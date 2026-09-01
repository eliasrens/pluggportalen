// ============================================================================
// Pluggportalen – ROBOTENS evolutionskonst (Pokémon-stil, inline SVG)
// ----------------------------------------------------------------------------
// Roboten utvecklas i 3 steg när eleven pluggar:
//   Steg 1: Robot      (grundfiguren – samma som tidigare)
//   Steg 2: Megarobot  (större, dubbla antenner, kraftigare kropp)
//   Steg 3: eleven VÄLJER gren – Kraftrobot / Taggrobot / Blixtrobot
//
// Samma stilguide och viewBox ("0 0 100 120") som art-characters.js, så
// klädsel-overlays och all layout fungerar oförändrat. Trösklarna för när
// stegen låses upp ligger i evolution.js – här finns bara KONSTEN.
//
// MALL FÖR FLER FIGURER: gör en fil art-characters-<figur>.js som exporterar
// grundkonsten + ett evolutionsobjekt med samma form som ROBOT_EVOLUTION
// (maxStage, branches, art(stage, branch)) och registrera det i EVOLUTIONS i
// art-characters.js. Klart – resten av sajten hänger med automatiskt.
// ============================================================================

import { LINE, THIN, eyes, cheeks, limb } from "./art-style.js";

// Robotens grundpalett (steg 1–2). Grenarna tonar om den lite.
const METAL = "#A9C2DE", DARK = "#7E97B8", ACCENT = "#F2A93B";

// --- Steg 1: Robot (grundfiguren, oförändrad från tidigare) -----------------

export function robotArt() {
  const metal = METAL, dark = DARK, accent = ACCENT;
  return (
    // antenn
    `<line x1="50" y1="14" x2="50" y2="6" ${LINE}/>` +
    `<circle cx="50" cy="4.5" r="3.5" fill="#EF6F6C" ${THIN}/>` +
    // larvfötter
    `<rect x="31" y="103" width="16" height="9" rx="4.5" fill="${dark}" ${LINE}/>` +
    `<rect x="53" y="103" width="16" height="9" rx="4.5" fill="${dark}" ${LINE}/>` +
    // kropp med panel + lampor
    `<rect x="33" y="60" width="34" height="44" rx="10" fill="${metal}" ${LINE}/>` +
    `<rect x="40" y="72" width="20" height="14" rx="4" fill="${dark}" stroke="none"/>` +
    `<circle cx="44" cy="93" r="2.6" fill="${accent}" stroke="none"/>` +
    `<circle cx="52" cy="93" r="2.6" fill="#EF6F6C" stroke="none"/>` +
    `<circle cx="60" cy="93" r="2.6" fill="#6FC66F" stroke="none"/>` +
    // armar
    limb("M35 66 Q28 72 28 80", metal, 7) +
    `<circle cx="28" cy="81" r="5" fill="${dark}" ${THIN}/>` +
    limb("M65 66 Q76 68 78 75", metal, 7) +
    `<circle cx="79" cy="77" r="5" fill="${dark}" ${THIN}/>` +
    // huvud med skruvöron
    `<rect x="24" y="30" width="5" height="12" rx="2.5" fill="${dark}" ${THIN}/>` +
    `<rect x="71" y="30" width="5" height="12" rx="2.5" fill="${dark}" ${THIN}/>` +
    `<rect x="27" y="15" width="46" height="42" rx="13" fill="${metal}" ${LINE}/>` +
    eyes() +
    `<path d="M43 46 Q50 51 57 46" fill="none" ${LINE}/>` +
    cheeks(44)
  );
}

// --- Steg 2: Megarobot (större och coolare) ---------------------------------

function robotArt2() {
  const metal = METAL, dark = DARK, accent = ACCENT;
  return (
    // dubbla antenner
    `<line x1="40" y1="13" x2="37" y2="4" ${LINE}/>` +
    `<circle cx="36.5" cy="3.5" r="3" fill="#EF6F6C" ${THIN}/>` +
    `<line x1="60" y1="13" x2="63" y2="4" ${LINE}/>` +
    `<circle cx="63.5" cy="3.5" r="3" fill="#6FC66F" ${THIN}/>` +
    // större larvfötter
    `<rect x="26" y="102" width="20" height="11" rx="5.5" fill="${dark}" ${LINE}/>` +
    `<rect x="54" y="102" width="20" height="11" rx="5.5" fill="${dark}" ${LINE}/>` +
    // bredare kropp
    `<rect x="29" y="58" width="42" height="48" rx="11" fill="${metal}" ${LINE}/>` +
    // bröstpanel med blixt
    `<rect x="37" y="68" width="26" height="17" rx="5" fill="${dark}" stroke="none"/>` +
    `<path d="M53 70 L45 78 L50 78 L47 83 L55 75 L50 75 Z" fill="${accent}" stroke="none"/>` +
    // lampor
    `<circle cx="42" cy="97" r="2.8" fill="${accent}" stroke="none"/>` +
    `<circle cx="50" cy="97" r="2.8" fill="#EF6F6C" stroke="none"/>` +
    `<circle cx="58" cy="97" r="2.8" fill="#6FC66F" stroke="none"/>` +
    // kraftiga armar + axelplattor
    limb("M32 64 Q23 72 23 82", metal, 8.5) +
    `<circle cx="23" cy="83" r="6" fill="${dark}" ${THIN}/>` +
    limb("M68 64 Q78 68 80 77", metal, 8.5) +
    `<circle cx="81" cy="79" r="6" fill="${dark}" ${THIN}/>` +
    `<rect x="25" y="55" width="14" height="8" rx="4" fill="${dark}" ${THIN}/>` +
    `<rect x="61" y="55" width="14" height="8" rx="4" fill="${dark}" ${THIN}/>` +
    // större huvud med skruvöron
    `<rect x="20" y="28" width="6" height="14" rx="3" fill="${dark}" ${THIN}/>` +
    `<rect x="74" y="28" width="6" height="14" rx="3" fill="${dark}" ${THIN}/>` +
    `<rect x="24" y="13" width="52" height="45" rx="14" fill="${metal}" ${LINE}/>` +
    eyes(34, 10, 6.5) +
    `<path d="M41 47 Q50 53 59 47" fill="none" ${LINE}/>` +
    cheeks(45, 16)
  );
}

// --- Steg 3: gemensam stomme (störst) + tre grenvarianter -------------------

/** Fötter + bred kropp + stort huvud – delas av alla steg 3-grenar. */
function robot3Frame(metal, dark) {
  return (
    // stora larvfötter med "hjul"
    `<rect x="22" y="101" width="24" height="12" rx="6" fill="${dark}" ${LINE}/>` +
    `<rect x="54" y="101" width="24" height="12" rx="6" fill="${dark}" ${LINE}/>` +
    `<circle cx="30" cy="107" r="2.2" fill="#fff" opacity="0.5" stroke="none"/>` +
    `<circle cx="70" cy="107" r="2.2" fill="#fff" opacity="0.5" stroke="none"/>` +
    // bred kropp
    `<rect x="26" y="57" width="48" height="48" rx="12" fill="${metal}" ${LINE}/>` +
    // stort huvud
    `<rect x="21" y="10" width="58" height="47" rx="15" fill="${metal}" ${LINE}/>`
  );
}

/** KRAFTROBOT – stor och superstark: jättenävar och glödande kraftkärna. */
function robot3Kraft() {
  const metal = "#9FB6D6", dark = "#6E87A8", accent = "#F2A93B";
  return (
    `<line x1="50" y1="10" x2="50" y2="3" ${LINE}/>` +
    `<circle cx="50" cy="1.8" r="3.2" fill="${accent}" ${THIN}/>` +
    // jättearmar med stora nävar (bakom kroppen)
    limb("M31 64 Q18 72 17 84", metal, 10) +
    `<circle cx="17" cy="86" r="8" fill="${dark}" ${LINE}/>` +
    limb("M69 64 Q82 72 83 84", metal, 10) +
    `<circle cx="83" cy="86" r="8" fill="${dark}" ${LINE}/>` +
    robot3Frame(metal, dark) +
    // axelplattor
    `<rect x="22" y="53" width="16" height="9" rx="4.5" fill="${dark}" ${THIN}/>` +
    `<rect x="62" y="53" width="16" height="9" rx="4.5" fill="${dark}" ${THIN}/>` +
    // glödande kraftkärna
    `<circle cx="50" cy="81" r="10" fill="${dark}" ${THIN}/>` +
    `<circle cx="50" cy="81" r="6" fill="${accent}" stroke="none"/>` +
    `<circle cx="48" cy="79" r="1.8" fill="#fff" opacity="0.8" stroke="none"/>` +
    eyes(33, 11, 7) +
    `<path d="M39 46 Q50 54 61 46" fill="none" ${LINE}/>` +
    cheeks(45, 18)
  );
}

/** TAGGROBOT – vass och bitig: taggar, sågtandsflin och klingor. */
function robot3Vass() {
  const metal = "#8FA6C4", dark = "#5E7694", blade = "#DDE6F2";
  return (
    // taggar på hjässan
    `<path d="M29 13 L34 2 L39 13 Z" fill="${dark}" ${THIN}/>` +
    `<path d="M44 12 L50 -1 L56 12 Z" fill="${dark}" ${THIN}/>` +
    `<path d="M61 13 L66 2 L71 13 Z" fill="${dark}" ${THIN}/>` +
    // armar med klingor (bakom kroppen)
    limb("M31 64 Q22 70 20 79", metal, 8) +
    `<path d="M24 74 L5 90 L25 90 Z" fill="${blade}" ${LINE}/>` +
    limb("M69 64 Q78 70 80 79", metal, 8) +
    `<path d="M76 74 L95 90 L75 90 Z" fill="${blade}" ${LINE}/>` +
    robot3Frame(metal, dark) +
    // taggiga axlar
    `<path d="M28 58 L18 50 L30 51 Z" fill="${dark}" ${THIN}/>` +
    `<path d="M72 58 L82 50 L70 51 Z" fill="${dark}" ${THIN}/>` +
    // varningspanel med ränder
    `<rect x="36" y="70" width="28" height="16" rx="5" fill="${dark}" stroke="none"/>` +
    `<path d="M40 84 L50 72 M48 85 L58 73" fill="none" stroke="${blade}" stroke-width="3" stroke-linecap="round"/>` +
    eyes(33, 11, 6.5) +
    // bitigt sågtandsflin
    `<path d="M38 45 L42 51 L46 45 L50 51 L54 45 L58 51 L62 45" fill="none" ${LINE}/>` +
    cheeks(38, 19)
  );
}

/** BLIXTROBOT – snabb som blixten: gyllene plåt, raketer och energi. */
function robot3Blixt() {
  const metal = "#F7C948", dark = "#E08A3C", spark = "#7FC7E8";
  return (
    // zickzack-antenn
    `<path d="M50 10 L46 5 L54 0" fill="none" ${LINE}/>` +
    // raketer på ryggen med lågor (bakom kroppen)
    `<rect x="12" y="62" width="12" height="26" rx="6" fill="${dark}" ${LINE}/>` +
    `<path d="M15 90 L18 99 L21 90 Z" fill="#EF6F6C" ${THIN}/>` +
    `<rect x="76" y="62" width="12" height="26" rx="6" fill="${dark}" ${LINE}/>` +
    `<path d="M79 90 L82 99 L85 90 Z" fill="#EF6F6C" ${THIN}/>` +
    // snabba armar
    limb("M31 64 Q24 72 25 82", metal, 8) +
    `<circle cx="25" cy="83" r="5.6" fill="${dark}" ${THIN}/>` +
    limb("M69 64 Q76 72 75 82", metal, 8) +
    `<circle cx="75" cy="83" r="5.6" fill="${dark}" ${THIN}/>` +
    robot3Frame(metal, dark) +
    // stor blixt på bröstet
    `<path d="M56 66 L42 82 L50 82 L45 96 L60 78 L52 78 Z" fill="${spark}" ${THIN}/>` +
    // fartränder på huvudets sidor
    `<path d="M26 30 L34 30 M26 37 L32 37" fill="none" stroke="${dark}" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M74 30 L66 30 M74 37 L68 37" fill="none" stroke="${dark}" stroke-width="3" stroke-linecap="round"/>` +
    eyes(33, 11, 6.5) +
    // stort glatt skratt
    `<path d="M40 45 Q50 55 60 45 Z" fill="#7C4A57" ${LINE}/>` +
    cheeks(41, 19)
  );
}

// --- Evolutionsdefinition (registreras i EVOLUTIONS i art-characters.js) ----

export const ROBOT_EVOLUTION = {
  maxStage: 3,
  /** Namn per steg (steg 3 heter som vald gren). */
  stageNames: { 1: "Robot", 2: "Megarobot" },
  /** Grenvarianterna eleven väljer mellan i sista steget. */
  branches: {
    kraft: {
      name: "Kraftrobot",
      desc: "Stor och superstark – lyfter en hel skolbänk med en näve!",
      art: robot3Kraft,
    },
    vass: {
      name: "Taggrobot",
      desc: "Vass och bitig – taggar, klingor och ett sågtandsflin!",
      art: robot3Vass,
    },
    blixt: {
      name: "Blixtrobot",
      desc: "Snabb som blixten – raketer på ryggen och energi i kroppen!",
      art: robot3Blixt,
    },
  },
  /**
   * SVG-innehåll + namn för ett steg. Returnerar null för steg 1 (grundkonsten
   * i CHARACTERS används då). Steg 3 utan vald gren visar steg 2-utseendet
   * tills eleven gjort sitt val.
   */
  art(stage, branch) {
    if (stage >= 3 && this.branches[branch]) {
      const b = this.branches[branch];
      return { art: b.art(), name: b.name };
    }
    if (stage >= 2) return { art: robotArt2(), name: this.stageNames[2] };
    return null;
  },
};
