// ============================================================================
// Ekvationsresan – talfältets parser (src/ekvationsresan/operand.js) · #615
// ----------------------------------------------------------------------------
// Tangentbordsflödet från Mattematchen (E1.4): "-4" ENTER = subtrahera 4,
// "+5" = addera 5, "/2" eller ":2" = dividera med 2, "*3" = multiplicera med 3.
// Står inget tecken först gäller knappen eleven valt (`op`).
//
// Förberett för Etapp 2 men AVSTÄNGT via spärrarna (config.js):
//   rules.operandX        "x", "2x", "-2x"
//   rules.operandDecimal  "2,5" / "2.5"
//
// Resultat: { ok: true, op, operand } där op ∈ "+", "-", "*", "/" och operand
// är en term (equation.js) – eller { ok: false, error, message }.
// ============================================================================

import { BASE_RULES, OPERAND_MESSAGES } from "./config.js";
import { parseDecimalSv, cmp, q, isInteger } from "./rational.js";
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
  let src = String(text ?? "").replace(/\s+/g, "");
  if (!src) return fail("empty");

  let op = normalizeOp(src[0]);
  if (op) src = src.slice(1);
  else op = chosen ? normalizeOp(chosen) : null;
  if (!src) return fail("empty");

  const m = /^(\d+(?:[,.]\d+)?)?(x)?$/i.exec(src);
  if (!m || (!m[1] && !m[2])) return fail("syntax");
  if (!op) return fail("noOp");

  const isX = Boolean(m[2]);
  if (isX && !rules.operandX) return fail("xOff");
  const value = m[1] ? parseDecimalSv(m[1]) : q(1);
  if (value === null) return fail("syntax");
  if (!isInteger(value) && !rules.operandDecimal) return fail("decimalOff");
  if (cmp(value, q(rules.operandMin)) < 0 || cmp(value, q(rules.operandMax)) > 0) return fail("range");

  return { ok: true, op, operand: term(value, isX ? 1 : 0) };
}
