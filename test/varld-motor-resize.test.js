// ============================================================================
// Motorns resize-klassning (#396, F8 #434).
//   • Nivåns egen stage-höjd (mobil: data-niva="rum" 580 → 452 px) med samma
//     viewport + dpr = "niva": ytan byter storlek, inget avbryts, inga
//     pyramider kastas. En spelande rörelse mätt i annan storlek LANDAR redan
//     i data-niva-mutationen (före paint), inte först i ResizeObserver.
//   • Äkta resize (viewport/dpr ändrad: rotation, fönster) = "akta" som idag.
// Fejkade ResizeObserver/MutationObserver: callbacken anropas för hand.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

const observatorer = { ro: [], mo: [] };
globalThis.ResizeObserver = class { constructor(cb) { this.cb = cb; observatorer.ro.push(this); } observe() {} disconnect() { this.av = true; } };
globalThis.MutationObserver = class { constructor(cb) { this.cb = cb; observatorer.mo.push(this); } observe() {} disconnect() { this.av = true; } };

const { klassa, mattAv, nyckelAv, skapaResizeVakt, NIVA_FONSTER_MS } = await import("../src/varld-motor-resize.js");

const m = (h, { w = 350, vw = 390, vh = 700, dpr = 1, niva = "hus" } = {}) => ({ w, h, dpr, vw, vh, niva });

test("klassa: nivåbyte med samma viewport/dpr = niva", () => {
  assert.equal(klassa(m(580, { niva: "hus" }), m(452, { niva: "rum" })), "niva");
  assert.equal(klassa(m(452, { niva: "rum" }), m(580, { niva: "hus" })), "niva");
});

test("klassa: viewport eller dpr ändrad = akta (rotation, fönster, zoom)", () => {
  assert.equal(klassa(m(580), m(580, { vw: 700, vh: 390 })), "akta");
  assert.equal(klassa(m(580), m(500, { vh: 620 })), "akta");
  assert.equal(klassa(m(580, { niva: "hus" }), m(452, { niva: "rum", vw: 360, vh: 640 })), "akta");
  assert.equal(klassa(m(580), m(580, { dpr: 2 })), "akta");
});

test("klassa: ingen förra mätning (ny scen) = akta", () => {
  assert.equal(klassa(null, m(580)), "akta");
});

test("klassa: samma nivå räknas bara inom NIVA_FONSTER_MS efter ett data-niva-byte", () => {
  const fore = m(452, { niva: "rum" });
  assert.equal(klassa(fore, m(440, { niva: "rum" }), 1000, 1000 + NIVA_FONSTER_MS - 1), "niva");
  assert.equal(klassa(fore, m(440, { niva: "rum" }), 1000, 1000 + NIVA_FONSTER_MS + 1), "akta");
  assert.equal(klassa(fore, m(440, { niva: "rum" })), "akta");
});

test("mattAv/nyckelAv: dpr kapas till 2, samma nyckelformat som ytan", () => {
  const stage = { clientWidth: 350, clientHeight: 452, dataset: { niva: "rum" } };
  const mm = mattAv(stage, { devicePixelRatio: 3, innerWidth: 390, innerHeight: 700 });
  assert.deepEqual(mm, { w: 350, h: 452, dpr: 2, vw: 390, vh: 700, niva: "rum" });
  assert.equal(nyckelAv(mm), "350x452@2");
});

/** Stage + vakt med inspelade anrop. */
function rigg() {
  const fonster = { devicePixelRatio: 1, innerWidth: 390, innerHeight: 700 };
  globalThis.window = fonster;
  const stage = { clientWidth: 350, clientHeight: 580, dataset: { niva: "hus" } };
  const anrop = [];
  let spel = null;
  const R = skapaResizeVakt({
    stage: () => stage, yta: () => ({}), spel: () => spel,
    landa: (n) => { anrop.push(["landa", n]); return spel && spel.matt !== n ? "landad" : "samma"; },
    resize: (mm, akta) => anrop.push(["resize", nyckelAv(mm), akta]),
    schemaForvarm: () => anrop.push(["forvarm"]),
  });
  observatorer.ro.length = observatorer.mo.length = 0;
  R.koppla(stage);
  R.skapad(R.matt());
  const [ro] = observatorer.ro, [mo] = observatorer.mo;
  return { R, stage, fonster, anrop, ro, mo, satSpel: (s) => { spel = s; } };
}

test("T3 in → rum: landar i data-niva-mutationen, ResizeObserver = niva utan rensaAllt", () => {
  const { R, stage, anrop, ro, mo, satSpel } = rigg();
  satSpel({ fas: "spelar", matt: "350x580@1" });
  stage.dataset.niva = "rum";
  stage.clientHeight = 452;
  mo.cb([]); // updateUi satte data-niva (mikrotask, före paint)
  assert.deepEqual(anrop, [["forvarm"], ["landa", "350x452@1"]]);
  ro.cb([]);
  assert.deepEqual(anrop.slice(2), [["landa", "350x452@1"], ["resize", "350x452@1", false]]);
  const [post] = R.logg;
  assert.equal(post.typ, "niva");
  assert.equal(post.rensaAllt, false);
  assert.equal(post.spel, "landad");
  assert.equal(post.fran, "350x580@1");
  assert.equal(post.niva, "rum");
});

test("nivåbyte utan storleksbyte (hus → by): bara förvärmning", () => {
  const { R, stage, anrop, ro, mo, satSpel } = rigg();
  satSpel({ fas: "spelar", matt: "350x580@1" });
  stage.dataset.niva = "by";
  mo.cb([]);
  ro.cb([]);
  assert.deepEqual(anrop, [["forvarm"]]);
  assert.equal(R.logg.length, 0);
});

test("ingen rörelse: nivåns resize ger bara ytan ny storlek (pyramiderna kvar)", () => {
  const { stage, anrop, ro, mo } = rigg();
  stage.dataset.niva = "rum";
  stage.clientHeight = 452;
  mo.cb([]);
  ro.cb([]);
  assert.deepEqual(anrop, [["forvarm"], ["resize", "350x452@1", false]]);
});

test("äkta resize (rotation) mitt i en rörelse: akta → avbryt + rensaAllt (ctx.resize akta=true), ingen landning", () => {
  const { R, stage, fonster, anrop, ro, satSpel } = rigg();
  satSpel({ fas: "spelar", matt: "350x580@1" });
  fonster.innerWidth = 700;
  fonster.innerHeight = 390;
  stage.clientWidth = 660;
  stage.clientHeight = 380;
  ro.cb([]);
  assert.deepEqual(anrop, [["resize", "660x380@1", true]]);
  assert.equal(R.logg[0].rensaAllt, true);
  assert.equal(R.logg[0].typ, "akta");
});

test("fönstret ändras samtidigt som nivån: akta (som idag)", () => {
  const { stage, fonster, anrop, ro, mo, satSpel } = rigg();
  satSpel({ fas: "spelar", matt: "350x580@1" });
  stage.dataset.niva = "rum";
  fonster.innerHeight = 640;
  stage.clientHeight = 420;
  mo.cb([]);
  ro.cb([]);
  assert.deepEqual(anrop, [["forvarm"], ["resize", "350x420@1", true]]);
});

test("ny scen (koppla igen): första mätningen räknas som äkta", () => {
  const { R, stage, anrop, ro } = rigg();
  R.koppla(stage);
  assert.equal(ro.av, true);
  const ro2 = observatorer.ro.at(-1);
  stage.clientHeight = 500;
  ro2.cb([]);
  assert.deepEqual(anrop, [["resize", "350x500@1", true]]);
});
