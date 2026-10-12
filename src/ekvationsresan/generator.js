// ============================================================================
// Ekvationsresan – generatorn (src/ekvationsresan/generator.js) · #615, E1.8
// ----------------------------------------------------------------------------
// Ingen hårdkodad lista: varje uppgift byggs av en form (forms.js) med nivåns
// parametrar (config.js). En uppgift känner alltid till lösningen och det
// optimala antalet drag (BFS i solver.js, med nivåns spärrar):
//
//   task = { schema, level, form, type, key,
//            equation,       // strukturerad (equation.toJSON) – sparas så
//            text,           // "2x + 4 = 14" (visning/loggar)
//            solution,       // { n, d } – positivt heltal i huvudprogressionen
//            optimalMoves, optimalPath: [{op, value}],
//            display }       // vågens visning: "foremal" | "block" | "stiliserad"
//
// generateTask(level, { rng, previous }) – aldrig samma ekvation som `previous`
// similarTask(task, { rng })            – "Försök igen": samma nivå och form,
//                                         ny ekvation OCH ny lösning
// Uppgiftstyp A/B (TASK_TYPES) dras med nivåns andel B. Etapp 2 lägger till
// typ C–F i TASK_TYPES och nivå 7–12 i config.js – ingen ombyggnad här.
// ============================================================================

import { levelConfig, rulesFor } from "./config.js";
import { FORMS } from "./forms.js";
import { toJSON, equationKey, swapSides, solve } from "./equation.js";
import { isInteger } from "./rational.js";
import { viewForEquation, chooseView, statesAlong } from "./vag-visning.js";
import { optimalPath } from "./solver.js";
import { equationRow } from "./notation.js";

export const TASK_SCHEMA = 1;

/** Uppgiftstyper (E1.8). Etapp 2: C–F läggs till här. */
export const TASK_TYPES = Object.freeze({
  A: { id: "A", name: "Balansen", description: "Vågen i fokus, konkreta föremål." },
  B: { id: "B", name: "Lös själv", description: "Samma mekanik, vågen diskretare och matematiken större." },
});

// --- slump ------------------------------------------------------------------

/** mulberry32 (samma familj som matte-generatorns prng) – seedbar och snabb. */
export function seededRng(seed) {
  let h = 1779033703 ^ String(seed).length;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 3432918353);
  let a = h >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(weights, rng) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [id, w] of entries) {
    if ((r -= w) < 0) return id;
  }
  return entries[entries.length - 1][0];
}

// --- vågens visning (E1.5) ----------------------------------------------------

/**
 * Föremål när alla tal (och lösningen) är positiva heltal ≤ 20 och x förekommer
 * högst 5 gånger; block upp till ca 100; annars stiliserad våg. Reglerna bor i
 * vag-visning.js (#617); uppgiftens `display` räknas över hela den optimala
 * vägen, så x/4 = 6 (som slutar i x = 24) blir block.
 */
export function scaleMode(eq) {
  return viewForEquation(eq);
}

// --- generering ------------------------------------------------------------------

const MAX_TRIES = 200;

function buildTask(level, formId, rng, swap) {
  const cfg = levelConfig(level);
  const built = FORMS[formId].build(cfg.params || {}, rng);
  if (!built) return null;
  const equation = swap ? swapSides(built.equation) : built.equation;
  const solution = solve(equation);
  // Vakt: formen och den exakta lösningen måste stämma, och x > 0 heltal.
  if (!solution || !isInteger(solution) || solution.n <= 0 || solution.n !== built.solution) return null;
  const best = optimalPath(equation, rulesFor(level));
  if (!best || best.moves === 0) return null;
  return {
    schema: TASK_SCHEMA,
    level,
    form: formId,
    type: rng() < (cfg.typeB ?? 0) ? "B" : "A",
    key: equationKey(equation),
    equation: toJSON(equation),
    text: equationRow(equation, "start").text,
    solution: { n: solution.n, d: solution.d },
    optimalMoves: best.moves,
    optimalPath: best.path,
    display: chooseView(statesAlong(equation, best.path, rulesFor(level))),
  };
}

/**
 * Ny uppgift på nivån.
 * @param {number} level 1–6 (Etapp 1)
 * @param {{rng?: () => number, previous?: {key?: string}|string, form?: string}} [opts]
 *   previous = förra uppgiften (eller dess key) – samma ekvation två gånger i
 *   följd ges aldrig. form/swap = tvinga form och sida för x (similarTask,
 *   tester). avoidSolution = lösning som inte får komma igen.
 */
export function generateTask(level, { rng = Math.random, previous = null, form = null, swap = null, avoidSolution = null } = {}) {
  const cfg = levelConfig(level);
  const prevKey = typeof previous === "string" ? previous : previous?.key || null;
  for (let i = 0; i < MAX_TRIES; i++) {
    const formId = form || pickWeighted(cfg.forms, rng);
    const swapped = swap ?? rng() < (cfg.swapShare ?? 0);
    const task = buildTask(level, formId, rng, swapped);
    if (!task || task.key === prevKey) continue;
    if (avoidSolution !== null && task.solution.n === avoidSolution) continue;
    return task;
  }
  throw new Error(`Ekvationsresan: kunde inte generera en uppgift på nivå ${level}`);
}

/** "Försök igen för ⭐⭐⭐" (E1.7): liknande ekvation, aldrig samma, ny lösning. */
export function similarTask(task, { rng = Math.random } = {}) {
  const swap = task.equation.right.some((t) => t.x);
  return generateTask(task.level, { rng, previous: task, form: task.form, swap, avoidSolution: task.solution.n });
}
