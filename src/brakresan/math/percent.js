// ============================================================================
// Bråkresan – procent (src/brakresan/math/percent.js) · #706
// ----------------------------------------------------------------------------
// Procent = hundradelar av SAMMA exakta värde som bråk och decimal (spec §6:
// "Procentkontroll och decimalomvandling ska bygga på samma exakta värde").
// 25 % är värdet 1/4. Grundläget använder hela procent; percentValue/
// integerPercent säger null när ett värde inte blir en hel procent.
// ============================================================================

import { q, toQ, mul, div, sub, add, isInteger } from "./rational.js";

const HUNDRED = q(100);

/** p % som värde: 25 → 1/4. p får vara ett heltal eller ett värde { n, d }. */
export function fromPercent(p) {
  return div(toQ(p), HUNDRED);
}

/** Värdet i procent (exakt, kan vara icke-heltal): 1/4 → 25, 1/8 → 25/2. */
export function percentValue(a) {
  return mul(toQ(a), HUNDRED);
}

/** Värdet som HEL procent, annars null: 3/4 → 75, 1/3 → null. */
export function integerPercent(a) {
  const p = percentValue(a);
  return isInteger(p) ? p.n : null;
}

/** p % av ett antal/belopp: percentOf(25, 80) → 20. */
export function percentOf(p, whole) {
  return mul(fromPercent(p), toQ(whole));
}

/** Hur många procent är delen av helheten? 6 av 24 → 25. Helhet 0 kastar. */
export function percentOfWhole(part, whole) {
  return percentValue(div(toQ(part), toQ(whole)));
}

/** Rabatt p % på ett pris: { discount, newPrice } (exakta värden). */
export function discount(price, p) {
  const d = percentOf(p, price);
  return { discount: d, newPrice: sub(toQ(price), d) };
}

/** Prisökning p %: { increase, newPrice } – ökningen räknas på ursprungspriset. */
export function increase(price, p) {
  const i = percentOf(p, price);
  return { increase: i, newPrice: add(toQ(price), i) };
}
