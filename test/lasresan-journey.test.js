// ============================================================================
// Läsresan (#399): reseprogression + världsregister – journey.js, worlds/.
// Spec-acceptanstest 1 (start), 2 (+1 steg), 7 (Skogen → Öknen) + sista världen.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { completeStep, normalizeProgress } from "../src/lasresan/journey.js";
import { WORLDS, firstWorld, nextWorld, getWorld, isWorldUnlocked, validateWorld } from "../src/lasresan/worlds/index.js";

test("registret: Skogen → Öknen → Havet → Djungeln, alla följer schemat", () => {
  assert.deepEqual(WORLDS.map((w) => w.id), ["skogen", "oknen", "havet", "djungeln"]);
  assert.deepEqual(WORLDS.map((w) => w.order), [1, 2, 3, 4]);
  assert.equal(firstWorld().id, "skogen");
  assert.equal(nextWorld("skogen").id, "oknen");
  assert.equal(nextWorld("oknen").id, "havet");
  assert.equal(nextWorld("havet").id, "djungeln");
  assert.equal(nextWorld("djungeln"), null);
  for (const w of WORLDS) assert.deepEqual(validateWorld(w), [], w.id);
  assert.equal(getWorld("skogen").steps, 20);
  assert.equal(getWorld("oknen").unlockAfter, "skogen");
  assert.equal(isWorldUnlocked(getWorld("oknen"), []), false);
  assert.equal(isWorldUnlocked(getWorld("oknen"), ["skogen"]), true);
});

test("unlockAfter-kedjan: varje värld låses upp av den före (#659)", () => {
  assert.equal(getWorld("skogen").unlockAfter, null);
  for (let i = 1; i < WORLDS.length; i++) assert.equal(WORLDS[i].unlockAfter, WORLDS[i - 1].id, WORLDS[i].id);
  assert.equal(isWorldUnlocked(getWorld("havet"), ["skogen"]), false);
  assert.equal(isWorldUnlocked(getWorld("havet"), ["skogen", "oknen"]), true);
  assert.equal(isWorldUnlocked(getWorld("djungeln"), ["skogen", "oknen"]), false);
  assert.equal(isWorldUnlocked(getWorld("djungeln"), ["skogen", "oknen", "havet"]), true);
});

test("Havet och Djungeln: 20 steg, 20 positioner inne i scenen, rendererbar scen (#659)", () => {
  for (const id of ["havet", "djungeln"]) {
    const w = getWorld(id);
    assert.equal(w.steps, 20, id);
    assert.equal(w.stepPositions.length, 20, id);
    const inne = (p) => p.x >= 0 && p.x <= w.scene.width && p.y >= 0 && p.y <= w.scene.height;
    assert.ok(w.stepPositions.every(inne) && inne(w.start), `${id}: punkter utanför scenen`);
    // Klickytorna (r≈46) ska inte ligga ovanpå varandra.
    const pts = [w.start, ...w.stepPositions];
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      assert.ok(d >= 100, `${id}: steg ${i - 1}→${i} för nära (${Math.round(d)} px)`);
    }
    const svg = w.scene.render(w);
    assert.equal(typeof svg, "string");
    assert.ok(svg.length > 1000 && !svg.includes("NaN") && !svg.includes("undefined"), id);
  }
});

test("Test 1: ny elev (saknat progress) → Skogen, före steg 1", () => {
  assert.deepEqual(normalizeProgress(undefined), { worldId: "skogen", stepInWorld: 0, completedWorlds: [] });
});

test("Test 2: en text → exakt +1 steg", () => {
  const r = completeStep({ worldId: "skogen", stepInWorld: 0, completedWorlds: [] });
  assert.equal(r.progress.stepInWorld, 1);
  assert.deepEqual(r.walk, { worldId: "skogen", fromStep: 0, toStep: 1 });
  assert.equal(r.worldCompleted, false);
});

test("Test 7: text 20 i Skogen → Skogen klar, Öknen öppnas, steg 0", () => {
  const r = completeStep({ worldId: "skogen", stepInWorld: 19, completedWorlds: [] });
  assert.equal(r.worldCompleted, true);
  assert.equal(r.completedWorldId, "skogen");
  assert.equal(r.unlockedWorldId, "oknen");
  assert.deepEqual(r.walk, { worldId: "skogen", fromStep: 19, toStep: 20 }); // avataren når sista steget
  assert.deepEqual(r.progress, { worldId: "oknen", stepInWorld: 0, completedWorlds: ["skogen"] });
  // Nästa läsning sker i Öknen.
  assert.equal(completeStep(r.progress).progress.worldId, "oknen");
});

test("text 20 i Öknen → Öknen klar, Havet öppnas; text 20 i Havet → Djungeln (#659)", () => {
  const r = completeStep({ worldId: "oknen", stepInWorld: 19, completedWorlds: ["skogen"] });
  assert.equal(r.worldCompleted, true);
  assert.equal(r.completedWorldId, "oknen");
  assert.equal(r.unlockedWorldId, "havet");
  assert.deepEqual(r.walk, { worldId: "oknen", fromStep: 19, toStep: 20 });
  assert.deepEqual(r.progress, { worldId: "havet", stepInWorld: 0, completedWorlds: ["skogen", "oknen"] });
  const h = completeStep({ worldId: "havet", stepInWorld: 19, completedWorlds: ["skogen", "oknen"] });
  assert.equal(h.unlockedWorldId, "djungeln");
  assert.deepEqual(h.progress, { worldId: "djungeln", stepInWorld: 0, completedWorlds: ["skogen", "oknen", "havet"] });
});

test("elev som redan klarat Öknen (förr sista världen) går vidare till Havet (#659)", () => {
  // Så låg en elev sparad när Öknen var sista världen: kvar på steg 20, Öknen klar.
  const sparad = { worldId: "oknen", stepInWorld: 20, completedWorlds: ["skogen", "oknen"] };
  const p = normalizeProgress(sparad);
  assert.deepEqual(p, { worldId: "havet", stepInWorld: 0, completedWorlds: ["skogen", "oknen"] });
  // Nästa text går ett steg i Havet (inte "står still" som i sista världen).
  const r = completeStep(sparad);
  assert.equal(r.worldCompleted, false);
  assert.deepEqual(r.walk, { worldId: "havet", fromStep: 0, toStep: 1 });
  assert.deepEqual(r.progress, { worldId: "havet", stepInWorld: 1, completedWorlds: ["skogen", "oknen"] });
});

test("sista världen (Djungeln): klar → står kvar på sista steget, kan fortsätta läsa", () => {
  const alla = ["skogen", "oknen", "havet"];
  const r = completeStep({ worldId: "djungeln", stepInWorld: 19, completedWorlds: alla });
  assert.equal(r.worldCompleted, true);
  assert.equal(r.unlockedWorldId, null);
  assert.deepEqual(r.progress, { worldId: "djungeln", stepInWorld: 20, completedWorlds: [...alla, "djungeln"] });
  const again = completeStep(r.progress);
  assert.equal(again.worldCompleted, false);
  assert.deepEqual(again.progress, r.progress);
  assert.deepEqual(again.walk, { worldId: "djungeln", fromStep: 20, toStep: 20 });
});

test("ny värld tillagd efter den sista → eleven flyttas dit automatiskt", () => {
  const rymden = { ...getWorld("djungeln"), id: "rymden", name: "Rymden", order: 5, unlockAfter: "djungeln" };
  const registry = [...WORLDS, rymden];
  const klara = ["skogen", "oknen", "havet", "djungeln"];
  const p = normalizeProgress({ worldId: "djungeln", stepInWorld: 20, completedWorlds: klara }, registry);
  assert.deepEqual(p, { worldId: "rymden", stepInWorld: 0, completedWorlds: klara });
});

test("okänd värld i sparad data → första ej klarade världen", () => {
  assert.equal(normalizeProgress({ worldId: "borttagen", stepInWorld: 5, completedWorlds: ["skogen"] }).worldId, "oknen");
  assert.equal(normalizeProgress({ worldId: "skogen", stepInWorld: 99 }).stepInWorld, 20);
});

test("validateWorld fångar trasig config", () => {
  const bad = { ...getWorld("skogen"), stepPositions: [{ x: 1, y: 1 }] };
  assert.ok(validateWorld(bad).some((e) => e.includes("stepPositions")));
});
