// ============================================================================
// Tester: Matchdagen i helskärm (#878) – src/matchdagen/md-helskarm.js.
//   • med Fullscreen-API:t: knappen går in (host) och ut, klasserna följer fullscreenchange
//   • utan API:t (Safari på iPhone): reserven – host fyller fönstret, html.md-helskarm-sida
//     döljer menyn; Esc och knappen lämnar
//   • att lämna sidan (signal abort) lämnar helskärmen och tar bort klasserna
// Ren node med en liten låtsas-DOM: node --test test/matchdagen-helskarm-878.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { monteraHelskarm } from "../src/matchdagen/md-helskarm.js";

const klasser = () => {
  const s = new Set();
  return {
    add: (...c) => c.forEach((x) => s.add(x)), remove: (...c) => c.forEach((x) => s.delete(x)),
    contains: (c) => s.has(c), toggle: (c, pa) => (pa ? s.add(c) : s.delete(c)),
  };
};
function lyssnare() {
  const l = {};
  return {
    addEventListener: (t, f) => (l[t] ||= new Set()).add(f),
    removeEventListener: (t, f) => l[t]?.delete(f),
    skicka: (t, e = {}) => [...(l[t] || [])].forEach((f) => f({ type: t, ...e })),
    antal: (t) => l[t]?.size || 0,
  };
}
function element() {
  const ev = lyssnare();
  const attr = {};
  return { ...ev, classList: klasser(), innerHTML: "", setAttribute: (k, v) => (attr[k] = v), attr, click: () => ev.skicka("click") };
}
/** Låtsas-document; api = Fullscreen-API:t finns (dator, iPad), annars som Safari på iPhone. */
function dokument(api) {
  const d = { ...lyssnare(), documentElement: element(), fullscreenElement: null, resizes: 0 };
  d.defaultView = { dispatchEvent: () => d.resizes++ };
  d.createElement = () => element();
  if (api) {
    d.fullscreenEnabled = true;
    d.documentElement.requestFullscreen = () => Promise.resolve();
    d.exitFullscreen = () => { d.fullscreenElement = null; d.skicka("fullscreenchange"); return Promise.resolve(); };
  }
  return d;
}
const hostFor = (d) => {
  const host = element();
  host.requestFullscreen = () => { d.fullscreenElement = host; d.skicka("fullscreenchange"); return Promise.resolve(); };
  return host;
};

describe("Matchdagen i helskärm (#878)", () => {
  it("med Fullscreen-API:t: in och ut med knappen, klassen och etiketten följer", () => {
    const d = dokument(true);
    const host = hostFor(d);
    const h = monteraHelskarm(host, { doc: d });
    assert.equal(h.knapp.attr["aria-label"], "Helskärm");
    h.knapp.click();
    assert.equal(d.fullscreenElement, host);
    assert.equal(host.classList.contains("md-helskarm-pa"), true);
    assert.equal(host.classList.contains("md-helskarm-reserv"), false);
    assert.equal(d.documentElement.classList.contains("md-helskarm-sida"), false, "menyn rörs inte i riktig helskärm");
    assert.equal(h.knapp.attr["aria-label"], "Lämna helskärm");
    h.knapp.click();
    assert.equal(d.fullscreenElement, null);
    assert.equal(host.classList.contains("md-helskarm-pa"), false);
    assert.ok(d.resizes >= 3, "planens höjd räknas om vid varje byte");
  });
  it("Esc i riktig helskärm (webbläsaren lämnar) → klasserna tas bort via fullscreenchange", () => {
    const d = dokument(true);
    const host = hostFor(d);
    const h = monteraHelskarm(host, { doc: d });
    h.knapp.click();
    d.fullscreenElement = null;
    d.skicka("fullscreenchange");
    assert.equal(host.classList.contains("md-helskarm-pa"), false);
    assert.equal(h.knapp.attr["aria-pressed"], "false");
  });
  it("utan API:t (iPhone): reserven döljer menyn och fyller fönstret; Esc lämnar", () => {
    const d = dokument(false);
    const host = hostFor(d);
    const h = monteraHelskarm(host, { doc: d });
    h.knapp.click();
    assert.equal(d.fullscreenElement, null, "ingen requestFullscreen");
    assert.equal(host.classList.contains("md-helskarm-pa"), true);
    assert.equal(host.classList.contains("md-helskarm-reserv"), true);
    assert.equal(d.documentElement.classList.contains("md-helskarm-sida"), true);
    d.skicka("keydown", { key: "a" });
    assert.equal(h.aktiv(), true, "andra tangenter lämnar inte");
    d.skicka("keydown", { key: "Escape" });
    assert.equal(h.aktiv(), false);
    assert.equal(d.documentElement.classList.contains("md-helskarm-sida"), false);
    h.knapp.click();
    h.knapp.click();
    assert.equal(host.classList.contains("md-helskarm-reserv"), false, "knappen lämnar också");
  });
  it("att lämna sidan lämnar helskärmen och tar bort lyssnarna", () => {
    for (const api of [true, false]) {
      const d = dokument(api);
      const host = hostFor(d);
      const ac = new AbortController();
      const h = monteraHelskarm(host, { doc: d, signal: ac.signal });
      h.knapp.click();
      assert.equal(h.aktiv(), true);
      ac.abort();
      assert.equal(d.fullscreenElement, null);
      assert.equal(host.classList.contains("md-helskarm-pa"), false);
      assert.equal(d.documentElement.classList.contains("md-helskarm-sida"), false);
      assert.equal(d.antal("keydown"), 0);
      assert.equal(d.antal("fullscreenchange"), 0);
    }
  });
  it("md-app.js sätter knappen före flikarna och CSS:en döljer menyn i reserven", () => {
    const app = readFileSync(new URL("../src/matchdagen/md-app.js", import.meta.url), "utf8");
    assert.match(app, /monteraHelskarm\(host, \{ signal: S\.signal \}\)/);
    assert.match(app, /querySelector\("\.md-flikar"\)\.before\(S\.helskarm\.knapp\)/);
    const css = readFileSync(new URL("../src/styles/49-matchdagen-match.css", import.meta.url), "utf8");
    assert.match(css, /html\.md-helskarm-sida \.sidebar, html\.md-helskarm-sida \.hamburger/);
    assert.match(css, /\.md-app\.md-helskarm-reserv \{\s*position: fixed; inset: 0;/);
  });
});
