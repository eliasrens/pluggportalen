// ============================================================================
// Regel-tester: varulåset (#856, docs/SAKERHET-MYNT.md §6 B4). Elevens egen
// studentData-skrivning kan inte skapa varor: ownedItems och agdaDjur rörs
// bara av servern, ownedCounts bara som sådden (lastFro), äpplena ökar aldrig,
// gårdens nivåer rörs aldrig och det eleven bär/bor i måste vara ägt.
//   • nekat: arrayUnion i ownedItems, varje skrivning till agdaDjur, höjd
//     appleCount, äpple ut utan att förrådet sjunker, ownedCounts +1 eller −1
//     på en annan nyckel än lastFro, höjd barnLevel/gardenTier, ej ägt plagg,
//     hus eller lada, create med varor
//   • tillåtet: flytta/döpa/lägga undan djur (också med en längre lista än den
//     sparade), mata, kläcka, lägga ut/plocka upp äpplen, så ett frö, mata
//     gårdsdjur, bära ägt plagg, byta till ägt hus/lada
// Listorna pets/roomAnimals/farm.animals har ingen regel – vad som syns avgör
// agdaDjur i läsfunktionerna (test/djur-agande.test.js). Gränstestet ligger i
// firestore-rules-mynt-las-grans.test.js. Körs av `npm run test:rules`.
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { arrayUnion, deleteField, doc, setDoc, updateDoc, increment } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { defaultStudentData } from "../src/klass-membership.js";

let testEnv, elev, teacher;

const HAST = { uid: "animal_horse#h1", id: "animal_horse", name: null, pos: null, trivsel: 80, lastFedAt: null, lastGiftAt: null };
const BAS = {
  ...defaultStudentData("fox"),
  coins: 500, xp: 100, appleCount: 3,
  ownedItems: ["keps", "krona", "slott", "lada-bla", "varmelampa", "soffa", "crop_clover"],
  ownedCounts: { soffa: 2, crop_carrot: 3 },
  avatarItems: ["keps"],
  floorApples: [{ id: "a1", x: 10, y: 80 }],
  pets: [
    { id: "p1", name: null, eggBoughtAt: 1, hasHeatLamp: true, speciesId: "katt", hatchedAt: 2, stage: 1, feedCount: 3, lastFedAt: null, pos: { x: 50, y: 70 } },
    { id: "p2", name: null, eggBoughtAt: 1, hasHeatLamp: false, speciesId: null, hatchedAt: null, stage: 0, feedCount: 0, lastFedAt: null, pos: { x: 40, y: 70 } },
  ],
  roomAnimals: [{ uid: "fisk#1", id: "fisk", pos: { x: 20, y: 80 }, name: null, stowed: false }],
  agdaDjur: { "fisk#1": "fisk", "animal_horse#h1": "animal_horse", p1: "mystery-egg", p2: "mystery-egg" },
  farm: { barnLevel: 2, barnSkin: null, gardenTier: 2, gardenSlots: [], inventoryHarvest: { crop_hay: 4 }, placedAnimals: [], animals: [HAST] },
};
const ref = (uid = "e1", db = elev(uid)) => doc(db, "studentData", uid);
const upd = (data) => updateDoc(ref(), data);

before(async () => {
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-mynt-varor"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "studentData", "e1"), BAS));
});

describe("varulåset (#856): varor ur tomma intet nekas", () => {
  it("ownedItems: arrayUnion, hela listan och setDoc med en vara till", async () => {
    await assertFails(upd({ ownedItems: arrayUnion("cape") }));
    await assertFails(upd({ ownedItems: [...BAS.ownedItems, "skepp"] }));
    await assertFails(setDoc(ref(), { ...BAS, ownedItems: [...BAS.ownedItems, "skepp"] }));
    await assertFails(upd({ ownedItems: deleteField() }), "inte heller ta bort");
  });
  it("agdaDjur: ny post, byte av art (fisk → dinosaurie, häst) och borttagen karta", async () => {
    await assertFails(upd({ "agdaDjur.dino#1": "dinosaurie" }));
    await assertFails(upd({ "agdaDjur.fisk#1": "dinosaurie" }));
    await assertFails(upd({ "agdaDjur.p1": "hw-djur-spokis" }));
    await assertFails(upd({ agdaDjur: { ...BAS.agdaDjur, "animal_horse#h2": "animal_horse" } }));
    await assertFails(upd({ agdaDjur: deleteField() }));
  });
  it("äpplen: höjd appleCount och ett äpple på golvet utan att förrådet sjunker", async () => {
    await assertFails(upd({ appleCount: 99 }));
    await assertFails(upd({ appleCount: increment(1) }));
    await assertFails(upd({ floorApples: [...BAS.floorApples, { id: "a2", x: 1, y: 1 }] }));
    await assertFails(upd({ appleCount: 2, floorApples: [...BAS.floorApples, { id: "a2", x: 1, y: 1 }, { id: "a3", x: 2, y: 2 }] }));
    await assertFails(upd({ appleCount: "9" }));
  });
  it("ownedCounts: +1, −1 på en annan nyckel än lastFro, två nycklar och utan lastFro", async () => {
    await assertFails(upd({ "ownedCounts.soffa": 3 }));
    await assertFails(upd({ "ownedCounts.soffa": 3, lastFro: "soffa" }));
    await assertFails(upd({ "ownedCounts.crop_carrot": 2, lastFro: "crop_clover" }));
    await assertFails(upd({ "ownedCounts.crop_carrot": 2, "ownedCounts.soffa": 9, lastFro: "crop_carrot" }));
    await assertFails(upd({ "ownedCounts.crop_carrot": 2 }));
    await assertFails(upd({ "ownedCounts.mobel": 0, lastFro: "mobel" }), "ett frö man aldrig haft kan inte räknas ned till 0");
    await assertFails(upd({ "ownedCounts.crop_carrot": -1, lastFro: "crop_carrot" }));
    await assertFails(upd({ "ownedCounts.crop_carrot": 2.5, lastFro: "crop_carrot" }));
  });
  it("gården: höjd barnLevel/gardenTier, också i hela farm-objektet", async () => {
    await assertFails(upd({ "farm.barnLevel": 3 }));
    await assertFails(upd({ "farm.gardenTier": 3 }));
    await assertFails(upd({ farm: { ...BAS.farm, barnLevel: 3 } }));
    await assertFails(upd({ "farm.barnLevel": deleteField() }));
  });
  it("utseendet: ej ägt plagg, hus eller lada", async () => {
    await assertFails(upd({ avatarItems: ["keps", "cape"] }));
    await assertFails(upd({ avatarItems: "cape" }));
    await assertFails(upd({ husSkalId: "skepp" }));
    await assertFails(upd({ "farm.barnSkin": "lada-rymd" }));
  });
  it("create med varor: agdaDjur, burna kläder, köpt hus eller köpt lada", async () => {
    const ny = { ...defaultStudentData("fox") };
    const skapa = (extra) => setDoc(ref("e2"), { ...ny, ...extra });
    await assertFails(skapa({ agdaDjur: { "dino#1": "dinosaurie" } }));
    await assertFails(skapa({ avatarItems: ["krona"] }));
    await assertFails(skapa({ husSkalId: "slott" }));
    await assertFails(skapa({ farm: { ...ny.farm, barnSkin: "lada-rymd" } }));
    await assertSucceeds(skapa({ husSkalId: "stuga" }));
  });
  it("en annan elevs varor (M3) och admin som förut", async () => {
    await assertFails(updateDoc(ref("e1", elev("e9")), { avatarItems: [] }));
    await assertSucceeds(updateDoc(ref("e1", teacher()), { ownedItems: arrayUnion("cape"), "agdaDjur.x": "hund", appleCount: 50 }));
  });
});

describe("varulåset (#856): det eleven själv gör går som förut", () => {
  it("flytta, döpa och lägga undan djur – också med en längre lista än den sparade", async () => {
    const flyttad = [{ ...BAS.roomAnimals[0], pos: { x: 60, y: 75 } }];
    await assertSucceeds(upd({ roomAnimals: flyttad }));
    // Den gamla sammanslagningen (äldre djur ur ownedItems, en fejkad post): listan blir längre.
    await assertSucceeds(upd({ roomAnimals: [...flyttad, { uid: "hund", id: "hund", pos: { x: 1, y: 1 }, name: null, stowed: false }] }));
    await assertSucceeds(upd({ roomAnimals: [{ ...flyttad[0], name: "Nemo", stowed: true }] }));
    await assertSucceeds(upd({ "farm.animals": [{ ...HAST, pos: { x: 3, y: 4 }, name: "Blixten" }] }));
    await assertSucceeds(upd({ pets: [{ ...BAS.pets[0], stowed: true, name: "Pip" }, BAS.pets[1]] }));
  });
  it("husdjuren: kläcka, äta ett äpple och mata med bär", async () => {
    const klackt = { ...BAS.pets[1], speciesId: "blomp", hatchedAt: 5, stage: 1 };
    await assertSucceeds(upd({ pets: [BAS.pets[0], klackt] }));
    const matad = { ...BAS.pets[0], feedCount: 4, lastFedAt: 6 };
    await assertSucceeds(upd({ pets: [matad, klackt], floorApples: [] }));
    await assertSucceeds(upd({ pets: [{ ...matad, feedCount: 5 }, klackt], "farm.inventoryHarvest": { crop_hay: 4, crop_berries: 0 } }));
  });
  it("äpplen: lägga ut, plocka upp och lägga ut det sista", async () => {
    const ute = [...BAS.floorApples, { id: "a2", x: 30, y: 80, room: 1 }];
    await assertSucceeds(upd({ appleCount: 2, floorApples: ute }));
    await assertSucceeds(upd({ appleCount: 3, floorApples: BAS.floorApples }));
    await testEnv.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), "studentData", "e1"), { appleCount: 1, floorApples: deleteField() }));
    await assertSucceeds(upd({ appleCount: 0, floorApples: [{ id: "a9", x: 5, y: 5 }] }));
  });
  it("så ett frö: ur ownedCounts och ur ownedItems (äldre köp utan counts-post)", async () => {
    const slots = [{ slotIndex: 0, cropId: "crop_carrot", growthStage: 0, plantedAt: 1 }];
    await assertSucceeds(upd({ "farm.gardenSlots": slots, "ownedCounts.crop_carrot": 2, lastFro: "crop_carrot" }));
    await assertSucceeds(upd({ "farm.gardenSlots": [...slots, { ...slots[0], slotIndex: 1 }], "ownedCounts.crop_carrot": 1, lastFro: "crop_carrot" }));
    await assertSucceeds(upd({ "ownedCounts.crop_clover": 0, lastFro: "crop_clover" }));
  });
  it("gården: mata gårdsdjur, skörda, flytta djur och hela farm-objektet med samma nivåer", async () => {
    await assertSucceeds(upd({ "farm.animals": [{ ...HAST, trivsel: 100, lastFedAt: 7 }], "farm.inventoryHarvest": { crop_hay: 3 } }));
    await assertSucceeds(upd({ "farm.placedAnimals": [{ petId: HAST.uid, location: "paddock" }] }));
    await assertSucceeds(upd({ farm: { ...BAS.farm, gardenSlots: [] } }));
  });
  it("utseendet: bära och ta av ägda plagg, byta till ägt hus/lada, stugan och null", async () => {
    await assertSucceeds(upd({ avatarItems: ["krona"] }));
    await assertSucceeds(upd({ avatarItems: [] }));
    await assertSucceeds(upd({ husSkalId: "slott" }));
    await assertSucceeds(upd({ husSkalId: "stuga" }));
    await assertSucceeds(upd({ husSkalId: null }));
    await assertSucceeds(upd({ "farm.barnSkin": "lada-bla" }));
    await assertSucceeds(upd({ "farm.barnSkin": null }));
  });
  it("ett plagg som sedan förr saknas i ownedItems kan tas av (men inte på igen)", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), "studentData", "e1"), { avatarItems: ["keps", "cape"] }));
    await assertSucceeds(upd({ avatarItems: ["cape"] }), "keps av – cape fanns redan");
    await assertSucceeds(upd({ avatarItems: [] }));
    await assertFails(upd({ avatarItems: ["cape"] }));
  });
  it("hela dokumentet tillbaka oförändrat och orelaterade fält", async () => {
    await assertSucceeds(setDoc(ref(), { ...BAS, husLast: true }));
    await assertSucceeds(upd({ "progress.so.quiz": { stars: 2 }, "room.placements.soffa": { x: 1, y: 2 } }));
  });
});
