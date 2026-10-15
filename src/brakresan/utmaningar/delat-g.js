// ============================================================================
// Bråkresan – hjälpfunktioner för utmaningarna 36–50 (utmaningar/delat-g.js) · #712 G
// ----------------------------------------------------------------------------
// Rena funktioner (inget rng – generatorerna slumpar själva): elevsvar till
// key.examples, former (bråk, blandad form, decimal, procent) ur EXAKTA värden,
// visningstext och pengar/antal-ord. Decimal och procent byggs alltid ur samma
// exakta värde (spec §6) – aldrig ur flyttal. Synkas till functions/ som resten
// av mappen.
// ============================================================================

import { q, toQ, toMixedParts, formatForm, decimal, percent, fraction, integer, mixedFormOf, integerPercent, fitsDecimals } from "../math/index.js";

export { ids, kortId, ord, stor } from "./delat-e.js";

/** Elevsvar i bråkfälten. */
export const falt = (n, d) => ({ fields: { n: String(n), d: String(d) } });
/** Elevsvar i blandad form (tomt heltal = vanligt bråk, tomma bråkfält = heltal). */
export const blandat = (whole, n = "", d = "") => ({ fields: { whole: whole ? String(whole) : "", n: String(n), d: String(d) } });
/** Elevsvar i ett textfält (heltal, decimal, procent). */
export const text = (t) => ({ text: String(t) });

/** Formen för W hela + x/n: heltal, vanligt bråk eller blandad form (som skriven, förkortas inte). */
export function formAv(W, x, n) {
  if (x === 0) return integer(W);
  if (W === 0) return fraction(x, n);
  return { kind: "mixed", whole: W, n: x, d: n };
}

/** Värdet i blandad form med förkortad bråkdel, som text: 6/4 → "1 1/2". */
export const blandadText = (v) => formatForm(mixedFormOf(toQ(v)));

/** Värdet som text i blandad form MED nämnaren d (oförkortad): (3/2, 4) → "1 2/4". */
export function blandadMed(v, d) {
  const { whole, n, d: dd } = toMixedParts(toQ(v));
  const x = (n * d) / dd;
  if (!Number.isInteger(x)) return blandadText(v);
  return x === 0 ? String(whole) : whole === 0 ? `${x}/${d}` : `${whole} ${x}/${d}`;
}

/** Elevsvaret (blandade fält) för värdet v, bråkdelen med nämnaren d (eller förkortad). */
export function blandatSvar(v, d = null) {
  const val = toQ(v);
  const { whole, n, d: dd } = toMixedParts(val);
  if (n === 0) return blandat(whole);
  const m = d && (n * d) % dd === 0 ? d : dd;
  return blandat(whole, (n * m) / dd, m);
}

/** Decimaltal ur ett exakt värde (högst två decimaler, kastar annars). */
export function dec(v, places = 0) {
  const val = toQ(v);
  if (!fitsDecimals(val, 2)) throw new RangeError(`Bråkresan: ${val.n}/${val.d} har ingen ändlig decimal med högst två decimaler`);
  return decimal(val, places);
}
/** Decimaltext: 3/4 → "0,75". */
export const decText = (v, places = 0) => formatForm(dec(v, places));

/** Procentformen ur ett exakt värde (heltalsprocent, kastar annars). */
export function pct(v) {
  const p = integerPercent(toQ(v));
  if (p === null) throw new RangeError("Bråkresan: värdet är ingen hel procent");
  return percent(p);
}
/** Procenttext: 3/4 → "75 %" (hårt mellanslag). */
export const pctText = (v) => formatForm(pct(v));

/** Bråkform (som skriven). */
export const br = (n, d) => fraction(n, d);

/** Heltal med svenskt tusentalsmellanrum: 1200 → "1 200". */
export const kr = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** Värdet v (exakt) som { n, d } för values/key. */
export const nd = (v) => {
  const x = toQ(v);
  return { n: x.n, d: x.d };
};

/** Värde ur procent: 25 → 1/4. */
export const avProcent = (p) => q(p, 100);
