// ============================================================================
// Ekvationsresan – uppgiftsformer (src/ekvationsresan/forms.js) · #615
// ----------------------------------------------------------------------------
// En FORM är en mall för en sorts ekvation. build(p, rng) väljer lösningen x
// FÖRST och räknar fram talen ur den, så generatorn vet alltid svaret och x är
// alltid positivt (E1.8, E2.1) – ett heltal, utom i "ax+b=c:xdec" (nivå 10+,
// x = 2,5). Nivåerna i config.js väljer former med vikter och ger parametrarna
// (p). `solution` är ett heltal eller ett exakt tal { n, d }.
//
// Ny form = en rad i FORMS + en vikt i LEVELS. `moves` = formens strukturella optimum, som testerna jämför BFS:en
// mot (solver.js räknar alltid själv; det är BFS-resultatet som sparas).
// ============================================================================

import { q, add, mul } from "./rational.js";
import { term, makeEquation } from "./equation.js";

/** Heltal i [min, max] ur rng (Math.random-lik funktion). */
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

const X = (a = 1) => term(q(a), 1); //       ax
const XA = (a) => term(q(1, a), 1); //       x/a
const C = (n) => term(q(n), 0); //           tal
const XQ = (c) => term(c, 1); //             2,5x (c rationellt)
const CQ = (c) => term(c, 0); //             2,5

/**
 * Decimalkoefficienter för nivå 10+ (n/d, aldrig heltal, aldrig täljaren 1 –
 * 0,5x skrivs x/2). Högst två decimaler: 1,5 2,5 3,5 4,5 1,2 1,25 0,75 1,75.
 */
const DECIMALS = Object.freeze([[3, 2], [5, 2], [7, 2], [9, 2], [6, 5], [5, 4], [3, 4], [7, 4]]);
const pickDecimal = (rng) => {
  const [n, d] = DECIMALS[randInt(rng, 0, DECIMALS.length - 1)];
  return q(n, d);
};

/** p = nivåns params; varje build returnerar { equation, solution } eller null. */
export const FORMS = Object.freeze({
  "x+a=b": {
    moves: 1,
    build(p, rng) {
      const max = p.maxNumber ?? 20;
      const x = randInt(rng, 1, max - 1);
      const a = randInt(rng, 1, max - x);
      return { equation: makeEquation([X(), C(a)], [C(x + a)]), solution: x };
    },
  },
  "x-a=b": {
    moves: 1,
    build(p, rng) {
      const max = p.maxNumber ?? 20;
      const x = randInt(rng, 2, max);
      const a = randInt(rng, 1, x - 1);
      return { equation: makeEquation([X(), C(-a)], [C(x - a)]), solution: x };
    },
  },
  "ax=b": {
    moves: 1,
    build(p, rng) {
      const a = randInt(rng, p.aMin ?? 2, p.aMax ?? 10);
      const x = randInt(rng, 2, p.xMax ?? 12);
      return { equation: makeEquation([X(a)], [C(a * x)]), solution: x };
    },
  },
  "x/a=b": {
    moves: 1,
    build(p, rng) {
      const a = randInt(rng, p.aMin ?? 2, p.aMax ?? 10);
      const b = randInt(rng, 2, p.xMax ?? 12); // kvoten hålls lika liten som x i ax=b
      return { equation: makeEquation([XA(a)], [C(b)]), solution: a * b };
    },
  },
  "ax+b=c": {
    moves: 2,
    build(p, rng) {
      const a = randInt(rng, p.aMin ?? 2, p.aMax ?? 5);
      const x = randInt(rng, p.xMin ?? 1, p.xMax ?? 10);
      const b = randInt(rng, p.bMin ?? 1, p.bMax ?? 10);
      return { equation: makeEquation([X(a), C(b)], [C(a * x + b)]), solution: x };
    },
  },
  "ax-b=c": {
    moves: 2,
    build(p, rng) {
      const a = randInt(rng, p.aMin ?? 2, p.aMax ?? 9);
      const x = randInt(rng, Math.max(2, p.xMin ?? 2), p.xMax ?? 12);
      const b = randInt(rng, p.bMin ?? 1, Math.min(p.bMax ?? 20, a * x - 1));
      if (b < 1) return null;
      return { equation: makeEquation([X(a), C(-b)], [C(a * x - b)]), solution: x };
    },
  },
  "x/a+b=c": {
    moves: 2,
    build(p, rng) {
      const a = randInt(rng, p.aMin ?? 2, p.aMax ?? 9);
      const k = randInt(rng, 1, p.quotientMax ?? 12); // x/a
      const b = randInt(rng, p.bMin ?? 1, p.bMax ?? 20);
      return { equation: makeEquation([XA(a), C(b)], [C(k + b)]), solution: a * k };
    },
  },
  "x/a-b=c": {
    moves: 2,
    build(p, rng) {
      const a = randInt(rng, p.aMin ?? 2, p.aMax ?? 9);
      const k = randInt(rng, 2, p.quotientMax ?? 12);
      const b = randInt(rng, 1, Math.min(p.bMax ?? 20, k - 1));
      return { equation: makeEquation([XA(a), C(-b)], [C(k - b)]), solution: a * k };
    },
  },

  // --- Etapp 2 (#623): x i båda leden, nivå 7–9, 11–12 ------------------------
  // Skillnaden mellan x-koefficienterna är minst 2, annars blir det ett drag
  // kortare (3x + 4 = 2x + 9 är löst efter −2x, −4).

  "ax=cx+d": { //                3x = x + 8
    moves: 2,
    build(p, rng) {
      const a = randInt(rng, Math.max(3, p.aMin ?? 3), p.aMax ?? 5);
      const c = randInt(rng, 1, a - 2);
      const x = randInt(rng, 1, p.xMax ?? 10);
      return { equation: makeEquation([X(a)], [X(c), C((a - c) * x)]), solution: x };
    },
  },
  "ax+b=cx+d": { //              3x + 4 = x + 12
    moves: 3,
    build(p, rng) {
      const a = randInt(rng, Math.max(3, p.aMin ?? 3), p.aMax ?? 5);
      const c = randInt(rng, 1, a - 2);
      const x = randInt(rng, 1, p.xMax ?? 10);
      const b = randInt(rng, 1, p.bMax ?? 12);
      return { equation: makeEquation([X(a), C(b)], [X(c), C((a - c) * x + b)]), solution: x };
    },
  },
  "ax-b=cx+d": { //              5x − 7 = 2x + 20
    moves: 3,
    build(p, rng) {
      const a = randInt(rng, Math.max(3, p.aMin ?? 3), p.aMax ?? 8);
      const c = randInt(rng, 1, a - 2);
      const x = randInt(rng, 2, p.xMax ?? 12);
      const b = randInt(rng, 1, Math.min(p.bMax ?? 25, (a - c) * x - 1));
      if (b < 1) return null;
      return { equation: makeEquation([X(a), C(-b)], [X(c), C((a - c) * x - b)]), solution: x };
    },
  },
  "ax+b=cx-d": { //              2x + 9 = 5x − 6
    moves: 3,
    build(p, rng) {
      const a = randInt(rng, 1, Math.max(1, (p.aMax ?? 8) - 2));
      const c = randInt(rng, a + 2, Math.max(a + 2, p.aMax ?? 8));
      const x = randInt(rng, 2, p.xMax ?? 12);
      const b = randInt(rng, 1, p.bMax ?? 25);
      const d = (c - a) * x - b;
      if (d < 1 || c * x - d < 1) return null;
      return { equation: makeEquation([X(a), C(b)], [X(c), C(-d)]), solution: x };
    },
  },
  "b-ax=c": { //                 20 − 2x = 8 (nivå 9: −20 ger minustal)
    moves: 3,
    build(p, rng) {
      const a = randInt(rng, 2, p.aMax ?? 8);
      const x = randInt(rng, 1, p.xMax ?? 12);
      const c = randInt(rng, 1, p.bMax ?? 25);
      return { equation: makeEquation([C(a * x + c), X(-a)], [C(c)]), solution: x };
    },
  },
  "b-ax=cx+d": { //              17 − 2x = x + 5
    moves: 3,
    build(p, rng) {
      const a = randInt(rng, 1, p.aMax ?? 8);
      const c = randInt(rng, 1, Math.max(1, (p.aMax ?? 8) - a));
      if (a + c < 2) return null;
      const x = randInt(rng, 1, p.xMax ?? 12);
      const d = randInt(rng, 1, p.bMax ?? 25);
      return { equation: makeEquation([C((a + c) * x + d), X(-a)], [X(c), C(d)]), solution: x };
    },
  },
  "ax-b=cx-d": { //              5x − 13 = 2x − 1
    moves: 3,
    build(p, rng) {
      const a = randInt(rng, Math.max(3, p.aMin ?? 3), p.aMax ?? 8);
      const c = randInt(rng, 1, a - 2);
      const x = randInt(rng, 2, p.xMax ?? 12);
      const d = randInt(rng, 1, Math.min(p.bMax ?? 25, c * x - 1));
      if (d < 1) return null;
      return { equation: makeEquation([X(a), C(-((a - c) * x + d))], [X(c), C(-d)]), solution: x };
    },
  },

  // --- Etapp 2 (#623): decimaler, nivå 10+ ------------------------------------

  "dx=c": { //                   1,5x = 9
    moves: 1,
    build(p, rng) {
      const a = pickDecimal(rng);
      const x = randInt(rng, 2, p.xMax ?? 10) * a.d; // a · x blir ett heltal
      if (x > (p.xMax ?? 10) * 2) return null;
      return { equation: makeEquation([XQ(a)], [CQ(mul(a, q(x)))]), solution: x };
    },
  },
  "dx+b=c": { //                 2,5x + 4 = 19 (högerledet får vara 11,5)
    moves: 2,
    build(p, rng) {
      const a = pickDecimal(rng);
      const x = randInt(rng, Math.max(2, p.xMin ?? 2), p.xMax ?? 10);
      const b = randInt(rng, p.bMin ?? 1, p.bMax ?? 20);
      return { equation: makeEquation([XQ(a), C(b)], [CQ(add(mul(a, q(x)), q(b)))]), solution: x };
    },
  },
  "ax+b=c:xdec": { //            2x + 3 = 8 → x = 2,5
    moves: 2,
    build(p, rng) {
      const a = [2, 4, 5][randInt(rng, 0, 2)];
      const k = randInt(rng, 1, (p.xMax ?? 10) * a);
      if (k % a === 0) return null; // lösningen ska vara ett decimaltal
      const b = randInt(rng, p.bMin ?? 1, p.bMax ?? 20);
      return { equation: makeEquation([X(a), C(b)], [C(k + b)]), solution: q(k, a) };
    },
  },
  "dx+b=ex+f": { //              3,5x + 3 = x + 12 (−x, −3, ÷2,5)
    moves: 3,
    build(p, rng) {
      const diff = pickDecimal(rng);
      const c = randInt(rng, 1, 3);
      const x = randInt(rng, 1, p.xMax ?? 10) * diff.d;
      if (x > (p.xMax ?? 10) * 2) return null;
      const b = randInt(rng, 1, p.bMax ?? 20);
      return { equation: makeEquation([XQ(add(diff, q(c))), C(b)], [X(c), CQ(add(mul(diff, q(x)), q(b)))]), solution: x };
    },
  },
});
