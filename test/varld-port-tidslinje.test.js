// Tidslinje-matten för port → hem (#424, S6 i epic #396): ren matte, ingen DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { tidslinjeState, sparVarde, mul, skalaKring } from "../src/varld-render-tidslinje.js";
import { lagerSyns, cubicBezier } from "../src/varld-render-anim.js";
import { PORT_TIDER, portTidslinje, synligTill } from "../src/varld-port-anim.js";

const nara = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const punkt = (m, x, y) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });

test("sparVarde: CSS-semantik (fran under delay, bezier, sedan till)", () => {
  const s = { typ: "skala", fran: 1, till: 6.5, delay: 260, ms: 900, ease: [0.55, 0, 0.2, 1] };
  assert.equal(sparVarde(s, 0), 1);
  assert.equal(sparVarde(s, 260), 1);
  assert.equal(sparVarde(s, 1160), 6.5);
  assert.equal(sparVarde(s, 5000), 6.5);
  nara(sparVarde(s, 260 + 450), 1 + 5.5 * cubicBezier(0.55, 0, 0.2, 1)(0.5));
});

test("mul/skalaKring: skalning kring en punkt lämnar punkten fast", () => {
  const m = skalaKring(6.5, 6.5, { x: 480, y: 428 });
  const p = punkt(m, 480, 428);
  nara(p.x, 480); nara(p.y, 428);
  const q = punkt(mul(skalaKring(2, 2), [1, 0, 0, 1, 10, 0]), 0, 0); // först flytta, sedan skala
  nara(q.x, 20);
});

test("tidslinjeState: yttre · bas · inre, alpha och zFran", () => {
  const lager = [
    { id: "niva@3", zFran: 3, yttre: [{ typ: "skala", origo: { x: 100, y: 100 }, fran: 1, till: 4, ms: 100 }] },
    { id: "halva", bas: [2, 0, 0, 2, 0, 0], inre: [{ typ: "skalaX", origo: { x: 10, y: 0 }, fran: 1, till: 0.5, ms: 100 }],
      yttre: [{ typ: "alpha", fran: 1, till: 0, delay: 50, ms: 50 }], alpha: 0.8 },
  ];
  const t0 = tidslinjeState(lager, 0);
  assert.equal(lagerSyns(t0[0]), false, "nivå 3 syns inte i skala 1");
  assert.equal(t0[1].opacity, 0.8);
  const t1 = tidslinjeState(lager, 100);
  assert.equal(t1[0].scale, 4);
  assert.equal(lagerSyns(t1[0]), true);
  // Halvan: lokalt (10,y) är gångjärnet → står still; (20,0) → 15 lokalt → 30 i ytan.
  nara(punkt(t1[1].matris, 10, 0).x, 20);
  nara(punkt(t1[1].matris, 20, 0).x, 30);
  assert.equal(t1[1].opacity, 0);
});

test("synligTill: största zoom där en ruta fortfarande syns", () => {
  const vy = { x: 0, y: 0, w: 1000, h: 600 };
  const o = { x: 500, y: 400 };
  assert.equal(synligTill({ x: 450, y: 350, w: 100, h: 100 }, o, vy, 6.5), 6.5); // innehåller origo
  // Ruta ovanför: underkant y=200. Synlig överkant vid z: 400 - 400/z < 200 ⇔ z < 2.
  nara(synligTill({ x: 0, y: 0, w: 1000, h: 200 }, o, vy, 6.5), 2);
  assert.equal(synligTill({ x: 0, y: 0, w: 10, h: 10 }, o, vy, 6.5) >= 1, true);
});

test("portTidslinje: exakt dagens CSS-tider", () => {
  const T = PORT_TIDER;
  assert.equal(T.oppnaMs, 500);
  assert.deepEqual(T.oppnaEase, [0.6, 0.05, 0.55, 0.4]);
  assert.equal(T.zoomStartMs + T.zoomMs, 1160);
  assert.equal(T.zoomStartMs + T.fadeDelayMs + T.fadeMs, 1260); // < städningen 1410
  const origo = { x: 683, y: 512 };
  const tl = portTidslinje({
    origo,
    nivaer: [{ id: "bak@1", z: 1 }, { id: "bak@2.25", z: 2.25 }],
    sprites: [{ id: "moln", bas: [1, 0, 0, 1, 5, 5], alpha: 0.9 }, { id: "halva-v", bas: [1.2, 0, 0, 1.2, 0, 0], gangjarn: { x: 230, y: 440 } }],
  });
  assert.deepEqual(tl.map((l) => l.id), ["bak@1", "bak@2.25", "moln", "halva-v"]);
  const vid = (t) => Object.fromEntries(tidslinjeState(tl, t).map((l) => [l.id, l]));
  // t=0: vila (identitet för nivå 1, bas för sprites).
  assert.deepEqual(vid(0)["bak@1"].matris, [1, 0, 0, 1, 0, 0]);
  // t=260: halvorna halvvägs i sin egen bezier, zoomen har inte börjat.
  const h = vid(260)["halva-v"].matris;
  nara(h[0], 1.2 * (1 + (0.07 - 1) * cubicBezier(0.6, 0.05, 0.55, 0.4)(260 / 500)));
  assert.equal(vid(260)["bak@1"].scale, 1);
  // t=500: halvorna öppna (0.07), gångjärnet står still i ytans px.
  nara(vid(500)["halva-v"].matris[0] / vid(500)["bak@1"].scale, 1.2 * 0.07);
  // Slutet: zoom 6.5 kring origo, origo står still.
  const slut = vid(1160)["bak@1"];
  assert.equal(slut.scale, 6.5);
  nara(punkt(slut.matris, origo.x, origo.y).x, origo.x);
  assert.equal(lagerSyns(vid(0)["bak@2.25"]), false);
  assert.equal(lagerSyns(vid(1160)["bak@2.25"]), true);
});
