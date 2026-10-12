// ============================================================================
// Hitta rätt! – vilket område ett klick väljer (src/hitta-ratt/karta/traff.js) · #640
// ----------------------------------------------------------------------------
// Klickringarna (#639) gör små områden lätta att träffa, men en ring får inte
// stjäla ett grannlands egen yta. Utan regel täckte ringarna för Cypern,
// Libanon och Palestina hela Israel i helvy (0 av 29 klick på Israel).
//
// Regeln: en ring "räcker" olika långt beroende på vad som ligger under klicket.
//   • Hav, sjö eller bakgrund (ingen yta): hela ringen, RING_R.
//   • Ringens eget område: alltid det området.
//   • Ett annat område: högst ANDEL × områdets smalaste mått på skärmen,
//     och aldrig mer än RING_R. Ett stort grannland (Frankrike runt Monaco,
//     Italien runt Vatikanen) ger hela ringen – det har gott om egen yta. Ett
//     litet (Israel, 4 px brett i helvy) ger nästan ingen ring alls, så ett
//     klick på dess yta väljer det. Däremellan krymper ringen mjukt.
// Bland ringarna som når klicket vinner den med närmast mitt (Levanten).
// Ren modul utan DOM: motorn mäter, den här bestämmer, testerna kör den.
// ============================================================================

/** Ringens radie i skärm-px (klickytan är 24 px). */
export const RING_R = 12;

/** Andel av grannområdets smalaste mått (px) som en ring får täcka. */
export const ANDEL = 0.4;

/**
 * Hur långt (px från mitten) en ring tar klick ovanpå ytan.
 * @param {string|null} yta     område under klicket utan ringar, null = hav/bakgrund
 * @param {number} smalast      ytans smalaste mått på skärmen i px
 */
export function ringRackvidd(yta, smalast) {
  if (yta == null) return RING_R;
  return Math.min(RING_R, Math.max(0, smalast) * ANDEL);
}

/**
 * Valt område för ett klick.
 * @param {object} a
 * @param {string|null} a.yta       område under klicket utan ringar (null = hav/bakgrund)
 * @param {number} a.smalast        ytans smalaste mått i skärm-px (ignoreras utan yta)
 * @param {{ id: string, d: number }[]} a.ringar  synliga ringar och klickets avstånd (px) till deras mitt
 * @returns {string|null}
 */
export function valjTraff({ yta = null, smalast = Infinity, ringar = [] }) {
  if (yta != null && ringar.some((r) => r.id === yta)) return yta;
  const nar = ringRackvidd(yta, smalast);
  let bast = null;
  for (const r of ringar) if (r.d <= nar && (!bast || r.d < bast.d)) bast = r;
  return bast ? bast.id : yta;
}
