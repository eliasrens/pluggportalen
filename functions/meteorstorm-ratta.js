// ============================================================================
// Meteorstormen på SERVERN – rättningen (functions/meteorstorm-ratta.js, #821)
// ----------------------------------------------------------------------------
// Samma rättning som kistspelen (kistspel-rattning.js): multiplikationens
// facit räknas om, quiz/tidslinje mot det lärarskyddade facit (msPrivate).
// Varje svar bär k = elevens fråga nr k (ms-anrop.js): quizfrågan måste vara
// fragaFor(seed, uid, k) och multiplikationens faktorer multFor(seed, uid, k)
// (#821 F1 – inga valfria faktorer). Servern vet då vilken fråga eleven fick
// utan att spara något per svar. Samma k rättas bara EN gång per instans:
// första beskedet gäller (minnet), så den som fått fel inte kan pröva nästa
// alternativ.
//
//   rattaSvar(deps, sid, s, uid, svar) → { k, graded }
//   svarsFalt(graded, k, attemptId)    → svarets fält i händelsen
//   rattaFel(deps, sid, s, uid, lista) → de buffrade fel svaren, omrättade
//                                        (bara riktigt fel, ett per k, högst MS_FEL_TAK)
//   ratta(deps, uid, raw)              → msRatta (bara quiz, skriver ingenting).
//                                        k måste ligga efter elevens senaste länk och
//                                        högst MS_K_FONSTER före den (#821 F2)
// ============================================================================

import { KsError, gradeMult, gradeQuiz, yearOut } from "./kistspel-rattning.js";
import { fragaFor, multFor, MS_FEL_TAK, MS_K_FONSTER } from "./meteorstorm/ms-anrop.js";
import {
  minneOf, satt, sessionFor, playerFor, quizFor, assertLive, parseSid, bad, isInt, lankFor, ATTEMPT_RE, MULT, QUIZ,
} from "./meteorstorm-sess.js";

const MAX_K = 1_000_000;
const MINNE_RATTNINGAR = 50_000;

function parseK(svar) {
  const k = svar?.k;
  if (!isInt(k, 0, MAX_K)) throw bad("Ogiltig fråga.");
  return k;
}

async function rattaQuiz(deps, sid, s, uid, svar, k) {
  const { pub, priv } = await quizFor(deps, sid);
  const raw = { q: svar?.q };
  if (svar?.choiceIndex !== undefined) raw.choiceIndex = svar.choiceIndex;
  if (svar?.year !== undefined) raw.year = svar.year;
  return gradeQuiz(s, raw, { nextQ: fragaFor(s.msSeed ?? 0, uid, k, (pub.questions || []).length) }, pub, priv);
}

function rattaMult(s, uid, svar, k) {
  const { a, b } = multFor(s.msSeed ?? 0, uid, k);
  if (svar?.factorA !== a || svar?.factorB !== b) throw new KsError("failed-precondition", "Svara på frågan du fick.");
  return gradeMult(s, svar);
}

export async function rattaSvar(deps, sid, s, uid, svar) {
  if (s.gameMode !== MULT && s.gameMode !== QUIZ) throw new KsError("failed-precondition", "Det här spelläget stöds inte i Meteorstormen.");
  const k = parseK(svar);
  let graded = s.gameMode === MULT ? rattaMult(s, uid, svar, k) : await rattaQuiz(deps, sid, s, uid, svar, k);
  const m = minneOf(deps).rattat;
  const key = `${sid}|${uid}|${k}`;
  const forst = m.get(key);
  if (forst === false) graded = { ...graded, isCorrect: false };
  else if (forst === undefined) satt(m, key, graded.isCorrect, MINNE_RATTNINGAR);
  return { k, graded };
}

export function svarsFalt(g, k, attemptId) {
  const ut = g.mode === MULT
    ? { factorA: g.factorA, factorB: g.factorB, answer: g.answer, k }
    : { q: g.q, answer: g.answer, ...(g.statKeys?.length ? { statKeys: g.statKeys } : {}), k };
  if (attemptId) ut.attemptId = attemptId;
  return ut;
}

export async function rattaFel(deps, sid, s, uid, lista) {
  if (!Array.isArray(lista)) return [];
  const ut = [];
  const sett = new Set();
  for (const f of lista.slice(0, MS_FEL_TAK)) {
    if (!f || typeof f !== "object" || sett.has(f.k)) continue;
    const attemptId = typeof f.attemptId === "string" && ATTEMPT_RE.test(f.attemptId) ? f.attemptId : null;
    try {
      const { k, graded } = await rattaSvar(deps, sid, s, uid, f);
      if (graded.isCorrect === true) continue; // inte ett fel svar – räknas inte alls
      sett.add(k);
      ut.push({ ...svarsFalt(graded, k, attemptId), isCorrect: false });
    } catch (err) {
      if (!(err instanceof KsError)) throw err; // ogiltig post – hoppas över
    }
  }
  return ut;
}

export async function ratta(deps, uid, raw) {
  const sid = parseSid(raw);
  const s = await sessionFor(deps, sid);
  await playerFor(deps, sid, uid, s);
  if (s.gameMode !== QUIZ) throw new KsError("failed-precondition", "Multiplikationen rättas i elevens skärm.");
  assertLive(s, deps.now());
  const k = parseK(raw?.svar);
  let lank = await lankFor(deps, sid, uid, raw?.nr);
  if (k > lank.k + MS_K_FONSTER) lank = await lankFor(deps, sid, uid, raw?.nr, { farsk: true });
  if (k <= lank.k) throw new KsError("failed-precondition", "Den frågan är redan besvarad.");
  if (k > lank.k + MS_K_FONSTER) throw new KsError("failed-precondition", "Svara på frågorna i ordning.");
  const { graded } = await rattaSvar(deps, sid, s, uid, raw?.svar);
  const n = ((await quizFor(deps, sid)).pub.questions || []).length;
  return {
    correct: graded.isCorrect === true, correctAnswer: graded.correctAnswer, ...yearOut(graded),
    k, nastaQ: fragaFor(s.msSeed ?? 0, uid, k + 1, n),
  };
}
