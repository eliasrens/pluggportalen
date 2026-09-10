// ============================================================================
// Enhetstest för matte­generator-adaptern (issue #278).
// ----------------------------------------------------------------------------
// Verifierar sömmens tre garantier:
//   1. FACIT: för varje topic+variant räknas answer OBEROENDE fram ur problemets
//      operander och jämförs med adapterns answer (aldrig bara ekat tillbaka).
//   2. DETERMINISM: samma (topic, settings, seed) → exakt samma resultat.
//   3. GRÄNSSNITT: listTopics/listVariants, variant-eko, ren problem/answer-seam.
// Körs med Node:s inbyggda testkörare:  node --test test/matte-generator.test.js
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { generateProblem, listTopics, listVariants } from "../src/matte-generator.js";

// Runda av som generatorn gör (för decimal-varianter).
function roundTo(v, digits) {
  const m = Math.pow(10, digits || 0);
  return Math.round(v * m) / m;
}

// OBEROENDE facit ur problemets operander. Returnerar { ok, expected } och
// tar även hand om rest-division och decimaltal (tolerans/avrundning).
function verifyAnswer(res) {
  const p = res.problem;
  const { a, b, c } = p;
  const dd = p.decimalDigits;

  // Rest-division: a = b·svar + rest, 0 < rest < b.
  if (p.hasRemainder) {
    const q = Math.floor(a / b);
    const r = a - b * q;
    return {
      ok: res.answer === q && p.remainder === r && r > 0 && r < b && a === b * q + r,
      expected: `${q} rest ${r}`,
    };
  }

  let expected;
  if (p.mode === 'flersteg') {
    expected = a + b + c;
  } else {
    switch (p.type) {
      case 'addition':       expected = a + b; break;
      case 'subtraktion':    expected = a - b; break;
      case 'multiplikation': expected = a * b; break;
      case 'division':       expected = a / b; break;
      default: return { ok: false, expected: '(okänd typ)' };
    }
  }

  if (dd != null) {
    // Decimalvariant: jämför avrundat till samma antal decimaler.
    return { ok: roundTo(expected, dd) === res.answer, expected: roundTo(expected, dd) };
  }
  // Heltalsvariant: exakt likhet.
  return { ok: expected === res.answer, expected };
}

// --- 1. Facit stämmer för varje topic + variant, över många frön -----------

for (const topic of listTopics()) {
  for (const variant of listVariants(topic)) {
    test(`facit stämmer: ${topic}/${variant}`, () => {
      for (let seed = 0; seed < 200; seed++) {
        const res = generateProblem(topic, { variant }, seed);
        assert.equal(res.variant, variant, `variant-eko för seed ${seed}`);
        const { ok, expected } = verifyAnswer(res);
        assert.ok(
          ok,
          `fel facit ${topic}/${variant} seed ${seed}: ` +
          `problem=${JSON.stringify(res.problem)} answer=${res.answer} förväntat=${expected}`
        );
        assert.equal(typeof res.answer, 'number');
        assert.ok(Number.isFinite(res.answer));
      }
    });
  }
}

// --- 2. Determinism: samma indata → samma resultat -------------------------

test("samma (topic, settings, seed) ger identiskt resultat", () => {
  for (const topic of listTopics()) {
    for (const variant of listVariants(topic)) {
      for (const seed of [0, 1, 42, 9999]) {
        const a = generateProblem(topic, { variant }, seed);
        const b = generateProblem(topic, { variant }, seed);
        assert.deepEqual(a, b, `${topic}/${variant} seed ${seed} ej reproducerbart`);
      }
    }
  }
});

test("determinism gäller även med extra settings (grade, addSubVaxling)", () => {
  const s = { variant: 'uppstallning', grade: 4, addSubVaxling: ['med', 'utan'] };
  const a = generateProblem('addition', s, 7);
  const b = generateProblem('addition', s, 7);
  assert.deepEqual(a, b);
});

// --- 3. Olika frön ger variation (PRNG är verkligen seedad, inte konstant) --

test("olika frön ger olika uppgifter", () => {
  for (const topic of listTopics()) {
    const texts = new Set();
    for (let seed = 0; seed < 30; seed++) {
      texts.add(generateProblem(topic, {}, seed).problem.text);
    }
    assert.ok(texts.size > 1, `${topic}: förväntade variation över frön, fick ${texts.size}`);
  }
});

// --- 4. Gränssnittets form -------------------------------------------------

test("listTopics ger de fyra fas 1-topics", () => {
  assert.deepEqual(listTopics(), ['addition', 'subtraktion', 'multiplikation', 'division']);
});

test("listVariants ger varianter per topic, tom för okänt", () => {
  assert.ok(listVariants('addition').includes('uppstallning'));
  assert.ok(listVariants('division').includes('rest'));
  assert.deepEqual(listVariants('finns-inte'), []);
});

test("okänt topic kastar fel", () => {
  assert.throws(() => generateProblem('finns-inte', {}, 0), /Okänt topic/);
});

test("okänd variant faller tillbaka till första varianten", () => {
  const res = generateProblem('addition', { variant: 'trams' }, 0);
  assert.equal(res.variant, 'enkel');
});

test("utelämnad variant ger default (första i listan)", () => {
  assert.equal(generateProblem('multiplikation', {}, 0).variant, 'tabeller');
});

test("problem-objektet exponerar INTE answer (ren seam)", () => {
  for (const topic of listTopics()) {
    const res = generateProblem(topic, {}, 3);
    assert.ok(!('answer' in res.problem), `${topic}: answer läckte in i problem`);
    assert.equal(typeof res.problem.text, 'string');
    assert.ok(res.problem.text.length > 0);
  }
});

// --- 5. Variant-specifika egenskaper --------------------------------------

test("uppstallning med växling ger verklig minnessiffra/lån", () => {
  // Med enbart 'med' ska växling alltid krävas (a+b har minnessiffra).
  const res = generateProblem('addition', { variant: 'uppstallning', addSubVaxling: ['med'] }, 5);
  assert.equal(res.problem.mode, 'uppstallning');
  assert.equal(res.problem.vaxling, true);
});

test("division/rest ger giltig rest inom [1, b-1]", () => {
  for (let seed = 0; seed < 50; seed++) {
    const res = generateProblem('division', { variant: 'rest' }, seed);
    const { remainder, b } = res.problem;
    assert.ok(remainder >= 1 && remainder <= b - 1, `rest ${remainder} utanför [1,${b - 1}]`);
  }
});

test("decimaler-varianter producerar decimaltal (decimalDigits satt)", () => {
  for (const topic of ['addition', 'subtraktion', 'multiplikation', 'division']) {
    const res = generateProblem(topic, { variant: 'decimaler' }, 11);
    assert.ok(res.problem.decimalDigits >= 1, `${topic}: förväntade decimalDigits`);
  }
});
