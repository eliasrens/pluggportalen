// ============================================================================
// Regel-tester: Guldrushen med tidslinjefrågor (#601, epic #595)
//   • quiz med session.quiz.timeline: sessionen + grPublic (kind "timeline",
//     span, inget årtal) + grPrivate (facit { year }) i SAMMA batch
//   • facit (årtalet) kan eleven aldrig läsa
//   • eleven kan inte skapa ett eget tidslinjesvar (bara servern) och inte
//     byta årtalet i ett låst (serverskapat) svar – inte heller ändra spannet
// Rättningen/formen prövas i servern: test/functions-guldrush-tidslinje.test.mjs.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, writeBatch, serverTimestamp, Timestamp } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { buildSessionDoc } from "../src/live/live-core.js";
import "../src/live/modes/index.js";

let testEnv, elev, teacher;
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
const SPAN = { min: 1500, max: 1600 };

const quizArea = { subjectId: "so", areaId: "vasatiden", usable: 2, timeline: true };
const sessionDoc = (over = {}) => ({
  ...buildSessionDoc({
    name: "Guldrushen 4B", format: "guldrush", gameMode: "plugga_quiz", answerKind: "choice",
    classIds: ["4b"], classNames: { "4b": "4B" }, durationMin: 10, stealSwap: true, showNames: true, quizArea,
  }, { uid: "larare1" }),
  questionCount: 2, createdAt: serverTimestamp(), ...over,
});
const QUESTIONS = [
  { id: "q1", key: "0:q1", text: "Huvudstad?", options: ["Oslo", "Stockholm"], statKeys: ["ovrig", "q:q1"] },
  { id: "tl-blodbad", key: "1:tl-blodbad", kind: "timeline", text: "Vilket år var Stockholms blodbad?",
    event: "Stockholms blodbad", span: SPAN, statKeys: ["tidslinje", "q:tl-blodbad"] },
];
const FACIT = [{ answerIndex: 1 }, { year: 1520 }];
const sess = (db, sid) => doc(db, "liveSessions", sid);
const tlAnswer = (over = {}) => ({
  uid: "alma", classId: "4b", mode: "plugga_quiz", answerKind: "timeline", q: 1, questionId: "tl-blodbad",
  year: 1520, answer: "1520", correctAnswer: "1520", correctYear: 1520, isCorrect: true,
  statKeys: ["tidslinje", "q:tl-blodbad"], format: "guldrush", at: serverTimestamp(), ...over,
});

before(async () => {
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-live-guldrush-tl"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "4b"), { name: "4B", studentIds: ["alma", "bo"] });
    await setDoc(sess(db, "tl"), { ...sessionDoc(), createdAt: ts(-H), status: "live", startedAt: ts(-60_000) });
    await setDoc(doc(db, "liveSessions", "tl", "players", "alma"),
      { uid: "alma", classId: "4b", name: "alma", joinedAt: ts(-H), lastSeenAt: ts(-1000), correct: 0, incorrect: 0 });
    await setDoc(doc(db, "liveSessions", "tl", "grPublic", "questions"), { questions: QUESTIONS });
    await setDoc(doc(db, "liveSessions", "tl", "grPrivate", "snapshot"), { facit: FACIT });
    await setDoc(doc(db, "liveSessions", "tl", "answers", "srv-tl-0001"), { ...tlAnswer(), year: 1519, isCorrect: false, at: ts(-500) });
  });
});

describe("Guldrushen + tidslinjefrågor: skapa", () => {
  it("quiz.timeline + tidslinjefråga (span, utan årtal) + facit { year } i SAMMA batch", async () => {
    const t = teacher();
    const b = writeBatch(t);
    b.set(sess(t, "ny"), sessionDoc());
    b.set(doc(t, "liveSessions", "ny", "grPublic", "questions"), { questions: QUESTIONS });
    b.set(doc(t, "liveSessions", "ny", "grPrivate", "snapshot"), { facit: FACIT });
    await assertSucceeds(b.commit());
    const s = (await getDoc(sess(t, "ny"))).data();
    if (s.quiz.timeline !== true) throw new Error("quiz.timeline ska sparas");
  });

  it("årtalet (facit) kan eleven aldrig läsa; frågan med spannet kan hon läsa men inte ändra", async () => {
    const a = elev("alma");
    await assertFails(getDoc(doc(a, "liveSessions", "tl", "grPrivate", "snapshot")));
    await assertSucceeds(getDoc(doc(a, "liveSessions", "tl", "grPublic", "questions")));
    const wide = QUESTIONS.map((q) => (q.kind === "timeline" ? { ...q, span: { min: 1520, max: 1520 } } : q));
    await assertFails(setDoc(doc(a, "liveSessions", "tl", "grPublic", "questions"), { questions: wide }));
  });
});

describe("Guldrushen + tidslinjefrågor: eleven skriver inget svar", () => {
  it("eget (rätt) tidslinjesvar nekas – bara servern skapar svar", async () => {
    const a = elev("alma");
    await assertFails(setDoc(doc(a, "liveSessions", "tl", "answers", "attempt-tl-01"), tlAnswer()));
    await assertFails(setDoc(doc(a, "liveSessions", "tl", "answers", "attempt-tl-02"), tlAnswer({ answerKind: "choice", choiceIndex: 1 })));
  });

  it("ett låst svar: årtalet (eller rätt/fel) går inte att byta efteråt", async () => {
    const a = elev("alma");
    const ref = doc(a, "liveSessions", "tl", "answers", "srv-tl-0001");
    await assertSucceeds(getDoc(ref));
    await assertFails(updateDoc(ref, { year: 1520 }));
    await assertFails(updateDoc(ref, { isCorrect: true }));
    await assertFails(setDoc(ref, tlAnswer()));
  });
});
