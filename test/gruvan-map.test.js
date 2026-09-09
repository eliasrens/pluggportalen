// ============================================================================
// Enhetstest för Gruvans grott-geometri (src/adventure/themes/gruvan-map.js,
// #224). Ren matte/data, ingen DOM. Körs med: node --test
// Verifierar att kollisionen blockerar berget runt/mellan gångarna men släpper
// fram grott-ytan, att start + slutmål + ALLA 18 kristall-kandidater ligger på
// gångbar mark OCH är nåbara från gruvöppningen (flood-fill), samt att
// urvalshjälparna beter sig rätt. Bakgrunds-SVG:n ritas ur samma geometri, så
// dessa tester skyddar även att BILDEN matchar det gångbara.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildCollision } from "../src/adventure/world.js";
import {
  WORLD,
  MAP_IMAGE,
  START_AT,
  GOAL_AT,
  SPAWN_CANDIDATES,
  CHAMBERS,
  buildGruvanCollision,
  insideCave,
  pickSpawns,
} from "../src/adventure/themes/gruvan-map.js";
import { gruvanTheme } from "../src/adventure/themes/gruvan.js";

// Blocked-predikat i VÄRLDSKOORDINATER, byggt precis som motorn gör det.
const blocked = buildCollision(buildGruvanCollision(), WORLD);
/** Är en normaliserad punkt (0..1) gångbar? */
function walkable(p) {
  return !blocked(p.x * WORLD.w, p.y * WORLD.h);
}

test("mapImage serveras som fil (ingen inline data-URI) och pekar på .svg", () => {
  assert.equal(MAP_IMAGE, gruvanTheme.mapImage);
  assert.ok(!MAP_IMAGE.startsWith("data:"), "får inte vara inline-a:d");
  assert.match(MAP_IMAGE, /gruvan-karta\.svg$/);
});

test("worldSize är brett vänster→höger-format (2.4:1) och matchar temat", () => {
  assert.deepEqual(WORLD, gruvanTheme.worldSize);
  assert.equal(WORLD.w / WORLD.h, 2.4);
});

test("startpunkten (gruvöppningen) ligger till vänster och är gångbar", () => {
  assert.ok(START_AT.x < 0.15, "start ska ligga längst till vänster");
  assert.ok(walkable(START_AT), "start måste vara gångbar");
});

test("slutmålet (jättekristallen) ligger till höger och är gångbart", () => {
  assert.ok(GOAL_AT.x > 0.85, "målet ska ligga längst till höger");
  assert.ok(walkable(GOAL_AT), "målet måste vara gångbart");
  assert.ok(GOAL_AT.x - START_AT.x > 0.7, "tydlig vänster→höger-riktning");
});

test("alla 18 kristall-kandidater ligger på gångbar mark", () => {
  assert.equal(SPAWN_CANDIDATES.length, 18);
  for (const p of SPAWN_CANDIDATES) {
    assert.ok(walkable(p), `kandidat (${p.x.toFixed(3)},${p.y.toFixed(3)}) ska vara gångbar`);
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

test("berget runt/mellan gångarna blockerar (hörn + utanför bilden)", () => {
  assert.ok(!walkable({ x: 0.02, y: 0.05 }), "uppe-vänster hörn = berg");
  assert.ok(!walkable({ x: 0.98, y: 0.05 }), "uppe-höger hörn = berg");
  assert.ok(!walkable({ x: 0.5, y: 0.98 }), "nedkant mitten = berg");
  assert.ok(!walkable({ x: 0.5, y: 0.02 }), "överkant mitten = berg");
  assert.ok(blocked(-5, 500), "utanför bilden = alltid blockerat");
  assert.ok(blocked(WORLD.w + 5, 500), "utanför bilden = alltid blockerat");
});

// --- Nåbarhet (flood-fill) --------------------------------------------------
// Att en punkt är gångbar räcker inte – den måste gå att NÅ från gruvöppningen
// genom gångarna. Annars kan en kristall (eller kistan) hamna i en avskuren ficka.
const FF_N = 300; // upplösning på samplingsrutnätet (fint nog för smala gångar)
function reachableSetFrom(startNorm) {
  const cellOf = (p) => ({ cx: Math.round(p.x * (FF_N - 1)), cy: Math.round(p.y * (FF_N - 1)) });
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
/** Är punkten nåbar? (liten snap-radie – avataren har storlek/glider.) */
function isReachable(reach, p) {
  const c = reach.cellOf(p);
  for (let r = 0; r <= 3; r++)
    for (let dx = -r; dx <= r; dx++)
      for (let dy = -r; dy <= r; dy++) {
        const nx = c.cx + dx, ny = c.cy + dy;
        if (nx < 0 || ny < 0 || nx >= FF_N || ny >= FF_N) continue;
        if (reach.seenSet.has(reach.key(nx, ny))) return true;
      }
  return false;
}

test("ALLA kristall-kandidater är NÅBARA från gruvöppningen (ej avskurna)", () => {
  const reach = reachableSetFrom(START_AT);
  for (const p of SPAWN_CANDIDATES) {
    assert.ok(isReachable(reach, p), `kandidat (${p.x.toFixed(3)},${p.y.toFixed(3)}) måste vara nåbar`);
  }
});

test("slutmålet är NÅBART från gruvöppningen (banan går alltid att klara)", () => {
  const reach = reachableSetFrom(START_AT);
  assert.ok(isReachable(reach, GOAL_AT), "jättekristallen måste kunna nås");
});

test("insideCave: kammar-mittpunkter är inne, en punkt långt utanför är berg", () => {
  for (const c of CHAMBERS) assert.ok(insideCave(c.x, c.y), "kammar-mitt inne i grottan");
  assert.ok(!insideCave(1200, 20), "högt upp i berget = utanför grottan");
});

test("pickSpawns väljer 10 unika kandidater (default)", () => {
  const spawns = pickSpawns();
  assert.equal(spawns.length, 10);
  const seen = new Set();
  for (const s of spawns) {
    assert.ok(SPAWN_CANDIDATES.includes(s), "vald spawn ur kandidatlistan");
    const key = `${s.x},${s.y}`;
    assert.ok(!seen.has(key), "ingen dubblett");
    seen.add(key);
  }
});

test("pickSpawns är slumpstyrd via injicerad rng och klampar n", () => {
  const a = pickSpawns(3, SPAWN_CANDIDATES, seq([0.99, 0.5, 0.1, 0.7, 0.2]));
  assert.equal(a.length, 3);
  assert.equal(pickSpawns(999, SPAWN_CANDIDATES, Math.random).length, SPAWN_CANDIDATES.length);
  assert.equal(pickSpawns(0).length, 0);
});

test("temat exponerar stationsAt (10) som getter och goal=10", () => {
  assert.equal(gruvanTheme.stationsAt.length, 10);
  assert.equal(gruvanTheme.goal, 10);
  // getter → färskt urval per läsning (ingen memoisering)
  assert.notEqual(gruvanTheme.stationsAt, gruvanTheme.stationsAt);
});

/** Liten deterministisk rng: matar givna värden i tur och ordning (wrap:ar). */
function seq(values) {
  let i = 0;
  return () => values[i++ % values.length];
}
