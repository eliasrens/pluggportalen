// ============================================================================
// Guldrushen (#563) + kistspelsmotorn (#651): kopiera den DELADE koden till
// functions/ – Cloud Functions laddas bara upp med functions/-mappen, så
// servern behöver en egen kopia. Källan är alltid src/…/delat/; kopian är
// genererad.
//   src/live/kistspel/delat/          → functions/kistspel/   (motorn)
//   src/live/formats/guldrush/delat/  → functions/guldrush/   (kistor + regler)
// Formatets delat/ importerar motorn som "../../../kistspel/delat/…" – i
// kopian skrivs vägen om till "../kistspel/…" (samma fil, functions-trädet).
// Ett nytt kistformat (Datakuppen) lägger till sin rad i PAIRS.
//
//   npm run sync:guldrush   (= sync:kistspel; firebase.json kör det som predeploy)
//   node admin/sync-guldrush-functions.mjs --check   → exit 1 om en kopia glidit
// test/live-guldrush-delat.test.js gör samma kontroll i testsviten.
// ============================================================================

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SRC = join(ROOT, "src/live/formats/guldrush/delat");
export const DST = join(ROOT, "functions/guldrush");
export const KS_SRC = join(ROOT, "src/live/kistspel/delat");
export const KS_DST = join(ROOT, "functions/kistspel");

/** Motorns importväg i ett formats delat/ → i functions-kopian. */
const KS_IMPORT = /(["'])\.\.\/\.\.\/\.\.\/kistspel\/delat\//g;
export const toFunctionsCopy = (src) => src.replace(KS_IMPORT, "$1../kistspel/");

export const PAIRS = [
  { name: "kistspel", src: KS_SRC, dst: KS_DST, transform: (s) => s },
  { name: "guldrush", src: SRC, dst: DST, transform: toFunctionsCopy },
];

const jsFiles = (dir) => readdirSync(dir).filter((f) => f.endsWith(".js")).sort();

/** Guldrushens delade filer (formatets delat/). */
export function sharedFiles() {
  return jsFiles(SRC);
}

/** Motorns delade filer (src/live/kistspel/delat/). */
export function kistspelFiles() {
  return jsFiles(KS_SRC);
}

/** Filer där kopian saknas eller skiljer sig – "kistspel/ks-regler.js" osv. */
export function driftedFiles(pairs = PAIRS) {
  return pairs.flatMap(({ name, src, dst, transform }) => jsFiles(src)
    .filter((f) => {
      const d = join(dst, f);
      return !existsSync(d) || readFileSync(d, "utf8") !== transform(readFileSync(join(src, f), "utf8"));
    })
    .map((f) => `${name}/${f}`));
}

export function syncAll(pairs = PAIRS) {
  for (const { src, dst, transform } of pairs) {
    mkdirSync(dst, { recursive: true });
    for (const f of jsFiles(src)) writeFileSync(join(dst, f), transform(readFileSync(join(src, f), "utf8")));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--check")) {
    const d = driftedFiles();
    if (d.length) {
      console.error(`functions/ är inte synkad (${d.join(", ")}) – kör npm run sync:guldrush`);
      process.exit(1);
    }
    console.log("functions/kistspel/ och functions/guldrush/ är synkade.");
  } else {
    syncAll();
    for (const p of PAIRS) console.log(`Kopierade ${jsFiles(p.src).join(", ")} → functions/${p.name}/`);
  }
}
