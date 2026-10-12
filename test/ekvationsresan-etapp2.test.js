// ============================================================================
// Ekvationsresan Etapp 2 (#623): kärna + generator nivå 7–12 – spec E2.1, E2.2,
// E1.3, E1.4, E1.10 och E2.7 (generering, −x/−2x, negativa mellanled från
// nivå 9, exakta decimaler från nivå 10, mynt, anpassning till nivå 12).
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateTask, similarTask, seededRng, TASK_TYPES } from "../src/ekvationsresan/generator.js";
import { FORMS } from "../src/ekvationsresan/forms.js";
import { LEVELS, LEVEL_MAX, LEVEL_UP, EXTRA_RULES, rulesFor, levelConfig } from "../src/ekvationsresan/config.js";
import { fromJSON, solve, isSolved, coefOf, parseEquation } from "../src/ekvationsresan/equation.js";
import { applyOperation, applyNumber, candidateOperands, OPS } from "../src/ekvationsresan/operations.js";
import { parseOperand } from "../src/ekvationsresan/operand.js";
import { startRun, playMove, playMoves, replayRows } from "../src/ekvationsresan/losning.js";
import { optimalPath } from "../src/ekvationsresan/solver.js";
import { helpSteps, revealSolution } from "../src/ekvationsresan/hjalp.js";
import { coinsFor } from "../src/ekvationsresan/mynt.js";
import { startAdaptation, recordResult } from "../src/ekvationsresan/anpassning.js";
import { q, isInteger, isDecimal, formatSv, eq as same } from "../src/ekvationsresan/rational.js";
import { term } from "../src/ekvationsresan/equation.js";

const N = 1000;
const ETAPP2 = LEVELS.filter((l) => l.level >= 7);

function series(level, seed = `e2-niva-${level}`) {
  const rng = seededRng(seed);
  const out = [];
  for (let i = 0; i < N; i++) out.push(generateTask(level, { rng, previous: out[i - 1] || null }));
  return out;
}

const SERIES = Object.fromEntries(ETAPP2.map((l) => [l.level, series(l.level)]));

/** Spela elevens text-drag i följd; varje drag måste gå. → run */
function play(text, moves, level) {
  let run = startRun(parseEquation(text), { rules: rulesFor(level) });
  for (const m of moves) {
    const { run: next, outcome } = playMove(run, m);
    assert.equal(outcome.kind, "move", `${text}: ${m} → ${outcome.kind} ${outcome.message || ""}`);
    run = next;
  }
  return run;
}
const texts = (rows) => rows.map((r) => r.text);

// --- nivåerna och spärrarna ----------------------------------------------------

test("nivå 7–12 finns, med namn, nivå-upp-text och växande andel typ B", () => {
  assert.equal(LEVEL_MAX, 12);
  assert.deepEqual(ETAPP2.map((l) => l.level), [7, 8, 9, 10, 11, 12]);
  for (const l of ETAPP2) {
    assert.ok(l.name, `nivå ${l.level} har namn`);
    assert.ok(LEVEL_UP[l.level], `nivå ${l.level} har nivå-upp-text`);
    for (const f of Object.keys(l.forms)) assert.ok(FORMS[f], `formen ${f} finns`);
  }
  const share = LEVELS.map((l) => l.typeB);
  for (let i = 1; i < share.length; i++) assert.ok(share[i] > share[i - 1], `typ B-andel ${share.join(", ")}`);
});

test("spärrarna per nivå: x-termer från 7, minustal från 9, högst två decimaler från 10, bråk aldrig", () => {
  for (const { level } of LEVELS) {
    const r = rulesFor(level);
    assert.equal(r.operandX, level >= 7, `operandX nivå ${level}`);
    assert.equal(r.allowNegative, level >= 9, `allowNegative nivå ${level}`);
    assert.equal(r.allowDecimals, level >= 10, `allowDecimals nivå ${level}`);
    assert.equal(r.operandDecimal, level >= 10, `operandDecimal nivå ${level}`);
    assert.equal(r.maxDecimals, 2);
    assert.equal(r.allowFractions, false, `bråk bara i extrautmaningar (nivå ${level})`);
    assert.equal(r.distributionStep, level <= 6, `mellanled vid fördelning bara nivå 1–6 (E1.3)`);
  }
  assert.equal(EXTRA_RULES.allowFractions, true);
  assert.equal(applyNumber(parseEquation("2x + 4 = 14"), "/", 3, rulesFor(12)).block, "fraction");
  assert.equal(applyNumber(parseEquation("2x + 4 = 14"), "/", 3, EXTRA_RULES).ok, true);
});

// --- generering: 1 000 per nivå ----------------------------------------------------

for (const { level } of ETAPP2) {
  test(`nivå ${level}: ${N} ekvationer – positiv lösning, optimalt antal drag (BFS = formen), vägen löser`, () => {
    const rules = rulesFor(level);
    for (const task of SERIES[level]) {
      const eq = fromJSON(task.equation);
      const x = solve(eq);
      assert.ok(x && x.n > 0, `${task.text}: lösningen ${JSON.stringify(x)} är inte positiv`);
      if (level < 10) assert.ok(isInteger(x), `${task.text}: heltalslösning före nivå 10`);
      else assert.ok(isDecimal(x, 2), `${task.text}: högst två decimaler`);
      assert.deepEqual(task.solution, { n: x.n, d: x.d }, task.text);
      assert.equal(task.optimalMoves, FORMS[task.form].moves, `${task.text}: BFS ${task.optimalMoves}, formen ${FORMS[task.form].moves}`);
      assert.equal(task.optimalPath.length, task.optimalMoves);
      const run = playMoves(startRun(eq, { rules }), task.optimalPath);
      assert.ok(run.solved, `${task.text}: vägen ${JSON.stringify(task.optimalPath)} löser inte`);
      assert.ok(same(run.value, x));
      assert.ok(!isSolved(eq));
    }
  });

  test(`nivå ${level}: inga dubbletter i följd, alla former, lämpliga tal`, () => {
    const cfg = levelConfig(level);
    const rules = rulesFor(level);
    const tasks = SERIES[level];
    for (let i = 1; i < tasks.length; i++) assert.notEqual(tasks[i].key, tasks[i - 1].key, `dubblett i följd: ${tasks[i].text}`);
    for (const t of tasks) {
      assert.ok(Object.hasOwn(cfg.forms, t.form));
      assert.ok(Object.hasOwn(TASK_TYPES, t.type));
      for (const tm of [...t.equation.left, ...t.equation.right]) {
        const c = coefOf(tm);
        assert.ok(Math.abs(c.n) <= 1000 && c.d <= 1000, `${t.text}: för stort tal`);
        const xa = tm.x && Math.abs(c.n) === 1; // x/a
        if (rules.allowDecimals) assert.ok(isDecimal(c, 2) || xa, `${t.text}: bråk eller > 2 decimaler`);
        else assert.ok(isInteger(c) || xa, `${t.text}: decimal före nivå 10`);
      }
      assert.ok(["foremal", "block", "stiliserad"].includes(t.display));
      assert.equal(typeof t.swapped, "boolean");
    }
    assert.deepEqual([...new Set(tasks.map((t) => t.form))].sort(), Object.keys(cfg.forms).sort(), "alla nivåns former förekommer");
    assert.ok(new Set(tasks.map((t) => t.key)).size > N / 2, "varierat");
  });
}

test("nivå 7–9, 11: x står i båda leden i de flesta uppgifter; nivå 10 har decimaler (även i lösningen)", () => {
  const both = (t) => t.equation.left.some((m) => m.x) && t.equation.right.some((m) => m.x);
  for (const level of [7, 8]) assert.ok(SERIES[level].filter(both).length > N * 0.6, `nivå ${level}`);
  assert.ok(SERIES[9].some((t) => t.form === "b-ax=c"));
  const dec = (t) => [...t.equation.left, ...t.equation.right].some((m) => !isInteger(coefOf(m)));
  assert.ok(SERIES[10].filter(dec).length > N * 0.5, "decimaler på nivå 10");
  assert.ok(SERIES[10].some((t) => t.solution.d > 1), "x = 2,5 förekommer");
  assert.ok(SERIES[7].some((t) => t.swapped) && SERIES[7].some((t) => !t.swapped), "x-sidan varieras");
});

// --- optimum: BFS:en missar inga kortare vägar med andra operander -----------------

/** Brett operandutbud: heltal 1–range, x-termer 1x–12x, och (nivå 10+) decimaler i tiondelar/kvartar upp till 20. */
function wideOperands(eq, rules, range) {
  const out = [...candidateOperands(eq, rules)];
  for (let v = 1; v <= range; v++) out.push(term(q(v), 0));
  if (rules.operandX) for (let v = 1; v <= 12; v++) out.push(term(q(v), 1));
  if (rules.operandDecimal) for (let k = 1; k <= Math.min(80, range); k++) out.push(term(q(k, 4), 0), term(q(k, 10), 0));
  return out;
}
function oneMoveStates(eq, rules, range) {
  const out = [];
  for (const operand of wideOperands(eq, rules, range)) {
    for (const op of OPS) {
      const r = applyOperation(eq, op, operand, rules);
      if (r.ok) out.push(r.after);
    }
  }
  return out;
}

test("optimum är verkligen minst: inga kortare vägar med ett brett operandutbud", () => {
  for (const { level } of ETAPP2) {
    const rules = rulesFor(level);
    for (const task of SERIES[level].filter((t) => t.optimalMoves === 2).slice(0, 15)) {
      const eq = fromJSON(task.equation);
      assert.ok(!oneMoveStates(eq, rules, 999).some(isSolved), `${task.text}: löses på ett drag`);
    }
    for (const task of SERIES[level].filter((t) => t.optimalMoves === 3).slice(0, 3)) {
      const eq = fromJSON(task.equation);
      for (const mid of oneMoveStates(eq, rules, 40)) {
        assert.ok(!oneMoveStates(mid, rules, 40).some(isSolved), `${task.text}: löses på två drag`);
      }
    }
  }
});

test("BFS: 3x + 4 = x + 12 → −x, −4, ÷2 (x-termen först); 2,5x + 4 = 19 → −4, ÷2,5", () => {
  assert.deepEqual(optimalPath(parseEquation("3x + 4 = x + 12"), rulesFor(7)).path, [
    { op: "-", n: 1, d: 1, x: 1 },
    { op: "-", value: 4 },
    { op: "/", value: 2 },
  ]);
  assert.deepEqual(optimalPath(parseEquation("2,5x + 4 = 19"), rulesFor(10)).path, [
    { op: "-", value: 4 },
    { op: "/", n: 5, d: 2, x: 0 },
  ]);
  // x/4 är "x delat med 4" – inte decimaltalet 0,25 – även när decimaler är på
  assert.equal(optimalPath(parseEquation("x/4 + 33 = 46"), rulesFor(11)).path.at(-1).op, "*", "x/4 löses med ·4, inte ÷0,25");
});

test("nivå 9: lika korta vägar utan minustal föredras (hjälpen och Visa lösningen)", () => {
  const best = optimalPath(parseEquation("2x - 4 = 4x - 18"), rulesFor(9));
  assert.equal(best.moves, 3);
  const run = playMoves(startRun(parseEquation("2x - 4 = 4x - 18"), { rules: rulesFor(8) }), best.path);
  assert.ok(run.solved, "vägen går även med spärren för minustal");
});

// --- talfältet: x-termer och decimaler -----------------------------------------------

test("talfältet: x, 2x, −2x från nivå 7; decimaler med högst två decimaler från nivå 10", () => {
  assert.equal(parseOperand("-2x", { rules: rulesFor(6) }).error, "xOff");
  assert.deepEqual(parseOperand("-2x", { rules: rulesFor(7) }), { ok: true, op: "-", operand: { n: 2, d: 1, x: 1 } });
  assert.deepEqual(parseOperand("−x", { rules: rulesFor(7) }), { ok: true, op: "-", operand: { n: 1, d: 1, x: 1 } });
  assert.deepEqual(parseOperand("x", { op: "+", rules: rulesFor(7) }), { ok: true, op: "+", operand: { n: 1, d: 1, x: 1 } });
  assert.equal(parseOperand("/2,5", { rules: rulesFor(9) }).error, "decimalOff");
  assert.deepEqual(parseOperand("/2,5", { rules: rulesFor(10) }).operand, { n: 5, d: 2, x: 0 });
  assert.deepEqual(parseOperand(":0.25", { rules: rulesFor(10) }).operand, { n: 1, d: 4, x: 0 });
  assert.deepEqual(parseOperand("-1,5x", { rules: rulesFor(10) }).operand, { n: 3, d: 2, x: 1 });
  assert.equal(parseOperand("/2,125", { rules: rulesFor(10) }).error, "decimalMax");
  assert.ok(parseOperand("/2,125", { rules: rulesFor(10) }).message);
  assert.equal(parseOperand("4,000", { op: "+", rules: rulesFor(3) }).ok, true, "4,000 är heltalet 4");
  // · och ÷ med x spärras (x · x finns inte)
  assert.equal(playMove(startRun(parseEquation("3x + 4 = x + 12"), { rules: rulesFor(7) }), "/x").outcome.block, "xProduct");
});

// --- skrivsättet E1.3 med x-termer ---------------------------------------------------

test("−x och −2x skrivs korrekt i MIN LÖSNING", () => {
  const a = play("3x + 4 = x + 12", ["-x", "-4", "/2"], 7);
  assert.deepEqual(texts(a.rows), [
    "3x + 4 = x + 12",
    "3x + 4 − x = x + 12 − x",
    "2x + 4 = 12",
    "2x + 4 − 4 = 12 − 4",
    "2x = 8",
    "2x ÷ 2 = 8 ÷ 2",
    "x = 4",
  ]);
  const b = play("5x - 7 = 2x + 20", ["-2x", "+7", "/3"], 8);
  assert.deepEqual(texts(b.rows).slice(1, 3), ["5x − 7 − 2x = 2x + 20 − 2x", "3x − 7 = 20"]);
  assert.equal(texts(b.rows).at(-1), "x = 9");
  const c = play("20 - 2x = 8", ["+2x"], 8);
  assert.deepEqual(texts(c.rows).slice(1), ["20 − 2x + 2x = 8 + 2x", "20 = 2x + 8"]);
  // parentes vid ÷ av ett led med flera termer, utan mellanled från nivå 7
  const d = play("4x + 6 = 2x + 10", ["/2"], 7);
  assert.deepEqual(texts(d.rows).slice(1), ["(4x + 6) ÷ 2 = (2x + 10) ÷ 2", "2x + 3 = x + 5"]);
  // x i högerledet → sista raden x = …
  const e = play("x + 12 = 3x + 4", ["-x", "-4", "/2"], 7);
  assert.deepEqual(texts(e.rows).slice(-2), ["4 = x", "x = 4"]);
});

// --- negativa mellanled: spärrade före nivå 9, tillåtna från 9 --------------------------

test("negativa mellanled spärras före nivå 9 och tillåts från nivå 9", () => {
  const eq = parseEquation("3x + 17 = 5x + 5");
  for (const level of [7, 8]) {
    const r = applyOperation(eq, "-", term(q(5), 1), rulesFor(level));
    assert.equal(r.block, "negative", `nivå ${level}: −5x ger −2x + 17 = 5`);
    assert.equal(playMove(startRun(eq, { rules: rulesFor(level) }), "-5x").outcome.kind, "blocked");
    assert.equal(applyNumber(parseEquation("20 - 2x = 8"), "-", 20, rulesFor(level)).block, "negative");
  }
  for (const level of [9, 10, 11, 12]) assert.equal(applyOperation(eq, "-", term(q(5), 1), rulesFor(level)).ok, true, `nivå ${level}`);
  // hela omvägen genom minustal på nivå 9 – lösningen är ändå positiv
  const run = play("3x + 17 = 5x + 5", ["-5x", "-17", "/2", "+x", "+6"], 9);
  assert.deepEqual(texts(run.rows), [
    "3x + 17 = 5x + 5",
    "3x + 17 − 5x = 5x + 5 − 5x",
    "−2x + 17 = 5",
    "−2x + 17 − 17 = 5 − 17",
    "−2x = −12",
    "−2x ÷ 2 = −12 ÷ 2",
    "−x = −6",
    "−x + x = −6 + x",
    "0 = x − 6",
    "0 + 6 = x − 6 + 6",
    "6 = x",
    "x = 6",
  ]);
  assert.ok(run.solved);
  assert.deepEqual(run.value, q(6));
  // den smarta vägen ger inga minustal: −3x, −5, ÷2
  assert.equal(optimalPath(eq, rulesFor(9)).moves, 3);
});

// --- decimaler: exakta, med decimalkomma ---------------------------------------------------

test("decimaler räknas exakt och visas med decimalkomma: 2,5x + 4 = 19", () => {
  const eq = parseEquation("2,5x + 4 = 19");
  assert.deepEqual(solve(eq), q(6));
  const run = play("2,5x + 4 = 19", ["-4", "/2,5"], 10);
  assert.deepEqual(texts(run.rows), ["2,5x + 4 = 19", "2,5x + 4 − 4 = 19 − 4", "2,5x = 15", "2,5x ÷ 2,5 = 15 ÷ 2,5", "x = 6"]);
  assert.ok(run.solved);
  // flyttal hade gett 0,30000000000000004
  assert.equal(texts(play("x + 0,1 = 0,4", ["-0,1"], 10).rows).at(-1), "x = 0,3");
  assert.equal(texts(play("1,1x = 3,3", ["/1,1"], 10).rows).at(-1), "x = 3");
  assert.equal(texts(play("2x + 3 = 8", ["-3", "/2"], 10).rows).at(-1), "x = 2,5");
  assert.equal(texts(play("0,75x + 0,5 = 2", ["-0,5", "/0,75"], 10).rows).at(-1), "x = 2");
  assert.equal(formatSv(q(3, 4)), "0,75");
  // decimaler bara från nivå 10; fler än två decimaler och bråk spärras
  assert.equal(applyNumber(parseEquation("2x + 3 = 8"), "-", 3, rulesFor(9)).ok, true);
  assert.equal(playMove(play("2x + 3 = 8", ["-3"], 9), "/2").outcome.block, "fraction");
  assert.equal(playMove(startRun(parseEquation("1,5x = 9"), { rules: rulesFor(10) }), "/4").outcome.block, "fraction", "0,375x = 2,25");
  assert.equal(playMove(startRun(parseEquation("2x + 4 = 14"), { rules: rulesFor(10) }), "/3").outcome.block, "fraction", "2/3 är inget decimaltal");
  // x/4 skrivs fortfarande med bråkstreck, inte 0,25x
  assert.equal(texts(play("x/4 + 1 = 3", ["-1"], 10).rows).at(-1), "x/4 = 2");
});

// --- liknande ekvation ----------------------------------------------------------------

test("Försök igen på nivå 7–12: liknande, aldrig samma, ny lösning, x-sidan bevaras", () => {
  const rng = seededRng("e2-igen");
  for (const { level } of ETAPP2) {
    for (const task of SERIES[level].slice(0, 150)) {
      const s = similarTask(task, { rng });
      assert.notEqual(s.key, task.key);
      assert.ok(!same(q(s.solution.n, s.solution.d), q(task.solution.n, task.solution.d)), `${task.text}: samma lösning`);
      assert.equal(s.level, level);
      assert.equal(s.form, task.form);
      assert.equal(s.swapped, task.swapped);
    }
  }
  // äldre uppgift utan `swapped` (Etapp 1) – härleds ur x-sidan
  const old = { ...generateTask(6, { rng, form: "ax+b=c", swap: true }) };
  delete old.swapped;
  assert.ok(similarTask(old, { rng }).equation.right.some((t) => t.x));
});

test("uppgiften är JSON-ren och räknegången kan byggas om ur den (x-termer och decimaler i vägen)", () => {
  for (const level of [7, 10]) {
    const task = SERIES[level].find((t) => t.optimalPath.some((m) => "n" in m));
    const copy = JSON.parse(JSON.stringify(task));
    assert.deepEqual(copy, task);
    assert.equal(replayRows(copy.equation, copy.optimalPath, { rules: rulesFor(level) }).at(-1).text, `x = ${formatSv(q(task.solution.n, task.solution.d))}`);
  }
});

// --- hjälpen tål x-termer och decimaler -------------------------------------------------

test("hjälpen och Visa lösningen med x-term- och decimaloperander", () => {
  const h = helpSteps(parseEquation("3x + 4 = x + 12"), rulesFor(7));
  assert.deepEqual(h.focus, { op: "-", n: 1, d: 1, x: 1 });
  assert.match(h.steps[2].text, /Subtrahera x från båda leden/);
  assert.deepEqual(h.steps[1].scale, { action: "remove", operand: { n: 1, d: 1, x: 1 } });
  assert.equal(h.steps[2].row.text, "3x + 4 − x = x + 12 − x");
  assert.equal(h.steps[3].text, "3x + 4 − x blir 2x + 4. Vad blir x + 12 − x?");
  const d = helpSteps(parseEquation("2,5x = 15"), rulesFor(10));
  assert.match(d.steps[2].text, /Dividera båda leden med 2,5/);
  for (const [text, level] of [["3x + 17 = 5x + 5", 9], ["2,5x + 4 = 19", 10], ["20 - 2x = 8", 9]]) {
    const { run } = revealSolution(startRun(parseEquation(text), { rules: rulesFor(level) }));
    assert.ok(run.solved && run.revealed, text);
  }
});

// --- mynt och anpassning ------------------------------------------------------------------

test("mynt för nivå 7–12: 4, 4, 5, 5, 6, 6 per löst uppgift; Visa lösningen 0", () => {
  assert.deepEqual([7, 8, 9, 10, 11, 12].map((l) => coinsFor(l)), [4, 4, 5, 5, 6, 6]);
  assert.equal(coinsFor(12, { solved: false }), 0);
  assert.equal(coinsFor(9, { extraChallenge: true }), 7);
});

test("anpassningen fungerar upp till nivå 12", () => {
  const feed = (level, stars) => stars.reduce((acc, s) => recordResult(acc.state, s), { state: startAdaptation(level) });
  assert.equal(feed(6, [3, 3, 3, 3]).state.level, 7);
  assert.equal(feed(11, [3, 3, 3, 3]).state.level, 12);
  assert.equal(feed(12, [3, 3, 3, 3]).state.level, 12, "högsta nivån");
  assert.equal(feed(9, [0, 0, 1, 0, 0]).state.level, 8);
  assert.equal(startAdaptation(12).level, 12);
});
