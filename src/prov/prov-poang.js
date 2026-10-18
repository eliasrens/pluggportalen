// ============================================================================
// Prov (#762, spec §2.2): poängen – halvpoäng, summor, delpoäng och hur
// poängen skrivs. Ren logik, ingen Firebase/DOM; ALLA vyer och all rättning
// går hit, så att inget räknar eller skriver poäng på egen hand.
//
//   halvor(p) / franHalvor(n)    tal ↔ halva poäng som heltal (3.5 ↔ 7)
//   summaPoang(lista)            exakt summa (3,5 + 4 + 0,5 = 8, aldrig 17.499999)
//   delpoangNed(andel, max)      automatikens delpoäng, NEDÅT till 0,5 (2 × 3/5 → 1)
//   klamPoang(p, max)            0 … max i steg om 0,5 (lärarens poäng)
//   arGiltigMaxpoang(p)          0,5–20 i steg om 0,5 (frågans maxpoäng)
//   poangTal(p)                  "3,5"   poangP(p) → "3,5 p"   poangAv(p, max) → "17,5 av 24 poäng"
//
// Poängen lagras som tal (3.5); internt räknas i halva poäng som heltal.
// ============================================================================

export const POANG_MIN = 0.5;
export const POANG_MAX = 20;
export const POANG_STEG = 0.5;
export const POANG_STANDARD = 1;

// Flyttalsbrus (0.1 + 0.2 …) får aldrig tippa en avrundning nedåt.
const BRUS = 1e-9;

/** Poängen i halva poäng som heltal (3.5 → 7). Ogiltigt → 0. */
export function halvor(p) {
  const n = Number(p);
  return Number.isFinite(n) ? Math.round(n * 2) : 0;
}

/** Halva poäng tillbaka till ett tal (7 → 3.5). */
export const franHalvor = (n) => n / 2;

/** Exakt summa av poäng (ogiltiga = 0), räknad i halva poäng. */
export function summaPoang(lista) {
  let n = 0;
  for (const p of lista || []) n += halvor(p);
  return franHalvor(n);
}

/**
 * Automatikens delpoäng (§2.2): andelen (0–1) av max, avrundad NEDÅT till
 * närmaste 0,5. En para-fråga värd 2 p med 3 av 5 par rätt → 1,2 → 1 p.
 */
export function delpoangNed(andel, max) {
  const a = Math.min(1, Math.max(0, Number(andel) || 0));
  const m = Math.max(0, halvor(max));
  return franHalvor(Math.min(m, Math.floor(a * m + BRUS)));
}

/** Lärarens poäng: 0 … max, avrundad till närmaste 0,5. */
export function klamPoang(p, max) {
  const m = Math.max(0, halvor(max));
  return franHalvor(Math.min(m, Math.max(0, halvor(p))));
}

/** Frågans maxpoäng: ett tal 0,5–20 i steg om 0,5 (gamla heltal 1–20 är giltiga). */
export function arGiltigMaxpoang(p) {
  return typeof p === "number" && Number.isFinite(p) && Number.isInteger(p * 2) && p >= POANG_MIN && p <= POANG_MAX;
}

/** Poängen med svenskt decimalkomma: 3.5 → "3,5", 4 → "4" (ogiltigt → "0"). */
export function poangTal(p) {
  return String(franHalvor(halvor(p))).replace(".", ",");
}

/** "3,5 p" */
export const poangP = (p) => `${poangTal(p)} p`;

/** "17,5 av 24 poäng" */
export const poangAv = (p, max) => `${poangTal(p)} av ${poangTal(max)} poäng`;
