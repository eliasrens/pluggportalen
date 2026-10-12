// ============================================================================
// Hitta rätt! – kartornas scope (src/hitta-ratt/delat/scope.js) · #633
// ----------------------------------------------------------------------------
// Ren modul, DELAD med servern (kopieras till functions/hitta-ratt/ av
// admin/sync-hitta-ratt-functions.mjs). Inga importer.
//
//   SCOPE_RUTA[scope]   lon/lat-ruta [väst, syd, öst, nord] (arkitektur §1.1) –
//                       samma tal som karta/projektion.js SCOPES (testet fäller drift)
//   GEO_SCOPE[geo]      geofil → scope
//   STANDARD[scope]     { scoringConfig, maxZoom } för egna punktpack (§5, §11.1)
//   OMRADE_CFG          scoringConfig för områdespack
//   inomScope(scope, lon, lat)  ligger punkten i scope-rutan?
// ============================================================================

export const SCOPE_RUTA = {
  sverige: [9.6, 54.9, 25.4, 69.4],
  europa: [-25, 33.5, 45, 71.5],
  varlden: [-180, -60, 180, 84],
};

export const GEO_SCOPE = {
  "sverige-landskap": "sverige",
  "sverige-lan": "sverige",
  europa: "europa",
  varlden: "varlden",
};

export const STANDARD = {
  sverige: { scoringConfig: { fullKm: 5, halvKm: 90 }, maxZoom: 10 },
  europa: { scoringConfig: { fullKm: 10, halvKm: 220 }, maxZoom: 16 },
  varlden: { scoringConfig: { fullKm: 25, halvKm: 600 }, maxZoom: 24 },
};

export const OMRADE_CFG = { minMsPerFraga: 700 };

export function inomScope(scope, lon, lat) {
  const r = SCOPE_RUTA[scope];
  if (!r || !Number.isFinite(lon) || !Number.isFinite(lat)) return false;
  return lon >= r[0] && lon <= r[2] && lat >= r[1] && lat <= r[3];
}
