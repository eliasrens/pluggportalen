// ============================================================================
// Pluggportalen – äventyrsmotorn: themes/spokjakten.js  (issue #252)
// ----------------------------------------------------------------------------
// TEMA (ren data + inline-SVG) ovanpå den tema-agnostiska motorn (engine.js).
// INGEN spellogik här: rörelse/kollision, frågor, progress, belöning (1–3★,
// grind-skalat mode "aventyr:spokjakten") ägs helt av motorn – se
// themes/README.md för motor↔tema-kontraktet. Filen levererar bara kartan,
// grafiken, färgerna och texterna för en MYSIG spökjakt i månsken.
//
// Spökjakten kör motorns OPT-IN scroll-läge (issue #220/#252), precis som
// Skattjakten: en STOR natt-värld blir världen och kameran scrollar mjukt under
// en nära centrerad avatar. Banans geometri – världsmått, kollision, start,
// fråge-spawns och slutspöke-platser – bor i spokjakten-map.js (ren, testbar
// matte), och den egenritade natt-SVG:n (spokjakten-scen-svg.js) ritas ur EXAKT
// samma geometri så konst och kollision aldrig driver isär.
//
// Spökjakten: en liten kyrkogård/by en mysig kväll uppifrån (mörkblått månsken,
// glödande lyktor, ett gammalt hus med varmt fönster, dimma, dova träd). Söta
// spöken (?) svävar utspridda – gå fram, svara rätt, så fångas spöket (👻 x/10).
// Vid 10 rätt spawnar motorn slutmålet – ett vänligt, glödande guldspöke – som
// eleven går till för att avsluta + belönas. Mysigt spöklikt, ALDRIG läskigt.
//
// Art följer stilguiden (src/art-style.js): mörk plommonkontur #3B3350, platta
// mjuka former. Här i sval nattpalett i stället för Skattjaktens soliga ö, så
// samma motor känns TYDLIGT annorlunda. Kortet i områdesöversikten drivs
// generiskt av `oversikt`-fältet (gamemodes.js) – ingen ändring där behövs.
// ============================================================================

import { O, LINE } from "../../art-style.js";
import {
  WORLD,
  START_AT,
  pickSpawns,
  pickGoal,
  buildSpokjaktenCollision,
} from "./spokjakten-map.js";
import { SPOKJAKTEN_SCEN_SVG } from "./spokjakten-scen-svg.js";

// --- Kamera-utzoom (lätt att tuna) ------------------------------------------
// Andel av kartBREDDEN som syns åt gången. HÖJ → mer utzoomat (mer av gläntan
// syns), SÄNK → mer inzoomat på avataren. Startar på 0.36 som Skattjakten.
const SPOKJAKT_VIEW_FRACTION = 0.36;

// --- Palett (mysig månskensnatt) --------------------------------------------
const SPOKE = "#F4F6FF"; // söta spöken (nästan vita)
const SPOKE_SKUGGA = "#D6DCF2";
const KIND = "#7FE0FF"; // svag spökglöd (kylig)
const GULD = "#F7C948"; // vänligt slutspöke (varmt guld)
const GULD_LJUS = "#FFF0B8";
const GULD_MORK = "#E0A92E";

/** Centrerad objekt-SVG (behåller proportioner – bra för station/mål-ikon). */
function obj(inner, size = "100%") {
  return (
    `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" ` +
    `style="width:${size};height:${size};display:block">${inner}</svg>`
  );
}

/** Söt spökstation (?) – litet svävande spöke med vänligt leende. */
function ghost() {
  return obj(
    `<ellipse cx="50" cy="88" rx="18" ry="5" fill="${O}" opacity="0.12"/>` +
    `<circle cx="50" cy="46" r="30" fill="${KIND}" opacity="0.16"/>` +
    // kropp med vågig fåll
    `<path d="M26 74 V44 Q26 16 50 16 Q74 16 74 44 V74 ` +
    `Q68 66 62 74 Q56 66 50 74 Q44 66 38 74 Q32 66 26 74 Z" fill="${SPOKE}" ${LINE}/>` +
    `<path d="M60 24 Q70 30 68 46" fill="none" stroke="${SPOKE_SKUGGA}" stroke-width="4" stroke-linecap="round" opacity="0.8"/>` +
    // vänligt ansikte
    `<circle cx="42" cy="42" r="4.2" fill="${O}"/>` +
    `<circle cx="58" cy="42" r="4.2" fill="${O}"/>` +
    `<circle cx="43.4" cy="40.6" r="1.4" fill="#fff"/>` +
    `<circle cx="59.4" cy="40.6" r="1.4" fill="#fff"/>` +
    `<path d="M44 52 Q50 58 56 52" fill="none" stroke="${O}" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="36" cy="50" r="3" fill="#FFB4C4" opacity="0.6"/>` +
    `<circle cx="64" cy="50" r="3" fill="#FFB4C4" opacity="0.6"/>`,
    "1.7em"
  );
}

/** Rädd spök-min (#276): samma söta spöke men UPPTÄCKT – höjda ögonbryn, liten
 *  "o"-mun och en svettdroppe. Signalerar tydligt "oj, nu flyr jag!" utan att bli
 *  läskigt. Scenen växlar hit när spelaren kommer inom upptäckts-radien. */
function scaredGhost() {
  return obj(
    `<ellipse cx="50" cy="88" rx="18" ry="5" fill="${O}" opacity="0.12"/>` +
    `<circle cx="50" cy="46" r="30" fill="${KIND}" opacity="0.22"/>` +
    // kropp med vågig fåll (som lugna spöket)
    `<path d="M26 74 V44 Q26 16 50 16 Q74 16 74 44 V74 ` +
    `Q68 66 62 74 Q56 66 50 74 Q44 66 38 74 Q32 66 26 74 Z" fill="${SPOKE}" ${LINE}/>` +
    `<path d="M60 24 Q70 30 68 46" fill="none" stroke="${SPOKE_SKUGGA}" stroke-width="4" stroke-linecap="round" opacity="0.8"/>` +
    // höjda ögonbryn (förvånad)
    `<path d="M36 33 Q42 29 47 32" fill="none" stroke="${O}" stroke-width="2.6" stroke-linecap="round"/>` +
    `<path d="M53 32 Q58 29 64 33" fill="none" stroke="${O}" stroke-width="2.6" stroke-linecap="round"/>` +
    // stora runda ögon
    `<circle cx="42" cy="43" r="4.6" fill="${O}"/>` +
    `<circle cx="58" cy="43" r="4.6" fill="${O}"/>` +
    `<circle cx="43.6" cy="41.4" r="1.5" fill="#fff"/>` +
    `<circle cx="59.6" cy="41.4" r="1.5" fill="#fff"/>` +
    // liten "o"-mun
    `<circle cx="50" cy="56" r="3.4" fill="none" stroke="${O}" stroke-width="2.8"/>` +
    // svettdroppe uppe till höger
    `<path d="M70 34 Q73 40 70 42 Q67 40 70 34 Z" fill="${KIND}" ${LINE}/>`,
    "1.7em"
  );
}

/** Slutmål: ett vänligt, glödande GULDSPÖKE som vinkar – tydligt festligt. */
function goldGhost() {
  return obj(
    `<defs><radialGradient id="sp-gg" cx="50%" cy="46%" r="56%">` +
    `<stop offset="0%" stop-color="${GULD_LJUS}" stop-opacity="0.95"/>` +
    `<stop offset="55%" stop-color="${GULD}" stop-opacity="0.4"/>` +
    `<stop offset="100%" stop-color="${GULD}" stop-opacity="0"/>` +
    `</radialGradient></defs>` +
    `<circle cx="50" cy="48" r="48" fill="url(#sp-gg)"/>` +
    strale(50, 6) + strale(14, 26) + strale(86, 26) + strale(18, 74) + strale(82, 74) +
    `<ellipse cx="50" cy="90" rx="24" ry="6" fill="${O}" opacity="0.14"/>` +
    // guldspökets kropp
    `<path d="M22 76 V42 Q22 12 50 12 Q78 12 78 42 V76 ` +
    `Q71 67 64 76 Q57 67 50 76 Q43 67 36 76 Q29 67 22 76 Z" fill="${GULD}" ${LINE}/>` +
    `<path d="M60 20 Q72 27 70 46" fill="none" stroke="${GULD_MORK}" stroke-width="4" stroke-linecap="round" opacity="0.8"/>` +
    // vänligt ansikte + vinkande "arm"
    `<circle cx="41" cy="40" r="4.6" fill="${O}"/>` +
    `<circle cx="59" cy="40" r="4.6" fill="${O}"/>` +
    `<path d="M43 51 Q50 59 57 51" fill="none" stroke="${O}" stroke-width="3.4" stroke-linecap="round"/>` +
    `<path d="M24 46 Q12 40 14 30" fill="none" stroke="${GULD}" stroke-width="9" stroke-linecap="round"/>` +
    `<path d="M24 46 Q12 40 14 30" fill="none" stroke="${O}" stroke-width="3" stroke-linecap="round"/>` +
    gnista(30, 24) + gnista(74, 30) + gnista(66, 54)
  );
}
function strale(x, y) {
  return `<path d="M50 48 L${x} ${y}" stroke="${GULD}" stroke-width="3" stroke-linecap="round" opacity="0.5"/>`;
}
function gnista(x, y) {
  return (
    `<path d="M${x} ${y - 5} L${x + 1.4} ${y - 1.4} L${x + 5} ${y} L${x + 1.4} ${y + 1.4} ` +
    `L${x} ${y + 5} L${x - 1.4} ${y + 1.4} L${x - 5} ${y} L${x - 1.4} ${y - 1.4} Z" fill="${GULD_LJUS}"/>`
  );
}

// ============================================================================
export const spokjaktenTheme = {
  id: "spokjakten",
  namn: "Spökjakten",
  // Mysig månskensnatt: djup blå himmel → svalt blått marksken (letterbox utanför
  // bildkanten hålls i samma mörka toner).
  stamning: { himmel: "#232A4D", mark: "#39406B" },

  // Opt-in-flaggan: mapSvg → motorn väljer scroll-läget (world.js/engine.js) och
  // renderar den egenritade natt-SVG:n rakt in i kartlagret (scene-scroll.js).
  mapSvg: SPOKJAKTEN_SCEN_SVG,
  worldSize: WORLD,
  // Andel av kartbredden som syns åt gången – tune:bar konstant högst upp.
  viewFraction: SPOKJAKT_VIEW_FRACTION,

  startAt: START_AT, // vid grinden nere-center (eleven kliver in på kyrkogården)
  // Fråge-spawns: 18 fasta kandidater, spelet väljer 10 (getter → nytt urval per
  // spelomgång). goal=10 → alla valda stationer måste klaras innan slutspöket spawnar.
  get stationsAt() {
    return pickSpawns(10);
  },
  // Slutspöket spawnar på EN av kandidat-platserna (getter → varierar per spel).
  get goalAt() {
    return pickGoal();
  },
  goal: 10, // 10 fångade spöken → slutspöket dyker upp

  // Auktoritativt kollisions-predikat byggt ur samma geometri som konsten ritas ur.
  collision: buildSpokjaktenCollision(),

  // --- Flyende spöken (issue #276) – OPT-IN, bara Spökjakten -----------------
  // fleeing:true slår på motorns flee-motor (flee.js). detectFrac = upptäckts-radie
  // (andel av min(världsmått)); satt större än interactFrac (0.06 default) så spöket
  // hinner bli rädd och fly innan man fångar det → en mysig, görbar jakt. objectScale
  // < 1.1 gör spöken MINDRE (fortfarande tydliga/pekvänliga). fleeSpeedFrac hålls
  // under spelarens speedFrac (0.14 default) så jakten går att vinna.
  fleeing: true,
  detectFrac: 0.13,
  fleeSpeedFrac: 0.1,
  objectScale: 0.78,

  progressIcon: "👻",
  stationArt: () => ghost(),
  stationScaredArt: () => scaredGhost(),
  goalArt: () => goldGhost(),

  texter: {
    intro:
      "En mysig kväll på kyrkogården. 🌙 Söta spöken 👻 svävar mellan gravstenar och " +
      "lyktor. Gå fram till varje spöke och svara rätt – då fångas det! Fånga 10 spöken " +
      "så dyker ett vänligt guldspöke ✨ upp. Gå dit för att avsluta jakten!",
    stationPrompt: "Ett sött spöke med en fråga! 👻 Tryck E (eller mellanslag) för att svara.",
    stationTitle: "Spökfråga",
    goalPrompt: "Det vänliga guldspöket vinkar! ✨ Tryck E för att avsluta och få din belöning.",
    klart: "Du fångade alla spöken i månskenet! 👻🌙",
  },

  // "generator" (#296): banan funkar även på ett generator-område – stationerna
  // ställer då genererade räkneuppgifter (tal + svarsfält) i stället för quiz/par.
  questionKinds: ["quiz", "lasforstaelse", "para", "generator"],

  // Kort i områdesöversikten (drivs generiskt av gamemodes.js via detta fält).
  oversikt: {
    sub: "Fånga söta spöken i månskenet – en mysig spökjakt!",
    color: "lila",
  },
};
