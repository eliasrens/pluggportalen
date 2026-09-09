// ============================================================================
// Enhetstest för Skattjaktens ö-karta-geometri (src/adventure/themes/
// skattjakten-map.js, #221). Ren matte/data, ingen DOM. Körs med: node --test
// Verifierar att kollisionen blockerar hav/damm/å/ruiner/klippor men släpper fram
// gräs/sand/bron, att start + ALLA fråge- och kist-kandidater ligger på gångbar
// mark, och att urvalshjälparna (pickSpawns/pickChest) beter sig rätt.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildCollision } from "../src/adventure/world.js";
import {
  WORLD,
  MAP_IMAGE,
  START_AT,
  SPAWN_CANDIDATES,
  CHEST_CANDIDATES,
  POND,
  RUINS,
  CLIFF_NW,
  STREAM_N,
  STREAM_S,
  pickSpawns,
  pickChest,
  buildSkattjaktenCollision,
} from "../src/adventure/themes/skattjakten-map.js";
import { skattjaktenTheme } from "../src/adventure/themes/skattjakten.js";

// Blocked-predikat i VÄRLDSKOORDINATER, byggt precis som motorn gör det.
const blocked = buildCollision(buildSkattjaktenCollision(), WORLD);
/** Är en normaliserad punkt (0..1) gångbar? */
function walkable(p) {
  return !blocked(p.x * WORLD.w, p.y * WORLD.h);
}
/** Mittpunkten av en normaliserad rect. */
function center(r) {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

test("mapImage serveras som fil (ingen inline data-URI) och pekar på .jpg", () => {
  assert.equal(MAP_IMAGE, skattjaktenTheme.mapImage);
  assert.ok(!MAP_IMAGE.startsWith("data:"), "får inte vara inline-a:d");
  assert.match(MAP_IMAGE, /skattjakten-karta\.jpg$/);
});

test("worldSize matchar bildens 3:2-aspekt (ingen tänjning)", () => {
  assert.equal(WORLD.w / WORLD.h, 1536 / 1024);
});

test("startpunkten (vid bryggan) ligger på gångbar mark", () => {
  assert.ok(walkable(START_AT), "start måste vara gångbar");
});

test("alla 18 fråge-kandidater ligger på gångbar mark", () => {
  assert.equal(SPAWN_CANDIDATES.length, 18);
  for (const p of SPAWN_CANDIDATES) {
    assert.ok(walkable(p), `spawn (${p.x},${p.y}) ska vara gångbar`);
  }
});

test("kandidaterna ligger utspridda (inga två ovanpå varandra)", () => {
  for (let i = 0; i < SPAWN_CANDIDATES.length; i++) {
    for (let j = i + 1; j < SPAWN_CANDIDATES.length; j++) {
      const a = SPAWN_CANDIDATES[i], b = SPAWN_CANDIDATES[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      assert.ok(d > 0.05, `kandidat ${i} och ${j} för nära (${d.toFixed(3)})`);
    }
  }
});

test("2–4 kist-kandidater, alla på gångbar mark", () => {
  assert.ok(CHEST_CANDIDATES.length >= 2 && CHEST_CANDIDATES.length <= 4);
  for (const p of CHEST_CANDIDATES) {
    assert.ok(walkable(p), `kist-plats (${p.x},${p.y}) ska vara gångbar`);
  }
});

test("kollision blockerar havet runt ön (hörn + utanför bilden)", () => {
  assert.ok(!walkable({ x: 0.02, y: 0.02 }), "uppe-vänster hörn = hav/klippa");
  assert.ok(!walkable({ x: 0.98, y: 0.05 }), "uppe-höger hörn = hav");
  assert.ok(!walkable({ x: 0.02, y: 0.95 }), "nere-vänster hörn = hav");
  assert.ok(!walkable({ x: 0.98, y: 0.95 }), "nere-höger hörn = hav");
  assert.ok(blocked(-5, 500), "utanför bilden = alltid blockerat");
});

test("kollision blockerar damm, ruiner och stora klippor", () => {
  assert.ok(!walkable(center(POND)), "dammen blockerad");
  assert.ok(!walkable(center(RUINS)), "ruinerna blockerade");
  assert.ok(!walkable(center(CLIFF_NW)), "uppe-vänstra klippan blockerad");
  assert.ok(!walkable(center(STREAM_N)), "ån (övre) blockerad");
  assert.ok(!walkable(center(STREAM_S)), "ån (nedre) blockerad");
});

test("bron är en gångbar lucka i ån (kan korsa mellan segmenten)", () => {
  // Luckan i y mellan STREAM_N (slutar 0.42) och STREAM_S (börjar 0.48), x vid bron.
  assert.ok(walkable({ x: 0.63, y: 0.45 }), "bro-partiet ska vara gångbart");
});

// --- Nåbarhet (flood-fill) --------------------------------------------------
// Att en punkt är gångbar (fri från hav/damm/å/klippor) räcker INTE – den måste
// också gå att NÅ från startbryggan utan att korsa vatten. Annars kan en station
// eller skattkistan hamna på en isolerad landtunga → banan blir omöjlig att klara.
// Vi flood-fill:ar (4-grannar) ett samplat rutnät från START_AT och kräver att
// varje fråge- och kist-kandidat ligger i samma sammanhängande gångbara region.
const FF_N = 220; // upplösning på samplingsrutnätet (fint nog för bro-luckan)
function reachableSetFrom(startNorm) {
  const cellOf = (p) => ({
    cx: Math.round(p.x * (FF_N - 1)),
    cy: Math.round(p.y * (FF_N - 1)),
  });
  const walkCell = (cx, cy) => !blocked((cx / (FF_N - 1)) * WORLD.w, (cy / (FF_N - 1)) * WORLD.h);
  const key = (x, y) => y * FF_N + x;
  const seenSet = new Set();
  const s = cellOf(startNorm);
  const stack = [[s.cx, s.cy]];
  seenSet.add(key(s.cx, s.cy));
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= FF_N || ny >= FF_N) continue;
      if (seenSet.has(key(nx, ny))) continue;
      if (!walkCell(nx, ny)) continue;
      seenSet.add(key(nx, ny));
      stack.push([nx, ny]);
    }
  }
  return { seenSet, key, cellOf };
}
/** Är punkten nåbar? (tillåt liten snap-radie – avataren har storlek/glider.) */
function isReachable(reach, p) {
  const c = reach.cellOf(p);
  for (let r = 0; r <= 3; r++) {
    for (let dx = -r; dx <= r; dx++)
      for (let dy = -r; dy <= r; dy++) {
        const nx = c.cx + dx, ny = c.cy + dy;
        if (nx < 0 || ny < 0 || nx >= FF_N || ny >= FF_N) continue;
        if (reach.seenSet.has(reach.key(nx, ny))) return true;
      }
  }
  return false;
}

test("ALLA fråge-kandidater är NÅBARA från startbryggan (flood-fill, ej isolerade)", () => {
  const reach = reachableSetFrom(START_AT);
  for (const p of SPAWN_CANDIDATES) {
    assert.ok(isReachable(reach, p), `spawn (${p.x},${p.y}) måste vara nåbar från start`);
  }
});

test("ALLA kist-kandidater är NÅBARA från startbryggan (kistan går alltid att nå)", () => {
  const reach = reachableSetFrom(START_AT);
  for (const p of CHEST_CANDIDATES) {
    assert.ok(isReachable(reach, p), `kist-plats (${p.x},${p.y}) måste vara nåbar från start`);
  }
});

test("öster om ån går att nå via bron (inte avskuret av vattnet)", () => {
  const reach = reachableSetFrom(START_AT);
  // En punkt tydligt öster om ån (höger gräs) måste ligga i start-regionen.
  assert.ok(isReachable(reach, { x: 0.86, y: 0.4 }), "höger sida om ån ska nås via bron");
});

test("pickSpawns väljer 10 unika kandidater (default)", () => {
  const spawns = pickSpawns();
  assert.equal(spawns.length, 10);
  // alla ur kandidatlistan och unika
  const seen = new Set();
  for (const s of spawns) {
    assert.ok(SPAWN_CANDIDATES.includes(s), "vald spawn ur kandidatlistan");
    const key = `${s.x},${s.y}`;
    assert.ok(!seen.has(key), "ingen dubblett");
    seen.add(key);
  }
});

test("pickSpawns är slumpstyrd via injicerad rng (deterministisk i test)", () => {
  const rng = seq([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const a = pickSpawns(3, SPAWN_CANDIDATES, seq([0.99, 0.5, 0.1]));
  assert.equal(a.length, 3);
  // n klampas till kandidatantalet
  assert.equal(pickSpawns(999, SPAWN_CANDIDATES, rng).length, SPAWN_CANDIDATES.length);
  assert.equal(pickSpawns(0).length, 0);
});

test("pickChest väljer en kandidat (styrbar via rng)", () => {
  assert.equal(pickChest(CHEST_CANDIDATES, () => 0), CHEST_CANDIDATES[0]);
  assert.equal(pickChest(CHEST_CANDIDATES, () => 0.999), CHEST_CANDIDATES[CHEST_CANDIDATES.length - 1]);
  assert.equal(pickChest([]), null);
});

test("temat exponerar stationsAt (10) och goalAt som getters", () => {
  assert.equal(skattjaktenTheme.stationsAt.length, 10);
  const g = skattjaktenTheme.goalAt;
  assert.ok(CHEST_CANDIDATES.includes(g), "goalAt ur kist-kandidaterna");
  assert.equal(skattjaktenTheme.goal, 10);
});

/** Liten deterministisk rng: matar givna värden i tur och ordning (och wrap:ar). */
function seq(values) {
  let i = 0;
  return () => values[i++ % values.length];
}
