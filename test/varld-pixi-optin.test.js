// ============================================================================
// Pixi-rörelsen är OPT-IN (#396, Elias 2026-10-06): utan pp:pixi:pa är allt
// dagens CSS/DOM-väg – motorn och port-Pixi laddas aldrig, och renderarens
// grind säger nej även om en modul skulle laddas. pp:pixi:av vinner över pa.
// ?pixi=pa sparar opt-in, ?pixi=normal tar bort den.
// ============================================================================

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
const las = (f) => readFileSync(resolve(SRC, f), "utf8");

let lager = new Map();
let sok = "";
globalThis.window ??= {};
window.matchMedia = () => ({ matches: false });
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k) => (lager.has(k) ? lager.get(k) : null),
    setItem: (k, v) => lager.set(k, String(v)),
    removeItem: (k) => lager.delete(k),
  },
});
Object.defineProperty(globalThis, "location", { configurable: true, get: () => ({ search: sok }) });

const { pixiPaslagen } = await import("../src/varld-kamera.js");
const { pixiFlaggor } = await import("../src/varld-render.js");

beforeEach(() => {
  lager = new Map();
  sok = "";
});

test("utan flagga: AV (kameran laddar ingen motor, renderaren säger av)", () => {
  assert.equal(pixiPaslagen(), false);
  assert.equal(pixiFlaggor().av, true);
  assert.equal(pixiFlaggor().pa, false);
});

test("pp:pixi:pa slår på", () => {
  lager.set("pp:pixi:pa", "1");
  assert.equal(pixiPaslagen(), true);
  assert.equal(pixiFlaggor().av, false);
});

test("pp:pixi:av vinner över pa", () => {
  lager.set("pp:pixi:pa", "1");
  lager.set("pp:pixi:av", "1");
  assert.equal(pixiPaslagen(), false);
  assert.equal(pixiFlaggor().av, true);
});

test("pa = 0/false räknas som av", () => {
  for (const v of ["0", "false"]) {
    lager.set("pp:pixi:pa", v);
    assert.equal(pixiPaslagen(), false, v);
    assert.equal(pixiFlaggor().av, true, v);
  }
});

test("?pixi=pa sparar opt-in, ?pixi=normal tar bort den", () => {
  sok = "?pixi=debug,pa";
  assert.equal(pixiPaslagen(), true);
  assert.equal(lager.get("pp:pixi:pa"), "1");
  sok = "";
  assert.equal(pixiPaslagen(), true, "kvar efter omladdning utan parameter");
  sok = "?pixi=normal";
  assert.equal(pixiPaslagen(), false);
  assert.equal(lager.has("pp:pixi:pa"), false);
});

test("trasig localStorage → AV, kastar inte", () => {
  const orig = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("blockerad"); } });
  try {
    assert.equal(pixiPaslagen(), false);
  } finally {
    Object.defineProperty(globalThis, "localStorage", orig);
  }
});

test("laddningsställena är grindade på pixiPaslagen()", () => {
  assert.match(las("pages-varld.js"), /if \(pixiPaslagen\(\)\)[^\n]*import\("\.\/varld-motor\.js"\)/);
  assert.match(las("port-overgang.js"), /if \(!pixiPaslagen\(\)/);
});
