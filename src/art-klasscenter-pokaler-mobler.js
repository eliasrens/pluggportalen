// ============================================================================
// Pluggporten – Klasscentrets pokalmöbler: pokalhyllan (där pokalerna
// auto-placeras), statistiktavlan (#496, epic #474 Klasscentret 3/4) och
// Troféhyllan = hedershyllan (#528, köps i shoppen).
// ----------------------------------------------------------------------------
// Register-format: se index-modulen art-klasscenter-pokaler.js. Möblerna ritas
// TOMMA – pokalerna (hyllan) och siffrorna (tavlan, sub-issue E) läggs ovanpå
// i platserna nedan, angivna i möbelns egna viewBox-koordinater.
// Ambient = bara CSS-klasser på ett fåtal grupper via anim() (#374); tavlans
// "klicka mig"-glöd är .kc-glod/.kc-guppa i styles.css.
// ============================================================================

import {
  O, LINE, THIN, shadow, anim, gnistra, glans, stjarnaKontur,
  GULD, GULD_MORK, GULD_LJUS, KRAM, WOOD, WOOD_DARK, SAMMET, SAMMET_MORK,
} from "./art-klasscenter-delar.js";

const SKARM = "#2E3A5C";
const SKARM_RUTA = "#3D4C74";
const SKARM_SPAR = "#1F2844";
const GRON = "#7BC67E";

// --- Pokalhyllan --------------------------------------------------------------
// #528: den gratis hyllan rymmer bara TRE pokaler (ett hyllplan) – fler och
// finare pokaler får plats i Troféhyllan (shoppen) nedan.
const HYLLA_PLAN = [104]; // hyllplanets överkant (pokalernas golv)
const HYLLA_CX = [55, 115, 175];
/** En plats rymmer en pokal i viewBox 100 × 140 (POKAL_VB). */
const PLATS_W = 56;
const PLATS_H = 78.4;

function platser(plan, cx) {
  return Object.freeze(plan.flatMap((yb) => cx.map((x) =>
    Object.freeze({ x: x - PLATS_W / 2, y: +(yb - PLATS_H).toFixed(1), w: PLATS_W, h: PLATS_H }))));
}

/**
 * Pokalplatserna på hyllan i hyllans viewBox: [{ x, y, w, h }], vänster→
 * höger. Fyll i ordning (t.ex. finast först).
 */
export const KC_POKALHYLLA_PLATSER = platser(HYLLA_PLAN, HYLLA_CX);

function hyllplan(y, x = 12, w = 206) {
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="9" rx="3" fill="${WOOD}" ${LINE}/>` +
    `<rect x="${x + 4}" y="${y + 2}" width="${w - 8}" height="2" rx="1" fill="${GULD}" stroke="none"/>`
  );
}

// --- Troféhyllan (#528) -------------------------------------------------------
// Shoppens Troféhylla (2 500 mynt) = klassens hedershylla: sex platser i
// guldkantade nischer med belysning. Klassens finaste pokaler ställs dit
// automatiskt (kc-pokal-placering.js) när den står i rummet.
const TROFE_PLAN = [118, 214];
const TROFE_CX = [60, 120, 180];
/** Troféhyllans sex platser (två plan à tre) i dess viewBox, ovan→ned. */
export const KC_TROFEHYLLA_PLATSER = platser(TROFE_PLAN, TROFE_CX);
const PLYSCH = "#7A3B5C";
const PLYSCH_MORK = "#5E2A46";

function nisch(cx, plan, opts) {
  const x = cx - 31;
  const y = plan - 88;
  return (
    `<rect x="${x}" y="${y}" width="62" height="88" rx="8" fill="${PLYSCH_MORK}" stroke="${GULD}" stroke-width="2.6"/>` +
    `<rect x="${x + 4}" y="${y + 4}" width="54" height="80" rx="6" fill="none" stroke="${GULD_MORK}" stroke-width="1" opacity="0.7"/>` +
    // Ljuskägla från spotlampan i nischens tak (pulserar via .kc-glod).
    `<g${anim(opts, "kc-glod")}><path d="M${cx - 5} ${y + 6} L${cx - 27} ${plan} L${cx + 27} ${plan} L${cx + 5} ${y + 6} Z" ` +
    `fill="${GULD_LJUS}" opacity="0.32"/></g>` +
    `<rect x="${cx - 7}" y="${y + 1}" width="14" height="6" rx="3" fill="${GULD}" ${THIN}/>` +
    `<ellipse cx="${cx}" cy="${plan - 1}" rx="22" ry="3" fill="${GULD_LJUS}" opacity="0.35"/>`
  );
}

function trofehylla(opts) {
  return (
    `<rect x="6" y="16" width="228" height="214" rx="9" fill="${WOOD_DARK}" ${LINE}/>` +
    `<rect x="14" y="26" width="212" height="196" rx="5" fill="${PLYSCH}" ${THIN}/>` +
    TROFE_PLAN.map((p) => TROFE_CX.map((cx) => nisch(cx, p, opts)).join("")).join("") +
    TROFE_PLAN.map((p) => hyllplan(p, 10, 220)).join("") +
    // Krönlist med guldkant och medaljong (stjärna).
    `<rect x="1" y="6" width="238" height="16" rx="6" fill="${WOOD}" ${LINE}/>` +
    `<rect x="9" y="16" width="222" height="3" rx="1.5" fill="${GULD}" stroke="none"/>` +
    `<ellipse cx="120" cy="9" rx="22" ry="9.5" fill="${GULD}" ${THIN}/>` +
    stjarnaKontur(120, 9.5, 7, KRAM) +
    // Sockel med mässingsskylt.
    `<rect x="3" y="224" width="234" height="12" rx="5" fill="${WOOD}" ${LINE}/>` +
    `<rect x="96" y="226.5" width="48" height="7" rx="2" fill="${GULD}" ${THIN}/>` +
    `<path d="M104 230 L136 230" stroke="${GULD_MORK}" stroke-width="1.4" stroke-linecap="round"/>` +
    glans("M10 30 L10 216", 1.6, 0.3) +
    `<g${anim(opts, "kc-glitter")}>${gnistra(146, 6, 5)}</g>` +
    `<g${anim(opts, "kc-glitter d3")}>${gnistra(20, 34, 3.6)}</g>`
  );
}

// --- Statistiktavlan ------------------------------------------------------------
/**
 * Statistiktavlans tre värdefält i tavlans viewBox (sub-issue E ritar
 * siffrorna/stapeln här): exp = klassens totala EXP, losta = lösta uppgifter
 * tillsammans, progress = stapelns spår mot nästa byggnadsnivå (fyll från x).
 */
export const KC_STATISTIK_FALT = Object.freeze({
  exp: Object.freeze({ x: 58, y: 48, w: 64, h: 32 }),
  losta: Object.freeze({ x: 162, y: 48, w: 64, h: 32 }),
  progress: Object.freeze({ x: 60, y: 104, w: 164, h: 12 }),
});

function ruta(x, y, w, h) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${SKARM_RUTA}" stroke="${O}" stroke-width="1.6"/>`;
}

export const KC_POKALER_MOBLER = {
  // Pokalhylla: väggskåp i mörkt trä med sammetsbakgrund, krönlist med
  // guldstjärna och två hyllplan à fyra platser.
  "kc-pokalhylla": {
    viewBox: "0 0 230 124",
    w: 10,
    rita: (opts) =>
      `<rect x="8" y="14" width="214" height="104" rx="8" fill="${WOOD_DARK}" ${LINE}/>` +
      `<rect x="16" y="22" width="198" height="86" rx="4" fill="${SAMMET_MORK}" ${THIN}/>` +
      `<path d="M16 22 L214 22 L214 32 L16 32 Z" fill="${O}" opacity="0.2"/>` +
      `<path d="M172 22 L214 22 L214 108 L196 108 Z" fill="${SAMMET}" opacity="0.35"/>` +
      // Krönlist med medaljong.
      `<rect x="2" y="6" width="226" height="16" rx="6" fill="${WOOD}" ${LINE}/>` +
      `<rect x="10" y="16" width="210" height="3" rx="1.5" fill="${GULD}" stroke="none"/>` +
      `<ellipse cx="115" cy="9" rx="20" ry="9" fill="${GULD}" ${THIN}/>` +
      stjarnaKontur(115, 9.5, 6.5, KRAM) +
      hyllplan(HYLLA_PLAN[0], 10, 210) +
      // Konsoler under hyllan.
      `<path d="M30 113 L30 120 L44 113 Z M200 113 L200 120 L186 113 Z" fill="${WOOD}" ${THIN}/>` +
      `<g${anim(opts, "kc-glitter")}>${gnistra(137, 8, 5)}</g>` +
      `<g${anim(opts, "kc-glitter d2")}>${gnistra(30, 40, 3.6)}</g>`,
  },

  // Troféhylla (#528, shoppen): hedershyllan med sex belysta nischer.
  "kc-trofehylla": {
    viewBox: "0 0 240 238",
    w: 11,
    rita: trofehylla,
  },

  // Statistiktavla: informationsskärm i träram på två ben, guldskylt med
  // stapeldiagram, tre tomma fält (EXP, lösta uppgifter, nivåstapel) och en
  // glödande förstoringsglas-bricka som visar att den går att klicka på.
  "kc-statistiktavla": {
    viewBox: "0 0 260 180",
    w: 10,
    rita: (opts) => {
      const f = KC_STATISTIK_FALT;
      const p = f.progress;
      return (
        // Glöden bakom ramen (pulserar via .kc-glod).
        `<g${anim(opts, "kc-glod")}><rect x="2" y="2" width="256" height="148" rx="18" fill="${GULD_LJUS}" opacity="0.7"/></g>` +
        shadow(130, 174, 110) +
        // Ben och fötter.
        `<rect x="40" y="136" width="10" height="36" rx="2" fill="${WOOD_DARK}" ${THIN}/>` +
        `<rect x="210" y="136" width="10" height="36" rx="2" fill="${WOOD_DARK}" ${THIN}/>` +
        `<rect x="28" y="168" width="34" height="7" rx="3.5" fill="${WOOD}" ${THIN}/>` +
        `<rect x="198" y="168" width="34" height="7" rx="3.5" fill="${WOOD}" ${THIN}/>` +
        // Ram och skärm.
        `<rect x="12" y="14" width="236" height="128" rx="10" fill="${WOOD_DARK}" ${LINE}/>` +
        `<rect x="18" y="20" width="224" height="116" rx="7" fill="none" stroke="${GULD}" stroke-width="2.4"/>` +
        `<rect x="22" y="34" width="216" height="98" rx="6" fill="${SKARM}" ${THIN}/>` +
        `<path d="M24 36 L80 36 L46 130 L24 130 Z" fill="#FFFFFF" opacity="0.05"/>` +
        // EXP-ruta (stjärna) och lösta-ruta (bock).
        ruta(28, 42, 98, 44) +
        stjarnaKontur(43, 64, 11, GULD) +
        ruta(132, 42, 98, 44) +
        `<circle cx="147" cy="64" r="10" fill="${GRON}" ${THIN}/>` +
        `<path d="M142 64.5 L145.6 68 L152 60.6" fill="none" stroke="#FFFFFF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>` +
        // Nivårad: litet klasscenter + tomt stapelspår.
        ruta(28, 92, 202, 36) +
        `<path d="M36 120 L36 106 L44 99 L52 106 L52 120 Z" fill="${KRAM}" ${THIN}/>` +
        `<rect x="41.5" y="111" width="5" height="9" rx="2.5" fill="${WOOD}" stroke="none"/>` +
        `<path d="M44 99 L44 92 L50 94.5 L44 97" fill="${GULD}" stroke="${O}" stroke-width="1.2" stroke-linejoin="round"/>` +
        `<rect x="${p.x - 2}" y="${p.y - 2}" width="${p.w + 4}" height="${p.h + 4}" rx="${(p.h + 4) / 2}" fill="${SKARM_SPAR}" stroke="${O}" stroke-width="1.6"/>` +
        // Rubrikskylt med stapeldiagram.
        `<rect x="94" y="4" width="72" height="24" rx="7" fill="${GULD}" ${LINE}/>` +
        `<rect x="98" y="8" width="64" height="2.4" rx="1.2" fill="${GULD_LJUS}" stroke="none"/>` +
        `<path d="M110 23 L150 23" stroke="${GULD_MORK}" stroke-width="2" stroke-linecap="round"/>` +
        `<rect x="114" y="16" width="6" height="7" rx="1" fill="${SAMMET}" stroke="${O}" stroke-width="1.2"/>` +
        `<rect x="124" y="12" width="6" height="11" rx="1" fill="${GRON}" stroke="${O}" stroke-width="1.2"/>` +
        `<rect x="134" y="9" width="6" height="14" rx="1" fill="#EF6F6C" stroke="${O}" stroke-width="1.2"/>` +
        // "Klicka mig"-bricka (guppar via .kc-guppa) med förstoringsglas.
        `<g${anim(opts, "kc-guppa")}>` +
        `<circle cx="240" cy="18" r="13" fill="${KRAM}" ${LINE}/>` +
        `<circle cx="237.5" cy="15.5" r="5.5" fill="none" stroke="${O}" stroke-width="2.6"/>` +
        `<path d="M241.6 19.6 L246.5 24.5" stroke="${O}" stroke-width="3.4" stroke-linecap="round"/>` +
        glans("M234.6 13.6 L236.2 12.2", 1.4, 0.9) +
        `</g>` +
        glans("M18 30 L18 120", 1.6, 0.35) +
        `<g${anim(opts, "kc-glitter d2")}>${gnistra(232, 132, 4)}</g>`
      );
    },
  },
};
