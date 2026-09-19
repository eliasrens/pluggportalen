// ============================================================================
// Pluggportalen – gården (data-farm.js)
// ----------------------------------------------------------------------------
// Additiv systermodul till data.js (samma mönster som data-animals.js/
// data-pet.js, re-exporteras via data.js): allt som rör `studentData.farm` –
// gård-expansionens datalager (laggård, odlingsbädd, skörde-förråd och
// djurplaceringar). INGA UI-beroenden här.
//
// All ren tillståndslogik (validering, slots, tillväxt, skörd, placeringar)
// bor i den BROWSER-FRIA kärnan farm-core.js och anropas inne i
// transaktionerna här – kärnan enhets-testas med `node --test`, den här
// modulen är bara Firestore-wiring (runTransaction + cache-invalidering).
//
// Skrivmönster: varje skrivning läser dokumentet i en transaktion,
// normaliserar med farmFromData (bakåtkompatibel default-merge för gamla
// dokument utan `farm`), kör den rena övergången och skriver ändrade fält med
// DOT-PATH (`farm.gardenSlots` …) så inget annat i farm-objektet – eller
// dokumentet – skrivs över. Saknas dokumentet skapas det som
// defaultStudentData + farm (samma mönster som addCoins/buyItem i data.js).
// ============================================================================

import { db } from "./firebase-config.js";
import {
  doc,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  currentStudentId,
  getStudentData,
  defaultStudentData,
  invalidateStudentData,
} from "./data.js";
import {
  farmFromData,
  plantCropIn,
  advanceGrowthIn,
  harvestFrom,
  adjustInventoryIn,
  setPlacementIn,
  FARM_MAX_BARN_LEVEL,
  FARM_MAX_GARDEN_TIER,
} from "./farm-core.js";

/**
 * Hela gårds-tillståndet för inloggad (eller angiven) elev, alltid ett
 * komplett giltigt farm-objekt (gamla dokument utan `farm` → defaultFarm).
 * Läser via getStudentData → session-cachad som allt annat.
 * @returns {Promise<object>} farm-objekt (se farm-core.js/DATAMODELL.md)
 */
export async function getFarm(studentId = currentStudentId()) {
  const data = await getStudentData(studentId);
  return farmFromData(data);
}

/**
 * Gemensam skriv-hjälpare: kör en ren farm-övergång i EN transaktion och
 * skriver de fält övergången ändrade med dot-path. `fn(farm)` är en av
 * farm-core-funktionerna och returnerar `{ ok, farm, ... }`; vid ok:false
 * skrivs inget. `fields` är farm-fälten som ska persisteras vid ok.
 */
async function updateFarm(studentId, fields, fn) {
  if (!studentId) throw new Error("Ingen elev inloggad.");
  const ref = doc(db, "studentData", studentId);
  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const farm = farmFromData(snap.exists() ? snap.data() : null);
    const res = fn(farm);
    if (!res.ok) return res;
    if (snap.exists()) {
      const write = {};
      for (const f of fields) write["farm." + f] = res.farm[f];
      tx.update(ref, write);
    } else {
      tx.set(ref, { ...defaultStudentData(), farm: res.farm });
    }
    return res;
  });
  if (result.ok) invalidateStudentData(studentId); // farm ändrat → färsk läsning (#274)
  return result;
}

/**
 * Så en gröda i en tom slot i odlingsbädden.
 * @param {number} slotIndex  0-baserat, < slotCountForTier(gardenTier)
 * @param {string} cropId     grödans id (t.ex. "crop_carrot")
 * @returns {Promise<{ok: boolean, farm: object, error?: string}>}
 */
export function plantCrop(slotIndex, cropId, studentId = currentStudentId()) {
  return updateFarm(studentId, ["gardenSlots"], (farm) => plantCropIn(farm, slotIndex, cropId));
}

/**
 * Avancera en grödas tillväxtsteg (default +1, klamras till färdigvuxen).
 * @returns {Promise<{ok: boolean, farm: object, error?: string}>}
 */
export function advanceCropGrowth(slotIndex, steps = 1, studentId = currentStudentId()) {
  return updateFarm(studentId, ["gardenSlots"], (farm) => advanceGrowthIn(farm, slotIndex, steps));
}

/**
 * Skörda en färdigvuxen gröda: sloten töms och grödan läggs i skörde-förrådet
 * (inventoryHarvest). Ej färdig → ok:false utan ändring.
 * @returns {Promise<{ok: boolean, farm: object, cropId?: string, error?: string}>}
 */
export function harvestCrop(slotIndex, studentId = currentStudentId()) {
  return updateFarm(studentId, ["gardenSlots", "inventoryHarvest"], (farm) => harvestFrom(farm, slotIndex));
}

/**
 * Justera skörde-förrådet med delta (negativt = förbruka, t.ex. mata ett
 * djur). Dras mer än saldot → ok:false utan ändring.
 * @returns {Promise<{ok: boolean, farm: object, count?: number, error?: string}>}
 */
export function adjustHarvestInventory(cropId, delta, studentId = currentStudentId()) {
  return updateFarm(studentId, ["inventoryHarvest"], (farm) => adjustInventoryIn(farm, cropId, delta));
}

/**
 * Sätt var ett djur är placerat: "room" (default-hemmet, posten tas bort),
 * "paddock" eller "barn". petId = djurets instans-id (pets[].id eller
 * roomAnimals[].uid – gården bryr sig inte om vilket).
 * @returns {Promise<{ok: boolean, farm: object, error?: string}>}
 */
export function setAnimalPlacement(petId, location, studentId = currentStudentId()) {
  return updateFarm(studentId, ["placedAnimals"], (farm) => setPlacementIn(farm, petId, location));
}

/**
 * Sätt laggårdens nivå (1–3). Uppgraderings-issuen äger KÖPET (pris/coins) –
 * det ska dra coins och sätta nivån i sin egen transaktion; den här hjälparen
 * är den råa nivå-skrivningen. Nivån får aldrig sänkas.
 * @returns {Promise<{ok: boolean, farm: object, error?: string}>}
 */
export function setBarnLevel(level, studentId = currentStudentId()) {
  return updateFarm(studentId, ["barnLevel"], (farm) => {
    const n = Math.round(Number(level));
    if (!Number.isFinite(n) || n < farm.barnLevel || n > FARM_MAX_BARN_LEVEL) {
      return { ok: false, farm, error: "ogiltig nivå" };
    }
    return { ok: true, farm: { ...farm, barnLevel: n } };
  });
}

/**
 * Sätt odlingsbäddens nivå (1–3). Samma kontrakt som setBarnLevel: köpet bor i
 * uppgraderings-issuen, nivån får aldrig sänkas (planterade slots ska aldrig
 * hamna utanför bädden).
 * @returns {Promise<{ok: boolean, farm: object, error?: string}>}
 */
export function setGardenTier(tier, studentId = currentStudentId()) {
  return updateFarm(studentId, ["gardenTier"], (farm) => {
    const n = Math.round(Number(tier));
    if (!Number.isFinite(n) || n < farm.gardenTier || n > FARM_MAX_GARDEN_TIER) {
      return { ok: false, farm, error: "ogiltig nivå" };
    }
    return { ok: true, farm: { ...farm, gardenTier: n } };
  });
}
