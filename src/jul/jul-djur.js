// ============================================================================
// Pluggporten – Jul-djuren: registrering (#912, epic #906)
// ----------------------------------------------------------------------------
// Slår in de tio arternas konst (jul-djur-a.js, jul-djur-b.js), julklappsägget,
// butiksvarorna (SHOP_ITEMS) och butikskorten i de befintliga registren – exakt
// som Halloween-djuren (halloween/hw-djur.js). Anropas av registreraJulKonst()
// (jul-konst.js), som laddas lazy av loadCollectionArt() – så rummet, kamrat-
// besöket och butiken ritar djuren året runt, oavsett om Jul är på.
//
// Katalogen (namn/steg/mystery-flaggan/äggnamnet) ligger i art-pets-creatures.js
// (JUL_SPECIES) eftersom kläckning och Mysterymat behöver den utan konsten.
// ============================================================================

import { registerCreatureArt, JUL_SPECIES } from "../art-pets-creatures.js";
import { registerPetArt } from "../art-pets.js";
import { registerItemArt } from "../art-items.js";
import { registerShopItems } from "../shop-items.js";
import { JUL_DJUR_A } from "./jul-djur-a.js";
import { JUL_DJUR_B } from "./jul-djur-b.js";
import { LINE, THIN, glitter } from "./jul-djur-delar.js";
import { JULROD, GULD, GULD_MORK, KRAM, SKEN } from "./jul-art-delar.js";
import { JUL_DJUR_VAROR } from "./jul-djur-katalog.js";

// Butiksvarorna (ett julklappsägg per djur, 500 mynt) står i den rena
// jul-djur-katalog.js (butikKop på servern läser dem) och slås in i SHOP_ITEMS
// lazy här – shop-items.js ligger vid filtaket och i bootgrafen.
export { JUL_DJUR_VAROR };

/** id → (stage 1–3, expr) => SVG-innehåll i viewBox 0 0 100 100. */
export const JUL_DJUR = { ...JUL_DJUR_A, ...JUL_DJUR_B };

/** Julklappsägget – samma mått som mystery- och pumpaägget, inslaget med guldband och rosett. */
export function julklappsagg() {
  const agg = "M50 16 C31 16 25 48 25 64 A25 25 0 0 0 75 64 C75 48 69 16 50 16 Z";
  return (
    `<defs><clipPath id="jd-agg-klipp"><path d="${agg}"/></clipPath></defs>` +
    `<ellipse cx="50" cy="90" rx="27" ry="6" fill="#B0805A" opacity="0.25" stroke="none"/>` +
    `<path d="${agg}" fill="${JULROD}" ${LINE}/>` +
    `<g clip-path="url(#jd-agg-klipp)">` +
    `<rect x="45" y="10" width="10" height="84" fill="${GULD}"/>` +
    `<rect x="20" y="56" width="60" height="9" fill="${GULD}"/>` +
    `<path d="M45 10 L45 94 M55 10 L55 94 M20 56 L80 56 M20 65 L80 65" stroke="${GULD_MORK}" stroke-width="1.2"/>` +
    `<circle cx="35" cy="40" r="2.4" fill="${KRAM}"/><circle cx="64" cy="34" r="2" fill="${KRAM}"/>` +
    `<circle cx="34" cy="78" r="2" fill="${KRAM}"/><circle cx="66" cy="80" r="2.4" fill="${KRAM}"/></g>` +
    `<path d="${agg}" fill="none" ${LINE}/>` +
    `<ellipse cx="38" cy="32" rx="4" ry="8" fill="#FFFFFF" opacity="0.45" stroke="none"/>` +
    `<path d="M50 16 Q36 2 35 12 Q36 20 50 16 Z" fill="${GULD}" ${THIN}/>` +
    `<path d="M50 16 Q64 2 65 12 Q64 20 50 16 Z" fill="${GULD}" ${THIN}/>` +
    `<circle cx="50" cy="16" r="3.4" fill="${GULD_MORK}" ${THIN}/>` +
    glitter(84, 26, 5, SKEN) + glitter(15, 50, 4, SKEN)
  );
}

/** Butikskortet: julklappsägget med djuret (steg 2, glad) bredvid. */
export function djurKort(id) {
  return (
    `<g transform="translate(-2 40) scale(0.58)">${julklappsagg()}</g>` +
    `<g transform="translate(25 12) scale(0.74)">${JUL_DJUR[id](2, "glad")}</g>`
  );
}

let klar = false;

/** Slå in djurens konst, julklappsägget och butiksvarorna i registren (idempotent). */
export function registreraJulDjur() {
  if (klar) return;
  klar = true;
  registerShopItems(JUL_DJUR_VAROR);
  registerCreatureArt(JUL_DJUR);
  registerPetArt({ "jul-julklappsagg": { viewBox: "0 0 100 100", art: julklappsagg(), label: "Julklappsägg" } });
  const kort = {};
  for (const s of JUL_SPECIES) kort["jul-djur-" + s.id] = { viewBox: "0 0 100 100", art: djurKort(s.id) };
  registerItemArt(kort);
}
