// ============================================================================
// Pluggportalen – klädselkonst: ANSIKTE-slotens plagg
// ----------------------------------------------------------------------------
// Del av WEARABLES-registret (se art-wearables.js). Ansiktssaker använder
// par "xMidYMid" och sitter över ögonlinjen. Följ stilguiden i art-style.js.
// Id:na måste matcha shop-items.js exakt (sparas i Firestore).
// ============================================================================

import { LINE, THIN } from "./art-style.js";

export const ANSIKTE_WEARABLES = {
  glasogon: {
    viewBox: "0 0 60 22",
    par: "xMidYMid",
    art:
      `<path d="M2 5 L8 5 M58 5 L52 5" fill="none" ${LINE}/>` +
      `<path d="M26 7 Q30 4 34 7" fill="none" ${LINE}/>` +
      `<rect x="7" y="3" width="20" height="16" rx="7" fill="#46405C" ${LINE}/>` +
      `<rect x="33" y="3" width="20" height="16" rx="7" fill="#46405C" ${LINE}/>` +
      `<path d="M12 8 Q15 5 19 6" fill="none" stroke="#8f89a6" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M38 8 Q41 5 45 6" fill="none" stroke="#8f89a6" stroke-width="2.4" stroke-linecap="round"/>`,
  },
  "glad-mask": {
    viewBox: "0 0 60 26",
    par: "xMidYMid",
    art:
      `<path d="M30 2 Q56 2 57 9 Q58 24 44 24 Q36 24 30 19 Q24 24 16 24 Q2 24 3 9 Q4 2 30 2 Z" fill="#F7C948" ${LINE}/>` +
      `<path d="M11 11 Q16 6 21 11" fill="none" ${THIN}/>` +
      `<path d="M39 11 Q44 6 49 11" fill="none" ${THIN}/>` +
      `<circle cx="10" cy="17" r="2.6" fill="#FFB1B8" stroke="none"/>` +
      `<circle cx="50" cy="17" r="2.6" fill="#FFB1B8" stroke="none"/>`,
  },
  pilotglasogon: {
    viewBox: "0 0 60 24",
    par: "xMidYMid",
    art:
      `<path d="M2 8 L9 9 M58 8 L51 9" fill="none" stroke="#F2A93B" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M25 10 Q30 7 35 10" fill="none" stroke="#F2A93B" stroke-width="3" stroke-linecap="round"/>` +
      `<circle cx="16" cy="12" r="9" fill="#D9F0FA" stroke="#F2A93B" stroke-width="3"/>` +
      `<circle cx="44" cy="12" r="9" fill="#D9F0FA" stroke="#F2A93B" stroke-width="3"/>` +
      `<path d="M11 9 Q14 6 18 8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>` +
      `<path d="M39 9 Q42 6 46 8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`,
  },
  ogonlapp: {
    viewBox: "0 0 60 26",
    par: "xMidYMid",
    art:
      `<path d="M4 6 L56 17" fill="none" ${LINE}/>` +
      `<ellipse cx="20" cy="13" rx="10" ry="9" fill="#4C4661" ${LINE}/>` +
      `<path d="M14 9 Q18 7 22 8" fill="none" stroke="#6E6784" stroke-width="2.2" stroke-linecap="round"/>` +
      `<path d="M40 12 Q44 9 48 12" fill="none" ${THIN}/>`,
  },

  // --- Issue #32 – nya ansiktssaker ----------------------------------------
  mustasch: {
    viewBox: "0 0 60 24",
    par: "xMidYMid",
    art:
      `<path d="M30 7 Q28 13 21 13 Q10 13 5 4 Q9 18 22 17 Q28 17 30 11 Q32 17 38 17 Q51 18 55 4 Q50 13 39 13 Q32 13 30 7 Z" fill="#8A6242" ${LINE}/>` +
      `<path d="M14 9 Q18 12 22 12 M46 9 Q42 12 38 12" fill="none" stroke="#6B4A32" stroke-width="1.8" stroke-linecap="round"/>`,
  },
  monokel: {
    viewBox: "0 0 60 26",
    par: "xMidYMid",
    art:
      `<circle cx="38" cy="11" r="9" fill="#D9F0FA" stroke="#F2A93B" stroke-width="3"/>` +
      `<path d="M34 8 Q37 5 41 7" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>` +
      `<path d="M38 20 Q33 25 27 24" fill="none" ${THIN}/>` +
      `<circle cx="27" cy="24" r="2.4" fill="#F7C948" ${THIN}/>`,
  },
  hjartglasogon: {
    viewBox: "0 0 60 26",
    par: "xMidYMid",
    art:
      `<path d="M2 6 L9 8 M58 6 L51 8" fill="none" ${LINE}/>` +
      `<path d="M22 8 Q30 5 38 8" fill="none" ${LINE}/>` +
      `<path transform="translate(15 12)" d="M0 3 C-1 -3 -9 -2 -9 4 C-9 9 -2 12 0 15 C2 12 9 9 9 4 C9 -2 1 -3 0 3 Z" fill="#F890B7" ${LINE}/>` +
      `<path transform="translate(45 12)" d="M0 3 C-1 -3 -9 -2 -9 4 C-9 9 -2 12 0 15 C2 12 9 9 9 4 C9 -2 1 -3 0 3 Z" fill="#F890B7" ${LINE}/>` +
      `<path d="M10 9 Q13 7 16 8 M40 9 Q43 7 46 8" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`,
  },
  snorkelmask: {
    viewBox: "0 0 60 30",
    par: "xMidYMid",
    art:
      `<path d="M50 9 L56 9 L56 25 Q56 28 53 28 Q50 28 50 25 L50 20" fill="none" stroke="#EF6F6C" stroke-width="4.5" stroke-linecap="round"/>` +
      `<rect x="9" y="3" width="42" height="19" rx="9" fill="#58C6A9" ${LINE}/>` +
      `<rect x="13" y="6" width="34" height="13" rx="6" fill="#D9F0FA" ${THIN}/>` +
      `<path d="M17 9 Q22 6 28 8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`,
  },
};
