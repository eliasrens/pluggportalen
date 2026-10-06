// ============================================================================
// Läsresan (#399): reseprogression + världsregister – journey.js, worlds/.
// Spec-acceptanstest 1 (start), 2 (+1 steg), 7 (Skogen → Öknen) + sista världen.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { completeStep, normalizeProgress } from "../src/lasresan/journey.js";
import { WORLDS, firstWorld, nextWorld, getWorld, isWorldUnlocked, validateWorld } from "../src/lasresan/worlds/index.js";

test("registret: Skogen först, Öknen efter, båda följer schemat", () => {
  assert.deepEqual(WORLDS.map((w) => w.id), ["skogen", "oknen"]);
  assert.equal(firstWorld().id, "skogen");
  assert.equal(nextWorld("skogen").id, "oknen");
  assert.equal(nextWorld("oknen"), null);
  for (const w of WORLDS) assert.deepEqual(validateWorld(w), [], w.id);
  assert.equal(getWorld("skogen").steps, 20);
  assert.equal(getWorld("oknen").unlockAfter, "skogen");
  assert.equal(isWorldUnlocked(getWorld("oknen"), []), false);
  assert.equal(isWorldUnlocked(getWorld("oknen"), ["skogen"]), true);
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

test("sista världen: klar → står kvar på sista steget, kan fortsätta läsa", () => {
  const r = completeStep({ worldId: "oknen", stepInWorld: 19, completedWorlds: ["skogen"] });
  assert.equal(r.worldCompleted, true);
  assert.equal(r.unlockedWorldId, null);
  assert.deepEqual(r.progress, { worldId: "oknen", stepInWorld: 20, completedWorlds: ["skogen", "oknen"] });
  const again = completeStep(r.progress);
  assert.equal(again.worldCompleted, false);
  assert.deepEqual(again.progress, r.progress);
  assert.deepEqual(again.walk, { worldId: "oknen", fromStep: 20, toStep: 20 });
});

test("ny värld tillagd efter den sista → eleven flyttas dit automatiskt", () => {
  const rymden = { ...getWorld("oknen"), id: "rymden", name: "Rymden", order: 3, unlockAfter: "oknen" };
  const registry = [...WORLDS, rymden];
  const p = normalizeProgress({ worldId: "oknen", stepInWorld: 20, completedWorlds: ["skogen", "oknen"] }, registry);
  assert.deepEqual(p, { worldId: "rymden", stepInWorld: 0, completedWorlds: ["skogen", "oknen"] });
});

test("okänd värld i sparad data → första ej klarade världen", () => {
  assert.equal(normalizeProgress({ worldId: "borttagen", stepInWorld: 5, completedWorlds: ["skogen"] }).worldId, "oknen");
  assert.equal(normalizeProgress({ worldId: "skogen", stepInWorld: 99 }).stepInWorld, 20);
});

test("validateWorld fångar trasig config", () => {
  const bad = { ...getWorld("skogen"), stepPositions: [{ x: 1, y: 1 }] };
  assert.ok(validateWorld(bad).some((e) => e.includes("stepPositions")));
});
