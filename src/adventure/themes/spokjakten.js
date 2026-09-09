// ============================================================================
// Pluggportalen – äventyrsmotorn: themes/spokjakten.js
// ----------------------------------------------------------------------------
// TEMA (ren data + inline-SVG) ovanpå den tema-agnostiska motorn (engine.js).
// INGEN spellogik här: rörelse/kollision, frågor, progress, belöning (1–3★,
// grind-skalat mode "aventyr:spokjakten") ägs helt av motorn – se
// themes/README.md för motor↔tema-kontraktet. Filen levererar bara kartan,
// grafiken, färgerna och texterna för en MYSIG spökjakt i månsken.
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

// --- Palett (mysig månskensnatt) --------------------------------------------
const GRAS = "#33506E"; // gräs i månsken (svalt blågrönt)
const GRAS_LJUS = "#436A82";
const GRAS_MORK = "#2A4258";
const STIG = "#3F4566"; // kullerstensstig
const STIG_LJUS = "#535A84";
const STEN = "#9AA2C0"; // gravsten (blek i månljus)
const STEN_LJUS = "#C2C8DE";
const STEN_MORK = "#6E769A";
const TRA = "#4A3A55"; // trädstam / trä (mörk plommon)
const TRA_LJUS = "#5E4A6A";
const LOV = "#2E4E52"; // löv (dov nattgrön)
const LOV_LJUS = "#3E6A64";
const LYKTA_GLOD = "#FFD27A"; // varmt lyktsken
const LYKTA_LJUS = "#FFF0C4";
const METALL = "#4A4466"; // svart-lila metall
const FONSTER = "#FFCF6E"; // glödande fönster
const SPOKE = "#F4F6FF"; // söta spöken (nästan vita)
const SPOKE_SKUGGA = "#D6DCF2";
const KIND = "#7FE0FF"; // svag spökglöd (kylig)
const GULD = "#F7C948"; // vänligt slutspöke (varmt guld)
const GULD_LJUS = "#FFF0B8";
const GULD_MORK = "#E0A92E";

/** Full-bleed tile-SVG (sträcks ut över hela rutan – bra för mark/gräs). */
function fill(inner) {
  return (
    `<svg viewBox="0 0 100 100" preserveAspectRatio="none" ` +
    `style="width:100%;height:100%;display:block">${inner}</svg>`
  );
}
/** Centrerad objekt-SVG (behåller proportioner – bra för sten/träd/lykta). */
function obj(inner, size = "100%") {
  return (
    `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" ` +
    `style="width:${size};height:${size};display:block">${inner}</svg>`
  );
}

// --- Marktexturer -----------------------------------------------------------
function grassTile() {
  return fill(
    `<rect x="0" y="0" width="100" height="100" fill="${GRAS}"/>` +
    // svalt månsken uppifrån
    `<rect x="0" y="0" width="100" height="46" fill="${GRAS_LJUS}" opacity="0.16"/>` +
    `<path d="M18 62 l3 -12 M34 74 l3 -12 M56 66 l3 -13 M74 76 l3 -12 M88 60 l3 -12" ` +
    `stroke="${GRAS_MORK}" stroke-width="4" stroke-linecap="round" fill="none"/>` +
    // liten glödmask/eldfluga
    `<circle cx="66" cy="30" r="2.2" fill="${LYKTA_GLOD}" opacity="0.65"/>`
  );
}
/** Gräs + en mjuk dimslinga (utspridd över banan – ger mysig nattdimma). */
function fogTile() {
  return fill(
    `<rect x="0" y="0" width="100" height="100" fill="${GRAS}"/>` +
    `<rect x="0" y="0" width="100" height="46" fill="${GRAS_LJUS}" opacity="0.16"/>` +
    `<path d="M-6 58 Q26 48 52 58 T112 56" fill="none" stroke="#EAF0FF" ` +
    `stroke-width="12" stroke-linecap="round" opacity="0.14"/>` +
    `<path d="M-6 74 Q30 66 58 74 T118 72" fill="none" stroke="#EAF0FF" ` +
    `stroke-width="9" stroke-linecap="round" opacity="0.11"/>`
  );
}
function pathTile() {
  return fill(
    `<rect x="0" y="0" width="100" height="100" fill="${STIG}"/>` +
    `<circle cx="28" cy="30" r="12" fill="${STIG_LJUS}"/>` +
    `<circle cx="66" cy="26" r="9" fill="${STIG_LJUS}"/>` +
    `<circle cx="46" cy="60" r="13" fill="${STIG_LJUS}"/>` +
    `<circle cx="78" cy="70" r="10" fill="${STIG_LJUS}"/>` +
    `<circle cx="18" cy="76" r="8" fill="${STIG_LJUS}"/>` +
    `<circle cx="28" cy="30" r="12" fill="none" stroke="${GRAS_MORK}" stroke-width="1.6" opacity="0.5"/>` +
    `<circle cx="46" cy="60" r="13" fill="none" stroke="${GRAS_MORK}" stroke-width="1.6" opacity="0.5"/>`
  );
}

// --- Objekt (hinder → bildar gångvägar) -------------------------------------
/** Träd – dova nattgröna kronor, mörk stam. */
function tree() {
  return obj(
    `<ellipse cx="50" cy="90" rx="26" ry="8" fill="${O}" opacity="0.16"/>` +
    `<rect x="44" y="60" width="12" height="30" rx="4" fill="${TRA}" ${LINE}/>` +
    `<path d="M50 66 q-8 -4 -12 -12 M50 74 q8 -4 13 -11" fill="none" stroke="${TRA_LJUS}" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="38" cy="42" r="18" fill="${LOV}" ${LINE}/>` +
    `<circle cx="64" cy="44" r="16" fill="${LOV}" ${LINE}/>` +
    `<circle cx="52" cy="30" r="19" fill="${LOV}" ${LINE}/>` +
    `<circle cx="46" cy="34" r="7" fill="${LOV_LJUS}" opacity="0.7"/>` +
    `<circle cx="60" cy="40" r="5" fill="${LOV_LJUS}" opacity="0.6"/>`
  );
}
/** Gravsten – bågformad häll, mjuk & vänlig (inte läskig). */
function gravestone() {
  return obj(
    `<ellipse cx="50" cy="88" rx="26" ry="8" fill="${O}" opacity="0.16"/>` +
    `<rect x="24" y="82" width="52" height="8" rx="3" fill="${STEN_MORK}" ${LINE}/>` +
    `<path d="M30 84 V50 Q30 24 50 24 Q70 24 70 50 V84 Z" fill="${STEN}" ${LINE}/>` +
    `<path d="M38 84 V52 Q38 34 50 34 Q62 34 62 52 V84" fill="none" stroke="${STEN_LJUS}" stroke-width="3" opacity="0.7"/>` +
    `<path d="M42 58 h16 M50 52 v18" stroke="${STEN_MORK}" stroke-width="3.4" stroke-linecap="round"/>`
  );
}
/** Gammalt hus med varmt, glödande fönster (mysigt, inte spökhus). */
function house() {
  return obj(
    `<defs><radialGradient id="sp-win" cx="50%" cy="50%" r="60%">` +
    `<stop offset="0%" stop-color="${LYKTA_LJUS}"/>` +
    `<stop offset="100%" stop-color="${FONSTER}"/></radialGradient></defs>` +
    `<ellipse cx="50" cy="92" rx="30" ry="7" fill="${O}" opacity="0.16"/>` +
    // varmt sken ut i natten
    `<circle cx="50" cy="62" r="40" fill="${LYKTA_GLOD}" opacity="0.14"/>` +
    `<rect x="24" y="52" width="52" height="40" rx="4" fill="${TRA}" ${LINE}/>` +
    `<path d="M18 54 L50 26 L82 54 Z" fill="${TRA_LJUS}" ${LINE}/>` +
    // glödande fönster
    `<rect x="34" y="62" width="14" height="14" rx="2" fill="url(#sp-win)" ${LINE}/>` +
    `<rect x="52" y="62" width="14" height="14" rx="2" fill="url(#sp-win)" ${LINE}/>` +
    `<path d="M41 62 v14 M34 69 h14 M59 62 v14 M52 69 h14" stroke="${METALL}" stroke-width="2"/>`
  );
}
/** Lykta på stolpe – varmt sken som lyser upp gångvägen. */
function lantern() {
  return obj(
    `<defs><radialGradient id="sp-glow" cx="50%" cy="34%" r="55%">` +
    `<stop offset="0%" stop-color="${LYKTA_LJUS}" stop-opacity="0.95"/>` +
    `<stop offset="55%" stop-color="${LYKTA_GLOD}" stop-opacity="0.35"/>` +
    `<stop offset="100%" stop-color="${LYKTA_GLOD}" stop-opacity="0"/>` +
    `</radialGradient></defs>` +
    `<circle cx="50" cy="34" r="46" fill="url(#sp-glow)"/>` +
    `<ellipse cx="50" cy="92" rx="16" ry="5" fill="${O}" opacity="0.16"/>` +
    `<rect x="46" y="44" width="8" height="46" rx="3" fill="${METALL}" ${LINE}/>` +
    `<path d="M40 90 h20" stroke="${METALL}" stroke-width="5" stroke-linecap="round"/>` +
    // lykthus
    `<path d="M38 40 h24 l-3 -8 h-18 Z" fill="${METALL}" ${LINE}/>` +
    `<rect x="39" y="18" width="22" height="22" rx="3" fill="${LYKTA_GLOD}" ${LINE}/>` +
    `<rect x="43" y="22" width="14" height="14" rx="2" fill="${LYKTA_LJUS}"/>` +
    `<path d="M50 16 v-4" stroke="${METALL}" stroke-width="3" stroke-linecap="round"/>`
  );
}
/** Litet trästaket – hinder som ramar in gravgångar (bildar gångvägar). */
function fence() {
  return obj(
    `<ellipse cx="50" cy="86" rx="30" ry="6" fill="${O}" opacity="0.12"/>` +
    `<path d="M14 62 h72" stroke="${TRA}" stroke-width="7" stroke-linecap="round"/>` +
    `<path d="M14 74 h72" stroke="${TRA}" stroke-width="7" stroke-linecap="round"/>` +
    stake(24) + stake(50) + stake(76),
    "100%"
  );
}
function stake(x) {
  return (
    `<path d="M${x} 84 V52 l-6 -8 h12 Z" fill="${TRA_LJUS}" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>`
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
    `<path d="M24 46 Q12 40 14 30" fill="none" stroke="${GULD}" stroke-width="9" stroke-linecap="round" ${""}/>` +
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
  // Mysig månskensnatt: djup blå himmel → svalt blått marksken (void-rutor = natt).
  stamning: { himmel: "#232A4D", mark: "#39406B" },

  // Liten kyrkogård/by uppifrån, inramad av mörka träd. Legenden ger varje
  // hinder eget tecken (träd/gravsten/hus/lykta/staket) och två golv-tecken
  // (stig/gräs) + dim-rutor, så gångvägarna slingrar mellan hindren.
  // Validerad (test/adventure-grid.test.js-stil BFS): alla gångrutor
  // sammanhängande, 10 stationer + start + mål nåbara.
  map: [
    "tttttttttttttttt",
    "t.,?..,.l.,?.,.t",
    "t.g.,ff.h..g.,.t",
    "t?.,.g...,.,.?.t",
    "t.,.,.,.,g,.,.,t",
    "t.?.l.,.,.,?.,.t",
    "t,.,.g.ff..g.,.t",
    "t.,.?.,.t.,?.,.t",
    "t.,g.,.,.l.,g..t",
    "tS.?.,.,M.,.?..t",
    "tttttttttttttttt",
  ],
  legend: {
    " ": "void", // natt (ritas ej – bakgrunds-gradienten syns som mörk himmel)
    t: "wall", // träd (hinder)
    g: "wall", // gravsten (hinder)
    h: "wall", // gammalt hus (hinder)
    l: "wall", // lykta (hinder)
    f: "wall", // staket (hinder)
    ".": "floor", // kullerstensstig
    ",": "floor", // gräs (månsken)
    S: "start",
    "?": "station",
    M: "goal",
  },
  goal: 10, // 10 fångade spöken → slutspöket dyker upp

  progressIcon: "👻",
  stationArt: () => ghost(),
  goalArt: () => goldGhost(),
  tileArt: {
    // Gräsrutor (",") får ibland en dimslinga; stig (".") är kullersten.
    floor: (t) => (t.char === "," ? (((t.col + t.row) % 3 === 0) ? fogTile() : grassTile()) : pathTile()),
    start: () => pathTile(),
    station: (t) => (t.char === "," ? grassTile() : pathTile()),
    goal: () => pathTile(),
    wall: (t) =>
      t.char === "t" ? tree() :
      t.char === "g" ? gravestone() :
      t.char === "h" ? house() :
      t.char === "l" ? lantern() :
      fence(),
    void: () => "", // natt – låt scen-gradienten vara
  },

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

  questionKinds: ["quiz", "lasforstaelse", "para"],

  // Kort i områdesöversikten (drivs generiskt av gamemodes.js via detta fält).
  oversikt: {
    sub: "Fånga söta spöken i månskenet – en mysig spökjakt!",
    color: "lila",
  },
};
