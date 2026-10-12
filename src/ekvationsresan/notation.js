// ============================================================================
// Ekvationsresan – korrekt skrivsätt (src/ekvationsresan/notation.js) · #615
// ----------------------------------------------------------------------------
// Spec E1.3 (MYCKET VIKTIGT). Bygger raderna i MIN LÖSNING som STRUKTURERAD
// data – UI:t renderar, logiken bestämmer matematiken:
//
//   Rad     { kind, segments, text }
//           kind ∈ "start" | "op" | "mid" | "simplified" | "final"
//   Segment { t, text, mark?, num?, den? }
//           t    ∈ "term" | "sign" | "paren" | "op" | "eq"
//           mark = "op" på elevens operation (ritas i rött)
//           num/den finns på termer som ska ritas med bråkstreck (x/4)
//   text    raden som ren text: "(2x + 4) ÷ 2 = 14 ÷ 2"
//
// Regler:
//   * + och − skrivs sist i ledet, utan parentes:     2x + 4 − 4 = 14 − 4
//   * ÷ och · av ett led med FLERA termer får parentes: (2x + 4) ÷ 2 = 14 ÷ 2
//     – aldrig "2x + 4 ÷ 2". Ett led med en term: 2x ÷ 2 = 10 ÷ 2
//   * multiplikation skrivs "·", division "÷", minus "−" (U+2212)
//   * mellanled vid fördelning (rules.distributionStep, nivå 1–6):
//       (2x + 4) ÷ 2 = 14 ÷ 2  →  2x ÷ 2 + 4 ÷ 2 = 7  →  x + 2 = 7
//   * x delat med ett tal i UPPGIFTEN skrivs ALLTID med bråkstreck, x/4
//     (segmentet har num "x", den "4"); elevens division skrivs alltid "÷".
//     Valet är konsekvent: bråkstreck = en term, ÷ = en operation.
//   * slutar uppgiften med "5 = x" läggs en sista rad "x = 5" till.
// ============================================================================

import { abs, isInteger, isNegative, isDecimal, formatSv } from "./rational.js";
import { coefOf } from "./equation.js";
import { OP_SYMBOL } from "./operand.js";

const MINUS = "−";

/** En term (utan tecken om `unsigned`) → segment. */
export function termSegment(t, { unsigned = false } = {}) {
  const c = unsigned ? abs(coefOf(t)) : coefOf(t);
  const sign = isNegative(c) ? MINUS : "";
  const a = abs(c);
  if (!t.x) return { t: "term", text: formatSv(c) };
  if (a.n === 1 && a.d === 1) return { t: "term", text: `${sign}x` };
  if (isInteger(a) || isDecimal(a)) return { t: "term", text: `${sign}${formatSv(a)}x` };
  const num = a.n === 1 ? "x" : `${a.n}x`;
  return { t: "term", text: `${sign}${num}/${a.d}`, num: `${sign}${num}`, den: String(a.d) };
}

/** Ett led som segment: "2x + 4", "x − 3", tomt led = "0". */
export function sideSegments(side) {
  if (!side.length) return [{ t: "term", text: "0" }];
  const out = [termSegment(side[0])];
  for (const t of side.slice(1)) {
    out.push({ t: "sign", text: isNegative(coefOf(t)) ? MINUS : "+" });
    out.push(termSegment(t, { unsigned: true }));
  }
  return out;
}

/** Elevens operation som ETT markerat segment: "÷ 2", "− 4". */
export function opSegment(op, operand) {
  return { t: "op", text: `${OP_SYMBOL[op]} ${termSegment(operand, { unsigned: true }).text}`, mark: "op" };
}

/** Radtext: mellanslag mellan segment, men inte innanför parenteser. */
export function rowText(segments) {
  let s = "";
  segments.forEach((seg, i) => {
    const prev = segments[i - 1];
    if (i > 0 && !(prev.t === "paren" && prev.text === "(") && !(seg.t === "paren" && seg.text === ")")) s += " ";
    s += seg.text;
  });
  return s;
}

function row(kind, left, right) {
  const segments = [...left, { t: "eq", text: "=" }, ...right];
  return { kind, segments, text: rowText(segments) };
}

/** En ekvation som rad, t.ex. startraden eller den förenklade raden. */
export const equationRow = (eq, kind = "simplified") => row(kind, sideSegments(eq.left), sideSegments(eq.right));

/** Operationsraden för ETT led: "2x + 4 − 4", "(2x + 4) ÷ 2", "10 ÷ 2". */
function opSide(side, op, operand) {
  const segs = sideSegments(side);
  const opSeg = opSegment(op, operand);
  if ((op === "*" || op === "/") && side.length > 1) {
    return [{ t: "paren", text: "(" }, ...segs, { t: "paren", text: ")" }, opSeg];
  }
  return [...segs, opSeg];
}

/** Mellanledet för ett led: "2x ÷ 2 + 4 ÷ 2"; ett led med en term visas förenklat. */
function distributedSide(side, simplified, op, operand) {
  if (side.length <= 1) return sideSegments(simplified);
  const out = [];
  side.forEach((t, i) => {
    if (i > 0) out.push({ t: "sign", text: isNegative(coefOf(t)) ? MINUS : "+" });
    out.push(termSegment(t, { unsigned: i > 0 }), opSegment(op, operand));
  });
  return out;
}

/**
 * Raderna för ett giltigt drag (resultatet från applyOperation):
 * operationsraden, ev. mellanled, den förenklade raden.
 */
export function moveRows(result, rules = {}) {
  const { before, after, op, operand } = result;
  const rows = [row("op", opSide(before.left, op, operand), opSide(before.right, op, operand))];
  const distributes = (op === "*" || op === "/") && (before.left.length > 1 || before.right.length > 1);
  if (distributes && rules.distributionStep !== false) {
    rows.push(row("mid", distributedSide(before.left, after.left, op, operand), distributedSide(before.right, after.right, op, operand)));
  }
  rows.push(equationRow(after, "simplified"));
  return rows;
}

/** Sista raden "x = 5" när eleven landat i "5 = x". */
export function finalRow(eq) {
  return row("final", sideSegments(eq.right), sideSegments(eq.left));
}
