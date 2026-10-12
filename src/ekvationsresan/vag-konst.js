// ============================================================================
// Ekvationsresan – vågens konst (src/ekvationsresan/vag-konst.js) · #617
// ----------------------------------------------------------------------------
// Kodritad SVG i Pluggportens stil (art-style.js): platt vektor, mjuka former,
// konturen #3B3350 (3 px, runda ändar) och portalens palett. Ingen DOM här –
// bara strängar, så konsten kan förhandsvisas och testas fritt.
//
//   VIEWBOX 0 0 800 420. Skålarnas ovansida: vänster (200, 296), höger
//   (600, 296). Bommen y = 338, stödet med "=" i mitten, visaren ovanför.
//   Varje bit ritas kring sin nederkant-mitt (0, 0) och växer uppåt.
//
// Teman (vag-visning.js THEMES): behållaren är ALLTID x – spargris, säck,
// korg med duk, frostad burk, paket med rosett – med en lapp "x". Föremålen:
// mynt, presenter, äpplen, kulor, småsaker (stjärna, boll, knapp, hjärta).
// ============================================================================

import { O } from "../art-style.js";
import { segsWidth, segWidth } from "./vag-layout.js";

export const VIEWBOX = Object.freeze({ w: 800, h: 420, top: 52 }); // top: ritytan börjar ovanför högsta stapeln
export const PAN_AT = Object.freeze({ L: { x: 200, y: 296 }, R: { x: 600, y: 296 } });

const L3 = `stroke="${O}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
const L2 = `stroke="${O}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const TEXT = `font-weight="800" text-anchor="middle" fill="${O}"`;

const BRIGHT = ["#EF6F6C", "#7FC7E8", "#6FC66F", "#B79BE0", "#F49E4C", "#F890B7"];

// --- vågen själv ------------------------------------------------------------------

/** Ställningen som står still: fot, stöd med "=" och visaren. */
export function standSvg() {
  return `
  <ellipse cx="400" cy="412" rx="250" ry="7" fill="${O}" opacity=".10"/>
  <rect x="300" y="394" width="200" height="18" rx="9" fill="#B0805A" ${L3}/>
  <rect x="312" y="397" width="176" height="5" rx="2.5" fill="#fff" opacity=".25"/>
  <path d="M400 340 L452 396 L348 396 Z" fill="#F2A93B" ${L3}/>
  <path d="M400 352 L418 372" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".4"/>
  <g transform="translate(400 384)">
    <rect x="-17" y="-14" width="34" height="22" rx="7" fill="#FFF3DC" ${L2}/>
    <rect x="-9" y="-8" width="18" height="3.6" rx="1.8" fill="${O}"/>
    <rect x="-9" y="-1" width="18" height="3.6" rx="1.8" fill="${O}"/>
  </g>
  <g class="ekv-visare">
    <path d="M370 252 A34 34 0 0 1 430 252" fill="none" stroke="#C9F0DC" stroke-width="9" stroke-linecap="round"/>
    <path d="M370 252 A34 34 0 0 1 430 252" fill="none" ${L2}/>
    <path d="M394 232 L406 232" stroke="#6FC66F" stroke-width="5" stroke-linecap="round"/>
    <path d="M400 330 L400 236" stroke="${O}" stroke-width="3.4" stroke-linecap="round"/>
    <circle cx="400" cy="236" r="4.5" fill="#EF6F6C" ${L2}/>
  </g>`;
}

/** Bommen och stagen (gungar med skålarna). */
export function beamSvg() {
  const stem = (x) => `<path d="M${x - 9} 320 L${x - 14} 338 L${x + 14} 338 L${x + 9} 320 Z" fill="#B0805A" ${L2}/>`;
  return `
  ${stem(200)}${stem(600)}
  <rect x="150" y="331" width="500" height="17" rx="8.5" fill="#F2A93B" ${L3}/>
  <rect x="162" y="334" width="476" height="4" rx="2" fill="#fff" opacity=".35"/>
  <circle cx="170" cy="339.5" r="4" fill="#FFF3DC" ${L2}/><circle cx="630" cy="339.5" r="4" fill="#FFF3DC" ${L2}/>
  <circle cx="400" cy="339.5" r="8" fill="#F7C948" ${L3}/>`;
}

/** En vågskål (ritas bakom bitarna). */
export function plateSvg() {
  return `
  <path d="M-168 6 Q-160 28 -120 28 L120 28 Q160 28 168 6 Z" fill="#7FC7E8" ${L3}/>
  <path d="M-150 16 Q-140 23 -112 23 L-40 23" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".45" fill="none"/>
  <rect x="-172" y="0" width="344" height="10" rx="5" fill="#A9C2DE" ${L3}/>`;
}

// --- text med bråkstreck ----------------------------------------------------------

/** Segment (notation.js) som SVG-text centrerad kring (cx, y = baslinje). */
export function segsSvg(segs, fs, cx, y, fill = O) {
  const total = segsWidth(segs, fs);
  let x = cx - total / 2;
  let out = "";
  for (const s of segs) {
    const w = segWidth(s, fs);
    const mx = x + w / 2;
    if (s.num) {
      const f = fs * 0.72;
      out += `<text x="${mx}" y="${y - fs * 0.42}" font-size="${f}" font-weight="800" text-anchor="middle" fill="${fill}">${esc(s.num)}</text>`;
      out += `<path d="M${mx - w / 2 + 3} ${y - fs * 0.3} L${mx + w / 2 - 3} ${y - fs * 0.3}" stroke="${fill}" stroke-width="${fs / 11}" stroke-linecap="round"/>`;
      out += `<text x="${mx}" y="${y + fs * 0.42}" font-size="${f}" font-weight="800" text-anchor="middle" fill="${fill}">${esc(s.den)}</text>`;
    } else {
      out += `<text x="${mx}" y="${y}" font-size="${fs}" font-weight="800" text-anchor="middle" fill="${fill}">${esc(s.text)}</text>`;
    }
    x += w;
  }
  return out;
}

// --- behållare (x) ------------------------------------------------------------------

const tag = `<g transform="translate(17 -50)"><rect x="-10" y="-9" width="21" height="19" rx="6" fill="#fff" ${L2}/><text x="0.5" y="6" font-size="17" font-style="italic" ${TEXT}>x</text></g>`;

const CONTAINERS = {
  spargris: () => `
    <path d="M-22 -26 Q-30 -32 -27 -38" fill="none" ${L2}/>
    <rect x="-17" y="-12" width="8" height="12" rx="3" fill="#F890B7" ${L2}/><rect x="9" y="-12" width="8" height="12" rx="3" fill="#F890B7" ${L2}/>
    <ellipse cx="0" cy="-27" rx="25" ry="19" fill="#F890B7" ${L3}/>
    <path d="M6 -44 L12 -54 L17 -41 Z" fill="#F890B7" ${L2}/>
    <ellipse cx="24" cy="-25" rx="7" ry="6.5" fill="#FFB1B8" ${L2}/>
    <circle cx="22" cy="-25" r="1.3" fill="${O}"/><circle cx="26" cy="-25" r="1.3" fill="${O}"/>
    <circle cx="13" cy="-33" r="2.4" fill="${O}"/><circle cx="7" cy="-24" r="3.5" fill="#FFB1B8" opacity=".9"/>
    <rect x="-11" y="-46" width="15" height="3.6" rx="1.8" fill="${O}"/>
    <path d="M-15 -36 Q-10 -41 -3 -42" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".5" fill="none"/>`,
  sack: () => `
    <path d="M-12 -40 Q-26 -30 -24 -12 Q-22 0 0 0 Q22 0 24 -12 Q26 -30 12 -40 Z" fill="#E7C38F" ${L3}/>
    <path d="M-12 -40 L-15 -52 Q0 -46 15 -52 L12 -40 Z" fill="#E7C38F" ${L2}/>
    <path d="M-13 -40 Q0 -36 13 -40" fill="none" stroke="#B0805A" stroke-width="4" stroke-linecap="round"/>
    <path d="M-13 -40 Q0 -36 13 -40" fill="none" ${L2}/>
    <path d="M-10 -24 Q-6 -14 -9 -6 M8 -28 Q12 -18 9 -8" stroke="#B0805A" stroke-width="2" stroke-linecap="round" fill="none"/>
    <path d="M-17 -30 Q-19 -20 -16 -12" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".45" fill="none"/>`,
  korg: () => `
    <path d="M-22 -32 Q0 -62 22 -32" fill="none" stroke="#8A6242" stroke-width="5" stroke-linecap="round"/>
    <path d="M-22 -32 Q0 -62 22 -32" fill="none" ${L2} stroke-width="1.6"/>
    <path d="M-26 -30 L-20 0 L20 0 L26 -30 Z" fill="#C99A63" ${L3}/>
    <path d="M-23 -20 L23 -20 M-21 -10 L21 -10 M-10 -30 L-8 0 M0 -30 L0 0 M10 -30 L8 0" stroke="#8A6242" stroke-width="2" stroke-linecap="round"/>
    <path d="M-28 -30 Q-20 -40 -6 -36 Q4 -42 14 -36 Q24 -40 28 -30 Q20 -26 10 -29 Q0 -25 -10 -29 Q-20 -26 -28 -30 Z" fill="#EF6F6C" ${L2}/>
    <path d="M-18 -33 L-14 -30 M-4 -35 L0 -31 M10 -34 L14 -31" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
  burk: () => `
    <rect x="-20" y="-44" width="40" height="44" rx="11" fill="#C7DCEE" ${L3}/>
    <rect x="-14" y="-38" width="5" height="26" rx="2.5" fill="#fff" opacity=".7"/>
    <rect x="-13" y="-28" width="28" height="18" rx="4" fill="#FFF3DC" ${L2}/>
    <text x="1" y="-14.5" font-size="14" ${TEXT}>?</text>
    <rect x="-17" y="-53" width="34" height="11" rx="4" fill="#EF6F6C" ${L3}/>
    <path d="M-11 -50 L-11 -45 M-4 -50 L-4 -45 M3 -50 L3 -45 M10 -50 L10 -45" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".6"/>`,
  paket: () => `
    <rect x="-24" y="-38" width="48" height="38" rx="5" fill="#B79BE0" ${L3}/>
    <rect x="-26" y="-44" width="52" height="10" rx="4" fill="#C9B6EC" ${L3}/>
    <rect x="-4" y="-44" width="8" height="44" fill="#F7C948" ${L2}/>
    <path d="M0 -44 Q-14 -58 -16 -48 Q-14 -42 0 -44 Q14 -58 16 -48 Q14 -42 0 -44 Z" fill="#F7C948" ${L2}/>
    <path d="M-18 -30 L-18 -8" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".4"/>`,
};

export function containerSvg(theme) {
  return (CONTAINERS[theme] || CONTAINERS.spargris)() + tag;
}

// --- föremål ---------------------------------------------------------------------------

const ITEMS = {
  mynt: () => `<circle cx="0" cy="-13" r="12" fill="#F7C948" ${L2}/><circle cx="0" cy="-13" r="7.5" fill="none" stroke="#E0A12E" stroke-width="2.2"/><path d="M-3 -18 Q0 -20 3 -18" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7" fill="none"/>`,
  present: (i) => `<rect x="-11" y="-20" width="22" height="20" rx="3" fill="${BRIGHT[i % BRIGHT.length]}" ${L2}/><rect x="-2.5" y="-20" width="5" height="20" fill="#FFF3DC"/><path d="M0 -20 Q-8 -28 -8 -22 Q-6 -19 0 -20 Q8 -28 8 -22 Q6 -19 0 -20" fill="#F7C948" ${L2}/>`,
  apple: () => `<path d="M0 -20 Q-12 -26 -12 -12 Q-11 0 0 -2 Q11 0 12 -12 Q12 -26 0 -20 Z" fill="#EF6F6C" ${L2}/><path d="M0 -20 L1 -25" ${L2}/><path d="M2 -24 Q8 -28 9 -22 Q4 -21 2 -24 Z" fill="#6FC66F" ${L2} stroke-width="1.6"/><path d="M-7 -16 Q-8 -11 -6 -8" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".6" fill="none"/>`,
  kula: (i) => `<circle cx="0" cy="-12" r="11" fill="${["#7FC7E8", "#6FC66F", "#B79BE0", "#F49E4C"][i % 4]}" ${L2}/><path d="M-6 -8 Q0 -16 7 -10" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".55" fill="none"/><circle cx="-4" cy="-17" r="2.6" fill="#fff" opacity=".85"/>`,
  smasak: (i) => [
    `<path d="M0 -25 L3.5 -16 L12 -15.5 L5.5 -9.5 L7.5 -1 L0 -5.5 L-7.5 -1 L-5.5 -9.5 L-12 -15.5 L-3.5 -16 Z" fill="#F7C948" ${L2}/>`,
    `<circle cx="0" cy="-12" r="11" fill="#EF6F6C" ${L2}/><path d="M-11 -12 Q0 -6 11 -12" stroke="#fff" stroke-width="3" fill="none"/>`,
    `<circle cx="0" cy="-12" r="11" fill="#7FC7E8" ${L2}/><circle cx="-3.5" cy="-15.5" r="1.8" fill="${O}"/><circle cx="3.5" cy="-15.5" r="1.8" fill="${O}"/><circle cx="-3.5" cy="-8.5" r="1.8" fill="${O}"/><circle cx="3.5" cy="-8.5" r="1.8" fill="${O}"/>`,
    `<path d="M0 -2 Q-13 -11 -11 -19 Q-8 -25 0 -19 Q8 -25 11 -19 Q13 -11 0 -2 Z" fill="#F890B7" ${L2}/>`,
  ][i % 4],
};

export function itemSvg(theme, i = 0) {
  return (ITEMS[theme] || ITEMS.mynt)(i);
}

/** Ett föremål som saknas (x − 3): streckad ring med minus. */
export function holeSvg() {
  return `<circle cx="0" cy="-13" r="11.5" fill="#FFE3E1" stroke="#EF6F6C" stroke-width="2.4" stroke-dasharray="4 3.2"/><path d="M-5 -13 L5 -13" stroke="#EF6F6C" stroke-width="3" stroke-linecap="round"/>`;
}

// --- block och brickor -------------------------------------------------------------

export function xBlockSvg() {
  return `<rect x="-22" y="-50" width="44" height="50" rx="9" fill="#B79BE0" ${L3}/><rect x="-16" y="-45" width="32" height="7" rx="3.5" fill="#fff" opacity=".35"/><text x="0" y="-15" font-size="28" font-style="italic" font-weight="800" text-anchor="middle" fill="#fff" stroke="${O}" stroke-width="1.2" paint-order="stroke">x</text>`;
}

/** Skuld-x-block (−x, #624): samma form som x-blocket, streckat och rött – "x som saknas". */
export function xDebtBlockSvg() {
  return `<rect x="-22" y="-50" width="44" height="50" rx="9" fill="#FFE3E1" stroke="#EF6F6C" stroke-width="3" stroke-dasharray="6 4"/><text x="-1" y="-16" font-size="21" font-style="italic" font-weight="800" text-anchor="middle" fill="#C9423F">−x</text>`;
}

export function xLabelBlockSvg(p, w) {
  const stroke = p.neg ? `stroke="#EF6F6C" stroke-width="3" stroke-dasharray="6 4"` : L3;
  return `<rect x="${-w / 2}" y="-50" width="${w}" height="50" rx="9" fill="${p.neg ? "#FFE3E1" : "#D9CBF2"}" ${stroke}/>${segsSvg(p.segs, 24, 0, -17)}`;
}

export function tileSvg(p, w) {
  const stroke = p.neg ? `stroke="#EF6F6C" stroke-width="3" stroke-dasharray="6 4"` : L3;
  return `<rect x="${-w / 2}" y="-40" width="${w}" height="40" rx="8" fill="${p.neg ? "#FFE3E1" : "#FFF3DC"}" ${stroke}/>${p.neg ? "" : `<rect x="${-w / 2 + 3}" y="-9" width="${w - 6}" height="6" rx="3" fill="#F2A93B" opacity=".35"/>`}<text x="0" y="-12" font-size="22" ${TEXT}>${esc(p.text)}</text>`;
}

export function labelSvg(p, w) {
  return `<rect x="${-w / 2}" y="-58" width="${w}" height="58" rx="16" fill="#fff" ${L3}/><rect x="${-w / 2 + 8}" y="-52" width="${w - 16}" height="6" rx="3" fill="#C9F0DC"/>${segsSvg(p.segs, 30, 0, -18)}`;
}

// ÷ är mörkblå (#643): vit text på ljusblå var svårläst – #2A73B0 ger 5,0:1 (WCAG AA).
const BADGE_FILL = { "-": "#EF6F6C", "+": "#58C6A9", "/": "#2A73B0", "*": "#F49E4C" };

export function badgeSvg(p, w) {
  return `<rect x="${-w / 2}" y="-30" width="${w}" height="30" rx="15" fill="${BADGE_FILL[p.op] || "#B79BE0"}" ${L2}/><text x="0" y="-9" font-size="19" font-weight="800" text-anchor="middle" fill="#fff">${esc(p.text)}</text>`;
}

export function frameSvg(w, h) {
  return `<rect x="${-w / 2}" y="${-h}" width="${w}" height="${h}" rx="14" fill="#7FC7E8" fill-opacity=".14" stroke="#46557A" stroke-width="2.4" stroke-dasharray="7 5"/>`;
}

/** SVG för en bit (vag-scen.js) i given storlek. */
export function pieceSvg(p, theme, size) {
  switch (p.kind) {
    case "cont": return containerSvg(theme.container);
    case "item": return `<g transform="scale(1.15)">${itemSvg(theme.item, p.i)}</g>`;
    case "hole": return `<g transform="scale(1.15)">${holeSvg()}</g>`;
    case "xb": return xBlockSvg();
    case "xn": return xDebtBlockSvg();
    case "xf": return xLabelBlockSvg(p, size.w);
    case "tile": return tileSvg(p, size.w);
    case "label": return labelSvg(p, size.w);
    case "badge": return badgeSvg(p, size.w);
    case "frame": return frameSvg(size.w, size.h);
    default: return "";
  }
}
