// ============================================================================
// Pluggportalen – klädselkonst: HALS-slotens plagg
// ----------------------------------------------------------------------------
// Del av WEARABLES-registret (se art-wearables.js). Halssaker använder
// par "xMidYMin" så de hänger från halslinjen. Följ stilguiden i art-style.js.
// Id:na måste matcha shop-items.js exakt (sparas i Firestore).
// ============================================================================

import { LINE, THIN } from "./art-style.js";

export const HALS_WEARABLES = {
  halsduk: {
    viewBox: "0 0 48 42",
    par: "xMidYMin",
    art:
      `<path d="M5 4 Q24 14 43 4 Q46 10 43 14 Q24 24 5 14 Q2 10 5 4 Z" fill="#EF6F6C" ${LINE}/>` +
      `<path d="M27 16 L38 16 Q40 28 36 37 L28 37 Q25 26 27 16 Z" fill="#EF6F6C" ${LINE}/>` +
      `<path d="M29 37 L29 41 M32.5 37 L32.5 41 M36 37 L36 41" fill="none" ${THIN}/>` +
      `<path d="M10 8.5 Q24 16 38 8.5" fill="none" stroke="#D95550" stroke-width="2.4" stroke-linecap="round"/>`,
  },
  medalj: {
    viewBox: "0 0 36 48",
    par: "xMidYMin",
    art:
      `<path d="M6 2 L18 22 L30 2 L23 2 L18 11 L13 2 Z" fill="#7FC7E8" ${LINE}/>` +
      `<circle cx="18" cy="32" r="12" fill="#F7C948" ${LINE}/>` +
      `<circle cx="18" cy="32" r="8" fill="none" ${THIN}/>` +
      `<path d="M18 27 L19.5 30 L23 30.5 L20.5 33 L21 36.5 L18 34.8 L15 36.5 L15.5 33 L13 30.5 L16.5 30 Z" fill="#D9912A" stroke="none"/>`,
  },
  fluga: {
    viewBox: "0 0 48 26",
    par: "xMidYMin",
    art:
      `<path d="M24 13 L6 4 Q1 13 6 22 Z" fill="#EF6F6C" ${LINE}/>` +
      `<path d="M24 13 L42 4 Q47 13 42 22 Z" fill="#EF6F6C" ${LINE}/>` +
      `<path d="M11 9 Q9 13 11 17 M37 9 Q39 13 37 17" fill="none" ${THIN}/>` +
      `<rect x="19" y="7" width="10" height="12" rx="3" fill="#D95550" ${LINE}/>`,
  },
  slips: {
    viewBox: "0 0 34 48",
    par: "xMidYMin",
    art:
      `<path d="M11 3 L23 3 L26 12 L8 12 Z" fill="#46557A" ${LINE}/>` +
      `<path d="M10 12 L24 12 L20 40 L17 45 L14 40 Z" fill="#7FC7E8" ${LINE}/>` +
      `<path d="M12 20 L21 20 M13 28 L20 28 M14 35 L19 35" fill="none" stroke="#5FB0D8" stroke-width="2.2" stroke-linecap="round"/>`,
  },

  // --- Issue #32 – nya halssaker -------------------------------------------
  parlhalsband: {
    viewBox: "0 0 48 34",
    par: "xMidYMin",
    art:
      `<path d="M6 4 Q24 28 42 4" fill="none" stroke="#A8BAD1" ${THIN}/>` +
      `<circle cx="6" cy="4" r="3" fill="#ffffff" ${THIN}/>` +
      `<circle cx="13" cy="12" r="3" fill="#ffffff" ${THIN}/>` +
      `<circle cx="19" cy="16" r="3" fill="#ffffff" ${THIN}/>` +
      `<circle cx="29" cy="16" r="3" fill="#ffffff" ${THIN}/>` +
      `<circle cx="35" cy="12" r="3" fill="#ffffff" ${THIN}/>` +
      `<circle cx="42" cy="4" r="3" fill="#ffffff" ${THIN}/>` +
      `<circle cx="24" cy="20" r="5" fill="#7FC7E8" ${LINE}/>`,
  },
  cape: {
    viewBox: "0 0 52 44",
    par: "xMidYMin",
    art:
      `<path d="M6 8 Q26 4 46 8 L42 40 Q26 46 10 40 Z" fill="#EF6F6C" ${LINE}/>` +
      `<path d="M16 11 L14 39 M26 9 L26 43 M36 11 L38 39" fill="none" ${THIN}/>` +
      `<path d="M8 4 Q26 12 44 4 Q47 9 44 13 Q26 21 8 13 Q5 9 8 4 Z" fill="#F7C948" ${LINE}/>`,
  },
  fjaderboa: {
    viewBox: "0 0 52 30",
    par: "xMidYMin",
    art:
      `<path d="M6 6 Q26 26 46 6" fill="none" stroke="#F890B7" stroke-width="4" stroke-linecap="round"/>` +
      `<circle cx="7" cy="7" r="6" fill="#F890B7" ${THIN}/>` +
      `<circle cx="15" cy="15" r="6.5" fill="#FFB1B8" ${THIN}/>` +
      `<circle cx="23" cy="20" r="7" fill="#F890B7" ${THIN}/>` +
      `<circle cx="31" cy="19" r="6.5" fill="#FFB1B8" ${THIN}/>` +
      `<circle cx="39" cy="14" r="6.5" fill="#F890B7" ${THIN}/>` +
      `<circle cx="46" cy="7" r="6" fill="#FFB1B8" ${THIN}/>`,
  },
  amulett: {
    viewBox: "0 0 44 42",
    par: "xMidYMin",
    art:
      `<path d="M7 4 L22 26 L37 4" fill="none" stroke="#8A6242" ${LINE}/>` +
      `<path d="M22 15 L31 24 L22 37 L13 24 Z" fill="#58C6A9" ${LINE}/>` +
      `<path d="M13 24 L31 24 M22 15 L22 37" fill="none" ${THIN}/>` +
      `<path d="M17 20 Q19 18 21 19" fill="none" stroke="#C9F0DC" stroke-width="2" stroke-linecap="round"/>`,
  },
};
