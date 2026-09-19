// ============================================================================
// Enhetstest för gårdens rena tillståndslogik (src/farm-core.js) – #327.
//
// farm-core.js är den browser-fria kärnan för studentData.farm som data-farm.js
// kör inne i sina Firestore-transaktioner. Här bevisas logiken isolerat:
//   • bakåtkompatibel default-merge (farmFromData på gamla/trasiga dokument)
//   • så/vattna/skörda-flödet inkl. felvägar (upptagen slot, för tidig skörd)
//   • förrådet (adjustInventoryIn) klamrar mot 0 och städar noll-poster
//   • djurplaceringar (setPlacementIn) – "room" = default, sparas aldrig
// Körs browser-fritt:  node --test test/farm-core.test.js
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  defaultFarm,
  farmFromData,
  plantCropIn,
  advanceGrowthIn,
  harvestFrom,
  adjustInventoryIn,
  setPlacementIn,
  placementFor,
  cropInSlot,
  slotCountForTier,
  FARM_MAX_GROWTH_STAGE,
  FARM_MAX_GARDEN_TIER,
} from "../src/farm-core.js";

test("farmFromData: dokument utan farm får giltig default (bakåtkompat)", () => {
  for (const data of [null, undefined, {}, { coins: 40, ownedItems: ["keps"] }]) {
    const farm = farmFromData(data);
    assert.deepEqual(farm, defaultFarm());
  }
});

test("farmFromData: delvisa/trasiga fält normaliseras utan att röra resten", () => {
  const farm = farmFromData({
    farm: {
      barnLevel: 99, // klamras till taket
      gardenTier: "två", // ogiltigt → 1
      gardenSlots: [
        { slotIndex: 0, cropId: "crop_carrot", growthStage: 7, plantedAt: 123 }, // stage klamras
        { slotIndex: -1, cropId: "crop_x" }, // ogiltigt index → bort
        { cropId: "crop_y" }, // saknar slotIndex → bort
        null,
      ],
      inventoryHarvest: { crop_carrot: 2.6, crop_potato: 0, crop_bad: -3 },
      placedAnimals: [
        { petId: "hund#1", location: "paddock" },
        { petId: "katt#1", location: "månen" }, // ogiltig plats → bort
        { location: "barn" }, // saknar petId → bort
      ],
    },
  });
  assert.equal(farm.barnLevel, 3);
  assert.equal(farm.gardenTier, 1);
  assert.deepEqual(farm.gardenSlots, [
    { slotIndex: 0, cropId: "crop_carrot", growthStage: FARM_MAX_GROWTH_STAGE, plantedAt: 123 },
  ]);
  assert.deepEqual(farm.inventoryHarvest, { crop_carrot: 3 });
  assert.deepEqual(farm.placedAnimals, [{ petId: "hund#1", location: "paddock" }]);
});

test("plantCropIn: sår i tom slot, vägrar upptagen/ogiltig slot", () => {
  const farm = defaultFarm();
  const r1 = plantCropIn(farm, 0, "crop_carrot", 1000);
  assert.equal(r1.ok, true);
  assert.deepEqual(cropInSlot(r1.farm, 0), {
    slotIndex: 0,
    cropId: "crop_carrot",
    growthStage: 0,
    plantedAt: 1000,
  });
  // Indata muteras aldrig.
  assert.deepEqual(farm, defaultFarm());
  // Upptagen slot.
  assert.equal(plantCropIn(r1.farm, 0, "crop_potato").ok, false);
  // Utanför bädden (tier 1 ⇒ slotCountForTier slots).
  assert.equal(plantCropIn(farm, slotCountForTier(1), "crop_carrot").ok, false);
  assert.equal(plantCropIn(farm, -1, "crop_carrot").ok, false);
  assert.equal(plantCropIn(farm, 1, "").ok, false);
});

test("advanceGrowthIn: stegar och klamras till färdigvuxen", () => {
  let { farm } = plantCropIn(defaultFarm(), 0, "crop_carrot", 1);
  const r = advanceGrowthIn(farm, 0);
  assert.equal(r.ok, true);
  assert.equal(cropInSlot(r.farm, 0).growthStage, 1);
  // Övervattning är en no-op vid taket.
  const r2 = advanceGrowthIn(r.farm, 0, 99);
  assert.equal(cropInSlot(r2.farm, 0).growthStage, FARM_MAX_GROWTH_STAGE);
  // Tom slot → fel.
  assert.equal(advanceGrowthIn(farm, 1).ok, false);
});

test("harvestFrom: bara färdigvuxen gröda; sloten töms och förrådet ökar", () => {
  let { farm } = plantCropIn(defaultFarm(), 2, "crop_carrot", 1);
  // För tidigt.
  assert.equal(harvestFrom(farm, 2).ok, false);
  farm = advanceGrowthIn(farm, 2, FARM_MAX_GROWTH_STAGE).farm;
  const r = harvestFrom(farm, 2);
  assert.equal(r.ok, true);
  assert.equal(r.cropId, "crop_carrot");
  assert.equal(cropInSlot(r.farm, 2), undefined);
  assert.deepEqual(r.farm.inventoryHarvest, { crop_carrot: 1 });
  // Skörda igen i samma (nu tomma) slot → fel.
  assert.equal(harvestFrom(r.farm, 2).ok, false);
});

test("adjustInventoryIn: klamrar mot 0, städar noll-poster, vägrar överdrag", () => {
  let farm = { ...defaultFarm(), inventoryHarvest: { crop_carrot: 2 } };
  const add = adjustInventoryIn(farm, "crop_carrot", 3);
  assert.equal(add.count, 5);
  const spend = adjustInventoryIn(add.farm, "crop_carrot", -5);
  assert.equal(spend.ok, true);
  assert.deepEqual(spend.farm.inventoryHarvest, {}); // noll-post städad
  // Mer än saldot → ok:false utan ändring.
  const over = adjustInventoryIn(farm, "crop_carrot", -3);
  assert.equal(over.ok, false);
  assert.deepEqual(over.farm.inventoryHarvest, { crop_carrot: 2 });
});

test("setPlacementIn: upsert per djur; room = default och sparas inte", () => {
  const r1 = setPlacementIn(defaultFarm(), "hund#1", "paddock");
  assert.deepEqual(r1.farm.placedAnimals, [{ petId: "hund#1", location: "paddock" }]);
  assert.equal(placementFor(r1.farm, "hund#1"), "paddock");
  // Flytt till barn ersätter posten (ingen dubblett).
  const r2 = setPlacementIn(r1.farm, "hund#1", "barn");
  assert.deepEqual(r2.farm.placedAnimals, [{ petId: "hund#1", location: "barn" }]);
  // Hem till rummet → posten tas bort (default).
  const r3 = setPlacementIn(r2.farm, "hund#1", "room");
  assert.deepEqual(r3.farm.placedAnimals, []);
  assert.equal(placementFor(r3.farm, "hund#1"), "room");
  // Ogiltig plats / ogiltigt id.
  assert.equal(setPlacementIn(r1.farm, "hund#1", "månen").ok, false);
  assert.equal(setPlacementIn(r1.farm, "", "barn").ok, false);
});

test("slotCountForTier: växer med nivån och tål skräp", () => {
  const c1 = slotCountForTier(1);
  const cMax = slotCountForTier(FARM_MAX_GARDEN_TIER);
  assert.ok(c1 > 0 && cMax > c1);
  assert.equal(slotCountForTier("skräp"), c1);
});
