// ============================================================================
// Regel-tester: Klasscentret crowdfunding – säkerhetsgranskningen (#500).
// Kompletterar firestore-rules-klasscenter-fund.test.js (garanti 2 i
// docs/SAKERHET-klasscentret.md):
//   • HÅL (rättat): flera donationer i SAMMA batch delade på ETT myntavdrag
//     (olika föremål, eller samma id i två klasser) → 100 mynt gav 200+
//     insamlat. Nu måste studentData.kcDonation == "<klass>/<id>" skrivas i
//     samma batch – ett avdrag = en donation,
//   • belopp 0/negativt, fund i annan klass än posten, nollställning efter
//     köp och radering/överskrivning av posten nekas,
//   • gränsfall som ska gå: hela saldot, elev i två klasser (var sin batch),
//   • anonymitet: fund bär ingen uid; posterna läses bara av lärare.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  doc, getDoc, getDocs, setDoc, deleteDoc, collection, writeBatch, serverTimestamp,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { planDonation, planDonationWrites } from "../src/klasscenter/kc-fund-plan.js";
import { kcShopItem } from "../src/klasscenter/kc-shop-items.js";

let testEnv, unauth, elev, teacher;
const fv = { serverTimestamp };

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
// Skrivplanen (absoluta värden) från ett känt läge – [saldo, post, fund].
function plan({ uid = "elev1", classId = "6a", itemId = "guldstaty", fund = null, amount = 100, coins = 1000, id = "don-a" } = {}) {
  const p = planDonation({ fund, item: kcShopItem(itemId), amount, coins });
  assert.equal(p.ok, true, p.error);
  return planDonationWrites({ classId, uid, itemId, plan: p, donationId: id, coinsFore: coins, fv });
}

before(async () => {
  ({ testEnv, unauth, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-kc-fund-sakerhet"));
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
    for (const uid of ["elev1", "elev2", "elev3"]) await setDoc(doc(db, "studentData", uid), { coins: 1000 });
  });
});

describe("Ett avdrag = en donation (hål rättat i #500)", () => {
  it("två donationer (olika föremål) i samma batch med ETT avdrag nekas", async () => {
    const a = plan({ itemId: "klassfana", id: "don-a" });
    const b = plan({ itemId: "lounge", id: "don-b" });
    await assertFails(commit(elev("elev1"), [a[0], a[1], a[2], b[1], b[2]]));
    // inte heller med summan dragen (−200): markören pekar bara på en post
    const summa = { ...a[0], data: { ...a[0].data, coins: 800 } };
    await assertFails(commit(elev("elev1"), [summa, a[1], a[2], b[1], b[2]]));
    assert.equal((await las("studentData", "elev1")).coins, 1000);
  });

  it("samma donations-id i två klasser (elev i båda) med ett avdrag nekas", async () => {
    const a = plan({ classId: "6a", id: "samma" });
    const c = plan({ classId: "6c", id: "samma" });
    await assertFails(commit(elev("elev1"), [a[0], a[1], a[2], c[1], c[2]]));
    await assertFails(commit(elev("elev1"), [c[0], a[1], a[2], c[1], c[2]]));
  });

  it("markören saknas, pekar på annan post eller annan klass → nekas", async () => {
    for (const kcDonation of [undefined, "6a/annan-post", "6c/don-a", "don-a", ""]) {
      const w = plan();
      w[0] = { ...w[0], data: { coins: 900, ...(kcDonation === undefined ? {} : { kcDonation }) } };
      await assertFails(commit(elev("elev1"), w));
    }
  });

  it("gammal markör från en tidigare donation räcker inte (nytt avdrag krävs)", async () => {
    await assertSucceeds(commit(elev("elev1"), plan({ id: "don-1" })));
    // nästa donation utan saldo-skrivning – markören "6a/don-1" ligger kvar
    const w = plan({ fund: { targetPrice: 5000, fundedAmount: 100 }, coins: 900, id: "don-2" });
    await assertFails(commit(elev("elev1"), [w[1], w[2]]));
  });

  it("skrivplanen sätter markören → appens donation går igenom (positiv)", async () => {
    const w = plan();
    assert.equal(w[0].data.kcDonation, "6a/don-a");
    await assertSucceeds(commit(elev("elev1"), w));
    assert.deepEqual(await las("studentData", "elev1"), { coins: 900, kcDonation: "6a/don-a" });
  });
});

describe("Belopp och klass", () => {
  it("belopp 0 och negativt nekas", async () => {
    for (const n of [0, -50]) {
      const w = plan();
      w[0].data.coins = 1000 - n;
      w[1].data.amount = n;
      w[2].data.fundedAmount = n;
      await assertFails(commit(elev("elev1"), w));
    }
  });

  it("decimalbelopp nekas", async () => {
    const w = plan();
    w[0].data.coins = 999.5;
    w[1].data.amount = 0.5;
    w[2].data.fundedAmount = 0.5;
    await assertFails(commit(elev("elev1"), w));
  });

  it("hela saldot går (0 kvar), en mynt mer nekas", async () => {
    await seed((db) => setDoc(doc(db, "studentData", "elev1"), { coins: 100 }));
    const over = plan({ coins: 100, amount: 100, id: "don-over" });
    over[0].data.coins = -1;
    over[1].data.amount = 101;
    over[2].data.fundedAmount = 101;
    await assertFails(commit(elev("elev1"), over));
    await assertSucceeds(commit(elev("elev1"), plan({ coins: 100, amount: 100 })));
    assert.equal((await las("studentData", "elev1")).coins, 0);
  });

  it("fund i en annan klass än donationsposten nekas – även för elev i båda", async () => {
    const a = plan({ classId: "6a", id: "don-x" });
    const c = plan({ classId: "6c", id: "don-x" });
    await assertFails(commit(elev("elev1"), [a[0], a[1], c[2]]));
    await assertFails(commit(elev("elev1"), [a[0], c[1], a[2]]));
  });

  it("elev i två klasser donerar till var och en i egna batchar (positiv)", async () => {
    await assertSucceeds(commit(elev("elev1"), plan({ classId: "6a", id: "don-a" })));
    await assertSucceeds(commit(elev("elev1"), plan({ classId: "6c", id: "don-c", coins: 900 })));
    assert.equal((await las("studentData", "elev1")).coins, 800);
  });
});

describe("Efter köp och i efterhand", () => {
  const KOPT = { targetPrice: 2000, fundedAmount: 2000, isUnlocked: true, lastDonationId: "seed-don" };
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "classCenters", "6a", "fund", "klassfana"), KOPT);
      await setDoc(doc(db, "classCenters", "6a", "donations", "seed-don"), { uid: "elev1", itemId: "klassfana", amount: 2000, at: new Date() });
    });
  });

  it("köpt föremål kan inte nollställas eller fyllas på av elev", async () => {
    const om = plan({ itemId: "klassfana", amount: 100, id: "don-om" }); // planerad mot "inget insamlat"
    await assertFails(commit(elev("elev1"), om));
    await assertFails(setDoc(doc(elev("elev1"), "classCenters", "6a", "fund", "klassfana"),
      { ...KOPT, fundedAmount: 0, isUnlocked: false }));
    await assertFails(deleteDoc(doc(elev("elev1"), "classCenters", "6a", "fund", "klassfana")));
    assert.equal((await las("classCenters", "6a", "fund", "klassfana")).fundedAmount, 2000);
  });

  it("donationsposten kan inte raderas eller skrivas över – av givaren, klassen eller läraren", async () => {
    const ref = ["classCenters", "6a", "donations", "seed-don"];
    for (const db of [elev("elev1"), elev("elev3"), teacher()]) {
      await assertFails(deleteDoc(doc(db, ...ref)));
      await assertFails(setDoc(doc(db, ...ref), { uid: "elev1", itemId: "klassfana", amount: 1, at: serverTimestamp() }));
    }
  });
});

describe("Anonymitet (spec §4: bara totalsumman syns för klassen)", () => {
  it("fund-dokumentet bär ingen givare – bara totalsumma och post-id", async () => {
    await assertSucceeds(commit(elev("elev1"), plan()));
    const f = await las("classCenters", "6a", "fund", "guldstaty");
    assert.deepEqual(Object.keys(f).sort(), ["fundedAmount", "isUnlocked", "lastDonationId", "targetPrice"]);
    await assertSucceeds(getDocs(collection(elev("elev3"), "classCenters", "6a", "fund")));
  });

  it("donationsposter läses varken av givaren, klasskamrat, gäst eller utloggad – lärare ja", async () => {
    await assertSucceeds(commit(elev("elev1"), plan()));
    const ref = ["classCenters", "6a", "donations", "don-a"];
    for (const db of [elev("elev1"), elev("elev3"), elev("elev2"), unauth()]) {
      await assertFails(getDoc(doc(db, ...ref)));
      await assertFails(getDocs(collection(db, "classCenters", "6a", "donations")));
    }
    const s = await assertSucceeds(getDocs(collection(teacher(), "classCenters", "6a", "donations")));
    assert.equal(s.docs[0].data().uid, "elev1");
  });
});
