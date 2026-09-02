// ============================================================================
// Pluggportalen – rums-saker & kategori-ikoner (inline SVG-uppslagning)
// ----------------------------------------------------------------------------
// Samlar konsten för shopens rum-placerbara saker (möbler/husdjur/dekor) från
// de tre konst-modulerna och exponerar två hjälpare:
//   itemSvg(id)       → fristående <svg> för en shop-sak, eller null
//   categorySvg(id)   → fristående <svg> för en kategori-ikon, eller null
// Konsten följer stilguiden i art-style.js. Klädsel-kategorin ("klader") har
// egen konst i art-wearables.js – här ritas bara kategori-IKONEN för klader.
//
// Dataschemat i shop-items.js är oförändrat: SVG:n slås upp på id, `emoji`
// finns kvar som ofarlig fallback/etikett. Håll id:na stabila (Firestore).
// ============================================================================

import { LINE, THIN, limb } from "./art-style.js";
import { getItem, CATEGORIES } from "./shop-items.js";
import { FURNITURE } from "./art-furniture.js";
import { PETS } from "./art-pets.js";
import { DECOR } from "./art-decor.js";

// Alla rum-saker i en uppslagning (id → { viewBox, art }).
const ITEMS = { ...FURNITURE, ...PETS, ...DECOR };

const WOOD = "#B0805A";
const WOOD_DARK = "#8A6242";

// Kategori-ikoner (CATEGORIES-emojin ersätts av dessa små SVG:er).
const CATEGORY_ICONS = {
  klader: {
    viewBox: "0 0 48 40",
    art:
      `<path d="M16 6 L20 6 Q24 11 28 6 L32 6 L44 14 L38 21 L35 18 L35 36 L13 36 L13 18 L10 21 L4 14 Z" fill="#7FC7E8" ${LINE}/>` +
      `<path d="M20 6 Q24 12 28 6" fill="none" ${THIN}/>`,
  },
  mobler: {
    viewBox: "0 0 46 48",
    art:
      limb("M12 32 L11 45", WOOD_DARK, 3) +
      limb("M34 32 L35 45", WOOD_DARK, 3) +
      `<rect x="11" y="4" width="24" height="7" rx="3" fill="#C9996B" ${LINE}/>` +
      `<path d="M14 10 L14 26 M32 10 L32 26" fill="none" ${LINE}/>` +
      `<rect x="8" y="25" width="30" height="8" rx="3" fill="${WOOD}" ${LINE}/>`,
  },
  husdjur: {
    viewBox: "0 0 46 44",
    art:
      `<ellipse cx="23" cy="31" rx="11" ry="9" fill="#F49E4C" ${LINE}/>` +
      `<ellipse cx="9" cy="19" rx="4" ry="5" fill="#F49E4C" ${LINE}/>` +
      `<ellipse cx="18" cy="11" rx="4" ry="5.5" fill="#F49E4C" ${LINE}/>` +
      `<ellipse cx="28" cy="11" rx="4" ry="5.5" fill="#F49E4C" ${LINE}/>` +
      `<ellipse cx="37" cy="19" rx="4" ry="5" fill="#F49E4C" ${LINE}/>`,
  },
  dekor: {
    viewBox: "0 0 48 44",
    art:
      `<rect x="5" y="6" width="38" height="32" rx="3" fill="#F7C948" ${LINE}/>` +
      `<rect x="10" y="11" width="28" height="22" rx="2" fill="#7FC7E8" stroke="none"/>` +
      `<circle cx="31" cy="18" r="3.5" fill="#FDE9A8" ${THIN}/>` +
      `<path d="M10 33 Q18 22 26 30 Q31 25 38 33 Z" fill="#6FC66F" stroke="none"/>` +
      `<rect x="10" y="11" width="28" height="22" rx="2" fill="none" ${THIN}/>`,
  },
};

/**
 * Fristående SVG för en rum-sak (möbel/husdjur/dekor), eller null om saken
 * saknar konst (då visar anroparen emoji-fältet som fallback). Skalar med
 * CSS width/height och centreras (preserveAspectRatio="xMidYMid meet").
 */
export function itemSvg(id) {
  const it = ITEMS[id];
  if (!it) return null;
  const name = (getItem(id) || {}).name || id;
  return (
    `<svg viewBox="${it.viewBox}" role="img" aria-label="${name}" ` +
    `preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${it.art}</svg>`
  );
}

/**
 * Visningsstorlek i rummet (rem). Konsten kan ange `w` (bredd i rem) i sin
 * definition; höjden räknas ut ur viewBox-proportionen så en säng blir bred
 * och låg medan en bokhylla blir smal och hög. Utan `w` används 3.6 rem.
 */
export function itemSize(id) {
  const it = ITEMS[id];
  const w = (it && it.w) || 3.6;
  if (!it) return { w, h: w };
  const vb = it.viewBox.split(" ").map(Number);
  const h = vb[2] > 0 ? +((w * vb[3]) / vb[2]).toFixed(2) : w;
  return { w, h };
}

/** Fristående SVG för en kategori-ikon, eller null om ikon saknas. */
export function categorySvg(catId) {
  const c = CATEGORY_ICONS[catId];
  if (!c) return null;
  const cat = CATEGORIES.find((x) => x.id === catId);
  const name = cat ? cat.name : catId;
  return (
    `<svg viewBox="${c.viewBox}" role="img" aria-label="${name}" ` +
    `preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${c.art}</svg>`
  );
}
