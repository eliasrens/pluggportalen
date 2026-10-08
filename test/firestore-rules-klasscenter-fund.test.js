// ============================================================================
// Regel-tester: Klasscentret crowdfunding (#486). Kör den RIKTIGA
// transaktionen (korDonation ur src/klasscenter/kc-fund-plan.js) och dess
// skrivplan mot firestore.rules i emulatorn och bevisar:
//   • lyckad donation (mynt dras, donationspost, fund 100/5000), cappning
//     till exakt det som saknas → isUnlocked, sedan nekas allt,
//   • överdonation, ökning utan donationspost, ökning ≠ donationens belopp,
//     ändrat pris, påhittat föremål, återanvänd donationspost, annan klass,
//     annans uid och donation utan myntavdrag nekas,
//   • donations läses bara av lärare, fund av alla inloggade,
//   • två samtidiga transaktioner ger rätt summa (och cappas vid målet),
//   • 12 samtidiga givare går ALLA igenom (#493), även förbi målet: summan
//     exakt, aldrig över, ingen förlorar mynt; icke-medlem nekas direkt.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  doc, getDoc, getDocFromServer, getDocs, setDoc, collection, writeBatch, increment, serverTimestamp,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { korDonation, planDonation, planDonationWrites } from "../src/klasscenter/kc-fund-plan.js";
import { kcShopItem } from "../src/klasscenter/kc-shop-items.js";

let testEnv, unauth, elev, teacher;
const sdk = { doc, collection, getDocFromServer, writeBatch, increment, serverTimestamp };
const fv = { serverTimestamp };
const staty = kcShopItem("guldstaty");

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
// Skrivplan för en donation från ett känt läge (utan transaktion).
function plan({ uid = "elev1", classId = "6a", itemId = "guldstaty", fund = null, amount = 100, coins = 1000, id = "don-" + Math.random().toString(36).slice(2, 10) } = {}) {
  const p = planDonation({ fund, item: kcShopItem(itemId) || staty, amount, coins });
  return planDonationWrites({ classId, uid, itemId, plan: p, donationId: id, coinsFore: coins, fv });
}
const donera = (uid, amount, over = {}) =>
  korDonation(sdk, elev(uid), { classId: "6a", uid, itemId: "guldstaty", amount, ...over });
async function fundLage(fundedAmount, extra = {}) {
  await seed((db) => setDoc(doc(db, "classCenters", "6a", "fund", "guldstaty"), {
    targetPrice: 5000, fundedAmount, isUnlocked: false, lastDonationId: "gammal-donation", ...extra,
  }));
}

before(async () => {
  ({ testEnv, unauth, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-kc-fund"));
});
after(async () => {
  if (testEnv) await testEnv.cleanup();
});
beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(async (db) => {
    await setDoc(doc(db, "classes", "6a"), { name: "6A", studentIds: ["elev1", "elev3"] });
    await setDoc(doc(db, "classes", "6b"), { name: "6B", studentIds: ["elev2"] });
    for (const uid of ["elev1", "elev2", "elev3"]) await setDoc(doc(db, "studentData", uid), { coins: 1000 });
  });
});

describe("Crowdfunding: lyckade donationer", () => {
  it("elev A donerar 100 till guldstatyn (5000) → 100/5000, mynt dras, anonym post", async () => {
    const r = await assertSucceeds(donera("elev1", 100));
    assert.equal(r.ok, true);
    const f = await las("classCenters", "6a", "fund", "guldstaty");
    assert.deepEqual({ ...f }, { targetPrice: 5000, fundedAmount: 100, isUnlocked: false, lastDonationId: r.donationId });
    assert.equal((await las("studentData", "elev1")).coins, 900);
    const d = await las("classCenters", "6a", "donations", r.donationId);
    assert.equal(d.uid, "elev1");
    assert.equal(d.amount, 100);
  });

  it("donation som passerar målet cappas till det som saknas → köpt, sedan nekas mer", async () => {
    await fundLage(4900);
    const r = await assertSucceeds(donera("elev1", 300));
    assert.equal(r.amount, 100);
    assert.equal(r.isUnlocked, true);
    const f = await las("classCenters", "6a", "fund", "guldstaty");
    assert.equal(f.fundedAmount, 5000);
    assert.equal(f.isUnlocked, true);
    assert.ok(f.unlockedAt);
    assert.equal((await las("studentData", "elev1")).coins, 900); // bara 100 drogs
    // klienten säger nej …
    assert.equal((await donera("elev3", 10)).kod, "redan-kopt");
    // … och reglerna också (handbyggd skrivning förbi klienten)
    const w = plan({ uid: "elev3", fund: { targetPrice: 5000, fundedAmount: 4990 }, amount: 10 });
    await assertFails(commit(elev("elev3"), w));
  });

  it("fund läses av alla inloggade (även annan klass), inte utloggad", async () => {
    await donera("elev1", 50);
    await assertSucceeds(getDocs(collection(elev("elev2"), "classCenters", "6a", "fund")));
    await assertFails(getDocs(collection(unauth(), "classCenters", "6a", "fund")));
  });

  it("donations läses bara av lärare", async () => {
    const r = await donera("elev1", 50);
    await assertSucceeds(getDocs(collection(teacher(), "classCenters", "6a", "donations")));
    await assertFails(getDocs(collection(elev("elev1"), "classCenters", "6a", "donations")));
    await assertFails(getDoc(doc(elev("elev1"), "classCenters", "6a", "donations", r.donationId)));
    await assertFails(getDocs(collection(elev("elev3"), "classCenters", "6a", "donations")));
  });
});

describe("Crowdfunding: nekas", () => {
  it("överdonation (fundedAmount > targetPrice) nekas", async () => {
    await fundLage(4900);
    const w = plan({ fund: { targetPrice: 5000, fundedAmount: 4900 }, amount: 100 });
    w[1].data.amount = 200;
    w[2].data.fundedAmount = 5100;
    w[2].data.isUnlocked = false;
    w[0].data.coins = 800;
    await assertFails(commit(elev("elev1"), w));
  });

  it("ökning utan donationspost nekas (och post utan fund-ökning)", async () => {
    const w = plan();
    await assertFails(commit(elev("elev1"), [w[0], w[2]]));
    await assertFails(commit(elev("elev1"), [w[0], w[1]]));
  });

  it("fund-ökning som inte är exakt donationens belopp nekas", async () => {
    const w = plan({ amount: 100 });
    w[2].data.fundedAmount = 150;
    await assertFails(commit(elev("elev1"), w));
  });

  it("donation utan myntavdrag (eller fel avdrag / negativt saldo) nekas", async () => {
    const w = plan({ amount: 100 });
    await assertFails(commit(elev("elev1"), [w[1], w[2]]));
    w[0].data.coins = 950;
    await assertFails(commit(elev("elev1"), w));
    await seed((db) => setDoc(doc(db, "studentData", "elev1"), { coins: 30 }));
    await assertFails(commit(elev("elev1"), plan({ amount: 100, coins: 30 }).map((x, i) => (i === 0 ? { ...x, data: { coins: -70 } } : x))));
  });

  it("ändrat pris, påhittat föremål och fel isUnlocked nekas", async () => {
    const billig = plan();
    billig[2].data.targetPrice = 100;
    await assertFails(commit(elev("elev1"), billig));
    const fejk = plan({ itemId: "finnsinte" });
    await assertFails(commit(elev("elev1"), fejk));
    await fundLage(100);
    const flagga = plan({ fund: { targetPrice: 5000, fundedAmount: 100 }, amount: 10 });
    flagga[2].data.isUnlocked = true;
    await assertFails(commit(elev("elev1"), flagga));
  });

  it("återanvänd donationspost (samma lastDonationId) nekas", async () => {
    const r = await donera("elev1", 100);
    const w = plan({ fund: { targetPrice: 5000, fundedAmount: 100 }, amount: 100, id: r.donationId });
    await assertFails(commit(elev("elev1"), w));
  });

  it("annan klass (icke-medlem) och påhittad klass nekas – klient och regler", async () => {
    await assert.rejects(donera("elev2", 100), (e) => e.code === "permission-denied" && e.krock === false);
    await assertFails(commit(elev("elev2"), plan({ uid: "elev2" })));
    await assertFails(commit(elev("elev1"), plan({ classId: "finnsinte" })));
    await assertFails(commit(unauth(), plan()));
  });

  it("donationspost med annans uid nekas", async () => {
    const w = plan({ uid: "elev1" });
    w[1].data.uid = "elev3";
    await assertFails(commit(elev("elev1"), w));
  });

  it("donations och fund går inte att ändra/radera i efterhand", async () => {
    const r = await donera("elev1", 100);
    const ref = ["classCenters", "6a", "donations", r.donationId];
    await assertFails(setDoc(doc(elev("elev1"), ...ref), { amount: 1 }, { merge: true }));
    await assertFails(setDoc(doc(teacher(), ...ref), { amount: 1 }, { merge: true }));
    await assertFails(setDoc(doc(teacher(), "classCenters", "6a", "fund", "guldstaty"), { fundedAmount: 5000 }, { merge: true }));
  });
});

describe("Crowdfunding: samtidighet", () => {
  it("två samtidiga donationer ger korrekt summa", async () => {
    const [a, b] = await Promise.all([donera("elev1", 120), donera("elev3", 80)]);
    assert.equal(a.ok && b.ok, true);
    const f = await las("classCenters", "6a", "fund", "guldstaty");
    assert.equal(f.fundedAmount, 200);
    assert.equal((await las("studentData", "elev1")).coins, 880);
    assert.equal((await las("studentData", "elev3")).coins, 920);
  });

  it("samtidiga donationer över målet: summan stannar exakt på målet", async () => {
    await fundLage(4800);
    const [a, b] = await Promise.all([donera("elev1", 150), donera("elev3", 150)]);
    const f = await las("classCenters", "6a", "fund", "guldstaty");
    assert.equal(f.fundedAmount, 5000);
    assert.equal(f.isUnlocked, true);
    assert.equal(a.amount + b.amount, 200);
    const c1 = (await las("studentData", "elev1")).coins;
    const c3 = (await las("studentData", "elev3")).coins;
    assert.equal(2000 - c1 - c3, 200); // inget gick förlorat
  });

  // #493 (QA F1): 5–10 samtidiga gav permission-denied efter 4 försök.
  const MANGA = Array.from({ length: 12 }, (_, i) => `m${String(i + 1).padStart(2, "0")}`);
  async function mangaElever() {
    await seed(async (db) => {
      await setDoc(doc(db, "classes", "6a"), { name: "6A", studentIds: ["elev1", "elev3", ...MANGA] });
      for (const uid of MANGA) await setDoc(doc(db, "studentData", uid), { coins: 1000 });
    });
  }
  async function dragnaMynt() {
    let s = 0;
    for (const uid of MANGA) s += 1000 - (await las("studentData", uid)).coins;
    return s;
  }

  it("12 samtidiga donationer går alla igenom och summan stämmer exakt", async () => {
    await mangaElever();
    const res = await Promise.all(MANGA.map((uid) => donera(uid, 100)));
    assert.deepEqual(res.filter((r) => !r.ok), []);
    const f = await las("classCenters", "6a", "fund", "guldstaty");
    assert.equal(f.fundedAmount, 1200);
    assert.equal(await dragnaMynt(), 1200);
  });

  it("12 samtidiga förbi målet: exakt målet, resten 'redan-kopt' utan avdrag, ingen nekas", async () => {
    await mangaElever();
    await fundLage(4000);
    const res = await Promise.all(MANGA.map((uid) => donera(uid, 150)));
    assert.deepEqual(res.filter((r) => !r.ok && r.kod !== "redan-kopt"), []);
    const f = await las("classCenters", "6a", "fund", "guldstaty");
    assert.equal(f.fundedAmount, 5000);
    assert.equal(f.isUnlocked, true);
    const okSumma = res.filter((r) => r.ok).reduce((s, r) => s + r.amount, 0);
    assert.equal(okSumma, 1000);
    assert.equal(await dragnaMynt(), 1000); // ingen förlorade mynt
    assert.equal(res.filter((r) => r.isUnlocked).length, 1);
  });
});
