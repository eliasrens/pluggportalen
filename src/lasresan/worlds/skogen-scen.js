// ============================================================================
// Läsresan – Skogens scen (src/lasresan/worlds/skogen-scen.js)  ·  issue #400
// ----------------------------------------------------------------------------
// EGENRITAD inline-SVG i portalens platta vektorstil (src/art-style.js: mörk
// plommonkontur, mjuka former, glad palett) – samma skola som Skattjaktens
// skattjakten-scen-svg.js. Ren strängbyggare utan DOM: skogenScen(world)
// returnerar scenens inre SVG-markup (mark, bäckar, stig, broar, dekor) i
// världspixlar. Stegmarkörer och avatar ritas av kartvyn OVANPÅ detta.
// All geometri (stig, dekor, bäckar) kommer ur världens config – det här är
// bara penseln.
// ============================================================================

import { O } from "../../art-style.js";
import { n1, routePoints, smoothOpenPath } from "./stig.js";

// --- Palett (svensk sommarskog, ur stilguiden) ------------------------------
const GRAS = "#9CCF7E";
const GRAS_LJUS = "#B7DC9A";
const GRAS_MORK = "#7FB968";
const LOV = "#6FC66F";
const LOV_LJUS = "#8FD98A";
const LOV_MORK = "#57A85A";
const GRAN = "#3F8E5F";
const GRAN_LJUS = "#58A977";
const STAM = "#B0805A";
const STAM_MORK = "#8A6242";
const STEN = "#998B79";
const STEN_LJUS = "#BDAF9B";
const STIG = "#D8B98A";
const STIG_KANT = "#B99463";
const VATTEN = "#5FB8E0";
const VATTEN_LJUS = "#AEE4F2";
const SVAMP = "#EF6F6C";
const GUL = "#F7C948";
const ROSA = "#F6A6C1";

const L2 = `stroke="${O}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`;
const L3 = `stroke="${O}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"`;

// --- Mark: gräs i mjuka nyanser + mörkare skogsbryn i kanterna --------------
function mark(w, h) {
  const flackar = [
    [300, 760, 170, GRAS_MORK, 0.16], [900, 860, 200, GRAS_MORK, 0.12],
    [1300, 300, 160, GRAS_MORK, 0.14], [500, 300, 150, GRAS_MORK, 0.12],
    [750, 560, 180, GRAS_LJUS, 0.5], [1150, 760, 150, GRAS_LJUS, 0.4],
    [250, 180, 140, GRAS_LJUS, 0.4], [1050, 420, 130, GRAS_LJUS, 0.45],
  ]
    .map(([x, y, r, f, o]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${n1(r * 0.55)}" fill="${f}" opacity="${o}"/>`)
    .join("");
  // Skogsbryn: mörk lövkant runt om, så kartan känns som en glänta i storskogen.
  const bryn =
    `<path d="M0 0 H${w} V70 Q${w * 0.75} 120 ${w * 0.5} 80 Q${w * 0.25} 40 0 90 Z" fill="${GRAN}" opacity="0.5"/>` +
    `<path d="M0 ${h} H${w} V${h - 55} Q${w * 0.7} ${h - 100} ${w * 0.45} ${h - 60} Q${w * 0.2} ${h - 25} 0 ${h - 70} Z" fill="${GRAN}" opacity="0.45"/>`;
  return `<rect x="0" y="0" width="${w}" height="${h}" fill="${GRAS}"/>` + flackar + bryn;
}

// --- Bäck med mjuka kanter + ljus stråle i mitten ---------------------------
function back(pts) {
  const d = smoothOpenPath(pts);
  return (
    `<path d="${d}" fill="none" stroke="${STIG_KANT}" stroke-width="54" stroke-linecap="round" opacity="0.35"/>` +
    `<path d="${d}" fill="none" stroke="${VATTEN}" stroke-width="42" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${VATTEN_LJUS}" stroke-width="14" stroke-linecap="round" opacity="0.7" stroke-dasharray="46 38"/>`
  );
}

// --- Stigen: bred mjuk grusstig genom alla steg -----------------------------
function stig(world) {
  const d = smoothOpenPath(routePoints(world));
  return (
    `<path d="${d}" fill="none" stroke="${STIG_KANT}" stroke-width="54" stroke-linecap="round" opacity="0.9"/>` +
    `<path d="${d}" fill="none" stroke="${STIG}" stroke-width="44" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="#EAD9B2" stroke-width="8" stroke-linecap="round" opacity="0.5" stroke-dasharray="4 72"/>`
  );
}

// --- Bro: liten plankbro tvärs över bäcken, roterad längs stigen ------------
function bro({ x, y, rot = 0 }) {
  const w = 120, h = 58;
  let plank = "";
  for (let i = 1; i < 6; i++) {
    const px = x - w / 2 + (w / 6) * i;
    plank += `<line x1="${px}" y1="${y - h / 2 + 4}" x2="${px}" y2="${y + h / 2 - 4}" stroke="${STAM_MORK}" stroke-width="3" opacity="0.7"/>`;
  }
  return (
    `<g transform="rotate(${rot} ${x} ${y})">` +
    `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="10" fill="${STAM}" ${L2}/>` + plank +
    `<rect x="${x - w / 2}" y="${y - h / 2 - 11}" width="${w}" height="9" rx="4.5" fill="${STAM_MORK}" ${L2}/>` +
    `<rect x="${x - w / 2}" y="${y + h / 2 + 2}" width="${w}" height="9" rx="4.5" fill="${STAM_MORK}" ${L2}/>` +
    `</g>`
  );
}

// --- Dekor-typer (ritas från world.decorations) ------------------------------

/** Ljus glänta i gräset (platt, bakom allt). */
function glanta(x, y, s) {
  return `<ellipse cx="${x}" cy="${y}" rx="${130 * s}" ry="${60 * s}" fill="#D2EBB4" opacity="0.55"/>`;
}

/** Lövträd: stam + rund trekulekrona. */
function trad(x, y, s) {
  return (
    `<ellipse cx="${x}" cy="${y + 6 * s}" rx="${44 * s}" ry="${12 * s}" fill="${O}" opacity="0.12"/>` +
    `<path d="M${n1(x - 8 * s)} ${y} Q${n1(x - 10 * s)} ${n1(y - 52 * s)} ${x} ${n1(y - 58 * s)} Q${n1(x + 10 * s)} ${n1(y - 52 * s)} ${n1(x + 8 * s)} ${y} Z" fill="${STAM}" ${L2}/>` +
    `<circle cx="${n1(x - 26 * s)}" cy="${n1(y - 68 * s)}" r="${30 * s}" fill="${LOV_MORK}" ${L2}/>` +
    `<circle cx="${n1(x + 26 * s)}" cy="${n1(y - 68 * s)}" r="${30 * s}" fill="${LOV_MORK}" ${L2}/>` +
    `<circle cx="${x}" cy="${n1(y - 88 * s)}" r="${36 * s}" fill="${LOV}" ${L2}/>` +
    `<circle cx="${n1(x - 12 * s)}" cy="${n1(y - 94 * s)}" r="${16 * s}" fill="${LOV_LJUS}" opacity="0.7"/>`
  );
}

/** Gran: stam + tre lager trianglar. */
function gran(x, y, s) {
  const lager = (by, bw, f) =>
    `<path d="M${n1(x - bw * s)} ${n1(y - by * s)} L${x} ${n1(y - (by + bw * 1.5) * s)} L${n1(x + bw * s)} ${n1(y - by * s)} Z" fill="${f}" ${L2}/>`;
  return (
    `<ellipse cx="${x}" cy="${y + 5 * s}" rx="${36 * s}" ry="${10 * s}" fill="${O}" opacity="0.12"/>` +
    `<rect x="${n1(x - 6 * s)}" y="${n1(y - 16 * s)}" width="${12 * s}" height="${18 * s}" rx="${4 * s}" fill="${STAM_MORK}" ${L2}/>` +
    lager(12, 34, GRAN) + lager(42, 27, GRAN) + lager(68, 20, GRAN_LJUS)
  );
}

/** Sten med ljus glimt. */
function sten(x, y, s) {
  return (
    `<ellipse cx="${x}" cy="${y + 6 * s}" rx="${28 * s}" ry="${8 * s}" fill="${O}" opacity="0.1"/>` +
    `<path d="M${n1(x - 26 * s)} ${n1(y + 8 * s)} Q${n1(x - 28 * s)} ${n1(y - 20 * s)} ${x} ${n1(y - 20 * s)} Q${n1(x + 28 * s)} ${n1(y - 20 * s)} ${n1(x + 26 * s)} ${n1(y + 8 * s)} Z" fill="${STEN}" ${L2}/>` +
    `<ellipse cx="${n1(x - 7 * s)}" cy="${n1(y - 7 * s)}" rx="${11 * s}" ry="${6 * s}" fill="${STEN_LJUS}" opacity="0.6"/>`
  );
}

/** Stubbe med årsringar. */
function stubbe(x, y, s) {
  return (
    `<ellipse cx="${x}" cy="${y + 4 * s}" rx="${24 * s}" ry="${7 * s}" fill="${O}" opacity="0.1"/>` +
    `<path d="M${n1(x - 18 * s)} ${n1(y - 20 * s)} L${n1(x - 18 * s)} ${y} Q${x} ${n1(y + 10 * s)} ${n1(x + 18 * s)} ${y} L${n1(x + 18 * s)} ${n1(y - 20 * s)}" fill="${STAM}" ${L2}/>` +
    `<ellipse cx="${x}" cy="${n1(y - 20 * s)}" rx="${18 * s}" ry="${9 * s}" fill="#D9B98F" ${L2}/>` +
    `<ellipse cx="${x}" cy="${n1(y - 20 * s)}" rx="${9 * s}" ry="${4.5 * s}" fill="none" stroke="${STAM_MORK}" stroke-width="2.2"/>`
  );
}

/** Flugsvamp (röd med vita prickar). */
function svamp(x, y, s) {
  return (
    `<ellipse cx="${x}" cy="${y + 3 * s}" rx="${16 * s}" ry="${5 * s}" fill="${O}" opacity="0.1"/>` +
    `<path d="M${n1(x - 6 * s)} ${n1(y - 10 * s)} L${n1(x - 5 * s)} ${y} Q${x} ${n1(y + 4 * s)} ${n1(x + 5 * s)} ${y} L${n1(x + 6 * s)} ${n1(y - 10 * s)} Z" fill="#FFF3DC" ${L2}/>` +
    `<path d="M${n1(x - 16 * s)} ${n1(y - 10 * s)} Q${x} ${n1(y - 34 * s)} ${n1(x + 16 * s)} ${n1(y - 10 * s)} Z" fill="${SVAMP}" ${L2}/>` +
    `<circle cx="${n1(x - 7 * s)}" cy="${n1(y - 15 * s)}" r="${2.6 * s}" fill="#fff"/>` +
    `<circle cx="${n1(x + 5 * s)}" cy="${n1(y - 19 * s)}" r="${2.2 * s}" fill="#fff"/>`
  );
}

/** Grästuva (låg markdekor). */
function tuva(x, y, s) {
  const stra = (dx, h) =>
    `<path d="M${n1(x + dx * s)} ${n1(y + 5 * s)} q${n1(-dx * 0.4 * s)} ${n1(-h * 0.6 * s)} ${n1(dx * 0.5 * s)} ${n1(-h * s)}" fill="none" stroke="${GRAS_MORK}" stroke-width="${n1(4 * s)}" stroke-linecap="round" opacity="0.85"/>`;
  return stra(-11, 20) + stra(-4, 28) + stra(4, 24) + stra(11, 18) + stra(0, 32);
}

/** Blomma (ritas stor nog att läsa som blomma på kartavstånd). */
function blomma(x, y, s) {
  const blad = (a) => `<circle cx="${n1(x + Math.cos(a) * 11 * s)}" cy="${n1(y - 16 * s + Math.sin(a) * 11 * s)}" r="${8 * s}" fill="${ROSA}" ${L2}/>`;
  return (
    `<path d="M${x} ${n1(y + 8 * s)} q-4 -16 0 -24" fill="none" stroke="${GRAS_MORK}" stroke-width="4" stroke-linecap="round"/>` +
    blad(0) + blad(1.256) + blad(2.513) + blad(3.769) + blad(5.026) +
    `<circle cx="${x}" cy="${n1(y - 16 * s)}" r="${7 * s}" fill="${GUL}" ${L2}/>`
  );
}

/** Liten fjäril (tunn kontur så vingarna läser gula, inte mörka). */
function mal(x, y, s) {
  const V = `stroke="${O}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"`;
  return (
    `<ellipse cx="${n1(x - 8 * s)}" cy="${y}" rx="${9 * s}" ry="${6.6 * s}" fill="${GUL}" ${V} transform="rotate(-24 ${x} ${y})"/>` +
    `<ellipse cx="${n1(x + 8 * s)}" cy="${y}" rx="${9 * s}" ry="${6.6 * s}" fill="${GUL}" ${V} transform="rotate(24 ${x} ${y})"/>` +
    `<ellipse cx="${x}" cy="${y}" rx="${2.6 * s}" ry="${7 * s}" fill="${O}"/>`
  );
}

/** Målflagga i sista gläntan. */
function flagga(x, y) {
  return (
    `<g transform="translate(${x + 36} ${y - 6})">` +
    `<ellipse cx="0" cy="4" rx="16" ry="6" fill="${O}" opacity="0.12"/>` +
    `<rect x="-3" y="-66" width="6" height="70" rx="3" fill="${STAM_MORK}" ${L2}/>` +
    `<path d="M3 -64 L46 -48 L3 -30 Z" fill="${GUL}" ${L2}/>` +
    `</g>`
  );
}

const TYPER = { glanta, trad, gran, sten, stubbe, svamp, tuva, blomma, mal };

// ============================================================================
// Hela scenen (bakifrån och fram): mark → gläntor → bäckar → stig → broar →
// övrig dekor (sorterad på y så det som står längre ned ritas framför).
// ============================================================================
export function skogenScen(world) {
  const { width: w, height: h } = world.scene;
  const deko = world.decorations || [];
  const bakom = deko.filter((d) => d.type === "glanta");
  const framfor = deko
    .filter((d) => d.type !== "glanta")
    .slice()
    .sort((a, b) => a.y - b.y);
  const rita = (d) => (TYPER[d.type] ? TYPER[d.type](d.x, d.y, d.s == null ? 1 : d.s) : "");
  const vatten = world.vatten || {};
  return (
    mark(w, h) +
    bakom.map(rita).join("") +
    (vatten.backar || []).map(back).join("") +
    stig(world) +
    (vatten.broar || []).map(bro).join("") +
    framfor.map(rita).join("") +
    (world.mal ? flagga(world.mal.x, world.mal.y) : "")
  );
}
