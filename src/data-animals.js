// ============================================================================
// Pluggportalen – vanliga djur (köpbara, promenerande djur med FAST storlek)
// ----------------------------------------------------------------------------
// Additiv systermodul till data.js (samma mönster som data-pet.js): allt som
// rör studentData.roomAnimals – de VANLIGA djuren från shoppen (hund, katt,
// kanin …). De är LEVANDE och promenerar omkring i rummet (rum-promenad.js)
// men till skillnad från mystery-djuren (studentData.pets, data-pet.js):
//   * FAST storlek – ingen tillväxt, inga steg, ingen feedCount.
//   * INGEN mat – de blir aldrig hungriga och ignorerar Mysterymat helt
//     (isHungry i data-pet.js är false för dem: de är inga sprite-arter).
//
// Datamodell (studentData.roomAnimals: array):
//   { id, pos: { x, y }, name }  id = shop-sakens id ("hund", "katt" …) –
//                                man kan bara äga ETT djur per art, så arten
//                                ÄR identiteten. pos i procent av rumsscenen.
//                                name = elevens eget namn (sträng) eller null –
//                                saneras med cleanPetName (samma som mystery-djur).
//
// Hålls medvetet HELT åtskild från pets[]: matnings-/evolutionslogiken i
// data-pet.js rör aldrig roomAnimals, och den här modulen rör aldrig pets.
//
// Bakåtkompatibilitet: djur som köptes när de var statiska möbler ligger i
// studentData.ownedItems (+ ev. room.placements). De läses in som roomAnimals
// vid rendering (legacy-merge i animalsFromData) och skrivs ner till
// roomAnimals första gången en position sparas – ownedItems lämnas orörd.
// ============================================================================

import { db } from "./firebase-config.js";
import {
  doc,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { currentStudentId } from "./data.js";
import { isAnimalItem } from "./shop-items.js";
import { cleanPetName } from "./data-pet.js";

/** Slumpad startposition nere på golvet (samma spridning som nya ägg). */
function randomFloorPos() {
  return { x: 30 + Math.round(Math.random() * 40), y: 70 + Math.round(Math.random() * 15) };
}

/**
 * roomAnimals[] ur ett studentData-objekt, inkl. legacy-merge: djur som bara
 * finns i ownedItems (köpta som statiska möbler förr) blir djur med en
 * startposition på golvet. Returnerar NYA objekt (fritt att mutera pos).
 */
export function animalsFromData(data) {
  const saved = Array.isArray(data.roomAnimals) ? data.roomAnimals : [];
  const out = [];
  const seen = new Set();
  for (const a of saved) {
    if (!a || !isAnimalItem(a.id) || seen.has(a.id)) continue;
    seen.add(a.id);
    const pos = a.pos && Number.isFinite(a.pos.x) && Number.isFinite(a.pos.y)
      ? { x: a.pos.x, y: a.pos.y }
      : randomFloorPos();
    out.push({ id: a.id, pos, name: cleanPetName(a.name) });
  }
  for (const id of data.ownedItems || []) {
    if (!isAnimalItem(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, pos: randomFloorPos(), name: null });
  }
  return out;
}

/**
 * Köp ett vanligt djur: drar coins och lägger djuret i roomAnimals – det dyker
 * upp promenerande i rummet direkt (ingen placering behövs). Ett djur per art.
 * Allt i EN transaktion (samma mönster som buyItem i data.js).
 * @returns {Promise<{ok: boolean, coins: number, animals: object[]}>}
 */
export async function buyAnimal(itemId, price, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  if (!isAnimalItem(itemId)) throw new Error("Inte ett vanligt djur: " + itemId);
  const cost = Math.max(0, Math.round(price || 0));
  const ref = doc(db, "studentData", studentId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const coins = data.coins || 0;
    const animals = animalsFromData(data);
    if (animals.some((a) => a.id === itemId)) return { ok: true, coins, animals };
    if (coins < cost) return { ok: false, coins, animals };
    const next = [...animals, { id: itemId, pos: randomFloorPos(), name: null }];
    const write = { coins: coins - cost, roomAnimals: next };
    if (snap.exists()) tx.update(ref, write);
    else tx.set(ref, write);
    return { ok: true, coins: coins - cost, animals: next };
  });
}

/**
 * Spara de vanliga djurens positioner: { [animalId]: { x, y } } (procent).
 * Skriver ner hela den aktuella listan (inkl. legacy-merge från ownedItems,
 * som därmed blir riktiga roomAnimals-poster första gången).
 * @returns {Promise<{animals: object[]}>}
 */
export async function saveAnimalPositions(positions, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const ref = doc(db, "studentData", studentId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return { animals: [] };
    const animals = animalsFromData(snap.data());
    let changed = false;
    const next = animals.map((a) => {
      const pos = positions[a.id];
      if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return a;
      changed = true;
      return { ...a, pos: { x: pos.x, y: pos.y } };
    });
    if (!changed) return { animals };
    tx.update(ref, { roomAnimals: next });
    return { animals: next };
  });
}

/**
 * Döp (eller döp om) ett vanligt djur. Namnet saneras precis som mystery-djurens
 * (cleanPetName: trimmat, maxlängd, utan HTML-tecken). Skriver ner hela listan
 * (inkl. ev. legacy-merge från ownedItems) i EN transaktion – samma mönster som
 * saveAnimalPositions och setPetName i data-pet.js.
 * @returns {Promise<{ok: boolean, animal: object|null, animals: object[]}>}
 */
export async function saveAnimalName(animalId, name, studentId = currentStudentId()) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const clean = cleanPetName(name);
  const ref = doc(db, "studentData", studentId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return { ok: false, animal: null, animals: [] };
    const animals = animalsFromData(snap.data());
    const i = animals.findIndex((a) => a.id === animalId);
    if (i === -1) return { ok: false, animal: null, animals };
    const next = animals.map((a) => (a.id === animalId ? { ...a, name: clean } : a));
    tx.update(ref, { roomAnimals: next });
    return { ok: true, animal: next[i], animals: next };
  });
}
