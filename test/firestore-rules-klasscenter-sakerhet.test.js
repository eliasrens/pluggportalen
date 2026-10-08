// ============================================================================
// Regel-tester: Klasscentret – säkerhetsgranskningen (#500), Klass-EXP,
// layout/historik och inredningSparr. Kompletterar de befintliga
// firestore-rules-klasscenter*.test.js (garanti 1, 3 och 4 i
// docs/SAKERHET-klasscentret.md) med fallen granskningen saknade:
//   • EXP: elevpost i en ANNAN klass bär ingen shard-ökning, två shardar på
//     en elevpost, klasskamratens lastUid, påhittat startvärde, läraren
//     skriver inga elevposter, spärren (15 s) går inte att nollställa genom
//     att tömma/radera elevposten,
//   • layout: historik går inte att radera eller efterhandsförfalska, gäst
//     återställer inte, spärrad elev kan inte radera klassprofilen,
//   • bockad elev får fortfarande donera och tjäna EXP (spec §5).
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  doc, getDoc, setDoc, deleteDoc, writeBatch, runTransaction, increment, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { planKlassExpWrites, planRaknareWrite } from "../src/klasscenter/kc-exp-skriv.js";
import { korAterstallning, korSparning, planSave, planSaveWrites } from "../src/klasscenter/kc-layout-plan.js";
import { planDonation, planDonationWrites } from "../src/klasscenter/kc-fund-plan.js";
import { kcShopItem } from "../src/klasscenter/kc-shop-items.js";

let testEnv, unauth, elev, teacher;
const fv = { serverTimestamp };
const sdk = { runTransaction, doc, serverTimestamp };
const STATY = { guldstaty: { x: 30, y: 60, z: 2 } };

const seed = (fn) => testEnv.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));
async function las(...path) {
  let snap;
  await seed(async (db) => { snap = await getDoc(doc(db, ...path)); });
  return snap.exists() ? snap.data() : null;
}
function commit(db, writes) {
  const b = writeBatch(db);
  for (const w of writes) b.set(doc(db, ...w.path), w.data, w.merge ? { merge: true } : {});
  return b.commit();
}
const award = (uid, over = {}) =>
  planKlassExpWrites({ classId: "6a", uid, antal: 1, kalla: "quiz", shard: 0, fv: { increment, serverTimestamp }, ...over });
const spara = (db, uid, placedItems = STATY) =>
  korSparning(sdk, db, { classId: "6a", uid, placedItems, lada: ["guldstaty"] });

before(async () => {
  ({ testEnv, unauth, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-kc-sakerhet"));
});
after(async () => {
  if (testEnv) await testEnv.cleanup();
});
beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(async (db) => {
    await setDoc(doc(db, "classes", "6a"), { name: "6A", studentIds: ["elev1", "elev3"] });
    await setDoc(doc(db, "classes", "6b"), { name: "6B", studentIds: ["elev2"] });
    await setDoc(doc(db, "classes", "6c"), { name: "6C", studentIds: ["elev1"] }); // elev1 i två klasser
    await setDoc(doc(db, "classCenters", "6a"), { inredningSparr: ["elev3"] });
    for (const uid of ["elev1", "elev2", "elev3"]) await setDoc(doc(db, "studentData", uid), { coins: 1000 });
  });
});

describe("Klass-EXP kan inte fuskas (garanti 1)", () => {
  it("elevpost i en ANNAN klass bär ingen shard-ökning (elev i båda klasserna)", async () => {
    const a = award("elev1");
    const c = award("elev1", { classId: "6c" });
    await assertFails(commit(elev("elev1"), [a[0], c[1]]));
    await assertFails(commit(elev("elev1"), [c[0], a[1]]));
    await assertSucceeds(commit(elev("elev1"), c)); // egen batch per klass går
  });

  it("två shardar på EN elevpost nekas (lastShard pekar på en)", async () => {
    const a = award("elev1", { shard: 0 });
    const b = award("elev1", { shard: 1 });
    await assertFails(commit(elev("elev1"), [a[0], b[0], a[1]]));
  });

  it("shard med klasskamratens lastUid nekas", async () => {
    const w = award("elev1");
    w[0].data.lastUid = "elev3";
    await assertFails(commit(elev("elev1"), w));
  });

  it("elevpost som skapas med påhittat startvärde nekas (bara +lastAmount från 0)", async () => {
    const w = award("elev1", { antal: 3 });
    w[0].data.exp = 3; // absolut i stället för increment – samma sak från 0
    w[1].data.exp = 50;
    await assertFails(commit(elev("elev1"), w));
    w[1].data.exp = 3;
    await assertSucceeds(commit(elev("elev1"), w));
  });

  it("läraren skriver inga elevposter (inga bidrag i elevens namn)", async () => {
    await assertFails(commit(teacher(), award("elev1")));
    await assertFails(commit(teacher(), [planRaknareWrite({ classId: "6a", uid: "elev1", raknare: { x: 1 } })]));
  });

  it("spärren (15 s) går inte att nollställa genom att tömma eller radera elevposten", async () => {
    await assertSucceeds(commit(elev("elev1"), award("elev1")));
    const tom = { ...planRaknareWrite({ classId: "6a", uid: "elev1", raknare: { x: 1 } }), merge: false };
    await assertFails(commit(elev("elev1"), [tom])); // set utan merge tar bort lastAt/exp
    await assertFails(deleteDoc(doc(elev("elev1"), "classCenters", "6a", "expMembers", "elev1")));
    await assertFails(deleteDoc(doc(elev("elev1"), "classCenters", "6a", "expShards", "0")));
    await assertFails(commit(elev("elev1"), award("elev1", { shard: 2 })));
    // räknare med merge (appens väg) går fortfarande
    await assertSucceeds(commit(elev("elev1"), [planRaknareWrite({ classId: "6a", uid: "elev1", raknare: { x: 1 } })]));
    assert.equal((await las("classCenters", "6a", "expMembers", "elev1")).exp, 1);
  });

  it("utloggad skapar varken shard eller elevpost", async () => {
    await assertFails(commit(unauth(), award("elev1")));
  });
});

describe("Layout och historik (garanti 3)", () => {
  it("elev raderar varken current eller historik – lärare får nollställa", async () => {
    await spara(elev("elev1"), "elev1");
    await assertFails(deleteDoc(doc(elev("elev1"), "classCenters", "6a", "layoutHistory", "1")));
    await assertFails(deleteDoc(doc(elev("elev1"), "classCenters", "6a", "layout", "current")));
    await assertSucceeds(deleteDoc(doc(teacher(), "classCenters", "6a", "layoutHistory", "1")));
  });

  it("en gammal historikpost går inte att förfalska i efterhand", async () => {
    await spara(elev("elev1"), "elev1");
    await spara(elev("elev1"), "elev1", {});
    const fejk = { placedItems: { fontan: { x: 1, y: 1, z: 1 } }, version: 1, savedBy: "elev1", savedAt: serverTimestamp() };
    const ref = ["classCenters", "6a", "layoutHistory", "1"];
    await assertFails(setDoc(doc(elev("elev1"), ...ref), fejk));
    // inte heller ihop med en ny current (version 3 → slot 3, inte 1)
    const plan = planSave({ current: { version: 2 }, placedItems: fejk.placedItems, uid: "elev1" });
    const [cur] = planSaveWrites({ classId: "6a", plan, fv });
    await assertFails(commit(elev("elev1"), [cur, { path: ref, data: fejk }]));
    assert.deepEqual({ ...(await las(...ref)).placedItems }, STATY);
  });

  it("återställning: medlem ja, gäst och bockad elev nej", async () => {
    await spara(elev("elev1"), "elev1");
    await spara(elev("elev1"), "elev1", {});
    await assertFails(korAterstallning(sdk, elev("elev2"), { classId: "6a", uid: "elev2", slot: 1, forsok: 1 }));
    await assertFails(korAterstallning(sdk, elev("elev3"), { classId: "6a", uid: "elev3", slot: 1, forsok: 1 }));
    await assertSucceeds(korAterstallning(sdk, elev("elev1"), { classId: "6a", uid: "elev1", slot: 1 }));
  });
});

describe("inredningSparr / klassprofilen (garanti 4)", () => {
  it("bockad elev kan inte radera eller ersätta klassprofilen (då vore spärren borta)", async () => {
    await assertFails(deleteDoc(doc(elev("elev3"), "classCenters", "6a")));
    await assertFails(setDoc(doc(elev("elev3"), "classCenters", "6a"), {}));
    await assertFails(setDoc(doc(elev("elev3"), "classCenters", "6a"), { inredningSparr: ["elev1"] }));
    assert.deepEqual((await las("classCenters", "6a")).inredningSparr, ["elev3"]);
    await assertFails(spara(elev("elev3"), "elev3"));
  });

  it("lärare tar bort spärren → eleven får inreda direkt", async () => {
    await assertSucceeds(setDoc(doc(teacher(), "classCenters", "6a"), { inredningSparr: [] }, { merge: true }));
    await assertSucceeds(spara(elev("elev3"), "elev3"));
  });

  it("bockad elev får fortfarande donera och tjäna EXP (spec §5)", async () => {
    await assertSucceeds(commit(elev("elev3"), award("elev3")));
    const p = planDonation({ fund: null, item: kcShopItem("lounge"), amount: 10, coins: 1000 });
    await assertSucceeds(commit(elev("elev3"),
      planDonationWrites({ classId: "6a", uid: "elev3", itemId: "lounge", plan: p, donationId: "d3", coinsFore: 1000, fv })));
  });
});
