// ============================================================================
// Hitta rätt! – poängmodellen för punktfrågor (src/hitta-ratt/delat/poang.js)
// ----------------------------------------------------------------------------
// Ren modul, DELAD med servern: admin/sync-hitta-ratt-functions.mjs kopierar
// den till functions/hitta-ratt/, så att klientens direkta feedback och
// Cloud Functionens omräkning (hittaRattSubmit, #609) ger EXAKT samma poäng.
// Inga importer – filen måste fungera ensam i functions/.
//
//   poang(km, { fullKm, halvKm }) → heltal 0–100   (arkitektur §5)
//   avstandKm([lon, lat], [lon, lat]) → km (haversine, samma som karta/projektion.js)
//
// Full pott inom fullKm. Därefter halveringskurva: 50 p vid halvKm,
//   p = 100 · 2^(−x^1,5),  x = (km − fullKm) / (halvKm − fullKm)
// Kontinuerlig (inga hopp), strikt fallande efter fullKm och avrundad till
// heltal → monotont icke-växande. Blir 0 p kring fullKm + 3,9 · (halvKm − fullKm).
// ============================================================================

export const EXPONENT = 1.5;
export const R_KM = 6371.0088;
const RAD = Math.PI / 180;

export function poang(km, cfg) {
  const full = Math.max(0, Number(cfg?.fullKm) || 0);
  const halv = Math.max(full + 1, Number(cfg?.halvKm) || 0);
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

/** Storcirkelavstånd i km (haversine) mellan två [lon, lat]. */
export function avstandKm([lon1, lat1], [lon2, lat2]) {
  const dLat = (lat2 - lat1) * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Godkänt punktsvar (§26: 1 coin) = mer än 0 p. */
export const godkandPunkt = (p) => p > 0;
