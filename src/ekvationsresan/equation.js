// ============================================================================
// Ekvationsresan – ekvationsmodellen (src/ekvationsresan/equation.js) · #615
// ----------------------------------------------------------------------------
// En ekvation har två led; varje led är en lista av termer:
//
//   Term     { n, d, x }   koefficienten n/d (rational.js) · x^x, där x är 0
//                          (konstantterm) eller 1 (x-term). Plant och JSON-
//                          vänligt, så samma form sparas i Firestore.
//   Led      Term[]        tom lista = 0
//   Ekvation { left: Term[], right: Term[] }
//
// Förberett för Etapp 2: x får stå i BÅDA leden (3x + 4 = x + 12), och
// koefficienterna är rationella, så decimaler (2,5x) och bråk ryms utan
// ombyggnad. Etapp 1 använder bara x i ett led och heltal/x/a.
//
// Kanonisk ordning i ett förenklat led: x-termen först, sedan konstanten.
// ============================================================================

import { q, toQ, add, sub, mul, div, neg, isZero, isOne, ZERO, parseDecimalSv } from "./rational.js";

/** Skapa en term. term(2, 1) = 2x, term(q(1, 4), 1) = x/4, term(14) = 14. */
export function term(coef, x = 0) {
  const c = toQ(coef);
  return Object.freeze({ n: c.n, d: c.d, x: x ? 1 : 0 });
}

export const coefOf = (t) => q(t.n, t.d);

/** Slå ihop lika termer, ta bort nollor, x-termer först. */
export function simplifySide(side) {
  let xs = ZERO;
  let cs = ZERO;
  for (const t of side) {
    if (t.x) xs = add(xs, coefOf(t));
    else cs = add(cs, coefOf(t));
  }
  const out = [];
  if (!isZero(xs)) out.push(term(xs, 1));
  if (!isZero(cs)) out.push(term(cs, 0));
  return out;
}

export function makeEquation(left, right) {
  return Object.freeze({ left: Object.freeze(left.map((t) => term(coefOf(t), t.x))), right: Object.freeze(right.map((t) => term(coefOf(t), t.x))) });
}

/** Läs en sparad/okänd ekvation (Firestore, JSON) till modellen. */
export function fromJSON(raw) {
  if (!raw || !Array.isArray(raw.left) || !Array.isArray(raw.right)) throw new TypeError("Ekvationsresan: ogiltig ekvation");
  return makeEquation(raw.left, raw.right);
}

export function toJSON(eq) {
  const plain = (s) => s.map((t) => ({ n: t.n, d: t.d, x: t.x }));
  return { left: plain(eq.left), right: plain(eq.right) };
}

/** Ledets värde för ett givet x. */
export function evaluateSide(side, xValue) {
  const xv = toQ(xValue);
  return side.reduce((sum, t) => add(sum, t.x ? mul(coefOf(t), xv) : coefOf(t)), ZERO);
}

function linear(side) {
  let a = ZERO;
  let b = ZERO;
  for (const t of side) {
    if (t.x) a = add(a, coefOf(t));
    else b = add(b, coefOf(t));
  }
  return { a, b };
}

/** Lös ekvationen exakt. → rationellt tal, eller null om ingen entydig lösning. */
export function solve(eq) {
  const L = linear(eq.left);
  const R = linear(eq.right);
  const a = sub(L.a, R.a);
  if (isZero(a)) return null;
  return div(sub(R.b, L.b), a);
}

/** Har ledet exakt formen "x" (en x-term med koefficienten 1)? */
const isLoneX = (side) => side.length === 1 && side[0].x === 1 && isOne(coefOf(side[0]));
/** Är ledet ett rent tal (tomt = 0)? */
const isNumber = (side) => side.length <= 1 && side.every((t) => t.x === 0);

/**
 * Löst-villkoret (E1.4): x ensamt med koefficienten 1 på ena sidan och ett tal
 * på den andra. → { solved, value, flipped } där flipped = "5 = x".
 */
export function solvedState(eq) {
  if (isLoneX(eq.left) && isNumber(eq.right)) return { solved: true, value: eq.right.length ? coefOf(eq.right[0]) : ZERO, flipped: false };
  if (isLoneX(eq.right) && isNumber(eq.left)) return { solved: true, value: eq.left.length ? coefOf(eq.left[0]) : ZERO, flipped: true };
  return { solved: false, value: null, flipped: false };
}

export const isSolved = (eq) => solvedState(eq).solved;

/** Alla tal i ekvationen (koefficienter som rationella tal, med tecken). */
export function numbersOf(eq) {
  return [...eq.left, ...eq.right].map(coefOf);
}

/** Stabil nyckel för dubblettkontroll och BFS: "2x+4=14", "x/4=6". */
export function equationKey(eq) {
  const side = (s) => (s.length ? s.map((t) => `${t.n < 0 ? "-" : "+"}${Math.abs(t.n)}${t.d === 1 ? "" : "/" + t.d}${t.x ? "x" : ""}`).join("") : "0");
  return `${side(eq.left)}=${side(eq.right)}`;
}

export const sameEquation = (a, b) => equationKey(a) === equationKey(b);

// ---------------------------------------------------------------------------
//  Textparser (för tester, förhandsvisning och lärarverktyg). Tar emot
//  "2x + 4 = 14", "x − 3 = 8", "x/4 = 6", "14 = 2x + 4", "2,5x + 4 = 19",
//  "3x + 4 = x + 12". Minustecken får vara "-" eller "−".
// ---------------------------------------------------------------------------

const TERM_RE = /^(\d+(?:[,.]\d+)?)?(x)?(?:\/(\d+))?$/;

function parseSide(text) {
  const src = text.replace(/\s+/g, "").replace(/−/g, "-");
  if (!src) throw new SyntaxError("Ekvationsresan: tomt led");
  const parts = src.match(/[+-]?[^+-]+/g) || [];
  if (parts.join("") !== src) throw new SyntaxError(`Ekvationsresan: kan inte läsa "${text}"`);
  return parts.map((part) => {
    const sign = part[0] === "-" ? -1 : 1;
    const body = part.replace(/^[+-]/, "");
    const m = TERM_RE.exec(body);
    if (!m || (!m[1] && !m[2])) throw new SyntaxError(`Ekvationsresan: kan inte läsa termen "${part}"`);
    let c = m[1] ? parseDecimalSv(m[1]) : q(1);
    if (m[3]) c = div(c, q(Number(m[3])));
    if (sign < 0) c = neg(c);
    return term(c, m[2] ? 1 : 0);
  });
}

export function parseEquation(text) {
  const halves = String(text).split("=");
  if (halves.length !== 2) throw new SyntaxError(`Ekvationsresan: "${text}" har inte exakt ett likhetstecken`);
  return makeEquation(parseSide(halves[0]), parseSide(halves[1]));
}

/** Byt plats på leden (5 = x → x = 5). */
export const swapSides = (eq) => makeEquation(eq.right, eq.left);
