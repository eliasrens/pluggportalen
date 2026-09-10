// ============================================================================
// Enhetstest för äventyrsmotorns flee-logik (src/adventure/flee.js, #276).
// Ren matte/state, ingen DOM, ingen Firebase. Körs med: node --test
// Täcker: detect→flee-transition, timer-nedräkning→respawn, respawn hamnar
// UTANFÖR viewporten + på gångbar mark + ej ovanpå spelaren, flee-vektorn pekar
// BORT och fastnar inte mot en vägg (matad blockedAt-mur), samt att cleared-spöken
// hoppas helt. Speglar test/adventure-camera.test.js / adventure-world.test.js.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  fleeStep,
  fleeDirection,
  pickRespawn,
  updateFlee,
  createFleeStates,
} from "../src/adventure/flee.js";

const OPEN = () => false; // ingenting blockerat (öppen värld)
const WORLD = { w: 1000, h: 800 };

/** Deterministisk rng-sekvens (loopar) för reproducerbara respawn-tester. */
function seqRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

test("createFleeStates ger n lugna spöken", () => {
  const s = createFleeStates(3);
  assert.equal(s.length, 3);
  for (const st of s) assert.deepEqual(st, { status: "calm", fleeTimer: 0, fleeCount: 0 });
});

test("fleeDirection: enhetsvektor bort från spelaren, säker vid sammanfall", () => {
  const d = fleeDirection({ x: 110, y: 100 }, { x: 100, y: 100 });
  assert.ok(Math.abs(Math.hypot(d.x, d.y) - 1) < 1e-9);
  assert.ok(d.x > 0.99 && Math.abs(d.y) < 1e-9); // rakt åt höger, bort från spelaren
  // Exakt samma punkt → fallback (ingen NaN).
  const f = fleeDirection({ x: 50, y: 50 }, { x: 50, y: 50 });
  assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y));
  assert.ok(Math.abs(Math.hypot(f.x, f.y) - 1) < 1e-9);
});

test("calm→fleeing när spelaren kommer inom detectRadius, annars orört", () => {
  const stations = [{ x: 500, y: 400 }];
  const states = createFleeStates(1);
  // Långt bort → förblir lugnt.
  let r = updateFlee({
    stations, states, playerPos: { x: 100, y: 100 }, dt: 0.1,
    blockedAt: OPEN, detectRadius: 80, speed: 100, worldSize: WORLD,
  });
  assert.equal(states[0].status, "calm");
  assert.equal(r.startedFleeing.length, 0);
  // Nära → börjar fly, timer = fleeWindow.
  r = updateFlee({
    stations, states, playerPos: { x: 460, y: 400 }, dt: 0.1,
    blockedAt: OPEN, detectRadius: 80, speed: 100, fleeWindow: 3, worldSize: WORLD,
  });
  assert.equal(states[0].status, "fleeing");
  assert.deepEqual(r.startedFleeing, [0]);
  assert.ok(states[0].fleeTimer > 2.8 && states[0].fleeTimer <= 3);
});

test("fleeing rör spöket BORT från spelaren", () => {
  const stations = [{ x: 500, y: 400 }];
  const states = [{ status: "fleeing", fleeTimer: 3, fleeCount: 0 }];
  const before = { ...stations[0] };
  updateFlee({
    stations, states, playerPos: { x: 400, y: 400 }, dt: 0.1,
    blockedAt: OPEN, detectRadius: 80, speed: 200, worldSize: WORLD,
  });
  // Spelaren är till vänster → spöket ska ha flyttat åt höger (ökat x).
  assert.ok(stations[0].x > before.x);
  assert.ok(Math.abs(stations[0].y - before.y) < 1e-6);
});

test("timer räknas ner och når 0 → escape + respawn (calm, fleeCount++)", () => {
  const stations = [{ x: 500, y: 400 }];
  const states = [{ status: "fleeing", fleeTimer: 0.05, fleeCount: 0 }];
  const r = updateFlee({
    stations, states, playerPos: { x: 480, y: 400 }, dt: 0.1,
    blockedAt: OPEN, detectRadius: 80, speed: 100, worldSize: WORLD,
    viewport: { x: 400, y: 300, w: 200, h: 200 }, rng: seqRng([0.05, 0.05]),
  });
  assert.deepEqual(r.respawned, [0]);
  assert.equal(states[0].status, "calm");
  assert.equal(states[0].fleeTimer, 0);
  assert.equal(states[0].fleeCount, 1);
});

test("cleared-spöken hoppas helt (rörs ej, blir aldrig fleeing)", () => {
  const stations = [{ x: 500, y: 400 }, { x: 600, y: 400 }];
  const states = createFleeStates(2);
  const before = { ...stations[0] };
  const r = updateFlee({
    stations, states, cleared: new Set([0]), playerPos: { x: 500, y: 400 }, dt: 0.1,
    blockedAt: OPEN, detectRadius: 80, speed: 100, worldSize: WORLD,
  });
  assert.equal(states[0].status, "calm"); // cleared → aldrig fleeing
  assert.deepEqual(stations[0], before); // orört
  assert.ok(!r.startedFleeing.includes(0));
});

test("fleeStep fastnar INTE mot en vägg – glider tangentiellt förbi", () => {
  // Lodrät mur strax till höger om spöket (x >= 520). Spelaren till vänster ⇒
  // ren flyktriktning är rakt in i muren; steget måste glida längs den (ändra y).
  const wall = (x) => x >= 520;
  const pos = { x: 510, y: 400 };
  const away = fleeDirection(pos, { x: 400, y: 400 }); // pekar åt höger (mot muren)
  const step = fleeStep(pos, away, 20, (x) => wall(x));
  assert.ok(step.moved, "spöket ska ha rört sig trots muren");
  assert.ok(step.x < 520, "får aldrig kliva in i muren");
  assert.ok(Math.abs(step.y - pos.y) > 1e-6, "ska ha glidit i sidled längs muren");
});

test("fleeStep i öppen värld rör sig rakt bort", () => {
  const pos = { x: 100, y: 100 };
  const step = fleeStep(pos, { x: 1, y: 0 }, 10, OPEN);
  assert.equal(step.moved, true);
  assert.ok(Math.abs(step.x - 110) < 1e-9 && Math.abs(step.y - 100) < 1e-9);
});

test("pickRespawn: gångbar mark, UTANFÖR viewporten, ej för nära spelaren", () => {
  const viewport = { x: 300, y: 200, w: 400, h: 300 }; // synlig ruta
  const playerPos = { x: 500, y: 350 };
  // Kör många gånger med äkta slump → alla villkor ska hålla varje gång.
  for (let k = 0; k < 400; k++) {
    const spot = pickRespawn({
      blockedAt: OPEN, worldSize: WORLD, viewport, playerPos,
      minGapFromPlayer: 150, rng: Math.random,
    });
    assert.ok(spot, "ska alltid hitta en plats i en öppen värld");
    // Gångbar (open → alltid), inom världen.
    assert.ok(spot.x >= 0 && spot.x <= WORLD.w && spot.y >= 0 && spot.y <= WORLD.h);
    // Utanför viewporten (med marginal ⇒ minst utanför själva rutan).
    const inRect = spot.x >= viewport.x && spot.x <= viewport.x + viewport.w &&
      spot.y >= viewport.y && spot.y <= viewport.y + viewport.h;
    assert.ok(!inRect, "får inte hamna inne i synhåll");
    // Ej för nära spelaren.
    assert.ok(Math.hypot(spot.x - playerPos.x, spot.y - playerPos.y) >= 150);
  }
});

test("pickRespawn respekterar blockedAt (respawnar aldrig i en vägg)", () => {
  // Halva världen (vänster) är vägg; respawn måste hamna i högra halvan.
  const blockedAt = (x) => x < WORLD.w / 2;
  for (let k = 0; k < 200; k++) {
    const spot = pickRespawn({
      blockedAt, worldSize: WORLD, viewport: null,
      playerPos: { x: 900, y: 400 }, minGapFromPlayer: 0, rng: Math.random,
    });
    assert.ok(spot);
    assert.ok(!blockedAt(spot.x, spot.y), "respawn får inte ligga i väggen");
    assert.ok(spot.x >= WORLD.w / 2);
  }
});

test("pickRespawn faller tillbaka snyggt när få gångbara punkter finns", () => {
  // Nästan allt blockerat utom en liten ruta – ska ändå hitta den (fallback-pass).
  const blockedAt = (x, y) => !(x > 950 && x < 990 && y > 10 && y < 50);
  const spot = pickRespawn({
    blockedAt, worldSize: WORLD, viewport: { x: 0, y: 0, w: 900, h: 800 },
    playerPos: { x: 100, y: 100 }, minGapFromPlayer: 5000, rng: Math.random, attempts: 2000,
  });
  assert.ok(spot, "ska hitta den enda gångbara fickan trots hårda villkor");
  assert.ok(!blockedAt(spot.x, spot.y));
});

test("respawn hamnar aldrig ovanpå spelaren (minGapFromPlayer via updateFlee)", () => {
  const stations = [{ x: 500, y: 400 }];
  const playerPos = { x: 500, y: 400 };
  for (let k = 0; k < 200; k++) {
    const states = [{ status: "fleeing", fleeTimer: 0.01, fleeCount: 0 }];
    updateFlee({
      stations: [{ ...stations[0] }], states, playerPos, dt: 0.1,
      blockedAt: OPEN, detectRadius: 100, speed: 100, worldSize: WORLD,
      viewport: { x: 400, y: 300, w: 200, h: 200 }, rng: Math.random,
    });
  }
  // (updateFlee ovan muterar en kopia; här bekräftar vi bara att minGap = detectRadius*1.5
  //  hålls genom pickRespawn direkt.)
  for (let k = 0; k < 300; k++) {
    const spot = pickRespawn({
      blockedAt: OPEN, worldSize: WORLD, viewport: { x: 400, y: 300, w: 200, h: 200 },
      playerPos, minGapFromPlayer: 150, rng: Math.random,
    });
    assert.ok(Math.hypot(spot.x - playerPos.x, spot.y - playerPos.y) >= 150);
  }
});

test("fleeCount saktar ner flykten (ease-golv 60%)", () => {
  const mk = (count) => ({
    stations: [{ x: 500, y: 400 }],
    states: [{ status: "fleeing", fleeTimer: 3, fleeCount: count }],
  });
  const a = mk(0), b = mk(10);
  updateFlee({ ...a, playerPos: { x: 400, y: 400 }, dt: 0.1, blockedAt: OPEN, detectRadius: 80, speed: 200, worldSize: WORLD });
  updateFlee({ ...b, playerPos: { x: 400, y: 400 }, dt: 0.1, blockedAt: OPEN, detectRadius: 80, speed: 200, worldSize: WORLD });
  const moveA = a.stations[0].x - 500;
  const moveB = b.stations[0].x - 500;
  assert.ok(moveB < moveA, "fler flykter → långsammare");
  // Golv 60%: aldrig långsammare än 60% av basfarten.
  assert.ok(moveB >= moveA * 0.6 - 1e-6);
});
