// ============================================================================
// Bråkresan – delade hjälpfunktioner för utmaningarna 21–35 (utmaningar/f-delat.js) · #711 F
// ----------------------------------------------------------------------------
// Små rena byggstenar som F:s utmaningsfiler delar: elevsvar i bedömningens
// form (granskningens exempel), bråk i uttryck, nycklar och talpooler.
// Ingen slump, inga webbläsar-API:er (synkas till Cloud Functions).
// Vyn "verkstad" som flera av F:s utmaningar använder beskrivs i
// src/brakresan/omgang-verkstad.js och docs/BRAKRESAN.md §5d.
// ============================================================================

import { gcd } from "../math/rational.js";

/** Elevens bråkfält. */
export const falt = (n, d) => ({ fields: { n: String(n), d: String(d) } });
/** Elevens fält i blandad form (heltal + bråk). */
export const blandat = (w, n, d) => ({ fields: { whole: String(w), n: String(n), d: String(d) } });
/** Elevens heltalsfält. */
export const heltal = (v) => ({ text: String(v) });
/** Ett bråk i ett uttryck (view.expr, kortens framsida). */
export const brak = (n, d) => ({ kind: "fraction", n, d });

export const NUMBER_FRACTION = Object.freeze({ type: "number", input: "fraction" });
export const NUMBER_INTEGER = Object.freeze({ type: "number", input: "integer" });
export const NUMBER_MIXED = Object.freeze({ type: "number", input: "mixed" });

/** Bedömningsregel för ett tal: värdet { n, d } och formkravet. */
export const talNyckel = (v, requirement = { kind: "value" }) => ({ type: "number", value: { n: v.n, d: v.d }, requirement });

/** Förkortade äkta bråk p/q med nämnare lo–hi, i fast ordning. */
export function basbrak(lo, hi) {
  const ut = [];
  for (let qq = lo; qq <= hi; qq++) for (let p = 1; p < qq; p++) if (gcd(p, qq) === 1) ut.push([p, qq]);
  return ut;
}

/** Delarna i läsordning: p0 … p{n−1}. */
export const ids = (n, start = 0) => Array.from({ length: n }, (_, i) => `p${start + i}`);

/** Första bokstaven versal. */
export const versal = (t) => `${t[0].toUpperCase()}${t.slice(1)}`;

/** "1 del" / "3 delar". */
export const delar = (k) => (k === 1 ? "1 del" : `${k} delar`);
