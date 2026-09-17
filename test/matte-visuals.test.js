// ============================================================================
// Enhetstest för de visuella renderarna (issue #321, src/matte-visuals.js)
// ----------------------------------------------------------------------------
// Verifierar för varje ämne att renderaren bygger RÄTT STRUKTUR ur problem-
// objektets presentationsfält, mot en minimal fejk-DOM (ingen jsdom i projektet):
//   • klocka=urtavla        → tavla+centrum (2 circle), 60 minutmarkeringar +
//     2 visare (62 line), 12 siffror; data-hours/data-minutes stämmer.
//   • sannolikhet=kulpåse   → `total` kulor (circle), `red` röda; word→null.
//   • statistik=stapeldiagram → en stapel (rect) per item; data-bars stämmer.
//   • koordinatsystem=rutnät → en punkt (circle) per points-element.
// Plus: dispatcher-val (renderTopicVisual), determinism (sträng-vägen), null för
// fel/otillräcklig data, och BOOT-SÄKERHET (matte-svg/visuals/bildstod/generator
// ligger UTANFÖR den statiska bootgrafen från app.js).
//
// Körs med Node:s inbyggda testkörare:  node --test test/matte-visuals.test.js
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  renderKlocka,
  renderKulpase,
  renderStapeldiagram,
  renderKoordinatsystem,
  renderTopicVisual,
} from "../src/matte-visuals.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "../src");

// --- Minimal fejk-DOM (element + textnoder) ---------------------------------
class FakeEl {
  constructor(tag) { this.tagName = tag; this.childNodes = []; this._attrs = {}; }
  setAttribute(k, v) { this._attrs[k] = String(v); }
  getAttribute(k) { return this._attrs[k]; }
  appendChild(c) { this.childNodes.push(c); return c; }
}
class FakeText {
  constructor(t) { this.tagName = "#text"; this.textContent = String(t); this.childNodes = []; }
}
const fakeDoc = {
  createElementNS: (_ns, tag) => new FakeEl(tag),
  createTextNode: (t) => new FakeText(t),
};

function walk(node, fn) { fn(node); for (const c of node.childNodes || []) walk(c, fn); }
function countTag(node, tag) { let n = 0; walk(node, (x) => { if (x.tagName === tag) n++; }); return n; }
function countClass(node, cls) {
  let n = 0;
  walk(node, (x) => {
    const c = x._attrs && x._attrs.class;
    if (c && c.split(/\s+/).includes(cls)) n++;
  });
  return n;
}

// --- Klocka -----------------------------------------------------------------
test("renderKlocka: tavla+visare+siffror, data-hours/-minutes stämmer", () => {
  const svg = renderKlocka({ type: "klocka", hours: 3, minutes: 15, questionType: "read" }, { document: fakeDoc });
  assert.ok(svg);
  assert.equal(svg.tagName, "svg");
  assert.equal(svg.getAttribute("data-hours"), "3");
  assert.equal(svg.getAttribute("data-minutes"), "15");
  assert.equal(countTag(svg, "circle"), 2);          // tavla + centrum
  assert.equal(countTag(svg, "line"), 62);           // 60 markeringar + 2 visare
  assert.equal(countClass(svg, "clock-num"), 12);    // siffror 1–12
  assert.equal(countClass(svg, "clock-hand-hour"), 1);
  assert.equal(countClass(svg, "clock-hand-min"), 1);
});

test("renderKlocka: 12 visas som 12, midnatt-normalisering", () => {
  const svg = renderKlocka({ type: "klocka", hours: 12, minutes: 0 }, { document: fakeDoc });
  assert.equal(svg.getAttribute("data-hours"), "12");
  assert.equal(svg.getAttribute("data-minutes"), "0");
});

test("renderKlocka: fel type → null", () => {
  assert.equal(renderKlocka({ type: "statistik" }, { document: fakeDoc }), null);
  assert.equal(renderKlocka(null), null);
});

// --- Kulpåse (sannolikhet) --------------------------------------------------
test("renderKulpase (frac): total kulor, red röda, data-attribut", () => {
  const svg = renderKulpase({ type: "sannolikhet", questionType: "frac", red: 4, blue: 2, total: 6 }, { document: fakeDoc });
  assert.ok(svg);
  assert.equal(countTag(svg, "circle"), 6);
  assert.equal(countClass(svg, "kul-rod"), 4);
  assert.equal(countClass(svg, "kul-bla"), 2);
  assert.equal(svg.getAttribute("data-total"), "6");
  assert.equal(svg.getAttribute("data-red"), "4");
});

test("renderKulpase (compare): två påsar, alla kulor ritas", () => {
  const svg = renderKulpase({
    type: "sannolikhet", questionType: "compare",
    a: { red: 3, total: 10 }, b: { red: 7, total: 10 },
  }, { document: fakeDoc });
  assert.ok(svg);
  assert.equal(countTag(svg, "circle"), 20);
  assert.equal(countTag(svg, "g"), 2); // en grupp per påse
});

test("renderKulpase: word/utan kuldata → null", () => {
  assert.equal(renderKulpase({ type: "sannolikhet", questionType: "word" }, { document: fakeDoc }), null);
  assert.equal(renderKulpase({ type: "klocka" }), null);
});

// --- Stapeldiagram (statistik) ----------------------------------------------
test("renderStapeldiagram: en stapel per item + värde/etikett-text", () => {
  const items = [{ label: "A", value: 5 }, { label: "B", value: 8 }, { label: "C", value: 3 }];
  const svg = renderStapeldiagram({ type: "statistik", items }, { document: fakeDoc });
  assert.ok(svg);
  assert.equal(countClass(svg, "chart-bar"), 3);
  assert.equal(svg.getAttribute("data-bars"), "3");
  assert.equal(countTag(svg, "rect"), 3);            // bara staplar (axel = line)
  assert.equal(countTag(svg, "text"), 6);            // värde + etikett per stapel
});

test("renderStapeldiagram: tomma items → null", () => {
  assert.equal(renderStapeldiagram({ type: "statistik", items: [] }, { document: fakeDoc }), null);
  assert.equal(renderStapeldiagram({ type: "statistik" }), null);
});

// --- Koordinatsystem --------------------------------------------------------
test("renderKoordinatsystem: en punkt per points-element + rutnät/axlar", () => {
  const points = [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 0, y: 5 }];
  const svg = renderKoordinatsystem({ type: "koordinatsystem", points, targetIdx: 1, range: 8, allQuadrants: false }, { document: fakeDoc });
  assert.ok(svg);
  assert.equal(countClass(svg, "coord-pt"), 3);
  assert.equal(svg.getAttribute("data-points"), "3");
  assert.equal(countClass(svg, "axis-x"), 1);
  assert.equal(countClass(svg, "axis-y"), 1);
  assert.ok(countClass(svg, "grid-line") > 0);
});

test("renderKoordinatsystem: inga punkter → null", () => {
  assert.equal(renderKoordinatsystem({ type: "koordinatsystem", points: [] }, { document: fakeDoc }), null);
});

// --- Dispatcher -------------------------------------------------------------
test("renderTopicVisual väljer rätt renderare och delegerar mult/div till bildstod", () => {
  assert.ok(renderTopicVisual({ type: "klocka", hours: 1, minutes: 0 }, { document: fakeDoc }));
  assert.ok(renderTopicVisual({ type: "statistik", items: [{ label: "A", value: 1 }] }, { document: fakeDoc }));
  // multiplikation → array-bildstöd (matte-bildstod.js): rows×cols prickar.
  const mult = renderTopicVisual({ type: "multiplikation", rows: 2, cols: 3, a: 2, b: 3, answer: 6 }, { document: fakeDoc });
  assert.ok(mult);
  assert.equal(countTag(mult, "circle"), 6);
  // okänt/icke-visuellt topic → null.
  assert.equal(renderTopicVisual({ type: "addition" }), null);
  assert.equal(renderTopicVisual(null), null);
});

// --- Determinism (sträng-vägen) ---------------------------------------------
test("deterministisk markup: samma problem → identisk sträng", () => {
  const p = { type: "koordinatsystem", points: [{ x: 2, y: 3 }], targetIdx: 0, range: 5, allQuadrants: true };
  assert.equal(renderKoordinatsystem(p), renderKoordinatsystem(p));
  const k = { type: "klocka", hours: 7, minutes: 45 };
  const s = renderKlocka(k);
  assert.equal(typeof s, "string");
  assert.ok(s.startsWith("<svg"));
});

// --- Boot-säkerhet: matte-* utanför statiska bootgrafen från app.js ----------
test("matte-svg/visuals/bildstod/generator ligger UTANFÖR statiska bootgrafen från app.js", () => {
  const staticImportRe = /^\s*import\s+(?:[^'";]*?\s+from\s+)?["']([^"']+)["']/gm;
  const seen = new Set();
  const queue = ["app.js"];
  while (queue.length) {
    const rel = queue.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    let code;
    try { code = readFileSync(resolve(SRC, rel), "utf8"); }
    catch { continue; }
    let m;
    while ((m = staticImportRe.exec(code))) {
      const spec = m[1];
      if (!spec.startsWith(".")) continue;
      const target = resolve(dirname(resolve(SRC, rel)), spec);
      queue.push(target.slice(SRC.length + 1));
    }
  }
  for (const f of ["matte-svg.js", "matte-visuals.js", "matte-bildstod.js", "matte-generator.js"]) {
    assert.ok(!seen.has(f), `${f} får inte vara statiskt nåbar från src/app.js`);
  }
});
