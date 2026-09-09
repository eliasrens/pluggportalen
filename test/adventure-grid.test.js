// ============================================================================
// Enhetstest för äventyrsmotorns grid-matte (src/adventure/grid.js).
// Ren koordinat-/kollisionsmatte, ingen DOM. Körs med: node --test
// Kanonisk svit för #194 (konsoliderar bort dubbletten #201): täcker parseMap
// (dimensioner/start/mål/stationer), blockerade rutor, utfyllda rader och
// koordinatmattens invers (cellCenter ↔ percentToCell).
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseMap,
  cellCenter,
  tileSizePct,
  percentToCell,
  makeBlockedAt,
} from "../src/adventure/grid.js";

const MAP = [
  "#####",
  "#S.?#",
  "#..M#",
  "#####",
];

test("parseMap hittar dimensioner, start, stationer och mål", () => {
  const g = parseMap(MAP);
  assert.equal(g.cols, 5);
  assert.equal(g.rows, 4);
  assert.deepEqual(g.start, { col: 1, row: 1 });
  assert.deepEqual(g.goal, { col: 3, row: 2 });
  assert.equal(g.stations.length, 1);
  assert.deepEqual(g.stations[0], { col: 3, row: 1 });
});

test("väggar (#) och tomrum blockerar, golv/start/station/mål gör inte", () => {
  const g = parseMap(MAP);
  assert.ok(g.blocked.has("0,0")); // vägg
  assert.ok(!g.blocked.has("1,1")); // start
  assert.ok(!g.blocked.has("3,1")); // station
  assert.ok(!g.blocked.has("3,2")); // mål
});

test("kortare rader stoppas ut med tomrum (blockerar)", () => {
  const g = parseMap(["...", "."]); // rad 2 är kort
  assert.equal(g.cols, 3);
  assert.ok(g.blocked.has("1,1")); // utfyllt tomrum
  assert.ok(g.blocked.has("2,1"));
  assert.ok(!g.blocked.has("0,1")); // faktiskt golv
});

test("cellCenter ger mittpunkten i procent och fyller scenen", () => {
  // 5 kolumner → varje ruta 20 % bred, center på 10 %, 30 %, …
  assert.deepEqual(cellCenter(0, 0, 5, 4), { x: 10, y: 12.5 });
  assert.deepEqual(cellCenter(4, 3, 5, 4), { x: 90, y: 87.5 });
});

test("tileSizePct = 100/cols × 100/rows", () => {
  assert.deepEqual(tileSizePct(5, 4), { w: 20, h: 25 });
});

test("percentToCell är invers till cellCenter och clampar utanför", () => {
  const c = cellCenter(2, 1, 5, 4);
  assert.deepEqual(percentToCell(c.x, c.y, 5, 4), { col: 2, row: 1 });
  assert.deepEqual(percentToCell(-5, -5, 5, 4), { col: 0, row: 0 });
  assert.deepEqual(percentToCell(999, 999, 5, 4), { col: 4, row: 3 });
});

test("makeBlockedAt: väggrutor och utanför-scenen blockerar, golv släpper igenom", () => {
  const g = parseMap(MAP);
  const blockedAt = makeBlockedAt(g);
  const wall = cellCenter(0, 0, g.cols, g.rows);
  const floor = cellCenter(2, 2, g.cols, g.rows);
  assert.ok(blockedAt(wall.x, wall.y));
  assert.ok(!blockedAt(floor.x, floor.y));
  assert.ok(blockedAt(-1, 50)); // utanför scenen
  assert.ok(blockedAt(50, 101));
});
