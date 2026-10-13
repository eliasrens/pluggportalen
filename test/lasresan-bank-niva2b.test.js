// ============================================================================
// Läsresan nivå 2, del b (#662): 40 nya texter i level-2-b.json utöver de 30
// i level-2.json (som inte rörs – textId:n finns i elevernas historik).
// Samma krav som lasresan-bank-niva2.test.js + inga krockar med level-2.json.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { questionRange, validateBank, wordCount, answerPositionStats, answerLengthStats } from "../src/lasresan/content/validate.js";
import { OPTIONS_PER_QUESTION, CATEGORIES } from "../src/lasresan/config.js";

const dir = new URL("../src/lasresan/content/bank/", import.meta.url);
const read = (f) => JSON.parse(readFileSync(new URL(f, dir)));
const texts = read("level-2-b.json");
const old = read("level-2.json");
const norm = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");

test("nivå 2 b: 40 texter, 20 story + 20 fact, id lr-g2-, level 2, i manifestet", () => {
  assert.equal(texts.length, 40);
  assert.equal(texts.filter((t) => t.textType === "story").length, 20);
  assert.equal(texts.filter((t) => t.textType === "fact").length, 20);
  for (const t of texts) {
    assert.equal(t.level, 2, t.id);
    assert.match(t.id, /^lr-g2-[a-z0-9-]+$/, t.id);
  }
  assert.deepEqual(read("manifest.json").levels["2"], ["level-2.json", "level-2-b.json"]);
});

test("nivå 2 b: inga id eller titlar som redan finns i level-2.json", () => {
  const ids = new Set(old.map((t) => t.id));
  const titles = new Set(old.map((t) => norm(t.title)));
  for (const t of texts) {
    assert.ok(!ids.has(t.id), `${t.id}: id finns redan`);
    assert.ok(!titles.has(norm(t.title)), `${t.id}: titeln finns redan`);
  }
  assert.equal(new Set(texts.map((t) => norm(t.title))).size, texts.length, "dubblett-titel i level-2-b.json");
});

test("nivå 2 b: 4–5 frågor per text och exakt ett giltigt answerIndex per fråga", () => {
  const [lo, hi] = questionRange(2);
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
      assert.ok(q.options.every((o) => o.trim().split(/\s+/).length <= 7), `${tag}: alternativ över 7 ord`);
    }
  }
});

test("nivå 2 b: 60–90 ord per text", () => {
  for (const t of texts) {
    const n = wordCount(t.body);
    assert.ok(n >= 60 && n <= 90, `${t.id}: ${n} ord`);
  }
});

test("nivå 2 b: A–D jämnt fördelat och ingen längdledtråd (unikt längst 15–30 %)", () => {
  const pos = answerPositionStats(texts)[2];
  const total = pos.reduce((a, b) => a + b, 0);
  for (const c of pos) assert.ok(Math.abs(c / total - 0.25) <= 0.03, `A–D ${pos.join("/")}`);
  const { longest } = answerLengthStats(texts)[2];
  assert.ok(longest / total >= 0.15 && longest / total <= 0.3, `unikt längst ${longest}/${total}`);
});

test("nivå 2 b: validateBank på hela banken ger 0 fel och 0 varningar, nivå 2 har 70 texter", () => {
  const all = Object.values(read("manifest.json").levels).flat().flatMap(read);
  const r = validateBank(all);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.stats.perLevel[2], 70);
  assert.deepEqual(validateBank(texts).warnings, [], "level-2-b.json ensam");
});

test("nivå 2 b: mest faktafrågor, högst en slutsatsfråga per text, alla fyra kategorier används", () => {
  for (const t of texts) {
    const inf = t.questions.filter((q) => q.category === "mellan_raderna" || q.category === "helhet_slutsats").length;
    assert.ok(inf <= 1, `${t.id}: ${inf} slutsatsfrågor`);
    assert.ok(t.questions.filter((q) => q.category === "fakta").length >= 3, t.id);
  }
  const used = new Set(texts.flatMap((t) => t.questions.map((q) => q.category)));
  assert.deepEqual([...used].sort(), [...CATEGORIES].sort());
});
