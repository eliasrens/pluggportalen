// ============================================================================
// Ekvationsresan – talfältets parser (src/ekvationsresan/operand.js) · #615
// ----------------------------------------------------------------------------
// Tangentbordsflödet från Mattematchen (E1.4): "-4" ENTER = subtrahera 4,
// "+5" = addera 5, "/2" eller ":2" = dividera med 2, "*3" = multiplicera med 3.
// Står inget tecken först gäller knappen eleven valt (`op`).
//
// Etapp 2 (#623) slår på mer via nivåns spärrar (config.js):
//   rules.operandX        "x", "2x", "-2x", "+2,5x"   nivå 7+
//   rules.operandDecimal  "2,5" / "2.5", högst rules.maxDecimals decimaler   nivå 10+
//   rules.allowNegative   division med ett negativt tal (#647): "/-2", "÷ -2",
//                         "÷ (−2)", "÷ −2"   nivå 9+ (där negativa mellanled finns).
//                         Under nivå 9 blir det samma "kan inte läsa" som förut.
// Minustecknet U+2212 (−) normaliseras till "-" innan tolkningen.
//
// Resultat: { ok: true, op, operand } där op ∈ "+", "-", "*", "/" och operand
// är en term (equation.js) – eller { ok: false, error, message }.
// ============================================================================

import { BASE_RULES, OPERAND_MESSAGES } from "./config.js";
import { parseDecimalSv, cmp, q, neg, isInteger, isDecimal } from "./rational.js";
import { term } from "./equation.js";

/** Tecken eleven kan skriva/trycka → intern operation. */
const OP_CHARS = {
  "+": "+",
  "-": "-",
  "−": "-",
  "*": "*",
  "·": "*",
  "×": "*",
  "/": "/",
  ":": "/",
  "÷": "/",
};

/** Visningstecken i räknegången (E1.3: multiplikation skrivs ·). */
export const OP_SYMBOL = Object.freeze({ "+": "+", "-": "−", "*": "·", "/": "÷" });

export const normalizeOp = (op) => OP_CHARS[op] || null;

function fail(error) {
  return { ok: false, error, message: OPERAND_MESSAGES[error] };
}

/**
 * @param {string} text  det eleven skrev, t.ex. "-4", "/2", "4"
 * @param {{op?: string, rules?: object}} [opts]  op = vald knapp (valfri)
 */
export function parseOperand(text, { op: chosen = null, rules = BASE_RULES } = {}) {
  let src = String(text ?? "").replace(/\s+/g, "").replace(/−/g, "-");
  if (!src) return fail("empty");

  let op = normalizeOp(src[0]);
  if (op) src = src.slice(1);
  else op = chosen ? normalizeOp(chosen) : null;
  if (!src) return fail("empty");

  // ÷ ett negativt tal (#647): "-2" eller "(-2)" efter divisionstecknet.
  const negDiv = op === "/" && rules.allowNegative ? /^(?:-(.+)|\(-(.+)\))$/.exec(src) : null;
  if (negDiv) src = negDiv[1] ?? negDiv[2];

  const m = /^(\d+(?:[,.]\d+)?)?(x)?$/i.exec(src);
  if (!m || (!m[1] && !m[2])) return fail("syntax");
  if (!op) return fail("noOp");

  const isX = Boolean(m[2]);
  if (isX && !rules.operandX) return fail("xOff");
  const value = m[1] ? parseDecimalSv(m[1]) : q(1);
  if (value === null) return fail("syntax");
  if (!isInteger(value) && !rules.operandDecimal) return fail("decimalOff");
  if (!isDecimal(value, rules.maxDecimals)) return fail("decimalMax");
  if (cmp(value, q(rules.operandMin)) < 0 || cmp(value, q(rules.operandMax)) > 0) return fail("range");

  return { ok: true, op, operand: term(negDiv ? neg(value) : value, isX ? 1 : 0) };
}
