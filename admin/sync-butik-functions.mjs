// ============================================================================
// Butiken (#854, epic #851): kopiera butikens DELADE rena kod till functions/butik/
// – Cloud Functions laddas bara upp med functions/-mappen, så callablen butikKop
// behöver en egen kopia (samma mönster som sync-schack-functions). Källan är
// alltid src/; kopian är genererad – redigera den aldrig.
//
//   src/butik-core.js                   kopVara – ett köp (pris, lottning, agdaDjur)
//   src/shop-items.js, mystery-items.js katalogen + mysterylådans lottning
//   src/season-config.js                Halloween på/av (config/season)
//   src/farm-core.js                    gården (djur, nivåer)
//   src/klass-membership.js             petsFromData, ownedCount (+ elevens standarddokument)
//   src/halloween/hw-kostymer.js        Halloween-kostymernas katalog (lazy i webben)
//   src/halloween/hw-djur-katalog.js    Halloween-djurens pumpaägg (lazy i webben)
// Samma inbördes struktur (functions/butik/<sökväg under src/>), så de relativa
// importerna fungerar oförändrade. Konsten och sidorna följer ALDRIG med – listan
// FILER är uttrycklig.
//
//   npm run sync:butik      (firebase.json kör det också som predeploy)
//   node admin/sync-butik-functions.mjs --check   → exit 1 om kopian glidit
// test/butik-core.test.js gör samma kontroll i testsviten.
// ============================================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SRC = join(ROOT, "src");
export const DST = join(ROOT, "functions/butik");
/** De delade filerna, relativt src/ respektive functions/butik/. */
export const FILER = [
  "butik-core.js", "shop-items.js", "mystery-items.js", "season-config.js", "farm-core.js", "klass-membership.js",
  "halloween/hw-kostymer.js", "halloween/hw-djur-katalog.js",
];

export function sharedFiles() {
  return [...FILER];
}

/** Filer där kopian saknas, skiljer sig eller ligger kvar i functions/butik/ utan att vara delad. */
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
      console.error(`functions/butik/ är inte synkad (${d.join(", ")}) – kör npm run sync:butik`);
      process.exit(1);
    }
    console.log("functions/butik/ är synkad.");
  } else {
    syncAll();
    console.log(`Kopierade ${FILER.length} filer → functions/butik/`);
  }
}
