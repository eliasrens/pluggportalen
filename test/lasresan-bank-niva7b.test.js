// ============================================================================
// Läsresan nivå 7, fil b (#667): 40 nya texter i level-7-b.json utöver level-7.json.
// Rätt antal frågor per text, exakt ett giltigt svar per fråga, story/fact,
// ordantal, unika id/titlar i hela banken, A–D-fördelning, längdledtråd och
// att level-7.json (elevernas historik pekar dit) fortfarande ligger först.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { questionRange, validateBank, wordCount, answerPositionStats, answerLengthStats } from "../src/lasresan/content/validate.js";
import { OPTIONS_PER_QUESTION, CATEGORIES, LEVEL_WORD_RANGES } from "../src/lasresan/config.js";

const dir = new URL("../src/lasresan/content/bank/", import.meta.url);
const read = (f) => JSON.parse(readFileSync(new URL(f, dir)));
const texts = read("level-7-b.json");
const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");

test("nivå 7-b: 40 texter, 20 story + 20 fact, id lr-n4- utan åäö, level 7", () => {
  assert.equal(texts.length, 40);
  assert.equal(texts.filter((t) => t.textType === "story").length, 20);
  assert.equal(texts.filter((t) => t.textType === "fact").length, 20);
  for (const t of texts) {
    assert.equal(t.level, 7, t.id);
    assert.match(t.id, /^lr-n4-[a-z0-9-]+$/, t.id);
  }
});

test("nivå 7-b: manifestet läser level-7.json först och sedan level-7-b.json", () => {
  assert.deepEqual(read("manifest.json").levels["7"], ["level-7.json", "level-7-b.json"]);
});

test("nivå 7-b: 5–9 frågor per text och exakt ett giltigt answerIndex per fråga", () => {
  const [lo, hi] = questionRange(7);
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

test("nivå 7-b: alla fyra frågekategorier används i varje text", () => {
  for (const t of texts) {
    const cats = new Set(t.questions.map((q) => q.category));
    assert.equal(cats.size, CATEGORIES.length, t.id);
  }
});

test("nivå 7-b: ordantal inom nivåns riktintervall", () => {
  const [lo, hi] = LEVEL_WORD_RANGES[7];
  for (const t of texts) {
    const n = wordCount(t.body);
    assert.ok(n >= lo && n <= hi, `${t.id}: ${n} ord`);
  }
});

test("nivå 7-b: A–D jämnt fördelat och ingen längdledtråd (unikt längst 15–30 %)", () => {
  const pos = answerPositionStats(texts)[7];
  const total = pos.reduce((a, b) => a + b, 0);
  for (const c of pos) assert.ok(Math.abs(c / total - 0.25) <= 0.03, `A–D ${pos.join("/")}`);
  const { longest } = answerLengthStats(texts)[7];
  assert.ok(longest / total >= 0.15 && longest / total <= 0.3, `unikt längst ${longest}/${total}`);
});

test("nivå 7-b: id och titlar är unika i hela banken", () => {
  const manifest = read("manifest.json");
  const all = Object.values(manifest.levels).flat().flatMap(read);
  const ids = all.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  const mine = new Set(texts.map((t) => t.id));
  const others = new Set(all.filter((t) => !mine.has(t.id)).map((t) => norm(t.title)));
  for (const t of texts) assert.ok(!others.has(norm(t.title)), `${t.id}: titeln "${t.title}" finns redan`);
});

test("nivå 7-b: validateBank på hela banken ger 0 fel och 0 varningar, nivå 7 har 80 texter", () => {
  const manifest = read("manifest.json");
  const all = Object.values(manifest.levels).flat().flatMap(read);
  const r = validateBank(all);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.stats.perLevel[7], 80);
});
