// ============================================================================
// Bråkresan – presentationsform (src/brakresan/math/form.js) · #706
// ----------------------------------------------------------------------------
// Spec §6: "Behåll dessutom uppgiftens presentationsform: 2/4 behöver visas som
// 2/4 även om värdet lagras som 1/2." En FORM är hur ett tal är skrivet; dess
// VÄRDE (valueOf) är ett reducerat { n, d } ur rational.js. Formerna är rena
// JSON-objekt (sparas i uppgifter och svar):
//
//   { kind: "integer",  v }                    7
//   { kind: "fraction", n, d }                 2/4   (OREDUCERAT, n ≥ 0, d ≥ 1)
//   { kind: "mixed",    whole, n, d }          2 3/4 (whole ≥ 1, 0 < n < d)
//   { kind: "decimal",  value: {n,d}, places } 0,50  (places ≥ värdets minsta)
//   { kind: "percent",  p: {n,d} }             25 %  (p = procenttalet, oftast heltal)
//
// Visning: formatForm (svensk decimalkomma, hårt mellanslag före %).
// Uppläsning för skärmläsare: speakForm i words.js.
// ============================================================================

import { q, toQ, isQ, gcd, fromMixed, toMixedParts } from "./rational.js";
import { decimalPlaces, decimalText } from "./decimal.js";
import { fromPercent } from "./percent.js";

/** Hårt mellanslag före procenttecknet (spec §4: "mellanslag före %"). */
export const PERCENT_SUFFIX = " %";

const nat = (v) => Number.isSafeInteger(v) && v >= 0;

export const integer = (v) => {
  if (!Number.isSafeInteger(v)) throw new RangeError("Bråkresan: heltal krävs");
  return { kind: "integer", v };
};
export function fraction(n, d) {
  if (!nat(n) || !nat(d) || d === 0) throw new RangeError(`Bråkresan: ogiltigt bråk ${n}/${d}`);
  return { kind: "fraction", n, d };
}
export function mixed(whole, n, d) {
  if (!nat(whole) || whole < 1 || !nat(n) || !nat(d) || n < 1 || n >= d) {
    throw new RangeError(`Bråkresan: ogiltig blandad form ${whole} ${n}/${d}`);
  }
  return { kind: "mixed", whole, n, d };
}
export function decimal(value, places = 0) {
  const v = toQ(value);
  const need = decimalPlaces(v);
  if (need === null) throw new RangeError("Bråkresan: värdet saknar ändlig decimalform");
  return { kind: "decimal", value: { n: v.n, d: v.d }, places: Math.max(need, places) };
}
export function percent(p) {
  const v = toQ(p);
  return { kind: "percent", p: { n: v.n, d: v.d } };
}

/** Är `f` en välformad form? */
export function isForm(f) {
  if (!f || typeof f !== "object") return false;
  switch (f.kind) {
    case "integer": return Number.isSafeInteger(f.v);
    case "fraction": return nat(f.n) && nat(f.d) && f.d > 0;
    case "mixed": return nat(f.whole) && f.whole >= 1 && nat(f.n) && nat(f.d) && f.n >= 1 && f.n < f.d;
    case "decimal": return isQ(f.value) && Number.isSafeInteger(f.places) && decimalPlaces(f.value) !== null &&
      f.places >= decimalPlaces(f.value);
    case "percent": return isQ(f.p);
    default: return false;
  }
}

/** Formens exakta värde: fraction(2, 4) → { n: 1, d: 2 }. */
export function valueOf(f) {
  switch (f?.kind) {
    case "integer": return q(f.v);
    case "fraction": return q(f.n, f.d);
    case "mixed": return fromMixed(f.whole, f.n, f.d);
    case "decimal": return toQ(f.value);
    case "percent": return fromPercent(f.p);
    default: throw new TypeError("Bråkresan: okänd form");
  }
}

/** Visningstext: "2/4", "2 3/4", "0,50", "25 %", "7". */
export function formatForm(f) {
  switch (f?.kind) {
    case "integer": return f.v < 0 ? `−${-f.v}` : String(f.v);
    case "fraction": return `${f.n}/${f.d}`;
    case "mixed": return `${f.whole} ${f.n}/${f.d}`;
    case "decimal": return decimalText(f.value, f.places);
    case "percent": return `${decimalText(f.p) ?? `${f.p.n}/${f.p.d}`}${PERCENT_SUFFIX}`;
    default: throw new TypeError("Bråkresan: okänd form");
  }
}

/**
 * Enklaste form: bråket går inte att förkorta (2/3 ja, 6/8 nej); i blandad form
 * gäller det bråkdelen. Heltal är alltid enklaste form. Decimal/procent: ja.
 */
export function isSimplest(f) {
  switch (f?.kind) {
    case "fraction":
    case "mixed": return f.n === 0 ? f.d === 1 : gcd(f.n, f.d) === 1;
    default: return isForm(f);
  }
}

/** Formen i enklaste skrivning av samma sort (fraction 6/8 → 3/4, mixed 2 2/4 → 2 1/2). */
export function simplify(f) {
  if (f.kind === "fraction") {
    const v = q(f.n, f.d);
    return fraction(v.n, v.d);
  }
  if (f.kind === "mixed") {
    const v = q(f.n, f.d);
    return mixed(f.whole, v.n, v.d);
  }
  return f;
}

/** Värdet som reducerat bråk (heltal som heltal): 6/8 → 3/4, 8/4 → 2. */
export function fractionFormOf(a) {
  const v = toQ(a);
  return v.d === 1 ? integer(v.n) : fraction(v.n, v.d);
}

/** Värdet i blandad form med förkortad bråkdel: 11/4 → 2 3/4, 3/4 → 3/4, 8/4 → 2. */
export function mixedFormOf(a) {
  const v = toQ(a);
  if (v.d === 1) return integer(v.n);
  const { whole, n, d } = toMixedParts(v);
  return whole === 0 ? fraction(n, d) : mixed(whole, n, d);
}
