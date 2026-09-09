// ============================================================================
// Pluggportalen – äventyrsmotorn: themes/skattjakten.js  (issue #221)
// ----------------------------------------------------------------------------
// TEMA (ren data + inline-SVG-strängar) ovanpå den tema-agnostiska motorn
// (engine.js). INGEN spellogik här: rörelse/kollision, frågor, progress, belöning
// (1–3★, grind-skalat mode "aventyr:skattjakten") ägs helt av motorn – se
// themes/README.md för motor↔tema-kontraktet.
//
// Skattjakten kör motorns OPT-IN scroll/bild-karta-läge (issue #220): en STOR
// illustrerad ö-karta (src/adventure/assets/skattjakten-karta.jpg, serverad som
// fil – inte inline) blir världen, kameran scrollar mjukt under en nära centrerad
// avatar (~1/3 av kartbredden syns, SKATTJAKT_VIEW_FRACTION – utzoomat efter
// användar-feedback). Banans geometri – världsmått, kollision, start, fråge-spawns
// och skattkist-platser – bor i themes/skattjakten-map.js (ren, testbar matte).
//
// Flöde: eleven anländer med båt vid bryggan nere-höger, utforskar ön (fastnar i
// hav/damm/å/klippor men går smidigt på gräs/sand/stigar), hittar 10 utspridda
// frågeobjekt (träskylt/frågelåda/kartpinne), svarar rätt → en bit av skattkartan
// (🗺️ x/10). Vid 10 rätt spawnar skattkistan på en kandidatplats med tydligt
// ljussken – eleven går dit och öppnar den → bana klar + belöning.
//
// Art följer stilguiden (src/art-style.js): mörk plommonkontur #3B3350, platta
// mjuka former, glad palett. Kortet i områdesöversikten drivs generiskt av
// `oversikt`-fältet (gamemodes.js).
// ============================================================================

import { O, LINE } from "../../art-style.js";
import {
  WORLD,
  MAP_IMAGE,
  START_AT,
  pickSpawns,
  pickChest,
  buildSkattjaktenCollision,
} from "./skattjakten-map.js";

// --- Kamera-utzoom (lätt att tuna) ------------------------------------------
// Andel av kartBREDDEN som syns åt gången. HÖJ → mer utzoomat (mer av ön syns),
// SÄNK → mer inzoomat på avataren. Tune-intervall som känns bra: 0.30–0.45.
// Historik: 1/6 (~0.17) var för tight inzoomat (användar-feedback) → 0.36.
const SKATTJAKT_VIEW_FRACTION = 0.36;

// --- Palett (tropisk, ur stilguiden) ----------------------------------------
const SAND_LJUS = "#FBEFCB";
const TRA = "#B0805A";
const TRA_MORK = "#8A6242";
const GULD = "#F7C948";
const GULD_MORK = "#E0A92E";
const PAPPER = "#F0E2BE";

/** Centrerad objekt-SVG (behåller proportioner). */
function obj(inner, size = "100%") {
  return (
    `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" ` +
    `style="width:${size};height:${size};display:block">${inner}</svg>`
  );
}

// --- Stationer: tre mysiga skattjakts-objekt (varieras per station) ----------
/** Träskylt med gåtan (?). */
function sign() {
  return obj(
    `<ellipse cx="50" cy="90" rx="20" ry="6" fill="${O}" opacity="0.14"/>` +
    `<rect x="45" y="52" width="10" height="40" rx="3" fill="${TRA_MORK}" ${LINE}/>` +
    `<rect x="18" y="26" width="64" height="34" rx="6" fill="${TRA}" ${LINE}/>` +
    `<path d="M28 34 h44 M28 52 h44" stroke="${TRA_MORK}" stroke-width="2.4" opacity="0.6"/>` +
    `<text x="50" y="52" text-anchor="middle" font-size="30" font-weight="900" ` +
    `font-family="system-ui,sans-serif" fill="${SAND_LJUS}" stroke="${O}" stroke-width="1.4">?</text>`
  );
}
/** Liten frågelåda (skattkista i miniatyr med ett ?). */
function box() {
  return obj(
    `<ellipse cx="50" cy="90" rx="24" ry="6" fill="${O}" opacity="0.14"/>` +
    `<rect x="24" y="52" width="52" height="34" rx="5" fill="${TRA}" ${LINE}/>` +
    `<path d="M24 54 Q24 36 50 36 Q76 36 76 54 Z" fill="${TRA_MORK}" ${LINE}/>` +
    `<rect x="24" y="54" width="52" height="7" fill="${GULD}" stroke="${O}" stroke-width="2"/>` +
    `<text x="50" y="80" text-anchor="middle" font-size="22" font-weight="900" ` +
    `font-family="system-ui,sans-serif" fill="${SAND_LJUS}" stroke="${O}" stroke-width="1.2">?</text>`
  );
}
/** Kartpinne: en hoprullad karta på en käpp. */
function mapPin() {
  return obj(
    `<ellipse cx="50" cy="90" rx="16" ry="5" fill="${O}" opacity="0.14"/>` +
    `<rect x="47" y="40" width="6" height="52" rx="3" fill="${TRA_MORK}" ${LINE}/>` +
    `<g transform="rotate(-12 50 36)">` +
    `<rect x="30" y="24" width="40" height="30" rx="4" fill="${PAPPER}" ${LINE}/>` +
    `<path d="M36 32 q8 6 16 0 t16 0" fill="none" stroke="${TRA_MORK}" stroke-width="2" opacity="0.6"/>` +
    `<path d="M40 42 l8 -5 l10 6" fill="none" stroke="${GULD_MORK}" stroke-width="2.4" stroke-linecap="round"/>` +
    `<text x="58" y="50" font-size="12" font-weight="900" fill="${GULD_MORK}">✕</text>` +
    `</g>`
  );
}
const STATION_ARTS = [sign, box, mapPin];
/** Motorn anropar stationArt() en gång per station → slumpa objekt för variation. */
function stationArt() {
  return STATION_ARTS[Math.floor(Math.random() * STATION_ARTS.length)]();
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
    strale(50, 8) + strale(14, 30) + strale(86, 30) + strale(20, 74) + strale(80, 74) +
    `<ellipse cx="50" cy="92" rx="30" ry="7" fill="${O}" opacity="0.14"/>` +
    `<rect x="24" y="58" width="52" height="30" rx="6" fill="${TRA}" ${LINE}/>` +
    `<path d="M24 60 Q24 40 50 40 Q76 40 76 60 Z" fill="${TRA_MORK}" ${LINE}/>` +
    `<rect x="24" y="60" width="52" height="7" fill="${GULD}" stroke="${O}" stroke-width="2.2"/>` +
    `<rect x="44" y="54" width="12" height="20" rx="2" fill="${GULD}" ${LINE}/>` +
    `<circle cx="50" cy="66" r="3.2" fill="${GULD_MORK}" ${LINE}/>` +
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

// ============================================================================
export const skattjaktenTheme = {
  id: "skattjakten",
  namn: "Skattjakten",
  // Havet runt ön (kamerans letterbox utanför bildkanten) hålls i samma blå ton.
  stamning: { himmel: "#79CFEC", mark: "#2F8FC4" },

  // Opt-in-flaggan: mapImage → motorn väljer scroll/bild-karta-läget (world.js).
  mapImage: MAP_IMAGE,
  worldSize: WORLD,
  // Andel av kartbredden som syns åt gången – tune:bar konstant högst upp.
  viewFraction: SKATTJAKT_VIEW_FRACTION,

  startAt: START_AT, // vid bryggan/båten nere-höger ("anländer med båt")
  // Fråge-spawns: 18 fasta kandidater, spelet väljer 10 (getter → nytt urval per
  // spelomgång). goal=10 → alla valda stationer måste klaras innan kistan spawnar.
  get stationsAt() {
    return pickSpawns(10);
  },
  // Skattkistan spawnar på EN av 2–4 kandidat-platser (getter → varierar per spel).
  get goalAt() {
    return pickChest();
  },
  goal: 10,

  // Grovt kollisionslager (grid = hav-mask + rects = damm/å/ruiner/klippor).
  collision: buildSkattjaktenCollision(),

  progressIcon: "🗺️",
  stationArt,
  goalArt: () => chest(),

  texter: {
    intro:
      "Du anländer med båt till Skattön! 🏝️ Utforska ön – gå på gräs, sand och " +
      "stigar (men akta dig för havet, dammen, ån och de stora klipporna – använd " +
      "bron!). Vid varje skylt 🪧 gömmer sig en gåta; svara rätt så får du en bit av " +
      "skattkartan (🗺️ 10 bitar). När kartan är hel dyker skattkistan upp – spring dit " +
      "och öppna den!",
    stationPrompt: "En gåta! Tryck E (eller mellanslag) för att svara.",
    stationTitle: "Skattgåta",
    goalPrompt: "Skattkistan glittrar! ✨ Tryck E för att öppna den och hämta belöningen.",
    klart: "Du hittade skatten på Skattön! 🏴‍☠️💰",
  },

  questionKinds: ["quiz", "lasforstaelse", "para"],

  // Kort i områdesöversikten (drivs generiskt av gamemodes.js).
  oversikt: {
    sub: "Anländ med båt, utforska ön och samla ihop skattkartan!",
    color: "orange",
  },
};
