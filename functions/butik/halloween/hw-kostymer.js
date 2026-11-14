// ============================================================================
// Pluggporten – Halloween-kostymernas katalog (#693, epic #689)
// ----------------------------------------------------------------------------
// Vanliga klädsaker (`category: "klader"`, en per slot) med två markeringar:
//   collection: "halloween" → säljs bara i 🎃 Halloween-fliken (hw-butik.js)
//   seasonal:   "halloween" → ritas med af-kostym (avatars.js) men bärs och syns
//               ÅRET RUNT (#799) – bara butiken är säsongsbunden.
// Lazy (#271, bootgrafen 107): registreras i SHOP_ITEMS av hw-konst.js via
// registerShopItems. Ett buret hw-id som inte laddats än ritas som platshållare
// i avatarMarkup och fylls i när katalogen kommit. Konsten: hw-art-kostymer.js.
// Id:na sparas i Firestore (ownedItems, avatarItems) – byt dem aldrig.
// ============================================================================

const kostym = (id, name, emoji, slot, price) =>
  ({ id, name, emoji, category: "klader", slot, price, collection: "halloween", seasonal: "halloween" });

/** Kostymerna i butiksordning (hatt → ansikte → hals → hand → rygg). */
export const HW_KOSTYMER_KATALOG = [
  kostym("hw-kattoron", "Kattöron", "🐱", "hatt", 60),
  kostym("hw-monsterhorn", "Monsterhorn", "👾", "hatt", 80),
  kostym("hw-haxhatt", "Häxhatt", "🧙", "hatt", 120),
  kostym("hw-pumpahuvud", "Pumpahuvud", "🎃", "hatt", 150),
  kostym("hw-mumiebandage", "Mumiebandage", "🩹", "ansikte", 70),
  kostym("hw-spokmask", "Spökmask", "👻", "ansikte", 90),
  kostym("hw-vampyrkrage", "Vampyrkrage", "🧛", "hals", 100),
  kostym("hw-godispase", "Godispåse", "🍬", "hand", 50),
  kostym("hw-haxstav", "Häxstav", "🌙", "hand", 110),
  kostym("hw-fladdervingar", "Fladdermusvingar", "🦇", "rygg", 200),
  kostym("hw-vampyrmantel", "Vampyrmantel", "🧛", "rygg", 250),
];
