// ============================================================================
// Läsresan (#399): dold adaptiv nivå – src/lasresan/level.js.
// Spec-acceptanstest 2 (nivådelen), 3, 4, 5, 6 + tak/golv + gränsfall.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { applyResult, classifyResult, normalizeLevel, percent } from "../src/lasresan/level.js";
import {
  START_LEVEL, LEVEL_MIN, LEVEL_MAX, HIGH_PCT, LOW_PCT, HIGH_STREAK_TO_UP, LOW_STREAK_TO_DOWN, COINS_PER_CORRECT,
} from "../src/lasresan/config.js";

const fresh = () => ({ level: START_LEVEL, highStreak: 0, lowStreak: 0 });
/** Kör en serie [correct, total] från ett tillstånd. */
const run = (state, results) => results.reduce((s, [c, t]) => applyResult(s, { correct: c, total: t }), state);

test("config: spec-talen", () => {
  assert.deepEqual(
    [LEVEL_MIN, LEVEL_MAX, START_LEVEL, HIGH_PCT, LOW_PCT, HIGH_STREAK_TO_UP, LOW_STREAK_TO_DOWN, COINS_PER_CORRECT],
    [1, 7, 3, 70, 50, 3, 2, 3]
  );
});

test("Test 2 (nivå): 6/8 = 75 % → highStreak 1, ingen nivåändring", () => {
  const s = applyResult(fresh(), { correct: 6, total: 8 });
  assert.equal(percent(6, 8), 75);
  assert.deepEqual(s, { level: 3, highStreak: 1, lowStreak: 0, changed: false, band: "high" });
});

test("Test 3: 75 % / 80 % / 71 % i rad → nivå 3 → 4, streaks nollade", () => {
  const s = run(fresh(), [[6, 8], [8, 10], [5, 7]]); // 75, 80, 71,4
  assert.equal(s.level, 4);
  assert.equal(s.changed, true);
  assert.equal(s.highStreak, 0);
  assert.equal(s.lowStreak, 0);
});

test("Test 4: 80 % / 76 % / 65 % → ingen ändring, highStreak nollad", () => {
  const two = run(fresh(), [[8, 10], [19, 25]]); // 80, 76
  assert.equal(two.highStreak, 2);
  const s = applyResult(two, { correct: 13, total: 20 }); // 65
  assert.equal(s.level, 3);
  assert.equal(s.changed, false);
  assert.equal(s.highStreak, 0);
  assert.equal(s.lowStreak, 0);
  assert.equal(s.band, "mid");
  // Nästa höga text börjar en NY serie.
  assert.equal(applyResult(s, { correct: 7, total: 7 }).highStreak, 1);
});

test("Test 5: 43 % / 49 % → nivå −1", () => {
  const s = run(fresh(), [[3, 7], [49, 100]]);
  assert.equal(s.level, 2);
  assert.equal(s.changed, true);
  assert.equal(s.lowStreak, 0);
  assert.equal(s.highStreak, 0);
});

test("Test 6: exakt 50 % är INTE låg (bryter lowStreak)", () => {
  assert.equal(classifyResult(4, 8), "mid");
  const oneLow = applyResult(fresh(), { correct: 2, total: 8 });
  assert.equal(oneLow.lowStreak, 1);
  const s = applyResult(oneLow, { correct: 4, total: 8 });
  assert.equal(s.lowStreak, 0);
  assert.equal(s.level, 3);
});

test("exakt 70 % ÄR hög – heltalsjämförelse utan flyttalsfel", () => {
  assert.equal(classifyResult(7, 10), "high");
  assert.equal(classifyResult(14, 20), "high");
  assert.equal(classifyResult(69, 100), "mid");
  // 0,7 * 10 = 7.000000000000001 i flyttal – får inte påverka.
  assert.equal(classifyResult(7, 10), "high");
  assert.equal(classifyResult(5, 9), "mid"); // 55,6 %
  assert.equal(classifyResult(4, 9), "low"); // 44,4 %
});

test("hög följd av låg nollar highStreak; låg följd av hög nollar lowStreak", () => {
  const a = run(fresh(), [[8, 8], [8, 8], [0, 8]]);
  assert.deepEqual([a.level, a.highStreak, a.lowStreak], [3, 0, 1]);
  const b = run(fresh(), [[0, 8], [8, 8]]);
  assert.deepEqual([b.level, b.highStreak, b.lowStreak], [3, 1, 0]);
});

test("tak: nivå 7 + 3 höga → stannar på 7, streak nollas", () => {
  const s = run({ level: 7, highStreak: 0, lowStreak: 0 }, [[8, 8], [8, 8], [8, 8]]);
  assert.deepEqual([s.level, s.highStreak, s.lowStreak, s.changed], [7, 0, 0, false]);
});

test("golv: nivå 1 + 2 låga → stannar på 1, streak nollas", () => {
  const s = run({ level: 1, highStreak: 0, lowStreak: 0 }, [[0, 8], [1, 8]]);
  assert.deepEqual([s.level, s.highStreak, s.lowStreak, s.changed], [1, 0, 0, false]);
});

test("normalizeLevel klämmer och har default 3", () => {
  assert.equal(normalizeLevel(undefined), 3);
  assert.equal(normalizeLevel("5"), 5);
  assert.equal(normalizeLevel(0), 1);
  assert.equal(normalizeLevel(99), 7);
});

test("total 0 påverkar ingenting", () => {
  const s = applyResult({ level: 4, highStreak: 2, lowStreak: 0 }, { correct: 0, total: 0 });
  assert.deepEqual([s.level, s.highStreak, s.changed], [4, 2, false]);
});
