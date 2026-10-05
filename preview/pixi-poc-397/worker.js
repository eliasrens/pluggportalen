// ============================================================================
// PoC #397 – Pixi v8 i en modul-Worker med OffscreenCanvas (enbart planstöd).
// Låser: (1) Pixi laddas lat från CDN i en worker (dist/webworker.min.mjs –
// main-bundlen saknar WebWorkerAdapter), (2) ImageBitmap → textur
// med mipmaps, (3) kamerans korszoom drivs av WORKERNS rAF – immun mot long
// tasks på main-tråden (spikens #389 invändning mot en main-thread-ticker).
//
// Meddelanden in:  {typ:"init", canvas, w, h, dpr}
//                  {typ:"nivaer", nivaer:[{bmp, x, y, w, h}]}  (lager-px)
//                  {typ:"zooma", fokus:{x,y}, fran, till, ms}
// Meddelanden ut:  {typ:"redo", renderer}, {typ:"klar", frames:[dt…]}
// ============================================================================

import * as PIXI from "https://cdn.jsdelivr.net/npm/pixi.js@8.22.0/dist/webworker.min.mjs";

// webworker-bundlen sätter WebWorkerAdapter själv (main-bundlen saknar den).
if (PIXI.WebWorkerAdapter) PIXI.DOMAdapter.set(PIXI.WebWorkerAdapter);

let app = null;
let lager = null;

/** CSS cubic-bezier(x1,y1,x2,y2) som funktion t→y (Newton + bisektion). */
function bezier(x1, y1, x2, y2) {
  const k = (a, b) => [3 * a, 3 * (b - a) - 3 * a, 1 - 3 * b + 3 * a];
  const [cx, bx, ax] = k(x1, x2);
  const [cy, by, ay] = k(y1, y2);
  const X = (t) => ((ax * t + bx) * t + cx) * t;
  const Y = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 20; i++) {
      const v = X(t) - x;
      if (Math.abs(v) < 1e-5) break;
      if (v > 0) hi = t; else lo = t;
      t = (lo + hi) / 2;
    }
    return Y(t);
  };
}
// EXAKT kamerans transform-kurva (.varld-lager i styles.css).
const KAMERA_EASE = bezier(0.55, 0, 0.2, 1);

self.onmessage = async (ev) => {
  try { await hantera(ev.data); } catch (err) { self.postMessage({ typ: "fel", fel: String(err && err.stack || err) }); }
};

async function hantera(m) {
  if (m.typ === "init") {
    app = new PIXI.Application();
    await app.init({
      canvas: m.canvas, width: m.w, height: m.h, resolution: m.dpr,
      backgroundAlpha: 0, antialias: false, preference: "webgl", autoStart: false,
    });
    lager = new PIXI.Container();
    app.stage.addChild(lager);
    self.postMessage({ typ: "redo", renderer: app.renderer.name, maxTex: app.renderer.gl?.getParameter(app.renderer.gl.MAX_TEXTURE_SIZE) });
  } else if (m.typ === "nivaer") {
    lager.removeChildren().forEach((c) => c.destroy({ texture: true, textureSource: true }));
    // Pyramiden staplas grovast → finast: varje nivå täcker en mindre region
    // med högre upplösning, så den skarpaste som täcker en punkt hamnar överst.
    for (const n of m.nivaer) {
      const source = new PIXI.ImageSource({ resource: n.bmp, autoGenerateMipmaps: true, scaleMode: "linear" });
      const s = new PIXI.Sprite(new PIXI.Texture({ source }));
      s.position.set(n.x, n.y);
      s.width = n.w;
      s.height = n.h;
      lager.addChild(s);
    }
    app.render();
  } else if (m.typ === "zooma") {
    // Lagret: pivot = fokus (transform-origin), skala fran → till.
    lager.pivot.set(m.fokus.x, m.fokus.y);
    lager.position.set(m.fokus.x - m.ox, m.fokus.y - m.oy);
    const frames = [];
    const t0 = performance.now();
    let forra = t0;
    const steg = (nu) => {
      frames.push(+(nu - forra).toFixed(1));
      forra = nu;
      const p = Math.min(1, (nu - t0) / m.ms);
      const s = m.fran + (m.till - m.fran) * KAMERA_EASE(p);
      lager.scale.set(s);
      app.render();
      if (p < 1) requestAnimationFrame(steg);
      else self.postMessage({ typ: "klar", frames });
    };
    requestAnimationFrame(steg);
  }
}
