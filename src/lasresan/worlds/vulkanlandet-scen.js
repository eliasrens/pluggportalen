// ============================================================================
// Läsresan – Vulkanlandets scen (src/lasresan/worlds/vulkanlandet-scen.js) · #660
// ----------------------------------------------------------------------------
// EGENRITAD inline-SVG i portalens platta vektorstil – se skogen-scen.js för
// mönstret. Ren strängbyggare utan DOM: vulkanlandetScen(world) → scenens
// inre SVG-markup (varm himmel, mörka berg, vulkanen, lavafloden, stenbroar,
// stig och dekor) i världspixlar.
//
// Barnvänligt: varma färger, runda former, en snäll vulkan som ångar. Lavan
// GLÖDER LUGNT – den är helt stilla (ingen blinkning). Det enda som rör sig är
// ångan, som sakta gungar uppåt (klassen lr-anga i ui-map-stil.js, avstängd
// vid prefers-reduced-motion).
// ============================================================================

import { O } from "../../art-style.js";
import { n1, routePoints, smoothOpenPath } from "./stig.js";

// --- Palett (varm skymning, mörka klippor, glödande lava) -------------------
const HIMMEL = "#F9D3A5";
const HIMMEL_LJUS = "#FCE6C6";
const SOL = "#FFE7B0";
const FJARRAN = "#6E5A72";
const MARK = "#7E6560";
const MARK_LJUS = "#957A70";
const MARK_MORK = "#684F4E";
const VULKAN = "#5E4B5A";
const VULKAN_LJUS = "#76606E";
const KLIPPA = "#4C4661";
const KLIPPA_LJUS = "#655D7C";
const LAVA = "#F08A3C";
const LAVA_LJUS = "#F7C948";
const LAVA_GLOD = "#F49E4C";
const STIG = "#E2BC8C";
const STIG_KANT = "#A9805B";
const STENBRO = "#B9AFA6";
const STENBRO_MORK = "#958A80";
const ANGA = "#FFFFFF";
const ANGA_SKUGGA = "#EDE3EA";
const VATTEN = "#58C6A9";
const VATTEN_LJUS = "#C9F0DC";
const LILA = "#B79BE0";
const ROSA = "#F890B7";
const GRON = "#6FC66F";
const GUL = "#F7C948";
const ROD = "#EF6F6C";
const STAM = "#8A6242";

const L2 = `stroke="${O}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`;
const L3 = `stroke="${O}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
const grupp = (x, y, s, inner, flip = false) =>
  `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})">${inner}</g>`;

/** Ett ångmoln av runda puffar (klassen gör att det gungar sakta uppåt). */
function angmoln(x, y, s, fordrojning = 0) {
  return (
    `<g transform="translate(${x} ${y}) scale(${s})"><g class="lr-anga" style="animation-delay:${fordrojning}s">` +
    `<circle cx="-14" cy="0" r="16" fill="${ANGA}" ${L3}/><circle cx="12" cy="-6" r="20" fill="${ANGA}" ${L3}/>` +
    `<circle cx="-2" cy="-26" r="17" fill="${ANGA}" ${L3}/>` +
    `<circle cx="-14" cy="0" r="14" fill="${ANGA}"/><circle cx="12" cy="-6" r="18" fill="${ANGA}"/><circle cx="-2" cy="-26" r="15" fill="${ANGA}"/>` +
    `<path d="M-18 4 q14 6 30 -2" fill="none" stroke="${ANGA_SKUGGA}" stroke-width="5" stroke-linecap="round"/>` +
    `</g></g>`
  );
}

// --- Himmel, mark och berg -----------------------------------------------------
function himmel(w) {
  return (
    `<rect x="0" y="0" width="${w}" height="420" fill="${HIMMEL}"/>` +
    `<ellipse cx="${w / 2}" cy="330" rx="${w * 0.7}" ry="120" fill="${HIMMEL_LJUS}" opacity="0.7"/>` +
    `<circle cx="560" cy="150" r="56" fill="${SOL}" ${L3} opacity="0.95"/>`
  );
}

/** Mörka berg i fjärran (en låg kam bakom vulkanen). */
function fjarran(kam, w) {
  if (!kam || !kam.length) return "";
  let d = `M${kam[0][0]} ${kam[0][1]}`;
  for (let i = 1; i < kam.length; i++) {
    const [px, py] = kam[i - 1], [x, y] = kam[i];
    d += ` Q${n1((px + x) / 2)} ${n1(Math.min(py, y) - 30)} ${x} ${y}`;
  }
  d += ` L${w} 300 V430 H0 Z`;
  return `<path d="${d}" fill="${FJARRAN}" ${L2}/>`;
}

function mark(w, h) {
  const d = `M0 350 Q200 320 420 345 T860 340 T1300 350 T${w} 340 V${h} H0 Z`;
  const flackar = [
    [1250, 840, 230, MARK_LJUS, 0.5], [400, 920, 220, MARK_LJUS, 0.45], [900, 640, 190, MARK_LJUS, 0.4],
    [230, 520, 170, MARK_LJUS, 0.4], [1450, 560, 150, MARK_LJUS, 0.35], [650, 450, 160, MARK_MORK, 0.35],
  ]
    .map(([x, y, r, f, o]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${n1(r * 0.45)}" fill="${f}" opacity="${o}"/>`)
    .join("");
  // Små sprickor i marken
  const sprickor = [[180, 860], [1040, 820], [560, 980], [1380, 560], [760, 420]]
    .map(([x, y]) => `<path d="M${x} ${y} l18 -6 l10 10 l20 -4" fill="none" stroke="${MARK_MORK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`)
    .join("");
  return `<path d="${d}" fill="${MARK}" ${L2}/>` + flackar + sprickor;
}

/** Vulkanen: rundad kon med krater, glödande lava i kratern och ånga ovanför. */
function vulkan({ x, y, krater: k, bas, wl, wr }) {
  const kl = x - k, kr = x + k;
  // Rundade, utåtbuktande flanker – en snäll "kulle-vulkan", inte en spets.
  const hv = n1(y + (bas - y) * 0.35);
  const kon = `M${x - wl} ${bas} Q${n1(x - wl * 0.75)} ${hv} ${kl} ${y} Q${x} ${y + 18} ${kr} ${y} Q${n1(x + wr * 0.75)} ${hv} ${x + wr} ${bas} Z`;
  const skugga = `M${x + 20} ${y + 14} Q${x + 60} ${y + 8} ${kr} ${y} Q${n1(x + wr * 0.75)} ${hv} ${x + wr} ${bas} L${x + 150} ${bas} Q${x + 80} ${y + 150} ${x + 20} ${y + 14} Z`;
  return (
    `<path d="${kon}" fill="${VULKAN}" ${L2}/>` +
    `<path d="${skugga}" fill="${KLIPPA}" opacity="0.45"/>` +
    // Ljusa åsar på flankerna
    `<path d="M${x - 40} ${y + 60} Q${x - 90} ${y + 170} ${x - 170} ${bas - 40} M${x + 30} ${y + 90} Q${x + 40} ${y + 180} ${x + 70} ${bas - 30}" fill="none" stroke="${VULKAN_LJUS}" stroke-width="7" stroke-linecap="round"/>` +
    // Kratern med glödande lava
    `<ellipse cx="${x}" cy="${y + 2}" rx="${k + 4}" ry="20" fill="${KLIPPA}" ${L2}/>` +
    `<ellipse cx="${x}" cy="${y + 5}" rx="${k - 12}" ry="12" fill="${LAVA}"/>` +
    `<ellipse cx="${x - 10}" cy="${y + 3}" rx="${n1((k - 12) * 0.55)}" ry="6" fill="${LAVA_LJUS}"/>` +
    // Ånga ur kratern
    angmoln(x - 50, y - 26, 1.1, 0) + angmoln(x + 30, y - 52, 1.3, 1.5) + angmoln(x - 4, y - 92, 1, 3)
  );
}

/** Lavafloden: mörk kant, mjuk glöd runt om, orange kärna och gula strimmor. */
function lavaflod(pts, b = 1) {
  const d = smoothOpenPath(pts);
  const sw = (v) => n1(v * b);
  return (
    `<path d="${d}" fill="none" stroke="${LAVA_LJUS}" stroke-width="${sw(96)}" stroke-linecap="round" opacity="0.16"/>` +
    `<path d="${d}" fill="none" stroke="${LAVA_GLOD}" stroke-width="${sw(72)}" stroke-linecap="round" opacity="0.28"/>` +
    `<path d="${d}" fill="none" stroke="${O}" stroke-width="${sw(54)}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${KLIPPA}" stroke-width="${sw(48)}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${LAVA}" stroke-width="${sw(36)}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${LAVA_LJUS}" stroke-width="${sw(10)}" stroke-linecap="round" stroke-dasharray="30 40" opacity="0.9"/>`
  );
}

/** Lavapöl med glöd och en mörk stenkant. */
function lavapol({ x, y, rx, ry }) {
  return (
    `<ellipse cx="${x}" cy="${y}" rx="${rx + 34}" ry="${ry + 22}" fill="${LAVA_LJUS}" opacity="0.2"/>` +
    `<ellipse cx="${x}" cy="${y}" rx="${rx + 12}" ry="${ry + 9}" fill="${KLIPPA}" ${L2}/>` +
    `<ellipse cx="${x}" cy="${y + 2}" rx="${rx}" ry="${ry}" fill="${LAVA}"/>` +
    `<ellipse cx="${x - 14}" cy="${y - 4}" rx="${n1(rx * 0.5)}" ry="${n1(ry * 0.4)}" fill="${LAVA_LJUS}"/>` +
    `<circle cx="${x + rx * 0.5}" cy="${y + 6}" r="6" fill="${LAVA_LJUS}"/>`
  );
}

// --- Stigen och stenbroarna --------------------------------------------------
function stig(world) {
  const d = smoothOpenPath(routePoints(world));
  return (
    `<path d="${d}" fill="none" stroke="${STIG_KANT}" stroke-width="52" stroke-linecap="round" opacity="0.95"/>` +
    `<path d="${d}" fill="none" stroke="${STIG}" stroke-width="42" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${STIG_KANT}" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 40" opacity="0.7"/>`
  );
}

/** Stenbro: ett valv av stora stenblock över lavan. */
function stenbro({ x, y, rot = 0 }) {
  let block = "";
  for (let i = 0; i < 5; i++) {
    block += `<rect x="${-70 + i * 28}" y="-24" width="26" height="48" rx="6" fill="${i % 2 ? STENBRO_MORK : STENBRO}" ${L3}/>`;
  }
  return (
    `<g transform="translate(${x} ${y}) rotate(${rot})">` +
    `<ellipse cx="0" cy="30" rx="80" ry="10" fill="${O}" opacity="0.18"/>` +
    block +
    `<path d="M-74 -28 H74 M-74 28 H74" stroke="${O}" stroke-width="4" stroke-linecap="round"/>` +
    `</g>`
  );
}

// --- Dekor-typer (ritas från world.decorations) ------------------------------

/** Mörk klippa med rundade toppar. */
function klippa(x, y, s, flip) {
  return grupp(x, y, s,
    `<ellipse cx="0" cy="6" rx="64" ry="12" fill="${O}" opacity="0.16"/>` +
    `<path d="M-60 8 Q-66 -40 -36 -54 Q-28 -92 6 -86 Q36 -84 40 -52 Q66 -40 60 8 Z" fill="${KLIPPA}" ${L2}/>` +
    `<path d="M-30 -48 Q-22 -76 2 -76 M22 -46 Q40 -40 44 -20" fill="none" stroke="${KLIPPA_LJUS}" stroke-width="6" stroke-linecap="round"/>`, flip);
}

/** Ånghål: en liten kulle med ett hål som det ångar ur. */
function anga(x, y, s) {
  return grupp(x, y, s,
    `<path d="M-40 6 Q-30 -16 -12 -18 L12 -18 Q30 -16 40 6 Z" fill="${MARK_MORK}" ${L2}/>` +
    `<ellipse cx="0" cy="-17" rx="13" ry="5" fill="${KLIPPA}" ${L3}/>`) +
    angmoln(x, y - 46 * s, 0.8 * s, (x % 7) / 2);
}

/** Varm källa: turkost vatten med en stenkant och lite ånga. */
function kalla(x, y, s) {
  return grupp(x, y, s,
    `<ellipse cx="0" cy="0" rx="72" ry="30" fill="${STENBRO}" ${L2}/>` +
    `<ellipse cx="0" cy="2" rx="58" ry="21" fill="${VATTEN}" ${L3}/>` +
    `<path d="M-30 -2 h24 M8 8 h22" stroke="${VATTEN_LJUS}" stroke-width="5" stroke-linecap="round"/>`) +
    angmoln(x + 10 * s, y - 40 * s, 0.7 * s, (x % 5) / 2);
}

/** Kristaller (lila och rosa) som växer ur en sten. */
function kristall(x, y, s) {
  const k = (rot, h, f) =>
    `<g transform="rotate(${rot})"><path d="M-9 0 L-9 ${-h + 12} L0 ${-h} L9 ${-h + 12} L9 0 Z" fill="${f}" ${L3}/>` +
    `<path d="M0 ${-h + 4} V-6" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.6"/></g>`;
  return grupp(x, y, s,
    `<ellipse cx="0" cy="4" rx="34" ry="8" fill="${O}" opacity="0.14"/>` +
    k(-28, 44, ROSA) + k(26, 40, LILA) + k(0, 62, LILA) +
    `<path d="M-30 6 Q-30 -10 -10 -10 Q12 -14 30 -6 Q36 2 30 6 Z" fill="${KLIPPA}" ${L3}/>`);
}

/** Tålig eldblomma (röd-gul) med blad. */
function blomma(x, y, s) {
  const kb = (a) => `<ellipse cx="${n1(Math.cos(a) * 9)}" cy="${n1(-22 + Math.sin(a) * 9)}" rx="8" ry="6" fill="${ROD}" ${L3} transform="rotate(${n1((a * 180) / Math.PI)} ${n1(Math.cos(a) * 9)} ${n1(-22 + Math.sin(a) * 9)})"/>`;
  return grupp(x, y, s,
    `<path d="M0 2 V-18" stroke="${GRON}" stroke-width="4" stroke-linecap="round"/>` +
    `<ellipse cx="-10" cy="-6" rx="10" ry="5" fill="${GRON}" ${L3} transform="rotate(-30 -10 -6)"/>` +
    `<ellipse cx="10" cy="-8" rx="10" ry="5" fill="${GRON}" ${L3} transform="rotate(30 10 -8)"/>` +
    kb(0) + kb(1.26) + kb(2.51) + kb(3.77) + kb(5.03) +
    `<circle cx="0" cy="-22" r="6" fill="${GUL}" ${L3}/>`);
}

/** Glad ödla som solar sig på en sten (tittar åt höger). */
function odla(x, y, s, flip) {
  return grupp(x, y, s,
    `<path d="M-30 4 Q-34 -12 -4 -14 Q24 -16 30 4 Z" fill="${STENBRO}" ${L3}/>` +
    `<path d="M-14 -12 Q-40 -18 -52 -4 Q-40 -10 -22 -6" fill="${GRON}" ${L3}/>` +
    `<ellipse cx="2" cy="-18" rx="20" ry="9" fill="${GRON}" ${L3}/>` +
    `<path d="M-8 -12 l-6 8 M10 -12 l6 8" stroke="${O}" stroke-width="4" stroke-linecap="round"/>` +
    `<ellipse cx="26" cy="-24" rx="11" ry="8" fill="${GRON}" ${L3}/>` +
    `<circle cx="29" cy="-27" r="2.6" fill="${O}"/>` +
    `<path d="M24 -20 q5 3 10 0" fill="none" stroke="${O}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<circle cx="-2" cy="-20" r="3" fill="${GUL}"/><circle cx="8" cy="-16" r="2.4" fill="${GUL}"/>`, flip);
}

/** Liten mörk sten. */
function sten(x, y, s) {
  return grupp(x, y, s,
    `<ellipse cx="0" cy="6" rx="30" ry="7" fill="${O}" opacity="0.12"/>` +
    `<path d="M-28 8 Q-30 -16 -6 -22 Q18 -24 26 -8 Q32 2 28 8 Z" fill="${KLIPPA_LJUS}" ${L2}/>` +
    `<path d="M-14 -10 Q-4 -18 8 -16" fill="none" stroke="${STENBRO}" stroke-width="4" stroke-linecap="round" opacity="0.7"/>`);
}

/** Utsiktsplats med målflagga. */
function flagga(x, y) {
  return (
    `<g transform="translate(${x + 40} ${y - 4})">` +
    `<ellipse cx="0" cy="4" rx="22" ry="7" fill="${O}" opacity="0.16"/>` +
    `<rect x="-3" y="-70" width="6" height="74" rx="3" fill="${STAM}" ${L3}/>` +
    `<path d="M3 -68 L46 -52 L3 -34 Z" fill="${GUL}" ${L3}/>` +
    `</g>`
  );
}

const TYPER = { klippa, anga, kalla, kristall, blomma, odla, sten };

// ============================================================================
// Hela scenen (bakifrån och fram): himmel → berg i fjärran → mark → vulkan →
// lavastrimma + lavaflod → lavapöl → stig → stenbroar → dekor (sorterad på y) → flaggan.
// ============================================================================
export function vulkanlandetScen(world) {
  const { width: w, height: h } = world.scene;
  const rita = (d) => (TYPER[d.type] ? TYPER[d.type](d.x, d.y, d.s == null ? 1 : d.s, !!d.flip) : "");
  const deko = (world.decorations || []).slice().sort((a, b) => a.y - b.y);
  return (
    himmel(w) +
    fjarran(world.fjarran, w) +
    mark(w, h) +
    (world.vulkan ? vulkan(world.vulkan) : "") +
    (world.lavastrimma ? lavaflod(world.lavastrimma, 0.5) : "") +
    (world.lava ? lavaflod(world.lava) : "") +
    (world.lavapol ? lavapol(world.lavapol) : "") +
    stig(world) +
    (world.broar || []).map(stenbro).join("") +
    deko.map(rita).join("") +
    (world.mal ? flagga(world.mal.x, world.mal.y) : "")
  );
}
