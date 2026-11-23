// ============================================================================
// Matchdagen (#874, Etapp 4): kopiera den DELADE koden till functions/matchdagen/ –
// Cloud Functions laddas bara upp med functions/-mappen, så servern behöver en egen
// kopia (samma mönster som Kurragömma i sync-guldrush-functions och sync-schack-functions).
// Källan är alltid src/; kopian är genererad – redigera den aldrig.
//
//   src/matchdagen/delat/*.js   → functions/matchdagen/*.js        (motorn, vänskapsmatchen,
//                                                                   texterna, konfigurationen)
//   frågekällornas rena kod     → functions/matchdagen/kallor/…    (samma inbördes vägar som i src/,
//                                                                   så "./matte-generator.js" fungerar):
//     rakna-core.js (generatorn och Räknas rättning), matte-generator.js + matte-generator/,
//     exercise-types.js, grades.js och mult/generator.js (multiplikationsfrågan och alternativen)
//   veckoschemats rena kod (#903, Del E) → functions/matchdagen/kallor/…: klass-schema.js och
//     klass-schema-tid.js (schemaForStudent med serverns tid) med det den importerar –
//     class-lock.js, gamemode-visibility.js, sanningsjakt-content.js, adventure/themes/meta.js
//   lästexturvalet (#905) → functions/matchdagen/kallor/…: matchdagen/md-lastext.js (quizUrval) och
//     live/modes/quiz-passage.js (Live-lägets lästext-regel) – klienten och servern väljer med samma kod
// Plugga-områdenas quiz och par byggs på servern i functions/md-vanskap-fragor.js (prov-fran-omrade.js
// drar in sidans moduler och kan inte följa med) – urvalet av quizfrågor med quizUrval ovan.
//
//   npm run sync:matchdagen     (firebase.json kör det också som predeploy)
//   node admin/sync-matchdagen-functions.mjs --check   → exit 1 om kopian glidit
// test/matchdagen-vanskap-server.test.js gör samma kontroll i testsviten.
// ============================================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SRC = join(ROOT, "src");
export const DELAT = join(ROOT, "src/matchdagen/delat");
export const DST = join(ROOT, "functions/matchdagen");

/** Frågekällornas filer, relativt src/ (kopieras till functions/matchdagen/kallor/). */
export const KALLOR = [
  "rakna-core.js", "matte-generator.js", "exercise-types.js", "grades.js", "mult/generator.js",
  "klass-schema.js", "klass-schema-tid.js", "class-lock.js", "gamemode-visibility.js", "sanningsjakt-content.js", "adventure/themes/meta.js",
  "matchdagen/md-lastext.js", "live/modes/quiz-passage.js",
  ...readdirSync(join(SRC, "matte-generator")).filter((f) => f.endsWith(".js")).sort().map((f) => `matte-generator/${f}`),
];

/** Alla delade filer: [källa, kopia relativt functions/matchdagen/]. */
export function sharedFiles() {
  const delat = readdirSync(DELAT).filter((f) => f.endsWith(".js")).sort().map((f) => [join(DELAT, f), f]);
  return [...delat, ...KALLOR.map((f) => [join(SRC, f), `kallor/${f}`])];
}

/** Kopior som saknas eller skiljer sig, och filer i functions/matchdagen/ som inte är delade. */
export function driftedFiles() {
  const filer = sharedFiles();
  const kanda = new Set(filer.map(([, d]) => d));
  const drift = filer.filter(([s, d]) => !existsSync(join(DST, d)) || readFileSync(join(DST, d), "utf8") !== readFileSync(s, "utf8")).map(([, d]) => d);
  const extra = [];
  const walk = (dir, rel) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(join(dir, e.name), r);
      else if (!kanda.has(r)) extra.push(`${r} (inte delad)`);
    }
  };
  walk(DST, "");
  return [...drift, ...extra];
}

export function syncAll() {
  for (const [s, d] of sharedFiles()) {
    mkdirSync(dirname(join(DST, d)), { recursive: true });
    writeFileSync(join(DST, d), readFileSync(s, "utf8"));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--check")) {
    const d = driftedFiles();
    if (d.length) {
      console.error(`functions/matchdagen/ är inte synkad (${d.join(", ")}) – kör npm run sync:matchdagen`);
      process.exit(1);
    }
    console.log("functions/matchdagen/ är synkad.");
  } else {
    syncAll();
    console.log(`Kopierade ${sharedFiles().length} filer → functions/matchdagen/`);
  }
}
