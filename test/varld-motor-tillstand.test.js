// ============================================================================
// Lagrets hover-/fokus-tillstånd i pyramidnyckeln (#396, F6 #432).
// Fejkade noder: matches(":hover"/":focus-visible") + getAnimations().
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { tillstand, tillstandsNyckel, klarAttSpegla } from "../src/varld-motor-tillstand.js";

class FejkTransition {
  constructor(playState = "running") { this.playState = playState; this.finished = new Promise((r) => { this.klar = r; }); }
}
globalThis.CSSTransition = FejkTransition;

function nod({ hover = false, fokus = false, anims = [] } = {}) {
  return {
    matches: (s) => (s === ":hover" ? hover : s === ":focus-visible" ? fokus : false),
    getAnimations: () => anims,
  };
}
const lager = (noder) => ({ querySelectorAll: () => noder });

test("neutralt lager → tom signatur (= dagens nyckel)", () => {
  assert.equal(tillstand(lager([nod(), nod()]), "[id$=husgrupp]"), "");
  assert.equal(tillstandsNyckel("ute|1", ""), "ute|1");
});

test("hover och fokus på olika noder → index i selektorns ordning", () => {
  const L = lager([nod({ hover: true }), nod({ fokus: true })]);
  assert.equal(tillstand(L, "x"), "0:h,1:f");
  assert.equal(tillstandsNyckel("ute|1", tillstand(L, "x")), "ute|1#0:h,1:f");
});

test("pågående (eller av vilan pausad) transition → '~' (ingen spegel matchar exakt)", () => {
  assert.equal(tillstand(lager([nod({ hover: true, anims: [new FejkTransition()] })]), "x"), "0:h~");
  assert.equal(tillstand(lager([nod({ anims: [new FejkTransition("paused")] })]), "x"), "0:~");
  assert.equal(tillstand(lager([nod({ hover: true, anims: [new FejkTransition("finished")] })]), "x"), "0:h");
});

test("ingen selektor / ogiltig selektor → neutralt", () => {
  assert.equal(tillstand(lager([nod({ hover: true })]), ""), "");
  assert.equal(tillstand({ querySelectorAll() { throw new Error("syntax"); } }, "::x"), "");
});

test("klarAttSpegla: löser när hover-transitionen landat", async () => {
  const t = new FejkTransition();
  let klar = false;
  const p = klarAttSpegla(lager([nod({ hover: true, anims: [t] })]), "x", 5000).then(() => { klar = true; });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(klar, false);
  t.klar();
  await p;
  assert.equal(klar, true);
});

test("klarAttSpegla: inget pågår → direkt; hänger transitionen → maxMs", async () => {
  await klarAttSpegla(lager([nod()]), "x", 5000);
  const t0 = performance.now();
  await klarAttSpegla(lager([nod({ anims: [new FejkTransition()] })]), "x", 30);
  assert.ok(performance.now() - t0 >= 25);
});
