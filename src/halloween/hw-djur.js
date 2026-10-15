// ============================================================================
// Pluggporten – Halloween-djuren: registrering (#695, epic #689)
// ----------------------------------------------------------------------------
// Slår in de tio arternas konst (hw-djur-a.js, hw-djur-b.js), pumpaägget,
// butiksvarorna (SHOP_ITEMS) och butikskorten i de befintliga registren. Anropas av registreraHalloweenKonst()
// (hw-konst.js), som laddas lazy av loadCollectionArt() – så rummet, kamrat-
// besöket och butiken ritar djuren året runt, oavsett om Halloween är på.
//
// Katalogen (namn/steg/mystery-flaggan) ligger i art-pets-creatures.js
// (HW_SPECIES) eftersom kläckning och Mysterymat behöver den utan konsten.
// ============================================================================

import { registerCreatureArt, HW_SPECIES } from "../art-pets-creatures.js";
import { registerPetArt } from "../art-pets.js";
import { registerItemArt } from "../art-items.js";
import { HW_DJUR_A } from "./hw-djur-a.js";
import { HW_DJUR_B } from "./hw-djur-b.js";
import { LINE, THIN, glitter } from "./hw-djur-delar.js";
import { PUMPA, PUMPA_MORK, GRON, GRON_MORK, LILA, SKEN } from "./hw-art-delar.js";
import { limb } from "../art-style.js";
import { SHOP_ITEMS } from "../shop-items.js";

// Butiksvarorna: ett pumpaägg per djur (500 mynt) som kläcks till VALT djur
// (buyEgg i data-pet.js, pages-shop.js). Bor här och slås in i SHOP_ITEMS lazy –
// shop-items.js ligger vid filtaket och i bootgrafen. Varorna ägs aldrig
// (ownedItems), så bara butiken behöver dem – och den väntar på loadCollectionArt.
const EMOJI = { spokis: "👻", pumpis: "🎃", fladdis: "🦇", gruffe: "🐉", svartis: "🐈", mumme: "🧸", spindis: "🕷️", skelli: "🦴", uggli: "🦉", slemmis: "🟢" };
export const HW_DJUR_VAROR = HW_SPECIES.map((s) => ({
  id: "hw-djur-" + s.id, name: s.name, emoji: EMOJI[s.id], category: "husdjur", price: 500, collection: "halloween", hatchSpecies: s.id,
}));

/** id → (stage 1–3, expr) => SVG-innehåll i viewBox 0 0 100 100. */
export const HW_DJUR = { ...HW_DJUR_A, ...HW_DJUR_B };

/** Pumpaägget (Halloween-ägget) – samma mått som mystery-ägget (art-pets.js). */
export function pumpaagg() {
  return (
    `<ellipse cx="50" cy="90" rx="27" ry="6" fill="#B0805A" opacity="0.25" stroke="none"/>` +
    `<path d="M50 16 C31 16 25 48 25 64 A25 25 0 0 0 75 64 C75 48 69 16 50 16 Z" fill="${PUMPA}" ${LINE}/>` +
    `<path d="M40 19 Q30 50 36 87 M60 19 Q70 50 64 87" fill="none" stroke="${PUMPA_MORK}" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M50 16 Q47 50 50 89" fill="none" stroke="${PUMPA_MORK}" stroke-width="2.4" stroke-linecap="round" opacity="0.7"/>` +
    `<ellipse cx="38" cy="36" rx="5" ry="9" fill="#FFFFFF" opacity="0.5" stroke="none"/>` +
    limb("M50 18 Q49 9 53 5", GRON_MORK, 4) +
    `<path d="M52 12 Q60 2 70 6 Q64 14 52 12 Z" fill="${GRON}" ${THIN}/>` +
    limb("M50 14 Q40 12 40 6 Q41 3 44 5", GRON_MORK, 1.5) +
    `<circle cx="58" cy="52" r="3.4" fill="${LILA}" stroke="none"/>` +
    `<circle cx="42" cy="68" r="2.6" fill="${LILA}" stroke="none"/>` +
    `<circle cx="59" cy="76" r="2" fill="${LILA}" stroke="none"/>` +
    glitter(84, 26, 5, SKEN) + glitter(15, 50, 4, SKEN)
  );
}

/** Butikskortet: pumpaägget med djuret (steg 2, glad) bredvid. */
export function djurKort(id) {
  return (
    `<g transform="translate(-2 40) scale(0.58)">${pumpaagg()}</g>` +
    `<g transform="translate(25 12) scale(0.74)">${HW_DJUR[id](2, "glad")}</g>`
  );
}

let klar = false;

/** Slå in djurens konst, pumpaägget och butiksvarorna i registren (idempotent). */
export function registreraHalloweenDjur() {
  if (klar) return;
  klar = true;
  SHOP_ITEMS.push(...HW_DJUR_VAROR.filter((v) => !SHOP_ITEMS.some((it) => it.id === v.id)));
  registerCreatureArt(HW_DJUR);
  registerPetArt({ "hw-pumpaagg": { viewBox: "0 0 100 100", art: pumpaagg(), label: "Pumpaägg" } });
  const kort = {};
  for (const s of HW_SPECIES) kort["hw-djur-" + s.id] = { viewBox: "0 0 100 100", art: djurKort(s.id) };
  registerItemArt(kort);
}
