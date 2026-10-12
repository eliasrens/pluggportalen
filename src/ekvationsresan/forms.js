// ============================================================================
// Ekvationsresan – uppgiftsformer (src/ekvationsresan/forms.js) · #615
// ----------------------------------------------------------------------------
// En FORM är en mall för en sorts ekvation. build(p, rng) väljer lösningen x
// FÖRST och räknar fram talen ur den, så generatorn vet alltid svaret och x är
// alltid ett positivt heltal (E1.8). Nivåerna i config.js väljer former med
// vikter och ger parametrarna (p).
//
// Ny form (Etapp 2, t.ex. "ax+b=cx+d" för nivå 7) = en rad i FORMS + en vikt i
// LEVELS. `moves` = formens strukturella optimum, som testerna jämför BFS:en
// mot (solver.js räknar alltid själv; det är BFS-resultatet som sparas).
// ============================================================================

import { q } from "./rational.js";
import { term, makeEquation } from "./equation.js";

/** Heltal i [min, max] ur rng (Math.random-lik funktion). */
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

const X = (a = 1) => term(q(a), 1); //       ax
const XA = (a) => term(q(1, a), 1); //       x/a
const C = (n) => term(q(n), 0); //           tal

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
});
