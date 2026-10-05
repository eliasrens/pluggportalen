// ============================================================================
// Läsresan (#399): statistik – stats.js (elevens "Min läsning", lärarvyn).
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  summarize, categoryBreakdown, mergeCategoryStats, aggregateAttempts, classRows, sortRows,
} from "../src/lasresan/stats.js";

const lasresa = {
  level: 5, totalTexts: 18, totalQuestions: 126, totalCorrect: 91, totalIncorrect: 35, moneyEarned: 273,
  worldId: "skogen", stepInWorld: 18, completedWorlds: [],
};

test("summarize: spec §20-exemplet, nivån bara med includeLevel", () => {
  const s = summarize(lasresa);
  assert.deepEqual([s.texts, s.questions, s.correct, s.pct, s.money], [18, 126, 91, 72, 273]);
  assert.equal("level" in s, false);
  assert.equal(summarize(lasresa, { includeLevel: true }).level, 5);
});

test("categoryBreakdown: alla fyra kategorier i ordning, nya behålls", () => {
  const rows = categoryBreakdown({ fakta: { q: 11, correct: 9 }, ny_typ: { q: 2, correct: 1 } });
  assert.deepEqual(rows.map((r) => r.category), ["fakta", "ordforstaelse", "mellan_raderna", "helhet_slutsats", "ny_typ"]);
  assert.equal(rows[0].pct, 82);
  assert.equal(rows[0].label, "Fakta");
  assert.equal(rows[1].q, 0);
});

test("mergeCategoryStats summerar", () => {
  assert.deepEqual(mergeCategoryStats({ fakta: { q: 1, correct: 1 } }, { fakta: { q: 2, correct: 0 }, ordforstaelse: { q: 1, correct: 1 } }), {
    fakta: { q: 3, correct: 1 }, ordforstaelse: { q: 1, correct: 1 },
  });
});

test("aggregateAttempts: totaler, per kategori, per text (senaste först)", () => {
  const a = aggregateAttempts([
    { textId: "x", title: "X", totalQuestions: 8, correct: 6, earnedMoney: 18, percentage: 75, completedAt: 1, perCategory: { fakta: { q: 8, correct: 6 } } },
    { textId: "y", title: "Y", totalQuestions: 5, correct: 2, earnedMoney: 6, percentage: 40, completedAt: 3, perCategory: { fakta: { q: 5, correct: 2 } } },
    { textId: "x", title: "X", totalQuestions: 8, correct: 4, earnedMoney: 12, percentage: 50, completedAt: 2, perCategory: {} },
  ]);
  assert.deepEqual(a.totals, { texts: 3, questions: 21, correct: 12, incorrect: 9, pct: 57, money: 36 });
  assert.deepEqual(a.perCategory[0], { category: "fakta", label: "Fakta", q: 13, correct: 8, pct: 62 });
  assert.deepEqual(a.perText.map((r) => r.textId), ["y", "x"]);
  const x = a.perText[1];
  assert.deepEqual([x.attempts, x.bestPct, x.lastPct], [2, 75, 50]);
});

test("classRows + sortRows: ej påbörjad elev har nivå null, sortering på namn/pct", () => {
  const rows = classRows([
    { studentId: "e1", namn: "Örjan", lasresa },
    { studentId: "e2", namn: "Astrid", lasresa: null },
    { studentId: "e3", namn: "Björn", lasresa: { ...lasresa, totalCorrect: 120 } },
  ]);
  assert.equal(rows[1].level, null);
  assert.equal(rows[1].started, false);
  assert.deepEqual(sortRows(rows, "namn").map((r) => r.namn), ["Astrid", "Björn", "Örjan"]);
  assert.deepEqual(sortRows(rows, "pct", "desc").map((r) => r.studentId), ["e3", "e1", "e2"]);
  assert.deepEqual(sortRows(rows, "level", "desc").map((r) => r.studentId).at(-1), "e2");
});
