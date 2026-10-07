// ============================================================================
// Mattematchen – lärarens Firestore-lager (#459)
// ----------------------------------------------------------------------------
// Skrivningar (bara lärare, validCompetition i firestore.rules):
//   createCompetition / updateCompetition / startNow / stop / resume
//   finishCompetition  → status "finished" + result (historik-ögonblicksbild)
//   archiveIfEnded     → tävling vars tid tog slut utan "Avsluta": spara result
//   resetCompetition   → radera answers, studentStats, scores, classCounters
//                        (i omgångar om ≤ 400) + ta bort result
// Läsningar (KVOT, incident #114 – aldrig svar per elev i tabeller):
//   listCompetitions        → alla tävlingar (få dokument)
//   competitionsForClass    → where participatingClassIds array-contains klass
//   loadStatsFor(cid, ids)  → studentStats för EN klass (documentId in, 30 åt gången)
//   loadTrainingTotals(uid) → MM + Live tillsammans via count()-aggregat på
//                             collectionGroup("answers") (inga dokument läses)
// Topp 25 + Klasskamp återanvänder elevsidans mm-data.js.
//
// Laddas DYNAMISKT (teacher-mattematchen.js / teacher-mm-stats.js, #271).
// ============================================================================

import { db, auth } from "../firebase-config.js";
import {
  collection, collectionGroup, doc, getDoc, getDocs, addDoc, updateDoc, query, where, limit,
  documentId, writeBatch, deleteField, serverTimestamp, Timestamp, getCountFromServer,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getClasses } from "../data-classes.js";
import { getStudentsByIds } from "../data.js";
import { buildResult, COUNTER_SHARDS } from "./mm-teacher-core.js";
import { competitionPhase } from "./mm-core.js";

const COL = "mathCompetitions";
const SUBS = ["answers", "studentStats", "scores", "classCounters"];
const PAGE = 400;

const withId = (d) => ({ id: d.id, ...d.data() });

/** Alla tävlingar (lärare får lista allt). */
export async function listCompetitions() {
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map(withId);
}

/** En tävling (eller null). */
export async function getCompetition(cid) {
  const snap = await getDoc(doc(db, COL, cid));
  return snap.exists() ? withId(snap) : null;
}

/** Klassens tävlingar (Statistik → Mattematchen). */
export async function competitionsForClass(classId) {
  const q = query(collection(db, COL), where("participatingClassIds", "array-contains", classId));
  return (await getDocs(q)).docs.map(withId);
}

/** Ny tävling. fields = validateCompetition().fields; tider i ms. */
export async function createCompetition({ name, participatingClassIds, startMs, endMs }) {
  const ref = await addDoc(collection(db, COL), {
    name,
    participatingClassIds,
    startAt: Timestamp.fromMillis(startMs),
    endAt: Timestamp.fromMillis(endMs),
    status: "active",
    counterShards: COUNTER_SHARDS,
    createdBy: auth.currentUser?.uid || "larare",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Ändra namn/klasser/tider (status rörs inte). */
export function updateCompetition(cid, { name, participatingClassIds, startMs, endMs }) {
  return updateDoc(doc(db, COL, cid), {
    name,
    participatingClassIds,
    startAt: Timestamp.fromMillis(startMs),
    endAt: Timestamp.fromMillis(endMs),
  });
}

/** "Starta nu": perioden börjar direkt (serverns tid) – bara för kommande. */
export function startNow(cid) {
  return updateDoc(doc(db, COL, cid), { status: "active", startAt: serverTimestamp() });
}

/** "Stoppa": svar nekas och eleverna ser inte tävlingen förrän den fortsätter. */
export function stopCompetition(cid) {
  return updateDoc(doc(db, COL, cid), { status: "stopped" });
}

/** "Fortsätt" efter stopp. */
export function resumeCompetition(cid) {
  return updateDoc(doc(db, COL, cid), { status: "active" });
}

/** Läs allt historiken behöver (en gång, vid avslut) och bygg ögonblicksbilden. */
async function snapshotResult(comp) {
  const base = [COL, comp.id];
  const [scores, stats, counters, classes] = await Promise.all([
    getDocs(collection(db, ...base, "scores")).then((s) => s.docs.map(withId)),
    getDocs(collection(db, ...base, "studentStats")).then((s) => s.docs.map(withId)),
    getDocs(collection(db, ...base, "classCounters")).then((s) => s.docs.map((d) => d.data())),
    getClasses().catch(() => []),
  ]);
  // Elever som bara svarat fel finns inte i scores → hämta deras namn.
  const named = new Set(scores.map((s) => s.uid || s.id));
  const missing = stats.map((s) => s.uid || s.id).filter((uid) => !named.has(uid));
  const extra = missing.length ? await getStudentsByIds(missing).catch(() => []) : [];
  const names = new Map(extra.map((s) => [s.id, s.namn || s.username || "Elev"]));
  return buildResult({
    scores, stats, counters, classes, participatingIds: comp.participatingClassIds, names, now: Date.now(),
  });
}

/** "Avsluta": tävlingen stängs och resultatet sparas i historiken. */
export async function finishCompetition(comp) {
  const result = await snapshotResult(comp);
  await updateDoc(doc(db, COL, comp.id), { status: "finished", finishedAt: serverTimestamp(), result });
  return result;
}

/**
 * En tävling vars sluttid passerade av sig själv saknar result – spara det
 * första gången läraren öppnar den (idempotent: gör inget om result finns).
 */
export async function archiveIfEnded(comp, now = Date.now()) {
  if (comp.result || competitionPhase(comp, now) !== "avslutad") return comp.result || null;
  const result = await snapshotResult(comp);
  await updateDoc(doc(db, COL, comp.id), { status: "finished", result });
  return result;
}

/** Radera en hel underkollektion i omgångar (läraren får radera, reglerna). */
async function deleteAll(cid, sub, onProgress) {
  let removed = 0;
  for (;;) {
    const snap = await getDocs(query(collection(db, COL, cid, sub), limit(PAGE)));
    if (snap.empty) return removed;
    const b = writeBatch(db);
    snap.docs.forEach((d) => b.delete(d.ref));
    await b.commit();
    removed += snap.size;
    onProgress?.(sub, removed);
  }
}

/**
 * Nollställ/teståterställ: ALLA svar, all statistik, topplistan och klass-
 * räknarna raderas och historik-resultatet tas bort. Kan inte ångras.
 */
export async function resetCompetition(cid, onProgress) {
  const counts = {};
  for (const sub of SUBS) counts[sub] = await deleteAll(cid, sub, onProgress);
  await updateDoc(doc(db, COL, cid), { result: deleteField() });
  return counts;
}

/** studentStats för givna elever (en klass) → Map uid → dokument. */
export async function loadStatsFor(cid, ids) {
  const uniq = [...new Set((ids || []).filter(Boolean))];
  const out = new Map();
  const chunks = [];
  for (let i = 0; i < uniq.length; i += 30) chunks.push(uniq.slice(i, i + 30));
  await Promise.all(
    chunks.map(async (chunk) => {
      const q = query(collection(db, COL, cid, "studentStats"), where(documentId(), "in", chunk));
      (await getDocs(q)).docs.forEach((d) => out.set(d.id, withId(d)));
    })
  );
  return out;
}

/**
 * Gemensam träningsstatistik (MM + Live) för en elev: antal svar och antal
 * rätt via count()-aggregat – dokumenten läses inte. Kräver collection-group-
 * index på answers.uid (+ uid,isCorrect), se firestore.indexes.json.
 */
export async function loadTrainingTotals(uid) {
  const base = query(collectionGroup(db, "answers"), where("uid", "==", uid));
  const [all, right] = await Promise.all([
    getCountFromServer(base),
    getCountFromServer(query(base, where("isCorrect", "==", true))),
  ]);
  const total = all.data().count;
  const correct = right.data().count;
  return { total, correct, incorrect: Math.max(0, total - correct) };
}
