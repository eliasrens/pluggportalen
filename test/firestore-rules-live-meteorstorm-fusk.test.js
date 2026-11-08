// ============================================================================
// Regel-tester: Meteorstormen (#821) – TESTARENS fusk-svit mot regelgrenen
// "Meteorstormen" i firestore.rules. Kompletterar
// firestore-rules-live-meteorstorm.test.js med det en elev eller en annan
// lärare kan försöka från konsolen:
//   • listfrågor på msPlayers/msEvents, andra stationens elev, årskurskonto
//     för en klass som inte är med
//   • sessionen: result/msStationer via auto-avslutet, result vid skapandet,
//     klasser/frö/läge under matchen, status tillbaka till live
//   • quizets dokument i efterhand, elev som skriver felbuffert/totaler själv
//   • pluggmyntens kvitto: elev, saknat msPlayers, bara fel svar, rätt-mynt
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  doc, getDoc, getDocs, collection, query, where, setDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp,
  runTransaction, increment,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";

let testEnv, elev, teacher;
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);

const sessionDoc = (over = {}) => ({
  name: "Meteorstormen 4B–4D", format: "meteorstorm", gameMode: "multiplication_0_10", answerKind: "free",
  participatingClassIds: ["4b", "4d"], classNames: { "4b": "4B", "4d": "4D" },
  durationSeconds: 600, countdownSeconds: 4, status: "lobby",
  createdBy: "larare1", createdByName: "Lärare", createdAt: serverTimestamp(),
  msSeed: 123456, msInstallningar: { lage: "klass-mot-klass", attacker: "milda" }, showNames: true,
  ...over,
});
const liveDoc = (ago = 60_000, over = {}) => sessionDoc({ createdAt: ts(-H), status: "live", startedAt: ts(-ago), ...over });
const sess = (db, sid) => doc(db, "liveSessions", sid);
const sub = (db, sid, col, id) => doc(db, "liveSessions", sid, col, id);

/** Årskurskonto (role "arskurs") med klasserna `classIds`. */
const arskurs = (uid) => testEnv.authenticatedContext(uid, { teacher: true, role: "arskurs" }).firestore();

before(async () => {
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-live-meteorstorm-fusk"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

async function seed(sid, data, msPlayers = { alma: { correct: 3, incorrect: 1 }, omar: { correct: 2, incorrect: 0 } }) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(sess(db, sid), data);
    for (const [u, c] of [["alma", "4b"], ["omar", "4d"]]) {
      await setDoc(sub(db, sid, "players", u), { uid: u, classId: c, name: u, joinedAt: ts(-H), lastSeenAt: ts(-1000), correct: 0, incorrect: 0 });
      if (msPlayers[u]) await setDoc(sub(db, sid, "msPlayers", u), { uid: u, classId: c, name: u, ...msPlayers[u] });
    }
    await setDoc(sub(db, sid, "msEvents", "alma_1"), { uid: "alma", classId: "4b", t: Date.now(), typ: "skold", nr: 1, energi: 0 });
    await setDoc(sub(db, sid, "msPublic", "status"), { tMs: Date.now(), stationer: [] });
  });
}

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "4b"), { name: "4B", studentIds: ["alma", "bo"] });
    await setDoc(doc(db, "classes", "4d"), { name: "4D", studentIds: ["omar"] });
    await setDoc(doc(db, "classes", "9x"), { name: "9X", studentIds: ["zed"] });
    for (const u of ["alma", "bo", "omar", "zed"]) await setDoc(doc(db, "students", u), { namn: u });
    await setDoc(doc(db, "studentData", "alma"), { coins: 10 });
    await setDoc(doc(db, "teacherAccounts", "ak9x"), { active: true, role: "arskurs", classIds: ["9x"] });
    await setDoc(doc(db, "teacherAccounts", "ak4d"), { active: true, role: "arskurs", classIds: ["4d"] });
  });
  await seed("pagar", liveDoc());
  await seed("slut", liveDoc(11 * 60_000));
});

describe("Meteorstormen fusk: läsning", () => {
  it("eleven: listfrågor på msPlayers/msEvents nekas, även filtrerade på sig själv", async () => {
    const a = elev("alma");
    await assertFails(getDocs(collection(a, "liveSessions", "pagar", "msPlayers")));
    await assertFails(getDocs(query(collection(a, "liveSessions", "pagar", "msEvents"), where("uid", "==", "alma"))));
    await assertFails(getDocs(query(collection(a, "liveSessions", "pagar", "msEvents"), where("classId", "==", "4b"))));
  });
  it("andra stationens elev läser inte mitt msPlayers; elev utanför sessionen läser ingenting", async () => {
    await assertFails(getDoc(sub(elev("omar"), "pagar", "msPlayers", "alma")));
    const z = elev("zed");
    await assertFails(getDoc(sub(z, "pagar", "msPublic", "status")));
    await assertFails(getDoc(sub(z, "pagar", "msEvents", "alma_1")));
  });
  it("årskurskonto för en klass som inte är med läser varken loggen, msPlayers eller statusen", async () => {
    const t = arskurs("ak9x");
    await assertFails(getDocs(collection(t, "liveSessions", "pagar", "msEvents")));
    await assertFails(getDoc(sub(t, "pagar", "msPlayers", "alma")));
    await assertFails(getDoc(sub(t, "pagar", "msPublic", "status")));
  });
  it("årskurskonto för EN av klasserna (projektorn i 4D) läser loggen och statusen", async () => {
    const t = arskurs("ak4d");
    await assertSucceeds(getDocs(collection(t, "liveSessions", "pagar", "msEvents")));
    await assertSucceeds(getDoc(sub(t, "pagar", "msPublic", "status")));
  });
});

describe("Meteorstormen fusk: elevens skrivningar", () => {
  it("felbufferten, totalerna och klar skriver eleven aldrig själv (create/merge/increment/delete)", async () => {
    const a = elev("alma");
    await assertFails(setDoc(sub(a, "pagar", "msPlayers", "alma"), { fel: [] }, { merge: true }));
    await assertFails(updateDoc(sub(a, "pagar", "msPlayers", "alma"), { correct: increment(1) }));
    await assertFails(setDoc(sub(a, "slut", "msPlayers", "bo"), { uid: "bo", correct: 50, incorrect: 0, klar: true }));
    await assertFails(deleteDoc(sub(a, "pagar", "msPlayers", "alma")));
    await assertFails(deleteDoc(sub(a, "pagar", "msPublic", "status")));
  });
  it("eleven byter inte station: spelardokumentets classId och närvaro-fält", async () => {
    const a = elev("alma");
    await assertFails(updateDoc(sub(a, "pagar", "players", "alma"), { classId: "4d" }));
    await assertFails(updateDoc(sub(a, "pagar", "players", "alma"), { joinedAt: ts(-2 * H) }));
    await assertFails(updateDoc(sub(a, "pagar", "players", "alma"), { correct: 99 }));
  });
  it("elev går inte med i en annan klass station", async () => {
    await assertFails(setDoc(sub(elev("bo"), "pagar", "players", "bo"), {
      uid: "bo", classId: "4d", name: "bo", joinedAt: serverTimestamp(), lastSeenAt: serverTimestamp(), correct: 0, incorrect: 0,
    }));
  });
  it("quizets frågor/facit kan inte läggas till eller bytas efter skapandet", async () => {
    await seed("quiz", liveDoc(60_000, { gameMode: "plugga_quiz", answerKind: "choice", questionCount: 1 }));
    await testEnv.withSecurityRulesDisabled((ctx) => setDoc(sub(ctx.firestore(), "quiz", "msPublic", "questions"), { questions: [{ text: "?" }] }));
    for (const db of [teacher(), elev("alma")]) {
      await assertFails(setDoc(sub(db, "quiz", "msPublic", "questions"), { questions: [{ text: "!" }] }));
      await assertFails(setDoc(sub(db, "quiz", "msPrivate", "snapshot"), { facit: [{ answerIndex: 0 }] }));
    }
  });
});

describe("Meteorstormen fusk: sessionen", () => {
  it("auto-avslutet (vem som helst efter slutet) kan inte bära med result eller msStationer", async () => {
    const a = elev("alma");
    await assertFails(updateDoc(sess(a, "slut"), { status: "finished", finishedAt: serverTimestamp(), result: { winner: "4b" } }));
    await assertFails(updateDoc(sess(a, "slut"), { status: "finished", finishedAt: serverTimestamp(), msStationer: [{ classId: "4b", aktiva: 1 }] }));
    await assertFails(updateDoc(sess(teacher(), "pagar"), { status: "finished", finishedAt: serverTimestamp(), result: { winner: "4b" } }));
  });
  it("skapa med result, med status live eller med msStationer nekas", async () => {
    const t = teacher();
    await assertFails(setDoc(sess(t, "n1"), sessionDoc({ result: { winner: "4b", rewards: {} } })));
    await assertFails(setDoc(sess(t, "n2"), sessionDoc({ status: "live", startedAt: serverTimestamp() })));
    await assertFails(setDoc(sess(t, "n3"), sessionDoc({ msStationer: [{ classId: "4b", aktiva: 30 }, { classId: "4d", aktiva: 1 }] })));
  });
  it("under matchen: klasser, frö, läge, speltid, startedAt och status tillbaka till live nekas", async () => {
    const t = teacher();
    await assertFails(updateDoc(sess(t, "pagar"), { participatingClassIds: ["4b", "9x"] }));
    await assertFails(updateDoc(sess(t, "pagar"), { msSeed: 1 }));
    await assertFails(updateDoc(sess(t, "pagar"), { msInstallningar: { lage: "klass-mot-klass", attacker: "av" } }));
    await assertFails(updateDoc(sess(t, "pagar"), { durationSeconds: 1200 }));
    await assertFails(updateDoc(sess(t, "pagar"), { startedAt: serverTimestamp() }));
    await testEnv.withSecurityRulesDisabled((ctx) => updateDoc(sess(ctx.firestore(), "slut"), { status: "finished", finishedAt: ts(-1000) }));
    await assertFails(updateDoc(sess(t, "slut"), { status: "live" }));
  });
  it("årskurskonto för en annan klass styr inte sessionen", async () => {
    await assertFails(updateDoc(sess(arskurs("ak9x"), "pagar"), { status: "finished", finishedAt: serverTimestamp() }));
  });
});

describe("Meteorstormen fusk: pluggmyntens kvitto", () => {
  const avslutad = (rewards) => liveDoc(11 * 60_000, {
    status: "finished", finishedAt: ts(-1000), rewards: { firstPrize: 100, perCorrect: 5, cap: 300 }, result: { format: "meteorstorm", rewards },
  });
  const kvitto = (db, sid, r, fore = 10) => runTransaction(db, async (tx) => {
    tx.set(doc(db, "liveSessions", sid, "coinReceipts", "alma"), {
      uid: "alma", prize: r.prize, correctCoins: r.correctCoins, total: r.total, at: serverTimestamp(), by: "larare1",
    });
    tx.set(doc(db, "studentData", "alma"), { coins: fore + r.total }, { merge: true });
  });
  it("eleven skriver inte sitt eget kvitto", async () => {
    const r = { rank: 1, correct: 3, prize: 100, correctCoins: 15, total: 115 };
    await seed("k1", avslutad({ alma: r }));
    const a = elev("alma");
    await assertFails(runTransaction(a, async (tx) => {
      tx.set(doc(a, "liveSessions", "k1", "coinReceipts", "alma"), { uid: "alma", prize: 100, correctCoins: 15, total: 115, at: serverTimestamp(), by: "alma" });
      tx.set(doc(a, "studentData", "alma"), { coins: 125 }, { merge: true });
    }));
  });
  it("utan msPlayers (servern såg inga svar) nekas även placeringspriset", async () => {
    const r = { rank: 1, correct: 0, prize: 100, correctCoins: 0, total: 100 };
    await seed("k2", avslutad({ alma: r }), {});
    await assertFails(kvitto(teacher(), "k2", r));
  });
  it("msPlayers med bara felbufferten (inga totaler) räcker inte", async () => {
    const r = { rank: 1, correct: 0, prize: 100, correctCoins: 0, total: 100 };
    await seed("k3", avslutad({ alma: r }), { alma: { fel: [{ factorA: 2, factorB: 2, answer: 5, isCorrect: false }] } });
    await assertFails(kvitto(teacher(), "k3", r));
  });
  it("rätt-mynt = 5 × correct går; ett mynt till nekas", async () => {
    const ok = { rank: 1, correct: 3, prize: 100, correctCoins: 15, total: 115 };
    await seed("k4", avslutad({ alma: ok }));
    await assertSucceeds(kvitto(teacher(), "k4", ok));
    const mer = { rank: 1, correct: 3, prize: 100, correctCoins: 16, total: 116 };
    await seed("k5", avslutad({ alma: mer }));
    await assertFails(kvitto(teacher(), "k5", mer));
  });
});
