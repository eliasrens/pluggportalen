// ============================================================================
// Läsresan (#399): reseprogression + världsregister – journey.js, worlds/.
// Spec-acceptanstest 1 (start), 2 (+1 steg), 7 (Skogen → Öknen) + sista världen
// (Månen sedan #660) + hela kedjan med sju världar.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { completeStep, normalizeProgress } from "../src/lasresan/journey.js";
import { WORLDS, firstWorld, nextWorld, getWorld, isWorldUnlocked, validateWorld } from "../src/lasresan/worlds/index.js";

test("registret: sju världar Skogen → … → Månen, alla följer schemat (#660)", () => {
  assert.deepEqual(WORLDS.map((w) => w.id), ["skogen", "oknen", "havet", "djungeln", "bergen", "vulkanlandet", "manen"]);
  assert.deepEqual(WORLDS.map((w) => w.order), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(WORLDS.slice(4).map((w) => w.name), ["Bergen", "Vulkanlandet", "Månen"]);
  // id:n är rena ASCII-nycklar (sparas i Firestore), namnen får ha å/ä/ö.
  for (const w of WORLDS) assert.match(w.id, /^[a-z]+$/, w.id);
  assert.equal(firstWorld().id, "skogen");
  assert.equal(nextWorld("skogen").id, "oknen");
  assert.equal(nextWorld("oknen").id, "havet");
  assert.equal(nextWorld("havet").id, "djungeln");
  assert.equal(nextWorld("djungeln").id, "bergen");
  assert.equal(nextWorld("bergen").id, "vulkanlandet");
  assert.equal(nextWorld("vulkanlandet").id, "manen");
  assert.equal(nextWorld("manen"), null);
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
  // #660: Djungeln → Bergen → Vulkanlandet → Månen
  const fyra = ["skogen", "oknen", "havet", "djungeln"];
  assert.equal(getWorld("bergen").unlockAfter, "djungeln");
  assert.equal(getWorld("vulkanlandet").unlockAfter, "bergen");
  assert.equal(getWorld("manen").unlockAfter, "vulkanlandet");
  assert.equal(isWorldUnlocked(getWorld("bergen"), fyra.slice(0, 3)), false);
  assert.equal(isWorldUnlocked(getWorld("bergen"), fyra), true);
  assert.equal(isWorldUnlocked(getWorld("vulkanlandet"), fyra), false);
  assert.equal(isWorldUnlocked(getWorld("vulkanlandet"), [...fyra, "bergen"]), true);
  assert.equal(isWorldUnlocked(getWorld("manen"), [...fyra, "bergen"]), false);
  assert.equal(isWorldUnlocked(getWorld("manen"), [...fyra, "bergen", "vulkanlandet"]), true);
});

test("Havet–Månen: 20 steg, 20 positioner inne i scenen, rendererbar scen (#659, #660)", () => {
  for (const id of ["havet", "djungeln", "bergen", "vulkanlandet", "manen"]) {
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

test("hela kedjan: 7 × 20 texter går genom alla världar i ordning till Månen (#660)", () => {
  let p = normalizeProgress(undefined);
  const byten = [];
  for (let i = 0; i < 7 * 20; i++) {
    const r = completeStep(p);
    assert.equal(r.walk.toStep, r.walk.fromStep + 1, `text ${i + 1}: exakt ett steg`);
    if (r.worldCompleted) byten.push([r.completedWorldId, r.unlockedWorldId]);
    p = r.progress;
  }
  assert.deepEqual(byten, [
    ["skogen", "oknen"], ["oknen", "havet"], ["havet", "djungeln"], ["djungeln", "bergen"],
    ["bergen", "vulkanlandet"], ["vulkanlandet", "manen"], ["manen", null],
  ]);
  assert.deepEqual(p, { worldId: "manen", stepInWorld: 20, completedWorlds: WORLDS.map((w) => w.id) });
});

test("text 20 i Djungeln → Bergen; Bergen → Vulkanlandet; Vulkanlandet → Månen (#660)", () => {
  const fyra = ["skogen", "oknen", "havet"];
  const d = completeStep({ worldId: "djungeln", stepInWorld: 19, completedWorlds: fyra });
  assert.equal(d.worldCompleted, true);
  assert.equal(d.completedWorldId, "djungeln");
  assert.equal(d.unlockedWorldId, "bergen");
  assert.deepEqual(d.walk, { worldId: "djungeln", fromStep: 19, toStep: 20 });
  assert.deepEqual(d.progress, { worldId: "bergen", stepInWorld: 0, completedWorlds: [...fyra, "djungeln"] });
  const b = completeStep({ worldId: "bergen", stepInWorld: 19, completedWorlds: [...fyra, "djungeln"] });
  assert.equal(b.unlockedWorldId, "vulkanlandet");
  assert.deepEqual(b.progress, { worldId: "vulkanlandet", stepInWorld: 0, completedWorlds: [...fyra, "djungeln", "bergen"] });
  const v = completeStep(b.progress);
  assert.deepEqual(v.walk, { worldId: "vulkanlandet", fromStep: 0, toStep: 1 });
  const v20 = completeStep({ ...b.progress, stepInWorld: 19 });
  assert.equal(v20.unlockedWorldId, "manen");
  assert.deepEqual(v20.progress, { worldId: "manen", stepInWorld: 0, completedWorlds: [...fyra, "djungeln", "bergen", "vulkanlandet"] });
});

test("elev som redan klarat Djungeln (förr sista världen) går vidare till Bergen (#660)", () => {
  const sparad = { worldId: "djungeln", stepInWorld: 20, completedWorlds: ["skogen", "oknen", "havet", "djungeln"] };
  assert.deepEqual(normalizeProgress(sparad), { worldId: "bergen", stepInWorld: 0, completedWorlds: sparad.completedWorlds });
  const r = completeStep(sparad);
  assert.equal(r.worldCompleted, false);
  assert.deepEqual(r.walk, { worldId: "bergen", fromStep: 0, toStep: 1 });
  assert.deepEqual(r.progress, { worldId: "bergen", stepInWorld: 1, completedWorlds: sparad.completedWorlds });
});

test("sista världen (Månen): klar → står kvar på sista steget, kan fortsätta läsa", () => {
  const alla = ["skogen", "oknen", "havet", "djungeln", "bergen", "vulkanlandet"];
  const r = completeStep({ worldId: "manen", stepInWorld: 19, completedWorlds: alla });
  assert.equal(r.worldCompleted, true);
  assert.equal(r.completedWorldId, "manen");
  assert.equal(r.unlockedWorldId, null);
  assert.deepEqual(r.progress, { worldId: "manen", stepInWorld: 20, completedWorlds: [...alla, "manen"] });
  // Varje ny text därefter: ingen gång, inget nytt firande, samma läge.
  let p = r.progress;
  for (let i = 0; i < 5; i++) {
    const again = completeStep(p);
    assert.equal(again.worldCompleted, false);
    assert.deepEqual(again.progress, r.progress);
    assert.deepEqual(again.walk, { worldId: "manen", fromStep: 20, toStep: 20 });
    p = again.progress;
  }
  assert.deepEqual(normalizeProgress(r.progress), r.progress);
});

test("ny värld tillagd efter den sista → eleven flyttas dit automatiskt", () => {
  const rymden = { ...getWorld("manen"), id: "rymden", name: "Rymden", order: 8, unlockAfter: "manen" };
  const registry = [...WORLDS, rymden];
  const klara = WORLDS.map((w) => w.id);
  const p = normalizeProgress({ worldId: "manen", stepInWorld: 20, completedWorlds: klara }, registry);
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
