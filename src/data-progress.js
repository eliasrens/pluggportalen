// ============================================================================
// Pluggporten – framsteg & statistik (data-progress.js)
// ----------------------------------------------------------------------------
// Additiv systermodul till data.js (samma mönster som data-xp.js/data-room.js,
// re-exporteras via data.js): allt som rör studentData.progress och
// studentData.questionRotation – spara/läsa framsteg per (område × gamemode),
// per-text-läsframsteg (#153), roterande frågeurval samt profilsidans enkla
// statistik som räknas ur progress. Utbruten ur data.js för filtaket (#327).
// ============================================================================

import { db } from "./firebase-config.js";
import {
  doc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { currentStudentId, getStudentData, invalidateStudentData } from "./data.js";
import { mergeCategoryCounts } from "./exercise-types.js";

// --- Framsteg ---------------------------------------------------------------

/** Hela progress-objektet. */
export async function getProgress(studentId = currentStudentId()) {
  const data = await getStudentData(studentId);
  return data.progress || {};
}

/**
 * Spara framsteg för ett arbetsområde + gamemode.
 * @param {string} areaId   arbetsområdets id
 * @param {string} gamemode t.ex. "quiz" | "lasforstaelse" | "para"
 * @param {object} result   { completed?, bestScore?, stars?, cat?, ... }
 *   `cat` (#445) = sessionens räkning per frågekategori { [kategori]: { r, t } };
 *   den ADDERAS till det sparade (aldrig ersätter). Saknas den behålls ev.
 *   sparad `cat` orörd (via ...existing nedan).
 */
export async function saveProgress(areaId, gamemode, result, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const ref = doc(db, "studentData", studentId);
  const key = `progress.${areaId}.${gamemode}`;
  const payload = { ...result, lastPlayed: serverTimestamp() };
  // Slå ihop med ev. tidigare resultat (behåll bästa score).
  const existing = (await getProgress(studentId))?.[areaId]?.[gamemode] || {};
  if (typeof existing.bestScore === "number" && typeof payload.bestScore === "number") {
    payload.bestScore = Math.max(existing.bestScore, payload.bestScore);
  }
  if (typeof existing.stars === "number" && typeof payload.stars === "number") {
    payload.stars = Math.max(existing.stars, payload.stars);
  }
  if ("cat" in payload) {
    const cat = mergeCategoryCounts(existing.cat, payload.cat);
    if (Object.keys(cat).length > 0) payload.cat = cat;
    else delete payload.cat;
  }
  await updateDoc(ref, { [key]: { ...existing, ...payload } });
  invalidateStudentData(studentId);
  return payload;
}

// --- Roterande frågeurval (per elev, område, läge) --------------------------

/**
 * Hämtar listan över frågenycklar som redan serverats i det PÅGÅENDE varvet för
 * ett (område, läge). Saknas data → tom lista (→ slumpad start; bakåtkompatibelt).
 * @returns {Promise<string[]>}
 */
export async function getQuestionRotation(areaId, mode, studentId = currentStudentId()) {
  try {
    const data = await getStudentData(studentId);
    const keys = data?.questionRotation?.[areaId]?.[mode];
    return Array.isArray(keys) ? keys : [];
  } catch {
    return [];
  }
}

/**
 * Sparar den uppdaterade listan serverade frågenycklar för ett (område, läge).
 * Anropas när en ny session byggts (se games-quiz.js). Fel sväljs – misslyckad
 * sparning innebär bara att nästa session slumpar om, aldrig en trasig övning.
 */
export async function saveQuestionRotation(areaId, mode, keys, studentId = currentStudentId()) {
  if (!studentId) return;
  const ref = doc(db, "studentData", studentId);
  const key = `questionRotation.${areaId}.${mode}`;
  try {
    await updateDoc(ref, { [key]: Array.isArray(keys) ? keys : [] });
    invalidateStudentData(studentId);
  } catch {}
}

// ---------------------------------------------------------------------------
// Enkel statistik (för profilsidan). Räknas ur progress-objektet.
// ---------------------------------------------------------------------------

/**
 * Räknar enkla nyckeltal direkt ur ett progress-objekt (ingen Firestore-läsning).
 * Bruten ut ur getStats så att lärarsidan kan återanvända den på redan inläst
 * progress (se teacher-class.js) utan att läsa om datan.
 * @param {object} progress  progress[areaId][gamemode] = { completed, stars, ... }
 * @returns {{playedExercises:number, completed:number, stars:number, areas:number, lastPlayed:(Date|null)}}
 */
export function statsFromProgress(progress) {
  let playedExercises = 0; // antal spelade övningar (område × gamemode)
  let completed = 0;
  let stars = 0;
  let lastPlayed = null; // senaste aktivitet (Date) över alla övningar
  const areaSet = new Set();
  for (const [areaId, modes] of Object.entries(progress || {})) {
    for (const result of Object.values(modes || {})) {
      if (!result) continue;
      playedExercises += 1;
      areaSet.add(areaId);
      if (result.completed) completed += 1;
      if (typeof result.stars === "number") stars += result.stars;
      const d = toDate(result.lastPlayed);
      if (d && (!lastPlayed || d > lastPlayed)) lastPlayed = d;
    }
  }
  return { playedExercises, completed, stars, areas: areaSet.size, lastPlayed };
}

/**
 * Tolkar ett lastPlayed-fält (Firestore Timestamp, {seconds}, ms-tal eller
 * ISO-sträng) till ett Date, eller null om det saknas/inte går att tolka.
 */
export function toDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate(); // Firestore Timestamp
  if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000);
  if (typeof ts === "number") return new Date(ts);
  if (typeof ts === "string") {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Sammanställer enkel statistik för profilsidan.
 * @returns {Promise<{coins:number, playedExercises:number, completed:number, stars:number, areas:number, lastPlayed:(Date|null)}>}
 */
export async function getStats(studentId = currentStudentId()) {
  const data = await getStudentData(studentId);
  return { coins: data.coins || 0, ...statsFromProgress(data.progress || {}) };
}
