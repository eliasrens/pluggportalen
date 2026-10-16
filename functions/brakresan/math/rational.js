// ============================================================================
// Bråkresan – exakta rationella tal (src/brakresan/math/rational.js) · #706
// ----------------------------------------------------------------------------
// Spec §6: ALL matematik räknas exakt med heltal täljare/nämnare – aldrig
// flyttal. Ett VÄRDE är ett fryst objekt { n, d } med d > 0 och
// gcd(|n|, d) = 1 (0 = { n: 0, d: 1 }), alltså direkt JSON-/Firestore-vänligt.
// Hur talet ska VISAS (2/4, 2 3/4, 0,50, 25 %) är en egen sak – se form.js.
//
// Heltalen är vanliga JS-tal men VAKTADE: varje mellanresultat måste vara ett
// säkert heltal (Number.isSafeInteger), annars kastas RangeError. Ett resultat
// kan alltså aldrig bli tyst inexakt. Modulens tal är små (nämnare ≤ 100,
// belopp ≤ 800 kr), så BigInt behövs inte.
//
// Delas med Cloud Functions (admin/sync-brakresan-functions.mjs) – inga
// webbläsar- eller Node-specifika beroenden här.
// ============================================================================

function safe(v) {
  if (!Number.isSafeInteger(v)) throw new RangeError(`Bråkresan: ${v} är inte ett säkert heltal`);
  return v;
}

/** Största gemensamma delare (gcd(0, 0) = 0). */
export function gcd(a, b) {
  a = Math.abs(safe(a));
  b = Math.abs(safe(b));
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Minsta gemensamma multipel av positiva heltal. */
export function lcm(a, b) {
  if (a === 0 || b === 0) return 0;
  return safe(Math.abs((a / gcd(a, b)) * b));
}

export const ZERO = Object.freeze({ n: 0, d: 1 });
export const ONE = Object.freeze({ n: 1, d: 1 });

/** Reducerat värde n/d med positiv nämnare. q(4, 6) → { n: 2, d: 3 }. d = 0 kastar. */
export function q(n, d = 1) {
  safe(n);
  safe(d);
  if (d === 0) throw new RangeError("Bråkresan: nämnaren är 0");
  if (n === 0) return ZERO;
  const g = gcd(n, d);
  const s = d < 0 ? -1 : 1;
  return Object.freeze({ n: (s * n) / g, d: (s * d) / g });
}

/** Är v ett välformat, reducerat värde { n, d }? */
export function isQ(v) {
  return !!v && typeof v === "object" && Number.isSafeInteger(v.n) && Number.isSafeInteger(v.d) &&
    v.d > 0 && (v.n === 0 ? v.d === 1 : gcd(v.n, v.d) === 1);
}

/** Normalisera godtycklig indata ({ n, d } eller heltal) till ett reducerat värde. */
export function toQ(v) {
  if (typeof v === "number") return q(v, 1);
  if (v && typeof v === "object") return q(Number(v.n), Number(v.d ?? 1));
  throw new TypeError("Bråkresan: inget rationellt tal");
}

export const add = (a, b) => q(safe(safe(a.n * b.d) + safe(b.n * a.d)), safe(a.d * b.d));
export const sub = (a, b) => q(safe(safe(a.n * b.d) - safe(b.n * a.d)), safe(a.d * b.d));
export const mul = (a, b) => q(safe(a.n * b.n), safe(a.d * b.d));
export function div(a, b) {
  if (b.n === 0) throw new RangeError("Bråkresan: division med 0");
  return q(safe(a.n * b.d), safe(a.d * b.n));
}
/** Summa av en lista värden (tom lista = 0). */
export const sum = (list) => list.reduce((s, v) => add(s, toQ(v)), ZERO);

export const isZero = (a) => a.n === 0;
export const isInteger = (a) => a.d === 1;
export const isNegative = (a) => a.n < 0;
/** Äkta bråk: 0 < a < 1. */
export const isProper = (a) => a.n > 0 && a.n < a.d;
/** Värdelikhet – 2/4 och 1/2 är lika eftersom båda reduceras. */
export const eq = (a, b) => {
  const x = toQ(a);
  const y = toQ(b);
  return x.n === y.n && x.d === y.d;
};
/** −1, 0 eller 1. Exakt (korsmultiplikation med vaktade heltal). */
export const cmp = (a, b) => Math.sign(safe(a.n * b.d) - safe(b.n * a.d));
export const lt = (a, b) => cmp(a, b) < 0;
export const gt = (a, b) => cmp(a, b) > 0;
export const min = (a, b) => (cmp(a, b) <= 0 ? a : b);
export const max = (a, b) => (cmp(a, b) >= 0 ? a : b);

/** Heltalsdel och rest: 11/4 → { whole: 2, n: 3, d: 4 }. Bara för icke-negativa värden. */
export function toMixedParts(a) {
  const v = toQ(a);
  if (v.n < 0) throw new RangeError("Bråkresan: blandad form bara för icke-negativa tal");
  return { whole: Math.floor(v.n / v.d), n: v.n % v.d, d: v.d };
}

/** 2 3/4 → 11/4 (heltal + täljare/nämnare). */
export function fromMixed(whole, n, d) {
  return add(q(whole), q(n, d));
}

/** Gemensam nämnare för en lista värden (minsta gemensamma multipel av nämnarna). */
export function commonDenominator(list) {
  return list.map(toQ).reduce((m, v) => lcm(m, v.d), 1);
}

/** Täljaren när värdet skrivs med nämnaren `d` – eller null om det inte går (3/4 med 6). */
export function numeratorFor(a, d) {
  const v = toQ(a);
  if (!Number.isSafeInteger(d) || d <= 0 || d % v.d !== 0) return null;
  return safe(v.n * (d / v.d));
}
