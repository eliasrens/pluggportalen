// ============================================================================
// Enhetstest för "Kopiera AI-prompt för mer innehåll" (issue #453):
//   • buildMorePrompt bygger på buildAreaPrompt oförändrad (områdets typer + årskurs)
//   • tillägget ber om BARA nytt innehåll och listar befintliga frågor/par att undvika
//   • läsförståelse-passager och inga nya typ-id.
// Issue #471 (HELA befintliga innehållet som JSON, tak i tecken) testas i
// test/prompts-existing.test.js.
// Körs med Node:s inbyggda testkörare:  node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildAreaPrompt, buildMorePrompt } from "../src/prompts.js";

const area = (extra = {}) => ({
  id: "handel",
  name: "Handel förr",
  grade: "ak6",
  exerciseTypes: ["quiz", "pairs"],
  quiz: [
    { question: "Vad sålde hansan?", options: ["Salt", "Bilar", "Te", "Ris"], answerIndex: 0 },
    { question: "Vilken stad var viktig?", options: ["Visby", "Oslo", "Rom", "Paris"], answerIndex: 0 },
  ],
  pairs: [{ term: "Kogg", definition: "Ett handelsskepp" }],
  ...extra,
});

test("buildMorePrompt börjar med buildAreaPrompt för områdets typer, önskemål och årskurs", () => {
  const a = area();
  const p = buildMorePrompt(a, "fler svåra frågor om handel");
  const bas = buildAreaPrompt(
    ["quiz", "pairs"],
    'Mer innehåll till det befintliga arbetsområdet "Handel förr". Önskemål: fler svåra frågor om handel',
    "ak6"
  );
  assert.ok(p.startsWith(bas), "prompten ska börja med den oförändrade buildAreaPrompt-texten");
  assert.match(p, /årskurs 6/);
  assert.match(p, /fler svåra frågor om handel/);
});

test("buildMorePrompt utan önskemål ger ändå ett önskemål om området (ingen PDF-platshållare)", () => {
  const p = buildMorePrompt(area(), "");
  assert.match(p, /Mer innehåll till det befintliga arbetsområdet "Handel förr"/);
  assert.doesNotMatch(p, /KLISTRA IN DIN LEKTIONSTEXT/);
});

test("buildMorePrompt ber om bara nytt innehåll och listar befintliga frågor och par", () => {
  const p = buildMorePrompt(area());
  assert.match(p, /MER innehåll till ett BEFINTLIGT arbetsområde/);
  assert.match(p, /BARA med det NYA innehållet/);
  assert.match(p, /"question":"Vad sålde hansan\?"/);
  assert.match(p, /"question":"Vilken stad var viktig\?"/);
  assert.match(p, /"term":"Kogg"/);
});

test("buildMorePrompt ber om passage när området har läsförståelse-frågor", () => {
  const med = buildMorePrompt(area({ quiz: [{ question: "Q?", options: ["a", "b"], answerIndex: 0, passage: "En text." }] }));
  assert.match(med, /läsförståelse: varje ny quizfråga MÅSTE ha en egen "passage"/);
  const utan = buildMorePrompt(area());
  assert.doesNotMatch(utan, /varje ny quizfråga MÅSTE ha en egen "passage"/);
});

test("prompterna: quizfrågor är kunskapsfrågor – passagen är bakgrund, \"enligt texten\" förbjudet (#582)", () => {
  const med = buildMorePrompt(area({ quiz: [{ question: "Q?", options: ["a", "b"], answerIndex: 0, passage: "En text." }] }));
  assert.match(med, /besvara med rätt ämneskunskap UTAN att läsa passagen/);
  assert.match(med, /"enligt texten", "i texten" och liknande är förbjudet/);
  const ny = buildAreaPrompt(["quiz"], "Vikingatiden", "ak4");
  assert.match(ny, /BAKGRUNDSINFORMATION/);
  assert.match(ny, /UTAN att läsa\s+passagen/);
  assert.match(ny, /FÖRBJUDNA/);
  assert.doesNotMatch(ny, /kan besvaras enbart utifrån/);
});

test("buildMorePrompt hittar inte på typer: rent quiz-område ber inte om par", () => {
  const p = buildMorePrompt(area({ exerciseTypes: ["quiz"], pairs: [] }));
  assert.ok(p.startsWith(buildAreaPrompt(["quiz"], 'Mer innehåll till det befintliga arbetsområdet "Handel förr"', "ak6")));
  assert.match(p, /Skapa INGA fakta-par/);
  assert.match(p, /Hitta inte på nya övningstyper/);
});

test("buildMorePrompt skickar inte räknegeneratorn som typ och tål ett tomt område", () => {
  const gen = buildMorePrompt({ name: "Gångertabell", exerciseTypes: ["generator"] });
  assert.ok(gen.startsWith(buildAreaPrompt([], 'Mer innehåll till det befintliga arbetsområdet "Gångertabell"', null)));
  assert.doesNotMatch(gen, /BEFINTLIGT INNEHÅLL/);
  assert.doesNotThrow(() => buildMorePrompt({}));
});
