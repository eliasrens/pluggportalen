// ============================================================================
// Bråkresan #751 (slut-QA #717 F2) – inga "null"/"undefined" som text.
// DOM:ens append/replaceChildren gör om null till texten "null". Testet
// renderar drakpanelen med ägg och den icke-interaktiva omdelningsmodellen
// (startvyns exempelbild, lärarens genomgång) i en liten fejk-DOM med samma
// strängningsregel som webbläsaren, och letar efter orden i texten.
// ============================================================================

import { test, describe, before } from "node:test";
import assert from "node:assert/strict";

/** Minimal DOM: bara det drakpanelen och omdelningen rör. */
class Nod {
  constructor(tag = "#text", text = "") {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attrs = {};
    this.dataset = {};
    this.style = { setProperty() {}, removeProperty() {} };
    this.lyssnare = {};
    this.text = text;
    this.html = "";
    const cl = new Set();
    this.classList = {
      add: (...c) => c.forEach((x) => cl.add(x)), remove: (...c) => c.forEach((x) => cl.delete(x)),
      toggle: (c, on = !cl.has(c)) => (on ? cl.add(c) : cl.delete(c), on), contains: (c) => cl.has(c),
    };
  }
  // Som i webbläsaren: allt som inte är en nod blir en textnod med String(x).
  append(...xs) { for (const x of xs) this.appendChild(x instanceof Nod ? x : new Nod("#text", String(x))); }
  prepend(...xs) { const f = this.children.slice(); this.children = []; this.append(...xs); this.append(...f); }
  replaceChildren(...xs) { for (const c of this.children) c.parentNode = null; this.children = []; this.append(...xs); }
  appendChild(n) {
    n.remove();
    n.parentNode = this;
    this.children.push(n);
    if (n.tagName === "LINK") queueMicrotask(() => n.dispatchEvent({ type: "load" }));
    return n;
  }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((c) => c !== this); this.parentNode = null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  removeAttribute(k) { delete this.attrs[k]; }
  hasAttribute(k) { return k in this.attrs; }
  addEventListener(t, f) { (this.lyssnare[t] ||= []).push(f); }
  removeEventListener(t, f) { this.lyssnare[t] = (this.lyssnare[t] || []).filter((g) => g !== f); }
  dispatchEvent(e) { for (const f of this.lyssnare[e.type] || []) f(e); return true; }
  focus() {}
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatchEvent({ type: "close" }); }
  getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, width: 300, height: 100, right: 300, bottom: 100 }; }
  set innerHTML(v) { this.children = []; this.html = String(v); }
  get innerHTML() { return this.html; }
  set textContent(v) { this.children = []; this.html = ""; this.text = String(v); }
  get textContent() {
    return this.text + this.html.replace(/<[^>]*>/g, " ") + this.children.map((c) => c.textContent).join("");
  }
  get firstChild() { return this.children[0] ?? null; }
  *alla() { for (const c of this.children) { yield c; yield* c.alla(); } }
  matchar(sel) {
    const m = /^([a-z0-9]*)((?:\.[\w-]+)*)(?:\[([\w-]+)\])?$/i.exec(sel.trim());
    if (!m) return false;
    const [, tag, klasser, attr] = m;
    if (tag && this.tagName !== tag.toUpperCase()) return false;
    if (klasser && !klasser.split(".").filter(Boolean).every((k) => this.classList.contains(k)
      || (this.attrs.class || "").split(/\s+/).includes(k))) return false;
    return !attr || attr in this.attrs;
  }
  querySelectorAll(sel) { return [...this.alla()].filter((n) => sel.split(",").some((s) => n.matchar(s))); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
}

function fejkDom() {
  const body = new Nod("body");
  const head = new Nod("head");
  const rot = new Nod("html");
  rot.append(head, body);
  globalThis.document = {
    head, body, documentElement: rot,
    createElement: (t) => new Nod(t),
    createElementNS: (_ns, t) => new Nod(t),
    createTextNode: (t) => new Nod("#text", t),
    getElementById: (id) => [...rot.alla()].find((n) => n.attrs.id === id) ?? null,
    querySelector: (s) => rot.querySelector(s),
    querySelectorAll: (s) => rot.querySelectorAll(s),
  };
}

// Utan \b: texten klistras ihop ("1null25"), så ordgränser hittar inte felet.
const NULLORD = /null|undefined/;

describe("ingen null/undefined-text (#751)", () => {
  before(fejkDom);

  test("drakpanelen med ägg: namnraden visar bara \"Drakägget\"", async () => {
    const { oppnaDrakpanel } = await import("../src/brakresan/drakpanel.js");
    const klar = oppnaDrakpanel({ state: { totalStars: 3 }, jakt: null, byt: async () => {}, idag: "2026-10-16" });
    await new Promise((r) => setTimeout(r, 20));
    const dlg = document.body.querySelector("dialog");
    assert.ok(dlg, "dialogen öppnades");
    const namnrad = dlg.querySelector(".bdp-namnrad");
    assert.equal(namnrad.textContent.trim(), "Drakägget");
    assert.doesNotMatch(dlg.textContent, NULLORD);
    dlg.close();
    await klar;
  });

  test("drakpanelen med kläckt drake: namnraden har \"Byt namn\"", async () => {
    const { oppnaDrakpanel } = await import("../src/brakresan/drakpanel.js");
    const klar = oppnaDrakpanel({ state: { totalStars: 25, dragon: { name: "Glöd" } }, jakt: null, byt: async () => {}, idag: "2026-10-16" });
    await new Promise((r) => setTimeout(r, 20));
    const dlg = document.body.querySelector("dialog");
    assert.match(dlg.querySelector(".bdp-namnrad").textContent, /Glöd\s*Byt namn/);
    assert.doesNotMatch(dlg.textContent, NULLORD);
    dlg.close();
    await klar;
  });

  for (const id of ["13", "14", "34", "47"]) {
    test(`omdelningsmodellen ${id} utan interaktion (startvy/genomgång)`, async () => {
      const { exampleTask, publicTask } = await import("../src/brakresan/demo.js");
      const { monteraUppgift } = await import("../src/brakresan/omgang-uppgift.js");
      const { task } = await exampleTask(id, `bild-${id}`);
      assert.equal(task.view.component, "omdelning", `${id} är en omdelningsuppgift`);
      for (const opts of [{ interactive: false, size: "kort" }, { interactive: true }]) {
        const host = document.createElement("div");
        document.body.append(host);
        const m = await monteraUppgift(host, publicTask(task), opts);
        await new Promise((r) => setTimeout(r, 0));
        assert.doesNotMatch(host.textContent, NULLORD, `${id} ${JSON.stringify(opts)}`);
        assert.equal(host.querySelectorAll(".br-omdelning-verktyg").length > 0, opts.interactive,
          "verktygen finns bara i den interaktiva modellen");
        m?.destroy?.();
        host.remove();
      }
    });
  }
});
