// ============================================================================
// Ekvationsresan – uppgiftstyperna (src/ekvationsresan/uppgiftstyper.js) · #625
// ----------------------------------------------------------------------------
// Spec E1.8 + E2.3. Nivån bestämmer matematiken, typen bestämmer formen:
//
//   A Balansen       vågen i fokus (Etapp 1)
//   B Lös själv      vågen diskretare (Etapp 1)
//   C Nästa rad      räknegången visas; eleven skriver/väljer nästa förenklade rad
//   D Bild → ekv.    vågens bild (+ text) → eleven skriver ekvationen
//   E Hitta felet    en påhittad elevs räknegång → eleven klickar på felraden
//   F Problemlösning text (ev. bild) → ekvation → vanliga lösningsvyn →
//                    "Vad betyder x i uppgiften?" → svar i sammanhanget
//
// Generatorn (generator.js) drar typen med nivåns andelar (config LEVELS[].types),
// väljer en form som typen klarar (supportsForm) och lägger på typens data
// (extendTask). fragor(task) ger frågorna i ordning för typ-svar.js.
// ============================================================================

import { NEXT_ROW_CHOICE_MAX_LEVEL } from "./config.js";
import { fromJSON, toJSON, equationKey } from "./equation.js";
import { applyStep, checkState } from "./operations.js";
import { statesAlong, themeFor } from "./vag-visning.js";
import { FORMS } from "./forms.js";
import { felVarianter, buildFel, felRader } from "./hitta-felet.js";
import { buildProblem, bildText, bildbar, harMall } from "./problem.js";
import { isDecimal } from "./rational.js";
import { moveRows } from "./notation.js";

export const TASK_TYPES = Object.freeze({
  A: { id: "A", name: "Balansen", description: "Vågen i fokus, konkreta föremål.", solve: true },
  B: { id: "B", name: "Lös själv", description: "Samma mekanik, vågen diskretare och matematiken större.", solve: true },
  C: { id: "C", name: "Nästa rad", description: "Eleven skriver eller väljer hur föregående operation förenklas." },
  D: { id: "D", name: "Bild → ekvation", description: "Vågens bild blir en ekvation som eleven skriver." },
  E: { id: "E", name: "Hitta felet", description: "En påhittad elevs räknegång – eleven hittar raden där felet börjar." },
  F: { id: "F", name: "Problemlösning", description: "Text → ekvation → lösning → vad x betyder i uppgiften.", solve: true },
});

/** C–F, de typer där eleven kan svara fel. */
export const QUESTION_TYPES = Object.freeze(["C", "D", "E", "F"]);
export const isQuestionType = (type) => QUESTION_TYPES.includes(type);

/** Har typen en vanlig lösningsdel (drag på vågen)? A, B och F. Drag räknas bara då. */
export const hasSolvePhase = (type) => !!TASK_TYPES[type]?.solve || !TASK_TYPES[type];

/** Former vars bild går att beskriva med behållare + föremål (bara plus, heltal). */
const D_FORMS = Object.freeze(["x+a=b", "ax=b", "ax+b=c", "ax=cx+d", "ax+b=cx+d"]);

/** Klarar typen formen? (före genereringen; extendTask kan ändå avböja en enskild ekvation) */
export function supportsForm(type, formId) {
  if (type === "D") return D_FORMS.includes(formId);
  if (type === "E") return (FORMS[formId]?.moves ?? 0) >= 2;
  if (type === "F") return harMall(formId);
  return true;
}

/** D och F bygger ekvationen ur bild/text – x står då alltid till vänster. */
export const forcesUnswapped = (type) => type === "D" || type === "F";

/** Sätt att skriva ett tal i ett alternativ: ändliga decimaler, eller x/a. */
const visbar = (eq) => [...eq.left, ...eq.right].every((t) => isDecimal(t) || (t.x && Math.abs(t.n) === 1));

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** C: välj (låga nivåer) eller skriv själv; i välj-läget tre alternativ per rad. */
function buildNastaRad(task, rules, rng) {
  if (task.level > NEXT_ROW_CHOICE_MAX_LEVEL) return { mode: "skriv" };
  const states = statesAlong(fromJSON(task.equation), task.optimalPath, rules);
  const steg = [];
  for (let i = 0; i < task.optimalPath.length; i++) {
    const right = states[i + 1];
    const seen = new Set([equationKey(right)]);
    const fel = [];
    // Missuppfattningarna (ena sidan, olika operation, halv delning) går före räknefelen.
    const varianter = shuffle(felVarianter(states[i], task.optimalPath[i]), rng).sort((a, b) => (a.kind === "raknefel") - (b.kind === "raknefel"));
    for (const v of varianter) {
      const k = equationKey(v.after);
      if (seen.has(k) || !visbar(v.after) || !v.after.left.length || !v.after.right.length || checkState(v.after, rules)) continue;
      seen.add(k);
      fel.push(v.after);
      if (fel.length === 2) break;
    }
    if (fel.length < 2) return null;
    steg.push({ val: shuffle([right, ...fel], rng).map(toJSON) });
  }
  return { mode: "valj", steg };
}

/**
 * Lägg på typens data på en färdig uppgift (A/B oförändrade).
 * → uppgiften, eller null om just den här ekvationen inte passar typen.
 */
export function extendTask(task, rules, rng) {
  switch (task.type) {
    case "C": {
      const nastaRad = buildNastaRad(task, rules, rng);
      return nastaRad && { ...task, nastaRad };
    }
    case "D": {
      const eq = fromJSON(task.equation);
      if (task.swapped || task.display === "stiliserad" || !bildbar(eq)) return null;
      return { ...task, bild: bildText(eq, themeFor(task)) };
    }
    case "E": {
      const fel = buildFel(task, rules, rng);
      return fel && { ...task, fel };
    }
    case "F": {
      const problem = buildProblem(task, rng);
      return problem && { ...task, problem };
    }
    default:
      return task;
  }
}

/**
 * Uppgiftens frågor i ordning (typ-svar.js). Varje fråga:
 *   { kind: "rad", i, mode, before, after, step, val? }  C
 *   { kind: "ekvation", target, kalla: "bild"|"text" }   D, F
 *   { kind: "steg", answer, rows }                       E (rows = felRader)
 *   { kind: "los" }                                      F: den vanliga lösningsvyn
 *   { kind: "betydelse", val, answer }                   F: "Vad betyder x?"
 */
export function fragor(task, rules) {
  const start = fromJSON(task.equation);
  switch (task.type) {
    case "C": {
      const states = statesAlong(start, task.optimalPath, rules);
      return task.optimalPath.map((step, i) => ({
        kind: "rad",
        i,
        mode: task.nastaRad?.mode || "skriv",
        before: states[i],
        after: states[i + 1],
        step,
        val: task.nastaRad?.mode === "valj" ? task.nastaRad.steg[i].val.map(fromJSON) : null,
      }));
    }
    case "D":
      return [{ kind: "ekvation", target: start, kalla: "bild" }];
    case "E":
      return [{ kind: "steg", answer: task.fel.rad, rows: felRader(task.fel, start, rules) }];
    case "F":
      return [
        { kind: "ekvation", target: start, kalla: "text" },
        { kind: "los" },
        { kind: "betydelse", val: task.problem.val, answer: task.problem.ratt },
      ];
    default:
      return [];
  }
}

/** C: raderna för ett steg (operationsrad, ev. mellanled, förenklad rad) – den första ges, resten är svaret. */
export const stegRader = (fraga, rules) => moveRows(applyStep(fraga.before, fraga.step, rules), rules);
