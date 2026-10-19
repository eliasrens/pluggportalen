// ============================================================================
// Schack (#779): kopiera den DELADE schackkoden till functions/schack/ – Cloud
// Functions laddas bara upp med functions/-mappen, så servern behöver en egen
// kopia (samma mönster som sync-guldrush-functions / sync-brakresan-functions).
// Källan är alltid src/schack/; kopian är genererad – redigera den aldrig.
//
//   src/schack/vendor/chess.js            → functions/schack/vendor/chess.js  (reglerna, BSD-2)
//   src/schack/vendor/LICENSE             → functions/schack/vendor/LICENSE
//   src/schack/schack-server-delat.js     → functions/schack/schack-server-delat.js
//   src/schack/schack-server-parti.js     → functions/schack/schack-server-parti.js
// Samma inbördes struktur, så "./vendor/chess.js" fungerar oförändrad. Brädet,
// motorn och sidorna (UI) följer ALDRIG med – listan FILER är uttrycklig.
//
//   npm run sync:schack     (firebase.json kör det också som predeploy)
//   node admin/sync-schack-functions.mjs --check   → exit 1 om kopian glidit
// test/schack-delat.test.js gör samma kontroll i testsviten.
// ============================================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SRC = join(ROOT, "src/schack");
export const DST = join(ROOT, "functions/schack");
/** De delade filerna, relativt src/schack/ respektive functions/schack/. */
export const FILER = ["vendor/chess.js", "vendor/LICENSE", "schack-server-delat.js", "schack-server-parti.js"];

export function sharedFiles() {
  return [...FILER];
}

/** Filer där kopian saknas, skiljer sig eller ligger kvar i functions/schack/ utan att vara delad. */
export function driftedFiles() {
  const drift = FILER.filter((f) => {
    const d = join(DST, f);
    return !existsSync(d) || readFileSync(d, "utf8") !== readFileSync(join(SRC, f), "utf8");
  });
  const extra = [];
  const walk = (dir, rel) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(join(dir, e.name), r);
      else if (!FILER.includes(r)) extra.push(`${r} (inte delad)`);
    }
  };
  walk(DST, "");
  return [...drift, ...extra];
}

export function syncAll() {
  for (const f of FILER) {
    mkdirSync(dirname(join(DST, f)), { recursive: true });
    writeFileSync(join(DST, f), readFileSync(join(SRC, f), "utf8"));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--check")) {
    const d = driftedFiles();
    if (d.length) {
      console.error(`functions/schack/ är inte synkad (${d.join(", ")}) – kör npm run sync:schack`);
      process.exit(1);
    }
    console.log("functions/schack/ är synkad.");
  } else {
    syncAll();
    console.log(`Kopierade ${FILER.length} filer → functions/schack/`);
  }
}
