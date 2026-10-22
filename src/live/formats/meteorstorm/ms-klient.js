// ============================================================================
// Meteorstormen (#821): ELEVENS ANROP – ren logik, anropen injiceras (call),
// så den testas i node (test/live-meteorstorm-*.test.js). Elevskärmen (D)
// får den bunden till Cloud Functions via meteorstorm-data.js skapaKlient().
//
// Elias 2026-10-21: svar och handling i ETT anrop. Klienten
//   • delar ut frågorna ur elevens egen kortlek (ms-anrop.js): multiplikationen
//     ur multFor (källan() – servern godtar bara de faktorerna, #821 F1), quiz
//     ur fragaFor (fraga()). Varje fråga har ett nummer k; en fråga som inte
//     besvarats visas igen i stället för att hoppas över;
//   • rättar multiplikationen själv (facit är a·b) – quiz frågar servern
//     (msRatta, ingen skrivning);
//   • håller ett rätt svar "väntande" tills eleven valt handling, och skickar
//     sedan svar + handling i msAgera;
//   • BUFFRAR fel svar och skickar dem med nästa msAgera (servern kräver varje
//     överhoppat k där, #821 F2), ensamma när bufferten nått MS_FEL_SKICKA, och
//     resten med skickaFel() när matchen tar slut;
//   • minns nr (elevens länk i händelsekedjan), energin och k i lagringen
//     (sessionStorage), så att en omladdning inte tappar bufferten; saknas
//     läget, eller säger servern att ordningen inte stämmer (details.omsynk),
//     frågar lage() servern (msLage) och börjar om efter senaste länken.
//
// createMsKlient({ sid, uid, seed, gameMode, antalFragor?, call, lagring?, vanta? })
//   call(namn, data) → Promise<svar>   ("msAgera" | "msRatta" | "msLage")
//   lagring           { getItem, setItem } | null (valfri)
//   vanta(ms)         paus före ett omförsök (standard setTimeout)
// → {
//   svara(payload)    send för kistspelets createQuestionFlow (ks-fraga.js):
//                     → { correct, correctAnswer?, correctYear?, nextQ? }
//   kalla()           multiplikationens frågekälla { next() } – ersätter
//                     mode.createSource() i createQuestionFlow ({ ...mode, createSource: k.kalla })
//   fraga()           quizets fråga för nuvarande k (flow.setNextQ(...) före show())
//   agera(typ, mal?)  skickar det väntande svaret + handlingen → msAgera-svaret
//   vantar()          finns ett rätt svar som väntar på handling?
//   skickaFel()       bufferten ensam → { ok, fel } | null (tom)
//   lage()            msLage → { nr, energi, k, status }
//   energi, nr, k, buffert (kopia)
// }
// Fel från anropen kastas vidare ({ code, message, details? }); ett väntande
// svar och bufferten ligger kvar, så samma agera() kan köras igen (samma
// attemptId → servern svarar likadant, ingen dubbel handling).
// ============================================================================

import { fragaFor, multFor, MS_FEL_TAK, MS_FEL_SKICKA } from "./delat/ms-anrop.js";

const MULT = "multiplication_0_10";

function parseTal(v) {
  if (Number.isInteger(v)) return v;
  return typeof v === "string" && /^\s*\d{1,4}\s*$/.test(v) ? Number(v.trim()) : null;
}

const multFraga = (a, b, k) => ({ key: `${a}x${b}`, a, b, answer: a * b, tables: [...new Set([a, b])], text: `${a} × ${b}`, k });

export function createMsKlient({ sid, uid, seed, gameMode, antalFragor = 0, call, lagring = null, vanta = null }) {
  const quiz = gameMode !== MULT;
  const nyckel = `pp:ms:${sid}:${uid}`;
  const paus = vanta || ((ms) => new Promise((res) => setTimeout(res, ms)));
  // k = nästa frågas nummer; utdelad = multiplikationens obesvarade fråga (k).
  let st = { nr: 0, energi: 0, k: 0, utdelad: null, buffert: [] };
  let vantande = null;
  let skickar = null;
  try {
    const sparat = JSON.parse(lagring?.getItem(nyckel) || "null");
    if (sparat && Array.isArray(sparat.buffert)) st = { ...st, ...sparat };
  } catch { /* privat läge / tom lagring – börja om */ }
  const spara = () => {
    try { lagring?.setItem(nyckel, JSON.stringify(st)); } catch { /* ingen lagring – bara minnet */ }
  };
  const taBort = (skickade) => {
    const ids = new Set(skickade.map((f) => f.attemptId));
    st.buffert = st.buffert.filter((f) => !ids.has(f.attemptId));
  };

  const fraga = () => fragaFor(seed, uid, st.k, antalFragor);

  function kalla() {
    return {
      next() {
        if (st.utdelad == null) {
          st.utdelad = st.k;
          st.k += 1;
          spara();
        }
        const { a, b } = multFor(seed, uid, st.utdelad);
        return multFraga(a, b, st.utdelad);
      },
    };
  }

  function buffra(fel) {
    st.buffert.push(fel);
    spara();
    if (st.buffert.length >= MS_FEL_SKICKA && !vantande && !skickar) skickaFel().catch(() => {});
  }

  async function svara(p) {
    if (!quiz) {
      const k = st.utdelad ?? st.k - 1;
      const svar = { k, factorA: p.factorA, factorB: p.factorB, answer: p.answer, ...(p.choiceIndex != null ? { choiceIndex: p.choiceIndex } : {}) };
      st.utdelad = null;
      const ratt = parseTal(p.answer) === p.factorA * p.factorB;
      if (!ratt) {
        buffra({ ...svar, attemptId: p.attemptId });
        return { correct: false, correctAnswer: p.factorA * p.factorB };
      }
      vantande = { attemptId: p.attemptId, svar };
      spara();
      return { correct: true, correctAnswer: p.factorA * p.factorB };
    }
    const k = st.k;
    const svar = { k, q: p.q, ...(p.choiceIndex != null ? { choiceIndex: p.choiceIndex } : {}), ...(p.year != null ? { year: p.year } : {}) };
    let res;
    try {
      res = await call("msRatta", { sid, svar, nr: st.nr });
    } catch (err) {
      if (err?.details?.omsynk || err?.code === "failed-precondition") await lage().catch(() => {});
      throw err;
    }
    st.k = k + 1;
    if (res.correct) vantande = { attemptId: p.attemptId, svar };
    else buffra({ ...svar, attemptId: p.attemptId });
    spara();
    return { correct: res.correct === true, correctAnswer: res.correctAnswer, ...(res.correctYear != null ? { correctYear: res.correctYear } : {}), nextQ: fraga() };
  }

  async function agera(typ, mal = null) {
    if (!vantande) throw Object.assign(new Error("Svara rätt först."), { code: "failed-precondition" });
    const skickas = st.buffert.filter((f) => f.k < vantande.svar.k).slice(-MS_FEL_TAK);
    const data = { sid, attemptId: vantande.attemptId, svar: vantande.svar, typ, fel: skickas, ...(st.nr ? { nr: st.nr + 1 } : {}), ...(mal ? { mal } : {}) };
    let res;
    try {
      try {
        res = await call("msAgera", data);
      } catch (err) {
        const v = Number(err?.details?.vantaMs);
        if (err?.code !== "resource-exhausted" || !(v > 0)) throw err;
        await paus(v + 50);
        res = await call("msAgera", data);
      }
    } catch (err) {
      if (err?.details?.omsynk) {
        // Ordningen stämmer inte med servern (annan flik, tappad buffert):
        // börja om efter senaste länken – svaret och bufferten släpps.
        vantande = null;
        await lage().catch(() => {});
      }
      throw err;
    }
    vantande = null;
    if (res.correct) {
      taBort(skickas);
      st.buffert = st.buffert.filter((f) => f.k > res.k);
      st.nr = res.nr;
      st.energi = res.energi;
    } else {
      // Servern rättade svaret fel (bör inte hända) – det blir ett fel svar i bufferten.
      buffra({ ...data.svar, attemptId: data.attemptId });
    }
    spara();
    return res;
  }

  async function skickaFel() {
    if (!st.buffert.length) return null;
    const skickas = [...st.buffert].sort((a, b) => a.k - b.k).slice(0, MS_FEL_TAK);
    skickar = call("msAgera", { sid, fel: skickas, ...(st.nr ? { nr: st.nr + 1 } : {}) });
    try {
      const res = await skickar;
      taBort(skickas);
      if (Number.isInteger(res?.nr)) st.nr = res.nr;
      spara();
      return res;
    } finally {
      skickar = null;
    }
  }

  async function lage() {
    const res = await call("msLage", { sid });
    st.nr = res.nr;
    st.energi = res.energi;
    const k = Number.isInteger(res.k) ? res.k : -1;
    st.buffert = st.buffert.filter((f) => f.k > k);
    if (st.k <= k || (st.utdelad != null && st.utdelad <= k)) {
      st.k = k + 1;
      st.utdelad = null;
    }
    spara();
    return res;
  }

  return {
    svara, kalla, fraga, agera, skickaFel, lage,
    vantar: () => !!vantande,
    get energi() { return st.energi; },
    get nr() { return st.nr; },
    get k() { return st.k; },
    get buffert() { return st.buffert.slice(); },
  };
}
