// ============================================================================
// Enhetstest för läsförståelse i 3 nivåer (issue #152):
//   • validate.js / validate-reading.js: datamodell + felmeddelanden + bakåtkompat
//   • prompt-reading.js: exempel-JSON validerar; prompten nämner alla tre nivåer
//   • merge-area.js: readingTexts tappas inte när man "lägger till innehåll"
// Körs med Node:s inbyggda testkörare:  node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { validateArea } from "../src/validate.js";
import { parseAndMergeArea } from "../src/merge-area.js";
import { buildReadingPrompt, READING_EXAMPLE_JSON } from "../src/prompt-reading.js";

// En giltig läs-text (3 nivåer, egna frågor per nivå).
function readingText() {
  const level = (n) => ({
    body: `Brödtext för nivå ${n}. Stycke ett.\n\nStycke två med lite mer text.`,
    questions: [
      { question: `Fråga A nivå ${n}?`, options: ["Rätt", "Fel", "Fel", "Fel"], answerIndex: 0 },
      { question: `Fråga B nivå ${n}?`, options: ["Fel", "Rätt", "Fel"], answerIndex: 1 },
      { question: `Fråga C nivå ${n}?`, options: ["Fel", "Fel", "Rätt", "Fel"], answerIndex: 2 },
    ],
  });
  return { title: "Vikingarnas resor", levels: { 1: level(1), 2: level(2), 3: level(3) } };
}

function area(readingTexts) {
  return { name: "Vikingatiden", readingTexts };
}

// --- Datamodell -------------------------------------------------------------

test("giltig läs-text i 3 nivåer godkänns och normaliseras", () => {
  const res = validateArea(area([readingText()]));
  assert.equal(res.ok, true, res.errors.join("; "));
  assert.equal(res.value.readingTexts.length, 1);
  const rt = res.value.readingTexts[0];
  assert.equal(rt.id, "vikingarnas-resor"); // slug ur titeln
  assert.deepEqual(Object.keys(rt.levels).sort(), ["1", "2", "3"]);
  assert.equal(rt.levels["1"].questions.length, 3);
  // Frågornas id fylls i per nivå.
  assert.equal(rt.levels["2"].questions[0].id, "q1");
});

test("en saknad nivå ger ett tydligt fel", () => {
  const rt = readingText();
  delete rt.levels[2];
  const res = validateArea(area([rt]));
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => /nivå 2 saknas/i.test(e)), res.errors.join("; "));
});

test("för få frågor på en nivå ger fel (3–5 krävs)", () => {
  const rt = readingText();
  rt.levels[1].questions = rt.levels[1].questions.slice(0, 2);
  const res = validateArea(area([rt]));
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => /3–5 frågor/.test(e)), res.errors.join("; "));
});

test("ogiltigt answerIndex fångas", () => {
  const rt = readingText();
  rt.levels[3].questions[0].answerIndex = 9;
  const res = validateArea(area([rt]));
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => /answerIndex/.test(e)), res.errors.join("; "));
});

test("tom titel ger fel", () => {
  const rt = readingText();
  rt.title = "   ";
  const res = validateArea(area([rt]));
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => /title.*saknas/i.test(e)), res.errors.join("; "));
});

test("readingTexts måste vara en lista", () => {
  const res = validateArea({ name: "X", readingTexts: { foo: 1 } });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => /readingTexts.*lista/i.test(e)), res.errors.join("; "));
});

// --- Bakåtkompatibilitet ----------------------------------------------------

test("område utan readingTexts fungerar (fältet blir tom lista)", () => {
  const res = validateArea({
    name: "Gammalt område",
    quiz: [{ question: "Fråga?", options: ["A", "B"], answerIndex: 0 }],
  });
  assert.equal(res.ok, true, res.errors.join("; "));
  assert.deepEqual(res.value.readingTexts, []);
});

test("bara en läs-text räcker som innehåll (inget quiz/par krävs)", () => {
  const res = validateArea(area([readingText()]));
  assert.equal(res.ok, true, res.errors.join("; "));
});

// --- AI-prompt --------------------------------------------------------------

test("READING_EXAMPLE_JSON är giltig JSON och passerar valideringen", () => {
  const obj = JSON.parse(READING_EXAMPLE_JSON);
  const res = validateArea({ name: "Test", readingTexts: [obj] });
  assert.equal(res.ok, true, res.errors.join("; "));
  assert.equal(res.value.readingTexts[0].levels["1"].questions.length >= 3, true);
});

test("prompten ber om alla tre nivåerna och nämner önskemålet", () => {
  const p = buildReadingPrompt("Rymden");
  assert.ok(/"1"/.test(p) && /"2"/.test(p) && /"3"/.test(p));
  assert.ok(/Rymden/.test(p));
  const p2 = buildReadingPrompt("");
  assert.ok(/KLISTRA IN/.test(p2)); // platshållare när önskemål saknas
});

// --- Merge bevarar readingTexts ---------------------------------------------

test("att lägga till quiz-innehåll tappar inte befintliga readingTexts", () => {
  const existing = validateArea(area([readingText()])).value;
  const res = parseAndMergeArea(
    JSON.stringify({ quiz: [{ question: "Ny?", options: ["A", "B"], answerIndex: 0 }] }),
    existing
  );
  assert.equal(res.ok, true, res.errors.join("; "));
  assert.equal(res.value.readingTexts.length, 1);
  assert.equal(res.value.readingTexts[0].title, "Vikingarnas resor");
});
