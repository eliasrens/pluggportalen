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
//            solution,       // { n, d } – positivt (heltal; decimal från nivå 10)
//            optimalMoves, optimalPath: [{op, value} | {op, n, d, x}],
//            swapped,        // x-sidan bytt (14 = 2x + 4) – för similarTask
//            display,        // vågens visning: "foremal" | "block" | "stiliserad"
//            nastaRad | bild | fel | problem }  // typ C | D | E | F (#625)
//
// generateTask(level, { rng, previous }) – aldrig samma ekvation som `previous`
// similarTask(task, { rng })            – "Försök igen": samma nivå och form,
//                                         ny ekvation OCH ny lösning
// Uppgiftstypen (uppgiftstyper.js) dras först: C–F med nivåns andelar
// (config LEVELS[].types, #625), annars A/B med nivåns andel B. Typen väljer
// bland nivåns former de den klarar, och typens data läggs på uppgiften
// (nastaRad / bild / fel / problem). Nivå 7–12 (#623) är bara rader i
// config.js + former i forms.js.
// ============================================================================

import { levelConfig, rulesFor } from "./config.js";
import { FORMS } from "./forms.js";
import { toJSON, equationKey, swapSides, solve } from "./equation.js";
import { toQ, eq as same, isInteger, isDecimal } from "./rational.js";
import { viewForEquation, chooseView, statesAlong } from "./vag-visning.js";
import { optimalPath } from "./solver.js";
import { equationRow } from "./notation.js";
import { TASK_TYPES, supportsForm, forcesUnswapped, extendTask } from "./uppgiftstyper.js";

export const TASK_SCHEMA = 1;

/** Uppgiftstyperna A–F (E1.8, E2.3) – definierade i uppgiftstyper.js. */
export { TASK_TYPES };

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

/** Får lösningen förekomma på nivån? Alltid > 0; heltal, eller decimal där decimaler är på. */
function solutionAllowed(x, rules) {
  if (!x || x.n <= 0) return false;
  return isInteger(x) || (rules.allowDecimals && isDecimal(x, rules.maxDecimals));
}

/**
 * Typen för nästa uppgift: C–F med nivåns andelar (`types`), annars A/B med
 * andelen B. `forced` (similarTask, tester) vinner.
 */
export function pickType(cfg, rng, forced = null) {
  if (forced) return forced;
  let r = rng();
  for (const [id, share] of Object.entries(cfg.types || {})) {
    if ((r -= share) < 0) return id;
  }
  return rng() < (cfg.typeB ?? 0) ? "B" : "A";
}

/** Nivåns formvikter som typen klarar (tomt → typen passar inte nivån). */
function formsFor(type, cfg) {
  return Object.fromEntries(Object.entries(cfg.forms).filter(([id]) => supportsForm(type, id)));
}

function buildTask(level, formId, rng, swap, type) {
  const cfg = levelConfig(level);
  const rules = rulesFor(level);
  const built = FORMS[formId].build(cfg.params || {}, rng);
  if (!built) return null;
  const equation = swap ? swapSides(built.equation) : built.equation;
  const solution = solve(equation);
  // Vakt: formen och den exakta lösningen måste stämma, och x > 0.
  if (!solutionAllowed(solution, rules) || !same(solution, toQ(built.solution))) return null;
  const best = optimalPath(equation, rules);
  if (!best || best.moves === 0) return null;
  const task = {
    schema: TASK_SCHEMA,
    level,
    form: formId,
    type,
    key: equationKey(equation),
    equation: toJSON(equation),
    text: equationRow(equation, "start").text,
    solution: { n: solution.n, d: solution.d },
    optimalMoves: best.moves,
    optimalPath: best.path,
    swapped: Boolean(swap),
    display: chooseView(statesAlong(equation, best.path, rules)),
  };
  return extendTask(task, rules, rng);
}

/**
 * Ny uppgift på nivån.
 * @param {number} level 1–12
 * @param {{rng?: () => number, previous?: {key?: string}|string, form?: string}} [opts]
 *   previous = förra uppgiften (eller dess key) – samma ekvation två gånger i
 *   följd ges aldrig. form/swap = tvinga form och sida för x (similarTask,
 *   tester). avoidSolution = lösning som inte får komma igen. type = tvinga
 *   uppgiftstyp (A–F).
 */
export function generateTask(level, { rng = Math.random, previous = null, form = null, swap = null, avoidSolution = null, type = null } = {}) {
  const cfg = levelConfig(level);
  const prevKey = typeof previous === "string" ? previous : previous?.key || null;
  const avoid = avoidSolution === null ? null : toQ(avoidSolution);
  for (let i = 0; i < MAX_TRIES; i++) {
    // En tvingad typ släpps efter halva försöken (en form som typen sällan klarar).
    const forced = i < MAX_TRIES / 2 ? type : null;
    let t = pickType(cfg, rng, forced);
    let forms = formsFor(t, cfg);
    if (!Object.keys(forms).length || (form && !Object.hasOwn(forms, form))) {
      t = rng() < (cfg.typeB ?? 0) ? "B" : "A";
      forms = cfg.forms;
    }
    const formId = form || pickWeighted(forms, rng);
    const swapped = forcesUnswapped(t) ? false : swap ?? rng() < (cfg.swapShare ?? 0);
    const task = buildTask(level, formId, rng, swapped, t);
    if (!task || task.key === prevKey) continue;
    if (avoid && same(toQ(task.solution), avoid)) continue;
    return task;
  }
  throw new Error(`Ekvationsresan: kunde inte generera en uppgift på nivå ${level}`);
}

/**
 * "Försök igen för ⭐⭐⭐" (E1.7): liknande ekvation, aldrig samma, ny lösning.
 * Typen behålls (samma sorts uppgift igen).
 */
export function similarTask(task, { rng = Math.random } = {}) {
  // Äldre uppgifter (Etapp 1) saknar `swapped`: x bara i högerledet = bytt.
  const swap = task.swapped ?? (task.equation.right.some((t) => t.x) && !task.equation.left.some((t) => t.x));
  const type = TASK_TYPES[task.type] ? task.type : null;
  return generateTask(task.level, { rng, previous: task, form: task.form, swap, avoidSolution: task.solution, type });
}
