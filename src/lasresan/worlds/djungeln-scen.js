// ============================================================================
// Läsresan – Djungelns scen (src/lasresan/worlds/djungeln-scen.js)  ·  #659
// ----------------------------------------------------------------------------
// EGENRITAD inline-SVG i portalens platta vektorstil – se skogen-scen.js för
// mönstret. Ren strängbyggare utan DOM: djungelnScen(world) → scenens inre
// SVG-markup (grönska, flod, vattenfall, stig, hängbroar, tempel, dekor,
// lövtak och lianer) i världspixlar. Lövtaket och lianerna ritas sist så
// djungeln "ramar in" kartan; de hänger aldrig ner över stigen.
// ============================================================================

import { O } from "../../art-style.js";
import { n1, routePoints, smoothOpenPath } from "./stig.js";

// --- Palett (frodig regnskog, ur stilguiden) ---------------------------------
const MARK = "#6DBB64";
const MARK_LJUS = "#8FD07A";
const MARK_MORK = "#4E9F55";
const LOV = "#58B947";
const LOV_LJUS = "#8BD86F";
const LOV_MORK = "#3F8E5F";
const TAK = "#2F7550";
const LIAN = "#7A9A3E";
const STAM = "#9C7350";
const STAM_MORK = "#6E4E35";
const STIG = "#C9A273";
const STIG_KANT = "#9C7A50";
const VATTEN = "#4FB3C9";
const VATTEN_LJUS = "#AEE4F2";
const STEN = "#A39E86";
const STEN_MORK = "#7D7966";
const STEN_LJUS = "#C3BEA6";
const PLANKA = "#C79A6B";
const ROD = "#EF6F6C";
const BLA = "#4FA3E8";
const GUL = "#F7C948";
const ROSA = "#F890B7";
const VIT = "#FFFFFF";

const L2 = `stroke="${O}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`;
const grupp = (x, y, s, inner, rot = 0) =>
  `<g transform="translate(${x} ${y})${rot ? ` rotate(${rot})` : ""} scale(${s})">${inner}</g>`;

// --- Mark: grön botten med ljusa och mörka fläckar ---------------------------
function mark(w, h) {
  const flackar = [
    [700, 560, 220, MARK_LJUS, 0.45], [1150, 780, 200, MARK_LJUS, 0.4],
    [380, 760, 180, MARK_LJUS, 0.4], [1000, 360, 170, MARK_LJUS, 0.4],
    [350, 480, 150, MARK_LJUS, 0.35], [1400, 900, 160, MARK_LJUS, 0.35],
  ]
    .map(([x, y, r, f, o]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${n1(r * 0.55)}" fill="${f}" opacity="${o}"/>`)
    .join("");
  return `<rect x="0" y="0" width="${w}" height="${h}" fill="${MARK}"/>` + flackar;
}

// --- Floden med vattenfall ----------------------------------------------------
function flod(pts) {
  const d = smoothOpenPath(pts);
  return (
    `<path d="${d}" fill="none" stroke="${MARK_MORK}" stroke-width="80" stroke-linecap="round" opacity="0.6"/>` +
    `<path d="${d}" fill="none" stroke="${O}" stroke-width="66" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${VATTEN}" stroke-width="58" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${VATTEN_LJUS}" stroke-width="14" stroke-linecap="round" opacity="0.7" stroke-dasharray="40 46"/>`
  );
}

/** Klippvägg med vattenfall ned i en pool vid (x, y). */
function vattenfall({ x, y }) {
  const topp = y - 40;
  return (
    `<path d="M${x - 120} 0 L${x - 112} ${topp} Q${x - 60} ${topp + 26} ${x} ${topp + 10} Q${x + 60} ${topp + 26} ${x + 112} ${topp} L${x + 120} 0 Z" fill="${STEN}" ${L2}/>` +
    `<path d="M${x - 100} ${topp - 30} l26 -18 M${x + 58} ${topp - 50} l30 10 M${x - 86} 30 l24 8" stroke="${STEN_MORK}" stroke-width="4" stroke-linecap="round" opacity="0.7"/>` +
    `<ellipse cx="${x - 70}" cy="12" rx="56" ry="22" fill="${LOV_MORK}" ${L2}/>` +
    `<ellipse cx="${x + 76}" cy="16" rx="52" ry="22" fill="${LOV_MORK}" ${L2}/>` +
    `<path d="M${x - 30} 0 L${x - 30} ${topp + 16} Q${x} ${topp + 28} ${x + 30} ${topp + 16} L${x + 30} 0 Z" fill="${VATTEN}" ${L2}/>` +
    `<path d="M${x - 15} 6 V${topp + 8} M${x + 2} 0 V${topp + 14} M${x + 17} 10 V${topp + 6}" stroke="${VATTEN_LJUS}" stroke-width="5" stroke-linecap="round" opacity="0.85"/>` +
    `<ellipse cx="${x}" cy="${y}" rx="64" ry="22" fill="${VATTEN}" ${L2}/>` +
    `<circle cx="${x - 30}" cy="${y - 10}" r="9" fill="${VIT}" opacity="0.9"/><circle cx="${x - 10}" cy="${y - 16}" r="11" fill="${VIT}" opacity="0.9"/>` +
    `<circle cx="${x + 14}" cy="${y - 14}" r="10" fill="${VIT}" opacity="0.9"/><circle cx="${x + 32}" cy="${y - 8}" r="8" fill="${VIT}" opacity="0.9"/>`
  );
}

// --- Stigen: upptrampad jordstig genom grönskan ------------------------------
function stig(world) {
  const d = smoothOpenPath(routePoints(world));
  return (
    `<path d="${d}" fill="none" stroke="${STIG_KANT}" stroke-width="54" stroke-linecap="round" opacity="0.9"/>` +
    `<path d="${d}" fill="none" stroke="${STIG}" stroke-width="44" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${MARK_MORK}" stroke-width="6" stroke-linecap="round" stroke-dasharray="2 58" opacity="0.55"/>`
  );
}

/** Hängbro av plankor och rep, roterad längs stigen. */
function hangbro({ x, y, rot = 0 }) {
  let plankor = "";
  for (let i = 0; i < 8; i++) {
    plankor += `<rect x="${-60 + i * 15.5}" y="-22" width="12" height="44" rx="3" fill="${PLANKA}" stroke="${O}" stroke-width="3"/>`;
  }
  const rep = (sy) => `<path d="M-68 ${sy} Q0 ${sy + Math.sign(sy) * -10} 68 ${sy}" fill="none" stroke="${STAM_MORK}" stroke-width="4.5" stroke-linecap="round"/>`;
  const stolpe = (px, py) => `<circle cx="${px}" cy="${py}" r="7" fill="${STAM_MORK}" ${L2}/>`;
  return grupp(x, y, 1,
    plankor + rep(-28) + rep(28) + stolpe(-68, -28) + stolpe(68, -28) + stolpe(-68, 28) + stolpe(68, 28), rot);
}

/** Templet vid målet: trappstegspyramid med mossa och klätterväxter. */
function tempel({ x, y }) {
  const sten = (rx, ry, w, h) => `<rect x="${rx}" y="${ry}" width="${w}" height="${h}" rx="4" fill="${STEN}" ${L2}/>`;
  return grupp(x, y, 1,
    `<ellipse cx="0" cy="6" rx="96" ry="16" fill="${O}" opacity="0.14"/>` +
    sten(-80, -38, 160, 40) + sten(-60, -74, 120, 38) + sten(-40, -106, 80, 34) +
    `<path d="M-16 2 L-16 -106 L16 -106 L16 2 Z" fill="${STEN_LJUS}" ${L2}/>` +
    `<path d="M-16 -16 H16 M-16 -32 H16 M-16 -48 H16 M-16 -64 H16 M-16 -80 H16 M-16 -94 H16" stroke="${STEN_MORK}" stroke-width="2.5"/>` +
    `<rect x="-24" y="-132" width="48" height="28" rx="4" fill="${STEN}" ${L2}/>` +
    `<path d="M-9 -104 L-9 -120 Q0 -128 9 -120 L9 -104 Z" fill="${O}"/>` +
    `<circle cx="0" cy="-142" r="8" fill="${GUL}" ${L2}/>` +
    `<ellipse cx="-56" cy="-38" rx="22" ry="8" fill="${LOV}" ${L2}/><ellipse cx="44" cy="-74" rx="18" ry="7" fill="${LOV}" ${L2}/>` +
    `<ellipse cx="-30" cy="-106" rx="14" ry="6" fill="${LOV}" ${L2}/>` +
    `<path d="M62 -38 q8 14 0 26 t2 22 M-70 -2 q-6 -10 0 -20" fill="none" stroke="${LIAN}" stroke-width="5" stroke-linecap="round"/>`);
}

// --- Dekor-typer (ritas från world.decorations) ------------------------------

/** Mörk fläck i undervegetationen (platt, bakom allt). */
function skugga(x, y, s) {
  return `<ellipse cx="${x}" cy="${y}" rx="${130 * s}" ry="${70 * s}" fill="${MARK_MORK}" opacity="0.4"/>`;
}

/** Ett stort tropiskt blad (pekar uppåt från origo, längd ~100). */
function blad(rot, f, len = 1) {
  const d = `M0 0 C-36 -24 -40 -76 0 -100 C40 -76 36 -24 0 0 Z`;
  return (
    `<g transform="rotate(${rot}) scale(${len})">` +
    `<path d="${d}" fill="${f}" ${L2}/>` +
    `<path d="M0 -4 L0 -90 M0 -30 L-20 -46 M0 -54 L-22 -70 M0 -30 L20 -46 M0 -54 L22 -70" fill="none" stroke="${LOV_MORK}" stroke-width="3" stroke-linecap="round" opacity="0.8"/>` +
    `</g>`
  );
}

/** Ruska av stora blad (ramar in kanterna och gläntorna). */
function bladruska(x, y, s) {
  return grupp(x, y, s,
    blad(-62, LOV_MORK, 0.95) + blad(58, LOV_MORK, 0.9) + blad(-28, LOV, 1.1) + blad(26, LOV, 1.05) + blad(0, LOV_LJUS, 0.8));
}

/** Ormbunke: böjda blad med små småblad (streckad bred linje = kam). */
function ormbunke(x, y, s) {
  const blad = (d) =>
    `<path d="${d}" fill="none" stroke="${O}" stroke-width="20" stroke-dasharray="3.5 3" opacity="0.9"/>` +
    `<path d="${d}" fill="none" stroke="${LOV}" stroke-width="15" stroke-dasharray="3.5 3"/>` +
    `<path d="${d}" fill="none" stroke="${LOV_MORK}" stroke-width="3.5" stroke-linecap="round"/>`;
  return grupp(x, y, s,
    blad("M0 0 Q-20 -30 -56 -36") + blad("M0 0 Q20 -30 56 -36") + blad("M0 0 Q-8 -40 -24 -64") + blad("M0 0 Q8 -40 24 -64"));
}

/** Djungelträd: hög stam, bred krona, en lian som hänger ner. */
function trad(x, y, s) {
  return grupp(x, y, s,
    `<ellipse cx="0" cy="6" rx="56" ry="14" fill="${O}" opacity="0.14"/>` +
    `<path d="M-12 0 Q-16 -90 -7 -160 L7 -160 Q16 -90 12 0 Z" fill="${STAM}" ${L2}/>` +
    `<path d="M-12 0 Q-26 -2 -30 8 M12 0 Q26 -2 30 8" fill="none" ${L2}/>` +
    `<path d="M-3 -40 Q2 -60 -2 -90" fill="none" stroke="${STAM_MORK}" stroke-width="3" opacity="0.6"/>` +
    `<circle cx="-56" cy="-162" r="42" fill="${LOV_MORK}" ${L2}/>` +
    `<circle cx="56" cy="-166" r="42" fill="${LOV_MORK}" ${L2}/>` +
    `<circle cx="-24" cy="-196" r="46" fill="${LOV}" ${L2}/>` +
    `<circle cx="30" cy="-200" r="44" fill="${LOV}" ${L2}/>` +
    `<circle cx="-36" cy="-208" r="18" fill="${LOV_LJUS}" opacity="0.7"/>` +
    `<circle cx="18" cy="-214" r="14" fill="${LOV_LJUS}" opacity="0.6"/>` +
    `<path d="M48 -132 q10 30 0 56 t2 40" fill="none" stroke="${LIAN}" stroke-width="5" stroke-linecap="round"/>` +
    `<ellipse cx="54" cy="-96" rx="9" ry="5" fill="${LOV}" ${L2} transform="rotate(30 54 -96)"/>`);
}

/** Papegoja (ara) på en gren. Röd eller grön beroende på plats. */
function papegoja(x, y, s) {
  const gron = Math.round(x / 10) % 2 === 1;
  const kropp = gron ? LOV : ROD;
  const vinge = gron ? GUL : BLA;
  return grupp(x, y, s,
    `<path d="M-46 4 Q0 -4 46 6" fill="none" stroke="${O}" stroke-width="13" stroke-linecap="round"/>` +
    `<path d="M-46 4 Q0 -4 46 6" fill="none" stroke="${STAM}" stroke-width="7" stroke-linecap="round"/>` +
    `<ellipse cx="38" cy="0" rx="10" ry="5" fill="${LOV}" ${L2} transform="rotate(-24 38 0)"/>` +
    `<path d="M2 -6 L14 48 L2 42 Z" fill="${vinge}" ${L2}/>` +
    `<path d="M-2 -6 L-6 46 L-14 38 Z" fill="${GUL}" ${L2}/>` +
    `<ellipse cx="0" cy="-22" rx="15" ry="22" fill="${kropp}" ${L2}/>` +
    `<path d="M-2 -32 Q20 -24 12 2 Q2 -10 -2 -32 Z" fill="${vinge}" ${L2}/>` +
    `<circle cx="-2" cy="-46" r="13" fill="${kropp}" ${L2}/>` +
    `<ellipse cx="-7" cy="-47" rx="6" ry="5" fill="${VIT}"/>` +
    `<circle cx="-7" cy="-48" r="2.6" fill="${O}"/>` +
    `<path d="M-12 -50 Q-26 -48 -20 -34 Q-16 -40 -11 -41 Z" fill="#F3E4C8" ${L2}/>` +
    `<path d="M-6 -2 L-8 4 M6 -2 L8 4" stroke="${O}" stroke-width="3.5" stroke-linecap="round"/>`);
}

/** Blå morfofjäril. */
function fjaril(x, y, s) {
  const V = `stroke="${O}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"`;
  return grupp(x, y, s,
    `<ellipse cx="-10" cy="-3" rx="11" ry="8" fill="${BLA}" ${V} transform="rotate(-24 -10 -3)"/>` +
    `<ellipse cx="10" cy="-3" rx="11" ry="8" fill="${BLA}" ${V} transform="rotate(24 10 -3)"/>` +
    `<ellipse cx="-7" cy="7" rx="6" ry="5" fill="${BLA}" ${V}/><ellipse cx="7" cy="7" rx="6" ry="5" fill="${BLA}" ${V}/>` +
    `<ellipse cx="0" cy="0" rx="2.8" ry="9" fill="${O}"/>`);
}

/** Hibiskus (stor rosa-röd blomma med blad). */
function blomma(x, y, s) {
  const kb = (a) => `<circle cx="${n1(Math.cos(a) * 11)}" cy="${n1(Math.sin(a) * 11)}" r="9.5" fill="${ROSA}" ${L2}/>`;
  return grupp(x, y, s,
    `<ellipse cx="-18" cy="6" rx="16" ry="7" fill="${LOV_MORK}" ${L2} transform="rotate(-20 -18 6)"/>` +
    `<ellipse cx="18" cy="8" rx="15" ry="7" fill="${LOV_MORK}" ${L2} transform="rotate(24 18 8)"/>` +
    kb(-1.57) + kb(-0.31) + kb(0.94) + kb(2.2) + kb(3.46) +
    `<circle cx="0" cy="0" r="6" fill="${ROD}" ${L2}/>` +
    `<path d="M0 0 L8 -14" stroke="${GUL}" stroke-width="3" stroke-linecap="round"/>`);
}

/** Mossig sten. */
function sten(x, y, s) {
  return grupp(x, y, s,
    `<ellipse cx="0" cy="6" rx="30" ry="8" fill="${O}" opacity="0.12"/>` +
    `<path d="M-28 8 Q-30 -22 0 -22 Q30 -22 28 8 Z" fill="${STEN}" ${L2}/>` +
    `<path d="M-22 -10 Q-14 -24 2 -22 Q18 -22 22 -12 Q10 -16 0 -12 Q-12 -8 -22 -10 Z" fill="${LOV}" opacity="0.9"/>` +
    `<ellipse cx="-8" cy="-4" rx="9" ry="5" fill="${STEN_LJUS}" opacity="0.7"/>`);
}

/** Näckrosblad med blomma (ligger i floden). */
function nackros(x, y, s) {
  return grupp(x, y, s,
    `<path d="M0 0 L22 -6 A24 14 0 1 1 22 6 Z" fill="${LOV}" ${L2}/>` +
    `<circle cx="-6" cy="-2" r="6" fill="${ROSA}" ${L2}/><circle cx="-6" cy="-2" r="2.4" fill="${GUL}"/>`);
}

/** Glad groda på ett näckrosblad. */
function groda(x, y, s) {
  return grupp(x, y, s,
    `<path d="M0 6 L24 0 A26 15 0 1 1 24 12 Z" fill="${LOV_MORK}" ${L2}/>` +
    `<ellipse cx="0" cy="-4" rx="16" ry="11" fill="${LOV_LJUS}" ${L2}/>` +
    `<circle cx="-8" cy="-14" r="6" fill="${LOV_LJUS}" ${L2}/><circle cx="8" cy="-14" r="6" fill="${LOV_LJUS}" ${L2}/>` +
    `<circle cx="-8" cy="-15" r="2.6" fill="${O}"/><circle cx="8" cy="-15" r="2.6" fill="${O}"/>` +
    `<path d="M-6 -2 q6 5 12 0" fill="none" stroke="${O}" stroke-width="2.5" stroke-linecap="round"/>`);
}

// --- Lövtak + lianer (ritas överst, bara i de angivna x-spannen) -------------
function lovtak(spann, w) {
  let kant = "", fyll = "", ljus = "";
  for (const [a, b] of spann || []) {
    for (let x = a, i = 0; x <= Math.min(b, w); x += 70, i++) {
      const cy = 10 + (i % 2) * 18, r = 46 + (i % 3) * 6;
      kant += `<circle cx="${x}" cy="${cy}" r="${r}" fill="${O}" stroke="${O}" stroke-width="8"/>`;
      fyll += `<circle cx="${x}" cy="${cy}" r="${r}" fill="${i % 2 ? TAK : LOV_MORK}"/>`;
      ljus += `<circle cx="${x - 12}" cy="${cy + 14}" r="${n1(r * 0.3)}" fill="${LOV}" opacity="0.6"/>`;
    }
  }
  return kant + fyll + ljus;
}

function lian({ x, l }) {
  const d = `M${x} 30 q-16 ${n1(l / 4)} 0 ${n1(l / 2)} t0 ${n1(l / 2)}`;
  let blad = "";
  for (let t = 60, i = 0; t < l; t += 42, i++) {
    const bx = x + (i % 2 ? 10 : -10);
    blad += `<ellipse cx="${bx}" cy="${30 + t}" rx="11" ry="6" fill="${i % 2 ? LOV : LOV_LJUS}" ${L2} transform="rotate(${i % 2 ? 30 : -30} ${bx} ${30 + t})"/>`;
  }
  return (
    `<path d="${d}" fill="none" stroke="${O}" stroke-width="9" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${LIAN}" stroke-width="5" stroke-linecap="round"/>` + blad
  );
}

/** Målflagga (samma form som Skogens). */
function flagga(x, y) {
  return (
    `<g transform="translate(${x + 36} ${y - 6})">` +
    `<ellipse cx="0" cy="4" rx="16" ry="6" fill="${O}" opacity="0.12"/>` +
    `<rect x="-3" y="-66" width="6" height="70" rx="3" fill="${STAM_MORK}" ${L2}/>` +
    `<path d="M3 -64 L46 -48 L3 -30 Z" fill="${GUL}" ${L2}/>` +
    `</g>`
  );
}

const TYPER = { skugga, bladruska, ormbunke, trad, papegoja, fjaril, blomma, sten, nackros, groda };
const I_FLODEN = new Set(["nackros", "groda"]);

// ============================================================================
// Hela scenen (bakifrån och fram): mark → skuggor → flod → vattenfall →
// flodens invånare → stig → hängbroar → tempel → övrig dekor (sorterad på y)
// → flaggan → lövtak → lianer.
// ============================================================================
export function djungelnScen(world) {
  const { width: w, height: h } = world.scene;
  const deko = world.decorations || [];
  const rita = (d) => (TYPER[d.type] ? TYPER[d.type](d.x, d.y, d.s == null ? 1 : d.s) : "");
  const bakom = deko.filter((d) => d.type === "skugga");
  const iFloden = deko.filter((d) => I_FLODEN.has(d.type));
  const framfor = deko
    .filter((d) => d.type !== "skugga" && !I_FLODEN.has(d.type))
    .slice()
    .sort((a, b) => a.y - b.y);
  return (
    mark(w, h) +
    bakom.map(rita).join("") +
    (world.flod ? flod(world.flod) : "") +
    (world.vattenfall ? vattenfall(world.vattenfall) : "") +
    iFloden.map(rita).join("") +
    stig(world) +
    (world.broar || []).map(hangbro).join("") +
    (world.tempel ? tempel(world.tempel) : "") +
    framfor.map(rita).join("") +
    (world.mal ? flagga(world.mal.x, world.mal.y) : "") +
    lovtak(world.lovtak, w) +
    (world.lianer || []).map(lian).join("")
  );
}
