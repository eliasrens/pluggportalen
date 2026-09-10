// ============================================================================
// Enhetstest för Spökjaktens natt-värld-geometri (src/adventure/themes/
// spokjakten-map.js, #251). Ren matte/data, ingen DOM. Körs med: node --test
// Speglar test/skattjakten-map.test.js: verifierar att kollisionen (ett EXAKT
// isBlockedWorld-predikat byggt ur samma geometri som konsten ritas ur) blockerar
// natt/hus/damm/gravstenar/staket/lyktor men släpper fram gräs/stigar, att start +
// ALLA spök- och slutspöke-kandidater ligger på gångbar mark OCH är nåbara från
// grinden (flood-fill), och att urvalshjälparna (pickSpawns/pickGoal) beter sig rätt.
//
// Rör INTE spokjakten.js/index.js ännu (nästa sub-issue) → temat importeras inte här.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildCollision } from "../src/adventure/world.js";
import {
  WORLD,
  START_AT,
  SPAWN_CANDIDATES,
  GOAL_CANDIDATES,
  OUTER,
  HOUSE,
  POND,
  GRAVESTONES,
  FENCE_SEGMENTS,
  LANTERNS,
  LANTERN_BLOCK_R,
  isBlockedWorld,
  smoothClosedPath,
  smoothOpenPath,
  pickSpawns,
  pickGoal,
  buildSpokjaktenCollision,
} from "../src/adventure/themes/spokjakten-map.js";

// Blocked-predikat i VÄRLDSKOORDINATER, byggt precis som motorn gör det.
const blocked = buildCollision(buildSpokjaktenCollision(), WORLD);
/** Är en normaliserad punkt (0..1) gångbar? */
function walkable(p) {
  return !blocked(p.x * WORLD.w, p.y * WORLD.h);
}
/** Mittpunkt av en world-px box {x,y,w,h}. */
function boxCenter(r) {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

test("worldSize matchar scen-SVG:ns 3:2-aspekt (ingen tänjning)", () => {
  assert.equal(WORLD.w / WORLD.h, 1536 / 1024);
});

test("kollisionen är ett auktoritativt blockedAt-predikat (ingen grov grid/rects)", () => {
  const c = buildSpokjaktenCollision();
  assert.equal(typeof c.blockedAt, "function", "blockedAt ska vara predikatet");
  assert.ok(!c.grid, "ingen grov grid");
  assert.ok(!c.rects, "inga grova rects");
});

test("startpunkten (vid grinden) ligger på gångbar mark", () => {
  assert.ok(walkable(START_AT), "start måste vara gångbar");
});

test("alla 18 spök-kandidater ligger på gångbar mark", () => {
  assert.equal(SPAWN_CANDIDATES.length, 18);
  for (const p of SPAWN_CANDIDATES) {
    assert.ok(walkable(p), `spawn (${p.x},${p.y}) ska vara gångbar`);
  }
});

test("kandidaterna ligger utspridda (inga två ovanpå varandra, ej på rad)", () => {
  for (let i = 0; i < SPAWN_CANDIDATES.length; i++) {
    for (let j = i + 1; j < SPAWN_CANDIDATES.length; j++) {
      const a = SPAWN_CANDIDATES[i], b = SPAWN_CANDIDATES[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      assert.ok(d > 0.05, `kandidat ${i} och ${j} för nära (${d.toFixed(3)})`);
    }
  }
});

test("2–4 slutspöke-kandidater, alla på gångbar mark", () => {
  assert.ok(GOAL_CANDIDATES.length >= 2 && GOAL_CANDIDATES.length <= 4);
  for (const p of GOAL_CANDIDATES) {
    assert.ok(walkable(p), `slutspöke-plats (${p.x},${p.y}) ska vara gångbar`);
  }
});

test("kollision blockerar natten/trädridån runt gläntan (hörn, ovan/under kanten, utanför bild)", () => {
  assert.ok(!walkable({ x: 0.02, y: 0.02 }), "uppe-vänster hörn = natt");
  assert.ok(!walkable({ x: 0.98, y: 0.03 }), "uppe-höger hörn = natt");
  assert.ok(!walkable({ x: 0.02, y: 0.97 }), "nere-vänster hörn = natt");
  assert.ok(!walkable({ x: 0.98, y: 0.97 }), "nere-höger hörn = natt");
  // Precis ovanför/under gläntans kant (utanför spelytan) = natt.
  assert.ok(isBlockedWorld(768, 20), "ovanför gläntan = natt");
  assert.ok(isBlockedWorld(768, 1010), "under gläntan = natt");
  assert.ok(blocked(-5, 500), "utanför bilden = alltid blockerat");
});

test("innanför gläntans kant (gräs/stig) är gångbart – ända ut till kanten", () => {
  assert.ok(!isBlockedWorld(768, 512), "gläntans mitt gångbar");
  // En punkt strax innanför nordkanten (mellan hindren) ska vara fri.
  assert.ok(!isBlockedWorld(430, 150), "strax innanför nordkanten = gräs");
});

test("kollision blockerar hus, damm och gravstenar HELT", () => {
  // Hus: hela footprinten.
  const hc = boxCenter(HOUSE);
  assert.ok(isBlockedWorld(hc.x, hc.y), "husets mitt blockerad");
  assert.ok(isBlockedWorld(HOUSE.x + 5, HOUSE.y + 5), "husets hörn blockerat");
  // Damm: hela vatten-ellipsen inkl. kanten.
  assert.ok(isBlockedWorld(POND.cx, POND.cy), "dammens mitt blockerad");
  assert.ok(isBlockedWorld(POND.cx + POND.rx * 0.8, POND.cy), "dammens kant blockerad");
  assert.ok(isBlockedWorld(POND.cx, POND.cy - 84), "dammens topp blockerad");
  // Men gräset strax utanför strand-ytterkanten är gångbart (ej överblockat).
  assert.ok(!isBlockedWorld(POND.cx + 140, POND.cy), "gräset utanför dammen gångbart");
});

test("varje gravsten blockerar sin ritade häll (och gräset intill är gångbart)", () => {
  assert.ok(GRAVESTONES.length >= 3, "flera gravstenar utspridda");
  for (const g of GRAVESTONES) {
    assert.ok(isBlockedWorld(g.x, g.y), `gravstenens fot (${g.x},${g.y}) blockerad`);
    assert.ok(isBlockedWorld(g.x, g.y - 18), "gravstenens krona blockerad");
    assert.ok(!isBlockedWorld(g.x + 60, g.y), "gräset intill gravstenen gångbart");
  }
});

test("staketen blockerar nära sin linje men lämnar breda luckor", () => {
  for (const seg of FENCE_SEGMENTS) {
    const mid = { x: (seg[0][0] + seg[1][0]) / 2, y: (seg[0][1] + seg[1][1]) / 2 };
    assert.ok(isBlockedWorld(mid.x, mid.y), "staketets mitt blockerad");
    // Långt vid sidan av staketet ska vara gångbart (luckor att gå runt).
    assert.ok(!isBlockedWorld(mid.x, mid.y - 80) || !isBlockedWorld(mid.x + 80, mid.y),
      "det finns gångbart utrymme förbi staketet");
  }
});

test("lyktstolparna blockerar (smal stolpe) men skenet omkring är gångbart", () => {
  for (const l of LANTERNS) {
    assert.ok(isBlockedWorld(l.x, l.y), `lyktstolpen (${l.x},${l.y}) blockerad`);
    // Strax utanför stolpradien = gångbart ljus (blockerar inte hela stigen).
    assert.ok(!isBlockedWorld(l.x + LANTERN_BLOCK_R + 26, l.y), "skenet utanför stolpen gångbart");
  }
});

test("hinder spärrar INTE en spawn/slutspöke-plats eller start", () => {
  const targets = [...SPAWN_CANDIDATES, ...GOAL_CANDIDATES, START_AT];
  const point = (t) => ({ x: t.x * WORLD.w, y: t.y * WORLD.h });
  for (const g of GRAVESTONES) {
    for (const t of targets) {
      const p = point(t);
      assert.ok(Math.hypot(g.x - p.x, g.y - p.y) > 42,
        `gravsten (${g.x},${g.y}) för nära mål (${t.x},${t.y})`);
    }
  }
});

// --- Nåbarhet (flood-fill) --------------------------------------------------
// Att en punkt är gångbar räcker INTE – den måste gå att NÅ från grinden utan att
// korsa natt/hus/damm. Annars kan en station eller slutspöket hamna på en isolerad
// landtunga → banan blir omöjlig. Vi flood-fill:ar (4-grannar) ett samplat rutnät
// från START_AT och kräver att varje spök- och slutspöke-kandidat ligger i samma
// sammanhängande gångbara region.
const FF_N = 220; // upplösning på samplingsrutnätet (fint nog för staket-luckorna)
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

test("ALLA spök-kandidater är NÅBARA från grinden (flood-fill, ej isolerade)", () => {
  const reach = reachableSetFrom(START_AT);
  for (const p of SPAWN_CANDIDATES) {
    assert.ok(isReachable(reach, p), `spawn (${p.x},${p.y}) måste vara nåbar från start`);
  }
});

test("ALLA slutspöke-kandidater är NÅBARA från grinden", () => {
  const reach = reachableSetFrom(START_AT);
  for (const p of GOAL_CANDIDATES) {
    assert.ok(isReachable(reach, p), `slutspöke-plats (${p.x},${p.y}) måste vara nåbar`);
  }
});

test("natten omsluter hela gläntan (start-regionen läcker inte ut i natten)", () => {
  const reach = reachableSetFrom(START_AT);
  assert.ok(!isReachable(reach, { x: 0.01, y: 0.01 }), "hörnet ska inte vara nåbart (natt)");
  assert.ok(!isReachable(reach, { x: 0.99, y: 0.99 }), "hörnet ska inte vara nåbart (natt)");
});

test("gläntans kant är en sluten polygon (delad geometri-källa)", () => {
  assert.ok(OUTER.length >= 12, "tillräckligt många kontrollpunkter för en organisk kant");
  for (const [x, y] of OUTER) {
    assert.ok(Number.isFinite(x) && Number.isFinite(y), "kantpunkt ska vara tal");
  }
});

test("kurv-hjälparna exporteras och ritar path-data ur samma geometri (för konsten)", () => {
  const closed = smoothClosedPath(OUTER);
  assert.match(closed, /^M /, "sluten path börjar med M");
  assert.match(closed, /Z$/, "sluten path avslutas med Z");
  assert.ok(closed.includes("C"), "sluten path använder bezier-kurvor");
  const open = smoothOpenPath([[0, 0], [100, 50], [200, 0]]);
  assert.match(open, /^M /, "öppen path börjar med M");
  assert.ok(!open.trim().endsWith("Z"), "öppen path är inte sluten");
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

test("pickSpawns är slumpstyrd via injicerad rng (deterministisk i test)", () => {
  const rng = seq([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const a = pickSpawns(3, SPAWN_CANDIDATES, seq([0.99, 0.5, 0.1]));
  assert.equal(a.length, 3);
  // n klampas till kandidatantalet
  assert.equal(pickSpawns(999, SPAWN_CANDIDATES, rng).length, SPAWN_CANDIDATES.length);
  assert.equal(pickSpawns(0).length, 0);
});

test("pickSpawns är deterministisk för samma injicerade rng", () => {
  const mk = () => seq([0.1, 0.9, 0.3, 0.7, 0.5, 0.2, 0.8, 0.4, 0.6, 0.05, 0.95, 0.15, 0.35, 0.55, 0.75, 0.25, 0.85]);
  const a = pickSpawns(10, SPAWN_CANDIDATES, mk());
  const b = pickSpawns(10, SPAWN_CANDIDATES, mk());
  assert.deepEqual(a, b, "samma rng → samma urval");
});

test("pickGoal väljer en kandidat (styrbar via rng)", () => {
  assert.equal(pickGoal(GOAL_CANDIDATES, () => 0), GOAL_CANDIDATES[0]);
  assert.equal(pickGoal(GOAL_CANDIDATES, () => 0.999), GOAL_CANDIDATES[GOAL_CANDIDATES.length - 1]);
  assert.equal(pickGoal([]), null);
});

/** Liten deterministisk rng: matar givna värden i tur och ordning (och wrap:ar). */
function seq(values) {
  let i = 0;
  return () => values[i++ % values.length];
}
