// ============================================================================
// Pluggporten – Pixi-workern för världens kamerarörelse (#396, F1 #415)
// ----------------------------------------------------------------------------
// Körs som MODUL-Worker (startas av varld-render.js, aldrig i bootgrafen). Äger
// alla WebGL-kontexter: en Pixi-WebGLRenderer per "yta" (OffscreenCanvas som
// main-tråden lämnat över med transferControlToOffscreen). Workern har en egen
// rAF och påverkas därför inte av long tasks på main-tråden (PoC #397).
//
// Pixi laddas LAT med import() från den vendorade webworker-bundlen – en 404
// (Pages-deployfönstret) blir ett vanligt `fel`-svar, och värden tar CSS-vägen.
//
// Protokoll (§2.3a i docs/pixi-arkitektur-396.md). In → ut:
//   {typ:"init", pixiUrl}                  → {typ:"redo", maxTex} | {typ:"fel", orsak, fel}
//   {typ:"init", yta, canvas, w, h, dpr}   → {typ:"redo", yta, maxTex} | {typ:"fel", yta, orsak, fel}
//   {typ:"resize", yta, w, h, dpr}
//   {typ:"satLager", yta, nr, lagerId, scen} → {typ:"satt", yta, nr, lagerId}   (bitmaps transfererade)
//   {typ:"vila", yta, nr, state}           → {typ:"visar", yta, nr}       (efter workerns rAF-commit)
//   {typ:"spela", yta, nr, anim}           → {typ:"klar", yta, nr, frames, avbruten?}
//   {typ:"rensa", yta}
//   {typ:"slapp", yta, lagerId}
//   {typ:"debug", yta, op:"forlora"|"aterstall"}   (test: WEBGL_lose_context)
//   {typ:"stats", yta, nr}                 → {typ:"stats", yta, nr, texturer, bitmaps}  (#417)
//   ut spontant: {typ:"kontext", yta, lage:"forlorad"|"aterstalld"}
// ============================================================================

import { interpolera, lagerMatris, lagerSyns, KAMERA_TOTAL_MS } from "./varld-render-anim.js";
import { tidslinjeState } from "./varld-render-tidslinje.js"; // #424: anim.tidslinje (port → hem)

let PIXI = null;
let maxTex = 0;
/** @type {Map<number, Yta>} */
const ytor = new Map();

const raf = typeof self.requestAnimationFrame === "function"
  ? (cb) => self.requestAnimationFrame(cb)
  : (cb) => setTimeout(() => cb(performance.now()), 16);
const nastaFrame = () => new Promise((res) => raf(res));
const posta = (m) => self.postMessage(m);

// Meddelanden hanteras i tur och ordning (init av en yta är asynkron och måste
// vara klar innan dess satLager/spela körs). `spela` väntar INTE i kön – den
// startar sin rAF-loop och kön går vidare (så rensa/ny spela kan avbryta).
let ko = Promise.resolve();
self.onmessage = ({ data }) => {
  ko = ko.then(() => hantera(data)).catch((err) => {
    posta({ typ: "fel", yta: data?.yta, nr: data?.nr, orsak: "undantag", fel: String(err?.stack || err) });
  });
};

async function hantera(m) {
  switch (m.typ) {
    case "init": return m.canvas ? initYta(m) : initKarna(m);
    case "resize": return ytor.get(m.yta)?.resize(m.w, m.h, m.dpr);
    case "satLager": ytor.get(m.yta)?.satLager(m.lagerId, m.scen); return posta({ typ: "satt", yta: m.yta, nr: m.nr, lagerId: m.lagerId });
    case "vila": return ytor.get(m.yta)?.vila(m.state, m.nr);
    case "spela": return ytor.get(m.yta)?.spela(m.anim, m.nr);
    case "rensa": return ytor.get(m.yta)?.rensa();
    case "slapp": return ytor.get(m.yta)?.slapp(m.lagerId);
    case "debug": return ytor.get(m.yta)?.debug(m.op);
    case "stats": return posta({ typ: "stats", yta: m.yta, nr: m.nr, ...(ytor.get(m.yta)?.stats() || { texturer: 0, bitmaps: 0 }) });
  }
}

/** Ladda Pixi + prova WebGL i workern. Svarar redo{maxTex} eller fel. */
async function initKarna({ pixiUrl }) {
  if (typeof OffscreenCanvas !== "function") return posta({ typ: "fel", orsak: "ingen-offscreencanvas" });
  try {
    const prov = new OffscreenCanvas(1, 1);
    const gl = prov.getContext("webgl2") || prov.getContext("webgl");
    if (!gl) return posta({ typ: "fel", orsak: "ingen-webgl" });
    maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) | 0;
    gl.getExtension("WEBGL_lose_context")?.loseContext(); // släpp prov-kontexten direkt
  } catch (err) {
    return posta({ typ: "fel", orsak: "ingen-webgl", fel: String(err) });
  }
  try {
    PIXI = await import(pixiUrl);
    if (PIXI.WebWorkerAdapter) PIXI.DOMAdapter.set(PIXI.WebWorkerAdapter);
  } catch (err) {
    PIXI = null;
    return posta({ typ: "fel", orsak: "pixi-laddning", fel: String(err?.message || err) });
  }
  posta({ typ: "redo", maxTex });
}

async function initYta({ yta: id, canvas, w, h, dpr }) {
  if (!PIXI) return posta({ typ: "fel", yta: id, orsak: "ej-initierad" });
  const y = new Yta(id, canvas);
  try {
    await y.init(w, h, dpr);
  } catch (err) {
    return posta({ typ: "fel", yta: id, orsak: "renderer", fel: String(err?.message || err) });
  }
  ytor.set(id, y);
  posta({ typ: "redo", yta: id, maxTex });
}

class Yta {
  constructor(id, canvas) {
    this.id = id;
    this.canvas = canvas;
    this.renderer = null;
    this.rot = null;
    /** @type {Map<string, {cont:any, bmps:ImageBitmap[]}>} */
    this.lager = new Map();
    this.spelNr = 0; // pågående spela (0 = ingen)
    this.forlorad = false;
  }

  async init(w, h, dpr) {
    this.canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault(); // tillåt restore
      this.forlorad = true;
      this.avbrytSpel();
      posta({ typ: "kontext", yta: this.id, lage: "forlorad" });
    });
    this.canvas.addEventListener("webglcontextrestored", () => {
      this.forlorad = false;
      posta({ typ: "kontext", yta: this.id, lage: "aterstalld" });
    });
    this.renderer = new PIXI.WebGLRenderer();
    await this.renderer.init({
      canvas: this.canvas, width: w, height: h, resolution: dpr,
      backgroundAlpha: 0, antialias: false, autoDensity: false,
      preserveDrawingBuffer: false, powerPreference: "high-performance",
    });
    this.rot = new PIXI.Container();
    // getExtension() ger null på en redan förlorad kontext → hämta i förväg.
    this.loseExt = this.renderer.gl.getExtension("WEBGL_lose_context");
  }

  resize(w, h, dpr) {
    this.renderer?.resize(w, h, dpr);
  }

  /**
   * Bygg lagrets scengraf: en Container per lager (lager-px), en Sprite per
   * tegel, nivåerna staplade grovast → finast (z stigande) så att den skarpaste
   * nivån som täcker en punkt ligger överst.
   */
  satLager(lagerId, scen) {
    this.slapp(lagerId);
    const cont = new PIXI.Container();
    cont.label = lagerId;
    const bmps = [];
    const nivaer = [...(scen?.nivaer || [])].sort((a, b) => a.z - b.z);
    for (const n of nivaer) {
      for (const t of n.tegel || []) {
        bmps.push(t.bmp);
        const source = new PIXI.ImageSource({ resource: t.bmp, autoGenerateMipmaps: true, scaleMode: "linear" });
        const s = new PIXI.Sprite(new PIXI.Texture({ source }));
        s.position.set(t.x, t.y);
        s.width = t.w;
        s.height = t.h;
        cont.addChild(s);
        // Ladda upp till GPU:n nu (inte i första rörelse-framen).
        if (!this.forlorad) this.renderer.texture.initSource(source);
      }
    }
    cont.visible = false;
    this.rot.addChild(cont);
    this.lager.set(lagerId, { cont, bmps });
  }

  slapp(lagerId) {
    const l = this.lager.get(lagerId);
    if (!l) return;
    this.lager.delete(lagerId);
    l.cont.destroy({ children: true, texture: true, textureSource: true });
    for (const b of l.bmps) b.close?.();
  }

  /** Ställ alla lagers Pixi-transform enligt ett LagerState[] (stage-px). */
  stall(state) {
    const sedda = new Set();
    for (const l of state) {
      const p = this.lager.get(l.id);
      if (!p) continue;
      sedda.add(l.id);
      const syns = lagerSyns(l);
      p.cont.visible = syns;
      if (!syns) continue;
      if (l.matris) p.cont.setFromMatrix(new PIXI.Matrix(...l.matris)); // #424: tidslinje
      else {
        const m = lagerMatris(l);
        p.cont.scale.set(m.s);
        p.cont.position.set(m.tx, m.ty);
      }
      p.cont.alpha = l.opacity;
    }
    for (const [id, p] of this.lager) if (!sedda.has(id)) p.cont.visible = false;
    // Inre lagret ligger ovanpå (DOM-ordningen: ytterst först) = state-ordningen.
    // addChild på ett befintligt barn flyttar det sist.
    for (const l of state) {
      const p = this.lager.get(l.id);
      if (p) this.rot.addChild(p.cont);
    }
  }

  rita() {
    if (this.forlorad || !this.renderer) return;
    this.renderer.render(this.rot);
  }

  /** Rita vilo-bilden i en rAF och svara när den committats (nästa rAF). */
  async vila(state, nr) {
    this.avbrytSpel();
    await nastaFrame();
    this.stall(state);
    this.rita();
    await nastaFrame();
    posta({ typ: "visar", yta: this.id, nr });
  }

  avbrytSpel() {
    if (this.spelNr && this.avbryt) this.avbryt();
  }

  /** Spela en korszoom med workerns rAF. Svarar klar{frames} (dt per frame, ms). */
  spela(anim, nr) {
    this.avbrytSpel();
    const ms = anim.ms ?? KAMERA_TOTAL_MS;
    const frames = [];
    let t0 = null;
    let forra = 0;
    let slut = false;
    this.spelNr = nr;
    const avsluta = (avbruten) => {
      if (slut) return;
      slut = true;
      if (this.spelNr === nr) { this.spelNr = 0; this.avbryt = null; }
      posta({ typ: "klar", yta: this.id, nr, frames, ...(avbruten ? { avbruten: true } : {}) });
    };
    this.avbryt = () => avsluta(true);
    const steg = (nu) => {
      if (slut) return;
      if (this.forlorad) return avsluta(true);
      if (t0 == null) { t0 = nu; forra = nu; }
      else frames.push(+(nu - forra).toFixed(2));
      forra = nu;
      const t = Math.min(ms, nu - t0);
      this.stall(anim.tidslinje ? tidslinjeState(anim.tidslinje, t) : interpolera(anim.fran, anim.till, t));
      this.rita();
      if (t < ms) raf(steg);
      else avsluta(false);
    };
    raf(steg);
  }

  rensa() {
    this.avbrytSpel();
    if (this.forlorad || !this.renderer) return;
    // Göm lagren (inte roten – en osynlig rot hoppar Pixi över helt, utan clear)
    // och rendera: tom scen + backgroundAlpha 0 → genomskinlig canvas.
    for (const p of this.lager.values()) p.cont.visible = false;
    this.renderer.render(this.rot);
  }

  /** Texturbokföring: levande texturer (sprites) och ostängda bitmaps (close() → width 0). */
  stats() {
    let texturer = 0, bitmaps = 0;
    for (const l of this.lager.values()) {
      texturer += l.cont.children.length;
      for (const b of l.bmps) if (b.width > 0) bitmaps++;
    }
    return { texturer, bitmaps };
  }

  debug(op) {
    if (op === "forlora" && !this.forlorad) this.loseExt?.loseContext();
    else if (op === "aterstall" && this.forlorad) this.loseExt?.restoreContext();
  }
}
