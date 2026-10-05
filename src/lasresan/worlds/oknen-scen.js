// ============================================================================
// Läsresan – Öknens scen (src/lasresan/worlds/oknen-scen.js)  ·  issue #400
// ----------------------------------------------------------------------------
// EGENRITAD inline-SVG i portalens platta vektorstil – se skogen-scen.js för
// mönstret. Ren strängbyggare utan DOM: oknenScen(world) → scenens inre
// SVG-markup (sand, dyner, stig, oas, dekor) i världspixlar.
// ============================================================================

import { O } from "../../art-style.js";
import { n1, routePoints, smoothOpenPath } from "./stig.js";

// --- Palett (varm öken, ur stilguiden) --------------------------------------
const SAND = "#F0DCA8";
const SAND_LJUS = "#F8EBC4";
const SAND_MORK = "#DFC388";
const STIG = "#E8C684";
const STIG_KANT = "#C9A05C";
const KLIPPA = "#D98E5F";
const KLIPPA_LJUS = "#EAAD7E";
const KLIPPA_MORK = "#B56F45";
const KAKTUS = "#58A977";
const KAKTUS_LJUS = "#79C495";
const PALM_STAM = "#B0805A";
const PALM_BLAD = "#6FC66F";
const VATTEN = "#5FB8E0";
const VATTEN_LJUS = "#AEE4F2";
const RUIN = "#D8CBAA";
const RUIN_MORK = "#B5A784";
const BEN = "#FFF3DC";
const GUL = "#F7C948";
const ROSA = "#F890B7";

const L2 = `stroke="${O}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`;

// --- Mark: sand med ljusa/mörka fält + värmedis vid horisontlinjen ----------
function mark(w, h) {
  const falt = [
    [350, 780, 190, SAND_MORK, 0.3], [1050, 850, 210, SAND_MORK, 0.25],
    [1300, 350, 170, SAND_MORK, 0.28], [550, 350, 160, SAND_MORK, 0.22],
    [800, 600, 190, SAND_LJUS, 0.55], [200, 500, 140, SAND_LJUS, 0.45],
    [1200, 600, 150, SAND_LJUS, 0.5], [700, 180, 150, SAND_LJUS, 0.45],
  ]
    .map(([x, y, r, f, o]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${n1(r * 0.5)}" fill="${f}" opacity="${o}"/>`)
    .join("");
  return `<rect x="0" y="0" width="${w}" height="${h}" fill="${SAND}"/>` + falt;
}

// --- Stigen: upptrampad karavanled genom sanden ------------------------------
function stig(world) {
  const d = smoothOpenPath(routePoints(world));
  return (
    `<path d="${d}" fill="none" stroke="${STIG_KANT}" stroke-width="54" stroke-linecap="round" opacity="0.7"/>` +
    `<path d="${d}" fill="none" stroke="${STIG}" stroke-width="44" stroke-linecap="round"/>` +
    // Kamel-/fotspår: små parvisa prickar längs leden.
    `<path d="${d}" fill="none" stroke="${STIG_KANT}" stroke-width="7" stroke-linecap="round" stroke-dasharray="3 60" opacity="0.8"/>`
  );
}

// --- Dekor-typer -------------------------------------------------------------

/** Sanddyn: mjuk våglinje med skugga (platt, bakom allt). */
function dyn(x, y, s) {
  return (
    `<path d="M${n1(x - 150 * s)} ${y} Q${n1(x - 60 * s)} ${n1(y - 44 * s)} ${n1(x + 30 * s)} ${n1(y - 10 * s)} T${n1(x + 170 * s)} ${n1(y - 6 * s)}" fill="none" stroke="${SAND_MORK}" stroke-width="${n1(7 * s)}" stroke-linecap="round" opacity="0.8"/>` +
    `<path d="M${n1(x - 120 * s)} ${n1(y + 14 * s)} Q${n1(x - 30 * s)} ${n1(y - 16 * s)} ${n1(x + 60 * s)} ${n1(y + 8 * s)}" fill="none" stroke="${SAND_LJUS}" stroke-width="${n1(6 * s)}" stroke-linecap="round" opacity="0.9"/>`
  );
}

/** Kaktus: klassisk saguaro med två armar och blomma. */
function kaktus(x, y, s) {
  return (
    `<ellipse cx="${x}" cy="${y + 5 * s}" rx="${26 * s}" ry="${8 * s}" fill="${O}" opacity="0.12"/>` +
    `<path d="M${n1(x - 11 * s)} ${y} L${n1(x - 11 * s)} ${n1(y - 52 * s)} Q${x} ${n1(y - 70 * s)} ${n1(x + 11 * s)} ${n1(y - 52 * s)} L${n1(x + 11 * s)} ${y} Z" fill="${KAKTUS}" ${L2}/>` +
    `<path d="M${n1(x - 11 * s)} ${n1(y - 30 * s)} Q${n1(x - 32 * s)} ${n1(y - 32 * s)} ${n1(x - 30 * s)} ${n1(y - 52 * s)} Q${n1(x - 29 * s)} ${n1(y - 60 * s)} ${n1(x - 22 * s)} ${n1(y - 58 * s)} Q${n1(x - 20 * s)} ${n1(y - 44 * s)} ${n1(x - 11 * s)} ${n1(y - 42 * s)} Z" fill="${KAKTUS}" ${L2}/>` +
    `<path d="M${n1(x + 11 * s)} ${n1(y - 22 * s)} Q${n1(x + 30 * s)} ${n1(y - 24 * s)} ${n1(x + 28 * s)} ${n1(y - 42 * s)} Q${n1(x + 27 * s)} ${n1(y - 50 * s)} ${n1(x + 20 * s)} ${n1(y - 48 * s)} Q${n1(x + 19 * s)} ${n1(y - 36 * s)} ${n1(x + 11 * s)} ${n1(y - 34 * s)} Z" fill="${KAKTUS}" ${L2}/>` +
    `<line x1="${x}" y1="${n1(y - 10 * s)}" x2="${x}" y2="${n1(y - 56 * s)}" stroke="${KAKTUS_LJUS}" stroke-width="${n1(3 * s)}" opacity="0.7"/>` +
    `<circle cx="${x}" cy="${n1(y - 66 * s)}" r="${5 * s}" fill="${ROSA}" ${L2}/>`
  );
}

/** Röd sandstensklippa (två toppar med ljussida). */
function klippa(x, y, s) {
  return (
    `<ellipse cx="${x}" cy="${y + 8 * s}" rx="${62 * s}" ry="${14 * s}" fill="${O}" opacity="0.12"/>` +
    `<path d="M${n1(x - 58 * s)} ${n1(y + 8 * s)} L${n1(x - 44 * s)} ${n1(y - 48 * s)} L${n1(x - 20 * s)} ${n1(y - 56 * s)} L${n1(x - 8 * s)} ${n1(y + 8 * s)} Z" fill="${KLIPPA}" ${L2}/>` +
    `<path d="M${n1(x - 14 * s)} ${n1(y + 8 * s)} L${n1(x) } ${n1(y - 78 * s)} L${n1(x + 30 * s)} ${n1(y - 64 * s)} L${n1(x + 56 * s)} ${n1(y + 8 * s)} Z" fill="${KLIPPA_MORK}" ${L2}/>` +
    `<path d="M${n1(x)} ${n1(y - 74 * s)} L${n1(x + 26 * s)} ${n1(y - 60 * s)} L${n1(x + 18 * s)} ${n1(y - 30 * s)} L${n1(x - 2 * s)} ${n1(y - 40 * s)} Z" fill="${KLIPPA_LJUS}" opacity="0.6"/>` +
    `<line x1="${n1(x - 40 * s)}" y1="${n1(y - 16 * s)}" x2="${n1(x - 16 * s)}" y2="${n1(y - 20 * s)}" stroke="${KLIPPA_MORK}" stroke-width="2.5" opacity="0.6"/>`
  );
}

/** Palm: böjd stam + bladkrona + kokosnötter. */
function palm(x, y, s) {
  const blad = (rot) =>
    `<path d="M0 0 Q${n1(26 * s)} ${n1(-14 * s)} ${n1(46 * s)} ${n1(-2 * s)} Q${n1(24 * s)} ${n1(2 * s)} 0 0 Z" fill="${PALM_BLAD}" ${L2} transform="rotate(${rot})"/>`;
  return (
    `<ellipse cx="${x}" cy="${y + 5 * s}" rx="${30 * s}" ry="${9 * s}" fill="${O}" opacity="0.12"/>` +
    `<path d="M${n1(x - 6 * s)} ${y} Q${n1(x - 2 * s)} ${n1(y - 40 * s)} ${n1(x + 14 * s)} ${n1(y - 64 * s)} L${n1(x + 20 * s)} ${n1(y - 58 * s)} Q${n1(x + 6 * s)} ${n1(y - 36 * s)} ${n1(x + 6 * s)} ${y} Z" fill="${PALM_STAM}" ${L2}/>` +
    `<g transform="translate(${n1(x + 17 * s)} ${n1(y - 62 * s)}) scale(${s})">` +
    blad(-150) + blad(-110) + blad(-60) + blad(-15) + blad(25) +
    `<circle cx="-4" cy="4" r="5" fill="${KLIPPA_MORK}" ${L2}/><circle cx="6" cy="6" r="5" fill="${KLIPPA_MORK}" ${L2}/>` +
    `</g>`
  );
}

/** Liten ruin: raserade sandstensmurar och en kullfallen pelare. */
function ruin(x, y, s) {
  const block = (bx, by, w, h) =>
    `<rect x="${n1(x + bx * s)}" y="${n1(y + by * s)}" width="${n1(w * s)}" height="${n1(h * s)}" rx="${n1(3 * s)}" fill="${RUIN}" ${L2}/>`;
  return (
    `<ellipse cx="${x}" cy="${y + 10 * s}" rx="${54 * s}" ry="${12 * s}" fill="${O}" opacity="0.1"/>` +
    block(-50, -16, 36, 24) + block(-46, -34, 24, 18) + block(2, -20, 30, 28) +
    `<rect x="${n1(x - 8 * s)}" y="${n1(y - 2 * s)}" width="${n1(52 * s)}" height="${n1(14 * s)}" rx="${n1(7 * s)}" fill="${RUIN_MORK}" ${L2} transform="rotate(8 ${x} ${y})"/>` +
    `<line x1="${n1(x + 4 * s)}" y1="${n1(y + 2 * s)}" x2="${n1(x + 14 * s)}" y2="${n1(y + 1 * s)}" stroke="${O}" stroke-width="2" opacity="0.4"/>`
  );
}

/** Oasen: damm med sandkant, två palmer och vass. */
function oas(x, y, s = 1) {
  return (
    `<ellipse cx="${x}" cy="${y}" rx="${110 * s}" ry="${46 * s}" fill="${SAND_MORK}" ${L2}/>` +
    `<ellipse cx="${x}" cy="${y}" rx="${92 * s}" ry="${36 * s}" fill="${VATTEN}"/>` +
    `<ellipse cx="${n1(x - 24 * s)}" cy="${n1(y - 8 * s)}" rx="${38 * s}" ry="${14 * s}" fill="${VATTEN_LJUS}" opacity="0.6"/>` +
    `<path d="M${n1(x - 50 * s)} ${n1(y + 10 * s)} q${n1(50 * s)} ${n1(18 * s)} ${n1(100 * s)} 0" fill="none" stroke="${VATTEN_LJUS}" stroke-width="${n1(4 * s)}" opacity="0.7"/>` +
    palm(x - 96 * s, y - 20 * s, 0.85 * s) +
    palm(x + 100 * s, y + 6 * s, 0.75 * s)
  );
}

/** Liten rund ökensten. */
function oksten(x, y, s) {
  return (
    `<ellipse cx="${x}" cy="${y + 5 * s}" rx="${24 * s}" ry="${7 * s}" fill="${O}" opacity="0.1"/>` +
    `<path d="M${n1(x - 22 * s)} ${n1(y + 6 * s)} Q${n1(x - 24 * s)} ${n1(y - 16 * s)} ${x} ${n1(y - 16 * s)} Q${n1(x + 24 * s)} ${n1(y - 16 * s)} ${n1(x + 22 * s)} ${n1(y + 6 * s)} Z" fill="${KLIPPA_LJUS}" ${L2}/>` +
    `<ellipse cx="${n1(x - 6 * s)}" cy="${n1(y - 5 * s)}" rx="${9 * s}" ry="${5 * s}" fill="${SAND_LJUS}" opacity="0.7"/>`
  );
}

/** Benknota (ökendetalj, mer rolig än läskig). */
function benknota(x, y, s) {
  return (
    `<g transform="rotate(-18 ${x} ${y})">` +
    `<rect x="${n1(x - 16 * s)}" y="${n1(y - 3 * s)}" width="${n1(32 * s)}" height="${n1(6 * s)}" rx="${n1(3 * s)}" fill="${BEN}" ${L2}/>` +
    `<circle cx="${n1(x - 17 * s)}" cy="${n1(y - 4 * s)}" r="${4.4 * s}" fill="${BEN}" ${L2}/>` +
    `<circle cx="${n1(x - 17 * s)}" cy="${n1(y + 4 * s)}" r="${4.4 * s}" fill="${BEN}" ${L2}/>` +
    `<circle cx="${n1(x + 17 * s)}" cy="${n1(y - 4 * s)}" r="${4.4 * s}" fill="${BEN}" ${L2}/>` +
    `<circle cx="${n1(x + 17 * s)}" cy="${n1(y + 4 * s)}" r="${4.4 * s}" fill="${BEN}" ${L2}/>` +
    `</g>`
  );
}

/** Torr ökenbuske. */
function okenbuske(x, y, s) {
  const kvist = (dx, h) =>
    `<path d="M${x} ${n1(y + 4 * s)} q${n1(dx * 0.6)} ${n1(-h * 0.7)} ${n1(dx)} ${n1(-h)}" fill="none" stroke="${KLIPPA_MORK}" stroke-width="${n1(3.4 * s)}" stroke-linecap="round" opacity="0.8"/>`;
  return (
    `<ellipse cx="${x}" cy="${y + 6 * s}" rx="${18 * s}" ry="${5 * s}" fill="${O}" opacity="0.1"/>` +
    kvist(-14 * s, 20 * s) + kvist(14 * s, 20 * s) + kvist(-5 * s, 28 * s) + kvist(6 * s, 25 * s) +
    `<circle cx="${n1(x - 8 * s)}" cy="${n1(y - 12 * s)}" r="${3 * s}" fill="${KAKTUS}" opacity="0.8"/>` +
    `<circle cx="${n1(x + 9 * s)}" cy="${n1(y - 14 * s)}" r="${3 * s}" fill="${KAKTUS}" opacity="0.8"/>`
  );
}

/** Målflagga (samma form som Skogens, ökengul). */
function flagga(x, y) {
  return (
    `<g transform="translate(${x + 36} ${y - 6})">` +
    `<ellipse cx="0" cy="4" rx="16" ry="6" fill="${O}" opacity="0.12"/>` +
    `<rect x="-3" y="-66" width="6" height="70" rx="3" fill="${KLIPPA_MORK}" ${L2}/>` +
    `<path d="M3 -64 L46 -48 L3 -30 Z" fill="${GUL}" ${L2}/>` +
    `</g>`
  );
}

const TYPER = { dyn, kaktus, klippa, palm, ruin, oksten, benknota, okenbuske };

// ============================================================================
// Hela scenen (bakifrån och fram): sand → dyner → stig → oas → övrig dekor
// (sorterad på y) → flaggan.
// ============================================================================
export function oknenScen(world) {
  const { width: w, height: h } = world.scene;
  const deko = world.decorations || [];
  const bakom = deko.filter((d) => d.type === "dyn");
  const framfor = deko
    .filter((d) => d.type !== "dyn")
    .slice()
    .sort((a, b) => a.y - b.y);
  const rita = (d) => (TYPER[d.type] ? TYPER[d.type](d.x, d.y, d.s == null ? 1 : d.s) : "");
  return (
    mark(w, h) +
    bakom.map(rita).join("") +
    stig(world) +
    (world.oas ? oas(world.oas.x, world.oas.y) : "") +
    framfor.map(rita).join("") +
    (world.mal ? flagga(world.mal.x, world.mal.y) : "")
  );
}
