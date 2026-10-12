// ============================================================================
// Hitta rätt! (#609): kopiera den DELADE rättningen (src/hitta-ratt/delat/)
// och packens FACIT till functions/hitta-ratt/ – Cloud Functions laddas bara
// upp med functions/-mappen, så servern behöver en egen kopia. Källan är
// alltid src/hitta-ratt/; kopian är genererad (som sync-guldrush-functions).
//
//   functions/hitta-ratt/*.js     ordagranna kopior av src/hitta-ratt/delat/
//   functions/hitta-ratt/packs.js
//     PACKS        kompakt facit per officiellt pack (delat/facit.js
//                  kompaktFacit – samma form som egna pack får på servern):
//                  { id, typ, titel, leaderboard, cfg, items: [{ id, lat, lon } |
//                  { id, omrade }], omraden: geofilens alla område-id }
//     GEO_OMRADEN  geo → { områdes-id: källnyckel } ur <geo>.nycklar.json (#633) –
//                  egna områdespack valideras mot den (delat/egna.js)
//   ⚠️ Egna pack i Firestore sparar områdes-id (omrade) + källnyckel (key).
//   Byggs en geofil om med NYA id måste egna pack migreras (räkna om omrade
//   ur key) – admin/hitta-ratt-geo.mjs får inte blanda om id:n utan det.
//
//   npm run sync:hitta-ratt     (firebase.json kör det också som predeploy)
//   node admin/sync-hitta-ratt-functions.mjs --check   → exit 1 om kopian glidit
// test/hitta-ratt-delat.test.js gör samma kontroll i testsviten.
// ============================================================================

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { kompaktFacit } from "../src/hitta-ratt/delat/facit.js";

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
  const omr = geoOmraden();
  const ut = {};
  for (const { id } of lasJson(join(PACKS, "index.json"))) {
    const p = lasJson(join(PACKS, `${id}.json`));
    if (!p.official) continue;
    ut[id] = kompaktFacit(p, Object.keys(omr[p.geo] || {}));
  }
  return ut;
}

/** geo → { områdes-id: källnyckel } för alla geofiler (ur <geo>.nycklar.json). */
export function geoOmraden() {
  const ut = {};
  for (const f of readdirSync(GEO).filter((f) => f.endsWith(".nycklar.json")).sort()) {
    const nycklar = lasJson(join(GEO, f));
    const geo = f.replace(/\.nycklar\.json$/, "");
    ut[geo] = Object.fromEntries(Object.entries(nycklar).map(([k, id]) => [id, k]).sort(([a], [b]) => (a < b ? -1 : 1)));
  }
  return ut;
}

export function packsJs() {
  return (
    "// GENERERAD av admin/sync-hitta-ratt-functions.mjs ur src/hitta-ratt/content/packs/ – redigera inte.\n" +
    `export const PACKS = ${JSON.stringify(packFacit())};\n` +
    `export const GEO_OMRADEN = ${JSON.stringify(geoOmraden())};\n`
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
