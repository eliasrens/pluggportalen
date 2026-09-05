// ============================================================================
// Pluggportalen – klädselkonst: HAND-slotens plagg
// ----------------------------------------------------------------------------
// Del av WEARABLES-registret (se art-wearables.js). Handsaker använder
// par "xMidYMax" och hålls i figurens hand. Följ stilguiden i art-style.js.
// Id:na måste matcha shop-items.js exakt (sparas i Firestore).
// ============================================================================

import { LINE, THIN, O } from "./art-style.js";

export const HAND_WEARABLES = {
  ballong: {
    viewBox: "0 0 36 62",
    par: "xMidYMax",
    art:
      `<ellipse cx="18" cy="18" rx="14" ry="16" fill="#EF6F6C" ${LINE}/>` +
      `<ellipse cx="13" cy="12" rx="4" ry="5.5" fill="#ffffff" opacity="0.45"/>` +
      `<path d="M15 34 L21 34 L18 38 Z" fill="#D95550" ${THIN}/>` +
      `<path d="M18 38 Q12 46 19 52 Q24 56 18 60" fill="none" ${THIN}/>`,
  },
  trollstav: {
    viewBox: "0 0 44 62",
    par: "xMidYMax",
    art:
      `<path d="M20 20 L20 58" stroke="#8A6242" stroke-width="7" stroke-linecap="round"/>` +
      `<path d="M20 20 L20 58" stroke="#B0805A" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M20 2 L23.4 9.6 L31.5 10.4 L25.5 15.9 L27.2 23.9 L20 19.8 L12.8 23.9 L14.5 15.9 L8.5 10.4 L16.6 9.6 Z" fill="#F7C948" ${LINE}/>` +
      `<path d="M35 20 L35 27 M31.5 23.5 L38.5 23.5" fill="none" stroke="#F7C948" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M7 32 L7 38 M4 35 L10 35" fill="none" stroke="#7FC7E8" stroke-width="2.2" stroke-linecap="round"/>`,
  },
  svard: {
    viewBox: "0 0 34 62",
    par: "xMidYMax",
    art:
      `<path d="M17 2 Q22 8 22 16 L22 38 L12 38 L12 16 Q12 8 17 2 Z" fill="#C4CBD8" ${LINE}/>` +
      `<path d="M17 7 L17 36" fill="none" stroke="#9aa3b5" stroke-width="2" stroke-linecap="round"/>` +
      `<rect x="4" y="38" width="26" height="7" rx="3.5" fill="#B0805A" ${LINE}/>` +
      `<path d="M17 45 L17 56" stroke="#8A6242" stroke-width="7" stroke-linecap="round"/>` +
      `<circle cx="17" cy="58" r="3.4" fill="#F7C948" ${THIN}/>`,
  },
  blomma: {
    viewBox: "0 0 40 62",
    par: "xMidYMax",
    art:
      `<path d="M20 24 L20 58" fill="none" stroke="#4FA85A" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M20 42 Q9 38 7 47 Q16 49 20 43 Z" fill="#6FC66F" ${THIN}/>` +
      `<circle cx="20" cy="8" r="7" fill="#F890B7" ${LINE}/>` +
      `<circle cx="30" cy="14" r="7" fill="#F890B7" ${LINE}/>` +
      `<circle cx="26" cy="25" r="7" fill="#F890B7" ${LINE}/>` +
      `<circle cx="14" cy="25" r="7" fill="#F890B7" ${LINE}/>` +
      `<circle cx="10" cy="14" r="7" fill="#F890B7" ${LINE}/>` +
      `<circle cx="20" cy="16" r="6" fill="#F7C948" ${THIN}/>`,
  },
  glasstrut: {
    viewBox: "0 0 36 62",
    par: "xMidYMax",
    art:
      `<path d="M10 30 L26 30 L18 58 Z" fill="#E0B98C" ${LINE}/>` +
      `<path d="M13 34 L21 43 M20 33 L26 39 M11 40 L16 46" fill="none" stroke="#B0805A" stroke-width="1.8" stroke-linecap="round"/>` +
      `<circle cx="18" cy="24" r="11" fill="#F890B7" ${LINE}/>` +
      `<circle cx="18" cy="13" r="8.5" fill="#58C6A9" ${LINE}/>` +
      `<path d="M18 5 Q18 2 21 2" fill="none" stroke="#4FA85A" stroke-width="2.2" stroke-linecap="round"/>` +
      `<circle cx="18" cy="5" r="3" fill="#EF6F6C" ${THIN}/>`,
  },
  bok: {
    viewBox: "0 0 44 54",
    par: "xMidYMax",
    art:
      `<rect x="9" y="9" width="28" height="40" rx="3" fill="#EF6F6C" ${LINE}/>` +
      `<rect x="9" y="9" width="7" height="40" rx="3" fill="#D95550" ${LINE}/>` +
      `<rect x="34" y="12" width="4" height="34" rx="1.5" fill="#FFF3DC" ${THIN}/>` +
      `<path d="M22 18 L23.4 21.4 L27 21.7 L24.2 24.1 L25 27.6 L22 25.7 L19 27.6 L19.8 24.1 L17 21.7 L20.6 21.4 Z" fill="#F7C948" stroke="none"/>` +
      `<path d="M20 34 L32 34 M20 39 L30 39" fill="none" stroke="#F7C948" stroke-width="2" stroke-linecap="round"/>`,
  },

  // --- Issue #32 – nya handsaker -------------------------------------------
  paraply: {
    viewBox: "0 0 48 64",
    par: "xMidYMax",
    art:
      `<path d="M24 6 L24 24" fill="none" stroke="#46557A" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M24 24 L24 54 Q24 60 17 60 Q12 60 12 55" fill="none" stroke="#8A6242" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M24 6 Q4 18 4 24 Q24 17 44 24 Q44 18 24 6 Z" fill="#EF6F6C" ${LINE}/>` +
      `<path d="M4 24 Q9 19 14 24 Q19 19 24 24 Q29 19 34 24 Q39 19 44 24" fill="none" ${THIN}/>` +
      `<path d="M14 24 Q14 13 24 8 M34 24 Q34 13 24 8" fill="none" stroke="#D95550" stroke-width="2" stroke-linecap="round"/>`,
  },
  gitarr: {
    viewBox: "0 0 40 64",
    par: "xMidYMax",
    art:
      `<rect x="16" y="3" width="8" height="8" rx="2" fill="#B0805A" ${LINE}/>` +
      `<rect x="17.5" y="9" width="5" height="24" rx="2" fill="#8A6242" ${LINE}/>` +
      `<path d="M20 27 Q31 28 31 39 Q31 44 27 47 Q34 51 34 57 Q34 63 20 63 Q6 63 6 57 Q6 51 13 47 Q9 44 9 39 Q9 28 20 27 Z" fill="#F2A93B" ${LINE}/>` +
      `<circle cx="20" cy="49" r="4.5" fill="#8A6242" ${THIN}/>` +
      `<rect x="16" y="55" width="8" height="4" rx="1.5" fill="#B0805A" ${THIN}/>` +
      `<path d="M18.5 11 L18.5 55 M21.5 11 L21.5 55" fill="none" stroke="#FFF3DC" stroke-width="1.2" stroke-linecap="round"/>`,
  },
  fiskespo: {
    viewBox: "0 0 44 64",
    par: "xMidYMax",
    art:
      `<path d="M9 60 L37 8" fill="none" stroke="#8A6242" stroke-width="4" stroke-linecap="round"/>` +
      `<circle cx="14" cy="52" r="4" fill="#EF6F6C" ${THIN}/>` +
      `<path d="M37 8 Q41 26 31 32" fill="none" ${THIN}/>` +
      `<path d="M25 36 Q33 31 33 39 Q33 46 25 41 L20 43 L23 39 L20 35 Z" fill="#7FC7E8" ${THIN}/>` +
      `<circle cx="29" cy="38" r="1.3" fill="${O}" stroke="none"/>`,
  },
  godisklubba: {
    viewBox: "0 0 40 64",
    par: "xMidYMax",
    art:
      `<rect x="18.5" y="20" width="3" height="40" rx="1.5" fill="#ffffff" ${THIN}/>` +
      `<circle cx="20" cy="18" r="15" fill="#ffffff" ${LINE}/>` +
      `<path d="M20 18 Q26 18 26 12 Q26 5 18 5 Q8 5 8 15 Q8 27 22 27 Q34 27 33 13" fill="none" stroke="#EF6F6C" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M20 18 Q23 18 23 15 Q23 11 19 11 Q14 11 14 16" fill="none" stroke="#F890B7" stroke-width="2.4" stroke-linecap="round"/>`,
  },
};
