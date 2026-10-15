// ============================================================================
// Pluggporten – rums-saker & kategori-ikoner (inline SVG-uppslagning)
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
import { GARDEN } from "./art-garden.js";
import { MYSTERY_DECOR } from "./art-mystery.js";
import { MYSTERY_BOX_ART } from "./art-mystery-box.js";

// Alla rum-, trädgårds- OCH mystery-saker i en uppslagning (id → { viewBox, art }).
// Trädgårdssakerna (art-garden.js) placeras utomhus i ute-vyn, mystery-dekor
// (art-mystery.js, vinns ur mysteryboxen) placeras i rummet som köpt dekor –
// alla delar samma itemSvg/itemSize-uppslagning så shop-miniatyren funkar direkt.
const ITEMS = { ...FURNITURE, ...PETS, ...DECOR, ...GARDEN, ...MYSTERY_DECOR, ...MYSTERY_BOX_ART };

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
  tradgard: {
    viewBox: "0 0 46 46",
    art:
      limb("M23 42 L23 26", WOOD, 5) +
      `<circle cx="23" cy="17" r="14" fill="#6FC66F" ${LINE}/>` +
      `<circle cx="12" cy="24" r="8" fill="#6FC66F" ${LINE}/>` +
      `<circle cx="34" cy="24" r="8" fill="#6FC66F" ${LINE}/>` +
      `<circle cx="18" cy="14" r="3" fill="#EF6F6C" ${THIN}/>` +
      `<circle cx="29" cy="20" r="3" fill="#EF6F6C" ${THIN}/>`,
  },
};

/**
 * Fristående SVG för en rum-sak (möbel/husdjur/dekor), eller null om saken
 * saknar konst (då visar anroparen emoji-fältet som fallback). Skalar med
 * CSS width/height och centreras (preserveAspectRatio="xMidYMid meet").
 */
export function itemSvg(id, { rot = 0 } = {}) {
  const it = ITEMS[id];
  if (!it) return null;
  const vy = itemVy(id, rot);
  const name = (getItem(id) || {}).name || id;
  return (
    `<svg viewBox="${vy.viewBox}" role="img" aria-label="${name}" ` +
    `preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${vy.art}</svg>`
  );
}

/**
 * Visningsstorlek i rummet (rem). Konsten kan ange `w` (bredd i rem) i sin
 * definition; höjden räknas ut ur viewBox-proportionen så en säng blir bred
 * och låg medan en bokhylla blir smal och hög. Utan `w` används 3.6 rem.
 * `rot` (#699): en roterad vy har SAMMA höjd som framsidan (vyerna ritas i
 * samma viewBox-höjd) och sin egen bredd – så underkanten, golvpunkten och
 * skuggan står kvar när möbeln vrids, bara bredden ändras.
 */
export function itemSize(id, rot = 0) {
  const it = ITEMS[id];
  const w = (it && it.w) || 3.6;
  if (!it) return { w, h: w };
  const vb = it.viewBox.split(" ").map(Number);
  const h = vb[2] > 0 ? +((w * vb[3]) / vb[2]).toFixed(2) : w;
  const vy = itemVy(id, rot);
  if (vy.viewBox === it.viewBox) return { w, h };
  const vyB = vy.viewBox.split(" ").map(Number);
  return { w: vyB[3] > 0 ? +((h * vyB[2]) / vyB[3]).toFixed(2) : w, h };
}

// --- Vända och rotera (#699) -------------------------------------------------
// Varje placering kan bära `rot` (0–3: framifrån, sidan, bakifrån, andra sidan)
// och `flip` (spegelvänd). Saknas fälten = framifrån och ovänd, som förr.
//
// ↔ VÄND gäller alla saker utom de som har text/siffror/kartor på sig – de
//    markeras med `text: true` i sin konst-definition (art-decor.js m.fl.).
// ⟳ ROTERA gäller saker med extra vyer i ITEM_VYER (art-furniture-vyer.js,
//    laddas lazy av loadCollectionArt). En vy-post är { sida, bak, sida2? }:
//    sida/bak/sida2 = { viewBox, art } ritade i SAMMA viewBox-höjd som
//    framsidan. bak: "spegel" = framsidan spegelvänd (för möbler vars framsida
//    redan är en profil, t.ex. sängar). Utan sida2 är andra sidan = sidan
//    spegelvänd. Ny fyrriktningsmöbel = två vyer + en post där, inget mer.

const ITEM_VYER = {};

/** Slå in rotations-vyer: { id: { sida, bak, sida2? } }. */
export function registerItemViews(reg) {
  Object.assign(ITEM_VYER, reg);
}

/** Har saken fyra riktningar (⟳ Rotera)? */
export function kanRoteras(id) {
  return !!(ITEMS[id] && ITEM_VYER[id]);
}

/** Får saken spegelvändas (↔ Vänd)? Nej för saker med text på (`text: true`). */
export function kanVandas(id) {
  return !(ITEMS[id] && ITEMS[id].text);
}

/** Riktningen 0–3 ur ett sparat värde (allt annat = 0, framifrån). */
function rotAv(rot) {
  const r = Number(rot);
  return Number.isInteger(r) && r >= 0 && r <= 3 ? r : 0;
}

/**
 * Vyn för en riktning: { viewBox, art, spegel }. spegel = vyn ska visas
 * spegelvänd (bakifrån-spegel eller andra sidan). Saknas vyer (eller är de
 * inte laddade) är det alltid framsidan.
 */
export function itemVy(id, rot = 0) {
  const it = ITEMS[id];
  const v = ITEM_VYER[id];
  const r = rotAv(rot);
  if (!it || !v || r === 0) return { viewBox: it ? it.viewBox : "0 0 1 1", art: it ? it.art : "", spegel: false };
  if (r === 1) return { ...v.sida, spegel: false };
  if (r === 2) return v.bak === "spegel" ? { viewBox: it.viewBox, art: it.art, spegel: true } : { ...v.bak, spegel: false };
  return v.sida2 ? { ...v.sida2, spegel: false } : { ...v.sida, spegel: true };
}

/**
 * Hur en placering ska ritas: { rot, spegel }. rot = sparad riktning om saken
 * kan roteras (annars 0); spegel = slutlig spegling (vyns spegling XOR flip,
 * flip bara om saken får vändas).
 */
export function itemRiktning(id, pos) {
  const rot = kanRoteras(id) ? rotAv(pos && pos.rot) : 0;
  const flip = !!(pos && pos.flip === true) && kanVandas(id);
  return { rot, spegel: itemVy(id, rot).spegel !== flip };
}

/**
 * Bara riktningsfälten ur en sparad placering, städade: { rot?, flip? }.
 * rot 0 och flip false skrivs aldrig (samma data som en orörd möbel).
 */
export function riktningsFalt(pos) {
  const ut = {};
  const r = rotAv(pos && pos.rot);
  if (r) ut.rot = r;
  if (pos && pos.flip === true) ut.flip = true;
  return ut;
}

/**
 * ⟳ / ↔ på en placering (muterar pos). typ "rot" stegar framifrån → sidan →
 * bakifrån → andra sidan → framifrån; "flip" vänder. Returnerar true om något
 * ändrades (saken kan det).
 */
export function vridPlacering(id, pos, typ) {
  if (!pos) return false;
  if (typ === "rot") {
    if (!kanRoteras(id)) return false;
    const r = (rotAv(pos.rot) + 1) % 4;
    if (r) pos.rot = r;
    else delete pos.rot;
    return true;
  }
  if (typ === "flip") {
    if (!kanVandas(id)) return false;
    if (pos.flip === true) delete pos.flip;
    else pos.flip = true;
    return true;
  }
  return false;
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

// --- Säsongssamlingarnas konst (#692) laddas LAZY ---------------------------
// Katalogen (shop-items.js) är statisk, men konsten för t.ex. Halloween-samlingen
// ligger i src/halloween/ och laddas med import() (bootgrafen, #271). Sidor som
// ritar elevernas saker (världen, kamratbesök, butiken) väntar på
// loadCollectionArt() före första ritningen; misslyckas laddningen faller
// itemSvg tillbaka på emoji-fältet och husskal på stugan – aldrig ett fel.

/** Slå in konst för fler saker: { id: { viewBox, w?, art, flat? } }. */
export function registerItemArt(reg) {
  Object.assign(ITEMS, reg);
}

/** Slå in kategori-/flik-ikoner: { id: { viewBox, art } }. */
export function registerCategoryIcons(reg) {
  Object.assign(CATEGORY_ICONS, reg);
}

let samlingsKonst = null;

/**
 * Ladda (en gång) säsongssamlingarnas konst OCH möblernas rotations-vyer
 * (#699, art-furniture-vyer.js). Löses alltid, även vid fel – utan vyerna
 * ritas varje möbel framifrån (rot ignoreras) och ⟳ visas inte.
 */
export function loadCollectionArt() {
  samlingsKonst ||= Promise.all([
    import("./halloween/hw-konst.js").then(
      (m) => m.registreraHalloweenKonst(),
      (err) => console.warn("Säsongskonsten kunde inte laddas", err)
    ),
    import("./art-furniture-vyer.js").then(
      (m) => registerItemViews(m.FURNITURE_VYER),
      (err) => console.warn("Möblernas vyer kunde inte laddas", err)
    ),
  ]);
  return samlingsKonst;
}
