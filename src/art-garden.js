// ============================================================================
// Pluggportalen – trädgårds- & utomhussaker (inline SVG-uppslagning)
// ----------------------------------------------------------------------------
// Konsten för shopens NYA kategori "Trädgård & utomhus" (issue #132): saker
// eleven köper och placerar UTOMHUS runt sitt hus i ute-vyn (art-hus-ute.js /
// varld-tradgard.js). Samma dataschema som rums-sakerna i art-decor.js/
// art-furniture.js:  id → { viewBox, w (rem), art, flat? }.  `flat:true` =
// markplacerad sak (grusruta, rabatt) som ritas UNDER övriga trädgårdssaker,
// precis som mattor i rummet. GARDEN spridas in i ITEMS i art-items.js så
// itemSvg(id) fungerar både för shop-miniatyren och scen-renderingen.
//
// Konsten följer stilguiden (art-style.js): kontur O (#3B3350) via LINE/THIN,
// samma trä-/grönska-palett som ute-scenen. Håll id:na STABILA – de lagras i
// studentData.garden.placements + ownedItems (Firestore). `emoji` i shop-items.js
// finns kvar som ofarlig fallback.
// ============================================================================

import { O, LINE, THIN, limb } from "./art-style.js";

// Palett – samma gröna/trä-toner som ute-scenen (färgas aldrig om av paletten).
const LOV = "#6FC66F";
const LOV_MORK = "#4E9B5E";
const WOOD = "#B0805A";
const WOOD_DARK = "#8A6242";

const shadow = (cx, cy, rx) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${(rx * 0.22).toFixed(1)}" fill="${O}" opacity="0.12"/>`;

/**
 * id → { viewBox, w (rem, ute-scenens bas-bredd), art, flat? }.
 * Höjden härleds ur viewBox-proportionen (itemSize i art-items.js).
 */
export const GARDEN = {
  // --- Träd: kraftig stam + tre lövklumpar med några äpplen ----------------
  trad: {
    viewBox: "0 0 120 150",
    w: 5.4,
    art:
      shadow(60, 146, 40) +
      limb("M60 146 L60 78", WOOD, 15) +
      `<path d="M52 110 Q42 100 40 112" fill="none" ${THIN}/>` +
      `<circle cx="60" cy="60" r="42" fill="${LOV}" ${LINE}/>` +
      `<circle cx="30" cy="82" r="26" fill="${LOV}" ${LINE}/>` +
      `<circle cx="92" cy="80" r="28" fill="${LOV}" ${LINE}/>` +
      `<path d="M40 46 Q52 40 60 50" fill="none" ${THIN}/>` +
      `<circle cx="46" cy="54" r="6" fill="#EF6F6C" ${THIN}/>` +
      `<circle cx="82" cy="70" r="6" fill="#EF6F6C" ${THIN}/>` +
      `<circle cx="66" cy="88" r="6" fill="#EF6F6C" ${THIN}/>`,
  },

  // --- Buske: låg rund grönska med små blommor -----------------------------
  buske: {
    viewBox: "0 0 110 74",
    w: 4.6,
    art:
      shadow(55, 70, 40) +
      `<circle cx="30" cy="46" r="24" fill="${LOV_MORK}" ${LINE}/>` +
      `<circle cx="80" cy="46" r="24" fill="${LOV_MORK}" ${LINE}/>` +
      `<circle cx="55" cy="34" r="28" fill="${LOV}" ${LINE}/>` +
      `<path d="M40 40 Q55 32 70 40" fill="none" ${THIN}/>` +
      `<circle cx="34" cy="46" r="4.6" fill="#F890B7" ${THIN}/>` +
      `<circle cx="76" cy="48" r="4.6" fill="#F7C948" ${THIN}/>` +
      `<circle cx="58" cy="28" r="4.6" fill="#F890B7" ${THIN}/>`,
  },

  // --- Blomrabatt (flat): jordremsa med rad av glada blommor ---------------
  blomrabatt: {
    viewBox: "0 0 130 60",
    w: 5.2,
    flat: true,
    art:
      `<path d="M8 44 Q65 30 122 44 L118 54 Q65 44 12 54 Z" fill="#8A6242" ${LINE}/>` +
      blommaVid(28, 40, "#F890B7") +
      blommaVid(58, 34, "#F7C948") +
      blommaVid(88, 40, "#EF6F6C") +
      blommaVid(108, 44, "#B892E0"),
  },

  // --- Parkeringsruta (flat): asfalt med vit ram + stort P ------------------
  parkering: {
    viewBox: "0 0 120 96",
    w: 5.6,
    flat: true,
    art:
      `<path d="M14 26 L106 26 L112 88 L8 88 Z" fill="#6E6A73" ${LINE}/>` +
      `<path d="M24 34 L98 34 L102 80 L18 80 Z" fill="none" stroke="#FFFFFF" stroke-width="4"/>` +
      `<path d="M50 44 L50 70 M50 44 L64 44 Q72 44 72 52 Q72 60 64 60 L50 60"
        fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  // --- Bil: gullig sidobild med tak, fönster & två hjul --------------------
  bil: {
    viewBox: "0 0 150 92",
    w: 6.4,
    art:
      shadow(75, 86, 58) +
      `<path d="M14 66 L14 52 Q14 46 22 46 L44 46 L58 24 Q62 18 72 18 L104 18
        Q112 18 116 26 L126 46 L136 48 Q142 50 142 58 L142 66 Z"
        fill="#EF6F6C" ${LINE}/>` +
      `<path d="M60 44 L70 26 L86 26 L86 44 Z" fill="#C9EEFB" ${THIN}/>` +
      `<path d="M92 44 L92 26 L102 26 Q108 26 111 32 L118 44 Z" fill="#C9EEFB" ${THIN}/>` +
      `<rect x="20" y="56" width="26" height="7" rx="3.5" fill="#FFE9CC" stroke="none"/>` +
      `<circle cx="44" cy="72" r="15" fill="#3B3350" ${LINE}/>` +
      `<circle cx="44" cy="72" r="6" fill="#C7C2CE" ${THIN}/>` +
      `<circle cx="112" cy="72" r="15" fill="#3B3350" ${LINE}/>` +
      `<circle cx="112" cy="72" r="6" fill="#C7C2CE" ${THIN}/>`,
  },

  // --- Cykel: ram, sadel, styre & två ekerhjul -----------------------------
  cykel: {
    viewBox: "0 0 140 96",
    w: 6.0,
    art:
      shadow(70, 90, 56) +
      `<circle cx="34" cy="66" r="24" fill="none" stroke="${O}" stroke-width="5"/>` +
      `<circle cx="106" cy="66" r="24" fill="none" stroke="${O}" stroke-width="5"/>` +
      `<circle cx="34" cy="66" r="3.4" fill="${O}"/>` +
      `<circle cx="106" cy="66" r="3.4" fill="${O}"/>` +
      ekrar(34, 66, 22) + ekrar(106, 66, 22) +
      `<path d="M34 66 L70 66 L52 38 Z M70 66 L92 38 M52 38 L92 38"
        fill="none" stroke="#EF6F6C" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M106 66 L92 38" fill="none" stroke="#EF6F6C" stroke-width="6" stroke-linecap="round"/>` +
      limb("M92 38 L100 30", O, 4) +
      `<path d="M96 30 L112 30" fill="none" stroke="${O}" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M44 40 L60 40" fill="none" stroke="${WOOD_DARK}" stroke-width="6" stroke-linecap="round"/>` +
      limb("M70 66 L70 54", O, 4),
  },
};

// En liten glad blomma på en stjälk vid (x, markY) – används i rabatten.
function blommaVid(x, markY, farg) {
  const top = markY - 20;
  return (
    `<path d="M${x} ${markY} L${x} ${top + 6}" fill="none" stroke="${LOV_MORK}" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="${x - 6}" cy="${top}" r="5" fill="${farg}" ${THIN}/>` +
    `<circle cx="${x + 6}" cy="${top}" r="5" fill="${farg}" ${THIN}/>` +
    `<circle cx="${x}" cy="${top - 6}" r="5" fill="${farg}" ${THIN}/>` +
    `<circle cx="${x}" cy="${top + 6}" r="5" fill="${farg}" ${THIN}/>` +
    `<circle cx="${x}" cy="${top}" r="4.5" fill="#F7C948" ${THIN}/>`
  );
}

// Fyra ekrar i ett cykelhjul (kors) med radie r kring (cx, cy).
function ekrar(cx, cy, r) {
  return (
    `<path d="M${cx - r} ${cy} L${cx + r} ${cy} M${cx} ${cy - r} L${cx} ${cy + r}"
      fill="none" stroke="${O}" stroke-width="2"/>`
  );
}
