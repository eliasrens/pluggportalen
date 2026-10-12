// ============================================================================
// Ekvationsresan (#615): generatorn nivå 1–6 – spec E1.14 test 8 (+ 9, 11, 16
// för vågens visning och "Försök igen" på datanivå).
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateTask, similarTask, seededRng, scaleMode, TASK_TYPES } from "../src/ekvationsresan/generator.js";
import { FORMS } from "../src/ekvationsresan/forms.js";
import { LEVELS, LEVEL_MAX, rulesFor, levelConfig } from "../src/ekvationsresan/config.js";
import { fromJSON, solve, isSolved, coefOf, parseEquation } from "../src/ekvationsresan/equation.js";
import { applyNumber, OPS } from "../src/ekvationsresan/operations.js";
import { replayRows, startRun, playMoves } from "../src/ekvationsresan/losning.js";
import { isInteger } from "../src/ekvationsresan/rational.js";

const N = 1000;

/** Generera N uppgifter i följd på nivån (som eleven får dem). */
function series(level, seed = `niva-${level}`) {
  const rng = seededRng(seed);
  const out = [];
  for (let i = 0; i < N; i++) out.push(generateTask(level, { rng, previous: out[i - 1] || null }));
  return out;
}

const SERIES = Object.fromEntries(LEVELS.map((l) => [l.level, series(l.level)]));

test("Etapp 1 har nivå 1–6 med namn", () => {
  assert.equal(LEVEL_MAX, 6);
  assert.deepEqual(LEVELS.map((l) => l.name), ["Balansen", "Lika stora grupper", "Två steg", "Ekvationslösaren", "Större tal", "Blandat"]);
});

for (const { level } of LEVELS) {
  test(`Test 8 – nivå ${level}: ${N} ekvationer, lösningen ett positivt heltal och optimalt antal drag stämmer`, () => {
    const rules = rulesFor(level);
    for (const task of SERIES[level]) {
      const eq = fromJSON(task.equation);
      const x = solve(eq);
      assert.ok(x && isInteger(x) && x.n > 0, `${task.text}: lösningen ${JSON.stringify(x)}`);
      assert.deepEqual(task.solution, { n: x.n, d: x.d }, task.text);
      assert.equal(task.optimalMoves, FORMS[task.form].moves, `${task.text}: BFS ${task.optimalMoves}, formen ${FORMS[task.form].moves}`);
      assert.equal(task.optimalPath.length, task.optimalMoves);
      // vägen löser verkligen ekvationen, med nivåns spärrar, till rätt x
      const run = playMoves(startRun(eq, { rules }), task.optimalPath);
      assert.ok(run.solved, task.text);
      assert.deepEqual(run.value, x);
      assert.ok(!isSolved(eq), "ingen uppgift är redan löst");
    }
  });

  test(`nivå ${level}: inga dubbletter i följd, lämpliga tal, typ A/B`, () => {
    const cfg = levelConfig(level);
    const tasks = SERIES[level];
    for (let i = 1; i < tasks.length; i++) assert.notEqual(tasks[i].key, tasks[i - 1].key, `dubblett i följd: ${tasks[i].text}`);
    for (const t of tasks) {
      assert.ok(Object.hasOwn(cfg.forms, t.form), `${t.form} hör inte till nivå ${level}`);
      assert.ok(Object.hasOwn(TASK_TYPES, t.type));
      for (const side of [t.equation.left, t.equation.right]) {
        for (const term of side) {
          const c = coefOf(term);
          assert.ok(Math.abs(c.n) <= 1000 && c.d <= 1000, `${t.text}: för stort tal`);
          assert.ok(isInteger(c) || (term.x && Math.abs(c.n) === 1), `${t.text}: bråk`);
          if (term.x && isInteger(c)) assert.notEqual(c.n, 0);
        }
      }
      if (level === 1) assert.ok([...t.equation.left, ...t.equation.right].every((term) => Math.abs(term.n) <= 20), `${t.text}: över 20 på nivå 1`);
      if (level <= 5) assert.ok(t.equation.left.some((term) => term.x), "x till vänster på nivå 1–5");
    }
    const forms = new Set(tasks.map((t) => t.form));
    assert.deepEqual([...forms].sort(), Object.keys(cfg.forms).sort(), "alla nivåns former förekommer");
    assert.ok(new Set(tasks.map((t) => t.key)).size > N / 10, "varierat");
  });
}

test("Test 8: BFS-optimum är verkligen minst – inget enda drag 1–999 löser en tvåstegsuppgift", () => {
  for (const level of [3, 4, 5, 6]) {
    const rules = rulesFor(level);
    for (const task of SERIES[level].filter((t) => t.optimalMoves === 2).slice(0, 25)) {
      const eq = fromJSON(task.equation);
      for (const op of OPS) {
        for (let v = 1; v <= 999; v++) {
          const r = applyNumber(eq, op, v, rules);
          assert.ok(!(r.ok && isSolved(r.after)), `${task.text}: ${op}${v} löser på ett drag`);
        }
      }
    }
  }
});

test("andelen typ B ökar med nivån", () => {
  const share = LEVELS.map((l) => SERIES[l.level].filter((t) => t.type === "B").length / N);
  for (let i = 1; i < share.length; i++) assert.ok(share[i] > share[i - 1], `B-andel ${share.join(", ")}`);
  assert.ok(share[0] < 0.25 && share[5] > 0.65);
});

test("nivå 2 har ax = b och x/a = b, nivå 6 även x/a + b = c och x i högerledet", () => {
  const forms2 = new Set(SERIES[2].map((t) => t.form));
  assert.ok(forms2.has("ax=b") && forms2.has("x/a=b"));
  assert.ok(SERIES[6].some((t) => t.form === "x/a+b=c"));
  assert.ok(SERIES[6].some((t) => t.equation.right.some((term) => term.x)), "14 = 2x + 4-varianten");
});

test("samma frö ger samma serie (reproducerbart)", () => {
  assert.deepEqual(series(3, "fro").slice(0, 20).map((t) => t.key), series(3, "fro").slice(0, 20).map((t) => t.key));
});

test("Test 16 (data): Försök igen ger en liknande men aldrig samma ekvation, och ny lösning", () => {
  const rng = seededRng("igen");
  for (const { level } of LEVELS) {
    for (const task of SERIES[level].slice(0, 200)) {
      const s = similarTask(task, { rng });
      assert.notEqual(s.key, task.key);
      assert.notEqual(s.solution.n, task.solution.n);
      assert.equal(s.level, task.level);
      assert.equal(s.form, task.form);
      assert.equal(s.equation.right.some((t) => t.x), task.equation.right.some((t) => t.x), "x på samma sida");
    }
  }
});

test("Test 9 + 11 (data): vågens visning väljs ur ekvationen", () => {
  assert.equal(scaleMode(parseEquation("2x + 3 = 11"), solve(parseEquation("2x + 3 = 11"))), "foremal");
  assert.equal(scaleMode(parseEquation("x - 3 = 8"), solve(parseEquation("x - 3 = 8"))), "foremal");
  assert.equal(scaleMode(parseEquation("5x + 13 = 48"), solve(parseEquation("5x + 13 = 48"))), "block");
  assert.equal(scaleMode(parseEquation("8x + 29 = 141"), solve(parseEquation("8x + 29 = 141"))), "stiliserad");
  assert.ok(SERIES[1].every((t) => t.display === "foremal"), "nivå 1 = mycket grafiskt stöd");
});

test("uppgiften är JSON-ren och räknegången kan byggas om ur den", () => {
  const task = SERIES[3][0];
  const copy = JSON.parse(JSON.stringify(task));
  assert.deepEqual(copy, task);
  assert.equal(replayRows(copy.equation, copy.optimalPath).at(-1).text, `x = ${task.solution.n}`);
});

test("#643: från nivå 3 är x ≥ 2 (många frön per nivå); nivå 1 har kvar x = 1", () => {
  for (const { level } of LEVELS) {
    let min = Infinity;
    for (let s = 0; s < 50; s++) {
      const rng = seededRng(`x-min-${level}-${s}`);
      for (let i = 0; i < 40; i++) min = Math.min(min, generateTask(level, { rng }).solution.n);
    }
    if (level >= 3) assert.ok(min >= 2, `nivå ${level}: x = ${min}`);
    if (level === 1) assert.equal(min, 1, "nivå 1 är oförändrad");
  }
});
