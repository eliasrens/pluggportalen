// ============================================================================
// Läsresan – Månens scen (src/lasresan/worlds/manen-scen.js)  ·  #660
// ----------------------------------------------------------------------------
// EGENRITAD inline-SVG i portalens platta vektorstil – se skogen-scen.js för
// mönstret. Ren strängbyggare utan DOM: manenScen(world) → scenens inre
// SVG-markup (stjärnhimmel, jorden, månytan med kratrar, stig, raket, månbil,
// månbas och målflagga) i världspixlar. Allt är stilla – stjärnorna blinkar
// inte. Stjärnornas lägen är fasta (seedad slump), så kartan ser likadan ut
// varje gång.
// ============================================================================

import { O } from "../../art-style.js";
import { n1, routePoints, smoothOpenPath } from "./stig.js";

// --- Palett (natt i rymden, ljusgrå måne) -----------------------------------
const RYMD = "#26305A";
const RYMD_LJUS = "#34407A";
const STJARNA = "#FFF3DC";
const MANE = "#C9C6D9";
const MANE_LJUS = "#DCD9E8";
const MANE_MORK = "#ABA7C0";
const MANE_DJUP = "#9792AE";
const STIG = "#E6E3F0";
const STIG_KANT = "#A9A5BE";
const HAV = "#4FA3E8";
const LAND = "#6FC66F";
const MOLN = "#FFFFFF";
const VIT = "#FFFFFF";
const ROD = "#EF6F6C";
const GUL = "#F7C948";
const ORANGE = "#F49E4C";
const HIMBLA = "#7FC7E8";
const STAL = "#A9C2DE";
const MORK = "#4C4661";

const L2 = `stroke="${O}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`;
const L3 = `stroke="${O}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
const grupp = (x, y, s, inner, flip = false) =>
  `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">${inner}</g>`;

/** Liten deterministisk slump (samma stjärnhimmel varje gång). */
function slump(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t * 1664525 + 1013904223) >>> 0;
    return t / 4294967296;
  };
}

// --- Himmel ------------------------------------------------------------------
function stjarnhimmel(w, antal) {
  const r = slump(660);
  let prickar = "";
  for (let i = 0; i < antal; i++) {
    const x = n1(r() * w), y = n1(r() * 420), s = r();
    prickar += `<circle cx="${x}" cy="${y}" r="${n1(1.4 + s * 2.4)}" fill="${STJARNA}" opacity="${n1(0.55 + s * 0.45)}"/>`;
  }
  // Några större fyrspetsiga stjärnor
  const stora = [[300, 90], [690, 150], [1010, 60], [1260, 250], [140, 260], [1560, 60], [880, 200], [470, 230]]
    .map(([x, y], i) => {
      const k = i % 2 ? 9 : 13;
      return `<path d="M${x} ${y - k} Q${x + 2} ${y - 2} ${x + k} ${y} Q${x + 2} ${y + 2} ${x} ${y + k} Q${x - 2} ${y + 2} ${x - k} ${y} Q${x - 2} ${y - 2} ${x} ${y - k} Z" fill="${GUL}" opacity="0.9"/>`;
    })
    .join("");
  return (
    `<rect x="0" y="0" width="${w}" height="460" fill="${RYMD}"/>` +
    `<ellipse cx="${w / 2}" cy="400" rx="${w * 0.6}" ry="140" fill="${RYMD_LJUS}" opacity="0.6"/>` +
    prickar + stora
  );
}

/** Jorden: blå med gröna kontinenter, moln och ett mjukt sken. */
function jorden({ x, y, r }) {
  const id = "lr-jorden-klipp";
  return (
    `<circle cx="${x}" cy="${y}" r="${r + 26}" fill="${HIMBLA}" opacity="0.14"/>` +
    `<circle cx="${x}" cy="${y}" r="${r + 12}" fill="${HIMBLA}" opacity="0.18"/>` +
    `<clipPath id="${id}"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath>` +
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${HAV}"/>` +
    `<g clip-path="url(#${id})">` +
    `<path d="M${x - r} ${y - 30} Q${x - 50} ${y - 64} ${x - 20} ${y - 40} Q${x} ${y - 10} ${x - 30} ${y + 10} Q${x - 50} ${y + 40} ${x - r} ${y + 30} Z" fill="${LAND}" ${L3}/>` +
    `<path d="M${x + 14} ${y - 70} Q${x + 60} ${y - 60} ${x + 52} ${y - 20} Q${x + 40} ${y + 10} ${x + 60} ${y + 40} Q${x + 30} ${y + 60} ${x + 14} ${y + 30} Q${x + 2} ${y} ${x + 14} ${y - 70} Z" fill="${LAND}" ${L3}/>` +
    `<path d="M${x - 50} ${y + 50} q30 -10 60 4 M${x - 30} ${y - 50} q24 -8 46 2 M${x + 20} ${y + 6} q20 -6 44 0" fill="none" stroke="${MOLN}" stroke-width="9" stroke-linecap="round" opacity="0.9"/>` +
    `<circle cx="${x + r * 0.45}" cy="${y + r * 0.1}" r="${r}" fill="${O}" opacity="0.18"/>` +
    `</g>` +
    `<circle cx="${x}" cy="${y}" r="${r}" fill="none" ${L2}/>` +
    `<ellipse cx="${x - r * 0.45}" cy="${y - r * 0.5}" rx="${n1(r * 0.18)}" ry="${n1(r * 0.1)}" fill="${VIT}" opacity="0.6" transform="rotate(-35 ${x - r * 0.45} ${y - r * 0.5})"/>`
  );
}

// --- Månytan -------------------------------------------------------------------
function manyta(horisont, w, h) {
  let d = `M${horisont[0][0]} ${horisont[0][1]}`;
  for (let i = 1; i < horisont.length; i++) {
    const [px, py] = horisont[i - 1], [x, y] = horisont[i];
    d += ` Q${n1((px + x) / 2)} ${n1(Math.min(py, y) - 18)} ${x} ${y}`;
  }
  d += ` V${h} H0 Z`;
  const flackar = [
    [400, 820, 240, MANE_LJUS, 0.5], [1150, 920, 230, MANE_LJUS, 0.45], [960, 560, 200, MANE_MORK, 0.35],
    [220, 470, 150, MANE_MORK, 0.35], [1460, 650, 150, MANE_LJUS, 0.4], [700, 400, 150, MANE_LJUS, 0.45],
  ]
    .map(([x, y, r, f, o]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${n1(r * 0.4)}" fill="${f}" opacity="${o}"/>`)
    .join("");
  return `<path d="${d}" fill="${MANE}" ${L2}/>` + flackar;
}

// --- Stigen: upptrampad väg i månstoftet, med små fotspår ---------------------
function stig(world) {
  const d = smoothOpenPath(routePoints(world));
  return (
    `<path d="${d}" fill="none" stroke="${STIG_KANT}" stroke-width="52" stroke-linecap="round" opacity="0.9"/>` +
    `<path d="${d}" fill="none" stroke="${STIG}" stroke-width="42" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${MANE_MORK}" stroke-width="8" stroke-linecap="round" stroke-dasharray="6 30" opacity="0.8"/>`
  );
}

/** Månbasen: en kupol med fönster och en antenn. */
function manbas({ x, y }) {
  return grupp(x, y, 1,
    `<ellipse cx="0" cy="6" rx="100" ry="14" fill="${O}" opacity="0.16"/>` +
    `<path d="M-90 4 Q-90 -96 0 -96 Q90 -96 90 4 Z" fill="${STAL}" ${L2}/>` +
    `<path d="M-60 -60 Q-30 -84 6 -86" fill="none" stroke="${VIT}" stroke-width="7" stroke-linecap="round" opacity="0.7"/>` +
    `<path d="M-90 -20 Q0 -36 90 -20" fill="none" stroke="${O}" stroke-width="3" opacity="0.5"/>` +
    `<circle cx="-40" cy="-44" r="11" fill="${HIMBLA}" ${L3}/><circle cx="0" cy="-52" r="11" fill="${HIMBLA}" ${L3}/>` +
    `<circle cx="40" cy="-44" r="11" fill="${HIMBLA}" ${L3}/>` +
    `<path d="M-18 4 V-22 Q0 -36 18 -22 V4 Z" fill="${MORK}" ${L3}/>` +
    `<rect x="94" y="-24" width="40" height="28" rx="6" fill="${STAL}" ${L3}/>` +
    `<path d="M70 -86 V-130" stroke="${O}" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M52 -126 Q70 -112 88 -126" fill="${VIT}" ${L3}/>` +
    `<circle cx="70" cy="-136" r="6" fill="${ROD}" ${L3}/>`);
}

// --- Dekor-typer (ritas från world.decorations) ------------------------------

/** Krater: platt skål med ljus kant upptill och skugga nertill. */
function krater(x, y, s) {
  return grupp(x, y, s,
    `<ellipse cx="0" cy="0" rx="70" ry="28" fill="${MANE_LJUS}" ${L3}/>` +
    `<ellipse cx="0" cy="4" rx="56" ry="20" fill="${MANE_DJUP}"/>` +
    `<path d="M-52 8 Q0 30 52 8 Q30 22 0 22 Q-30 22 -52 8 Z" fill="${MANE_MORK}"/>` +
    `<ellipse cx="-18" cy="-2" rx="14" ry="5" fill="${MANE_MORK}" opacity="0.7"/>`);
}

/** Månsten. */
function mansten(x, y, s) {
  return grupp(x, y, s,
    `<ellipse cx="0" cy="6" rx="32" ry="7" fill="${O}" opacity="0.14"/>` +
    `<path d="M-30 8 Q-32 -14 -10 -22 Q14 -28 26 -10 Q34 2 30 8 Z" fill="${MANE_MORK}" ${L2}/>` +
    `<circle cx="8" cy="-8" r="5" fill="${MANE_DJUP}"/>` +
    `<path d="M-16 -12 Q-6 -20 6 -20" fill="none" stroke="${MANE_LJUS}" stroke-width="4" stroke-linecap="round"/>`);
}

/** Fotspår i stoftet (en kort rad). */
function fotspar(x, y, s) {
  let spar = "";
  for (let i = 0; i < 4; i++) {
    const fx = i * 26, fy = i % 2 ? 10 : 0;
    spar += `<ellipse cx="${fx}" cy="${fy}" rx="8" ry="5" fill="${MANE_DJUP}" opacity="0.7"/>`;
  }
  return grupp(x, y, s, spar);
}

/** Raket på landningsben (röd-vit, med fönster). Fotpunkten i origo. */
function raket(x, y, s) {
  return grupp(x, y, s,
    `<ellipse cx="0" cy="4" rx="70" ry="12" fill="${O}" opacity="0.18"/>` +
    `<path d="M-30 -60 L-62 0 M30 -60 L62 0" stroke="${O}" stroke-width="7" stroke-linecap="round"/>` +
    `<path d="M-30 -60 L-62 0 M30 -60 L62 0" stroke="${STAL}" stroke-width="3.5" stroke-linecap="round"/>` +
    `<path d="M-34 -44 L-62 -4 L-30 -16 Z" fill="${ROD}" ${L2}/><path d="M34 -44 L62 -4 L30 -16 Z" fill="${ROD}" ${L2}/>` +
    `<path d="M-14 -24 L-18 -8 L18 -8 L14 -24 Z" fill="${MORK}" ${L3}/>` +
    `<path d="M-34 -24 Q-40 -150 0 -220 Q40 -150 34 -24 Z" fill="${VIT}" ${L2}/>` +
    `<path d="M-30 -160 Q0 -150 30 -160 Q20 -196 0 -220 Q-20 -196 -30 -160 Z" fill="${ROD}" ${L2}/>` +
    `<path d="M-34 -40 Q0 -32 34 -40" fill="none" stroke="${ROD}" stroke-width="10"/>` +
    `<path d="M-34 -24 Q-40 -150 0 -220 Q40 -150 34 -24 Z" fill="none" ${L2}/>` +
    `<circle cx="0" cy="-112" r="17" fill="${HIMBLA}" stroke="${O}" stroke-width="6"/>` +
    `<circle cx="0" cy="-112" r="17" fill="none" stroke="${STAL}" stroke-width="3"/>` +
    `<path d="M-8 -118 q6 -6 12 -2" fill="none" stroke="${VIT}" stroke-width="3.5" stroke-linecap="round"/>` +
    `<path d="M-20 -60 Q-22 -110 -12 -140" fill="none" stroke="${STAL}" stroke-width="5" stroke-linecap="round" opacity="0.7"/>`);
}

/** Månbil med fyra hjul, solpanel och parabolantenn. */
function manbil(x, y, s, flip) {
  const hjul = (hx) =>
    `<circle cx="${hx}" cy="-14" r="16" fill="${MORK}" ${L3}/><circle cx="${hx}" cy="-14" r="6" fill="${STAL}" ${L3}/>`;
  return grupp(x, y, s,
    `<ellipse cx="0" cy="4" rx="78" ry="10" fill="${O}" opacity="0.16"/>` +
    `<path d="M-50 -60 L-62 -96 M-50 -60 L-30 -96" stroke="${O}" stroke-width="4" stroke-linecap="round"/>` +
    `<rect x="-86" y="-104" width="80" height="14" rx="3" fill="${HAV}" ${L3}/>` +
    `<path d="M-66 -104 V-90 M-46 -104 V-90 M-26 -104 V-90" stroke="${HIMBLA}" stroke-width="2.5"/>` +
    `<rect x="-62" y="-60" width="124" height="34" rx="10" fill="${GUL}" ${L2}/>` +
    `<rect x="10" y="-82" width="40" height="24" rx="6" fill="${HIMBLA}" ${L3}/>` +
    `<path d="M40 -82 V-104" stroke="${O}" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M26 -112 Q40 -94 56 -110 Z" fill="${VIT}" ${L3}/>` +
    `<circle cx="-30" cy="-44" r="5" fill="${ORANGE}" ${L3}/><circle cx="-12" cy="-44" r="5" fill="${ROD}" ${L3}/>` +
    hjul(-44) + hjul(-14) + hjul(16) + hjul(46), flip);
}

/** Liten satellit som svävar på himlen. */
function satellit(x, y, s) {
  return grupp(x, y, s,
    `<g transform="rotate(-18)">` +
    `<rect x="-62" y="-10" width="40" height="20" rx="3" fill="${HAV}" ${L3}/>` +
    `<rect x="22" y="-10" width="40" height="20" rx="3" fill="${HAV}" ${L3}/>` +
    `<path d="M-22 0 H22" stroke="${O}" stroke-width="4"/>` +
    `<rect x="-14" y="-16" width="28" height="32" rx="6" fill="${STAL}" ${L3}/>` +
    `<circle cx="0" cy="-4" r="5" fill="${GUL}" ${L3}/>` +
    `</g>`);
}

/** Målflaggan: en stor flagga med en stjärna (resans slut). */
function flagga(x, y) {
  return (
    `<g transform="translate(${x + 44} ${y - 4})">` +
    `<ellipse cx="0" cy="4" rx="20" ry="6" fill="${O}" opacity="0.16"/>` +
    `<rect x="-3" y="-92" width="6" height="96" rx="3" fill="${STAL}" ${L3}/>` +
    `<rect x="3" y="-90" width="58" height="40" rx="3" fill="${ROD}" ${L3}/>` +
    `<path d="M32 -82 l4 8 l9 1 l-7 6 l2 9 l-8 -5 l-8 5 l2 -9 l-7 -6 l9 -1 Z" fill="${GUL}" ${L3}/>` +
    `</g>`
  );
}

const TYPER = { krater, mansten, fotspar, raket, manbil, satellit };
const PLATTA = new Set(["krater", "fotspar"]);
const PA_HIMLEN = new Set(["satellit"]);

// ============================================================================
// Hela scenen (bakifrån och fram): stjärnhimmel → jorden → satellit → månytan
// → kratrar/fotspår → stig → månbas → övrig dekor (sorterad på y) → flaggan.
// ============================================================================
export function manenScen(world) {
  const { width: w, height: h } = world.scene;
  const deko = world.decorations || [];
  const rita = (d) => (TYPER[d.type] ? TYPER[d.type](d.x, d.y, d.s == null ? 1 : d.s, !!d.flip) : "");
  const himmel = deko.filter((d) => PA_HIMLEN.has(d.type));
  const platta = deko.filter((d) => PLATTA.has(d.type));
  const framfor = deko
    .filter((d) => !PLATTA.has(d.type) && !PA_HIMLEN.has(d.type))
    .slice()
    .sort((a, b) => a.y - b.y);
  return (
    stjarnhimmel(w, world.stjarnor || 80) +
    (world.jorden ? jorden(world.jorden) : "") +
    himmel.map(rita).join("") +
    manyta(world.horisont || [[0, 360], [w, 360]], w, h) +
    platta.map(rita).join("") +
    stig(world) +
    (world.bas ? manbas(world.bas) : "") +
    framfor.map(rita).join("") +
    (world.mal ? flagga(world.mal.x, world.mal.y) : "")
  );
}
