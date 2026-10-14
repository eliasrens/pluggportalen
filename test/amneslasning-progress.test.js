// ============================================================================
// Ämnesläsning (#671): tillstånd per område, försök med source och pluggmynt
// med omläsningstrappa. Spec docs/UTVECKLINGSUPPDRAG_AMNESLASNING.md §5, §8,
// §10 test 14–15.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  amnesCoinsFor, applyAmnesCompletion, areaOf, attemptSource, buildAmnesAttempt,
  emptyTotals, normalizeAmneslasning, previousReads, readList, withStartedAmnesText,
} from "../src/amneslasning/progress.js";
import { AMNES_COINS_PER_CORRECT, AMNES_SOURCE } from "../src/lasresan/config.js";
import { normalizeLasresa } from "../src/lasresan/progress.js";
import { normalizeAttempt } from "../src/lasresan/level-scale.js";
import { award } from "../src/lasresan/rewards.js";
import { grindMultiplier } from "../src/leveling.js";

function amnesText(id, n = 7, level = 3) {
  return {
    id, title: `Text ${id}`, level, textType: "fact", body: "x",
    questions: Array.from({ length: n }, (_, i) => ({
      id: `q${i + 1}`, question: "?", options: ["a", "b", "c", "d"], answerIndex: 3, category: i % 2 ? "fakta" : "mellan_raderna",
    })),
  };
}
const answersFor = (text, correct) =>
  text.questions.map((q, i) => ({ qid: q.id, chosen: i < correct ? q.answerIndex : 0 }));
const ctx = { subjectId: "no", areaId: "fotosyntes" };

/** Läs `text` klart med `correct` rätt; returnerar nytt tillstånd + försöket. */
function read(amneslasning, text, correct, now) {
  const started = withStartedAmnesText(amneslasning, { ...ctx, textId: text.id }, now - 10).amneslasning;
  const prevReads = previousReads(areaOf(started, ctx.areaId), text.id);
  const attempt = buildAmnesAttempt(text, answersFor(text, correct), { ...ctx, prevReads, startedAt: now - 10, completedAt: now, studentId: "elev1" });
  const out = applyAmnesCompletion({ lasresa: normalizeLasresa(undefined), amneslasning: started }, attempt, now);
  return { ...out, attempt };
}

test("Test 14: 6 rätt av 7 på en ny text → 30 pluggmynt", () => {
  assert.equal(AMNES_COINS_PER_CORRECT, 5);
  const { attempt } = read(undefined, amnesText("t1"), 6, 1000);
  assert.equal(attempt.correct, 6);
  assert.equal(attempt.totalQuestions, 7);
  assert.equal(attempt.earnedMoney, 30);
  assert.equal(attempt.readNumber, 1);
});

test("Test 15: samma text en andra gång med 6 rätt → 24 pluggmynt (80 %)", () => {
  const first = read(undefined, amnesText("t1"), 6, 1000);
  const second = read(first.amneslasning, amnesText("t1"), 6, 2000);
  assert.equal(second.attempt.earnedMoney, 24);
  assert.equal(second.attempt.readNumber, 2);
  assert.deepEqual(second.amneslasning.areas.fotosyntes.read.t1, { count: 2, lastAt: 2000 });
  // Trappan är per text: en annan text ger full pott igen.
  const other = read(second.amneslasning, amnesText("t2"), 6, 3000);
  assert.equal(other.attempt.earnedMoney, 30);
  // Hela trappan 100 → 80 → 60 → 40 → 20 % (golv), samma som Plugga.
  assert.deepEqual([0, 1, 2, 3, 4, 5, 9].map((n) => amnesCoinsFor(6, n)), [30, 24, 18, 12, 6, 6, 6]);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((n) => Math.round(grindMultiplier(n) * 100)), [100, 80, 60, 40, 20, 20]);
  // Avrundas uppåt (som Pluggas trappa): 1 rätt tredje gången = ceil(3) = 3, 0 rätt = 0.
  assert.equal(amnesCoinsFor(1, 2), 3);
  assert.equal(amnesCoinsFor(1, 1), 4);
  assert.equal(amnesCoinsFor(0, 0), 0);
});

test("mynten går till det vanliga saldot på Läsresans väg (rewards.award)", async () => {
  const calls = [];
  const addCoins = async (amount, studentId) => { calls.push([amount, studentId]); return 100 + amount; };
  const res = await award(6, { studentId: "elev1", addCoins, coins: 24 });
  assert.deepEqual(res, { coins: 24, balance: 124 });
  assert.deepEqual(calls, [[24, "elev1"]]);
  // Utan `coins` är Läsresan oförändrad: 3 per rätt.
  assert.equal((await award(6, { studentId: "elev1", addCoins })).coins, 18);
  assert.deepEqual(await award(0, { addCoins, coins: 0 }), { coins: 0, balance: null });
});

test("försöket: source, subjectId, areaId, amnesLevel och motsvarande läsnivå", () => {
  const { attempt } = read(undefined, amnesText("t1", 7, 3), 5, 1000);
  assert.equal(attempt.source, AMNES_SOURCE);
  assert.equal(attempt.source, "amnesläsning");
  assert.equal(attempt.subjectId, "no");
  assert.equal(attempt.areaId, "fotosyntes");
  assert.equal(attempt.amnesLevel, 3);
  assert.equal(attempt.textLevel, 6);
  assert.equal(attempt.levelScale, 10);
  assert.equal(attempt.studentId, "elev1");
  assert.equal(attempt.percentage, 71);
  assert.deepEqual(attempt.perCategory, { mellan_raderna: { q: 4, correct: 3 }, fakta: { q: 3, correct: 2 } });
  // normalizeAttempt (listAttempts) lämnar försöket orört.
  assert.equal(normalizeAttempt(attempt), attempt);
  assert.deepEqual([1, 2].map((l) => buildAmnesAttempt(amnesText("x", 3, l), [], ctx).textLevel), [2, 4]);
  assert.throws(() => buildAmnesAttempt(amnesText("x", 3, 4), [], ctx), /ämnesnivå/);
});

test("gamla försök utan source räknas som Läsresan", () => {
  assert.equal(attemptSource({ textId: "lr-n3-a" }), "lasresan");
  assert.equal(attemptSource({ textId: "lr-n3-a", source: "lasresan" }), "lasresan");
  assert.equal(attemptSource({ source: "amnesläsning" }), "amnesläsning");
  assert.equal(attemptSource(null), "lasresan");
});

test("påbörjad text per område återupptas; force byter", () => {
  const a = withStartedAmnesText(undefined, { ...ctx, textId: "t1" }, 100);
  assert.equal(a.resumed, false);
  assert.equal(a.amneslasning.areas.fotosyntes.currentTextId, "t1");
  assert.equal(a.amneslasning.areas.fotosyntes.subjectId, "no");
  const b = withStartedAmnesText(a.amneslasning, { ...ctx, textId: "t2" }, 200);
  assert.equal(b.resumed, true);
  assert.equal(b.textId, "t1");
  assert.equal(b.amneslasning.areas.fotosyntes.currentStartedAt, 100);
  const c = withStartedAmnesText(a.amneslasning, { ...ctx, textId: "t2" }, 300, { force: true });
  assert.equal(c.textId, "t2");
  // Ett annat område har sin egen påbörjade text.
  const d = withStartedAmnesText(a.amneslasning, { subjectId: "so", areaId: "vikingar", textId: "v1" }, 400);
  assert.equal(d.resumed, false);
  assert.equal(d.amneslasning.areas.fotosyntes.currentTextId, "t1");
  assert.equal(d.amneslasning.areas.vikingar.currentTextId, "v1");
});

test("läst-listan per område: tidpunkt, äldst först, tål skräpdata", () => {
  let s;
  s = read(s, amnesText("b"), 3, 1000).amneslasning;
  s = read(s, amnesText("a"), 3, 2000).amneslasning;
  s = read(s, amnesText("b"), 3, 3000).amneslasning;
  const area = areaOf(s, "fotosyntes");
  assert.equal(area.currentTextId, null);
  assert.deepEqual(readList(area), [
    { textId: "a", count: 1, lastAt: 2000 },
    { textId: "b", count: 2, lastAt: 3000 },
  ]);
  assert.deepEqual(areaOf(s, "annat", "so"), { subjectId: "so", read: {}, currentTextId: null, currentStartedAt: null, totals: emptyTotals() });
  const junk = normalizeAmneslasning({ areas: { x: { read: { t: { count: -1 }, u: { count: 2, lastAt: "igår" } }, currentTextId: 5 } } });
  assert.deepEqual(junk.areas.x.read, { u: { count: 2, lastAt: null } });
  assert.equal(junk.areas.x.currentTextId, null);
  assert.deepEqual(normalizeAmneslasning(undefined), { areas: {}, totals: emptyTotals(), updatedAt: null });
});

test("#674: totaler per område och för all ämnesläsning (denormaliserat, samma transaktion)", () => {
  let s;
  s = read(s, amnesText("a"), 6, 1000).amneslasning; // 6/7
  s = read(s, amnesText("a"), 3, 2000).amneslasning; // omläsning 3/7
  const other = withStartedAmnesText(s, { subjectId: "so", areaId: "vikingar", textId: "v1" }, 2500).amneslasning;
  const v = buildAmnesAttempt(amnesText("v1", 4), answersFor(amnesText("v1", 4), 4), { subjectId: "so", areaId: "vikingar", completedAt: 3000 });
  s = applyAmnesCompletion({ lasresa: normalizeLasresa(undefined), amneslasning: other }, v, 3000).amneslasning;
  const foto = areaOf(s, "fotosyntes").totals;
  assert.equal(foto.totalTexts, 2);
  assert.equal(foto.totalQuestions, 14);
  assert.equal(foto.totalCorrect, 9);
  assert.equal(foto.totalIncorrect, 5);
  assert.equal(foto.catStats.mellan_raderna.q + foto.catStats.fakta.q, 14);
  assert.equal(areaOf(s, "vikingar").totals.totalTexts, 1);
  assert.equal(s.totals.totalTexts, 3);
  assert.equal(s.totals.totalCorrect, 13);
  assert.equal(s.totals.moneyEarned, foto.moneyEarned + areaOf(s, "vikingar").totals.moneyEarned);
  // Skräp i lagrade totaler tvättas.
  const junk = normalizeAmneslasning({ totals: { totalTexts: -2, totalCorrect: "x", catStats: { fakta: { q: 2, correct: 1 } } } });
  assert.equal(junk.totals.totalTexts, 0);
  assert.equal(junk.totals.totalCorrect, 0);
  assert.deepEqual(junk.totals.catStats, { fakta: { q: 2, correct: 1 } });
});
