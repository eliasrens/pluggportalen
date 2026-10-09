// ============================================================================
// PoC #397 (ENBART stöd för arkitekturplanen docs/pixi-arkitektur-396.md – inte
// produktionskod, ingår aldrig i appens bootgraf). Låser tre gränssnitt:
//
//   speglaLager(lagerEl, fangstEl) → { svg, w, h, ox, oy }
//     Komponerar ett levande världslager till EN fristående SVG-sträng UTAN
//     foreignObject (taint-fyndet #389): var(--hus-*) löses mot DOM:en,
//     foreignObject-avataren ersätts in-place av nästlade <svg>-delar mätta i
//     lagrets px, CSS-animerade noder fryses i sitt aktuella läge och web-
//     fonten bäddas in (SVG-som-bild får inte ladda externa fonter).
//   rastrera(spegel, region, utW, utH) → ImageBitmap
//     Rastrerar en REGION av spegeln i utW×utH enhets-pixlar (pyramid-nivå).
//   pyramidRegion(spegel, fokus, zoom) → region (lager-px) som syns vid zoom.
// ============================================================================

const SVGNS = "http://www.w3.org/2000/svg";
let fontCss = null;

/** Hämta Baloo 2 (latin) som data-URL-@font-face, EN gång. */
export async function inbaddadFont() {
  if (fontCss != null) return fontCss;
  try {
    const css = await (await fetch("https://fonts.googleapis.com/css2?family=Baloo+2:wght@800")).text();
    const block = css.split("/* latin */")[1] || css;
    const url = /url\((https:[^)]+\.woff2)\)/.exec(block)?.[1];
    const buf = await (await fetch(url)).arrayBuffer();
    let bin = "";
    const u8 = new Uint8Array(buf);
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    fontCss = `@font-face{font-family:'Baloo 2';font-weight:800;src:url(data:font/woff2;base64,${btoa(bin)}) format('woff2');}`;
  } catch {
    fontCss = "";
  }
  return fontCss;
}

/** Ersätt var(--x[, fallback]) i ett attributvärde med värdet från `ctxEl`. */
function losVars(varde, ctxEl) {
  if (!varde.includes("var(")) return varde;
  const cs = getComputedStyle(ctxEl);
  return varde.replace(/var\((--[\w-]+)\s*(?:,\s*([^)]*))?\)/g, (_, namn, fb) =>
    cs.getPropertyValue(namn).trim() || (fb || "").trim());
}

/** Matris som tar elementets användar-koordinater → lagrets px. */
function tillLager(svgEl, lagerRect) {
  const m = svgEl.getScreenCTM();
  return new DOMMatrix([m.a, m.b, m.c, m.d, m.e - lagerRect.left, m.f - lagerRect.top]);
}

/**
 * Bygg en nästlad <svg> (lager-px) av en HTML-inbäddad svg-del (avatar/klädsel).
 * CSS-filtret drop-shadow på .af-wear blir ett SVG-filter (identiskt utseende).
 */
function delSomSvg(delSvg, lagerRect, filterId) {
  const r = delSvg.getBoundingClientRect();
  const kopia = delSvg.cloneNode(true);
  kopia.setAttribute("x", (r.left - lagerRect.left).toFixed(2));
  kopia.setAttribute("y", (r.top - lagerRect.top).toFixed(2));
  kopia.setAttribute("width", r.width.toFixed(2));
  kopia.setAttribute("height", r.height.toFixed(2));
  kopia.removeAttribute("class");
  kopia.removeAttribute("style");
  const wear = delSvg.closest(".af-wear");
  const g = document.createElementNS(SVGNS, "g");
  if (wear && getComputedStyle(wear).filter.includes("drop-shadow")) g.setAttribute("filter", `url(#${filterId})`);
  g.appendChild(kopia);
  return g;
}

/**
 * Spegla `lagerEl` (i vila, scale(1)) till en fristående SVG. `fangstEl` = det
 * synliga staget: fångstytan är STAGETS ruta uttryckt i lagrets px (#373 –
 * ute-SVG:n övertecknar utanför lagerboxen), så ox/oy kan vara negativa.
 */
export async function speglaLager(lagerEl, fangstEl) {
  const t0 = performance.now();
  const lr = lagerEl.getBoundingClientRect();
  const fr = fangstEl.getBoundingClientRect();
  const ox = fr.left - lr.left, oy = fr.top - lr.top, w = fr.width, h = fr.height;
  const ut = [];
  const filterId = "pp-af-skugga";
  for (const svg of lagerEl.querySelectorAll(":scope > svg")) {
    const kopia = svg.cloneNode(true);
    const orig = svg.querySelectorAll("*");
    const klon = kopia.querySelectorAll("*");
    // Parallell genomgång original ↔ klon (samma dokumentordning).
    orig.forEach((o, i) => {
      const k = klon[i];
      for (const a of ["fill", "stroke", "stop-color", "style"]) {
        const v = k.getAttribute(a);
        if (v && v.includes("var(")) k.setAttribute(a, losVars(v, o));
      }
      // Frys CSS-animerade noder i sitt AKTUELLA läge (PoC: inline computed).
      if (o.getAnimations && o.getAnimations().length) {
        const cs = getComputedStyle(o);
        k.setAttribute("style", `transform:${cs.transform};transform-origin:${cs.transformOrigin};transform-box:${cs.transformBox};opacity:${cs.opacity}`);
        k.removeAttribute("class");
      }
    });
    // foreignObject → in-place grupp med inverterad CTM + nästlade del-svg:er.
    const foOrig = svg.querySelectorAll("foreignObject");
    kopia.querySelectorAll("foreignObject").forEach((fo, i) => {
      const inv = tillLager(svg, lr).inverse();
      const g = document.createElementNS(SVGNS, "g");
      g.setAttribute("transform", `matrix(${inv.a} ${inv.b} ${inv.c} ${inv.d} ${inv.e} ${inv.f})`);
      // Rygg-plagg före bas, övrigt efter – DOM-ordningen i avatarMarkup bevaras.
      for (const del of foOrig[i].querySelectorAll(".af-wear > svg, .af-base > svg")) g.appendChild(delSomSvg(del, lr, filterId));
      fo.replaceWith(g);
    });
    // Ytter-svg:n placeras på sin lager-ruta (den har viewBox + meet).
    const sr = svg.getBoundingClientRect();
    kopia.setAttribute("x", sr.left - lr.left);
    kopia.setAttribute("y", sr.top - lr.top);
    kopia.setAttribute("width", sr.width);
    kopia.setAttribute("height", sr.height);
    kopia.setAttribute("overflow", "visible");
    kopia.removeAttribute("class");
    ut.push(new XMLSerializer().serializeToString(kopia));
  }
  const font = await inbaddadFont();
  // Kommentarnoder får inte innehålla "--" i XML (#389-buggen) → rensa.
  const kropp = ut.join("").replace(/<!--[\s\S]*?-->/g, "");
  const svg = `<svg xmlns="${SVGNS}" width="${w}" height="${h}" viewBox="${ox} ${oy} ${w} ${h}">
    <defs><style>${font}</style>
    <filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="0.5" flood-color="#000" flood-opacity="0.2"/></filter></defs>
    ${kropp}</svg>`;
  return { svg, w, h, ox, oy, ms: performance.now() - t0 };
}

/** Regionen (lager-px) som syns när lagret står i scale(zoom) kring fokus (px). */
export function pyramidRegion(spegel, fokusPx, zoom) {
  const { ox, oy, w, h } = spegel;
  return {
    x: fokusPx.x + (ox - fokusPx.x) / zoom,
    y: fokusPx.y + (oy - fokusPx.y) / zoom,
    w: w / zoom,
    h: h / zoom,
  };
}

/** Avkoda spegeln EN gång (SVG → Image via blob-URL, samma origin → ej taint). */
export async function avkoda(spegel) {
  const url = URL.createObjectURL(new Blob([spegel.svg], { type: "image/svg+xml" }));
  const img = new Image();
  img.src = url;
  await img.decode();
  URL.revokeObjectURL(url);
  return img;
}

/**
 * Rastrera `region` (lager-px) av den avkodade spegeln till utW×utH px.
 * Två vägar jämförs i PoC:n: "kalla" (drawImage med käll-rektangel på den
 * avkodade bilden) och "viewbox" (ny SVG med beskuren viewBox per region).
 */
export async function rastrera(spegel, img, region, utW, utH, vag = "kalla") {
  const t0 = performance.now();
  const c = new OffscreenCanvas(utW, utH);
  const ctx = c.getContext("2d");
  if (vag === "kalla") {
    const sx = region.x - spegel.ox, sy = region.y - spegel.oy;
    ctx.drawImage(img, sx, sy, region.w, region.h, 0, 0, utW, utH);
  } else {
    const svg = spegel.svg.replace(/viewBox="[^"]*"/, `viewBox="${region.x} ${region.y} ${region.w} ${region.h}"`)
      .replace(/width="[^"]*" height="[^"]*"/, `width="${utW}" height="${utH}"`);
    const bild = await avkoda({ svg });
    ctx.drawImage(bild, 0, 0, utW, utH);
  }
  let taint = false;
  try { ctx.getImageData(0, 0, 1, 1); } catch { taint = true; }
  const bmp = c.transferToImageBitmap();
  return { bmp, taint, ms: performance.now() - t0 };
}
