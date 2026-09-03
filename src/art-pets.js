// ============================================================================
// Pluggportalen – husdjurskonst (inline SVG för shopens "husdjur"-saker)
// ----------------------------------------------------------------------------
// Följer stilguiden i art-style.js och återanvänder de delade byggdelarna.
// Kvar här är bara det NYA kläckbara husdjuret: mystery-egg + värmelampa
// (de gamla placerbara djuren är borttagna, se shop-items.js).
// Id:na måste matcha shop-items.js exakt (sparas i Firestore).
// ============================================================================

import { LINE, limb } from "./art-style.js";

// --- Mystery egg + värmelampa (kläckbara husdjuret, se pages-pet.js) --------

function mysteryEgg() {
  const shell = "#EADFF7", spot = "#B79BE0", star = "#F7C948";
  return (
    `<ellipse cx="50" cy="90" rx="27" ry="6" fill="#B0805A" opacity="0.25" stroke="none"/>` +
    `<path d="M50 12 C31 12 25 46 25 63 A25 25 0 0 0 75 63 C75 46 69 12 50 12 Z" fill="${shell}" ${LINE}/>` +
    `<ellipse cx="40" cy="30" rx="6" ry="9" fill="#FFFFFF" opacity="0.7" stroke="none"/>` +
    `<circle cx="60" cy="40" r="5" fill="${spot}" stroke="none"/>` +
    `<circle cx="38" cy="56" r="4" fill="${spot}" stroke="none"/>` +
    `<circle cx="58" cy="70" r="3.2" fill="${spot}" stroke="none"/>` +
    `<path d="M47 47 L48.6 51 L53 51.4 L49.8 54.2 L50.8 58.4 L47 56.2 L43.2 58.4 L44.2 54.2 L41 51.4 L45.4 51 Z" fill="${star}" stroke="none"/>` +
    `<path d="M84 22 L84 32 M79 27 L89 27" fill="none" stroke="${star}" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M15 46 L15 54 M11 50 L19 50" fill="none" stroke="${star}" stroke-width="2.6" stroke-linecap="round"/>`
  );
}

function heatLamp() {
  const metal = "#A8BAD1", shade = "#EF6F6C", glow = "#F7C948";
  return (
    `<path d="M46 62 Q40 74 44 86" fill="none" stroke="${glow}" stroke-width="3" stroke-linecap="round" opacity="0.8"/>` +
    `<path d="M58 62 Q64 74 60 86" fill="none" stroke="${glow}" stroke-width="3" stroke-linecap="round" opacity="0.8"/>` +
    `<path d="M52 64 Q52 76 52 88" fill="none" stroke="${glow}" stroke-width="3" stroke-linecap="round" opacity="0.8"/>` +
    `<ellipse cx="22" cy="92" rx="14" ry="5" fill="${metal}" ${LINE}/>` +
    limb("M22 90 L22 26 Q22 14 36 14 L52 14", metal, 5) +
    `<path d="M36 8 Q52 4 68 8 L62 34 Q52 40 42 34 Z" fill="${shade}" ${LINE}/>` +
    `<path d="M42 34 Q52 40 62 34 Q60 44 52 44 Q44 44 42 34 Z" fill="#FDE9A8" ${LINE}/>` +
    `<circle cx="52" cy="36" r="4" fill="${glow}" stroke="none"/>`
  );
}

/** id → { viewBox, art } */
export const PETS = {
  // Kläckbara husdjuret (varelserna själva ligger i art-pets-creatures.js).
  "mystery-egg": { viewBox: "0 0 100 100", art: mysteryEgg() },
  varmelampa: { viewBox: "0 0 100 100", art: heatLamp() },
};

/** Fristående <svg> för ägget (används på husdjurssidan). */
export function eggSvg() {
  return (
    `<svg viewBox="0 0 100 100" role="img" aria-label="Mystiskt ägg" ` +
    `preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${PETS["mystery-egg"].art}</svg>`
  );
}
