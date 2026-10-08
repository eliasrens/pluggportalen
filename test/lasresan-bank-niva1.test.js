// ============================================================================
// Läsresan nivå 1 (#521, epic #516): 30 mycket enkla texter i level-1.json.
// Rätt antal frågor per text, exakt ett giltigt svar per fråga, story/fact,
// ordantal, unika id i hela banken, A–D-fördelning och längdledtråd.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { questionRange, validateBank, wordCount, answerPositionStats, answerLengthStats } from "../src/lasresan/content/validate.js";
import { OPTIONS_PER_QUESTION, CATEGORIES } from "../src/lasresan/config.js";

const dir = new URL("../src/lasresan/content/bank/", import.meta.url);
const read = (f) => JSON.parse(readFileSync(new URL(f, dir)));
const texts = read("level-1.json");
const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");

test("nivå 1: 30 texter, 15 story + 15 fact, id lr-g1-, level 1", () => {
  assert.equal(texts.length, 30);
  assert.equal(texts.filter((t) => t.textType === "story").length, 15);
  assert.equal(texts.filter((t) => t.textType === "fact").length, 15);
  for (const t of texts) {
    assert.equal(t.level, 1, t.id);
    assert.match(t.id, /^lr-g1-[a-z0-9-]+$/, t.id);
  }
});

test("nivå 1: 3–4 frågor per text och exakt ett giltigt answerIndex per fråga", () => {
  const [lo, hi] = questionRange(1);
  assert.deepEqual([lo, hi], [3, 4]);
  for (const t of texts) {
    assert.ok(t.questions.length >= lo && t.questions.length <= hi, `${t.id}: ${t.questions.length} frågor`);
    assert.deepEqual(t.questions.map((q) => q.id), t.questions.map((_, i) => `q${i + 1}`), t.id);
    for (const q of t.questions) {
      const tag = `${t.id}/${q.id}`;
      assert.equal(q.options.length, OPTIONS_PER_QUESTION, tag);
      assert.ok(Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex < OPTIONS_PER_QUESTION, tag);
      // Inga dubbletter efter normalisering → rätt svar finns på exakt EN plats.
      const opts = q.options.map(norm);
      assert.equal(new Set(opts).size, opts.length, `${tag}: dubblett bland alternativen`);
      assert.equal(opts.filter((o) => o === opts[q.answerIndex]).length, 1, tag);
      assert.ok(CATEGORIES.includes(q.category), tag);
      assert.ok(q.options.every((o) => o.trim().split(/\s+/).length <= 4), `${tag}: alternativ över 4 ord`);
    }
  }
});

test("nivå 1: 30–50 ord per text", () => {
  for (const t of texts) {
    const n = wordCount(t.body);
    assert.ok(n >= 30 && n <= 50, `${t.id}: ${n} ord`);
  }
});

test("nivå 1: A–D jämnt fördelat och ingen längdledtråd (unikt längst 15–30 %)", () => {
  const pos = answerPositionStats(texts)[1];
  const total = pos.reduce((a, b) => a + b, 0);
  for (const c of pos) assert.ok(Math.abs(c / total - 0.25) <= 0.03, `A–D ${pos.join("/")}`);
  const { longest } = answerLengthStats(texts)[1];
  assert.ok(longest / total >= 0.15 && longest / total <= 0.3, `unikt längst ${longest}/${total}`);
});

test("nivå 1: validateBank på hela banken ger 0 fel och 0 varningar, id unika", () => {
  const manifest = read("manifest.json");
  const all = Object.values(manifest.levels).flat().flatMap(read);
  const r = validateBank(all);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.stats.perLevel[1], 30);
});
