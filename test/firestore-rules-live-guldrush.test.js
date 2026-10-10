// ============================================================================
// Regel-tester: Guldrushen (#563, epic #562) – firestore.rules "Guldrushen"
//   • skapa: inställningarna validerade och låsta; quiz → frågorna (grPublic)
//     + facit (grPrivate) i SAMMA batch, facit oläsbart för elev (§4.4)
//   • STARTA / endsAt / avsluta / result en gång / auto-avslut efter 00:00
//   • test 19: eleven kan inte skriva guld, kistor, skydd, händelser eller
//     ledaren, och inte skapa ett eget (rätt) svar – det gör bara servern
//   • test 20: inga svar efter tiden (inga klientsvar alls i Guldrushen)
//   • deltagare läser guld/händelser, utomstående elever inte
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch, serverTimestamp, Timestamp, deleteField,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { buildSessionDoc } from "../src/live/live-core.js";
import "../src/live/modes/index.js";

let testEnv, elev, teacher;
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);

const sessionDoc = (over = {}, inp = {}) => {
  const d = buildSessionDoc({
    name: "Guldrushen 4B", format: "guldrush", gameMode: "multiplication_0_10", answerKind: "free",
    classIds: ["4b"], classNames: { "4b": "4B" }, durationMin: 10, stealSwap: true, showNames: true, ...inp,
  }, { uid: "larare1" });
  return { ...d, createdAt: serverTimestamp(), ...over };
};
const quizInput = { gameMode: "plugga_quiz", answerKind: "choice", quizArea: { subjectId: "so", areaId: "x", usable: 2 } };
const QUESTIONS = [
  { id: "q1", text: "Huvudstad?", options: ["Oslo", "Stockholm"], statKeys: ["ovrig", "q:q1"] },
  { id: "q2", text: "2+2?", options: ["4", "5"], statKeys: ["ovrig", "q:q2"] },
];
const FACIT = [{ answerIndex: 1 }, { answerIndex: 0 }];
// Pågående: startad för `ago` ms sedan (10 min speltid + 4 s nedräkning).
const liveDoc = (ago = 60_000, over = {}) => ({ ...sessionDoc(), createdAt: ts(-H), status: "live", startedAt: ts(-ago), ...over });

const sess = (db, sid) => doc(db, "liveSessions", sid);

before(async () => {
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-live-guldrush"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

async function seed(sid, data, extra = async () => {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(sess(db, sid), data);
    await setDoc(doc(db, "liveSessions", sid, "players", "alma"),
      { uid: "alma", classId: "4b", name: "alma", joinedAt: ts(-H), lastSeenAt: ts(-1000), correct: 0, incorrect: 0 });
    await setDoc(doc(db, "liveSessions", sid, "grPlayers", "alma"), { uid: "alma", classId: "4b", name: "alma", gold: 100 });
    await setDoc(doc(db, "liveSessions", sid, "grEvents", "e1"), { type: "chest", chest: "guld", uid: "alma", amount: 25, at: ts(-1000) });
    await setDoc(doc(db, "liveSessions", sid, "grMeta", "leader"), { uid: "alma", gold: 100 });
    await extra(db);
  });
}

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "4b"), { name: "4B", studentIds: ["alma", "bo", "omar"] });
    for (const u of ["alma", "bo", "omar"]) await setDoc(doc(db, "students", u), { namn: u });
  });
  await seed("lobby", { ...sessionDoc(), createdAt: ts(-H) });
  await seed("pagar", liveDoc());
  await seed("slut", liveDoc(11 * 60_000));
  await seed("quiz", { ...sessionDoc({}, quizInput), questionCount: 2, createdAt: ts(-H), status: "live", startedAt: ts(-60_000) }, async (db) => {
    await setDoc(doc(db, "liveSessions", "quiz", "grPublic", "questions"), { questions: QUESTIONS });
    await setDoc(doc(db, "liveSessions", "quiz", "grPrivate", "snapshot"), { facit: FACIT });
  });
});

describe("Guldrushen: skapa sessionen", () => {
  it("läraren skapar en multiplikationsmatch; eleven kan inte", async () => {
    await assertSucceeds(setDoc(sess(teacher(), "ny"), sessionDoc()));
    await assertFails(setDoc(sess(elev("alma"), "ny2"), { ...sessionDoc(), createdBy: "alma" }));
  });

  it("ogiltiga inställningar nekas (speltid 25 min, 4 klasser, annat spelläge, quiz med skriv själv, okänt fält)", async () => {
    const t = teacher();
    await assertFails(setDoc(sess(t, "a"), sessionDoc({ durationSeconds: 1500 })));
    await assertFails(setDoc(sess(t, "b"), sessionDoc({ participatingClassIds: ["4b", "5e", "6a", "6b"] })));
    await assertFails(setDoc(sess(t, "c"), sessionDoc({ gameMode: "annat_lage" })));
    await assertFails(setDoc(sess(t, "d"), sessionDoc({ gameMode: "plugga_quiz", answerKind: "free" })));
    await assertFails(setDoc(sess(t, "e"), sessionDoc({ counterShards: 4 })));
    await assertFails(setDoc(sess(t, "f"), sessionDoc({ stealSwap: "ja" })));
  });

  it("quiz: sessionen + frågorna + facit i SAMMA batch; utan facit nekas", async () => {
    const t = teacher();
    const b = writeBatch(t);
    b.set(sess(t, "q"), { ...sessionDoc({}, quizInput), questionCount: 2 });
    b.set(doc(t, "liveSessions", "q", "grPublic", "questions"), { questions: QUESTIONS });
    b.set(doc(t, "liveSessions", "q", "grPrivate", "snapshot"), { facit: FACIT });
    await assertSucceeds(b.commit());
    const b2 = writeBatch(t);
    b2.set(sess(t, "q2"), { ...sessionDoc({}, quizInput), questionCount: 2 });
    b2.set(doc(t, "liveSessions", "q2", "grPublic", "questions"), { questions: QUESTIONS });
    await assertFails(b2.commit());
    const b3 = writeBatch(t);
    b3.set(sess(t, "q3"), { ...sessionDoc({}, quizInput), questionCount: 3 });
    b3.set(doc(t, "liveSessions", "q3", "grPublic", "questions"), { questions: QUESTIONS });
    b3.set(doc(t, "liveSessions", "q3", "grPrivate", "snapshot"), { facit: FACIT });
    await assertFails(b3.commit(), "antalet måste stämma");
  });

  it("facit kan eleven aldrig läsa; frågorna (utan facit) kan alla inloggade läsa; ingen ändrar dem", async () => {
    await assertFails(getDoc(doc(elev("alma"), "liveSessions", "quiz", "grPrivate", "snapshot")));
    await assertSucceeds(getDoc(doc(teacher(), "liveSessions", "quiz", "grPrivate", "snapshot")));
    await assertSucceeds(getDoc(doc(elev("alma"), "liveSessions", "quiz", "grPublic", "questions")));
    await assertFails(setDoc(doc(teacher(), "liveSessions", "quiz", "grPrivate", "snapshot"), { facit: [{ answerIndex: 0 }, { answerIndex: 0 }] }));
    await assertFails(setDoc(doc(elev("alma"), "liveSessions", "quiz", "grPublic", "questions"), { questions: [] }));
  });
});

describe("Guldrushen: sessionens övergångar", () => {
  it("STARTA, endsAt exakt, avsluta, result en gång", async () => {
    const t = teacher();
    await assertSucceeds(updateDoc(sess(t, "lobby"), { status: "live", startedAt: serverTimestamp() }));
    const s = (await getDoc(sess(t, "lobby"))).data();
    const end = new Timestamp(s.startedAt.seconds + 4 + 600, s.startedAt.nanoseconds);
    await assertFails(updateDoc(sess(t, "lobby"), { endsAt: new Timestamp(end.seconds + 60, end.nanoseconds) }));
    await assertSucceeds(updateDoc(sess(t, "lobby"), { endsAt: end }));
    await assertSucceeds(updateDoc(sess(t, "pagar"), { status: "finished", finishedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(sess(t, "pagar"), { result: { format: "guldrush", totalGold: 10 } }));
    await assertFails(updateDoc(sess(t, "pagar"), { result: { format: "guldrush", totalGold: 99999 } }));
  });

  it("inställningarna är låsta (stöld & byte, speltid, spelläge) – namn i händelseflödet får ändras", async () => {
    const t = teacher();
    await assertFails(updateDoc(sess(t, "lobby"), { stealSwap: false }));
    await assertFails(updateDoc(sess(t, "pagar"), { durationSeconds: 1200 }));
    await assertFails(updateDoc(sess(t, "pagar"), { gameMode: "plugga_quiz" }));
    await assertFails(updateDoc(sess(t, "pagar"), { format: "klassmatch" }));
    await assertSucceeds(updateDoc(sess(t, "pagar"), { showNames: false }));
    await assertFails(updateDoc(sess(elev("alma"), "pagar"), { showNames: false }));
  });

  it("test 20: vem som helst avslutar efter 00:00, ingen före", async () => {
    await assertSucceeds(updateDoc(sess(elev("alma"), "slut"), { status: "finished", finishedAt: serverTimestamp() }));
    await assertFails(updateDoc(sess(elev("alma"), "pagar"), { status: "finished", finishedAt: serverTimestamp() }));
  });
});

describe("Guldrushen: eleven skriver inget guld (test 19)", () => {
  const multAnswer = (over = {}) => ({
    uid: "alma", classId: "4b", mode: "multiplication_0_10", factorA: 3, factorB: 4, answer: 12,
    correctAnswer: 12, isCorrect: true, shard: 0, at: serverTimestamp(), ...over,
  });

  it("eget (rätt) svar nekas – svaren skapar bara servern, även inom tiden", async () => {
    const a = elev("alma");
    const b = writeBatch(a);
    b.set(doc(a, "liveSessions", "pagar", "answers", "attempt-0001"), multAnswer());
    b.set(doc(a, "liveSessions", "pagar", "players", "alma"),
      { lastAttemptId: "attempt-0001", lastAt: serverTimestamp(), correct: 1, incorrect: 0 }, { merge: true });
    await assertFails(b.commit());
    await assertFails(setDoc(doc(a, "liveSessions", "pagar", "answers", "attempt-0002"), multAnswer()));
  });

  it("test 20: svar efter tiden nekas också", async () => {
    await assertFails(setDoc(doc(elev("alma"), "liveSessions", "slut", "answers", "attempt-0003"), multAnswer()));
  });

  it("kistan: eleven kan inte markera/ändra ett svar (chest) eller skapa en kista", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "liveSessions", "pagar", "answers", "srv-00001"), { ...multAnswer(), format: "guldrush", at: ts(-500) });
    });
    const a = elev("alma");
    await assertSucceeds(getDoc(doc(a, "liveSessions", "pagar", "answers", "srv-00001")));
    await assertFails(updateDoc(doc(a, "liveSessions", "pagar", "answers", "srv-00001"), { chest: "skattkammare" }));
  });

  it("guld, sköld, skydd, väntande stöld: varken skapa eller ändra (egen eller annans)", async () => {
    const a = elev("alma");
    const me = doc(a, "liveSessions", "pagar", "grPlayers", "alma");
    await assertFails(updateDoc(me, { gold: 10000 }));
    await assertFails(updateDoc(me, { shield: true }));
    await assertFails(updateDoc(me, { protectedUntil: ts(H) }));
    await assertFails(updateDoc(me, { pending: deleteField() }));
    await assertFails(setDoc(doc(a, "liveSessions", "pagar", "grPlayers", "bo"), { uid: "bo", gold: 0 }));
    await assertFails(setDoc(doc(elev("bo"), "liveSessions", "pagar", "grPlayers", "bo"), { uid: "bo", gold: 500 }));
    await assertFails(updateDoc(me, { gold: 10000 }), "inte läraren heller");
    await assertFails(updateDoc(doc(teacher(), "liveSessions", "pagar", "grPlayers", "alma"), { gold: 1 }));
  });

  it("händelser och ledaren: ingen klient skriver", async () => {
    const a = elev("alma");
    await assertFails(setDoc(doc(a, "liveSessions", "pagar", "grEvents", "fake"), { type: "chest", chest: "skattkammare", uid: "alma", amount: 100 }));
    await assertFails(updateDoc(doc(a, "liveSessions", "pagar", "grEvents", "e1"), { amount: 1000 }));
    await assertFails(setDoc(doc(a, "liveSessions", "pagar", "grMeta", "leader"), { uid: "alma", gold: 1e6 }));
    await assertFails(setDoc(doc(teacher(), "liveSessions", "pagar", "grEvents", "fake"), { type: "lead" }));
  });
});

describe("Guldrushen: läsning", () => {
  it("deltagare och lärare läser guld, händelser och ledaren; en elev som inte gått med gör det inte", async () => {
    for (const db of [elev("alma"), teacher()]) {
      await assertSucceeds(getDocs(collection(db, "liveSessions", "pagar", "grPlayers")));
      await assertSucceeds(getDocs(collection(db, "liveSessions", "pagar", "grEvents")));
      await assertSucceeds(getDoc(doc(db, "liveSessions", "pagar", "grMeta", "leader")));
    }
    await assertFails(getDocs(collection(elev("bo"), "liveSessions", "pagar", "grPlayers")));
    await assertFails(getDocs(collection(elev("bo"), "liveSessions", "pagar", "grEvents")));
  });

  it("sen anslutning: eleven går med under pågående match (kärnans spelardokument)", async () => {
    const b = elev("bo");
    await assertSucceeds(setDoc(doc(b, "liveSessions", "pagar", "players", "bo"), {
      uid: "bo", classId: "4b", name: "bo", joinedAt: serverTimestamp(), lastSeenAt: serverTimestamp(), correct: 0, incorrect: 0,
    }));
    await assertSucceeds(getDocs(collection(b, "liveSessions", "pagar", "grPlayers")));
  });
});
