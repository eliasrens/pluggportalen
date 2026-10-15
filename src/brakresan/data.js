// ============================================================================
// Bråkresan – klientens dataskikt (src/brakresan/data.js) · #708
// ----------------------------------------------------------------------------
// Laddas bara LAT (Bråkresan-routen, lärarvyn) – aldrig i bootgrafen (#271).
// Tunna omslag runt callables (functions/brakresan-core.js) och läsningar.
// Klienten skickar bara SVAR; rätt/fel, stjärnor, mynt och drake avgörs på
// servern (spec §13). Inga skrivningar till Firestore härifrån.
//
// Elev (callables – nätfel försöks igen med SAMMA id, servern är idempotent):
//   startRound(challengeId, { restart?, replaceRoundId? }) → { roundId, resumed, round }
//   answer(roundId, index, answer, helpBefore?)  → { status: "graded", correct, reason, message,
//                                                   reveal, answeredCount, correctCount, already }
//                                                 | { status: "invalid", error, message } (låser inte)
//   rework(roundId, index, { answer?, helpAfter?, attemptId? }) → { status, correct?, message?, reworkCount }
//   finishRound(roundId) → { correctCount, reward, message, rewardText, stars, totalStars,
//                            dragon: { levelBefore, levelAfter, hatched }, coinsAfter, already }
//   abortRound(roundId)  → { status: "avbruten" }
//   ackDragon(level)     → { levelShown }
//   renameDragon(name)   → { name } – servern rensar texten (#713); ägget → BrakresaFel
//   newAttemptId()       → id för ett bearbetningsförsök (skicka samma vid omförsök)
//   saveStatus.subscribe(cb) → avregistrera; cb("vilar"|"sparar"|"sparat"|"offline"|"fel")
//   drafts.save/load/clear(roundId, index[, answer]) – osparad inmatning lokalt
//   Fel: BrakresaFel { code, message, retryable } – retryable = nätet, försök igen.
//
// Läsningar (eleven sitt eget, läraren egna elever – firestore.rules):
//   getState(studentId?)          → state (DATAMODELL.md) med standardvärden; EN läsning
//   getRound(roundId, studentId?) → omgångsdokumentet eller null
//   getClassStates(studentIds)    → Map(studentId → state) – EN läsning per elev (#231)
//   listRounds(studentId, { challengeId?, limit? }) → avslutade omgångar, nyast först
//   getRecommendations(classIds) → elevens aktiva rekommendationer (egna + klassernas)
//
// Demonstrationsläget (Prova ett exempel, lärarens testläge) skriver aldrig: demo.js.
// ============================================================================

import { app, db } from "../firebase-config.js";
import {
  collection, doc, getDoc, getDocs, limit as qLimit, orderBy, query, where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { currentStudentId, invalidateStudentData } from "../data.js";
import { BrakresaFel, callWithRetry, createDrafts, createSaveStatus } from "./data-core.js";

export { BrakresaFel };

const REGION = "europe-west1";
const TIMEOUT_MS = 20_000;

export const saveStatus = createSaveStatus();
export const drafts = createDrafts(globalThis.localStorage);

const calls = new Map();
function callable(name) {
  if (!calls.has(name)) {
    const fns = getFunctions(app, globalThis.__PP_FUNCTIONS_URL || REGION);
    calls.set(name, httpsCallable(fns, name, { timeout: TIMEOUT_MS }));
  }
  return calls.get(name);
}
const call = (name, data) => callWithRetry(callable(name), data, { status: saveStatus });

export const startRound = (challengeId, { restart = false, replaceRoundId = null } = {}) =>
  call("brakresaStartRound", { challengeId, ...(restart ? { restart: true } : {}), ...(replaceRoundId ? { replaceRoundId } : {}) });

export const answer = (roundId, index, ans, helpBefore = []) =>
  call("brakresaAnswer", { roundId, index, answer: ans, helpBefore });

export const rework = (roundId, index, { answer: ans = null, helpAfter = [], attemptId = null } = {}) =>
  call("brakresaRework", { roundId, index, ...(ans ? { answer: ans } : {}), helpAfter, ...(attemptId ? { attemptId } : {}) });

export async function finishRound(roundId) {
  const res = await call("brakresaFinishRound", { roundId });
  // Saldot (och draken) ändrades på servern – sidomenyn läser om studentData.
  // Även vid already: ett tappat första svar kan ha betalat.
  if (res?.reward?.kind === "stjarna" || res?.reward?.kind === "uppmuntran" || res?.dragon?.hatched) {
    invalidateStudentData(currentStudentId());
  }
  return res;
}

export const abortRound = (roundId) => call("brakresaAbortRound", { roundId });
export const ackDragon = (level) => call("brakresaAckDragon", { level });

export async function renameDragon(name) {
  const res = await call("brakresaRenameDragon", { name });
  invalidateStudentData(currentStudentId()); // husposten (brakdrake.name) ändrades
  return res;
}

export function newAttemptId() {
  const a = new Uint32Array(3);
  globalThis.crypto.getRandomValues(a);
  return Array.from(a, (n) => n.toString(36)).join("-");
}

// --- läsningar -------------------------------------------------------------------

const EMPTY_STATE = Object.freeze({
  schema: 1, totalStars: 0, mastered: 0, challenges: {}, encouragementCoins: 0,
  totals: { roundsCompleted: 0, roundsAborted: 0, firstCorrect: 0, firstTotal: 0, helpBefore: 0, helpAfter: 0 },
  dragon: null, hunts: { count: 0, coins: 0, lastDate: null }, lastActivityAt: null,
});

const withDefaults = (d) => ({
  ...EMPTY_STATE, ...(d || {}),
  challenges: { ...(d?.challenges || {}) },
  totals: { ...EMPTY_STATE.totals, ...(d?.totals || {}) },
  hunts: { ...EMPTY_STATE.hunts, ...(d?.hunts || {}) },
});

export async function getState(studentId = currentStudentId()) {
  const snap = await getDoc(doc(db, "studentData", studentId, "brakresa", "state"));
  return withDefaults(snap.exists() ? snap.data() : null);
}

export async function getRound(roundId, studentId = currentStudentId()) {
  const snap = await getDoc(doc(db, "studentData", studentId, "brakresaRounds", roundId));
  return snap.exists() ? snap.data() : null;
}

export async function getClassStates(studentIds) {
  const list = await Promise.all(studentIds.map(async (id) => {
    try {
      return [id, await getState(id)];
    } catch {
      return [id, null]; // ingen behörighet / borttagen elev – vyn visar "–"
    }
  }));
  return new Map(list);
}

/**
 * Avslutade omgångar, nyast först. Med challengeId används det sammansatta
 * indexet (challengeId, status, finishedAt) i firestore.indexes.json.
 */
export async function listRounds(studentId, { challengeId = null, limit = 20 } = {}) {
  const col = collection(db, "studentData", studentId, "brakresaRounds");
  const q = challengeId
    ? query(col, where("challengeId", "==", challengeId), where("status", "==", "avslutad"), orderBy("finishedAt", "desc"), qLimit(limit))
    : query(col, orderBy("startedAt", "desc"), qLimit(limit));
  return (await getDocs(q)).docs.map((d) => d.data());
}

/**
 * Elevens aktiva rekommendationer (spec §11/§12, K #716): de som gäller eleven
 * själv + de som gäller någon av elevens klasser. Frågorna filtrerar på
 * studentId/classId så som firestore.rules kräver. Fel → tom lista (frivillig del).
 */
export async function getRecommendations(classIds = [], studentId = currentStudentId()) {
  const col = collection(db, "brakresaRecommendations");
  const fragor = [
    query(col, where("studentId", "==", studentId), where("active", "==", true)),
    ...classIds.slice(0, 10).map((id) => query(col, where("classId", "==", id), where("active", "==", true))),
  ];
  const svar = await Promise.all(fragor.map((q) => getDocs(q).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))).catch(() => [])));
  return svar.flat();
}
