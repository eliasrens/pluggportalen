// ============================================================================
// Hitta rätt! (#634) – svenska namn för geofilernas områden (lärarvyn).
// ----------------------------------------------------------------------------
// Offline-skript. Skriver src/hitta-ratt/content/geo/<geo>.namn.json
// (källnyckel → svenskt namn) för varje <geo>.nycklar.json. Lärarvyn
// kombinerar den med nyckelfilen till områdes-id → { key, namn } när läraren
// väljer områden (arkitektur §11.7). Eleven laddar ALDRIG namnfilen – inga
// namn i spelets DOM (§4.2).
//
// Namnen tas i den här ordningen:
//   1. de officiella områdespackens `name` per `key` (redan granskade):
//      först pack på samma geofil, sedan andra (Europas länder → världen)
//   2. Natural Earth NAME_SV (admin-0, 50m) för världens övriga länder
//      (enstaka föråldrade namn rättas i RATTA)
//   3. källnyckeln, om inget annat finns
//
// Varken mapshaper eller geofilerna behövs – bara nyckelfilerna, packen och
// (för världen) Natural Earth, som hämtas till samma cache som geo-skriptet.
//
//   node admin/hitta-ratt-namn.mjs
//   HR_GEO_CACHE=/tmp/x node admin/hitta-ratt-namn.mjs
// ============================================================================

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GEO_DIR, PACK_DIR, lasJson } from "./hitta-ratt-delat.mjs";

const CACHE = process.env.HR_GEO_CACHE || "/tmp/hitta-ratt-geo-cache";
// Samma pinnade källa som admin/hitta-ratt-geo.mjs (ne50land).
const NE_LAND = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson";
// Geofiler vars nycklar är Natural Earths ADM0_A3.
const NE_GEO = new Set(["europa", "varlden"]);
// Natural Earths NAME_SV är ibland föråldrat – rättat efter Svenska FN-förbundet.
const RATTA = { SWZ: "Eswatini" };

function neNamn() {
  mkdirSync(CACHE, { recursive: true });
  const fil = join(CACHE, "ne50land.geojson");
  if (!existsSync(fil)) {
    console.log("hämtar ne50land …");
    execFileSync("curl", ["-sSfL", "-m", "600", "-o", fil, NE_LAND]);
  }
  const m = new Map();
  for (const f of lasJson(fil).features) {
    const p = f.properties;
    if (p.ADM0_A3 && p.NAME_SV && !m.has(p.ADM0_A3)) m.set(p.ADM0_A3, String(p.NAME_SV).trim());
  }
  return m;
}

/** key → name per geofil ur de officiella områdespacken. */
function packNamn() {
  const perGeo = new Map();
  for (const f of readdirSync(PACK_DIR).filter((f) => f.endsWith(".json") && f !== "index.json").sort()) {
    const p = lasJson(join(PACK_DIR, f));
    if (p.type !== "area") continue;
    if (!perGeo.has(p.geo)) perGeo.set(p.geo, new Map());
    const m = perGeo.get(p.geo);
    for (const it of p.items) if (it.key && it.name && !m.has(it.key)) m.set(it.key, it.name);
  }
  return perGeo;
}

/** Namnfilens innehåll för en geofil. Ren – testas i Node. */
export function byggNamn(geo, nycklar, perGeo, ne) {
  const egna = perGeo.get(geo) || new Map();
  const andra = [...perGeo.entries()].filter(([g]) => g !== geo && NE_GEO.has(g) === NE_GEO.has(geo)).map(([, m]) => m);
  const ut = {};
  const kallor = { pack: 0, ne: 0, nyckel: 0 };
  for (const key of Object.keys(nycklar).sort()) {
    let namn = egna.get(key) || andra.map((m) => m.get(key)).find(Boolean);
    if (namn) kallor.pack += 1;
    else if (NE_GEO.has(geo) && ne?.get(key)) {
      namn = RATTA[key] || ne.get(key);
      kallor.ne += 1;
    } else {
      namn = key;
      kallor.nyckel += 1;
    }
    ut[key] = namn;
  }
  return { namn: ut, kallor };
}

const arHuvud = import.meta.url === `file://${process.argv[1]}`;
if (arHuvud) {
  const perGeo = packNamn();
  let ne = null;
  for (const f of readdirSync(GEO_DIR).filter((f) => f.endsWith(".nycklar.json")).sort()) {
    const geo = f.replace(/\.nycklar\.json$/, "");
    if (NE_GEO.has(geo) && !ne) ne = neNamn();
    const { namn, kallor } = byggNamn(geo, lasJson(join(GEO_DIR, f)), perGeo, ne);
    writeFileSync(join(GEO_DIR, `${geo}.namn.json`), JSON.stringify(namn, null, 1) + "\n");
    console.log(`${geo}: ${Object.keys(namn).length} namn (pack ${kallor.pack}, Natural Earth ${kallor.ne}, nyckel ${kallor.nyckel})`);
  }
}
