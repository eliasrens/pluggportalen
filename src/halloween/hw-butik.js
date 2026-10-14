// ============================================================================
// Pluggporten – 🎃 Halloween-fliken i butiken (#692, epic #689)
// ----------------------------------------------------------------------------
// Ren UI-gruppering, som Baksidan i pages-shop.js: varorna ligger i sina vanliga
// kategorier (dekor/mobler/tradgard/hus …) med `collection: "halloween"` i
// shop-items.js, så köp, placering och inventarie fungerar utan ny kod. Här
// bestäms bara fliken och dess undergrupper (sub-flikar).
//
// Fliken syns BARA när isHalloweenActive() (season.js, server-korrigerad klocka)
// – pages-shop.js lyssnar på onSeasonChange och ritar om utan omladdning när
// slutdatumet passerar. Köpta saker behålls och fungerar året runt.
//
// D (kostymer), E (avatarer), F (djur): lägg till en egen undergrupp med
// registreraUndergrupp({ id, rubrik, match }) – t.ex. från er egen modul som
// importeras av hw-konst.js – eller som en rad i HW_UNDERGRUPPER nedan.
// Laddas bara med import() (#271).
// ============================================================================

import { itemsInCollection } from "../shop-items.js";
import "../avatars.js"; // köpavatarernas katalograder (#694) slås in i SHOP_ITEMS där

export const HALLOWEEN = "halloween";

/** Flik-definitionen (samma form som CATEGORIES; ikonen = categorySvg("halloween")). */
export const HALLOWEEN_FLIK = {
  id: HALLOWEEN,
  name: "Halloween",
  emoji: "🎃",
  hint: "Bara under Halloween! Allt du köper här behåller du för alltid – även när Halloween är slut. Kostymerna kan bäras varje Halloween.",
};

/** Undergrupperna i ordning. `match(it)` avgör vilka samlingsvaror som hör hit. */
export const HW_UNDERGRUPPER = [
  { id: "inne", rubrik: "🕯️ Dekor & möbler", match: (it) => it.category === "dekor" || it.category === "mobler" },
  { id: "tradgard", rubrik: "🍂 Trädgård", match: (it) => it.category === "tradgard" },
  { id: "hus", rubrik: "🏚️ Hus", match: (it) => it.category === "hus" },
  // Halloween-djuren (#695): pumpaägg som kläcks till valt djur.
  { id: "djur", rubrik: "👻 Djur", match: (it) => !!it.hatchSpecies },
  { id: "avatarer", rubrik: "🧛 Avatarer", match: (it) => it.category === "avatar" }, // #694
];

/**
 * Lägg till en undergrupp (idempotent på id). `fore` = id att hamna före,
 * annars sist. Varor som ingen undergrupp matchar visas i "Övrigt".
 * @param {{id:string, rubrik:string, match:(it:object)=>boolean}} grupp
 */
export function registreraUndergrupp(grupp, fore = null) {
  if (HW_UNDERGRUPPER.some((g) => g.id === grupp.id)) return;
  const i = fore ? HW_UNDERGRUPPER.findIndex((g) => g.id === fore) : -1;
  if (i === -1) HW_UNDERGRUPPER.push(grupp);
  else HW_UNDERGRUPPER.splice(i, 0, grupp);
}

/**
 * Sektionerna med varor: [{ id, rubrik, items }] i undergruppsordning, tomma
 * utelämnade. Varje vara hamnar i FÖRSTA matchande grupp (disjunkt).
 */
export function halloweenSektioner(items = itemsInCollection(HALLOWEEN)) {
  const kvar = new Set(items);
  const ut = [];
  for (const g of HW_UNDERGRUPPER) {
    const mine = items.filter((it) => kvar.has(it) && g.match(it));
    mine.forEach((it) => kvar.delete(it));
    if (mine.length) ut.push({ id: g.id, rubrik: g.rubrik, items: mine });
  }
  if (kvar.size) ut.push({ id: "ovrigt", rubrik: "✨ Övrigt", items: items.filter((it) => kvar.has(it)) });
  return ut;
}
