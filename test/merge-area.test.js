// ============================================================================
// Enhetstest för "lägg till nytt innehåll i ett befintligt område" (issue #40):
//   • mergeAreaContent: behåller befintligt, lägger till nytt, hoppar dubbletter,
//     ger unika id, slår på nya övningstyper och slutvaliderar helheten.
//   • parseAndMergeArea: JSON-fel ger vänligt meddelande.
// Körs med Node:s inbyggda testkörare:  node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { mergeAreaContent, parseAndMergeArea } from "../src/merge-area.js";

// Ett litet befintligt (redan sparat) område att merga in i.
function baseArea() {
  return {
    id: "vikingatiden",
    name: "Vikingatiden",
    order: 2,
    coverEmoji: "⚔️",
    description: "Om vikingarna.",
    exerciseTypes: ["quiz"],
    texts: [{ id: "t1", title: "Vikingar", body: "De seglade långt." }],
    quiz: [
      { id: "q1", question: "Vad seglade vikingarna i?", options: ["Skepp", "Bil"], answerIndex: 0, explanation: "" },
    ],
    pairs: [],
  };
}

test("lägger till nya frågor sist och behåller befintliga", () => {
  const res = mergeAreaContent(baseArea(), {
    quiz: [{ question: "Vem var Oden?", options: ["En gud", "En bil"], answerIndex: 0 }],
  });
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.equal(res.value.quiz.length, 2);
  assert.equal(res.value.quiz[0].id, "q1"); // befintlig kvar först
  assert.equal(res.value.quiz[1].question, "Vem var Oden?");
  assert.equal(res.value.quiz[1].id, "q2"); // nytt unikt id efter q1
  assert.deepEqual(res.added, { texts: 0, quiz: 1, pairs: 0 });
  assert.deepEqual(res.skipped, { texts: 0, quiz: 0, pairs: 0 });
});

test("dubblett-fråga (samma frågetext + alternativ) hoppas över", () => {
  const res = mergeAreaContent(baseArea(), {
    quiz: [
      { question: "  vad seglade vikingarna i? ", options: ["skepp", "BIL"], answerIndex: 0 }, // dubblett
      { question: "Ny fråga?", options: ["Ja", "Nej"], answerIndex: 0 },
    ],
  });
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.equal(res.value.quiz.length, 2); // q1 + en ny (dubbletten hoppades)
  assert.deepEqual(res.added, { texts: 0, quiz: 1, pairs: 0 });
  assert.deepEqual(res.skipped, { texts: 0, quiz: 1, pairs: 0 });
});

test("nya par slår på övningstypen 'pairs' i ett tidigare rent quiz-område", () => {
  const res = mergeAreaContent(baseArea(), {
    pairs: [{ term: "Oden", definition: "Gudarnas kung" }],
  });
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.equal(res.value.pairs.length, 1);
  assert.equal(res.value.pairs[0].id, "p1");
  assert.deepEqual(res.value.exerciseTypes, ["quiz", "pairs"]);
  assert.deepEqual(res.added, { texts: 0, quiz: 0, pairs: 1 });
});

test("unika id räknas vidare från högsta befintliga suffix", () => {
  const area = baseArea();
  area.pairs = [{ id: "p3", term: "A", definition: "a" }];
  const res = mergeAreaContent(area, {
    pairs: [
      { term: "B", definition: "b" },
      { term: "C", definition: "c" },
    ],
  });
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.deepEqual(res.value.pairs.map((p) => p.id), ["p3", "p4", "p5"]);
});

test("dubblett-par (samma term + definition) hoppas över", () => {
  const area = baseArea();
  area.pairs = [{ id: "p1", term: "Oden", definition: "Gudarnas kung" }];
  const res = mergeAreaContent(area, {
    pairs: [{ term: " oden ", definition: "GUDARNAS kung" }],
  });
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.equal(res.value.pairs.length, 1);
  assert.deepEqual(res.skipped, { texts: 0, quiz: 0, pairs: 1 });
});

test("fel i det nya innehållet rapporteras (t.ex. saknat svarsalternativ)", () => {
  const res = mergeAreaContent(baseArea(), {
    quiz: [{ question: "Trasig?", options: ["Bara ett"], answerIndex: 0 }],
  });
  assert.equal(res.ok, false);
  assert.match(res.errors.join(" | "), /minst 2 svarsalternativ/);
});

test("tomt nytt innehåll ger tydligt fel", () => {
  const res = mergeAreaContent(baseArea(), {});
  assert.equal(res.ok, false);
  assert.match(res.errors.join(" | "), /minst en "texts", "quiz" eller "pairs"/);
});

test("läsförståelse-regeln gäller helheten: fråga utan passage till ett passage-område ger fel", () => {
  const area = baseArea();
  area.quiz = [
    { id: "q1", question: "Enligt texten?", options: ["A", "B"], answerIndex: 0, passage: "En källtext." },
  ];
  const res = mergeAreaContent(area, {
    quiz: [{ question: "Utan källtext?", options: ["A", "B"], answerIndex: 0 }],
  });
  assert.equal(res.ok, false);
  assert.match(res.errors.join(" | "), /passage/);
});

test("ett helt område kan klistras in – bara innehållslistorna mergas", () => {
  const res = mergeAreaContent(baseArea(), {
    name: "Ignoreras",
    id: "ignoreras",
    order: 99,
    texts: [{ title: "Ny text", body: "Ny brödtext." }],
  });
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.equal(res.value.name, "Vikingatiden"); // namnet från befintligt bevaras
  assert.equal(res.value.order, 2);
  assert.equal(res.value.texts.length, 2);
  assert.equal(res.value.texts[1].id, "t2");
});

test("parseAndMergeArea ger vänligt fel vid trasig JSON", () => {
  const res = parseAndMergeArea("{ trasig", baseArea());
  assert.equal(res.ok, false);
  assert.match(res.errors.join(" | "), /inte giltig JSON/);
});

test("parseAndMergeArea mergar giltig JSON-sträng", () => {
  const res = parseAndMergeArea('{ "quiz": [ { "question": "Ny?", "options": ["A","B"], "answerIndex": 1 } ] }', baseArea());
  assert.equal(res.ok, true, res.errors.join(" | "));
  assert.equal(res.value.quiz.length, 2);
});
