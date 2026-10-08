// ============================================================================
// Inrednings-kärnan (#490): Mitt rum och Klasscentrets rum delar drag-
// klamringen, ritordningen, startplatsen och nycklarna (rum-promenad-golv.js).
// Mitt rum ska bete sig EXAKT som före utbrytningen → kärnan jämförs mot en
// ordagrann kopia av den gamla koden i varld-rum.js. Körs med: node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { FLOOR_TOP } from "../src/art-room.js";
import {
  dragPos, ordnaNycklar, nastaPlats, nyPlaceringsNyckel, rumSakHtml,
} from "../src/rum-promenad-golv.js";
import { sakIdFranNyckel, kvarILadan } from "../src/rum-inredning.js";

// --- Den gamla koden (varld-rum.js före #490), ordagrant --------------------
const clamp = (n, min, max) => {
  n = Number(n);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
};
function gammalDrag(px, py, drag) {
  const x = clamp(px, drag.halfW, 100 - drag.halfW);
  let minY = drag.halfH;
  let maxY = 100 - drag.halfH;
  if (drag.win) {
    maxY = FLOOR_TOP;
  } else if (drag.floor) {
    minY = Math.max(drag.halfH, FLOOR_TOP + 4 - drag.halfH);
  }
  return { x, y: clamp(py, minY, maxY) };
}
const SPREAD_X = [50, 30, 70, 20, 80, 40, 60, 15, 85];
function gammalNextSpot(placements, floor, isFloorKey) {
  const n = Object.keys(placements).filter((pid) => isFloorKey(pid) === floor).length;
  const x = SPREAD_X[n % SPREAD_X.length];
  const row = Math.floor(n / SPREAD_X.length);
  const y = floor ? 78 - (row % 2) * 8 : 32 + (row % 2) * 12;
  return { x, y };
}

// Deterministisk pseudo-slump (samma körning varje gång).
let fro = 7;
const slump = () => ((fro = (fro * 16807) % 2147483647) / 2147483647);

test("dragPos = gamla drag-klamringen för golv, vägg och fönster", () => {
  for (let i = 0; i < 3000; i++) {
    const px = slump() * 160 - 30;
    const py = slump() * 160 - 30;
    const halfW = slump() * 30;
    const halfH = slump() * 30;
    for (const [zon, drag] of [
      ["golv", { floor: true, win: false }],
      ["vagg", { floor: false, win: false }],
      ["fonster", { floor: false, win: true }],
    ]) {
      assert.deepEqual(
        dragPos({ px, py, halfW, halfH, zon }),
        gammalDrag(px, py, { ...drag, halfW, halfH }),
        `${zon} px=${px} py=${py} halfW=${halfW} halfH=${halfH}`
      );
    }
  }
  // NaN-position → min (som ui.js clamp).
  assert.deepEqual(dragPos({ px: NaN, py: NaN, halfW: 5, halfH: 5, zon: "vagg" }), { x: 5, y: 5 });
});

test("golvsaker hålls i golvzonen, fönstret ovanför golvlinjen", () => {
  assert.ok(dragPos({ px: 50, py: 0, halfW: 5, halfH: 5, zon: "golv" }).y >= FLOOR_TOP + 4 - 5);
  assert.equal(dragPos({ px: 50, py: 99, halfW: 5, halfH: 5, zon: "fonster" }).y, FLOOR_TOP);
  assert.equal(dragPos({ px: 50, py: 99, halfW: 5, halfH: 5, zon: "golv", golvTopp: 50 }).y, 95);
});

test("ordnaNycklar: platta saker först, annars nyckelordning (stabil)", () => {
  const pl = { soffa: {}, matta: {}, lampa: {}, "matta#2": {}, bord: {} };
  const platt = (k) => (k.startsWith("matta") ? 0 : 1);
  const gammal = Object.keys(pl).sort((a, b) => platt(a) - platt(b));
  assert.deepEqual(ordnaNycklar(pl, platt), gammal);
  assert.deepEqual(ordnaNycklar(pl, platt), ["matta", "matta#2", "soffa", "lampa", "bord"]);
  // Klasscentret: z som rang.
  const z = { a: { z: 3 }, b: { z: 1 }, c: { z: 2 } };
  assert.deepEqual(ordnaNycklar(z, (k) => z[k].z), ["b", "c", "a"]);
});

test("nastaPlats = gamla nextSpot (spridning per zon, rader växlar)", () => {
  const pl = {};
  const arGolv = (k) => !k.startsWith("tavla");
  for (let i = 0; i < 25; i++) {
    const golv = i % 3 !== 0;
    assert.deepEqual(nastaPlats(pl, golv, arGolv), gammalNextSpot(pl, golv, arGolv));
    pl[golv ? `soffa${i}` : `tavla${i}`] = nastaPlats(pl, golv, arGolv);
  }
  assert.deepEqual(nastaPlats({}, true, () => true), { x: 50, y: 78 });
  assert.deepEqual(nastaPlats({}, false, () => true), { x: 50, y: 32 });
});

test("nyPlaceringsNyckel: rent id först, sedan #2, #3 …", () => {
  assert.equal(nyPlaceringsNyckel({}, "soffa"), "soffa");
  assert.equal(nyPlaceringsNyckel({ soffa: {} }, "soffa"), "soffa#2");
  assert.equal(nyPlaceringsNyckel({ soffa: {}, "soffa#2": {} }, "soffa"), "soffa#3");
  assert.equal(nyPlaceringsNyckel({ soffa: {}, "soffa#3": {} }, "soffa"), "soffa#2");
});

test("rumSakHtml: position, vald-ram, cqw-storlek och 🗑️ bara när taBort", () => {
  const h = rumSakHtml({ key: "soffa#2", x: 12.5, y: 70, titel: "Soffa", art: "<svg/>", w: 4, h: 3, vald: true });
  assert.match(h, /class="room-item selected"/);
  assert.match(h, /data-id="soffa#2"/);
  assert.match(h, /left:12\.5%;top:70%/);
  assert.match(h, /width:calc\(4 \* min\(var\(--rum-koeff, 2\.5\) \* 1cqw, var\(--rum-cap, 25px\)\)\)/);
  assert.match(h, /data-remove="soffa#2"/);
  const las = rumSakHtml({ key: "a", x: 1, y: 2, titel: "A", art: "", w: 1, h: 1, taBort: false });
  assert.doesNotMatch(las, /ri-remove/);
  assert.doesNotMatch(las, /selected/);
});

test("adapter-hjälpare: sak-id ur nyckel och kvar i lådan", () => {
  assert.equal(sakIdFranNyckel("lounge#2"), "lounge");
  assert.equal(sakIdFranNyckel("fontan"), "fontan");
  const adapter = { lada: (id) => ({ lounge: 2, fontan: 1 }[id] || 0) };
  assert.equal(kvarILadan(adapter, { lounge: {} }, "lounge"), 1);
  assert.equal(kvarILadan(adapter, { lounge: {}, "lounge#2": {} }, "lounge"), 0);
  assert.equal(kvarILadan(adapter, {}, "flygel"), 0);
});
