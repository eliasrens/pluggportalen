// ============================================================================
// Läsresan nivå 5 del b (#665): 40 nya texter i level-5-b.json (byggs av
// admin/lasresan-n2b-bygg.mjs). Rätt antal frågor, exakt ett giltigt svar per
// fråga, story/fact, ordantal, id-format, A–D-fördelning, längdledtråd och att
// level-5.json (elevernas historik) ligger kvar i manifestet.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { questionRange, validateBank, wordCount, answerPositionStats, answerLengthStats } from "../src/lasresan/content/validate.js";
import { OPTIONS_PER_QUESTION, CATEGORIES, LEVEL_WORD_RANGES } from "../src/lasresan/config.js";

const dir = new URL("../src/lasresan/content/bank/", import.meta.url);
const read = (f) => JSON.parse(readFileSync(new URL(f, dir)));
const texts = read("level-5-b.json");
const old = read("level-5.json");
const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");

test("nivå 5b: 40 texter, 20 story + 20 fact, id lr-n2- utan å/ä/ö, level 5", () => {
  assert.equal(texts.length, 40);
  assert.equal(texts.filter((t) => t.textType === "story").length, 20);
  assert.equal(texts.filter((t) => t.textType === "fact").length, 20);
  for (const t of texts) {
    assert.equal(t.level, 5, t.id);
    assert.match(t.id, /^lr-n2-[a-z0-9-]+$/, t.id);
  }
});

test("nivå 5b: inga id:n eller rubriker krockar med level-5.json", () => {
  const oldIds = new Set(old.map((t) => t.id));
  const oldTitles = new Set(old.map((t) => norm(t.title)));
  for (const t of texts) {
    assert.ok(!oldIds.has(t.id), t.id);
    assert.ok(!oldTitles.has(norm(t.title)), t.title);
  }
  assert.equal(new Set(texts.map((t) => norm(t.title))).size, texts.length);
});

test("nivå 5b: 5–9 frågor per text och exakt ett giltigt answerIndex per fråga", () => {
  const [lo, hi] = questionRange(5);
  for (const t of texts) {
    assert.ok(t.questions.length >= lo && t.questions.length <= hi, `${t.id}: ${t.questions.length} frågor`);
    assert.deepEqual(t.questions.map((q) => q.id), t.questions.map((_, i) => `q${i + 1}`), t.id);
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

test("nivå 5b: alla fyra frågekategorier i varje text", () => {
  for (const t of texts) {
    assert.deepEqual(new Set(t.questions.map((q) => q.category)), new Set(CATEGORIES), t.id);
  }
});

test("nivå 5b: ordantal inom nivåns intervall", () => {
  const [lo, hi] = LEVEL_WORD_RANGES[5];
  for (const t of texts) {
    const n = wordCount(t.body);
    assert.ok(n >= lo && n <= hi, `${t.id}: ${n} ord`);
  }
});

test("nivå 5b: A–D jämnt fördelat och ingen längdledtråd (unikt längst 15–30 %)", () => {
  const pos = answerPositionStats(texts)[5];
  const total = pos.reduce((a, b) => a + b, 0);
  for (const c of pos) assert.ok(Math.abs(c / total - 0.25) <= 0.03, `A–D ${pos.join("/")}`);
  const { longest } = answerLengthStats(texts)[5];
  assert.ok(longest / total >= 0.15 && longest / total <= 0.3, `unikt längst ${longest}/${total}`);
});

test("nivå 5b: manifestet har level-5.json + level-5-b.json, hela banken 0 fel och 0 varningar", () => {
  const manifest = read("manifest.json");
  assert.deepEqual(manifest.levels["5"], ["level-5.json", "level-5-b.json"]);
  const all = Object.values(manifest.levels).flat().flatMap(read);
  const r = validateBank(all);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.stats.perLevel[5], 80);
});
