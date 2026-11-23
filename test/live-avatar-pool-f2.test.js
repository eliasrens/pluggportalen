// ============================================================================
// Test: Live-avatarpoolen läker en figur som ritats frånkopplad (Halloween-QA
// F2, docs/QA-RAPPORT-host-halloween.md; rättat i #911 för båda samlingarna).
// ----------------------------------------------------------------------------
// avatars.js byter bara platshållare som sitter i dokumentet. Poolen ritar varje
// figur en gång – ett element skapat före visning (live-regi, pall, notis) under
// den första laddningen fick stå kvar med platshållaren. Nu ritar poolen om när
// avatarKonstKlar() löses. Egen fil: konsten får INTE vara laddad när testet
// börjar (node --test kör varje fil i en egen process).
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

/** Minsta DOM som createAvatarPool behöver; figuren bärs som en sträng. */
class El {
  constructor() { this.dataset = {}; this.style = { setProperty() {} }; this.classList = { toggle() {} }; this.fig = null; }
  set innerHTML(v) { this.html = v; this.firstElementChild = Object.assign(new El(), { html: v }); }
  querySelector(sel) {
    if (sel === ".avatar-figure") return this.fig;
    if (sel === ".lav-glow") return { after: (f) => { this.fig = f; f.parent = this; } };
    return null;
  }
  replaceWith(n) { this.parent.fig = n; n.parent = this.parent; }
  remove() {}
}
globalThis.document = {
  createElement: () => new El(),
  querySelector: () => ({}), // live-css: arken "finns redan"
  querySelectorAll: () => [], // pool-elementen sitter aldrig i dokumentet
  head: { appendChild() {} },
};

const { createAvatarPool } = await import("../src/live/design/live-avatar-pool.js");
const { avatarKonstKlar, avatarArtReady } = await import("../src/avatars.js");

const tick = () => new Promise((r) => setTimeout(r, 0));

test("frånkopplad figur med Jul- och Halloween-köpavatar + kostymer läker när konsten laddats", async () => {
  const utseende = {
    a: { avatarId: "jul-av-tomtenisse", avatarItems: ["jul-luciakrona", "hw-vampyrmantel"], resolved: true },
    b: { avatarId: "hw-av-spoke", avatarItems: ["jul-snoangelvingar"], resolved: true },
    c: { avatarId: "fox", avatarItems: ["keps"], resolved: true },
  };
  let ritningar = 0;
  const pool = createAvatarPool({ roster: { info: (uid) => (ritningar++, utseende[uid]), onChange: () => () => {} } });
  assert.equal(avatarArtReady("jul-av-tomtenisse"), false, "konsten är inte laddad när figuren ritas");
  const a = pool.el("a"), b = pool.el("b"), c = pool.el("c");
  assert.match(a.fig.html, /data-av-vantar="jul-av-tomtenisse"/);
  assert.match(a.fig.html, /af-kostym-vantar" data-kostym="jul-luciakrona"/);
  assert.match(b.fig.html, /data-av-vantar="hw-av-spoke"/);
  assert.doesNotMatch(c.fig.html, /vantar/, "gratis figur utan kostym: ingen platshållare");
  const cFig = c.fig;

  await avatarKonstKlar();
  await tick();
  for (const [el, kostym] of [[a, "jul-luciakrona"], [b, "jul-snoangelvingar"]]) {
    assert.doesNotMatch(el.fig.html, /vantar/, "platshållarna borta");
    assert.match(el.fig.html, /viewBox="0 0 100 120"/, "riktig figur");
    assert.match(el.fig.html, new RegExp(`af-kostym" data-seasonal="jul"><svg[^>]*aria-label="[^"]+"[^]*`), `${kostym} ritad`);
  }
  assert.match(a.fig.html, /data-seasonal="halloween"/, "Halloween-manteln också");
  assert.equal(c.fig, cFig, "figurer utan platshållare ritas inte om");
  assert.equal(pool.el("a"), a, "samma element");
  pool.destroy();
});

test("misslyckad laddning ger ingen evig omritning (en gång per utseende)", async () => {
  // Okänt jul-id: platshållaren står kvar även när konsten är laddad.
  let ritningar = 0;
  const info = { avatarId: "fox", avatarItems: ["jul-finns-inte"], resolved: true };
  const pool = createAvatarPool({ roster: { info: () => (ritningar++, info), onChange: () => () => {} } });
  const el = pool.el("x");
  await avatarKonstKlar();
  for (let i = 0; i < 5; i++) await tick();
  assert.equal(ritningar, 2, "ritad + EN omritning");
  assert.match(el.fig.html, /af-kostym-vantar[^>]*hidden/, "den dolda platshållaren står kvar, osynlig");
  pool.destroy();
});
