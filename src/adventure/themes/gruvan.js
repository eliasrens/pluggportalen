// ============================================================================
// Pluggportalen – äventyrsmotorn: themes/gruvan.js
// ----------------------------------------------------------------------------
// TEMA (ren data + inline-SVG) ovanpå den tema-agnostiska motorn (engine.js).
// INGEN spellogik här: rörelse/kollision, frågor, progress, belöning (1–3★,
// grind-skalat mode "aventyr:gruvan") ägs helt av motorn – se themes/README.md
// för motor↔tema-kontraktet. Filen levererar bara kartan, grafiken, färgerna
// och texterna för en MYSIG underjordisk gruva.
//
// Gruvan: en varm, ombonad gruvgång uppifrån (dovt varmt lyktsken, glödande
// kristaller, träbalkar, rälsgångar, gruvvagnar, stenar, lysande svampar,
// glimmande mineraler i bergväggen). Objekten (?) är kristaller som sticker upp
// ur marken – gå fram, svara rätt, så bryts/samlas kristallen in (💎 x/10). Vid
// 10 rätt spawnar motorn slutmålet – en JÄTTEKRISTALL som börjar lysa längre in
// i gruvan – som eleven går till för att aktivera + belönas.
//
// Art följer stilguiden (src/art-style.js): mörk plommonkontur #3B3350, platta
// mjuka former. Här i varm underjords-palett (bärnstensljus mot svalt glödande
// grönskimrande kristaller) – tydligt annorlunda mot Skattjaktens soliga ö och
// Spökjaktens nattkyrkogård. Kortet i områdesöversikten drivs generiskt av
// `oversikt`-fältet (gamemodes.js) – ingen ändring där behövs.
// ============================================================================

import { O, LINE } from "../../art-style.js";

// --- Palett (varm underjordisk gruva) ---------------------------------------
const GOLV = "#5A4436"; // gruvgolv (varm jordbrun)
const GOLV_LJUS = "#6E5342";
const GOLV_MORK = "#43332A";
const RALS_TRA = "#7A5238"; // rälsslipers (mörkt trä)
const RALS_METALL = "#C2B29A"; // blanka rälsskenor
const TRA = "#B0805A"; // träbalk
const TRA_LJUS = "#C89A6E";
const TRA_MORK = "#8A6242";
const STEN = "#998B79"; // sten/block (varmgrå)
const STEN_LJUS = "#BDAF9B";
const STEN_MORK = "#6E6254";
const METALL = "#8A8296"; // gruvvagn metall
const METALL_MORK = "#5A5470";
const LYKTA_GLOD = "#FFCE73"; // varmt lyktsken
const LYKTA_LJUS = "#FFF1C6";
const KRISTALL = "#5FE0A0"; // glödande kristall (grönskimrande)
const KRISTALL_LJUS = "#C4F6DE";
const KRISTALL_MORK = "#34B07A";
const MINERAL = "#86D8E8"; // glimmande mineralåder i berget (svalt cyan)
const MINERAL_LJUS = "#DCF5FA";
const SVAMP = "#E88FA8"; // lysande gruvsvamp (mjuk rosa)
const SVAMP_LJUS = "#FFC9D6";
const SVAMP_STAM = "#F1E4D2";

// Kristallvarianter (stationerna "får gärna se lite olika ut"). Motorn anropar
// stationArt() en gång per station i tur och ordning → en räknare ger stabil,
// deterministisk variation (form + färgton) utan svårighetsval.
const KRIST_VARIANTER = [
  { c: KRISTALL, l: KRISTALL_LJUS, m: KRISTALL_MORK },
  { c: "#7FC7F0", l: "#D2ECFB", m: "#3E8FD0" }, // svalt blå
  { c: "#C79BF0", l: "#ECDCFB", m: "#8A5FD0" }, // ametist-lila
  { c: "#F7C948", l: "#FFF0B8", m: "#E0A92E" }, // bärnstensgul
];
let kristallRakning = 0;

/** Full-bleed tile-SVG (sträcks ut över hela rutan – bra för golv/räls). */
function fill(inner) {
  return (
    `<svg viewBox="0 0 100 100" preserveAspectRatio="none" ` +
    `style="width:100%;height:100%;display:block">${inner}</svg>`
  );
}
/** Centrerad objekt-SVG (behåller proportioner – bra för balk/vagn/kristall). */
function obj(inner, size = "100%") {
  return (
    `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" ` +
    `style="width:${size};height:${size};display:block">${inner}</svg>`
  );
}

// --- Marktexturer -----------------------------------------------------------
/** Gruvgolv – varm jord med små stenflisor och en dov lyktton uppifrån. */
function floorTile() {
  return fill(
    `<rect x="0" y="0" width="100" height="100" fill="${GOLV}"/>` +
    `<rect x="0" y="0" width="100" height="44" fill="${GOLV_LJUS}" opacity="0.18"/>` +
    `<circle cx="26" cy="32" r="4" fill="${GOLV_LJUS}"/>` +
    `<circle cx="70" cy="24" r="3" fill="${GOLV_MORK}" opacity="0.7"/>` +
    `<circle cx="58" cy="68" r="4.5" fill="${GOLV_MORK}" opacity="0.6"/>` +
    `<circle cx="34" cy="76" r="3" fill="${GOLV_LJUS}" opacity="0.7"/>`
  );
}
/** Rälsgång – gruvspår på slipers (två blanka skenor + tvärslå). */
function railTile() {
  return fill(
    `<rect x="0" y="0" width="100" height="100" fill="${GOLV}"/>` +
    `<rect x="0" y="0" width="100" height="44" fill="${GOLV_LJUS}" opacity="0.14"/>` +
    // slipers (tvärgående träbitar)
    `<rect x="6" y="16" width="88" height="12" rx="3" fill="${RALS_TRA}"/>` +
    `<rect x="6" y="50" width="88" height="12" rx="3" fill="${RALS_TRA}"/>` +
    `<rect x="6" y="84" width="88" height="12" rx="3" fill="${RALS_TRA}"/>` +
    // skenor (längsgående metall)
    `<rect x="28" y="0" width="7" height="100" fill="${RALS_METALL}"/>` +
    `<rect x="65" y="0" width="7" height="100" fill="${RALS_METALL}"/>` +
    `<rect x="28" y="0" width="2.4" height="100" fill="#FFF" opacity="0.45"/>` +
    `<rect x="65" y="0" width="2.4" height="100" fill="#FFF" opacity="0.45"/>`
  );
}
/** Golv med en klunga lysande gruvsvampar – mysig underjordsdekor. */
function mushroomTile() {
  return fill(
    `<rect x="0" y="0" width="100" height="100" fill="${GOLV}"/>` +
    `<rect x="0" y="0" width="100" height="44" fill="${GOLV_LJUS}" opacity="0.18"/>` +
    mushroom(34, 70, 1) + mushroom(60, 78, 0.8) + mushroom(72, 58, 0.62)
  );
}
function mushroom(x, y, s) {
  const capW = 16 * s, capH = 11 * s, stemW = 5 * s, stemH = 13 * s;
  return (
    `<circle cx="${x}" cy="${y - capH * 0.3}" r="${14 * s}" fill="${SVAMP_LJUS}" opacity="0.22"/>` +
    `<rect x="${x - stemW / 2}" y="${y - stemH}" width="${stemW}" height="${stemH}" rx="${stemW / 2}" fill="${SVAMP_STAM}" stroke="${O}" stroke-width="2"/>` +
    `<path d="M${x - capW} ${y - stemH + 1} Q${x} ${y - stemH - capH} ${x + capW} ${y - stemH + 1} Z" fill="${SVAMP}" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/>` +
    `<circle cx="${x - capW * 0.4}" cy="${y - stemH - capH * 0.2}" r="${1.8 * s}" fill="${SVAMP_LJUS}"/>` +
    `<circle cx="${x + capW * 0.35}" cy="${y - stemH - capH * 0.1}" r="${1.5 * s}" fill="${SVAMP_LJUS}"/>`
  );
}

// --- Objekt (hinder → bildar gruvgångar) ------------------------------------
/** Bergvägg – mörk klippa. Väggkaraktär "#" (omger gångarna). */
function rockWall() {
  return fill(
    `<rect x="0" y="0" width="100" height="100" fill="${GOLV_MORK}"/>` +
    `<path d="M0 0 H100 V64 Q74 54 50 64 Q26 74 0 62 Z" fill="#2C2230"/>` +
    `<path d="M0 60 Q26 70 50 60 Q74 50 100 60 V100 H0 Z" fill="#3A2E3F"/>` +
    `<path d="M12 20 L30 26 M60 14 L78 22 M40 40 L56 46" stroke="#241C28" stroke-width="3" stroke-linecap="round"/>`
  );
}
/** Glimmande mineralåder i bergväggen (hinder "m"). */
function mineralVein() {
  return fill(
    `<rect x="0" y="0" width="100" height="100" fill="${GOLV_MORK}"/>` +
    `<path d="M0 0 H100 V60 Q72 52 50 62 Q26 72 0 60 Z" fill="#2C2230"/>` +
    `<path d="M0 58 Q26 68 50 58 Q74 48 100 58 V100 H0 Z" fill="#3A2E3F"/>` +
    // glittrande mineralådror
    `<path d="M16 84 L30 54 L24 40 M30 54 L46 48" fill="none" stroke="${MINERAL}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M64 88 L72 58 L86 44 M72 58 L60 46" fill="none" stroke="${MINERAL}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` +
    gnista(30, 54, MINERAL_LJUS) + gnista(72, 58, MINERAL_LJUS) + gnista(46, 48, MINERAL_LJUS)
  );
}
/** Stenblock – rundat klippblock som delar av gången. */
function boulder() {
  return obj(
    `<ellipse cx="50" cy="84" rx="30" ry="8" fill="${O}" opacity="0.18"/>` +
    `<path d="M18 80 Q10 52 36 46 Q50 28 70 44 Q92 50 82 80 Z" fill="${STEN}" ${LINE}/>` +
    `<path d="M32 62 Q46 50 60 60" fill="none" stroke="${STEN_LJUS}" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M40 74 Q54 68 66 74" fill="none" stroke="${STEN_MORK}" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="38" cy="68" r="3" fill="${STEN_LJUS}"/>`
  );
}
/** Träbalk – stödbjälke (två stolpar + tvärslå) som ramar in gruvgångar. */
function beam() {
  return obj(
    `<ellipse cx="50" cy="90" rx="30" ry="6" fill="${O}" opacity="0.16"/>` +
    `<rect x="20" y="22" width="60" height="13" rx="3" fill="${TRA}" ${LINE}/>` +
    `<rect x="22" y="34" width="15" height="58" rx="3" fill="${TRA}" ${LINE}/>` +
    `<rect x="63" y="34" width="15" height="58" rx="3" fill="${TRA}" ${LINE}/>` +
    // ådring + ljusdager
    `<path d="M29 40 V86 M70 40 V86" stroke="${TRA_MORK}" stroke-width="2.4" opacity="0.6"/>` +
    `<rect x="22" y="34" width="4" height="58" fill="${TRA_LJUS}" opacity="0.5"/>` +
    `<path d="M24 28 h52" stroke="${TRA_LJUS}" stroke-width="2.4" opacity="0.5"/>`
  );
}
/** Gruvvagn – liten tralla på räls, lastad med malm. */
function cart() {
  return obj(
    `<ellipse cx="50" cy="90" rx="32" ry="7" fill="${O}" opacity="0.18"/>` +
    // malmlast
    `<path d="M26 50 Q40 36 52 48 Q64 38 74 50 Z" fill="${STEN}" ${LINE}/>` +
    `<circle cx="44" cy="46" r="4" fill="${KRISTALL}" ${LINE}/>` +
    `<circle cx="60" cy="48" r="3.4" fill="${MINERAL}" ${LINE}/>` +
    // vagnskorg
    `<path d="M22 50 H78 L72 76 H28 Z" fill="${METALL}" ${LINE}/>` +
    `<path d="M30 58 H70 M33 68 H67" stroke="${METALL_MORK}" stroke-width="2.6" opacity="0.7"/>` +
    `<rect x="22" y="50" width="56" height="5" rx="2" fill="${METALL_MORK}"/>` +
    // hjul
    `<circle cx="38" cy="80" r="7" fill="${METALL_MORK}" ${LINE}/>` +
    `<circle cx="62" cy="80" r="7" fill="${METALL_MORK}" ${LINE}/>` +
    `<circle cx="38" cy="80" r="2.4" fill="${STEN_LJUS}"/>` +
    `<circle cx="62" cy="80" r="2.4" fill="${STEN_LJUS}"/>`
  );
}
/** Lykta på stolpe – varmt sken som lyser upp gruvgången. */
function lantern() {
  return obj(
    `<defs><radialGradient id="gr-glow" cx="50%" cy="32%" r="55%">` +
    `<stop offset="0%" stop-color="${LYKTA_LJUS}" stop-opacity="0.95"/>` +
    `<stop offset="55%" stop-color="${LYKTA_GLOD}" stop-opacity="0.38"/>` +
    `<stop offset="100%" stop-color="${LYKTA_GLOD}" stop-opacity="0"/>` +
    `</radialGradient></defs>` +
    `<circle cx="50" cy="32" r="46" fill="url(#gr-glow)"/>` +
    `<ellipse cx="50" cy="92" rx="15" ry="5" fill="${O}" opacity="0.18"/>` +
    `<rect x="46" y="44" width="8" height="46" rx="3" fill="${METALL_MORK}" ${LINE}/>` +
    `<path d="M40 90 h20" stroke="${METALL_MORK}" stroke-width="5" stroke-linecap="round"/>` +
    // lykthus
    `<path d="M38 40 h24 l-3 -8 h-18 Z" fill="${METALL_MORK}" ${LINE}/>` +
    `<rect x="39" y="18" width="22" height="22" rx="3" fill="${LYKTA_GLOD}" ${LINE}/>` +
    `<rect x="43" y="22" width="14" height="14" rx="2" fill="${LYKTA_LJUS}"/>` +
    `<path d="M50 16 v-4" stroke="${METALL_MORK}" stroke-width="3" stroke-linecap="round"/>`
  );
}

/** Kristall-station (?) – en glödande kristallklunga som sticker upp ur marken.
 *  Varje anrop ger nästa variant (form/färgton) för lite olika utseende. */
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
    // liten bergsockel
    `<path d="M26 88 Q24 78 34 76 L66 76 Q76 78 74 88 Z" fill="${STEN_MORK}" ${LINE}/>` +
    // kristallspetsar (tre, olika höjd)
    `<path d="M40 80 L34 52 L44 40 L50 62 Z" fill="${v.c}" ${LINE}/>` +
    `<path d="M40 80 L44 40 L50 62 Z" fill="${v.m}" opacity="0.55"/>` +
    `<path d="M52 80 L50 30 L62 46 L60 80 Z" fill="${v.c}" ${LINE}/>` +
    `<path d="M52 80 L50 30 L56 55 Z" fill="${v.l}" opacity="0.55"/>` +
    `<path d="M60 80 L66 54 L74 66 L70 80 Z" fill="${v.c}" ${LINE}/>` +
    gnista(44, 44, v.l) + gnista(62, 40, v.l) + gnista(36, 60, v.l),
    "1.8em"
  );
}

/** Slutmål: en JÄTTEKRISTALL som börjar lysa längre in i gruvan. */
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
    // sockel
    `<path d="M22 92 Q20 80 34 78 L66 78 Q80 80 78 92 Z" fill="${STEN_MORK}" ${LINE}/>` +
    // stor mittkristall
    `<path d="M38 82 L50 8 L62 82 Z" fill="${KRISTALL}" ${LINE}/>` +
    `<path d="M50 8 L50 82 L38 82 Z" fill="${KRISTALL_LJUS}" opacity="0.5"/>` +
    `<path d="M50 8 L62 82 L56 82 L50 34 Z" fill="${KRISTALL_MORK}" opacity="0.55"/>` +
    // sidokristaller
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

function strale(x, y) {
  return `<path d="M50 48 L${x} ${y}" stroke="${KRISTALL}" stroke-width="3" stroke-linecap="round" opacity="0.5"/>`;
}
function gnista(x, y, col) {
  return (
    `<path d="M${x} ${y - 5} L${x + 1.4} ${y - 1.4} L${x + 5} ${y} L${x + 1.4} ${y + 1.4} ` +
    `L${x} ${y + 5} L${x - 1.4} ${y + 1.4} L${x - 5} ${y} L${x - 1.4} ${y - 1.4} Z" fill="${col}"/>`
  );
}

// ============================================================================
export const gruvanTheme = {
  id: "gruvan",
  namn: "Gruvan",
  // Mysig underjord: mörk varm berggrund (void-rutor = oupptäckt klippa runt gången).
  stamning: { himmel: "#241C28", mark: "#3A2E3F" },

  // Gruvgångar uppifrån, inramade av bergvägg. Legenden ger varje hinder eget
  // tecken (bergvägg/balk/vagn/sten/lykta/mineralåder) och tre golv-tecken
  // (gruvgolv/räls/svampklunga), så gångarna slingrar mellan hindren.
  // Validerad (BFS): alla 107 gångrutor sammanhängande, 10 stationer + start + mål nåbara.
  map: [
    "################",
    "#S.=.?..bb..?..#",
    "#..o...==...o..#",
    "#.?.l..m.s..?l.#",
    "#...==.#.==....#",
    "#.v.?..o.o..?.v#",
    "#..s...==.s....#",
    "#.?.bb.?..M...s#",
    "#...l...==...l.#",
    "#.o..?..o..o.?.#",
    "################",
  ],
  legend: {
    " ": "void", // oupptäckt berg (ritas ej – scen-gradienten syns som mörk klippa)
    "#": "wall", // bergvägg (hinder)
    b: "wall", // träbalk (hinder)
    v: "wall", // gruvvagn (hinder)
    o: "wall", // stenblock (hinder)
    l: "wall", // lykta (hinder)
    m: "wall", // glimmande mineralåder (hinder)
    ".": "floor", // gruvgolv
    "=": "floor", // rälsgång
    s: "floor", // svampklunga
    S: "start",
    "?": "station",
    M: "goal",
  },
  goal: 10, // 10 brutna kristaller → jättekristallen börjar lysa

  progressIcon: "💎",
  stationArt: () => crystal(),
  goalArt: () => giantCrystal(),
  // Verktyg i handen: en pickhacka ritas som extra lager i avatarens hand och
  // svingar en kort hackrörelse när en kristall bryts (motorn via hand-tool.js).
  handTool: { namn: "pickhacka", svg: () => pickaxe() },
  tileArt: {
    floor: (t) => (t.char === "=" ? railTile() : t.char === "s" ? mushroomTile() : floorTile()),
    start: () => floorTile(),
    station: () => floorTile(),
    goal: () => floorTile(),
    wall: (t) =>
      t.char === "b" ? beam() :
      t.char === "v" ? cart() :
      t.char === "o" ? boulder() :
      t.char === "l" ? lantern() :
      t.char === "m" ? mineralVein() :
      rockWall(),
    void: () => "", // oupptäckt berg – låt scen-gradienten vara
  },

  texter: {
    intro:
      "Djupt nere i den mysiga Gruvan! ⛏️ Lyktor lyser upp gångarna och kristaller 💎 " +
      "glöder i bergväggarna. Gå fram till varje kristall och svara rätt – då bryts den " +
      "loss! Bryt 10 kristaller så börjar en jättelik kristall lysa längre in. Gå dit " +
      "för att aktivera den!",
    stationPrompt: "En glödande kristall! 💎 Tryck E (eller mellanslag) för att bryta loss den.",
    stationTitle: "Kristallfråga",
    goalPrompt: "Jättekristallen lyser! ✨ Tryck E för att aktivera den och få din belöning.",
    klart: "Du bröt alla kristaller och väckte jättekristallen i Gruvan! 💎⛏️",
  },

  questionKinds: ["quiz", "lasforstaelse", "para"],

  // Kort i områdesöversikten (drivs generiskt av gamemodes.js via detta fält).
  oversikt: {
    sub: "Bryt glödande kristaller djupt nere i den mysiga gruvan!",
    color: "gron",
  },
};
