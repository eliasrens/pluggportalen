// ============================================================================
// Läsresan – Bergens scen (src/lasresan/worlds/bergen-scen.js)  ·  #660
// ----------------------------------------------------------------------------
// EGENRITAD inline-SVG i portalens platta vektorstil – se skogen-scen.js för
// mönstret. Ren strängbyggare utan DOM: bergenScen(world) → scenens inre
// SVG-markup (himmel, snöklädd bergskedja, fjällsjö, toppen stigen klättrar
// upp på, ravin med hängbro, serpentinstig, stugor, granar och getter) i
// världspixlar. Allt är stilla – inget rör sig i Bergen.
// ============================================================================

import { O } from "../../art-style.js";
import { n1, routePoints, smoothOpenPath } from "./stig.js";

// --- Palett (fjäll: kall himmel, varm äng) ---------------------------------
const HIMMEL = "#BFE6F5";
const FJARRAN = "#A9C2DE";
const FJARRAN_MORK = "#8EA7C6";
const SNO = "#FFFFFF";
const SNO_SKUGGA = "#DCE9F5";
const BERG = "#B9B1A4";
const BERG_MORK = "#978E81";
const BERG_LJUS = "#D3CCC0";
const RAVIN = "#6E6676";
const ANG = "#8FCB72";
const ANG_LJUS = "#B2DD8E";
const ANG_MORK = "#6FB25E";
const GRAN = "#3F8E5F";
const GRAN_LJUS = "#58A86E";
const STAM = "#8A6242";
const STIG = "#D9C29A";
const STIG_KANT = "#AE9670";
const VATTEN = "#7FC7E8";
const VATTEN_LJUS = "#C9EEF8";
const FALU = "#D9584F";
const TAK = "#6E4E35";
const PLANKA = "#C79A6B";
const KRAM = "#FFF3DC";
const BRUN = "#B0805A";
const GUL = "#F7C948";
const LILA = "#B79BE0";
const BLA = "#4FA3E8";

const L2 = `stroke="${O}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`;
const L3 = `stroke="${O}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
const grupp = (x, y, s, inner, flip = false) =>
  `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">${inner}</g>`;
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const pts = (list) => list.map((p) => `${n1(p[0])},${n1(p[1])}`).join(" ");

// --- Berg -------------------------------------------------------------------

/**
 * Ett berg med snötäcke: topp (x, y), bas på `bas`, vänster/höger flank wl/wr.
 * `snoT` = hur långt ner snön når (andel av höjden). Höger sida skuggas.
 */
function berg({ x, y, wl, wr, bas }, fill, skugga, snoT = 0.32) {
  const P = [x, y], L = [x - wl, bas], R = [x + wr, bas];
  const a = lerp(P, L, snoT), b = lerp(P, R, snoT);
  // Snökanten: en mjuk sicksack mellan flankerna.
  const kant = [];
  for (let i = 1; i < 6; i++) {
    const p = lerp(a, b, i / 6);
    kant.push([p[0], p[1] + (i % 2 ? 22 : -4)]);
  }
  const snoPts = [P, a, ...kant, b];
  const skuggPts = [P, R, [x + wr * 0.25, bas]];
  return (
    `<polygon points="${pts([P, L, R])}" fill="${fill}" ${L2}/>` +
    `<polygon points="${pts(skuggPts)}" fill="${skugga}" opacity="0.55"/>` +
    `<polygon points="${pts(snoPts)}" fill="${SNO}" ${L3}/>` +
    `<polygon points="${pts([P, b, lerp(P, b, 0.4), [x + 6, y + (b[1] - y) * 0.7]])}" fill="${SNO_SKUGGA}"/>` +
    `<polygon points="${pts([P, L, R])}" fill="none" ${L2}/>`
  );
}

/** Bergskedjan på himlen (ljus, blåaktig – längre bort). */
function fjarran(lista) {
  return (lista || []).map((b) => berg({ ...b, bas: 420 }, FJARRAN, FJARRAN_MORK, 0.36)).join("");
}

/** Fjällängen: grön mark med mjukt kuperad överkant. */
function ang(w, h) {
  const d = `M0 365 Q120 330 260 350 T560 345 T880 352 T1200 340 T1600 345 V${h} H0 Z`;
  const flackar = [
    [420, 800, 230, 0.45], [1050, 760, 210, 0.4], [1300, 940, 200, 0.35],
    [600, 560, 170, 0.4], [180, 880, 160, 0.4], [900, 470, 140, 0.35],
  ]
    .map(([x, y, r, o]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${n1(r * 0.45)}" fill="${ANG_LJUS}" opacity="${o}"/>`)
    .join("");
  return `<path d="${d}" fill="${ANG}" ${L2}/>` + flackar;
}

/** Fjällsjö med spegling av himlen. */
function sjo({ x, y, rx, ry }) {
  return (
    `<ellipse cx="${x}" cy="${y}" rx="${rx + 10}" ry="${ry + 8}" fill="${ANG_MORK}" opacity="0.5"/>` +
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${VATTEN}" ${L2}/>` +
    `<path d="M${x - rx * 0.55} ${y - 8} h${n1(rx * 0.45)} M${x - rx * 0.1} ${y + 12} h${n1(rx * 0.5)}" stroke="${VATTEN_LJUS}" stroke-width="6" stroke-linecap="round"/>`
  );
}

/** Toppen som stigen klättrar upp på. Foten döljs av en mjuk ängskulle. */
function topp(t, w) {
  // Kullen börjar en bit upp på vänstra flanken så bergets hörn aldrig syns.
  const [x0, y1] = lerp([t.x - t.wl, t.bas], [t.x, t.y], 0.12);
  const y0 = t.bas;
  const kulle = `M${n1(x0)} ${n1(y1)} Q${n1(x0 + 80)} ${y0 - 20} ${n1(x0 + 200)} ${y0 - 10} T${n1(x0 + 450)} ${y0 - 16} T${n1(x0 + 720)} ${y0 - 28}`;
  return (
    berg(t, BERG, BERG_MORK, 0.3) +
    // Några klippavsatser på flanken
    `<path d="M${t.x - 150} ${t.y + 230} l60 -12 M${t.x + 120} ${t.y + 200} l70 14 M${t.x - 40} ${t.y + 300} l50 6" stroke="${BERG_MORK}" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M${t.x - 230} ${t.y + 320} l40 -8 M${t.x + 210} ${t.y + 290} l40 10" stroke="${BERG_LJUS}" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M${n1(x0 - 160)} ${y0 + 50} L${kulle.slice(1)} L${w + 10} ${y0 - 28} V${y0 + 60} Z" fill="${ANG}"/>` +
    `<path d="${kulle} L${w + 10} ${y0 - 28}" fill="none" ${L2}/>`
  );
}

/** Ravinen: en klyfta i ängen med en bäck längst ner. */
function ravin({ x, topp: y0 }, h) {
  const d = `M${x - 42} ${y0} Q${x - 58} ${y0 + 130} ${x - 88} ${h + 10} L${x + 88} ${h + 10} Q${x + 58} ${y0 + 130} ${x + 42} ${y0} Q${x} ${y0 - 22} ${x - 42} ${y0} Z`;
  const vagg = `M${x - 42} ${y0} Q${x - 58} ${y0 + 130} ${x - 88} ${h + 10} L${x - 20} ${h + 10} Q${x - 18} ${y0 + 120} ${x - 10} ${y0 + 6} Z`;
  const back = `M${x} ${y0 + 14} Q${x - 6} ${y0 + 120} ${x + 4} ${h + 10}`;
  return (
    `<path d="${d}" fill="${RAVIN}" ${L2}/>` +
    `<path d="${vagg}" fill="${BERG_MORK}"/>` +
    `<path d="${back}" fill="none" stroke="${VATTEN}" stroke-width="16" stroke-linecap="round"/>` +
    `<path d="${back}" fill="none" stroke="${VATTEN_LJUS}" stroke-width="4" stroke-linecap="round" stroke-dasharray="14 22"/>` +
    `<path d="${d}" fill="none" ${L2}/>`
  );
}

// --- Stigen: grusad serpentinstig ---------------------------------------------
function stig(world) {
  const d = smoothOpenPath(routePoints(world));
  return (
    `<path d="${d}" fill="none" stroke="${STIG_KANT}" stroke-width="52" stroke-linecap="round" opacity="0.95"/>` +
    `<path d="${d}" fill="none" stroke="${STIG}" stroke-width="42" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${STIG_KANT}" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 40" opacity="0.7"/>`
  );
}

/** Hängbro över ravinen: plankor, rep och två par stolpar. */
function hangbro({ x, y, rot = 0 }) {
  let plankor = "";
  for (let i = 0; i < 10; i++) {
    plankor += `<rect x="${-78 + i * 15.8}" y="-20" width="12" height="40" rx="3" fill="${PLANKA}" stroke="${O}" stroke-width="3"/>`;
  }
  const rep = (sy) => `<path d="M-90 ${sy} Q0 ${sy + Math.sign(sy) * -12} 90 ${sy}" fill="none" stroke="${TAK}" stroke-width="4.5" stroke-linecap="round"/>`;
  const stolpe = (px, py) => `<rect x="${px - 6}" y="${py - 14}" width="12" height="20" rx="3" fill="${TAK}" ${L3}/>`;
  return (
    `<g transform="translate(${x} ${y}) rotate(${rot})">` +
    plankor + rep(-26) + rep(26) +
    stolpe(-90, -26) + stolpe(90, -26) + stolpe(-90, 32) + stolpe(90, 32) +
    `</g>`
  );
}

// --- Dekor-typer (ritas från world.decorations) ------------------------------

/** Fluffigt moln. */
function moln(x, y, s) {
  return grupp(x, y, s,
    `<path d="M-70 10 Q-80 -14 -52 -16 Q-46 -42 -16 -36 Q0 -58 26 -40 Q56 -46 58 -16 Q84 -12 74 10 Z" fill="${SNO}" ${L3}/>` +
    `<path d="M-50 4 Q-20 8 10 4" stroke="${SNO_SKUGGA}" stroke-width="5" stroke-linecap="round" fill="none"/>`);
}

/** Gran: tre våningar, mörkgrön. */
function gran(x, y, s) {
  const vaning = (top, bred, nere) =>
    `<path d="M0 ${top} L${bred} ${nere} Q0 ${nere + 10} ${-bred} ${nere} Z" fill="${GRAN}" ${L2}/>`;
  return grupp(x, y, s,
    `<ellipse cx="0" cy="4" rx="34" ry="9" fill="${O}" opacity="0.14"/>` +
    `<rect x="-7" y="-22" width="14" height="24" rx="3" fill="${STAM}" ${L2}/>` +
    vaning(-80, 42, -14) + vaning(-118, 34, -54) + vaning(-150, 25, -92) +
    `<path d="M-8 -66 L-22 -32 M-6 -104 L-16 -72" stroke="${GRAN_LJUS}" stroke-width="5" stroke-linecap="round"/>`);
}

/** Röd stuga med vita knutar, torvtak med snökant och rykande skorsten. */
function stuga(x, y, s, flip) {
  return grupp(x, y, s,
    `<ellipse cx="0" cy="4" rx="66" ry="12" fill="${O}" opacity="0.14"/>` +
    `<path d="M-32 -96 q-8 -16 4 -26 q-6 -16 10 -22" fill="none" stroke="${SNO}" stroke-width="7" stroke-linecap="round" opacity="0.9"/>` +
    `<rect x="-40" y="-104" width="16" height="30" rx="2" fill="${BERG}" ${L3}/>` +
    `<rect x="-52" y="-62" width="104" height="64" rx="3" fill="${FALU}" ${L2}/>` +
    `<path d="M-52 -62 V2 M52 -62 V2" stroke="${SNO}" stroke-width="6"/>` +
    `<path d="M-64 -56 L0 -104 L64 -56 Z" fill="${TAK}" ${L2}/>` +
    `<path d="M-36 -77 L0 -104 L36 -77 Q18 -84 0 -78 Q-18 -84 -36 -77 Z" fill="${SNO}" ${L3}/>` +
    `<path d="M-64 -56 L64 -56" stroke="${SNO}" stroke-width="5" stroke-linecap="round"/>` +
    `<rect x="-36" y="-40" width="24" height="22" rx="2" fill="${VATTEN_LJUS}" ${L3}/>` +
    `<path d="M-24 -40 V-18 M-36 -29 H-12" stroke="${SNO}" stroke-width="3"/>` +
    `<rect x="10" y="-36" width="24" height="38" rx="3" fill="${KRAM}" ${L3}/>` +
    `<circle cx="28" cy="-16" r="2.4" fill="${O}"/>`, flip);
}

/** Get med horn och skägg (vit eller brun beroende på plats), tittar åt höger. */
function get(x, y, s, flip) {
  const brun = Math.round(x / 10) % 2 === 1;
  const p = brun ? BRUN : KRAM;
  const ben = (bx) => `<rect x="${bx}" y="-20" width="8" height="22" rx="3" fill="${p}" ${L3}/>`;
  return grupp(x, y, s,
    `<ellipse cx="0" cy="3" rx="34" ry="7" fill="${O}" opacity="0.14"/>` +
    ben(-24) + ben(-12) + ben(8) + ben(18) +
    `<path d="M-30 -36 q-10 -6 -8 -16" fill="none" stroke="${p}" stroke-width="7" stroke-linecap="round"/>` +
    `<ellipse cx="0" cy="-32" rx="32" ry="18" fill="${p}" ${L3}/>` +
    `<path d="M24 -60 q-6 -20 -22 -22 M30 -60 q-2 -22 -16 -28" fill="none" stroke="${O}" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M24 -60 q-6 -20 -22 -22 M30 -60 q-2 -22 -16 -28" fill="none" stroke="${BERG_LJUS}" stroke-width="2.5" stroke-linecap="round"/>` +
    `<path d="M20 -46 Q24 -66 36 -64 Q50 -60 48 -46 Q44 -36 34 -36 Q22 -36 20 -46 Z" fill="${p}" ${L3}/>` +
    `<path d="M20 -58 L8 -54 L18 -50 Z" fill="${p}" ${L3}/>` +
    `<circle cx="38" cy="-54" r="2.8" fill="${O}"/>` +
    `<path d="M40 -37 L42 -26 L46 -37" fill="${brun ? KRAM : BERG}" ${L3}/>` +
    (brun ? `<ellipse cx="-4" cy="-38" rx="12" ry="7" fill="${KRAM}" opacity="0.8"/>` : ""), flip);
}

/** Grå sten med ljus kant. */
function sten(x, y, s) {
  return grupp(x, y, s,
    `<ellipse cx="0" cy="6" rx="34" ry="8" fill="${O}" opacity="0.12"/>` +
    `<path d="M-32 8 Q-34 -18 -10 -26 Q12 -32 26 -16 Q38 -2 32 8 Z" fill="${BERG}" ${L2}/>` +
    `<path d="M-18 -14 Q-6 -24 10 -22" fill="none" stroke="${BERG_LJUS}" stroke-width="5" stroke-linecap="round"/>`);
}

/** Fjällblommor: blå, lila och gula små blommor i en tuva. */
function blomma(x, y, s) {
  const b = (bx, by, f) => `<circle cx="${bx}" cy="${by}" r="7" fill="${f}" ${L3}/><circle cx="${bx}" cy="${by}" r="2.2" fill="${GUL}"/>`;
  return grupp(x, y, s,
    `<path d="M-18 4 Q-10 -12 0 4 Q10 -14 18 4 Z" fill="${ANG_MORK}" ${L3}/>` +
    `<path d="M-10 -2 V-18 M2 0 V-24 M12 -2 V-14" stroke="${GRAN}" stroke-width="3" stroke-linecap="round"/>` +
    b(-10, -20, BLA) + b(2, -28, LILA) + b(13, -16, GUL));
}

/** Toppröse (stenröse) med målflagga. */
function flagga(x, y) {
  return (
    `<g transform="translate(${x + 40} ${y - 4})">` +
    `<ellipse cx="0" cy="4" rx="26" ry="7" fill="${O}" opacity="0.14"/>` +
    `<path d="M-24 4 Q-26 -10 -12 -12 Q-14 -24 0 -24 Q14 -24 12 -12 Q26 -10 24 4 Z" fill="${BERG}" ${L3}/>` +
    `<rect x="-3" y="-82" width="6" height="64" rx="3" fill="${TAK}" ${L3}/>` +
    `<path d="M3 -80 L46 -64 L3 -46 Z" fill="${GUL}" ${L3}/>` +
    `</g>`
  );
}

const TYPER = { moln, gran, stuga, get, sten, blomma };
const PA_HIMLEN = new Set(["moln"]);

// ============================================================================
// Hela scenen (bakifrån och fram): himmel → moln → bergskedjan → ängen →
// sjön → toppen → ravinen → stig → hängbro → övrig dekor (sorterad på y) →
// toppröset med flaggan.
// ============================================================================
export function bergenScen(world) {
  const { width: w, height: h } = world.scene;
  const deko = world.decorations || [];
  const rita = (d) => (TYPER[d.type] ? TYPER[d.type](d.x, d.y, d.s == null ? 1 : d.s, !!d.flip) : "");
  const himmel = deko.filter((d) => PA_HIMLEN.has(d.type));
  const framfor = deko.filter((d) => !PA_HIMLEN.has(d.type)).slice().sort((a, b) => a.y - b.y);
  return (
    `<rect x="0" y="0" width="${w}" height="${h}" fill="${HIMMEL}"/>` +
    himmel.map(rita).join("") +
    fjarran(world.fjarran) +
    ang(w, h) +
    (world.sjo ? sjo(world.sjo) : "") +
    (world.topp ? topp(world.topp, w) : "") +
    (world.ravin ? ravin(world.ravin, h) : "") +
    stig(world) +
    (world.bro ? hangbro(world.bro) : "") +
    framfor.map(rita).join("") +
    (world.mal ? flagga(world.mal.x, world.mal.y) : "")
  );
}
