// G1 (#425): kalibrerad enhetsklass, budget efter scenstorlek, LRU-ålder för
// 30 s-städningen. Ren logik i varld-textur-budget.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  enhetsKlass, budget, overgangBytes, anpassaBudget, sattAnpassning, sattGpu, tvingadKlass,
  texturBytes, nivaer, TexturLRU,
} from "../src/varld-textur-budget.js";
import { planeraNiva } from "../src/varld-textur.js";

const MB = 1024 * 1024;

test("enhetsKlass (G1): Chromebooks svaga, fyrkärnig 8 GB-laptop normal, mjukvaru-GL svag", () => {
  // Typiska skol-Chromebooks: N4020/N4500 (2 kärnor, 4 GB), MT8183 (8 kärnor, 4 GB), N5100 (4 kärnor, 4/8 GB)
  assert.equal(enhetsKlass({ deviceMemory: 4, hardwareConcurrency: 2 }, 16384), "svag");
  assert.equal(enhetsKlass({ deviceMemory: 4, hardwareConcurrency: 8 }, 8192), "svag");
  assert.equal(enhetsKlass({ deviceMemory: 8, hardwareConcurrency: 4 }, 16384), "normal"); // §6 hade svag
  assert.equal(enhetsKlass({ deviceMemory: 8, hardwareConcurrency: 2 }, 16384), "svag");
  assert.equal(enhetsKlass({ hardwareConcurrency: 4 }, 16384), "svag"); // okänt minne + 4 kärnor
  assert.equal(enhetsKlass({ deviceMemory: 8, hardwareConcurrency: 8 }, 16384, "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))"), "svag");
  assert.equal(enhetsKlass({ deviceMemory: 8, hardwareConcurrency: 8 }, 16384, "ANGLE (Intel, Mesa Intel(R) UHD Graphics 600 (GLK 2))"), "normal");
  assert.equal(enhetsKlass({ deviceMemory: 8, hardwareConcurrency: 8 }, 16384, "llvmpipe (LLVM 15.0.7, 256 bits)"), "svag");
});

test("sattGpu: standard-GPU för enhetsKlass (stallIn skickar ingen gpu)", () => {
  try {
    sattGpu("Google SwiftShader");
    assert.equal(enhetsKlass({ deviceMemory: 8, hardwareConcurrency: 8 }, 16384), "svag");
  } finally {
    sattGpu("");
  }
  assert.equal(enhetsKlass({ deviceMemory: 8, hardwareConcurrency: 8 }, 16384), "normal");
});

test("pp:pixi:klass tvingar enhetsklassen (localStorage i try/catch)", () => {
  const forra = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  try {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (k) => (k === "pp:pixi:klass" ? "svag" : null) } });
    assert.equal(tvingadKlass(), "svag");
    assert.equal(enhetsKlass({ deviceMemory: 8, hardwareConcurrency: 16 }, 16384), "svag");
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("blockerad"); } });
    assert.equal(tvingadKlass(), null);
    assert.equal(enhetsKlass({ deviceMemory: 8, hardwareConcurrency: 16 }, 16384), "normal");
  } finally {
    if (forra) Object.defineProperty(globalThis, "localStorage", forra);
    else delete globalThis.localStorage;
  }
});

/** Samma pyramid som motorn bygger (inre rollens fångst = vyn / zMin). */
function verkligaBytes(w, h, dpr, zoom, b) {
  const vy = { x: 0, y: 0, w, h };
  const o = { x: w / 2, y: h / 2 };
  let s = 0;
  for (const z of nivaer(1, zoom, b.steg)) s += planeraNiva(z, o, vy, vy, { dpr, upp: 1, tegel: b.tegel }).bytes;
  const k = zoom;
  const fangst = { x: o.x - o.x * k, y: o.y - o.y * k, w: w * k, h: h * k };
  for (const z of nivaer(1 / zoom, 1, b.steg)) s += planeraNiva(z, o, vy, fangst, { dpr, upp: z < 1 ? b.under1Upplosning : 1, tegel: b.tegel }).bytes;
  return s;
}

test("overgangBytes stämmer med planeraNiva (±3 %) och ger G1-tabellens siffror", () => {
  const svag = budget("svag"), normal = budget("normal");
  for (const [w, h, dpr, zoom, b] of [[1366, 700, 1, 5, svag], [1366, 700, 1, 6, svag], [1920, 1000, 1, 6, normal], [1440, 800, 1.5, 6, normal]]) {
    const est = overgangBytes({ w, h, dpr }, zoom, b), verk = verkligaBytes(w, h, dpr, zoom, b);
    assert.ok(Math.abs(est - verk) / verk < 0.03, `${w}×${h}@${dpr} z${zoom}: ${est} mot ${verk}`);
  }
  const mbT = (w, h, dpr, z, b) => overgangBytes({ w, h, dpr }, z, b) / MB;
  assert.ok(Math.abs(mbT(1366, 700, 1, 5, svag) - 34.0) < 0.5);
  assert.ok(Math.abs(mbT(1366, 700, 1, 6, svag) - 40.1) < 0.5);
  // Chromebook (1366 och FHD i 125 %): navets två grannövergångar (T2 + T3) ryms i svag-budgeten.
  assert.ok(mbT(1366, 700, 1, 5, svag) + mbT(1366, 700, 1, 6, svag) < svag.maxBytes / MB);
  assert.ok(2 * mbT(1536, 800, 1, 6, svag) < svag.maxBytes / MB);
  assert.ok(Math.abs(mbT(1920, 1000, 1, 6, normal) - 117.2) < 1);
});

test("anpassaBudget: maxPar = antal övergångar som ryms, minst 1, högst klassens", () => {
  const svag = budget("svag"), normal = budget("normal");
  assert.equal(anpassaBudget(svag, { w: 1366, h: 700, dpr: 1 }).maxPar, 2);
  assert.equal(anpassaBudget(svag, { w: 1536, h: 800, dpr: 1 }).maxPar, 2);
  assert.equal(anpassaBudget(svag, { w: 1920, h: 1000, dpr: 1 }).maxPar, 1); // 112/~81 MB
  assert.equal(anpassaBudget(normal, { w: 1366, h: 700, dpr: 1 }).maxPar, 3);
  assert.equal(anpassaBudget(normal, { w: 1920, h: 1000, dpr: 1 }).maxPar, 2);
  assert.equal(anpassaBudget(normal, { w: 1440, h: 800, dpr: 2 }).maxPar, 1); // dprTak 1.5 tillämpas
  assert.equal(anpassaBudget(normal, { w: 5000, h: 3000, dpr: 2 }).maxPar, 1);
  assert.deepEqual(anpassaBudget(normal, { w: 0, h: 0, dpr: 1 }), normal);
  // Resten av budgeten orörd.
  const a = anpassaBudget(svag, { w: 1366, h: 700, dpr: 1 });
  assert.deepEqual({ ...a, maxPar: 0 }, { ...svag, maxPar: 0 });
});

test("sattAnpassning: budget() kör kroken, fel i kroken → orörd budget, null tar bort", () => {
  try {
    sattAnpassning((b) => anpassaBudget(b, { w: 1920, h: 1000, dpr: 1 }));
    assert.equal(budget("normal").maxPar, 2);
    assert.equal(budget("normal").maxBytes, 256 * MB);
    sattAnpassning(() => { throw new Error("x"); });
    assert.equal(budget("normal").maxPar, 3);
  } finally {
    sattAnpassning(null);
  }
  assert.equal(budget("normal").maxPar, 3);
});

test("TexturLRU: alder/gamla för 30 s-städningen (låsta räknas aldrig)", () => {
  const lru = new TexturLRU(100 * MB);
  const t0 = performance.now();
  lru.lagg("a", texturBytes(10, 10));
  lru.lagg("b", texturBytes(10, 10));
  lru.lagg("c", texturBytes(10, 10));
  lru.las("c");
  assert.ok(lru.alder("a") < 1000);
  assert.equal(lru.alder("saknas"), Infinity);
  assert.deepEqual(lru.gamla(30000), []);
  const sen = t0 + 31000;
  assert.deepEqual(lru.gamla(30000, sen), ["a", "b"]);
  assert.equal(lru.last("c"), true);
  lru.slapp("a");
  assert.deepEqual(lru.gamla(30000, sen), ["b"]);
  assert.equal(lru.alder("a"), Infinity);
  // Eviction rensar också åldern.
  lru.stallMax(0);
  assert.equal(lru.alder("b"), Infinity);
  assert.deepEqual(lru.nycklar(), ["c"]);
});

test("30 s-städningen behåller aktiva lagret + dess kameragrannar", async () => {
  const { behallLager } = await import("../src/varld-motor-hud.js");
  const kameror = [
    ["skola-lager", "by-lager", "ute-lager", "rum-lager"],
    ["ute-lager", "gard-lager", "laggard-lager"],
    ["by-lager", "kompis-lager"],
  ];
  assert.deepEqual([...behallLager("rum-lager", kameror)].sort(), ["rum-lager", "ute-lager"]);
  assert.deepEqual([...behallLager("ute-lager", kameror)].sort(), ["by-lager", "gard-lager", "rum-lager", "ute-lager"]);
  assert.deepEqual([...behallLager("by-lager", kameror)].sort(), ["by-lager", "kompis-lager", "skola-lager", "ute-lager"]);
  assert.deepEqual([...behallLager("okand", kameror)], ["okand"]);
});
