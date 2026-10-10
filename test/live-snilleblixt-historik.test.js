// #560 – Snilleblixten: historikens siffror (andel rätt per fråga, per
// tabell via statKeys, pallplats, elev × fråga) och det isolerade demoläget.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildResult, scoreQuestion } from "../src/live/formats/snilleblixt/snilleblixt-poang.js";
import {
  questionRates, hardestQuestions, categoryRates, podiumGroups, playerCounts, answerMatrix,
} from "../src/live/formats/snilleblixt/sb-historik-data.js";
import { createSbDemo, demoOutfit, demoMembers, DEMO_NAMES } from "../src/live/formats/snilleblixt/sb-demo.js";

const S = { id: "x", format: "snilleblixt", participatingClassIds: ["a", "b"], questionSeconds: 10, answerKind: "choice" };
const PLAYERS = [
  { uid: "u1", name: "Alma", classId: "a" }, { uid: "u2", name: "Bo", classId: "a" }, { uid: "u3", name: "Cia", classId: "b" },
];
const SCORES = [
  { index: 0, skipped: false, answered: 3, correctCount: 3, points: { u1: 900, u2: 800, u3: 700 }, correct: { u1: true, u2: true, u3: true } },
  { index: 1, skipped: false, answered: 3, correctCount: 1, points: { u1: 0, u2: 0, u3: 950 }, correct: { u1: false, u2: false, u3: true } },
  { index: 2, skipped: true, answered: 1, correctCount: 0, points: {}, correct: {} },
  { index: 3, skipped: false, answered: 2, correctCount: 1, points: { u1: 600, u2: 0 }, correct: { u1: true, u2: false } },
];
const QUESTIONS = [
  { text: "7 × 8", statKeys: ["t7", "t8"] }, { text: "6 × 7", statKeys: ["t6", "t7"] },
  { text: "9 × 4", statKeys: ["t9", "t4"] }, { text: "8 × 8", statKeys: ["t8"] },
];
const CATS = [4, 6, 7, 8, 9].map((n) => ({ key: `t${n}`, label: `${n}:ans tabell` }));

describe("#560 buildResult – andel rätt per fråga", () => {
  const r = buildResult(S, [], PLAYERS, null, { scores: SCORES, questions: QUESTIONS });
  it("perQuestion har text, statKeys och byClass", () => {
    assert.equal(r.perQuestion[0].text, "7 × 8");
    assert.deepEqual(r.perQuestion[1].statKeys, ["t6", "t7"]);
    assert.deepEqual(r.perQuestion[1].byClass, { a: { answered: 2, correct: 0 }, b: { answered: 1, correct: 1 } });
    assert.equal(r.ranking.find((p) => p.uid === "u1").answered, 3);
  });
  it("utan ögonblicksbild (gamla/elevens klient) – inga text/statKeys, ingen krasch", () => {
    const r2 = buildResult(S, [], PLAYERS, null, { scores: SCORES });
    assert.equal(r2.perQuestion[0].text, undefined);
    assert.equal(questionRates(r2)[0].text, "");
  });
  it("andel rätt och svåraste frågan (hoppade räknas inte)", () => {
    const q = questionRates(r);
    assert.equal(q[0].rate, 1);
    assert.equal(Math.round(q[1].rate * 100), 33);
    assert.equal(q[2].rate, null);
    assert.deepEqual(hardestQuestions(r, 2).map((x) => x.index), [1, 3]);
  });
  it("per tabell ur statKeys – hela matchen och per klass", () => {
    const all = Object.fromEntries(categoryRates(r.perQuestion, CATS).map((c) => [c.key, [c.correct, c.answered]]));
    assert.deepEqual(all, { t6: [1, 3], t7: [4, 6], t8: [4, 5] });
    const a = Object.fromEntries(categoryRates(r.perQuestion, CATS, { classId: "a" }).map((c) => [c.key, [c.correct, c.answered]]));
    assert.deepEqual(a, { t6: [0, 2], t7: [2, 4], t8: [3, 4] });
  });
  it("elev × fråga och rätt/fel per elev", () => {
    const m = answerMatrix(r.ranking, SCORES);
    assert.deepEqual(m.find((x) => x.uid === "u3").cells, ["ratt", "ratt", "hoppad", "inget"]);
    assert.deepEqual(playerCounts(r).get("u2"), { correct: 1, incorrect: 2 });
  });
  it("pallplats med delad placering", () => {
    const g = podiumGroups([{ uid: "a", rank: 1, points: 9 }, { uid: "b", rank: 1, points: 9 }, { uid: "c", rank: 3, points: 5 }, { uid: "d", rank: 4, points: 1 }]);
    assert.deepEqual(g.map((x) => [x.rank, x.players.length]), [[1, 2], [3, 1]]);
  });
  it("test 7b: vanligaste felsvaren finns i sbScores", () => {
    const answers = ["54", "54", "56", "64"].map((a, i) => ({ uid: `u${i}`, q: 0, at: 1000 + i, answer: a }));
    const sc = scoreQuestion({ q: { index: 0, openedAt: 1000 }, facit: { correctAnswer: "56" }, answers, questionSeconds: 10, answerKind: "free" });
    assert.deepEqual(sc.topWrong, [{ answer: "54", n: 2 }, { answer: "64", n: 1 }]);
  });
});

describe("#560 demoläget – isolerat", () => {
  it("laddar aldrig Firestore-lagret", () => {
    const src = readFileSync(new URL("../src/live/formats/snilleblixt/sb-demo.js", import.meta.url), "utf8");
    assert.doesNotMatch(src, /firebase|snilleblixt-data|live-data|live-rewards-data|kc-koppling/);
  });
  it("30 elever med olika djur och olika kläder", () => {
    const m = Object.values(demoMembers());
    assert.equal(m.length, 30);
    assert.equal(new Set(m.map((x) => x.avatarId)).size, 30);
    assert.equal(new Set(DEMO_NAMES.map((_, i) => demoOutfit(i).join("+"))).size, 30);
  });
  for (const kind of ["choice", "free"]) {
    it(`${kind}: pallplats direkt, oavgjort om 1:a och delad 2:a, demo:true`, () => {
      for (const [tie, rank] of [["forsta", 1], ["andra", 2]]) {
        const d = createSbDemo({ kind, auto: false });
        d.jumpToFinal(tie);
        const { session, scores, players } = d.state();
        assert.equal(session.status, "finished");
        assert.equal(session.demo, true);
        assert.equal(scores.length, 10);
        const r = buildResult(session, [], players, null, { scores });
        assert.equal(r.ranking.filter((p) => p.rank === rank).length, 2, `${tie}`);
        d.destroy();
      }
    });
  }
});
