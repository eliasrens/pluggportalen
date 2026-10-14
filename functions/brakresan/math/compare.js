// ============================================================================
// Bråkresan – jämförelse (src/brakresan/math/compare.js) · #706
// ----------------------------------------------------------------------------
// Exakt rationell jämförelse för <, =, > (utm. 09, 16, 17, 25), sortering
// (26, 46) och unikhetskontroller i kortuppgifter (§6: "I sortering ska
// genererade värden vara olika om strikt ordning krävs").
// ============================================================================

import { toQ, cmp } from "./rational.js";

export const RELATIONS = Object.freeze(["<", "=", ">"]);
export const RELATION_WORDS = Object.freeze({ "<": "är mindre än", "=": "är lika med", ">": "är större än" });

/** Relationstecknet mellan a och b: relation(3/4, 1/4) → ">". */
export function relation(a, b) {
  return RELATIONS[cmp(toQ(a), toQ(b)) + 1];
}

/** Stigande ordning (stabil – lika värden behåller inbördes ordning). */
export function sortAscending(values, key = (v) => v) {
  return values.map((v, i) => [v, i]).sort(([a, i], [b, j]) => cmp(toQ(key(a)), toQ(key(b))) || i - j).map(([v]) => v);
}

/** Är alla värden olika (värdelikhet, 2/4 = 1/2)? */
export function allDistinct(values, key = (v) => v) {
  const seen = new Set();
  for (const v of values) {
    const x = toQ(key(v));
    const k = `${x.n}/${x.d}`;
    if (seen.has(k)) return false;
    seen.add(k);
  }
  return true;
}

/** Nyckel för värdeklassen ("1/2" för 2/4) – grupperar likvärdiga kort. */
export const valueKey = (v) => {
  const x = toQ(v);
  return `${x.n}/${x.d}`;
};

/** Är ordningen stigande? Lika värden får stå i valfri inbördes ordning (§6). */
export function isAscending(values, key = (v) => v) {
  for (let i = 1; i < values.length; i++) if (cmp(toQ(key(values[i - 1])), toQ(key(values[i]))) > 0) return false;
  return true;
}
