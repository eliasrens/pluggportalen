// ============================================================================
// Regel-tester: Snilleblixten med TIDSLINJEFRÅGOR (#600, epic #595) –
// firestore.rules "Snilleblixten" (sbQuestionKind/sbAnswerKindOk).
//   • quiz-session med tidslinjefrågor inblandade skapas som vanligt
//   • eleven läser aldrig årtalet före avslöjandet (sbPrivate, q.question)
//   • tidslinjesvar: BARA year, heltal inom frågans spann – allt annat nekas
//   • fel form för frågans kind nekas åt båda hållen (choiceIndex på en
//     tidslinjefråga, year på en flervalsfråga, fel answerKind)
//   • hela flödet: öppna → svar → stäng → avslöja → sbScores med guesses
// Planerna är klientens egna (snilleblixt-flode.js planStep/planAnswer).
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  collection, doc, getDoc, getDocs, query, runTransaction, setDoc, where, writeBatch, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { buildSessionDoc } from "../src/live/live-core.js";
import { requireGameMode } from "../src/live/modes/index.js";
import { buildQuizSnapshot } from "../src/live/modes/plugga-quiz-core.js";
import { seededRng } from "../src/mult/generator.js";
import { buildSnapshot } from "../src/live/formats/snilleblixt/snilleblixt-core.js";
import { planStep, planAnswer } from "../src/live/formats/snilleblixt/snilleblixt-flode.js";
import { VASATIDEN_JSON } from "./fixtures/vasatiden-tidsjakt.js";

let testEnv, elev, teacher;
const fv = { serverTimestamp };
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
const QUIZ = requireGameMode("plugga_quiz");
const AREA = JSON.parse(VASATIDEN_JSON);
const quizArea = { subjectId: "so", areaId: "vasatiden", subjectName: "SO", areaName: "Vasatiden", usable: 7, timeline: true };

const sessionDoc = (over = {}) => ({
  ...buildSessionDoc({
    name: "Snilleblixten 4B", format: "snilleblixt", gameMode: "plugga_quiz", answerKind: "choice",
    classIds: ["4b"], classNames: { "4b": "4B" }, questionCount: 0, questionSeconds: 20,
    shuffleQuestions: false, showQuestionOnStudent: true, quizArea,
  }, { uid: "larare1" }),
  createdAt: ts(-2 * H),
  ...over,
});
// Ingen slumpning: områdets 2 quizfrågor + 5 händelser, jämnt inblandade.
const SNAP = buildSnapshot(QUIZ, {
  answerKind: "choice", count: 0, shuffle: false, quiz: AREA.quiz, showPassage: true,
  timeline: AREA.timeline, timelineSpan: AREA.timelineSpan, quizSnapshot: buildQuizSnapshot, rng: seededRng(3),
});
const N = SNAP.questions.length;
const TL = SNAP.questions.findIndex((q) => q.kind === "timeline");
const CH = SNAP.questions.findIndex((q) => q.kind !== "timeline");
const qOpen = (i, ago = 2000) => ({ index: i, phase: "open", openedAt: ts(-ago), question: SNAP.questions[i] });
const live = (q) => sessionDoc({ status: "live", startedAt: ts(-10 * 60 * 1000), questionCount: N, ...(q ? { q } : {}) });

const sess = (db, sid) => doc(db, "liveSessions", sid);
const priv = (db, sid) => doc(db, "liveSessions", sid, "sbPrivate", "snapshot");

before(async () => {
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-live-sb-tidslinje"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

async function seed(sid, data, players = { alma: -H, bo: -H }) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(sess(db, sid), data);
    await setDoc(priv(db, sid), SNAP);
    for (const [uid, joined] of Object.entries(players)) {
      await setDoc(doc(db, "liveSessions", sid, "players", uid),
        { uid, classId: "4b", name: uid, joinedAt: ts(joined), lastSeenAt: ts(-1000), correct: 0, incorrect: 0 });
    }
  });
}

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "4b"), { name: "4B", studentIds: ["alma", "bo"] });
    for (const u of ["alma", "bo"]) await setDoc(doc(db, "students", u), { namn: u });
  });
  await seed("tl", live(qOpen(TL)));
  await seed("val", live(qOpen(CH)));
  await seed("lobby", sessionDoc({ questionCount: N }));
});

const svar = (db, sid, s, uid, extra) => {
  const w = planAnswer({ sid, s, uid, classId: "4b", fv, ...extra });
  return setDoc(doc(db, ...w.path), w.data);
};
// Rått svarsdokument (förbi planen – reglerna ska neka det själva).
const raw = (db, sid, i, uid, data) => setDoc(doc(db, "liveSessions", sid, "sbAnswers", `${i}_${uid}`),
  { uid, classId: "4b", q: i, at: serverTimestamp(), ...data });

describe("Snilleblixten + tidslinje: ögonblicksbilden", () => {
  it("blandad: tidslinjefrågor med kind/span, årtalet bara i facit", () => {
    assert.equal(N, 7);
    assert.ok(TL >= 0 && CH >= 0);
    for (const [i, q] of SNAP.questions.entries()) {
      if (q.kind !== "timeline") continue;
      assert.deepEqual(q.span, { min: 1500, max: 1580 });
      assert.ok(!("year" in q));
      assert.ok(!JSON.stringify(q).includes(String(SNAP.facit[i].year)), `fråga ${i} läcker årtalet`);
      assert.equal(SNAP.facit[i].correctAnswer, String(SNAP.facit[i].year));
    }
  });

  it("sessionen (quiz.timeline) + ögonblicksbilden skapas i samma batch", async () => {
    const t = teacher();
    const b = writeBatch(t);
    b.set(sess(t, "ny"), { ...sessionDoc({ questionCount: N }), createdAt: serverTimestamp() });
    b.set(priv(t, "ny"), SNAP);
    await assertSucceeds(b.commit());
    assert.equal((await getDoc(sess(t, "ny"))).data().quiz.timeline, true);
  });

  it("eleven läser inte facit; den öppna frågan har inget årtal", async () => {
    await assertFails(getDoc(priv(elev("alma"), "tl")));
    const q = (await getDoc(sess(elev("alma"), "tl"))).data().q;
    assert.equal(q.question.kind, "timeline");
    assert.ok(!("facit" in q) && !("year" in q.question));
  });
});

describe("Snilleblixten + tidslinje: svar", () => {
  const S = () => live(qOpen(TL));

  it("ett heltalsår inom spannet godtas – även kanterna", async () => {
    await assertSucceeds(svar(elev("alma"), "tl", S(), "alma", { year: 1500 }));
    await assertSucceeds(svar(elev("bo"), "tl", S(), "bo", { year: 1580 }));
  });

  it("dubbelsvar nekas", async () => {
    await assertSucceeds(svar(elev("alma"), "tl", S(), "alma", { year: 1523 }));
    await assertFails(raw(elev("alma"), "tl", TL, "alma", { answerKind: "timeline", year: 1524 }));
  });

  it("år utanför spannet, decimaltal och text nekas", async () => {
    for (const year of [1499, 1581, 1520.5, "1520", null]) {
      await assertFails(raw(elev("alma"), "tl", TL, "alma", { answerKind: "timeline", year }));
    }
  });

  it("fel form för frågans kind nekas: choiceIndex/answer/answerKind på en tidslinjefråga", async () => {
    await assertFails(raw(elev("alma"), "tl", TL, "alma", { answerKind: "choice", choiceIndex: 0 }));
    await assertFails(raw(elev("alma"), "tl", TL, "alma", { answerKind: "timeline", choiceIndex: 0 }));
    await assertFails(raw(elev("alma"), "tl", TL, "alma", { answerKind: "timeline", year: 1520, choiceIndex: 0 }));
    await assertFails(raw(elev("alma"), "tl", TL, "alma", { answerKind: "timeline", year: 1520, answer: "1520" }));
    await assertFails(raw(elev("alma"), "tl", TL, "alma", { answerKind: "choice", year: 1520 }));
    await assertFails(raw(elev("alma"), "tl", TL, "alma", { answerKind: "free", answer: "1520" }));
    await assertFails(raw(elev("alma"), "tl", TL, "alma", { answerKind: "timeline", year: 1520, isCorrect: true }));
  });

  it("flervalsfrågan i samma session: som förut – och tidslinjesvar nekas där", async () => {
    await assertFails(raw(elev("bo"), "val", CH, "bo", { answerKind: "timeline", year: 1520 }));
    await assertFails(raw(elev("bo"), "val", CH, "bo", { answerKind: "choice", choiceIndex: 0, year: 1520 }));
    await assertSucceeds(svar(elev("alma"), "val", live(qOpen(CH)), "alma", { choiceIndex: 1 }));
  });

  it("planAnswer vägrar fel form redan i klienten", () => {
    assert.throws(() => planAnswer({ sid: "tl", s: S(), uid: "alma", classId: "4b", fv, choiceIndex: 1 }));
    assert.throws(() => planAnswer({ sid: "tl", s: S(), uid: "alma", classId: "4b", fv, year: 1600 }));
    assert.throws(() => planAnswer({ sid: "tl", s: S(), uid: "alma", classId: "4b", fv, year: 1520.5 }));
  });
});

async function step(db, sid, action, fromIndex) {
  const answers = action === "reveal" || action === "skip"
    ? (await getDocs(query(collection(db, "liveSessions", sid, "sbAnswers"), where("q", "==", fromIndex)))).docs.map((d) => d.data())
    : [];
  return runTransaction(db, async (tx) => {
    const s = (await tx.get(sess(db, sid))).data();
    const snapshot = action === "open" || action === "reveal" ? (await tx.get(priv(db, sid))).data() : null;
    const plan = planStep(s, action, { fromIndex, snapshot, answers, fv });
    if (plan.noop) return { done: false, reason: plan.noop };
    tx.update(sess(db, sid), plan.patch);
    if (plan.scores) tx.set(doc(db, "liveSessions", sid, "sbScores", String(plan.scores.index)), plan.scores);
    return { done: true };
  });
}

describe("Snilleblixten + tidslinje: flödet", () => {
  it("öppna → svar → stäng → avslöja: exakt år = rätt (500–1000), annars 0; spridningen utan namn", async () => {
    const t = teacher();
    // Ställ sessionen precis före tidslinjefrågan (föregående avslöjad).
    await testEnv.withSecurityRulesDisabled((ctx) => setDoc(sess(ctx.firestore(), "tl"),
      live(TL === 0 ? null : { ...qOpen(TL - 1, 30_000), phase: "revealed", closedAt: ts(-9000), facit: SNAP.facit[TL - 1] })));
    assert.deepEqual(await step(t, "tl", "open", TL - 1), { done: true });
    const s = (await getDoc(sess(elev("alma"), "tl"))).data();
    assert.equal(s.q.index, TL);
    const year = SNAP.facit[TL].year;
    await assertSucceeds(svar(elev("alma"), "tl", s, "alma", { year }));
    await assertSucceeds(svar(elev("bo"), "tl", s, "bo", { year: year + 3 }));
    assert.deepEqual(await step(t, "tl", "close", TL), { done: true });
    assert.deepEqual(await step(t, "tl", "reveal", TL), { done: true });
    const sc = (await getDoc(doc(elev("bo"), "liveSessions", "tl", "sbScores", String(TL)))).data();
    assert.ok(sc.points.alma >= 900 && sc.points.alma <= 1000, `alma ${sc.points.alma}`);
    assert.equal(sc.points.bo, 0);
    assert.deepEqual(sc.correct, { alma: true, bo: false });
    assert.deepEqual(sc.guesses, [year, year + 3]);
    assert.ok(!("choiceCounts" in sc) && !("topWrong" in sc));
    const facit = (await getDoc(sess(elev("alma"), "tl"))).data().q.facit;
    assert.equal(facit.year, year);
  });
});
