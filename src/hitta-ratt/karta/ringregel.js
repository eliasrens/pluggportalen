// ============================================================================
// Hitta rätt! – vilka områden får klickring (src/hitta-ratt/karta/ringregel.js) · #639
// ----------------------------------------------------------------------------
// Två steg, så att ringarna inte beror på skärmbredden ensam:
//   1. Geodatan (admin/hitta-ratt-geo.mjs) avgör om ett område NÅGONSIN kan få
//      ring: bara om dess största sammanhängande del är mindre än RING_KM2 i
//      verklig yta (mikrostater, små önationer). Fältet `liten` = sidan på en
//      kvadrat med samma yta som den delen, i kartenheter. Saknas fältet får
//      området aldrig ring (Belgien, Nederländerna, Israel, Rwanda …).
//   2. Motorn visar ringen bara när den sidan är under LITEN_PX skärm-px vid
//      aktuell zoom. Zoomar man in försvinner ringen och landet klickas direkt.
// Största delen (inte hela ytan eller rutan) används, så att en ögrupp som
// Bahamas räknas som de små öarna den består av.
// Ren modul utan DOM: läses av motorn, byggskriptet och testerna.
// ============================================================================

/** Största delen under så här många km² → kan få ring (Jamaica ≈ 11 000). */
export const RING_KM2 = 12000;

/** Ringen syns när delens sida är mindre än så här många skärm-px. */
export const LITEN_PX = 12;

/**
 * Geodatans `liten`-värde för ett område, eller null (aldrig ring).
 * @param {number} storstaYta  största delens yta i kartenheter²
 * @param {number} s           projektionens skala (kartenheter per km)
 */
export function litenSida(storstaYta, s) {
  if (!(storstaYta >= 0) || storstaYta / (s * s) >= RING_KM2) return null;
  return Math.max(0.1, +Math.sqrt(storstaYta).toFixed(1));
}

/**
 * Ska området ha ring vid zoomen k (skärm-px per kartenhet)?
 * @param {{ liten?: number }} omrade  område ur geodatan
 */
export function visaRing(omrade, k) {
  const sida = omrade?.liten;
  return typeof sida === "number" && sida * k < LITEN_PX;
}
