// ============================================================================
// Klasscentret – crowdfunding-katalogen (#486, epic #475 Klasscentret 2/4).
// ----------------------------------------------------------------------------
// Ren modul (ingen Firestore). Laddas BARA dynamiskt (#271) – shop-items.js
// (400/400 rader, bootgraf) rörs inte. Klassen samlar ihop till ett föremål
// i taget per id; insamlingen bor i classCenters/{classId}/fund/{id}
// (se kc-fund-plan.js / kc-fund-data.js och DATAMODELL.md "Klasscentret").
//
// Fält per föremål
//   id           stabil nyckel = fund-dokumentets id (^[a-z0-9-]{1,40}$)
//   namn         visningsnamn
//   targetPrice  heltal KC_PRIS_MIN..KC_PRIS_MAX (låses i fund vid första
//                donationen – ändra aldrig priset på ett befintligt id)
//   zon          "golv" (står på golvet) | "vagg" (hängs upp: vägg/tak)
//   storlek      standardstorlek { w, h } i procent av scenens bredd/höjd
//                (samma enhet som layoutens x/y)
//   art          rit-nyckel för konsten (sub-issue B, art-modul)
//   emoji        reservbild tills konsten finns
//   beskrivning  valfri – vad föremålet GÖR (visas på shopkortet, #528)
//
// ⚠️ firestore.rules (KLASSCENTRET, kcPris) har en kopia av id → pris.
// Nytt föremål = ny post här + samma rad där (+ rules-deploy).
// test/kc-fund-plan.test.js failar om de glider isär.
// ============================================================================

export const KC_PRIS_MIN = 2000;
export const KC_PRIS_MAX = 10000;
export const KC_ZONER = Object.freeze(["golv", "vagg"]);

export const KC_SHOP_ITEMS = Object.freeze([
  { id: "klassfana", namn: "Klassens fana", emoji: "🚩", targetPrice: 2000, zon: "vagg", storlek: { w: 10, h: 24 }, art: "kc-klassfana" },
  {
    id: "trofehylla", namn: "Troféhylla", emoji: "🏆", targetPrice: 2500, zon: "vagg", storlek: { w: 18, h: 14 }, art: "kc-trofehylla",
    // #528: hedershyllan – klassens 6 finaste pokaler ställs dit automatiskt.
    beskrivning: "Klassens hedershylla! Här ställs era 6 finaste pokaler automatiskt – med guldkant och belysning. Den vanliga pokalhyllan rymmer bara 3.",
  },
  { id: "lounge", namn: "Stor lounge-soffa", emoji: "🛋️", targetPrice: 3000, zon: "golv", storlek: { w: 26, h: 16 }, art: "kc-lounge" },
  { id: "akvarium", namn: "Akvarium", emoji: "🐠", targetPrice: 4000, zon: "golv", storlek: { w: 20, h: 20 }, art: "kc-akvarium" },
  { id: "guldstaty", namn: "Guldstaty", emoji: "🗿", targetPrice: 5000, zon: "golv", storlek: { w: 12, h: 30 }, art: "kc-guldstaty" },
  { id: "flygel", namn: "Flygel", emoji: "🎹", targetPrice: 6000, zon: "golv", storlek: { w: 24, h: 22 }, art: "kc-flygel" },
  { id: "fontan", namn: "Pampig fontän", emoji: "⛲", targetPrice: 8000, zon: "golv", storlek: { w: 22, h: 26 }, art: "kc-fontan" },
  { id: "kristallkrona", namn: "Gigantisk kristallkrona", emoji: "💎", targetPrice: 10000, zon: "vagg", storlek: { w: 18, h: 22 }, art: "kc-kristallkrona" },
].map((it) => Object.freeze({ ...it, storlek: Object.freeze({ ...it.storlek }) })));

const PER_ID = new Map(KC_SHOP_ITEMS.map((it) => [it.id, it]));

/** Föremålet med detta id, eller null. */
export function kcShopItem(id) {
  return PER_ID.get(id) || null;
}
