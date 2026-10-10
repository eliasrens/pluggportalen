// ============================================================================
// #570: bygg src/styles.css av delarna i src/styles/ (NN-namn.css, i
// nummerordning). Källan är alltid src/styles/; styles.css är genererad –
// redigera den aldrig direkt.
//
//   npm run build:css                        → skriv om src/styles.css
//   node admin/bygg-styles.mjs --check       → exit 1 om styles.css glidit
// test/styles-delar.test.js gör samma kontroll i testsviten.
//
// Varför en genererad samlingsfil och inte @import/flera <link>: GitHub Pages-
// deployen är inte atomär och 404:or cachas ~10 min (#271). Nya filer i
// boot-kedjan kan då saknas i ett blandningsfönster → osylad sida. Sajten
// laddar därför fortfarande EN fil, src/styles.css, precis som förut – samma
// regler i samma ordning, inga extra requests, inget @import-vattenfall.
// ============================================================================

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DELAR = join(ROOT, "src/styles");
export const UT = join(ROOT, "src/styles.css");

/** Delarna i laddningsordning (nummerprefixet styr – CSS-ordningen spelar roll). */
export function delar() {
  return readdirSync(DELAR).filter((f) => /^\d\d-[a-z0-9-]+\.css$/.test(f)).sort();
}

/** Hela innehållet i src/styles.css som det ska se ut. */
export function byggStyles() {
  const huvud =
    "/* GENERERAD FIL – redigera inte här. Källan är src/styles/*.css (en fil per\n" +
    "   område, laddas i nummerordning). Bygg om: npm run build:css (#570). */\n";
  return huvud + delar().map((f) => `\n/* ── src/styles/${f} ── */\n` + readFileSync(join(DELAR, f), "utf8")).join("");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--check")) {
    if (readFileSync(UT, "utf8") !== byggStyles()) {
      console.error("src/styles.css är inte byggd från src/styles/ – kör npm run build:css");
      process.exit(1);
    }
    console.log("src/styles.css är synkad.");
  } else {
    writeFileSync(UT, byggStyles());
    console.log(`Byggde src/styles.css av ${delar().length} delar.`);
  }
}
