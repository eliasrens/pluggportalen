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
  advanceAllGrowthIn,
  harvestFrom,
  adjustInventoryIn,
  setPlacementIn,
  placementFor,
  cropInSlot,
  slotCountForTier,
  addFarmAnimalIn,
  renameFarmAnimalIn,
  withFarmAnimalPositions,
  moodForTrivsel,
  FARM_MAX_GROWTH_STAGE,
  FARM_MAX_GARDEN_TIER,
  FARM_ANIMAL_DEFAULT_TRIVSEL,
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

test("advanceAllGrowthIn: alla växande grödor stegar, färdiga rörs inte (#329)", () => {
  let farm = plantCropIn(defaultFarm(), 0, "crop_carrot", 1).farm;
  farm = plantCropIn(farm, 1, "crop_clover", 1).farm;
  // Gröda 0 görs färdig i förväg – den ska INTE räknas som växande.
  farm = advanceGrowthIn(farm, 0, FARM_MAX_GROWTH_STAGE).farm;
  const r = advanceAllGrowthIn(farm);
  assert.equal(r.ok, true);
  assert.equal(r.grew, 1); // bara klövern växte
  assert.equal(cropInSlot(r.farm, 0).growthStage, FARM_MAX_GROWTH_STAGE);
  assert.equal(cropInSlot(r.farm, 1).growthStage, 1);
  // Indata muteras aldrig.
  assert.equal(cropInSlot(farm, 1).growthStage, 0);
  // Tom bädd / allt färdigt → ok med grew 0 och samma farm-objekt (ingen skrivning).
  const done = advanceAllGrowthIn(advanceAllGrowthIn(r.farm, 99).farm);
  assert.equal(done.grew, 0);
  const tom = advanceAllGrowthIn(defaultFarm());
  assert.equal(tom.ok, true);
  assert.equal(tom.grew, 0);
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

// --- Bondgårdsdjuren (farm.animals, issue #330) ------------------------------

test("addFarmAnimalIn: nytt djur med trivsel-default; unika uid krävs", () => {
  const r1 = addFarmAnimalIn(defaultFarm(), "animal_horse#a1", "animal_horse");
  assert.equal(r1.ok, true);
  assert.deepEqual(r1.animal, {
    uid: "animal_horse#a1", id: "animal_horse", name: null, pos: null,
    trivsel: FARM_ANIMAL_DEFAULT_TRIVSEL, lastFedAt: null,
  });
  // Nytt djur har ingen placerings-post → bor i rummet (default).
  assert.equal(placementFor(r1.farm, "animal_horse#a1"), "room");
  // Dubblett-uid, tomt uid och tom art vägras utan ändring.
  assert.equal(addFarmAnimalIn(r1.farm, "animal_horse#a1", "animal_horse").ok, false);
  assert.equal(addFarmAnimalIn(r1.farm, "", "animal_cow").ok, false);
  assert.equal(addFarmAnimalIn(r1.farm, "animal_cow#c1", "").ok, false);
});

test("farmFromData: animals normaliseras (trasiga poster bort, fält klamras)", () => {
  const farm = farmFromData({
    farm: {
      animals: [
        { uid: "animal_pig#p1", id: "animal_pig", name: "Nasse", pos: { x: 40, y: 80 }, trivsel: 999, lastFedAt: 1234 },
        { uid: "animal_cow#k1", id: "animal_cow" }, // gammal/partiell post → defaults
        { uid: "", id: "animal_cow" }, // tomt uid → bort
        { id: "animal_cow" }, // saknar uid → bort
        null,
      ],
    },
  });
  assert.deepEqual(farm.animals, [
    { uid: "animal_pig#p1", id: "animal_pig", name: "Nasse", pos: { x: 40, y: 80 }, trivsel: 100, lastFedAt: 1234 },
    { uid: "animal_cow#k1", id: "animal_cow", name: null, pos: null, trivsel: FARM_ANIMAL_DEFAULT_TRIVSEL, lastFedAt: null },
  ]);
});

test("renameFarmAnimalIn: döper/nollställer; okänt djur vägras", () => {
  const { farm } = addFarmAnimalIn(defaultFarm(), "animal_cow#k1", "animal_cow");
  const r1 = renameFarmAnimalIn(farm, "animal_cow#k1", "Rosa");
  assert.equal(r1.ok, true);
  assert.equal(r1.animal.name, "Rosa");
  assert.equal(r1.animal.trivsel, FARM_ANIMAL_DEFAULT_TRIVSEL); // övriga fält orörda
  const r2 = renameFarmAnimalIn(r1.farm, "animal_cow#k1", null);
  assert.equal(r2.animal.name, null);
  assert.equal(renameFarmAnimalIn(farm, "okänd#x", "Namn").ok, false);
});

test("withFarmAnimalPositions: skriver giltiga uid, ignorerar resten", () => {
  let { farm } = addFarmAnimalIn(defaultFarm(), "animal_pig#p1", "animal_pig");
  ({ farm } = addFarmAnimalIn(farm, "animal_pig#p2", "animal_pig"));
  const r = withFarmAnimalPositions(farm, {
    "animal_pig#p1": { x: 33, y: 78 },
    "animal_pig#p2": { x: "nej", y: 70 }, // ogiltig → ignoreras
    "okänd#x": { x: 1, y: 2 }, // okänt uid → ignoreras
  });
  assert.equal(r.changed, true);
  assert.deepEqual(r.farm.animals[0].pos, { x: 33, y: 78 });
  assert.equal(r.farm.animals[1].pos, null);
  // Inga giltiga positioner → changed:false och samma farm-objekt tillbaka.
  const r2 = withFarmAnimalPositions(farm, { "okänd#x": { x: 1, y: 2 } });
  assert.equal(r2.changed, false);
  assert.equal(r2.farm, farm);
});

test("moodForTrivsel: glad/nöjd/less med klamrande trösklar", () => {
  assert.equal(moodForTrivsel(100), "glad");
  assert.equal(moodForTrivsel(60), "glad");
  assert.equal(moodForTrivsel(59), "nojd");
  assert.equal(moodForTrivsel(30), "nojd");
  assert.equal(moodForTrivsel(29), "less");
  assert.equal(moodForTrivsel(0), "less");
  assert.equal(moodForTrivsel("skräp"), moodForTrivsel(FARM_ANIMAL_DEFAULT_TRIVSEL)); // ogiltigt → default
});
