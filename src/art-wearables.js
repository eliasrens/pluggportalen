// ============================================================================
// Pluggportalen – klädselkonst (inline SVG för shopens "klader"-saker)
// ----------------------------------------------------------------------------
// Följer stilguiden i art-style.js (samma kontur, palett och mjuka former).
// Varje sak ritas TAJT i sin egen viewBox; positioneringen på figuren görs av
// CSS-slot-boxarna (.af-wear.af-<slot> i styles.css) som är satta i % av
// avatar-containern och därmed träffar samma ankargrid på ALLA karaktärer
// (se ankargriddet i art-style.js). `par` styr hur saken ankras i sin box:
// hattar sjunker ner mot hjässan (xMidYMax), halssaker hänger från halslinjen
// (xMidYMin), osv.
//
// Id:na måste matcha shop-items.js exakt (sparas i Firestore).
// ============================================================================

import { LINE, THIN } from "./art-style.js";
import { getItem } from "./shop-items.js";

/** id → { viewBox, par (preserveAspectRatio), art } */
export const WEARABLES = {
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
};

/**
 * Fristående SVG för en klädsak, eller null om saken inte har SVG-konst
 * (då visar anroparen emoji-fältet från shop-items.js som fallback).
 */
export function wearableSvg(id) {
  const w = WEARABLES[id];
  if (!w) return null;
  const name = (getItem(id) || {}).name || id;
  return (
    `<svg viewBox="${w.viewBox}" role="img" aria-label="${name}" ` +
    `preserveAspectRatio="${w.par} meet" xmlns="http://www.w3.org/2000/svg">${w.art}</svg>`
  );
}
