// ============================================================================
// Live räknas in i Mattematchen (#847) – de rena planerna utan emulator:
// planLiveMmWrites (klientens MM-del: tävling, period, klass, ankare) och
// Snilleblixtens sbMultRecord (frågans faktorer + elevens tal).
// Regelsidan: test/firestore-rules-mattematchen-live-847.test.js; servern:
// test/functions-mattematchen-live-847.test.mjs.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planLiveMmWrites, planMathAnswerWrites, MM_LIVE_ANKARE } from "../src/tavling/answer-writes.js";
import { sbMultRecord } from "../src/live/formats/snilleblixt/snilleblixt-flode.js";

const fv = { increment: (n) => ({ inc: n }), serverTimestamp: () => "TS" };
const NU = 1_800_000_000_000;
const H = 3600 * 1000;
const comp = (over = {}) => ({
  id: "mm1", status: "active", participatingClassIds: ["3a", "4b"], startAt: NU - H, endAt: NU + H, counterShards: 4, ...over,
});
const args = (over = {}) => ({
  competition: comp(), now: NU, uid: "alma", classId: "3a", name: "Alma", attemptId: "a123456789",
  record: { factorA: 7, factorB: 8, answer: 56, correctAnswer: 56 }, isCorrect: true, fv, rng: () => 0.99, ...over,
});

describe("planLiveMmWrites (#847)", () => {
  it("aktiv tävling + klassen deltar → MM:s fyra skrivningar med ankaret i liveAnswers, inga mynt", () => {
    const w = planLiveMmWrites(args());
    assert.deepEqual(w.map((x) => x.path.join("/")), [
      "mathCompetitions/mm1/liveAnswers/a123456789",
      "mathCompetitions/mm1/studentStats/alma",
      "mathCompetitions/mm1/scores/alma",
      "mathCompetitions/mm1/classCounters/3a_3",
    ]);
    assert.ok(!w.some((x) => x.path[0] === "studentData"));
    assert.equal(w[0].merge, false);
  });

  it("fel svar → ankare + studentStats (incorrect, w-tabeller)", () => {
    const w = planLiveMmWrites(args({ record: { factorA: 6, factorB: 9, answer: 55, correctAnswer: 54 }, isCorrect: false }));
    assert.equal(w.length, 2);
    assert.deepEqual(w[1].data.incorrect, { inc: 1 });
    assert.deepEqual([w[1].data.w6, w[1].data.w9], [{ inc: 1 }, { inc: 1 }]);
  });

  it("ingen tävling, pausad/avslutad/kommande, utanför perioden eller klassen deltar inte → []", () => {
    for (const over of [
      { competition: null }, { competition: comp({ status: "stopped" }) }, { competition: comp({ status: "finished" }) },
      { now: NU - 2 * H }, { now: NU + H }, { classId: "5e" }, { competition: comp({ participatingClassIds: undefined }) },
    ]) {
      assert.deepEqual(planLiveMmWrites(args(over)), [], JSON.stringify(over));
    }
  });

  it("ankaret kombineras aldrig med mynt; okänt ankare kastar", () => {
    const base = { competitionId: "mm1", attemptId: "a123456789", uid: "alma", classId: "3a", name: "A", record: args().record, isCorrect: true, shard: 0, fv };
    assert.throws(() => planMathAnswerWrites({ ...base, ankare: MM_LIVE_ANKARE, mynt: { dag: "2026-11-13" } }), /inga MM-mynt/);
    assert.throws(() => planMathAnswerWrites({ ...base, ankare: "annat" }), /okänt ankare/);
    assert.equal(planMathAnswerWrites(base)[0].path[2], "answers", "MM-sidan oförändrad");
  });
});

describe("sbMultRecord (#847, Snilleblixten)", () => {
  const s = (question, gameMode = "multiplication_0_10") => ({ gameMode, q: { index: 2, question } });
  it("skriv själv: faktorerna ur nyckeln 'i:7x8', talet rättas", () => {
    assert.deepEqual(sbMultRecord(s({ key: "2:7x8", text: "7 × 8" }), { answer: " 56 " }),
      { record: { factorA: 7, factorB: 8, answer: 56, correctAnswer: 56 }, isCorrect: true });
    assert.equal(sbMultRecord(s({ key: "2:7x8" }), { answer: "55" }).isCorrect, false);
    assert.equal(sbMultRecord(s({ key: "2:10x0" }), { answer: "0" }).isCorrect, true);
  });
  it("flerval: det valda alternativets tal", () => {
    const q = { key: "0:6x9", options: ["54", "56", "45", "63"] };
    assert.equal(sbMultRecord(s(q), { choiceIndex: 0 }).isCorrect, true);
    assert.deepEqual(sbMultRecord(s(q), { choiceIndex: 3 }).record, { factorA: 6, factorB: 9, answer: 63, correctAnswer: 54 });
  });
  it("quiz, tidslinje, ogiltigt tal, tabell > 10 eller saknad fråga → null", () => {
    assert.equal(sbMultRecord(s({ key: "q:abc" }, "plugga_quiz"), { choiceIndex: 0 }), null);
    assert.equal(sbMultRecord(s({ key: "2:7x8" }), { answer: "vet ej" }), null);
    assert.equal(sbMultRecord(s({ key: "2:11x3" }), { answer: "33" }), null);
    assert.equal(sbMultRecord({ gameMode: "multiplication_0_10" }, { answer: "1" }), null);
  });
});
