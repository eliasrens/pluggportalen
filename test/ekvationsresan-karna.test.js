// ============================================================================
// Ekvationsresan (#615): matematikkärnan – spec E1.14 test 1–7 + enheter.
// Rationella tal, modell, talfältets parser, spärrar, skrivsätt, BFS.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { q, add, sub, mul, div, formatSv, parseDecimalSv, isDecimal } from "../src/ekvationsresan/rational.js";
import { parseEquation, equationKey, solve, solvedState, toJSON, fromJSON } from "../src/ekvationsresan/equation.js";
import { parseOperand } from "../src/ekvationsresan/operand.js";
import { applyNumber } from "../src/ekvationsresan/operations.js";
import { startRun, playMove, replayRows } from "../src/ekvationsresan/losning.js";
import { optimalPath, optimalMoves, moveEffect } from "../src/ekvationsresan/solver.js";
import { BASE_RULES, BLOCK_MESSAGES, rulesFor } from "../src/ekvationsresan/config.js";

const M = "−";
const texts = (rows) => rows.map((r) => r.text);
const marked = (row) => row.segments.filter((s) => s.mark === "op").map((s) => s.text);

/** Spela en följd textdrag; kräver att alla är giltiga. */
function play(eqText, inputs, rules = BASE_RULES) {
  let run = startRun(parseEquation(eqText), { rules });
  for (const input of inputs) {
    const r = playMove(run, input);
    assert.equal(r.outcome.kind, "move", `${input}: ${r.outcome.message || r.outcome.kind}`);
    run = r.run;
  }
  return run;
}

// --- rationella tal -----------------------------------------------------------

test("rationella tal: exakt, reducerat, inga flyttal", () => {
  assert.deepEqual(q(4, 6), { n: 2, d: 3 });
  assert.deepEqual(q(3, -6), { n: -1, d: 2 });
  assert.deepEqual(add(q(1, 10), q(2, 10)), q(3, 10)); // 0,1 + 0,2 = 0,3 exakt
  assert.deepEqual(sub(q(1, 3), q(1, 3)), q(0));
  assert.deepEqual(mul(q(2, 3), q(3, 4)), q(1, 2));
  assert.deepEqual(div(q(14), q(2)), q(7));
  assert.throws(() => div(q(1), q(0)), RangeError);
  assert.throws(() => mul(q(2 ** 40), q(2 ** 40)), RangeError, "överskridet säkert heltal kastar i stället för att avrunda");
});

test("rationella tal: svensk decimalkomma (förberett för Etapp 2)", () => {
  assert.equal(formatSv(q(5, 2)), "2,5");
  assert.equal(formatSv(q(-1, 4)), `${M}0,25`);
  assert.equal(formatSv(q(1, 3)), "1/3");
  assert.equal(formatSv(q(14)), "14");
  assert.deepEqual(parseDecimalSv("2,5"), q(5, 2));
  assert.deepEqual(parseDecimalSv("0.1"), q(1, 10));
  assert.equal(parseDecimalSv("2,5,1"), null);
  assert.equal(isDecimal(q(1, 8)), false, "0,125 har tre decimaler");
  assert.equal(isDecimal(q(1, 8), 3), true);
});

// --- modellen ---------------------------------------------------------------------

test("modell: två led med termer, x i båda leden och decimaler ryms", () => {
  const e = parseEquation("3x + 4 = x + 12");
  assert.deepEqual(solve(e), q(4));
  assert.deepEqual(solve(parseEquation("2,5x + 4 = 19")), q(6));
  assert.deepEqual(solve(parseEquation("x/4 = 6")), q(24));
  assert.equal(equationKey(parseEquation("2x + 4 = 14")), "+2x+4=+14");
  assert.equal(equationKey(fromJSON(JSON.parse(JSON.stringify(toJSON(e))))), equationKey(e));
});

test("löst-villkor: x ensamt med koefficienten 1 på ena sidan", () => {
  assert.equal(solvedState(parseEquation("x = 5")).solved, true);
  assert.deepEqual(solvedState(parseEquation("5 = x")), { solved: true, value: q(5), flipped: true });
  assert.equal(solvedState(parseEquation("2x = 10")).solved, false);
  assert.equal(solvedState(parseEquation("x + 2 = 7")).solved, false);
  assert.equal(solvedState(parseEquation("x/4 = 6")).solved, false);
});

// --- talfältet --------------------------------------------------------------------

test("talfältet: -4, +5, /2, :2, *3 och vald knapp", () => {
  const p = (t, o) => parseOperand(t, o);
  assert.equal(p("-4").op, "-");
  assert.deepEqual(p("-4").operand, { n: 4, d: 1, x: 0 });
  assert.equal(p("+5").op, "+");
  assert.equal(p("/2").op, "/");
  assert.equal(p(":2").op, "/");
  assert.equal(p("*3").op, "*");
  assert.equal(p("÷ 2").op, "/");
  assert.equal(p(`${M}4`).op, "-");
  assert.equal(p("4", { op: "·" }).op, "*");
  assert.equal(p("4").error, "noOp");
  assert.equal(p("").error, "empty");
  assert.equal(p("-").error, "empty");
  assert.equal(p("--4").error, "syntax");
  assert.equal(p("+1000").error, "range");
  assert.equal(p("/0").ok, true, "0 tas emot så att spärren kan förklara");
});

test("talfältet: x-termer och decimaler är förberedda men avstängda i Etapp 1", () => {
  assert.equal(parseOperand("-2x").error, "xOff");
  assert.equal(parseOperand("+2,5").error, "decimalOff");
  const etapp2 = { ...BASE_RULES, operandX: true, operandDecimal: true };
  assert.deepEqual(parseOperand("-2x", { rules: etapp2 }).operand, { n: 2, d: 1, x: 1 });
  assert.deepEqual(parseOperand("-x", { rules: etapp2 }).operand, { n: 1, d: 1, x: 1 });
  assert.deepEqual(parseOperand("+2,5", { rules: etapp2 }).operand, { n: 5, d: 2, x: 0 });
});

// --- E1.14 test 1–7 ----------------------------------------------------------------

test("Test 1: 2x + 4 = 14, −4 och ÷2 ger exakt räknegången, operationerna markerade", () => {
  const run = play("2x + 4 = 14", ["-4", "/2"]);
  assert.deepEqual(texts(run.rows), [
    "2x + 4 = 14",
    `2x + 4 ${M} 4 = 14 ${M} 4`,
    "2x = 10",
    "2x ÷ 2 = 10 ÷ 2",
    "x = 5",
  ]);
  assert.deepEqual(run.rows.map((r) => r.kind), ["start", "op", "simplified", "op", "simplified"]);
  assert.deepEqual(marked(run.rows[1]), [`${M} 4`, `${M} 4`]);
  assert.deepEqual(marked(run.rows[3]), ["÷ 2", "÷ 2"]);
  assert.deepEqual(marked(run.rows[2]), [], "den förenklade raden har inget rött");
  assert.equal(run.solved, true);
  assert.deepEqual(run.value, q(5));
  assert.equal(run.moves.length, 2);
});

test("Test 2: ÷2 först ger parentes, mellanled och x + 2 = 7 – aldrig 2x + 4 ÷ 2", () => {
  const run = play("2x + 4 = 14", ["/2"]);
  assert.deepEqual(texts(run.rows.slice(1)), ["(2x + 4) ÷ 2 = 14 ÷ 2", "2x ÷ 2 + 4 ÷ 2 = 7", "x + 2 = 7"]);
  assert.deepEqual(run.rows.slice(1).map((r) => r.kind), ["op", "mid", "simplified"]);
  for (const r of run.rows) assert.ok(!r.text.includes("2x + 4 ÷ 2"), r.text);
  const parens = run.rows[1].segments.filter((s) => s.t === "paren").map((s) => s.text);
  assert.deepEqual(parens, ["(", ")"]);
});

test("Test 2b: · av led med flera termer får parentes och mellanled, · skrivs med punkt", () => {
  const run = play("x/3 + 2 = 6", ["*3"]);
  assert.deepEqual(texts(run.rows), ["x/3 + 2 = 6", "(x/3 + 2) · 3 = 6 · 3", "x/3 · 3 + 2 · 3 = 18", "x + 6 = 18"]);
  const frac = run.rows[0].segments[0];
  assert.deepEqual([frac.num, frac.den], ["x", "3"], "x/a ritas med bråkstreck");
});

test("Test 2c: mellanled kan stängas av per nivå (Etapp 2)", () => {
  const run = play("2x + 4 = 14", ["/2"], { ...BASE_RULES, distributionStep: false });
  assert.deepEqual(texts(run.rows.slice(1)), ["(2x + 4) ÷ 2 = 14 ÷ 2", "x + 2 = 7"]);
});

test("Test 3: ÷0 och ·0 stoppas med förklaring och räknas inte som drag", () => {
  const run = startRun(parseEquation("2x + 4 = 14"));
  for (const [input, code] of [["/0", "div0"], ["*0", "mul0"]]) {
    const r = playMove(run, input);
    assert.equal(r.outcome.kind, "blocked");
    assert.equal(r.outcome.block, code);
    assert.equal(r.outcome.message, BLOCK_MESSAGES[code]);
    assert.equal(r.run.moves.length, 0);
    assert.equal(r.run.rows.length, 1);
  }
  assert.equal(BLOCK_MESSAGES.div0, "Man kan inte dela med noll.");
});

test("Test 4: ÷3 på 2x + 4 = 14 stoppas – då får du bråk", () => {
  const r = playMove(startRun(parseEquation("2x + 4 = 14")), "/3");
  assert.equal(r.outcome.block, "fraction");
  assert.match(r.outcome.message, /bråk/);
  assert.equal(r.run.moves.length, 0);
  // x/a i uppgiften är inget bråk: x/4 = 6 ·2 → x/2 = 12 är tillåtet, ·3 → 3x/4 spärras
  assert.equal(applyNumber(parseEquation("x/4 = 6"), "*", 2).ok, true);
  assert.equal(applyNumber(parseEquation("x/4 = 6"), "*", 3).block, "fraction");
});

test("Test 5: drag som ger minustal stoppas i Etapp 1 (men x − 3 är tillåtet)", () => {
  const r = playMove(startRun(parseEquation("2x + 4 = 14")), "-20");
  assert.equal(r.outcome.block, "negative");
  assert.equal(r.outcome.message, "Då blir det minustal. Prova ett annat drag!");
  assert.equal(r.run.moves.length, 0);
  assert.equal(applyNumber(parseEquation("x + 4 = 11"), "-", 6).ok, true, "x − 2 = 5 är inget minustal");
  assert.equal(applyNumber(parseEquation("x + 4 = 11"), "-", 11).ok, true, "x − 7 = 0: noll är inget minustal");
  assert.equal(applyNumber(parseEquation("x + 4 = 11"), "-", 12).block, "negative", "x − 8 = −1");
  // Etapp 2-nivåer kan öppna för minustal
  assert.equal(applyNumber(parseEquation("2x + 4 = 14"), "-", 20, { ...BASE_RULES, allowNegative: true }).ok, true);
});

test("Test 5b: tal över 1 000 stoppas", () => {
  const r = applyNumber(parseEquation("2x + 4 = 14"), "*", 999);
  assert.equal(r.block, "tooBig");
  assert.equal(r.message, BLOCK_MESSAGES.tooBig);
});

test("Test 6: omvägen +6, −10, ÷2 löser 2x + 4 = 14 på 3 drag (optimalt 2), inget kallas fel", () => {
  const eq = parseEquation("2x + 4 = 14");
  assert.equal(optimalMoves(eq), 2);
  const run = play("2x + 4 = 14", ["+6", "-10", "/2"]);
  assert.equal(run.solved, true);
  assert.equal(run.moves.length, 3);
  assert.deepEqual(texts(run.rows), [
    "2x + 4 = 14",
    "2x + 4 + 6 = 14 + 6",
    "2x + 10 = 20",
    `2x + 10 ${M} 10 = 20 ${M} 10`,
    "2x = 10",
    "2x ÷ 2 = 10 ÷ 2",
    "x = 5",
  ]);
  // +6 är giltigt men gör inte ekvationen enklare – "same", aldrig ett fel
  assert.equal(moveEffect(eq, parseEquation("2x + 10 = 20")), "same");
  assert.equal(moveEffect(eq, parseEquation("2x = 10")), "closer");
  assert.equal(moveEffect(parseEquation("x = 5"), parseEquation("x + 3 = 8")), "further");
});

test("Test 7: slutar uppgiften med 5 = x räknas den som löst och x = 5 skrivs sist", () => {
  const run = play("14 = 2x + 4", ["-4", "/2"]);
  assert.deepEqual(texts(run.rows), [
    "14 = 2x + 4",
    `14 ${M} 4 = 2x + 4 ${M} 4`,
    "10 = 2x",
    "10 ÷ 2 = 2x ÷ 2",
    "5 = x",
    "x = 5",
  ]);
  assert.equal(run.rows.at(-1).kind, "final");
  assert.equal(run.solved, true);
  assert.equal(run.moves.length, 2, "sista raden är inget drag");
  assert.equal(playMove(run, "+1").outcome.kind, "done");
});

// --- BFS och omspelning -------------------------------------------------------------------

test("BFS: optimalt antal drag och naturlig väg för Visa lösningen", () => {
  assert.deepEqual(optimalPath(parseEquation("2x + 4 = 14")).path, [{ op: "-", value: 4 }, { op: "/", value: 2 }]);
  assert.equal(optimalMoves(parseEquation("x + 4 = 11")), 1);
  assert.equal(optimalMoves(parseEquation("x - 3 = 8")), 1);
  assert.equal(optimalMoves(parseEquation("x/4 = 6")), 1);
  assert.equal(optimalMoves(parseEquation("x/3 + 2 = 6")), 2);
  assert.equal(optimalMoves(parseEquation("x = 5")), 0);
  assert.equal(optimalMoves(parseEquation("5x + 13 = 48"), rulesFor(5)), 2);
});

test("räknegången byggs om ur sparade drag (lärarvy) och ur BFS-vägen", () => {
  const run = play("2x + 4 = 14", ["+6", "-10", "/2"]);
  const saved = JSON.parse(JSON.stringify({ equation: toJSON(run.start), moves: run.moves }));
  assert.deepEqual(texts(replayRows(saved.equation, saved.moves)), texts(run.rows));
  const best = optimalPath(parseEquation("2x + 4 = 14"));
  assert.deepEqual(texts(replayRows(parseEquation("2x + 4 = 14"), best.path)).at(-1), "x = 5");
});
