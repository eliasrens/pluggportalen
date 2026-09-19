// ============================================================================
// Pluggportalen – gårdens rena tillståndslogik (farm-core.js)
// ----------------------------------------------------------------------------
// BROWSER-FRI kärna för gård-expansionen (epic trädgård/gård): alla rena
// tillståndsövergångar på `studentData.farm`-objektet bor här, HELT utan
// Firebase/DOM-beroenden – testbara med `node --test test/farm-core.test.js`
// (samma mönster som rakna-core.js/class-projection-entries.js).
//
// Firestore-wiringen (transaktioner, cache-invalidering) bor i systermodulen
// data-farm.js som anropar de här funktionerna inne i sina transaktioner.
//
// Datamodell (studentData.farm) – se docs/DATAMODELL.md:
//   farm: {
//     barnLevel: 1,          // laggårdens nivå (1–3) – SPARAT FÄLT (se DATAMODELL)
//     gardenTier: 1,         // odlingsbäddens nivå (1–3) – SPARAT FÄLT
//     gardenSlots: [],       // [{ slotIndex, cropId, growthStage, plantedAt }]
//     inventoryHarvest: {},  // { [cropId]: antal } skördad gröda
//     placedAnimals: []      // [{ petId, location: "room"|"paddock"|"barn" }]
//   }
//
// Alla muterande funktioner är RENA: de tar ett farm-objekt och returnerar
// `{ ok, farm }` med ett NYTT farm-objekt (indata muteras aldrig) – vid
// ok:false returneras indatat oförändrat plus en `error`-sträng.
// ============================================================================

/** Nivå-tak (laggård + odlingsbädd). Höj här när fler nivåer byggs. */
export const FARM_MAX_BARN_LEVEL = 3;
export const FARM_MAX_GARDEN_TIER = 1 + 2; // = 3, hålls i par med barn-taket

/**
 * Antal odlings-slots per odlingsbädds-nivå (gardenTier 1–3). Odlings-issuen
 * får gärna justera siffrorna – logiken här läser bara tabellen.
 */
export const FARM_SLOTS_PER_TIER = { 1: 4, 2: 6, 3: 8 };

/**
 * Tillväxtsteg för en gröda: 0 = nysådd, 1 = grodd, 2 = växer,
 * FARM_MAX_GROWTH_STAGE (3) = färdigvuxen → kan skördas.
 */
export const FARM_MAX_GROWTH_STAGE = 3;

/** Giltiga platser ett djur kan placeras på (rummet är default-hemmet). */
export const FARM_LOCATIONS = ["room", "paddock", "barn"];

/** Tomt gårds-tillstånd för en ny elev (och default-merge för gamla dokument). */
export function defaultFarm() {
  return {
    barnLevel: 1,
    gardenTier: 1,
    gardenSlots: [],
    inventoryHarvest: {},
    placedAnimals: [],
  };
}

/** Klamra en nivå till heltal i [1, max]; ogiltigt → 1. */
function clampLevel(v, max) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(1, n)) : 1;
}

/** Antal slots som elevens odlingsbädd har (utifrån gardenTier). */
export function slotCountForTier(gardenTier) {
  return FARM_SLOTS_PER_TIER[clampLevel(gardenTier, FARM_MAX_GARDEN_TIER)] || FARM_SLOTS_PER_TIER[1];
}

/**
 * Normaliserar `studentData.farm` ur ett (ev. gammalt) studentData-objekt till
 * ett komplett, giltigt farm-objekt. BAKÅTKOMPATIBEL default-merge: dokument
 * utan `farm` (alla befintliga elever) får defaultFarm(); delvisa/trasiga fält
 * ersätts fält för fält utan att röra resten av dokumentet. Returnerar alltid
 * ett NYTT objekt (fritt att mutera för anroparen).
 * @param {object|null|undefined} data helt studentData-objekt (eller null)
 * @returns {object} giltigt farm-objekt
 */
export function farmFromData(data) {
  const raw = (data && typeof data.farm === "object" && data.farm) || {};
  const def = defaultFarm();
  const slots = Array.isArray(raw.gardenSlots) ? raw.gardenSlots : def.gardenSlots;
  const inv = raw.inventoryHarvest && typeof raw.inventoryHarvest === "object" ? raw.inventoryHarvest : def.inventoryHarvest;
  const placed = Array.isArray(raw.placedAnimals) ? raw.placedAnimals : def.placedAnimals;
  return {
    barnLevel: clampLevel(raw.barnLevel ?? def.barnLevel, FARM_MAX_BARN_LEVEL),
    gardenTier: clampLevel(raw.gardenTier ?? def.gardenTier, FARM_MAX_GARDEN_TIER),
    gardenSlots: slots
      .filter(
        (s) =>
          s &&
          Number.isInteger(s.slotIndex) &&
          s.slotIndex >= 0 &&
          typeof s.cropId === "string" &&
          s.cropId
      )
      .map((s) => ({
        slotIndex: s.slotIndex,
        cropId: s.cropId,
        growthStage: Math.min(FARM_MAX_GROWTH_STAGE, Math.max(0, Math.round(Number(s.growthStage) || 0))),
        plantedAt: Number.isFinite(s.plantedAt) ? s.plantedAt : null,
      })),
    inventoryHarvest: Object.fromEntries(
      Object.entries(inv)
        .map(([id, n]) => [id, Math.max(0, Math.round(Number(n) || 0))])
        .filter(([, n]) => n > 0)
    ),
    placedAnimals: placed
      .filter((p) => p && typeof p.petId === "string" && p.petId && FARM_LOCATIONS.includes(p.location))
      .map((p) => ({ petId: p.petId, location: p.location })),
  };
}

/** Hjälpare: hitta grödan i en slot (eller undefined). */
export function cropInSlot(farm, slotIndex) {
  return (farm.gardenSlots || []).find((s) => s.slotIndex === slotIndex);
}

/**
 * Så en gröda i en tom slot. Slot-index måste rymmas i elevens odlingsbädd
 * (slotCountForTier) och vara ledigt.
 * @param {object} farm    normaliserat farm-objekt (farmFromData)
 * @param {number} slotIndex
 * @param {string} cropId  grödans id (t.ex. "crop_carrot")
 * @param {number} [now]   ms-tidsstämpel (injicerbar för test)
 * @returns {{ok: boolean, farm: object, error?: string}}
 */
export function plantCropIn(farm, slotIndex, cropId, now = Date.now()) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= slotCountForTier(farm.gardenTier)) {
    return { ok: false, farm, error: "ogiltig slot" };
  }
  if (typeof cropId !== "string" || !cropId) return { ok: false, farm, error: "ogiltig gröda" };
  if (cropInSlot(farm, slotIndex)) return { ok: false, farm, error: "sloten är upptagen" };
  const next = { slotIndex, cropId, growthStage: 0, plantedAt: now };
  return { ok: true, farm: { ...farm, gardenSlots: [...farm.gardenSlots, next] } };
}

/**
 * Avancera en grödas tillväxtsteg (default +1). Klamras till
 * FARM_MAX_GROWTH_STAGE – att "övervattna" en färdig gröda är en no-op (ok).
 * @returns {{ok: boolean, farm: object, error?: string}}
 */
export function advanceGrowthIn(farm, slotIndex, steps = 1) {
  const slot = cropInSlot(farm, slotIndex);
  if (!slot) return { ok: false, farm, error: "ingen gröda i sloten" };
  const inc = Math.max(0, Math.round(Number(steps) || 0));
  const stage = Math.min(FARM_MAX_GROWTH_STAGE, slot.growthStage + inc);
  const gardenSlots = farm.gardenSlots.map((s) =>
    s.slotIndex === slotIndex ? { ...s, growthStage: stage } : s
  );
  return { ok: true, farm: { ...farm, gardenSlots } };
}

/**
 * Skörda en FÄRDIGVUXEN gröda: sloten töms och grödan flyttas till
 * inventoryHarvest (+1). Ej färdig gröda → ok:false (skörda inte i förtid).
 * @returns {{ok: boolean, farm: object, cropId?: string, error?: string}}
 */
export function harvestFrom(farm, slotIndex) {
  const slot = cropInSlot(farm, slotIndex);
  if (!slot) return { ok: false, farm, error: "ingen gröda i sloten" };
  if (slot.growthStage < FARM_MAX_GROWTH_STAGE) return { ok: false, farm, error: "grödan är inte färdig" };
  const gardenSlots = farm.gardenSlots.filter((s) => s.slotIndex !== slotIndex);
  const inventoryHarvest = {
    ...farm.inventoryHarvest,
    [slot.cropId]: (farm.inventoryHarvest[slot.cropId] || 0) + 1,
  };
  return { ok: true, farm: { ...farm, gardenSlots, inventoryHarvest }, cropId: slot.cropId };
}

/**
 * Justera skörde-förrådet: delta kan vara negativt (t.ex. mata ett djur med en
 * morot). Saldot klamras till ≥ 0 och noll-poster städas bort; att dra mer än
 * saldot ger ok:false utan ändring (samma anda som buyItem vid för få coins).
 * @returns {{ok: boolean, farm: object, count?: number, error?: string}}
 */
export function adjustInventoryIn(farm, cropId, delta) {
  if (typeof cropId !== "string" || !cropId) return { ok: false, farm, error: "ogiltig gröda" };
  const d = Math.round(Number(delta) || 0);
  const cur = farm.inventoryHarvest[cropId] || 0;
  const next = cur + d;
  if (next < 0) return { ok: false, farm, error: "för lite i förrådet" };
  const inventoryHarvest = { ...farm.inventoryHarvest };
  if (next === 0) delete inventoryHarvest[cropId];
  else inventoryHarvest[cropId] = next;
  return { ok: true, farm: { ...farm, inventoryHarvest }, count: next };
}

/**
 * Sätt var ett djur är placerat ("room" | "paddock" | "barn"). Upsert per
 * petId: "room" är djurets default-hem, så den posten TAS BORT i stället för
 * att sparas (håller placedAnimals som en lista över avvikelser från rummet –
 * bakåtkompatibelt: djur utan post bor i rummet precis som idag).
 * @returns {{ok: boolean, farm: object, error?: string}}
 */
export function setPlacementIn(farm, petId, location) {
  if (typeof petId !== "string" || !petId) return { ok: false, farm, error: "ogiltigt djur-id" };
  if (!FARM_LOCATIONS.includes(location)) return { ok: false, farm, error: "ogiltig plats" };
  const rest = farm.placedAnimals.filter((p) => p.petId !== petId);
  const placedAnimals = location === "room" ? rest : [...rest, { petId, location }];
  return { ok: true, farm: { ...farm, placedAnimals } };
}

/** Var ett djur är placerat just nu ("room" om ingen post finns). */
export function placementFor(farm, petId) {
  const p = (farm.placedAnimals || []).find((x) => x.petId === petId);
  return p ? p.location : "room";
}
