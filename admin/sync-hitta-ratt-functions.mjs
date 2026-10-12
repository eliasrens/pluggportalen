// ============================================================================
// Hitta rätt! (#609): kopiera den DELADE rättningen (src/hitta-ratt/delat/)
// och packens FACIT till functions/hitta-ratt/ – Cloud Functions laddas bara
// upp med functions/-mappen, så servern behöver en egen kopia. Källan är
// alltid src/hitta-ratt/; kopian är genererad (som sync-guldrush-functions).
//
//   functions/hitta-ratt/{poang,rank,omgang}.js   ordagranna kopior
//   functions/hitta-ratt/packs.js                 kompakt facit per officiellt
//     pack: { id, typ, titel, leaderboard, cfg, items: [{ id, lat, lon } |
//     { id, omrade }], omraden: geofilens alla område-id (för "känt id") }
//
//   npm run sync:hitta-ratt     (firebase.json kör det också som predeploy)
//   node admin/sync-hitta-ratt-functions.mjs --check   → exit 1 om kopian glidit
// test/hitta-ratt-delat.test.js gör samma kontroll i testsviten.
// ============================================================================

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SRC = join(ROOT, "src/hitta-ratt/delat");
export const PACKS = join(ROOT, "src/hitta-ratt/content/packs");
export const GEO = join(ROOT, "src/hitta-ratt/content/geo");
export const DST = join(ROOT, "functions/hitta-ratt");

const lasJson = (p) => JSON.parse(readFileSync(p, "utf8"));

export function sharedFiles() {
  return readdirSync(SRC).filter((f) => f.endsWith(".js")).sort();
}

/** Det kompakta facit som servern rättar mot (bara officiella pack). */
export function packFacit() {
  const geoCache = new Map();
  const omraden = (geo) => {
    if (!geoCache.has(geo)) geoCache.set(geo, lasJson(join(GEO, `${geo}.json`)).omraden.map((o) => o.id).sort());
    return geoCache.get(geo);
  };
  const ut = {};
  for (const { id } of lasJson(join(PACKS, "index.json"))) {
    const p = lasJson(join(PACKS, `${id}.json`));
    if (!p.official) continue;
    const typ = p.type === "area" ? "area" : "point";
    ut[id] = {
      id, typ, titel: p.title, leaderboard: p.leaderboard !== false, cfg: p.scoringConfig || {},
      items: p.items.map((it) => (typ === "area" ? { id: it.id, omrade: it.omrade } : { id: it.id, lat: it.lat, lon: it.lon })),
      ...(typ === "area" ? { omraden: omraden(p.geo) } : {}),
    };
  }
  return ut;
}

export function packsJs() {
  return (
    "// GENERERAD av admin/sync-hitta-ratt-functions.mjs ur src/hitta-ratt/content/packs/ – redigera inte.\n" +
    `export const PACKS = ${JSON.stringify(packFacit())};\n`
  );
}

/** Filer där kopian saknas eller skiljer sig. */
export function driftedFiles() {
  const skillnad = (f, want) => {
    const dst = join(DST, f);
    return !existsSync(dst) || readFileSync(dst, "utf8") !== want;
  };
  const d = sharedFiles().filter((f) => skillnad(f, readFileSync(join(SRC, f), "utf8")));
  if (skillnad("packs.js", packsJs())) d.push("packs.js");
  return d;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--check")) {
    const d = driftedFiles();
    if (d.length) {
      console.error(`functions/hitta-ratt/ är inte synkad (${d.join(", ")}) – kör npm run sync:hitta-ratt`);
      process.exit(1);
    }
    console.log("functions/hitta-ratt/ är synkad.");
  } else {
    mkdirSync(DST, { recursive: true });
    for (const f of sharedFiles()) writeFileSync(join(DST, f), readFileSync(join(SRC, f), "utf8"));
    writeFileSync(join(DST, "packs.js"), packsJs());
    console.log(`Kopierade ${sharedFiles().join(", ")} + packs.js → functions/hitta-ratt/`);
  }
}
