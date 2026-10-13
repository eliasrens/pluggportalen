// ============================================================================
// Läsresan nivå 1, del B (#661): 40 nya texter i level-1-b.json (level-1.json
// orörd). Samma krav som del A (#521): 3–4 frågor, exakt ett giltigt svar,
// 30–50 ord, unika id i hela banken, A–D-fördelning och längdledtråd – både
// för del B och för hela nivå 1.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { questionRange, validateBank, wordCount, answerPositionStats, answerLengthStats } from "../src/lasresan/content/validate.js";
import { OPTIONS_PER_QUESTION, CATEGORIES } from "../src/lasresan/config.js";

const dir = new URL("../src/lasresan/content/bank/", import.meta.url);
const read = (f) => JSON.parse(readFileSync(new URL(f, dir)));
const texts = read("level-1-b.json");
const levelA = read("level-1.json");
const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");

test("nivå 1 del B: 40 texter, 20 story + 20 fact, id lr-g1-, level 1, i manifestet", () => {
  assert.equal(texts.length, 40);
  assert.equal(texts.filter((t) => t.textType === "story").length, 20);
  assert.equal(texts.filter((t) => t.textType === "fact").length, 20);
  for (const t of texts) {
    assert.equal(t.level, 1, t.id);
    assert.match(t.id, /^lr-g1-[a-z0-9-]+$/, t.id);
  }
  assert.deepEqual(read("manifest.json").levels[1], ["level-1.json", "level-1-b.json"]);
});

test("nivå 1 del B: inga titlar eller id som redan finns på nivå 1", () => {
  const titles = new Set(levelA.map((t) => norm(t.title)));
  const ids = new Set(levelA.map((t) => t.id));
  for (const t of texts) {
    assert.ok(!titles.has(norm(t.title)), `${t.id}: titeln "${t.title}" finns redan`);
    assert.ok(!ids.has(t.id), `${t.id}: id:t finns redan i level-1.json`);
  }
});

test("nivå 1 del B: 3–4 frågor per text och exakt ett giltigt answerIndex per fråga", () => {
  const [lo, hi] = questionRange(1);
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
      assert.ok(q.options.every((o) => o.trim().split(/\s+/).length <= 4), `${tag}: alternativ över 4 ord`);
    }
  }
});

test("nivå 1 del B: 30–50 ord per text", () => {
  for (const t of texts) {
    const n = wordCount(t.body);
    assert.ok(n >= 30 && n <= 50, `${t.id}: ${n} ord`);
  }
});

test("nivå 1 del B och hela nivå 1: A–D jämnt fördelat, ingen längdledtråd (unikt längst 15–30 %)", () => {
  for (const [label, list] of [["del B", texts], ["hela nivå 1", [...levelA, ...texts]]]) {
    const pos = answerPositionStats(list)[1];
    const total = pos.reduce((a, b) => a + b, 0);
    for (const c of pos) assert.ok(Math.abs(c / total - 0.25) <= 0.03, `${label}: A–D ${pos.join("/")}`);
    const { longest } = answerLengthStats(list)[1];
    assert.ok(longest / total >= 0.15 && longest / total <= 0.3, `${label}: unikt längst ${longest}/${total}`);
  }
});

test("nivå 1 del B: mest direkta frågor (fakta ≥ 70 %), alla fyra kategorier finns", () => {
  const qs = texts.flatMap((t) => t.questions);
  const cats = {};
  for (const q of qs) cats[q.category] = (cats[q.category] || 0) + 1;
  assert.ok(cats.fakta / qs.length >= 0.7, `fakta ${cats.fakta}/${qs.length}`);
  for (const c of CATEGORIES) assert.ok(cats[c] > 0, `kategori ${c} saknas`);
  assert.ok((cats.mellan_raderna || 0) + (cats.helhet_slutsats || 0) <= qs.length * 0.15, "för många slutsatsfrågor");
});
