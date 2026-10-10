// ============================================================================
// Guldrushen (#563): kopiera den DELADE kistkonfigen + spelreglerna
// (src/live/formats/guldrush/delat/) till functions/guldrush/ – Cloud
// Functions laddas bara upp med functions/-mappen, så servern behöver en egen
// kopia. Källan är alltid src/…/delat/; kopian är genererad.
//
//   npm run sync:guldrush         (firebase.json kör det också som predeploy)
//   node admin/sync-guldrush-functions.mjs --check   → exit 1 om kopian glidit
// test/live-guldrush-delat.test.js gör samma kontroll i testsviten.
// ============================================================================

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SRC = join(ROOT, "src/live/formats/guldrush/delat");
export const DST = join(ROOT, "functions/guldrush");

export function sharedFiles() {
  return readdirSync(SRC).filter((f) => f.endsWith(".js")).sort();
}

/** Filer där kopian saknas eller skiljer sig. */
export function driftedFiles() {
  return sharedFiles().filter((f) => {
    const dst = join(DST, f);
    return !existsSync(dst) || readFileSync(dst, "utf8") !== readFileSync(join(SRC, f), "utf8");
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--check")) {
    const d = driftedFiles();
    if (d.length) {
      console.error(`functions/guldrush/ är inte synkad (${d.join(", ")}) – kör npm run sync:guldrush`);
      process.exit(1);
    }
    console.log("functions/guldrush/ är synkad.");
  } else {
    mkdirSync(DST, { recursive: true });
    for (const f of sharedFiles()) writeFileSync(join(DST, f), readFileSync(join(SRC, f), "utf8"));
    console.log(`Kopierade ${sharedFiles().join(", ")} → functions/guldrush/`);
  }
}
