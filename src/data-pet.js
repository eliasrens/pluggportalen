// ============================================================================
// Pluggportalen – husdjursdata (mystery egg: kläckbart husdjur)
// ----------------------------------------------------------------------------
// Additiv systermodul till data.js (som redan ligger nära filtaket): allt som
// rör studentData.pet. Se docs/DATAMODELL.md för fältbeskrivning.
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

// Kläcktid: ~3 dagar realtid; värmelampan halverar tiden.
export const HATCH_MS = 3 * 24 * 60 * 60 * 1000;
export const LAMP_HATCH_FACTOR = 0.5;

// Tillväxt: steget beräknas ur antal matningar (3 steg, sista rätt stort).
export const STAGE2_FEEDS = 3; // så många matningar → steg 2
export const STAGE3_FEEDS = 7; // så många matningar → steg 3 (max)

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

/** Tidpunkten (ms) då ägget kläcks – halva tiden med värmelampa. */
export function hatchTimeFor(pet) {
  if (!pet || !pet.eggBoughtAt) return Infinity;
  const factor = pet.hasHeatLamp ? LAMP_HATCH_FACTOR : 1;
  return pet.eggBoughtAt + Math.round(HATCH_MS * factor);
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

/** Elevens pet-objekt, eller null om inget ägg köpts. */
export async function getPet(studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const snap = await getDoc(doc(db, "studentData", studentId));
  return snap.exists() ? snap.data().pet || null : null;
}

/**
 * Köp mystery egg: drar coins, lägger "mystery-egg" i ownedItems och startar
 * kläckningsklockan – allt i EN transaktion. Redan köpt ägg → ok utan kostnad.
 * @returns {Promise<{ok: boolean, coins: number, owned: string[], pet: object|null}>}
 */
export async function buyEgg(price, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const cost = Math.max(0, Math.round(price || 0));
  const ref = doc(db, "studentData", studentId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const owned = data.ownedItems || [];
    const pet = data.pet || null;
    const coins = data.coins || 0;
    if (owned.includes(EGG_ITEM_ID) || (pet && pet.eggBoughtAt)) {
      return { ok: true, coins, owned, pet };
    }
    if (!snap.exists() || coins < cost) return { ok: false, coins, owned, pet };
    const nextPet = {
      eggBoughtAt: Date.now(),
      hasHeatLamp: !!(pet && pet.hasHeatLamp),
      speciesId: null,
      hatchedAt: null,
      stage: 0,
      feedCount: 0,
      lastFedAt: null,
    };
    const nextOwned = [...owned, EGG_ITEM_ID];
    tx.update(ref, { coins: coins - cost, ownedItems: nextOwned, pet: nextPet });
    return { ok: true, coins: coins - cost, owned: nextOwned, pet: nextPet };
  });
}

/**
 * Köp värmelampa: drar coins, lägger "varmelampa" i ownedItems och sätter
 * pet.hasHeatLamp (kläcker ägget snabbare). Fungerar även före äggköpet.
 * @returns {Promise<{ok: boolean, coins: number, owned: string[], pet: object|null}>}
 */
export async function buyHeatLamp(price, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const cost = Math.max(0, Math.round(price || 0));
  const ref = doc(db, "studentData", studentId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const owned = data.ownedItems || [];
    const pet = data.pet || null;
    const coins = data.coins || 0;
    if (owned.includes(LAMP_ITEM_ID)) return { ok: true, coins, owned, pet };
    if (!snap.exists() || coins < cost) return { ok: false, coins, owned, pet };
    const nextPet = { ...(pet || {}), hasHeatLamp: true };
    const nextOwned = [...owned, LAMP_ITEM_ID];
    tx.update(ref, { coins: coins - cost, ownedItems: nextOwned, pet: nextPet });
    return { ok: true, coins: coins - cost, owned: nextOwned, pet: nextPet };
  });
}

/**
 * Kläck ägget om kläcktiden passerats: slumpar en art och sätter hatchedAt +
 * steg 1. Anropas vid inläsning av husdjurssidan. Returnerar pet (ev. nykläckt).
 * @returns {Promise<{pet: object|null, justHatched: boolean}>}
 */
export async function hatchIfReady(studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const ref = doc(db, "studentData", studentId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const pet = snap.exists() ? snap.data().pet || null : null;
    if (!pet || !pet.eggBoughtAt || pet.hatchedAt) {
      return { pet, justHatched: false };
    }
    if (Date.now() < hatchTimeFor(pet)) return { pet, justHatched: false };
    const hatched = {
      ...pet,
      speciesId: randomSpeciesId(),
      hatchedAt: Date.now(),
      stage: 1,
      feedCount: 0,
      lastFedAt: null,
    };
    tx.update(ref, { pet: hatched });
    return { pet: hatched, justHatched: true };
  });
}

/**
 * Mata varelsen (gratis, max 1 gång per dygn). Ökar feedCount och räknar om
 * steget. Ingen bestraffning om man missar dagar – den slutar bara växa.
 * @returns {Promise<{ok: boolean, reason?: string, pet: object|null, stageUp: boolean}>}
 */
export async function feedPet(studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const ref = doc(db, "studentData", studentId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const pet = snap.exists() ? snap.data().pet || null : null;
    if (!pet || !pet.hatchedAt) {
      return { ok: false, reason: "inte-klackt", pet, stageUp: false };
    }
    if (!canFeed(pet)) {
      return { ok: false, reason: "redan-matad", pet, stageUp: false };
    }
    const feedCount = (pet.feedCount || 0) + 1;
    const fed = {
      ...pet,
      feedCount,
      stage: stageForFeeds(feedCount),
      lastFedAt: Date.now(),
    };
    tx.update(ref, { pet: fed });
    return { ok: true, pet: fed, stageUp: fed.stage > (pet.stage || 1) };
  });
}
