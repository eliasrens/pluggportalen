// ============================================================================
// Meteorstormen på SERVERN – rättningen (functions/meteorstorm-ratta.js, #821)
// ----------------------------------------------------------------------------
// Samma rättning som kistspelen (kistspel-rattning.js): multiplikationens
// facit räknas om, quiz/tidslinje mot det lärarskyddade facit (msPrivate).
// Quizfrågan måste vara elevens k:te i kortleken (ms-anrop.js fragaFor) –
// servern vet då vilken fråga eleven fick utan att spara något per svar.
// Samma k rättas bara EN gång per instans: första beskedet gäller (minnet),
// så den som fått fel inte kan pröva nästa alternativ.
//
//   rattaSvar(deps, sid, s, uid, svar) → { k (null för multiplikation), graded }
//   svarsFalt(graded, k, attemptId)    → svarets fält i händelsen
//   rattaFel(deps, sid, s, uid, lista) → de buffrade fel svaren, omrättade
//                                        (bara riktigt fel, högst MS_FEL_TAK)
//   ratta(deps, uid, raw)              → msRatta (bara quiz, skriver ingenting)
// ============================================================================

import { KsError, gradeMult, gradeQuiz, yearOut } from "./kistspel-rattning.js";
import { fragaFor, MS_FEL_TAK } from "./meteorstorm/ms-anrop.js";
import {
  minneOf, satt, sessionFor, playerFor, quizFor, assertLive, parseSid, bad, isInt, ATTEMPT_RE, MULT, QUIZ,
} from "./meteorstorm-sess.js";

const MAX_K = 1_000_000;
const MINNE_RATTNINGAR = 50_000;

async function rattaQuiz(deps, sid, s, uid, svar) {
  const k = svar?.k;
  if (!isInt(k, 0, MAX_K)) throw bad("Ogiltig fråga.");
  const { pub, priv } = await quizFor(deps, sid);
  const raw = { q: svar?.q };
  if (svar?.choiceIndex !== undefined) raw.choiceIndex = svar.choiceIndex;
  if (svar?.year !== undefined) raw.year = svar.year;
  const graded = gradeQuiz(s, raw, { nextQ: fragaFor(s.msSeed ?? 0, uid, k, (pub.questions || []).length) }, pub, priv);
  return { k, graded };
}

export async function rattaSvar(deps, sid, s, uid, svar) {
  if (s.gameMode === MULT) return { k: null, graded: gradeMult(s, svar || {}) };
  if (s.gameMode !== QUIZ) throw new KsError("failed-precondition", "Det här spelläget stöds inte i Meteorstormen.");
  const ut = await rattaQuiz(deps, sid, s, uid, svar);
  const m = minneOf(deps).rattat;
  const key = `${sid}|${uid}|${ut.k}`;
  const forst = m.get(key);
  if (forst === false) ut.graded = { ...ut.graded, isCorrect: false };
  else if (forst === undefined) satt(m, key, ut.graded.isCorrect, MINNE_RATTNINGAR);
  return ut;
}

export function svarsFalt(g, k, attemptId) {
  const ut = g.mode === MULT
    ? { factorA: g.factorA, factorB: g.factorB, answer: g.answer }
    : { q: g.q, answer: g.answer, ...(g.statKeys?.length ? { statKeys: g.statKeys } : {}), ...(k != null ? { k } : {}) };
  if (attemptId) ut.attemptId = attemptId;
  return ut;
}

export async function rattaFel(deps, sid, s, uid, lista) {
  if (!Array.isArray(lista)) return [];
  const ut = [];
  for (const f of lista.slice(0, MS_FEL_TAK)) {
    if (!f || typeof f !== "object") continue;
    const attemptId = typeof f.attemptId === "string" && ATTEMPT_RE.test(f.attemptId) ? f.attemptId : null;
    try {
      const { k, graded } = await rattaSvar(deps, sid, s, uid, f);
      if (graded.isCorrect === true) continue; // inte ett fel svar – räknas inte alls
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
  const { k, graded } = await rattaSvar(deps, sid, s, uid, raw?.svar);
  const n = ((await quizFor(deps, sid)).pub.questions || []).length;
  return {
    correct: graded.isCorrect === true, correctAnswer: graded.correctAnswer, ...yearOut(graded),
    k, nastaQ: fragaFor(s.msSeed ?? 0, uid, k + 1, n),
  };
}
