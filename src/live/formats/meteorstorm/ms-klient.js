// ============================================================================
// Meteorstormen (#821): ELEVENS ANROP – ren logik, anropen injiceras (call),
// så den testas i node (test/live-meteorstorm-klient.test.js). Elevskärmen (D)
// får den bunden till Cloud Functions via meteorstorm-data.js skapaKlient().
//
// Elias 2026-10-21: svar och handling i ETT anrop. Klienten
//   • rättar multiplikationen själv (facit är a·b) – quiz frågar servern
//     (msRatta, ingen skrivning);
//   • håller ett rätt svar "väntande" tills eleven valt handling, och skickar
//     sedan svar + handling i msAgera;
//   • BUFFRAR fel svar och skickar dem med nästa msAgera (eller ensamma med
//     skickaFel() när matchen tar slut / bufferten blivit MS_FEL_SKICKA lång).
//   • minns nr (elevens länk i händelsekedjan), energin och quizets k – i
//     lagringen (sessionStorage) så att en omladdning inte tappar bufferten;
//     saknas läget frågar lage() servern (msLage).
//
// createMsKlient({ sid, uid, seed, gameMode, antalFragor?, call, lagring?, vanta? })
//   call(namn, data) → Promise<svar>   ("msAgera" | "msRatta" | "msLage")
//   lagring           { getItem, setItem } | null (valfri)
//   vanta(ms)         paus före ett omförsök (standard setTimeout)
// → {
//   svara(payload)    send för kistspelets createQuestionFlow (ks-fraga.js):
//                     → { correct, correctAnswer?, correctYear?, nextQ? }
//   fraga()           quizets fråga för nuvarande k (flow.setNextQ(...) före show())
//   agera(typ, mal?)  skickar det väntande svaret + handlingen → msAgera-svaret
//                     ({ correct, typ, energi, onskad?, nekad?, effekt, status … })
//   vantar()          finns ett rätt svar som väntar på handling?
//   skickaFel()       bufferten ensam (slutet) → { ok, fel } | null (tom)
//   lage()            msLage → { nr, energi, k, status }
//   energi, nr, k, buffert (kopia)
// }
// Fel från anropen kastas vidare ({ code, message, details? }); ett väntande
// svar och bufferten ligger kvar, så samma agera() kan köras igen (samma
// attemptId → servern svarar likadant, ingen dubbel handling).
// ============================================================================

import { fragaFor, MS_FEL_TAK, MS_FEL_SKICKA } from "./delat/ms-anrop.js";

const MULT = "multiplication_0_10";

function parseTal(v) {
  if (Number.isInteger(v)) return v;
  return typeof v === "string" && /^\s*\d{1,4}\s*$/.test(v) ? Number(v.trim()) : null;
}

export function createMsKlient({ sid, uid, seed, gameMode, antalFragor = 0, call, lagring = null, vanta = null }) {
  const quiz = gameMode !== MULT;
  const nyckel = `pp:ms:${sid}:${uid}`;
  const paus = vanta || ((ms) => new Promise((res) => setTimeout(res, ms)));
  let st = { nr: 0, energi: 0, k: 0, buffert: [] };
  let vantande = null;
  try {
    const sparat = JSON.parse(lagring?.getItem(nyckel) || "null");
    if (sparat && Array.isArray(sparat.buffert)) st = { ...st, ...sparat };
  } catch { /* privat läge / tom lagring – börja om */ }
  const spara = () => {
    try { lagring?.setItem(nyckel, JSON.stringify(st)); } catch { /* ingen lagring – bara minnet */ }
  };

  const fraga = () => fragaFor(seed, uid, st.k, antalFragor);

  function buffra(fel) {
    st.buffert.push(fel);
    if (st.buffert.length > MS_FEL_TAK * 2) st.buffert.splice(0, st.buffert.length - MS_FEL_TAK * 2);
    spara();
    if (st.buffert.length >= MS_FEL_SKICKA && !vantande) skickaFel().catch(() => {});
  }

  async function svara(p) {
    if (!quiz) {
      const svar = { factorA: p.factorA, factorB: p.factorB, answer: p.answer, ...(p.choiceIndex != null ? { choiceIndex: p.choiceIndex } : {}) };
      const ratt = parseTal(p.answer) === p.factorA * p.factorB;
      if (!ratt) {
        buffra({ ...svar, attemptId: p.attemptId });
        return { correct: false, correctAnswer: p.factorA * p.factorB };
      }
      vantande = { attemptId: p.attemptId, svar };
      return { correct: true, correctAnswer: p.factorA * p.factorB };
    }
    const k = st.k;
    const svar = { k, q: p.q, ...(p.choiceIndex != null ? { choiceIndex: p.choiceIndex } : {}), ...(p.year != null ? { year: p.year } : {}) };
    const res = await call("msRatta", { sid, svar });
    st.k = k + 1;
    if (res.correct) vantande = { attemptId: p.attemptId, svar };
    else buffra({ ...svar, attemptId: p.attemptId });
    spara();
    return { correct: res.correct === true, correctAnswer: res.correctAnswer, ...(res.correctYear != null ? { correctYear: res.correctYear } : {}), nextQ: fraga() };
  }

  async function agera(typ, mal = null) {
    if (!vantande) throw Object.assign(new Error("Svara rätt först."), { code: "failed-precondition" });
    const skickas = st.buffert.slice(0, MS_FEL_TAK);
    const data = { sid, attemptId: vantande.attemptId, svar: vantande.svar, typ, fel: skickas, ...(st.nr ? { nr: st.nr + 1 } : {}), ...(mal ? { mal } : {}) };
    let res;
    try {
      res = await call("msAgera", data);
    } catch (err) {
      const v = Number(err?.details?.vantaMs);
      if (err?.code !== "resource-exhausted" || !(v > 0)) throw err;
      await paus(v + 50);
      res = await call("msAgera", data);
    }
    vantande = null;
    if (res.correct) {
      st.buffert.splice(0, skickas.length);
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
    const skickas = st.buffert.slice(0, MS_FEL_TAK);
    const res = await call("msAgera", { sid, fel: skickas });
    st.buffert.splice(0, skickas.length);
    spara();
    return res;
  }

  async function lage() {
    const res = await call("msLage", { sid });
    st.nr = res.nr;
    st.energi = res.energi;
    if (Number.isInteger(res.k) && res.k + 1 > st.k) st.k = res.k + 1;
    spara();
    return res;
  }

  return {
    svara, fraga, agera, skickaFel, lage,
    vantar: () => !!vantande,
    get energi() { return st.energi; },
    get nr() { return st.nr; },
    get k() { return st.k; },
    get buffert() { return st.buffert.slice(); },
  };
}
