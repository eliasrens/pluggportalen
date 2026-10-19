// ============================================================================
// Helskärm (#783): den delade helpern (src/helskarm.js) med ett låtsas-document,
// schackmonteringen (src/schack/schack-helskarm.js) och källkodskontroller –
// knappen i datorläget, Live/Datakuppen använder samma helper, bootgrafen 107.
// Körs med: node --test test/schack-helskarm.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createFullscreenButton, fullscreenSupported, goIn, goUt, helskarmElement, lyssna, vaxla } from "../src/helskarm.js";
import { monteraHelskarm, HELSKARM_KLASS } from "../src/schack/schack-helskarm.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRCDIR = join(ROOT, "src");
const las = (p) => readFileSync(join(ROOT, p), "utf8");
const kod = (p) => las(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Element med classList, appendChild och requestFullscreen mot låtsas-documentet. */
function fakeEl(doc, namn = "div") {
  const ls = {};
  const klasser = new Set();
  const el = {
    namn, attrs: {}, innerHTML: "", title: "", children: [],
    classList: { add: (c) => klasser.add(c), remove: (c) => klasser.delete(c), contains: (c) => klasser.has(c), toggle: (c, on) => (on ? klasser.add(c) : klasser.delete(c)) },
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
    addEventListener: (t, f) => { ls[t] = f; }, click: () => ls.click?.(),
    appendChild(c) { this.children.push(c); c.foralder = this; return c; },
    remove() { this.removed = true; },
  };
  if (doc) {
    el.requestFullscreen = async () => { doc.fullscreenElement = el; doc.fire("fullscreenchange"); };
  }
  return el;
}

function fakeDoc({ api = true, webkit = false } = {}) {
  const listeners = {};
  const doc = {
    fullscreenElement: null,
    documentElement: {},
    createElement: (n) => fakeEl(null, n),
    addEventListener: (t, f) => { (listeners[t] ||= new Set()).add(f); },
    removeEventListener: (t, f) => listeners[t]?.delete(f),
    fire: (t) => [...(listeners[t] || [])].forEach((f) => f()),
    count: (t) => listeners[t]?.size || 0,
  };
  if (api && !webkit) {
    doc.fullscreenEnabled = true;
    doc.documentElement.requestFullscreen = () => {};
    doc.exitFullscreen = async () => { doc.fullscreenElement = null; doc.fire("fullscreenchange"); };
  }
  if (api && webkit) {
    doc.webkitFullscreenEnabled = true;
    doc.documentElement.webkitRequestFullscreen = () => {};
    doc.webkitExitFullscreen = () => { doc.webkitFullscreenElement = null; doc.fire("webkitfullscreenchange"); };
  }
  return doc;
}

function fakeWin(hash) {
  const ls = new Set();
  return {
    location: { hash },
    addEventListener: (t, f) => { if (t === "hashchange") ls.add(f); },
    removeEventListener: (t, f) => ls.delete(f),
    byt(nyHash, medEvent = true, hashEfter = nyHash) {
      const gammal = this.location.hash;
      this.location.hash = hashEfter;
      for (const f of [...ls]) f(medEvent ? { oldURL: `http://x/${gammal}`, newURL: `http://x/${nyHash}` } : undefined);
    },
    count: () => ls.size,
  };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("delade helpern src/helskarm.js", () => {
  it("stöd: kräver API:t och requestFullscreen; webkit-prefix räcker", () => {
    assert.equal(fullscreenSupported(fakeDoc({ api: false })), false);
    assert.equal(fullscreenSupported(fakeDoc()), true);
    assert.equal(fullscreenSupported(fakeDoc({ webkit: true })), true);
    const utanMetod = fakeDoc();
    delete utanMetod.documentElement.requestFullscreen;
    assert.equal(fullscreenSupported(utanMetod), false);
  });

  it("ingen knapp utan stöd eller utan mål", () => {
    assert.equal(createFullscreenButton(fakeEl(), { doc: fakeDoc({ api: false }) }), null);
    assert.equal(createFullscreenButton(null, { doc: fakeDoc() }), null);
  });

  it("goIn / goUt / vaxla och helskarmElement (standard + webkit)", async () => {
    const doc = fakeDoc();
    const mal = fakeEl(doc);
    assert.equal(helskarmElement(doc), null);
    vaxla(mal, doc);
    await tick();
    assert.equal(helskarmElement(doc), mal);
    vaxla(mal, doc);
    await tick();
    assert.equal(helskarmElement(doc), null);
    goIn(mal, doc);
    goUt(doc);
    assert.equal(helskarmElement(doc), null);
    const w = fakeDoc({ webkit: true });
    const wm = { webkitRequestFullscreen() { w.webkitFullscreenElement = wm; w.fire("webkitfullscreenchange"); } };
    goIn(wm, w);
    assert.equal(helskarmElement(w), wm);
    goUt(w);
    assert.equal(helskarmElement(w), null);
  });

  it("goIn/goUt sväljer fel och avvisade löften (ingen oväntad rejection)", async () => {
    const doc = fakeDoc();
    doc.exitFullscreen = () => { throw new Error("nej"); };
    goUt(doc);
    goIn({ requestFullscreen: () => Promise.reject(new Error("ingen gest")) }, doc);
    goIn(null, doc);
    await tick();
  });

  it("lyssna: fullscreenchange och webkitfullscreenchange, och avregistrering", () => {
    const doc = fakeDoc();
    let n = 0;
    const av = lyssna(() => n++, doc);
    doc.fire("fullscreenchange");
    doc.fire("webkitfullscreenchange");
    assert.equal(n, 2);
    av();
    doc.fire("fullscreenchange");
    assert.equal(n, 2);
    assert.equal(doc.count("fullscreenchange") + doc.count("webkitfullscreenchange"), 0);
  });

  it("knappen: klick växlar, ikon/etikett följer fullscreenchange (även Esc), text:true ger synlig text", async () => {
    const doc = fakeDoc();
    const mal = fakeEl(doc);
    const b = createFullscreenButton(mal, { cls: "x", doc, text: true });
    assert.equal(b.el.className, "x");
    assert.equal(b.el.getAttribute("aria-label"), "Helskärm");
    assert.match(b.el.innerHTML, /<svg[\s\S]*<span class="helskarm-text">Helskärm<\/span>/);
    b.el.click();
    await tick();
    assert.equal(b.el.getAttribute("aria-label"), "Lämna helskärm");
    assert.equal(b.el.getAttribute("aria-pressed"), "true");
    assert.match(b.el.innerHTML, /Lämna helskärm<\/span>/);
    doc.fullscreenElement = null; // Esc
    doc.fire("fullscreenchange");
    assert.equal(b.el.getAttribute("aria-label"), "Helskärm");
    assert.equal(b.el.getAttribute("aria-pressed"), "false");
  });

  it("destroy: avregistrerar; lämnar helskärm som standard men inte med exitOnDestroy:false", async () => {
    for (const [exit, kvar] of [[true, false], [false, true]]) {
      const doc = fakeDoc();
      const mal = fakeEl(doc);
      const b = createFullscreenButton(mal, { doc, exitOnDestroy: exit });
      b.el.click();
      await tick();
      b.destroy();
      await tick();
      assert.equal(!!helskarmElement(doc), kvar, `exitOnDestroy ${exit}`);
      assert.equal(doc.count("fullscreenchange"), 0);
      assert.equal(b.el.removed, true);
    }
  });
});

describe("monteraHelskarm (schack)", () => {
  it("null utan Fullscreen-API:t (t.ex. iPhone) – ingen knapp läggs till", () => {
    const doc = fakeDoc({ api: false });
    const rot = fakeEl(doc);
    assert.equal(monteraHelskarm(rot, { doc, win: fakeWin("#/elev/schack") }), null);
    assert.equal(rot.children.length, 0);
    assert.equal(monteraHelskarm(null, { doc: fakeDoc(), win: fakeWin("") }), null);
  });

  it("knappen hamnar i knappPlats (annars i behållaren) och klassen följer helskärmen, Esc inräknad", async () => {
    const doc = fakeDoc();
    const win = fakeWin("#/elev/schack?vy=dator");
    const rot = fakeEl(doc);
    const plats = fakeEl(doc);
    const hs = monteraHelskarm(rot, { knappPlats: plats, doc, win });
    assert.equal(plats.children[0], hs.knapp);
    assert.equal(rot.children.length, 0);
    assert.equal(rot.classList.contains(HELSKARM_KLASS), false);
    assert.match(hs.knapp.className, /schack-helskarm-knapp/);
    hs.knapp.click();
    await tick();
    assert.equal(rot.classList.contains(HELSKARM_KLASS), true);
    assert.equal(hs.knapp.getAttribute("aria-label"), "Lämna helskärm");
    doc.fullscreenElement = null; // Esc
    doc.fire("fullscreenchange");
    assert.equal(rot.classList.contains(HELSKARM_KLASS), false);
    assert.equal(hs.knapp.getAttribute("aria-label"), "Helskärm");
    const hs2 = monteraHelskarm(fakeEl(doc), { doc, win });
    assert.ok(hs2.knapp.foralder, "utan knappPlats läggs knappen i behållaren");
  });

  it("lämnar eleven schacksidan i helskärm avslutas helskärmen; byten inom schack gör det inte", async () => {
    const doc = fakeDoc();
    const win = fakeWin("#/elev/schack?vy=dator");
    const rot = fakeEl(doc);
    const hs = monteraHelskarm(rot, { doc, win });
    hs.knapp.click();
    await tick();
    assert.equal(win.count(), 1, "sidbytesvakten är på medan helskärm är på");
    win.byt("#/elev/schack?vy=dator&ny=1");
    await tick();
    assert.equal(helskarmElement(doc), rot, "kvar i helskärm inom schack");
    win.byt("#/elev");
    await tick();
    assert.equal(helskarmElement(doc), null, "lämnade schack → helskärmen avslutad");
    assert.equal(win.count(), 0, "vakten tar bort sig själv");
    assert.equal(rot.classList.contains(HELSKARM_KLASS), false);
  });

  it("vakten avgör efter händelsens newURL, inte efter location.hash som en annan lyssnare hunnit ändra", async () => {
    const doc = fakeDoc();
    const win = fakeWin("#/elev/schack");
    const rot = fakeEl(doc);
    monteraHelskarm(rot, { doc, win }).knapp.click();
    await tick();
    win.byt("#/elev", true, "#/elev/schack"); // en annan lyssnare skickar tillbaka hashen före vår
    await tick();
    assert.equal(helskarmElement(doc), null);
  });

  it("vyn kan bytas (destroy + ny montering) utan att helskärmen avbryts; nya vyn ärver läget", async () => {
    const doc = fakeDoc();
    const win = fakeWin("#/elev/schack?vy=dator");
    const rot = fakeEl(doc);
    const a = monteraHelskarm(rot, { doc, win });
    a.knapp.click();
    await tick();
    a.destroy();
    rot.classList.remove(HELSKARM_KLASS); // flödet nollställer className vid vybyte
    assert.equal(helskarmElement(doc), rot, "destroy lämnar inte helskärm");
    const b = monteraHelskarm(rot, { doc, win });
    assert.equal(rot.classList.contains(HELSKARM_KLASS), true);
    assert.equal(b.knapp.getAttribute("aria-label"), "Lämna helskärm");
    b.avsluta();
    await tick();
    assert.equal(helskarmElement(doc), null);
    assert.equal(doc.count("fullscreenchange") > 0, true);
    b.destroy();
    assert.equal(doc.count("fullscreenchange"), 0, "inga kvarglömda lyssnare");
    assert.equal(win.count(), 0);
  });
});

describe("källkod: knappen finns, Live/Datakuppen delar helpern, bootgrafen 107", () => {
  it("datorläget monterar helskärmsknappen på sidans rot, bredvid panelens knappar", () => {
    const k = kod("src/schack/schack-dator-vy.js");
    assert.match(k, /import \{ monteraHelskarm \} from "\.\/schack-helskarm\.js"/);
    assert.match(k, /monteraHelskarm\(host\.closest\?\.\("\.schack-rot"\) \|\| host, \{ knappPlats: \$\("\.schack-knappar"\) \}\)/);
    assert.match(k, /helskarm\?\.destroy\(\)/);
  });
  it("dragspöket läggs i helskärmselementet (annars osynligt i helskärm)", () => {
    assert.match(kod("src/schack/schack-bradet-inmatning.js"), /document\.fullscreenElement \|\| document\.webkitFullscreenElement \|\| document\.body\)\.appendChild\(d\.spoke\)/);
  });
  it("kistspelets och elevskärmens helskärm bygger på src/helskarm.js", () => {
    assert.match(kod("src/live/kistspel/ks-helskarm.js"), /export \{ fullscreenSupported, createFullscreenButton \} from "\.\.\/\.\.\/helskarm\.js"/);
    assert.match(kod("src/live/elevskarm-skarm.js"), /from "\.\.\/helskarm\.js"/);
    assert.doesNotMatch(kod("src/live/elevskarm-skarm.js"), /requestFullscreen|exitFullscreen/);
    assert.doesNotMatch(kod("src/live/kistspel/ks-helskarm.js"), /requestFullscreen|exitFullscreen/);
  });
  it("helpern har inga importer och schackmonteringen ligger i src/schack/", () => {
    assert.doesNotMatch(kod("src/helskarm.js"), /^\s*import\s/m);
    assert.match(kod("src/schack/schack-helskarm.js"), /from "\.\.\/helskarm\.js"/);
  });
  it("stilarna för helskärm är inbyggda i styles.css", () => {
    assert.match(las("src/styles.css"), /src\/styles\/37-schack-helskarm\.css/);
    assert.match(las("src/styles.css"), /\.schack-helskarm-pa \.schack \{/);
  });
  it("bootgrafen är kvar på 107 – helpern och schackfilerna ligger inte i den", () => {
    const g = staticBootGraph();
    assert.equal(g.size, 107);
    assert.ok(!g.has(join(SRCDIR, "helskarm.js")), "helskarm.js får inte vara en bootfil (#271)");
    assert.ok(![...g].some((f) => f.startsWith(join(SRCDIR, "schack") + "/")));
    assert.ok(![...g].some((f) => f.startsWith(join(SRCDIR, "live") + "/")), "Live ligger utanför bootgrafen");
  });
});

function staticBootGraph() {
  const start = join(SRCDIR, "app.js");
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const file = queue.shift();
    let src;
    try {
      src = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const re = /\b(?:import|export)\s+(?:[\w*{}\s,$]+?\s+from\s+)?["'](\.[^"']+)["']/g;
    let m;
    while ((m = re.exec(src))) {
      const next = resolve(dirname(file), m[1]);
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}
