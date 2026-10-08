// ============================================================================
// Enhetstest för "BEFINTLIGT INNEHÅLL" i AI-prompterna (issue #471):
//   • mer-innehåll-prompten skickar med ALLT: fråga, alternativ, rätt svar,
//     kategori, passage, par med definition och texter
//   • blocket är giltig JSON i samma format som AI:n svarar i
//   • ingen avkortning för normalstora områden; jätteområden kortas rättvist
//     och får en notering om vad som utelämnades
//   • räknegeneratorns räknesätt nämns som kontext (#470)
//   • gamla nivåtexter (readingTexts, borttagna i #531) skickas INTE med
// Körs med Node:s inbyggda testkörare:  node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildMorePrompt, MORE_PROMPT_MAX_CHARS } from "../src/prompts.js";
import { existingContentJson } from "../src/prompt-existing.js";
import { parseAndMergeArea } from "../src/merge-area.js";
import { validateArea } from "../src/validate.js";

// Gamla nivåtexter (#152) kan ligga kvar i äldre områdesdokument – de ska
// ignoreras helt sedan #531.
const nivatext = (title) => ({
  title,
  levels: Object.fromEntries(
    ["1", "2", "3"].map((l) => [
      l,
      {
        body: `${title}, brödtext nivå ${l}.`,
        questions: [1, 2, 3].map((n) => ({ question: `${title} fråga ${n} nivå ${l}?`, options: ["Ja", "Nej"], answerIndex: 1 })),
      },
    ])
  ),
});

const area = (extra = {}) => ({
  id: "handel",
  name: "Handel förr",
  grade: "ak6",
  exerciseTypes: ["quiz", "pairs"],
  texts: [{ id: "t1", title: "Hansan", body: "Hansan var ett förbund av handelsstäder." }],
  quiz: [
    {
      id: "q1",
      question: "Vad sålde hansan?",
      options: ["Salt", "Bilar", "Te", "Ris"],
      answerIndex: 0,
      category: "fakta",
      explanation: "Salt var en viktig vara.",
    },
    { id: "q2", question: "Varför växte Visby?", options: ["Handel", "Gruvor"], answerIndex: 0, passage: "Visby låg mitt i Östersjön." },
  ],
  pairs: [{ id: "p1", term: "Kogg", definition: "Ett handelsskepp" }],
  readingTexts: [nivatext("Vikingarnas resor")],
  ...extra,
});

/** Plocka ut och tolka JSON-blocket efter rubriken "BEFINTLIGT INNEHÅLL". */
function blockJson(prompt) {
  const start = prompt.indexOf("{", prompt.indexOf("BEFINTLIGT INNEHÅLL"));
  const end = prompt.indexOf("\n}", start) + 2;
  return JSON.parse(prompt.slice(start, end));
}

test("mer-innehåll-prompten skickar med svar, alternativ, kategori, passage, definitioner och texter", () => {
  const p = buildMorePrompt(area());
  assert.match(p, /BEFINTLIGT INNEHÅLL/);
  const b = blockJson(p);
  assert.deepEqual(b.texts, [{ title: "Hansan", body: "Hansan var ett förbund av handelsstäder." }]);
  assert.deepEqual(b.quiz[0], {
    question: "Vad sålde hansan?",
    options: ["Salt", "Bilar", "Te", "Ris"],
    answerIndex: 0,
    category: "fakta",
    explanation: "Salt var en viktig vara.",
  });
  assert.equal(b.quiz[1].passage, "Visby låg mitt i Östersjön.");
  assert.deepEqual(b.pairs, [{ term: "Kogg", definition: "Ett handelsskepp" }]);
  assert.equal(b.readingTexts, undefined, "gamla nivåtexter skickas inte med (#531)");
  assert.doesNotMatch(p, /readingTexts|nivåtext/);
  assert.match(p, /bygg vidare i samma stil/);
  assert.doesNotMatch(p, /utelämnades/);
});

test("ingen avkortning för ett normalstort område (100 frågor, 60 par, 10 texter)", () => {
  const quiz = Array.from({ length: 100 }, (_, i) => ({
    question: `Fråga nummer ${i} om handel under medeltiden?`,
    options: ["Svar A", "Svar B", "Svar C", "Svar D"],
    answerIndex: i % 4,
    category: "fakta",
  }));
  const pairs = Array.from({ length: 60 }, (_, i) => ({ term: `Begrepp ${i}`, definition: `Förklaring ${i}` }));
  const texts = Array.from({ length: 10 }, (_, i) => ({ title: `Text ${i}`, body: "Lite brödtext. ".repeat(20) }));
  const p = buildMorePrompt(area({ quiz, pairs, texts }));
  const b = blockJson(p);
  assert.equal(b.quiz.length, 100);
  assert.equal(b.pairs.length, 60);
  assert.equal(b.texts.length, 10);
  assert.equal(b.quiz[99].question, "Fråga nummer 99 om handel under medeltiden?");
  assert.doesNotMatch(p, /utelämnades/);
});

test("jätteområde kortas till taket, alla typer får plats och noteringen säger vad som saknas", () => {
  const quiz = Array.from({ length: 2000 }, (_, i) => ({
    question: `Fråga ${i}?`,
    options: ["a", "b", "c", "d"],
    answerIndex: 0,
    passage: "En lång passage. ".repeat(10),
  }));
  const pairs = Array.from({ length: 900 }, (_, i) => ({ term: `Begrepp ${i}`, definition: "x ".repeat(30) }));
  const p = buildMorePrompt(area({ quiz, pairs }));
  const blockStart = p.indexOf("BEFINTLIGT INNEHÅLL");
  const b = blockJson(p);
  assert.ok(p.length - blockStart < MORE_PROMPT_MAX_CHARS + 1000, "blocket håller sig kring taket");
  assert.ok(b.quiz.length > 50 && b.quiz.length < 2000);
  assert.ok(b.pairs.length > 50 && b.pairs.length < 900, "även paren får plats");
  assert.equal(b.texts.length, 1);
  const m = p.match(/(\d+) quizfrågor och (\d+) par utelämnades/);
  assert.ok(m, "noteringen räknar upp det utelämnade");
  assert.equal(Number(m[1]), 2000 - b.quiz.length);
  assert.equal(Number(m[2]), 900 - b.pairs.length);
});

test("existingContentJson: tomma fält och poster utelämnas, inget innehåll → tom sträng", () => {
  assert.deepEqual(existingContentJson({}, ["quiz"]), { json: "", count: 0, omitted: {} });
  const r = existingContentJson({ quiz: [{ question: " Q? ", options: [], explanation: "" }, {}] }, ["quiz"]);
  assert.deepEqual(JSON.parse(r.json), { quiz: [{ question: "Q?" }] });
  assert.equal(r.count, 1);
});

test("ett AI-svar i samma format som blocket mergas som förut", () => {
  const v = validateArea(area());
  assert.equal(v.ok, true, v.errors?.join("\n"));
  const existing = v.value;
  const nytt = { quiz: [{ question: "Vad var en kogg?", options: ["Ett skepp", "En häst"], answerIndex: 0 }] };
  const res = parseAndMergeArea(JSON.stringify(nytt), existing);
  assert.equal(res.ok, true, res.errors?.join("\n"));
  assert.equal(res.added.quiz, 1);
  assert.equal(res.value.readingTexts, undefined, "gamla nivåtexter följer inte med (#531)");
});

test("generator-område: valda räknesätt och varianter nämns som kontext", () => {
  const p = buildMorePrompt({
    name: "Blandat",
    exerciseTypes: ["generator"],
    generator: { topics: [{ topic: "addition", variants: ["enkel"] }, { topic: "negativa-tal", variants: ["temperatur", "rakna"] }] },
  });
  assert.match(p, /räknegenerator .* räknesätten: Addition \(Enkel\); Negativa tal \(Temperatur, Rakna\)/);
  assert.doesNotMatch(p, /befintliga innehållet nedan/, "ingen hänvisning till ett block som saknas");
  assert.doesNotMatch(buildMorePrompt(area()), /räknegenerator som skapar/);
});
