// ============================================================================
// Pluggporten – textur-pipelinen för Pixi-rörelsen (#396, F3 #417)
// ----------------------------------------------------------------------------
// Från en spegel (F2: ett lager som EN fristående SVG-sträng) till skarpa,
// tegelsatta ImageBitmaps som renderaren (F1, Yta.satLager) laddar upp:
//
//   avkodaSpegel(s)            Blob-URL → Image.decode, EN gång per nyckel.
//   byggPyramid(a, roll, prio) nivåer z ∈ nivaer(zMin, zMax, steg) kring
//                              roll.originPx; varje nivå = regionen som syns i
//                              scale(z), rastrerad i z·dpr·upplösning enhets-px
//                              per lager-px och tegelsatt i ≤ tegel px. Strömmas
//                              grovast → finast via idle-kön (≈ 6 ms/uppgift).
//   koa(fn, prio)              idle-kön (varld-textur-ko.js, re-exporterad här).
//
// Käll-rektangel: SVG:n avkodas EN gång och varje nivå skärs ur bilden med
// drawImage(img, sx,sy,sw,sh, …) – Chromium rastrerar vektorerna i målstorleken
// (skarpt). Beskuren viewBox per nivå avkodar om (20–25 ms) → används inte (#397).
//
// Koordinater: region/tegel i LAGER-px (lagrets box-hörn = 0,0), samma som
// spegelns ox/oy/w/h. roll.originPx = transform-origin i LAGER-px (stage-px
// minus lagrets box.x/y). Nivåer med z<1 behövs för det inkommande lagret.
//
// Laddas aldrig statiskt (bara via import()). Inga DOM-anrop vid import →
// de rena hjälparna (planeraNiva) går att testa i node.
// ============================================================================

import { budget as budgetFor, enhetsKlass, nivaer as zNivaer, texturBytes, TexturLRU } from "./varld-textur-budget.js";
import { koa } from "./varld-textur-ko.js";

export { koa, koStats, nollstallKoStats } from "./varld-textur-ko.js";

/** Mål för EN rastreringsuppgift (ms) – ett tegel ritas i band av den här kostnaden. */
const BAND_MS = 6;
/** Startgissning för rastreringskostnad (ms per px; SwiftShader: 25-husbyn ≈ 4e-5, med marginal). */
const START_MS_PER_PX = 6e-5;
/** Antal avkodade speglar som hålls i minnet (vektorbilder, inga GPU-bytes). */
const AVKODADE_MAX = 6;

// ---- Konfiguration (enhetsklass/budget/dpr) --------------------------------

let konfig = null;

/**
 * Ställ in enhetsklass/budget/dpr (motorn anropar efter workerns `redo{maxTex}`).
 * Utan anrop: klass ur navigator, dpr ur devicePixelRatio.
 * @param {{klass?:"svag"|"normal", budget?:object, dpr?:number, maxTex?:number}} [o]
 */
export function stallIn(o = {}) {
  const nav = typeof navigator !== "undefined" ? navigator : null;
  const klass = o.klass || enhetsKlass(nav, o.maxTex);
  const b = { ...budgetFor(klass), ...(o.budget || {}) };
  if (o.maxTex > 0) b.tegel = Math.min(b.tegel, o.maxTex);
  const dprRa = o.dpr ?? (typeof devicePixelRatio === "number" ? devicePixelRatio : 1);
  konfig = { klass, budget: b, dprRa, dpr: Math.min(dprRa || 1, b.dprTak) };
  if (cache) cache.stallMax(b.maxBytes);
  return konfig;
}

/** Aktuell konfiguration ({klass, budget, dprRa, dpr}). */
export function konfiguration() {
  return konfig || stallIn();
}

let cache = null;
/** Den delade LRU:n för cachade pyramider (maxBytes ur budgeten). */
export function texturCache() {
  cache ??= new TexturLRU(konfiguration().budget.maxBytes);
  return cache;
}

// ---- Avkodning ---------------------------------------------------------------

/** @type {Map<string, Promise<AvkodadSpegel>>} Map-ordning = LRU. */
const avkodade = new Map();

/**
 * @typedef {{ svg:string, w:number, h:number, ox:number, oy:number, nyckel:string }} Spegel
 * @typedef {{ img: HTMLImageElement, nyckel:string, w:number, h:number, ox:number, oy:number,
 *             fx:number, fy:number, msPerPx:number, ms:number }} AvkodadSpegel
 *   fx/fy = bildens naturliga px per lager-px (SVG:ns width/height kan avrundas).
 *   msPerPx = uppmätt rastreringskostnad (styr bandhöjden, uppdateras löpande).
 */

/**
 * Avkoda spegeln EN gång (SVG → Blob-URL → Image.decode; samma origin → ingen
 * taint). Samma nyckel ger samma (cachade) bild.
 * @param {Spegel} s
 * @returns {Promise<AvkodadSpegel>}
 */
export function avkodaSpegel(s) {
  const nyckel = s.nyckel || "";
  const finns = nyckel && avkodade.get(nyckel);
  if (finns) {
    avkodade.delete(nyckel);
    avkodade.set(nyckel, finns);
    return finns;
  }
  const p = (async () => {
    const t0 = performance.now();
    const url = URL.createObjectURL(new Blob([s.svg], { type: "image/svg+xml" }));
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      const fx = s.w > 0 ? (img.naturalWidth || s.w) / s.w : 1;
      const fy = s.h > 0 ? (img.naturalHeight || s.h) / s.h : 1;
      // Förvärm: första drawImage bygger SVG:ns ritlista (engångskostnad) –
      // ta den här, inte i första tegel-uppgiften.
      new OffscreenCanvas(1, 1).getContext("2d").drawImage(img, 0, 0, 1, 1);
      return { img, nyckel, w: s.w, h: s.h, ox: s.ox, oy: s.oy, fx, fy, msPerPx: START_MS_PER_PX, ms: performance.now() - t0 };
    } finally {
      URL.revokeObjectURL(url);
    }
  })();
  if (nyckel) {
    avkodade.set(nyckel, p);
    p.catch(() => avkodade.get(nyckel) === p && avkodade.delete(nyckel));
    while (avkodade.size > AVKODADE_MAX) avkodade.delete(avkodade.keys().next().value);
  }
  return p;
}

/** Glöm en avkodad spegel (t.ex. när lagret blivit smutsigt). */
export const glomAvkodad = (nyckel) => avkodade.delete(nyckel);

// ---- Pyramid ---------------------------------------------------------------

/**
 * @typedef {{x:number, y:number, w:number, h:number}} Rekt
 * @typedef {{ px:Rekt, x:number, y:number, w:number, h:number }} TegelPlan  px = heltals-pixlar i nivåns raster
 * @typedef {{ z:number, skala:number, region:Rekt, tegel:TegelPlan[], bytes:number }} NivaPlan
 *   skala = enhets-px per lager-px (z · dpr · upplösning)
 */

function snitt(a, b) {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
  return x2 > x && y2 > y ? { x, y, w: x2 - x, h: y2 - y } : null;
}

/**
 * Planera EN nivå (ren matte). Regionen = det som syns av vyn `vy` när lagret
 * står i scale(z) kring `origin`, klippt mot spegelns fångstyta, utvidgad till
 * hela enhets-pixlar och delad i tegel ≤ `tegel` px.
 * @param {number} z
 * @param {{x:number,y:number}} origin  lager-px
 * @param {Rekt} vy      stagets synliga yta i lager-px
 * @param {Rekt} fangst  spegelns fångstyta i lager-px ({ox,oy,w,h})
 * @param {{dpr:number, upp:number, tegel:number}} o
 * @returns {NivaPlan|null} null = inget av nivån syns inom fångsten
 */
export function planeraNiva(z, origin, vy, fangst, { dpr, upp, tegel }) {
  const r = { x: origin.x + (vy.x - origin.x) / z, y: origin.y + (vy.y - origin.y) / z, w: vy.w / z, h: vy.h / z };
  const c = snitt(r, fangst);
  if (!c) return null;
  const skala = z * dpr * upp;
  const px0 = Math.floor(c.x * skala + 1e-6), py0 = Math.floor(c.y * skala + 1e-6);
  const px1 = Math.ceil((c.x + c.w) * skala - 1e-6), py1 = Math.ceil((c.y + c.h) * skala - 1e-6);
  const plan = { z, skala, region: { x: px0 / skala, y: py0 / skala, w: (px1 - px0) / skala, h: (py1 - py0) / skala }, tegel: [], bytes: 0 };
  const T = Math.max(1, Math.floor(tegel));
  for (let py = py0; py < py1; py += T) {
    for (let px = px0; px < px1; px += T) {
      const w = Math.min(T, px1 - px), h = Math.min(T, py1 - py);
      plan.tegel.push({ px: { x: px, y: py, w, h }, x: px / skala, y: py / skala, w: w / skala, h: h / skala });
      plan.bytes += texturBytes(w, h);
    }
  }
  return plan;
}

/**
 * Byggordningen: grovaste nivån och nivå 1 först (det `kanSpela` kräver),
 * sedan resten grovast → finast.
 */
export function byggOrdning(zs) {
  const min = [zs[0]];
  if (zs.includes(1) && zs[0] !== 1) min.push(1);
  return { min, ordning: [...min, ...zs.filter((z) => !min.includes(z))] };
}

/**
 * Rastrera NÄSTA band av ett tegel (käll-rektangel) på en egen duk. drawImage
 * spelas bara in – rastreringen sker i transferToImageBitmap, så varje band
 * flushas för sig (≈ BAND_MS med uppmätt ms/px). När alla band finns blittas de
 * ihop (billigt, egen uppgift) → tegelet blir EN textur.
 * @returns {boolean} true = alla band klara (dags för sammanfogaBand)
 */
function rastreraBand(a, t, st) {
  const { w, h } = t.px;
  const rader = Math.min(h - st.rad, Math.max(16, Math.floor(BAND_MS / (a.msPerPx * w))));
  const lagerPerPx = t.h / h;
  const t0 = performance.now();
  const duk = new OffscreenCanvas(w, rader);
  const ctx = duk.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(a.img,
    (t.x - a.ox) * a.fx, (t.y + st.rad * lagerPerPx - a.oy) * a.fy, t.w * a.fx, rader * lagerPerPx * a.fy,
    0, 0, w, rader);
  st.band.push({ bmp: duk.transferToImageBitmap(), y: st.rad });
  st.rad += rader;
  // Snabbt upp, långsamt ner: hellre för små band än en lång uppgift.
  const matt = (performance.now() - t0) / (w * rader);
  a.msPerPx = matt > a.msPerPx ? matt : a.msPerPx * 0.7 + matt * 0.3;
  return st.rad >= h;
}

/** Fogar ihop tegelets band till EN ImageBitmap (och stänger banden). */
function sammanfogaBand(t, st) {
  if (st.band.length === 1) return st.band.pop().bmp;
  const duk = new OffscreenCanvas(t.px.w, t.px.h);
  const ctx = duk.getContext("2d");
  for (const b of st.band) {
    ctx.drawImage(b.bmp, 0, b.y);
    b.bmp.close();
  }
  st.band.length = 0;
  return duk.transferToImageBitmap();
}

/** Stäng alla bitmaps i nivåerna (sådana som INTE transfererats till workern). */
export function slappNivaer(nivaer) {
  for (const n of nivaer || []) for (const t of n.tegel || []) t.bmp?.close?.();
}

const avbrytFel = () => Object.assign(new Error("pyramiden avbröts"), { name: "AbortError" });

/**
 * Bygg pyramiden för EN övergångsroll. Nivåerna strömmas grovast → finast,
 * ett tegel (eller ett band av det, ≈ BAND_MS) per kö-uppgift.
 *   minimumKlart → grovaste nivån + nivå 1 (det motorn kräver för att spela)
 *   allt         → alla nivåer (stigande z)
 *   avbryt()     → köade tegel blir no-ops; ofärdiga nivåers bitmaps stängs.
 *                  Färdiga nivåer (jobb.klara) ägs av anroparen.
 * @param {AvkodadSpegel} a
 * @param {{originPx:{x:number,y:number}, zMin:number, zMax:number, vy?:Rekt}} roll
 *   vy = stagets synliga yta i lager-px (standard: spegelns fångstyta)
 * @param {"idle"|"nu"} [prio="idle"]
 * @param {{budget?:object, dpr?:number}} [opt]
 */
export function byggPyramid(a, roll, prio = "idle", opt = {}) {
  const k = konfiguration();
  const b = opt.budget || k.budget;
  const dpr = opt.dpr ?? k.dpr;
  const fangst = { x: a.ox, y: a.oy, w: a.w, h: a.h };
  const vy = roll.vy || fangst;
  const zs = zNivaer(roll.zMin, roll.zMax, b.steg);
  const { min, ordning } = byggOrdning(zs);
  const planer = new Map();
  for (const z of ordning) {
    const p = planeraNiva(z, roll.originPx, vy, fangst, { dpr, upp: z < 1 ? b.under1Upplosning : 1, tegel: b.tegel });
    if (p) planer.set(z, p);
  }
  const o = roll.originPx;
  const jobb = {
    nyckel: `${a.nyckel}|${o.x.toFixed(1)},${o.y.toFixed(1)}|${roll.zMin}-${roll.zMax}|${dpr}`,
    nivaer: [...planer.keys()].sort((x, y) => x - y),
    planeradeBytes: [...planer.values()].reduce((s, p) => s + p.bytes, 0),
    klara: [], // färdiga Niva (varld-render.js), stigande z
    avbruten: false,
    minimumKlart: null, allt: null, avbryt: null,
    /** Lyssna på varje färdig nivå (strömning in i en pågående rörelse). */
    onNiva(cb) { lyssnare.push(cb); },
  };
  const lyssnare = [];
  let resMin, rejMin, resAllt, rejAllt;
  jobb.minimumKlart = new Promise((r, j) => { resMin = r; rejMin = j; });
  jobb.allt = new Promise((r, j) => { resAllt = r; rejAllt = j; });
  // Märk som hanterade (anroparen kanske bara väntar på den ena).
  for (const p of [jobb.minimumKlart, jobb.allt]) p.catch(() => {});

  const ofardiga = new Map(); // z → {plan, tegel[], kvar}
  const minKvar = new Set(min.filter((z) => planer.has(z)));
  const sorterade = () => [...jobb.klara];

  const nivaKlar = (z) => {
    const f = ofardiga.get(z);
    ofardiga.delete(z);
    const niva = { z, skala: f.plan.skala, region: f.plan.region, tegel: f.tegel, bytes: f.plan.bytes };
    jobb.klara.push(niva);
    jobb.klara.sort((x, y) => x.z - y.z);
    for (const cb of lyssnare) {
      try { cb(niva); } catch (err) { console.warn("[pp:pixi] onNiva:", err); }
    }
    minKvar.delete(z);
    if (!minKvar.size) resMin(sorterade());
    if (!ofardiga.size) resAllt(sorterade());
  };

  jobb.avbryt = () => {
    if (jobb.avbruten || !ofardiga.size) return;
    jobb.avbruten = true;
    for (const f of ofardiga.values()) for (const t of f.tegel) t?.bmp?.close?.();
    ofardiga.clear();
    rejMin(avbrytFel());
    rejAllt(avbrytFel());
  };

  if (!minKvar.size) resMin([]);
  if (!planer.size) resAllt([]);

  for (const z of ordning) {
    const plan = planer.get(z);
    if (!plan) continue;
    const f = { plan, tegel: new Array(plan.tegel.length), kvar: plan.tegel.length };
    ofardiga.set(z, f);
    plan.tegel.forEach((t, i) => {
      const st = { rad: 0, band: [] };
      const fel = (err) => {
        if (jobb.avbruten) return;
        console.warn("[pp:pixi] tegel misslyckades:", err);
        jobb.avbryt();
      };
      const avbrutet = () => {
        if (!jobb.avbruten) return false;
        for (const b of st.band) b.bmp.close();
        st.band.length = 0;
        return true;
      };
      const foga = () => {
        if (avbrutet()) return;
        f.tegel[i] = { bmp: sammanfogaBand(t, st), x: t.x, y: t.y, w: t.w, h: t.h };
        if (--f.kvar === 0) nivaKlar(z);
      };
      // Påbörjat tegel fortsätter FÖRST i kön (bara ett halvfärdigt tegel i taget).
      const band = () => {
        if (avbrutet()) return;
        koa(rastreraBand(a, t, st) ? foga : band, prio, true).catch(fel);
      };
      koa(band, prio).catch(fel);
    });
  }
  return jobb;
}
