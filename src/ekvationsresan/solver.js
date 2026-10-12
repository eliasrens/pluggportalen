// ============================================================================
// Ekvationsresan – optimalt antal drag (src/ekvationsresan/solver.js) · #615
// ----------------------------------------------------------------------------
// Spec E1.7: bredden-först-sökning över RIMLIGA drag – operationerna + − · ÷
// med operander ur talen i det aktuella tillståndet (candidateOperands) – högst
// rules.maxSearchDepth (6) drag djupt, med SAMMA spärrar som eleven har. Ett
// drag = en operation; spärrade drag och förenkling räknas inte.
//
// Operationsordningen (− + ÷ ·, små tal först) avgör vilken av flera lika
// korta vägar som hittas först. Den ger den "naturliga" vägen för "Visa
// lösningen": 2x + 4 = 14 → −4, ÷2 (inte ÷2, −2).
// ============================================================================

import { BASE_RULES } from "./config.js";
import { equationKey, isSolved } from "./equation.js";
import { applyNumber, candidateOperands } from "./operations.js";

const SEARCH_ORDER = ["-", "+", "/", "*"];

/** Alla giltiga drag från ett tillstånd: [{ op, value, after }]. */
export function legalMoves(eq, rules = BASE_RULES) {
  const out = [];
  const operands = candidateOperands(eq);
  for (const op of SEARCH_ORDER) {
    for (const value of operands) {
      const r = applyNumber(eq, op, value, rules);
      if (r.ok) out.push({ op, value, after: r.after });
    }
  }
  return out;
}

/**
 * Kortaste vägen till löst. → { moves, path: [{op, value}] }, eller null om
 * ekvationen inte går att lösa inom maxDepth drag.
 */
export function optimalPath(eq, rules = BASE_RULES, maxDepth = rules.maxSearchDepth ?? 6) {
  if (isSolved(eq)) return { moves: 0, path: [] };
  const seen = new Set([equationKey(eq)]);
  let frontier = [{ eq, path: [] }];
  for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
    const next = [];
    for (const node of frontier) {
      for (const m of legalMoves(node.eq, rules)) {
        const key = equationKey(m.after);
        if (seen.has(key)) continue;
        seen.add(key);
        const path = [...node.path, { op: m.op, value: m.value }];
        if (isSolved(m.after)) return { moves: depth, path };
        next.push({ eq: m.after, path });
      }
    }
    frontier = next;
  }
  return null;
}

/** Minsta antal drag kvar (null = inte inom maxDepth). */
export function optimalMoves(eq, rules = BASE_RULES, maxDepth) {
  return optimalPath(eq, rules, maxDepth)?.moves ?? null;
}

/**
 * Hur ett giltigt drag påverkade avståndet till lösningen (för feedbacken i
 * E1.7 – ett giltigt drag kallas aldrig "fel"):
 *   "closer"  färre drag kvar än före
 *   "same"    lika många ("Det fungerar, men ekvationen blev inte enklare än.")
 *   "further" fler drag kvar ("Båda sidor är fortfarande lika. Finns det …")
 */
export function moveEffect(before, after, rules = BASE_RULES) {
  const a = optimalMoves(before, rules);
  const b = optimalMoves(after, rules);
  if (a === null || b === null) return b === null && a !== null ? "further" : "same";
  if (b < a) return "closer";
  return b === a ? "same" : "further";
}
