// ============================================================================
// Pluggporten – Klasscentrets pokaler: en kodritad figur per pokaltyp (#496,
// epic #474 Klasscentret 3/4).
// ----------------------------------------------------------------------------
// Register-format: se index-modulen art-klasscenter-pokaler.js. Nycklarna är
// pokaltypernas `art` i src/klasscenter/kc-pokal-typer.js ("pokal" = reserv
// för okända/framtida typer, som normaliseraPokal faller tillbaka på).
// ALLA pokaler delar viewBox POKAL_VB (100 × 140, står på y≈134) så hyllan
// kan placera dem i lika stora platser utan att veta vilken typ det är.
// Stil = Klasscentrum-föremålen (art-klasscenter-inredning*.js): tvåtonat guld
// med glans, kontur O, platt – inga gradienter/defs/id. Ambient = bara CSS-
// klasser på ett fåtal grupper via anim() (#374).
// ============================================================================

import {
  O, LINE, THIN, limb, shadow, anim, gnistra, glans, stjarnaKontur,
  GULD, GULD_MORK, GULD_LJUS, KRAM, FANA, WOOD, WOOD_DARK, GLAS, STAL, STAL_DARK,
  SAMMET, SAMMET_MORK,
} from "./art-klasscenter-delar.js";

/** Gemensam viewBox för alla pokaler. */
export const POKAL_VB = "0 0 100 140";
/** Visningsbredd (rem) för en fristående pokal. */
const POKAL_W = 3.2;

const GRON = "#7BC67E";
const ORANGE = "#F49E4C";

// Träsockel med mässingsskylt (två graverade rader). fill = sockelns färg.
export function sockel(fill = WOOD_DARK, list = WOOD) {
  return (
    shadow(50, 134, 38) +
    `<rect x="18" y="112" width="64" height="22" rx="3" fill="${fill}" ${LINE}/>` +
    `<rect x="22" y="104" width="56" height="10" rx="3" fill="${list}" ${LINE}/>` +
    `<rect x="33" y="118" width="34" height="10" rx="2" fill="${GULD}" ${THIN}/>` +
    `<path d="M38 121.6 L62 121.6 M42 124.8 L58 124.8" stroke="${GULD_MORK}" stroke-width="1.4" stroke-linecap="round"/>`
  );
}

// Bägarpokal (fot, skaft, handtag, skål) i färgen c / skuggfärgen cm.
export function bagare(c, cm) {
  return (
    `<path d="M34 104 L66 104 L58 94 L42 94 Z" fill="${cm}" ${THIN}/>` +
    `<rect x="45" y="74" width="10" height="21" fill="${c}" ${THIN}/>` +
    `<ellipse cx="50" cy="82" rx="8" ry="4" fill="${cm}" ${THIN}/>` +
    limb("M24 32 Q6 32 10 50 Q14 64 32 62", c, 5) +
    limb("M76 32 Q94 32 90 50 Q86 64 68 62", c, 5) +
    `<path d="M20 24 L80 24 Q80 74 50 76 Q20 74 20 24 Z" fill="${c}" ${LINE}/>` +
    `<path d="M62 24 L80 24 Q80 60 62 72 Z" fill="${cm}" opacity="0.45"/>` +
    `<ellipse cx="50" cy="24" rx="30" ry="6" fill="${cm}" ${LINE}/>` +
    `<ellipse cx="50" cy="24.6" rx="24" ry="3.4" fill="${O}" opacity="0.22"/>` +
    glans("M27 32 Q27 52 36 64", 2.6, 0.8)
  );
}

// Rosett i klassens färg (--kc-fana) runt skaftet.
export function rosett(cx, cy) {
  return (
    `<path d="M${cx - 2} ${cy + 2} L${cx - 9} ${cy + 18} L${cx - 4} ${cy + 15} L${cx - 2} ${cy + 20} L${cx + 2} ${cy + 4} Z" fill="${FANA}" ${THIN}/>` +
    `<path d="M${cx + 2} ${cy + 2} L${cx + 9} ${cy + 18} L${cx + 4} ${cy + 15} L${cx + 2} ${cy + 20} L${cx - 2} ${cy + 4} Z" fill="${FANA}" ${THIN}/>` +
    `<path d="M${cx} ${cy} L${cx - 12} ${cy - 6} L${cx - 12} ${cy + 6} Z" fill="${FANA}" ${THIN}/>` +
    `<path d="M${cx} ${cy} L${cx + 12} ${cy - 6} L${cx + 12} ${cy + 6} Z" fill="${FANA}" ${THIN}/>` +
    `<circle cx="${cx}" cy="${cy}" r="3.4" fill="${FANA}" ${THIN}/>`
  );
}

export const KC_POKALER_FIGURER = {
  // Mattematchens mästare (mm-klasskamp): stor guldpokal med räknesätts-
  // emblem (+ − × ÷), rosett i klassens färg och mässingsskylt.
  "pokal-mm": {
    viewBox: POKAL_VB,
    w: POKAL_W,
    rita: (opts) =>
      sockel() +
      bagare(GULD, GULD_MORK) +
      `<circle cx="50" cy="46" r="14" fill="${KRAM}" ${THIN}/>` +
      `<circle cx="50" cy="46" r="10.6" fill="none" stroke="${GULD}" stroke-width="1.8"/>` +
      `<path d="M41.5 42 L47.5 42 M44.5 39 L44.5 45 M52.5 42 L58.5 42 M42 48 L47 53 M47 48 L42 53 M52.5 50.5 L58.5 50.5" ` +
      `stroke="${GULD_MORK}" stroke-width="2" stroke-linecap="round"/>` +
      `<circle cx="55.5" cy="47.8" r="1.1" fill="${GULD_MORK}"/><circle cx="55.5" cy="53.2" r="1.1" fill="${GULD_MORK}"/>` +
      rosett(50, 86) +
      `<g${anim(opts, "kc-glitter")}>${gnistra(80, 16, 5.5)}</g>` +
      `<g${anim(opts, "kc-glitter d2")}>${gnistra(16, 66, 4)}</g>`,
  },

  // Live-segrare (live-vinst): stjärnpokal på guldstav med blixt i mitten,
  // strålkrans bakom och band i klassens färg – snabb, elektrisk vinst.
  "pokal-live": {
    viewBox: POKAL_VB,
    w: POKAL_W,
    rita: (opts) =>
      sockel(SAMMET_MORK, SAMMET) +
      `<rect x="22" y="108" width="56" height="2.4" rx="1.2" fill="${GULD}" stroke="none"/>` +
      // Band bakom staven.
      `<path d="M44 60 L32 96 L38 92 L41 99 L52 64 Z" fill="${FANA}" ${THIN}/>` +
      `<path d="M56 60 L68 96 L62 92 L59 99 L48 64 Z" fill="${FANA}" ${THIN}/>` +
      `<path d="M42 104 L58 104 L54 96 L46 96 Z" fill="${GULD_MORK}" ${THIN}/>` +
      `<rect x="46" y="66" width="8" height="31" fill="${GULD}" ${THIN}/>` +
      glans("M48.4 70 L48.4 92", 1.6, 0.7) +
      // Strålkrans + stjärna + blixt.
      `<circle cx="50" cy="42" r="38" fill="${GULD_LJUS}" opacity="0.45"/>` +
      [0, 1, 2, 3, 4].map((i) => {
        const a = -Math.PI / 2 + Math.PI / 5 + (i * 2 * Math.PI) / 5;
        const x = (50 + 40 * Math.cos(a)).toFixed(1);
        const y = (42 + 40 * Math.sin(a)).toFixed(1);
        return `<path d="M50 42 L${x} ${y}" stroke="${GULD_LJUS}" stroke-width="4" stroke-linecap="round" opacity="0.8"/>`;
      }).join("") +
      stjarnaKontur(50, 44, 36, GULD, LINE) +
      stjarnaKontur(50, 45, 24, GULD_MORK, `stroke="none"`) +
      stjarnaKontur(50, 45, 20, GULD, `stroke="none"`) +
      `<path d="M55 26 L40 48 L49 48 L44 64 L61 39 L52 39 L57 26 Z" fill="${SAMMET}" ${THIN}/>` +
      glans("M53 30 L46 41", 1.6, 0.8) +
      glans("M38 30 L44 22", 2, 0.75) +
      `<g${anim(opts, "kc-glitter")}>${gnistra(86, 12, 5)}</g>` +
      `<g${anim(opts, "kc-glitter d2")}>${gnistra(12, 28, 4)}</g>` +
      `<g${anim(opts, "kc-glitter d3")}>${gnistra(88, 70, 3.6)}</g>`,
  },

  // Liveläge avklarat (live-avklarat, kooperativt): sköldformad träplakett
  // med natthimmel och en raket som lyfter, guldbanderoll och grön bock.
  "pokal-live-klar": {
    viewBox: POKAL_VB,
    w: POKAL_W,
    rita: (opts) =>
      shadow(50, 134, 34) +
      `<rect x="28" y="112" width="44" height="22" rx="3" fill="${WOOD_DARK}" ${LINE}/>` +
      `<rect x="31" y="117" width="38" height="2.4" rx="1.2" fill="${GULD}" stroke="none"/>` +
      `<path d="M14 16 Q50 2 86 16 L86 82 Q86 102 50 118 Q14 102 14 82 Z" fill="${WOOD}" ${LINE}/>` +
      `<path d="M22 23 Q50 12 78 23 L78 80 Q78 96 50 109 Q22 96 22 80 Z" fill="${SAMMET_MORK}" ${THIN}/>` +
      `<path d="M68 19 Q74 20 78 23 L78 80 Q78 92 68 100 Z" fill="${O}" opacity="0.18"/>` +
      // Stjärnhimmel.
      [[30, 34], [70, 38], [29, 66], [72, 62], [38, 84], [64, 86]]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#FFFFFF" opacity="0.85"/>`).join("") +
      `<g${anim(opts, "kc-glitter")}>${gnistra(33, 48, 3.6)}</g>` +
      `<g${anim(opts, "kc-glitter d3")}>${gnistra(68, 50, 3)}</g>` +
      // Raketen (flamman under kroppen så nozzeln täcker dess fäste).
      `<g${anim(opts, "kc-flamma")}><path d="M44 72 Q50 96 56 72 Z" fill="${ORANGE}" ${THIN}/>` +
      `<path d="M47 73 Q50 86 53 73 Z" fill="${GULD_LJUS}" stroke="none"/></g>` +
      `<path d="M41 58 L31 74 L41 71 Z" fill="${FANA}" ${THIN}/>` +
      `<path d="M59 58 L69 74 L59 71 Z" fill="${FANA}" ${THIN}/>` +
      `<rect x="43" y="68" width="14" height="6" rx="1.5" fill="${STAL_DARK}" ${THIN}/>` +
      `<path d="M50 24 Q63 38 60 70 L40 70 Q37 38 50 24 Z" fill="${STAL}" ${LINE}/>` +
      `<path d="M50 24 Q57 31 59 40 L41 40 Q43 31 50 24 Z" fill="${FANA}" ${THIN}/>` +
      `<circle cx="50" cy="52" r="6.5" fill="${GLAS}" ${THIN}/>` +
      glans("M47 49 L49 47.5", 1.6, 0.9) + glans("M44 44 Q43 54 44 64", 1.8, 0.7) +
      // Banderoll och bock.
      `<path d="M10 90 L90 90 L85 96 L90 102 L10 102 L15 96 Z" fill="${GULD}" ${THIN}/>` +
      `<path d="M30 96 L70 96" stroke="${GULD_MORK}" stroke-width="1.8" stroke-linecap="round"/>` +
      `<circle cx="80" cy="18" r="11" fill="${GRON}" ${LINE}/>` +
      `<path d="M74.5 18.5 L78.5 22.5 L85.5 14" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  // Reserv (okänd/framtida typ): enkel silverpokal med stjärna.
  pokal: {
    viewBox: POKAL_VB,
    w: POKAL_W,
    rita: (opts) =>
      sockel() +
      bagare(STAL, STAL_DARK) +
      `<circle cx="50" cy="46" r="13" fill="${KRAM}" ${THIN}/>` +
      stjarnaKontur(50, 47, 9, GULD) +
      `<g${anim(opts, "kc-glitter")}>${gnistra(80, 16, 4.6)}</g>`,
  },
};
