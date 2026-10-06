// ============================================================================
// Pluggporten – renderar-värden för Pixi-rörelsen (#396, F1 #415)
// ----------------------------------------------------------------------------
// Main-trådens sida av renderaren. Laddas ALDRIG statiskt (bootgrafen från
// src/app.js är oförändrad) – bara via import() när världen ligger i idle.
//
//   ensureRenderare() → startar EN modul-Worker (varld-render-worker.js) som
//   laddar den vendorade Pixi-bundlen och provar WebGL. null = Pixi-vägen är
//   inte tillgänglig → anroparen kör dagens CSS-övergång.
//
// Fallback-stegen (varje steg → null/CSS, aldrig ett kastat fel):
//   pp:pixi:av → prefers-reduced-motion → saknad OffscreenCanvas /
//   transferControlToOffscreen / modul-Worker → worker-fel (404 på workern
//   eller vendor-filen, ingen WebGL, timeout) → Renderare.dod (context-loss
//   eller worker-krasch; "kontext aterstalld" väcker den igen).
//
// Flaggor (localStorage, alltid i try/catch):
//   pp:pixi:av     A/B – allt CSS, exakt dagens beteende
//   pp:pixi:tvinga ignorera budget/heuristik (läses av motorn) + försök igen
//                  direkt efter ett init-fel i stället för att vänta OMFORSOK_MS
//   pp:pixi:debug  logga varje spelad rörelse (frame-dt) i konsolen
//   pp:pixi:frys   Yta.rensa() gör inget → canvasen ligger kvar i vila (jämför
//                  Pixi mot DOM med skärmdump)
//
// Vendor: vendor/pixi-8.22.0/webworker.min.mjs = npm pixi.js@8.22.0 dist/webworker.min.mjs
// oförändrad (sha256 0380fc21…88ea6, MIT, LICENSE bredvid). Main-bundlen saknar
// WebWorkerAdapter. Bundlen har inga egna import()-chunkar.
//
// window.__ppPixi (debug/test): { vag, orsak, maxTex, dod, senaste, historik,
//   flaggor(), forloraKontext(), aterstallKontext() }.
// ============================================================================

import { KAMERA_TOTAL_MS } from "./varld-render-anim.js";

/**
 * Formatet som textur-pipelinen (F3, §2.3c) fyller och satLager skickar.
 * Alla koordinater i LAGER-px (lagrets box-hörn = 0,0; kan vara negativa för
 * övertecknad natur). bmp kan ha högre upplösning än w×h (pyramid-nivå × dpr).
 * @typedef {{ bmp: ImageBitmap, x:number, y:number, w:number, h:number }} Tegel
 * @typedef {{ z:number, region:{x:number,y:number,w:number,h:number}, tegel: Tegel[], bytes:number }} Niva
 * @typedef {{ nivaer: Niva[], nyckel?: string }} LagerScen
 *   nivaer ritas grovast → finast (z stigande) – workern sorterar.
 * @typedef {import("./varld-render-anim.js").LagerState} LagerState
 * @typedef {LagerState[]} KameraState  Lagren ordnade YTTERST → INNERST (som kameran).
 * @typedef {{ fran: KameraState, till: KameraState, ms?: number }} KameraAnim
 *   fran = vilan före (vilaState), till = lagerState(nivaer, mal, origoNiva).
 */

const PIXI_URL = new URL("../vendor/pixi-8.22.0/webworker.min.mjs", import.meta.url).href;
const WORKER_URL = new URL("./varld-render-worker.js", import.meta.url);
/** Hur länge init (worker + Pixi-laddning + WebGL-prov) får ta. */
const INIT_MS = 8000;
/** Efter ett init-fel: vänta så här länge innan nästa försök (deployfönster ~10 min). */
const OMFORSOK_MS = 5 * 60 * 1000;
const HISTORIK = 12;

// ---- Flaggor + kapabiliteter ----------------------------------------------

const lasFlagga = (namn) => {
  try {
    const v = localStorage.getItem(`pp:pixi:${namn}`);
    return v != null && v !== "0" && v !== "false";
  } catch {
    return false;
  }
};

/** Alla pp:pixi:*-flaggor (läses om varje gång – kan ändras i konsolen). */
export function pixiFlaggor() {
  return { av: lasFlagga("av"), tvinga: lasFlagga("tvinga"), debug: lasFlagga("debug"), frys: lasFlagga("frys") };
}

let modulWorkerOk = null;
/**
 * Stöder webbläsaren `new Worker(url, {type:"module"})`? Options-objektet läses
 * innan URL:en tolkas, så en ogiltig URL ger svaret utan att starta en worker.
 */
function stodjerModulWorker() {
  if (modulWorkerOk != null) return modulWorkerOk;
  let last = false;
  try {
    // eslint-disable-next-line no-new
    new Worker("http://[", { get type() { last = true; return "module"; } });
  } catch { /* förväntat: ogiltig URL */ }
  modulWorkerOk = last;
  return modulWorkerOk;
}

/** Varför Pixi-vägen inte går (synkront), eller null om den kan provas. */
function hinder() {
  if (lasFlagga("av")) return "flagga-av";
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return "reduced-motion";
  } catch { /* ignoreras */ }
  if (typeof OffscreenCanvas !== "function") return "ingen-offscreencanvas";
  if (typeof HTMLCanvasElement === "undefined" || !("transferControlToOffscreen" in HTMLCanvasElement.prototype)) {
    return "ingen-offscreencanvas";
  }
  if (typeof Worker !== "function" || !stodjerModulWorker()) return "ingen-modul-worker";
  return null;
}

/** Snabb synkron koll: flaggor, reduced-motion, OffscreenCanvas, modul-Worker. */
export function pixiMojlig() {
  return hinder() == null;
}

// ---- Debug-/testobjektet ----------------------------------------------------

const info = {
  vag: null, orsak: null, maxTex: 0, dod: false, senaste: null, historik: [],
  flaggor: pixiFlaggor,
  forloraKontext: () => instans?._debugAlla("forlora"),
  aterstallKontext: () => instans?._debugAlla("aterstall"),
};
try { window.__ppPixi = info; } catch { /* ingen window (test) */ }

function noteraSenaste(post) {
  info.senaste = { ...post, t: Math.round(performance.now()) };
  info.historik = [info.senaste, ...info.historik].slice(0, HISTORIK);
}

/** Motorn (F4) noterar en övergång som gick CSS-vägen – syns i __ppPixi.senaste. */
export function noteraCssVag(orsak) {
  noteraSenaste({ vag: "css", orsak });
}

// ---- ensureRenderare --------------------------------------------------------

let instans = null;
let pagaende = null;
let felTid = 0;
let felOrsak = null;

const css = (orsak) => {
  info.vag = "css";
  info.orsak = orsak;
  return null;
};

/**
 * Starta worker + Pixi första gången (idempotent singel).
 * @returns {Promise<Renderare|null>} null = använd CSS-vägen.
 */
export function ensureRenderare() {
  const h = hinder();
  if (h) return Promise.resolve(css(h));
  if (instans) {
    if (instans.dod) return Promise.resolve(css(instans.dodOrsak));
    info.vag = "pixi";
    info.orsak = null;
    return Promise.resolve(instans);
  }
  if (pagaende) return pagaende;
  if (felTid && performance.now() - felTid < OMFORSOK_MS && !lasFlagga("tvinga")) {
    return Promise.resolve(css(felOrsak));
  }
  pagaende = startaWorker().then(
    (r) => {
      pagaende = null;
      if (r.renderare) {
        instans = r.renderare;
        felTid = 0;
        info.vag = "pixi";
        info.orsak = null;
        info.maxTex = instans.maxTex;
        return instans;
      }
      felTid = performance.now();
      felOrsak = r.orsak;
      return css(r.orsak);
    },
  );
  return pagaende;
}

/** @returns {Promise<{renderare?: Renderare, orsak?: string}>} – kastar aldrig. */
function startaWorker() {
  return new Promise((res) => {
    let worker;
    try {
      worker = new Worker(WORKER_URL, { type: "module" });
    } catch (err) {
      res({ orsak: "worker-start" });
      return;
    }
    let klar = false;
    const avsluta = (svar) => {
      if (klar) return;
      klar = true;
      clearTimeout(timer);
      worker.onmessage = null;
      worker.onerror = null;
      if (svar.maxTex == null) {
        worker.terminate();
        res(svar);
      } else {
        // Renderaren tar över worker.onmessage/onerror (därför efter nollningen ovan).
        res({ renderare: new Renderare(worker, svar.maxTex) });
      }
    };
    const timer = setTimeout(() => avsluta({ orsak: "init-timeout" }), INIT_MS);
    worker.onmessage = ({ data }) => {
      if (data?.yta != null) return;
      if (data?.typ === "redo") avsluta({ maxTex: data.maxTex | 0 });
      else if (data?.typ === "fel") {
        if (lasFlagga("debug")) console.warn("[pp:pixi] init-fel:", data.orsak, data.fel || "");
        avsluta({ orsak: data.orsak || "worker-fel" });
      }
    };
    // 404 på själva worker-skriptet / syntaxfel → error-event (inget meddelande).
    worker.onerror = (e) => {
      e.preventDefault?.();
      avsluta({ orsak: "worker-fel" });
    };
    worker.postMessage({ typ: "init", pixiUrl: PIXI_URL });
  });
}

// ---- Renderare + Yta ------------------------------------------------------

let nastaNr = 1;

class Renderare {
  constructor(worker, maxTex) {
    this.worker = worker;
    this.maxTex = maxTex;
    this.dodOrsak = null;
    this._dodCb = [];
    /** @type {Map<number, {res:Function, rej:Function, typ:string}>} */
    this._vantar = new Map();
    this._ytor = new Map();
    this._ytId = 0;
    worker.onmessage = ({ data }) => this._svar(data);
    worker.onerror = (e) => {
      e.preventDefault?.();
      this._doda("worker-krasch", true);
    };
  }

  /** true = context lost / worker-krasch → alltid CSS-väg (tills kontexten återställs). */
  get dod() {
    return this.dodOrsak != null;
  }

  onDod(cb) {
    this._dodCb.push(cb);
  }

  /**
   * Koppla en <canvas> till en Pixi-yta i workern (transferControlToOffscreen).
   * @param {HTMLCanvasElement} canvas
   * @param {{dpr:number, w:number, h:number}} opt  w/h i CSS-px
   */
  skapaYta(canvas, { dpr, w, h }) {
    const id = ++this._ytId;
    const off = canvas.transferControlToOffscreen();
    const yta = new Yta(this, id);
    this._ytor.set(id, yta);
    this.worker.postMessage({ typ: "init", yta: id, canvas: off, w, h, dpr }, [off]);
    return yta;
  }

  _post(m, transfer) {
    if (this.dodOrsak === "worker-krasch") return;
    this.worker.postMessage(m, transfer || []);
  }

  /** Skicka ett meddelande som väntar på svar (nr). */
  _fraga(typ, m, transfer) {
    if (this.dodOrsak === "worker-krasch") return Promise.reject(new Error("renderaren är död"));
    const nr = nastaNr++;
    return new Promise((res, rej) => {
      this._vantar.set(nr, { res, rej, typ });
      this.worker.postMessage({ ...m, typ, nr }, transfer || []);
    });
  }

  _svar(d) {
    if (!d) return;
    if (d.typ === "kontext") {
      if (d.lage === "forlorad") this._doda("kontext-forlorad", false);
      else if (d.lage === "aterstalld" && this.dodOrsak === "kontext-forlorad") {
        this.dodOrsak = null;
        info.dod = false;
      }
      return;
    }
    if (d.typ === "fel" && d.yta != null && d.nr == null) {
      // En yta kunde inte skapas (t.ex. WebGL-renderer) → hela Pixi-vägen ur spel.
      if (lasFlagga("debug")) console.warn("[pp:pixi] yta-fel:", d.orsak, d.fel || "");
      this._doda(`yta-${d.orsak}`, false);
      return;
    }
    const v = d.nr != null ? this._vantar.get(d.nr) : null;
    if (!v) return;
    this._vantar.delete(d.nr);
    if (d.typ === "fel") v.rej(new Error(`${d.orsak}: ${d.fel || ""}`));
    else v.res(d);
  }

  _doda(orsak, krasch) {
    // Redan död: bara en krasch får ta över en kontextförlust (och dödar då för gott).
    if (this.dodOrsak && (!krasch || this.dodOrsak === "worker-krasch")) return;
    this.dodOrsak = orsak;
    info.dod = true;
    info.vag = "css";
    info.orsak = orsak;
    if (krasch) {
      for (const v of this._vantar.values()) v.rej(new Error(orsak));
      this._vantar.clear();
      try { this.worker.terminate(); } catch { /* redan stängd */ }
    }
    for (const cb of this._dodCb) {
      try { cb(); } catch (err) { console.warn("[pp:pixi] onDod:", err); }
    }
  }

  _debugAlla(op) {
    for (const id of this._ytor.keys()) this._post({ typ: "debug", yta: id, op });
  }
}

class Yta {
  constructor(renderare, id) {
    this._r = renderare;
    this.id = id;
  }

  resize(w, h, dpr) {
    this._r._post({ typ: "resize", yta: this.id, w, h, dpr });
  }

  /**
   * Bygg/ersätt lagrets scengraf i workern. Bitmaparna TRANSFERERAS (de blir
   * oanvändbara på main efteråt).
   * @param {string} lagerId
   * @param {LagerScen} scen
   */
  async satLager(lagerId, scen) {
    const transfer = [];
    for (const n of scen?.nivaer || []) for (const t of n.tegel || []) if (t.bmp) transfer.push(t.bmp);
    await this._r._fraga("satLager", { yta: this.id, lagerId, scen }, transfer);
  }

  /** Rita vila-läget och vänta tills workern presenterat framen. @param {KameraState} state */
  async visaVila(state) {
    await this._r._fraga("vila", { yta: this.id, state });
  }

  /**
   * Spela en korszoom i workern. Resolvar när sista framen är ritad.
   * @param {KameraAnim} anim
   * @returns {Promise<{frames:number[], avbruten?:boolean}>}
   */
  async spela(anim) {
    const start = performance.now();
    const d = await this._r._fraga("spela", { yta: this.id, anim: { ms: KAMERA_TOTAL_MS, ...anim } });
    const frames = d.frames || [];
    const post = {
      vag: "pixi", frames, n: frames.length,
      maxDt: frames.length ? Math.max(...frames) : 0,
      ms: Math.round(performance.now() - start),
      ...(d.avbruten ? { avbruten: true } : {}),
    };
    noteraSenaste(post);
    if (lasFlagga("debug")) console.info("[pp:pixi] spela", post);
    return { frames, ...(d.avbruten ? { avbruten: true } : {}) };
  }

  /** Töm canvasen (efter att DOM:en visats igen). pp:pixi:frys → no-op. */
  rensa() {
    if (lasFlagga("frys")) return;
    this._r._post({ typ: "rensa", yta: this.id });
  }

  /** Workerns texturbokföring för ytan (#417; G1:s HUD: + bytes, lager, gl, forlorad, gpu, maxTex). */
  async stats() {
    const { typ, yta, nr, ...s } = await this._r._fraga("stats", { yta: this.id });
    return s;
  }

  /** Släpp lagrets texturer i workern (destroy + bitmap.close()). */
  slappLager(lagerId) {
    this._r._post({ typ: "slapp", yta: this.id, lagerId });
  }
}
