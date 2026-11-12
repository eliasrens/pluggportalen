// Kurragömma B (#837, spec §13.4): "2D-reserven startar när WebGL saknas" – hela
// kg-scen.js körs mot en mini-DOM där canvas.getContext("webgl") ger null.
// Scenen ska då bli typ "2d", ha samma API, stega figuren med tangenter
// (fokusregeln), räkna skyddet ur motorn och aldrig röra src/vendor/three/.
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { ON } from "../src/live/formats/kurragomma/delat/kg-karta.js";
import { skydd } from "../src/live/formats/kurragomma/delat/kg-geometri.js";

/** Ett element i mini-DOM:en: bara det scenen rör. */
function element(tag) {
  const klasser = new Set();
  const lyss = {};
  const el = {
    tagName: tag.toUpperCase(), children: [], style: {}, hidden: false, textContent: "", innerHTML: "",
    width: 300, height: 150, clientWidth: 1366, clientHeight: 768, isContentEditable: false, parent: null,
    classList: {
      add: (...c) => c.forEach((x) => klasser.add(x)), remove: (...c) => c.forEach((x) => klasser.delete(x)),
      toggle: (c, v) => { (v === undefined ? !klasser.has(c) : v) ? klasser.add(c) : klasser.delete(c); }, contains: (c) => klasser.has(c),
    },
    appendChild(c) { el.children.push(c); c.parent = el; return c; },
    append(...cs) { cs.forEach((c) => el.appendChild(c)); },
    remove() { if (el.parent) el.parent.children = el.parent.children.filter((c) => c !== el); },
    contains: (c) => el.children.includes(c),
    setAttribute() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1366, height: 768 }),
    addEventListener: (t, fn) => { (lyss[t] = lyss[t] || []).push(fn); }, removeEventListener() {},
    dispatch: (t, e) => (lyss[t] || []).forEach((fn) => fn(e)),
    get firstElementChild() { return el.children[0] || element("div"); },
    getContext(typ) {
      if (typ !== "2d") return null; // ingen WebGL
      return new Proxy({ measureText: () => ({ width: 40 }), getImageData: () => ({ data: new Uint8Array(4) }) },
        { get: (o, k) => (k in o ? o[k] : () => {}), set: () => true });
    },
  };
  return el;
}

const fonster = {};
before(() => {
  const win = {
    addEventListener: (t, fn) => { (fonster[t] = fonster[t] || []).push(fn); }, removeEventListener() {},
    matchMedia: () => ({ matches: false }), devicePixelRatio: 1, localStorage: null,
  };
  globalThis.window = win;
  globalThis.document = {
    hidden: false, activeElement: null, styleSheets: [],
    createElement: (tag) => element(tag), addEventListener() {}, removeEventListener() {},
  };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  globalThis.Image = class { set src(_) { /* laddas aldrig i testet */ } };
  globalThis.KeyboardEvent = class { constructor(t, o) { Object.assign(this, o); } preventDefault() {} };
});
after(() => { delete globalThis.window; delete globalThis.document; delete globalThis.requestAnimationFrame; });

describe("2D-reserven startar när WebGL saknas (kg-scen.js mot mini-DOM)", () => {
  it("typ = 2d, samma API, figuren går med W och tangenterna lyder fokusregeln", async () => {
    const { skapaKgScen } = await import("../src/live/formats/kurragomma/scen/kg-scen.js");
    const yta = element("div");
    const roster = { info: () => ({ avatarId: "fox", avatarItems: ["keps"] }), onChange: () => () => {} };
    const scen = await skapaKgScen({ yta, roster, lage: "elev-gom", storage: null, auto: false });
    assert.equal(scen.typ, "2d");
    assert.ok(yta.classList.contains("kg-scen"));
    assert.ok(yta.children.some((c) => c.tagName === "CANVAS"), "en 2D-canvas i ytan");
    for (const k of ["lage", "jag", "skydd", "sokare", "sokareBort", "vissling", "hopp", "hittad", "gomstallen", "hjartslag", "namnPa", "niva", "nivaInfo", "on", "paus", "destroy"]) {
      assert.equal(typeof scen[k], "function", k);
    }
    // Kör några bildrutor för hand: W nedtryckt → figuren går framåt (sin yaw, cos yaw).
    let bildruta = null;
    globalThis.requestAnimationFrame = (fn) => { bildruta = fn; return 1; };
    scen.paus(true); scen.paus(false);
    assert.ok(bildruta, "loopen begär en bildruta");
    scen.jag({ x: 0, z: 0, yaw: 0 });
    const skyddsHandelser = [];
    scen.on("skydd", (s) => skyddsHandelser.push(s));
    const keydown = (key) => fonster.keydown.forEach((fn) => fn(new KeyboardEvent("keydown", { key })));
    keydown("w");
    let t = 1000;
    for (let i = 0; i < 10; i++) { bildruta(t); t += 50; }
    const p = scen.jag();
    assert.ok(p.z > 1 && Math.abs(p.x) < 1e-9, `gick framåt: ${JSON.stringify(p)}`);
    assert.equal(scen.skydd(), skydd(p.x, p.z, ON), "mätaren ur motorn");
    assert.ok(skyddsHandelser.length >= 1);
    // Fokusregeln: ett fält har fokus → tangenterna rör inte figuren.
    fonster.keyup.forEach((fn) => fn(new KeyboardEvent("keyup", { key: "w" })));
    document.activeElement = { tagName: "INPUT" };
    keydown("w");
    const fore = scen.jag();
    for (let i = 0; i < 5; i++) { bildruta(t); t += 50; }
    assert.deepEqual(scen.jag(), fore, "figuren står still när ett formulärfält har fokus");
    document.activeElement = null;
    // Sökare, vissling, hittad, gömställen och projektorn kastar inte i 2D.
    scen.sokare([{ uid: "e1", x: 3, z: 3, yaw: 0, t: t, namn: "Alma" }]);
    scen.lage("elev-sokare"); scen.vissling({ x: 2, z: 2 }); scen.hittad({ x: 1, z: 1 });
    scen.lage("projektor"); scen.gomstallen([{ uid: "e2", x: 5, z: 5 }]);
    for (let i = 0; i < 3; i++) { bildruta(t); t += 50; }
    assert.equal(scen.nivaInfo().typ, "2d");
    assert.equal(scen.nivaInfo().ritanrop, 1);
    scen.destroy();
    assert.ok(!yta.classList.contains("kg-scen"));
  });
});
