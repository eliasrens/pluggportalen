// ============================================================================
// Pluggporten – rotations-vyer för förvaring, bord & elektronik (#699)
// ----------------------------------------------------------------------------
// Andra halvan av FURNITURE_VYER (se art-furniture-vyer.js för reglerna:
// samma viewBox-höjd som framsidan, fötterna/skuggan på samma y). Sitt- och
// sovmöblerna ligger i art-furniture-vyer.js. Laddas bara via den (lazy, #271).
// ============================================================================

import { LINE, THIN, limb, shadow, stjarna } from "./art-style.js";

const WOOD = "#B0805A";
const WOOD_DARK = "#8A6242";
const WOOD_LIGHT = "#E0B98C";
const ADRING = `stroke="${WOOD_DARK}" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.6"`;

/** id → { sida, bak } – skrivbord, TV, dator, bokhylla, byrå, garderob, kylskåp, nattduksbord. */
export const VYER_FORVARING = {
  // --- Skrivbord (108×78): sidan = gaveln med hurtsen och prylarna --------
  skrivbord: {
    sida: {
      viewBox: "0 0 48 78",
      art:
        shadow(24, 73, 20) +
        `<rect x="6" y="34" width="34" height="36" rx="4" fill="${WOOD}" ${LINE}/>` +
        `<path d="M10 46 L36 46 M10 58 L36 58" ${ADRING}/>` +
        `<path d="M40 40 L43 40 M40 52 L43 52 M40 64 L43 64" fill="none" stroke="${WOOD_DARK}" stroke-width="2.6" stroke-linecap="round"/>` +
        `<rect x="4" y="26" width="40" height="10" rx="5" fill="#C9996B" ${LINE}/>` +
        `<path d="M10 29 H30" stroke="${WOOD_LIGHT}" stroke-width="2.6" stroke-linecap="round"/>` +
        `<rect x="8" y="14" width="16" height="5.5" rx="2" fill="#EF6F6C" ${THIN}/>` +
        `<rect x="9" y="8.5" width="14" height="5.5" rx="2" fill="#7FC7E8" ${THIN}/>` +
        `<path d="M32 8 L32 15" stroke="#EF6F6C" stroke-width="2.6" stroke-linecap="round"/>` +
        `<path d="M36 5.5 L36 15" stroke="#F7C948" stroke-width="2.6" stroke-linecap="round"/>` +
        `<rect x="28" y="14" width="12" height="12" rx="2.5" fill="#B79BE0" ${THIN}/>`,
    },
    bak: {
      viewBox: "0 0 108 78",
      art:
        shadow(54, 73, 46) +
        limb("M94 36 L98 70", WOOD_DARK, 5) +
        `<rect x="8" y="34" width="38" height="36" rx="4" fill="${WOOD}" ${LINE}/>` +
        `<path d="M27 38 L27 66" ${ADRING}/>` +
        `<rect x="46" y="35" width="48" height="16" rx="3" fill="${WOOD}" ${THIN}/>` +
        `<rect x="4" y="26" width="100" height="10" rx="5" fill="#C9996B" ${LINE}/>` +
        `<rect x="74" y="14" width="20" height="5.5" rx="2" fill="#EF6F6C" ${THIN}/>` +
        `<rect x="76" y="8.5" width="16" height="5.5" rx="2" fill="#7FC7E8" ${THIN}/>` +
        `<path d="M61 8 L61 15" stroke="#EF6F6C" stroke-width="2.6" stroke-linecap="round"/>` +
        `<path d="M56 5.5 L56 15" stroke="#F7C948" stroke-width="2.6" stroke-linecap="round"/>` +
        `<rect x="51" y="14" width="15" height="12" rx="2.5" fill="#B79BE0" ${THIN}/>`,
    },
  },

  // --- TV (96×74): sidan = tunn skärm på bänken, baksidan = kåpan & sladd --
  tv: {
    sida: {
      viewBox: "0 0 40 74",
      art:
        shadow(20, 69, 16) +
        limb("M9 58 L8 67", WOOD_DARK, 4) +
        limb("M31 58 L32 67", WOOD_DARK, 4) +
        `<rect x="15" y="40" width="9" height="11" fill="#46405C" ${LINE}/>` +
        `<rect x="4" y="50" width="32" height="10" rx="5" fill="${WOOD}" ${LINE}/>` +
        `<path d="M9 53 H24" stroke="${WOOD_LIGHT}" stroke-width="2.6" stroke-linecap="round"/>` +
        `<path d="M17 14 L11 17 L11 35 L17 38 Z" fill="#5A5372" ${THIN}/>` +
        `<rect x="17" y="6" width="7" height="40" rx="3" fill="#46405C" ${LINE}/>` +
        `<path d="M25.5 10 L25.5 42" stroke="#7FC7E8" stroke-width="2" stroke-linecap="round"/>`,
    },
    bak: {
      viewBox: "0 0 96 74",
      art:
        shadow(48, 69, 40) +
        limb("M18 58 L16 67", WOOD_DARK, 4) +
        limb("M78 58 L80 67", WOOD_DARK, 4) +
        `<rect x="43" y="45" width="10" height="6" fill="#46405C" ${LINE}/>` +
        `<rect x="8" y="50" width="80" height="10" rx="5" fill="${WOOD}" ${LINE}/>` +
        `<rect x="14" y="6" width="68" height="40" rx="5" fill="#46405C" ${LINE}/>` +
        `<rect x="30" y="12" width="36" height="28" rx="4" fill="#5A5372" ${THIN}/>` +
        `<path d="M36 18 H60 M36 23 H60 M36 28 H60" stroke="#3B3350" stroke-width="1.6" stroke-linecap="round" opacity="0.5"/>` +
        `<path d="M58 40 Q60 48 70 50" fill="none" stroke="#3B3350" stroke-width="2.2" stroke-linecap="round"/>`,
    },
  },

  // --- Dator (72×68): skärmen i profil, tangentbordet framför --------------
  dator: {
    sida: {
      viewBox: "0 0 40 68",
      art:
        shadow(20, 64, 17) +
        `<rect x="8" y="45" width="22" height="5" rx="2.5" fill="#7E97B8" ${LINE}/>` +
        `<path d="M17 47 L19 34 L25 34 L23 47 Z" fill="#7E97B8" ${LINE}/>` +
        `<path d="M20 10 L14 13 L14 31 L20 34 Z" fill="#5B6B91" ${THIN}/>` +
        `<rect x="20" y="4" width="7" height="36" rx="3" fill="#46557A" ${LINE}/>` +
        `<path d="M28.5 8 L28.5 36" stroke="#9BD3EF" stroke-width="2" stroke-linecap="round"/>` +
        `<path d="M26 64 L38 64 L38 60 L28 61.5 Z" fill="#A9C2DE" ${THIN}/>`,
    },
    bak: {
      viewBox: "0 0 72 68",
      art:
        shadow(36, 64, 30) +
        `<path d="M36 47 Q30 58 16 60" fill="none" stroke="#3B3350" stroke-width="2.2" stroke-linecap="round"/>` +
        `<rect x="24" y="45" width="24" height="5" rx="2.5" fill="#7E97B8" ${LINE}/>` +
        `<rect x="33" y="36" width="6" height="11" fill="#7E97B8" ${LINE}/>` +
        `<rect x="8" y="4" width="56" height="36" rx="6" fill="#46557A" ${LINE}/>` +
        `<rect x="22" y="10" width="28" height="22" rx="5" fill="#5B6B91" ${THIN}/>` +
        stjarna(36, 21, 1.1, "#9BD3EF"),
    },
  },

  // --- Bokhylla (78×110): sidan = gavel, baksidan = panelbrädor ------------
  bokhylla: {
    sida: {
      viewBox: "0 0 34 110",
      art:
        shadow(17, 104, 14) +
        `<path d="M6 100 L6 22 Q6 8 17 7 Q28 8 28 22 L28 100 Z" fill="${WOOD}" ${LINE}/>` +
        `<path d="M23 12 Q26.5 16 26.5 22 L26.5 98 L23 98 Z" fill="${WOOD_DARK}" stroke="none" opacity="0.7"/>` +
        `<path d="M10 96 L10 24 Q10 13 17 11.5" fill="none" stroke="${WOOD_LIGHT}" stroke-width="2.4" stroke-linecap="round"/>` +
        `<path d="M13 40 Q16 46 13 52 M15 70 Q18 76 15 82" ${ADRING}/>` +
        `<path d="M28 88 Q34 84 32 78 Q28 80 28 88" fill="#6FC66F" ${THIN}/>`,
    },
    bak: {
      viewBox: "0 0 78 110",
      art:
        shadow(39, 104, 32) +
        `<path d="M10 100 L10 22 Q10 6 39 6 Q68 6 68 22 L68 100 Z" fill="${WOOD}" ${LINE}/>` +
        `<path d="M26 10 L26 100 M39 6 L39 100 M52 10 L52 100" ${ADRING}/>` +
        `<path d="M10 42 L68 42 M10 68 L68 68" fill="none" ${THIN} opacity="0.5"/>` +
        `<circle cx="18" cy="24" r="1.4" fill="${WOOD_DARK}"/><circle cx="60" cy="24" r="1.4" fill="${WOOD_DARK}"/>` +
        `<circle cx="18" cy="90" r="1.4" fill="${WOOD_DARK}"/><circle cx="60" cy="90" r="1.4" fill="${WOOD_DARK}"/>`,
    },
  },

  // --- Byrå (72×88): lådornas knoppar sticker ut, prylarna på toppen ------
  byra: {
    sida: {
      viewBox: "0 0 40 88",
      art:
        shadow(20, 83, 16) +
        limb("M10 74 L9 81", WOOD_DARK, 4) +
        limb("M30 74 L31 81", WOOD_DARK, 4) +
        `<rect x="10" y="10" width="14" height="4.5" rx="2" fill="#7FC7E8" ${THIN}/>` +
        `<rect x="11" y="5.5" width="12" height="4.5" rx="2" fill="#EF6F6C" ${THIN}/>` +
        `<path d="M26 15 L28 3 L31 3 L29 15 Z" fill="#F7C948" ${THIN}/>` +
        `<rect x="6" y="16" width="28" height="58" rx="5" fill="${WOOD}" ${LINE}/>` +
        `<rect x="10" y="19" width="14" height="3.5" rx="1.7" fill="${WOOD_LIGHT}" stroke="none"/>` +
        `<path d="M30 25 L30 72" fill="none" ${THIN}/>` +
        `<circle cx="36" cy="31.5" r="2.2" fill="${WOOD_DARK}"/><circle cx="36" cy="48.5" r="2.2" fill="${WOOD_DARK}"/>` +
        `<circle cx="36" cy="65.5" r="2.2" fill="${WOOD_DARK}"/>`,
    },
    bak: {
      viewBox: "0 0 72 88",
      art:
        shadow(36, 83, 30) +
        limb("M14 74 L12 81", WOOD_DARK, 4) +
        limb("M58 74 L60 81", WOOD_DARK, 4) +
        `<rect x="40" y="10" width="18" height="4.5" rx="2" fill="#7FC7E8" ${THIN}/>` +
        `<rect x="42" y="5.5" width="14" height="4.5" rx="2" fill="#EF6F6C" ${THIN}/>` +
        `<path d="M22 9 L27 15" fill="none" stroke="${WOOD_DARK}" stroke-width="2.2" stroke-linecap="round"/>` +
        `<rect x="14" y="2" width="16" height="13" rx="2" fill="#F7C948" ${THIN}/>` +
        `<rect x="8" y="16" width="56" height="58" rx="5" fill="${WOOD}" ${LINE}/>` +
        `<path d="M12 35 H60 M12 55 H60" ${ADRING}/>`,
    },
  },

  // --- Garderob (78×116): sidan = gaveln, baksidan = panelbrädor ----------
  garderob: {
    sida: {
      viewBox: "0 0 44 116",
      art:
        shadow(22, 110, 18) +
        limb("M10 100 L9 108", WOOD_DARK, 4) +
        limb("M34 100 L35 108", WOOD_DARK, 4) +
        `<rect x="6" y="8" width="32" height="94" rx="6" fill="${WOOD}" ${LINE}/>` +
        `<rect x="10" y="12" width="22" height="86" rx="3" fill="${WOOD_LIGHT}" stroke="none"/>` +
        `<path d="M35 12 L35 98" fill="none" ${THIN}/>` +
        `<circle cx="39.5" cy="56" r="2.4" fill="${WOOD_DARK}"/>` +
        stjarna(21, 32, 1.1, "#7FC7E8"),
    },
    bak: {
      viewBox: "0 0 78 116",
      art:
        shadow(39, 110, 32) +
        limb("M18 100 L16 108", WOOD_DARK, 4) +
        limb("M60 100 L62 108", WOOD_DARK, 4) +
        `<rect x="10" y="8" width="58" height="94" rx="6" fill="${WOOD}" ${LINE}/>` +
        `<path d="M24 12 V98 M39 12 V98 M54 12 V98" ${ADRING}/>`,
    },
  },

  // --- Kylskåp (66×112): handtagen i profil, baksidan = kylslingan --------
  kylskap: {
    sida: {
      viewBox: "0 0 40 112",
      art:
        shadow(20, 106, 16) +
        `<rect x="6" y="6" width="28" height="100" rx="8" fill="#A9C2DE" ${LINE}/>` +
        `<path d="M11 14 V96" stroke="#C6D6E8" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M28 8 V104" fill="none" ${THIN}/>` +
        `<path d="M28 44 H34" fill="none" ${LINE}/>` +
        `<rect x="33" y="14" width="4" height="18" rx="2" fill="${WOOD_DARK}" ${THIN}/>` +
        `<rect x="33" y="52" width="4" height="26" rx="2" fill="${WOOD_DARK}" ${THIN}/>`,
    },
    bak: {
      viewBox: "0 0 66 112",
      art:
        shadow(33, 106, 27) +
        `<rect x="10" y="6" width="46" height="100" rx="8" fill="#A9C2DE" ${LINE}/>` +
        `<path d="M20 18 H46 Q50 18 50 22 Q50 26 46 26 H20 Q16 26 16 30 Q16 34 20 34 H46 Q50 34 50 38 Q50 42 46 42 H20 Q16 42 16 46 Q16 50 20 50 H46 Q50 50 50 54 Q50 58 46 58 H20 Q16 58 16 62 Q16 66 20 66 H46 Q50 66 50 70 Q50 74 46 74 H20" fill="none" stroke="#7E97B8" stroke-width="2.4" stroke-linecap="round"/>` +
        `<rect x="18" y="86" width="30" height="12" rx="3" fill="#7E97B8" ${THIN}/>` +
        `<path d="M23 89 V95 M29 89 V95 M35 89 V95 M41 89 V95" stroke="#3B3350" stroke-width="1.6" stroke-linecap="round" opacity="0.5"/>`,
    },
  },

  // --- Nattduksbord (62×82): lampan är rund, skåpet har fram och bak ------
  nattduksbord: {
    sida: {
      viewBox: "0 0 40 82",
      art:
        shadow(20, 77, 16) +
        `<ellipse cx="20" cy="30" rx="9" ry="3" fill="#FDE9A8" opacity="0.7"/>` +
        `<path d="M13 12 L27 12 L31 29 L9 29 Z" fill="#F7C948" ${LINE}/>` +
        `<path d="M20 29 L20 14" fill="none" stroke="#F2A93B" stroke-width="2.4" stroke-linecap="round"/>` +
        limb("M10 62 L9 76", WOOD_DARK, 4) +
        limb("M30 62 L31 76", WOOD_DARK, 4) +
        `<rect x="6" y="32" width="28" height="34" rx="5" fill="${WOOD}" ${LINE}/>` +
        `<path d="M30 37 L30 62" fill="none" ${THIN}/>` +
        `<circle cx="35.5" cy="42.5" r="2" fill="${WOOD_DARK}"/><circle cx="35.5" cy="56.5" r="2" fill="${WOOD_DARK}"/>`,
    },
    bak: {
      viewBox: "0 0 62 82",
      art:
        shadow(31, 77, 24) +
        `<ellipse cx="31" cy="30" rx="13" ry="3.4" fill="#FDE9A8" opacity="0.7"/>` +
        `<path d="M22 12 L40 12 L45 29 L17 29 Z" fill="#F7C948" ${LINE}/>` +
        `<path d="M31 29 L31 14" fill="none" stroke="#F2A93B" stroke-width="2.4" stroke-linecap="round"/>` +
        limb("M14 62 L12 76", WOOD_DARK, 4) +
        limb("M48 62 L50 76", WOOD_DARK, 4) +
        `<rect x="8" y="32" width="46" height="34" rx="5" fill="${WOOD}" ${LINE}/>` +
        `<path d="M12 49 H50" ${ADRING}/>`,
    },
  },
};
