// Enhetstester för mysterybox-poolen & lottningen (mystery-items.js).
// Rena funktioner – ingen Firestore/DOM. Körs med `node --test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MYSTERY_ITEMS,
  MYSTERY_BOX_ID,
  MYSTERY_BOX_PRICE,
  MYSTERY_BOXES,
  RARITIES,
  RARITY_ORDER,
  getMysteryItem,
  isMysteryItem,
  rarityOf,
  dupCoins,
  itemsOfRarity,
  rollMysteryItem,
} from "../src/mystery-items.js";

const CATS = new Set(["klader", "dekor", "tradgard", "hus"]);
const SLOTS = new Set(["hatt", "ansikte", "hals", "hand", "rygg"]);

test("boxen kostar 500 coins (v2)", () => {
  assert.equal(MYSTERY_BOX_PRICE, 500);
});

test("varje item är välformat och har giltig nivå/kategori", () => {
  assert.ok(MYSTERY_ITEMS.length >= 6);
  for (const it of MYSTERY_ITEMS) {
    assert.equal(typeof it.id, "string");
    // Mystery-egna saker är prefixade "myst-"; legendary-fordon återanvänder
    // befintliga shop-id:n och markeras då existingShopItem.
    if (!it.existingShopItem) assert.ok(it.id.startsWith("myst-"), `id ska vara prefixat myst-: ${it.id}`);
    assert.ok(RARITIES[it.rarity], `okänd nivå: ${it.rarity}`);
    assert.ok(CATS.has(it.category), `okänd kategori: ${it.category}`);
    if (it.category === "klader") assert.ok(SLOTS.has(it.slot), `klader saknar giltig slot: ${it.id}`);
    if (it.category === "hus") assert.equal(it.skalId, it.id, `hus-skalId ska === id: ${it.id}`);
  }
});

test("id:n är unika", () => {
  const ids = MYSTERY_ITEMS.map((it) => it.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("alla fyra nivåer har minst en sak", () => {
  for (const r of RARITY_ORDER) assert.ok(itemsOfRarity(r).length > 0, `nivå ${r} tom`);
});

test("vikterna är legendary << sällsynt < ovanlig < vanlig", () => {
  assert.ok(RARITIES.vanlig.weight > RARITIES.ovanlig.weight);
  assert.ok(RARITIES.ovanlig.weight > RARITIES.sallsynt.weight);
  assert.ok(RARITIES.sallsynt.weight > RARITIES.legendary.weight);
  // Legendary klart under sällsynt (riktmärke ~1–2 %).
  const total = RARITY_ORDER.reduce((s, r) => s + RARITIES[r].weight, 0);
  const legShare = RARITIES.legendary.weight / total;
  assert.ok(legShare > 0.005 && legShare < 0.03, `legendary-andel ${legShare}`);
});

test("legendary innehåller fordon (bil/cykel) och hus-skal", () => {
  const leg = itemsOfRarity("legendary");
  const ids = new Set(leg.map((it) => it.id));
  assert.ok(ids.has("bil"), "bil ska vara legendary-drop");
  assert.ok(ids.has("cykel"), "cykel ska vara legendary-drop");
  assert.ok(leg.some((it) => it.category === "hus"), "minst ett hus-skal i legendary");
  // Fordonen återanvänder shop-id:n → markerade så shop-items.js inte dubblerar.
  for (const it of leg) if (it.category === "tradgard") assert.ok(it.existingShopItem, `${it.id} saknar existingShopItem`);
});

test("uppslagning & nivå-hjälpare", () => {
  const first = MYSTERY_ITEMS[0];
  assert.equal(getMysteryItem(first.id).name, first.name);
  assert.equal(getMysteryItem("finns-inte"), null);
  assert.ok(isMysteryItem(first.id));
  assert.ok(!isMysteryItem("keps"));
  assert.equal(rarityOf(first.id), first.rarity);
  assert.equal(rarityOf("keps"), null);
});

test("dupCoins ger nivåns värde (och fallbackar snällt)", () => {
  assert.equal(dupCoins("vanlig"), RARITIES.vanlig.dupCoins);
  assert.equal(dupCoins("legendary"), RARITIES.legendary.dupCoins);
  assert.equal(dupCoins("nonsens"), RARITIES.vanlig.dupCoins);
  // Legendary ger mest coins vid dubblett.
  assert.ok(RARITIES.legendary.dupCoins > RARITIES.sallsynt.dupCoins);
});

// En rng som matar ut en fast talföljd (loopar) – för deterministiska tester.
function seqRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

test("rollMysteryItem: viktad nivå + likformig sak (deterministiskt)", () => {
  // Band (vikter 58/28/12/2, total 100): vanlig [0,.58) ovanlig [.58,.86)
  // sällsynt [.86,.98) legendary [.98,1).
  assert.equal(rollMysteryItem(seqRng([0, 0])).id, itemsOfRarity("vanlig")[0].id);
  assert.equal(rollMysteryItem(seqRng([0.7, 0])).rarity, "ovanlig");
  assert.equal(rollMysteryItem(seqRng([0.9, 0])).rarity, "sallsynt");
  assert.equal(rollMysteryItem(seqRng([0.99, 0])).rarity, "legendary");
  // Sista saken i sällsynt-nivån vid idx→slut.
  const sall = itemsOfRarity("sallsynt");
  assert.equal(rollMysteryItem(seqRng([0.9, 0.999])).id, sall[sall.length - 1].id);
});

test("rollMysteryItem returnerar alltid ett item ur poolen", () => {
  const idSet = new Set(MYSTERY_ITEMS.map((it) => it.id));
  for (let k = 0; k < 200; k++) {
    const it = rollMysteryItem();
    assert.ok(idSet.has(it.id));
  }
});

test("MYSTERY_BOXES: tre nivåer 500/1000/2000, stigande legendary-chans", () => {
  assert.equal(MYSTERY_BOXES.length, 3);
  const [vanlig, mega, epic] = MYSTERY_BOXES;
  // Vanliga boxen är oförändrad: id/pris + basviktning (legendaryChance null).
  assert.equal(vanlig.id, MYSTERY_BOX_ID);
  assert.equal(vanlig.price, MYSTERY_BOX_PRICE);
  assert.equal(vanlig.legendaryChance, null);
  // Mega & Epic: dyrare + explicit högre legendary-chans.
  assert.equal(mega.id, "mysterybox-mega");
  assert.equal(mega.price, 1000);
  assert.equal(epic.id, "mysterybox-epic");
  assert.equal(epic.price, 2000);
  assert.ok(mega.legendaryChance > 0.05 && mega.legendaryChance < 0.2, `mega ${mega.legendaryChance}`);
  assert.ok(epic.legendaryChance >= 0.85, `epic ${epic.legendaryChance}`);
  // Priserna i stigande ordning (visas billigast → dyrast sist i shoppen).
  assert.ok(vanlig.price < mega.price && mega.price < epic.price);
});

test("rollMysteryItem: legendaryChance parametrerar legendary-oddsen", () => {
  // rng < chansen → legendary; annars viktas övriga tre nivåer inbördes.
  assert.equal(rollMysteryItem(seqRng([0.0, 0]), { legendaryChance: 0.9 }).rarity, "legendary");
  assert.notEqual(rollMysteryItem(seqRng([0.95, 0, 0]), { legendaryChance: 0.9 }).rarity, "legendary");
  // Epic-chans (0.9): stor andel legendary över många drag.
  let leg = 0;
  const N = 20000;
  for (let k = 0; k < N; k++) if (rollMysteryItem(Math.random, { legendaryChance: 0.9 }).rarity === "legendary") leg++;
  assert.ok(leg / N > 0.85, `epic legendary-andel ${leg / N}`);
  // Mega-chans (0.11): tydligt högre än basboxens ~2 %, men långt från Epic.
  let mleg = 0;
  for (let k = 0; k < N; k++) if (rollMysteryItem(Math.random, { legendaryChance: 0.11 }).rarity === "legendary") mleg++;
  assert.ok(mleg / N > 0.08 && mleg / N < 0.15, `mega legendary-andel ${mleg / N}`);
});

test("distributionen speglar vikterna grovt (vanlig > ovanlig > sällsynt > legendary)", () => {
  const counts = { vanlig: 0, ovanlig: 0, sallsynt: 0, legendary: 0 };
  const N = 40000;
  for (let k = 0; k < N; k++) counts[rollMysteryItem().rarity]++;
  assert.ok(counts.vanlig > counts.ovanlig, `vanlig(${counts.vanlig}) > ovanlig(${counts.ovanlig})`);
  assert.ok(counts.ovanlig > counts.sallsynt, `ovanlig(${counts.ovanlig}) > sällsynt(${counts.sallsynt})`);
  assert.ok(counts.sallsynt > counts.legendary, `sällsynt(${counts.sallsynt}) > legendary(${counts.legendary})`);
  // Legendary ligger runt 2 % (tolerant band).
  const legShare = counts.legendary / N;
  assert.ok(legShare > 0.008 && legShare < 0.04, `legendary-andel ${legShare}`);
});
