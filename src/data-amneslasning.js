// ============================================================================
// Pluggporten – Ämnesläsning, Firestore-brygga (data-amneslasning.js)  ·  #671
// ----------------------------------------------------------------------------
// Tunn brygga mellan Ämnesläsningens rena kärna (src/amneslasning/) och
// Firestore. Allt i EN transaktion per textavslut:
//   studentData/{id}.lasresa       – den DELADE dolda läsnivån + streaks (bara
//                                    de fälten ändras; skrivs via toStoredLasresa)
//   studentData/{id}.amneslasning  – läst-lista + påbörjad text per område
//   studentData/{id}/lasresaAttempts/{auto} – försöket, source "amnesläsning"
// Läsresans resa (worldId/stepInWorld/seenTextIds/currentTextId) rörs aldrig.
// Spec: docs/UTVECKLINGSUPPDRAG_AMNESLASNING.md §3, §5, §8.
//
// Samma degradering som Läsresan: nekas lasresaAttempts sparas försöket i
// studentData.lasresaAttemptsFallback. Mynten (5/rätt, omläsningstrappa) läggs
// på det vanliga saldot via rewards.award → data.addCoins, som Läsresans.
//
// Importeras BARA dynamiskt (Ämnesläsningens vy) – aldrig statiskt från app.js
// (bootgrafen, #271 / incident 2026-09-10).
// ============================================================================

import { db } from "./firebase-config.js";
import { collection, doc, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { currentStudentId, getStudentData, defaultStudentData, invalidateStudentData } from "./data.js";
import { ATTEMPTS_SUBCOLLECTION, FALLBACK_FIELD, FALLBACK_ATTEMPTS_MAX } from "./data-lasresan.js";
import { getStudentStartLevel } from "./data-lasresan-niva.js";
import { normalizeLasresa } from "./lasresan/progress.js";
import { toStoredLasresa } from "./lasresan/level-scale.js";
import { award } from "./lasresan/rewards.js";
import { WORLDS } from "./lasresan/worlds/index.js";
import { amnesLevelFor } from "./amneslasning/level.js";
import {
  applyAmnesCompletion,
  areaOf,
  buildAmnesAttempt,
  normalizeAmneslasning,
  previousReads,
  withStartedAmnesText,
} from "./amneslasning/progress.js";

export const AMNES_FIELD = "amneslasning";

function requireId(studentId) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  return studentId;
}

const isPermissionDenied = (err) =>
  !!err && (err.code === "permission-denied" || /insufficient permissions/i.test(err.message || ""));

/**
 * Elevens ämnesnivå (1–3) och områdets tillstånd (läst-lista, påbörjad text).
 * Läsnivån läses som Läsresan (klassens startnivå för elev som inte börjat).
 * OBS: `amnesLevel` styr textvalet – visa den aldrig för eleven.
 * @returns {Promise<{amnesLevel:number, area:object}>}
 */
export async function getAmnesArea(subjectId, areaId, studentId = currentStudentId()) {
  const sd = await getStudentData(requireId(studentId));
  const raw = sd && sd.lasresa;
  const startLevel = raw ? undefined : await getStudentStartLevel(studentId);
  const level = normalizeLasresa(raw, WORLDS, { startLevel }).level;
  return { amnesLevel: amnesLevelFor(level), area: areaOf(sd && sd[AMNES_FIELD], areaId, subjectId) };
}

/**
 * Starta en ämnestext i ett område. Finns redan en påbörjad text där
 * returneras den (återupptas). `force: true` bara när den påbörjade texten
 * inte längre finns i området.
 * @returns {Promise<{textId:string, resumed:boolean}>}
 */
export async function startAmnesText({ subjectId, areaId, textId }, studentId = currentStudentId(), { force = false } = {}) {
  requireId(studentId);
  if (!areaId || !textId) throw new Error("areaId och textId krävs.");
  const ref = doc(db, "studentData", studentId);
  const res = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const sd = snap.exists() ? snap.data() : null;
    const out = withStartedAmnesText(sd && sd[AMNES_FIELD], { subjectId, areaId, textId }, Date.now(), { force });
    if (!out.resumed) {
      const patch = { [AMNES_FIELD]: out.amneslasning };
      if (snap.exists()) tx.update(ref, patch);
      else tx.set(ref, { ...defaultStudentData(), ...patch });
    }
    return { textId: out.textId, resumed: out.resumed };
  });
  invalidateStudentData(studentId);
  return res;
}

function completeTx(ref, studentId, ctx, startLevel, completedAt, withSubcollection) {
  const { subjectId, areaId, text, answers } = ctx;
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const sd = snap.exists() ? snap.data() : null;
    const amnes = normalizeAmneslasning(sd && sd[AMNES_FIELD]);
    const area = areaOf(amnes, areaId, subjectId);
    if (area.currentTextId !== text.id) {
      return { ok: false, reason: area.currentTextId ? "other-text-active" : "not-started" };
    }
    const lasresa = normalizeLasresa(sd && sd.lasresa, WORLDS, { startLevel });
    const attempt = buildAmnesAttempt(text, answers, {
      subjectId: area.subjectId || subjectId,
      areaId,
      prevReads: previousReads(area, text.id),
      startedAt: area.currentStartedAt,
      completedAt,
      studentId,
    });
    const out = applyAmnesCompletion({ lasresa, amneslasning: amnes }, attempt, completedAt);
    const patch = { lasresa: toStoredLasresa(out.lasresa), [AMNES_FIELD]: out.amneslasning };
    if (withSubcollection) {
      tx.set(doc(collection(ref, ATTEMPTS_SUBCOLLECTION)), attempt);
    } else {
      const prev = Array.isArray(sd && sd[FALLBACK_FIELD]) ? sd[FALLBACK_FIELD] : [];
      patch[FALLBACK_FIELD] = [...prev, attempt].slice(-FALLBACK_ATTEMPTS_MAX);
    }
    if (snap.exists()) tx.update(ref, patch);
    else tx.set(ref, { ...defaultStudentData(), ...patch });
    return { ok: true, attempt, area: out.amneslasning.areas[areaId] };
  });
}

/**
 * Avsluta den påbörjade ämnestexten i området. EN transaktion: försöket, den
 * delade läsnivån (tak 7 uppåt) och områdets läst-lista. Därefter mynten.
 * @param {{subjectId:string, areaId:string, text:object, answers:{qid:string, chosen:(number|null)}[]}} args
 * @returns {Promise<{ok:true, attempt:object, area:object, coins:number, balance:(number|null),
 *   attemptStoredIn:("subcollection"|"studentData")} | {ok:false, reason:string}>}
 *   Nivån returneras MEDVETET inte – UI:t ska aldrig kunna visa den.
 */
export async function completeAmnesText({ subjectId, areaId, text, answers }, studentId = currentStudentId()) {
  requireId(studentId);
  if (!areaId || !text || !text.id || !Array.isArray(text.questions)) throw new Error("areaId och text krävs.");
  const ref = doc(db, "studentData", studentId);
  const ctx = { subjectId, areaId, text, answers };
  // Klassens startnivå gäller bara elev utan lasresa – samma som getAmnesArea gav.
  const startLevel = await getStudentStartLevel(studentId);
  const completedAt = Date.now();
  let res;
  let attemptStoredIn = "subcollection";
  try {
    res = await completeTx(ref, studentId, ctx, startLevel, completedAt, true);
  } catch (err) {
    if (!isPermissionDenied(err)) throw err;
    console.warn("[Ämnesläsning] lasresaAttempts nekades – sparar försöket i studentData i stället.", err);
    attemptStoredIn = "studentData";
    res = await completeTx(ref, studentId, ctx, startLevel, completedAt, false);
  }
  invalidateStudentData(studentId);
  if (!res.ok) return res;

  let reward = { coins: 0, balance: null };
  try {
    reward = await award(res.attempt.correct, { studentId, coins: res.attempt.earnedMoney });
  } catch (err) {
    console.warn("[Ämnesläsning] kunde inte lägga till pengar:", err);
  }
  return { ok: true, attempt: res.attempt, area: res.area, coins: reward.coins, balance: reward.balance, attemptStoredIn };
}
