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
  trivselNow,
  sammaDygn,
  feedFarmAnimalIn,
  giftReadyIn,
  claimGiftIn,
  FARM_MAX_GROWTH_STAGE,
  FARM_MAX_GARDEN_TIER,
  FARM_ANIMAL_DEFAULT_TRIVSEL,
  DYGN_MS,
  FEED_TRIVSEL,
  TRIVSEL_DECAY_PER_DYGN,
  FARM_GIFT_COINS,
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
    trivsel: FARM_ANIMAL_DEFAULT_TRIVSEL, lastFedAt: null, lastGiftAt: null,
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
    { uid: "animal_pig#p1", id: "animal_pig", name: "Nasse", pos: { x: 40, y: 80 }, trivsel: 100, lastFedAt: 1234, lastGiftAt: null },
    { uid: "animal_cow#k1", id: "animal_cow", name: null, pos: null, trivsel: FARM_ANIMAL_DEFAULT_TRIVSEL, lastFedAt: null, lastGiftAt: null },
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

// --- Matning, trivsel & daglig gåva (issue #332) ------------------------------

// Fast "nu" mitt på dagen (lokal tid) så kalenderdags-gaten inte råkar korsa
// midnatt i testet: 2026-09-15 12:00 lokal.
const NU = new Date(2026, 8, 15, 12, 0, 0).getTime();

/** Gård med en häst (uid h1) och givet skörde-förråd. */
function gardMedHast(inventoryHarvest, hast = {}) {
  const { farm } = addFarmAnimalIn(defaultFarm(), "h1", "animal_horse");
  farm.animals[0] = { ...farm.animals[0], ...hast };
  return { ...farm, inventoryHarvest };
}

test("sammaDygn: kalenderdag (lokal tid), null → false", () => {
  assert.equal(sammaDygn(NU, NU - 3 * 60 * 60 * 1000), true); // samma dag, 09:00
  assert.equal(sammaDygn(NU, NU - DYGN_MS), false); // igår
  assert.equal(sammaDygn(NU, NU - 13 * 60 * 60 * 1000), false); // igår kväll (23:00)
  assert.equal(sammaDygn(null, NU), false);
  assert.equal(sammaDygn(NU, undefined), false);
});

test("trivselNow: −10 per helt dygn sedan lastFedAt, golv 0, ingen decay omatad", () => {
  assert.equal(trivselNow({ trivsel: 80, lastFedAt: null }, NU), 80); // aldrig matad
  assert.equal(trivselNow({ trivsel: 80, lastFedAt: NU - DYGN_MS + 1 }, NU), 80); // < 1 dygn
  assert.equal(trivselNow({ trivsel: 80, lastFedAt: NU - DYGN_MS }, NU), 80 - TRIVSEL_DECAY_PER_DYGN);
  assert.equal(trivselNow({ trivsel: 80, lastFedAt: NU - 3.5 * DYGN_MS }, NU), 50); // 3 hela dygn
  assert.equal(trivselNow({ trivsel: 30, lastFedAt: NU - 99 * DYGN_MS }, NU), 0); // golv 0
});

test("feedFarmAnimalIn: rätt gröda +25 (klamrat 100), förrådet −1, lastFedAt sätts", () => {
  const farm = gardMedHast({ crop_carrot: 2 });
  const r = feedFarmAnimalIn(farm, "h1", "crop_carrot", NU);
  assert.equal(r.ok, true);
  assert.equal(r.gavTrivsel, true);
  assert.equal(r.animal.trivsel, 100); // 80 + 25 klamrat till 100
  assert.equal(r.animal.lastFedAt, NU);
  assert.deepEqual(r.farm.inventoryHarvest, { crop_carrot: 1 });
  assert.equal(farm.animals[0].lastFedAt, null); // indata muteras aldrig
});

test("feedFarmAnimalIn: bara FÖRSTA matningen per kalenderdag ger trivsel", () => {
  const farm = gardMedHast({ crop_carrot: 3 }, { trivsel: 40, lastFedAt: NU - DYGN_MS });
  // Igår matad → dagens första: decay −10 materialiseras, sedan +25.
  const r1 = feedFarmAnimalIn(farm, "h1", "crop_carrot", NU);
  assert.equal(r1.gavTrivsel, true);
  assert.equal(r1.animal.trivsel, 40 - TRIVSEL_DECAY_PER_DYGN + FEED_TRIVSEL);
  // Andra matningen samma dag: förbrukar gröda (hjärtan i UI) men ingen trivsel.
  const r2 = feedFarmAnimalIn(r1.farm, "h1", "crop_carrot", NU + 60000);
  assert.equal(r2.ok, true);
  assert.equal(r2.gavTrivsel, false);
  assert.equal(r2.animal.trivsel, r1.animal.trivsel);
  assert.deepEqual(r2.farm.inventoryHarvest, { crop_carrot: 1 });
});

test("feedFarmAnimalIn: fel gröda / tomt förråd / okänt djur → ok:false utan ändring", () => {
  const farm = gardMedHast({ crop_clover: 1 });
  const fel = feedFarmAnimalIn(farm, "h1", "crop_clover", NU); // häst vill ha morot
  assert.equal(fel.ok, false);
  assert.equal(fel.error, "fel gröda");
  assert.deepEqual(fel.farm.inventoryHarvest, { crop_clover: 1 }); // inget förbrukat
  assert.equal(feedFarmAnimalIn(gardMedHast({}), "h1", "crop_carrot", NU).ok, false);
  assert.equal(feedFarmAnimalIn(farm, "okänd#x", "crop_carrot", NU).ok, false);
});

test("giftReadyIn/claimGiftIn: gåva vid trivsel ≥ 60, en gång per kalenderdag", () => {
  const farm = gardMedHast({}, { trivsel: 70, lastFedAt: NU });
  assert.equal(giftReadyIn(farm.animals[0], NU), true);
  const r = claimGiftIn(farm, "h1", NU);
  assert.equal(r.ok, true);
  assert.equal(r.coins, FARM_GIFT_COINS);
  assert.equal(r.animal.lastGiftAt, NU);
  // Redan hämtad idag → ok:false; i morgon är den redo igen (om trivseln räcker).
  assert.equal(claimGiftIn(r.farm, "h1", NU + 60000).ok, false);
  assert.equal(giftReadyIn(r.farm.animals[0], NU + DYGN_MS), true);
  // Låg trivsel (decay under 60) → ingen gåva, aldrig ett "fel".
  const less = gardMedHast({}, { trivsel: 65, lastFedAt: NU - DYGN_MS });
  assert.equal(giftReadyIn(less.animals[0], NU), false); // 65 − 10 = 55 < 60
  assert.equal(claimGiftIn(less, "h1", NU).ok, false);
  assert.equal(claimGiftIn(farm, "okänd#x", NU).ok, false);
});
