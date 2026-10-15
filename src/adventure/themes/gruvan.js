// ============================================================================
// Pluggporten – äventyrsmotorn: themes/gruvan.js  (issue #224)
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

// --- Palett (kristaller + pickhacka) ----------------------------------------
const STEN_MORK = "#6E6254";
const STEN_LJUS = "#BDAF9B";
const KRISTALL = "#5FE0A0";
const KRISTALL_LJUS = "#C4F6DE";
const KRISTALL_MORK = "#34B07A";
const MINERAL_LJUS = "#DCF5FA";
const TRA = "#B0805A"; // pickhackans skaft
const TRA_LJUS = "#C89A6E";
const METALL = "#8A8296"; // pickhackans stålhuvud
const METALL_MORK = "#5A5470";

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

/** Pickhacka i handen (issue #225): trä-skaft + böjt stål-pickhuvud. Ritas som
 *  extra lager i avatarens hand av motorn (hand-tool.js) – ett ÅTERANVÄNDBART
 *  "tema-verktyg", framtida teman sätter bara sitt eget `handTool`. Följer
 *  stilguiden (plommonkontur, platta former). viewBox 0 0 100 100, skaftets grepp
 *  ligger nere till vänster (~30,86) där avatarens hand är. */
function pickaxe() {
  return (
    `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" ` +
    `style="width:100%;height:100%;display:block;overflow:visible">` +
    // skaft (trä): mörk kontur under + varm träyta + ljusdager
    `<path d="M30 88 L63 25" stroke="${O}" stroke-width="15" stroke-linecap="round"/>` +
    `<path d="M30 88 L63 25" stroke="${TRA}" stroke-width="10" stroke-linecap="round"/>` +
    `<path d="M31 85 L61 28" stroke="${TRA_LJUS}" stroke-width="3" stroke-linecap="round" opacity="0.6"/>` +
    // pickhuvud (böjd stålbar med två spetsar, korsar skaftets topp)
    `<path d="M14 34 Q38 10 60 22 Q82 10 100 30 Q80 22 60 31 Q40 22 14 34 Z" ` +
    `fill="${METALL}" ${LINE}/>` +
    `<path d="M18 33 Q40 14 60 24 Q80 14 96 30" fill="none" stroke="${STEN_LJUS}" ` +
    `stroke-width="2.4" stroke-linecap="round" opacity="0.7"/>` +
    // fäste (kil) där huvudet möter skaftet
    `<rect x="55" y="19" width="14" height="13" rx="3" fill="${METALL_MORK}" ${LINE}/>` +
    // liten glimt på stålspetsen
    gnista(96, 29, MINERAL_LJUS) +
    `</svg>`
  );
}

// --- Bild på äventyrskortet (#704) -------------------------------------------
// Områdessidans kort visar en remsa (78–120 px hög) av den här 320×140-bilden,
// beskuren med xMidYMid slice: hela bredden syns alltid, höjden kapas uppifrån
// och nerifrån. Allt viktigt ligger därför inom y≈40–100. Platt, inga gradienter.
const SCEN_LINJE = `stroke="${O}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"`;
const BERGVAGG = "#6B4A35";
const BERGVAGG_LJUS = "#7C583F";
const GROTTA = "#2E1F15";
const GOLV = "#4A3426";
const LYKTA = "#FFCE73";
const TURKOS = "#7FE3F0";
const TURKOS_LJUS = "#DCF5FA";
const ROSA = "#FF7FA8";
const ROSA_LJUS = "#FFD0DE";
const GUL = "#F7C948";
const GUL_LJUS = "#FFF0B8";

/** En klunga med tre kristaller som står på golvet vid x (botten y). */
function scenKristaller(x, y, s, c, l) {
  const p = (pts) => pts.map(([a, b]) => `${x + a * s} ${y + b * s}`).join(" L");
  return (
    `<path d="M${p([[-12, 0], [-16, -16], [-9, -22], [-4, 0]])} Z" fill="${c}" ${SCEN_LINJE}/>` +
    `<path d="M${p([[8, 0], [14, -18], [19, -10], [16, 0]])} Z" fill="${c}" ${SCEN_LINJE}/>` +
    `<path d="M${p([[-6, 0], [-6, -26], [2, -36], [8, -26], [8, 0]])} Z" fill="${c}" ${SCEN_LINJE}/>` +
    `<path d="M${p([[-3, -3], [-3, -25], [2, -31]])} Z" fill="${l}" opacity="0.8"/>`
  );
}
function scenGnista(x, y, r, col) {
  const k = r * 0.28;
  return `<path d="M${x} ${y - r} L${x + k} ${y - k} L${x + r} ${y} L${x + k} ${y + k} L${x} ${y + r} L${x - k} ${y + k} L${x - r} ${y} L${x - k} ${y - k} Z" fill="${col}"/>`;
}

/** Brun bergvägg med två grottöppningar, glittrande kristaller och en lykta. */
function oversiktScen() {
  return (
    `<svg viewBox="0 0 320 140" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" focusable="false">` +
    `<rect width="320" height="140" fill="${BERGVAGG}"/>` +
    // bergets struktur: mjuka ljusare stenar
    `<path d="M10 30 q14 -10 28 0 q-4 10 -28 0 Z M236 26 q18 -10 34 2 q-10 10 -34 -2 Z M86 40 q10 -6 20 0 q-6 7 -20 0 Z M14 112 q14 -8 26 2 q-10 8 -26 -2 Z" fill="${BERGVAGG_LJUS}"/>` +
    // golvet
    `<path d="M0 98 Q80 94 160 98 T320 96 V140 H0 Z" fill="${GOLV}" ${SCEN_LINJE}/>` +
    // stora grottöppningen i mitten med trästöttor
    `<path d="M116 140 V78 Q116 50 160 50 Q204 50 204 78 V140 Z" fill="${GROTTA}" ${SCEN_LINJE}/>` +
    `<rect x="108" y="52" width="10" height="88" rx="2" fill="${TRA}" ${SCEN_LINJE}/>` +
    `<rect x="202" y="52" width="10" height="88" rx="2" fill="${TRA}" ${SCEN_LINJE}/>` +
    `<rect x="100" y="42" width="120" height="11" rx="3" fill="${TRA_LJUS}" ${SCEN_LINJE}/>` +
    // lilla grottöppningen till höger
    `<path d="M246 140 V92 Q246 72 268 72 Q290 72 290 92 V140 Z" fill="${GROTTA}" ${SCEN_LINJE}/>` +
    // rälsen in i gruvan
    `<path d="M146 98 L136 140 M174 98 L184 140" stroke="${METALL}" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M143 108 H177 M140 120 H180" stroke="${TRA}" stroke-width="3" stroke-linecap="round"/>` +
    // kristaller: turkos till vänster, gul inne i grottan, rosa vid lilla öppningen
    scenKristaller(68, 99, 1, TURKOS, TURKOS_LJUS) +
    scenKristaller(160, 98, 0.62, GUL, GUL_LJUS) +
    scenKristaller(232, 99, 0.75, ROSA, ROSA_LJUS) +
    scenGnista(52, 66, 4, "#FFFFFF") + scenGnista(86, 70, 3.5, TURKOS_LJUS) +
    scenGnista(150, 70, 3, GUL_LJUS) + scenGnista(174, 76, 2.5, GUL_LJUS) + scenGnista(242, 76, 3.5, "#FFFFFF") +
    // lyktan på en krok i bergväggen, med korta ljusstrålar
    [-60, -30, 0, 30, 60, 120, 150, 180, 210, 240]
      .map((v) => `<path d="M46 61 H51" stroke="${LYKTA}" stroke-width="2.5" stroke-linecap="round" transform="rotate(${v} 28 61)"/>`)
      .join("") +
    `<path d="M16 42 H28 V48" fill="none" stroke="${O}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<rect x="20" y="50" width="16" height="22" rx="4" fill="${LYKTA}" ${SCEN_LINJE}/>` +
    `<path d="M20 56 H36 M20 66 H36" stroke="${O}" stroke-width="2"/>` +
    `<path d="M22 50 Q28 44 34 50" fill="${METALL_MORK}" ${SCEN_LINJE}/>` +
    `</svg>`
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
  // Verktyg i handen: en pickhacka ritas som extra lager i avatarens hand och
  // svingar en kort hackrörelse när en kristall bryts (motorn via hand-tool.js).
  handTool: { namn: "pickhacka", svg: () => pickaxe() },

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

  // "generator" (#296): banan funkar även på ett generator-område – stationerna
  // ställer då genererade räkneuppgifter (tal + svarsfält) i stället för quiz/par.
  questionKinds: ["quiz", "lasforstaelse", "para", "generator"],

  // Kort i områdesöversikten (drivs generiskt av gamemodes.js via detta fält).
  oversikt: {
    sub: "Utforska den mysiga grottan och bryt glödande kristaller!",
    color: "gron",
    scen: oversiktScen,
  },
};
