// ============================================================================
// Enhetstest för äventyrsmotorns bild-karta-värld (src/adventure/world.js, #220).
// Ren matte/datamodell, ingen DOM. Körs med: node --test
// Täcker koordinatkonvertering (normaliserat 0..1 → världspixlar), det grova
// kollisionslagret (rects + ASCII-grid + utanför-bilden) och att interaktions-
// räckvidden är isotrop i pixelvärlden (samma åt alla håll → #218 av sig självt).
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { createImageWorld, buildCollision } from "../src/adventure/world.js";

test("createImageWorld: normaliserade positioner blir världspixlar", () => {
  const w = createImageWorld({
    mapImage: "x.png",
    worldSize: { w: 2000, h: 1000 },
    startAt: { x: 0.1, y: 0.2 },
    stationsAt: [{ x: 0.5, y: 0.5 }, { x: 0.9, y: 0.8 }],
    goalAt: { x: 1, y: 1 },
  });
  assert.equal(w.scroll, true);
  assert.deepEqual(w.size, { w: 2000, h: 1000 });
  assert.deepEqual(w.start, { x: 200, y: 200 });
  assert.deepEqual(w.stations[0], { x: 1000, y: 500 });
  assert.deepEqual(w.stations[1], { x: 1800, y: 800 });
  assert.deepEqual(w.goal, { x: 2000, y: 1000 });
  assert.equal(w.maxX, 2000);
  assert.equal(w.maxY, 1000);
});

test("createImageWorld: goalAt faller tillbaka på startAt, defaults i mitten", () => {
  const w = createImageWorld({ mapImage: "x.png", worldSize: { w: 400, h: 400 }, startAt: { x: 0.25, y: 0.25 } });
  assert.deepEqual(w.goal, { x: 100, y: 100 }); // = startAt
  const d = createImageWorld({ mapImage: "x.png", worldSize: { w: 400, h: 200 } });
  assert.deepEqual(d.start, { x: 200, y: 100 }); // mitten
});

test("buildCollision: utanför bilden blockerar alltid", () => {
  const size = { w: 100, h: 100 };
  const b = buildCollision({}, size);
  assert.ok(b(-1, 50));
  assert.ok(b(50, 101));
  assert.ok(!b(50, 50));
});

test("buildCollision: normaliserade rektanglar blockerar sitt område", () => {
  const size = { w: 100, h: 100 };
  const b = buildCollision({ rects: [{ x: 0.2, y: 0.2, w: 0.2, h: 0.2 }] }, size);
  assert.ok(b(30, 30), "inuti rektangeln (20..40)");
  assert.ok(!b(50, 50), "utanför rektangeln");
  assert.ok(!b(10, 10), "före rektangeln");
});

test("buildCollision: lågupplöst ASCII-grid sträcks över hela världen", () => {
  const size = { w: 400, h: 200 };
  // 4 kolumner × 2 rader; '#' blockerar. Kolumn 0 rad 0 = blockerad.
  const b = buildCollision({ grid: ["#...", "...#"] }, size);
  assert.ok(b(10, 10), "cell (0,0) = # → blockerad");
  assert.ok(!b(150, 10), "cell (1,0) = . → fri");
  assert.ok(b(350, 150), "cell (3,1) = # → blockerad");
  assert.ok(!b(10, 150), "cell (0,1) = . → fri");
});

test("createImageWorld: reach är isotropt i pixlar (samma åt alla håll → #218)", () => {
  const w = createImageWorld({ mapImage: "x.png", worldSize: { w: 1000, h: 1000 }, interactFrac: 0.05 });
  const c = { x: 500, y: 500 };
  const right = w.reach(c, { x: 560, y: 500 });
  const down = w.reach(c, { x: 500, y: 560 });
  assert.ok(Math.abs(right - down) < 1e-9, "lika lång räckvidd horisontellt som vertikalt");
  assert.equal(w.interactRadius, 50); // 0.05 * min(1000,1000)
});
