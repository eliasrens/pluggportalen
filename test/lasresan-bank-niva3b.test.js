// ============================================================================
// Läsresan nivå 3, del b (#663): 40 nya texter i level-3-b.json (level-3.json orörd).
// Rätt antal frågor per text, exakt ett giltigt svar per fråga, story/fact,
// ordantal, minst en slutsatsfråga per text, unika id i hela banken,
// A–D-fördelning och längdledtråd.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { questionRange, validateBank, wordCount, answerPositionStats, answerLengthStats } from "../src/lasresan/content/validate.js";
import { OPTIONS_PER_QUESTION, CATEGORIES } from "../src/lasresan/config.js";

const dir = new URL("../src/lasresan/content/bank/", import.meta.url);
const read = (f) => JSON.parse(readFileSync(new URL(f, dir)));
const texts = read("level-3-b.json");
const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");

test("nivå 3b: 40 texter, 20 story + 20 fact, id lr-g3- utan åäö, level 3, i manifestet", () => {
  assert.equal(texts.length, 40);
  assert.equal(texts.filter((t) => t.textType === "story").length, 20);
  assert.equal(texts.filter((t) => t.textType === "fact").length, 20);
  for (const t of texts) {
    assert.equal(t.level, 3, t.id);
    assert.match(t.id, /^lr-g3-[a-z0-9-]+$/, t.id);
  }
  assert.ok(read("manifest.json").levels["3"].includes("level-3-b.json"));
});

test("nivå 3b: titlar och id krockar inte med level-3.json", () => {
  const old = read("level-3.json");
  const oldTitles = new Set(old.map((t) => norm(t.title)));
  const oldIds = new Set(old.map((t) => t.id));
  for (const t of texts) {
    assert.ok(!oldTitles.has(norm(t.title)), t.title);
    assert.ok(!oldIds.has(t.id), t.id);
  }
});

test("nivå 3b: 5–7 frågor, exakt ett giltigt svar, minst en slutsatsfråga per text", () => {
  const [lo, hi] = questionRange(3);
  for (const t of texts) {
    assert.ok(t.questions.length >= lo && t.questions.length <= hi, `${t.id}: ${t.questions.length} frågor`);
    assert.deepEqual(t.questions.map((q) => q.id), t.questions.map((_, i) => `q${i + 1}`), t.id);
    assert.ok(t.questions.some((q) => q.category === "mellan_raderna" || q.category === "helhet_slutsats"), `${t.id}: ingen slutsatsfråga`);
    for (const q of t.questions) {
      const tag = `${t.id}/${q.id}`;
      assert.equal(q.options.length, OPTIONS_PER_QUESTION, tag);
      assert.ok(Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex < OPTIONS_PER_QUESTION, tag);
      const opts = q.options.map(norm);
      assert.equal(new Set(opts).size, opts.length, `${tag}: dubblett bland alternativen`);
      assert.ok(CATEGORIES.includes(q.category), tag);
    }
  }
});

test("nivå 3b: 100–140 ord per text", () => {
  for (const t of texts) {
    const n = wordCount(t.body);
    assert.ok(n >= 100 && n <= 140, `${t.id}: ${n} ord`);
  }
});

test("nivå 3b: A–D jämnt fördelat och ingen längdledtråd (unikt längst 15–30 %)", () => {
  const pos = answerPositionStats(texts)[3];
  const total = pos.reduce((a, b) => a + b, 0);
  for (const c of pos) assert.ok(Math.abs(c / total - 0.25) <= 0.03, `A–D ${pos.join("/")}`);
  const { longest } = answerLengthStats(texts)[3];
  assert.ok(longest / total >= 0.15 && longest / total <= 0.3, `unikt längst ${longest}/${total}`);
});

test("nivå 3b: validateBank på hela banken ger 0 fel och 0 varningar, nivå 3 = 70 texter", () => {
  const manifest = read("manifest.json");
  const all = Object.values(manifest.levels).flat().flatMap(read);
  const r = validateBank(all);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.stats.perLevel[3], 70);
});
