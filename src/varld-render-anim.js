// ============================================================================
// Pluggporten – kamera-matten för Pixi-rörelsen (#396, F1 #415)
// ----------------------------------------------------------------------------
// REN matte: ingen DOM, ingen Pixi → testas med `node --test`. Används både av
// värden på main-tråden (varld-render.js) och av workern (varld-render-worker.js),
// så att Pixi-zoomen blir EXAKT samma bild som dagens CSS-korszoom:
//
//   • lagerState()  = varld-kamera.js apply() som data (scale/origo/opacitet/
//                     synlighet per lager för aktiv nivå k och övergångens origo).
//   • interpolera() = CSS-transitionen på .varld-lager (styles.css):
//                       transform 0.9s cubic-bezier(0.55,0,0.2,1),
//                       opacity   0.55s ease 0.25s
//                     transform-origin och visibility är INTE transitionerade
//                     (de slår om direkt vid stilbytet) → tas från `till`.
//
// Koordinater: allt i STAGE-px (stagets övre vänstra hörn = 0,0). Ett lagers
// innehåll ritas i LAGER-px (lagrets box-hörn = 0,0) och placeras med
// lagerMatris(): stage = s·lokal + t.
//
// OBS rum-lagrets avvikande box (#373): apply() sätter transform-origin som %
// av VARJE lagers egen box – även när procenten kommer från ett annat lagers
// fokus (inre lagret använder origoNivåns fokus). lagerState() räknar därför
// procenten mot lagrets EGEN box, precis som webbläsaren gör, och "rättar"
// inte till det.
// ============================================================================

/** Transform-delen av .varld-lager-transitionen (= KAMERA_MS i varld-kamera.js). */
export const KAMERA_TRANSFORM = Object.freeze({ ms: 900, ease: Object.freeze([0.55, 0, 0.2, 1]) });
/** Opacitets-delen: 550 ms CSS "ease" efter 250 ms fördröjning. */
export const KAMERA_OPACITY = Object.freeze({ ms: 550, delay: 250, ease: Object.freeze([0.25, 0.1, 0.25, 1]) });
/** Hela rörelsens längd (transform är längst: 900 ≥ 250 + 550). */
export const KAMERA_TOTAL_MS = Math.max(KAMERA_TRANSFORM.ms, KAMERA_OPACITY.delay + KAMERA_OPACITY.ms);

/**
 * CSS cubic-bezier(x1, y1, x2, y2) som funktion av förloppet x ∈ [0,1] → y.
 * Löser x(t) = x med Newton-Raphson och faller tillbaka på bisektion (samma
 * metod som webbläsarnas UnitBezier), noggrannhet ~1e-7.
 * @returns {(x:number) => number}
 */
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t;
  const Y = (t) => ((ay * t + by) * t + cy) * t;
  const dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  const EPS = 1e-7;
  const losT = (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const fel = X(t) - x;
      if (Math.abs(fel) < EPS) return t;
      const d = dX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= fel / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 60; i++) {
      const v = X(t);
      if (Math.abs(v - x) < EPS) return t;
      if (v < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return Y(losT(x));
  };
}

const easeTransform = cubicBezier(...KAMERA_TRANSFORM.ease);
const easeOpacity = cubicBezier(...KAMERA_OPACITY.ease);

/**
 * @typedef {{x:number, y:number, w:number, h:number}} Box   stage-px
 * @typedef {{ id:string, box:Box, fokus:{x:number,y:number}, zoom:number }} NivaGeo
 *          fokus i % av lagrets EGEN box; ordnade YTTERST → INNERST (som kameran).
 * @typedef {{
 *   id: string, box: Box,
 *   scale: number|null,               // null = apply() rör inte transform (behåll)
 *   originPx: {x:number,y:number}|null, // transform-origin i stage-px; null = behåll
 *   opacity: number,
 *   synlig: boolean,                  // false = .varld-dold (visibility:hidden)
 *   inert: boolean,
 * }} LagerState
 */

const originPx = (box, fokus) => ({
  x: box.x + (fokus.x / 100) * box.w,
  y: box.y + (fokus.y / 100) * box.h,
});

/**
 * Exakt varld-kamera.js apply(k, origoNiva) som data. Lager längre bort än ett
 * steg får `scale/originPx = null` (apply() lämnar deras transform orörd) och
 * `synlig:false` (de göms direkt). Grannlagrens fördröjda `varld-dold` (vid
 * KAMERA_MS + 60) hör till vilan efteråt, se `vilaState`.
 * @param {NivaGeo[]} nivaer
 * @param {number} k aktiv nivå (index)
 * @param {number} [origoNiva=k] min(gammal, ny) under en övergång
 * @returns {LagerState[]}
 */
export function lagerState(nivaer, k, origoNiva = k) {
  return nivaer.map((n, j) => {
    const bas = { id: n.id, box: { ...n.box } };
    if (j === k) {
      return { ...bas, scale: 1, originPx: originPx(n.box, nivaer[origoNiva].fokus), opacity: 1, synlig: true, inert: false };
    }
    if (j === k - 1) {
      return { ...bas, scale: n.zoom, originPx: originPx(n.box, n.fokus), opacity: 0, synlig: true, inert: true };
    }
    if (j === k + 1) {
      return { ...bas, scale: 1 / nivaer[j - 1].zoom, originPx: originPx(n.box, nivaer[origoNiva].fokus), opacity: 0, synlig: true, inert: true };
    }
    return { ...bas, scale: null, originPx: null, opacity: 0, synlig: false, inert: true };
  });
}

/** Vilan efter en övergång: bara det aktiva lagret är synligt (doldTimer i apply()). */
export function vilaState(nivaer, k, origoNiva = k) {
  return lagerState(nivaer, k, origoNiva).map((l, j) => (j === k ? l : { ...l, synlig: false }));
}

/** Fyll i "behåll"-fält (null) i `till` från `fran` (samma lager-id). */
function fyllBehall(fran, till) {
  const f = new Map(fran.map((l) => [l.id, l]));
  return till.map((l) => {
    const g = f.get(l.id);
    return {
      ...l,
      scale: l.scale ?? g?.scale ?? 1,
      originPx: l.originPx ?? g?.originPx ?? { x: l.box.x, y: l.box.y },
    };
  });
}

/**
 * Tillståndet `tMs` ms in i en CSS-övergång från `fran` till `till`.
 * transform: 900 ms kamera-bezier kring `till`-origot (origo slår om direkt –
 * kameran byter det bara på lager som står i scale(1), så det syns aldrig).
 * opacity: konstant i 250 ms, sedan 550 ms "ease". visibility: `till` direkt.
 * @param {LagerState[]} fran
 * @param {LagerState[]} till
 * @param {number} tMs
 * @returns {LagerState[]}
 */
export function interpolera(fran, till, tMs) {
  const f = new Map(fyllBehall([], fran).map((l) => [l.id, l]));
  const pT = easeTransform(Math.min(1, Math.max(0, tMs / KAMERA_TRANSFORM.ms)));
  const pO = easeOpacity(Math.min(1, Math.max(0, (tMs - KAMERA_OPACITY.delay) / KAMERA_OPACITY.ms)));
  return fyllBehall(fran, till).map((l) => {
    const g = f.get(l.id) ?? l;
    return {
      ...l,
      scale: g.scale + (l.scale - g.scale) * pT,
      opacity: g.opacity + (l.opacity - g.opacity) * pO,
    };
  });
}

/**
 * Lagrets matris i stage-px: stage = s·lokal + (tx, ty), där lokal = lager-px
 * (lagrets box-hörn = 0,0). Motsvarar CSS `transform: scale(s)` kring origo.
 * @param {LagerState} l
 * @returns {{ s:number, tx:number, ty:number }}
 */
export function lagerMatris(l) {
  const s = l.scale ?? 1;
  const o = l.originPx ?? { x: l.box.x, y: l.box.y };
  return { s, tx: s * l.box.x + (1 - s) * o.x, ty: s * l.box.y + (1 - s) * o.y };
}

/** Ska lagret ritas alls i detta tillstånd? */
export function lagerSyns(l) {
  return l.synlig && l.opacity > 0.001;
}
