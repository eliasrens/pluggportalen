// ============================================================================
// Regel-tester: flyttade pokaler i Klasscentrets layout (#497). Kör den
// RIKTIGA sparningen (korSparning ur src/klasscenter/kc-layout-plan.js) mot
// firestore.rules i emulatorn och bevisar att kcPlaced:
//   • godtar "pokal-<trophyId>"-nycklar för kända pokaltyper bredvid
//     katalogföremålen – även ett FULLT rum (alla 8 föremål + 8 pokaler)
//     som elev, vilket är det dyraste fallet mot reglernas 1000-uttryckstak
//     (före #497 nekades redan 8 föremål utan pokaler),
//   • nekar okänd typ, fel prefix, ogiltigt kallaId, för många pokaler och
//     ogiltig position (per index – första, mittersta och sista),
//   • fortfarande nekar främmande möbel-id:n och bockad elev.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, writeBatch, runTransaction, serverTimestamp } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { korSparning, planSaveWrites, KC_POKAL_MAX } from "../src/klasscenter/kc-layout-plan.js";
import { KC_SHOP_ITEMS } from "../src/klasscenter/kc-shop-items.js";

let testEnv, elev, teacher;
const sdk = { runTransaction, doc, serverTimestamp };
const fv = { serverTimestamp };
const lada = KC_SHOP_ITEMS.map((it) => it.id);
const POS = { x: 30, y: 20, z: 1 };

const seed = (fn) => testEnv.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));
const spara = (db, uid, placedItems) => korSparning(sdk, db, { classId: "6a", uid, placedItems, lada });

// Rå skrivning (förbi klientvalideringen) – reglerna är den riktiga spärren.
function raSkriv(db, uid, placedItems) {
  const plan = { ok: true, version: 1, slot: 1, placedItems, uid };
  const b = writeBatch(db);
  for (const w of planSaveWrites({ classId: "6a", plan, fv })) b.set(doc(db, ...w.path), w.data);
  return b.commit();
}

function pokaler(n, pos = () => POS) {
  const ut = {};
  for (let i = 0; i < n; i++) ut[`pokal-${i % 2 ? "live-vinst" : "mm-klasskamp"}-k${i}`] = pos(i);
  return ut;
}

before(async () => {
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-kc-layout-pokal"));
});
after(async () => {
  if (testEnv) await testEnv.cleanup();
});
beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(async (db) => {
    await setDoc(doc(db, "classes", "6a"), { name: "6A", studentIds: ["elev1", "elev3"] });
    await setDoc(doc(db, "classCenters", "6a"), { inredningSparr: ["elev3"] });
  });
});

describe("Layout med flyttade pokaler", () => {
  it("klassmedlem sparar pokaler bredvid möbler (alla tre typerna)", async () => {
    const pi = {
      lounge: { x: 40, y: 80, z: 0 },
      "pokal-mm-klasskamp-AbC_9": POS,
      "pokal-live-vinst-s1": { x: 70, y: 30, z: 2 },
      "pokal-live-avklarat-s2": { x: 0, y: 100, z: 999 },
    };
    const r = await assertSucceeds(spara(elev("elev1"), "elev1", pi));
    assert.equal(r.version, 1);
    let cur;
    await seed(async (db) => { cur = (await getDoc(doc(db, "classCenters", "6a", "layout", "current"))).data(); });
    assert.deepEqual(Object.keys(cur.placedItems).sort(), Object.keys(pi).sort());
  });

  it(`fullt rum: alla 8 föremål + ${KC_POKAL_MAX} pokaler går (elev och lärare)`, async () => {
    const pi = { ...pokaler(KC_POKAL_MAX, (i) => ({ x: 100 - i * 3.33, y: i * 1.5, z: 999 - i })) };
    for (const id of lada) pi[id] = { x: 50, y: 50, z: 0 };
    await assertSucceeds(spara(elev("elev1"), "elev1", pi));
    await assertSucceeds(spara(teacher(), "larare1", pi));
  });

  it("alla 8 föremål utan pokaler går (regression: 1000-uttryckstaket)", async () => {
    const pi = {};
    for (const id of lada) pi[id] = { x: 12.5, y: 99.99, z: 7 };
    await assertSucceeds(spara(elev("elev1"), "elev1", pi));
  });

  it(`${KC_POKAL_MAX + 1} pokaler nekas`, async () => {
    await assertFails(raSkriv(elev("elev1"), "elev1", pokaler(KC_POKAL_MAX + 1)));
  });

  it("okänd typ, fel prefix, ogiltigt kallaId och främmande möbel nekas", async () => {
    for (const nyckel of ["pokal-hittepa-1", "trofe-mm-klasskamp-1", "pokal-mm-klasskamp-", "pokal-mm-klasskamp-a.b",
      "pokal-mm-klasskamp-a/pokal-live-vinst-b", "soffa"]) {
      await assertFails(raSkriv(elev("elev1"), "elev1", { [nyckel]: POS }), nyckel);
    }
  });

  it("ogiltig position nekas på varje index (första, mitten, sista)", async () => {
    for (const fel of [0, 4, KC_POKAL_MAX - 1]) {
      const pi = pokaler(KC_POKAL_MAX, (i) => (i === fel ? { x: 101, y: 5, z: 0 } : POS));
      await assertFails(raSkriv(elev("elev1"), "elev1", pi), `index ${fel}`);
    }
    await assertFails(raSkriv(elev("elev1"), "elev1", { "pokal-live-vinst-s1": { x: 5, y: 5, z: 1.5 } }));
    await assertFails(raSkriv(elev("elev1"), "elev1", { "pokal-live-vinst-s1": { x: 5, y: 5, z: 1, extra: 1 } }));
    await assertFails(raSkriv(elev("elev1"), "elev1", { "pokal-live-vinst-s1": { x: 5, y: 5 } }));
    await assertFails(raSkriv(elev("elev1"), "elev1", { "pokal-live-vinst-s1": { x: "5", y: 5, z: 1 } }));
    await assertFails(raSkriv(elev("elev1"), "elev1", { "pokal-live-vinst-s1": { x: 5, y: true, z: 1 } }));
    await assertFails(raSkriv(elev("elev1"), "elev1", { "pokal-live-vinst-s1": { x: -0.5, y: 5, z: 1 } }));
  });

  it("bockad elev får inte flytta pokaler heller", async () => {
    await assertFails(raSkriv(elev("elev3"), "elev3", { "pokal-live-vinst-s1": POS }));
  });
});
