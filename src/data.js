// ============================================================================
// Pluggportalen – datamodul (data.js)
// ----------------------------------------------------------------------------
// Detta är det gemensamma API:et som ALLA delar av sajten återanvänder:
// gamemodes (quiz/läsförståelse/para ihop), shoppen, elevrummet och lärarsidan.
//
// Ansvar:
//   * Inloggning mot elevkonton via Firebase Auth (användarnamn + lösenord).
//     Själva auth-logiken (mappning username->e-post, sessionsspegel, lärar-
//     claim) bor i src/auth.js; login()/logout() här är tunna omslag som även
//     ser till att elevdata-dokumentet finns.
//   * All riktig elevdata (coins, framsteg, ägda saker, avatar, rum) i Firestore.
//   * Kunskapsinnehåll: hämta ämnen och arbetsområden.
//
// Firestore-datamodell – se docs/DATAMODELL.md för full dokumentation.
//   subjects/{subjectId}                      – ämne (t.ex. "so")
//   subjects/{subjectId}/areas/{areaId}       – arbetsområde (t.ex. "vikingatiden")
//       innehåller: texts[], quiz[], pairs[]
//   students/{studentId}                      – { namn, username, avatarId }   (studentId = Auth-uid)
//   studentData/{studentId}                   – { coins, xp, progress, ownedItems, room, avatarId }
// ============================================================================

import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  signInStudent,
  signOutCurrent,
  getSession,
  currentStudentId,
  isLoggedIn,
} from "./auth.js";
import { isMultiItem } from "./shop-items.js";
import { DEFAULT_READING_LEVEL } from "./reading-level.js";
import { createTtlCache } from "./class-projection.js";
import { clearContentCache, clearProjectionCache } from "./data-content.js";
import { clearClassCache } from "./data-classes.js";

// Session-API:t bor numera i auth.js (backat av Firebase Auth) men re-exporteras
// här så att `import * as data from "./data.js"` fortsätter fungera överallt.
export { getSession, currentStudentId, isLoggedIn };

// ---------------------------------------------------------------------------
// Inloggning / utloggning
// ---------------------------------------------------------------------------

/**
 * Logga in en elev med användarnamn + lösenord (via Firebase Auth).
 * "Kom-ihåg-mig" mappas till Auth-persistens (local vs session) i auth.js.
 * @returns {Promise<{ok: true, student: object} | {ok: false, error: string}>}
 */
export async function login(username, password, remember = false) {
  const res = await signInStudent(username, password, remember);
  if (!res.ok) return res;

  // Ny elev i sessionen → töm ALLA session-cachar så en tidigare elevs cachade
  // studentData/innehåll/klasser aldrig läcker in (#274, dela-inte-mellan-elever).
  clearAllSessionCaches();

  const uid = res.uid;
  // Läs elevdokumentet för namn/avatar (reglerna tillåter eleven att läsa sitt eget).
  let student = { id: uid };
  try {
    const snap = await getDoc(doc(db, "students", uid));
    if (snap.exists()) student = { id: uid, ...snap.data() };
  } catch {}
  // Säkerställ att elevdata-dokumentet finns.
  await ensureStudentData(uid, student.avatarId);
  return { ok: true, student };
}

/** Logga ut den inloggade eleven (Firebase Auth signOut + rensa spegeln). */
export function logout() {
  // Töm alla session-cachar så nästa elev aldrig ser förra elevens data (#274).
  clearAllSessionCaches();
  return signOutCurrent();
}

/**
 * Töm samtliga in-memory session-cachar (#274): elevdata (denna modul),
 * kunskapsinnehåll (data-content), klasslistan (data-classes) och by-/grannby-
 * projektionen (data-content). Anropas vid in-/utloggning. Motsvarar den gamla
 * clearProjectionCache-punkten men täcker alla nya cachar.
 */
function clearAllSessionCaches() {
  clearStudentDataCache();
  clearContentCache();
  clearClassCache();
  clearProjectionCache();
}

// ---------------------------------------------------------------------------
// Elevdata (Firestore) – coins, framsteg, ägda saker, avatar, rum.
// ---------------------------------------------------------------------------
// Session-cache (#274): getStudentData läses på så gott som varje sida (saldo,
// framsteg, ägda saker, avatar, rum). En kort TTL-cache (INLINE, se
// class-projection-entries.createTtlCache) gör återbesök omedelbara. NYCKLAD PER
// studentId → aldrig delad mellan elever. FÄRSKHET: varje egen SKRIVNING
// invaliderar sin studentId via invalidateStudentData(), så saldo/olåst aldrig
// är gammalt (krav 2); alla skrivvägar i data.js/data-room.js/data-reading-
// level.js anropar den efter lyckad skrivning.
const _studentDataCache = createTtlCache();

/** Invalidera studentData-cachen för en elev (anropas av ALLA skrivvägar). */
export function invalidateStudentData(studentId = currentStudentId()) {
  if (studentId) _studentDataCache.invalidate(studentId);
}

/** Töm hela studentData-cachen (in-/utloggning, test). */
export function clearStudentDataCache() {
  _studentDataCache.clear();
}

export function defaultStudentData(avatarId) {
  return {
    coins: 0,
    xp: 0, // kumulativt erfarenhets-XP (nivån härleds ur detta – se leveling.js)
    progress: {}, // { [areaId]: { [gamemode]: { completed, bestScore, stars, lastPlayed } } }
    questionRotation: {}, // { [areaId]: { [mode]: [frågenycklar serverade i pågående varv] } } – se question-rotation.js
    ownedItems: [], // shop-sak-id:n (binärt "ägd" – single-kategorier & legacy)
    ownedCounts: {}, // { [id]: antal } för multi-saker (möbler/dekor) – se buyItem/ownedCount
    avatarItems: [], // burna klädsaker (delmängd av ownedItems)
    room: { placements: {} }, // { [itemId]: { x, y } }
    garden: { placements: {} }, // utomhussaker placerade runt huset i ute-vyn – { [key]: { x, y } }
    husSkalId: null, // aktivt husskal (byter husets exteriör); null = default-stugan
    husLast: false, // true = huset är låst → klasskamrater ser "🔒 Låst" i stället för rummet
    readingLevel: DEFAULT_READING_LEVEL, // läsförståelsenivå (1–3), sätts av läraren (#154)
    avatarId: avatarId || "fox",
    avatarChosen: false, // sätts true när eleven själv valt en grundavatar
  };
}

/** Skapar studentData-dokumentet om det saknas. Returnerar datan. */
export async function ensureStudentData(studentId, avatarId) {
  const ref = doc(db, "studentData", studentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const data = defaultStudentData(avatarId);
    await setDoc(ref, data);
    invalidateStudentData(studentId); // nyskapat dok → ev. cachad "saknad" är död
    return data;
  }
  return snap.data();
}

/** Hämtar hela elevdata-dokumentet för inloggad (eller angiven) elev
 *  (session-cachad per studentId, se _studentDataCache). */
export async function getStudentData(studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  return _studentDataCache.read(studentId, async () => {
    const ref = doc(db, "studentData", studentId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : await ensureStudentData(studentId);
  });
}

// Läsnivå (#154): getReadingLevel/setReadingLevel bor i data-reading-level.js
// (re-exporteras längst ned). Håller data.js under filtaket.

// --- Coins ------------------------------------------------------------------

/** Aktuellt saldo pluggcoins. */
export async function getCoins(studentId = currentStudentId()) {
  const data = await getStudentData(studentId);
  return data.coins || 0;
}

/**
 * Lägg till coins (transaktion, så flera övningar inte skriver över varandra).
 * @returns {Promise<number>} nytt saldo.
 */
export async function addCoins(amount, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const n = Math.max(0, Math.round(amount || 0));
  const ref = doc(db, "studentData", studentId);
  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.exists() ? snap.data().coins || 0 : 0;
    const nextCoins = cur + n;
    if (snap.exists()) tx.update(ref, { coins: nextCoins });
    else tx.set(ref, { ...defaultStudentData(), coins: nextCoins });
    return nextCoins;
  });
  invalidateStudentData(studentId); // saldot ändrat → nästa läsning måste vara färsk
  return next;
}

// XP / nivå: se systermodulen data-xp.js (additiv, som data-pet.js) – håller
// data.js under filtaket. getXp()/addXp() importeras därifrån direkt.

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
 * @param {object} result   { completed?, bestScore?, stars?, ... }
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
  await updateDoc(ref, { [key]: { ...existing, ...payload } });
  invalidateStudentData(studentId);
  return payload;
}

/**
 * Spara PER-TEXT-framsteg för läsförståelse (Läsuppdrag/lastext, issue #153) i
 * `progress[areaId].reading[textId]`. Handskaket som reading-prereq.js (#155)
 * räknar: varje godkänd text (stars ≥ 2) räknas för sig. Anropas BARA vid godkänt
 * (då är stars alltid ≥ 2), utöver det vanliga lastext-framsteget. Fel sväljs –
 * en misslyckad skrivning får aldrig krascha övningen.
 * @param {string} areaId  arbetsområdets id
 * @param {string} textId  läs-textens id (validate-reading.js sätter det)
 * @param {object} result  { stars, bestScore?, ... }
 */
export async function saveReadingProgress(areaId, textId, result, studentId = currentStudentId()) {
  if (!studentId || !areaId || !textId) return;
  const ref = doc(db, "studentData", studentId);
  const key = `progress.${areaId}.reading.${textId}`;
  try {
    await updateDoc(ref, { [key]: { ...result, lastPlayed: serverTimestamp() } });
    invalidateStudentData(studentId);
  } catch {}
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

// --- Ägda saker (shop) ------------------------------------------------------

/**
 * Hur många exemplar eleven äger av en sak. För multi-saker (möbler/dekor) läses
 * antalet ur studentData.ownedCounts; saknas ett värde där räknas ett äldre
 * dokument som 1 om id:t finns i den binära ownedItems-listan (bakåtkompatibelt).
 * För single-saker (kläder/hus/…) är svaret 0 eller 1 utifrån ownedItems.
 * @param {object} data studentData-objekt
 * @param {string} id   shop-sakens id
 * @returns {number}
 */
export function ownedCount(data, id) {
  const counts = data && data.ownedCounts;
  if (counts && Object.prototype.hasOwnProperty.call(counts, id)) {
    return Math.max(0, Math.round(counts[id] || 0));
  }
  return data && Array.isArray(data.ownedItems) && data.ownedItems.includes(id) ? 1 : 0;
}

/**
 * Köp en sak: drar coins OCH lägger till i ägda saker i samma transaktion.
 *
 * Multi-saker (möbler/dekor, isMultiItem) kan köpas FLERA gånger – varje köp ökar
 * studentData.ownedCounts[id] med 1 (och id:t hålls kvar en gång i ownedItems så
 * äldre kod som bara kollar "ägd?" fortsätter fungera). Single-saker (kläder, hus)
 * blockeras som förr när de redan ägs.
 * @returns {Promise<{ok: boolean, coins: number, owned: string[], counts: object}>}
 */
export async function buyItem(itemId, price, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const cost = Math.max(0, Math.round(price || 0));
  const multi = isMultiItem(itemId);
  const ref = doc(db, "studentData", studentId);
  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : defaultStudentData();
    const owned = data.ownedItems || [];
    const coins = data.coins || 0;
    const counts = data.ownedCounts || {};
    // Single-kategori: redan ägd → köpet är en no-op (som förr).
    if (!multi && owned.includes(itemId)) return { ok: true, coins, owned, counts };
    if (coins < cost) return { ok: false, coins, owned, counts };
    const nextOwned = owned.includes(itemId) ? owned : [...owned, itemId];
    const next = { coins: coins - cost, ownedItems: nextOwned };
    let nextCounts = counts;
    if (multi) {
      nextCounts = { ...counts, [itemId]: ownedCount(data, itemId) + 1 };
      next.ownedCounts = nextCounts;
    }
    if (snap.exists()) tx.update(ref, next);
    else tx.set(ref, { ...defaultStudentData(), ...next });
    return { ok: true, coins: next.coins, owned: nextOwned, counts: nextCounts };
  });
  // Coins + ägda saker kan ha ändrats → invalidera så saldo/olåst blir färskt.
  if (result.ok) invalidateStudentData(studentId);
  return result;
}

// Rum & avatar-utseende (rum, klädsaker, avatar, evolution): utbrutet till
// data-room.js (additiv systermodul som data-xp.js) – re-exporteras nedan.

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

// ---------------------------------------------------------------------------
// Kunskapsinnehåll + elevkonton (lärarsidans data) – utbrutet till
// data-content.js men re-exporteras här så alla `import * as data` fungerar.
// ---------------------------------------------------------------------------

export {
  getAvatarItems,
  saveAvatarItems,
  getRoom,
  saveRoom,
  getGarden,
  getGardenFrom,
  saveGarden,
  getRooms,
  getRoomCount,
  saveRoomAt,
  getHusSkal,
  saveHusSkal,
  isHouseLocked,
  getHusLast,
  setHusLast,
  getAvatar,
  setAvatar,
  hasChosenAvatar,
} from "./data-room.js";

export {
  getSubjects,
  getAreas,
  getArea,
  upsertSubject,
  saveArea,
  deleteArea,
  nextAreaOrder,
  getStudents,
  getStudent,
  getStudentsByIds,
  getStudentsWithLooks,
  upsertStudent,
  deleteStudent,
  usernameTaken,
  getClassProjection,
  getClassOverview,
  getOwnVillageOverview,
  buildProjectionEntries,
  ensureClassProjection,
  updateStudentProjection,
  updateStudentProjectionAllClasses,
  classIdsForStudent,
  invalidateClassProjection,
  clearProjectionCache,
} from "./data-content.js";

export {
  getClasses,
  upsertClass,
  deleteClass,
  setClassStudents,
  normalizeAssignments,
  setClassAssignments,
  getClassAssignments,
  setClassHiddenModes,
  setClassAreaModes,
  getClassForStudent,
} from "./data-classes.js";

export { getReadingLevel, setReadingLevel } from "./data-reading-level.js";
