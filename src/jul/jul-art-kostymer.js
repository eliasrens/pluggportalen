// ============================================================================
// Pluggporten – Jul-kostymernas konst (#911, epic #906, DEL E.1)
// ----------------------------------------------------------------------------
// Samma format och konvention som Halloween-kostymerna (hw-art-kostymer.js) och
// WEARABLES: varje plagg ritas TAJT i sin viewBox och placeras av CSS-slot-
// boxarna (.af-wear.af-<slot> i styles/08-avatar-klader.css), som träffar det
// gemensamma ankargriddet – därför sitter kostymerna rätt på alla avatarer.
// `par` som i slot-modulerna: hattar xMidYMax, ansikte xMidYMid (ögonlinjen),
// hals/rygg xMidYMin, hand xMidYMax.
//
// Luciakronans ljus har en LUGN låga: stilla, med ett mjukt sken bakom – ingen
// animation, ingen eld som fladdrar (DEL E.1).
// Registreras lazy av jul-konst.js (registerWearables) – aldrig i bootgrafen.
// Id:na måste matcha jul-kostymer.js exakt (sparas i Firestore).
// ============================================================================

import {
  LINE, THIN, limb, glitter, JULROD, JULROD_MORK, GRAN, GRAN_LJUS, GULD, GULD_MORK, SKEN,
  SNOVIT, SNOSKUGGA, IS, IS_MORK, WOOD, paket,
} from "./jul-art-delar.js";

const MORK = "#2F2B3A";
const ROSA = "#F890B7";
const SACK = "#B98A5E";
const SACK_MORK = "#8F6640";

/** Spegla x-koordinaterna i en viewBox med bredden w (symmetriska plagg). */
const spegel = (d, w) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${+(w - x).toFixed(1)} ${y}`);

/** Liten snöflinga (sex ekrar) i (x,y) med radien r. */
function snoflinga(x, y, r, farg, w = 1.4) {
  let d = "";
  for (let i = 0; i < 3; i++) {
    const v = (i * Math.PI) / 3;
    const dx = +(r * Math.cos(v)).toFixed(1), dy = +(r * Math.sin(v)).toFixed(1);
    d += `M${+(x - dx).toFixed(1)} ${+(y - dy).toFixed(1)} L${+(x + dx).toFixed(1)} ${+(y + dy).toFixed(1)} `;
  }
  return `<path d="${d.trim()}" fill="none" stroke="${farg}" stroke-width="${w}" stroke-linecap="round"/>`;
}

/** Ett ljus i kronan: stilla låga + mjukt sken bakom (ingen animation). */
function kronljus(x, botten, h) {
  const topp = botten - h;
  return (
    `<circle cx="${x}" cy="${topp - 6}" r="7.5" fill="${SKEN}" opacity="0.5"/>` +
    `<rect x="${x - 3}" y="${topp}" width="6" height="${h}" rx="1.8" fill="#fff" ${THIN}/>` +
    `<path d="M${x} ${topp - 13} Q${x + 5} ${topp - 6} ${x + 3.2} ${topp - 2.4} Q${x} ${topp + 0.6} ${x - 3.2} ${topp - 2.4} ` +
    `Q${x - 5} ${topp - 6} ${x} ${topp - 13} Z" fill="${GULD}" ${THIN}/>` +
    `<ellipse cx="${x}" cy="${topp - 5}" rx="1.5" ry="2.8" fill="#fff" opacity="0.9"/>`
  );
}

const HORN_V = "M15 27 Q10 17 12 5 M12.5 15 Q6 13 4 7 M12 9 Q16 5 20 6";
const VINGE_V = "M50 42 Q38 8 12 6 Q4 8 6 15 Q1 19 5 25 Q1 31 8 35 Q6 41 15 43 Q16 49 26 49 Q38 51 50 52 Z";
const VINGE_V_FJADER = "M44 44 Q30 30 9 15 M44 46 Q28 38 8 26 M45 48 Q30 44 15 39";
const SKAGG = "M4 6 Q2 20 12 27 Q20 32 30 31 Q40 32 48 27 Q58 20 56 6 Q50 13 42 13 Q36 19 30 18 Q24 19 18 13 Q10 13 4 6 Z";

/** id → { viewBox, par, art[, anchor] } – samma form som WEARABLES. */
export const JUL_KOSTYMER = {
  // --- hatt --------------------------------------------------------------
  "jul-tomteluva": {
    viewBox: "0 0 60 50",
    par: "xMidYMax",
    art:
      `<path d="M9 40 Q12 13 36 8 Q51 6 53 22 L47 23 Q45 17 40 18 Q46 27 51 40 Z" fill="${JULROD}" ${LINE}/>` +
      `<path d="M20 22 Q28 15 37 14" fill="none" stroke="${JULROD_MORK}" stroke-width="2" stroke-linecap="round"/>` +
      `<rect x="4" y="36" width="52" height="11" rx="5.5" fill="${SNOVIT}" ${LINE}/>` +
      `<path d="M12 41 L12 42 M22 40.5 L22 41.5 M32 41 L32 42 M42 40.5 L42 41.5" stroke="${SNOSKUGGA}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<circle cx="50" cy="27" r="5.2" fill="${GULD}" ${LINE}/>` +
      `<path d="M47.6 28.4 Q50 30 52.4 28.4" fill="none" stroke="${GULD_MORK}" stroke-width="1.6" stroke-linecap="round"/>` +
      `<circle cx="50" cy="29.6" r="1" fill="${MORK}" stroke="none"/>`,
  },
  "jul-renhorn": {
    viewBox: "0 0 60 30",
    par: "xMidYMax",
    art:
      `<path d="M7 28 Q30 18 53 28" fill="none" stroke="${JULROD_MORK}" stroke-width="4" stroke-linecap="round"/>` +
      limb(HORN_V, WOOD, 3.6) +
      limb(spegel(HORN_V, 60), WOOD, 3.6) +
      `<path d="M20 23 Q26 25 30 22.5 Q34 25 40 23" fill="none" stroke="${GRAN}" stroke-width="3" stroke-linecap="round"/>` +
      `<circle cx="30" cy="22.5" r="2.6" fill="${JULROD}" ${THIN}/>` +
      `<circle cx="24.5" cy="24" r="1.5" fill="${JULROD}" stroke="none"/>` +
      `<circle cx="35.5" cy="24" r="1.5" fill="${JULROD}" stroke="none"/>`,
  },
  "jul-oronmuffar": {
    viewBox: "0 0 60 32",
    par: "xMidYMax",
    art:
      `<path d="M8 22 Q8 2 30 2 Q52 2 52 22" fill="none" stroke="${MORK}" stroke-width="5.4" stroke-linecap="round"/>` +
      `<path d="M8 22 Q8 2 30 2 Q52 2 52 22" fill="none" stroke="${JULROD}" stroke-width="3" stroke-linecap="round"/>` +
      `<circle cx="8.5" cy="23" r="7.6" fill="${SNOVIT}" ${LINE}/>` +
      `<circle cx="51.5" cy="23" r="7.6" fill="${SNOVIT}" ${LINE}/>` +
      `<circle cx="8.5" cy="23" r="4" fill="${JULROD}" stroke="none"/>` +
      `<circle cx="51.5" cy="23" r="4" fill="${JULROD}" stroke="none"/>` +
      snoflinga(8.5, 23, 2.4, "#fff", 1.1) + snoflinga(51.5, 23, 2.4, "#fff", 1.1),
  },
  "jul-luciakrona": {
    viewBox: "0 0 60 46",
    par: "xMidYMax",
    art:
      kronljus(9, 40, 9) + kronljus(51, 40, 9) + kronljus(19.5, 38, 12) + kronljus(40.5, 38, 12) + kronljus(30, 37, 15) +
      `<ellipse cx="30" cy="41" rx="27" ry="5" fill="${GRAN}" ${LINE}/>` +
      `<path d="M7 40 q3 -4 7 -1 M16 43 q3 -4 7 -1 M26 40 q3 -4 7 -1 M36 43 q3 -4 7 -1 M45 40 q3 -4 7 -1" fill="none" stroke="${GRAN_LJUS}" stroke-width="2.2" stroke-linecap="round"/>` +
      `<circle cx="13" cy="43" r="1.6" fill="${JULROD}" stroke="none"/>` +
      `<circle cx="25" cy="44" r="1.6" fill="${JULROD}" stroke="none"/>` +
      `<circle cx="35" cy="43.5" r="1.6" fill="${JULROD}" stroke="none"/>` +
      `<circle cx="47" cy="43" r="1.6" fill="${JULROD}" stroke="none"/>`,
  },
  // --- ansikte (ögonen ≈ x19/x41, y12 i viewBoxen) -----------------------
  "jul-rosiga-kinder": {
    viewBox: "0 0 60 26",
    par: "xMidYMid",
    art:
      `<ellipse cx="7" cy="21" rx="5.6" ry="3.6" fill="${ROSA}" opacity="0.85"/>` +
      `<ellipse cx="53" cy="21" rx="5.6" ry="3.6" fill="${ROSA}" opacity="0.85"/>` +
      snoflinga(53, 20.5, 3.4, "#fff", 1.5) +
      `<circle cx="53" cy="20.5" r="1" fill="${IS}" stroke="none"/>` +
      glitter(4, 16.5, 1.6) + glitter(10, 24.5, 1.2),
  },
  // Skägget hänger från munnen ner över hakan: egen, större box (anchor "skagg",
  // styles/34-kostymer.css) – mustaschens "mun"-box är för liten för ett tomteskägg.
  "jul-tomteskagg": {
    viewBox: "0 0 60 34",
    par: "xMidYMid",
    anchor: "skagg",
    art:
      `<path d="${SKAGG}" fill="${SNOVIT}" ${LINE}/>` +
      `<path d="M16 21 Q20 26 24 22 M27 26 Q30 29 33 26 M36 22 Q40 26 44 21" fill="none" stroke="${SNOSKUGGA}" stroke-width="1.8" stroke-linecap="round"/>` +
      `<path d="M30 8 Q22 3 14 7 Q9 10 11 14 Q20 15 30 11 Q40 15 49 14 Q51 10 46 7 Q38 3 30 8 Z" fill="#fff" ${THIN}/>`,
  },
  // --- hals ----------------------------------------------------------------
  "jul-stickad-halsduk": {
    viewBox: "0 0 48 42",
    par: "xMidYMin",
    art:
      `<path d="M5 4 Q24 14 43 4 Q46 10 43 14 Q24 24 5 14 Q2 10 5 4 Z" fill="${GRAN}" ${LINE}/>` +
      `<path d="M27 16 L38 16 Q40 28 36 37 L28 37 Q25 26 27 16 Z" fill="${GRAN}" ${LINE}/>` +
      `<path d="M9 9 Q24 17 39 9" fill="none" stroke="${JULROD}" stroke-width="2.6" stroke-linecap="round"/>` +
      `<path d="M27.2 22 L38.4 22 M27.6 30 L37.8 30" fill="none" stroke="${JULROD}" stroke-width="2.6" stroke-linecap="round"/>` +
      `<path d="M14 12 l1.5 1.5 l1.5 -1.5 M22 14 l1.5 1.5 l1.5 -1.5 M30 13.5 l1.5 1.5 l1.5 -1.5" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>` +
      `<path d="M30 26 l1.5 1.5 l1.5 -1.5 l1.5 1.5" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>` +
      `<path d="M29 37 L29 41 M32.5 37 L32.5 41 M36 37 L36 41" fill="none" stroke="${JULROD}" stroke-width="2.4" stroke-linecap="round"/>`,
  },
  // --- hand (handtaget ≈ y52 i viewBoxen) ----------------------------------
  "jul-paket": {
    viewBox: "0 0 40 62",
    par: "xMidYMax",
    art: paket(5, 58, 30, 26, JULROD, GULD) + `<path d="M5 44 L35 44" stroke="${GULD}" stroke-width="3"/>`,
  },
  "jul-polkagrisstav": {
    viewBox: "0 0 44 62",
    par: "xMidYMax",
    art:
      limb("M20 58 L20 18 Q20 7 29 7 Q37 7 37 16", "#fff", 6) +
      `<path d="M20 58 L20 18 Q20 7 29 7 Q37 7 37 16" fill="none" stroke="${JULROD}" stroke-width="6" stroke-dasharray="3.4 4.2"/>` +
      `<path d="M18.4 50 L18.4 22" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>`,
  },
  // --- rygg: ritas BAKOM figuren (avatarMarkup) ----------------------------
  // Säcken hänger bakom vänster axel (betraktarens) och sticker upp bredvid
  // huvudet: egen, högre box (anchor "sack", styles/34-kostymer.css).
  "jul-tomtesack": {
    viewBox: "0 0 52 44",
    par: "xMidYMin",
    anchor: "sack",
    art:
      paket(6, 17, 10, 8, GRAN, GULD) +
      `<path d="M2 10 Q11 5 21 9 Q26 24 22 38 Q12 44 2 39 Q-2 24 2 10 Z" fill="${SACK}" ${LINE}/>` +
      `<path d="M4 11 Q12 13 19 10" fill="none" stroke="${JULROD}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M7 20 Q9 28 8 35 M15 19 Q18 27 16 35" fill="none" stroke="${SACK_MORK}" stroke-width="1.8" stroke-linecap="round"/>` +
      `<path d="M7 27 q3 -3 6 0 q-3 3 -6 0 Z" fill="${JULROD}" stroke="none"/>` +
      `<path d="M21 12 Q34 13 44 22" fill="none" stroke="${SACK_MORK}" stroke-width="2.8" stroke-linecap="round"/>`,
  },
  // Vingarna behöver bred box: anchor "vingar" (styles/34-kostymer.css), som fladdermusvingarna.
  "jul-snoangelvingar": {
    viewBox: "0 0 100 60",
    par: "xMidYMin",
    anchor: "vingar",
    art:
      `<path d="${VINGE_V}" fill="${SNOVIT}" ${LINE}/>` +
      `<path d="${spegel(VINGE_V, 100)}" fill="${SNOVIT}" ${LINE}/>` +
      `<path d="${VINGE_V_FJADER} ${spegel(VINGE_V_FJADER, 100)}" fill="none" stroke="${IS_MORK}" stroke-width="1.6" stroke-linecap="round"/>` +
      snoflinga(16, 22, 3.2, IS_MORK) + snoflinga(84, 22, 3.2, IS_MORK) +
      glitter(25, 12, 2.2, IS) + glitter(75, 12, 2.2, IS) + glitter(10, 34, 1.6, IS) + glitter(90, 34, 1.6, IS),
  },
};
