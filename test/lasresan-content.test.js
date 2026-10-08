// ============================================================================
// Läsresan (#399): innehåll – validator (content/validate.js) på dev-seed,
// felfall, och loadern (content/loader.js) med fejk-fetch: bank, lat laddning
// per nivå, trasiga texter hoppas över, fallback till dev-seed.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateBank,
  validateText,
  wordCount,
  answerPositionStats,
  answerLengthStats,
  questionRange,
  levelFromId,
} from "../src/lasresan/content/validate.js";
import { DEV_SEED } from "../src/lasresan/content/dev-seed.js";
import { createLoader } from "../src/lasresan/content/loader.js";

const clone = (x) => JSON.parse(JSON.stringify(x));

test("dev-seed: 4 referenstexter (gamla nivå 1/3/5/7 = nya 4/6/8/10), inga fel", () => {
  const r = validateBank(DEV_SEED);
  assert.deepEqual(r.errors, []);
  // Spec:ens egen (gamla) nivå 7-referenstext är 259 ord (riktintervall 280–500).
  // Den citeras ordagrant, så den ENDA varningen är just ordantalet där.
  assert.deepEqual(r.warnings, ["lr-n7-nar-alven-andrar-vag: 259 ord (riktintervall nivå 10: 280–500)"]);
  assert.deepEqual(DEV_SEED.map((t) => t.level), [4, 6, 8, 10]);
  for (const t of DEV_SEED) {
    assert.ok(t.questions.length >= 5, `${t.id} har ${t.questions.length} frågor`);
    assert.match(t.id, /^lr-n\d-[a-z0-9-]+$/);
  }
  // Rätt svars position varierar (alla fyra positioner används).
  const all = [0, 0, 0, 0];
  for (const row of Object.values(answerPositionStats(DEV_SEED))) row.forEach((c, i) => (all[i] += c));
  assert.ok(all.every((c) => c > 0), `positioner ${all}`);
});

test("validateText: fel för kontraktsbrott", () => {
  const base = clone(DEV_SEED[0]);
  const err = (mut) => { const t = clone(base); mut(t); return validateText(t).errors; };
  assert.ok(err((t) => (t.questions[0].options = ["a", "b", "c"])).length > 0);
  assert.ok(err((t) => (t.questions[0].answerIndex = 4)).length > 0);
  assert.ok(err((t) => (t.questions[0].category = "gissning")).length > 0);
  assert.ok(err((t) => (t.questions = t.questions.slice(0, 4))).length > 0);
  assert.ok(err((t) => (t.questions = [...t.questions, ...t.questions].map((q, i) => ({ ...q, id: `q${i}` })))).length > 0); // 10 frågor
  assert.ok(err((t) => (t.questions[1].id = "q1")).some((e) => e.includes("dubblett")));
  assert.ok(err((t) => (t.level = 11)).length > 0);
  assert.ok(err((t) => (t.level = 0)).length > 0);
  assert.ok(err((t) => (t.textType = "poem")).length > 0);
  assert.ok(err((t) => delete t.title).length > 0);
});

test("validateText: ordantal utanför riktintervallet = VARNING, inte fel", () => {
  const t = clone(DEV_SEED[0]);
  t.body = "Kort text.";
  const r = validateText(t);
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((w) => w.includes("ord")));
  assert.equal(wordCount("Hej – du där! ”Kom”"), 4);
});

test("validateBank: dubblett-id i banken + skev svarsposition varnas", () => {
  const a = clone(DEV_SEED[1]);
  assert.ok(validateBank([a, clone(a)]).errors.some((e) => e.includes("dubblett-id i banken")));
  // 3 texter × 6 frågor, alla rätt = A → skev
  const skew = [0, 1, 2].map((i) => {
    const t = clone(DEV_SEED[1]);
    t.id = `lr-n3-skev-${i}`;
    t.questions.forEach((q) => (q.answerIndex = 0));
    return t;
  });
  const r = validateBank(skew);
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((w) => w.includes("skev")));
});

/**
 * 3 nivå 6-texter (DEV_SEED[1]) × 6 frågor = 18 flervalsfrågor, rätt svar roterar A–D (ingen
 * positionsskevhet). `isLongest(n)` avgör om fråga n (0–17) får rätt svar som
 * unikt längst; annars är rätt svar kortast.
 */
function lengthBank(isLongest) {
  let n = 0;
  return [0, 1, 2].map((i) => {
    const t = clone(DEV_SEED[1]);
    t.id = `lr-n3-langd-${i}`; // lr-n3 = nivå 6
    t.questions.forEach((q) => {
      const k = n++;
      q.answerIndex = k % 4;
      q.options = ["Fel svar ett", "Fel svar två", "Fel svar tre", "Fel svar fyra"];
      q.options[q.answerIndex] = isLongest(k) ? "Det här rätta svaret är längst" : "Rätt";
    });
    return t;
  });
}
const lengthWarnings = (r) => r.warnings.filter((w) => w.includes("längdledtråd"));

test("validateBank: rätt svar unikt längst i >45 % → varning med antal och procent", () => {
  const r = validateBank(lengthBank((k) => k < 9 || k === 17)); // 10 av 18
  assert.deepEqual(r.errors, []);
  assert.deepEqual(lengthWarnings(r), [
    "nivå 6: rätt svar är unikt längst i 10 av 18 frågor (56 %, över 45 %) – längdledtråd",
  ]);
  assert.deepEqual(r.stats.answerLengths, { 6: { longest: 10, total: 18 } });
});

test("validateBank: rätt svar unikt längst i <10 % → varning", () => {
  const r = validateBank(lengthBank((k) => k === 0)); // 1 av 18
  assert.deepEqual(r.errors, []);
  assert.deepEqual(lengthWarnings(r), [
    "nivå 6: rätt svar är unikt längst i 1 av 18 frågor (6 %, under 10 %) – längdledtråd",
  ]);
});

test("validateBank: normal längdfördelning → ingen längdvarning; lika långt räknas inte som unikt längst", () => {
  const r = validateBank(lengthBank((k) => k % 3 === 0)); // 6 av 18 = 33 %
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  // Delad längsta längd (efter trim) är inte "unikt längst".
  const tie = { level: 2, questions: [{ options: ["  Lika lång  ", "Lika lång", "kort", "kort2"], answerIndex: 0 }] };
  assert.deepEqual(answerLengthStats([tie]), { 2: { longest: 0, total: 1 } });
  // För litet urval (dev-seed: ≤ 9 frågor per nivå) kontrolleras inte.
  assert.deepEqual(lengthWarnings(validateBank(lengthBank(() => true).slice(0, 1))), []);
});

test("innehållsbanken (content/bank/): validateBank ger 0 fel och 0 varningar", () => {
  const dir = new URL("../src/lasresan/content/bank/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", dir)));
  const texts = Object.values(manifest.levels).flat().flatMap((f) => JSON.parse(readFileSync(new URL(f, dir))));
  const r = validateBank(texts);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.validTexts.length, texts.length);
});

/** Fejk-fetch över en filkarta { "manifest.json": obj, ... }. */
function fakeFetch(files) {
  const calls = [];
  const fn = async (url) => {
    const name = url.split("/").pop();
    calls.push(name);
    if (!(name in files)) return { ok: false, status: 404, json: async () => null };
    return { ok: true, status: 200, json: async () => clone(files[name]) };
  };
  fn.calls = calls;
  return fn;
}
const quiet = () => {};

test("loader: ingen bank (404) → dev-seed", async () => {
  const L = createLoader({ fetch: fakeFetch({}), baseUrl: "http://x/bank/", warn: quiet });
  assert.equal((await L.loadBank()).length, 4);
  assert.equal(await L.source(), "dev-seed");
  assert.equal((await L.loadLevel(6))[0].id, "lr-n3-bollen-som-forsvann");
  assert.deepEqual(await L.loadLevel(1), []);
  assert.equal((await L.findText("lr-n7-nar-alven-andrar-vag")).level, 10);
});

test("loader: bank via manifest, lat per nivå, flera filer, trasig text hoppas över", async () => {
  const n3 = clone(DEV_SEED[1]);
  const n3b = { ...clone(DEV_SEED[1]), id: "lr-n3-annan" };
  const broken = { ...clone(DEV_SEED[1]), id: "lr-n3-trasig", questions: [] };
  const n5 = clone(DEV_SEED[2]);
  const fetch = fakeFetch({
    "manifest.json": { version: 1, levels: { 6: ["level-6.json", "level-6b.json"], 8: ["level-8.json"] } },
    "level-6.json": [n3, broken],
    "level-6b.json": [n3b],
    "level-8.json": [n5],
  });
  const L = createLoader({ fetch, baseUrl: "http://x/bank/", warn: quiet });
  const lvl6 = await L.loadLevel(6);
  assert.deepEqual(lvl6.map((t) => t.id), ["lr-n3-bollen-som-forsvann", "lr-n3-annan"]);
  assert.equal(fetch.calls.includes("level-8.json"), false, "nivå 8 laddas inte i onödan");
  assert.equal(await L.source(), "bank");
  assert.equal((await L.loadBank()).length, 3);
  assert.equal((await L.findText("lr-n5-den-tomma-platsen")).title, "Den tomma platsen");
  assert.equal(fetch.calls.filter((c) => c === "level-8.json").length, 1, "lr-n5 slås upp på nivå 8");
  assert.equal(await L.findText("lr-n5-finns-inte"), null);
  assert.equal(fetch.calls.filter((c) => c === "manifest.json").length, 1, "manifestet cachas");
});

test("loader: listad nivåfil saknas (404) → varning, dev-seed för just den nivån", async () => {
  const n3 = { ...clone(DEV_SEED[1]), id: "lr-n3-ur-banken" };
  const warnings = [];
  const fetch = fakeFetch({
    "manifest.json": { version: 1, levels: { 4: ["level-4.json"], 5: ["level-5.json"], 6: ["level-6.json"] } },
    "level-6.json": [n3],
  });
  const L = createLoader({ fetch, baseUrl: "http://x/bank/", warn: (...a) => warnings.push(a.join(" ")) });
  assert.deepEqual((await L.loadLevel(4)).map((t) => t.id), ["lr-n1-katten-i-regnet"]); // seed
  assert.deepEqual(await L.loadLevel(5), []); // seed saknar nivå 5 → tom, pickern tar närmaste nivå
  assert.deepEqual((await L.loadBank()).map((t) => t.id), ["lr-n1-katten-i-regnet", "lr-n3-ur-banken"]);
  assert.equal(await L.source(), "bank");
  assert.ok(warnings.some((w) => w.includes("level-4.json")));
});

test("loader: bank utan giltiga texter → dev-seed", async () => {
  const fetch = fakeFetch({
    "manifest.json": { version: 1, levels: { 1: ["level-1.json"] } },
    "level-1.json": [{ id: "trasig" }],
  });
  const L = createLoader({ fetch, baseUrl: "http://x/bank/", warn: quiet });
  assert.equal((await L.loadBank()).length, 4);
  assert.equal(await L.source(), "dev-seed");
});
