// ============================================================================
// Enhetstest för äventyrsmotorns rörelse-/kollisionsmatte (src/adventure/movement.js).
// Ren matte, ingen DOM. Körs med: node --test
// Kanonisk svit för #194 (konsoliderar bort dubbletten #201): täcker väggkollision,
// axel-separerad väggglidning, normerad diagonal och stillastående input.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  clamp,
  normalizeDir,
  moveStep,
  dist,
  nearestWithin,
} from "../src/adventure/movement.js";

const free = () => false; // inget blockerar

test("normalizeDir ger enhetsvektor och noll för stillastående", () => {
  const n = normalizeDir({ x: 3, y: 4 });
  assert.ok(Math.abs(Math.hypot(n.x, n.y) - 1) < 1e-9);
  assert.deepEqual(normalizeDir({ x: 0, y: 0 }), { x: 0, y: 0 });
});

test("diagonal rörelse blir inte snabbare än rak (normaliserad)", () => {
  const p = { x: 50, y: 50 };
  const straight = moveStep(p, { x: 1, y: 0 }, { speed: 10, dt: 1, blockedAt: free });
  const diag = moveStep(p, { x: 1, y: 1 }, { speed: 10, dt: 1, blockedAt: free });
  const dStraight = dist(p, straight);
  const dDiag = dist(p, diag);
  assert.ok(Math.abs(dStraight - dDiag) < 1e-9, "samma sträcka oavsett riktning");
});

test("stillastående input rör inte figuren och vänder inte", () => {
  const r = moveStep({ x: 20, y: 20 }, { x: 0, y: 0 }, { speed: 50, dt: 1, blockedAt: free });
  assert.deepEqual({ x: r.x, y: r.y, moving: r.moving }, { x: 20, y: 20, moving: false });
  assert.equal(r.facingLeft, null);
});

test("facingLeft följer horisontell riktning", () => {
  const left = moveStep({ x: 50, y: 50 }, { x: -1, y: 0 }, { speed: 10, dt: 0.1, blockedAt: free });
  const right = moveStep({ x: 50, y: 50 }, { x: 1, y: 0 }, { speed: 10, dt: 0.1, blockedAt: free });
  const up = moveStep({ x: 50, y: 50 }, { x: 0, y: -1 }, { speed: 10, dt: 0.1, blockedAt: free });
  assert.equal(left.facingLeft, true);
  assert.equal(right.facingLeft, false);
  assert.equal(up.facingLeft, null, "vertikal rörelse behåller förra vändningen");
});

test("kliver inte in i en blockerad ruta (rakt in i vägg)", () => {
  // Allt med x>60 blockerar (en vägg till höger).
  const blockedAt = (x) => x > 60;
  const r = moveStep({ x: 58, y: 50 }, { x: 1, y: 0 }, { speed: 100, dt: 1, blockedAt });
  assert.equal(r.x, 58, "x-steget stoppas av väggen");
  assert.equal(r.moving, false);
});

test("glider längs en vägg: blockerad X men fri Y ger fortsatt rörelse i Y", () => {
  // Vägg till höger (x>60). Går man snett upp-höger ska Y släppas igenom.
  const blockedAt = (x) => x > 60;
  const r = moveStep({ x: 58, y: 50 }, { x: 1, y: -1 }, { speed: 100, dt: 0.1, blockedAt });
  assert.equal(r.x, 58, "x hålls kvar mot väggen");
  assert.ok(r.y < 50, "y glider vidare uppåt");
  assert.ok(r.moving);
});

test("clamp och margin håller figuren innanför scenen", () => {
  assert.equal(clamp(-5, 0, 100), 0);
  assert.equal(clamp(150, 0, 100), 100);
  const r = moveStep({ x: 3, y: 50 }, { x: -1, y: 0 }, { speed: 100, dt: 1, blockedAt: free, margin: 4 });
  assert.equal(r.x, 4, "stoppas vid marginalen, inte utanför scenen");
});

test("maxX/maxY clampar till en STÖRRE värld (pixel-koordinater, #220)", () => {
  // Default är 0..100 (procent-gridet). En bild-karta-värld skickar sina pixelmått.
  const r = moveStep({ x: 1990, y: 500 }, { x: 1, y: 0 }, {
    speed: 1000, dt: 1, blockedAt: free, margin: 5, maxX: 2000, maxY: 1000,
  });
  assert.equal(r.x, 1995, "stoppas vid maxX - margin, inte vid 100");
  const up = moveStep({ x: 500, y: 3 }, { x: 0, y: -1 }, {
    speed: 1000, dt: 1, blockedAt: free, margin: 5, maxX: 2000, maxY: 1000,
  });
  assert.equal(up.y, 5, "clampas mot marginalen i den nya världens höjd");
});

test("utan maxX/maxY behålls 0..100-beteendet (bakåtkompatibelt)", () => {
  const r = moveStep({ x: 98, y: 50 }, { x: 1, y: 0 }, { speed: 100, dt: 1, blockedAt: free });
  assert.equal(r.x, 100, "clampas fortfarande till 100 som förr");
});

test("nearestWithin hittar närmaste punkt inom radie, annars null", () => {
  const from = { x: 50, y: 50 };
  const pts = [{ x: 90, y: 90 }, { x: 55, y: 50 }, { x: 40, y: 60 }];
  const hit = nearestWithin(from, pts, 12);
  assert.equal(hit.index, 1);
  assert.ok(hit.d <= 12);
  assert.equal(nearestWithin(from, [{ x: 99, y: 99 }], 5), null);
});
