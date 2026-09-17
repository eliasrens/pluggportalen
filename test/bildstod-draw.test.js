// ============================================================================
// Enhetstest för rit-lagret ovanpå bildstödet (issue #325, bildstod-draw.js)
//   • wrapDrawable bygger wrapper med SVG:n som BAKGRUND och en transparent
//     canvas OVANPÅ (staplingsordning = barn-ordning) i samma box → strecken i
//     linje med bilden.
//   • attachDrawLayer kopplar den INJICERADE rit-motorn (attachScratchpad) på
//     canvasen och returnerar dess pad; destroy river paddet.
//
// Modulen är import-fri (som scratch-enlarge.js/matte-svg.js) just för att kunna
// köras mot en minimal fejk-DOM (ingen jsdom i projektet):  node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");

// --- Minimal fejk-DOM -------------------------------------------------------
class FakeEl {
  constructor(tag = "div") {
    this.tag = tag;
    this.children = [];
    this.parentNode = null;
    this._attrs = {};
    this.className = "";
  }
  setAttribute(k, v) { this._attrs[k] = String(v); }
  getAttribute(k) { return this._attrs[k]; }
  appendChild(child) {
    if (child.parentNode) {
      const i = child.parentNode.children.indexOf(child);
      if (i >= 0) child.parentNode.children.splice(i, 1);
    }
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
}

const fakeDoc = { createElement: (t) => new FakeEl(t) };

const { wrapDrawable, attachDrawLayer } = await import("../src/bildstod-draw.js");

// En låtsas-SVG (motsvarar renderBildstod/renderTopicVisual mot opts.document).
function fakeSvg() {
  const svg = new FakeEl("svg");
  svg.setAttribute("viewBox", "0 0 200 200");
  return svg;
}

// --- Tester -----------------------------------------------------------------

test("wrapDrawable: SVG bakgrund + canvas ovanpå i samma wrapper", () => {
  const svg = fakeSvg();
  const { wrapper, canvas } = wrapDrawable(svg, { document: fakeDoc });

  assert.equal(wrapper.tag, "div");
  assert.equal(wrapper.className, "bildstod-draw");
  assert.equal(canvas.tag, "canvas");
  assert.equal(canvas.className, "bildstod-draw-canvas");

  // Ordningen är staplingsordningen: SVG FÖRST (bakgrund), canvas SEDAN (ovanpå).
  assert.deepEqual(wrapper.children, [svg, canvas], "svg före canvas i wrappern");
  assert.equal(svg.parentNode, wrapper);
  assert.equal(canvas.parentNode, wrapper);
});

test("wrapDrawable: canvasen får ett tillgänglighetsnamn (rit-lager)", () => {
  const { canvas } = wrapDrawable(fakeSvg(), { document: fakeDoc });
  assert.ok(canvas.getAttribute("aria-label"), "canvas har aria-label");
});

test("wrapDrawable: kräver ett document (inget globalt i test)", () => {
  assert.throws(() => wrapDrawable(fakeSvg(), {}), /document/);
});

test("attachDrawLayer: kopplar den injicerade rit-motorn på canvasen", () => {
  const svg = fakeSvg();
  let attachedTo = null;
  let destroyed = false;
  const fakePad = { setTool() {}, clear() {}, resize() {}, destroy() { destroyed = true; } };
  const attach = (c) => { attachedTo = c; return fakePad; };

  const layer = attachDrawLayer(svg, { document: fakeDoc, attach });
  assert.equal(layer.canvas.tag, "canvas");
  assert.equal(attachedTo, layer.canvas, "rit-motorn kopplas på ÖVERLAGRETS canvas");
  assert.equal(layer.pad, fakePad, "paddet returneras så kortet kan registrera det");

  layer.destroy();
  assert.equal(destroyed, true, "destroy river rit-paddet");
});

test("attachDrawLayer: utan attach byggs bara strukturen (pad = null)", () => {
  const layer = attachDrawLayer(fakeSvg(), { document: fakeDoc });
  assert.equal(layer.pad, null);
  assert.deepEqual(layer.wrapper.children.map((c) => c.tag), ["svg", "canvas"]);
  layer.destroy(); // no-op utan pad, ska inte kasta
});

// --- Boot-säkerhet: utanför statiska bootgrafen från app.js -----------------
// Reachability-scan (samma som matte-bildstod.test.js): följ BARA statiska
// import-satser (inte dynamiska import()) från src/app.js och säkra att
// rit-lagret aldrig nås. Rit-canvasen är runtime → får inte i bootgrafen
// (jfr #271/#290: nya filer i bootgrafen = risk för vit sida vid deploy).
test("bildstod-draw.js ligger UTANFÖR den statiska bootgrafen från app.js", () => {
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
  assert.ok(!seen.has("bildstod-draw.js"), "bildstod-draw.js får inte vara statiskt nåbar från app.js");
  // Rit-lagret dras in via games-rakna.js (som själv nås dynamiskt) → även den
  // och scratchpad-kedjan ska ligga utanför boot.
  assert.ok(!seen.has("games-rakna.js"), "games-rakna.js får inte vara statiskt nåbar från app.js");
  assert.ok(!seen.has("scratchpad.js"), "scratchpad.js får inte vara statiskt nåbar från app.js");
});
