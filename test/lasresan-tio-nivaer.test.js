// ============================================================================
// Läsresan 10 nivåer (#518, epic #516): banken omnumrerad 1–7 → 4–10, tomma
// nivå 1–3, frågeantal per nivå, id-konventionen lr-n<N> (= nivå N+3) /
// lr-g<N> (= nivå N), och att loader/picker klarar tomma nivåer.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LEVEL_MIN,
  LEVEL_MAX,
  START_LEVEL,
  LEVEL_WORD_RANGES,
  QUESTIONS_BY_LEVEL,
} from "../src/lasresan/config.js";
import { validateBank, validateText, questionRange, levelFromId } from "../src/lasresan/content/validate.js";
import { DEV_SEED } from "../src/lasresan/content/dev-seed.js";
import { createLoader } from "../src/lasresan/content/loader.js";
import { pickText, levelSearchOrder } from "../src/lasresan/picker.js";

const clone = (x) => JSON.parse(JSON.stringify(x));
const LEVELS = Array.from({ length: LEVEL_MAX - LEVEL_MIN + 1 }, (_, i) => LEVEL_MIN + i);

/** En giltig text på `level` med `n` frågor (kopierade ur dev-seedens nivå 4-text). */
function textWith(level, n, id = `lr-g${level}-prov`) {
  const t = clone(DEV_SEED[0]);
  t.id = id;
  t.level = level;
  const qs = [];
  for (let i = 0; i < n; i++) qs.push({ ...clone(t.questions[i % t.questions.length]), id: `q${i + 1}` });
  t.questions = qs;
  return t;
}

test("config: nivå 1–10, start 4, ordintervall för varje nivå", () => {
  assert.equal(LEVEL_MIN, 1);
  assert.equal(LEVEL_MAX, 10);
  assert.equal(START_LEVEL, 4);
  assert.deepEqual(Object.keys(LEVEL_WORD_RANGES).map(Number), LEVELS);
  // Gamla nivå 1–7 flyttade oförändrade till 4–10.
  assert.deepEqual(LEVEL_WORD_RANGES[4], [60, 110]);
  assert.deepEqual(LEVEL_WORD_RANGES[10], [280, 500]);
  // Nya nivåer täcker spec:ens 30–50 / 60–90 / 100–140 ord.
  const covers = (lvl, lo, hi) => LEVEL_WORD_RANGES[lvl][0] <= lo && LEVEL_WORD_RANGES[lvl][1] >= hi;
  assert.ok(covers(1, 30, 50) && covers(2, 60, 90) && covers(3, 100, 140));
});

test("questionRange: nivå 1 = 3–4, 2 = 4–5, 3 = 5–7, 4–10 = 5–9", () => {
  assert.deepEqual(QUESTIONS_BY_LEVEL, { 1: [3, 4], 2: [4, 5], 3: [5, 7] });
  assert.deepEqual(questionRange(1), [3, 4]);
  assert.deepEqual(questionRange(2), [4, 5]);
  assert.deepEqual(questionRange(3), [5, 7]);
  for (const lvl of [4, 5, 6, 7, 8, 9, 10]) assert.deepEqual(questionRange(lvl), [5, 9]);
});

test("validateText: frågeantalet kontrolleras per nivå", () => {
  const errs = (level, n) => validateText(textWith(level, n)).errors;
  const qErr = (level, n) => errs(level, n).some((e) => e.includes("frågor (ska vara"));
  assert.deepEqual([2, 3, 4, 5].map((n) => qErr(1, n)), [true, false, false, true]);
  assert.deepEqual([3, 4, 5, 6].map((n) => qErr(2, n)), [true, false, false, true]);
  assert.deepEqual([4, 5, 7, 8].map((n) => qErr(3, n)), [true, false, false, true]);
  assert.deepEqual([4, 5, 9, 10].map((n) => qErr(10, n)), [true, false, false, true]);
  assert.ok(errs(1, 5).includes("lr-g1-prov: 5 frågor (ska vara 3–4)"));
  // Fortfarande exakt 4 alternativ och ett giltigt answerIndex även på nivå 1.
  const t = textWith(1, 3);
  t.questions[0].options = ["a", "b", "c"];
  t.questions[1].answerIndex = 4;
  assert.equal(validateText(t).errors.length, 2);
});

test("levelFromId + varning när id och level inte stämmer", () => {
  assert.equal(levelFromId("lr-g1-katten"), 1);
  assert.equal(levelFromId("lr-g3-x"), 3);
  assert.equal(levelFromId("lr-n1-tanden"), 4);
  assert.equal(levelFromId("lr-n7-x"), 10);
  assert.equal(levelFromId("trasig"), null);
  assert.equal(levelFromId(undefined), null);
  const warn = (id, level, n) => validateText(textWith(level, n, id)).warnings.filter((w) => w.includes("id:t hör till"));
  assert.deepEqual(warn("lr-g2-fel", 1, 3), ["lr-g2-fel: id:t hör till nivå 2 men level är 1"]);
  assert.deepEqual(warn("lr-n1-gammal", 1, 3), ["lr-n1-gammal: id:t hör till nivå 4 men level är 1"]);
  assert.deepEqual(warn("lr-g1-ratt", 1, 3), []);
  assert.deepEqual(warn("lr-n1-ratt", 4, 5), []);
  assert.deepEqual(warn("egen-text", 2, 4), []);
});

test("positions-/längdkontroll fungerar på nivåer med få frågor per text", () => {
  const skewBank = (texts) =>
    Array.from({ length: texts }, (_, i) => {
      const t = textWith(1, 3, `lr-g1-skev-${i}`);
      t.questions.forEach((q) => (q.answerIndex = 0));
      return t;
    });
  // 4 texter × 3 frågor = 12 (= ANSWER_SKEW_MIN_QUESTIONS) → kontrolleras.
  const r = validateBank(skewBank(4));
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((w) => w.startsWith("nivå 1: rätt svar är A i 12 av 12")));
  // 3 texter × 3 = 9 frågor → för litet urval, ingen positionsvarning.
  assert.ok(!validateBank(skewBank(3)).warnings.some((w) => w.includes("skev fördelning")));
});

test("banken: 40 texter per nivå 4–10 (lr-n<N> → nivå N+3), manifest 10 nivåer", () => {
  const dir = new URL("../src/lasresan/content/bank/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", dir)));
  assert.deepEqual(Object.keys(manifest.levels).map(Number), LEVELS);
  const perLevel = {};
  for (const lvl of LEVELS) {
    const texts = manifest.levels[lvl].flatMap((f) => JSON.parse(readFileSync(new URL(f, dir))));
    perLevel[lvl] = texts.length;
    for (const t of texts) {
      assert.equal(t.level, lvl, `${t.id} ligger i nivå ${lvl}s fil`);
      assert.equal(levelFromId(t.id), lvl, `${t.id}: id-prefixet stämmer med nivån`);
      const [lo, hi] = questionRange(lvl);
      assert.ok(t.questions.length >= lo && t.questions.length <= hi, t.id);
    }
  }
  // Nivå 1–3 fylls av delarna D1–D3 (epic #516) och räknas i egna banktester.
  for (const lvl of [4, 5, 6, 7, 8, 9, 10]) assert.equal(perLevel[lvl], 40, `nivå ${lvl}`);
});

test("loader + picker: tomma nivå 1–3 → närmaste nivå med texter", async () => {
  const n4 = { ...clone(DEV_SEED[0]), id: "lr-n1-ur-banken" };
  const files = {
    "manifest.json": { version: 1, levels: { 1: ["level-1.json"], 2: ["level-2.json"], 4: ["level-4.json"] } },
    "level-1.json": [],
    "level-2.json": [],
    "level-4.json": [n4],
  };
  const fetch = async (url) => {
    const name = url.split("/").pop();
    if (!(name in files)) return { ok: false, status: 404, json: async () => null };
    return { ok: true, status: 200, json: async () => clone(files[name]) };
  };
  const L = createLoader({ fetch, baseUrl: "http://x/bank/", warn: () => {} });
  assert.deepEqual(await L.loadLevel(1), []);
  assert.equal(await L.findText("lr-g1-finns-inte"), null);
  const bank = await L.loadBank();
  assert.equal(await L.source(), "bank");
  assert.equal(pickText(1, [], bank, { rng: () => 0 }).id, n4.id);
  assert.deepEqual(levelSearchOrder(1), LEVELS);
  assert.deepEqual(levelSearchOrder(10), [...LEVELS].reverse());
});
