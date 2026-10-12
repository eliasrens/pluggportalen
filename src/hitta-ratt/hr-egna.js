// ============================================================================
// Hitta rätt! – lärarens egna pack på elevsidan (src/hitta-ratt/hr-egna.js) · #633
// ----------------------------------------------------------------------------
// Ren modul (ingen DOM, inget Firebase) – testas i Node. Läsningarna (katalogen
// och packdokumentet) ligger i hr-egna-data.js. Arkitektur §11.3.
//
//   egnaForElev(katalog, klassIds) → kort för startsidan, bara pack som delas
//     med någon av elevens klasser (classIds ∩ elevens klasser ≠ ∅), sorterade
//     på titel. Formen är som posterna i packs/index.json plus
//     { category: "egna", ikon, version, egen: true }.
//   delasMed(pack, klassIds) → är packet delat med någon av klasserna?
//   startvyAuto(pack, geo) → lon/lat-ruta [v, s, ö, n] för kartmotorn, eller
//     null = hela kartan. "auto": itemens utbredning (punkter, eller områdenas
//     inre punkt c) + 30 % luft, minst 25 % av scope-rutan, kräver minst 4
//     items. "hel" → null.
//   egetSparFel(code, message) → { rubrik, text, igen } | null – serverns
//     fel för egna pack (ändrad karta, inte delad, borttagen) som egen vy.
// ============================================================================

import { SCOPE_RUTA } from "./delat/scope.js";
import { tillLatLon } from "./karta/projektion.js";

export const STARTVY_LUFT = 0.3;
export const STARTVY_MIN_ANDEL = 0.25;
export const STARTVY_MIN_ITEMS = 4;

export const arEget = (packId) => typeof packId === "string" && packId.startsWith("e-");

export function delasMed(pack, klassIds) {
  const mina = new Set(klassIds || []);
  return Array.isArray(pack?.classIds) && pack.classIds.some((id) => mina.has(id));
}

export function egnaForElev(katalog, klassIds) {
  const packs = katalog?.packs && typeof katalog.packs === "object" ? katalog.packs : {};
  return Object.entries(packs)
    .filter(([id, p]) => arEget(id) && p && delasMed(p, klassIds))
    .map(([id, p]) => ({
      id, title: p.title, description: p.description || "", category: "egna",
      type: p.type === "area" ? "area" : "point", geo: p.geo, antal: Number(p.antal) || 0,
      ikon: p.ikon || "🗺️", version: Number(p.version) || 1, leaderboard: p.leaderboard === true,
      classIds: p.classIds, egen: true,
    }))
    .sort((a, b) => String(a.title).localeCompare(String(b.title), "sv") || (a.id < b.id ? -1 : 1));
}

/** Itemens lon/lat-punkter: punkter direkt, områden via geofilens inre punkt c. */
function punkter(pack, geo) {
  if (pack.type !== "area") {
    return pack.items.filter((it) => Number.isFinite(it.lon) && Number.isFinite(it.lat)).map((it) => [it.lon, it.lat]);
  }
  const c = new Map((geo?.omraden || []).map((o) => [o.id, o.c]));
  return pack.items
    .map((it) => c.get(it.omrade))
    .filter((p) => Array.isArray(p) && geo?.proj)
    .map(([x, y]) => tillLatLon(geo.proj, x, y));
}

/** Ett spann [lo, hi] med luft och minsta bredd, inpassat i [min, max]. */
function spann(lo, hi, min, max) {
  const bredd = Math.min(max - min, Math.max((hi - lo) * (1 + STARTVY_LUFT), (max - min) * STARTVY_MIN_ANDEL));
  let a = (lo + hi) / 2 - bredd / 2;
  a = Math.min(Math.max(a, min), max - bredd);
  return [a, a + bredd];
}

export function startvyAuto(pack, geo) {
  if (!pack || pack.startvy === "hel" || !Array.isArray(pack.items)) return null;
  const ruta = SCOPE_RUTA[geo?.scope];
  if (!ruta) return null;
  const pts = punkter(pack, geo);
  if (pts.length < STARTVY_MIN_ITEMS) return null;
  const lons = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  const [v, o] = spann(Math.min(...lons), Math.max(...lons), ruta[0], ruta[2]);
  const [s, n] = spann(Math.min(...lats), Math.max(...lats), ruta[1], ruta[3]);
  return [v, s, o, n];
}

export function egetSparFel(code, message) {
  if (code === "failed-precondition" && /ändrat kartan/.test(message || "")) {
    return { rubrik: "Kartan har ändrats", text: "Läraren har ändrat kartan – starta en ny omgång.", igen: true };
  }
  if (code === "permission-denied") return { rubrik: "Kartan är inte delad", text: "Kartan är inte delad med din klass.", igen: false };
  if (code === "not-found") return { rubrik: "Kartan finns inte längre", text: "Läraren har tagit bort kartan.", igen: false };
  return null;
}
