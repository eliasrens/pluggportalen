// ============================================================================
// Regel-tester: Klasscentret gemensam layout + historik + inredningSparr
// (#489). Kör de RIKTIGA transaktionerna (korSparning/korAterstallning ur
// src/klasscenter/kc-layout-plan.js) och skrivplanen mot firestore.rules i
// emulatorn och bevisar:
//   • klassmedlem sparar (current + historikslot), lärare sparar/återställer,
//   • bockad elev, annan klass och utloggad nekas,
//   • versionshopp, current utan historikslot, ensam historikslot, fel slot,
//     främmande föremål/fält, ogiltig position och merge-skrivning nekas,
//   • inredningSparr skrivs bara av lärare (och bara det fältet),
//   • layout/historik läses av alla inloggade (gästläge),
//   • två samtidiga sparningar → två hela versioner i följd, ingen blandning.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  doc, getDoc, getDocs, setDoc, updateDoc, collection, writeBatch, runTransaction, serverTimestamp,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { korSparning, korAterstallning, planSave, planSaveWrites } from "../src/klasscenter/kc-layout-plan.js";

let testEnv, unauth, elev, teacher;
const sdk = { runTransaction, doc, serverTimestamp };
const fv = { serverTimestamp };
const lada = ["guldstaty", "fontan", "klassfana"];
const STATY = { guldstaty: { x: 30, y: 60, z: 2 } };

const seed = (fn) => testEnv.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));
async function las(...path) {
  let snap;
  await seed(async (db) => { snap = await getDoc(doc(db, ...path)); });
  return snap.exists() ? snap.data() : null;
}
function commit(db, writes, opt) {
  const b = writeBatch(db);
  for (const w of writes) b.set(doc(db, ...w.path), w.data, opt || {});
  return b.commit();
}
// Skrivplan från ett känt läge (utan transaktion).
function writes({ uid = "elev1", fore = 0, placedItems = STATY } = {}) {
  const plan = planSave({ current: fore ? { version: fore } : null, placedItems, uid });
  assert.equal(plan.ok, true, plan.error);
  return planSaveWrites({ classId: "6a", plan, fv });
}
const spara = (db, uid, placedItems = STATY, over = {}) =>
  korSparning(sdk, db, { classId: "6a", uid, placedItems, lada, ...over });

before(async () => {
  ({ testEnv, unauth, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-kc-layout"));
});
after(async () => {
  if (testEnv) await testEnv.cleanup();
});
beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(async (db) => {
    await setDoc(doc(db, "classes", "6a"), { name: "6A", studentIds: ["elev1", "elev3", "elev4"] });
    await setDoc(doc(db, "classes", "6b"), { name: "6B", studentIds: ["elev2"] });
    await setDoc(doc(db, "classCenters", "6a"), { inredningSparr: ["elev3"] });
  });
});

describe("Layout: spara", () => {
  it("klassmedlem sparar → current version 1 + historikslot 1", async () => {
    const r = await assertSucceeds(spara(elev("elev1"), "elev1"));
    assert.equal(r.version, 1);
    const cur = await las("classCenters", "6a", "layout", "current");
    assert.deepEqual(cur.placedItems, STATY);
    assert.equal(cur.version, 1);
    assert.equal(cur.updatedBy, "elev1");
    assert.ok(cur.updatedAt);
    const h = await las("classCenters", "6a", "layoutHistory", "1");
    assert.deepEqual({ ...h.placedItems }, STATY);
    assert.equal(h.savedBy, "elev1");
    assert.equal(h.version, 1);
  });

  it("klassmedlem i klass UTAN klassprofil (inget inredningSparr) får spara", async () => {
    await seed((db) => setDoc(doc(db, "classes", "6c"), { name: "6C", studentIds: ["elev5"] }));
    await assertSucceeds(korSparning(sdk, elev("elev5"), { classId: "6c", uid: "elev5", placedItems: STATY }));
  });

  it("flera sparningar i följd + tom layout", async () => {
    await spara(elev("elev1"), "elev1");
    await spara(elev("elev4"), "elev4", { fontan: { x: 50, y: 50, z: 0 } });
    const r = await assertSucceeds(spara(elev("elev1"), "elev1", {}));
    assert.equal(r.version, 3);
    assert.deepEqual((await las("classCenters", "6a", "layout", "current")).placedItems, {});
  });

  it("lärare sparar", async () => {
    await assertSucceeds(korSparning(sdk, teacher(), { classId: "6a", uid: "larare1", placedItems: STATY }));
    assert.equal((await las("classCenters", "6a", "layout", "current")).updatedBy, "larare1");
  });

  it("bockad elev (inredningSparr) nekas", async () => {
    await assertFails(commit(elev("elev3"), writes({ uid: "elev3" })));
    await assertFails(spara(elev("elev3"), "elev3", STATY, { forsok: 1 }));
  });

  it("annan klass och utloggad nekas", async () => {
    await assertFails(commit(elev("elev2"), writes({ uid: "elev2" })));
    await assertFails(commit(unauth(), writes({ uid: "elev2" })));
  });

  it("annans namn i updatedBy/savedBy nekas", async () => {
    await assertFails(commit(elev("elev1"), writes({ uid: "elev4" })));
  });
});

describe("Layout: version + historik", () => {
  it("versionshopp nekas (current 0 → 2, och 1 → 3)", async () => {
    await assertFails(commit(elev("elev1"), writes({ fore: 1 })));
    await spara(elev("elev1"), "elev1");
    await assertFails(commit(elev("elev1"), writes({ fore: 2 })));
    await assertFails(commit(elev("elev1"), writes({ fore: 0 }))); // samma version igen
    await assertSucceeds(commit(elev("elev1"), writes({ fore: 1 })));
  });

  it("current utan historikslot nekas, ensam historikslot nekas", async () => {
    const w = writes();
    await assertFails(commit(elev("elev1"), [w[0]]));
    await assertFails(commit(elev("elev1"), [w[1]]));
  });

  it("historik i fel slot eller med annan layout nekas", async () => {
    const fel = writes();
    fel[1].path[3] = "2";
    await assertFails(commit(elev("elev1"), fel));
    const annan = writes();
    annan[1].data.placedItems = {};
    await assertFails(commit(elev("elev1"), annan));
    const ver = writes();
    ver[1].data.version = 11; // 11 % 10 = slot 1, men current säger 1
    await assertFails(commit(elev("elev1"), ver));
  });

  it("11 sparningar → slot 1 (version 1) överskriven, 10 slottar kvar", async () => {
    for (let i = 1; i <= 11; i++) await spara(elev("elev1"), "elev1", { guldstaty: { x: i, y: 1, z: 0 } });
    assert.equal((await las("classCenters", "6a", "layoutHistory", "1")).version, 11);
    assert.equal((await las("classCenters", "6a", "layoutHistory", "0")).version, 10);
    const snap = await getDocs(collection(elev("elev2"), "classCenters", "6a", "layoutHistory"));
    assert.equal(snap.size, 10);
  });

  it("merge-skrivning (nästlad blandning) nekas eller blir hel – aldrig en blandad layout", async () => {
    await spara(elev("elev1"), "elev1", { guldstaty: { x: 1, y: 1, z: 0 }, fontan: { x: 2, y: 2, z: 0 } });
    // set med merge behåller fontan i current men historiken säger bara guldstaty → nekas
    await assertFails(commit(elev("elev1"), writes({ fore: 1, placedItems: { guldstaty: { x: 9, y: 9, z: 0 } } }), { merge: true }));
    const cur = await las("classCenters", "6a", "layout", "current");
    assert.equal(cur.version, 1);
  });
});

describe("Layout: fältform och storlek", () => {
  async function nekas(placedItems) {
    const w = writes();
    w[0].data.placedItems = placedItems;
    w[1].data.placedItems = placedItems;
    await assertFails(commit(elev("elev1"), w));
  }
  it("okänt föremål / #n-nyckel nekas", async () => {
    await nekas({ soffa: { x: 1, y: 1, z: 0 } });
    await nekas({ "guldstaty#2": { x: 1, y: 1, z: 0 } });
  });
  it("position utanför 0–100, z ej heltal/utanför, saknat/extra fält nekas", async () => {
    await nekas({ guldstaty: { x: 101, y: 1, z: 0 } });
    await nekas({ guldstaty: { x: 1, y: -1, z: 0 } });
    await nekas({ guldstaty: { x: 1, y: 1, z: 1.5 } });
    await nekas({ guldstaty: { x: 1, y: 1, z: 1000 } });
    await nekas({ guldstaty: { x: 1, y: 1 } });
    await nekas({ guldstaty: { x: 1, y: 1, z: 0, farg: "röd" } });
    await nekas({ guldstaty: { x: "1", y: 1, z: 0 } });
    await nekas({ guldstaty: "mitt" });
    await nekas(["guldstaty"]);
  });
  it("främmande fält i current/historik nekas", async () => {
    const w = writes();
    w[0].data.extra = "x".repeat(10000);
    await assertFails(commit(elev("elev1"), w));
    const h = writes();
    h[1].data.extra = 1;
    await assertFails(commit(elev("elev1"), h));
  });
  it("decimaltal i x/y godtas (procent)", async () => {
    await assertSucceeds(commit(elev("elev1"), writes({ placedItems: { guldstaty: { x: 33.33, y: 0, z: 0 }, fontan: { x: 100, y: 99.5, z: 999 } } })));
  });
});

describe("Layout: återställ", () => {
  it("återställning blir en ny version och hamnar i historiken", async () => {
    await spara(elev("elev1"), "elev1");
    await spara(elev("elev4"), "elev4", {}); // "förstört"
    const r = await assertSucceeds(korAterstallning(sdk, elev("elev1"), { classId: "6a", uid: "elev1", slot: 1, lada }));
    assert.equal(r.version, 3);
    assert.equal(r.aterstalldFran, 1);
    assert.deepEqual((await las("classCenters", "6a", "layout", "current")).placedItems, STATY);
    assert.deepEqual({ ...(await las("classCenters", "6a", "layoutHistory", "3")).placedItems }, STATY);
    assert.equal((await las("classCenters", "6a", "layoutHistory", "2")).version, 2);
  });
  it("lärare återställer, bockad elev nekas", async () => {
    await spara(elev("elev1"), "elev1");
    await spara(elev("elev1"), "elev1", {});
    await assertFails(korAterstallning(sdk, elev("elev3"), { classId: "6a", uid: "elev3", slot: 1, forsok: 1 }));
    await assertSucceeds(korAterstallning(sdk, teacher(), { classId: "6a", uid: "larare1", slot: 1 }));
    assert.equal((await las("classCenters", "6a", "layout", "current")).version, 3);
  });
  it("bockad elev nekas direkt (krock=false) även med alla omförsök (#493)", async () => {
    await spara(elev("elev1"), "elev1");
    await assert.rejects(korAterstallning(sdk, elev("elev3"), { classId: "6a", uid: "elev3", slot: 1 }),
      (e) => e.code === "permission-denied" && e.krock === false);
  });
  it("O1: inaktuell lista (slotten överskriven av ringbufferten) → historik-andrad (#493)", async () => {
    await spara(elev("elev1"), "elev1"); // v1 i slot 1 = STATY
    for (let i = 2; i <= 11; i++) await spara(elev("elev4"), "elev4", {}); // v11 skriver över slot 1
    const r = await korAterstallning(sdk, elev("elev1"), { classId: "6a", uid: "elev1", slot: 1, historikVersion: 1, lada });
    assert.equal(r.kod, "historik-andrad");
    assert.equal((await las("classCenters", "6a", "layout", "current")).version, 11);
    const ok = await assertSucceeds(korAterstallning(sdk, elev("elev1"), { classId: "6a", uid: "elev1", slot: 1, historikVersion: 11, lada }));
    assert.equal(ok.version, 12);
  });
});

describe("Layout: läsning + samtidighet", () => {
  it("alla inloggade läser layout och historik (gästläge), inte utloggad", async () => {
    await spara(elev("elev1"), "elev1");
    await assertSucceeds(getDoc(doc(elev("elev2"), "classCenters", "6a", "layout", "current")));
    await assertSucceeds(getDocs(collection(elev("elev3"), "classCenters", "6a", "layoutHistory")));
    await assertFails(getDoc(doc(unauth(), "classCenters", "6a", "layout", "current")));
    await assertFails(getDocs(collection(unauth(), "classCenters", "6a", "layoutHistory")));
  });

  it("två samtidiga sparningar → två hela versioner i följd, senaste vinner", async () => {
    const A = { guldstaty: { x: 10, y: 10, z: 0 } };
    const B = { fontan: { x: 80, y: 80, z: 1 }, klassfana: { x: 50, y: 5, z: 2 } };
    const [ra, rb] = await Promise.all([spara(elev("elev1"), "elev1", A), spara(elev("elev4"), "elev4", B)]);
    assert.deepEqual([ra.version, rb.version].sort(), [1, 2]);
    const cur = await las("classCenters", "6a", "layout", "current");
    assert.equal(cur.version, 2);
    const senast = ra.version === 2 ? A : B;
    assert.deepEqual(cur.placedItems, senast); // hel layout, ingen blandning
    const h1 = await las("classCenters", "6a", "layoutHistory", "1");
    const h2 = await las("classCenters", "6a", "layoutHistory", "2");
    assert.deepEqual([h1.placedItems, h2.placedItems].map((p) => Object.keys(p).sort().join()).sort(), ["fontan,klassfana", "guldstaty"]);
  });

  it("forvantadVersion inaktuell → krock utan skrivning", async () => {
    await spara(elev("elev1"), "elev1");
    const r = await spara(elev("elev4"), "elev4", {}, { forvantadVersion: 0 });
    assert.equal(r.kod, "krock");
    assert.equal((await las("classCenters", "6a", "layout", "current")).version, 1);
  });

  it("lärare kan radera (nollställa), elev inte", async () => {
    await spara(elev("elev1"), "elev1");
    const { deleteDoc } = await import("firebase/firestore");
    await assertFails(deleteDoc(doc(elev("elev1"), "classCenters", "6a", "layout", "current")));
    await assertSucceeds(deleteDoc(doc(teacher(), "classCenters", "6a", "layoutHistory", "1")));
  });
});

describe("Klassprofilen: inredningSparr", () => {
  it("lärare sätter listan (create och update)", async () => {
    await assertSucceeds(setDoc(doc(teacher(), "classCenters", "6a"), { inredningSparr: ["elev1", "elev3"] }, { merge: true }));
    await assertSucceeds(setDoc(doc(teacher(), "classCenters", "6b"), { inredningSparr: [] }, { merge: true }));
    // nu är elev1 bockad → nekas
    await assertFails(commit(elev("elev1"), writes()));
  });

  it("elev kan inte ändra inredningSparr (inte ens ta bort sig själv)", async () => {
    await assertFails(updateDoc(doc(elev("elev3"), "classCenters", "6a"), { inredningSparr: [] }));
    await assertFails(setDoc(doc(elev("elev1"), "classCenters", "6a"), { inredningSparr: ["elev4"] }, { merge: true }));
    await assertFails(setDoc(doc(elev("elev2"), "classCenters", "6b"), { inredningSparr: [] }));
  });

  it("lärare får bara skriva inredningSparr, som lista ≤ 200", async () => {
    await assertFails(setDoc(doc(teacher(), "classCenters", "6a"), { trophies: [] }, { merge: true }));
    await assertFails(setDoc(doc(teacher(), "classCenters", "6a"), { inredningSparr: "elev1" }, { merge: true }));
    const mycket = Array.from({ length: 201 }, (_, i) => `e${i}`);
    await assertFails(setDoc(doc(teacher(), "classCenters", "6a"), { inredningSparr: mycket }, { merge: true }));
  });

  it("klassprofilen läses av klassen och lärare – inte gäst eller utloggad (#500)", async () => {
    await assertSucceeds(getDoc(doc(elev("elev1"), "classCenters", "6a")));
    await assertSucceeds(getDoc(doc(teacher(), "classCenters", "6a")));
    await assertFails(getDoc(doc(elev("elev2"), "classCenters", "6a")));
    await assertFails(getDoc(doc(unauth(), "classCenters", "6a")));
  });
});
