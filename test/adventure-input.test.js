// ============================================================================
// Enhetstest för äventyrsmotorns TOUCH-styrning (src/adventure/input.js, #250).
// Två delar:
//   1) pointerDir() som REN funktion – ingen DOM (samma stil som movement-testet).
//   2) createInput() med en pytteliten event-target-mock (repo:t har ingen jsdom):
//      pointerdown→move→ dir() = "gå mot fingret", frozen nollar touch, up/cancel
//      stannar, tap→interagera, och att TANGENTBORDET är oförändrat.
// Körs med: node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { pointerDir, createInput } from "../src/adventure/input.js";

// --- Del 1: pointerDir som ren funktion -------------------------------------

test("pointerDir: finger rakt höger om origin → {x:1,y:0}", () => {
  assert.deepEqual(pointerDir({ x: 40, y: 10 }, { x: 10, y: 10 }), { x: 1, y: 0 });
});

test("pointerDir: finger rakt ner → {x:0,y:1} (y växer nedåt på skärmen)", () => {
  assert.deepEqual(pointerDir({ x: 10, y: 40 }, { x: 10, y: 10 }), { x: 0, y: 1 });
});

test("pointerDir: nedåt-vänster → normaliserad diagonal (|dir|≈1)", () => {
  const d = pointerDir({ x: 0, y: 20 }, { x: 20, y: 0 }); // dx=-20, dy=+20
  assert.ok(Math.abs(Math.hypot(d.x, d.y) - 1) < 1e-9, "enhetslängd");
  assert.ok(d.x < 0 && d.y > 0, "vänster + ner");
  assert.ok(Math.abs(d.x + 0.7071067811865475) < 1e-9);
  assert.ok(Math.abs(d.y - 0.7071067811865475) < 1e-9);
});

test("pointerDir: finger i stort sett på avataren (inom dödzon) → {0,0}", () => {
  assert.deepEqual(pointerDir({ x: 12, y: 12 }, { x: 10, y: 10 }), { x: 0, y: 0 });
});

test("pointerDir: alltid enhetslängd oavsett avstånd (full längd, motorn klarar diagonaler)", () => {
  const near = pointerDir({ x: 15, y: 25 }, { x: 0, y: 0 });
  const far = pointerDir({ x: 150, y: 250 }, { x: 0, y: 0 });
  assert.ok(Math.abs(near.x - far.x) < 1e-9 && Math.abs(near.y - far.y) < 1e-9, "riktning oberoende av avstånd");
  assert.ok(Math.abs(Math.hypot(far.x, far.y) - 1) < 1e-9);
});

// --- Del 2: createInput med mock-DOM ----------------------------------------

/** Minimal EventTarget-liknande mock med rect + pointer-capture (input.js behov). */
function makeEl(rect = { left: 0, top: 0, width: 100, height: 100 }) {
  const listeners = {};
  return {
    rect,
    addEventListener(type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    removeEventListener(type, fn) {
      if (listeners[type]) listeners[type] = listeners[type].filter((f) => f !== fn);
    },
    dispatch(type, ev = {}) {
      (listeners[type] || []).slice().forEach((f) => f({ preventDefault() {}, type, ...ev }));
    },
    getBoundingClientRect() {
      return this.rect;
    },
    setPointerCapture() {},
    releasePointerCapture() {},
  };
}

/** Sätt upp input med mockad window (input.js lyssnar pointerup/cancel på window). */
function harness({ getAimOrigin, onInteract } = {}) {
  const win = makeEl();
  const prevWindow = globalThis.window;
  globalThis.window = win;
  const target = makeEl(); // tangentbords-target
  const stage = makeEl();
  const input = createInput({ onInteract, target, pointerTarget: stage, getAimOrigin });
  return {
    input,
    win,
    target,
    stage,
    cleanup() {
      input.destroy();
      if (prevWindow === undefined) delete globalThis.window;
      else globalThis.window = prevWindow;
    },
  };
}

test("håll+dra: dir() går mot fingret (grid-läge via getAimOrigin)", () => {
  const h = harness({ getAimOrigin: () => ({ x: 0, y: 0 }) });
  try {
    h.stage.dispatch("pointerdown", { pointerId: 1, clientX: 0, clientY: 0 });
    // Dra långt åt höger → passerar TAP_SLOP → gång-drag
    h.stage.dispatch("pointermove", { pointerId: 1, clientX: 60, clientY: 0 });
    assert.deepEqual(h.input.dir(), { x: 1, y: 0 });
  } finally {
    h.cleanup();
  }
});

test("scroll-läge (ingen getAimOrigin): riktning relativt spelytans mitt", () => {
  // stage-rect 0,0,100,100 → mitt (50,50); finger rakt ner i mitten → {0,1}
  const h = harness();
  try {
    h.stage.dispatch("pointerdown", { pointerId: 1, clientX: 50, clientY: 50 });
    h.stage.dispatch("pointermove", { pointerId: 1, clientX: 50, clientY: 95 });
    const d = h.input.dir();
    assert.equal(d.x, 0);
    assert.ok(d.y > 0.99, "pekar nedåt");
  } finally {
    h.cleanup();
  }
});

test("setFrozen(true) nollar touch-riktningen (aktiv pekning + frozen ⇒ {0,0})", () => {
  const h = harness({ getAimOrigin: () => ({ x: 0, y: 0 }) });
  try {
    h.stage.dispatch("pointerdown", { pointerId: 1, clientX: 0, clientY: 0 });
    h.stage.dispatch("pointermove", { pointerId: 1, clientX: 60, clientY: 0 });
    assert.deepEqual(h.input.dir(), { x: 1, y: 0 }, "rör sig innan frysning");
    h.input.setFrozen(true);
    assert.deepEqual(h.input.dir(), { x: 0, y: 0 }, "fryst ⇒ stilla");
  } finally {
    h.cleanup();
  }
});

test("pointerup stannar (dir→{0,0})", () => {
  const h = harness({ getAimOrigin: () => ({ x: 0, y: 0 }) });
  try {
    h.stage.dispatch("pointerdown", { pointerId: 1, clientX: 0, clientY: 0 });
    h.stage.dispatch("pointermove", { pointerId: 1, clientX: 60, clientY: 0 });
    assert.deepEqual(h.input.dir(), { x: 1, y: 0 });
    h.win.dispatch("pointerup", { pointerId: 1, clientX: 60, clientY: 0 });
    assert.deepEqual(h.input.dir(), { x: 0, y: 0 });
  } finally {
    h.cleanup();
  }
});

test("pointercancel stannar (dir→{0,0})", () => {
  const h = harness({ getAimOrigin: () => ({ x: 0, y: 0 }) });
  try {
    h.stage.dispatch("pointerdown", { pointerId: 1, clientX: 0, clientY: 0 });
    h.stage.dispatch("pointermove", { pointerId: 1, clientX: 60, clientY: 0 });
    h.win.dispatch("pointercancel", { pointerId: 1, clientX: 60, clientY: 0 });
    assert.deepEqual(h.input.dir(), { x: 0, y: 0 });
  } finally {
    h.cleanup();
  }
});

test("kort TAP (utan nämnvärd rörelse) triggar interagera – och startar ingen gång", () => {
  let interacts = 0;
  const h = harness({ getAimOrigin: () => ({ x: 0, y: 0 }), onInteract: () => interacts++ });
  try {
    h.stage.dispatch("pointerdown", { pointerId: 1, clientX: 10, clientY: 10 });
    // liten skakning under TAP_SLOP (10px)
    h.stage.dispatch("pointermove", { pointerId: 1, clientX: 13, clientY: 12 });
    assert.deepEqual(h.input.dir(), { x: 0, y: 0 }, "ingen gång-drag under tröskeln");
    h.win.dispatch("pointerup", { pointerId: 1, clientX: 13, clientY: 12 });
    assert.equal(interacts, 1, "tapp = interagera");
  } finally {
    h.cleanup();
  }
});

test("en gång-drag (över tröskeln) räknas INTE som tapp vid släpp", () => {
  let interacts = 0;
  const h = harness({ getAimOrigin: () => ({ x: 0, y: 0 }), onInteract: () => interacts++ });
  try {
    h.stage.dispatch("pointerdown", { pointerId: 1, clientX: 0, clientY: 0 });
    h.stage.dispatch("pointermove", { pointerId: 1, clientX: 60, clientY: 0 });
    h.win.dispatch("pointerup", { pointerId: 1, clientX: 60, clientY: 0 });
    assert.equal(interacts, 0, "drag ska inte interagera");
  } finally {
    h.cleanup();
  }
});

test("tapp när fryst triggar INTE interagera", () => {
  let interacts = 0;
  const h = harness({ getAimOrigin: () => ({ x: 0, y: 0 }), onInteract: () => interacts++ });
  try {
    h.input.setFrozen(true);
    h.stage.dispatch("pointerdown", { pointerId: 1, clientX: 10, clientY: 10 });
    h.win.dispatch("pointerup", { pointerId: 1, clientX: 11, clientY: 10 });
    assert.equal(interacts, 0);
  } finally {
    h.cleanup();
  }
});

test("desktop oförändrat: piltangenter ger riktning, E interagerar, frozen nollar", () => {
  let interacts = 0;
  const h = harness({ onInteract: () => interacts++ });
  try {
    h.target.dispatch("keydown", { key: "ArrowRight" });
    assert.deepEqual(h.input.dir(), { x: 1, y: 0 });
    h.target.dispatch("keydown", { key: "ArrowUp" });
    assert.deepEqual(h.input.dir(), { x: 1, y: -1 });
    h.target.dispatch("keyup", { key: "ArrowUp" });
    h.target.dispatch("keyup", { key: "ArrowRight" });
    assert.deepEqual(h.input.dir(), { x: 0, y: 0 });
    h.target.dispatch("keydown", { key: "e" });
    assert.equal(interacts, 1);
    // frozen: håll höger men frusen ⇒ stilla + ingen interaktion
    h.target.dispatch("keydown", { key: "ArrowRight" });
    h.input.setFrozen(true);
    assert.deepEqual(h.input.dir(), { x: 0, y: 0 });
    h.target.dispatch("keydown", { key: "Enter" });
    assert.equal(interacts, 1, "interagera avstängd när fryst");
  } finally {
    h.cleanup();
  }
});
