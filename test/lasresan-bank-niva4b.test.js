// ============================================================================
// Läsresan nivå 4, fil b (#664): nya texter i level-4-b.json utöver level-4.json.
// Rätt antal frågor per text, exakt ett giltigt svar per fråga, story/fact,
// ordantal, unika id/titlar mot level-4.json, A–D-fördelning och längdledtråd.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { questionRange, validateBank, wordCount, answerPositionStats, answerLengthStats, levelFromId } from "../src/lasresan/content/validate.js";
import { OPTIONS_PER_QUESTION, CATEGORIES } from "../src/lasresan/config.js";

const dir = new URL("../src/lasresan/content/bank/", import.meta.url);
const read = (f) => JSON.parse(readFileSync(new URL(f, dir)));
const texts = read("level-4-b.json");
const old = read("level-4.json");
const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");
const EXPECTED = 30;

test("nivå 4b: texter, hälften story/fact, id lr-n1- utan åäö, level 4, i manifestet", () => {
  assert.equal(texts.length, EXPECTED);
  assert.equal(texts.filter((t) => t.textType === "story").length, EXPECTED / 2);
  assert.equal(texts.filter((t) => t.textType === "fact").length, EXPECTED / 2);
  for (const t of texts) {
    assert.equal(t.level, 4, t.id);
    assert.match(t.id, /^lr-n1-[a-z0-9-]+$/, t.id);
    assert.equal(levelFromId(t.id), 4, t.id);
  }
  assert.deepEqual(read("manifest.json").levels["4"], ["level-4.json", "level-4-b.json"]);
});

test("nivå 4b: inga id eller titlar som redan finns i level-4.json", () => {
  const ids = new Set(old.map((t) => t.id));
  const titles = new Set(old.map((t) => norm(t.title)));
  for (const t of texts) {
    assert.ok(!ids.has(t.id), `${t.id}: id finns redan`);
    assert.ok(!titles.has(norm(t.title)), `${t.id}: titeln finns redan`);
  }
  assert.equal(new Set(texts.map((t) => norm(t.title))).size, texts.length, "dubblett-titel i level-4-b.json");
});

test("nivå 4b: 5–9 frågor per text och exakt ett giltigt answerIndex per fråga", () => {
  const [lo, hi] = questionRange(4);
  assert.deepEqual([lo, hi], [5, 9]);
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
      assert.ok(CATEGORIES.includes(q.category), tag);
    }
  }
});

test("nivå 4b: 60–110 ord per text", () => {
  for (const t of texts) {
    const n = wordCount(t.body);
    assert.ok(n >= 60 && n <= 110, `${t.id}: ${n} ord`);
  }
});

test("nivå 4b: alla fyra kategorier används, fakta i majoritet men inte allt", () => {
  const cats = {};
  for (const t of texts) for (const q of t.questions) cats[q.category] = (cats[q.category] || 0) + 1;
  const total = Object.values(cats).reduce((a, b) => a + b, 0);
  for (const c of CATEGORIES) assert.ok(cats[c] > 0, `${c} saknas`);
  assert.ok(cats.fakta / total >= 0.45 && cats.fakta / total <= 0.65, `fakta ${cats.fakta}/${total}`);
});

test("nivå 4b: A–D jämnt fördelat och ingen längdledtråd (unikt längst 15–30 %)", () => {
  const pos = answerPositionStats(texts)[4];
  const total = pos.reduce((a, b) => a + b, 0);
  for (const c of pos) assert.ok(Math.abs(c / total - 0.25) <= 0.03, `A–D ${pos.join("/")}`);
  const { longest } = answerLengthStats(texts)[4];
  assert.ok(longest / total >= 0.15 && longest / total <= 0.3, `unikt längst ${longest}/${total}`);
});

test("nivå 4b: validateBank på hela banken ger 0 fel och 0 varningar", () => {
  const manifest = read("manifest.json");
  const all = Object.values(manifest.levels).flat().flatMap(read);
  const r = validateBank(all);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.stats.perLevel[4], old.length + EXPECTED);
});
