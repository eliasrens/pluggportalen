// ============================================================================
// Testarens fuskförsök mot dagskvittot myntDag (#853, SAKERHET-MYNT §6 B1),
// utöver test/firestore-rules-mynt-dag.test.js. Varje försök är en klient-
// skrivning med elevens token, i den form ett fusk-skript skulle skicka:
//   • typfusk: decimaltal, strängar, negativa räknare, NaN-liknande värden
//   • nollställa en räknare genom att skriva över (set utan merge) eller ta
//     bort fältet, så att dagstaket börjar om
//   • gåvans fält (gavor, gardUid) från en annan källa
//   • gåvan: false i gavor, uid utan agdaDjur-post, ett tidigare djur bort
//   • flera kvittoskrivningar i samma batch (två källor, samma saldohöjning)
//   • årskurskontot (lärare med klassen) och en oinloggad
//   • XP: över dagstaket, XP utan mynt från fel källa
//   • dagstaket nås exakt (sista myntet tillåtet, nästa nekat)
// Körs av `npm run test:rules`.
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp, deleteField } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { MYNT_DAG_KVITTON, PER_GANG, PER_DAG, XP_PER_DAG, myntDag } from "../src/mynt-dag.js";

let testEnv, elev, unauth;
const IDAG = myntDag(Date.now());

const seed = (path, data) => testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), ...path), data));
async function las(path) {
  let out = null;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const s = await getDoc(doc(ctx.firestore(), ...path));
    out = s.exists() ? s.data() : null;
  });
  return out;
}

/** Rå skrivning: kvittot (merge om inget annat sägs) + studentData i samma batch. */
function skriv(db, uid, kvitto, sd, { merge = true, dag = IDAG } = {}) {
  const b = writeBatch(db);
  const kRef = doc(db, "studentData", uid, MYNT_DAG_KVITTON, dag);
  const data = { dag, lastAt: serverTimestamp(), senastXp: 0, ...kvitto };
  if (merge) b.set(kRef, data, { merge: true });
  else b.set(kRef, data);
  if (sd) b.update(doc(db, "studentData", uid), sd);
  return b.commit();
}

before(async () => {
  ({ testEnv, elev, unauth } = await createRulesEnv("pluggportalen-rules-test-mynt-dag-tester-853"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(["classes", "4b"], { name: "4B", studentIds: ["alma"] });
  await seed(["students", "alma"], { namn: "Alma", classIds: ["4b"] });
  await seed(["studentData", "alma"], {
    coins: 100, xp: 100, progress: {},
    agdaDjur: { h1: "animal_horse", k1: "animal_cow" },
    farm: { animals: [{ uid: "h1", id: "animal_horse" }, { uid: "k1", id: "animal_cow" }] },
  });
  await seed(["teacherAccounts", "ak4"], { active: true, classIds: ["4b"], role: "arskurs" });
});

describe("myntDag-fusk (#853 tester): typer och tal", () => {
  it("decimaltal, sträng och negativt belopp nekas", async () => {
    const db = elev("alma");
    await assertFails(skriv(db, "alma", { kalla: "ekv", senastMynt: 2.5, ekv: 2.5 }, { coins: 102.5 }));
    await assertFails(skriv(db, "alma", { kalla: "ekv", senastMynt: "3", ekv: 3 }, { coins: 103 }));
    await assertFails(skriv(db, "alma", { kalla: "ekv", senastMynt: 3, ekv: "3" }, { coins: 103 }));
    await assertFails(skriv(db, "alma", { kalla: "ekv", senastMynt: -3, ekv: -3 }, { coins: 97 }));
    await assertFails(skriv(db, "alma", { kalla: "ovning", senastMynt: 0, senastXp: 10.5, xp: 10.5 }, { xp: 110.5 }));
    assert.equal((await las(["studentData", "alma"])).coins, 100);
  });
  it("räknaren nekas om den startar över noll vid första skrivningen (kvittot skapas med ett påhittat startvärde)", async () => {
    // m == d[k] − 0 kräver att den nya räknaren ÄR beloppet – en start på 1 000 med senastMynt 3 nekas.
    await assertFails(skriv(elev("alma"), "alma", { kalla: "lasresa", senastMynt: 3, lasresa: 1000 }, { coins: 103 }));
  });
  it("dagstaket nås exakt: sista myntet går, nästa nekas", async () => {
    await seed(["studentData", "alma", MYNT_DAG_KVITTON, IDAG], { dag: IDAG, kalla: "ovning", ovning: PER_DAG.ovning - 1, senastMynt: 1, senastXp: 0, lastAt: Timestamp.now() });
    await assertSucceeds(skriv(elev("alma"), "alma", { kalla: "ovning", senastMynt: 1, ovning: PER_DAG.ovning }, { coins: 101 }));
    await assertFails(skriv(elev("alma"), "alma", { kalla: "ovning", senastMynt: 1, ovning: PER_DAG.ovning + 1 }, { coins: 102 }));
  });
  it("XP över dagstaket nekas, XP precis på taket går", async () => {
    await seed(["studentData", "alma", MYNT_DAG_KVITTON, IDAG], { dag: IDAG, kalla: "ovning", ovning: 10, xp: XP_PER_DAG - 5, senastMynt: 1, senastXp: 1, lastAt: Timestamp.now() });
    await assertFails(skriv(elev("alma"), "alma", { kalla: "ovning", senastMynt: 0, senastXp: 6, xp: XP_PER_DAG + 1 }, { xp: 106 }));
    await assertSucceeds(skriv(elev("alma"), "alma", { kalla: "ovning", senastMynt: 0, senastXp: 5, xp: XP_PER_DAG }, { xp: 105 }));
  });
});

describe("myntDag-fusk (#853 tester): nollställa räknaren", () => {
  const fullt = () => seed(["studentData", "alma", MYNT_DAG_KVITTON, IDAG], {
    dag: IDAG, kalla: "lasresa", lastAt: Timestamp.now(), senastMynt: 3, senastXp: 0,
    lasresa: PER_DAG.lasresa, ovning: PER_DAG.ovning, ekv: PER_DAG.ekv, amnes: PER_DAG.amnes, xp: XP_PER_DAG,
  });
  it("set utan merge (räknarna försvinner) nekas", async () => {
    await fullt();
    await assertFails(skriv(elev("alma"), "alma", { kalla: "ekv", senastMynt: 7, ekv: 7 }, { coins: 107 }, { merge: false }));
    await assertFails(skriv(elev("alma"), "alma", { kalla: "lasresa", senastMynt: 30, lasresa: 30 }, { coins: 130 }, { merge: false }));
  });
  it("ta bort en annan källas räknare (deleteField) nekas", async () => {
    await fullt();
    await assertFails(skriv(elev("alma"), "alma", { kalla: "ekv", senastMynt: 0, ekv: PER_DAG.ekv, ovning: deleteField(), senastXp: 0 }, { coins: 100 }));
  });
  it("skriva källans räknare från noll igen (merge över ett fullt kvitto) nekas", async () => {
    await fullt();
    await assertFails(skriv(elev("alma"), "alma", { kalla: "ekv", senastMynt: 7, ekv: 7 }, { coins: 107 }));
  });
  it("radera kvittot som elev nekas", async () => {
    await fullt();
    await assertFails(deleteDoc(doc(elev("alma"), "studentData", "alma", MYNT_DAG_KVITTON, IDAG)));
  });
});

describe("myntDag-fusk (#853 tester): gåvans fält och djur", () => {
  it("gavor/gardUid från en annan källa nekas", async () => {
    await assertFails(skriv(elev("alma"), "alma", { kalla: "ekv", senastMynt: 3, ekv: 3, gavor: { h1: true } }, { coins: 103 }));
    await assertFails(skriv(elev("alma"), "alma", { kalla: "ekv", senastMynt: 3, ekv: 3, gardUid: "h1" }, { coins: 103 }));
  });
  it("gavor-värde false, eller gåvan utan gavor, nekas", async () => {
    await assertFails(skriv(elev("alma"), "alma", { kalla: "gard", senastMynt: 8, gard: 8, gardUid: "h1", gavor: { h1: false } }, { coins: 108 }));
    await assertFails(skriv(elev("alma"), "alma", { kalla: "gard", senastMynt: 8, gard: 8, gardUid: "h1" }, { coins: 108 }));
  });
  it("ett djur utan agdaDjur-post (aldrig migrerat) nekas, saldot orört", async () => {
    await assertFails(skriv(elev("alma"), "alma", { kalla: "gard", senastMynt: 8, gard: 8, gardUid: "ny9", gavor: { ny9: true } }, { coins: 108 }));
    assert.equal((await las(["studentData", "alma"])).coins, 100);
  });
  it("ta bort gårdagens/tidigare gåva ur gavor för att hämta igen nekas", async () => {
    await assertSucceeds(skriv(elev("alma"), "alma", { kalla: "gard", senastMynt: 8, gard: 8, gardUid: "h1", gavor: { h1: true } }, { coins: 108 }));
    await assertFails(skriv(elev("alma"), "alma", { kalla: "gard", senastMynt: 8, gard: 16, gardUid: "h1", gavor: { h1: deleteField() } }, { coins: 116 }));
    await assertFails(skriv(elev("alma"), "alma", { kalla: "gard", senastMynt: 8, gard: 16, gardUid: "h1", gavor: { h1: true } }, { coins: 116 }, { merge: false }));
    await assertSucceeds(skriv(elev("alma"), "alma", { kalla: "gard", senastMynt: 8, gard: 16, gardUid: "k1", gavor: { k1: true } }, { coins: 116 }));
    assert.equal((await las(["studentData", "alma"])).coins, 116);
  });
});

describe("myntDag-fusk (#853 tester): flera skrivningar och andra konton", () => {
  it("två källor i två kvittoskrivningar i samma batch ger aldrig mer än en saldohöjning", async () => {
    const db = elev("alma");
    const b = writeBatch(db);
    const kRef = doc(db, "studentData", "alma", MYNT_DAG_KVITTON, IDAG);
    b.set(kRef, { dag: IDAG, lastAt: serverTimestamp(), kalla: "lasresa", senastMynt: PER_GANG.lasresa, senastXp: 0, lasresa: PER_GANG.lasresa }, { merge: true });
    b.set(kRef, { dag: IDAG, lastAt: serverTimestamp(), kalla: "amnes", senastMynt: PER_GANG.amnes, senastXp: 0, amnes: PER_GANG.amnes }, { merge: true });
    b.update(doc(db, "studentData", "alma"), { coins: 100 + PER_GANG.lasresa + PER_GANG.amnes });
    await assertFails(b.commit());
    assert.equal((await las(["studentData", "alma"])).coins, 100);
  });
  it("årskurskontot med klassen och en oinloggad får inte skriva kvittot", async () => {
    const ak = testEnv.authenticatedContext("ak4", { teacher: true, role: "arskurs" }).firestore();
    await assertFails(skriv(ak, "alma", { kalla: "ekv", senastMynt: 3, ekv: 3 }, { coins: 103 }));
    await assertFails(skriv(unauth(), "alma", { kalla: "ekv", senastMynt: 3, ekv: 3 }, null));
    await assertSucceeds(getDoc(doc(ak, "studentData", "alma")));
  });
});
