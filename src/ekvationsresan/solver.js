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
//
// Etapp 2 (#623): med rules.operandX söks även x-termsoperander (−x, −2x) och
// med rules.operandDecimal decimaltal (÷2,5). x-termer prövas först, så
// 3x + 4 = x + 12 ger −x, −4, ÷2. Vägsteg: { op, value } för heltal, annars
// { op, n, d, x } (operations.moveStep).
// ============================================================================

import { BASE_RULES } from "./config.js";
import { equationKey, isSolved } from "./equation.js";
import { applyOperation, candidateOperands, moveStep } from "./operations.js";

const SEARCH_ORDER = ["-", "+", "/", "*"];

/** Alla giltiga drag från ett tillstånd: [{ step, after }], step = moveStep-formen. */
export function legalMoves(eq, rules = BASE_RULES) {
  const out = [];
  const operands = candidateOperands(eq, rules);
  const tryMove = (op, operand) => {
    const r = applyOperation(eq, op, operand, rules);
    if (r.ok) out.push({ step: moveStep(op, operand), after: r.after });
  };
  // x-termer först (− x, + 2x): när x står i båda leden flyttas x först.
  // · och ÷ med x spärras alltid (xProduct) och prövas inte.
  for (const op of SEARCH_ORDER) for (const o of operands) if (o.x && (op === "-" || op === "+")) tryMove(op, o);
  for (const op of SEARCH_ORDER) for (const o of operands) if (!o.x) tryMove(op, o);
  return out;
}

function bfs(eq, rules, maxDepth) {
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
        const path = [...node.path, m.step];
        if (isSolved(m.after)) return { moves: depth, path };
        next.push({ eq: m.after, path });
      }
    }
    frontier = next;
  }
  return null;
}

/**
 * Kortaste vägen till löst. → { moves, path: [step] }, eller null om
 * ekvationen inte går att lösa inom maxDepth drag.
 *
 * Där minustal är tillåtna (nivå 9+) väljs bland lika korta vägar en utan
 * minustal om det finns: "Visa lösningen" och hjälpen visar då den väg som
 * inte kräver negativa mellanled (antalet drag är detsamma).
 */
export function optimalPath(eq, rules = BASE_RULES, maxDepth = rules.maxSearchDepth ?? 6) {
  const best = bfs(eq, rules, maxDepth);
  if (!best || best.moves === 0 || !rules.allowNegative) return best;
  const positive = bfs(eq, { ...rules, allowNegative: false }, best.moves);
  return positive && positive.moves === best.moves ? positive : best;
}

/** Minsta antal drag kvar (null = inte inom maxDepth). */
export function optimalMoves(eq, rules = BASE_RULES, maxDepth = rules.maxSearchDepth ?? 6) {
  return bfs(eq, rules, maxDepth)?.moves ?? null;
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
