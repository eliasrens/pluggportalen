// ============================================================================
// Tester: badrumsmöblerna i shoppen (#829)
//   • katalogen: 8 nya "mobler"-saker i Möbler & prylar, billigt → dyrt
//   • konsten laddas lazy (loadCollectionArt) – före = emoji-fallback, efter =
//     SVG i samma stil (kontur #3B3350, kontaktskugga under golvsakerna)
//   • samma placeringsflöde som övriga möbler; mattan ligger underst
//   • konstfilen ligger utanför bootgrafen och under 400 rader
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  getItem, itemsInCategory, isFlatItem, isMultiItem, isGardenItem, isHouseItem, isWearable, itemIdFromKey,
} from "../src/shop-items.js";
import { itemSvg, itemSize, loadCollectionArt } from "../src/art-items.js";
import { nyPlaceringsNyckel, ordnaNycklar } from "../src/rum-promenad-golv.js";

const BADRUM = ["badrumsmatta", "tvattkorg", "handdukstork", "toalett", "handfat", "dusch", "badkar", "tvattmaskin"];

test("katalogen: 8 badrumsmöbler under Möbler & prylar", () => {
  const mobler = itemsInCategory("mobler").map((it) => it.id);
  let pris = 0;
  for (const id of BADRUM) {
    const it = getItem(id);
    assert.ok(it, `${id} finns`);
    assert.equal(it.category, "mobler");
    assert.ok(mobler.includes(id), `${id} syns i fliken`);
    assert.ok(it.name && it.emoji && it.price > 0);
    assert.ok(it.price >= pris, `${id}: priserna stiger billigt → dyrt`);
    pris = it.price;
  }
});

test("konsten: emoji-fallback före laddning, SVG i seriens stil efter", async () => {
  assert.equal(itemSvg("badkar"), null, "före loadCollectionArt → anroparen visar emoji");
  await loadCollectionArt();
  const soffa = itemSize("soffa");
  for (const id of BADRUM) {
    const svg = itemSvg(id);
    assert.ok(svg && svg.startsWith("<svg"), `${id} har konst`);
    assert.ok(svg.includes(`aria-label="${getItem(id).name}"`));
    assert.doesNotMatch(svg, /NaN|undefined/, `${id}: inga trasiga koordinater`);
    assert.match(svg, /stroke="#3B3350" stroke-width="3"/, `${id}: seriens kontur`);
    if (!isFlatItem(id)) assert.match(svg, /opacity="0\.09"/, `${id}: kontaktskugga`);
    const { w, h } = itemSize(id);
    assert.ok(w >= 2.8 && w <= soffa.w * 1.1 && h > 1 && h < 8, `${id} storlek ${w}×${h} i paritet med soffan`);
  }
});

test("samma placeringsflöde som övriga möbler; mattan ligger underst", async () => {
  await loadCollectionArt();
  for (const id of BADRUM) {
    assert.ok(!isGardenItem(id) && !isHouseItem(id) && !isWearable(id), `${id} placeras i rummet`);
    assert.ok(isMultiItem(id), `${id} kan ägas i flera exemplar`);
  }
  assert.ok(isFlatItem("badrumsmatta"));
  assert.ok(BADRUM.filter((id) => isFlatItem(id)).length === 1, "bara mattan är platt");
  const placements = {};
  for (const id of ["badkar", "toalett", "toalett", "badrumsmatta"]) placements[nyPlaceringsNyckel(placements, id)] = { x: 50, y: 70 };
  assert.deepEqual(Object.keys(placements), ["badkar", "toalett", "toalett#2", "badrumsmatta"]);
  const ordning = ordnaNycklar(placements, (k) => (isFlatItem(itemIdFromKey(k)) ? 0 : 1));
  assert.equal(ordning[0], "badrumsmatta");
  delete placements["toalett#2"];
  assert.deepEqual(Object.keys(placements), ["badkar", "toalett", "badrumsmatta"]);
});

test("konstfilen laddas bara lazy och håller 400-radersgränsen", () => {
  const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
  for (const f of readdirSync(new URL("../src/", import.meta.url))) {
    if (!f.endsWith(".js")) continue;
    assert.doesNotMatch(src(f), /import\s[^;()]*from\s+["']\.\/art-furniture-badrum\.js["']/, `${f} importerar inte statiskt`);
  }
  for (const f of ["art-furniture-badrum.js", "shop-items.js", "art-items.js"]) {
    assert.ok(src(f).split("\n").length <= 401, `${f} ≤ 400 rader`);
  }
});
