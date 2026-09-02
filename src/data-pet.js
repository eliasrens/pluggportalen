// ============================================================================
// Pluggportalen – husdjursdata (mystery eggs: kläckbara husdjur i rummet)
// ----------------------------------------------------------------------------
// Additiv systermodul till data.js: allt som rör studentData.pets (LISTA av
// husdjur – eleven kan ha flera ägg/djur samtidigt). Husdjuren bor i Mitt rum.
//
// Datamodell (studentData.pets: array av pet-objekt):
//   { id, name, eggBoughtAt, hasHeatLamp, speciesId, hatchedAt, stage,
//     feedCount, lastFedAt, pos: { x, y } }   (pos i procent av rumsscenen)
//
// Bakåtkompatibilitet: ett äldre studentData.pet (singular) migreras till
// pets[] vid första inläsningen (fältet lämnas kvar men ignoreras sedan –
// pets[] är sanningen så fort den finns).
//
// Principer:
//   * Tidsstämplar sparas som millisekunder (Date.now()). Kläckning och
//     tillväxt räknas ut VID INLÄSNING – ingen bakgrundsprocess behövs.
//   * Allt som rör coins går i runTransaction (samma mönster som buyItem).
//   * Husdjuret kan ALDRIG dö – matas det inte slutar det bara växa.
// ============================================================================

import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { currentStudentId } from "./data.js";
import { randomSpeciesId } from "./art-pets-creatures.js";

// Shop-id:n (måste matcha shop-items.js).
export const EGG_ITEM_ID = "mystery-egg";
export const LAMP_ITEM_ID = "varmelampa";

// Kläcktid: 1 dygn utan värmelampa, 10 minuter MED värmelampa (fast tid).
export const HATCH_MS = 24 * 60 * 60 * 1000; // 1 dygn
export const LAMP_HATCH_MS = 10 * 60 * 1000; // 10 minuter med värmelampa

// Tillväxt: steget beräknas ur antal matningar (3 steg, sista rätt stort).
export const STAGE2_FEEDS = 3; // så många matningar → steg 2
export const STAGE3_FEEDS = 7; // så många matningar → steg 3 (max)

// Namn: sätts av eleven, barnvänlig maxlängd.
export const NAME_MAX_LEN = 16;

/** Vilket steg (1–3) motsvarar ett antal matningar? */
export function stageForFeeds(feedCount) {
  const n = feedCount || 0;
  if (n >= STAGE3_FEEDS) return 3;
  if (n >= STAGE2_FEEDS) return 2;
  return 1;
}

/** { needed, have } till nästa steg, eller null om fullvuxen (steg 3). */
export function feedsToNextStage(feedCount) {
  const n = feedCount || 0;
  if (n >= STAGE3_FEEDS) return null;
  const target = n >= STAGE2_FEEDS ? STAGE3_FEEDS : STAGE2_FEEDS;
  return { needed: target, have: n };
}

/** Tidpunkten (ms) då ägget kläcks – 1 dygn, eller 10 min med värmelampa. */
export function hatchTimeFor(pet, hasLamp = false) {
  if (!pet || !pet.eggBoughtAt) return Infinity;
  const dur = pet.hasHeatLamp || hasLamp ? LAMP_HATCH_MS : HATCH_MS;
  return pet.eggBoughtAt + dur;
}

/** Är två ms-tidsstämplar samma (lokala) kalenderdag? */
export function isSameLocalDay(a, b) {
  const da = new Date(a), db_ = new Date(b);
  return (
    da.getFullYear() === db_.getFullYear() &&
    da.getMonth() === db_.getMonth() &&
    da.getDate() === db_.getDate()
  );
}

/** Får varelsen matas nu? (kläckt + inte redan matad idag – 1 gång/dygn) */
export function canFeed(pet, now = Date.now()) {
  if (!pet || !pet.hatchedAt) return false;
  return !pet.lastFedAt || !isSameLocalDay(pet.lastFedAt, now);
}

/** Städat namn (trimmat, maxlängd, utan HTML-tecken) eller null. */
export function cleanPetName(name) {
  const s = String(name || "").replace(/[<>&"'`]/g, "").trim().slice(0, NAME_MAX_LEN);
  return s || null;
}

// --- Internt: id-generering + migrering -------------------------------------

function newPetId() {
  return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Gör ett äldre singular-pet till en post i pets[] (behåller alla fält). */
function migratedLegacyPet(pet) {
  return {
    id: newPetId(),
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
function petsFromData(data) {
  if (Array.isArray(data.pets)) return data.pets;
  if (data.pet && data.pet.eggBoughtAt) return [migratedLegacyPet(data.pet)];
  return [];
}

/**
 * Kör en transaktion som läser pets[] (migrerar legacy-pet vid behov), låter
 * `fn(pets, data)` returnera { pets, result } och skriver tillbaka listan.
 * fn kan returnera null → inget skrivs (resultatet blir { pets, ...extra }).
 */
async function updatePets(studentId, fn) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const ref = doc(db, "studentData", studentId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const hadList = Array.isArray(data.pets);
    const pets = petsFromData(data).map((p) => ({ ...p }));
    const out = await fn(pets, data);
    if (out && out.write) {
      tx.update(ref, { pets: out.pets, ...(out.extra || {}) });
      return out.result;
    }
    // Ingen ändring i övrigt – men skriv ändå ner en ev. migrering så att
    // legacy-husdjuret får ett stabilt id/pos i Firestore.
    if (!hadList && pets.length > 0 && snap.exists()) {
      tx.update(ref, { pets });
    }
    return out ? out.result : { pets };
  });
}

// --- Publikt API ------------------------------------------------------------

/**
 * Elevens husdjurslista (migrerar ett ev. äldre studentData.pet först).
 * @returns {Promise<object[]>}
 */
export async function getPets(studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const snap = await getDoc(doc(db, "studentData", studentId));
  if (!snap.exists()) return [];
  const data = snap.data();
  if (Array.isArray(data.pets)) return data.pets;
  const pets = petsFromData(data);
  if (pets.length === 0) return [];
  // Skriv ner migreringen så id:t blir stabilt (transaktion – tål samtidighet).
  return updatePets(studentId, (p) => ({ write: true, pets: p, result: p })).then(
    (r) => (Array.isArray(r) ? r : pets)
  );
}

/**
 * Köp mystery egg: drar coins och lägger ett NYTT ägg i pets[] – eleven kan ha
 * flera samtidigt. Allt i EN transaktion.
 * @returns {Promise<{ok: boolean, coins: number, pets: object[]}>}
 */
export async function buyEgg(price, studentId = currentStudentId()) {
  const cost = Math.max(0, Math.round(price || 0));
  return updatePets(studentId, (pets, data) => {
    const coins = data.coins || 0;
    const hasLamp = (data.ownedItems || []).includes(LAMP_ITEM_ID);
    if (coins < cost) return { result: { ok: false, coins, pets } };
    const egg = {
      id: newPetId(),
      name: null,
      eggBoughtAt: Date.now(),
      hasHeatLamp: hasLamp,
      speciesId: null,
      hatchedAt: null,
      stage: 0,
      feedCount: 0,
      lastFedAt: null,
      // Nya ägg hamnar lite utspritt på golvet så de inte staplas exakt.
      pos: { x: 30 + Math.round(Math.random() * 40), y: 70 + Math.round(Math.random() * 15) },
    };
    const next = [...pets, egg];
    return {
      write: true,
      pets: next,
      extra: { coins: coins - cost },
      result: { ok: true, coins: coins - cost, pets: next },
    };
  });
}

/**
 * Köp värmelampa: drar coins, lägger "varmelampa" i ownedItems och sätter
 * hasHeatLamp på alla okläckta ägg (kläcks snabbare). Fungerar även före äggköp.
 * @returns {Promise<{ok: boolean, coins: number, owned: string[], pets: object[]}>}
 */
export async function buyHeatLamp(price, studentId = currentStudentId()) {
  const cost = Math.max(0, Math.round(price || 0));
  return updatePets(studentId, (pets, data) => {
    const owned = data.ownedItems || [];
    const coins = data.coins || 0;
    if (owned.includes(LAMP_ITEM_ID)) {
      return { result: { ok: true, coins, owned, pets } };
    }
    if (coins < cost) return { result: { ok: false, coins, owned, pets } };
    const next = pets.map((p) => (p.hatchedAt ? p : { ...p, hasHeatLamp: true }));
    const nextOwned = [...owned, LAMP_ITEM_ID];
    return {
      write: true,
      pets: next,
      extra: { coins: coins - cost, ownedItems: nextOwned },
      result: { ok: true, coins: coins - cost, owned: nextOwned, pets: next },
    };
  });
}

/**
 * Kläck alla ägg vars kläcktid passerats: slumpar art + sätter hatchedAt och
 * steg 1. Anropas vid inläsning av rummet.
 * @returns {Promise<{pets: object[], justHatchedIds: string[]}>}
 */
export async function hatchReadyPets(studentId = currentStudentId()) {
  return updatePets(studentId, (pets, data) => {
    const hasLamp = (data.ownedItems || []).includes(LAMP_ITEM_ID);
    const now = Date.now();
    const justHatchedIds = [];
    const next = pets.map((p) => {
      if (!p.eggBoughtAt || p.hatchedAt || now < hatchTimeFor(p, hasLamp)) return p;
      justHatchedIds.push(p.id);
      return { ...p, speciesId: randomSpeciesId(), hatchedAt: now, stage: 1 };
    });
    if (justHatchedIds.length === 0) {
      return { result: { pets, justHatchedIds } };
    }
    return { write: true, pets: next, result: { pets: next, justHatchedIds } };
  });
}

/**
 * Mata ETT husdjur (gratis, max 1 gång per dygn och djur). Ökar feedCount och
 * räknar om steget. Ingen bestraffning om man missar dagar.
 * @returns {Promise<{ok: boolean, reason?: string, pet: object|null, pets: object[], stageUp: boolean}>}
 */
export async function feedPet(petId, studentId = currentStudentId()) {
  return updatePets(studentId, (pets) => {
    const i = pets.findIndex((p) => p.id === petId);
    const pet = i === -1 ? null : pets[i];
    if (!pet || !pet.hatchedAt) {
      return { result: { ok: false, reason: "inte-klackt", pet, pets, stageUp: false } };
    }
    if (!canFeed(pet)) {
      return { result: { ok: false, reason: "redan-matad", pet, pets, stageUp: false } };
    }
    const feedCount = (pet.feedCount || 0) + 1;
    const fed = { ...pet, feedCount, stage: stageForFeeds(feedCount), lastFedAt: Date.now() };
    const next = [...pets];
    next[i] = fed;
    return {
      write: true,
      pets: next,
      result: { ok: true, pet: fed, pets: next, stageUp: fed.stage > (pet.stage || 1) },
    };
  });
}

/**
 * Döp (eller döp om) ett husdjur. Namnet trimmas och kapas till NAME_MAX_LEN.
 * @returns {Promise<{ok: boolean, pet: object|null, pets: object[]}>}
 */
export async function setPetName(petId, name, studentId = currentStudentId()) {
  const clean = cleanPetName(name);
  return updatePets(studentId, (pets) => {
    const i = pets.findIndex((p) => p.id === petId);
    if (i === -1) return { result: { ok: false, pet: null, pets } };
    const next = [...pets];
    next[i] = { ...next[i], name: clean };
    return { write: true, pets: next, result: { ok: true, pet: next[i], pets: next } };
  });
}

/**
 * Spara husdjurens positioner i rummet: { [petId]: { x, y } } (procent 0–100).
 * @returns {Promise<{pets: object[]}>}
 */
export async function savePetPositions(positions, studentId = currentStudentId()) {
  return updatePets(studentId, (pets) => {
    let changed = false;
    const next = pets.map((p) => {
      const pos = positions[p.id];
      if (!pos) return p;
      changed = true;
      return { ...p, pos: { x: pos.x, y: pos.y } };
    });
    if (!changed) return { result: { pets } };
    return { write: true, pets: next, result: { pets: next } };
  });
}
