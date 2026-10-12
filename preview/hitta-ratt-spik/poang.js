// ============================================================================
// Hitta rätt! – SPIKE (#604): poängmodellen för punktfrågor.
// ----------------------------------------------------------------------------
// Ren modul. Sub-issue F (#609) lyfter den till src/hitta-ratt/delat/poang.js,
// som synkas till functions/ (servern räknar om varje svar med SAMMA kod).
//
//   poang(km, { fullKm, halvKm }) → heltal 0–100
//
// Full pott inom fullKm. Därefter halveringskurva: 50 p vid halvKm,
//   p = 100 · 2^(−x^1,5),  x = (km − fullKm) / (halvKm − fullKm)
// Kontinuerlig (inga hopp), strikt fallande efter fullKm och avrundad till
// heltal → monotont icke-växande. Blir 0 p vid x ≈ 3,9, d.v.s. kring
// fullKm + 3,9 · (halvKm − fullKm). Normaliseras per pack via scoringConfig.
// ============================================================================

export const EXPONENT = 1.5;

export function poang(km, cfg) {
  const full = Math.max(0, Number(cfg.fullKm) || 0);
  const halv = Math.max(full + 1, Number(cfg.halvKm) || 0);
  const d = Math.max(0, Number(km) || 0);
  if (d <= full) return 100;
  const x = (d - full) / (halv - full);
  return Math.round(100 * 2 ** -(x ** EXPONENT));
}

/** Avståndet där poängen avrundas till 0 (för dokumentation/lärar-UI). */
export function nollKm(cfg) {
  const x = Math.log2(1 / 0.005) ** (1 / EXPONENT);
  return Math.round(cfg.fullKm + x * (cfg.halvKm - cfg.fullKm));
}
