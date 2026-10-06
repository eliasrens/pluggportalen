// ============================================================================
// Preview-stöd för textur-pipelinen (#417, F3 i epic #396) – INTE appkod.
// Ersättare för F2:s speglaLager under utvecklingen (F2 bygger parallellt mot
// samma frysta `Spegel`-gränssnitt: {svg, w, h, ox, oy, nyckel}).
//
// = PoC #397:s speglaLager, generaliserad från "lagrets egna <svg>-barn" till
// ALLA yttersta <svg> i lagret (byns tomter/dekor är divar med SVG inuti), i
// målarordning efter z-index, placerade med getBoundingClientRect. HTML-text
// (namnpiller, "Du!"-brickan) och CSS-filter speglas INTE här – det är F2:s jobb.
// ============================================================================

import { inbaddadFont } from "../pixi-poc-397/spegel.js";

const SVGNS = "http://www.w3.org/2000/svg";
const FILTER_ID = "pp-af-skugga";

/** Ersätt var(--x[, fallback]) i ett attributvärde med värdet från `ctxEl`. */
function losVars(varde, ctxEl) {
  if (!varde.includes("var(")) return varde;
  const cs = getComputedStyle(ctxEl);
  return varde.replace(/var\((--[\w-]+)\s*(?:,\s*([^)]*))?\)/g, (_, namn, fb) =>
    cs.getPropertyValue(namn).trim() || (fb || "").trim());
}

/** FNV-1a 32 bit (innehålls-nyckel). */
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** z-index för närmaste positionerade förfader inom lagret (målarordning). */
function zIndex(el, lagerEl) {
  for (let e = el.parentElement; e && e !== lagerEl; e = e.parentElement) {
    const z = getComputedStyle(e).zIndex;
    if (z !== "auto") return Number(z) || 0;
  }
  return 0;
}

function delSomSvg(delSvg, lr) {
  const r = delSvg.getBoundingClientRect();
  const kopia = delSvg.cloneNode(true);
  kopia.setAttribute("x", (r.left - lr.left).toFixed(2));
  kopia.setAttribute("y", (r.top - lr.top).toFixed(2));
  kopia.setAttribute("width", r.width.toFixed(2));
  kopia.setAttribute("height", r.height.toFixed(2));
  kopia.removeAttribute("class");
  kopia.removeAttribute("style");
  const g = document.createElementNS(SVGNS, "g");
  const wear = delSvg.closest(".af-wear");
  if (wear && getComputedStyle(wear).filter.includes("drop-shadow")) g.setAttribute("filter", `url(#${FILTER_ID})`);
  g.appendChild(kopia);
  return g;
}

function speglaSvg(svg, lr) {
  const kopia = svg.cloneNode(true);
  const orig = svg.querySelectorAll("*");
  const klon = kopia.querySelectorAll("*");
  orig.forEach((o, i) => {
    const k = klon[i];
    for (const a of ["fill", "stroke", "stop-color", "style"]) {
      const v = k.getAttribute(a);
      if (v && v.includes("var(")) k.setAttribute(a, losVars(v, o));
    }
    if (o.getAnimations && o.getAnimations().length) {
      const cs = getComputedStyle(o);
      k.setAttribute("style", `transform:${cs.transform};transform-origin:${cs.transformOrigin};transform-box:${cs.transformBox};opacity:${cs.opacity}`);
      k.removeAttribute("class");
    }
  });
  const foOrig = svg.querySelectorAll("foreignObject");
  kopia.querySelectorAll("foreignObject").forEach((fo, i) => {
    const m = svg.getScreenCTM();
    const inv = new DOMMatrix([m.a, m.b, m.c, m.d, m.e - lr.left, m.f - lr.top]).inverse();
    const g = document.createElementNS(SVGNS, "g");
    g.setAttribute("transform", `matrix(${inv.a} ${inv.b} ${inv.c} ${inv.d} ${inv.e} ${inv.f})`);
    for (const del of foOrig[i].querySelectorAll(".af-wear > svg, .af-base > svg")) g.appendChild(delSomSvg(del, lr));
    fo.replaceWith(g);
  });
  for (const a of ["fill", "stroke"]) {
    const v = kopia.getAttribute(a);
    if (v && v.includes("var(")) kopia.setAttribute(a, losVars(v, svg));
  }
  const sr = svg.getBoundingClientRect();
  kopia.setAttribute("x", (sr.left - lr.left).toFixed(2));
  kopia.setAttribute("y", (sr.top - lr.top).toFixed(2));
  kopia.setAttribute("width", sr.width.toFixed(2));
  kopia.setAttribute("height", sr.height.toFixed(2));
  if (getComputedStyle(svg).overflow === "visible") kopia.setAttribute("overflow", "visible");
  kopia.removeAttribute("class");
  kopia.removeAttribute("style");
  return new XMLSerializer().serializeToString(kopia);
}

const medTimeout = (p, ms, fallback) => Promise.race([p, new Promise((r) => setTimeout(() => r(fallback), ms))]);

/**
 * Spegla `lagerEl` (i vila, scale(1)) till en fristående SVG i lagrets px.
 * Fångstytan = stagets ruta i lager-px (kan vara negativ, #373), eller
 * `fangst` (lager-px) – t.ex. större för det inkommande lagret (z<1).
 * @param {{x:number,y:number,w:number,h:number}} [fangst]
 * @returns {Promise<{svg:string, w:number, h:number, ox:number, oy:number, nyckel:string, ms:number}>}
 */
export async function speglaLager(lagerEl, stageEl, fangst) {
  const t0 = performance.now();
  const lr = lagerEl.getBoundingClientRect();
  const fr = stageEl.getBoundingClientRect();
  const { x: ox, y: oy, w, h } = fangst || { x: fr.left - lr.left, y: fr.top - lr.top, w: fr.width, h: fr.height };
  const delar = [];
  const bg = getComputedStyle(lagerEl).backgroundColor;
  if (bg && bg !== "transparent" && !/rgba\(.*,\s*0\)$/.test(bg)) {
    delar.push(`<rect x="0" y="0" width="${lr.width}" height="${lr.height}" fill="${bg}"/>`);
  }
  const svgs = [...lagerEl.querySelectorAll("svg")]
    .filter((s) => !s.parentElement.closest("svg"))
    .map((s, i) => ({ s, i, z: zIndex(s, lagerEl) }))
    .sort((a, b) => a.z - b.z || a.i - b.i);
  for (const { s } of svgs) delar.push(speglaSvg(s, lr));
  const font = await medTimeout(inbaddadFont(), 3000, "");
  const kropp = delar.join("").replace(/<!--[\s\S]*?-->/g, "");
  const svg = `<svg xmlns="${SVGNS}" width="${w}" height="${h}" viewBox="${ox} ${oy} ${w} ${h}">`
    + `<defs><style>${font}</style><filter id="${FILTER_ID}" x="-20%" y="-20%" width="140%" height="140%">`
    + `<feDropShadow dx="0" dy="1" stdDeviation="0.5" flood-color="#000" flood-opacity="0.2"/></filter></defs>${kropp}</svg>`;
  return { svg, w, h, ox, oy, nyckel: hash(svg), ms: performance.now() - t0 };
}
