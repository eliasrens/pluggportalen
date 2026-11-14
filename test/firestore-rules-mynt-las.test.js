// ============================================================================
// Regel-tester: myntlåset på saldot (#855, docs/SAKERHET-MYNT.md §6 B3).
// Elevens egen studentData-skrivning får ändra coins/xp BARA via kvitto
// (myntDag från #853, mmMynt från #846) eller som avdrag ihop med kcDonation,
// och får inte skapa ett dokument med värden eller radera sitt eget.
//   • nekat: coins 99999, increment utan kvitto, setDoc med högre saldo, kvitto
//     som inte stämmer, gammalt kvitto, annan elevs kvitto, MM +2, coins som
//     sträng/decimal/negativt, sänkning utan kcDonation, xp utan kvitto,
//     borttagen xp, xp i dokument utan xp (även med kvitto), Live-/Prov-
//     markörerna, create med coins: 5 eller utan xp med uppblåst progress (F1),
//     delete av eget dokument, annan elevs saldo
//   • tillåtet: myntDag-utbetalning (mynt + xp), mynt utan xp för dokument utan
//     xp, MM-svar, admin Ge mynt, ny elev med standarddokument, övriga fält.
// Donation, Live och Prov täcks av de befintliga -fund*-, -live-rewards-,
// -roller-*- och -prov-mynt*-sviterna. Gränstestet (1000 uttryck / 20
// dokumentåtkomster) ligger i firestore-rules-mynt-las-grans.test.js.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  doc, getDoc, setDoc, deleteDoc, updateDoc, writeBatch, increment, deleteField, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { MYNT_DAG_KVITTON, myntDag, planTjana } from "../src/mynt-dag.js";
import { planMathAnswerWrites } from "../src/tavling/answer-writes.js";
import { defaultStudentData } from "../src/klass-membership.js";

let testEnv, elev, teacher;
const H = 3600 * 1000;
const IDAG = myntDag(Date.now());
const IGAR = myntDag(Date.now() - 24 * H);
const fv = { increment, serverTimestamp };
let seq = 0;
const aid = () => `las${Date.now().toString(36)}x${(seq++).toString(36)}`;

async function las(path) {
  let out;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const s = await getDoc(doc(ctx.firestore(), ...path));
    out = s.exists() ? s.data() : null;
  });
  return out;
}
const seed = (path, data) => testEnv.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), ...path), data));
const sd = (uid, db = elev(uid)) => doc(db, "studentData", uid);

/** Det tjanaMynt skriver (planTjana); `kv`/`patch` skriver över för fuskförsöken. */
async function tjana(uid, kalla, mynt, { xp = 0, dag = IDAG, kv = {}, patch = {}, db = elev(uid), kvittoUid = uid } = {}) {
  const fore = await las(["studentData", uid]);
  const kvFore = await las(["studentData", kvittoUid, MYNT_DAG_KVITTON, dag]);
  const p = planTjana({ kalla, mynt, xp, sd: fore, kvitto: kvFore });
  const b = writeBatch(db);
  b.set(doc(db, "studentData", kvittoUid, MYNT_DAG_KVITTON, dag),
    { ...(p.kvitto || { kalla, senastMynt: 0, senastXp: 0 }), dag, lastAt: serverTimestamp(), ...kv }, { merge: true });
  b.update(sd(uid, db), { ...(p.sd || {}), ...patch });
  return b.commit();
}
/** Ett rätt MM-svar med mynt; `saldo` ersätter saldoskrivningen (fusk). */
function mm(uid, saldo = null) {
  const writes = planMathAnswerWrites({
    competitionId: "mm1", attemptId: aid(), uid, classId: "4b", name: uid,
    record: { factorA: 7, factorB: 8, answer: 56, correctAnswer: 56 }, isCorrect: true, shard: 0, fv, mynt: { dag: IDAG },
  });
  const db = elev(uid);
  const b = writeBatch(db);
  for (const w of writes) {
    const data = saldo && w.path[0] === "studentData" && w.path.length === 2 ? saldo : w.data;
    b.set(doc(db, ...w.path), data, w.merge ? { merge: true } : undefined);
  }
  return b.commit();
}
const coins = async (uid) => (await las(["studentData", uid])).coins;

before(async () => {
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-mynt-las"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(["classes", "4b"], { name: "4B", studentIds: ["alma", "omar", "nils"] });
  for (const u of ["alma", "omar", "nils"]) await seed(["students", u], { namn: u });
  await seed(["studentData", "alma"], { ...defaultStudentData(), coins: 250, xp: 100 });
  await seed(["studentData", "omar"], { coins: 10, xp: 0, progress: {} });
  await seed(["studentData", "nils"], { coins: 40, progress: {} }); // gammalt dokument utan xp
  await seed(["mathCompetitions", "mm1"], {
    name: "Mattematchen", participatingClassIds: ["4b"],
    startAt: Timestamp.fromMillis(Date.now() - H), endAt: Timestamp.fromMillis(Date.now() + H),
    status: "active", counterShards: 5, createdBy: "larare1", createdAt: Timestamp.fromMillis(Date.now() - 2 * H),
  });
});

describe("myntlåset (#855): saldot utan kvitto nekas", () => {
  it("update { coins: 99999 }, increment(1) och setDoc av hela dokumentet med högre saldo", async () => {
    await assertFails(updateDoc(sd("alma"), { coins: 99999 }));
    await assertFails(updateDoc(sd("alma"), { coins: increment(1) }));
    await assertFails(setDoc(sd("alma"), { coins: 99999 }, { merge: true }));
    const hela = await las(["studentData", "alma"]);
    await assertFails(setDoc(sd("alma"), { ...hela, coins: 251 }));
    assert.equal(await coins("alma"), 250);
  });
  it("kvitto + saldo som inte stämmer (+6 mot senastMynt 5, och +5 mot kvitto utan höjning)", async () => {
    await assertFails(tjana("alma", "lasresa", 5, { patch: { coins: 256 } }));
    await assertFails(tjana("alma", "lasresa", 5, { kv: { senastMynt: 0, lasresa: 0 } }));
  });
  it("ett gammalt kvitto (idag, men skrivet i en tidigare begäran) eller gårdagens kvitto", async () => {
    await assertSucceeds(tjana("alma", "lasresa", 5));
    await assertFails(updateDoc(sd("alma"), { coins: increment(5) }), "dagens kvitto återanvänds");
    await assertFails(tjana("alma", "lasresa", 5, { dag: IGAR }), "gårdagens kvitto");
    assert.equal(await coins("alma"), 255);
  });
  it("en annan elevs kvitto betalar inte mitt saldo", async () => {
    await assertFails(tjana("alma", "lasresa", 5, { kvittoUid: "omar" }));
  });
  it("MM-kvittot ger bara +1: +2 i samma batch nekas", async () => {
    await assertFails(mm("alma", { coins: increment(2) }));
    await assertFails(mm("alma", { coins: 999 }));
    assert.equal(await coins("alma"), 250);
  });
  it("coins som sträng, decimaltal eller negativt – även med kvitto", async () => {
    await assertFails(updateDoc(sd("alma"), { coins: "300" }));
    await assertFails(updateDoc(sd("alma"), { coins: 250.5 }));
    await assertFails(updateDoc(sd("alma"), { coins: -1 }));
    await assertFails(tjana("alma", "lasresa", 5, { patch: { coins: "255" } }));
    await assertFails(updateDoc(sd("alma"), { coins: deleteField() }), "saldot tas bort");
  });
  it("sänkning utan kcDonation nekas (bara donation och köp på servern sänker)", async () => {
    await assertFails(updateDoc(sd("alma"), { coins: 200 }));
    await assertFails(updateDoc(sd("alma"), { coins: increment(-50) }));
  });
  it("Live- och Prov-markörerna skrivs aldrig av eleven", async () => {
    await assertFails(updateDoc(sd("alma"), { lastLiveReceipt: "s1" }));
    await assertFails(updateDoc(sd("alma"), { lastProvMynt: "t1" }));
    await assertFails(tjana("alma", "lasresa", 5, { patch: { lastLiveReceipt: "s1" } }));
  });
  it("en annan elevs saldo (M3) – uppåt, nedåt och med kvitto", async () => {
    await assertFails(updateDoc(sd("omar", elev("alma")), { coins: 0 }));
    await assertFails(updateDoc(sd("omar", elev("alma")), { coins: increment(5) }));
    await assertFails(tjana("omar", "lasresa", 5, { db: elev("alma") }));
  });
});

describe("myntlåset (#855): xp utan kvitto nekas", () => {
  it("xp utan kvitto, xp med fel belopp och borttagen xp", async () => {
    await assertFails(updateDoc(sd("alma"), { xp: 5000 }));
    await assertFails(updateDoc(sd("alma"), { xp: increment(1) }));
    await assertFails(tjana("alma", "ovning", 10, { xp: 20, patch: { xp: 125 } }));
    await assertFails(updateDoc(sd("alma"), { xp: deleteField() }));
    await assertFails(updateDoc(sd("alma"), { xp: 50 }), "sänkt xp");
  });
  it("xp som sätts i ett dokument utan xp – även med ett kvitto som stämmer", async () => {
    await assertFails(updateDoc(sd("nils"), { xp: 10 }));
    await assertFails(tjana("nils", "ovning", 10, {
      kv: { senastXp: 10, xp: 10 }, patch: { xp: 10 },
    }));
    assert.equal((await las(["studentData", "nils"])).xp, undefined);
  });
});

describe("myntlåset (#855): create och delete", () => {
  it("create med coins: 5 (eller xp, äpplen, varor, djur, gårdsnivå) nekas", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), "studentData", "alma")));
    const bas = defaultStudentData();
    await assertFails(setDoc(sd("alma"), { ...bas, coins: 5 }));
    await assertFails(setDoc(sd("alma"), { coins: 5 }));
    await assertFails(setDoc(sd("alma"), { ...bas, xp: 3000 }));
    await assertFails(setDoc(sd("alma"), { ...bas, appleCount: 9 }));
    await assertFails(setDoc(sd("alma"), { ...bas, ownedItems: ["hus-slott"] }));
    await assertFails(setDoc(sd("alma"), { ...bas, ownedCounts: { soffa: 3 } }));
    await assertFails(setDoc(sd("alma"), { ...bas, pets: [{ id: "p1" }] }));
    await assertFails(setDoc(sd("alma"), { ...bas, roomAnimals: [{ uid: "a", id: "dinosaurie" }] }));
    await assertFails(setDoc(sd("alma"), { ...bas, farm: { ...bas.farm, animals: [{ uid: "h", id: "animal_horse" }] } }));
    await assertFails(setDoc(sd("alma"), { ...bas, farm: { ...bas.farm, barnLevel: 3 } }));
    await assertFails(setDoc(sd("alma"), { ...bas, farm: { ...bas.farm, gardenTier: 2 } }));
    await assertFails(setDoc(sd("alma"), { ...bas, coins: "5" }));
  });
  it("create utan xp med uppblåst progress nekas (#855 F1: xpFromProgress ger nivå 31)", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), "studentData", "alma")));
    const progress = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`omr${i}`, { quiz: { stars: 3, completed: true } }]));
    await assertFails(setDoc(sd("alma"), { avatarId: "fox", progress }, { merge: true }));
    await assertFails(setDoc(sd("alma"), { progress: { so: { quiz: { stars: 1 } } } }));
    await assertFails(setDoc(sd("alma"), { avatarId: "fox", progress: "x" }));
    await assertSucceeds(setDoc(sd("alma"), { ...defaultStudentData(), progress: { so: { quiz: { stars: 1 } } } }),
      "med xp: 0 får progress följa med – xp räknas sedan ur xp, inte progress");
  });
  it("delete av sitt eget dokument nekas (admin får)", async () => {
    await assertFails(deleteDoc(sd("alma")));
    await assertFails(deleteDoc(sd("omar", elev("alma"))));
    await assertSucceeds(deleteDoc(sd("alma", teacher())));
  });
});

describe("myntlåset (#855): det legitima fungerar", () => {
  it("myntDag-utbetalning: mynt + xp (övning) och mynt utan xp (Läsresan)", async () => {
    await assertSucceeds(tjana("alma", "ovning", 30, { xp: 40 }));
    await assertSucceeds(tjana("alma", "lasresa", 12));
    const a = await las(["studentData", "alma"]);
    assert.deepEqual([a.coins, a.xp], [292, 140]);
  });
  it("dokument utan xp får mynt (ingen xp) via myntDag", async () => {
    await assertSucceeds(tjana("nils", "ovning", 30, { xp: 40 }));
    const n = await las(["studentData", "nils"]);
    assert.deepEqual([n.coins, n.xp], [70, undefined]);
  });
  it("MM-svar: kvitto +1 och saldo +1", async () => {
    await assertSucceeds(mm("alma"));
    await assertSucceeds(mm("alma"));
    assert.equal(await coins("alma"), 252);
  });
  it("admin Ge mynt (och sätter saldot fritt)", async () => {
    await assertSucceeds(updateDoc(sd("alma", teacher()), { coins: increment(25) }));
    await assertSucceeds(updateDoc(sd("alma", teacher()), { coins: 10, xp: 0 }));
    assert.equal(await coins("alma"), 10);
  });
  it("ny elev med standarddokument (ensureStudentData) och de andra skapandevägarna", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), "studentData", "alma")));
    await assertSucceeds(setDoc(sd("alma"), defaultStudentData("owl")));
    await testEnv.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), "studentData", "alma")));
    await assertSucceeds(setDoc(sd("alma"), { ...defaultStudentData(), lasresa: { level: 3 } }), "Läsresan-reserven");
    await testEnv.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), "studentData", "alma")));
    await assertSucceeds(setDoc(sd("alma"), { avatarId: "fox", avatarChosen: true }, { merge: true }), "setAvatar på saknat dokument");
  });
  it("alla andra fält skrivs som förut (framsteg, rum, gård, schack, Läsresan, huslås)", async () => {
    await assertSucceeds(updateDoc(sd("alma"), { "progress.so.quiz": { stars: 3, plays: 2, cat: { a: 1 } } }));
    await assertSucceeds(updateDoc(sd("alma"), { "room.placements.soffa#1": { x: 3, y: 4 }, husLast: true }));
    await assertSucceeds(updateDoc(sd("alma"), { "farm.gardenSlots": [{ crop: "morot" }], questionRotation: { so: {} } }));
    await assertSucceeds(updateDoc(sd("alma"), { "schack.datorPartier": 1, "schack.lektioner.1": 2 }));
    await assertSucceeds(updateDoc(sd("alma"), { lasresa: { level: 4, currentTextId: "t1" } }));
    await assertSucceeds(updateDoc(sd("alma"), { coins: 250, xp: 100 }), "oförändrat saldo i en patch");
    const hela = await las(["studentData", "alma"]);
    await assertSucceeds(setDoc(sd("alma"), { ...hela, husLast: false }), "hela dokumentet med samma saldo");
    await assertSucceeds(updateDoc(sd("nils"), { coins: 40, progress: { ma: {} } }), "gammalt dokument utan xp");
  });
});
