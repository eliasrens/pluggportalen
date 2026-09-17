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
  normalizeGenerator,
  hasGeneratorContent,
  topicSupportsBildstod,
  generatorBildstodEnabled,
  talstorlekToGrade,
  listTalstorlekar,
  TALSTORLEK_OPTIONS,
} from "../src/exercise-types.js";
import { validateArea } from "../src/validate.js";
import { buildAreaPrompt } from "../src/prompts.js";

// --- exercise-types.js ------------------------------------------------------

test("EXERCISE_TYPES har de fyra valbara typerna (inkl. generator)", () => {
  const ids = EXERCISE_TYPES.map((t) => t.id);
  assert.deepEqual(ids, ["quiz", "pairs", "bildpar", "generator"]);
  // generator är genererad (egen kontroll, inte i AI-prompt-rutan).
  assert.equal(EXERCISE_TYPES.find((t) => t.id === "generator").generated, true);
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

// --- generator-innehåll (issue #279) ----------------------------------------

test("normalizeGenerator rensar mot adapterns topics/varianter", () => {
  // Giltig topic + varianter → normaliserat objekt.
  assert.deepEqual(
    normalizeGenerator({ topic: "addition", variants: ["enkel", "uppstallning", "enkel"] }),
    { topic: "addition", variants: ["enkel", "uppstallning"] } // dubblett rensad
  );
  // Okänd variant filtreras bort; kvar finns minst en → ok.
  assert.deepEqual(normalizeGenerator({ topic: "addition", variants: ["enkel", "bogus"] }), {
    topic: "addition",
    variants: ["enkel"],
  });
  // Årskurs vävs in när satt (normaliserad), utelämnas annars.
  assert.deepEqual(normalizeGenerator({ topic: "addition", variants: ["enkel"], grade: 3 }), {
    topic: "addition",
    variants: ["enkel"],
    grade: "ak3",
  });
});

test("normalizeGenerator ger null för okänt topic, ingen variant eller skräp", () => {
  assert.equal(normalizeGenerator({ topic: "bogus", variants: ["enkel"] }), null);
  assert.equal(normalizeGenerator({ topic: "addition", variants: [] }), null);
  assert.equal(normalizeGenerator({ topic: "addition", variants: ["bogus"] }), null);
  assert.equal(normalizeGenerator(null), null);
  assert.equal(normalizeGenerator("addition"), null);
  assert.equal(normalizeGenerator(undefined), null);
});

// --- generator-inställningar: talstorlek & bildstöd (issue #322) -------------

test("talstorlek: bara kända id behålls, mappas till en grade", () => {
  assert.deepEqual(listTalstorlekar(), ["liten", "mellan", "stor"]);
  // Känt id sparas oförändrat på configen.
  assert.equal(
    normalizeGenerator({ topic: "addition", variants: ["enkel"], talstorlek: "stor" }).talstorlek,
    "stor"
  );
  // Okänt/tomt talstorlek utelämnas (bakåtkompatibelt → styrs av årskurs/adapterns default).
  assert.equal("talstorlek" in normalizeGenerator({ topic: "addition", variants: ["enkel"], talstorlek: "bogus" }), false);
  assert.equal("talstorlek" in normalizeGenerator({ topic: "addition", variants: ["enkel"] }), false);
  // Varje option pekar på en giltig grade (1–6) och listan matchar mappningen.
  for (const o of TALSTORLEK_OPTIONS) {
    assert.equal(talstorlekToGrade(o.id), o.grade);
    assert.ok(o.grade >= 1 && o.grade <= 6);
  }
  // Storleken monotont stigande (liten < mellan < stor).
  assert.ok(talstorlekToGrade("liten") < talstorlekToGrade("mellan"));
  assert.ok(talstorlekToGrade("mellan") < talstorlekToGrade("stor"));
  assert.equal(talstorlekToGrade(""), null);
});

test("bildstöd: relevant bara för multiplikation/division; sparas bara där, default på", () => {
  assert.equal(topicSupportsBildstod("multiplikation"), true);
  assert.equal(topicSupportsBildstod("division"), true);
  assert.equal(topicSupportsBildstod("addition"), false);
  assert.equal(topicSupportsBildstod(""), false);

  // Explicit på/av sparas som boolean på ett bildstöds-topic.
  assert.equal(
    normalizeGenerator({ topic: "multiplikation", variants: ["tabeller"], bildstod: false }).bildstod,
    false
  );
  assert.equal(
    normalizeGenerator({ topic: "multiplikation", variants: ["tabeller"], bildstod: true }).bildstod,
    true
  );
  // Saknas fältet helt → utelämnas (tolkas som på via BILDSTOD_DEFAULT nedströms).
  assert.equal(
    "bildstod" in normalizeGenerator({ topic: "multiplikation", variants: ["tabeller"] }),
    false
  );
  // Icke-boolean skräp ignoreras (ingen bildstod sparas).
  assert.equal(
    "bildstod" in normalizeGenerator({ topic: "multiplikation", variants: ["tabeller"], bildstod: "ja" }),
    false
  );
  // Ett icke-bildstöds-topic får ALDRIG ett bildstod-fält, även om det skickas in.
  assert.equal(
    "bildstod" in normalizeGenerator({ topic: "addition", variants: ["enkel"], bildstod: false }),
    false
  );
});

test("generatorBildstodEnabled: default på för bildstöds-topics, av med false, aldrig för övriga", () => {
  assert.equal(generatorBildstodEnabled({ topic: "multiplikation", variants: ["tabeller"] }), true);
  assert.equal(generatorBildstodEnabled({ topic: "division", variants: ["tabeller"] }), true);
  assert.equal(generatorBildstodEnabled({ topic: "multiplikation", variants: ["tabeller"], bildstod: false }), false);
  assert.equal(generatorBildstodEnabled({ topic: "addition", variants: ["enkel"] }), false);
  assert.equal(generatorBildstodEnabled(null), false);
});

test("hasGeneratorContent speglar en giltig area.generator", () => {
  assert.equal(hasGeneratorContent({ generator: { topic: "division", variants: ["tabeller"] } }), true);
  assert.equal(hasGeneratorContent({ generator: { topic: "division", variants: [] } }), false);
  assert.equal(hasGeneratorContent({}), false);
});

test("deriveExerciseTypes tar med generator (och håller isär från quiz/pairs)", () => {
  assert.deepEqual(deriveExerciseTypes({ generator: { topic: "addition", variants: ["enkel"] } }), [
    "generator",
  ]);
  assert.deepEqual(
    deriveExerciseTypes({ quiz: [{}], generator: { topic: "addition", variants: ["enkel"] } }),
    ["quiz", "generator"]
  );
  // Ogiltig generator ger ingen generator-typ.
  assert.deepEqual(deriveExerciseTypes({ generator: { topic: "bogus", variants: ["enkel"] } }), []);
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

// --- validate.js: generator-område (issue #279) -----------------------------

test("validateArea godtar ett rent generator-område (inget quiz/pairs)", () => {
  const res = validateArea({
    name: "Multiplikationsträning",
    generator: { topic: "multiplikation", variants: ["tabeller", "dubbelt"], grade: 3 },
  });
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.deepEqual(res.value.generator, {
    topic: "multiplikation",
    variants: ["tabeller", "dubbelt"],
    grade: "ak3",
  });
  // Härledd övningstyp = generator; inga quiz/pairs finns.
  assert.deepEqual(res.value.exerciseTypes, ["generator"]);
  assert.deepEqual(res.value.quiz, []);
  assert.deepEqual(res.value.pairs, []);
});

test("validateArea sparar talstorlek & bildstöd på generator-området (issue #322)", () => {
  const res = validateArea({
    name: "Multiplikation med stöd",
    generator: { topic: "multiplikation", variants: ["tabeller"], talstorlek: "stor", bildstod: false },
  });
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.deepEqual(res.value.generator, {
    topic: "multiplikation",
    variants: ["tabeller"],
    talstorlek: "stor",
    bildstod: false,
  });
});

test("validateArea godtar generator-område utan de nya fälten (bakåtkompatibelt)", () => {
  const res = validateArea({
    name: "Gammalt område",
    generator: { topic: "addition", variants: ["enkel"] },
  });
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.equal("talstorlek" in res.value.generator, false);
  assert.equal("bildstod" in res.value.generator, false);
});

test("validateArea ger tydligt fel för okänt topic / ingen variant", () => {
  const bad = validateArea({ name: "X", generator: { topic: "bogus", variants: ["enkel"] } });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => /okänt "topic"/.test(e)), bad.errors.join(" | "));

  const noVariant = validateArea({ name: "X", generator: { topic: "addition", variants: [] } });
  assert.equal(noVariant.ok, false);
  assert.ok(noVariant.errors.some((e) => /minst en variant/.test(e)), noVariant.errors.join(" | "));
});

test("validateArea rör inte vanliga områden – inget generator-fält utan generator", () => {
  const res = validateArea({
    name: "Vikingatiden",
    quiz: [{ question: "q", options: ["a", "b", "c", "d"], answerIndex: 0 }],
  });
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.equal("generator" in res.value, false);
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
