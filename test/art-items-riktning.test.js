// ============================================================================
// Enhetstest för vända och rotera möbler (issue #699): rot/flip-hjälparna i
// src/art-items.js. Bakåtkompatibelt (saknade fält = framifrån och ovänd),
// saker med text kan inte vändas, fyrriktningsmöbler stegar 0→1→2→3→0 och
// håller samma höjd (golvpunkten står still). Browser-fritt:  node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  itemSvg, itemSize, itemVy, itemRiktning, kanRoteras, kanVandas,
  riktningsFalt, vridPlacering, loadCollectionArt,
} from "../src/art-items.js";
import { SHOP_ITEMS } from "../src/shop-items.js";

await loadCollectionArt();

const FYRA = ["sang", "bokhylla", "dator", "tv", "byra", "skrivbord", "fatolj",
  "enkelsang", "soffa", "gungstol", "garderob", "kylskap", "nattduksbord"];
const TEXT = ["vaggklocka", "poster-varld", "parkering", "hw-buu-skylt"];

test("de 13 utvalda möblerna har fyra riktningar, inga andra", () => {
  const rot = SHOP_ITEMS.map((i) => i.id).filter(kanRoteras).sort();
  assert.deepEqual(rot, [...FYRA].sort());
});

test("saker med text kan inte vändas; allt annat kan", () => {
  for (const id of TEXT) assert.equal(kanVandas(id), false, id);
  for (const id of [...FYRA, "trad", "bil", "tavla", "matta", "hw-pumpalykta"]) {
    assert.equal(kanVandas(id), true, id);
  }
});

test("gammal placering utan rot/flip ritas exakt som förr", () => {
  for (const { id } of SHOP_ITEMS) {
    if (!itemSvg(id)) continue;
    assert.deepEqual(itemRiktning(id, { x: 10, y: 20 }), { rot: 0, spegel: false }, id);
    assert.deepEqual(itemSize(id, 0), itemSize(id), id);
    assert.equal(itemSvg(id, { rot: 0 }), itemSvg(id), id);
  }
  assert.deepEqual(riktningsFalt({ x: 1, y: 2 }), {});
});

test("soffan roterar genom alla fyra riktningar med samma höjd", () => {
  const pos = { x: 30, y: 72 };
  const h = itemSize("soffa").h;
  const sett = [];
  for (let i = 0; i < 4; i++) {
    assert.equal(vridPlacering("soffa", pos, "rot"), true);
    const { rot } = itemRiktning("soffa", pos);
    sett.push(rot);
    assert.equal(itemSize("soffa", rot).h, h, `rot ${rot}`);
  }
  assert.deepEqual(sett, [1, 2, 3, 0]);
  assert.equal("rot" in pos, false, "rot 0 skrivs aldrig");
  assert.deepEqual(pos, { x: 30, y: 72 });
});

test("andra sidan (rot 3) = sidan spegelvänd när sida2 saknas; flip XOR:as", () => {
  assert.equal(itemVy("soffa", 3).spegel, true);
  assert.deepEqual(itemRiktning("soffa", { rot: 3 }), { rot: 3, spegel: true });
  assert.deepEqual(itemRiktning("soffa", { rot: 3, flip: true }), { rot: 3, spegel: false });
  assert.deepEqual(itemRiktning("soffa", { rot: 1, flip: true }), { rot: 1, spegel: true });
});

test("vänd växlar flip och städar bort false; text-saker vägrar", () => {
  const pos = { x: 1, y: 1 };
  assert.equal(vridPlacering("trad", pos, "flip"), true);
  assert.equal(pos.flip, true);
  assert.equal(vridPlacering("trad", pos, "flip"), true);
  assert.equal("flip" in pos, false);
  const klocka = { x: 1, y: 1 };
  assert.equal(vridPlacering("vaggklocka", klocka, "flip"), false);
  assert.deepEqual(klocka, { x: 1, y: 1 });
  // En sparad flip på en text-sak ignoreras vid ritning.
  assert.equal(itemRiktning("vaggklocka", { flip: true }).spegel, false);
});

test("rot ignoreras för saker utan vyer och för ogiltiga värden", () => {
  assert.equal(vridPlacering("trad", { x: 1, y: 1 }, "rot"), false);
  assert.equal(itemRiktning("trad", { rot: 2 }).rot, 0);
  for (const bad of [4, -1, 1.5, "2", null, "x"]) {
    const r = itemRiktning("soffa", { rot: bad }).rot;
    assert.equal(r, bad === "2" ? 2 : 0, String(bad));
  }
  assert.deepEqual(riktningsFalt({ x: 1, y: 1, rot: 7, flip: "ja" }), {});
  assert.deepEqual(riktningsFalt({ rot: 2, flip: true, scen: "gard" }), { rot: 2, flip: true });
});
