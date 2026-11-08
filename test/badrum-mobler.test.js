// ============================================================================
// Tester: badrumsmöblerna i shoppen (#829)
//   • katalogen: 8 nya "mobler"-saker i Möbler & prylar, billigt → dyrt
//   • konsten laddas lazy (loadCollectionArt) – före = emoji-fallback, efter =
//     SVG i samma stil (kontur #3B3350, kontaktskugga under golvsakerna)
//   • samma placeringsflöde som övriga möbler; mattan ligger underst
//   • ⟳ fyra riktningar + ↔ vänd för alla åtta (som #699)
//   • konstfilerna ligger utanför bootgrafen och under 400 rader
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { posix } from "node:path";
import {
  getItem, itemsInCategory, isFlatItem, isMultiItem, isGardenItem, isHouseItem, isWearable, itemIdFromKey,
} from "../src/shop-items.js";
import {
  itemSvg, itemSize, loadCollectionArt, kanRoteras, kanVandas, vridPlacering, riktningsFalt,
} from "../src/art-items.js";
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

test("⟳ alla fyra riktningar (samma höjd) och ↔ vänd, sparas som rot/flip", async () => {
  await loadCollectionArt();
  for (const id of BADRUM) {
    assert.ok(kanRoteras(id), `${id} kan roteras`);
    assert.ok(kanVandas(id), `${id} kan vändas (ingen text)`);
    const h = itemSize(id).h;
    for (const rot of [1, 2, 3]) {
      const svg = itemSvg(id, { rot });
      assert.doesNotMatch(svg, /NaN|undefined/, `${id} rot ${rot}`);
      assert.equal(itemSize(id, rot).h, h, `${id} rot ${rot}: samma höjd → samma golvpunkt`);
    }
    assert.notEqual(itemSvg(id, { rot: 1 }), itemSvg(id), `${id}: sidan är en egen ritning`);
    const pos = { x: 40, y: 70 };
    vridPlacering(id, pos, "rot");
    vridPlacering(id, pos, "flip");
    assert.deepEqual(riktningsFalt(JSON.parse(JSON.stringify(pos))), { rot: 1, flip: true }, `${id}: sparas och laddas om`);
  }
});

test("konstfilerna ligger utanför bootgrafen och håller 400-radersgränsen", () => {
  const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
  // Samma BFS som admin/qa-bootgraf-bfs.mjs men på arbetskopian: bara statiska importer.
  const re = /(?:^|[;\n])\s*(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?["']([^"']+)["']/g;
  const seen = new Set(["src/app.js"]);
  const q = ["src/app.js"];
  while (q.length) {
    const f = q.shift();
    for (const m of src(f).matchAll(re)) {
      if (!m[1].startsWith(".")) continue;
      const p = posix.normalize(posix.join(posix.dirname(f), m[1]));
      if (!seen.has(p)) { seen.add(p); q.push(p); }
    }
  }
  for (const f of ["src/art-furniture-badrum.js", "src/art-furniture-vyer-badrum.js"]) {
    assert.ok(!seen.has(f), `${f} laddas lazy`);
  }
  for (const f of ["art-furniture-badrum.js", "art-furniture-vyer-badrum.js", "art-furniture-vyer.js", "shop-items.js", "art-items.js"]) {
    assert.ok(src(`src/${f}`).split("\n").length <= 401, `${f} ≤ 400 rader`);
  }
});
