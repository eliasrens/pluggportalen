// ============================================================================
// Pluggporten – Jul-kostymernas katalog (#911, epic #906, DEL E.1)
// ----------------------------------------------------------------------------
// Samma regler som Halloween-kostymerna (hw-kostymer.js, #693/#799): vanliga
// klädsaker (`category: "klader"`, en per slot) med två markeringar:
//   collection: "jul" → säljs bara i 🎄 Jul-fliken (jul-butik.js)
//   seasonal:   "jul" → ritas med af-kostym (avatars.js) men bärs och syns
//               ÅRET RUNT – bara butiken är säsongsbunden.
// Ren katalog utan konst. Lazy (#271): jul-konst.js slår in raderna i SHOP_ITEMS
// (registerShopItems), och butikKop på servern läser samma rader via
// functions/butik/ (admin/sync-butik-functions.mjs). Konsten: jul-art-kostymer.js.
// Ett buret jul-id som inte laddats än ritas som platshållare i avatarMarkup.
// Emoji-fallbacken är Emoji ≤ 12 (#590). Id:na sparas i Firestore – byt dem aldrig.
// ============================================================================

const kostym = (id, name, emoji, slot, price) =>
  ({ id, name, emoji, category: "klader", slot, price, collection: "jul", seasonal: "jul" });

/** Kostymerna i butiksordning (hatt → ansikte → hals → hand → rygg). */
export const JUL_KOSTYMER_KATALOG = [
  // "Tomteluva" finns redan bland de vanliga kläderna (tomtemossa) – julens får
  // ett eget namn så garderoben inte visar två likadana.
  kostym("jul-tomteluva", "Tomteluva med bjällra", "🎅", "hatt", 60),
  kostym("jul-renhorn", "Renhorn", "🦌", "hatt", 80),
  kostym("jul-oronmuffar", "Öronmuffar", "🎧", "hatt", 90),
  kostym("jul-luciakrona", "Luciakrona", "🕯️", "hatt", 120),
  kostym("jul-rosiga-kinder", "Rosiga kinder med snöflinga", "❄️", "ansikte", 70),
  kostym("jul-tomteskagg", "Tomteskägg", "🧔", "ansikte", 90),
  kostym("jul-stickad-halsduk", "Stickad halsduk", "🧣", "hals", 100),
  kostym("jul-paket", "Julklapp", "🎁", "hand", 50),
  kostym("jul-polkagrisstav", "Polkagrisstav", "🍬", "hand", 110),
  kostym("jul-tomtesack", "Tomtesäck", "🎒", "rygg", 200),
  kostym("jul-snoangelvingar", "Snöängelvingar", "👼", "rygg", 250),
];
