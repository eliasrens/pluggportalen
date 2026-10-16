// ============================================================================
// Bråkresan – decimaltal (src/brakresan/math/decimal.js) · #706
// ----------------------------------------------------------------------------
// Spec §6 "Tal och representationer": decimalomvandling UTAN avrundning. Ett
// värde har en ändlig decimalutveckling precis när den reducerade nämnaren
// bara har faktorerna 2 och 5. 1/3 är aldrig 0,33 – decimalText(1/3) = null.
// Svensk decimalkomma, minustecken U+2212.
// ============================================================================

import { toQ } from "./rational.js";

/** Har värdet en ändlig decimalutveckling? (3/4 ja, 1/3 nej, 7/20 ja) */
export function isTerminating(a) {
  let d = toQ(a).d;
  while (d % 2 === 0) d /= 2;
  while (d % 5 === 0) d /= 5;
  return d === 1;
}

/** Minsta antal decimaler som visar värdet exakt (3/4 → 2, 5 → 0), null om oändlig. */
export function decimalPlaces(a) {
  const v = toQ(a);
  if (!isTerminating(v)) return null;
  let k = 0;
  while (10 ** k % v.d !== 0) k++;
  return k;
}

/** Ryms värdet exakt med högst `max` decimaler? */
export function fitsDecimals(a, max = 2) {
  const k = decimalPlaces(a);
  return k !== null && k <= max;
}

/**
 * Svensk decimaltext: decimalText(3/4) → "0,75", decimalText(1/2, 2) → "0,50"
 * (minst `places` decimaler – en slutnolla ändrar inte värdet). Null om värdet
 * inte har en ändlig utveckling eller kräver fler än `maxPlaces` decimaler.
 */
export function decimalText(a, places = 0, { maxPlaces = 6 } = {}) {
  const v = toQ(a);
  const need = decimalPlaces(v);
  if (need === null || need > maxPlaces) return null;
  const k = Math.max(need, places);
  const sign = v.n < 0 ? "−" : "";
  const scaled = String(Math.abs(v.n) * (10 ** k / v.d)).padStart(k + 1, "0");
  return k === 0 ? sign + scaled : `${sign}${scaled.slice(0, -k)},${scaled.slice(-k)}`;
}

/** Positionsdelarna i en decimal: 0,37 → { whole: 0, tenths: 3, hundredths: 7 } (högst två decimaler). */
export function placeValues(a) {
  const v = toQ(a);
  if (v.n < 0 || !fitsDecimals(v, 2)) return null;
  const h = (v.n * 100) / v.d; // exakt heltal eftersom nämnaren delar 100
  return { whole: Math.floor(h / 100), tenths: Math.floor(h / 10) % 10, hundredths: h % 10 };
}
