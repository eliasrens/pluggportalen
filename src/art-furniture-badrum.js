// ============================================================================
// Pluggporten – badrumsmöblernas konst (#829, elevönskemål)
// ----------------------------------------------------------------------------
// Samma serie som art-furniture.js: kontur #3B3350 (LINE/THIN), tvåtonade ytor
// (vitt porslin med blågrå skugga, krom, trä), små högdagrar och mjuk
// kontaktskugga under varje golvsak. Samma schema: id → { viewBox, w (rem), art,
// flat? }. Id:na matchar shop-items.js ("mobler") och sparas i Firestore.
// Laddas LAZY (#271) via loadCollectionArt() i art-items.js – modulen får aldrig
// importeras statiskt från bootgrafen. Rummet, butiken och kamratbesöket väntar
// redan på loadCollectionArt() före första ritningen.
// ============================================================================

import { LINE, THIN, limb, shadow, stjarna } from "./art-style.js";

// Färger och delar delas med sidovyerna (art-furniture-vyer-badrum.js).
export const WOOD = "#B0805A";
export const WOOD_DARK = "#8A6242";
export const WOOD_LIGHT = "#E0B98C";
export const PORSLIN = "#FFFFFF";
export const PORSLIN_SKUGGA = "#DCE7F2";
export const KROM = "#C6D6E8";
export const KROM_MORK = "#A9C2DE";
export const VATTEN = "#7FC7E8";
export const VATTEN_LJUS = "#C9EEFB";
export const HOGDAGER = `fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity="0.85"`;

// Vattendroppe med spetsen uppåt.
export const droppe = (x, y) =>
  `<path d="M${x} ${y} Q${x - 3.2} ${y + 5} ${x} ${y + 6.5} Q${x + 3.2} ${y + 5} ${x} ${y} Z" fill="${VATTEN}" ${THIN}/>`;
// Skumbubbla/såpbubbla med liten glans.
export const bubbla = (x, y, r, fill = "#fff") =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${THIN}/>` +
  (r >= 4 ? `<circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${(r * 0.22).toFixed(1)}" fill="#fff" stroke="none"/>` : "");

/** id → { viewBox, w (rem i rummet), art, flat? } */
export const FURNITURE_BADRUM = {
  // Badkar: ljusblått karbad på guldiga lejontassar, skumtopp & blandare.
  badkar: {
    viewBox: "0 0 124 84",
    w: 7.0,
    art:
      shadow(62, 79, 50) +
      `<path d="M24 62 Q18 71 20 78 L34 78 Q34 70 32 62 Z" fill="#F7C948" ${LINE}/>` +
      `<path d="M100 62 Q106 71 104 78 L90 78 Q90 70 92 62 Z" fill="#F7C948" ${LINE}/>` +
      `<path d="M25 74 L25 78 M29 74 L29 78 M95 74 L95 78 M99 74 L99 78" fill="none" ${THIN}/>` +
      `<path d="M10 38 L114 38 Q112 66 90 70 L34 70 Q12 66 10 38 Z" fill="#A6DCF2" ${LINE}/>` +
      `<path d="M17 56 Q62 63 107 56 Q101 66 89 67.5 L35 67.5 Q23 66 17 56 Z" fill="${VATTEN}" stroke="none"/>` +
      `<path d="M22 46 Q62 52 102 46" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="0.1 6"/>` +
      `<path d="M17 44 Q19 52 24 57" ${HOGDAGER}/>` +
      bubbla(24, 30, 7) + bubbla(37, 24, 9) + bubbla(51, 28, 8) + bubbla(65, 21, 10) +
      bubbla(80, 26, 8) + bubbla(92, 29, 6) +
      bubbla(54, 9, 3.5, VATTEN_LJUS) + bubbla(71, 5, 2.6, VATTEN_LJUS) + bubbla(44, 13, 2, VATTEN_LJUS) +
      `<rect x="4" y="32" width="116" height="9" rx="4.5" fill="${PORSLIN}" ${LINE}/>` +
      `<path d="M12 35.5 H70" stroke="${PORSLIN_SKUGGA}" stroke-width="2.4" stroke-linecap="round"/>` +
      limb("M110 33 L110 20 Q110 14 104 14 L101 14", KROM_MORK, 4) +
      `<circle cx="115" cy="24" r="3.2" fill="#F7C948" ${THIN}/>` +
      droppe(101, 18),
  },
  // Duschhörna: kaklad vägg, krommunstycke med droppar & glasdörr med glans.
  dusch: {
    viewBox: "0 0 76 118",
    w: 4.2,
    art:
      shadow(38, 112, 32) +
      `<rect x="8" y="8" width="60" height="92" rx="4" fill="${VATTEN_LJUS}" ${LINE}/>` +
      `<path d="M11 31 H65 M11 54 H65 M11 77 H65 M28 11 V97 M48 11 V97" fill="none" stroke="#A6DCF2" stroke-width="1.8" stroke-linecap="round"/>` +
      limb("M22 98 L22 24 Q22 16 30 16 L45 16 L45 19", KROM_MORK, 4) +
      `<circle cx="22" cy="64" r="4" fill="#F7C948" ${THIN}/>` +
      `<path d="M35 27 Q45 15 55 27 Z" fill="${KROM}" ${LINE}/>` +
      droppe(38, 32) + droppe(46, 37) + droppe(54, 31) + droppe(42, 48) + droppe(52, 52) + droppe(46, 64) +
      `<rect x="38" y="8" width="32" height="92" rx="4" fill="#E8F6FC" fill-opacity="0.45" ${LINE}/>` +
      `<path d="M44 44 L60 22 M44 60 L64 32" ${HOGDAGER}/>` +
      `<rect x="41.5" y="56" width="4" height="16" rx="2" fill="${KROM_MORK}" ${THIN}/>` +
      `<rect x="6" y="98" width="64" height="12" rx="4" fill="${PORSLIN}" ${LINE}/>` +
      `<path d="M12 102 H64" stroke="${PORSLIN_SKUGGA}" stroke-width="2.4" stroke-linecap="round"/>`,
  },
  // Toalett: porslin med blå sits, spolknapp, handtag och en stjärndekal.
  toalett: {
    viewBox: "0 0 64 84",
    w: 3.4,
    art:
      shadow(32, 78, 24) +
      `<path d="M22 56 L20 76 L44 76 L42 56 Z" fill="${PORSLIN}" ${LINE}/>` +
      `<path d="M38 60 L39.5 73" stroke="${PORSLIN_SKUGGA}" stroke-width="3" stroke-linecap="round"/>` +
      `<rect x="27" y="1.8" width="10" height="5" rx="2.5" fill="${KROM}" ${THIN}/>` +
      `<rect x="10" y="6" width="44" height="32" rx="6" fill="${PORSLIN}" ${LINE}/>` +
      `<rect x="14" y="22" width="36" height="12" rx="4" fill="${PORSLIN_SKUGGA}" stroke="none"/>` +
      `<rect x="7" y="4" width="50" height="8" rx="4" fill="${PORSLIN}" ${LINE}/>` +
      `<rect x="40" y="16" width="10" height="4.5" rx="2.2" fill="${KROM_MORK}" ${THIN}/>` +
      stjarna(21, 20, 1.1, "#F890B7") +
      `<path d="M6 42 L58 42 Q56 62 32 62 Q8 62 6 42 Z" fill="${PORSLIN}" ${LINE}/>` +
      `<path d="M12 50 Q32 57 52 50 Q48 59.5 32 59.5 Q16 59.5 12 50 Z" fill="${PORSLIN_SKUGGA}" stroke="none"/>` +
      `<rect x="4" y="36" width="56" height="8" rx="4" fill="${VATTEN}" ${LINE}/>` +
      `<path d="M10 39.5 H36" stroke="${VATTEN_LJUS}" stroke-width="2.4" stroke-linecap="round"/>`,
  },
  // Handfat: piedestal, kran med varm/kall, tandborstmugg, tvål & guldspegel.
  handfat: {
    viewBox: "0 0 66 112",
    w: 3.6,
    art:
      shadow(33, 106, 22) +
      `<path d="M26 62 Q24 90 20 102 L46 102 Q42 90 40 62 Z" fill="${PORSLIN}" ${LINE}/>` +
      `<path d="M36 66 Q37.5 88 40.5 98" fill="none" stroke="${PORSLIN_SKUGGA}" stroke-width="3" stroke-linecap="round"/>` +
      `<ellipse cx="33" cy="18" rx="20" ry="15" fill="#F7C948" ${LINE}/>` +
      `<ellipse cx="33" cy="18" rx="15" ry="10.5" fill="${VATTEN_LJUS}" ${THIN}/>` +
      `<path d="M24 17 L30 10 M26 23 L36 11.5" ${HOGDAGER}/>` +
      limb("M33 46 L33 37 Q33 33 37 33", KROM_MORK, 3.5) +
      `<circle cx="23" cy="42" r="3" fill="#EF6F6C" ${THIN}/>` +
      `<circle cx="43" cy="42" r="3" fill="${VATTEN}" ${THIN}/>` +
      `<path d="M13 37 L10.5 27" fill="none" stroke="#F7C948" stroke-width="2.6" stroke-linecap="round"/>` +
      `<rect x="8.5" y="36" width="9" height="10" rx="2" fill="#6FC66F" ${THIN}/>` +
      `<rect x="48" y="40.5" width="10" height="5" rx="2.5" fill="#F890B7" ${THIN}/>` +
      `<path d="M6 50 L60 50 Q58 68 33 68 Q8 68 6 50 Z" fill="${PORSLIN}" ${LINE}/>` +
      `<path d="M12 56 Q33 62 54 56 Q50 65.5 33 65.5 Q16 65.5 12 56 Z" fill="${PORSLIN_SKUGGA}" stroke="none"/>` +
      `<rect x="4" y="45" width="58" height="8" rx="4" fill="${PORSLIN}" ${LINE}/>` +
      `<path d="M10 48.5 H34" stroke="${PORSLIN_SKUGGA}" stroke-width="2.4" stroke-linecap="round"/>`,
  },
  // Handdukstork: trästativ med två stänger, rosa & blå handduk med ränder.
  handdukstork: {
    viewBox: "0 0 58 92",
    w: 3.2,
    art:
      shadow(29, 87, 22) +
      limb("M7 85 L17 85", WOOD_DARK, 3.5) +
      limb("M41 85 L51 85", WOOD_DARK, 3.5) +
      limb("M12 11 L12 84", WOOD, 4) +
      limb("M46 11 L46 84", WOOD, 4) +
      limb("M12 14 L46 14", WOOD_DARK, 3) +
      limb("M12 46 L46 46", WOOD_DARK, 3) +
      `<circle cx="12" cy="8" r="3.2" fill="${WOOD_LIGHT}" ${THIN}/>` +
      `<circle cx="46" cy="8" r="3.2" fill="${WOOD_LIGHT}" ${THIN}/>` +
      `<path d="M16 11 L42 11 L42 38 Q35.5 42 29 38 Q22.5 42 16 38 Z" fill="#F890B7" ${LINE}/>` +
      `<path d="M16 18 H42" fill="none" ${THIN}/>` +
      `<path d="M18 31 H40" stroke="#FFB1B8" stroke-width="2.6" stroke-linecap="round"/>` +
      `<path d="M20 24 L22 14" ${HOGDAGER}/>` +
      `<rect x="19" y="43" width="20" height="28" rx="3" fill="${VATTEN}" ${LINE}/>` +
      `<path d="M19 50 H39" fill="none" ${THIN}/>` +
      `<path d="M21 64 H37" stroke="${VATTEN_LJUS}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M23 74 L23 77 M29 74 L29 77 M35 74 L35 77" fill="none" ${THIN}/>`,
  },
  // Tvättkorg: flätad korg med röd strumpa & grön tröja som sticker upp.
  tvattkorg: {
    viewBox: "0 0 60 70",
    w: 3.0,
    art:
      shadow(30, 65, 24) +
      `<path d="M13 25 Q14 11 25 13 Q23 19 27 25 Z" fill="#EF6F6C" ${LINE}/>` +
      `<path d="M15 19 Q19 16 24 17" fill="none" stroke="#FFB1B8" stroke-width="2.2" stroke-linecap="round"/>` +
      `<path d="M30 25 Q32 9 47 14 L43 25 Z" fill="#6FC66F" ${LINE}/>` +
      `<path d="M8 24 L52 24 L47 61 Q30 65 13 61 Z" fill="${WOOD_LIGHT}" ${LINE}/>` +
      `<path d="M20 28 L21 61 M30 28 L30 63 M40 28 L39 61" fill="none" stroke="${WOOD}" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/>` +
      `<path d="M10.5 36 Q30 39 49.5 36 M11.8 46 Q30 49 48.2 46 M13 55 Q30 58 47 55" fill="none" stroke="${WOOD}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<rect x="5" y="20" width="50" height="8" rx="4" fill="${WOOD}" ${LINE}/>` +
      `<path d="M10 23.5 H30" stroke="${WOOD_LIGHT}" stroke-width="2.2" stroke-linecap="round"/>`,
  },
  // Badrumsmatta: platt, fluffig blå matta med tofsar och såpbubblor.
  badrumsmatta: {
    viewBox: "0 0 120 56",
    w: 6.4,
    flat: true,
    art:
      `<path d="M2.5 18 H8 M2.5 28 H8 M2.5 38 H8 M112 18 H117.5 M112 28 H117.5 M112 38 H117.5" fill="none" ${THIN}/>` +
      `<rect x="6" y="8" width="108" height="40" rx="18" fill="${VATTEN}" ${LINE}/>` +
      `<rect x="14" y="14" width="92" height="28" rx="12" fill="#A6DCF2" ${THIN}/>` +
      `<rect x="18" y="17.5" width="84" height="21" rx="9" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="3 5" opacity="0.8"/>` +
      bubbla(34, 28, 5) + bubbla(46, 22, 2.6) + bubbla(83, 29, 6) + bubbla(95, 21, 3) + bubbla(62, 32, 2.4),
  },
  // Tvättmaskin: vit med kontrollpanel, vred & rund lucka med skummande tvätt.
  tvattmaskin: {
    viewBox: "0 0 70 80",
    w: 3.9,
    art:
      shadow(35, 75, 29) +
      limb("M15 71 L15 74", KROM_MORK, 3) +
      limb("M55 71 L55 74", KROM_MORK, 3) +
      `<rect x="6" y="6" width="58" height="66" rx="7" fill="${PORSLIN}" ${LINE}/>` +
      `<rect x="10" y="58" width="50" height="10" rx="3" fill="${PORSLIN_SKUGGA}" stroke="none"/>` +
      `<path d="M6 21 H64" fill="none" ${LINE}/>` +
      `<circle cx="15" cy="13.5" r="2.2" fill="#6FC66F" stroke="none"/>` +
      `<circle cx="22" cy="13.5" r="2.2" fill="#F7C948" stroke="none"/>` +
      `<rect x="28" y="10" width="12" height="7" rx="1.5" fill="#46557A" ${THIN}/>` +
      `<path d="M31 13.5 H37" stroke="${VATTEN_LJUS}" stroke-width="1.8" stroke-linecap="round"/>` +
      `<circle cx="52" cy="13.5" r="4.2" fill="${KROM_MORK}" ${THIN}/>` +
      `<path d="M52 13.5 L54 10.5" fill="none" ${THIN}/>` +
      `<circle cx="35" cy="45" r="19" fill="${KROM}" ${LINE}/>` +
      `<circle cx="35" cy="45" r="13" fill="${VATTEN}" ${THIN}/>` +
      `<path d="M22.35 48 Q28.7 44 35 48 Q41.3 52 47.65 48 A13 13 0 0 1 22.35 48 Z" fill="#5AAED8" stroke="none"/>` +
      `<circle cx="30" cy="52" r="3.2" fill="#F890B7" stroke="none"/><circle cx="41" cy="54" r="2.6" fill="#F7C948" stroke="none"/>` +
      bubbla(39, 40, 2.4) + bubbla(31, 42, 1.8) +
      `<circle cx="35" cy="45" r="13" fill="none" ${THIN}/>` +
      `<path d="M26.5 39 Q29.5 35 34 34" ${HOGDAGER}/>` +
      `<rect x="51" y="40.5" width="4.5" height="9" rx="2.2" fill="${KROM_MORK}" ${THIN}/>`,
  },
};
