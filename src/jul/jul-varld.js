// ============================================================================
// Pluggporten – julen i världen, på porten och i lärarspärren (#909, epic #906,
// UTVECKLINGSUPPDRAG_VINTER_JUL.md C.1–C.3)
// ----------------------------------------------------------------------------
// Laddas av season-world.js med import() FÖRST när Jul är på – sommar, höst
// och vinter utan Jul ritas alltså exakt som förut (inget i deras konst eller
// bootgraf ändras, #271). Julen läggs in som ett eget lager i de redan ritade
// scenerna (konsten i jul-art-varld.js), ungefär som Halloween-djuret som
// vinkar fylls i på porten:
//   • husen i byn (.by-tomt) och huset ute (#husgrupp): en ljusslinga längs
//     takkanten + en adventsstjärna i ett fönster. Takkanten tas GENERISKT ur
//     husets silhuett (rastreras en gång per husskal), så alla husskal – även
//     Halloween-husen, de legendariska och framtida – får en slinga.
//   • byn: julgran med ljus, stjärna och klappar vid lägerelden (Klasscentret)
//   • skolan (områdesnivån): en julbock
//   • gården: en tomte som vinkar · rumsfönstret: en ljusslinga
//   • porten och lärarspärren: kvällshimlens stjärnor, måne och norrsken +
//     slinga, granris, julgran, tomte och snölyktor (jul-art-varld.js)
// Scenerna ritas om (byn, huset vid skalbyte, rummet …) – en MutationObserver
// per monterad scen lägger då in julen igen. Allt bär .julv-dekor, som döljs
// när Jul slås av (styles/53-jul.css).
// ============================================================================

import {
  ljusslinga, langsLinje, adventsstjarna, julgran, julklappar, julbock, tomte,
  portJul, gateJul, fonsterJul,
} from "./jul-art-varld.js";

const SVGNS = "http://www.w3.org/2000/svg";

/** SVG-markup → fragment (tolkat i SVG-namnrymden). */
function svgFragment(markup) {
  const t = document.createElementNS(SVGNS, "svg");
  t.innerHTML = markup;
  const fr = document.createDocumentFragment();
  while (t.firstChild) fr.appendChild(t.firstChild);
  return fr;
}

// --- Takkanten ur husets silhuett ------------------------------------------

/** Ytan (husens scenkoordinater, art-hus-ute.js) som rastreras – K px per enhet. */
const RUTA = { x: 150, y: 0, w: 660, h: 600 };
const K = 0.5;

/**
 * Takkanten ur en rastrerad silhuett (alfa = RGBA-data, B × H px). För varje
 * kolumn: översta täckta pixeln. Smala utstick (skorstenar, flaggstänger,
 * tinnar, rök) tas bort med en morfologisk öppning (bredd `oppning` enheter),
 * så slingan följer själva taket. Ut: den längsta sammanhängande kanten som
 * polylinje i scenkoordinater, `inset` enheter in under kanten.
 */
export function takLinje(alfa, B, H, { x0 = RUTA.x, y0 = RUTA.y, k = K, oppning = 44, inset = 3 } = {}) {
  const topp = new Array(B).fill(Infinity);
  for (let c = 0; c < B; c++) {
    for (let r = 0; r < H; r++) {
      if (alfa[(r * B + c) * 4 + 3] > 60) {
        topp[c] = r;
        break;
      }
    }
  }
  const w = Math.max(1, Math.round((oppning * k) / 2));
  const ero = topp.map((_, c) => {
    let m = -Infinity;
    for (let i = c - w; i <= c + w; i++) m = Math.max(m, i < 0 || i >= B ? Infinity : topp[i]);
    return m;
  });
  const dil = ero.map((_, c) => {
    let m = Infinity;
    for (let i = Math.max(0, c - w); i <= Math.min(B - 1, c + w); i++) m = Math.min(m, ero[i]);
    return m;
  });
  let bast = [0, -1];
  for (let c = 0, start = -1; c <= B; c++) {
    const ok = c < B && Number.isFinite(dil[c]);
    if (ok && start < 0) start = c;
    if (!ok && start >= 0) {
      if (c - 1 - start > bast[1] - bast[0]) bast = [start, c - 1];
      start = -1;
    }
  }
  const linje = [];
  for (let c = bast[0]; c <= bast[1]; c += 2) linje.push([x0 + (c + 0.5) / k, y0 + dil[c] / k + inset]);
  return linje.length > 1 && linje[linje.length - 1][0] - linje[0][0] > 40 ? linje : [];
}

/** Husets konst (utan avatar, rök, snötäcke, säsongsdekor och julen) som fristående SVG. */
function husKopia(mal) {
  const svg = document.createElementNS(SVGNS, "svg");
  for (const n of mal.childNodes) svg.appendChild(n.cloneNode(true));
  for (const n of svg.querySelectorAll(
    "foreignObject, image, .hus-rok, .sz-bara-host, .sz-bara-vinter, .sz-bara-halloween, .sz-bara-jul, .julv-dekor"
  ))
    n.remove();
  svg.setAttribute("xmlns", SVGNS);
  svg.setAttribute("viewBox", `${RUTA.x} ${RUTA.y} ${RUTA.w} ${RUTA.h}`);
  return svg;
}

/**
 * Ett fönster att hänga adventsstjärnan i: husskalen ritar fönsterglaset med
 * --hus-wall. Det SIST ritade lagom stora (svamphusets prickar ritas före
 * fönstren). Mäts i en dold kopia (fungerar även när byn är dold).
 */
function hittaFonster(kopia) {
  const vard = document.createElementNS(SVGNS, "svg");
  vard.setAttribute("viewBox", `${RUTA.x} ${RUTA.y} ${RUTA.w} ${RUTA.h}`);
  vard.setAttribute("width", RUTA.w);
  vard.setAttribute("height", RUTA.h);
  vard.setAttribute("aria-hidden", "true");
  vard.style.cssText = "position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none";
  vard.innerHTML = kopia.innerHTML;
  document.body.appendChild(vard);
  try {
    const bas = vard.getBoundingClientRect();
    let fonster = null;
    for (const el of vard.querySelectorAll('[fill="var(--hus-wall)"]')) {
      const b = el.getBoundingClientRect();
      if (b.width >= 26 && b.height >= 26 && b.width <= 200 && b.height <= 200) {
        fonster = { x: b.left - bas.left + RUTA.x, y: b.top - bas.top + RUTA.y, w: b.width, h: b.height };
      }
    }
    return fonster;
  } finally {
    vard.remove();
  }
}

const husCache = new Map(); // husets markup → Promise<{linje, fonster}>

/** Takkanten + fönstret för ett hus (en gång per husskal och palett-oberoende). */
function husForm(mal) {
  const kopia = husKopia(mal);
  const nyckel = kopia.innerHTML;
  let p = husCache.get(nyckel);
  if (!p) {
    p = (async () => {
      kopia.setAttribute("width", RUTA.w * K);
      kopia.setAttribute("height", RUTA.h * K);
      const bild = new Image();
      bild.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(kopia))}`;
      await bild.decode();
      const c = document.createElement("canvas");
      c.width = RUTA.w * K;
      c.height = RUTA.h * K;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(bild, 0, 0, c.width, c.height);
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      return { linje: takLinje(data, c.width, c.height), fonster: hittaFonster(kopia) };
    })();
    husCache.set(nyckel, p);
  }
  return p;
}

/** Husets juldekor: slinga längs takkanten + adventsstjärna. `liten` = byns minihus. */
export function husJul({ linje, fonster }, { liten = false, fas = 0 } = {}) {
  const lampor = langsLinje(linje, liten ? 36 : 28);
  let stjarna = "";
  if (fonster) {
    const r = Math.max(11, Math.min(30, Math.min(fonster.w, fonster.h) * 0.3));
    stjarna = adventsstjarna(fonster.x + fonster.w / 2, fonster.y + fonster.h * 0.48, r);
  } else if (linje.length) {
    const [mx, my] = linje[Math.floor(linje.length / 2)];
    stjarna = adventsstjarna(mx, my + 70, 18);
  }
  return `<g class="julv-dekor julv-hus">${stjarna}${ljusslinga(lampor, { r: liten ? 10 : 7, fas })}</g>`;
}

const pagar = new WeakSet();
let husNr = 0;

function dekoreraHus(mal, liten) {
  if (pagar.has(mal) || mal.querySelector(":scope > .julv-hus")) return;
  pagar.add(mal);
  const fas = (husNr++ * 1.37) % 4.8;
  husForm(mal)
    .then((form) => {
      if (!mal.isConnected || mal.querySelector(":scope > .julv-hus") || !form.linje.length) return;
      mal.insertBefore(svgFragment(husJul(form, { liten, fas })), mal.querySelector(":scope > foreignObject"));
    })
    .catch(() => {}) // ren dekor – världen påverkas aldrig
    .finally(() => pagar.delete(mal));
}

// --- Byn, skolan, gården, rummet, porten och spärren -------------------------

const pct = (v) => parseFloat(v) || 0;

/** Julgranen med klappar vid lägerelden (Klasscentrets vänsterkant). */
function byGran(kc) {
  const lager = kc.parentElement;
  if (!lager || lager.querySelector(":scope > .julv-by-gran")) return;
  const tomt = lager.querySelector(":scope > .by-tomt");
  const s = Math.max(0.55, Math.min(1, (tomt ? pct(tomt.style.height) : 26) / 26));
  const x = pct(kc.style.left) - pct(kc.style.width) * 0.24;
  const y = pct(kc.style.top) + pct(kc.style.height) + 0.4;
  const div = document.createElement("div");
  div.className = "by-dekor julv-dekor julv-by-gran";
  div.setAttribute("aria-hidden", "true");
  div.style.cssText = `left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;width:${(10 * s).toFixed(2)}%;height:${(17 * s).toFixed(2)}%;z-index:${Math.round(y * 10)}`;
  div.innerHTML = `<svg viewBox="-62 -150 124 156" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false"
    xmlns="${SVGNS}">${julgran(0, 0)}${julklappar(14, 4, 0.75)}</svg>`;
  lager.appendChild(div);
}

/** Julbocken vid skolan (områdesnivån), nere till höger – fri från klass-byarna. */
function skolBock(lager) {
  if (lager.querySelector(":scope > .julv-skola-bock")) return;
  const div = document.createElement("div");
  div.className = "by-dekor julv-dekor julv-skola-bock";
  div.setAttribute("aria-hidden", "true");
  div.style.cssText = "left:91%;top:94%;width:10%;height:15%";
  div.innerHTML = `<svg viewBox="-46 -114 106 120" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false"
    xmlns="${SVGNS}">${julbock(0, 0)}</svg>`;
  lager.appendChild(div);
}

/** Lägg `markup` sist i `svg` en gång (märkt med klassen `klass`). */
function enGang(svg, klass, markup, fore = null) {
  if (svg.querySelector(`:scope > .${klass}`)) return;
  svg.insertBefore(svgFragment(markup), fore);
}

/**
 * Lägg in julen i allt som är ritat under `root` (idempotent – det som redan
 * har sin juldekor rörs inte).
 */
export function julFyll(root) {
  if (!root?.querySelectorAll) return;
  for (const svg of root.querySelectorAll('svg[aria-label="Porten till Pluggporten"]')) {
    const { bak, fram } = portJul();
    const himmel = svg.querySelector(":scope > rect");
    enGang(svg, "julv-port-bak", bak, himmel ? himmel.nextSibling : svg.firstChild);
    enGang(svg, "julv-port-fram", fram);
  }
  for (const svg of root.querySelectorAll(".sz-gate-svg")) enGang(svg, "julv-gate", gateJul());
  for (const svg of root.querySelectorAll("svg.room-window")) enGang(svg, "julv-fonster", fonsterJul());
  for (const svg of root.querySelectorAll('svg[aria-label="Gården på baksidan av huset"]')) {
    enGang(svg, "julv-gard", `<g class="julv-dekor julv-gard">${tomte(50, 576, 1.1)}</g>`);
  }
  for (const svg of root.querySelectorAll(".by-tomt > svg")) dekoreraHus(svg, true);
  for (const g of root.querySelectorAll('[id="husgrupp"]')) dekoreraHus(g, false);
  for (const kc of root.querySelectorAll(".by-klasscenter")) byGran(kc);
  for (const mark of root.querySelectorAll(".omrade-mark")) if (mark.parentElement) skolBock(mark.parentElement);
}

const bevakade = new Set();

/**
 * Fyll `root` nu och igen varje gång något ritas om därunder (byn, huset vid
 * skalbyte, rummet …). En observer per scen; en scen inne i en redan bevakad
 * (byns lager i världens stage) får ingen egen.
 */
export function julMontera(root) {
  julFyll(root);
  for (const r of bevakade) {
    if (!r.isConnected) bevakade.delete(r);
    else if (r.contains(root)) return;
  }
  bevakade.add(root);
  let planerad = false;
  new MutationObserver(() => {
    if (planerad || !document.documentElement.dataset.jul) return;
    planerad = true;
    requestAnimationFrame(() => {
      planerad = false;
      julFyll(root);
    });
  }).observe(root, { childList: true, subtree: true });
}
