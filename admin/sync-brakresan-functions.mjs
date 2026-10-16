// ============================================================================
// Bråkresan (#706): kopiera den DELADE koden till functions/brakresan/ – Cloud
// Functions laddas bara upp med functions/-mappen, så servern behöver en egen
// kopia (samma mönster som sync-guldrush-functions / sync-hitta-ratt-functions).
// Källan är alltid src/brakresan/; kopian är genererad – redigera den aldrig.
//
//   src/brakresan/math/        → functions/brakresan/math/        (matematikmotorn)
//   src/brakresan/schema/      → functions/brakresan/schema/      (katalog, kontrakt,
//                                 omgångsplan, bedömning, regler)
//   src/brakresan/utmaningar/  → functions/brakresan/utmaningar/  (generatorerna)
// Mapparna speglas med samma inbördes struktur, så relativa importer
// ("../math/rational.js") fungerar oförändrade. UI-kod (komponenter, vyer)
// ligger i ANDRA mappar under src/brakresan/ och följer aldrig med.
//
//   npm run sync:brakresan     (firebase.json kör det också som predeploy)
//   node admin/sync-brakresan-functions.mjs --check   → exit 1 om kopian glidit
// test/brakresan-delat.test.js gör samma kontroll i testsviten.
// ============================================================================

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SRC = join(ROOT, "src/brakresan");
export const DST = join(ROOT, "functions/brakresan");
export const DIRS = ["math", "schema", "utmaningar"];

const jsFiles = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".js")).sort() : []);

/** "math/rational.js" … för alla delade filer. */
export function sharedFiles() {
  return DIRS.flatMap((d) => jsFiles(join(SRC, d)).map((f) => `${d}/${f}`));
}

/** Filer där kopian saknas, skiljer sig eller ligger kvar utan källa. */
export function driftedFiles() {
  const src = sharedFiles();
  const drift = src.filter((f) => {
    const d = join(DST, f);
    return !existsSync(d) || readFileSync(d, "utf8") !== readFileSync(join(SRC, f), "utf8");
  });
  const extra = DIRS.flatMap((d) => jsFiles(join(DST, d)).map((f) => `${d}/${f}`)).filter((f) => !src.includes(f));
  return [...drift, ...extra.map((f) => `${f} (borttagen i src)`)];
}

export function syncAll() {
  for (const d of DIRS) {
    rmSync(join(DST, d), { recursive: true, force: true });
    mkdirSync(join(DST, d), { recursive: true });
  }
  for (const f of sharedFiles()) writeFileSync(join(DST, f), readFileSync(join(SRC, f), "utf8"));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--check")) {
    const d = driftedFiles();
    if (d.length) {
      console.error(`functions/brakresan/ är inte synkad (${d.join(", ")}) – kör npm run sync:brakresan`);
      process.exit(1);
    }
    console.log("functions/brakresan/ är synkad.");
  } else {
    syncAll();
    console.log(`Kopierade ${sharedFiles().length} filer → functions/brakresan/`);
  }
}
