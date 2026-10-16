// ============================================================================
// Bråkresan (#708): klientens anropslogik (src/brakresan/data-core.js) och
// demonstrationsläget (src/brakresan/demo.js) – utan Firebase.
//   • nätfel → omförsök med SAMMA data; ger upp → retryable-fel, inmatningen kvar
//   • "Sparar …" → "Sparat" / "offline" / "fel"
//   • serverns egna fel (failed-precondition …) försöks inte igen
//   • utkast i localStorage tål trasig lagring
//   • demo/test-läget bygger och bedömer lokalt, stubbar vägras
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { BrakresaFel, callWithRetry, createDrafts, createSaveStatus } from "../src/brakresan/data-core.js";
import { demoRound, exampleTask, gradeDemo, publicTask } from "../src/brakresan/demo.js";
import { loadAllChallenges } from "../src/brakresan/utmaningar/index.js";

const noSleep = async () => {};
const fel = (code, message = code) => Object.assign(new Error(message), { code: `functions/${code}` });

test("nätfel försöks igen med samma data och lyckas", async () => {
  const seen = [];
  let n = 0;
  const invoke = async (d) => {
    seen.push(d);
    if (n++ < 2) throw fel("internal");
    return { data: { ok: true } };
  };
  const status = createSaveStatus();
  const states = [];
  status.subscribe((s) => states.push(s));
  const res = await callWithRetry(invoke, { roundId: "r1", index: 3 }, { status, sleep: noSleep });
  assert.deepEqual(res, { ok: true });
  assert.equal(seen.length, 3);
  assert.ok(seen.every((d) => d.roundId === "r1" && d.index === 3), "samma id varje gång");
  assert.deepEqual(states, ["vilar", "sparar", "sparat"]);
});

test("ger upp efter omförsöken: retryable-fel och offline-status", async () => {
  const status = createSaveStatus();
  const invoke = async () => {
    throw fel("unavailable");
  };
  await assert.rejects(
    callWithRetry(invoke, {}, { status, sleep: noSleep, delays: [1, 1], online: () => false }),
    (e) => e instanceof BrakresaFel && e.retryable && e.code === "unavailable" && /försök igen/.test(e.message),
  );
  assert.equal(status.get(), "offline");
});

test("serverns sakliga fel försöks inte igen och behåller texten", async () => {
  let n = 0;
  const invoke = async () => {
    n++;
    throw fel("failed-precondition", "Svara på alla tio uppgifterna först.");
  };
  const status = createSaveStatus();
  await assert.rejects(callWithRetry(invoke, {}, { status, sleep: noSleep }),
    (e) => e.code === "failed-precondition" && !e.retryable && e.message === "Svara på alla tio uppgifterna först.");
  assert.equal(n, 1);
  assert.equal(status.get(), "fel");
});

test("utkast: spara/läsa/rensa, och trasig lagring kastar aldrig", () => {
  const mem = new Map();
  const storage = { setItem: (k, v) => mem.set(k, v), getItem: (k) => mem.get(k) ?? null, removeItem: (k) => mem.delete(k) };
  const d = createDrafts(storage);
  d.save("r1", 2, { selected: ["p0"] });
  assert.deepEqual(d.load("r1", 2), { selected: ["p0"] });
  assert.equal(d.load("r1", 3), null);
  d.clear("r1", 2);
  assert.equal(d.load("r1", 2), null);
  const trasig = createDrafts({ setItem() { throw new Error("full"); }, getItem() { throw new Error("x"); }, removeItem() { throw new Error("x"); } });
  assert.doesNotThrow(() => trasig.save("r", 0, {}));
  assert.equal(trasig.load("r", 0), null);
  assert.equal(createDrafts(undefined).load("r", 0), null);
});

const all = await loadAllChallenges();
const built = all.find((c) => c.implemented);
const stub = all.find((c) => !c.implemented);

test("demo: en stubbe vägras", { skip: !stub }, async () => {
  await assert.rejects(demoRound(stub.id, "s"), /inte klar/);
});

test("demo: tio lokala uppgifter med facit, publik vy utan facit, lokal bedömning", { skip: !built && "ingen utmaning byggd ännu" }, async () => {
  const a = await demoRound(built.id, "seed-1");
  const b = await demoRound(built.id, "seed-1");
  assert.equal(a.tasks.length, 10);
  assert.deepEqual(a.tasks, b.tasks, "samma seed → samma uppgifter (lärarens 'byt seed')");
  const t = a.tasks[0];
  assert.ok(t.key && !("key" in publicTask(t)));
  const r = gradeDemo(a.challenge, t, t.key.examples.right[0]);
  assert.equal(r.correct, true);
  assert.equal(r.reveal.display, t.key.display);
  const ex = await exampleTask(built.id, "seed-2");
  assert.ok(ex.task.key);
});
