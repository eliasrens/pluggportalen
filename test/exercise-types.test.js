// ============================================================================
// Enhetstest för övningstyper per arbetsområde (issue #39):
//   • exercise-types.js: normalisering + härledning ur innehåll
//   • validate.js: exerciseTypes sparas (explicit eller härlett)
//   • prompts.js: buildAreaPrompt speglar valen (bl.a. inga bildpar när ovalt)
// Körs med Node:s inbyggda testkörare:  node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  EXERCISE_TYPES,
  normalizeExerciseTypes,
  deriveExerciseTypes,
  areaExerciseTypes,
} from "../src/exercise-types.js";
import { validateArea } from "../src/validate.js";
import { buildAreaPrompt } from "../src/prompts.js";

// --- exercise-types.js ------------------------------------------------------

test("EXERCISE_TYPES har de tre valbara typerna", () => {
  const ids = EXERCISE_TYPES.map((t) => t.id);
  assert.deepEqual(ids, ["quiz", "pairs", "bildpar"]);
});

test("normalizeExerciseTypes rensar okända id och dubbletter, kanonisk ordning", () => {
  assert.deepEqual(normalizeExerciseTypes(["bildpar", "quiz", "xxx", "quiz"]), ["quiz", "bildpar"]);
  assert.deepEqual(normalizeExerciseTypes("inte-en-lista"), []);
  assert.deepEqual(normalizeExerciseTypes(undefined), []);
});

test("deriveExerciseTypes härleder typer ur innehållet", () => {
  assert.deepEqual(deriveExerciseTypes({ quiz: [{}], pairs: [] }), ["quiz"]);
  assert.deepEqual(deriveExerciseTypes({ pairs: [{ term: "a", definition: "b" }] }), ["pairs"]);
  assert.deepEqual(
    deriveExerciseTypes({ quiz: [{}], pairs: [{ term: "", termImage: "partier/s", definition: "S" }] }),
    ["quiz", "pairs", "bildpar"]
  );
  assert.deepEqual(deriveExerciseTypes({}), []);
});

test("areaExerciseTypes: explicit vinner, annars härlett", () => {
  assert.deepEqual(areaExerciseTypes({ exerciseTypes: ["quiz"], pairs: [{ term: "a", definition: "b" }] }), ["quiz"]);
  assert.deepEqual(areaExerciseTypes({ pairs: [{ term: "a", definition: "b" }] }), ["pairs"]);
});

// --- validate.js: exerciseTypes på det sparade dokumentet -------------------

test("validateArea sparar explicit exerciseTypes (normaliserat)", () => {
  const res = validateArea({
    name: "Test",
    quiz: [{ question: "q", options: ["a", "b", "c", "d"], answerIndex: 0, passage: "p" }],
    exerciseTypes: ["quiz", "bogus"],
  });
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.deepEqual(res.value.exerciseTypes, ["quiz"]);
});

test("validateArea härleder exerciseTypes när fältet saknas (bakåtkompatibelt)", () => {
  const res = validateArea({ name: "Test", pairs: [{ term: "a", definition: "b" }] });
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.deepEqual(res.value.exerciseTypes, ["pairs"]);
});

// --- prompts.js: buildAreaPrompt --------------------------------------------

test("buildAreaPrompt(['quiz']) ber inte om fakta-par eller bildpar", () => {
  const p = buildAreaPrompt(["quiz"]);
  assert.match(p, /quiz \(Quiz, Läsförståelse och Kunskapsjakt\)/);
  assert.match(p, /Skapa INGA fakta-par/);
  assert.doesNotMatch(p, /BILDPAR \(valfritt\)/);
});

test("buildAreaPrompt(['pairs']) förbjuder bildpar uttryckligen och utelämnar quiz", () => {
  const p = buildAreaPrompt(["pairs"]);
  assert.match(p, /Använd INGA bildpar/);
  assert.match(p, /Skapa INGA quizfrågor/);
  assert.doesNotMatch(p, /"termImage": "partier\/s"/); // exemplet visar inget bildpar
});

test("buildAreaPrompt med bildpar tar med bildpar-instruktion och exempel", () => {
  const p = buildAreaPrompt(["quiz", "pairs", "bildpar"]);
  assert.match(p, /BILDPAR \(valfritt\)/);
  assert.match(p, /"termImage": "partier\/s"/);
});

test("buildAreaPrompt utan val faller tillbaka till quiz + text-par (inga bildpar)", () => {
  const p = buildAreaPrompt([]);
  assert.match(p, /Quizfrågor/);
  assert.match(p, /Fakta-par/);
  assert.match(p, /Använd INGA bildpar/);
});

test("buildAreaPrompt väver in fritext-önskemål i stället för material-platshållaren", () => {
  const p = buildAreaPrompt(["quiz"], "Politik för åk 4");
  assert.match(p, /Lärarens önskemål/);
  assert.match(p, /Politik för åk 4/);
  assert.doesNotMatch(p, /KLISTRA IN DIN LEKTIONSTEXT/);
});
