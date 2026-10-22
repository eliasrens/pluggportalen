// ============================================================================
// Pluggporten – METEORSTORMEN på SERVERN (functions/meteorstorm-core.js, #821)
// ----------------------------------------------------------------------------
// Servern avgör allt som påverkar stormen: rättningen, energin, handlingarna
// (med serverns tid) och slutresultatet. Klienten skriver ALDRIG i ms-samlingarna
// (firestore.rules). index.js kör funktionerna med Admin SDK:t injicerat, så
// kärnan testas direkt mot Firestore-emulatorn med styrd klocka.
// Kontraktet: docs/METEORSTORMEN.md §7–§9. Motorn: ./meteorstorm/ (kopia av
// src/live/formats/meteorstorm/delat/). Delarna: -sess.js (sessionen, minnet),
// -ratta.js (rättningen, msRatta), -status.js (loggen, msPublic/status),
// -resultat.js (slutet), -mynt.js (pluggmynten).
//
// ANROPEN (Elias 2026-10-21: svar och handling i ETT anrop, EN skrivning)
//   agera   msAgera({ sid, attemptId, svar, typ, mal?, fel?, nr? })
//           svar = { factorA, factorB, answer, choiceIndex? } (multiplikation)
//                | { k, q, choiceIndex } | { k, q, year } (quiz, k = kortlekens nr)
//           typ  = "skold" | "laser" | "drag" | "spara"
//           Rätt svar → EN händelse msEvents/{uid}_{nr} med svaret, de buffrade
//           fel svaren (fel[]) och handlingen. En nekad handling (väntetid,
//           dragstrålen inte redo, för lite energi) sparas som "spara" – energin
//           går aldrig förlorad. Fel svar (servern rättar om) skriver ingenting.
//           → { correct, nr, typ, energi, vinst, kostnad, handelse, effekt,
//               onskad?, nekad?, redoMs?, k?, igen?, status }
//           Utan svar: msAgera({ sid, fel }) skickar bara felbufferten (slutet
//           av matchen, eller när bufferten blivit lång) → msPlayers/{uid}.fel.
//   ratta   msRatta – se meteorstorm-ratta.js (bara quiz, skriver ingenting)
//   lage    msLage({ sid }) → { nr, energi, k, status } – elevens läge efter omladdning
//   avsluta msAvsluta({ sid }) – lärare (när som helst; live → avslutas nu) eller
//           deltagare efter slutet. Kör motorn med HELA loggen, sparar result,
//           msPlayers-totalerna och sista msPublic/status. Idempotent.
//
// ENERGIN: varje händelse bär elevens energi EFTER handlingen. Händelserna
// bildar en kedja per elev (id {uid}_{nr}, nr = 1, 2 …): nästa handling läser
// bara föregående länk i transaktionen – ingen skrivning per svar i msPlayers.
// Två samtidiga anrop krockar på samma länk; den ena får nästa nr och kör om.
// Länken ger också idempotens (samma attemptId → samma svar) och spärren
// MS_MIN_GAP_MS mellan två handlingar.
//
// DRAGSTRÅLEN: kanAgera körs i SAMMA transaktion som händelsen skrivs, mot
// loggen + stationens låsdokument msLas/{classId} (senaste dragstrålen), som
// transaktionen läser och skriver. Två dragstrålar samtidigt från samma
// station krockar där – den andra ser den första och nekas ("armerad").
//
// deps = { db, FieldValue, Timestamp, now(), sleep?(ms), minne?, roll?(auth) }
// ============================================================================

import { KsError, yearOut } from "./kistspel-rattning.js";
import { matchWindow } from "./kistspel-core.js";
import { kanAgera, energiEffekt, effektPerTryck } from "./meteorstorm/ms-agera.js";
import { ENERGI_TAK, HANDLINGAR, RENDER_FORDROJNING_MS } from "./meteorstorm/ms-balans.js";
import { MS_MIN_GAP_MS, MS_EFTER_SLUT_MS, MS_AVSLUTA_VANTA_MS, MS_TYPER } from "./meteorstorm/ms-anrop.js";
import {
  minneOf, satt, refs, parseSid, parseAttempt, sessionFor, slutFor, assertLive, playerFor, quizFor,
  stationerFor, stationerOk, raknaStationer, cfgFor, bad, isInt, fel, QUIZ,
} from "./meteorstorm-sess.js";
import { rattaSvar, rattaFel, svarsFalt, ratta } from "./meteorstorm-ratta.js";
import { uppdateraLogg, laggTillLogg, somHandling, statusFran, statusUrMinnet, kanskeStatus } from "./meteorstorm-status.js";
import { byggResultat } from "./meteorstorm-resultat.js";

export { KsError, ratta };
export { nyttMinne } from "./meteorstorm-sess.js";

const OMSYNK = Symbol("omsynk");
const finnsRedan = (err) => err?.code === 6 || err?.code === "already-exists" || /ALREADY_EXISTS/.test(String(err?.message || ""));

function parseMal(v, s, egen) {
  if (v == null) return null;
  if (typeof v !== "string" || v === egen || !(s.participatingClassIds || []).includes(v)) throw bad("Ogiltigt mål för dragstrålen.");
  return v;
}

/** Elevens senaste länk (omladdning, eller när klientens nr inte stämmer). */
async function senaste(deps, sid, uid) {
  const snap = await refs(deps.db, sid).events.where("uid", "==", uid).get();
  let best = null;
  for (const d of snap.docs) {
    const h = d.data();
    if (Number.isInteger(h.nr) && (!best || h.nr > best.nr)) best = h;
  }
  return best;
}

function utFran(h, extra = {}) {
  return {
    correct: true, nr: h.nr, typ: h.typ, energi: h.energi, vinst: h.vinst, kostnad: h.kostnad, handelse: h.handelse ?? null,
    ...(h.onskad ? { onskad: h.onskad, nekad: h.nekad } : {}),
    ...(h.redoMs != null ? { redoMs: h.redoMs } : {}),
    ...(Number.isInteger(h.k) ? { k: h.k } : {}),
    ...extra,
  };
}

async function skickaFel(deps, sid, s, uid, p, felLista, now) {
  const w = matchWindow(s);
  if (!w || now < w.t0 || now > slutFor(s) + MS_EFTER_SLUT_MS) throw new KsError("failed-precondition", "Matchen pågår inte.");
  if (!felLista.length) return { ok: true, fel: 0 };
  const m = minneOf(deps).felSkickat;
  const key = `${sid}/${uid}`;
  if (now - (m.get(key) ?? -Infinity) < MS_MIN_GAP_MS) throw fel("resource-exhausted", "Ett ögonblick …", { vantaMs: MS_MIN_GAP_MS });
  satt(m, key, now, 5000);
  await refs(deps.db, sid).msPlayer(uid).set({
    uid, classId: p.classId, name: p.name, fel: deps.FieldValue.arrayUnion(...felLista),
  }, { merge: true });
  return { ok: true, fel: felLista.length };
}

/**
 * Transaktionens beslut: energi, väntetid, dragstråle → händelsen (eller
 * { igen } om föregående länk redan är det här försöket).
 */
function beslut({ cfg, t, prev, k, typ, mal, p, logg, senastDrag }) {
  const eff = energiEffekt(cfg, t);
  const fore = Number(prev?.energi) || 0;
  let kostnad = 0;
  let nekad = null;
  let redoMs = null;
  if (typ !== "spara") {
    let input = cfg;
    if (logg) {
      const lista = [...logg.lista.values()];
      if (senastDrag?.id && !logg.lista.has(senastDrag.id)) lista.push(somHandling(senastDrag.id, senastDrag));
      input = { ...cfg, handlingar: lista };
    }
    const ka = kanAgera(input, t, p.classId, typ);
    if (!ka.ok) {
      nekad = ka.orsak;
      redoMs = ka.redoMs ?? null;
    } else if (fore + eff.energi < ka.kostnad) {
      nekad = "energi";
    } else {
      kostnad = ka.kostnad;
    }
  }
  const utfort = nekad ? "spara" : typ;
  return {
    t, typ: utfort, energi: Math.min(ENERGI_TAK, fore + eff.energi - kostnad), vinst: eff.energi, kostnad, handelse: eff.handelse,
    ...(utfort === "drag" && mal ? { mal } : {}),
    ...(nekad ? { onskad: typ, nekad } : {}),
    ...(redoMs != null ? { redoMs } : {}),
    ...(k != null ? { k } : {}),
  };
}

export async function agera(deps, uid, raw) {
  const { db, FieldValue } = deps;
  const sid = parseSid(raw);
  const s = await sessionFor(deps, sid);
  const p = await playerFor(deps, sid, uid, s);
  if (raw?.svar == null) {
    const felLista = await rattaFel(deps, sid, s, uid, raw?.fel);
    return skickaFel(deps, sid, s, uid, p, felLista, deps.now());
  }
  assertLive(s, deps.now());
  const typ = raw?.typ;
  if (!MS_TYPER.includes(typ)) throw bad("Välj sköld, laser, dragstråle eller spara.");
  const mal = typ === "drag" ? parseMal(raw?.mal, s, p.classId) : null;
  const attemptId = parseAttempt(raw);
  const { k, graded } = await rattaSvar(deps, sid, s, uid, raw.svar);
  if (!graded.isCorrect) {
    // Fel svar påverkar inte spelet och skrivs inte – klienten buffrar det.
    return { correct: false, correctAnswer: graded.correctAnswer, ...yearOut(graded), ...(k != null ? { k } : {}) };
  }
  const felLista = await rattaFel(deps, sid, s, uid, raw?.fel);
  await stationerFor(deps, sid, s);
  const cfg = cfgFor(s);
  const r = refs(db, sid);
  const logg = typ === "drag" ? await uppdateraLogg(deps, sid) : null;
  const statusNu = () => statusUrMinnet(deps, sid, cfg, deps.now());
  let nr = isInt(raw?.nr, 1, 1_000_000) ? raw.nr : null;
  for (let forsok = 0; forsok < 4; forsok++) {
    if (nr == null) nr = ((await senaste(deps, sid, uid))?.nr || 0) + 1;
    const id = `${uid}_${nr}`;
    const prevRef = nr > 1 ? r.ev(uid, nr - 1) : null;
    const lasRef = logg ? r.las(p.classId) : null;
    try {
      const ut = await db.runTransaction(async (tx) => {
        const las = [prevRef, lasRef].filter(Boolean);
        const snaps = las.length ? await tx.getAll(...las) : [];
        const prevSnap = prevRef ? snaps[0] : null;
        const lasSnap = lasRef ? snaps[snaps.length - 1] : null;
        if (prevRef && !prevSnap.exists) throw OMSYNK;
        const prev = prevSnap ? prevSnap.data() : null;
        if (prev && prev.attemptId === attemptId) return { igen: prev };
        const t = Number(deps.now());
        assertLive(s, t);
        if (prev && t - prev.t < MS_MIN_GAP_MS) {
          throw fel("resource-exhausted", "Lugn i stormen – ett svar i taget!", { vantaMs: MS_MIN_GAP_MS - (t - prev.t) });
        }
        if (k != null && prev && Number.isInteger(prev.k) && k <= prev.k) {
          throw new KsError("failed-precondition", "Den frågan är redan besvarad.");
        }
        const b = beslut({ cfg, t, prev, k, typ, mal, p, logg, senastDrag: lasSnap?.exists ? lasSnap.data() : null });
        const h = {
          uid, classId: p.classId, namn: p.name, nr, attemptId, ...b,
          svar: svarsFalt(graded, k, null), fel: felLista, at: FieldValue.serverTimestamp(),
        };
        tx.create(r.ev(uid, nr), h);
        if (h.typ === "drag") tx.set(lasRef, { id, t: h.t, classId: p.classId, uid, typ: "drag", ...(mal ? { mal } : {}) });
        return { ny: h };
      });
      if (ut.igen) return utFran(ut.igen, { igen: true, status: statusNu() });
      const h = ut.ny;
      if (HANDLINGAR.includes(h.typ)) laggTillLogg(deps, sid, id, h);
      const skrev = await kanskeStatus(deps, sid, s, deps.now()).catch(() => null);
      const effekt = h.typ === "skold" || h.typ === "laser" ? { [h.typ]: effektPerTryck(cfg, p.classId)[h.typ] } : null;
      return utFran(h, { effekt, status: skrev || statusNu() });
    } catch (err) {
      if (err === OMSYNK) {
        nr = null;
        continue;
      }
      if (finnsRedan(err)) {
        const d = (await r.ev(uid, nr).get()).data();
        if (d?.attemptId === attemptId) return utFran(d, { igen: true, status: statusNu() });
        nr = null;
        continue;
      }
      throw err;
    }
  }
  throw new KsError("aborted", "Många svar samtidigt – försök igen.");
}

export async function lage(deps, uid, raw) {
  const sid = parseSid(raw);
  const s = await sessionFor(deps, sid);
  await playerFor(deps, sid, uid, s);
  const h = await senaste(deps, sid, uid);
  let status = statusUrMinnet(deps, sid, cfgFor(s), deps.now());
  if (!status) status = (await refs(deps.db, sid).status.get()).data() || null;
  if (status?.uppdaterad) delete status.uppdaterad;
  return { nr: h?.nr || 0, energi: h?.energi || 0, k: Number.isInteger(h?.k) ? h.k : null, status };
}

/** Läraren som styr matchen (samma som reglernas liveTeacherOf). */
function larareFor(roll, s) {
  if (!roll) return false;
  if (roll.role === "admin") return true;
  return (s.participatingClassIds || []).some((c) => (roll.classIds || []).includes(c));
}

/** msAvsluta. deps.roll(auth) = callerRole (index.js) – null för elever. → { result, redan } */
export async function avsluta(deps, auth, raw) {
  const { db, FieldValue, Timestamp } = deps;
  const sid = parseSid(raw);
  const r = refs(db, sid);
  let s = await sessionFor(deps, sid, { farsk: true });
  const w = matchWindow(s);
  if (!w) throw new KsError("failed-precondition", "Matchen har inte startat.");
  if (s.result) return { result: s.result, redan: true };
  if (!larareFor(deps.roll ? await deps.roll(auth) : null, s)) {
    await playerFor(deps, sid, auth?.uid, s);
    if (s.status !== "finished" && deps.now() < w.end) throw new KsError("failed-precondition", "Stormen pågår fortfarande.");
  }
  if (s.status !== "finished") {
    const now = deps.now();
    await db.runTransaction(async (tx) => {
      if ((await tx.get(r.sess)).data().status !== "finished") tx.update(r.sess, { status: "finished", finishedAt: Timestamp.fromMillis(now) });
    });
    s = await sessionFor(deps, sid, { farsk: true });
  }
  const slut = slutFor(s);
  // De sista felbuffrarna (elevskärmarna skickar dem när de ser slutet).
  const vanta = Math.min(MS_AVSLUTA_VANTA_MS, slut + MS_AVSLUTA_VANTA_MS - deps.now());
  if (vanta > 0) await (deps.sleep || ((ms) => new Promise((res) => setTimeout(res, ms))))(vanta);

  const [evSnap, mpSnap, plSnap] = await Promise.all([r.events.get(), r.msPlayers.get(), r.players.get()]);
  const players = plSnap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  if (!stationerOk(s)) s = { ...s, msStationer: raknaStationer(s, players) };
  const cfg = cfgFor(s);
  const events = evSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const { result, spelare } = byggResultat({
    s, cfg, slutMs: slut, events, players,
    extraFel: Object.fromEntries(mpSnap.docs.map((d) => [d.id, d.data().fel || []])),
    questions: s.gameMode === QUIZ ? (await quizFor(deps, sid)).pub.questions || [] : null,
  });
  const handlingar = events.filter((h) => HANDLINGAR.includes(h.typ) && h.t <= slut).map((h) => somHandling(h.id, h));
  const slutStatus = {
    ...statusFran(cfg, handlingar, Math.max(slut, cfg.startMs) + RENDER_FORDROJNING_MS),
    klart: true,
    resultat: {
      lage: result.lage, winner: result.winner, draw: result.draw, placering: result.placering,
      ...(result.lage === "en-klass" ? { stjarnor: result.stjarnor, overlevde: result.overlevde } : {}),
    },
  };
  return db.runTransaction(async (tx) => {
    const d = (await tx.get(r.sess)).data();
    if (d.result) return { result: d.result, redan: true };
    tx.update(r.sess, {
      result: { ...result, computedAt: FieldValue.serverTimestamp() },
      ...(stationerOk(d) ? {} : { msStationer: s.msStationer }),
    });
    for (const [id, tot] of Object.entries(spelare)) tx.set(r.msPlayer(id), { ...tot, klar: true }, { merge: true });
    tx.set(r.status, { ...slutStatus, uppdaterad: FieldValue.serverTimestamp() });
    return { result, redan: false };
  });
}
