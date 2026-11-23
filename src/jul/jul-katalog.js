// ============================================================================
// Pluggporten – 🎄 Jul-samlingens katalog: dekor, möbler, trädgård, hus (#910)
// ----------------------------------------------------------------------------
// Vanliga kategorier (placering/inventarie som förut) + `collection: "jul"` →
// säljs BARA i 🎄 Jul-fliken (jul-butik.js) medan Jul är på; köpta saker gäller
// året runt. Samma antal och prisnivå som Halloween (#692, DEL D.2).
// Ren katalog utan konst. Lazy (#271, bootgrafen oförändrad, shop-items.js vid
// sin 400-radersgräns): jul-konst.js slår in raderna i SHOP_ITEMS
// (registerShopItems), och butikKop på servern läser samma rader via
// functions/butik/ (admin/sync-butik-functions.mjs). Konsten: jul-art-*.js.
// Emoji-fallbacken är Emoji ≤ 12 (#590). Id:na sparas i Firestore – byt dem aldrig.
// ============================================================================

const vara = (category, id, name, emoji, price, extra = {}) =>
  ({ id, name, emoji, category, price, ...extra, collection: "jul" });

/** Julvarorna i butiksordning: 9 dekor, 3 möbler, 8 trädgård, 3 hus. */
export const JUL_VAROR = [
  vara("dekor", "jul-adventsljusstake", "Adventsljusstake", "🕯️", 75),
  vara("dekor", "jul-julstjarna", "Julstjärna i fönstret", "⭐", 60),
  vara("dekor", "jul-pepparkaksfat", "Pepparkaksfat", "🍪", 50),
  vara("dekor", "jul-julbock", "Liten julbock", "🐐", 55),
  vara("dekor", "jul-tomtefigur", "Tomtefigur", "🎅", 110),
  vara("dekor", "jul-julstrumpa", "Julstrumpa", "🧦", 40),
  vara("dekor", "jul-snoglob", "Snöglob", "❄️", 150),
  vara("dekor", "jul-ljusslinga", "Ljusslinga", "💡", 45),
  vara("dekor", "jul-mistel", "Mistel", "🌿", 95),
  vara("mobler", "jul-julmatta", "Julmatta", "🟥", 85, { flat: true }),
  vara("mobler", "jul-oppen-spis", "Öppen spis med strumpor", "🔥", 180),
  vara("mobler", "jul-julgran", "Julgran med pynt", "🎄", 120),
  vara("tradgard", "jul-snogubbe", "Snögubbe", "⛄", 60),
  vara("tradgard", "jul-snolykta", "Snölykta", "🏮", 70),
  vara("tradgard", "jul-kalke", "Kälke", "🛷", 80),
  vara("tradgard", "jul-granris", "Granris med ljus", "🌲", 110),
  vara("tradgard", "jul-stor-julbock", "Stor julbock", "🐐", 130),
  vara("tradgard", "jul-slade", "Släde med ren", "🦌", 180),
  vara("tradgard", "jul-fagelbord", "Fågelbord med talgbollar", "🐦", 140),
  vara("tradgard", "jul-isskulptur", "Isskulptur som glittrar", "🧊", 300),
  vara("hus", "jul-pepparkakshus", "Pepparkakshus", "🏠", 4000, { skalId: "jul-pepparkakshus" }),
  vara("hus", "jul-tomteverkstad", "Tomteverkstad", "🛠️", 4000, { skalId: "jul-tomteverkstad" }),
  vara("hus", "jul-snohydda", "Snöhydda", "🏔️", 4000, { skalId: "jul-snohydda" }),
];
