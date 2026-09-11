// ============================================================================
// Enhetstest för Räkna-lägets rena kärna (issue #280, rakna-core.js):
//   • deterministisk seed + runda-bygge ur ett generator-område (via #278-adaptern)
//   • rättning av slutsvar (komma/punkt, "rest"-varianten)
//   • uppgiftsdisplay (svensk decimalkomma) och facit-text
// Körs med Node:s inbyggda testkörare:  node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ROUND_SIZE,
  hashSeed,
  sessionSeed,
  sv,
  problemDisplay,
  expectedAnswerText,
  checkAnswer,
  isSameProblem,
  buildRound,
} from "../src/rakna-core.js";

// --- seed -------------------------------------------------------------------

test("hashSeed är deterministisk och ger 32-bitars osignerat", () => {
  const a = hashSeed("elev1|123");
  const b = hashSeed("elev1|123");
  assert.equal(a, b);
  assert.ok(a >= 0 && a <= 0xffffffff);
  assert.notEqual(hashSeed("elev1|123"), hashSeed("elev2|123"));
});

test("sessionSeed skiljer på elev och session (nonce)", () => {
  assert.notEqual(sessionSeed("elev1", 111), sessionSeed("elev2", 111));
  assert.notEqual(sessionSeed("elev1", 111), sessionSeed("elev1", 222));
  assert.equal(sessionSeed("elev1", 111), sessionSeed("elev1", 111));
});

// --- display + facit --------------------------------------------------------

test("sv/problemDisplay byter punkt mot svensk decimalkomma", () => {
  assert.equal(sv(1.5), "1,5");
  assert.equal(problemDisplay({ text: "1.5 + 2.25" }), "1,5 + 2,25");
  // questionText går före text.
  assert.equal(problemDisplay({ questionText: "Hälften av 20?", text: "20 ÷ 2" }), "Hälften av 20?");
});

test("expectedAnswerText visar rest för rest-varianten", () => {
  assert.equal(expectedAnswerText({ hasRemainder: true, remainder: 1 }, 3), "3 rest 1");
  assert.equal(expectedAnswerText({}, 7), "7");
  assert.equal(expectedAnswerText({}, 1.5), "1,5");
});

// --- rättning ---------------------------------------------------------------

test("checkAnswer: heltal, tål blanksteg, avvisar fel/tomt", () => {
  const p = { text: "3 · 4" };
  assert.equal(checkAnswer(p, 12, "12"), true);
  assert.equal(checkAnswer(p, 12, "  12 "), true);
  assert.equal(checkAnswer(p, 12, "13"), false);
  assert.equal(checkAnswer(p, 12, ""), false);
  assert.equal(checkAnswer(p, 12, "tolv"), false);
});

test("checkAnswer: decimaltal tål både komma och punkt", () => {
  const p = { mode: "decimaler" };
  assert.equal(checkAnswer(p, 1.5, "1,5"), true);
  assert.equal(checkAnswer(p, 1.5, "1.5"), true);
  assert.equal(checkAnswer(p, 1.5, "1,50"), true);
  assert.equal(checkAnswer(p, 1.5, "1,6"), false);
});

test("checkAnswer: rest-varianten kräver både kvot och rest", () => {
  const p = { hasRemainder: true, remainder: 1 };
  assert.equal(checkAnswer(p, 3, "3 rest 1"), true);
  assert.equal(checkAnswer(p, 3, "3 r 1"), true);
  assert.equal(checkAnswer(p, 3, "3, 1"), true);
  assert.equal(checkAnswer(p, 3, "3"), false);       // saknar rest
  assert.equal(checkAnswer(p, 3, "3 rest 2"), false); // fel rest
  assert.equal(checkAnswer(p, 3, "4 rest 1"), false); // fel kvot
});

// --- runda-bygge (mot riktiga adaptern) -------------------------------------

const GEN = { topic: "addition", variants: ["enkel"], grade: "ak4" };

test("buildRound ger ROUND_SIZE uppgifter med facit och text", () => {
  const round = buildRound(GEN, sessionSeed("e", 1), ROUND_SIZE);
  assert.equal(round.length, ROUND_SIZE);
  for (const item of round) {
    assert.ok(item.problem && typeof item.answer === "number");
    assert.ok(problemDisplay(item.problem).length > 0);
    // facit stämmer med checkAnswer på det egna svaret.
    assert.equal(checkAnswer(item.problem, item.answer, String(item.answer)), true);
  }
});

test("buildRound är deterministisk per seed (reproducerbar session)", () => {
  const seed = sessionSeed("elev1", 42);
  const a = buildRound(GEN, seed, 4).map((x) => x.problem.text);
  const b = buildRound(GEN, seed, 4).map((x) => x.problem.text);
  assert.deepEqual(a, b);
  // Annan seed → (mycket sannolikt) annan följd.
  const c = buildRound(GEN, sessionSeed("elev2", 42), 4).map((x) => x.problem.text);
  assert.notDeepEqual(a, c);
});

test("buildRound undviker direkt upprepning av samma uppgift", () => {
  const round = buildRound(GEN, sessionSeed("e", 7), ROUND_SIZE);
  for (let i = 1; i < round.length; i++) {
    assert.equal(isSameProblem(round[i], round[i - 1]), false);
  }
});

test("buildRound stödjer division inkl. rest-varianten", () => {
  const round = buildRound({ topic: "division", variants: ["rest"], grade: "ak4" }, 12345, 5);
  assert.equal(round.length, 5);
  for (const item of round) {
    // rest-uppgifter bär hasRemainder; facit-rättning på svarssträngen stämmer.
    const guess = expectedAnswerText(item.problem, item.answer);
    assert.equal(checkAnswer(item.problem, item.answer, guess), true);
  }
});
