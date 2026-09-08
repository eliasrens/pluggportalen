// Enhetstester för mysterybox-poolen & lottningen (mystery-items.js).
// Rena funktioner – ingen Firestore/DOM. Körs med `node --test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MYSTERY_ITEMS,
  RARITIES,
  RARITY_ORDER,
  getMysteryItem,
  isMysteryItem,
  rarityOf,
  dupCoins,
  itemsOfRarity,
  rollMysteryItem,
} from "../src/mystery-items.js";

const CATS = new Set(["klader", "dekor", "hus"]);
const SLOTS = new Set(["hatt", "ansikte", "hals", "hand", "rygg"]);

test("varje item är välformat och har giltig nivå/kategori", () => {
  assert.ok(MYSTERY_ITEMS.length >= 6);
  for (const it of MYSTERY_ITEMS) {
    assert.equal(typeof it.id, "string");
    assert.ok(it.id.startsWith("myst-"), `id ska vara prefixat myst-: ${it.id}`);
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

test("alla tre nivåer har minst en sak", () => {
  for (const r of RARITY_ORDER) assert.ok(itemsOfRarity(r).length > 0, `nivå ${r} tom`);
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
  assert.equal(dupCoins("sallsynt"), RARITIES.sallsynt.dupCoins);
  assert.equal(dupCoins("nonsens"), RARITIES.vanlig.dupCoins);
});

// En rng som matar ut en fast talföljd (loopar) – för deterministiska tester.
function seqRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

test("rollMysteryItem: viktad nivå + likformig sak (deterministiskt)", () => {
  // rng≈0 → första nivån (vanlig), idx 0.
  assert.equal(rollMysteryItem(seqRng([0, 0])).id, itemsOfRarity("vanlig")[0].id);
  // rng=0.7 → hamnar i ovanlig-bandet (60<70<90), idx 0.
  assert.equal(rollMysteryItem(seqRng([0.7, 0])).rarity, "ovanlig");
  // rng=0.95 → sällsynt-bandet (>90), sista saken i nivån.
  const sall = itemsOfRarity("sallsynt");
  assert.equal(rollMysteryItem(seqRng([0.95, 0.999])).id, sall[sall.length - 1].id);
});

test("rollMysteryItem returnerar alltid ett item ur poolen", () => {
  const idSet = new Set(MYSTERY_ITEMS.map((it) => it.id));
  for (let k = 0; k < 200; k++) {
    const it = rollMysteryItem();
    assert.ok(idSet.has(it.id));
  }
});

test("distributionen speglar vikterna grovt (vanlig > ovanlig > sällsynt)", () => {
  const counts = { vanlig: 0, ovanlig: 0, sallsynt: 0 };
  const N = 20000;
  for (let k = 0; k < N; k++) counts[rollMysteryItem().rarity]++;
  // Rangordning ska hålla med god marginal.
  assert.ok(counts.vanlig > counts.ovanlig, `vanlig(${counts.vanlig}) > ovanlig(${counts.ovanlig})`);
  assert.ok(counts.ovanlig > counts.sallsynt, `ovanlig(${counts.ovanlig}) > sällsynt(${counts.sallsynt})`);
  // Sällsynt ligger runt 10 % (tolerant band).
  const rareShare = counts.sallsynt / N;
  assert.ok(rareShare > 0.06 && rareShare < 0.14, `sällsynt-andel ${rareShare}`);
});
