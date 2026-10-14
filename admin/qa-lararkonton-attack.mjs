// ============================================================================
// QA #682: säkerhetsgranskning av lärarkontona – Årskurs 4 som angripare.
// ----------------------------------------------------------------------------
// Årskurs 4 (4a, 4b) med en EGEN klient: skriver direkt i samlingar utanför
// §2.1, ändrar otillåtna fält med update och set+merge, läser andra klassers
// elever via queries, skapar Live utan egen klass, använder en avstängd
// token och en gammal token efter att klasser tagits bort. Riggen och
// testanvändarna: test/helpers/roller-env.js.
//
// Testnamn som börjar med "HÅL" bevisar ett fynd i docs/QA-RAPPORT-lararkonton.md
// (de GODTAS i dag – rättas reglerna ska testet vändas till assertFails).
// "OKLART" = godtas med flit enligt docs/BEHORIGHETER.md, men värt ett beslut.
//
// Ligger utanför test/ (och utan .test.) så att `node --test` och test:rules inte tar med den.
// Körs:
//   firebase emulators:exec --only firestore "node --test admin/qa-lararkonton-attack.mjs"
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  collection, collectionGroup, deleteDoc, deleteField, doc, getDoc, getDocs, limit, query, serverTimestamp,
  setDoc, updateDoc, where, writeBatch, Timestamp,
} from "firebase/firestore";
import { createRollerEnv, seedRoller } from "../test/helpers/roller-env.js";
import { buildSessionDoc } from "../src/live/live-core.js";

let env;
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);

const klassmatch = (classIds, uid, over = {}) => ({
  ...buildSessionDoc({
    name: classIds.join(" mot "), gameMode: "multiplication_0_10", classIds, durationMin: 10,
    divisors: Object.fromEntries(classIds.map((c) => [c, 20])),
  }, { uid }),
  createdAt: serverTimestamp(),
  ...over,
});
const kist = (format, classIds, uid, rewards = { firstPrize: 1000, perCorrect: 50, cap: 1000 }) => ({
  ...buildSessionDoc({
    name: format, format, gameMode: "multiplication_0_10", answerKind: "free", classIds, durationMin: 5,
    stealSwap: true, hacking: true, showNames: true,
    rewards: { firstPrize: String(rewards.firstPrize), perCorrect: String(rewards.perCorrect), cap: String(rewards.cap) },
  }, { uid }),
  createdAt: serverTimestamp(),
});
const coins = async (uid) => {
  let c;
  await env.seed(async (db) => { c = (await getDoc(doc(db, "studentData", uid))).data().coins; });
  return c;
};
// Betala ett "kvitto" som läraren själv hittat på: kvittot + elevens saldo i samma batch.
function betala(db, sid, uid, prize, correctCoins, fore) {
  const b = writeBatch(db);
  b.set(doc(db, "liveSessions", sid, "coinReceipts", uid),
    { uid, prize, correctCoins, total: prize + correctCoins, at: serverTimestamp(), by: "ak4" });
  b.update(doc(db, "studentData", uid), { coins: fore + prize + correctCoins, lastLiveReceipt: sid });
  return b.commit();
}

before(async () => { env = await createRollerEnv("pluggportalen-qa682-attack"); });
after(async () => { if (env) await env.testEnv.cleanup(); });
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    await setDoc(doc(db, "liveSessions", "m4a5a"), { ...klassmatch(["4a", "5a"], "admin1"), createdAt: ts(-H) });
    await setDoc(doc(db, "liveSessions", "m4a5a", "answers", "svar5a-0001"),
      { uid: "e5a", classId: "5a", mode: "multiplication_0_10", factorA: 3, factorB: 4, answer: 12 });
    await setDoc(doc(db, "mathCompetitions", "mm1"), {
      name: "MM", participatingClassIds: ["4a", "5a"], startAt: ts(-H), endAt: ts(H), status: "active", counterShards: 4,
    });
    for (const [uid, classId] of [["e4a", "4a"], ["e5a", "5a"]]) {
      await setDoc(doc(db, "mathCompetitions", "mm1", "studentStats", uid), { uid, classId, correct: 5 });
      await setDoc(doc(db, "mathCompetitions", "mm1", "answers", `a-${uid}-0001`),
        { uid, classId, mode: "multiplication_0_10", factorA: 2, factorB: 2, answer: 4 });
      await setDoc(doc(db, "hittaRattAttempts", `hr-${uid}-0001`), { uid, packId: "sverige", status: "done" });
      await setDoc(doc(db, "hittaRattBest", uid), { uid, best: 10 });
      await setDoc(doc(db, "studentData", uid, "lasresaAttempts", "x1"), { uid, correct: 3 });
      await setDoc(doc(db, "studentData", uid, "ekvationsresa", "progress"), { level: 3, window: [] });
      await setDoc(doc(db, "classCenters", classId), { kassorer: [] });
      await setDoc(doc(db, "classCenters", classId, "kassa", "saldo"), { saldo: 500 });
      await setDoc(doc(db, "classCenters", classId, "donations", "d1"), { uid, itemId: "lounge", amount: 5 });
      await setDoc(doc(db, "classCenters", classId, "expMembers", uid), { uid, exp: 10 });
    }
  });
});

describe("A. Skriva direkt i samlingar som inte nämns i §2.1", () => {
  it("lärarkonton: eget dokument (klasser, roll, aktiv), andras, nytt konto", async () => {
    const db = env.ak4();
    await assertFails(updateDoc(doc(db, "teacherAccounts", "ak4"), { classIds: ["4a", "4b", "5a"] }));
    await assertFails(setDoc(doc(db, "teacherAccounts", "ak4"), { role: "admin" }, { merge: true }));
    await assertFails(setDoc(doc(db, "teacherAccounts", "ak4av"), { active: true }, { merge: true }));
    await assertFails(setDoc(doc(db, "teacherAccounts", "nytt"), { role: "admin", active: true, classIds: [] }));
    await assertFails(deleteDoc(doc(db, "teacherAccounts", "ak5")));
  });
  it("elevkonton, klasser, ämnen, klassprojektioner, klassprojekt", async () => {
    const db = env.ak4();
    await assertFails(setDoc(doc(db, "students", "ny"), { namn: "Ny", username: "ny", classIds: ["4a"] }));
    await assertFails(updateDoc(doc(db, "students", "e4a"), { classIds: ["5a"] }));
    await assertFails(setDoc(doc(db, "students", "e4a"), { namn: "Hackad" }, { merge: true }));
    await assertFails(deleteDoc(doc(db, "students", "e4a")));
    await assertFails(setDoc(doc(db, "studentCredentials", "e4a"), { username: "e4a", password: "nytt123" }));
    await assertFails(deleteDoc(doc(db, "studentCredentials", "e4a")));
    await assertFails(setDoc(doc(db, "classes", "4c"), { name: "4C", studentIds: [] }));
    await assertFails(deleteDoc(doc(db, "classes", "4a")));
    await assertFails(setDoc(doc(db, "subjects", "ny"), { name: "Nytt ämne" }));
    await assertFails(updateDoc(doc(db, "subjects", "so"), { name: "Hackat" }));
    await assertFails(setDoc(doc(db, "classProjections", "4a"), { members: {} }));
    await assertFails(setDoc(doc(db, "classProjects", "4a"), { projects: {} }));
  });
  it("Mattematchen, klasscentret, Hitta rätt!, okänd samling, annans Live-klocka", async () => {
    const db = env.ak4();
    await assertFails(updateDoc(doc(db, "mathCompetitions", "mm1"), { status: "finished" }));
    await assertFails(deleteDoc(doc(db, "mathCompetitions", "mm1", "studentStats", "e4a")));
    await assertFails(setDoc(doc(db, "classCenters", "4a"), { kassorer: ["e4a"] }, { merge: true }));
    await assertFails(setDoc(doc(db, "classCenters", "4a", "kassa", "saldo"), { saldo: 99999, lastTxId: "x" }));
    await assertFails(setDoc(doc(db, "classCenters", "4a", "kassaHistorik", "x"),
      { typ: "in", kalla: "live", sessionId: "m4a5a", titel: "x", belopp: 1, at: serverTimestamp(), av: "ak4" }));
    await assertFails(setDoc(doc(db, "classCenters", "4a", "fund", "lounge"), { targetPrice: 3000, fundedAmount: 3000, isUnlocked: true }));
    await assertFails(setDoc(doc(db, "classCenters", "4a", "layout", "current"), { placedItems: {}, version: 1 }));
    await assertFails(setDoc(doc(db, "hittaRattPacks", "eget"), { titel: "Eget" }));
    await assertFails(setDoc(doc(db, "hittaRattBoards", "sverige"), { top: [] }));
    await assertFails(setDoc(doc(db, "hittaRattBest", "e4a"), { best: 999 }));
    await assertFails(setDoc(doc(db, "nagotNytt", "x"), { a: 1 }));
    await assertFails(setDoc(doc(db, "liveClock", "e4a"), { t: serverTimestamp() }));
  });
  it("elevdata: skapa, radera, under-dokument", async () => {
    const db = env.ak4();
    await assertFails(setDoc(doc(db, "studentData", "ny4a"), { coins: 0 }));
    await assertFails(deleteDoc(doc(db, "studentData", "e4a")));
    await assertFails(setDoc(doc(db, "studentData", "e4a", "lasresaAttempts", "fusk"), { uid: "e4a", correct: 10 }));
    await assertFails(deleteDoc(doc(db, "studentData", "e4a", "lasresaAttempts", "x1")));
    await assertFails(deleteDoc(doc(db, "studentData", "e4a", "ekvationsresa", "progress")));
  });
});

describe("B. Otillåtna fält via update och set+merge", () => {
  it("klassen: namn, elevlista, byarna – update och merge, även ihop med ett tillåtet fält", async () => {
    const db = env.ak4();
    const ref = doc(db, "classes", "4a");
    await assertFails(updateDoc(ref, { name: "Hackad" }));
    await assertFails(setDoc(ref, { name: "Hackad" }, { merge: true }));
    await assertFails(setDoc(ref, { studentIds: ["e4a", "e5a"] }, { merge: true }));
    await assertFails(setDoc(ref, { hiddenVillages: ["5a"] }, { merge: true }));
    await assertFails(setDoc(ref, { assignedAreas: ["so/x"], name: "Hackad" }, { merge: true }));
    await assertFails(setDoc(ref, { assignedAreas: ["so/x"] })); // set utan merge raderar name/studentIds
    await assertSucceeds(setDoc(ref, { assignedAreas: ["so/x"] }, { merge: true }));
  });
  it("klassen: ett evigt fokusläge nekas (servertid, högst 24 h)", async () => {
    const lock = { mal: { typ: "lasresan" }, till: Date.now() + 48 * H, doljOvrigt: true };
    await assertFails(setDoc(doc(env.ak4(), "classes", "4a"), { lock }, { merge: true }));
  });
  it("elevdata: mynt, xp, Läsresans resultat och pengar – update, merge och fältväg", async () => {
    const db = env.ak4();
    const ref = doc(db, "studentData", "e4a");
    await assertFails(updateDoc(ref, { coins: 100000 }));
    await assertFails(setDoc(ref, { coins: 100000 }, { merge: true }));
    await assertFails(updateDoc(ref, { xp: 5000 }));
    await assertFails(updateDoc(ref, { "lasresa.moneyEarned": 9999 }));
    await assertFails(updateDoc(ref, { "lasresa.level10": 9, coins: 100000 }));
    // mergeFields ersätter hela lasresa-mappen = nollställer elevens resultat.
    await assertFails(setDoc(ref, { lasresa: { level10: 9 } }, { mergeFields: ["lasresa"] }));
    await assertFails(updateDoc(ref, { husLast: true }));
    await assertSucceeds(updateDoc(ref, { "lasresa.level10": 9, "lasresa.level": 6 }));
  });
  it("OKLART: nivåfälten valideras inte – nivå 999 och text godtas", async () => {
    await assertSucceeds(updateDoc(doc(env.ak4(), "studentData", "e4a"), { "lasresa.level10": 999, "lasresa.level": "x" }));
  });
  it("OKLART: elev utan Läsresa – nytt tillstånd får bära egna fält (inga resultat/pengar)", async () => {
    await assertSucceeds(updateDoc(doc(env.ak4(), "studentData", "e4b"),
      { lasresa: { level10: 5, worldId: "manen", completedWorlds: ["skogen", "havet"] } }));
    await assertFails(updateDoc(doc(env.ak4(), "studentData", "e4b"), { lasresa: { level10: 5, moneyEarned: 50 } }));
  });
  it("Ekvationsresan: bara nivån, aldrig mynt/statistik", async () => {
    const ref = doc(env.ak4(), "studentData", "e4a", "ekvationsresa", "progress");
    await assertFails(setDoc(ref, { coins: 500 }, { merge: true }));
    await assertFails(setDoc(ref, { level: 12, window: [], solved: 400 }, { merge: true }));
  });
  it("material: byta ägare, ta över andras med merge, skapa åt någon annan", async () => {
    const db = env.ak4();
    await assertFails(setDoc(doc(db, "subjects", "so", "areas", "admin-omr"), { createdBy: "ak4" }, { merge: true }));
    await assertFails(setDoc(doc(db, "subjects", "so", "areas", "ak5-omr"), { title: "Hackat" }, { merge: true }));
    await assertFails(updateDoc(doc(db, "subjects", "so", "areas", "ak4-omr"), { createdBy: "ak5" }));
    await assertFails(updateDoc(doc(db, "subjects", "so", "areas", "ak4-omr"), { createdBy: deleteField() }));
    await assertFails(setDoc(doc(db, "subjects", "so", "areas", "ny"), { title: "x", createdBy: "ak5" }));
    await assertFails(setDoc(doc(db, "subjects", "so", "areas", "ny"), { title: "x" }));
    await assertFails(setDoc(doc(db, "subjects", "finnsinte", "areas", "ny"), { title: "x", createdBy: "ak4" }));
  });
  it("OKLART: createdByName valideras inte – Årskurs 4 kan skriva 'Admin' som skapare", async () => {
    await assertSucceeds(setDoc(doc(env.ak4(), "subjects", "so", "areas", "falskt"),
      { title: "x", createdBy: "ak4", createdByName: "Admin" }));
  });
});

describe("C. Läsa en elev i en annan klass via queries", () => {
  it("dokument direkt: elevdata, lösenord, Läsresan, Ekvationsresan, Hitta rätt!, klasscentret", async () => {
    const db = env.ak4();
    await assertFails(getDoc(doc(db, "studentData", "e5a")));
    await assertFails(getDoc(doc(db, "studentCredentials", "e5a")));
    await assertFails(getDocs(collection(db, "studentData", "e5a", "lasresaAttempts")));
    await assertFails(getDoc(doc(db, "studentData", "e5a", "ekvationsresa", "progress")));
    await assertFails(getDoc(doc(db, "hittaRattBest", "e5a")));
    await assertFails(getDoc(doc(db, "classCenters", "5a")));
    await assertFails(getDoc(doc(db, "classCenters", "5a", "kassa", "saldo")));
    await assertFails(getDocs(collection(db, "classCenters", "5a", "donations")));
    await assertFails(getDoc(doc(db, "classCenters", "5a", "expMembers", "e5a")));
    await assertSucceeds(getDoc(doc(db, "studentData", "e4a")));
  });
  it("hela samlingar och filter på uid/klass", async () => {
    const db = env.ak4();
    await assertFails(getDocs(collection(db, "studentData")));
    await assertFails(getDocs(collection(db, "studentCredentials")));
    await assertFails(getDocs(query(collection(db, "studentCredentials"), where("username", "==", "e5a"))));
    await assertFails(getDocs(collectionGroup(db, "answers")));
    await assertFails(getDocs(query(collectionGroup(db, "answers"), where("uid", "==", "e5a"))));
    await assertFails(getDocs(query(collectionGroup(db, "answers"), where("classId", "==", "5a"))));
    await assertFails(getDocs(query(collectionGroup(db, "answers"), where("classId", "in", ["4a", "5a"]))));
    await assertFails(getDocs(query(collection(db, "hittaRattAttempts"), where("uid", "==", "e5a"))));
    await assertFails(getDocs(collection(db, "hittaRattAttempts")));
    await assertFails(getDocs(collection(db, "mathCompetitions", "mm1", "studentStats")));
    await assertFails(getDocs(query(collection(db, "mathCompetitions", "mm1", "studentStats"), where("classId", "==", "5a"))));
    await assertFails(getDocs(query(collection(db, "mathCompetitions", "mm1", "answers"), where("uid", "==", "e5a"))));
    await assertFails(getDocs(collectionGroup(db, "lasresaAttempts")));
    await assertFails(getDocs(collectionGroup(db, "ekvationsresa")));
    await assertFails(getDocs(collectionGroup(db, "expMembers")));
    await assertFails(getDocs(query(collectionGroup(db, "expMembers"), where("uid", "==", "e5a"))));
    // Kontroll: egna klassen går att lista.
    await assertSucceeds(getDocs(query(collectionGroup(db, "answers"), where("classId", "==", "4a"))));
    await assertSucceeds(getDocs(query(collection(db, "hittaRattAttempts"), where("uid", "==", "e4a"))));
  });
  it("OKLART: i en Klassmatch 4A mot 5A läser Årskurs 4 även 5A-elevernas svar och spelare", async () => {
    const db = env.ak4();
    await assertSucceeds(getDocs(collection(db, "liveSessions", "m4a5a", "answers")));
    await assertSucceeds(getDoc(doc(db, "liveSessions", "m4a5a", "answers", "svar5a-0001")));
  });
  it("öppet för alla inloggade (som för elever, #114): elevkonton (namn/klass), topplistan högst 25", async () => {
    const db = env.ak4();
    await assertSucceeds(getDoc(doc(db, "students", "e5a")));
    await assertSucceeds(getDocs(query(collection(db, "mathCompetitions", "mm1", "scores"), limit(25))));
  });
});

describe("D. Skapa Live utan egen klass", () => {
  const ny = (db) => doc(db, "liveSessions", `ny-${Math.random().toString(36).slice(2)}`);
  it("Klassmatchen och kistformaten utan egen klass, eller med andras klasser", async () => {
    const db = env.ak4();
    await assertFails(setDoc(ny(db), klassmatch(["5a", "6a"], "ak4")));
    await assertFails(setDoc(ny(db), klassmatch(["5a"], "ak4")));
    await assertFails(setDoc(ny(db), kist("guldrush", ["5a"], "ak4")));
    await assertFails(setDoc(ny(db), kist("guldrush", ["4a", "5a"], "ak4")));
    await assertFails(setDoc(ny(db), kist("datakuppen", ["5a"], "ak4")));
    await assertFails(setDoc(ny(db), klassmatch(["4a", "5a"], "admin1"))); // createdBy någon annan
  });
  it("ta över en match: byta klasser i lobbyn till andras, sätta kassapris", async () => {
    const db = env.ak4();
    const ref = doc(db, "liveSessions", "m4a5a");
    await assertFails(updateDoc(ref, { participatingClassIds: ["5a", "6a"], classDivisors: { "5a": 20, "6a": 20 } }));
    await assertFails(updateDoc(ref, { coinPrize: 1000 }));
    await assertSucceeds(setDoc(doc(env.admin(), "liveSessions", "m5a6a"), klassmatch(["5a", "6a"], "admin1")));
    await assertFails(updateDoc(doc(db, "liveSessions", "m5a6a"),
      { participatingClassIds: ["4a", "6a"], classDivisors: { "4a": 20, "6a": 20 } }));
  });
});

describe("E. Pluggmynt utan riktig match (§2.2 'ge pluggmynt direkt')", () => {
  it("HÅL: Klassmatchen tar ett påhittat rewards-tak – tom match ger 1 000 000 mynt till en egen elev", async () => {
    const db = env.ak4();
    const sid = "fusk-km";
    await assertSucceeds(setDoc(doc(db, "liveSessions", sid), klassmatch(["4a", "5a"], "ak4",
      { rewards: { firstPrize: 1000000, perCorrect: 0, cap: 1000000 } })));
    await assertSucceeds(updateDoc(doc(db, "liveSessions", sid), {
      status: "finished",
      result: { rewards: { e4a: { prize: 1000000, correctCoins: 0, total: 1000000 } } },
    }));
    await assertSucceeds(betala(db, sid, "e4a", 1000000, 0, 100));
    assert.equal(await coins("e4a"), 1000100);
  });
  it("HÅL: kistformaten – lobby → avsluta → eget result ger 2 000 mynt per elev och match, utan spel", async () => {
    const db = env.ak4();
    const sid = "fusk-gr";
    await assertSucceeds(setDoc(doc(db, "liveSessions", sid), kist("guldrush", ["4a"], "ak4")));
    await assertSucceeds(updateDoc(doc(db, "liveSessions", sid), { status: "finished", finishedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db, "liveSessions", sid),
      { result: { rewards: { e4a: { prize: 1000, correctCoins: 1000, total: 2000 } } } }));
    await assertSucceeds(betala(db, sid, "e4a", 1000, 1000, 100));
    assert.equal(await coins("e4a"), 2100);
  });
  it("mynt till en elev i en annan klass går inte ens med falskt kvitto", async () => {
    const db = env.ak4();
    const sid = "fusk-5a";
    await assertSucceeds(setDoc(doc(db, "liveSessions", sid), klassmatch(["4a", "5a"], "ak4",
      { rewards: { firstPrize: 500, perCorrect: 0, cap: 500 } })));
    await assertSucceeds(updateDoc(doc(db, "liveSessions", sid),
      { status: "finished", result: { rewards: { e5a: { prize: 500, correctCoins: 0, total: 500 } } } }));
    await assertFails(betala(db, sid, "e5a", 500, 0, 100));
    assert.equal(await coins("e5a"), 100);
  });
});

describe("F. Avstängd token och gammal token efter ändrade klasser", () => {
  it("avstängt årskurskonto (active:false) läser och skriver inget", async () => {
    const db = env.ak4av();
    await assertFails(getDoc(doc(db, "studentData", "e4a")));
    await assertFails(getDoc(doc(db, "studentCredentials", "e4a")));
    await assertFails(setDoc(doc(db, "classes", "4a"), { assignedAreas: ["x"] }, { merge: true }));
    await assertFails(setDoc(doc(db, "liveSessions", "av1"), klassmatch(["4a", "5a"], "ak4av")));
    await assertFails(setDoc(doc(db, "subjects", "so", "areas", "av"), { title: "x", createdBy: "ak4av" }));
  });
  it("raderat konto (dokumentet borta, token kvar) nekas", async () => {
    await env.seed((db) => deleteDoc(doc(db, "teacherAccounts", "ak4")));
    const db = env.ak4();
    await assertFails(getDoc(doc(db, "studentData", "e4a")));
    await assertFails(setDoc(doc(db, "classes", "4a"), { assignedAreas: ["x"] }, { merge: true }));
  });
  it("4B borttagen ur kontot – samma token når inte 4B längre, 4A fortfarande", async () => {
    await env.seed((db) => updateDoc(doc(db, "teacherAccounts", "ak4"), { classIds: ["4a"] }));
    const db = env.ak4();
    await assertFails(getDoc(doc(db, "studentData", "e4b")));
    await assertFails(getDoc(doc(db, "studentCredentials", "e4b")));
    await assertFails(setDoc(doc(db, "classes", "4b"), { assignedAreas: ["x"] }, { merge: true }));
    await assertFails(setDoc(doc(db, "liveSessions", "x4b"), klassmatch(["4b", "5a"], "ak4")));
    await assertSucceeds(getDoc(doc(db, "studentData", "e4a")));
  });
  it("årskurskonto som gjorts om till admin i dokumentet (claims ännu arskurs) får inte adminrätt", async () => {
    await env.seed((db) => updateDoc(doc(db, "teacherAccounts", "ak4"), { role: "admin" }));
    await assertFails(setDoc(doc(env.ak4(), "students", "ny"), { namn: "x", classIds: ["4a"] }));
  });
  it("OKLART (dokumenterat): en admin som stängts av eller nedgraderats behåller adminrätt med sin gamla token (≤ 1 h)", async () => {
    await env.seed((db) => updateDoc(doc(db, "teacherAccounts", "admin1"), { role: "arskurs", active: false, classIds: [] }));
    const db = env.admin(); // token från före avstängningen: { teacher, admin: true }
    await assertSucceeds(setDoc(doc(db, "students", "ny"), { namn: "x", classIds: ["5a"] }));
    await assertSucceeds(updateDoc(doc(db, "studentData", "e5a"), { coins: 99999 }));
  });
  it("påhittade claims-varianter ger ingen behörighet", async () => {
    const ingen = [
      env.as("x1", { teacher: true, role: "admin" }),      // role admin utan admin-claim
      env.as("x2", { teacher: true, admin: false }),       // admin:false
      env.as("x4", { teacher: true, role: "arskurs" }),    // arskurs utan dokument
    ];
    for (const db of ingen) {
      await assertFails(getDoc(doc(db, "studentData", "e4a")));
      await assertFails(setDoc(doc(db, "classes", "4a"), { assignedAreas: ["x"] }, { merge: true }));
    }
    // admin utan teacher = vanlig inloggad (läser olåst elevdata som alla elever, #114), skriver inget.
    const x3 = env.as("x3", { admin: true });
    await assertFails(setDoc(doc(x3, "students", "ny"), { namn: "x", classIds: ["4a"] }));
    await assertFails(setDoc(doc(x3, "classes", "4a"), { assignedAreas: ["x"] }, { merge: true }));
    await assertFails(getDoc(doc(x3, "studentCredentials", "e4a")));
  });
  it("en elev kan inte göra sig till lärare via teacherAccounts", async () => {
    const db = env.as("e4a");
    await assertFails(setDoc(doc(db, "teacherAccounts", "e4a"), { role: "arskurs", active: true, classIds: ["4a", "5a"] }));
    await assertSucceeds(getDoc(doc(db, "teacherAccounts", "e4a"))); // eget (saknat) dokument
    await assertFails(getDoc(doc(db, "teacherAccounts", "ak4")));
  });
});
