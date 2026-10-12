// ============================================================================
// Ekvationsresan – exakta rationella tal (src/ekvationsresan/rational.js) · #615
// ----------------------------------------------------------------------------
// Spec §1.4: ALL matematik (generator, operationer, förenkling) räknas exakt
// med täljare/nämnare som heltal – aldrig flyttal. Ett tal är ett fryst objekt
// { n, d } med d > 0 och gcd(n, d) = 1 (0 = { n: 0, d: 1 }), alltså direkt
// JSON-/Firestore-vänligt.
//
// Heltalen är vanliga JS-tal men VAKTADE: varje mellanresultat måste vara ett
// säkert heltal (Number.isSafeInteger), annars kastas RangeError. Ett resultat
// kan alltså aldrig bli tyst inexakt. Spärren "tal över 1 000" (operations.js)
// håller talen långt under gränsen, så BigInt behövs inte (och BFS:en i
// solver.js blir snabbare utan).
//
// Decimaler (Etapp 2) räknas som rationella tal (2,5 = 5/2) och visas med
// svensk decimalkomma via formatSv / parseDecimalSv.
// ============================================================================

function safe(v) {
  if (!Number.isSafeInteger(v)) throw new RangeError(`Ekvationsresan: talet ${v} är inte ett säkert heltal`);
  return v;
}

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Skapa ett reducerat tal n/d (d ≠ 0). q(4, 6) → { n: 2, d: 3 }. */
export function q(n, d = 1) {
  safe(n);
  safe(d);
  if (d === 0) throw new RangeError("Ekvationsresan: nämnaren är 0");
  if (n === 0) return ZERO;
  const g = gcd(n, d);
  const s = d < 0 ? -1 : 1;
  return Object.freeze({ n: (s * n) / g, d: (s * d) / g });
}

export const ZERO = Object.freeze({ n: 0, d: 1 });
export const ONE = Object.freeze({ n: 1, d: 1 });

/** Normalisera godtycklig indata ({n,d}, heltal) till ett reducerat tal. */
export function toQ(v) {
  if (typeof v === "number") return q(v, 1);
  if (v && typeof v === "object") return q(Number(v.n), Number(v.d ?? 1));
  throw new TypeError("Ekvationsresan: inget rationellt tal");
}

export const add = (a, b) => q(safe(a.n * b.d) + safe(b.n * a.d), safe(a.d * b.d));
export const sub = (a, b) => q(safe(a.n * b.d) - safe(b.n * a.d), safe(a.d * b.d));
export const mul = (a, b) => q(safe(a.n * b.n), safe(a.d * b.d));
export function div(a, b) {
  if (b.n === 0) throw new RangeError("Ekvationsresan: division med 0");
  return q(safe(a.n * b.d), safe(a.d * b.n));
}
export const neg = (a) => (a.n === 0 ? ZERO : Object.freeze({ n: -a.n, d: a.d }));
export const abs = (a) => (a.n < 0 ? neg(a) : a);

export const isZero = (a) => a.n === 0;
export const isOne = (a) => a.n === 1 && a.d === 1;
export const isInteger = (a) => a.d === 1;
export const isNegative = (a) => a.n < 0;
export const eq = (a, b) => a.n === b.n && a.d === b.d;
export const cmp = (a, b) => Math.sign(safe(a.n * b.d) - safe(b.n * a.d));

/** Är talet en ändlig decimal med högst `maxDecimals` decimaler? (2,5 ja, 1/3 nej) */
export function isDecimal(a, maxDecimals = 2) {
  let d = a.d;
  for (let i = 0; i <= maxDecimals; i++) {
    if (10 ** i % d === 0) return true;
  }
  return false;
}

/**
 * Svensk text för talet: heltal "14", decimal "2,5" (om ändlig med högst
 * `maxDecimals` decimaler), annars bråk "1/3". Minustecken = U+2212.
 */
export function formatSv(a, { maxDecimals = 2 } = {}) {
  const sign = a.n < 0 ? "−" : "";
  const n = Math.abs(a.n);
  if (a.d === 1) return sign + n;
  if (isDecimal(a, maxDecimals)) {
    let k = 0;
    while (10 ** k % a.d !== 0) k++;
    const scaled = (n * (10 ** k / a.d)).toString().padStart(k + 1, "0");
    return `${sign}${scaled.slice(0, -k)},${scaled.slice(-k)}`;
  }
  return `${sign}${n}/${a.d}`;
}

/** "2,5" / "2.5" / "14" / "−3" → exakt tal, annars null. Inga flyttal på vägen. */
export function parseDecimalSv(text) {
  const m = /^\s*([-−]?)(\d+)(?:[,.](\d+))?\s*$/.exec(String(text ?? ""));
  if (!m) return null;
  const decimals = m[3] || "";
  const n = Number(m[2] + decimals);
  if (!Number.isSafeInteger(n)) return null;
  const v = q(n, 10 ** decimals.length);
  return m[1] ? neg(v) : v;
}
