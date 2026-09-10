// ============================================================================
// Enhetstest för äventyrsmotorns kompass-riktning (src/adventure/compass.js, #261).
// Ren matte, ingen DOM. Körs med: node --test
// Täcker: vinkel mot närmsta icke-klarade station, målbyte när man klarar en,
// slutmålet efter goalActive, samt "inget mål" (hasTarget=false → dölj kompassen).
// Koordinatsystemet är skärm-orienterat (y växer nedåt) så atan2(dy,dx) matchar
// CSS rotate() medurs; testerna verifierar exakta vinklar för de fyra väderstrecken.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { nearestTargetAngle } from "../src/adventure/compass.js";

const HALF_PI = Math.PI / 2;

test("pekar mot enda stationen: fyra väderstreck ger rätt atan2-vinkel", () => {
  const pos = { x: 50, y: 50 };
  // öster (till höger) → 0
  assert.equal(nearestTargetAngle({ pos, stations: [{ x: 90, y: 50 }] }).angleRad, 0);
  // söder (nedåt, y växer) → +π/2
  assert.equal(nearestTargetAngle({ pos, stations: [{ x: 50, y: 90 }] }).angleRad, HALF_PI);
  // norr (uppåt) → -π/2
  assert.equal(nearestTargetAngle({ pos, stations: [{ x: 50, y: 10 }] }).angleRad, -HALF_PI);
  // väster (till vänster) → π
  assert.equal(nearestTargetAngle({ pos, stations: [{ x: 10, y: 50 }] }).angleRad, Math.PI);
});

test("hasTarget=true när ett mål finns, annars false", () => {
  assert.equal(nearestTargetAngle({ pos: { x: 0, y: 0 }, stations: [{ x: 1, y: 1 }] }).hasTarget, true);
  // Inga stationer alls → inget mål.
  assert.deepEqual(nearestTargetAngle({ pos: { x: 0, y: 0 }, stations: [] }), {
    angleRad: 0,
    hasTarget: false,
  });
});

test("väljer NÄRMSTA icke-klarade stationen (euklidiskt)", () => {
  const pos = { x: 0, y: 0 };
  const stations = [
    { x: 100, y: 0 }, // långt bort (öster)
    { x: 0, y: 10 }, // nära (söder)
  ];
  const r = nearestTargetAngle({ pos, stations });
  assert.equal(r.hasTarget, true);
  assert.equal(r.angleRad, HALF_PI); // pekar mot den nära (söder)
});

test("byter mål när närmsta stationen klaras (cleared som Set)", () => {
  const pos = { x: 0, y: 0 };
  const stations = [
    { x: 0, y: 10 }, // närmast (söder)
    { x: 100, y: 0 }, // längre bort (öster)
  ];
  // Innan: pekar söderut mot index 0.
  assert.equal(nearestTargetAngle({ pos, stations }).angleRad, HALF_PI);
  // Efter att index 0 klarats: pekar österut mot index 1.
  const cleared = new Set([0]);
  assert.equal(nearestTargetAngle({ pos, stations, cleared }).angleRad, 0);
});

test("cleared fungerar också som array (inte bara Set)", () => {
  const pos = { x: 0, y: 0 };
  const stations = [
    { x: 0, y: 10 },
    { x: 100, y: 0 },
  ];
  assert.equal(nearestTargetAngle({ pos, stations, cleared: [0] }).angleRad, 0);
});

test("alla stationer klarade utan goalActive → inget mål", () => {
  const pos = { x: 0, y: 0 };
  const stations = [
    { x: 0, y: 10 },
    { x: 100, y: 0 },
  ];
  const r = nearestTargetAngle({ pos, stations, cleared: new Set([0, 1]) });
  assert.equal(r.hasTarget, false);
});

test("goalActive → pekar mot slutmålet, oavsett stationer", () => {
  const pos = { x: 0, y: 0 };
  const stations = [{ x: 0, y: 10 }]; // skulle annars peka söderut
  const goal = { x: 10, y: 0 }; // öster
  const r = nearestTargetAngle({ pos, stations, cleared: new Set([0]), goalActive: true, goal });
  assert.equal(r.hasTarget, true);
  assert.equal(r.angleRad, 0);
});

test("goalActive men goal saknas/ogiltigt → inget mål", () => {
  const pos = { x: 0, y: 0 };
  assert.equal(nearestTargetAngle({ pos, stations: [], goalActive: true }).hasTarget, false);
  assert.equal(
    nearestTargetAngle({ pos, stations: [], goalActive: true, goal: { x: NaN, y: 0 } }).hasTarget,
    false
  );
});

test("robust mot saknad/ogiltig indata (inga krascher)", () => {
  assert.equal(nearestTargetAngle().hasTarget, false);
  assert.equal(nearestTargetAngle({}).hasTarget, false);
  assert.equal(nearestTargetAngle({ pos: { x: NaN, y: 0 }, stations: [{ x: 1, y: 1 }] }).hasTarget, false);
  // Ogiltig station hoppas över, giltig används.
  const r = nearestTargetAngle({ pos: { x: 0, y: 0 }, stations: [null, { x: 5, y: 0 }] });
  assert.equal(r.hasTarget, true);
  assert.equal(r.angleRad, 0);
});

test("diagonal: 45° nedåt-höger ger π/4", () => {
  const r = nearestTargetAngle({ pos: { x: 0, y: 0 }, stations: [{ x: 5, y: 5 }] });
  assert.ok(Math.abs(r.angleRad - Math.PI / 4) < 1e-12);
});
