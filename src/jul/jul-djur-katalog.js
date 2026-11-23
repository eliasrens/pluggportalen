// ============================================================================
// Pluggporten – Jul-djurens butiksvaror (#912, epic #906)
// ----------------------------------------------------------------------------
// Ett julklappsägg per djur (500 mynt) som kläcks till VALT djur (`hatchSpecies`),
// exakt som Halloweens pumpaägg (halloween/hw-djur-katalog.js). Ren katalog utan
// konst: jul-djur.js slår in varorna i SHOP_ITEMS lazy (i webbläsaren) och
// butikKop på servern läser samma rader via functions/butik/
// (admin/sync-butik-functions.mjs). Namnen = JUL_SPECIES i art-pets-creatures.js
// (test/butik-core.test.js håller dem i par). Id:na sparas – byt dem aldrig.
// Emoji-fallbacken är Emoji ≤ 12 (#590).
// ============================================================================

const ARTER = [
  ["snois", "Snöis", "⛄"], ["renis", "Renis", "🦌"], ["pingvis", "Pingvis", "🐧"],
  ["pepparis", "Pepparis", "🍪"], ["isbjornis", "Isbjörnis", "🐻"], ["tomtis", "Tomtis", "🎅"],
  ["ravis", "Rävis", "🦊"], ["snougglis", "Snöugglis", "🦉"], ["glittris", "Glittris", "⭐"],
  ["julklappis", "Julklappis", "🎁"],
];

/** Butiksvarorna "jul-djur-<art>" i katalogordning. */
export const JUL_DJUR_VAROR = ARTER.map(([art, name, emoji]) => ({
  id: "jul-djur-" + art, name, emoji, category: "husdjur", price: 500, collection: "jul", hatchSpecies: art,
}));
