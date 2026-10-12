// ============================================================================
// Ekvationsresan – operationer och spärrar (src/ekvationsresan/operations.js)
// ----------------------------------------------------------------------------
// #615, spec E1.4. Eleven väljer + − · ÷ och ett tal; operationen görs på BÅDA
// leden och förenklas automatiskt (förenklingen är inget drag).
//
// Spärrar (konfigurerbara per nivå via rules, config.js). Ett spärrat drag ger
// elevens förklaring och räknas INTE som drag:
//   div0      ÷ 0
//   mul0      · 0
//   xProduct  · eller ÷ med en x-term (Etapp 2-fältet; x · x finns inte här)
//   fraction  någon term blir ett bråk/decimaltal. x/a (x delat med ett heltal,
//             t.ex. x/4 = 6 på nivå 2) räknas som "x delat med 4", inte som bråk.
//   negative  ett led börjar med minus (−6, −2x + …) eller ledens värde vid
//             lösningen blir negativt. "x − 3" är subtraktion, inget minustal.
//   tooBig    något tal (täljare eller x/a-nämnare) över rules.maxAbs (1 000)
// ============================================================================

import { BASE_RULES, BLOCK_MESSAGES } from "./config.js";
import { q, mul, div, neg, abs, isZero, isInteger, isNegative, isDecimal } from "./rational.js";
import { term, coefOf, simplifySide, makeEquation, solve, evaluateSide } from "./equation.js";
import { normalizeOp } from "./operand.js";

/** Leden direkt efter operationen, före förenkling (används av notation.js). */
function applyToSide(side, op, operand) {
  const c = coefOf(operand);
  if (op === "+") return [...side, operand];
  if (op === "-") return [...side, term(neg(c), operand.x)];
  if (op === "*") return side.map((t) => term(mul(coefOf(t), c), t.x + operand.x));
  return side.map((t) => term(div(coefOf(t), c), t.x));
}

function termAllowed(t, rules) {
  const c = coefOf(t);
  if (isInteger(c) || rules.allowFractions) return true;
  if (rules.allowDecimals && isDecimal(c, rules.maxDecimals)) return true;
  // x/a: x-term med koefficienten ±1/a visas som ett heltal under bråkstreck.
  return t.x === 1 && Math.abs(c.n) === 1;
}

function tooBig(t, rules) {
  return Math.abs(t.n) > rules.maxAbs || t.d > rules.maxAbs;
}

function hasNegative(eq) {
  for (const side of [eq.left, eq.right]) {
    if (side.length && isNegative(coefOf(side[0]))) return true;
  }
  const x = solve(eq);
  if (x === null) return false;
  return isNegative(evaluateSide(eq.left, x)) || isNegative(evaluateSide(eq.right, x));
}

/** Kontrollera ett färdigt (förenklat) tillstånd mot spärrarna. → kod eller null */
export function checkState(eq, rules = BASE_RULES) {
  const terms = [...eq.left, ...eq.right];
  if (!terms.every((t) => termAllowed(t, rules))) return "fraction";
  if (!rules.allowNegative && hasNegative(eq)) return "negative";
  if (terms.some((t) => tooBig(t, rules))) return "tooBig";
  return null;
}

function blocked(code) {
  return { ok: false, block: code, message: BLOCK_MESSAGES[code] };
}

/**
 * Gör operationen `op` med `operand` (en term) på båda leden.
 * @returns {{ok:true, op, operand, before, raw:{left,right}, after}
 *          | {ok:false, block:string, message:string}}
 *   raw   = leden före förenkling (för operationsraden i MIN LÖSNING)
 *   after = den förenklade ekvationen (nästa tillstånd)
 */
export function applyOperation(eq, opIn, operand, rules = BASE_RULES) {
  const op = normalizeOp(opIn);
  if (!op) throw new TypeError(`Ekvationsresan: okänd operation ${opIn}`);
  const c = coefOf(operand);
  if (op === "/" && isZero(c)) return blocked("div0");
  if (op === "*" && isZero(c)) return blocked("mul0");
  if ((op === "*" || op === "/") && operand.x) return blocked("xProduct");

  const raw = { left: applyToSide(eq.left, op, operand), right: applyToSide(eq.right, op, operand) };
  const after = makeEquation(simplifySide(raw.left), simplifySide(raw.right));
  const code = checkState(after, rules);
  if (code) return blocked(code);
  return { ok: true, op, operand: term(c, operand.x), before: eq, raw, after };
}

/** Bekvämlighet: applyOperation med ett heltal som operand. */
export const applyNumber = (eq, op, value, rules) => applyOperation(eq, op, term(q(value), 0), rules);

/**
 * Rimliga operander för ett tillstånd (BFS i solver.js och hjälpen): talen i
 * ekvationen – konstanternas absolutbelopp, x-koefficienternas täljare och
 * x/a-nämnare – som positiva heltal.
 */
export function candidateOperands(eq) {
  const set = new Set();
  for (const t of [...eq.left, ...eq.right]) {
    const c = abs(coefOf(t));
    if (c.n >= 1) set.add(c.n);
    if (c.d > 1) set.add(c.d);
  }
  return [...set].sort((a, b) => a - b);
}

export const OPS = Object.freeze(["+", "-", "*", "/"]);
