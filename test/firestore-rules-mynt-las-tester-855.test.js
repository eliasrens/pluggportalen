// ============================================================================
// Testarens kanter för myntlåset (#855, docs/SAKERHET-MYNT.md §6 B3) utöver
// firestore-rules-mynt-las.test.js:
//   • devtools-formerna mot ett SAKNAT dokument (create med merge, create med
//     xp) och tom överskrivning av ett befintligt (set {} / set utan saldo)
//   • ett kvitto, två studentData-skrivningar i samma batch
//   • en falsk kcDonation-markör sänker bara – ingen väg tillbaka upp
//   • create med mynt som ett dagskvitto betalar i samma begäran (= höjning från 0)
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc, updateDoc, writeBatch, increment, serverTimestamp } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { MYNT_DAG_KVITTON, myntDag, planTjana } from "../src/mynt-dag.js";
import { defaultStudentData } from "../src/klass-membership.js";

let testEnv, elev;
const IDAG = myntDag(Date.now());

async function las(path) {
  let out;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const s = await getDoc(doc(ctx.firestore(), ...path));
    out = s.exists() ? s.data() : null;
  });
  return out;
}
const seed = (path, data) => testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), ...path), data));
const sd = (uid) => doc(elev(uid), "studentData", uid);

before(async () => { ({ testEnv, elev } = await createRulesEnv("pluggportalen-rules-test-mynt-las-tester-855")); });
after(async () => { if (testEnv) await testEnv.cleanup(); });
beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(["classes", "4b"], { name: "4B", studentIds: ["alma", "ny"] });
  await seed(["studentData", "alma"], { ...defaultStudentData(), coins: 300, xp: 10 });
});

describe("myntlåset (#855, testaren): devtools mot saknat och befintligt dokument", () => {
  it("saknat dokument: setDoc merge med saldo, create med xp eller sträng-saldo nekas", async () => {
    await assertFails(setDoc(sd("ny"), { coins: 99999 }, { merge: true }));
    await assertFails(setDoc(sd("ny"), { ...defaultStudentData(), xp: 3000 }));
    await assertFails(setDoc(sd("ny"), { ...defaultStudentData(), coins: -5 }));
    assert.equal(await las(["studentData", "ny"]), null);
  });
  it("befintligt dokument: tom överskrivning, överskrivning utan saldo och delete nekas", async () => {
    await assertFails(setDoc(sd("alma"), {}));
    await assertFails(setDoc(sd("alma"), { avatarId: "fox" }));
    await assertFails(deleteDoc(sd("alma")));
    assert.equal((await las(["studentData", "alma"])).coins, 300);
  });
});

describe("myntlåset (#855, testaren): kvitton och markörer", () => {
  it("ett dagskvitto, två saldoskrivningar i samma batch nekas", async () => {
    const db = elev("alma");
    const b = writeBatch(db);
    b.set(doc(db, "studentData", "alma", MYNT_DAG_KVITTON, IDAG),
      { dag: IDAG, kalla: "ekv", lastAt: serverTimestamp(), senastMynt: 5, senastXp: 0, ekv: 5 }, { merge: true });
    b.update(doc(db, "studentData", "alma"), { coins: increment(5) });
    b.update(doc(db, "studentData", "alma"), { coins: increment(5) });
    await assertFails(b.commit());
    assert.equal((await las(["studentData", "alma"])).coins, 300);
  });
  it("falsk kcDonation-markör: sänkningen går (ofarlig), men ingen höjning tillbaka", async () => {
    await assertSucceeds(updateDoc(sd("alma"), { coins: 0, kcDonation: "x/y" }));
    await assertFails(updateDoc(sd("alma"), { coins: 300, kcDonation: "x/z" }));
    await assertFails(updateDoc(sd("alma"), { coins: 300 }));
    assert.equal((await las(["studentData", "alma"])).coins, 0);
  });
  it("create med mynt som dagskvittot betalar i samma begäran (som höjning från 0)", async () => {
    const p = planTjana({ kalla: "ovning", mynt: 30, xp: 0, sd: {}, kvitto: null });
    const db = elev("ny");
    const b = writeBatch(db);
    b.set(doc(db, "studentData", "ny", MYNT_DAG_KVITTON, IDAG), { ...p.kvitto, dag: IDAG, lastAt: serverTimestamp() }, { merge: true });
    b.set(doc(db, "studentData", "ny"), { ...defaultStudentData(), coins: 30 });
    await assertSucceeds(b.commit());
    const b2 = writeBatch(db);
    await testEnv.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), "studentData", "ny")));
    b2.set(doc(db, "studentData", "ny"), { ...defaultStudentData(), coins: 30 });
    await assertFails(b2.commit(), "samma create utan nytt kvitto");
  });
});
