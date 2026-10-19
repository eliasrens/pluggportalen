#!/usr/bin/env node
// ============================================================================
// Schack slut-QA Etapp 2 (#782): flera elever + läraren i RIKTIGA appen mot EN
// emulator (rigg.sh), varje användare i sin egen origin (proxy med räknare).
//
//   source /tmp/qa-schack-2/env
//   node admin/qa-schack-2/qa.mjs <steg> <port-Alva> <port-Bilal> <port-lärare> <port-Cleo> <port-Ebba> [bildmapp]
//   steg: partier  – matt (+ lärarens åskådarläge live), remi (neka + acceptera), ge upp,
//                    tiden slut + Kräv vinsten, 5-min-regeln utan klocka, slutrutorna
//         lobby    – vänta/sluta vänta, utmana/nej, 2-/10-min-utgång, ett parti åt gången
//                    (även samtidigt), återkomst, Spela igen, Till lobbyn, annan klass
//         larare   – topplistan (poäng, egen rad, dölj, nollställ), modul av, fokusläge,
//                    avsluta parti (avbrutet hos båda, tabellen orörd), statistik
//         sakerhet – direktskrivning, läsa annans parti, fel tur/olagligt drag/falsk klocka,
//                    elev mot lärarcallables, lärare/annan klass mot elevcallables
//         kvot     – 80 halvdrag med klocka (två spelare + åskådare), lobbyn med många öppna,
//                    lyssnarna stängs, inget per sekund
//         layout   – 320/360 px, surfplatta, Chromebook: lobby, parti, slutruta, lärarvy
//         helskarm – 2E: knappen mot kompis och datorn, fyller skärmen, ut med knappen/Esc,
//                    mobil/surfplatta/Chromebook, dold utan Fullscreen API (riktig Esc:
//                    QA_HEADFUL=1 xvfb-run -a node admin/qa-schack-2/qa.mjs helskarm …)
//         lyssnare – antal onSnapshot (addTarget/removeTarget på tråden) i varje läge
//         klocka   – riktig 5-min-utgång + Kräv vinsten, elevdatorer som går fel
//         (även kvotlobby, latens, extra, gammalt – se steg-*.mjs)
// Allt som testas är DOM:en eleven ser + riktiga callables; facit läses med Admin-SDK.
// ============================================================================
import { startaChromium } from "../qa-schack/cdp.mjs";
import { skapaRapport } from "./lib.mjs";

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
