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
// Lager (bakifrån→fram): mörkt berg → mjuk bergtextur → gång-kant (ledge) →
// varmt grottgolv → upplyst golvmitt → lyktsken → dekor (lyktor, svampar,
// mineralådror, diskret småsten) → gruvöppning med dagsljus till vänster.
// Städat #256: inga trä-stödbalkar/plankbroar längre → renare grottväggar.
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
const TRA_MORK = "#5f4127"; // enda kvarvarande trä-ton (lyktans stolpe)

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

// --- Bergtextur (mjuka block, diskreta sprickor) – deterministisk -------------
// Renare grottväggar: mjuka, lågkontrast block ger volym utan att bli "stökigt";
// bara ett fåtal fina sprickor som antydan – ingen hård kritstrecks-look.
function rockTexture() {
  const rand = rng(4224);
  let out = "";
  for (let i = 0; i < 120; i++) {
    const x = r2(rand() * WORLD.w), y = r2(rand() * WORLD.h);
    const rr = r2(24 + rand() * 66);
    const tone = [BERG, BERG_2, BERG_HILITE][Math.floor(rand() * 3)];
    const op = r2(0.16 + rand() * 0.24);
    out += `<circle cx="${x}" cy="${y}" r="${rr}" fill="${tone}" opacity="${op}" filter="url(#soft)"/>`;
  }
  // ett fåtal diskreta sprickor (antydan, inte hårda streck)
  for (let i = 0; i < 12; i++) {
    const x = r2(rand() * WORLD.w), y = r2(rand() * WORLD.h);
    const x2 = r2(x + (rand() - 0.5) * 200), y2 = r2(y + (rand() - 0.5) * 150);
    out += `<path d="M${x} ${y}L${x2} ${y2}" stroke="${BERG_DJUP}" stroke-width="${r2(1.5 + rand() * 2.5)}" stroke-linecap="round" opacity="0.35"/>`;
  }
  return `<g>${out}</g>`;
}

// --- Golvdekor: diskret småsten utspridd på grottgolvet (aldrig blockerande) --
// Liten, dämpad och sparsam → ligger som antydd grus-detalj, konkurrerar aldrig
// med lyktor/svamp om blicken.
function floorPebbles() {
  const rand = rng(909);
  let out = "";
  for (const c of CHAMBERS) {
    const n = Math.round(c.r / 34);
    for (let i = 0; i < n; i++) {
      const ang = rand() * Math.PI * 2;
      const rad = rand() * (c.r - 34);
      const x = r2(c.x + Math.cos(ang) * rad), y = r2(c.y + Math.sin(ang) * rad);
      const rr = r2(2 + rand() * 5);
      const tone = rand() > 0.5 ? GOLV_LJUS : "#4a3629";
      out += `<circle cx="${x}" cy="${y}" r="${rr}" fill="${tone}" opacity="0.5"/>`;
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

// --- Gruvöppning till vänster (dagsljus – ingen timrad portal längre) ---------
// Städat #256: den timrade träportalen är borttagen (den läste som störande
// bjälkar i spelytan). Gruvmynningen markeras nu enbart av mjukt dagsljus från
// vänster → renare, men fortfarande tydligt var man kom in.
function entrance() {
  const { x, y, r } = START_ROOM;
  return (
    `<radialGradient id="daylight" cx="0%" cy="50%" r="60%">` +
    `<stop offset="0%" stop-color="#fbe9c4" stop-opacity="0.5"/>` +
    `<stop offset="100%" stop-color="#fbe9c4" stop-opacity="0"/></radialGradient>` +
    `<rect x="0" y="${y - r}" width="${x + r}" height="${2 * r}" fill="url(#daylight)"/>`
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
    mushrooms() +
    entrance() +
    // extra glöd i slutrummet (jättekristallen bor där → objektet ritas av motorn)
    `<circle cx="${END_ROOM.x}" cy="${END_ROOM.y}" r="${END_ROOM.r * 0.9}" fill="${MINERAL}" opacity="0.06"/>` +
    `</svg>`
  );
}
