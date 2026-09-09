// ============================================================================
// Pluggportalen – äventyrsmotorn: themes/gruvan.js  (issue #224)
// ----------------------------------------------------------------------------
// TEMA (ren data + inline-SVG-objekt) ovanpå den tema-agnostiska motorn
// (engine.js). INGEN spellogik här: rörelse/kollision, frågor, progress, belöning
// (1–3★, grind-skalat mode "aventyr:gruvan") ägs helt av motorn – se
// themes/README.md för motor↔tema-kontraktet.
//
// Gruvan kör motorns OPT-IN scroll/bild-karta-läge (#220): en STOR egentecknad
// Diablo-lik grotta (src/adventure/assets/gruvan-karta.svg, serverad som fil) blir
// världen och kameran scrollar mjukt under en nära centrerad avatar. Banan går
// VÄNSTER (gruvöppningen) → djupare åt HÖGER genom smala berggångar och kammare
// (med sidofickor) till en STOR slutkammare längst in. Grottans geometri,
// kollision och kristall-platser bor i themes/gruvan-map.js (ren, testbar matte);
// bakgrundsbilden genereras ur SAMMA geometri (themes/gruvan-scen-svg.js) så det
// man ser = det man kan gå på.
//
// Flöde: eleven utforskar gången, hittar 10 (av 18) utspridda glödande kristaller,
// svarar rätt vid var och en (💎 x/10). Vid 10 rätt spawnar JÄTTEKRISTALLEN i
// slutkammaren med tydligt ljussken – eleven går dit, aktiverar den → bana klar.
//
// Art följer stilguiden (src/art-style.js): mörk plommonkontur #3B3350, platta
// mjuka former, varm underjords-palett mot svalt glödande kristaller.
// ============================================================================

import { O, LINE } from "../../art-style.js";
import {
  WORLD,
  MAP_IMAGE,
  START_AT,
  GOAL_AT,
  pickSpawns,
  buildGruvanCollision,
} from "./gruvan-map.js";

// --- Palett (kristaller) ----------------------------------------------------
const STEN_MORK = "#6E6254";
const KRISTALL = "#5FE0A0";
const KRISTALL_LJUS = "#C4F6DE";
const KRISTALL_MORK = "#34B07A";

/** Centrerad objekt-SVG (behåller proportioner). */
function obj(inner, size = "100%") {
  return (
    `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" ` +
    `style="width:${size};height:${size};display:block">${inner}</svg>`
  );
}
function gnista(x, y, col) {
  return (
    `<path d="M${x} ${y - 5} L${x + 1.4} ${y - 1.4} L${x + 5} ${y} L${x + 1.4} ${y + 1.4} ` +
    `L${x} ${y + 5} L${x - 1.4} ${y + 1.4} L${x - 5} ${y} L${x - 1.4} ${y - 1.4} Z" fill="${col}"/>`
  );
}

// Kristallvarianter (stationerna får se lite olika ut). Motorn anropar
// stationArt() en gång per station → en räknare ger stabil variation.
const KRIST_VARIANTER = [
  { c: KRISTALL, l: KRISTALL_LJUS, m: KRISTALL_MORK }, // grön
  { c: "#7FC7F0", l: "#D2ECFB", m: "#3E8FD0" }, // svalt blå
  { c: "#C79BF0", l: "#ECDCFB", m: "#8A5FD0" }, // ametist-lila
  { c: "#F7C948", l: "#FFF0B8", m: "#E0A92E" }, // bärnstensgul
];
let kristallRakning = 0;

/** Kristall-station (?) – en glödande kristallklunga som sticker upp ur marken. */
function crystal() {
  const v = KRIST_VARIANTER[kristallRakning % KRIST_VARIANTER.length];
  kristallRakning++;
  const gid = `gr-kr-${kristallRakning}`;
  return obj(
    `<defs><radialGradient id="${gid}" cx="50%" cy="46%" r="55%">` +
      `<stop offset="0%" stop-color="${v.l}" stop-opacity="0.9"/>` +
      `<stop offset="60%" stop-color="${v.c}" stop-opacity="0.3"/>` +
      `<stop offset="100%" stop-color="${v.c}" stop-opacity="0"/>` +
      `</radialGradient></defs>` +
      `<circle cx="50" cy="50" r="44" fill="url(#${gid})"/>` +
      `<ellipse cx="50" cy="88" rx="22" ry="6" fill="${O}" opacity="0.16"/>` +
      `<path d="M26 88 Q24 78 34 76 L66 76 Q76 78 74 88 Z" fill="${STEN_MORK}" ${LINE}/>` +
      `<path d="M40 80 L34 52 L44 40 L50 62 Z" fill="${v.c}" ${LINE}/>` +
      `<path d="M40 80 L44 40 L50 62 Z" fill="${v.m}" opacity="0.55"/>` +
      `<path d="M52 80 L50 30 L62 46 L60 80 Z" fill="${v.c}" ${LINE}/>` +
      `<path d="M52 80 L50 30 L56 55 Z" fill="${v.l}" opacity="0.55"/>` +
      `<path d="M60 80 L66 54 L74 66 L70 80 Z" fill="${v.c}" ${LINE}/>` +
      gnista(44, 44, v.l) + gnista(62, 40, v.l) + gnista(36, 60, v.l)
  );
}

function strale(x, y) {
  return `<path d="M50 48 L${x} ${y}" stroke="${KRISTALL}" stroke-width="3" stroke-linecap="round" opacity="0.5"/>`;
}
/** Slutmål: en JÄTTEKRISTALL som börjar lysa längst in i grottan. */
function giantCrystal() {
  return obj(
    `<defs><radialGradient id="gr-giant" cx="50%" cy="46%" r="58%">` +
      `<stop offset="0%" stop-color="${KRISTALL_LJUS}" stop-opacity="0.98"/>` +
      `<stop offset="52%" stop-color="${KRISTALL}" stop-opacity="0.42"/>` +
      `<stop offset="100%" stop-color="${KRISTALL}" stop-opacity="0"/>` +
      `</radialGradient></defs>` +
      `<circle cx="50" cy="48" r="50" fill="url(#gr-giant)"/>` +
      strale(50, 4) + strale(12, 26) + strale(88, 26) + strale(16, 72) + strale(84, 72) +
      `<ellipse cx="50" cy="92" rx="30" ry="7" fill="${O}" opacity="0.16"/>` +
      `<path d="M22 92 Q20 80 34 78 L66 78 Q80 80 78 92 Z" fill="${STEN_MORK}" ${LINE}/>` +
      `<path d="M38 82 L50 8 L62 82 Z" fill="${KRISTALL}" ${LINE}/>` +
      `<path d="M50 8 L50 82 L38 82 Z" fill="${KRISTALL_LJUS}" opacity="0.5"/>` +
      `<path d="M50 8 L62 82 L56 82 L50 34 Z" fill="${KRISTALL_MORK}" opacity="0.55"/>` +
      `<path d="M26 82 L34 36 L44 58 L42 82 Z" fill="${KRISTALL}" ${LINE}/>` +
      `<path d="M26 82 L34 36 L38 62 Z" fill="${KRISTALL_LJUS}" opacity="0.5"/>` +
      `<path d="M58 82 L68 44 L76 62 L72 82 Z" fill="${KRISTALL}" ${LINE}/>` +
      `<path d="M72 82 L68 44 L66 64 Z" fill="${KRISTALL_MORK}" opacity="0.5"/>` +
      gnista(40, 34, KRISTALL_LJUS) + gnista(62, 50, KRISTALL_LJUS) + gnista(50, 22, "#FFFFFF")
  );
}

// ============================================================================
export const gruvanTheme = {
  id: "gruvan",
  namn: "Gruvan",
  // Berget runt grottan (kamerans letterbox utanför bildkanten) i djup varm ton.
  stamning: { himmel: "#1d1622", mark: "#2C2230" },

  // Opt-in-flaggan: mapImage → motorn väljer scroll/bild-karta-läget (world.js).
  mapImage: MAP_IMAGE,
  worldSize: WORLD,
  viewFraction: 1 / 4, // ~1/4 av grottans bredd syns → nära, mysig Diablo-känsla

  startAt: START_AT, // gruvöppningen längst till vänster
  // Kristall-spawns: 18 fasta kandidater, spelet väljer 10 (getter → nytt urval
  // per spelomgång). goal=10 → alla valda måste brytas innan jättekristallen tänds.
  get stationsAt() {
    return pickSpawns(10);
  },
  goalAt: GOAL_AT, // jättekristallen i slutkammaren, längst till höger
  goal: 10,

  // Grovt/generöst kollisionslager: berg = allt utanför grott-ytan.
  collision: buildGruvanCollision(),

  // Tuning för den stora världen (world.js läser *Frac som andel av min(w,h)).
  avatarFrac: 0.055,
  speedFrac: 0.2,
  interactFrac: 0.06,

  progressIcon: "💎",
  stationArt: () => crystal(),
  goalArt: () => giantCrystal(),

  texter: {
    intro:
      "Djupt in i den mysiga Gruvan! ⛏️ Gå in genom gruvöppningen till vänster och " +
      "följ de slingrande berggångarna allt djupare åt höger. Lyktor lyser upp vägen och " +
      "glödande kristaller 💎 sticker upp här och var (kika in i sidofickorna!). Gå fram " +
      "till en kristall och svara rätt – då bryts den loss! Bryt 10 kristaller så börjar " +
      "en jättelik kristall lysa längst in i grottan. Gå dit och aktivera den!",
    stationPrompt: "En glödande kristall! 💎 Tryck E (eller mellanslag) för att bryta loss den.",
    stationTitle: "Kristallfråga",
    goalPrompt: "Jättekristallen lyser! ✨ Tryck E för att aktivera den och få din belöning.",
    klart: "Du bröt alla kristaller och väckte jättekristallen djupt inne i Gruvan! 💎⛏️",
  },

  questionKinds: ["quiz", "lasforstaelse", "para"],

  // Kort i områdesöversikten (drivs generiskt av gamemodes.js via detta fält).
  oversikt: {
    sub: "Utforska den mysiga grottan och bryt glödande kristaller!",
    color: "gron",
  },
};
