// ============================================================================
// Pluggportalen – äventyrsmotorn: themes/skattjakten.js
// ----------------------------------------------------------------------------
// TEMA (ren data + inline-SVG) ovanpå den tema-agnostiska motorn (engine.js).
// INGEN spellogik här: rörelse/kollision, frågor, progress, belöning (1–3★,
// grind-skalat mode "aventyr:skattjakten") ägs helt av motorn – se
// themes/README.md för motor↔tema-kontraktet. Den här filen levererar bara
// kartan, grafiken, färgerna och texterna för en mysig tropisk skattjakt.
//
// Skattjakten: en liten ö uppifrån (sand, gräs, palmer, stenar, strandvatten).
// Objekten (?) är träskyltar där man hittar en frågeställning; rätt svar ger en
// bit av skattkartan (progress 🗺️ x/10). Vid 10 rätt spawnar motorn slutmålet –
// här en skattkista med ljussken – som eleven går till för att avsluta + belönas.
//
// Art följer stilguiden (src/art-style.js): mörk plommonkontur #3B3350, platta
// mjuka former, glad palett. Kortet i områdesöversikten drivs generiskt av
// `oversikt`-fältet (gamemodes.js) så Spökjakten/Gruvan bara lägger till en rad.
// ============================================================================

import { O, LINE } from "../../art-style.js";

// --- Palett (tropisk, ur stilguiden) ----------------------------------------
const SAND = "#F3DFAE";
const SAND_LJUS = "#FBEFCB";
const SAND_MORK = "#E4C88A";
const GRAS = "#7FC77A";
const GRAS_MORK = "#5FB268";
const VATTEN = "#8FD6EF";
const VATTEN_LJUS = "#C4ECF8";
const TRA = "#B0805A";
const TRA_MORK = "#8A6242";
const STEN = "#AEB4BE";
const STEN_LJUS = "#CDD2DA";
const GULD = "#F7C948";
const GULD_MORK = "#E0A92E";
const LOV = "#6FC66F";
const LOV_MORK = "#4FA85B";

/** Full-bleed tile-SVG (sträcks ut över hela rutan – bra för mark/vatten). */
function fill(inner) {
  return (
    `<svg viewBox="0 0 100 100" preserveAspectRatio="none" ` +
    `style="width:100%;height:100%;display:block">${inner}</svg>`
  );
}
/** Centrerad objekt-SVG (behåller proportioner – bra för palm/sten/skylt). */
function obj(inner, size = "100%") {
  return (
    `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" ` +
    `style="width:${size};height:${size};display:block">${inner}</svg>`
  );
}

// --- Marktexturer -----------------------------------------------------------
function sandTile() {
  return fill(
    `<rect x="0" y="0" width="100" height="100" fill="${SAND}"/>` +
    `<circle cx="24" cy="30" r="4.5" fill="${SAND_LJUS}"/>` +
    `<circle cx="70" cy="22" r="3.5" fill="${SAND_MORK}" opacity="0.7"/>` +
    `<circle cx="58" cy="66" r="5" fill="${SAND_LJUS}"/>` +
    `<circle cx="34" cy="78" r="3" fill="${SAND_MORK}" opacity="0.6"/>`
  );
}
function grassTile() {
  return fill(
    `<rect x="0" y="0" width="100" height="100" fill="${SAND}"/>` +
    `<path d="M0 34 Q28 20 52 32 Q78 44 100 30 L100 100 L0 100 Z" fill="${GRAS}"/>` +
    `<path d="M16 60 l4 -12 M30 74 l3 -12 M52 66 l4 -13 M72 76 l3 -12 M86 58 l4 -12" ` +
    `stroke="${GRAS_MORK}" stroke-width="4" stroke-linecap="round" fill="none"/>`
  );
}
function waterTile() {
  return fill(
    `<rect x="0" y="0" width="100" height="100" fill="${VATTEN}"/>` +
    `<path d="M-4 34 Q18 24 40 34 T84 34 T128 34" fill="none" ` +
    `stroke="${VATTEN_LJUS}" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M-4 66 Q18 56 40 66 T84 66 T128 66" fill="none" ` +
    `stroke="${VATTEN_LJUS}" stroke-width="5" stroke-linecap="round"/>`
  );
}
function bridgeTile() {
  return fill(
    `<rect x="0" y="0" width="100" height="100" fill="${VATTEN}"/>` +
    `<rect x="6" y="20" width="88" height="60" rx="8" fill="${TRA}" ` +
    `stroke="${O}" stroke-width="4"/>` +
    `<path d="M22 20 V80 M44 20 V80 M66 20 V80" stroke="${TRA_MORK}" stroke-width="4"/>`
  );
}

// --- Objekt (hinder + slutmål) ----------------------------------------------
function palm() {
  return obj(
    `<ellipse cx="50" cy="90" rx="30" ry="9" fill="${SAND_MORK}"/>` +
    // stam (kontur + fyllning, som limb() i stilguiden)
    `<path d="M50 88 Q44 62 56 40" fill="none" stroke="${O}" stroke-width="13" stroke-linecap="round"/>` +
    `<path d="M50 88 Q44 62 56 40" fill="none" stroke="${TRA}" stroke-width="8" stroke-linecap="round"/>` +
    `<path d="M50 66 h10 M49 78 h10" stroke="${TRA_MORK}" stroke-width="3" stroke-linecap="round"/>` +
    // kokosnötter
    `<circle cx="50" cy="40" r="4.5" fill="${TRA_MORK}" ${LINE}/>` +
    `<circle cx="61" cy="42" r="4.5" fill="${TRA_MORK}" ${LINE}/>` +
    // kronblad
    palmFrond("M56 40 Q34 26 16 34 Q36 34 56 44") +
    palmFrond("M56 40 Q78 26 92 40 Q72 36 56 46") +
    palmFrond("M56 40 Q40 18 30 8 Q46 22 58 40") +
    palmFrond("M56 40 Q72 20 84 12 Q68 24 58 42")
  );
}
function palmFrond(d) {
  return (
    `<path d="${d}" fill="${LOV}" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${LOV_MORK}" stroke-width="1.6" opacity="0.7"/>`
  );
}
function rock() {
  return obj(
    `<ellipse cx="50" cy="84" rx="30" ry="8" fill="${SAND_MORK}"/>` +
    `<path d="M20 78 Q14 52 38 48 Q52 30 70 46 Q90 52 82 78 Z" fill="${STEN}" ${LINE}/>` +
    `<path d="M34 62 Q46 50 60 60" fill="none" stroke="${STEN_LJUS}" stroke-width="5" stroke-linecap="round"/>` +
    `<circle cx="40" cy="70" r="3" fill="${STEN_LJUS}"/>`
  );
}

/** Skattkistan (slutmål) med ett mjukt ljussken bakom – "skatten hittad". */
function chest() {
  return obj(
    `<defs><radialGradient id="sk-glow" cx="50%" cy="46%" r="55%">` +
    `<stop offset="0%" stop-color="#FFF6C8" stop-opacity="0.95"/>` +
    `<stop offset="55%" stop-color="${GULD}" stop-opacity="0.35"/>` +
    `<stop offset="100%" stop-color="${GULD}" stop-opacity="0"/>` +
    `</radialGradient></defs>` +
    `<circle cx="50" cy="52" r="48" fill="url(#sk-glow)"/>` +
    // ljusstrålar
    strale(50, 8) + strale(14, 30) + strale(86, 30) + strale(20, 74) + strale(80, 74) +
    `<ellipse cx="50" cy="92" rx="30" ry="7" fill="${O}" opacity="0.14"/>` +
    // kista: botten + lock
    `<rect x="24" y="58" width="52" height="30" rx="6" fill="${TRA}" ${LINE}/>` +
    `<path d="M24 60 Q24 40 50 40 Q76 40 76 60 Z" fill="${TRA_MORK}" ${LINE}/>` +
    // guldband + lås
    `<rect x="24" y="60" width="52" height="7" fill="${GULD}" stroke="${O}" stroke-width="2.2"/>` +
    `<rect x="44" y="54" width="12" height="20" rx="2" fill="${GULD}" ${LINE}/>` +
    `<circle cx="50" cy="66" r="3.2" fill="${GULD_MORK}" ${LINE}/>` +
    // glittrar
    gnista(30, 30) + gnista(72, 24) + gnista(64, 46)
  );
}
function strale(x, y) {
  return `<path d="M50 52 L${x} ${y}" stroke="${GULD}" stroke-width="3" stroke-linecap="round" opacity="0.5"/>`;
}
function gnista(x, y) {
  return (
    `<path d="M${x} ${y - 5} L${x + 1.4} ${y - 1.4} L${x + 5} ${y} L${x + 1.4} ${y + 1.4} ` +
    `L${x} ${y + 5} L${x - 1.4} ${y + 1.4} L${x - 5} ${y} L${x - 1.4} ${y - 1.4} Z" fill="#FFF6C8"/>`
  );
}

/** Träskylt (station) – en frågeplats där en bit av skattkartan gömmer sig. */
function sign() {
  return obj(
    `<ellipse cx="50" cy="90" rx="20" ry="6" fill="${O}" opacity="0.14"/>` +
    `<rect x="45" y="52" width="10" height="40" rx="3" fill="${TRA_MORK}" ${LINE}/>` +
    `<rect x="18" y="26" width="64" height="34" rx="6" fill="${TRA}" ${LINE}/>` +
    `<path d="M28 34 h44 M28 52 h44" stroke="${TRA_MORK}" stroke-width="2.4" opacity="0.6"/>` +
    `<text x="50" y="52" text-anchor="middle" font-size="30" font-weight="900" ` +
    `font-family="system-ui,sans-serif" fill="${SAND_LJUS}" stroke="${O}" stroke-width="1.4">?</text>`,
    "1.9em"
  );
}

// ============================================================================
export const skattjaktenTheme = {
  id: "skattjakten",
  namn: "Skattjakten",
  // Bakgrund = havet runt ön (void-rutorna visar denna gradient som öppet vatten).
  stamning: { himmel: "#79CFEC", mark: "#3E9FD1" },

  // Ö uppifrån. Legend nedan ger vatten/palm/sten egna tecken (alla = hinder) och
  // sand/gräs/bro egna golv-tecken, så tileArt kan rita rätt grafik per ruta.
  // Validerad: alla 94 gångrutor sammanhängande, 10 stationer, start+mål nåbara.
  map: [
    "    ~~~~~~~~    ",
    "  ~~.,?,,.?.~~  ",
    " ~..?..,,..?..~ ",
    " ~.,..oo...,.,~ ",
    " ~..,..,,..,..~ ",
    " ~?..,.PP.,..?~ ",
    " ~..,...M..,..~ ",
    " ~?..,.oo.,..?~ ",
    " ~..?..,,..?..~ ",
    "  ~~..S...,.~~  ",
    "    ~~~~~~~~    ",
  ],
  legend: {
    " ": "void", // öppet hav (ritas ej – bakgrunds-gradienten syns)
    "~": "wall", // strandvatten (hinder)
    P: "wall", // palm (hinder)
    o: "wall", // sten (hinder)
    ".": "floor", // sand
    ",": "floor", // gräs
    "=": "floor", // brygga
    S: "start",
    "?": "station",
    M: "goal",
  },
  goal: 10, // 10 rätt → skattkartan komplett → kistan spawnar

  progressIcon: "🗺️",
  stationArt: () => sign(),
  goalArt: () => chest(),
  tileArt: {
    floor: (t) => (t.char === "," ? grassTile() : t.char === "=" ? bridgeTile() : sandTile()),
    start: () => sandTile(),
    station: (t) => (t.char === "," ? grassTile() : sandTile()),
    goal: () => sandTile(),
    wall: (t) => (t.char === "P" ? palm() : t.char === "o" ? rock() : waterTile()),
    void: () => "", // öppet hav – låt scen-gradienten vara
  },

  texter: {
    intro:
      "Välkommen till Skattön! 🏝️ Utforska ön och gå fram till varje träskylt 🪧. " +
      "Svara rätt så får du en bit av skattkartan (🗺️ 10 bitar). När kartan är hel " +
      "dyker skattkistan upp – gå dit och öppna den!",
    stationPrompt: "En träskylt med en gåta! Tryck E (eller mellanslag) för att svara.",
    stationTitle: "Skattgåta",
    goalPrompt: "Skattkistan glittrar! ✨ Tryck E för att öppna den och hämta belöningen.",
    klart: "Du hittade skatten på Skattön! 🏴‍☠️💰",
  },

  questionKinds: ["quiz", "lasforstaelse", "para"],

  // Kort i områdesöversikten (drivs generiskt av gamemodes.js). Ett nytt tema som
  // vill synas som kort lägger bara till detta fält – ingen ändring i gamemodes.js.
  oversikt: {
    sub: "Utforska ön och samla ihop skattkartan!",
    color: "orange",
  },
};
