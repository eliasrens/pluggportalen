// ============================================================================
// Pluggporten – spegling: levande DOM-lager → fristående SVG (#416, F2 i #396)
// ----------------------------------------------------------------------------
// Pixi-motorn (epic #396) ritar kamerans rörelse ur texturer. Texturerna är
// HÄRLEDDA ur DOM:en: ett världslager i vila "fotograferas" hit till EN SVG-
// sträng som webbläsarens egen SVG-motor sedan rastrerar (varld-textur.js).
// Därför ser texturen ut exakt som DOM:en – samma konst, samma font, samma
// färger – utan att någon scen behöver en egen Pixi-modell.
//
// Reglerna (docs/pixi-arkitektur-396.md §2.3b), generiska för ALLA scener:
//  1. <svg> serialiseras direkt ur originalträdet (ingen kloning); var(--…) i
//     fill/stroke/stop-color/style löses mot originalnodens computed style
//     (palett per tomt/lager följer med).
//  2. <foreignObject> → in-place <g> + nästlade <svg> mätta i lagrets px
//     (avatarens af-*-ordning bevaras eftersom DOM-ordningen följs: rygg först).
//  3. CSS-filter → SVG-<filter> (låsta hus grayscale, klädernas drop-shadow).
//  4. HTML-boxar → <rect> (bakgrund/gradient/border/radie/skugga), text →
//     <text> (computed font, baslinje via measureText, ellipsis). Emoji = text.
//  5. <img> (PNG-spritedjur) → <image href="data:…"> (cache per URL).
//  6. Baloo 2 bäddas in som data-URL-@font-face (varld-spegel-font.js).
//     Moduler: -html (matriser/box/filter), -text (<text>), -klipp (förfäders
//     klipp för nod-sprites), -ut (bilder/font/hash), -font.
//  7. XML-kommentarer rensas; CSS-transform/opacity (hover-scale, tomternas
//     translate(-50%,-50%), "Du!"-brickans rotate) bakas in.
//  8. Profilens `ambient` utelämnas (returneras i `ambient`), `ignorera` ritas inte.
//     (Motorn skickar scen-profilens `sprites` här – se varld-profil-standard.js.)
//  9. `neutraliseraObjekt` (selektor): hovrade/fokuserade objekt ritas i vila-
//     läge, utan :hover/:focus-visible (varld-spegel-neutral.js, #428).
// Utdata innehåller ALDRIG foreignObject eller extern URL → ingen canvas-taint.
//
// Läser bara DOM/layout (enda undantaget: regel 9:s vila-kloner, borttagna i
// samma task) och gör hela genomgången SYNKRONT,
// så ögonblicksbilden är konsistent. Bara bilder/font väntas in efteråt.
// Laddas enbart via import() – aldrig i den statiska bootgrafen (#271).
// ============================================================================

import { esc, matrisAttr, kedjaLinjar, elementRam, dekoration, filterPrimitiver, delaKomma, tolkaSkugga, dropPrimitiv } from "./varld-spegel-html.js";
import { textSvg } from "./varld-spegel-text.js";
import { forfaderKlipp } from "./varld-spegel-klipp.js";
import { slutfor, hash } from "./varld-spegel-ut.js";
import { neutraliseraObjekt } from "./varld-spegel-neutral.js";

export { granska, hash } from "./varld-spegel-ut.js";

const VAR_ATTR = ["fill", "stroke", "stop-color", "flood-color", "color", "style", "opacity"];
const ARV = ["color", "fill", "stroke", "stroke-width", "stroke-linejoin", "stroke-linecap", "font-family", "font-size", "font-weight"];
const f = (n) => (Math.round(n * 1000) / 1000).toString();
const px = (v) => parseFloat(v) || 0;

/** Profilens selektorlista (sträng eller array) → en selektor ("" = ingen). */
const sel = (v) => (Array.isArray(v) ? v.join(",") : v || "");
/** Standard för bildZoom: kamerans största zoom (hus→rum = 6). */
const BILD_ZOOM = 6;

/** Linjär skala (√|det|) för en matris – element-px → viewport-px. */
const linSkala = (m) => Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;

/**
 * Kontext för EN spegling: defs (deterministiska id:n), bilder, ambient.
 * bildZoom = största skala lagret visas förstorat i (pyramidens zMax); <img>
 * bäddas in i visad storlek × dpr × bildZoom i stället för full PNG (#422).
 */
function nyKtx(profil, lagerEl, lagerL) {
  const defs = new Map();
  const bilder = [];
  return {
    amb: sel(profil?.ambient),
    ign: sel(profil?.ignorera),
    ambient: [],
    // Lagret självt kan stå visibility:hidden (varld-dold) när det förvärms –
    // då ärver alla barn "hidden" fast de syns i vila. Ignorera visibility då.
    ignVis: !!lagerEl && getComputedStyle(lagerEl).visibility === "hidden",
    bilder,
    lagerSkala: lagerL ? linSkala(lagerL) : 1,
    bildPx: Math.min(window.devicePixelRatio || 1, 2) * (profil?.bildZoom ?? BILD_ZOOM),
    def(nyckel, bygg) {
      let d = defs.get(nyckel);
      if (!d) { d = { id: `pps${defs.size}` }; d.markup = bygg(d.id); defs.set(nyckel, d); }
      return d.id;
    },
    defsMarkup: () => [...defs.values()].map((d) => d.markup).join(""),
    filter(css) {
      const p = filterPrimitiver(css);
      return p ? this.def(`f:${css}`, (id) => `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">${p}</filter>`) : null;
    },
    bild(url, bredd, img) { bilder.push({ url, bredd, img }); return `__pps_bild_${bilder.length - 1}__`; },
  };
}

// --- HTML-genomgång -------------------------------------------------------------
/** Barnen i CSS-målarordning (ungefärlig): z<0, flöde + text, positionerade, z>0. */
function barn(el, cs, ram, ktx) {
  const poster = [];
  let i = 0;
  for (const n of el.childNodes) {
    if (n.nodeType === 3) { poster.push({ k: 1, z: 0, i: i++, n }); continue; }
    if (n.nodeType !== 1) continue;
    const c = getComputedStyle(n);
    const pos = c.position !== "static";
    const z = c.zIndex === "auto" ? 0 : parseInt(c.zIndex, 10) || 0;
    poster.push({ k: !pos ? 1 : z < 0 ? 0 : z > 0 ? 3 : 2, z, i: i++, n, c });
  }
  poster.sort((a, b) => a.k - b.k || a.z - b.z || a.i - b.i);
  let s = "";
  for (const p of poster) {
    if (p.c) { s += element(p.n, p.c, ram, ktx); continue; }
    if (cs.visibility !== "visible" && !ktx.ignVis) continue;
    let fid = null;
    if (cs.textShadow && cs.textShadow !== "none") {
      const sk = tolkaSkugga(delaKomma(cs.textShadow)[0]);
      fid = ktx.def(`ts:${cs.textShadow}`, (id) => `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">${dropPrimitiv(sk)}</filter>`);
    }
    s += textSvg(p.n, cs, ram, fid);
  }
  return s;
}

/** Ett element (relativt föräldraramen `ram`) → SVG-markup. */
function element(el, cs, ram, ktx) {
  if (ktx.ign && el.matches(ktx.ign)) return "";
  if (ktx.hoppa?.has(el)) return ""; // ritas av sin vila-klon (regel 9)
  if (ktx.amb && el.matches(ktx.amb)) { ktx.ambient.push(el); return ""; }
  if (cs.display === "none" || cs.opacity === "0") return "";
  if (cs.display === "contents") return barn(el, cs, ram, ktx);
  const ersatt = el instanceof SVGSVGElement || el.localName === "img" || el.localName === "canvas";
  // Icke-ersatta inline-element har ingen egen box/transform: genomskinliga
  // omslag som bara bär font/färg till sin text (t.ex. <b> i områdesskylten).
  if (cs.display === "inline" && !ersatt) return barn(el, cs, ram, ktx);
  if (!(el instanceof HTMLElement) && !(el instanceof SVGSVGElement)) return "";
  const r = elementRam(el, cs, ram.L);
  let attr = matrisAttr(ram.inv.multiply(r.M));
  if (+cs.opacity < 1) attr += ` opacity="${cs.opacity}"`;
  const fid = ktx.filter(cs.filter);
  if (fid) attr += ` filter="url(#${fid})"`;
  return `<g${attr}>${boxInnehall(el, cs, r, ktx)}</g>`;
}

/** Innehållet i en box (egna px, utan egen transform/opacitet): dekor + innehåll + outline. */
function boxInnehall(el, cs, r, ktx) {
  const { w, h } = r;
  const synlig = cs.visibility === "visible" || ktx.ignVis;
  const ram = { M: r.M, L: r.L, inv: r.M.inverse(), ell: null };
  if (cs.textOverflow === "ellipsis" && cs.overflowX !== "visible") {
    ram.ell = { hoger: w - px(cs.borderRightWidth) - px(cs.paddingRight), klar: false };
  }
  const d = synlig ? dekoration(cs, w, h, ktx) : { under: "", over: "" };
  let inne;
  if (el instanceof SVGSVGElement) inne = svgInnehall(el, cs, w, h, ktx);
  else if (el.localName === "img") inne = synlig ? bild(el, cs, w, h, ktx, r.L) : "";
  else if (el.localName === "canvas") inne = synlig ? canvasBild(el, cs, w, h) : "";
  else {
    inne = barn(el, cs, ram, ktx);
    if (inne && cs.overflowX !== "visible") {
      const rad = /^(\d|\.)/.test(cs.borderTopLeftRadius) ? Math.min(px(cs.borderTopLeftRadius), w / 2, h / 2) : 0;
      const cid = ktx.def(`clip:${f(w)}x${f(h)}r${f(rad)}`, (id) =>
        `<clipPath id="${id}"><rect width="${f(w)}" height="${f(h)}"${rad ? ` rx="${f(rad)}"` : ""}/></clipPath>`);
      inne = `<g clip-path="url(#${cid})">${inne}</g>`;
    }
  }
  return d.under + inne + d.over;
}

/** Innehållsboxens läge (border + padding) – ersatta element ritas där. */
const innehallsBox = (cs, w, h) => {
  const x = px(cs.borderLeftWidth) + px(cs.paddingLeft), y = px(cs.borderTopWidth) + px(cs.paddingTop);
  return { x, y, w: w - x - px(cs.borderRightWidth) - px(cs.paddingRight), h: h - y - px(cs.borderBottomWidth) - px(cs.paddingBottom) };
};
const PAR = { fill: "none", contain: "xMidYMid meet", cover: "xMidYMid slice", "scale-down": "xMidYMid meet" };

/** <img> → <image> med data-URL (löses efter genomgången), nedskalad till visad storlek. */
function bild(el, cs, w, h, ktx, L) {
  if (!el.complete || !el.naturalWidth) return "";
  const b = innehallsBox(cs, w, h);
  const bredd = Math.ceil(b.w * (linSkala(L) / ktx.lagerSkala) * ktx.bildPx);
  return `<image href="${ktx.bild(el.currentSrc || el.src, bredd, el)}" x="${f(b.x)}" y="${f(b.y)}" width="${f(b.w)}" height="${f(b.h)}" preserveAspectRatio="${PAR[cs.objectFit] || "none"}"/>`;
}

function canvasBild(el, cs, w, h) {
  try {
    const b = innehallsBox(cs, w, h);
    return `<image href="${el.toDataURL()}" x="${f(b.x)}" y="${f(b.y)}" width="${f(b.w)}" height="${f(b.h)}" preserveAspectRatio="none"/>`;
  } catch { return ""; } // tainted canvas – hoppa hellre än att smitta spegeln
}

// --- SVG-serialisering --------------------------------------------------------------
/** var(--x[, fallback]) → värdet i originalnodens computed style. */
function losVars(v, cs) {
  return v.replace(/var\((--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g, (_, namn, fb) => cs.getPropertyValue(namn).trim() || (fb || "").trim());
}

const escA = (v) => v.replace(/[&<"]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&quot;"));
const escT = (v) => v.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));

/**
 * Serialisera `o` (+ delträdet) DIREKT ur originalträdet till XML-sträng och
 * laga noderna i flykten enligt regel 1, 2, 3, 7, 8 – ingen kloning, inga
 * DOM-skrivningar (kloning + XMLSerializer var den dyraste delen i 25-husbyn,
 * och FO-avatarerna klonades dessutom två gånger). Kommentarer hoppas över.
 * @param {Element} o
 * @param {object} ktx
 * @param {{amb:Set<Element>, ign:Set<Element>}} sp  ambient/ignorera i delträdet
 * @param {{ers:Record<string,string|null>, stil:string}|null} rot  bara för roten:
 *   attribut som ersätts (null = tas bort) + stil som läggs till
 */
function nodStrang(o, ktx, sp, rot) {
  let cs = null, extra = "", fid = null;
  if (!rot) {
    if (sp.ign.has(o) || ktx.hoppa?.has(o)) return "";
    if (sp.amb.has(o)) { ktx.ambient.push(o); return ""; }
    if (o.localName === "foreignObject") return foInnehall(o, ktx);
    // CSS-styrda noder (klass/id): baka in transform/opacitet/visibility/filter
    // i det AKTUELLA läget (hover, transition, frusen animation).
    if (o.hasAttribute("class") || o.hasAttribute("id")) {
      cs = getComputedStyle(o);
      if (cs.display === "none") return "";
      if (cs.transform !== "none") extra += `;transform:${cs.transform};transform-origin:${cs.transformOrigin};transform-box:${cs.transformBox}`;
      if (cs.opacity !== "1") extra += `;opacity:${cs.opacity}`;
      if (cs.visibility !== "visible" && !ktx.ignVis) extra += ";visibility:hidden";
      if (extra) extra += ";animation:none;transition:none";
      fid = ktx.filter(cs.filter);
    }
  }
  const tag = o.localName;
  let attrs = "", stil = "";
  for (const a of o.attributes) {
    const n = a.name;
    if ((rot && n in rot.ers) || (fid && n === "filter")) continue;
    let v = a.value;
    if (v.includes("var(") && VAR_ATTR.includes(n)) v = losVars(v, (cs ||= getComputedStyle(o)));
    if (n === "style") stil = v;
    else attrs += ` ${n}="${escA(v)}"`;
  }
  if (fid) attrs += ` filter="url(#${fid})"`;
  if (rot) {
    for (const n in rot.ers) if (rot.ers[n] != null) attrs += ` ${n}="${escA(rot.ers[n])}"`;
    extra += `;${rot.stil}`;
  }
  if (extra) stil = stil ? `${stil}${extra}` : extra.slice(1);
  if (stil) attrs += ` style="${escA(stil)}"`;
  let inne = "";
  for (const c of o.childNodes) {
    if (c.nodeType === 1) inne += nodStrang(c, ktx, sp, null);
    else if (c.nodeType === 3 || c.nodeType === 4) inne += escT(c.data);
  }
  return inne ? `<${tag}${attrs}>${inne}</${tag}>` : `<${tag}${attrs}/>`;
}

/** Serialisera ett svg-delträd från roten `rot` (ambient/ignorera slås upp en gång). */
function svgStrang(rotEl, ktx, rot) {
  const sp = {
    amb: new Set(ktx.amb ? rotEl.querySelectorAll(ktx.amb) : []),
    ign: new Set(ktx.ign ? rotEl.querySelectorAll(ktx.ign) : []),
  };
  return nodStrang(rotEl, ktx, sp, rot);
}

/** foreignObject → <g> med dess HTML speglad i FO:ns användarkoordinater (regel 2). */
function foInnehall(fo, ktx) {
  const sm = fo.getScreenCTM();
  if (!sm) return "<g/>";
  const ctm = DOMMatrix.fromMatrix(sm);
  const cs = getComputedStyle(fo);
  const ram = { M: ctm, L: new DOMMatrix([ctm.a, ctm.b, ctm.c, ctm.d, 0, 0]), inv: ctm.inverse(), ell: null };
  let inne = barn(fo, cs, ram, ktx);
  if (cs.overflowX !== "visible") {
    const [x, y, w, h] = ["x", "y", "width", "height"].map((a) => fo[a].baseVal.value);
    const cid = ktx.def(`foclip:${x},${y},${w},${h}`, (id) => `<clipPath id="${id}"><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"/></clipPath>`);
    inne = `<g clip-path="url(#${cid})">${inne}</g>`;
  }
  return `<g>${inne}</g>`;
}

/** Ärvda presentationsegenskaper från HTML-sammanhanget (fill/color/font …). */
const arvStil = (cs) => ARV.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";");

/** En <svg> i HTML → nästlad <svg> i boxens px (viewBox/klippning sköts av SVG-motorn). */
function svgInnehall(svg, cs, w, h, ktx) {
  const b = innehallsBox(cs, w, h);
  const ers = { x: f(b.x), y: f(b.y), width: f(b.w), height: f(b.h), overflow: cs.overflowX === "visible" ? "visible" : "hidden",
    style: null, class: null, id: null, role: null, tabindex: null, "aria-label": null, "aria-hidden": null, focusable: null };
  return svgStrang(svg, ktx, { ers, stil: arvStil(cs) });
}

/** Lagrets ram (box-px → viewport), oberoende av om lagret står skalat just nu. */
function lagerRam(lagerEl) {
  const cs = getComputedStyle(lagerEl);
  return { cs, ...elementRam(lagerEl, cs, kedjaLinjar(lagerEl.parentElement)) };
}

/**
 * Spegla ett lager I VILA till EN fristående SVG-sträng i lagrets px.
 * @param {HTMLElement} lagerEl  .varld-lager-elementet
 * @param {HTMLElement} stageEl  staget (fångstytan när profil.fangst = "stage")
 * @param {{ambient?:string|string[], ignorera?:string|string[], fangst?:"stage"|"lager",
 *   neutraliseraObjekt?:string|string[]}} [profil]
 * @returns {Promise<{svg:string,w:number,h:number,ox:number,oy:number,nyckel:string,ambient:Element[],ms:number}>}
 *   ox/oy/w/h = fångstytan i lagrets px (kan vara negativ, #373); ambient =
 *   utelämnade levande noder; ms = kostnad (synkron genomgång + väntan).
 */
export async function speglaLager(lagerEl, stageEl, profil = {}) {
  const t0 = performance.now();
  const neutral = neutraliseraObjekt(lagerEl, sel(profil?.neutraliseraObjekt));
  const r = lagerRam(lagerEl);
  const ktx = nyKtx(profil, lagerEl, r.L);
  ktx.hoppa = neutral?.hoppa;
  const inv = r.M.inverse();
  let ox = 0, oy = 0, w = r.w, h = r.h;
  if (profil?.fangst !== "lager" && stageEl) {
    const sr = stageEl.getBoundingClientRect();
    const a = inv.transformPoint(new DOMPoint(sr.left, sr.top));
    const b = inv.transformPoint(new DOMPoint(sr.right, sr.bottom));
    ox = Math.min(a.x, b.x); oy = Math.min(a.y, b.y);
    w = Math.abs(b.x - a.x); h = Math.abs(b.y - a.y);
  }
  let kropp;
  try { kropp = boxInnehall(lagerEl, r.cs, r, ktx); } finally { neutral?.stad(); }
  const synkMs = performance.now() - t0;
  const svg = await slutfor(kropp, ktx, `width="${f(w)}" height="${f(h)}" viewBox="${f(ox)} ${f(oy)} ${f(w)} ${f(h)}"`);
  return { svg, w, h, ox, oy, nyckel: hash(svg), ambient: ktx.ambient, ms: performance.now() - t0, synkMs };
}

/**
 * Spegla EN nod (ambient-sprite, fokus-överlägg) i dess aktuella, frysta läge.
 * Spriten ritas i nodens EGNA koordinater UTAN dess egen transform/opacitet:
 *   svg    – fristående SVG som täcker `rect`
 *   rect   – {x,y,w,h} i nodens lokala koordinater (box-px resp. SVG-användarenheter)
 *   matrix – lokala koordinater → lagrets px (inkl. nodens aktuella transform)
 *   opacity– effektiv opacitet (nod × förfäder upp till lagret)
 * Rita alltså spriten med matrix·translate(rect.x, rect.y), storlek rect.w×rect.h.
 * @param {{bildZoom?:number}} [opt]  största skala spriten ritas i (<img>-upplösning)
 */
export async function speglaNod(nod, lagerEl, opt = {}) {
  const lr = lagerRam(lagerEl);
  const ktx = nyKtx(opt, lagerEl, lr.L);
  const lagerInv = lr.M.inverse();
  let opacity = 1;
  for (let e = nod; e && e !== lagerEl; e = e.parentElement) opacity *= +getComputedStyle(e).opacity;
  let kropp, rect, matrix, nodInv;
  if (nod instanceof SVGElement && !(nod instanceof SVGSVGElement && !(nod.parentNode instanceof SVGElement))) {
    // Nod INUTI en svg: rita dess delträd i nodens egna användarkoordinater.
    const ctm = DOMMatrix.fromMatrix(nod.getScreenCTM());
    matrix = lagerInv.multiply(ctm);
    nodInv = ctm.inverse();
    const bb = nod.getBBox();
    const pad = 4;
    rect = { x: bb.x - pad, y: bb.y - pad, w: bb.width + 2 * pad, h: bb.height + 2 * pad };
    // Nodens egen transform/opacitet bärs av matrix/opacity – inte av spriten.
    const egen = svgStrang(nod, ktx, { ers: { transform: null, opacity: null }, stil: "transform:none;opacity:1;animation:none" });
    kropp = `<g style="${esc(arvStil(getComputedStyle(nod.parentElement)))}">${egen}</g>`;
  } else {
    const cs = getComputedStyle(nod);
    const r = elementRam(nod, cs, kedjaLinjar(nod.parentElement));
    matrix = lagerInv.multiply(r.M);
    nodInv = r.M.inverse();
    kropp = boxInnehall(nod, cs, r, ktx);
    const fid = ktx.filter(cs.filter);
    if (fid) kropp = `<g filter="url(#${fid})">${kropp}</g>`;
    // Täckning: unionen av nodens och ättlingarnas rutor, i nodens box-px (+ skuggmarginal).
    const inv = r.M.inverse();
    let x0 = 0, y0 = 0, x1 = r.w, y1 = r.h;
    for (const e of nod.querySelectorAll("*")) {
      const b = e.getBoundingClientRect();
      if (!b.width && !b.height) continue;
      for (const [px_, py] of [[b.left, b.top], [b.right, b.top], [b.left, b.bottom], [b.right, b.bottom]]) {
        const p = inv.transformPoint(new DOMPoint(px_, py));
        x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
      }
    }
    const pad = 6;
    rect = { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
  }
  const k = forfaderKlipp(nod, lagerEl, nodInv, ktx);
  kropp = k.oppna + kropp + k.stang;
  const svg = await slutfor(kropp, ktx, `width="${f(rect.w)}" height="${f(rect.h)}" viewBox="${f(rect.x)} ${f(rect.y)} ${f(rect.w)} ${f(rect.h)}" overflow="hidden"`);
  return { svg, rect, matrix, opacity, nyckel: hash(svg) };
}
