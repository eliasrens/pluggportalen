// ============================================================================
// Enhetstest för kladdytans TEXT-verktyg (issue #392, scratch-text.js)
//   • Text-läget: ett tryck på ytan skapar en lapp på trycket (i PROCENT, så den
//     följer ytan vid förstora/förminska) och ger den fokus.
//   • Rit-lägena skapar inga lappar; tomma lappar städas bort vid blur.
//   • Sudd över en lapp tar bort den, Rensa tar bort alla.
//   • Boot-säkerhet: modulen ligger UTANFÖR den statiska bootgrafen från app.js.
//
// scratch-text.js är import-fri just för att kunna köras mot en minimal fejk-DOM
// (ingen jsdom i projektet) med Node:s inbyggda testkörare:  node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { attachTextLayer } from "../src/scratch-text.js";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");

// --- Minimal fejk-DOM -------------------------------------------------------
class FakeEl {
  constructor(doc, tag) {
    this.ownerDocument = doc;
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.value = "";
    this.placeholder = "";
    this._attrs = {};
    this._ls = {};
    this.rect = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    const set = new Set();
    this.classList = {
      add: (c) => set.add(c),
      remove: (c) => set.delete(c),
      contains: (c) => set.has(c),
      toggle: (c, on) => {
        const want = on === undefined ? !set.has(c) : !!on;
        if (want) set.add(c); else set.delete(c);
        return want;
      },
    };
  }
  set className(v) { String(v).split(/\s+/).filter(Boolean).forEach((c) => this.classList.add(c)); }
  setAttribute(k, v) { this._attrs[k] = String(v); }
  getAttribute(k) { return this._attrs[k]; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; return c; }
  contains(n) { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; }
  querySelectorAll(sel) {
    const cls = sel.replace(/^\./, "");
    const out = [];
    const walk = (n) => n.children.forEach((c) => { if (c.classList.contains(cls)) out.push(c); walk(c); });
    walk(this);
    return out;
  }
  getBoundingClientRect() { return this.rect; }
  addEventListener(t, fn) { (this._ls[t] = this._ls[t] || []).push(fn); }
  removeEventListener(t, fn) { this._ls[t] = (this._ls[t] || []).filter((f) => f !== fn); }
  dispatch(type, init = {}) {
    const e = { type, target: this, preventDefault() {}, ...init };
    for (let n = this; n; n = n.parentNode) (n._ls[type] || []).forEach((fn) => fn(e));
    return e;
  }
  focus() { this.ownerDocument.activeElement = this; }
  blur() {
    if (this.ownerDocument.activeElement !== this) return;
    this.ownerDocument.activeElement = null;
    (this._ls.blur || []).forEach((fn) => fn({ type: "blur", target: this }));
  }
}
function makeDoc() {
  const doc = {
    activeElement: null,
    defaultView: null, // ingen getComputedStyle → ch-fallback för bredden
    createElement: (tag) => new FakeEl(doc, tag),
  };
  return doc;
}
function setup() {
  const doc = makeDoc();
  const surface = new FakeEl(doc, "div");
  const t = attachTextLayer(surface, { document: doc });
  t.layer.rect = { left: 100, top: 50, right: 500, bottom: 250, width: 400, height: 200 };
  return { doc, surface, t };
}

test("Text-läget: tryck skapar en fokuserad lapp, placerad i procent av ytan", () => {
  const { doc, t } = setup();
  t.setTool("text");
  assert.ok(t.layer.classList.contains("is-text"));
  t.layer.dispatch("click", { clientX: 200, clientY: 150 }); // 25 % in, 50 % ner
  const notes = t.notes();
  assert.equal(notes.length, 1);
  assert.equal(notes[0].tagName, "INPUT");
  assert.equal(notes[0].style.left, "25.00%");
  assert.equal(notes[0].style.top, "50.00%");
  assert.equal(doc.activeElement, notes[0], "lappen får fokus direkt (öppnar mobiltangentbordet)");
});

test("rit-lägena skapar inga lappar; tryck på en befintlig lapp skapar ingen ny", () => {
  const { t } = setup();
  t.layer.dispatch("click", { clientX: 200, clientY: 150 });
  assert.equal(t.notes().length, 0, "penna (standard) ska inte skapa text");
  t.setTool("text");
  assert.ok(t.layer.classList.contains("is-text"));
  t.layer.dispatch("click", { clientX: 200, clientY: 150 });
  const [note] = t.notes();
  note.value = "12";
  note.dispatch("click", { clientX: 210, clientY: 150 }); // target = lappen
  assert.equal(t.notes().length, 1);
});

test("tom lapp städas bort vid blur, ifylld lapp blir kvar", () => {
  const { t } = setup();
  t.setTool("text");
  t.layer.dispatch("click", { clientX: 200, clientY: 100 });
  t.notes()[0].blur();
  assert.equal(t.notes().length, 0);
  t.layer.dispatch("click", { clientX: 200, clientY: 100 });
  const [note] = t.notes();
  note.value = "3 + 4";
  note.blur();
  assert.equal(t.notes().length, 1);
});

test("Enter avslutar lappen (och preventDefault så svarsformuläret inte skickas)", () => {
  const { t, doc } = setup();
  t.setTool("text");
  t.layer.dispatch("click", { clientX: 200, clientY: 100 });
  const [note] = t.notes();
  note.value = "7";
  let prevented = false;
  note.dispatch("keydown", { key: "Enter", preventDefault() { prevented = true; } });
  assert.ok(prevented);
  assert.equal(doc.activeElement, null);
});

test("Sudd tar bort lappar det passerar, Rensa tar bort alla", () => {
  const { surface, t } = setup();
  t.setTool("text");
  t.layer.dispatch("click", { clientX: 200, clientY: 100 });
  t.layer.dispatch("click", { clientX: 400, clientY: 200 });
  const [a, b] = t.notes();
  a.value = "1"; b.value = "2";
  a.rect = { left: 200, top: 90, right: 240, bottom: 110 };
  b.rect = { left: 400, top: 190, right: 440, bottom: 210 };
  t.setTool("eraser");
  surface.dispatch("pointermove", { clientX: 150, clientY: 100 }); // ej nedtryckt → inget
  assert.equal(t.notes().length, 2);
  surface.dispatch("pointerdown", { clientX: 150, clientY: 100 });
  surface.dispatch("pointermove", { clientX: 195, clientY: 100 }); // inom suddradien från a
  surface.dispatch("pointerup", {});
  assert.deepEqual(t.notes(), [b]);
  t.clear();
  assert.equal(t.notes().length, 0);
});

test("destroy kopplar bort lyssnarna", () => {
  const { surface, t } = setup();
  t.setTool("text");
  t.destroy();
  t.layer.dispatch("click", { clientX: 200, clientY: 100 });
  assert.equal(t.notes().length, 0);
  assert.equal((surface._ls.pointerdown || []).length, 0);
});

// --- Boot-säkerhet ------------------------------------------------------------
test("scratch-text.js ligger UTANFÖR den statiska bootgrafen från app.js", () => {
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
  assert.ok(seen.size > 10, "bootgrafen ska ha hittats");
  assert.ok(!seen.has("scratch-text.js"), "scratch-text.js får inte vara statiskt nåbar från app.js");
  assert.ok(!seen.has("scratchpad.js"), "scratchpad.js får inte vara statiskt nåbar från app.js");
});
