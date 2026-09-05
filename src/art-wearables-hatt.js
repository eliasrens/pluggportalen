// ============================================================================
// Pluggportalen – klädselkonst: HATT-slotens plagg
// ----------------------------------------------------------------------------
// Del av WEARABLES-registret (se art-wearables.js). Alla hattar använder
// par "xMidYMax" så de sjunker ner mot hjässan. Följ stilguiden i art-style.js.
// Id:na måste matcha shop-items.js exakt (sparas i Firestore).
// ============================================================================

import { LINE, THIN } from "./art-style.js";

export const HATT_WEARABLES = {
  keps: {
    viewBox: "0 0 60 36",
    par: "xMidYMax",
    art:
      `<path d="M9 24 Q9 5 30 5 Q51 5 51 24 Z" fill="#EF6F6C" ${LINE}/>` +
      `<path d="M30 5 Q34 12 33 24" fill="none" ${THIN}/>` +
      `<circle cx="30" cy="4.5" r="2.6" fill="#F7C948" ${THIN}/>` +
      `<path d="M6 24 Q30 18 54 24 Q56 30 52 30 Q30 25 8 30 Q4 30 6 24 Z" fill="#D95550" ${LINE}/>`,
  },
  partyhatt: {
    viewBox: "0 0 40 46",
    par: "xMidYMax",
    art:
      `<path d="M20 6 L35 43 L5 43 Z" fill="#7FC7E8" ${LINE}/>` +
      `<circle cx="14" cy="34" r="2.2" fill="#F7C948" stroke="none"/>` +
      `<circle cx="24" cy="27" r="2.2" fill="#EF6F6C" stroke="none"/>` +
      `<circle cx="19" cy="18" r="2" fill="#F890B7" stroke="none"/>` +
      `<circle cx="27" cy="37" r="2.2" fill="#6FC66F" stroke="none"/>` +
      `<circle cx="20" cy="5" r="4" fill="#F7C948" ${THIN}/>`,
  },
  krona: {
    viewBox: "0 0 56 38",
    par: "xMidYMax",
    art:
      `<path d="M5 33 L5 10 L17 21 L28 4 L39 21 L51 10 L51 33 Z" fill="#F7C948" ${LINE}/>` +
      `<circle cx="28" cy="27" r="3" fill="#EF6F6C" ${THIN}/>` +
      `<circle cx="14" cy="28" r="2.2" fill="#7FC7E8" ${THIN}/>` +
      `<circle cx="42" cy="28" r="2.2" fill="#7FC7E8" ${THIN}/>`,
  },
  tomtemossa: {
    viewBox: "0 0 58 44",
    par: "xMidYMax",
    art:
      `<path d="M10 32 Q12 6 30 6 Q46 6 48 20 Q49 27 44 32 Z" fill="#EF6F6C" ${LINE}/>` +
      `<circle cx="50" cy="32" r="5" fill="#fff" ${THIN}/>` +
      `<path d="M7 31 Q27 27 46 31 Q48 39 44 39 Q27 35 10 39 Q6 39 7 31 Z" fill="#fff" ${LINE}/>`,
  },
  trollkarlshatt: {
    viewBox: "0 0 60 50",
    par: "xMidYMax",
    art:
      `<path d="M30 3 Q40 20 43 36 L17 36 Q20 20 30 3 Z" fill="#B79BE0" ${LINE}/>` +
      `<path d="M16 36 L44 36 Q46 40 43 41 L17 41 Q14 40 16 36 Z" fill="#9C7ED0" ${LINE}/>` +
      `<ellipse cx="30" cy="44" rx="26" ry="5.5" fill="#B79BE0" ${LINE}/>` +
      `<path d="M30 16 L31.6 19.6 L35.5 20 L32.6 22.6 L33.4 26.4 L30 24.4 L26.6 26.4 L27.4 22.6 L24.5 20 L28.4 19.6 Z" fill="#F7C948" stroke="none"/>` +
      `<circle cx="35" cy="30" r="1.8" fill="#F7C948" stroke="none"/>`,
  },
  vintermossa: {
    viewBox: "0 0 56 42",
    par: "xMidYMax",
    art:
      `<path d="M8 32 Q8 6 28 6 Q48 6 48 32 Z" fill="#7FC7E8" ${LINE}/>` +
      `<path d="M18 10 L16 31 M28 7 L28 32 M38 10 L40 31" fill="none" ${THIN}/>` +
      `<rect x="5" y="29" width="46" height="10" rx="5" fill="#5FB0D8" ${LINE}/>` +
      `<path d="M9 34 L47 34" fill="none" ${THIN}/>` +
      `<circle cx="28" cy="5" r="4.6" fill="#fff" ${THIN}/>`,
  },
  strahatt: {
    viewBox: "0 0 64 38",
    par: "xMidYMax",
    art:
      `<ellipse cx="32" cy="28" rx="30" ry="8" fill="#F2A93B" ${LINE}/>` +
      `<path d="M15 26 Q16 7 32 7 Q48 7 49 26 Z" fill="#F7C948" ${LINE}/>` +
      `<path d="M15 24 Q32 30 49 24 L49 27 Q32 33 15 27 Z" fill="#EF6F6C" ${LINE}/>` +
      `<path d="M20 15 Q26 11 32 12" fill="none" stroke="#FDE9A8" stroke-width="2.2" stroke-linecap="round"/>`,
  },
  cowboyhatt: {
    viewBox: "0 0 64 42",
    par: "xMidYMax",
    art:
      `<path d="M4 31 Q32 22 60 31 Q32 41 4 31 Z" fill="#B0805A" ${LINE}/>` +
      `<path d="M18 31 Q17 12 24 9 Q32 6 40 9 Q47 12 46 31 Z" fill="#C9996B" ${LINE}/>` +
      `<path d="M18 27 Q32 32 46 27" fill="none" stroke="#8A6242" stroke-width="3.4" stroke-linecap="round"/>` +
      `<path d="M32 15 L33.4 18.4 L37 18.7 L34.2 21.1 L35 24.6 L32 22.7 L29 24.6 L29.8 21.1 L27 18.7 L30.6 18.4 Z" fill="#F7C948" ${THIN}/>`,
  },

  // --- Issue #32 – nya hattar ----------------------------------------------
  kockmossa: {
    viewBox: "0 0 56 46",
    par: "xMidYMax",
    art:
      `<path d="M13 35 Q5 35 5 25 Q1 17 9 12 Q10 4 20 6 Q24 1 30 5 Q39 2 42 9 Q51 10 49 21 Q53 31 43 35 Z" fill="#ffffff" ${LINE}/>` +
      `<path d="M18 14 Q16 26 18 34 M30 10 Q29 24 30 34 M40 15 Q42 26 40 34" fill="none" ${THIN}/>` +
      `<rect x="11" y="32" width="34" height="11" rx="4" fill="#FFF3DC" ${LINE}/>`,
  },
  vikinghjalm: {
    viewBox: "0 0 64 44",
    par: "xMidYMax",
    art:
      `<path d="M12 34 Q5 20 10 6 Q19 12 18 24 Z" fill="#FFF3DC" ${LINE}/>` +
      `<path d="M52 34 Q59 20 54 6 Q45 12 46 24 Z" fill="#FFF3DC" ${LINE}/>` +
      `<path d="M13 33 Q13 9 32 9 Q51 9 51 33 Z" fill="#A8BAD1" ${LINE}/>` +
      `<path d="M32 11 L32 33" fill="none" ${THIN}/>` +
      `<rect x="9" y="31" width="46" height="9" rx="4" fill="#8A6242" ${LINE}/>` +
      `<circle cx="16" cy="35.5" r="1.9" fill="#F7C948" stroke="none"/>` +
      `<circle cx="48" cy="35.5" r="1.9" fill="#F7C948" stroke="none"/>`,
  },
  riddarhjalm: {
    viewBox: "0 0 52 50",
    par: "xMidYMax",
    art:
      `<path d="M26 10 Q25 -1 34 1 Q30 8 30 15" fill="#EF6F6C" ${LINE}/>` +
      `<path d="M12 42 Q12 9 26 9 Q40 9 40 42 Z" fill="#C4CBD8" ${LINE}/>` +
      `<rect x="10" y="24" width="32" height="5" rx="2.5" fill="#46557A" ${THIN}/>` +
      `<path d="M15 34 L37 34 M16 39 L36 39" fill="none" ${THIN}/>` +
      `<path d="M26 12 L26 22" fill="none" ${THIN}/>`,
  },
  djuroron: {
    viewBox: "0 0 60 30",
    par: "xMidYMax",
    art:
      `<path d="M7 27 Q30 17 53 27" fill="none" stroke="#4C4661" stroke-width="4" stroke-linecap="round"/>` +
      `<circle cx="14" cy="12" r="9" fill="#4C4661" ${LINE}/>` +
      `<circle cx="46" cy="12" r="9" fill="#4C4661" ${LINE}/>` +
      `<circle cx="14" cy="12" r="4.4" fill="#F890B7" stroke="none"/>` +
      `<circle cx="46" cy="12" r="4.4" fill="#F890B7" stroke="none"/>`,
  },
};
