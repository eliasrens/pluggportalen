// Enhetstester: tidslinjefrågor i Live (#600, epic #595) – plugga_quiz-
// ögonblicksbilden med områdets timeline[], svarets form per fråga
// (answer-writes.js) och Snilleblixtens rättning/poäng/svarsplan.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildQuizSnapshot, selectTimelineQuestions, prepareTimelineQuestion, summarizeQuizArea, quizAreaMessage,
  joinFacit, checkQuizAnswer, quizStatKeys,
} from "../src/live/modes/plugga-quiz-core.js";
import { requireGameMode } from "../src/live/modes/index.js";
import { requireFormat } from "../src/live/formats/index.js";
import { buildSessionDoc } from "../src/live/live-core.js";
import { questionAnswerKind, timelineAnswerError, answerShapeError, liveAnswerKindError } from "../src/tavling/answer-writes.js";
import { buildSnapshot } from "../src/live/formats/snilleblixt/snilleblixt-core.js";
import { scoreQuestion, isCorrectAnswer } from "../src/live/formats/snilleblixt/snilleblixt-poang.js";
import { planAnswer } from "../src/live/formats/snilleblixt/snilleblixt-flode.js";
import { seededRng } from "../src/mult/generator.js";
import { VASATIDEN_JSON } from "./fixtures/vasatiden-tidsjakt.js";

const AREA = JSON.parse(VASATIDEN_JSON);
const QUIZ = requireGameMode("plugga_quiz");
const SB = requireFormat("snilleblixt");
const fraga = (id) => ({ id, question: `Fråga ${id}?`, options: ["A", "B", "C", "D"], answerIndex: 1, explanation: "x" });
const QUIZ6 = ["a", "b", "c", "d", "e", "f"].map(fraga);
const fv = { serverTimestamp: () => "TS" };

describe("plugga_quiz: tidslinjefrågor i ögonblicksbilden", () => {
  it("utan timeline i opts: exakt som förut (inga kind, samma frågor)", () => {
    const a = buildQuizSnapshot(QUIZ6, { rng: seededRng(4) });
    const b = buildQuizSnapshot(QUIZ6, { rng: seededRng(4), timeline: null });
    assert.deepEqual(a, b);
    assert.ok(a.questions.every((q) => !("kind" in q)));
  });

  it("med timeline: blandade, kind timeline, elevsynligt utan årtal, årtalet bara i facit", () => {
    const { questions, facit } = buildQuizSnapshot(QUIZ6, { timeline: AREA.timeline, timelineSpan: AREA.timelineSpan, rng: seededRng(9) });
    assert.equal(questions.length, 11);
    const tl = questions.map((q, i) => [q, facit[i]]).filter(([q]) => q.kind === "timeline");
    assert.equal(tl.length, 5);
    for (const [q, f] of tl) {
      assert.deepEqual(Object.keys(q).sort(), ["description", "event", "id", "key", "kind", "span", "text"]);
      assert.deepEqual(q.span, { min: 1500, max: 1580 });
      assert.ok(!JSON.stringify(q).includes(String(f.year)), `${q.id} läcker årtalet`);
      assert.ok(q.id.startsWith("tl-"));
      assert.equal(f.id, q.id);
      assert.ok(Number.isInteger(f.year));
      assert.ok(!("options" in q) && !("answerIndex" in f));
    }
    // Inga dubbletter.
    assert.equal(new Set(questions.map((q) => q.id)).size, questions.length);
  });

  it("samma spann för varje fråga (hela området) – aldrig centrerat på svaret", () => {
    const { usable, span } = selectTimelineQuestions(AREA.timeline, null);
    assert.ok(usable.every((q) => q.span.min === span.min && q.span.max === span.max));
    assert.ok(usable.every((q) => q.year >= span.min && q.year <= span.max));
  });

  it("utan slumpning sprids tidslinjefrågorna jämnt bland quizfrågorna", () => {
    const { questions } = buildQuizSnapshot(QUIZ6, { shuffle: false, timeline: AREA.timeline.slice(0, 2) });
    assert.deepEqual(questions.map((q) => (q.kind === "timeline" ? "T" : "q")).join(""), "qqTqqqTq");
  });

  it("count skär efter blandningen; dubblett-text och ogiltiga hoppas över", () => {
    assert.equal(buildQuizSnapshot(QUIZ6, { count: 4, timeline: AREA.timeline }).questions.length, 4);
    const tl = [...AREA.timeline, { ...AREA.timeline[0], id: "x" }, { id: "y", question: "", year: 1530 }, { id: "z", question: "Q?", year: "1530" }];
    const r = selectTimelineQuestions(tl, AREA.timelineSpan);
    assert.equal(r.usable.length, 5);
    assert.deepEqual(r.skipped, { dubblett: 1, invalid: 2 });
    assert.equal(prepareTimelineQuestion(AREA.timeline[0], 0, { min: 1530, max: 1600 }).ok, false);
  });

  it("joinFacit, rättning: exakt år = rätt, ingen tolerans; utanför spannet ogiltigt", () => {
    const { questions, facit } = buildQuizSnapshot([], { timeline: AREA.timeline.slice(0, 1), timelineSpan: AREA.timelineSpan });
    const q = joinFacit(questions[0], facit[0]);
    assert.equal(q.year, 1520);
    assert.deepEqual(checkQuizAnswer(q, 1520), { valid: true, correct: true, given: 1520, correctAnswer: "1520" });
    assert.equal(checkQuizAnswer(q, 1521).correct, false);
    assert.equal(checkQuizAnswer(q, "1520").correct, true);
    assert.equal(checkQuizAnswer(q, 1499).valid, false);
    assert.equal(checkQuizAnswer(q, 1520.5).valid, false);
    assert.equal(checkQuizAnswer(questions[0], 1520).correct, null); // utan facit: formatet rättar
    assert.deepEqual(quizStatKeys(q), ["tidslinje", `q:${q.id}`]);
    assert.equal(QUIZ.choices(q), null);
    assert.deepEqual(QUIZ.answerRecord(q, checkQuizAnswer(q, 1520)), { questionId: q.id, year: 1520 });
  });

  it("lärarens rad räknar med tidslinjefrågorna; område med bara händelser är spelbart", () => {
    const s = summarizeQuizArea(QUIZ6, { timeline: AREA.timeline });
    assert.equal(s.usable, 11);
    assert.equal(s.timeline, 5);
    assert.match(quizAreaMessage(s).text, /11 frågor kan användas \(av 11 i området, varav 5 tidslinjefrågor\)/);
    assert.equal(summarizeQuizArea([], { timeline: AREA.timeline }).empty, false);
    assert.equal(summarizeQuizArea(QUIZ6).timeline, 0);
    assert.doesNotMatch(quizAreaMessage(summarizeQuizArea(QUIZ6)).text, /tidslinje/);
  });

  it("sessionsfältet quiz.timeline finns BARA när rutan är på", () => {
    const input = (extra) => ({
      name: "SB", format: "snilleblixt", gameMode: "plugga_quiz", answerKind: "choice", classIds: ["4b"],
      questionCount: 10, questionSeconds: 20, quizArea: { subjectId: "so", areaId: "v", usable: 3, ...extra },
    });
    assert.equal(buildSessionDoc(input({}), { uid: "l" }).quiz.timeline, undefined);
    assert.ok(!("timeline" in buildSessionDoc(input({ timeline: false }), { uid: "l" }).quiz));
    assert.equal(buildSessionDoc(input({ timeline: true }), { uid: "l" }).quiz.timeline, true);
    assert.equal(SB.timelineQuestions, true);
  });
});

describe("answer-writes: svarets form per fråga", () => {
  const span = { min: 1500, max: 1580 };
  it("questionAnswerKind: tidslinjefråga åsidosätter sessionens, allt annat oförändrat", () => {
    assert.equal(questionAnswerKind({ kind: "timeline" }, "choice"), "timeline");
    assert.equal(questionAnswerKind({ options: [] }, "choice"), "choice");
    assert.equal(questionAnswerKind(undefined, "free"), "free");
  });
  it("timelineAnswerError: heltal inom spannet", () => {
    assert.equal(timelineAnswerError(1500, span), null);
    assert.equal(timelineAnswerError(1580, span), null);
    for (const y of [1499, 1581, 1520.5, "1520", null, undefined]) assert.ok(timelineAnswerError(y, span), String(y));
    assert.ok(timelineAnswerError(1520, null));
  });
  it("answerShapeError: fel form för frågans kind nekas", () => {
    assert.equal(answerShapeError({ kind: "timeline", year: 1520, span }), null);
    assert.ok(answerShapeError({ kind: "timeline", choiceIndex: 0, span }));
    assert.ok(answerShapeError({ kind: "timeline", year: 1520, choiceIndex: 0, span }));
    assert.ok(answerShapeError({ kind: "choice", year: 1520 }));
    assert.equal(answerShapeError({ kind: "choice", choiceIndex: 3 }), null);
    assert.ok(answerShapeError({ kind: "free", answer: "56", year: 1 }));
    assert.equal(answerShapeError({ kind: "free", answer: "56" }), null);
    assert.ok(answerShapeError({ kind: "x" }));
    // Det gamla kontraktet är orört.
    assert.equal(liveAnswerKindError("choice", 2), null);
    assert.ok(liveAnswerKindError("timeline", undefined));
  });
});

describe("Snilleblixten: tidslinjefrågor", () => {
  const snap = buildSnapshot(QUIZ, {
    answerKind: "choice", count: 0, shuffle: false, quiz: QUIZ6, timeline: AREA.timeline, timelineSpan: AREA.timelineSpan,
    quizSnapshot: buildQuizSnapshot,
  });
  const i = snap.questions.findIndex((q) => q.kind === "timeline");

  it("buildSnapshot: facit { year, correctAnswer, explanation }, statKeys tidslinje", () => {
    assert.equal(snap.questions.length, 11);
    assert.equal(snap.facit[i].correctAnswer, String(snap.facit[i].year));
    assert.ok(typeof snap.facit[i].explanation === "string");
    assert.equal(snap.questions[i].statKeys[0], "tidslinje");
    assert.ok(!("year" in snap.questions[i]));
  });

  it("utan quiz.timeline: ögonblicksbilden exakt som förut", () => {
    const base = { answerKind: "choice", count: 0, quiz: QUIZ6, quizSnapshot: buildQuizSnapshot };
    assert.deepEqual(buildSnapshot(QUIZ, { ...base, rng: seededRng(5) }), buildSnapshot(QUIZ, { ...base, rng: seededRng(5), timeline: undefined }));
  });

  it("prepareCreate tar bara med händelserna när quiz.timeline är på", async () => {
    const getArea = async () => AREA;
    const data = (timeline) => ({ gameMode: "plugga_quiz", answerKind: "choice", questionCount: 0, shuffleQuestions: true,
      quiz: { subjectId: "so", areaId: "v", showPassage: true, ...(timeline ? { timeline: true } : {}) } });
    const med = await SB.prepareCreate({}, data(true), { getArea, rng: seededRng(1) });
    const utan = await SB.prepareCreate({}, data(false), { getArea, rng: seededRng(1) });
    assert.equal(med.data.questionCount, 7);
    assert.equal(utan.data.questionCount, 2);
    assert.ok(utan.subdocs[0].data.questions.every((q) => q.kind !== "timeline"));
  });

  const T0 = 1_700_000_000_000;
  const q = { index: i, phase: "closed", openedAt: T0, closedAt: T0 + 15_000, question: snap.questions[i] };
  const facit = snap.facit[i];
  const Y = facit.year;

  it("rättning: exakt år = rätt; servertidspoäng oförändrad; spridningen sorterad, utan namn", () => {
    const sc = scoreQuestion({
      q, facit, questionSeconds: 20, answerKind: "choice",
      answers: [
        { uid: "a", q: i, at: T0 + 4000, answerKind: "timeline", year: Y },
        { uid: "b", q: i, at: T0 + 1000, answerKind: "timeline", year: Y + 1 },
        { uid: "c", q: i, at: T0 + 2000, answerKind: "timeline", year: Y - 7 },
        { uid: "d", q: i, at: T0 + 16_000, answerKind: "timeline", year: Y }, // efter stängning
      ],
    });
    assert.deepEqual(sc.points, { a: 900, b: 0, c: 0 });
    assert.equal(sc.correctCount, 1);
    assert.deepEqual(sc.guesses, [Y - 7, Y, Y + 1]);
    assert.ok(!("choiceCounts" in sc) && !("topWrong" in sc));
    assert.ok(isCorrectAnswer({ year: Y }, facit, "timeline"));
    assert.ok(!isCorrectAnswer({ year: String(Y) }, facit, "timeline"));
  });

  it("flervalsfrågan i samma match rättas som förut (choiceCounts, inga guesses)", () => {
    const j = snap.questions.findIndex((x) => x.kind !== "timeline");
    const sc = scoreQuestion({
      q: { ...q, index: j, question: snap.questions[j] }, facit: snap.facit[j], questionSeconds: 20, answerKind: "choice",
      answers: [{ uid: "a", q: j, at: T0 + 4000, choiceIndex: snap.facit[j].answerIndex }],
    });
    assert.equal(sc.points.a, 900);
    assert.equal(sc.choiceCounts.length, 4);
    assert.ok(!("guesses" in sc));
  });

  it("planAnswer: year + answerKind timeline; fel form kastar", () => {
    const s = { answerKind: "choice", q: { ...q, phase: "open" } };
    const w = planAnswer({ sid: "s1", s, uid: "a", classId: "4b", year: Y, fv });
    assert.deepEqual(w.data, { uid: "a", classId: "4b", q: i, answerKind: "timeline", at: "TS", year: Y });
    assert.throws(() => planAnswer({ sid: "s1", s, uid: "a", classId: "4b", choiceIndex: 0, fv }));
    assert.throws(() => planAnswer({ sid: "s1", s, uid: "a", classId: "4b", year: 1400, fv }));
  });
});

describe("Projektorn: spridningen och demot", async () => {
  const { spreadBins } = await import("../src/timeline/timeline-spread.js");
  const { spreadText, revealInfo } = await import("../src/live/formats/snilleblixt/sb-scen.js");
  const { demoSnapshot, createSbDemo } = await import("../src/live/formats/snilleblixt/sb-demo.js");

  it("spreadBins: årssteg efter spannets bredd, antal per grupp", () => {
    assert.deepEqual(spreadBins([1520, 1520, 1523, 1559], { min: 1500, max: 1580 }), {
      size: 2, bins: [{ from: 1520, to: 1521, n: 2 }, { from: 1522, to: 1523, n: 1 }, { from: 1558, to: 1559, n: 1 }],
    });
    assert.equal(spreadBins([1], { min: -3000, max: 2000 }).size, 100);
    assert.deepEqual(spreadBins([], { min: 0, max: 50 }).bins, []);
  });

  it("spreadText och revealInfo: rätt år + anonym spridning, per fråga", () => {
    assert.equal(spreadText([1530, 1515, 1527]), "Gissningarna: 1515–1530, mitten 1527");
    assert.equal(spreadText([1527, 1527]), "Alla gissade 1527");
    assert.equal(spreadText([]), "");
    const q = { question: { kind: "timeline", span: { min: 1500, max: 1580 } }, facit: { year: 1527, correctAnswer: "1527" } };
    const info = revealInfo(q, { answered: 3, correctCount: 1, guesses: [1530, 1527, 1515] }, "choice");
    assert.equal(info.kind, "timeline");
    assert.equal(info.correctYear, 1527);
    assert.deepEqual(info.guesses, [1515, 1527, 1530]);
    assert.equal(info.share, 33);
    assert.equal(revealInfo({ question: { options: ["a", "b"] }, facit: { answerIndex: 0 } }, null, "choice").kind, "choice");
  });

  it("demot: varannan fråga är en tidslinjefråga och hela matchen går att spela", () => {
    const snap = demoSnapshot("choice", "tidslinje");
    assert.equal(snap.questions.filter((q) => q.kind === "timeline").length, 5);
    assert.ok(snap.questions.every((q, i) => q.kind !== "timeline" || !JSON.stringify(q).includes(String(snap.facit[i].year))));
    const demo = createSbDemo({ fragor: "tidslinje", auto: false, rng: seededRng(2) });
    try {
      demo.jumpToFinal();
      const { scores, session } = demo.state();
      assert.equal(session.status, "finished");
      const tl = scores.find((s) => snap.questions[s.index].kind === "timeline");
      assert.ok(tl.guesses.length > 0 && tl.correctCount > 0);
    } finally {
      demo.destroy();
    }
  });
});
