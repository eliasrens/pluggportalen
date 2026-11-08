// ============================================================================
// Pluggporten – badrumsmöblernas extra vyer för ⟳ Rotera (#829)
// ----------------------------------------------------------------------------
// Samma regler som art-furniture-vyer.js: varje vy ritas i SAMMA viewBox-höjd
// som framsidan (art-furniture-badrum.js) med fötterna/skuggan på samma y, så
// möbeln står kvar på golvpunkten när den vrids. `bak: "spegel"` där framsidan
// redan är en profil (badkaret) eller saken ser likadan ut bakifrån (stativ,
// korg, matta); andra sidan = sidan spegelvänd (inget sida2).
// Laddas LAZY (#271) via art-furniture-vyer.js – aldrig statiskt från bootgrafen.
// ============================================================================

import { LINE, THIN, limb, shadow } from "./art-style.js";
import {
  WOOD, WOOD_DARK, WOOD_LIGHT, PORSLIN, PORSLIN_SKUGGA, KROM, KROM_MORK, VATTEN, VATTEN_LJUS, HOGDAGER,
  droppe, bubbla,
} from "./art-furniture-badrum.js";

const GLAS = `fill="#E8F6FC" fill-opacity="0.45"`;

/** id → { sida, bak, sida2? } där varje vy är { viewBox, art } (eller bak: "spegel"). */
export const VYER_BADRUM = {
  // --- Badkar (124×84): framsidan = långsidan → sidan är kortänden -------
  badkar: {
    sida: {
      viewBox: "0 0 64 84",
      art:
        shadow(32, 79, 26) +
        `<path d="M14 62 Q9 71 11 78 L23 78 Q23 70 21 62 Z" fill="#F7C948" ${LINE}/>` +
        `<path d="M50 62 Q55 71 53 78 L41 78 Q41 70 43 62 Z" fill="#F7C948" ${LINE}/>` +
        `<path d="M15 74 L15 78 M19 74 L19 78 M45 74 L45 78 M49 74 L49 78" fill="none" ${THIN}/>` +
        `<path d="M6 38 L58 38 Q57 66 44 70 L20 70 Q7 66 6 38 Z" fill="#A6DCF2" ${LINE}/>` +
        `<path d="M10 56 Q32 62 54 56 Q51 66 43 67.5 L21 67.5 Q13 66 10 56 Z" fill="${VATTEN}" stroke="none"/>` +
        `<path d="M13 46 Q32 50 51 46" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="0.1 6"/>` +
        `<path d="M10 44 Q11 51 15 56" ${HOGDAGER}/>` +
        limb("M32 33 L32 14 Q32 9 37 9", KROM_MORK, 4) +
        `<circle cx="25" cy="18" r="3.2" fill="#F7C948" ${THIN}/>` +
        bubbla(13, 30, 6) + bubbla(24, 25, 8) + bubbla(38, 27, 8) + bubbla(51, 30, 6) +
        bubbla(46, 12, 3, VATTEN_LJUS) + bubbla(18, 9, 2.4, VATTEN_LJUS) +
        `<rect x="2" y="32" width="60" height="9" rx="4.5" fill="${PORSLIN}" ${LINE}/>` +
        `<path d="M8 35.5 H34" stroke="${PORSLIN_SKUGGA}" stroke-width="2.4" stroke-linecap="round"/>`,
    },
    bak: "spegel",
  },

  // --- Duschhörna (76×118): sidan = glasväggen, bakifrån = kakelväggens baksida
  dusch: {
    sida: {
      viewBox: "0 0 60 118",
      art:
        shadow(30, 112, 25) +
        `<rect x="6" y="8" width="9" height="92" rx="3" fill="${VATTEN_LJUS}" ${LINE}/>` +
        limb("M19 98 L19 24 Q19 16 27 16 L35 16", KROM_MORK, 4) +
        `<circle cx="19" cy="64" r="4" fill="#F7C948" ${THIN}/>` +
        `<path d="M31 14 L42 14 L44 24 L29 24 Z" fill="${KROM}" ${LINE}/>` +
        droppe(33, 30) + droppe(41, 35) + droppe(36, 46) + droppe(43, 54) + droppe(37, 64) +
        `<rect x="6" y="8" width="48" height="92" rx="4" ${GLAS} ${LINE}/>` +
        `<path d="M16 46 L34 22 M16 62 L40 30" ${HOGDAGER}/>` +
        `<rect x="4" y="98" width="52" height="12" rx="4" fill="${PORSLIN}" ${LINE}/>` +
        `<path d="M10 102 H50" stroke="${PORSLIN_SKUGGA}" stroke-width="2.4" stroke-linecap="round"/>`,
    },
    bak: {
      viewBox: "0 0 76 118",
      art:
        shadow(38, 112, 32) +
        `<rect x="6" y="8" width="32" height="92" rx="4" ${GLAS} ${LINE}/>` +
        `<rect x="8" y="8" width="60" height="92" rx="4" fill="${PORSLIN_SKUGGA}" ${LINE}/>` +
        `<path d="M12 40 H64 M12 72 H64" fill="none" stroke="${KROM_MORK}" stroke-width="1.8" stroke-linecap="round"/>` +
        `<path d="M14 14 L14 34" ${HOGDAGER}/>` +
        `<rect x="6" y="98" width="64" height="12" rx="4" fill="${PORSLIN}" ${LINE}/>` +
        `<path d="M12 102 H64" stroke="${PORSLIN_SKUGGA}" stroke-width="2.4" stroke-linecap="round"/>`,
    },
  },

  // --- Toalett (64×84): sidan = profilen, bakifrån = cisternen -------------
  toalett: {
    sida: {
      viewBox: "0 0 60 84",
      art:
        shadow(30, 78, 24) +
        `<path d="M18 56 L16 76 L38 76 L40 56 Z" fill="${PORSLIN}" ${LINE}/>` +
        `<path d="M34 60 L35 73" stroke="${PORSLIN_SKUGGA}" stroke-width="3" stroke-linecap="round"/>` +
        `<rect x="8" y="1.8" width="8" height="5" rx="2.5" fill="${KROM}" ${THIN}/>` +
        `<rect x="4" y="6" width="16" height="34" rx="5" fill="${PORSLIN}" ${LINE}/>` +
        `<rect x="7" y="22" width="10" height="14" rx="3" fill="${PORSLIN_SKUGGA}" stroke="none"/>` +
        `<rect x="2" y="4" width="20" height="8" rx="4" fill="${PORSLIN}" ${LINE}/>` +
        `<path d="M10 42 L56 42 Q55 58 40 62 L22 62 Q12 58 10 42 Z" fill="${PORSLIN}" ${LINE}/>` +
        `<path d="M14 51 Q34 56 53 50 Q48 59 40 60 L22 60 Q16 57 14 51 Z" fill="${PORSLIN_SKUGGA}" stroke="none"/>` +
        `<rect x="8" y="36" width="50" height="7" rx="3.5" fill="${VATTEN}" ${LINE}/>` +
        `<path d="M14 39.5 H38" stroke="${VATTEN_LJUS}" stroke-width="2.4" stroke-linecap="round"/>`,
    },
    bak: {
      viewBox: "0 0 64 84",
      art:
        shadow(32, 78, 24) +
        `<path d="M22 56 L20 76 L44 76 L42 56 Z" fill="${PORSLIN}" ${LINE}/>` +
        `<path d="M6 42 L58 42 Q56 62 32 62 Q8 62 6 42 Z" fill="${PORSLIN}" ${LINE}/>` +
        `<rect x="4" y="36" width="56" height="8" rx="4" fill="${VATTEN}" ${LINE}/>` +
        limb("M32 46 L32 56", KROM_MORK, 3) +
        `<rect x="27" y="1.8" width="10" height="5" rx="2.5" fill="${KROM}" ${THIN}/>` +
        `<rect x="10" y="6" width="44" height="40" rx="6" fill="${PORSLIN}" ${LINE}/>` +
        `<rect x="14" y="28" width="36" height="14" rx="4" fill="${PORSLIN_SKUGGA}" stroke="none"/>` +
        `<rect x="7" y="4" width="50" height="8" rx="4" fill="${PORSLIN}" ${LINE}/>`,
    },
  },

  // --- Handfat (66×112): sidan = profilen mot väggen, bakifrån = spegelns baksida
  handfat: {
    sida: {
      viewBox: "0 0 40 112",
      art:
        shadow(20, 106, 15) +
        `<path d="M14 62 Q13 90 10 102 L30 102 Q27 90 26 62 Z" fill="${PORSLIN}" ${LINE}/>` +
        `<path d="M22 66 Q23 88 25 98" fill="none" stroke="${PORSLIN_SKUGGA}" stroke-width="3" stroke-linecap="round"/>` +
        `<rect x="5" y="3" width="7" height="30" rx="3.5" fill="#F7C948" ${LINE}/>` +
        limb("M10 46 L10 38 Q10 34 16 34", KROM_MORK, 3.5) +
        `<path d="M4 50 L36 50 Q35 66 22 68 Q8 66 4 50 Z" fill="${PORSLIN}" ${LINE}/>` +
        `<path d="M8 56 Q22 61 33 56 Q30 65.5 22 65.5 Q11 65 8 56 Z" fill="${PORSLIN_SKUGGA}" stroke="none"/>` +
        `<rect x="2" y="45" width="36" height="8" rx="4" fill="${PORSLIN}" ${LINE}/>` +
        `<rect x="26" y="40.5" width="9" height="5" rx="2.5" fill="#F890B7" ${THIN}/>`,
    },
    bak: {
      viewBox: "0 0 66 112",
      art:
        shadow(33, 106, 22) +
        `<path d="M26 62 Q24 90 20 102 L46 102 Q42 90 40 62 Z" fill="${PORSLIN}" ${LINE}/>` +
        `<ellipse cx="33" cy="18" rx="20" ry="15" fill="#F7C948" ${LINE}/>` +
        `<ellipse cx="33" cy="18" rx="14" ry="10" fill="${WOOD}" ${THIN}/>` +
        `<path d="M33 3 L33 8" fill="none" ${THIN}/>` +
        limb("M33 46 L33 36", KROM_MORK, 3.5) +
        `<path d="M6 50 L60 50 Q58 68 33 68 Q8 68 6 50 Z" fill="${PORSLIN}" ${LINE}/>` +
        limb("M33 66 L33 72", KROM_MORK, 3) +
        `<rect x="4" y="45" width="58" height="8" rx="4" fill="${PORSLIN}" ${LINE}/>`,
    },
  },

  // --- Handdukstork (58×92): sidan = stativets gavel med handdukarna på kant
  handdukstork: {
    sida: {
      viewBox: "0 0 30 92",
      art:
        shadow(15, 87, 12) +
        limb("M5 85 L25 85", WOOD_DARK, 3.5) +
        limb("M15 11 L15 84", WOOD, 4) +
        `<circle cx="15" cy="8" r="3.2" fill="${WOOD_LIGHT}" ${THIN}/>` +
        `<path d="M11 12 Q15 9 19 12 L19 38 Q15 41 11 38 Z" fill="#F890B7" ${LINE}/>` +
        `<rect x="12" y="43" width="6" height="28" rx="3" fill="${VATTEN}" ${LINE}/>` +
        `<circle cx="15" cy="14" r="2.4" fill="${WOOD_DARK}" ${THIN}/>` +
        `<circle cx="15" cy="46" r="2.4" fill="${WOOD_DARK}" ${THIN}/>`,
    },
    bak: "spegel",
  },

  // --- Tvättkorg (60×70): rund korg – sidan visar tvätten från ett annat håll
  tvattkorg: {
    sida: {
      viewBox: "0 0 60 70",
      art:
        shadow(30, 65, 24) +
        `<path d="M14 25 Q12 10 26 12 L30 25 Z" fill="#6FC66F" ${LINE}/>` +
        `<path d="M32 25 Q38 9 47 16 Q42 20 44 25 Z" fill="#EF6F6C" ${LINE}/>` +
        `<path d="M8 24 L52 24 L47 61 Q30 65 13 61 Z" fill="${WOOD_LIGHT}" ${LINE}/>` +
        `<path d="M20 28 L21 61 M30 28 L30 63 M40 28 L39 61" fill="none" stroke="${WOOD}" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/>` +
        `<path d="M10.5 36 Q30 39 49.5 36 M11.8 46 Q30 49 48.2 46 M13 55 Q30 58 47 55" fill="none" stroke="${WOOD}" stroke-width="2.4" stroke-linecap="round"/>` +
        `<rect x="24" y="31" width="12" height="4" rx="2" fill="${WOOD_DARK}" ${THIN}/>` +
        `<rect x="5" y="20" width="50" height="8" rx="4" fill="${WOOD}" ${LINE}/>` +
        `<path d="M10 23.5 H30" stroke="${WOOD_LIGHT}" stroke-width="2.2" stroke-linecap="round"/>`,
    },
    bak: "spegel",
  },

  // --- Badrumsmatta (120×56): vriden ett kvarts varv = kortsidan fram -----
  badrumsmatta: {
    sida: {
      viewBox: "0 0 76 56",
      art:
        `<path d="M24 2.5 V8 M38 2.5 V8 M52 2.5 V8 M24 48 V53.5 M38 48 V53.5 M52 48 V53.5" fill="none" ${THIN}/>` +
        `<rect x="6" y="8" width="64" height="40" rx="18" fill="${VATTEN}" ${LINE}/>` +
        `<rect x="14" y="14" width="48" height="28" rx="12" fill="#A6DCF2" ${THIN}/>` +
        `<rect x="18" y="17.5" width="40" height="21" rx="9" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="3 5" opacity="0.8"/>` +
        bubbla(28, 29, 5) + bubbla(44, 21, 2.6) + bubbla(50, 31, 4),
    },
    bak: "spegel",
  },

  // --- Tvättmaskin (70×80): sidan = plåtsidan, bakifrån = slangar & lucka --
  tvattmaskin: {
    sida: {
      viewBox: "0 0 60 80",
      art:
        shadow(30, 75, 25) +
        limb("M13 71 L13 74", KROM_MORK, 3) +
        limb("M47 71 L47 74", KROM_MORK, 3) +
        `<rect x="6" y="6" width="48" height="66" rx="7" fill="${PORSLIN}" ${LINE}/>` +
        `<rect x="10" y="24" width="40" height="44" rx="4" fill="${PORSLIN_SKUGGA}" stroke="none"/>` +
        `<path d="M6 21 H54" fill="none" ${LINE}/>` +
        `<path d="M18 30 H42 M18 35 H42 M18 40 H42" fill="none" stroke="${KROM_MORK}" stroke-width="2" stroke-linecap="round"/>` +
        `<path d="M12 10 L12 17" ${HOGDAGER}/>`,
    },
    bak: {
      viewBox: "0 0 70 80",
      art:
        shadow(35, 75, 29) +
        limb("M15 71 L15 74", KROM_MORK, 3) +
        limb("M55 71 L55 74", KROM_MORK, 3) +
        `<rect x="6" y="6" width="58" height="66" rx="7" fill="${PORSLIN}" ${LINE}/>` +
        `<path d="M6 21 H64" fill="none" ${LINE}/>` +
        `<rect x="16" y="28" width="38" height="34" rx="4" fill="${PORSLIN_SKUGGA}" ${THIN}/>` +
        `<circle cx="20" cy="32" r="1.6" fill="${KROM_MORK}"/><circle cx="50" cy="32" r="1.6" fill="${KROM_MORK}"/>` +
        `<circle cx="20" cy="58" r="1.6" fill="${KROM_MORK}"/><circle cx="50" cy="58" r="1.6" fill="${KROM_MORK}"/>` +
        limb("M48 14 Q60 16 58 30", "#46557A", 3.5) +
        limb("M24 14 Q10 18 12 34", VATTEN, 3.5),
    },
  },
};
