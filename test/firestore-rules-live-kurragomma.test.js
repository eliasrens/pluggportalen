// ============================================================================
// Regel-tester: Kurragömma (#838, epic #835) – firestore.rules "Kurragömma"
//   • skapa: inställningarna (gömtid, startsökare, tystnad, karta) validerade och
//     låsta; durationSeconds = gömtid + hela minuter 1–60; quiz → kgPublic +
//     kgPrivate i SAMMA batch
//   • kgFas/kgGomSlut/kgLetStart/kgPlacerade/result skriver bara servern
//   • klienten skriver ALDRIG i kgPlayers, kgSelf, kgSecret, kgEvents, answers
//   • eleven läser eget kgPlayers + kgSelf – inte andras, inte kgEvents;
//     ingen läser kgSecret; läraren läser kgPlayers + kgEvents men inte kgSelf
//   • pluggmynten: kvittot mot kgPlayers.ratt (bara servern skriver det)
// Körs av `npm run test:rules` (kräver emulatorn). Spec §13.3.
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp, runTransaction,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { payLiveRewards } from "../src/live/live-rewards-pay.js";

let testEnv, elev, teacher;
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
const sdk = { doc, getDoc, runTransaction, serverTimestamp };
const INST = { gomtid: 30, startsokare: "auto", tystnad: true, karta: "on" };

/** Sessionen som formatets buildSessionFields (E) ska skriva den: 30 s gömtid + 8 min. */
const sessionDoc = (over = {}) => ({
  name: "Kurragömma 4B", format: "kurragomma", gameMode: "multiplication_0_10", answerKind: "free",
  participatingClassIds: ["4b"], classNames: { "4b": "4B" },
  durationSeconds: 30 + 480, countdownSeconds: 4, status: "lobby",
  createdBy: "larare1", createdByName: "Lärare", createdAt: serverTimestamp(),
  kgInstallningar: INST, showNames: true,
  ...over,
});
const QUESTIONS = [{ id: "q1", text: "Huvudstad?", options: ["Oslo", "Stockholm"] }, { id: "q2", text: "2+2?", options: ["4", "5"] }];
const FACIT = [{ answerIndex: 1 }, { answerIndex: 0 }];
const quizOver = { gameMode: "plugga_quiz", answerKind: "choice", questionCount: 2, quiz: { subjectId: "so", areaId: "x" } };
const liveDoc = (ago = 60_000, over = {}) => sessionDoc({
  createdAt: ts(-H), status: "live", startedAt: ts(-ago), kgFas: "leta", kgGomSlut: ts(-ago + 34_000), kgLetStart: ts(-ago + 34_000), ...over,
});

const sess = (db, sid) => doc(db, "liveSessions", sid);
const sub = (db, sid, col, id) => doc(db, "liveSessions", sid, col, id);

before(async () => {
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-live-kurragomma"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

async function seed(sid, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(sess(db, sid), data);
    for (const [u, roll] of [["alma", "gomd"], ["omar", "sokare"]]) {
      await setDoc(sub(db, sid, "players", u), { uid: u, classId: "4b", name: u, joinedAt: ts(-H), lastSeenAt: ts(-1000), correct: 0, incorrect: 0 });
      await setDoc(sub(db, sid, "kgPlayers", u), { uid: u, classId: "4b", name: u, roll, poang: 10, ratt: 3, besvarade: 4, hittade: 0, laddningar: 1, harLast: true });
      await setDoc(sub(db, sid, "kgSelf", u), { gomstalle: { x: 1, z: 2, skydd: 2, namn: "vid ladan" } });
      await setDoc(sub(db, sid, "kgSecret", u), { x: 1, z: 2, gomd: roll === "gomd", lastAt: Date.now() });
    }
    await setDoc(sub(db, sid, "kgEvents", "e1"), { t: Date.now(), typ: "vissling", x: 3, z: 4, plats: "vid ladan" });
  });
}

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "4b"), { name: "4B", studentIds: ["alma", "bo", "omar"] });
    for (const u of ["alma", "bo", "omar"]) await setDoc(doc(db, "students", u), { namn: u });
    await setDoc(doc(db, "studentData", "alma"), { coins: 10 });
  });
  await seed("lobby", sessionDoc({ createdAt: ts(-H) }));
  await seed("pagar", liveDoc());
  await seed("slut", liveDoc(11 * 60_000));
});

describe("Kurragömma: skapa sessionen", () => {
  it("läraren skapar en lobby (multiplikation), även med 1–4 startsökare och tystnad av", async () => {
    await assertSucceeds(setDoc(sess(teacher(), "ny"), sessionDoc()));
    await assertSucceeds(setDoc(sess(teacher(), "ny2"), sessionDoc({ kgInstallningar: { gomtid: 60, startsokare: 4, tystnad: false, karta: "on" }, durationSeconds: 60 + 3600 })));
    await assertSucceeds(setDoc(sess(teacher(), "ny3"), sessionDoc({ durationSeconds: 30 + 60, rewards: { firstPrize: 100, perCorrect: 5, cap: 300 } })));
  });
  it("quiz: frågorna + facit i samma batch; utan dem nekas", async () => {
    const db = teacher();
    await assertFails(setDoc(sess(db, "q0"), sessionDoc(quizOver)));
    const b = writeBatch(db);
    b.set(sess(db, "q1"), sessionDoc(quizOver));
    b.set(sub(db, "q1", "kgPublic", "questions"), { questions: QUESTIONS });
    b.set(sub(db, "q1", "kgPrivate", "snapshot"), { facit: FACIT });
    await assertSucceeds(b.commit());
  });
  it("elev får inte skapa", async () => {
    await assertFails(setDoc(sess(elev("alma"), "ny"), sessionDoc({ createdBy: "alma" })));
  });
  it("ogiltiga inställningar och serverns fält nekas", async () => {
    const db = teacher();
    const fel = [
      { okant: 1 },
      { kgInstallningar: { ...INST, gomtid: 25 } },
      { kgInstallningar: { ...INST, startsokare: 5 } },
      { kgInstallningar: { ...INST, startsokare: "0" } },
      { kgInstallningar: { ...INST, tystnad: "ja" } },
      { kgInstallningar: { ...INST, karta: "skolgarden" } },
      { kgInstallningar: { ...INST, extra: 1 } },
      { durationSeconds: 480 }, // utan gömtiden
      { durationSeconds: 30 + 30 }, // under 1 min
      { durationSeconds: 30 + 3660 }, // över 60 min
      { durationSeconds: 30 + 490 }, // inte hela minuter
      { participatingClassIds: [], classNames: {} },
      { gameMode: "plugga_quiz", answerKind: "free", questionCount: 2 },
      { kgFas: "gom" }, { kgGomSlut: serverTimestamp() }, { kgLetStart: serverTimestamp() }, { kgPlacerade: true },
      { result: { winner: null } },
      { startedAt: serverTimestamp() },
    ];
    for (const [i, over] of fel.entries()) await assertFails(setDoc(sess(db, `fel${i}`), sessionDoc(over)));
    const utanInst = sessionDoc();
    delete utanInst.kgInstallningar;
    await assertFails(setDoc(sess(db, "utan"), utanInst));
  });
});

describe("Kurragömma: sessionens övergångar", () => {
  it("STARTA, avsluta och namn i lobbyn", async () => {
    await assertSucceeds(updateDoc(sess(teacher(), "lobby"), { name: "Nytt namn" }));
    await assertSucceeds(updateDoc(sess(teacher(), "lobby"), { status: "live", startedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(sess(teacher(), "pagar"), { status: "finished", finishedAt: serverTimestamp() }));
  });
  it("inställningarna, formatet, fasen, tiderna och result rör ingen klient", async () => {
    const db = teacher();
    await assertFails(updateDoc(sess(db, "lobby"), { "kgInstallningar.gomtid": 60 }));
    await assertFails(updateDoc(sess(db, "lobby"), { format: "guldrush" }));
    await assertFails(updateDoc(sess(db, "lobby"), { durationSeconds: 630 }));
    await assertFails(updateDoc(sess(db, "pagar"), { kgFas: "gom" }));
    await assertFails(updateDoc(sess(db, "pagar"), { kgGomSlut: serverTimestamp() }));
    await assertFails(updateDoc(sess(db, "pagar"), { kgLetStart: serverTimestamp() }));
    await assertFails(updateDoc(sess(db, "pagar"), { kgPlacerade: true }));
    await testEnv.withSecurityRulesDisabled((ctx) => updateDoc(sess(ctx.firestore(), "slut"), { status: "finished", finishedAt: ts(-1000) }));
    await assertFails(updateDoc(sess(db, "slut"), { result: { winner: null } }));
  });
  it("auto-avslut efter slutet (vem som helst), inte före", async () => {
    await assertFails(updateDoc(sess(elev("alma"), "pagar"), { status: "finished", finishedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(sess(elev("alma"), "slut"), { status: "finished", finishedAt: serverTimestamp() }));
  });
});

describe("Kurragömma: klienten skriver aldrig i formatets samlingar", () => {
  for (const [vem, db] of [["eleven", () => elev("alma")], ["läraren", () => teacher()]]) {
    it(`${vem}: kgPlayers, kgSelf, kgSecret, kgEvents nekas`, async () => {
      const d = db();
      await assertFails(updateDoc(sub(d, "pagar", "kgPlayers", "alma"), { poang: 999 }));
      await assertFails(setDoc(sub(d, "pagar", "kgPlayers", "bo"), { uid: "bo", roll: "gomd", poang: 0 }));
      await assertFails(updateDoc(sub(d, "pagar", "kgSelf", "alma"), { gomstalle: { x: 0, z: 0, skydd: 3, namn: "i buskaget" } }));
      await assertFails(setDoc(sub(d, "pagar", "kgSecret", "alma"), { x: 0, z: 0 }));
      await assertFails(updateDoc(sub(d, "pagar", "kgSecret", "alma"), { gomd: false }));
      await assertFails(setDoc(sub(d, "pagar", "kgEvents", "e2"), { t: Date.now(), typ: "hittad", x: 0, z: 0, plats: "vid brunnen" }));
      if (vem === "eleven") await assertFails(deleteDoc(sub(d, "pagar", "kgEvents", "e1"))); // admin får städa
    });
  }
  it("inga svar i kärnans answers (servern rättar)", async () => {
    await assertFails(setDoc(sub(elev("alma"), "pagar", "answers", "a-12345678"), {
      uid: "alma", classId: "4b", mode: "multiplication_0_10", factorA: 2, factorB: 3, answer: 6, isCorrect: true, at: serverTimestamp(),
    }));
  });
});

describe("Kurragömma: läsning", () => {
  it("eleven läser eget kgPlayers och kgSelf – inte andras, inte kgEvents, inte kgSecret", async () => {
    const a = elev("alma");
    await assertSucceeds(getDoc(sub(a, "pagar", "kgPlayers", "alma")));
    await assertSucceeds(getDoc(sub(a, "pagar", "kgSelf", "alma")));
    await assertFails(getDoc(sub(a, "pagar", "kgPlayers", "omar")));
    await assertFails(getDoc(sub(a, "pagar", "kgSelf", "omar")));
    await assertFails(getDocs(collection(a, "liveSessions", "pagar", "kgPlayers")));
    await assertFails(getDoc(sub(a, "pagar", "kgSecret", "alma")));
    await assertFails(getDoc(sub(a, "pagar", "kgEvents", "e1")));
    await assertFails(getDocs(collection(a, "liveSessions", "pagar", "kgEvents")));
    await assertFails(getDoc(sub(a, "pagar", "kgPrivate", "snapshot")));
  });
  it("läraren/projektorn läser kgPlayers och kgEvents – aldrig kgSelf eller kgSecret", async () => {
    const t = teacher();
    await assertSucceeds(getDocs(collection(t, "liveSessions", "pagar", "kgPlayers")));
    await assertSucceeds(getDocs(collection(t, "liveSessions", "pagar", "kgEvents")));
    await assertFails(getDoc(sub(t, "pagar", "kgSelf", "alma")));
    await assertFails(getDocs(collection(t, "liveSessions", "pagar", "kgSelf")));
    await assertFails(getDoc(sub(t, "pagar", "kgSecret", "alma")));
    await assertFails(getDocs(collection(t, "liveSessions", "pagar", "kgSecret")));
  });
  it("elev som inte gått med läser inte kgPublic; deltagaren läser", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) => setDoc(sub(ctx.firestore(), "pagar", "kgPublic", "questions"), { questions: QUESTIONS }));
    await assertFails(getDoc(sub(elev("bo"), "pagar", "kgPublic", "questions")));
    await assertSucceeds(getDoc(sub(elev("alma"), "pagar", "kgPublic", "questions")));
  });
});

describe("Kurragömma: pluggmynten (kvittot mot kgPlayers.ratt)", () => {
  const avslutad = (rewards) => liveDoc(11 * 60_000, {
    status: "finished", finishedAt: ts(-1000), rewards: { firstPrize: 100, perCorrect: 5, cap: 300 }, result: { format: "kurragomma", rewards },
  });
  it("rätt kvitto (rätt-mynt ≤ 5 × kgPlayers.ratt) betalas en gång", async () => {
    const s = avslutad({ alma: { rank: 1, correct: 3, prize: 100, correctCoins: 15, total: 115 } });
    await seed("betala", s);
    const ut = await payLiveRewards(sdk, teacher(), { sid: "betala", session: s, uid: "larare1" });
    assert.deepEqual(ut.map((x) => x.status), ["betald"]);
    const igen = await payLiveRewards(sdk, teacher(), { sid: "betala", session: s, uid: "larare1" });
    assert.deepEqual(igen.map((x) => x.status), ["redan"]);
  });
  it("fler rätt-mynt än servern räknat rätt svar nekas", async () => {
    const s = avslutad({ alma: { rank: 1, correct: 10, prize: 100, correctCoins: 50, total: 150 } });
    await seed("fusk", s);
    const ut = await payLiveRewards(sdk, teacher(), { sid: "fusk", session: s, uid: "larare1" });
    assert.deepEqual(ut.map((x) => x.status), ["nekad"]);
  });
});
