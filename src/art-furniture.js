// ============================================================================
// Pluggportalen – möbelkonst (inline SVG för shopens "mobler"-saker)
// ----------------------------------------------------------------------------
// Följer stilguiden i art-style.js: kontur #3B3350, stroke 3 (tunt 2.2),
// mjuka rundade former, platt vektor och samma glada palett som karaktärerna.
// Varje sak ritas TAJT i sin egen viewBox och skalas av renderingen
// (preserveAspectRatio="xMidYMid meet"). Id:na måste matcha shop-items.js
// exakt (sparas i Firestore).
// ============================================================================

import { LINE, THIN, limb } from "./art-style.js";

const WOOD = "#B0805A";
const WOOD_DARK = "#8A6242";
const WOOD_LIGHT = "#E0B98C";

// Liten bokrygg i bokhyllan.
const book = (x, y, w, h, c) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.6" fill="${c}" ${THIN}/>`;
const tiltBook = (x, y, w, h, c) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.6" fill="${c}" ${THIN} ` +
  `transform="rotate(9 ${x + w / 2} ${y + h / 2})"/>`;

/** id → { viewBox, art } */
export const FURNITURE = {
  stol: {
    viewBox: "0 0 56 62",
    art:
      limb("M16 26 L11 56", WOOD_DARK, 5) +
      limb("M40 26 L45 56", WOOD_DARK, 5) +
      limb("M14 44 L42 44", WOOD_DARK, 4) +
      `<rect x="7" y="12" width="42" height="14" rx="7" fill="${WOOD}" ${LINE}/>` +
      `<rect x="13" y="16" width="18" height="4" rx="2" fill="${WOOD_LIGHT}" stroke="none"/>`,
  },
  sang: {
    viewBox: "0 0 74 54",
    art:
      limb("M13 44 L13 51", WOOD_DARK, 4) +
      limb("M61 44 L61 51", WOOD_DARK, 4) +
      `<rect x="4" y="8" width="9" height="38" rx="4" fill="${WOOD}" ${LINE}/>` +
      `<rect x="60" y="22" width="9" height="24" rx="4" fill="${WOOD}" ${LINE}/>` +
      `<rect x="9" y="26" width="54" height="15" rx="6" fill="#FFF3DC" ${LINE}/>` +
      `<rect x="33" y="26" width="30" height="15" rx="6" fill="#7FC7E8" ${LINE}/>` +
      `<path d="M33 32 L61 32" fill="none" ${THIN}/>` +
      `<rect x="13" y="18" width="19" height="12" rx="6" fill="#F890B7" ${LINE}/>` +
      `<path d="M18 24 Q22 22 27 24" fill="none" ${THIN}/>`,
  },
  lampa: {
    viewBox: "0 0 46 66",
    art:
      limb("M23 24 L23 56", WOOD, 4) +
      `<ellipse cx="23" cy="59" rx="13" ry="4.5" fill="${WOOD}" ${LINE}/>` +
      `<path d="M13 6 L33 6 L41 24 L5 24 Z" fill="#F7C948" ${LINE}/>` +
      `<path d="M17 9 L11 22" fill="none" stroke="#FDE9A8" stroke-width="2.4" stroke-linecap="round"/>` +
      `<ellipse cx="23" cy="26" rx="15" ry="3" fill="#FDE9A8" opacity="0.7"/>`,
  },
  bokhylla: {
    viewBox: "0 0 56 64",
    art:
      `<rect x="6" y="4" width="44" height="56" rx="4" fill="${WOOD}" ${LINE}/>` +
      `<path d="M8 25 L48 25 M8 43 L48 43" fill="none" ${LINE}/>` +
      // översta hyllan
      book(11, 8, 6, 15, "#EF6F6C") + book(18, 10, 5, 13, "#6FC66F") +
      book(24, 7, 6, 16, "#7FC7E8") + tiltBook(32, 9, 5, 13, "#F7C948") +
      book(40, 8, 6, 15, "#B79BE0") +
      // mellersta hyllan
      book(11, 28, 6, 13, "#F49E4C") + book(18, 26, 5, 15, "#58C6A9") +
      book(24, 29, 6, 12, "#F890B7") + book(31, 27, 6, 14, "#7FC7E8") +
      book(39, 28, 6, 13, "#EF6F6C") +
      // nedersta hyllan
      book(11, 46, 6, 13, "#B79BE0") + tiltBook(18, 47, 5, 12, "#F7C948") +
      book(25, 45, 6, 14, "#6FC66F") + book(33, 47, 6, 12, "#F08A3C") +
      book(40, 46, 6, 13, "#7FC7E8"),
  },
  dator: {
    viewBox: "0 0 60 62",
    art:
      `<rect x="27" y="35" width="6" height="8" fill="#7E97B8" ${LINE}/>` +
      `<rect x="19" y="42" width="22" height="5" rx="2.5" fill="#7E97B8" ${LINE}/>` +
      `<rect x="7" y="4" width="46" height="33" rx="5" fill="#46557A" ${LINE}/>` +
      `<rect x="11" y="8" width="38" height="25" rx="2.5" fill="#9BD3EF" stroke="none"/>` +
      `<circle cx="21" cy="18" r="4.5" fill="#F7C948" stroke="none"/>` +
      `<path d="M28 27 L36 18 L42 24 L47 18" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<rect x="9" y="51" width="42" height="9" rx="3" fill="#A9C2DE" ${LINE}/>` +
      `<path d="M14 55.5 H46" fill="none" ${THIN}/>`,
  },
  tv: {
    viewBox: "0 0 64 52",
    art:
      limb("M27 38 L23 47", "#7E97B8", 3) +
      limb("M37 38 L41 47", "#7E97B8", 3) +
      `<rect x="18" y="45" width="28" height="4.5" rx="2.2" fill="#7E97B8" ${LINE}/>` +
      `<rect x="5" y="4" width="54" height="35" rx="5" fill="#46405C" ${LINE}/>` +
      `<rect x="9" y="8" width="46" height="27" rx="2.5" fill="#7FC7E8" stroke="none"/>` +
      `<circle cx="44" cy="17" r="5" fill="#F7C948" stroke="none"/>` +
      `<path d="M9 35 Q22 20 34 30 Q46 20 55 35 Z" fill="#6FC66F" stroke="none"/>`,
  },
  matta: {
    viewBox: "0 0 64 44",
    art:
      `<ellipse cx="32" cy="22" rx="28" ry="15" fill="#F890B7" ${LINE}/>` +
      `<ellipse cx="32" cy="22" rx="20" ry="10.5" fill="#FFF3DC" ${LINE}/>` +
      `<ellipse cx="32" cy="22" rx="11" ry="5.5" fill="#7FC7E8" ${THIN}/>`,
  },
  sittpuff: {
    viewBox: "0 0 60 48",
    art:
      `<path d="M8 40 Q3 18 30 14 Q57 18 52 40 Q30 48 8 40 Z" fill="#58C6A9" ${LINE}/>` +
      `<path d="M30 14 Q26 28 12 39 M30 14 Q34 28 48 39 M30 15 L30 44" fill="none" ${THIN}/>` +
      `<circle cx="30" cy="16" r="3.4" fill="#C9F0DC" ${THIN}/>`,
  },
  byra: {
    viewBox: "0 0 56 62",
    art:
      limb("M11 52 L9 59", WOOD_DARK, 4) +
      limb("M45 52 L47 59", WOOD_DARK, 4) +
      `<rect x="6" y="5" width="44" height="49" rx="4" fill="${WOOD}" ${LINE}/>` +
      `<rect x="11" y="10" width="34" height="12" rx="3" fill="${WOOD_LIGHT}" ${LINE}/>` +
      `<rect x="11" y="25" width="34" height="12" rx="3" fill="${WOOD_LIGHT}" ${LINE}/>` +
      `<rect x="11" y="40" width="34" height="12" rx="3" fill="${WOOD_LIGHT}" ${LINE}/>` +
      `<circle cx="21" cy="16" r="2.2" fill="${WOOD_DARK}"/><circle cx="35" cy="16" r="2.2" fill="${WOOD_DARK}"/>` +
      `<circle cx="21" cy="31" r="2.2" fill="${WOOD_DARK}"/><circle cx="35" cy="31" r="2.2" fill="${WOOD_DARK}"/>` +
      `<circle cx="21" cy="46" r="2.2" fill="${WOOD_DARK}"/><circle cx="35" cy="46" r="2.2" fill="${WOOD_DARK}"/>`,
  },
  skrivbord: {
    viewBox: "0 0 66 58",
    art:
      `<rect x="4" y="12" width="58" height="9" rx="3" fill="#C9996B" ${LINE}/>` +
      limb("M12 21 L12 52", WOOD_DARK, 4) +
      `<rect x="38" y="21" width="24" height="31" rx="3" fill="${WOOD}" ${LINE}/>` +
      `<path d="M40 32 L60 32 M40 42 L60 42" fill="none" ${THIN}/>` +
      `<path d="M46 26 L54 26 M46 37 L54 37 M46 47 L54 47" fill="none" stroke="${WOOD_DARK}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<rect x="14" y="4" width="18" height="9" rx="2" fill="#EF6F6C" ${THIN}/>`,
  },
  fatolj: {
    viewBox: "0 0 64 58",
    art:
      limb("M16 46 L14 55", WOOD_DARK, 4) +
      limb("M48 46 L50 55", WOOD_DARK, 4) +
      `<rect x="12" y="4" width="40" height="36" rx="11" fill="#B79BE0" ${LINE}/>` +
      `<rect x="5" y="22" width="13" height="26" rx="6" fill="#9C7ED0" ${LINE}/>` +
      `<rect x="46" y="22" width="13" height="26" rx="6" fill="#9C7ED0" ${LINE}/>` +
      `<rect x="14" y="30" width="36" height="18" rx="7" fill="#C9B3EC" ${LINE}/>` +
      `<path d="M22 14 Q32 10 42 14" fill="none" ${THIN}/>`,
  },
};
