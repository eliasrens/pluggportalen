// ============================================================================
// Pluggporten – en butiksflik per säsongssamling (#910, epic #906; ur #692)
// ----------------------------------------------------------------------------
// Ren UI-gruppering, som Baksidan i pages-shop.js: samlingens varor ligger i
// sina vanliga kategorier (dekor/mobler/tradgard/hus …) med `collection:
// "<samling>"`, så köp, placering och inventarie fungerar utan ny kod. Här
// bestäms bara fliken och dess undergrupper (sub-flikar).
//
// En samling (🎃 Halloween, 🎄 Jul, …) = skapaSamlingsFlik({ … }) i sin egen
// modul (halloween/hw-butik.js, jul/jul-butik.js) + en rad i butik-samlingar.js.
// Fliken syns BARA medan tillägget (TILLAGG i season-config.js) är på –
// pages-shop.js frågar season.isTillaggActive(tillagg) vid varje ritning och
// ritar om vid onSeasonChange. Köpta saker behålls och fungerar året runt.
// Laddas bara med import() (#271).
// ============================================================================

import { itemsInCollection } from "./shop-items.js";

/**
 * Standardundergrupperna i samma ordning för alla samlingar (#692): inne,
 * trädgård, hus, djur, avatarer. `rubriker` = { id: rubrik } per samling.
 * Kostymerna läggs till sist av samlingens konst (registreraUndergrupp).
 */
export function standardUndergrupper(rubriker) {
  return [
    { id: "inne", match: (it) => it.category === "dekor" || it.category === "mobler" },
    { id: "tradgard", match: (it) => it.category === "tradgard" },
    { id: "hus", match: (it) => it.category === "hus" },
    { id: "djur", match: (it) => !!it.hatchSpecies }, // ägg som kläcks till valt djur (#695)
    { id: "avatarer", match: (it) => it.category === "avatar" }, // #694
  ].map((g) => ({ ...g, rubrik: rubriker[g.id] }));
}

/**
 * En samlings butiksflik.
 * @param {{ samling: string, tillagg?: string, flik: {name:string, emoji:string, hint:string},
 *           slutText: string, undergrupper: {id:string, rubrik:string, match:(it:object)=>boolean}[] }} def
 *   samling   shop-items `collection` (= flik-id, = categorySvg-ikonens id)
 *   tillagg   tillägget i TILLAGG som öppnar fliken (förval: samma id)
 *   slutText  flash-texten om någon köper när samlingen just stängt
 */
export function skapaSamlingsFlik({ samling, tillagg = samling, flik, slutText, undergrupper }) {
  const grupper = [...undergrupper];
  return {
    samling,
    tillagg,
    slutText,
    /** Flik-definitionen (samma form som CATEGORIES). */
    flik: { id: samling, ...flik },
    /** Undergrupperna i ordning. `match(it)` avgör vilka samlingsvaror som hör hit. */
    undergrupper: grupper,
    /**
     * Lägg till en undergrupp (idempotent på id). `fore` = id att hamna före,
     * annars sist. Varor som ingen undergrupp matchar visas i "Övrigt".
     */
    registreraUndergrupp(grupp, fore = null) {
      if (grupper.some((g) => g.id === grupp.id)) return;
      const i = fore ? grupper.findIndex((g) => g.id === fore) : -1;
      if (i === -1) grupper.push(grupp);
      else grupper.splice(i, 0, grupp);
    },
    /**
     * Sektionerna med varor: [{ id, rubrik, items }] i undergruppsordning, tomma
     * utelämnade. Varje vara hamnar i FÖRSTA matchande grupp (disjunkt).
     */
    sektioner(items = itemsInCollection(samling)) {
      const kvar = new Set(items);
      const ut = [];
      for (const g of grupper) {
        const mine = items.filter((it) => kvar.has(it) && g.match(it));
        mine.forEach((it) => kvar.delete(it));
        if (mine.length) ut.push({ id: g.id, rubrik: g.rubrik, items: mine });
      }
      if (kvar.size) ut.push({ id: "ovrigt", rubrik: "✨ Övrigt", items: items.filter((it) => kvar.has(it)) });
      return ut;
    },
  };
}
