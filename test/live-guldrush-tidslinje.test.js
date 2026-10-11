// Enhetstester: tidslinjefrågor i Guldrushen (#601, epic #595) – frågepoolen
// (buildQuizPool), prepareCreate med/utan lärarens ruta (session.quiz.timeline)
// och att en Guldrush utan tidslinjefrågor blir exakt som förut.
// Serverns rättning: test/functions-guldrush-tidslinje.test.mjs.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { requireFormat } from "../src/live/formats/index.js";
import { requireGameMode } from "../src/live/modes/index.js";
import { buildSessionDoc } from "../src/live/live-core.js";
import { buildQuizSnapshot } from "../src/live/modes/plugga-quiz-core.js";
import { buildQuizPool } from "../src/live/formats/guldrush/guldrush-core.js";
import { seededRng } from "../src/mult/generator.js";
import { VASATIDEN_JSON } from "./fixtures/vasatiden-tidsjakt.js";

const AREA = JSON.parse(VASATIDEN_JSON);
const GR = requireFormat("guldrush");
const QUIZ = requireGameMode("plugga_quiz");
const input = (quizArea) => ({
  name: "Guldrushen 4B", format: "guldrush", gameMode: "plugga_quiz", answerKind: "choice",
  classIds: ["4b"], classNames: { "4b": "4B" }, durationMin: 10, stealSwap: true, showNames: true, quizArea,
});
const area = { subjectId: "so", areaId: "vasatiden", usable: 7 };

describe("Guldrushen: tidslinjefrågor i frågepoolen", () => {
  it("formatet visar quizväljarens ruta (timelineQuestions)", () => {
    assert.equal(GR.timelineQuestions, true);
  });

  it("buildQuizPool: tidslinjefrågor blandas in – span elevsynligt, årtalet bara i facit { year }", () => {
    const pool = buildQuizPool(QUIZ, AREA.quiz, buildQuizSnapshot, seededRng(2),
      { timeline: AREA.timeline, timelineSpan: AREA.timelineSpan });
    const tl = pool.questions.map((q, i) => [q, i]).filter(([q]) => q.kind === "timeline");
    assert.equal(tl.length, AREA.timeline.length);
    assert.ok(pool.questions.some((q) => q.kind !== "timeline"), "vanliga frågor finns kvar");
    for (const [q, i] of tl) {
      assert.ok(!("year" in q) && !("options" in q) && !("explanation" in q));
      assert.ok(Number.isInteger(q.span.min) && Number.isInteger(q.span.max));
      assert.equal(q.statKeys[0], "tidslinje");
      assert.deepEqual(Object.keys(pool.facit[i]), ["year"]);
      const ev = AREA.timeline.find((e) => q.id === `tl-${e.id}`);
      assert.equal(pool.facit[i].year, ev.year);
    }
    pool.questions.forEach((q, i) => {
      if (q.kind !== "timeline") assert.deepEqual(Object.keys(pool.facit[i]), ["answerIndex"]);
    });
  });

  it("prepareCreate: med lärarens ruta → tidslinjefrågor; utan → exakt som förut", async () => {
    const getArea = async () => AREA;
    const med = buildSessionDoc(input({ ...area, timeline: true }), { uid: "l1" });
    const utan = buildSessionDoc(input(area), { uid: "l1" });
    assert.equal(med.quiz.timeline, true);
    assert.ok(!("timeline" in utan.quiz), "fältet finns bara när rutan är på");
    const a = await GR.prepareCreate({}, med, { getArea, rng: seededRng(7) });
    const b = await GR.prepareCreate({}, utan, { getArea, rng: seededRng(7) });
    assert.equal(a.data.questionCount, b.data.questionCount + AREA.timeline.length);
    assert.equal(a.subdocs[0].data.questions.filter((q) => q.kind === "timeline").length, AREA.timeline.length);
    assert.ok(b.subdocs[0].data.questions.every((q) => q.kind !== "timeline"));
    // Utan rutan: samma ögonblicksbild som före #601 (gamla anropet, ingen timeline-opt).
    const old = buildQuizPool(QUIZ, AREA.quiz, buildQuizSnapshot, seededRng(7), { showPassage: false });
    assert.deepEqual(b.subdocs[0].data.questions, old.questions);
    assert.deepEqual(b.subdocs[1].data.facit, old.facit);
  });

  it("rutan på men området saknar händelser → vanliga frågor (inget fel)", async () => {
    const d = buildSessionDoc(input({ ...area, timeline: true }), { uid: "l1" });
    const out = await GR.prepareCreate({}, d, { getArea: async () => ({ ...AREA, timeline: [] }), rng: seededRng(1) });
    assert.ok(out.subdocs[0].data.questions.length > 0);
    assert.ok(out.subdocs[0].data.questions.every((q) => q.kind !== "timeline"));
  });
});
