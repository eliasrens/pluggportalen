// ============================================================================
// Regel-tester: Meteorstormen (#821, epic #819) – firestore.rules "Meteorstormen"
//   • skapa: inställningarna (frö, läge, attacker, speltid 5–20 min) validerade
//     och låsta; quiz → frågorna (msPublic) + facit (msPrivate) i SAMMA batch
//   • msStationer och result skriver bara servern (lärarklienten nekas)
//   • STARTA / avsluta / auto-avslut efter slutet
//   • klienten skriver ALDRIG i msEvents, msPlayers, msPublic/status, msLas
//   • eleven läser eget msPlayers + msPublic, aldrig msEvents eller andras
//     msPlayers; lärare/projektor läser allt
//   • pluggmynten: kvittot mot msPlayers.correct (bara servern skriver det)
// Körs av `npm run test:rules` (kräver emulatorn).
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

/** Sessionen som formatets buildSessionFields (D) ska skriva den. */
const sessionDoc = (over = {}) => ({
  name: "Meteorstormen 4B–4D", format: "meteorstorm", gameMode: "multiplication_0_10", answerKind: "free",
  participatingClassIds: ["4b", "4d"], classNames: { "4b": "4B", "4d": "4D" },
  durationSeconds: 600, countdownSeconds: 4, status: "lobby",
  createdBy: "larare1", createdByName: "Lärare", createdAt: serverTimestamp(),
  msSeed: 123456, msInstallningar: { lage: "klass-mot-klass", attacker: "milda" }, showNames: true,
  ...over,
});
const QUESTIONS = [{ id: "q1", text: "Huvudstad?", options: ["Oslo", "Stockholm"] }, { id: "q2", text: "2+2?", options: ["4", "5"] }];
const FACIT = [{ answerIndex: 1 }, { answerIndex: 0 }];
const quizOver = { gameMode: "plugga_quiz", answerKind: "choice", questionCount: 2, quiz: { subjectId: "so", areaId: "x" } };
const liveDoc = (ago = 60_000, over = {}) => sessionDoc({ createdAt: ts(-H), status: "live", startedAt: ts(-ago), ...over });

const sess = (db, sid) => doc(db, "liveSessions", sid);
const sub = (db, sid, col, id) => doc(db, "liveSessions", sid, col, id);

before(async () => {
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-live-meteorstorm"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

async function seed(sid, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(sess(db, sid), data);
    for (const [u, c] of [["alma", "4b"], ["omar", "4d"]]) {
      await setDoc(sub(db, sid, "players", u), { uid: u, classId: c, name: u, joinedAt: ts(-H), lastSeenAt: ts(-1000), correct: 0, incorrect: 0 });
      await setDoc(sub(db, sid, "msPlayers", u), { uid: u, classId: c, name: u, correct: 3, incorrect: 1 });
    }
    await setDoc(sub(db, sid, "msEvents", "alma_1"), { uid: "alma", classId: "4b", t: Date.now(), typ: "skold", nr: 1, energi: 0 });
    await setDoc(sub(db, sid, "msPublic", "status"), { tMs: Date.now(), stationer: [] });
    await setDoc(sub(db, sid, "msLas", "4b"), { id: "alma_1", t: Date.now() });
  });
}

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "4b"), { name: "4B", studentIds: ["alma", "bo"] });
    await setDoc(doc(db, "classes", "4d"), { name: "4D", studentIds: ["omar"] });
    for (const u of ["alma", "bo", "omar"]) await setDoc(doc(db, "students", u), { namn: u });
    await setDoc(doc(db, "studentData", "alma"), { coins: 10 });
  });
  await seed("lobby", sessionDoc({ createdAt: ts(-H) }));
  await seed("pagar", liveDoc());
  await seed("slut", liveDoc(11 * 60_000));
});

describe("Meteorstormen: skapa sessionen", () => {
  it("läraren skapar en lobby (multiplikation)", async () => {
    await assertSucceeds(setDoc(sess(teacher(), "ny"), sessionDoc()));
  });
  it("En klass med en klass, Attacker av", async () => {
    await assertSucceeds(setDoc(sess(teacher(), "en"), sessionDoc({
      participatingClassIds: ["4b"], classNames: { "4b": "4B" }, msInstallningar: { lage: "en-klass", attacker: "av" },
    })));
  });
  it("quiz: frågorna + facit i samma batch; utan dem nekas", async () => {
    const db = teacher();
    await assertFails(setDoc(sess(db, "q0"), sessionDoc(quizOver)));
    const b = writeBatch(db);
    b.set(sess(db, "q1"), sessionDoc(quizOver));
    b.set(sub(db, "q1", "msPublic", "questions"), { questions: QUESTIONS });
    b.set(sub(db, "q1", "msPrivate", "snapshot"), { facit: FACIT });
    await assertSucceeds(b.commit());
  });
  it("quizets dokument: fel id (status) eller fel antal nekas", async () => {
    const db = teacher();
    const b = writeBatch(db);
    b.set(sess(db, "q2"), sessionDoc(quizOver));
    b.set(sub(db, "q2", "msPublic", "questions"), { questions: QUESTIONS });
    b.set(sub(db, "q2", "msPrivate", "snapshot"), { facit: FACIT });
    b.set(sub(db, "q2", "msPublic", "status"), { questions: QUESTIONS });
    await assertFails(b.commit());
    const c = writeBatch(db);
    c.set(sess(db, "q3"), sessionDoc(quizOver));
    c.set(sub(db, "q3", "msPublic", "questions"), { questions: QUESTIONS.slice(0, 1) });
    c.set(sub(db, "q3", "msPrivate", "snapshot"), { facit: FACIT });
    await assertFails(c.commit());
  });
  it("elev får inte skapa", async () => {
    await assertFails(setDoc(sess(elev("alma"), "ny"), sessionDoc({ createdBy: "alma" })));
  });
  it("ogiltiga inställningar nekas", async () => {
    const db = teacher();
    const fel = [
      { okant: 1 },
      { msSeed: -1 }, { msSeed: 1.5 }, { msSeed: "abc" },
      { msInstallningar: { lage: "alla-mot-alla", attacker: "milda" } },
      { msInstallningar: { lage: "klass-mot-klass", attacker: "brutala" } },
      { msInstallningar: { lage: "klass-mot-klass", attacker: "milda", extra: 1 } },
      { msInstallningar: { lage: "en-klass", attacker: "av" } }, // två klasser i En klass
      { participatingClassIds: ["4b"], classNames: { "4b": "4B" } }, // en klass i Klass mot klass
      { durationSeconds: 240 }, { durationSeconds: 1260 }, { durationSeconds: 630 },
      { gameMode: "plugga_quiz", answerKind: "free", questionCount: 2 },
      { msStationer: [{ classId: "4b", aktiva: 99 }] },
      { result: { winner: "4b" } },
      { startedAt: serverTimestamp() },
    ];
    for (const [i, over] of fel.entries()) await assertFails(setDoc(sess(db, `fel${i}`), sessionDoc(over)));
    const utanFro = sessionDoc();
    delete utanFro.msSeed;
    await assertFails(setDoc(sess(db, "utan"), utanFro));
  });
});

describe("Meteorstormen: sessionens övergångar", () => {
  it("STARTA, avsluta och namn i lobbyn", async () => {
    await assertSucceeds(updateDoc(sess(teacher(), "lobby"), { name: "Nytt namn" }));
    await assertSucceeds(updateDoc(sess(teacher(), "lobby"), { status: "live", startedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(sess(teacher(), "pagar"), { status: "finished", finishedAt: serverTimestamp() }));
  });
  it("inställningarna, formatet, msStationer och result rör ingen klient", async () => {
    const db = teacher();
    await assertFails(updateDoc(sess(db, "lobby"), { msSeed: 7 }));
    await assertFails(updateDoc(sess(db, "lobby"), { "msInstallningar.attacker": "vilda" }));
    await assertFails(updateDoc(sess(db, "lobby"), { format: "guldrush" }));
    await assertFails(updateDoc(sess(db, "pagar"), { msStationer: [{ classId: "4b", aktiva: 1 }, { classId: "4d", aktiva: 1 }] }));
    await testEnv.withSecurityRulesDisabled((ctx) => updateDoc(sess(ctx.firestore(), "slut"), { status: "finished", finishedAt: ts(-1000) }));
    await assertFails(updateDoc(sess(db, "slut"), { result: { winner: "4b" } }));
  });
  it("auto-avslut efter slutet (vem som helst), inte före", async () => {
    await assertFails(updateDoc(sess(elev("alma"), "pagar"), { status: "finished", finishedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(sess(elev("alma"), "slut"), { status: "finished", finishedAt: serverTimestamp() }));
  });
});

describe("Meteorstormen: klienten skriver aldrig i formatets samlingar", () => {
  for (const [vem, db] of [["eleven", () => elev("alma")], ["läraren", () => teacher()]]) {
    it(`${vem}: msEvents, msPlayers, msPublic/status, msLas nekas`, async () => {
      const d = db();
      await assertFails(setDoc(sub(d, "pagar", "msEvents", "alma_2"), { uid: "alma", classId: "4b", t: Date.now(), typ: "laser", nr: 2 }));
      await assertFails(updateDoc(sub(d, "pagar", "msEvents", "alma_1"), { typ: "drag" }));
      await assertFails(setDoc(sub(d, "pagar", "msPlayers", "alma"), { correct: 999 }));
      await assertFails(updateDoc(sub(d, "pagar", "msPlayers", "alma"), { correct: 999 }));
      await assertFails(setDoc(sub(d, "pagar", "msPublic", "status"), { tMs: 1, stationer: [] }));
      await assertFails(setDoc(sub(d, "pagar", "msLas", "4b"), { id: "x" }));
      if (vem === "eleven") await assertFails(deleteDoc(sub(d, "pagar", "msEvents", "alma_1"))); // admin får städa
    });
  }
  it("inga svar i kärnans answers (servern rättar)", async () => {
    await assertFails(setDoc(sub(elev("alma"), "pagar", "answers", "a-12345678"), {
      uid: "alma", classId: "4b", mode: "multiplication_0_10", factorA: 2, factorB: 3, answer: 6, isCorrect: true, at: serverTimestamp(),
    }));
  });
});

describe("Meteorstormen: läsning", () => {
  it("eleven läser eget msPlayers och msPublic/status – inte andras, inte loggen", async () => {
    const a = elev("alma");
    await assertSucceeds(getDoc(sub(a, "pagar", "msPlayers", "alma")));
    await assertFails(getDoc(sub(a, "pagar", "msPlayers", "omar")));
    await assertSucceeds(getDoc(sub(a, "pagar", "msPublic", "status")));
    await assertFails(getDoc(sub(a, "pagar", "msEvents", "alma_1")));
    await assertFails(getDocs(collection(a, "liveSessions", "pagar", "msEvents")));
    await assertFails(getDoc(sub(a, "pagar", "msLas", "4b")));
    await assertFails(getDoc(sub(a, "pagar", "msPrivate", "snapshot")));
  });
  it("elev som inte gått med läser inte statusen", async () => {
    await assertFails(getDoc(sub(elev("bo"), "pagar", "msPublic", "status")));
  });
  it("läraren/projektorn läser loggen, alla msPlayers och statusen – inte msLas", async () => {
    const t = teacher();
    await assertSucceeds(getDocs(collection(t, "liveSessions", "pagar", "msEvents")));
    await assertSucceeds(getDocs(collection(t, "liveSessions", "pagar", "msPlayers")));
    await assertSucceeds(getDoc(sub(t, "pagar", "msPublic", "status")));
    await assertFails(getDoc(sub(t, "pagar", "msLas", "4b")));
  });
});

describe("Meteorstormen: pluggmynten (kvittot mot msPlayers)", () => {
  const avslutad = (rewards) => liveDoc(11 * 60_000, {
    status: "finished", finishedAt: ts(-1000), rewards: { firstPrize: 100, perCorrect: 5, cap: 300 }, result: { format: "meteorstorm", rewards },
  });
  it("rätt kvitto (rätt-mynt ≤ 5 × msPlayers.correct) betalas en gång", async () => {
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
