// ============================================================================
// Testarens svit för varulåset (#856, docs/SAKERHET-MYNT.md §6 B4). Angreppen
// körs med de riktiga anroparna: gåvan via data-mynt.js tjanaMyntMed med samma
// extra som data-farm.js claimFarmAnimalGift (farmFromData + claimGiftIn +
// medDoldaPoster), och djurlistorna läses tillbaka med läsfunktionerna.
//   • gårdsgåvan: egen agdaDjur-post (dotted, merge, batch ihop med gåvan,
//     nytt dokument), fejkat djur bara i farm.animals, ett ägt rumsdjurs/äggs
//     uid som gårdsdjur, en ägd häst ×5, raderat dagskvitto → inga extra mynt
//   • kantfall i varugrenarna: avatarItems/husSkalId/barnSkin/farm/ownedCounts/
//     floorApples i ovanliga former
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  arrayRemove, arrayUnion, deleteDoc, deleteField, doc, getDoc, runTransaction, serverTimestamp, setDoc, updateDoc, writeBatch,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { installeraFirebaseStubbe } from "./helpers/firebase-stub-loader.js";
import { MYNT_DAG_KVITTON, myntDag } from "../src/mynt-dag.js";
import { farmFromData, claimGiftIn, medDoldaPoster } from "../src/farm-core.js";
import { defaultStudentData } from "../src/klass-membership.js";

let testEnv, elev, tjanaMyntMed;
const IDAG = myntDag(Date.now());
const HAST = { uid: "h1", id: "animal_horse", name: null, pos: null, trivsel: 100, lastFedAt: Date.now(), lastGiftAt: null };
const BAS = {
  ...defaultStudentData("fox"),
  coins: 100, xp: 50,
  ownedItems: ["keps", "lada-bla", "slott"],
  avatarItems: ["gammal-krona"], // äldre plagg som saknas i ownedItems
  roomAnimals: [{ uid: "fisk#1", id: "fisk", pos: { x: 1, y: 2 }, name: null, stowed: false }],
  pets: [{ id: "p1", eggBoughtAt: 1, hatchedAt: null, stage: 0, feedCount: 0 }],
  agdaDjur: { h1: "animal_horse", "fisk#1": "fisk", p1: "mystery-egg" },
  farm: { barnLevel: 2, barnSkin: null, gardenTier: 1, gardenSlots: [], inventoryHarvest: {}, placedAnimals: [], animals: [HAST] },
};

async function las(...path) {
  let out;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const s = await getDoc(doc(ctx.firestore(), ...path));
    out = s.exists() ? s.data() : null;
  });
  return out;
}
const seed = (data, uid = "e1") => testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "studentData", uid), data));
const ref = (uid = "e1") => doc(elev(uid), "studentData", uid);
const sdk = (uid = "e1") => ({ db: elev(uid), doc, runTransaction, serverTimestamp, nu: Date.now });
// claimFarmAnimalGift:s extra (data-farm.js) – ett angrepp skickar ett eget.
const gavaExtra = (uid) => (sd) => {
  const r = claimGiftIn(farmFromData(sd || {}), uid);
  return r.ok ? { "farm.animals": medDoldaPoster(sd.farm && sd.farm.animals, r.farm.animals, (a) => a.uid) } : null;
};
const gava = (gardUid, extra = gavaExtra(gardUid)) => tjanaMyntMed(sdk(), "gard", 8, { gardUid, extra, studentId: "e1" });
const rattFarm = (animals) => ({ "farm.animals": animals });

before(async () => {
  ({ testEnv, elev } = await createRulesEnv("pluggportalen-rules-test-mynt-varor-tester-856"));
  installeraFirebaseStubbe();
  ({ tjanaMyntMed } = await import("../src/data-mynt.js"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });
beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(BAS);
});

describe("tester #856: gårdsgåvan kan inte ge extra mynt", () => {
  it("baslinje: den ägda hästen ger 8 en gång, andra gången samma dag 0", async () => {
    const r1 = await gava("h1");
    assert.deepEqual([r1.mynt, r1.saldo], [8, 108]);
    const r2 = await gava("h1", rattFarm(BAS.farm.animals));
    assert.equal(r2.mynt, 0);
    assert.equal((await las("studentData", "e1")).coins, 108);
  });
  it("egen agdaDjur-post nekas i alla former (dotted, merge, hela kartan, batch ihop med gåvan)", async () => {
    const fejk = { uid: "fejk1", id: "animal_horse", trivsel: 100, lastFedAt: Date.now(), lastGiftAt: null };
    await assertFails(updateDoc(ref(), { "agdaDjur.fejk1": "animal_horse", "farm.animals": [HAST, fejk] }));
    await assertFails(setDoc(ref(), { agdaDjur: { fejk1: "animal_horse" } }, { merge: true }));
    await assertFails(updateDoc(ref(), { agdaDjur: { ...BAS.agdaDjur, fejk1: "animal_horse" } }));
    // Hela gåvan i EN transaktion med kartposten i extra.
    const r = await gava("fejk1", { "agdaDjur.fejk1": "animal_horse", "farm.animals": [HAST, fejk] });
    assert.equal(r.nekad, true);
    const sd = await las("studentData", "e1");
    assert.equal(sd.coins, 100);
    assert.ok(!("fejk1" in sd.agdaDjur));
    assert.equal(await las("studentData", "e1", MYNT_DAG_KVITTON, IDAG), null, "inget kvitto skrevs");
  });
  it("fejkade hästar bara i farm.animals: listan går att skriva, men gåvan nekas och de syns inte", async () => {
    const fejk = Array.from({ length: 5 }, (_, i) => ({ uid: `fejk${i}`, id: "animal_horse", trivsel: 100, lastFedAt: Date.now(), lastGiftAt: null }));
    await assertSucceeds(updateDoc(ref(), { "farm.animals": [HAST, ...fejk] }));
    for (const f of fejk) {
      const r = await gava(f.uid, rattFarm([HAST, ...fejk]));
      assert.equal(r.mynt, 0);
      assert.equal(r.nekad, true, f.uid);
    }
    // Klientens egen väg (claimGiftIn på farmFromData) skriver inte ens.
    const r = await gava("fejk0");
    assert.equal(r.avbrutet, true);
    const sd = await las("studentData", "e1");
    assert.equal(sd.coins, 100);
    assert.deepEqual(farmFromData(sd).animals.map((a) => a.uid), ["h1"]);
  });
  it("ett ägt rumsdjurs eller äggs uid inkopierat som gårdsdjur ger ingen gåva och syns inte på gården", async () => {
    const kopior = [
      { uid: "fisk#1", id: "animal_horse", trivsel: 100, lastFedAt: Date.now(), lastGiftAt: null },
      { uid: "p1", id: "animal_cow", trivsel: 100, lastFedAt: Date.now(), lastGiftAt: null },
    ];
    await assertSucceeds(updateDoc(ref(), { "farm.animals": [HAST, ...kopior] }));
    assert.equal((await gava("fisk#1", rattFarm([HAST, ...kopior]))).nekad, true);
    assert.equal((await gava("p1", rattFarm([HAST, ...kopior]))).nekad, true);
    const sd = await las("studentData", "e1");
    assert.equal(sd.coins, 100);
    assert.deepEqual(farmFromData(sd).animals.map((a) => a.uid), ["h1"]);
  });
  it("den ägda hästen ×5 i farm.animals ger en gåva och ett djur", async () => {
    const fem = Array.from({ length: 5 }, () => ({ ...HAST }));
    await assertSucceeds(updateDoc(ref(), { "farm.animals": fem }));
    assert.equal(farmFromData(await las("studentData", "e1")).animals.length, 1);
    assert.equal((await gava("h1")).mynt, 8);
    for (let i = 0; i < 4; i++) assert.equal((await gava("h1", rattFarm(fem))).mynt, 0);
    assert.equal((await las("studentData", "e1")).coins, 108);
  });
  it("radera dagskvittot för att nollställa gavor nekas", async () => {
    await gava("h1");
    await assertFails(deleteDoc(doc(elev("e1"), "studentData", "e1", MYNT_DAG_KVITTON, IDAG)));
    await assertFails(setDoc(doc(elev("e1"), "studentData", "e1", MYNT_DAG_KVITTON, IDAG), { dag: IDAG, gavor: {} }, { merge: true }));
    assert.equal((await gava("h1", rattFarm(BAS.farm.animals))).mynt, 0);
  });
  it("nytt dokument med agdaDjur + gåva i samma batch nekas", async () => {
    const db = elev("ny1");
    const b = writeBatch(db);
    b.set(doc(db, "studentData", "ny1"), { ...defaultStudentData("fox"), coins: 8, agdaDjur: { h9: "animal_horse" },
      farm: { ...defaultStudentData("fox").farm, animals: [{ ...HAST, uid: "h9" }] } });
    b.set(doc(db, "studentData", "ny1", MYNT_DAG_KVITTON, IDAG),
      { dag: IDAG, kalla: "gard", gard: 8, senastMynt: 8, senastXp: 0, gardUid: "h9", gavor: { h9: true }, lastAt: serverTimestamp() });
    await assertFails(b.commit());
    // Samma utan agdaDjur (bara standarddokumentet) skapas, men gåvan nekas.
    await assertSucceeds(setDoc(doc(db, "studentData", "ny1"), defaultStudentData("fox")));
    await assertFails(updateDoc(doc(db, "studentData", "ny1"), { agdaDjur: { h9: "animal_horse" } }));
  });
});

describe("tester #856: kantfall i varugrenarna", () => {
  it("avatarItems: ett äldre ej ägt plagg får ligga kvar och tas av, men inte tas på igen", async () => {
    await assertSucceeds(updateDoc(ref(), { avatarItems: ["gammal-krona", "keps"] }), "ta på ägd keps, behåll äldre");
    await assertSucceeds(updateDoc(ref(), { avatarItems: ["keps"] }), "ta av det äldre");
    await assertFails(updateDoc(ref(), { avatarItems: ["keps", "gammal-krona"] }), "tillbaka på → nekas");
    await assertFails(updateDoc(ref(), { avatarItems: arrayUnion("cape") }));
    await assertFails(updateDoc(ref(), { avatarItems: "keps" }), "inte en lista");
    await assertSucceeds(updateDoc(ref(), { avatarItems: arrayRemove("keps") }));
  });
  it("husSkalId: ägt/stuga/null ok, tom sträng, ej ägt och borttaget fält", async () => {
    await assertSucceeds(updateDoc(ref(), { husSkalId: "slott" }));
    await assertSucceeds(updateDoc(ref(), { husSkalId: "stuga" }));
    await assertSucceeds(updateDoc(ref(), { husSkalId: null }));
    await assertFails(updateDoc(ref(), { husSkalId: "" }));
    await assertFails(updateDoc(ref(), { husSkalId: "lyxvilla" }));
    await assertSucceeds(updateDoc(ref(), { husSkalId: deleteField() }), "fältet borta = default-stugan");
  });
  it("farm: borttagen/ersatt karta, borttagen barnLevel, ägd/ej ägd lada", async () => {
    await assertFails(updateDoc(ref(), { farm: deleteField() }));
    await assertFails(updateDoc(ref(), { farm: { animals: [HAST] } }), "hela kartan utan nivåer");
    await assertFails(updateDoc(ref(), { "farm.barnLevel": deleteField() }));
    await assertFails(updateDoc(ref(), { "farm.gardenTier": 3 }));
    await assertSucceeds(updateDoc(ref(), { "farm.barnSkin": "lada-bla" }));
    await assertFails(updateDoc(ref(), { "farm.barnSkin": "lada-guld" }));
    await assertSucceeds(updateDoc(ref(), { "farm.barnSkin": null }));
  });
  it("ownedCounts: negativt, decimal och borttagen karta nekas; frö från ownedItems ned till 0 ok", async () => {
    await seed({ ...BAS, ownedItems: [...BAS.ownedItems, "crop_clover"], ownedCounts: { crop_carrot: 3 } });
    await assertFails(updateDoc(ref(), { "ownedCounts.crop_carrot": -1, lastFro: "crop_carrot" }));
    await assertFails(updateDoc(ref(), { "ownedCounts.crop_carrot": 2.5, lastFro: "crop_carrot" }));
    await assertFails(updateDoc(ref(), { ownedCounts: deleteField(), lastFro: "crop_carrot" }));
    await assertFails(updateDoc(ref(), { "ownedCounts.crop_okand": 0, lastFro: "crop_okand" }), "frö man inte har");
    await assertSucceeds(updateDoc(ref(), { "ownedCounts.crop_clover": 0, lastFro: "crop_clover" }));
  });
  it("äpplen: floorApples som karta, decimal appleCount och borttaget förråd", async () => {
    await seed({ ...BAS, appleCount: 2, floorApples: [{ id: "a1", x: 1, y: 1 }] });
    await assertFails(updateDoc(ref(), { appleCount: 2.5 }));
    await assertFails(updateDoc(ref(), { appleCount: 4, floorApples: deleteField() }), "förrådet +2, golvet −1");
    await assertSucceeds(updateDoc(ref(), { appleCount: 3, floorApples: [] }), "plocka upp");
    await assertSucceeds(updateDoc(ref(), { appleCount: 2, floorApples: [{ id: "a2", x: 5, y: 5 }] }), "lägga ut");
    await assertFails(updateDoc(ref(), { floorApples: { a: 1, b: 2 } }), "karta med fler poster än listan");
  });
});
