// ============================================================================
// Regel-tester: Datakuppen (#652, epic Datakuppen) – firestore.rules "Datakuppen"
//   • skapa: inställningarna (hackning, speltid …) validerade och låsta; quiz →
//     frågorna (dkPublic) + facit (dkPrivate) i SAMMA batch, facit oläsbart
//   • STARTA / endsAt / avsluta / result en gång / auto-avslut efter 00:00
//   • test 3: ingen annan elev (och ingen lärare) läser elevens kod (dkSelf);
//     koder, lockkoder och strukna alternativ (dkSecret) läser ingen klient
//   • §2-attacker på regelnivå: skriva data direkt, skapa ett eget (rätt) svar,
//     svara efter tiden, skriva sin egen kod / sina hackkoder / händelser
//   • deltagare läser data/händelser, utomstående elever inte
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, writeBatch, serverTimestamp, Timestamp, deleteField,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { buildSessionDoc } from "../src/live/live-core.js";
import "../src/live/modes/index.js";

let testEnv, elev, teacher;
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);

const sessionDoc = (over = {}, inp = {}) => {
  const d = buildSessionDoc({
    name: "Datakuppen 4B", format: "datakuppen", gameMode: "multiplication_0_10", answerKind: "free",
    classIds: ["4b"], classNames: { "4b": "4B" }, durationMin: 10, hacking: true, showNames: true, ...inp,
  }, { uid: "larare1" });
  return { ...d, createdAt: serverTimestamp(), ...over };
};
const quizInput = { gameMode: "plugga_quiz", answerKind: "choice", quizArea: { subjectId: "so", areaId: "x", usable: 2 } };
const QUESTIONS = [
  { id: "q1", text: "Huvudstad?", options: ["Oslo", "Stockholm"], statKeys: ["ovrig", "q:q1"] },
  { id: "q2", text: "2+2?", options: ["4", "5"], statKeys: ["ovrig", "q:q2"] },
];
const FACIT = [{ answerIndex: 1 }, { answerIndex: 0 }];
const liveDoc = (ago = 60_000, over = {}) => ({ ...sessionDoc(), createdAt: ts(-H), status: "live", startedAt: ts(-ago), ...over });

const sess = (db, sid) => doc(db, "liveSessions", sid);
const sub = (db, sid, col, id) => doc(db, "liveSessions", sid, col, id);

before(async () => {
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-live-datakuppen"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

async function seed(sid, data, extra = async () => {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(sess(db, sid), data);
    for (const u of ["alma", "omar"]) {
      await setDoc(sub(db, sid, "players", u),
        { uid: u, classId: "4b", name: u, joinedAt: ts(-H), lastSeenAt: ts(-1000), correct: 0, incorrect: 0 });
      await setDoc(sub(db, sid, "dkPlayers", u), { uid: u, classId: "4b", name: u, gold: 100, protectedUntil: null, pending: null });
      await setDoc(sub(db, sid, "dkSelf", u), { uid: u, code: `kod-${u}`, codeVersion: 1, offers: null, hack: null });
      await setDoc(sub(db, sid, "dkSecret", u), { uid: u, code: `kod-${u}`, codeVersion: 1, hacks: {} });
    }
    await setDoc(sub(db, sid, "dkEvents", "e1"), { type: "chest", chest: "mapp", uid: "alma", amount: 25, at: ts(-1000) });
    await setDoc(sub(db, sid, "dkMeta", "leader"), { uid: "alma", gold: 100 });
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
    await setDoc(sub(db, "quiz", "dkPublic", "questions"), { questions: QUESTIONS });
    await setDoc(sub(db, "quiz", "dkPrivate", "snapshot"), { facit: FACIT });
  });
});

describe("Datakuppen: skapa sessionen (§3)", () => {
  it("läraren skapar en match (hackning på eller av); eleven kan inte", async () => {
    await assertSucceeds(setDoc(sess(teacher(), "ny"), sessionDoc()));
    await assertSucceeds(setDoc(sess(teacher(), "snall"), sessionDoc({}, { hacking: false })));
    await assertFails(setDoc(sess(elev("alma"), "ny2"), { ...sessionDoc(), createdBy: "alma" }));
  });

  it("test 17: speltid hela minuter 1–60 tas; 30 s / 61 min / 1,5 min / 0 nekas", async () => {
    const t = teacher();
    for (const m of [1, 3, 7, 30, 60]) await assertSucceeds(setDoc(sess(t, `m${m}`), sessionDoc({}, { durationMin: m })));
    for (const sek of [30, 3660, 90, 0]) await assertFails(setDoc(sess(t, `s${sek}`), sessionDoc({ durationSeconds: sek })));
  });

  it("ogiltiga inställningar nekas (4 klasser, annat spelläge, quiz med skriv själv, Guldrushens fält, fel typ)", async () => {
    const t = teacher();
    await assertFails(setDoc(sess(t, "b"), sessionDoc({ participatingClassIds: ["4b", "5e", "6a", "6b"] })));
    await assertFails(setDoc(sess(t, "c"), sessionDoc({ gameMode: "annat_lage" })));
    await assertFails(setDoc(sess(t, "d"), sessionDoc({ gameMode: "plugga_quiz", answerKind: "free" })));
    await assertFails(setDoc(sess(t, "e"), sessionDoc({ stealSwap: true })));
    await assertFails(setDoc(sess(t, "f"), sessionDoc({ hacking: "ja" })));
    await assertFails(setDoc(sess(t, "g"), sessionDoc({ status: "live" })));
  });

  it("quiz: sessionen + frågorna + facit i SAMMA batch; utan facit (eller i Guldrushens samling) nekas", async () => {
    const t = teacher();
    const b = writeBatch(t);
    b.set(sess(t, "q"), { ...sessionDoc({}, quizInput), questionCount: 2 });
    b.set(sub(t, "q", "dkPublic", "questions"), { questions: QUESTIONS });
    b.set(sub(t, "q", "dkPrivate", "snapshot"), { facit: FACIT });
    await assertSucceeds(b.commit());
    const b2 = writeBatch(t);
    b2.set(sess(t, "q2"), { ...sessionDoc({}, quizInput), questionCount: 2 });
    b2.set(sub(t, "q2", "dkPublic", "questions"), { questions: QUESTIONS });
    await assertFails(b2.commit());
    const b3 = writeBatch(t);
    b3.set(sess(t, "q3"), { ...sessionDoc({}, quizInput), questionCount: 2 });
    b3.set(sub(t, "q3", "grPublic", "questions"), { questions: QUESTIONS });
    b3.set(sub(t, "q3", "grPrivate", "snapshot"), { facit: FACIT });
    await assertFails(b3.commit(), "Guldrushens samlingar hör inte till Datakuppen");
  });

  it("facit kan eleven aldrig läsa; frågorna (utan facit) kan alla inloggade läsa; ingen ändrar dem", async () => {
    await assertFails(getDoc(sub(elev("alma"), "quiz", "dkPrivate", "snapshot")));
    await assertSucceeds(getDoc(sub(teacher(), "quiz", "dkPrivate", "snapshot")));
    await assertSucceeds(getDoc(sub(elev("alma"), "quiz", "dkPublic", "questions")));
    await assertFails(setDoc(sub(teacher(), "quiz", "dkPrivate", "snapshot"), { facit: [{ answerIndex: 0 }, { answerIndex: 0 }] }));
    await assertFails(setDoc(sub(elev("alma"), "quiz", "dkPublic", "questions"), { questions: [] }));
  });
});

describe("Datakuppen: sessionens övergångar", () => {
  it("STARTA, endsAt exakt, avsluta, result en gång", async () => {
    const t = teacher();
    await assertSucceeds(updateDoc(sess(t, "lobby"), { status: "live", startedAt: serverTimestamp() }));
    const s = (await getDoc(sess(t, "lobby"))).data();
    const end = new Timestamp(s.startedAt.seconds + 4 + 600, s.startedAt.nanoseconds);
    await assertFails(updateDoc(sess(t, "lobby"), { endsAt: new Timestamp(end.seconds + 60, end.nanoseconds) }));
    await assertSucceeds(updateDoc(sess(t, "lobby"), { endsAt: end }));
    await assertSucceeds(updateDoc(sess(t, "pagar"), { status: "finished", finishedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(sess(t, "pagar"), { result: { format: "datakuppen", totalGold: 10 } }));
    await assertFails(updateDoc(sess(t, "pagar"), { result: { format: "datakuppen", totalGold: 99999 } }));
  });

  it("inställningarna är låsta (hackning, speltid, spelläge, format) – namn i händelseflödet får ändras", async () => {
    const t = teacher();
    await assertFails(updateDoc(sess(t, "lobby"), { hacking: false }));
    await assertFails(updateDoc(sess(t, "pagar"), { hacking: false }));
    await assertFails(updateDoc(sess(t, "pagar"), { durationSeconds: 1200 }));
    await assertFails(updateDoc(sess(t, "pagar"), { gameMode: "plugga_quiz" }));
    await assertFails(updateDoc(sess(t, "pagar"), { format: "guldrush" }));
    await assertSucceeds(updateDoc(sess(t, "pagar"), { showNames: false }));
    await assertFails(updateDoc(sess(elev("alma"), "pagar"), { showNames: false }));
  });

  it("vem som helst avslutar efter 00:00, ingen före", async () => {
    await assertSucceeds(updateDoc(sess(elev("alma"), "slut"), { status: "finished", finishedAt: serverTimestamp() }));
    await assertFails(updateDoc(sess(elev("alma"), "pagar"), { status: "finished", finishedAt: serverTimestamp() }));
  });
});

describe("Datakuppen: koden är hemlig (test 3, §1.2)", () => {
  it("eleven läser sin egen kod; en annan elev, en utomstående och läraren gör det inte", async () => {
    await assertSucceeds(getDoc(sub(elev("alma"), "pagar", "dkSelf", "alma")));
    await assertFails(getDoc(sub(elev("omar"), "pagar", "dkSelf", "alma")));
    await assertFails(getDoc(sub(elev("bo"), "pagar", "dkSelf", "alma")));
    await assertFails(getDoc(sub(teacher(), "pagar", "dkSelf", "alma")));
  });

  it("ingen kan lista allas koder (samlingsfråga), inte ens med sin egen i svaret", async () => {
    await assertFails(getDocs(collection(elev("alma"), "liveSessions", "pagar", "dkSelf")));
    await assertFails(getDocs(query(collection(teacher(), "liveSessions", "pagar", "dkSelf"))));
  });

  it("koder, lockkoder och strukna alternativ (dkSecret): ingen klient läser – inte ens sitt eget eller läraren", async () => {
    await assertFails(getDoc(sub(elev("alma"), "pagar", "dkSecret", "alma")));
    await assertFails(getDoc(sub(elev("omar"), "pagar", "dkSecret", "alma")));
    await assertFails(getDoc(sub(teacher(), "pagar", "dkSecret", "alma")));
    await assertFails(getDocs(collection(teacher(), "liveSessions", "pagar", "dkSecret")));
  });

  it("§2: eleven kan inte skriva en egen påhittad kod, egna hackkoder eller strukna alternativ", async () => {
    const a = elev("alma");
    await assertFails(updateDoc(sub(a, "pagar", "dkSelf", "alma"), { code: "mittlosen123" }));
    await assertFails(setDoc(sub(a, "pagar", "dkSelf", "alma"), { code: "mittlosen123" }));
    await assertFails(setDoc(sub(elev("bo"), "lobby", "dkSelf", "bo"), { uid: "bo", code: "hemlis1234" }));
    await assertFails(updateDoc(sub(a, "pagar", "dkSelf", "alma"), { hack: { targetUid: "omar", options: ["kod-omar"] } }));
    await assertFails(setDoc(sub(a, "pagar", "dkSecret", "alma"), { hacks: { omar: { struck: [] } } }));
    await assertFails(setDoc(sub(teacher(), "pagar", "dkSecret", "alma"), { code: "x" }));
  });

  it("dkPlayers (det andra eleverna läser) innehåller ingen kod i seed-data och kan inte få någon av en klient", async () => {
    await assertFails(updateDoc(sub(elev("alma"), "pagar", "dkPlayers", "alma"), { code: "r0b0t" }));
  });
});

describe("Datakuppen: eleven skriver ingen data (§2)", () => {
  const multAnswer = (over = {}) => ({
    uid: "alma", classId: "4b", mode: "multiplication_0_10", factorA: 3, factorB: 4, answer: 12,
    correctAnswer: 12, isCorrect: true, shard: 0, at: serverTimestamp(), ...over,
  });

  it("öppna en fil utan rätt svar: eget (rätt) svar nekas – svaren skapar bara servern, även inom tiden", async () => {
    const a = elev("alma");
    const b = writeBatch(a);
    b.set(sub(a, "pagar", "answers", "attempt-0001"), multAnswer());
    b.set(sub(a, "pagar", "players", "alma"),
      { lastAttemptId: "attempt-0001", lastAt: serverTimestamp(), correct: 1, incorrect: 0 }, { merge: true });
    await assertFails(b.commit());
    await assertFails(setDoc(sub(a, "pagar", "answers", "attempt-0002"), multAnswer()));
  });

  it("svara efter att tiden tagit slut nekas också", async () => {
    await assertFails(setDoc(sub(elev("alma"), "slut", "answers", "attempt-0003"), multAnswer()));
  });

  it("filen: eleven kan inte markera/ändra ett svar (chest)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(sub(ctx.firestore(), "pagar", "answers", "srv-00001"), { ...multAnswer(), format: "datakuppen", at: ts(-500) });
    });
    const a = elev("alma");
    await assertSucceeds(getDoc(sub(a, "pagar", "answers", "srv-00001")));
    await assertFails(updateDoc(sub(a, "pagar", "answers", "srv-00001"), { chest: "serverhall" }));
  });

  it("skriva data direkt: data, skydd, väntande hack – varken skapa eller ändra (egen, annans, lärarens)", async () => {
    const a = elev("alma");
    const me = sub(a, "pagar", "dkPlayers", "alma");
    await assertFails(updateDoc(me, { gold: 10000 }));
    await assertFails(updateDoc(me, { protectedUntil: ts(H) }));
    await assertFails(updateDoc(me, { pending: { kind: "steal", chest: "hack" } }));
    await assertFails(updateDoc(me, { pending: deleteField() }));
    await assertFails(updateDoc(sub(a, "pagar", "dkPlayers", "omar"), { gold: 0 }));
    await assertFails(setDoc(sub(elev("bo"), "pagar", "dkPlayers", "bo"), { uid: "bo", gold: 500 }));
    await assertFails(updateDoc(sub(teacher(), "pagar", "dkPlayers", "alma"), { gold: 1 }));
  });

  it("händelser och ledaren: ingen klient skriver", async () => {
    const a = elev("alma");
    await assertFails(setDoc(sub(a, "pagar", "dkEvents", "fake"), { type: "steal", chest: "hack", uid: "alma", amount: 100 }));
    await assertFails(updateDoc(sub(a, "pagar", "dkEvents", "e1"), { amount: 1000 }));
    await assertFails(setDoc(sub(a, "pagar", "dkMeta", "leader"), { uid: "alma", gold: 1e6 }));
    await assertFails(setDoc(sub(teacher(), "pagar", "dkEvents", "fake"), { type: "lead" }));
  });
});

describe("Datakuppen: läsning", () => {
  it("deltagare och lärare läser data, händelser och ledaren; en elev som inte gått med gör det inte", async () => {
    for (const db of [elev("alma"), teacher()]) {
      await assertSucceeds(getDocs(collection(db, "liveSessions", "pagar", "dkPlayers")));
      await assertSucceeds(getDocs(collection(db, "liveSessions", "pagar", "dkEvents")));
      await assertSucceeds(getDoc(sub(db, "pagar", "dkMeta", "leader")));
    }
    await assertFails(getDocs(collection(elev("bo"), "liveSessions", "pagar", "dkPlayers")));
    await assertFails(getDocs(collection(elev("bo"), "liveSessions", "pagar", "dkEvents")));
  });

  it("läraren städar bort en match: underdokumenten får raderas av lärare, inte av elever", async () => {
    await assertFails(updateDoc(sub(elev("alma"), "lobby", "dkSelf", "alma"), { code: deleteField() }));
    await assertFails(deleteDoc(sub(elev("alma"), "lobby", "dkSelf", "alma")));
    await assertSucceeds(deleteDoc(sub(teacher(), "lobby", "dkSelf", "alma")));
    await assertSucceeds(deleteDoc(sub(teacher(), "lobby", "dkSecret", "alma")));
  });
});
