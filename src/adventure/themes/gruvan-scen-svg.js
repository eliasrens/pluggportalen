// ============================================================================
// Pluggportalen – äventyrsmotorn: themes/gruvan-scen-svg.js  (issue #224)
// ----------------------------------------------------------------------------
// GENERATOR för Gruvans egentecknade bakgrunds-SVG (den stora grott-bilden i
// motorns scroll-läge). REN sträng-produktion – ingen DOM, ingen Firebase – så
// den kan köras i Node (assets/build-gruvan-karta.mjs skriver ut .svg-filen) och
// enhetstestas. Bilden RITAS ur EXAKT samma geometri som kollisionen bygger på
// (gruvan-map.js: CHAMBERS + CORRIDORS), så den upplysta grott-ytan sammanfaller
// med den gångbara ytan – berget runt om är mörkt och stängt.
//
// Lager (bakifrån→fram): mörkt berg → bergtextur → gång-kant (ledge) → varmt
// grottgolv → upplyst golvmitt → lyktsken → dekor (lyktor, stödbalkar, broar,
// svampar, mineralådror, småstenar) → gruvöppning med dagsljus till vänster.
// Dekoren bor BARA här (aldrig i geometrin) → blockerar aldrig (issue: pynt fritt).
// ============================================================================

import { WORLD, CHAMBERS, CORRIDORS, START_ROOM, END_ROOM } from "./gruvan-map.js";

// --- Palett (varm, mysig underjord – lite mörkare men lätt att se) -----------
const BERG_DJUP = "#1d1622"; // djupaste oupptäckta berg
const BERG = "#2C2230";
const BERG_2 = "#3A2E3F";
const BERG_HILITE = "#4a3a52";
const LEDGE = "#43332A"; // mörk kant där golvet möter berget
const GOLV = "#5A4436";
const GOLV_LJUS = "#6E5342";
const GOLV_LJUS2 = "#856650";
const LYKTA_GLOD = "#FFCE73";
const LYKTA_LJUS = "#FFF1C6";
const MINERAL = "#86D8E8";
const MINERAL_LJUS = "#DCF5FA";
const SVAMP = "#E88FA8";
const SVAMP_LJUS = "#FFC9D6";
const SVAMP_STAM = "#F1E4D2";
const TRA = "#8A6242";
const TRA_LJUS = "#B0805A";
const TRA_MORK = "#5f4127";

/** Liten deterministisk PRNG (mulberry32) → stabil, diff-vänlig utfil. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r2 = (v) => Math.round(v * 100) / 100; // korta decimaler i utfilen
const midOf = (s) => ({ x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 });
const angOf = (s) => (Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x) * 180) / Math.PI;

// --- Grott-ytan (union av kammare + gångar) som SVG --------------------------
/** Cirklar (kammare, fill) + kapslar (gångar, stroke) i EN färg och radie-delta.
 *  Fill sätts bara på cirklar, stroke bara på gångar → ingen dubblerad attribut
 *  (giltig XML även när filen öppnas direkt). */
function caveShapes(dr, color) {
  const circles = CHAMBERS.map(
    (c) => `<circle cx="${c.x}" cy="${c.y}" r="${Math.max(6, c.r + dr)}" fill="${color}"/>`
  ).join("");
  const caps = CORRIDORS.map(
    (s) =>
      `<path d="M${s.a.x} ${s.a.y}L${s.b.x} ${s.b.y}" fill="none" stroke="${color}" ` +
      `stroke-linecap="round" stroke-width="${Math.max(12, 2 * (s.r + dr))}"/>`
  ).join("");
  return circles + caps;
}

// --- Bergtextur (spridda block/sprickor) – deterministisk ---------------------
function rockTexture() {
  const rand = rng(4224);
  let out = "";
  for (let i = 0; i < 150; i++) {
    const x = r2(rand() * WORLD.w), y = r2(rand() * WORLD.h);
    const rr = r2(18 + rand() * 60);
    const tone = [BERG, BERG_2, BERG_DJUP, BERG_HILITE][Math.floor(rand() * 4)];
    const op = r2(0.25 + rand() * 0.4);
    out += `<circle cx="${x}" cy="${y}" r="${rr}" fill="${tone}" opacity="${op}"/>`;
  }
  // några sprickor
  for (let i = 0; i < 26; i++) {
    const x = r2(rand() * WORLD.w), y = r2(rand() * WORLD.h);
    const x2 = r2(x + (rand() - 0.5) * 220), y2 = r2(y + (rand() - 0.5) * 160);
    out += `<path d="M${x} ${y}L${x2} ${y2}" stroke="${BERG_DJUP}" stroke-width="${r2(2 + rand() * 4)}" stroke-linecap="round" opacity="0.6"/>`;
  }
  return `<g>${out}</g>`;
}

// --- Golvdekor: småstenar utspridda på grottgolvet (aldrig blockerande) -------
function floorPebbles() {
  const rand = rng(909);
  let out = "";
  for (const c of CHAMBERS) {
    const n = Math.round(c.r / 26);
    for (let i = 0; i < n; i++) {
      const ang = rand() * Math.PI * 2;
      const rad = rand() * (c.r - 34);
      const x = r2(c.x + Math.cos(ang) * rad), y = r2(c.y + Math.sin(ang) * rad);
      const rr = r2(3 + rand() * 8);
      const tone = rand() > 0.5 ? GOLV_LJUS : "#4a3629";
      out += `<circle cx="${x}" cy="${y}" r="${rr}" fill="${tone}" opacity="0.7"/>`;
    }
  }
  return `<g>${out}</g>`;
}

// --- Lyktor (varmt sken + liten lykta) ---------------------------------------
const LANTERNS = [
  { x: 300, y: 344 }, { x: 705, y: 452 }, { x: 968, y: 226 }, { x: 1180, y: 522 },
  { x: 1492, y: 262 }, { x: 1742, y: 500 }, { x: 2028, y: 300 }, { x: 2232, y: 372 },
];
function lantern(x, y, i) {
  const gid = `glow${i}`;
  return (
    `<radialGradient id="${gid}" cx="50%" cy="42%" r="55%">` +
    `<stop offset="0%" stop-color="${LYKTA_LJUS}" stop-opacity="0.9"/>` +
    `<stop offset="45%" stop-color="${LYKTA_GLOD}" stop-opacity="0.32"/>` +
    `<stop offset="100%" stop-color="${LYKTA_GLOD}" stop-opacity="0"/></radialGradient>` +
    `<circle cx="${x}" cy="${y}" r="150" fill="url(#${gid})"/>` +
    `<rect x="${x - 4}" y="${y - 6}" width="8" height="34" rx="3" fill="${TRA_MORK}"/>` +
    `<path d="M${x - 12} ${y - 8}h24l-4 -8h-16Z" fill="#4a4450"/>` +
    `<rect x="${x - 11} " y="${y - 30}" width="22" height="22" rx="3" fill="${LYKTA_GLOD}" stroke="#4a4450" stroke-width="2.5"/>` +
    `<rect x="${x - 7}" y="${y - 26}" width="14" height="14" rx="2" fill="${LYKTA_LJUS}"/>`
  );
}

// --- Stödbalkar som ramar in gången (vid varje huvudgångs mitt) --------------
function beamAt(m, ang, half) {
  // Rita i lokalt koord (0,0)=gångens mitt, x längs gången → rotera på plats.
  const post = (sx) =>
    `<rect x="${sx - 9}" y="${-half - 26}" width="18" height="${2 * half + 40}" rx="4" fill="${TRA}" stroke="${TRA_MORK}" stroke-width="2.5"/>` +
    `<rect x="${sx - 9}" y="${-half - 26}" width="5" height="${2 * half + 40}" fill="${TRA_LJUS}" opacity="0.5"/>`;
  const lintel =
    `<rect x="-34" y="${-half - 34}" width="68" height="18" rx="4" fill="${TRA}" stroke="${TRA_MORK}" stroke-width="2.5"/>`;
  return `<g transform="translate(${r2(m.x)} ${r2(m.y)}) rotate(${r2(ang + 90)})">${post(-half + 4)}${post(half - 4)}${lintel}</g>`;
}
function beams() {
  // första 8 = huvudgångarna (ryggraden), rama in varannan för att inte överlasta.
  let out = "";
  for (let i = 0; i < 8; i++) {
    if (i % 2 === 1) continue;
    const s = CORRIDORS[i];
    out += beamAt(midOf(s), angOf(s), s.r);
  }
  return `<g>${out}</g>`;
}

// --- Träbroar över små sprickor (på ett par gångar) --------------------------
function bridgeAt(m, ang, half) {
  const plankW = 2 * half + 24;
  let planks = "";
  for (let i = 0; i < 7; i++) {
    const px = -half - 6 + i * ((plankW) / 7);
    planks += `<rect x="${r2(px)}" y="-26" width="${r2(plankW / 7 - 4)}" height="52" rx="2" fill="${TRA_LJUS}" stroke="${TRA_MORK}" stroke-width="2"/>`;
  }
  return (
    `<g transform="translate(${r2(m.x)} ${r2(m.y)}) rotate(${r2(ang)})">` +
    // mörk spricka under bron
    `<rect x="${-half - 14}" y="-16" width="${plankW + 20}" height="32" rx="10" fill="${BERG_DJUP}" opacity="0.9"/>` +
    // sidobalkar + plankor (rita vinkelrätt → rotera 90 lokalt)
    `<g transform="rotate(90)">${planks}` +
    `<rect x="${-half - 8}" y="-30" width="${plankW + 16}" height="7" rx="3" fill="${TRA}"/>` +
    `<rect x="${-half - 8}" y="23" width="${plankW + 16}" height="7" rx="3" fill="${TRA}"/></g></g>`
  );
}
function bridges() {
  return [CORRIDORS[3], CORRIDORS[5]]
    .map((s) => bridgeAt(midOf(s), angOf(s), s.r))
    .join("");
}

// --- Lysande svampklungor -----------------------------------------------------
const MUSHROOMS = [{ x: 640, y: 612 }, { x: 1170, y: 700 }, { x: 1700, y: 660 }, { x: 600, y: 892 }];
function mushroom(x, y, s) {
  const capW = 15 * s, stemH = 13 * s, stemW = 5 * s;
  return (
    `<circle cx="${x}" cy="${y - stemH}" r="${18 * s}" fill="${SVAMP_LJUS}" opacity="0.2"/>` +
    `<rect x="${r2(x - stemW / 2)}" y="${r2(y - stemH)}" width="${r2(stemW)}" height="${r2(stemH)}" rx="${r2(stemW / 2)}" fill="${SVAMP_STAM}" stroke="#3B3350" stroke-width="2"/>` +
    `<path d="M${r2(x - capW)} ${r2(y - stemH + 1)}Q${x} ${r2(y - stemH - capW * 0.7)} ${r2(x + capW)} ${r2(y - stemH + 1)}Z" fill="${SVAMP}" stroke="#3B3350" stroke-width="2.2" stroke-linejoin="round"/>` +
    `<circle cx="${r2(x - capW * 0.4)}" cy="${r2(y - stemH - capW * 0.15)}" r="${r2(1.8 * s)}" fill="${SVAMP_LJUS}"/>`
  );
}
function mushrooms() {
  return MUSHROOMS.map((m) => mushroom(m.x, m.y, 1) + mushroom(m.x + 26, m.y + 8, 0.7) + mushroom(m.x - 22, m.y + 10, 0.55)).join("");
}

// --- Glimmande mineralådror i berget nära kammar-kanterna ---------------------
const VEINS = [{ x: 870, y: 220 }, { x: 1560, y: 268 }, { x: 2070, y: 300 }, { x: 500, y: 250 }, { x: 1300, y: 770 }];
function vein(x, y) {
  return (
    `<path d="M${x} ${y}l24 -30l-8 -20m8 20l26 -8" fill="none" stroke="${MINERAL}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>` +
    `<circle cx="${x + 24}" cy="${y - 30}" r="3" fill="${MINERAL_LJUS}"/>` +
    `<circle cx="${x + 50}" cy="${y - 38}" r="2.4" fill="${MINERAL_LJUS}"/>`
  );
}
function veins() {
  return VEINS.map((v) => vein(v.x, v.y)).join("");
}

// --- Gruvöppning till vänster (timrad portal + en aning dagsljus) ------------
function entrance() {
  const { x, y, r } = START_ROOM;
  return (
    `<radialGradient id="daylight" cx="0%" cy="50%" r="60%">` +
    `<stop offset="0%" stop-color="#fbe9c4" stop-opacity="0.55"/>` +
    `<stop offset="100%" stop-color="#fbe9c4" stop-opacity="0"/></radialGradient>` +
    `<rect x="0" y="${y - r}" width="${x + r}" height="${2 * r}" fill="url(#daylight)"/>` +
    // timrad portal runt öppningen
    `<rect x="${x - 20}" y="${y - r - 30}" width="26" height="${2 * r + 60}" rx="5" fill="${TRA}" stroke="${TRA_MORK}" stroke-width="3"/>` +
    `<rect x="${x + r - 30}" y="${y - r - 30}" width="26" height="${2 * r + 60}" rx="5" fill="${TRA}" stroke="${TRA_MORK}" stroke-width="3"/>` +
    `<rect x="${x - 26}" y="${y - r - 42}" width="${r + 40}" height="30" rx="6" fill="${TRA}" stroke="${TRA_MORK}" stroke-width="3"/>` +
    `<rect x="${x - 26}" y="${y - r - 42}" width="${r + 40}" height="8" fill="${TRA_LJUS}" opacity="0.5"/>`
  );
}

/**
 * Bygg hela grott-bakgrunden som en fristående SVG-sträng (viewBox 0 0 W H).
 * Anropas av assets/build-gruvan-karta.mjs (skriver .svg) – ren, sidoeffektfri.
 */
export function buildCaveSvg() {
  const { w, h } = WORLD;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    `<defs>` +
    `<filter id="soft" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="7"/></filter>` +
    `<filter id="softer" x="-8%" y="-8%" width="116%" height="116%"><feGaussianBlur stdDeviation="14"/></filter>` +
    `<radialGradient id="deep" cx="88%" cy="50%" r="60%">` +
    `<stop offset="0%" stop-color="#120d16" stop-opacity="0.55"/>` +
    `<stop offset="100%" stop-color="#120d16" stop-opacity="0"/></radialGradient>` +
    `</defs>` +
    // mörkt berg + textur
    `<rect x="0" y="0" width="${w}" height="${h}" fill="${BERG_DJUP}"/>` +
    rockTexture() +
    // grott-ytan: mörk kant (ledge) → golv → upplyst mitt
    `<g filter="url(#softer)">${caveShapes(24, LEDGE)}</g>` +
    `<g filter="url(#soft)">${caveShapes(0, GOLV)}</g>` +
    `<g filter="url(#soft)" opacity="0.55">${caveShapes(-34, GOLV_LJUS)}</g>` +
    `<g filter="url(#softer)" opacity="0.35">${caveShapes(-70, GOLV_LJUS2)}</g>` +
    floorPebbles() +
    // "djupare = lite mörkare" åt höger, men slutrummet lyses ändå upp av lyktan
    `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#deep)"/>` +
    // dekor
    veins() +
    LANTERNS.map((l, i) => lantern(l.x, l.y, i)).join("") +
    beams() +
    bridges() +
    mushrooms() +
    entrance() +
    // extra glöd i slutrummet (jättekristallen bor där → objektet ritas av motorn)
    `<circle cx="${END_ROOM.x}" cy="${END_ROOM.y}" r="${END_ROOM.r * 0.9}" fill="${MINERAL}" opacity="0.06"/>` +
    `</svg>`
  );
}
