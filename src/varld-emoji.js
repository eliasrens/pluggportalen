// ============================================================================
// Pluggporten – färg-emoji i Pixi-rörelsen: detektion + text-reserv (#396, G1 #425)
// ----------------------------------------------------------------------------
// Speglingen (F2) ritar emoji som SVG-<text>, och webbläsarens SVG-motor
// rastrerar dem i SVG-som-bild. Om den bilden saknar färg-emoji (desk har
// ingen färg-emojifont alls; Chromebookens SVG-bild är okänd tills Elias
// provat) ritas emojin i stället som TEXT-SPRITES – exakt det Pixi `Text` gör
// internt: canvas-2D fillText (som har färg-emoji när DOM:en har det) → en
// textur. Spriterna rastreras här på main (samma fontregister som DOM:en) och
// läggs som ett eget överlägg ovanpå lagrets pyramid, och glyferna i spegelns
// SVG görs osynliga (fill-opacity 0 – layouten och resten av texten orörd).
//
//   upptack()            async: { svgFarg, canvasFarg, lage, orsak }
//   emojiLage()          "svg" (ingen reserv) | "text" (reserven på)
//   doljEmoji(spegel)    spegel med osynliga emoji-glyfer (bara i "text"-läge)
//   emojiOverlagg(el, maxSkala, yta, ignorera) → { ids, klart } (bara i "text"-läge)
//
// Läge: localStorage pp:pixi:emoji = "text" | "svg" tvingar; annars auto =
// "text" om canvas-2D har färg men SVG-bilden inte har det.
// Laddas bara via import() (varld-motor-textur.js) – aldrig i bootgrafen.
// ============================================================================

import { konfiguration } from "./varld-textur.js";
import { elementRam, kedjaLinjar } from "./varld-spegel-html.js";

/** En emoji-följd: keycap, eller piktogram/flagga + variation, ZWJ-sekvenser, hudton. */
const EMOJI = /[#*0-9]\uFE0F?\u20E3|(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:\uFE0F|\u20E3|\p{Emoji_Modifier}|\u200D(?:\p{Extended_Pictographic}|\p{Regional_Indicator})|\p{Regional_Indicator})*/gu;
const harEmoji = (s) => { EMOJI.lastIndex = 0; return EMOJI.test(s); };
const MAX_EMOJI = 300;
const PROV = "😀";

let resultat = null; // { svgFarg, canvasFarg, lage, orsak }
let pagaende = null;

function flagga() {
  try {
    const v = localStorage.getItem("pp:pixi:emoji");
    return v === "text" || v === "svg" ? v : null;
  } catch {
    return null;
  }
}

/** "text" = rita emoji som text-sprites (reserven), "svg" = låt SVG-bilden rita dem. */
export function emojiLage() {
  return flagga() || resultat?.lage || "svg";
}

/** Har ritningen färgade pixlar (inte svart/grå glyf eller tofu)? */
async function farg(rita) {
  const c = new OffscreenCanvas(40, 40);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  await rita(ctx);
  const d = ctx.getImageData(0, 0, 40, 40).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 48) n++;
  }
  return n > 20;
}

/**
 * Detektera (en gång): ritar 😀 som SVG-som-bild och med canvas-2D fillText,
 * i appens egen font-familj, och letar färgade pixlar.
 * @returns {Promise<{svgFarg:boolean, canvasFarg:boolean, lage:"svg"|"text", orsak:string}>}
 */
export function upptack() {
  if (resultat) return Promise.resolve(resultat);
  pagaende ||= (async () => {
    const fam = (getComputedStyle(document.body).fontFamily || "sans-serif").replace(/"/g, "'");
    let svgFarg = false, canvasFarg = false;
    try {
      canvasFarg = await farg((ctx) => {
        ctx.font = `30px ${fam}`;
        ctx.fillText(PROV, 2, 32);
      });
    } catch { /* ingen OffscreenCanvas-2D */ }
    try {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><text x="2" y="32" font-size="30" font-family="${fam}">${PROV}</text></svg>`;
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        svgFarg = await farg((ctx) => ctx.drawImage(img, 0, 0));
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch { /* avkodning misslyckades → räknas som ingen färg */ }
    const lage = canvasFarg && !svgFarg ? "text" : "svg";
    const orsak = svgFarg ? "svg-har-farg" : canvasFarg ? "bara-canvas-har-farg" : "ingen-fargfont";
    resultat = { svgFarg, canvasFarg, lage, orsak };
    return resultat;
  })();
  return pagaende;
}

/** Emoji-läget som nyckel-suffix: en pyramid byggd i "svg"-läge får aldrig återanvändas i "text". */
export const emojiNyckel = () => (emojiLage() === "text" ? "|emoji-text" : "");

/**
 * Gör emoji-glyferna i spegelns <text>-element osynliga (fill/stroke-opacity 0).
 * Glyferna står kvar → resten av raden ligger exakt där den låg.
 * @param {{svg:string, nyckel:string}} spegel
 */
export function doljEmoji(spegel) {
  if (emojiLage() !== "text" || !harEmoji(spegel.svg)) return spegel;
  // Bara textinnehållet i <text>…</text> (taggar som <tspan> lämnas orörda).
  const svg = spegel.svg.replace(/(<text\b[^>]*>)([\s\S]*?)(<\/text>)/g, (_, a, inne, b) =>
    a + inne.split(/(<[^>]*>)/).map((d) => (d.startsWith("<") ? d : dolj(d))).join("") + b);
  return { ...spegel, svg, nyckel: spegel.nyckel + emojiNyckel() };
}
const dolj = (t) => t.replace(EMOJI, (e) => `<tspan fill-opacity="0" stroke-opacity="0">${e}</tspan>`);

/** Effektiv opacitet för noden upp till (men inte med) lagret; 0 = syns inte. */
function opacitet(nod, lager, ignVis, ign) {
  let o = 1;
  for (let e = nod; e && e !== lager; e = e.parentElement) {
    if (ign && e.matches(ign)) return 0;
    const cs = getComputedStyle(e);
    if (cs.display === "none" || (!ignVis && cs.visibility !== "visible")) return 0;
    o *= +cs.opacity;
    if (!o) return 0;
  }
  return o;
}

/**
 * Lagrets synliga emoji som text-sprites (en tegel per emoji) i en egen
 * behållare i workern, rastrerade för största skalan `maxSkala`. Läser DOM:en
 * SYNKRONT (den är frusen vid handoff). Koordinater i lager-px.
 * @param {HTMLElement} el  lagret
 * @param {number} maxSkala
 * @param {{satLager:Function}} yta
 * @param {string} [ignorera]  profilens ignorera-selektor
 * @returns {{ids:string[], klart:Promise<void>}}
 */
export function emojiOverlagg(el, maxSkala, yta, ignorera = "") {
  const tom = { ids: [], klart: Promise.resolve() };
  if (emojiLage() !== "text" || !harEmoji(el.textContent || "")) return tom;
  const M = lagerMatris(el);
  if (!M) return tom;
  const inv = M.inverse();
  const ignVis = getComputedStyle(el).visibility === "hidden";
  const k = konfiguration();
  const r = document.createRange();
  const ctx = new OffscreenCanvas(1, 1).getContext("2d");
  const tegel = [];
  const varv = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (harEmoji(n.data) ? 1 : 3) });
  for (let nod = varv.nextNode(); nod && tegel.length < MAX_EMOJI; nod = varv.nextNode()) {
    const forald = nod.parentElement;
    const op = forald ? opacitet(forald, el, ignVis, ignorera) : 0;
    if (!op) continue;
    const cs = getComputedStyle(forald);
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    EMOJI.lastIndex = 0;
    for (const m of nod.data.matchAll(EMOJI)) {
      r.setStart(nod, m.index);
      r.setEnd(nod, m.index + m[0].length);
      const rc = r.getBoundingClientRect();
      if (rc.width < 0.5 || rc.height < 0.5) continue;
      const h = [[rc.left, rc.top], [rc.right, rc.top], [rc.left, rc.bottom], [rc.right, rc.bottom]].map(([x, y]) => inv.transformPoint(new DOMPoint(x, y)));
      const x = Math.min(...h.map((p) => p.x)), y = Math.min(...h.map((p) => p.y));
      const w = Math.max(...h.map((p) => p.x)) - x, hh = Math.max(...h.map((p) => p.y)) - y;
      const bmp = rastrera(ctx, m[0], font, cs.color, op, w, hh, maxSkala * k.dpr, k.budget.tegel);
      if (bmp) tegel.push({ bmp, x, y, w, h: hh });
      if (tegel.length >= MAX_EMOJI) break;
    }
  }
  if (!tegel.length) return tom;
  const id = `emoji${++nr}`;
  const klart = yta.satLager(id, { nivaer: [{ z: 1e3, region: { x: 0, y: 0, w: 0, h: 0 }, tegel, bytes: 0 }] });
  return { ids: [id], klart };
}
let nr = 0;

/** Lagrets box-px → viewport (inkl. kamerans transform) – samma som lagerGeo i motorn. */
function lagerMatris(el) {
  try {
    return elementRam(el, getComputedStyle(el), kedjaLinjar(el.parentElement)).M;
  } catch {
    return null;
  }
}

/** En emoji → ImageBitmap i `skala` enhets-px per lager-px (canvas-2D fillText = Pixi Text). */
function rastrera(matKtx, text, font, farg, op, w, h, skala, tegelMax) {
  const s = Math.min(skala, tegelMax / Math.max(w, h, 1), 512 / Math.max(w, h, 1));
  const W = Math.max(1, Math.ceil(w * s)), H = Math.max(1, Math.ceil(h * s));
  matKtx.font = font;
  const m = matKtx.measureText(text);
  if (!(m.width > 0)) return null;
  // Glyfens skala i lagret: rutans bredd / glyfens bredd i computed font-size.
  const g = w / m.width;
  const asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent;
  const duk = new OffscreenCanvas(W, H);
  const ctx = duk.getContext("2d");
  ctx.setTransform(s * g, 0, 0, s * g, 0, 0);
  ctx.font = font;
  ctx.fillStyle = farg;
  ctx.globalAlpha = op;
  ctx.textBaseline = "alphabetic";
  // Som textSvg (varld-spegel-text.js): baslinjen ur font-ascent/descent, centrerad i rutan.
  const hg = h / g;
  ctx.fillText(text, 0, hg / 2 - (asc + desc) / 2 + asc);
  return duk.transferToImageBitmap();
}
