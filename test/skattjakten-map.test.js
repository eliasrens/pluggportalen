// ============================================================================
// Enhetstest för Skattjaktens ö-karta-geometri (src/adventure/themes/
// skattjakten-map.js, #221, #243). Ren matte/data, ingen DOM. Körs med: node --test
// Verifierar att kollisionen (nu ett EXAKT blockedAt-predikat byggt ur samma
// geometri som konsten ritas ur, #243) blockerar hav/damm/å/ruiner/klippor men
// släpper fram gräs/sand/bron, att start + ALLA fråge- och kist-kandidater ligger
// på gångbar mark OCH är nåbara från startbryggan (flood-fill), och att
// urvalshjälparna (pickSpawns/pickChest) beter sig rätt.
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
  COAST,
  POND,
  CLIFF_NW,
  CLIFF_MID,
  STREAM_UPPER,
  STREAM_LOWER,
  BRIDGE,
  BLOCKING_BUSHES,
  cliffStones,
  isBlockedWorld,
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
/** Mittpunkt av en world-px box {x,y,w,h}. */
function boxCenter(r) {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

test("temat ritar en egenritad inline-SVG-värld (mapSvg), inte JPG-bilden (#238)", () => {
  // Sedan #238: ön ritas egenhändigt i inline-SVG. mapImage-JPG:n används INTE
  // längre som värld; referenssökvägen behålls bara som dokumentation.
  assert.ok(!skattjaktenTheme.mapImage, "temat får inte längre ladda JPG:n som värld");
  assert.ok(typeof skattjaktenTheme.mapSvg === "string" && skattjaktenTheme.mapSvg.includes("<svg"),
    "temat ska rendera en inline-SVG-värld");
  assert.match(MAP_IMAGE, /skattjakten-karta\.jpg$/, "referensbilden ligger kvar som inspiration");
});

test("worldSize matchar bildens 3:2-aspekt (ingen tänjning)", () => {
  assert.equal(WORLD.w / WORLD.h, 1536 / 1024);
});

test("kollisionen är ett auktoritativt blockedAt-predikat (ingen grov grid/rects, #243)", () => {
  const c = buildSkattjaktenCollision();
  assert.equal(typeof c.blockedAt, "function", "blockedAt ska vara predikatet");
  assert.ok(!c.grid, "ingen grov grid längre");
  assert.ok(!c.rects, "inga grova rects längre");
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

test("kollision blockerar havet runt ön (hörn, kant utanför kustlinjen, utanför bild)", () => {
  assert.ok(!walkable({ x: 0.02, y: 0.02 }), "uppe-vänster hörn = hav/klippa");
  assert.ok(!walkable({ x: 0.98, y: 0.05 }), "uppe-höger hörn = hav");
  assert.ok(!walkable({ x: 0.02, y: 0.95 }), "nere-vänster hörn = hav");
  assert.ok(!walkable({ x: 0.98, y: 0.95 }), "nere-höger hörn = hav");
  // Precis ovanför öns topp (utanför kustlinjen) = hav.
  assert.ok(isBlockedWorld(700, 20), "ovanför kusten = hav");
  assert.ok(isBlockedWorld(700, 1010), "under kusten = hav");
  assert.ok(blocked(-5, 500), "utanför bilden = alltid blockerat");
});

test("inuti kustlinjen (gräs/sand) är gångbart – man kan gå ända ut till kanten", () => {
  // Öns mitt och en punkt nära (men innanför) kustlinjen ska vara fria.
  assert.ok(!isBlockedWorld(700, 500), "öns mitt gångbar");
  // En punkt strax innanför nordkusten (mellan topp-punkterna, ej på hinder).
  assert.ok(!isBlockedWorld(700, 150), "strax innanför nordkusten = sand/gräs");
});

test("kollision blockerar damm och stora klippor HELT (inga halva hinder, #243)", () => {
  // Damm: hela vatten-ellipsen blockeras.
  assert.ok(isBlockedWorld(POND.cx, POND.cy), "dammens mitt blockerad");
  assert.ok(isBlockedWorld(POND.cx + POND.rx * 0.8, POND.cy), "dammens kant blockerad");
  // Ruinerna togs bort (issue #286): forna footprinten (x921–1241, y60–232) är nu
  // öppet gräs och GÅNGBART – ingen osynlig vägg kvar (konst = kollision, #243).
  assert.ok(!isBlockedWorld(1081, 146), "forna ruin-området (mitt) nu gångbart");
  assert.ok(!isBlockedWorld(926, 65), "forna ruin-området (hörn) nu gångbart");
  // Klippor: båda klustren.
  assert.ok(isBlockedWorld(60, 60), "NV-klippan blockerad");
  const mc = boxCenter(CLIFF_MID);
  assert.ok(isBlockedWorld(mc.x, mc.y), "center-klippan blockerad");
});

test("dammen blockerar HELA poolen inkl. toppen (inget gångbart kantband, #243 r2)", () => {
  // Toppen av den ritade poolen (nära sand-ytterkanten) ska vara blockerad.
  assert.ok(isBlockedWorld(POND.cx, POND.cy - 88), "dammens topp blockerad");
  assert.ok(isBlockedWorld(POND.cx, POND.cy + 88), "dammens botten blockerad");
  assert.ok(isBlockedWorld(POND.cx - 108, POND.cy), "dammens vänsterkant blockerad");
  // Men gräset strax utanför sand-ytterkanten (rx118) är gångbart (ej överblockat).
  assert.ok(!isBlockedWorld(POND.cx + 130, POND.cy), "gräset utanför dammen gångbart");
});

test("klippkluster blockerar HELA de ritade stenarna (vänster/topp, #243 r2)", () => {
  // CLIFF_MID: de ritade stenarna sträcker sig utanför den gamla boxen (x453/y655).
  // Kontrollera att ett par punkter i vänster/topp-stenarna nu blockeras.
  const stones = cliffStones(CLIFF_MID);
  for (const [cx, cy] of stones) {
    assert.ok(isBlockedWorld(cx, cy), `stenens mitt (${cx},${cy}) blockerad`);
  }
  // Vänster utkant av vänstra stenen (fd. gångbart hål) ska nu blockera.
  assert.ok(isBlockedWorld(440, 750), "CLIFF_MID vänsterkant blockerad");
});

test("blockerande buskar är RIKTIGA hinder (hela kronan blockerar, #243 r2)", () => {
  assert.ok(BLOCKING_BUSHES.length >= 2 && BLOCKING_BUSHES.length <= 4, "ett fåtal hinder-buskar");
  for (const b of BLOCKING_BUSHES) {
    assert.ok(isBlockedWorld(b.x, b.y), `busk-mitten (${b.x},${b.y}) blockerad`);
    // hela kronan: prova några punkter runt centrum
    assert.ok(isBlockedWorld(b.x - 38, b.y - 4), "busk vänsterkant blockerad");
    assert.ok(isBlockedWorld(b.x + 38, b.y - 4), "busk högerkant blockerad");
    assert.ok(isBlockedWorld(b.x, b.y - 28), "busk topp blockerad");
    // men strax utanför kronan är gångbart (ej hela ön full av blockerare)
    assert.ok(!isBlockedWorld(b.x + 60, b.y), "gräset utanför busken gångbart");
  }
});

test("blockerande buskar spärrar INTE en spawn/kist-plats eller start", () => {
  const targets = [...SPAWN_CANDIDATES, ...CHEST_CANDIDATES, START_AT];
  for (const b of BLOCKING_BUSHES) {
    for (const t of targets) {
      const d = Math.hypot(b.x - t.x * WORLD.w, b.y - t.y * WORLD.h);
      assert.ok(d > 55, `busk (${b.x},${b.y}) för nära mål (${t.x},${t.y}) d=${d.toFixed(0)}`);
    }
  }
});

test("ån blockerar (utom bron): nära åns lopp = vatten, bron = gångbar lucka", () => {
  // Mittpunkter på åns polylinjer ska blockeras.
  assert.ok(isBlockedWorld(STREAM_UPPER[1][0], STREAM_UPPER[1][1]), "övre ån blockerad");
  assert.ok(isBlockedWorld(STREAM_LOWER[1][0], STREAM_LOWER[1][1]), "nedre ån blockerad");
  assert.ok(isBlockedWorld(STREAM_LOWER[2][0], STREAM_LOWER[2][1]), "nedre ån (kurva) blockerad");
  // Bron: mittpunkten (och strax runt) ska vara gångbar trots att den bryter ån.
  assert.ok(!isBlockedWorld(BRIDGE.cx, BRIDGE.cy), "bro-mitten gångbar");
});

test("bron är en gångbar lucka så man kan korsa ån (öster ↔ väster)", () => {
  assert.ok(!isBlockedWorld(BRIDGE.cx, BRIDGE.cy), "bro-partiet gångbart");
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

test("havet omsluter hela ön (start-regionen läcker inte ut i havet)", () => {
  // Flood-fill från start får inte nå bildhörnen (då vore havet gångbart).
  const reach = reachableSetFrom(START_AT);
  assert.ok(!isReachable(reach, { x: 0.01, y: 0.01 }), "hörnet ska inte vara nåbart (hav)");
  assert.ok(!isReachable(reach, { x: 0.99, y: 0.99 }), "hörnet ska inte vara nåbart (hav)");
});

test("kustlinjen är en sluten polygon med 20 punkter (delad geometri-källa)", () => {
  assert.equal(COAST.length, 20);
  for (const [x, y] of COAST) {
    assert.ok(Number.isFinite(x) && Number.isFinite(y), "kustpunkt ska vara tal");
  }
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
