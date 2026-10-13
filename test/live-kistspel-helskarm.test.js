// ============================================================================
// Enhetstester: kistspelets HELSKÄRMSKNAPP (src/live/kistspel/ks-helskarm.js,
// #653) med ett litet låtsas-document – ingen knapp utan Fullscreen-API,
// klick → requestFullscreen/exitFullscreen, fullscreenchange synkar ikonen.
// ============================================================================

import { it } from "node:test";
import assert from "node:assert/strict";
import { createFullscreenButton, fullscreenSupported } from "../src/live/kistspel/ks-helskarm.js";

function fakeDoc({ api = true, webkit = false } = {}) {
  const listeners = {};
  const el = () => {
    const attrs = {};
    const ls = {};
    return {
      attrs, innerHTML: "", title: "",
      setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: (k) => attrs[k],
      addEventListener: (t, f) => { ls[t] = f; }, click: () => ls.click?.(), remove() { this.removed = true; },
    };
  };
  const doc = {
    fullscreenElement: null,
    documentElement: {},
    createElement: el,
    addEventListener: (t, f) => { (listeners[t] ||= new Set()).add(f); },
    removeEventListener: (t, f) => listeners[t]?.delete(f),
    fire: (t) => listeners[t]?.forEach((f) => f()),
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

it("ingen knapp där Fullscreen-API:t saknas (t.ex. Safari på iPhone)", () => {
  const doc = fakeDoc({ api: false });
  assert.equal(fullscreenSupported(doc), false);
  assert.equal(createFullscreenButton({}, { doc }), null);
});

it("klick → helskärm på vyns rot; ikonen byts; Esc/systemets utgång synkar tillbaka", async () => {
  const doc = fakeDoc();
  const target = { requestFullscreen: async () => { doc.fullscreenElement = target; doc.fire("fullscreenchange"); } };
  const b = createFullscreenButton(target, { cls: "dk-helskarm", doc });
  assert.equal(b.el.className, "dk-helskarm");
  assert.equal(b.el.getAttribute("aria-label"), "Helskärm");
  assert.match(b.el.innerHTML, /<svg/);
  b.el.click();
  await Promise.resolve();
  assert.equal(b.el.getAttribute("aria-label"), "Lämna helskärm");
  assert.equal(b.el.getAttribute("aria-pressed"), "true");
  // Esc: webbläsaren lämnar helskärmen själv.
  doc.fullscreenElement = null;
  doc.fire("fullscreenchange");
  assert.equal(b.el.getAttribute("aria-label"), "Helskärm");
  b.destroy();
  assert.equal(doc.count("fullscreenchange"), 0);
  assert.equal(b.el.removed, true);
});

it("webkit-prefixet räcker som reserv", () => {
  const doc = fakeDoc({ webkit: true });
  let asked = false;
  const target = { webkitRequestFullscreen: () => { asked = true; } };
  const b = createFullscreenButton(target, { doc });
  b.el.click();
  assert.equal(asked, true);
});
