// ============================================================================
// Enhetstest för innehållshärledningen i arkad-läget "Fånga sanningar" (#142):
//   • hasSanningsjaktContent: kortet syns bara vid ≥2 textpar eller quiz
//   • buildStatements: sant/falskt ur par (föredras) resp. quiz-fallback
//   • statementFeeder: matar ut påståenden utan snabb upprepning
// Körs browser-fritt med Node:s inbyggda testkörare:  node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  textualPairs,
  hasSanningsjaktContent,
  buildStatements,
  statementFeeder,
} from "../src/sanningsjakt-content.js";

const PAIRS = {
  pairs: [
    { term: "Kung", definition: "regent" },
    { term: "Riksdag", definition: "folkets församling" },
    { term: "Lag", definition: "regel alla måste följa" },
  ],
};

const QUIZ = {
  quiz: [
    { question: "Vad är en ö?", options: ["land i vatten", "en bil", "en färg"], answerIndex: 0 },
    { question: "Vad är en sjö?", options: ["vatten", "berg"], answerIndex: 0 },
  ],
};

// --- textualPairs -----------------------------------------------------------

test("textualPairs släpper igenom textpar men filtrerar bort bildpar/ofullständiga", () => {
  const area = {
    pairs: [
      { term: "a", definition: "b" },
      { term: "c", definition: "d", termImage: "x" }, // bildpar → bort
      { term: "e" }, // saknar definition → bort
    ],
  };
  assert.equal(textualPairs(area).length, 1);
  assert.deepEqual(textualPairs(undefined), []);
});

// --- hasSanningsjaktContent -------------------------------------------------

test("hasSanningsjaktContent kräver minst 2 textpar", () => {
  assert.equal(hasSanningsjaktContent({ pairs: [{ term: "a", definition: "b" }] }), false);
  assert.equal(hasSanningsjaktContent(PAIRS), true);
});

test("hasSanningsjaktContent godkänner quiz som fallback", () => {
  assert.equal(hasSanningsjaktContent(QUIZ), true);
  assert.equal(hasSanningsjaktContent({}), false);
  assert.equal(hasSanningsjaktContent(undefined), false);
});

// --- buildStatements: par ---------------------------------------------------

test("buildStatements ur par ger balanserat sant/falskt med korrekt sant-text", () => {
  const st = buildStatements(PAIRS);
  assert.equal(st.length, PAIRS.pairs.length * 2); // ett sant + ett falskt per par
  const truths = st.filter((s) => s.truth);
  const falses = st.filter((s) => !s.truth);
  assert.equal(truths.length, PAIRS.pairs.length);
  assert.equal(falses.length, PAIRS.pairs.length);
  // Varje sant-påstående är den korrekta parningen.
  for (const p of PAIRS.pairs) {
    assert.ok(truths.some((s) => s.text === `${p.term} betyder ${p.definition}`));
  }
  // Falska påståenden paras ihop fel (term hör inte till definitionen).
  const correct = new Set(PAIRS.pairs.map((p) => `${p.term} betyder ${p.definition}`));
  for (const f of falses) assert.ok(!correct.has(f.text));
});

// --- buildStatements: quiz-fallback -----------------------------------------

test("buildStatements faller tillbaka på quiz när par saknas", () => {
  const st = buildStatements(QUIZ);
  const truths = st.filter((s) => s.truth);
  // Rätt alternativ blir sant, distraktor blir falskt; frågan följer med som sub.
  assert.ok(truths.some((s) => s.text === "land i vatten" && s.sub === "Vad är en ö?"));
  assert.ok(st.some((s) => !s.truth));
  assert.ok(st.every((s) => typeof s.sub === "string"));
});

test("buildStatements ger [] utan innehåll", () => {
  assert.deepEqual(buildStatements({}), []);
});

// --- statementFeeder --------------------------------------------------------

test("statementFeeder undviker att samma text kommer direkt igen", () => {
  const st = buildStatements(PAIRS);
  const feed = statementFeeder(st);
  let prev = null;
  for (let i = 0; i < 50; i++) {
    const cur = feed();
    assert.ok(cur, "feed ska alltid ge ett påstående");
    assert.notEqual(cur.text, prev, "ingen omedelbar upprepning");
    prev = cur.text;
  }
});

test("statementFeeder på tom kortlek ger null (ingen krasch)", () => {
  const feed = statementFeeder([]);
  assert.equal(feed(), null);
});
