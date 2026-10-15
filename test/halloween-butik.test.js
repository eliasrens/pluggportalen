// ============================================================================
// Tester: Halloween-sektionen i butiken (#692, epic #689)
//   • katalogen: 12 inne (dekor/möbler), 8 trädgård, 3 hus – alla
//     `collection: "halloween"`, unika id:n, priser enligt spec §3
//   • test 5 (katalogdelen): samlingsvarorna ligger BARA i sin flik – aldrig i
//     de vanliga kategoriflikarna (itemsInCategory) – med undergrupper som D–F
//     kan bygga på (registreraUndergrupp)
//   • test 6: konsten är säsongsoberoende – när den laddats ritas köpta saker
//     och husskal oavsett Halloween-läget (inget i konsten läser säsongen)
//   • test 7: sakerna går genom samma placeringsflöde som befintliga saker
//     (klassning trädgård/rum/hus, multi/flat, placeringsnycklar, rumSakHtml)
//   • lazy-konsten: före loadCollectionArt() = emoji-/stug-fallback, aldrig fel
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SHOP_ITEMS, getItem, itemsInCategory, itemsInCollection, itemCollection, isGardenItem, isHouseItem,
  isMultiItem, isFlatItem, isWearable, itemIdFromKey,
} from "../src/shop-items.js";
import { itemSvg, itemSize, categorySvg, loadCollectionArt } from "../src/art-items.js";
import { husSkalMarkup, isHusSkal, listHusSkal } from "../src/art-hus-ute.js";
import { nyPlaceringsNyckel, ordnaNycklar, rumSakHtml } from "../src/rum-promenad-golv.js";

// C:s varor (dekor/möbler/trädgård/hus); kostymerna (#693) testas i halloween-kostymer.test.js,
// F:s djur (#695, hatchSpecies) i halloween-djur.test.js.
const HW = itemsInCollection("halloween").filter((it) => ["dekor", "mobler", "tradgard", "hus"].includes(it.category) && !it.hatchSpecies);
const INNE = HW.filter((it) => it.category === "dekor" || it.category === "mobler");
const UTE = HW.filter((it) => it.category === "tradgard");
const HUS = HW.filter((it) => it.category === "hus");

test("katalogen: 12 inne, 8 trädgård, 3 hus – alla i Halloween-samlingen", () => {
  assert.equal(INNE.length, 12);
  assert.equal(UTE.length, 8);
  assert.equal(HUS.length, 3);
  assert.equal(HW.length, 23, "C:s varor är just dessa (D–F lägger till fler)");
  for (const it of HW) {
    assert.equal(itemCollection(it.id), "halloween");
    assert.match(it.id, /^hw-[a-z0-9-]+$/, `${it.id}: stabilt hw-prefix, inget '#'`);
    assert.ok(it.name && it.emoji, `${it.id}: namn + emoji-fallback`);
    assert.doesNotMatch(it.name, /["<>]/, `${it.id}: namnet hamnar i aria-label`);
  }
  const ids = SHOP_ITEMS.map((it) => it.id);
  assert.equal(new Set(ids).size, ids.length, "inga dubbla id:n i hela katalogen");
});

test("priser enligt spec §3 + Elias: inne 40–250, ute 60–300, hus exakt 4 000", () => {
  for (const it of INNE) assert.ok(it.price >= 40 && it.price <= 250, `${it.id} ${it.price}`);
  for (const it of UTE) assert.ok(it.price >= 60 && it.price <= 300, `${it.id} ${it.price}`);
  for (const it of HUS) assert.equal(it.price, 4000, it.id);
});

test("test 5: samlingsvaror visas bara i Halloween-fliken, aldrig i vanliga flikar", () => {
  for (const cat of ["dekor", "mobler", "tradgard", "hus", "klader", "husdjur"]) {
    assert.ok(itemsInCategory(cat).every((it) => !it.collection), `${cat} innehåller inga säsongsvaror`);
  }
  // Befintliga varor är kvar i sina flikar.
  assert.ok(itemsInCategory("dekor").some((it) => it.id === "krukvaxt"));
  assert.ok(itemsInCategory("hus").some((it) => it.id === "slott"));
});

test("test 5: Halloween-flikens undergrupper – disjunkta, D–F kan lägga till egna", async () => {
  const hw = await import("../src/halloween/hw-butik.js");
  const sek = hw.halloweenSektioner(HW);
  assert.deepEqual(sek.map((s) => s.id), ["inne", "tradgard", "hus"]);
  assert.deepEqual(sek.map((s) => s.items.length), [12, 8, 3]);
  // En ny undergrupp (som D:s kostymer) före "hus"; omatchade varor → "Övrigt".
  const kostym = { id: "x-kostym", name: "Testkostym", category: "klader", collection: "halloween" };
  const okand = { id: "x-okand", name: "Okänd", category: "mat", collection: "halloween" };
  hw.registreraUndergrupp({ id: "x-kostymer", rubrik: "Kostymer", match: (it) => it.category === "klader" }, "hus");
  hw.registreraUndergrupp({ id: "x-kostymer", rubrik: "dubbel", match: () => true }); // idempotent
  const sek2 = hw.halloweenSektioner([...HW, kostym, okand]);
  assert.deepEqual(sek2.map((s) => s.id), ["inne", "tradgard", "x-kostymer", "hus", "ovrigt"]);
  assert.deepEqual(sek2.find((s) => s.id === "ovrigt").items, [okand]);
  assert.equal(hw.HALLOWEEN_FLIK.id, "halloween");
});

test("lazy konst: före laddning fallback (emoji/stuga), efter laddning riktig SVG", async () => {
  // Katalogen är statisk (getItem funkar direkt) – bara konsten är lazy.
  assert.equal(getItem("hw-pumpalykta").category, "dekor");
  assert.equal(itemSvg("hw-pumpalykta"), null, "utan konst → anroparen visar emoji");
  assert.equal(isHusSkal("hw-spokhus"), false);
  assert.equal(husSkalMarkup("hw-spokhus"), husSkalMarkup("stuga"), "okänt skal → stugan");

  await loadCollectionArt();
  await loadCollectionArt(); // idempotent
  for (const it of HW) {
    const svg = itemSvg(it.id);
    assert.ok(svg && svg.startsWith("<svg"), `${it.id} har konst`);
    assert.ok(svg.includes(`aria-label="${it.name}"`));
    assert.doesNotMatch(svg, /NaN|undefined/, `${it.id}: inga trasiga koordinater`);
    const { w, h } = itemSize(it.id);
    assert.ok(w > 1 && h > 0.5 && h < 12, `${it.id} storlek ${w}×${h}`);
  }
  assert.ok(categorySvg("halloween"), "flik-ikonen är SVG (ingen Emoji 13+)");
});

test("test 6: husskalen registrerade – väljs i Nytt hus, ritas utan säsongsberoende", async () => {
  await loadCollectionArt();
  const lista = listHusSkal().map((s) => s.id);
  for (const it of HUS) {
    assert.equal(it.skalId, it.id, "item-id === skal-id (Firestore)");
    assert.ok(isHusSkal(it.id));
    assert.ok(lista.includes(it.id));
    const m = husSkalMarkup(it.id);
    assert.notEqual(m, husSkalMarkup("stuga"));
    assert.doesNotMatch(m, /NaN|undefined/);
  }
  // Konsten läser aldrig säsongen: modulerna importerar inte season*.js.
  const { readFileSync, readdirSync } = await import("node:fs");
  for (const f of readdirSync(new URL("../src/halloween/", import.meta.url))) {
    if (!f.startsWith("hw-art") && f !== "hw-konst.js") continue;
    const src = readFileSync(new URL(`../src/halloween/${f}`, import.meta.url), "utf8");
    assert.doesNotMatch(src, /season/, `${f} beror inte på säsongen`);
  }
});

test("test 7: samma placeringsflöde som befintliga saker", async () => {
  await loadCollectionArt();
  // Klassningen styr var saken placeras (rum/ute/husväljare) och om flera får ägas.
  for (const it of INNE) {
    assert.ok(!isGardenItem(it.id) && !isHouseItem(it.id) && !isWearable(it.id), `${it.id} placeras i rummet`);
    assert.ok(isMultiItem(it.id), `${it.id} kan ägas i flera exemplar`);
  }
  for (const it of UTE) {
    assert.ok(isGardenItem(it.id) && isMultiItem(it.id), `${it.id} placeras ute`);
  }
  for (const it of HUS) assert.ok(isHouseItem(it.id) && !isMultiItem(it.id));
  assert.ok(isFlatItem("hw-halloweenmatta"), "mattan ritas underst");

  // Placera två lyktor + en matta, flytta (ny x/y), ta bort – som i varld-rum.js.
  const placements = {};
  for (const id of ["hw-pumpalykta", "hw-pumpalykta", "hw-halloweenmatta"]) {
    const key = nyPlaceringsNyckel(placements, id);
    placements[key] = { x: 50, y: 70 };
  }
  assert.deepEqual(Object.keys(placements), ["hw-pumpalykta", "hw-pumpalykta#2", "hw-halloweenmatta"]);
  assert.equal(itemIdFromKey("hw-pumpalykta#2"), "hw-pumpalykta");
  const ordning = ordnaNycklar(placements, (k) => (isFlatItem(itemIdFromKey(k)) ? 0 : 1));
  assert.equal(ordning[0], "hw-halloweenmatta");
  placements["hw-pumpalykta#2"] = { x: 20, y: 80 };
  delete placements["hw-pumpalykta"];
  const key = "hw-pumpalykta#2";
  const { w, h } = itemSize(itemIdFromKey(key));
  const html = rumSakHtml({ key, x: 20, y: 80, titel: "Pumpalykta", art: itemSvg("hw-pumpalykta"), w, h });
  assert.ok(html.includes(`data-id="${key}"`) && html.includes(`data-remove="${key}"`) && html.includes("<svg"));
});
