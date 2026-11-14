// ============================================================================
// Pluggporten – klass-medlemskap (ren logik, ingen Firestore)
// ----------------------------------------------------------------------------
// Klassbyn (#/elev/by) ska visa ALLA klasskamraternas hus, inte bara elevens
// eget. Vilka elever byn ska försöka läsa härleds ur klass-dokumentens publika
// `studentIds`-lista (classes-kollektionen är läsbar för alla inloggade). Den
// här modulen är den rena mattematiken kring det, utbruten så den kan
// enhetstestas utan Firebase (jfr leveling.js):
//
//   * En elev kan ingå i FLERA klasser. Byn ska då visa kamrater ur ALLA
//     elevens klasser (unionen), inte bara den första som råkar matcha – annars
//     tappas kamrater när en elev har mer än en klass. Reglerna tillåter ändå
//     läsning av var och en (sharesClass matchar delad klass), så unionen är
//     behörighetssäker.
//   * Eleven själv är alltid med (först i listan), även utan klass – då blir byn
//     bara det egna huset (samma snälla fallback som förr).
//
// OBS: att en kamrat finns i listan garanterar inte att läsningen LYCKAS – det
// kräver att den denormaliserade students/{id}.classIds är i synk (se
// firestore.rules sharesClass + admin/backfill-class-ids.mjs). getStudentsWithLooks
// hoppar tyst över nekade läsningar per elev, så byn tål osynk utan att falla.
//
// #831: här bor även hur en NY elev och en NY klass ser ut (students,
// studentData, studentCredentials, classes) – EN källa för lärarsidans "Skapa
// klass"/"Lägg till elev" (data-content.upsertStudent, data.ensureStudentData,
// data-classes.upsertClass) och admin/importera-elever.mjs (Admin SDK), så ett
// importerat konto aldrig kan skilja sig från ett handskapat. Tidsstämpeln
// (serverTimestamp() i webb-SDK:t, FieldValue.serverTimestamp() i Admin SDK:t)
// skickas in av anroparen. Ligger här (inte i en egen fil) så bootgrafen inte
// växer (#271).
// ============================================================================

import { defaultFarm } from "./farm-core.js";

/**
 * De klasser en elev ingår i (via klass-dokumentets `studentIds`).
 * @param {string} meId
 * @param {Array<{id?:string, studentIds?:string[]}>} classes
 * @returns {Array<{id?:string, studentIds?:string[]}>}
 */
export function myClasses(meId, classes) {
  if (!meId || !Array.isArray(classes)) return [];
  return classes.filter(
    (c) => c && Array.isArray(c.studentIds) && c.studentIds.includes(meId)
  );
}

/**
 * Alla elev-id:n byn ska försöka läsa: eleven själv först, sedan unionen av
 * klasskamraterna ur ALLA elevens klasser (deduplicerad, self borttagen ur
 * svansen). Utan klass (eller okänd elev) blir det bara elevens eget id.
 *
 * @param {string} meId
 * @param {Array<{id?:string, studentIds?:string[]}>} classes  hela klasslistan (getClasses)
 * @returns {string[]} unika id:n, meId först
 */
export function classmateIds(meId, classes) {
  if (!meId) return [];
  const ids = new Set([meId]);
  for (const c of myClasses(meId, classes)) {
    for (const sid of c.studentIds) if (sid) ids.add(sid);
  }
  return [...ids];
}

// --- Ny elev och ny klass (#831) ----------------------------------------------

/** Tillåtna tecken i ett (normaliserat) elevanvändarnamn – samma som functions/login-core.js. */
export const USERNAME_RE = /^[a-z0-9._-]{3,40}$/;
/** Firebase Auth kräver minst 6 tecken i ett lösenord. */
export const MIN_PASSWORD_LEN = 6;

/** Användarnamn sparas och loggar in med gemener (auth.usernameToEmail gör likadant). */
export function normalizeUsername(username) {
  return String(username ?? "").trim().toLowerCase();
}

/** studentData/{uid} för en ny elev: standardvärden och 0 mynt. */
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

/** students/{uid} för en ny elev (klassIds läggs till när eleven kopplas till klassen). */
export function newStudentDoc({ namn, username, avatarId }) {
  return { namn, username: normalizeUsername(username), avatarId: avatarId || "fox" };
}

/** studentCredentials/{uid}: lösenordet sparas så läraren kan se det och skriva ut inloggningskort. */
export function studentCredentialsDoc({ username, password }, updatedAt) {
  return { username: normalizeUsername(username), password: String(password), updatedAt };
}

/** classes/{classId} första gången klassen skapas (inställningar saknas = standard). */
export function newClassDoc({ name, order }, createdAt) {
  const doc = { name: String(name || "").trim() };
  if (order !== undefined) doc.order = Number(order) || 0;
  doc.createdAt = createdAt;
  doc.studentIds = [];
  return doc;
}

/** Nästa klass hamnar sist i listan: order = största befintliga + 1 (som Skapa klass). */
export function nextClassOrder(classes) {
  return (classes || []).reduce((m, c) => Math.max(m, Number(c.order) || 0), 0) + 1;
}

// --- Ägda saker (#854: flyttad från data.js, delas med butikKop) -----------------
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

// --- Husdjurslistan (#854) ----------------------------------------------------
// Ett äldre studentData.pet (singular) blir första posten i pets[]. Bor här (ren,
// redan i bootgrafen) så att data-pet.js, butiken på servern (butik-core.js via
// functions/butik/) och migreringen (admin/migrera-mynt-las-core.mjs) delar den.

/** Nytt husdjurs-id ("p<tid><slump>"); `nu`/`rng` injiceras på servern och i tester. */
export function newPetId(nu = Date.now(), rng = Math.random) {
  return "p" + nu.toString(36) + Math.floor(rng() * 36 ** 4).toString(36).padStart(4, "0");
}

/** Gör ett äldre singular-pet till en post i pets[] (behåller alla fält). */
export function migratedLegacyPet(pet, id = newPetId()) {
  return {
    id,
    name: null,
    eggBoughtAt: pet.eggBoughtAt || null,
    hasHeatLamp: !!pet.hasHeatLamp,
    speciesId: pet.speciesId || null,
    hatchedAt: pet.hatchedAt || null,
    stage: pet.stage || 0,
    feedCount: pet.feedCount || 0,
    lastFedAt: pet.lastFedAt || null,
    pos: { x: 50, y: 70 },
  };
}

/** pets[] ur ett studentData-objekt, med migrering av ev. legacy-pet i minnet. */
export function petsFromData(data, id) {
  if (Array.isArray(data.pets)) return data.pets;
  if (data.pet && data.pet.eggBoughtAt) return [migratedLegacyPet(data.pet, id)];
  return [];
}
