// ============================================================================
// Enhetstest för mattegenerator-adaptern (src/math-generator/, issue #278).
// Körs med Node:s inbyggda testkörare:  node --test test/math-generator.test.js
//
// Testar GRÄNSSNITTET, inte klassrummattes interna lager:
//   1) listTopics / listVariants stämmer.
//   2) För VARJE topic+variant: answer stämmer ALLTID mot problem (räknas om
//      oberoende ur problemets egna operander).
//   3) Samma (topic, settings, seed) ger reproducerbart resultat.
//   4) Inga globaler läcker ut ur adaptern.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { generateProblem, listTopics, listVariants } from "../src/math-generator/index.js";

// --- Oberoende omräkning av facit ur problemets egna fält --------------------
function recompute(problem) {
  const { op, operands, decimalDigits = 0, hasRemainder } = problem;
  const f = Math.pow(10, decimalDigits);
  const round = (v) => Math.round(v * f) / f;
  const [a, b] = operands;
  if (op === "add") return round(operands.reduce((s, x) => s + x, 0));
  if (op === "sub") return round(a - b);
  if (op === "mul") return round(a * b);
  if (op === "div") return hasRemainder ? Math.floor(a / b) : round(a / b);
  throw new Error(`okänd op: ${op}`);
}

const SEEDS = [0, 1, 2, 7, 42, 123, 9999, 20260910];

// --- 1) Gränssnittet ---------------------------------------------------------
test("listTopics() ger de fyra fas1-ämnena", () => {
  assert.deepEqual(listTopics(), ["addition", "subtraktion", "multiplikation", "division"]);
});

test("listVariants() ger icke-tom lista per ämne, tom för okänt", () => {
  for (const topic of listTopics()) {
    const vs = listVariants(topic);
    assert.ok(Array.isArray(vs) && vs.length > 0, `${topic} ska ha varianter`);
  }
  assert.deepEqual(listVariants("finns-inte"), []);
});

test("generateProblem kastar för okänt ämne", () => {
  assert.throws(() => generateProblem("finns-inte", {}, 1));
});

// --- 2) Facit stämmer ALLTID mot problem, alla topic+variant -----------------
test("answer stämmer mot problem för varje topic+variant+seed", () => {
  for (const topic of listTopics()) {
    for (const variant of listVariants(topic)) {
      for (const seed of SEEDS) {
        const { problem, answer, variant: got } = generateProblem(topic, { variant }, seed);

        // Struktur-sanity
        assert.equal(got, variant, `variant ska ekas tillbaka (${topic}/${variant})`);
        assert.equal(problem.topic, topic);
        assert.ok(Number.isFinite(answer), `answer ska vara ett tal (${topic}/${variant} seed ${seed})`);
        assert.ok(Array.isArray(problem.operands) && problem.operands.length >= 2);
        assert.ok(typeof problem.text === "string" && problem.text.length > 0);

        // Facit räknat oberoende ur operander
        const expected = recompute(problem);
        assert.ok(
          Math.abs(expected - answer) < 1e-9,
          `fel facit ${topic}/${variant} seed ${seed}: problem=${JSON.stringify(problem)} answer=${answer} förväntat=${expected}`
        );

        // Division med rest: a = b·answer + rest, 0 < rest < b
        if (problem.hasRemainder) {
          const [a, b] = problem.operands;
          assert.equal(a, b * answer + problem.remainder, `rest-invariant ${topic}/${variant} seed ${seed}`);
          assert.ok(problem.remainder > 0 && problem.remainder < b, "rest i intervall");
        }
      }
    }
  }
});

// --- 3) Determinism: samma (topic, settings, seed) → samma resultat ----------
test("samma (topic, settings, seed) ger identiskt resultat", () => {
  for (const topic of listTopics()) {
    for (const variant of listVariants(topic)) {
      for (const seed of SEEDS) {
        const settings = { variant };
        const a = generateProblem(topic, settings, seed);
        const b = generateProblem(topic, settings, seed);
        assert.deepEqual(b, a, `ej reproducerbart: ${topic}/${variant} seed ${seed}`);
      }
    }
  }
});

test("seed kan vara sträng och är fortfarande reproducerbart", () => {
  const a = generateProblem("addition", { variant: "enkel" }, "elev-42");
  const b = generateProblem("addition", { variant: "enkel" }, "elev-42");
  assert.deepEqual(b, a);
});

test("olika seeds ger variation (inte alltid samma tal)", () => {
  const texts = new Set(SEEDS.map((s) => generateProblem("addition", { variant: "enkel" }, s).problem.text));
  assert.ok(texts.size > 1, "olika seeds bör ge olika uppgifter");
});

// --- 4) Default-variant + inga globaler --------------------------------------
test("utan variant används default (första i listVariants)", () => {
  for (const topic of listTopics()) {
    const { variant } = generateProblem(topic, {}, 1);
    assert.equal(variant, listVariants(topic)[0]);
  }
});

test("inga globaler läcker ut (PluginManager/PluginUtils)", () => {
  assert.equal(typeof globalThis.PluginManager, "undefined");
  assert.equal(typeof globalThis.PluginUtils, "undefined");
  assert.equal(typeof globalThis.PluginMathUtils, "undefined");
  assert.equal(typeof globalThis.BasePlugin, "undefined");
});

// --- Flersteg har tre operander och rätt summa -------------------------------
test("addition/flersteg har tre operander som summerar till answer", () => {
  const { problem, answer } = generateProblem("addition", { variant: "flersteg" }, 5);
  assert.equal(problem.operands.length, 3);
  assert.equal(problem.operands.reduce((s, x) => s + x, 0), answer);
});
