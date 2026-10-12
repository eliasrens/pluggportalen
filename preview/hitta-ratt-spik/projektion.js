// ============================================================================
// Hitta rätt! – SPIKE (#604): projektioner lat/lon ↔ kartkoordinat.
// ----------------------------------------------------------------------------
// Ren modul (ingen DOM) – används av BÅDE admin-skriptet (Node, när geodatan
// förprojiceras till SVG-vägar) och kartmotorn i webbläsaren (nål, klick →
// lat/lon). Därför måste exakt samma kod köras på båda ställena.
// Sub-issue C (#606) lyfter den till src/hitta-ratt/karta/projektion.js.
//
// Sfäriska formler (R = 6371 km) – tillräckligt för ett skolspel; avstånd
// räknas ALDRIG i kartplanet utan med haversine på lat/lon.
//
//   tm    Transversal Mercator (Sverige; λ0 = 15° ≈ SWEREF 99 TM:s utseende)
//   laea  Lambert azimutal ytriktig (Europa; ETRS89-LAEA, 52°N 10°E)
//   ee    Equal Earth (världen)
//
// Kartkoordinat (X, Y): projicerad km → normaliserad så att scope-rutan har
// längsta sida = SIDA (10 000) enheter, Y nedåt (SVG). Parametrarna
// { typ, lon0, lat0, s, x0, y0 } sparas i geo-filen så webbläsaren kan räkna
// exakt som skriptet: X = (x − x0)·s, Y = (y0 − y)·s.
// ============================================================================

export const R_KM = 6371.0088;
export const SIDA = 10000;

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

// --- Råprojektioner: (lon, lat) i grader → (x, y) i km, y uppåt -------------

const tm = {
  fram(lon, lat, p) {
    const l = (lon - p.lon0) * RAD;
    const f = lat * RAD;
    const b = Math.cos(f) * Math.sin(l);
    return [0.5 * R_KM * Math.log((1 + b) / (1 - b)), R_KM * (Math.atan2(Math.tan(f), Math.cos(l)) - p.lat0 * RAD)];
  },
  bak(x, y, p) {
    const d = y / R_KM + p.lat0 * RAD;
    const xr = x / R_KM;
    return [p.lon0 + Math.atan2(Math.sinh(xr), Math.cos(d)) * DEG, Math.asin(Math.sin(d) / Math.cosh(xr)) * DEG];
  },
};

const laea = {
  fram(lon, lat, p) {
    const l = (lon - p.lon0) * RAD;
    const f = lat * RAD;
    const f0 = p.lat0 * RAD;
    const k = Math.sqrt(2 / (1 + Math.sin(f0) * Math.sin(f) + Math.cos(f0) * Math.cos(f) * Math.cos(l)));
    return [R_KM * k * Math.cos(f) * Math.sin(l), R_KM * k * (Math.cos(f0) * Math.sin(f) - Math.sin(f0) * Math.cos(f) * Math.cos(l))];
  },
  bak(x, y, p) {
    const f0 = p.lat0 * RAD;
    const rho = Math.hypot(x, y);
    if (rho < 1e-9) return [p.lon0, p.lat0];
    const c = 2 * Math.asin(Math.min(1, rho / (2 * R_KM)));
    const lat = Math.asin(Math.cos(c) * Math.sin(f0) + (y * Math.sin(c) * Math.cos(f0)) / rho);
    const lon = Math.atan2(x * Math.sin(c), rho * Math.cos(f0) * Math.cos(c) - y * Math.sin(f0) * Math.sin(c));
    return [p.lon0 + lon * DEG, lat * DEG];
  },
};

// Equal Earth (Šavrič, Patterson & Jenny 2018).
const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796;
const M = Math.sqrt(3) / 2;
const ee = {
  fram(lon, lat, p) {
    const l = (lon - p.lon0) * RAD;
    const t = Math.asin(M * Math.sin(lat * RAD));
    const t2 = t * t, t6 = t2 * t2 * t2;
    const x = (2 * Math.sqrt(3) * l * Math.cos(t)) / (3 * (9 * A4 * t6 * t2 + 7 * A3 * t6 + 3 * A2 * t2 + A1));
    const y = t * (A4 * t6 * t2 + A3 * t6 + A2 * t2 + A1);
    return [R_KM * x, R_KM * y];
  },
  bak(x, y, p) {
    const yr = y / R_KM;
    let t = yr;
    for (let i = 0; i < 12; i++) {
      const t2 = t * t, t6 = t2 * t2 * t2;
      const f = t * (A1 + A2 * t2 + A3 * t6 + A4 * t6 * t2) - yr;
      const df = A1 + 3 * A2 * t2 + 7 * A3 * t6 + 9 * A4 * t6 * t2;
      const steg = f / df;
      t -= steg;
      if (Math.abs(steg) < 1e-12) break;
    }
    const t2 = t * t, t6 = t2 * t2 * t2;
    const df = A1 + 3 * A2 * t2 + 7 * A3 * t6 + 9 * A4 * t6 * t2;
    const l = (3 * (x / R_KM) * df) / (2 * Math.sqrt(3) * Math.cos(t));
    return [p.lon0 + l * DEG, Math.asin(Math.sin(t) / M) * DEG];
  },
};

const RAA = { tm, laea, ee };

/** Projektionsparametrar per scope (scope-rutan = [väst, syd, öst, nord]). */
export const SCOPES = {
  sverige: { typ: "tm", lon0: 15, lat0: 62, ruta: [9.6, 54.9, 25.4, 69.4] },
  europa: { typ: "laea", lon0: 10, lat0: 52, ruta: [-25, 33.5, 45, 71.5] },
  varlden: { typ: "ee", lon0: 0, lat0: 0, ruta: [-180, -60, 180, 84] },
};

/**
 * Bygg en projektion för ett scope. `ruta` mäts genom att projicera rutans
 * kanter tätt (koniska/azimutala rutor är inte rektanglar i planet).
 * @returns {{ typ, lon0, lat0, s, x0, y0, bredd, hojd }}
 */
export function byggProjektion(scope) {
  const sc = SCOPES[scope];
  if (!sc) throw new Error(`okänt scope: ${scope}`);
  const p = { typ: sc.typ, lon0: sc.lon0, lat0: sc.lat0 };
  const [v, s, o, n] = sc.ruta;
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  const N = 64;
  for (let i = 0; i <= N; i++) {
    for (const [lon, lat] of [
      [v + ((o - v) * i) / N, s], [v + ((o - v) * i) / N, n],
      [v, s + ((n - s) * i) / N], [o, s + ((n - s) * i) / N],
    ]) {
      const [x, y] = RAA[p.typ].fram(lon, lat, p);
      xmin = Math.min(xmin, x); xmax = Math.max(xmax, x);
      ymin = Math.min(ymin, y); ymax = Math.max(ymax, y);
    }
  }
  const skala = SIDA / Math.max(xmax - xmin, ymax - ymin);
  return {
    ...p,
    s: +skala.toPrecision(8),
    x0: +xmin.toFixed(3),
    y0: +ymax.toFixed(3),
    bredd: Math.round((xmax - xmin) * skala),
    hojd: Math.round((ymax - ymin) * skala),
  };
}

/** lat/lon (grader) → kartkoordinat [X, Y]. `p` = geo-filens `proj`. */
export function tillKarta(p, lon, lat) {
  const [x, y] = RAA[p.typ].fram(lon, lat, p);
  return [(x - p.x0) * p.s, (p.y0 - y) * p.s];
}

/** kartkoordinat [X, Y] → [lon, lat] (grader). */
export function tillLatLon(p, X, Y) {
  return RAA[p.typ].bak(X / p.s + p.x0, p.y0 - Y / p.s, p);
}

/** Storcirkelavstånd i km (haversine) mellan två [lon, lat]. */
export function avstandKm([lon1, lat1], [lon2, lat2]) {
  const dLat = (lat2 - lat1) * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}
