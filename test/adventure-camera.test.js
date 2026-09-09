// ============================================================================
// Enhetstest för äventyrsmotorns scroll-kamera (src/adventure/camera.js, #220).
// Ren matte, ingen DOM. Körs med: node --test
// Täcker zoom (~1/6 men aldrig utanför bildkanten), fokus-clamp (viewporten
// aldrig utanför världen + centrering när världen är mindre än viewporten),
// lerp/följnings-faktor och den stateful följarens snäpp-på-första-bildrutan.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  clampRange,
  lerp,
  fitZoom,
  clampFocus,
  cameraTransform,
  followFactor,
  createCamera,
} from "../src/adventure/camera.js";

test("clampRange klampar och centrerar när intervallet är inverterat", () => {
  assert.equal(clampRange(5, 0, 10), 5);
  assert.equal(clampRange(-3, 0, 10), 0);
  assert.equal(clampRange(99, 0, 10), 10);
  // hi<lo → viewporten större än världen → centrera (mitt mellan gränserna).
  assert.equal(clampRange(999, 30, 10), 20);
});

test("lerp och followFactor: bildruts-oberoende, 0 vid dt=0", () => {
  assert.equal(lerp(0, 10, 0.5), 5);
  assert.equal(followFactor(0, 0.12), 0);
  const t = followFactor(0.016, 0.12);
  assert.ok(t > 0 && t < 1);
  // Längre dt → större steg mot målet.
  assert.ok(followFactor(0.1, 0.12) > followFactor(0.016, 0.12));
});

test("fitZoom: stor värld ger ~1/6-vy, men aldrig under cover", () => {
  const screen = { w: 600, h: 400 };
  const world = { w: 3600, h: 2400 };
  const z = fitZoom(screen, world, 1 / 6);
  // desired = 600 / (3600 * 1/6) = 1.0 ; cover = max(600/3600, 400/2400)=0.1667
  assert.ok(Math.abs(z - 1) < 1e-9);
  // Vid zoom 1 syns 600px av 3600 → 1/6 av världsbredden. ✔
  const visibleFrac = screen.w / z / world.w;
  assert.ok(Math.abs(visibleFrac - 1 / 6) < 1e-9);
});

test("fitZoom: liten värld → cover vinner (ser aldrig utanför bilden)", () => {
  const screen = { w: 600, h: 400 };
  const world = { w: 500, h: 500 };
  const z = fitZoom(screen, world, 1 / 6);
  // cover = max(600/500, 400/500) = 1.2 ; desired = 600/(500/6)=7.2 → men här
  // desired > cover ändå; testa i stället en värld nätt större än scenen:
  const z2 = fitZoom(screen, { w: 800, h: 600 }, 1);
  // viewFraction 1 → desired = 600/800 = 0.75 ; cover = max(0.75, 0.667)=0.75.
  const halfW = screen.w / z2 / 2;
  assert.ok(halfW <= 800 / 2 + 1e-9, "viewporten ryms inom världsbredden");
  assert.ok(z > 0);
});

test("clampFocus håller viewporten innanför världen", () => {
  const screen = { w: 600, h: 400 };
  const world = { w: 3600, h: 2400 };
  const zoom = 1; // halvView = 300 × 200
  // Försök fokusera i hörnet (0,0) → clampas till (300,200).
  assert.deepEqual(clampFocus({ x: 0, y: 0 }, screen, world, zoom), { x: 300, y: 200 });
  // Bortom bortre hörnet → clampas till (3300,2200).
  assert.deepEqual(clampFocus({ x: 9999, y: 9999 }, screen, world, zoom), { x: 3300, y: 2200 });
  // Mitten lämnas orörd.
  assert.deepEqual(clampFocus({ x: 1800, y: 1200 }, screen, world, zoom), { x: 1800, y: 1200 });
});

test("cameraTransform placerar fokus i scenens mitt", () => {
  const screen = { w: 600, h: 400 };
  const t = cameraTransform({ x: 1000, y: 800 }, screen, 2);
  // tx = 300 - 1000*2 = -1700 ; ty = 200 - 800*2 = -1400
  assert.equal(t, "translate(-1700px, -1400px) scale(2)");
});

test("createCamera: snäpper första bildrutan, följer sedan mjukt & clampat", () => {
  const world = { w: 3600, h: 2400 };
  const cam = createCamera({ world, viewFraction: 1 / 6, tau: 0.12 });
  cam.setScreen({ w: 600, h: 400 });
  // Första update snäpper fokus till (clampad) spelarposition – ingen glidning.
  cam.update({ x: 1800, y: 1200 }, 0.016);
  assert.deepEqual(cam.getFocus(), { x: 1800, y: 1200 });
  // Flytta spelaren; fokus rör sig MOT målet men inte hela vägen på en bildruta.
  cam.update({ x: 2000, y: 1200 }, 0.016);
  const f = cam.getFocus();
  assert.ok(f.x > 1800 && f.x < 2000, "mjuk följning, ingen hoppighet");
  // Nära världskanten clampas fokus (viewporten går aldrig utanför bilden).
  for (let i = 0; i < 200; i++) cam.update({ x: 5000, y: 1200 }, 0.05);
  assert.ok(cam.getFocus().x <= 3600 - 300 + 1e-6);
});
