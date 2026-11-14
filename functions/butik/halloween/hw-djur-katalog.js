// ============================================================================
// Pluggporten – Halloween-djurens butiksvaror (#695, utbrutet i #854)
// ----------------------------------------------------------------------------
// Ett pumpaägg per djur (500 mynt) som kläcks till VALT djur (`hatchSpecies`).
// Ren katalog utan konst: hw-djur.js slår in varorna i SHOP_ITEMS lazy (i
// webbläsaren) och butikKop på servern läser samma rader via functions/butik/
// (admin/sync-butik-functions.mjs). Namnen = HW_SPECIES i art-pets-creatures.js
// (test/butik-core.test.js håller dem i par). Id:na sparas – byt dem aldrig.
// ============================================================================

const ARTER = [
  ["spokis", "Spökis", "👻"], ["pumpis", "Pumpis", "🎃"], ["fladdis", "Fladdis", "🦇"],
  ["gruffe", "Gruffe", "🐉"], ["svartis", "Häxis", "🐈"], ["mumme", "Mumme", "🧸"],
  ["spindis", "Spindis", "🕷️"], ["skelli", "Skelli", "🦴"], ["uggli", "Uggli", "🦉"],
  ["slemmis", "Slemmis", "🟢"],
];

/** Butiksvarorna "hw-djur-<art>" i katalogordning. */
export const HW_DJUR_VAROR = ARTER.map(([art, name, emoji]) => ({
  id: "hw-djur-" + art, name, emoji, category: "husdjur", price: 500, collection: "halloween", hatchSpecies: art,
}));
