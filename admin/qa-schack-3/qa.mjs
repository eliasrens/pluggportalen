#!/usr/bin/env node
// ============================================================================
// Schack slut-QA Etapp 3 (#792): guiden "Lär dig schack" (3A) och pusslen (3B) i RIKTIGA
// appen mot EN emulator (rigg.sh; samma proxy-per-användare som Etapp 2).
//
//   bash admin/qa-schack-3/rigg.sh <6 portar>;  source /tmp/qa-schack-3/env
//   node admin/qa-schack-3/qa.mjs <steg> <port-A> <port-B> <port-C> … [bildmapp]
//   steg: guide    – alla 12 lektioner klaras (egen BFS för jakterna), stjärnor efter antal drag,
//                    felsvar, sparning (en skrivning per förbättring), kvar efter omladdning
//         pussel   – rätt/fel/tips/matt i två, framsteg, lätt→svårt, kvar efter omladdning
//         sakerhet – schackOk: sänkta stjärnor, främmande nycklar, annan elevs doc, datorPartier/aktivtParti
//         lazy     – pussel-JSON hämtas först i pusselvyn; inga guide-/pusselmoduler vid uppstart
//         layout   – 320/mobil/surfplatta/Chromebook: inget horisontellt scroll, touch + mus
//         kvot     – läsningar/skrivningar för guide + pussel
//         regress  – Etapp 1–2 rök i samma app (dator, kompis i två flikar, lärarsektionen)
// Allt som testas är DOM:en eleven ser; facit läses med Admin-SDK:t.
// ============================================================================
import { startaChromium } from "../qa-schack/cdp.mjs";
import { skapaRapport } from "../qa-schack-2/lib.mjs";

const [STEG, ...rest] = process.argv.slice(2);
const PORTAR = rest.filter((x) => /^\d+$/.test(x)).map(Number);
const BILDER = rest.find((x) => !/^\d+$/.test(x)) || "";
const { ok, fel } = skapaRapport();
const br = await startaChromium();

try {
  const steg = await import(`./steg-${STEG}.mjs`);
  await steg.default({ br, PORTAR, BILDER, ok });
} catch (err) {
  ok("körningen", false, err.stack);
} finally {
  console.log(`\n${fel() ? "FEL: " + fel() : "allt OK"}`);
  br.stang();
  process.exit(fel() ? 1 : 0);
}
