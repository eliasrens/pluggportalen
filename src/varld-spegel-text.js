// ============================================================================
// Pluggporten – HTML-text → SVG-<text> för världsspeglingen (#416, F2/#396)
// ----------------------------------------------------------------------------
// Regel 4 i docs/pixi-arkitektur-396.md §2.3b: namnpiller, "Du!"-brickan,
// områdesskyltar, djurens namnlappar och emoji speglas som <text> med samma
// computed font/vikt/storlek/färg som DOM:en. Positionen tas ur textnodens
// egna rutor (Range) mappade till ramens lokala px, baslinjen ur
// canvas.measureText (font-ascent/descent) och text-overflow: ellipsis mäts
// fram tecken för tecken. Raderna delas när texten radbryts.
// Laddas bara via import() (aldrig i bootgrafen).
// ============================================================================

import { esc, farg } from "./varld-spegel-html.js";

const f = (n) => (Math.round(n * 1000) / 1000).toString();
let matKtx = null;
const ktx = () => (matKtx ||= document.createElement("canvas").getContext("2d"));

const TT = { uppercase: (s) => s.toUpperCase(), lowercase: (s) => s.toLowerCase(), capitalize: (s) => s.replace(/(^|\s)(\S)/g, (_, a, b) => a + b.toUpperCase()) };
let intervall = null;

/** Dela [a, b) i rader utifrån teckenrutornas lokala y (bara när texten radbryts). */
function rader(nod, a, b, inv) {
  const r = (intervall ||= document.createRange());
  const ut = [];
  let start = a, y0 = null;
  for (let i = a; i < b; i++) {
    r.setStart(nod, i); r.setEnd(nod, i + 1);
    const rc = r.getBoundingClientRect();
    if (!rc.width && !rc.height) continue;
    const y = inv.transformPoint(new DOMPoint(rc.left + rc.width / 2, rc.top + rc.height / 2)).y;
    if (y0 != null && Math.abs(y - y0) > 2) { ut.push([start, i]); start = i; }
    y0 = y;
  }
  ut.push([start, b]);
  return ut;
}

/**
 * En HTML-textnod → <text>-element i ramens lokala px. `ram.inv` mappar
 * viewport → lokala px; `ram.ell` (om satt) = ellipsis-kant {hoger, klar}.
 */
export function textSvg(nod, cs, ram, filterId) {
  const data = nod.data;
  const i0 = data.search(/\S/);
  if (i0 < 0) return "";
  const i1 = data.length - /\s*$/.exec(data)[0].length;
  const r = (intervall ||= document.createRange());
  r.setStart(nod, i0); r.setEnd(nod, i1);
  const flera = r.getClientRects().length > 1;
  const delar = flera ? rader(nod, i0, i1, ram.inv) : [[i0, i1]];
  const k = ktx();
  k.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  k.letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
  const omvandla = TT[cs.textTransform] || ((s) => s);
  const attr = ` font-family="${esc(cs.fontFamily)}" font-size="${cs.fontSize}" font-weight="${cs.fontWeight}"` +
    (cs.fontStyle !== "normal" ? ` font-style="${cs.fontStyle}"` : "") +
    (cs.letterSpacing !== "normal" ? ` letter-spacing="${cs.letterSpacing}"` : "") +
    ` fill="${farg(cs.color)}"${filterId ? ` filter="url(#${filterId})"` : ""} style="white-space:pre"`;
  let ut = "";
  for (const [a, b] of delar) {
    if (ram.ell?.klar) break;
    r.setStart(nod, a); r.setEnd(nod, b);
    const rc = r.getBoundingClientRect();
    let text = omvandla(data.slice(a, b).replace(/\s+/g, " ").trim());
    if (!text || (!rc.width && !rc.height)) continue;
    const m = k.measureText(text);
    const c = ram.inv.transformPoint(new DOMPoint(rc.left + rc.width / 2, rc.top + rc.height / 2));
    const asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent;
    const x = c.x - m.width / 2;
    const bas = c.y - (asc + desc) / 2 + asc;
    if (ram.ell && x + m.width > ram.ell.hoger + 0.5) {
      // text-overflow: ellipsis – längsta prefix som får plats med "…".
      const plats = ram.ell.hoger - x;
      let lo = 0, hi = text.length;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (k.measureText(text.slice(0, mid) + "…").width <= plats) lo = mid; else hi = mid - 1;
      }
      // Som Chromium: ellipsen sätts direkt efter sista tecknet som får plats
      // (ett avslutande mellanslag behålls – "långt …").
      text = text.slice(0, lo) + "…";
      ram.ell.klar = true;
      if (plats <= 0) break;
    }
    ut += `<text x="${f(x)}" y="${f(bas)}"${attr}>${esc(text)}</text>`;
  }
  return ut;
}
