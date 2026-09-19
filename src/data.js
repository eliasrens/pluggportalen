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
import { defaultFarm } from "./farm-core.js";
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
    // Gården (epic gård-expansion, #327): { barnLevel, gardenTier, gardenSlots,
    // inventoryHarvest, placedAnimals } – nivåerna är SPARADE FÄLT (se
    // DATAMODELL.md, till skillnad från rummens härledda roomUpgradeCount).
    // Logik i data-farm.js (Firestore) + farm-core.js (ren kärna). Bakåtkompat:
    // gamla dokument utan `farm` default-mergas vid läsning (farmFromData).
    farm: defaultFarm(),
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

// Framsteg, roterande frågeurval & profilstatistik: utbrutet till
// data-progress.js (additiv systermodul, filtaket #327) – re-exporteras nedan.

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

export {
  getProgress,
  saveProgress,
  saveReadingProgress,
  getQuestionRotation,
  saveQuestionRotation,
  statsFromProgress,
  toDate,
  getStats,
} from "./data-progress.js";

export {
  getFarm,
  plantCrop,
  advanceCropGrowth,
  harvestCrop,
  adjustHarvestInventory,
  setAnimalPlacement,
  setBarnLevel,
  setGardenTier,
} from "./data-farm.js";

// Gårdens rena kärna (browser-fri, node-testbar) – re-exporteras för
// bekvämlighet så UI-kod kan läsa konstanter/hjälpare via data.js.
export {
  defaultFarm,
  farmFromData,
  slotCountForTier,
  cropInSlot,
  placementFor,
  FARM_MAX_BARN_LEVEL,
  FARM_MAX_GARDEN_TIER,
  FARM_MAX_GROWTH_STAGE,
  FARM_SLOTS_PER_TIER,
  FARM_LOCATIONS,
} from "./farm-core.js";
