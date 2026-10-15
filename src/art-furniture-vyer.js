// ============================================================================
// Pluggporten – möblernas extra vyer för ⟳ Rotera (#699)
// ----------------------------------------------------------------------------
// Rummet är ritat rakt framifrån (teaterscen), så en möbel kan bara vridas i
// fyra riktningar om den har en ritning per håll. Framsidan finns redan i
// art-furniture.js; här ligger SIDAN och BAKSIDAN (andra sidan = sidan
// spegelvänd om inget `sida2` anges). Samma stil som art-furniture.js: kontur
// #3B3350 (LINE/THIN), tvåtonat trä, kontaktskugga under varje golvsak.
//
// REGEL: varje vy ritas i SAMMA viewBox-höjd som framsidan och med fötterna/
// skuggan på samma y. itemSize(id, rot) ger då samma höjd och samma skala, så
// möbeln står kvar på exakt samma golvpunkt när den vrids – bara bredden ändras.
//
// `bak: "spegel"` = framsidan spegelvänd. Används för möbler vars framsida
// redan är en profil (sängarna, gungstolen): bakifrån ser de ut som framsidan
// från andra hållet, och sida/sida2 blir gavlarna (fot- och huvudände).
//
// NY FYRRIKTNINGSMÖBEL: rita sida + bak här och lägg in posten nedan – inget
// annat behöver ändras (art-items.js läser FURNITURE_VYER via loadCollectionArt).
// Sitt- och sovmöblerna ligger här; förvaring, bord och elektronik i
// art-furniture-vyer-forvaring.js.
// Laddas LAZY (#271) – modulen får aldrig importeras statiskt från bootgrafen.
// ============================================================================

import { LINE, THIN, limb, shadow } from "./art-style.js";
import { VYER_FORVARING } from "./art-furniture-vyer-forvaring.js";

const WOOD = "#B0805A";
const WOOD_DARK = "#8A6242";
const WOOD_LIGHT = "#E0B98C";
const ADRING = `stroke="${WOOD_DARK}" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.6"`;

/** id → { sida, bak, sida2? } där varje vy är { viewBox, art } (eller bak: "spegel"). */
export const FURNITURE_VYER = {
  // --- Soffa (120×74): sidan = armstödet i profil med ryggen bakom ---------
  soffa: {
    sida: {
      viewBox: "0 0 58 74",
      art:
        shadow(29, 69, 24) +
        limb("M13 60 L12 70", WOOD_DARK, 4) +
        limb("M45 60 L46 70", WOOD_DARK, 4) +
        `<path d="M6 60 L8 34 Q9 28 16 28 L20 28 Q26 28 25 35 L23 50 Z" fill="#58C6A9" ${LINE}/>` +
        `<rect x="6" y="38" width="46" height="25" rx="10" fill="#46B396" ${LINE}/>` +
        `<path d="M14 45 Q30 42 45 45" fill="none" stroke="#C9F0DC" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="0.1 5"/>` +
        `<rect x="40" y="40" width="9" height="6" rx="3" fill="#C9F0DC" opacity="0.6" stroke="none"/>`,
    },
    bak: {
      viewBox: "0 0 120 74",
      art:
        shadow(60, 69, 50) +
        limb("M18 60 L16 70", WOOD_DARK, 4) +
        limb("M102 60 L104 70", WOOD_DARK, 4) +
        `<rect x="4" y="38" width="16" height="26" rx="8" fill="#46B396" ${LINE}/>` +
        `<rect x="100" y="38" width="16" height="26" rx="8" fill="#46B396" ${LINE}/>` +
        `<path d="M10 40 Q10 30 20 30 L100 30 Q110 30 110 40 L110 62 L10 62 Z" fill="#58C6A9" ${LINE}/>` +
        `<path d="M20 36 Q60 32 100 36" fill="none" stroke="#C9F0DC" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="0.1 6"/>` +
        `<path d="M60 34 L60 60" fill="none" stroke="#46B396" stroke-width="2.4" stroke-linecap="round"/>` +
        `<rect x="66" y="46" width="10" height="8" rx="1.5" fill="#FFF3DC" ${THIN}/>`,
    },
  },

  // --- Fåtölj (104×92): sidan = armen med pläden hängande över ------------
  fatolj: {
    sida: {
      viewBox: "0 0 62 92",
      art:
        shadow(31, 86, 26) +
        `<circle cx="13" cy="82" r="5" fill="${WOOD_DARK}" ${THIN}/>` +
        `<circle cx="49" cy="82" r="5" fill="${WOOD_DARK}" ${THIN}/>` +
        `<path d="M6 66 Q2 24 16 14 Q26 9 29 18 Q31 40 27 66 Z" fill="#B79BE0" ${LINE}/>` +
        `<path d="M12 22 Q18 16 24 19" fill="none" ${THIN}/>` +
        `<rect x="7" y="44" width="48" height="36" rx="14" fill="#9C7ED0" ${LINE}/>` +
        `<path d="M38 44 L52 44 L53 66 Q45.5 71 38 66 Z" fill="#EF6F6C" ${THIN}/>` +
        `<path d="M40 50 H51 M40 57 H52" stroke="#FFB1B8" stroke-width="2.2" stroke-linecap="round"/>`,
    },
    bak: {
      viewBox: "0 0 104 92",
      art:
        shadow(52, 86, 44) +
        `<circle cx="22" cy="82" r="5" fill="${WOOD_DARK}" ${THIN}/>` +
        `<circle cx="82" cy="82" r="5" fill="${WOOD_DARK}" ${THIN}/>` +
        `<rect x="8" y="40" width="20" height="40" rx="10" fill="#9C7ED0" ${LINE}/>` +
        `<rect x="76" y="40" width="20" height="40" rx="10" fill="#9C7ED0" ${LINE}/>` +
        `<path d="M16 80 Q8 20 34 14 Q52 8 70 14 Q96 20 88 80 Z" fill="#B79BE0" ${LINE}/>` +
        `<path d="M30 24 Q52 16 74 24" fill="none" ${THIN}/>` +
        `<circle cx="40" cy="44" r="2" fill="#9C7ED0"/><circle cx="64" cy="44" r="2" fill="#9C7ED0"/>` +
        `<circle cx="52" cy="58" r="2" fill="#9C7ED0"/>` +
        // Plädens hörn hänger ner över ena armen.
        `<path d="M22 56 L38 58 L36 74 Q28 78 22 72 Z" fill="#EF6F6C" ${THIN}/>`,
    },
  },

  // --- Gungstol (82×94): framsidan är en profil → sidorna är gavlarna -----
  gungstol: {
    // Rakt framifrån: dynan, spjälryggen bakom och medarnas ändar.
    sida: {
      viewBox: "0 0 60 94",
      art:
        shadow(30, 88, 24) +
        limb("M14 60 L13 84", WOOD, 5) +
        limb("M46 60 L47 84", WOOD, 5) +
        `<ellipse cx="13" cy="85" rx="6" ry="3" fill="${WOOD_DARK}" ${THIN}/>` +
        `<ellipse cx="47" cy="85" rx="6" ry="3" fill="${WOOD_DARK}" ${THIN}/>` +
        `<path d="M14 54 Q12 14 30 12 Q48 14 46 54 Z" fill="${WOOD}" ${LINE}/>` +
        `<path d="M22 22 L22 50 M30 17 L30 50 M38 22 L38 50" fill="none" stroke="${WOOD_LIGHT}" stroke-width="2.2" stroke-linecap="round"/>` +
        `<rect x="8" y="52" width="44" height="12" rx="5" fill="${WOOD}" ${LINE}/>` +
        `<rect x="12" y="44" width="36" height="13" rx="6" fill="#EF6F6C" ${LINE}/>` +
        `<path d="M18 50 Q30 47 42 50" fill="none" ${THIN}/>`,
    },
    bak: "spegel",
    // Rakt bakifrån: ryggens baksida skymmer dynan.
    sida2: {
      viewBox: "0 0 60 94",
      art:
        shadow(30, 88, 24) +
        limb("M14 60 L13 84", WOOD, 5) +
        limb("M46 60 L47 84", WOOD, 5) +
        `<ellipse cx="13" cy="85" rx="6" ry="3" fill="${WOOD_DARK}" ${THIN}/>` +
        `<ellipse cx="47" cy="85" rx="6" ry="3" fill="${WOOD_DARK}" ${THIN}/>` +
        `<rect x="8" y="52" width="44" height="12" rx="5" fill="${WOOD}" ${LINE}/>` +
        `<path d="M14 60 Q12 14 30 12 Q48 14 46 60 Z" fill="${WOOD}" ${LINE}/>` +
        `<path d="M22 20 L22 56 M30 16 L30 56 M38 20 L38 56" fill="none" stroke="${WOOD_DARK}" stroke-width="2" stroke-linecap="round" opacity="0.55"/>`,
    },
  },

  // --- Himmelsäng (124×88): framsidan = långsidan → gavlarna -------------
  sang: {
    // Från fotänden: låg fotgavel framför, täcket, kudden och huvudgaveln bakom.
    sida: {
      viewBox: "0 0 72 88",
      art:
        shadow(36, 82, 30) +
        limb("M12 66 L11 79", WOOD_DARK, 5) +
        limb("M60 66 L61 79", WOOD_DARK, 5) +
        `<rect x="6" y="10" width="60" height="44" rx="8" fill="${WOOD}" ${LINE}/>` +
        `<path d="M30 22 C30 16 36 16 36 22 C36 16 42 16 42 22 Q42 27 36 30 Q30 27 30 22 Z" fill="#F890B7" ${THIN}/>` +
        `<rect x="20" y="34" width="32" height="12" rx="6" fill="#F890B7" ${LINE}/>` +
        `<path d="M8 52 Q8 42 18 42 L54 42 Q64 42 64 52 L64 62 L8 62 Z" fill="#7FC7E8" ${LINE}/>` +
        `<circle cx="24" cy="50" r="2.4" fill="#F7C948" stroke="none"/><circle cx="46" cy="48" r="3" fill="#F7C948" stroke="none"/>` +
        `<rect x="6" y="58" width="60" height="12" rx="5" fill="${WOOD}" ${LINE}/>` +
        `<path d="M12 61.5 H40" stroke="${WOOD_LIGHT}" stroke-width="2.4" stroke-linecap="round"/>`,
    },
    bak: "spegel",
    // Från huvudänden: gavelns baksida med hjärtat skymmer sängen.
    sida2: {
      viewBox: "0 0 72 88",
      art:
        shadow(36, 82, 30) +
        limb("M12 66 L11 79", WOOD_DARK, 5) +
        limb("M60 66 L61 79", WOOD_DARK, 5) +
        `<path d="M10 44 L62 44 L62 62 L10 62 Z" fill="#7FC7E8" ${LINE}/>` +
        `<rect x="6" y="10" width="60" height="60" rx="8" fill="${WOOD}" ${LINE}/>` +
        `<rect x="12" y="16" width="48" height="48" rx="5" fill="${WOOD_LIGHT}" stroke="none"/>` +
        `<path d="M27 34 C27 25 36 25 36 34 C36 25 45 25 45 34 Q45 41 36 46 Q27 41 27 34 Z" fill="#F890B7" ${THIN}/>`,
    },
  },

  // --- Enkelsäng (120×72): samma upplägg som himmelsängen -----------------
  enkelsang: {
    sida: {
      viewBox: "0 0 64 72",
      art:
        shadow(32, 67, 26) +
        limb("M10 52 L9 66", WOOD_DARK, 5) +
        limb("M54 52 L55 66", WOOD_DARK, 5) +
        `<rect x="6" y="14" width="52" height="30" rx="6" fill="${WOOD}" ${LINE}/>` +
        `<rect x="16" y="30" width="32" height="12" rx="6" fill="#7FC7E8" ${LINE}/>` +
        `<path d="M8 47 Q8 39 16 39 L48 39 Q56 39 56 47 L56 54 L8 54 Z" fill="#6FC66F" ${LINE}/>` +
        `<path d="M14 44 Q32 41 50 44" fill="none" stroke="#C9F0DC" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="0.1 6"/>` +
        `<rect x="6" y="48" width="52" height="10" rx="5" fill="${WOOD}" ${LINE}/>`,
    },
    bak: "spegel",
    sida2: {
      viewBox: "0 0 64 72",
      art:
        shadow(32, 67, 26) +
        limb("M10 52 L9 66", WOOD_DARK, 5) +
        limb("M54 52 L55 66", WOOD_DARK, 5) +
        `<path d="M8 40 L56 40 L56 54 L8 54 Z" fill="#6FC66F" ${LINE}/>` +
        `<rect x="6" y="14" width="52" height="42" rx="6" fill="${WOOD}" ${LINE}/>` +
        `<rect x="12" y="20" width="40" height="20" rx="4" fill="${WOOD_LIGHT}" stroke="none"/>` +
        `<path d="M12 46 H52" ${ADRING}/>`,
    },
  },


  ...VYER_FORVARING,
};
