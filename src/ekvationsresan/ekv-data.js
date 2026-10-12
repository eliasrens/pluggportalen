// ============================================================================
// Ekvationsresan – Firestore-brygga (src/ekvationsresan/ekv-data.js) · #618
// ----------------------------------------------------------------------------
// Tunn brygga mellan den rena logiken (framsteg.js) och Firestore, som
// data-lasresan.js för Läsresan:
//   studentData/{id}/ekvationsresa/progress           progressdokumentet
//   studentData/{id}/ekvationsresaAttempts/{taskId}   ett försök per uppgift
// Laddas BARA från Ekvationsresans dynamiska moduler – aldrig från bootgrafen.
//
// MYNT (E1.10) med säker idempotens: försök + progress skrivs i EN transaktion,
// och försökets dokument-id är uppgiftens id. Finns försöket redan (dubbelklick,
// omsändning, två flikar) skrivs inget och inga mynt delas ut; reglerna tillåter
// dessutom bara CREATE av försöket. Mynten läggs sedan på det vanliga saldot via
// data.addCoins (mynt.award) – Läsresans mönster. Går nätet ner precis mellan
// transaktionen och addCoins uteblir mynten för den uppgiften, men de kan aldrig
// delas ut två gånger.
// ⚠️ DEPLOY: reglerna för båda sökvägarna kräver `firebase deploy --only firestore:rules`.
// ============================================================================

import { db } from "../firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as qLimit,
  orderBy,
  query,
  runTransaction,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { currentStudentId } from "../data.js";
import { newAttemptId } from "../mult/attempt-id.js";
import { generateTask } from "./generator.js";
import { award } from "./mynt.js";
import { normalizeProgress, currentTask, withCurrent, buildAttempt, applyCompletion, teacherSetLevel, TEACHER_LEVEL_FIELDS } from "./framsteg.js";

export const PROGRESS_PATH = ["ekvationsresa", "progress"];
export const ATTEMPTS = "ekvationsresaAttempts";

function requireId(studentId) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  return studentId;
}

const progressRef = (studentId) => doc(db, "studentData", studentId, ...PROGRESS_PATH);
const attemptRef = (studentId, taskId) => doc(db, "studentData", studentId, ATTEMPTS, taskId);

/** Elevens progress (saknas dokumentet → ny elev på nivå 1). */
export async function getEkvationsresa(studentId = currentStudentId()) {
  const snap = await getDoc(progressRef(requireId(studentId)));
  return normalizeProgress(snap.exists() ? snap.data() : null);
}

/** Spara en ny pågående uppgift (ny elev, nivåbyte från läraren, "Försök igen"). */
export async function startTask(task, studentId = currentStudentId(), { progress = null } = {}) {
  requireId(studentId);
  const cur = { id: newAttemptId(), at: Date.now(), task };
  const base = progress || (await getEkvationsresa(studentId));
  const next = withCurrent(base, task, cur);
  await setDoc(progressRef(studentId), next);
  return { progress: next, current: cur };
}

/**
 * Var eleven kommer in (E1.1): den pågående uppgiften om den finns på elevens
 * nivå, annars en ny som sparas direkt.
 * @returns {Promise<{progress, current:{id, at, task}}>}
 */
export async function enterEkvationsresan(studentId = currentStudentId(), { rng = Math.random } = {}) {
  const progress = await getEkvationsresa(studentId);
  const cur = currentTask(progress);
  if (cur) return { progress, current: cur };
  const previous = progress.current?.task || null;
  return startTask(generateTask(progress.level, { rng, previous }), studentId, { progress });
}

/**
 * Avsluta en uppgift: försök + progress (anpassning, räknare, nästa uppgift) i
 * EN transaktion, sedan mynten via addCoins om försöket var nytt.
 * @param {{current:{id,at,task}, run, help, result, blocked?:number, ownMoves?:number}} args
 * @returns {Promise<{ok:true, created:boolean, attempt, progress, change, from, to,
 *   next:{id,at,task}, coins:number, balance:(number|null)}>}
 */
export async function completeTask({ current, run, help, result, blocked = 0, ownMoves = null }, studentId = currentStudentId(), { rng = Math.random } = {}) {
  requireId(studentId);
  const now = Date.now();
  const attempt = buildAttempt({ id: current.id, task: current.task, run, help, result, blocked, ownMoves, startedAt: current.at, completedAt: now });
  const pRef = progressRef(studentId);
  const aRef = attemptRef(studentId, current.id);
  const res = await runTransaction(db, async (tx) => {
    const [pSnap, aSnap] = await Promise.all([tx.get(pRef), tx.get(aRef)]);
    const progress = normalizeProgress(pSnap.exists() ? pSnap.data() : null);
    if (aSnap.exists()) {
      // Redan sparad: inga mynt igen. Nästa uppgift = den som redan står som pågående.
      return { created: false, progress, change: null, from: progress.level, to: progress.level };
    }
    const r0 = applyCompletion(progress, attempt, { now });
    const nextTask = generateTask(r0.to, { rng, previous: current.task });
    const next = { id: newAttemptId(), at: now, task: nextTask };
    const r = { ...r0, progress: { ...r0.progress, current: next } };
    tx.set(aRef, attempt);
    tx.set(pRef, r.progress);
    return { created: true, ...r };
  });

  let reward = { coins: 0, balance: null };
  if (res.created && attempt.coins > 0) {
    try {
      reward = await award(attempt.coins, { studentId });
    } catch (err) {
      console.warn("[Ekvationsresan] kunde inte lägga till mynt:", err);
    }
  }
  let next = currentTask(res.progress);
  if (!next || next.id === current.id) next = (await startTask(generateTask(res.progress.level, { rng, previous: current.task }), studentId, { progress: res.progress })).current;
  return { ok: true, created: res.created, attempt, progress: res.progress, change: res.change, from: res.from, to: res.to, next, coins: reward.coins, balance: reward.balance };
}

/** Elevens senaste försök, nyast först (lärarens elevdetalj, E1.12). */
export async function listAttempts(studentId, max = 20) {
  const q = query(collection(db, "studentData", requireId(studentId), ATTEMPTS), orderBy("completedAt", "desc"), qLimit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Lärarens nivåstyrning (E1.12): ny nivå, nollställt fönster, ny uppgift vid nästa besök. */
export async function setStudentLevel(studentId, level) {
  const ref = progressRef(requireId(studentId));
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const next = teacherSetLevel(normalizeProgress(snap.exists() ? snap.data() : null), level, Date.now());
    // Befintligt dokument: bara nivåfälten (reglerna, #619, tillåter läraren
    // inget annat – statistik och mynt ägs av eleven). Nytt: tomt dokument.
    if (!snap.exists()) tx.set(ref, next);
    else tx.update(ref, Object.fromEntries(TEACHER_LEVEL_FIELDS.map((k) => [k, next[k]])));
    return next;
  });
}

/**
 * Klassöversikten (E1.12): progressdokumentet för varje elev – ett dokument
 * per elev, en gång när läraren öppnar fliken (Läsresans mönster, #231).
 * Försöken läses först i elevdetaljen. Fel för en elev → progress null.
 * @returns {Promise<{studentId:string, progress:(object|null)}[]>}
 */
export async function getClassEkvationsresa(studentIds) {
  const ids = [...new Set((studentIds || []).filter(Boolean))];
  return Promise.all(
    ids.map(async (studentId) => {
      try {
        const snap = await getDoc(progressRef(studentId));
        return { studentId, progress: snap.exists() ? snap.data() : null };
      } catch (err) {
        console.warn(`[Ekvationsresan] kunde inte läsa ${studentId}`, err);
        return { studentId, progress: null };
      }
    })
  );
}

/**
 * Samma nivå för alla elever i listan (en transaktion per elev, som Läsresans
 * setClassLevel). Ett misslyckat byte stoppar inte de andra.
 * @returns {Promise<{level:number, total:number, updated:number, failed:{studentId, error}[]}>}
 */
export async function setClassLevel(studentIds, level) {
  const ids = [...new Set((studentIds || []).filter((x) => typeof x === "string" && x))];
  const results = await Promise.allSettled(ids.map((id) => setStudentLevel(id, level)));
  const out = { level, total: ids.length, updated: 0, failed: [] };
  results.forEach((r, i) => {
    if (r.status === "fulfilled") out.updated += 1;
    else out.failed.push({ studentId: ids[i], error: r.reason?.message || String(r.reason) });
  });
  return out;
}
