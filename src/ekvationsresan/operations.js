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
//
// Etapp 2 (#623): operanden kan vara en x-term (−2x, rules.operandX, nivå 7+)
// eller ett decimaltal (÷2,5, rules.operandDecimal, nivå 10+). Ett drag i en
// sparad väg är { op, value } för heltal (Etapp 1-formen) och { op, n, d, x }
// för x-termer och decimaler – moveStep/moveOperand översätter.
// ============================================================================

import { BASE_RULES, BLOCK_MESSAGES } from "./config.js";
import { q, mul, div, neg, abs, cmp, isZero, isInteger, isNegative, isDecimal } from "./rational.js";
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

/** Ett drag som vägsteg: heltal → { op, value } (Etapp 1), annars { op, n, d, x }. */
export function moveStep(op, operand) {
  if (!operand.x && operand.d === 1) return { op, value: operand.n };
  return { op, n: operand.n, d: operand.d, x: operand.x };
}

/** Operanden (en term) i ett vägsteg/sparat drag: { operand } | { n, d, x } | { value }. */
export function moveOperand(m) {
  if (m.operand) return m.operand;
  if ("n" in m) return term(q(m.n, m.d ?? 1), m.x || 0);
  return term(q(m.value), 0);
}

/** Gör ett vägsteg (moveStep-formen) på ekvationen. */
export const applyStep = (eq, step, rules) => applyOperation(eq, step.op, moveOperand(step), rules);

/** Kan eleven skriva koefficienten c i talfältet med de här spärrarna? */
function typeable(c, rules) {
  if (isInteger(c)) return true;
  return Boolean(rules.operandDecimal) && isDecimal(c, rules.maxDecimals);
}

/**
 * Rimliga operander för ett tillstånd (BFS i solver.js och hjälpen) som
 * termer: talen i ekvationen – konstanternas absolutbelopp, x-koefficienternas
 * täljare och x/a-nämnare – som positiva heltal. Med rules.operandDecimal även
 * decimaltalen själva (2,5), med rules.operandX även x-termerna (x, 3x, 2,5x).
 * Ordning: x-termer först (det naturliga första draget när x står i båda
 * leden), sedan talen i storleksordning.
 */
export function candidateOperands(eq, rules = BASE_RULES) {
  const nums = new Map();
  const xs = new Map();
  const put = (map, c, x) => map.set(`${c.n}/${c.d}`, term(c, x));
  for (const t of [...eq.left, ...eq.right]) {
    const c = abs(coefOf(t));
    if (c.n >= 1) put(nums, q(c.n), 0);
    if (c.d > 1) put(nums, q(c.d), 0);
    // x/4 är "x delat med 4" – inte talet 0,25 (då blev vägen ÷0,25 i stället för ·4).
    const xa = t.x && c.n === 1 && c.d > 1;
    if (!isInteger(c) && !xa && typeable(c, rules)) put(nums, c, 0);
    if (t.x && !xa && rules.operandX && typeable(c, rules)) put(xs, c, 1);
  }
  const byValue = (a, b) => cmp(coefOf(a), coefOf(b));
  return [...[...xs.values()].sort(byValue), ...[...nums.values()].sort(byValue)];
}

export const OPS = Object.freeze(["+", "-", "*", "/"]);
