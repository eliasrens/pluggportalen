// ============================================================================
// Pluggportalen – klädselkonst: RYGG-slotens plagg (manteln)
// ----------------------------------------------------------------------------
// Del av WEARABLES-registret (se art-wearables.js). Rygg-saker ritas BAKOM
// figuren (lägre i DOM än af-base, se avatarMarkup i avatars.js) och hänger
// från axel-/halslinjen med par "xMidYMin". CSS-boxen är .af-wear.af-rygg i
// styles.css. Följ stilguiden i art-style.js. Id:na måste matcha shop-items.js
// exakt (sparas i Firestore).
// ============================================================================

import { LINE, THIN } from "./art-style.js";

export const RYGG_WEARABLES = {
  cape: {
    viewBox: "0 0 52 44",
    par: "xMidYMin",
    art:
      `<path d="M6 8 Q26 4 46 8 L42 40 Q26 46 10 40 Z" fill="#EF6F6C" ${LINE}/>` +
      `<path d="M16 11 L14 39 M26 9 L26 43 M36 11 L38 39" fill="none" ${THIN}/>` +
      `<path d="M8 4 Q26 12 44 4 Q47 9 44 13 Q26 21 8 13 Q5 9 8 4 Z" fill="#F7C948" ${LINE}/>`,
  },
};
