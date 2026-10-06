// ============================================================================
// Rollnyckeln och lagrets geometri över scroll (#396, F7 #433).
//   • Dokumentets scroll: allt mäts i viewport-px i samma ögonblick → samma
//     box, samma nyckel.
//   • Stagets EGEN scroll (overflow:hidden är ändå en scroll-container): lagren
//     och canvasen flyttas med −scroll. stageRam() nollar den före mätningen →
//     samma nyckel som oscrollat. Rå getBoundingClientRect gav en ny nyckel
//     (felet: vy.y förskjuten med scrollTop, canvasen ritade dubbelt fel).
//   • Utan spelbar Pixi (pp:pixi:av, CSS-vägen) rör scroll-vakten ingenting.
// Fejkad 2D-geometri: minimal DOMMatrix/DOMPoint + getComputedStyle.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

class DOMPoint {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
}
class DOMMatrix {
  constructor(v = [1, 0, 0, 1, 0, 0]) { [this.a, this.b, this.c, this.d, this.e, this.f] = v; }
  multiply(o) {
    return new DOMMatrix([
      this.a * o.a + this.c * o.b, this.b * o.a + this.d * o.b,
      this.a * o.c + this.c * o.d, this.b * o.c + this.d * o.d,
      this.a * o.e + this.c * o.f + this.e, this.b * o.e + this.d * o.f + this.f,
    ]);
  }
  transformPoint(p) { return new DOMPoint(this.a * p.x + this.c * p.y + this.e, this.b * p.x + this.d * p.y + this.f); }
}
globalThis.DOMMatrix = DOMMatrix;
globalThis.DOMPoint = DOMPoint;
globalThis.window ??= {};
globalThis.getComputedStyle = (el) => el.cs;

const TX = await import("../src/varld-motor-textur.js");
const { skapaForvarmare } = await import("../src/varld-motor-mal.js");

/**
 * Stage i dokumentet (top = stageTop − dokumentets scroll) med ett lager
 * (box x/y/w/h i stage-px, kamerans scale s kring origo ox/oy). Lagrets ruta
 * följer stagets egen scroll, precis som i webbläsaren.
 */
function scen({ stageTop = 72, w = 1366, h = 600, box = { x: 20, y: 75, w: 1326, h: 450 }, s = 1, origo = [600, 230] } = {}) {
  const dok = { scrollY: 0 };
  const stage = {
    nodeType: 1, parentElement: null, scrollTop: 0, scrollLeft: 0,
    cs: { transform: "none", rotate: "none", scale: "none" },
    getBoundingClientRect: () => ({ left: 0, top: stageTop - dok.scrollY, width: w, height: h, right: w, bottom: stageTop - dok.scrollY + h }),
  };
  const [ox, oy] = origo;
  const lager = {
    id: "ute-lager", nodeType: 1, parentElement: stage,
    cs: { transform: s === 1 ? "none" : `matrix(${s}, 0, 0, ${s}, 0, 0)`, rotate: "none", scale: "none", transformOrigin: `${ox}px ${oy}px` },
    getBoundingClientRect() {
      const sr = stage.getBoundingClientRect();
      const left = sr.left + box.x - stage.scrollLeft + ox - ox * s;
      const top = sr.top + box.y - stage.scrollTop + oy - oy * s;
      return { left, top, width: box.w * s, height: box.h * s, right: left + box.w * s, bottom: top + box.h * s };
    },
  };
  return { stage, lager, dok };
}

const nyckel = (lager, sr, fokus = { x: 48.5, y: 52 }) => TX.roll(lager, TX.lagerGeo(lager, sr), fokus, 1, 6, sr).nyckel;

test("dokumentets scroll: samma box och samma nyckel (allt i viewport-px samtidigt)", () => {
  for (const s of [1, 6]) {
    const { stage, lager, dok } = scen({ s });
    const fore = nyckel(lager, TX.stageRam(stage));
    dok.scrollY = 64;
    assert.equal(nyckel(lager, TX.stageRam(stage)), fore, `scale ${s}`);
    const { box } = TX.lagerGeo(lager, TX.stageRam(stage));
    assert.deepEqual([box.x, box.y, box.w, box.h].map((v) => +v.toFixed(3)), [20, 75, 1326, 450]);
  }
});

test("stagets egen scroll: stageRam nollar den → nyckeln identisk med oscrollat", () => {
  const { stage, lager } = scen();
  const fore = nyckel(lager, TX.stageRam(stage));
  assert.match(fore, /\|-20\.0,-75\.0,1366\.0x600\.0\|/);
  stage.scrollTop = 64;
  // Rotorsaken: rå stage-ruta → boxen förskjuten med scrollTop (vy.y −75 → −11).
  assert.match(nyckel(lager, stage.getBoundingClientRect()), /\|-20\.0,-11\.0,1366\.0x600\.0\|/);
  assert.equal(nyckel(lager, TX.stageRam(stage)), fore);
  assert.equal(stage.scrollTop, 0);
});

test("nollaScroll: bara när staget faktiskt står scrollat", () => {
  const { stage } = scen();
  assert.equal(TX.nollaScroll(stage), false);
  assert.equal(TX.nollaScroll(null), false);
  stage.scrollLeft = 10;
  assert.equal(TX.nollaScroll(stage), true);
  assert.equal(stage.scrollLeft, 0);
});

test("scroll-vakten: utan spelbar Pixi (pp:pixi:av / CSS-vägen) rörs stagets scroll inte", () => {
  const lyssnare = {};
  const stage = { scrollTop: 64, scrollLeft: 0, addEventListener: (typ, fn) => { lyssnare[typ] = fn; } };
  const F = skapaForvarmare({ stage: () => stage, yta: () => null, kameror: new Set(), ledig: () => false, logga() {} });
  F.koppla(stage);
  assert.equal(typeof lyssnare.scroll, "function", "vakten lyssnar på stagets scroll");
  lyssnare.scroll();
  assert.equal(stage.scrollTop, 64, "ingen Worker i node → pixiMojlig() false → dagens beteende");
  F.slappa();
});
