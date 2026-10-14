// ============================================================================
// Pluggporten – Halloween-djuren 6–10 (#695): Mumme, Spindis, Skelli, Uggli,
// Slemmis. Samma form som hw-djur-a.js: (steg 1–3, uttryck) => SVG-innehåll i
// viewBox 0 0 100 100, golvet vid y≈95. Laddas bara via import() (#271).
// ============================================================================

import {
  O, LINE, THIN, limb, anim, golv, ansikte, krona, glod, glimtar, fot, stjarnaK,
} from "./hw-djur-delar.js";
import { LILA, LILA_MORK, GUL, KRAM, SKEN, SLEM } from "./hw-art-delar.js";

// --- Mumme: Lindfjun → Bindelbjörn → Faraonallen ----------------------------

const MU_BINDEL = "#FFF3DC";
const MU_LINJE = "#E3D2B0";
const MU_PALS = "#B0805A";
const MU_BLA = "#46557A";

/** Bandagelindor tvärs över en rund form: [[y, böj], …] inom x0–x1. */
const lindor = (x0, x1, rader) =>
  rader.map(([y, b]) => `<path d="M${x0} ${y} Q${(x0 + x1) / 2} ${y + b} ${x1} ${y - 1}" fill="none" stroke="${MU_LINJE}" stroke-width="2" stroke-linecap="round"/>`).join("");

const muOron = (cx, cy, dx, r) =>
  `<circle cx="${cx - dx}" cy="${cy}" r="${r}" fill="${MU_BINDEL}" ${LINE}/><circle cx="${cx + dx}" cy="${cy}" r="${r}" fill="${MU_BINDEL}" ${LINE}/>` +
  `<circle cx="${cx - dx}" cy="${cy}" r="${(r * 0.5).toFixed(1)}" fill="${MU_PALS}"/><circle cx="${cx + dx}" cy="${cy}" r="${(r * 0.5).toFixed(1)}" fill="${MU_PALS}"/>`;

/** Ögonspringan där den bruna nallepälsen tittar fram. */
const springa = (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${MU_PALS}" stroke="none"/>`;

const losLinda = (d) => anim("hwd-svans", limb(d, MU_BINDEL, 4.5));

function mumme(stage, expr) {
  if (stage === 1) {
    return golv(20) +
      fot(-1, 41, 90, 6, 3.6, MU_BINDEL) + fot(1, 59, 90, 6, 3.6, MU_BINDEL) +
      losLinda("M74 66 Q86 64 88 74 Q90 80 84 82") +
      anim("hwd-andas",
        muOron(50, 38, 19, 8) +
        `<circle cx="50" cy="61" r="27" fill="${MU_BINDEL}" ${LINE}/>` +
        springa(50, 58, 21, 9) +
        lindor(25, 75, [[44, -4], [70, 4], [78, 3]]) +
        ansikte(50, 58, 9.5, 6.5, expr, { munY: 11 }));
  }
  if (stage === 2) {
    return golv(24) +
      fot(-1, 40, 90, 7, 4.2, MU_BINDEL) + fot(1, 60, 90, 7, 4.2, MU_BINDEL) +
      limb("M33 66 Q24 72 24 80", MU_BINDEL, 7) +
      anim("hwd-flax-h", limb("M67 66 Q78 64 80 56", MU_BINDEL, 7) + limb("M80 56 Q88 50 90 58", MU_BINDEL, 3.5)) +
      anim("hwd-andas",
        `<path d="M32 60 Q26 92 50 92 Q74 92 68 60 Q50 54 32 60 Z" fill="${MU_BINDEL}" ${LINE}/>` +
        lindor(31, 69, [[66, 3], [74, 4], [82, 3]]) +
        muOron(50, 22, 17, 7.5) +
        `<circle cx="50" cy="40" r="22" fill="${MU_BINDEL}" ${LINE}/>` +
        springa(50, 38, 18, 8) +
        lindor(29, 71, [[27, -3], [50, 3]]) +
        ansikte(50, 38, 8.5, 6, expr, { munY: 10 }));
  }
  // Steg 3: Faraonallen – guldkrage och pannband med blå sten, mjuk glöd.
  return glod(50, 52, 44, SKEN, 0.6) + golv(28) +
    fot(-1, 39, 91, 8, 4.5, MU_BINDEL) + fot(1, 61, 91, 8, 4.5, MU_BINDEL) +
    losLinda("M30 70 Q16 72 14 84 Q13 90 19 90") +
    anim("hwd-flax-h", limb("M68 66 Q80 62 82 52", MU_BINDEL, 7.5)) +
    anim("hwd-andas",
      `<path d="M30 60 Q23 93 50 93 Q77 93 70 60 Q50 53 30 60 Z" fill="${MU_BINDEL}" ${LINE}/>` +
      lindor(30, 70, [[72, 4], [80, 4], [87, 2]]) +
      `<path d="M28 58 Q50 76 72 58 Q66 54 50 55 Q34 54 28 58 Z" fill="${GUL}" ${LINE}/>` +
      `<path d="M33 60 Q50 72 67 60" fill="none" stroke="${MU_BLA}" stroke-width="2.6"/>` +
      `<path d="M37 62 Q50 69 63 62" fill="none" stroke="${GUL}" stroke-width="1.4"/>` +
      muOron(50, 20, 18, 8) +
      `<circle cx="50" cy="38" r="23" fill="${MU_BINDEL}" ${LINE}/>` +
      springa(50, 37, 19, 8.5) +
      `<path d="M28 27 Q50 18 72 27 L71 31 Q50 23 29 31 Z" fill="${GUL}" ${THIN}/>` +
      `<circle cx="50" cy="24" r="3.4" fill="${MU_BLA}" ${THIN}/>` +
      lindor(28, 72, [[50, 3]]) +
      ansikte(50, 37, 9, 6.2, expr, { munY: 10 })) +
    glimtar([[12, 22, 3], [88, 18, 3], [90, 80, 2.4]], GUL);
}

// --- Spindis: Trådfjun → Nätvävaren → Silkesdrottningen ---------------------

const SP_PALS = "#7E62B8";
const SP_BEN = "#4C4661";
const SP_MAGE = "#C9B6F0";
const SP_ROSA = "#F890B7";

/** Åtta korta, rundade ben (4 per sida) med knä och rund fot; längd l. Fötterna "går". */
function spBen(cx, cy, rx, l, golvY = 93) {
  const ben = (dir, i) => {
    const y0 = cy - 10 + i * 7;
    const x0 = cx + dir * rx * 0.8;
    const kx = cx + dir * (rx + l * (0.55 + i * 0.06));
    const ky = y0 - l * 0.3 + i * 2;
    const fx = cx + dir * (rx + l * (0.7 + i * 0.12));
    const fy = Math.min(golvY, y0 + l * 0.6);
    const d = `M${x0.toFixed(1)} ${y0} Q${kx.toFixed(1)} ${ky.toFixed(1)} ${fx.toFixed(1)} ${fy.toFixed(1)}`;
    return `<path d="${d}" fill="none" stroke="${O}" stroke-width="6" stroke-linecap="round"/>` +
      `<path d="${d}" fill="none" stroke="${SP_BEN}" stroke-width="2.8" stroke-linecap="round"/>` +
      `<circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="2.8" fill="${SP_PALS}" ${THIN}/>`;
  };
  const sida = (dir) => [0, 1, 2, 3].map((i) => ben(dir, i));
  const v = sida(-1);
  const h = sida(1);
  return anim("hwd-fot-v", v[0] + v[2] + h[1] + h[3]) + anim("hwd-fot-h", v[1] + v[3] + h[0] + h[2]);
}

/** Mini-ögon ovanför huvudögonen (spindlar har fler – gulligt små). */
const smaOgon = (cx, cy, dx) =>
  `<circle cx="${cx - dx}" cy="${cy}" r="2.2" fill="${O}"/><circle cx="${cx + dx}" cy="${cy}" r="2.2" fill="${O}"/>` +
  `<circle cx="${cx - dx + 0.7}" cy="${cy - 0.7}" r="0.7" fill="#fff"/><circle cx="${cx + dx + 0.7}" cy="${cy - 0.7}" r="0.7" fill="#fff"/>`;

/** Litet spindelnät (ekrar + bågar), mitt (cx,cy), radie r. */
function nat(cx, cy, r, op = 0.75) {
  let s = "";
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    s += `M${cx} ${cy} L${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)} `;
  }
  for (const k of [0.35, 0.65, 0.95]) {
    for (let i = 0; i < 8; i++) {
      const a0 = (i * Math.PI) / 4;
      const a1 = ((i + 1) * Math.PI) / 4;
      const m = (a0 + a1) / 2;
      s += `M${(cx + Math.cos(a0) * r * k).toFixed(1)} ${(cy + Math.sin(a0) * r * k).toFixed(1)} ` +
        `Q${(cx + Math.cos(m) * r * k * 0.86).toFixed(1)} ${(cy + Math.sin(m) * r * k * 0.86).toFixed(1)} ` +
        `${(cx + Math.cos(a1) * r * k).toFixed(1)} ${(cy + Math.sin(a1) * r * k).toFixed(1)} `;
    }
  }
  return `<path d="${s}" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity="${op}"/>` +
    `<path d="${s}" fill="none" stroke="${LILA}" stroke-width="0.5" opacity="${op}"/>`;
}

const fluff = (cx, top) => `<path d="M${cx - 6} ${top + 4} Q${cx - 4} ${top - 4} ${cx} ${top + 2} Q${cx + 4} ${top - 4} ${cx + 6} ${top + 4}" fill="${SP_PALS}" ${THIN}/>`;

function spindis(stage, expr) {
  if (stage === 1) {
    // Trådfjun: dinglar i sin tråd.
    return golv(14) + anim("hwd-svav",
      `<path d="M50 0 L50 34" stroke="${O}" stroke-width="1.4" opacity="0.6"/>` +
      spBen(50, 60, 22, 13) +
      fluff(50, 32) +
      anim("hwd-andas", `<circle cx="50" cy="58" r="24" fill="${SP_PALS}" ${LINE}/>` +
        `<ellipse cx="50" cy="71" rx="12" ry="7" fill="${SP_MAGE}"/>`) +
      smaOgon(50, 44, 6) +
      ansikte(50, 56, 9, 6.5, expr));
  }
  if (stage === 2) {
    return nat(76, 26, 22) + golv(28) +
      spBen(50, 68, 24, 17) +
      anim("hwd-andas",
        `<ellipse cx="50" cy="66" rx="26" ry="24" fill="${SP_PALS}" ${LINE}/>` +
        fluff(50, 40) +
        `<ellipse cx="50" cy="80" rx="13" ry="7.5" fill="${SP_MAGE}"/>` +
        smaOgon(50, 51, 7) +
        ansikte(50, 63, 10, 7, expr));
  }
  // Steg 3: Silkesdrottningen – stort glittrande nät, tiara, hjärta på magen.
  return glod(50, 54, 44, "#E5D8F7", 0.55) + nat(50, 42, 44, 0.85) + golv(32) +
    glimtar([[24, 22, 2.4], [80, 30, 2.8], [14, 50, 2], [88, 58, 2.2]], "#fff") +
    spBen(50, 68, 26, 18) +
    anim("hwd-andas",
      `<ellipse cx="50" cy="66" rx="28" ry="26" fill="${SP_PALS}" ${LINE}/>` +
      `<ellipse cx="50" cy="82" rx="14" ry="8" fill="${SP_MAGE}"/>` +
      `<path d="M50 87 Q42 81 45 77 Q48 75 50 78 Q52 75 55 77 Q58 81 50 87 Z" fill="${SP_ROSA}" ${THIN}/>` +
      smaOgon(50, 50, 7.5) +
      ansikte(50, 62, 10.5, 7.2, expr) +
      krona(50, 41, 1.05, "#C9D6EA", SP_ROSA));
}

// --- Skelli: Benvalp → Benrasslaren → Skelettriddaren -----------------------

const SK_BEN = "#FFF8EC";
const SK_LINJE = "#D9CCB8";
const SK_ROSETT = "#F890B7";
const SK_SILVER = "#C9D6EA";

/** Mjuka "revben" – rundade ränder, inget realistiskt. */
const revben = (cx, y0, n, w) =>
  Array.from({ length: n }, (_, i) =>
    `<path d="M${cx - w + i} ${y0 + i * 6} Q${cx} ${y0 + i * 6 + 3} ${cx + w - i} ${y0 + i * 6}" fill="none" stroke="${SK_LINJE}" stroke-width="2.4" stroke-linecap="round"/>`).join("");

const skOron = (cx, cy, r) =>
  `<path d="M${cx - r * 0.7} ${cy - r * 0.6} Q${cx - r * 1.5} ${cy - r * 0.5} ${cx - r * 1.2} ${cy + r * 0.5} Q${cx - r * 1.05} ${cy + r * 0.85} ${cx - r * 0.82} ${cy + r * 0.3} Z" fill="${SK_BEN}" ${LINE}/>` +
  `<path d="M${cx + r * 0.7} ${cy - r * 0.6} Q${cx + r * 1.5} ${cy - r * 0.5} ${cx + r * 1.2} ${cy + r * 0.5} Q${cx + r * 1.05} ${cy + r * 0.85} ${cx + r * 0.82} ${cy + r * 0.3} Z" fill="${SK_BEN}" ${LINE}/>`;

/** Gulliga mjuka ögonfläckar (ingen dödskalle – en valps fläckar). */
const flackar = (cx, cy, dx, r) =>
  `<circle cx="${cx - dx}" cy="${cy}" r="${r}" fill="${SK_LINJE}" opacity="0.6"/><circle cx="${cx + dx}" cy="${cy}" r="${r}" fill="${SK_LINJE}" opacity="0.6"/>`;

const skNos = (cx, cy) => `<ellipse cx="${cx}" cy="${cy}" rx="3.4" ry="2.4" fill="${O}"/>`;

const rosett = (x, y, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0 L-8 -5 Q-10 0 -8 5 Z M0 0 L8 -5 Q10 0 8 5 Z" fill="${SK_ROSETT}" ${THIN}/>` +
  `<circle cx="0" cy="0" r="2.6" fill="${SK_ROSETT}" ${THIN}/></g>`;

const benSvans = (d, x, y) =>
  anim("hwd-svans", limb(d, SK_BEN, 4) +
    `<circle cx="${x - 2}" cy="${y - 2}" r="3" fill="${SK_BEN}" ${THIN}/><circle cx="${x + 2}" cy="${y + 1}" r="3" fill="${SK_BEN}" ${THIN}/>`);

function skelli(stage, expr) {
  if (stage === 1) {
    return golv(20) +
      benSvans("M64 80 Q76 78 78 68", 79, 66) +
      fot(-1, 41, 90, 6, 3.6, SK_BEN) + fot(1, 59, 90, 6, 3.6, SK_BEN) +
      anim("hwd-andas",
        `<ellipse cx="50" cy="79" rx="19" ry="13" fill="${SK_BEN}" ${LINE}/>` +
        revben(50, 74, 2, 10) +
        skOron(50, 46, 24) +
        `<circle cx="50" cy="50" r="24" fill="${SK_BEN}" ${LINE}/>` +
        flackar(50, 48, 9.5, 8.5) +
        skNos(50, 57) +
        ansikte(50, 48, 9.5, 6.4, expr, { munY: 12 }) +
        rosett(66, 30, 0.9));
  }
  if (stage === 2) {
    return golv(24) +
      benSvans("M66 84 Q84 84 84 70", 85, 68) +
      fot(-1, 40, 90, 7, 4.2, SK_BEN) + fot(1, 60, 90, 7, 4.2, SK_BEN) +
      anim("hwd-andas",
        `<path d="M32 60 Q26 92 50 92 Q74 92 68 60 Q50 54 32 60 Z" fill="${SK_BEN}" ${LINE}/>` +
        revben(50, 68, 3, 12) +
        skOron(50, 38, 22) +
        `<circle cx="50" cy="41" r="22" fill="${SK_BEN}" ${LINE}/>` +
        flackar(50, 39, 9, 8) +
        skNos(50, 48) +
        ansikte(50, 39, 9, 6, expr, { munY: 11.5 }) +
        rosett(50, 61, 1.1));
  }
  // Steg 3: Skelettriddaren – liten hjälm med plym och en rund sköld.
  return glod(50, 52, 44, "#E3ECF7", 0.6) + golv(28) +
    benSvans("M68 86 Q88 86 88 70", 89, 68) +
    fot(-1, 39, 91, 8, 4.5, SK_BEN) + fot(1, 61, 91, 8, 4.5, SK_BEN) +
    anim("hwd-andas",
      `<path d="M30 60 Q23 93 50 93 Q77 93 70 60 Q50 53 30 60 Z" fill="${SK_BEN}" ${LINE}/>` +
      revben(50, 68, 3, 13) +
      skOron(50, 40, 23) +
      `<circle cx="50" cy="40" r="23" fill="${SK_BEN}" ${LINE}/>` +
      `<path d="M27 34 Q27 12 50 12 Q73 12 73 34 Q62 28 50 28 Q38 28 27 34 Z" fill="${SK_SILVER}" ${LINE}/>` +
      `<path d="M50 12 L50 28" stroke="${O}" stroke-width="1.6"/>` +
      `<path d="M50 13 Q47 5 54 3 Q61 3 60 9 Q56 6 52 12 Z" fill="${SK_ROSETT}" ${THIN}/>` +
      flackar(50, 41, 9, 8) +
      skNos(50, 50) +
      ansikte(50, 41, 9, 6.2, expr, { munY: 11.5 })) +
    anim("hwd-flax-v",
      `<circle cx="22" cy="72" r="13" fill="${SK_SILVER}" ${LINE}/>` +
      `<circle cx="22" cy="72" r="9" fill="${SK_ROSETT}" ${THIN}/>` +
      limb("M17 70 L27 74", SK_BEN, 3) +
      `<circle cx="16" cy="69" r="2" fill="${SK_BEN}" ${THIN}/><circle cx="28" cy="75" r="2" fill="${SK_BEN}" ${THIN}/>`) +
    glimtar([[86, 18, 3], [12, 24, 2.6], [90, 54, 2.2]], SK_SILVER);
}

// --- Uggli: Duvunge → Nattuggla → Stjärnugglan ------------------------------

const UG_MAGE = "#E5D8F7";
const UG_NAB = "#F2A93B";
const UG_MANTEL = "#46557A";

const ansiktsskiva = (cx, cy, dx, r) =>
  `<circle cx="${cx - dx}" cy="${cy}" r="${r}" fill="${KRAM}" ${THIN}/><circle cx="${cx + dx}" cy="${cy}" r="${r}" fill="${KRAM}" ${THIN}/>`;

const nabb = (cx, cy, s = 1) => `<path d="M${cx - 3.5 * s} ${cy} Q${cx} ${cy - 1.5 * s} ${cx + 3.5 * s} ${cy} L${cx} ${cy + 6 * s} Z" fill="${UG_NAB}" ${THIN}/>`;

const tofsar = (cx, top, h, dx) =>
  `<path d="M${cx - dx} ${top + h} Q${cx - dx - 4} ${top + 3} ${cx - dx + 1} ${top} Q${cx - dx + 6} ${top + h * 0.6} ${cx - dx + 8} ${top + h} Z" fill="${LILA}" ${LINE}/>` +
  `<path d="M${cx + dx} ${top + h} Q${cx + dx + 4} ${top + 3} ${cx + dx - 1} ${top} Q${cx + dx - 6} ${top + h * 0.6} ${cx + dx - 8} ${top + h} Z" fill="${LILA}" ${LINE}/>`;

const fjader = (cx, y0, rader) =>
  rader.map(([y, w]) => `<path d="M${cx - w} ${y0 + y} Q${cx - w / 2} ${y0 + y + 3} ${cx} ${y0 + y} Q${cx + w / 2} ${y0 + y + 3} ${cx + w} ${y0 + y}" fill="none" stroke="${LILA}" stroke-width="1.6" stroke-linecap="round"/>`).join("");

const ugVinge = (dir, x, y, h) =>
  anim(dir < 0 ? "hwd-flax-v" : "hwd-flax-h",
    `<path d="M${x} ${y} Q${x + dir * 13} ${y + h * 0.3} ${x + dir * 9} ${y + h} Q${x + dir * 3} ${y + h * 0.8} ${x} ${y + h * 0.7} Z" fill="${LILA_MORK}" ${LINE}/>`);

const ugFotter = (y) => fot(-1, 43, y, 4.5, 3, UG_NAB) + fot(1, 57, y, 4.5, 3, UG_NAB);

function uggli(stage, expr) {
  const o = { munY: 12, mun: 2.6, utanMun: true }; // näbben är munnen (utom glad/äter)
  if (stage === 1) {
    return golv(20) + ugFotter(91) +
      ugVinge(-1, 26, 58, 18) + ugVinge(1, 74, 58, 18) +
      anim("hwd-andas",
        `<circle cx="50" cy="61" r="27" fill="${LILA}" ${LINE}/>` +
        `<path d="M44 35 Q46 28 50 33 Q54 27 57 35" fill="${LILA}" ${THIN}/>` +
        `<ellipse cx="50" cy="76" rx="15" ry="10" fill="${UG_MAGE}"/>` +
        ansiktsskiva(50, 56, 10, 11) +
        ansikte(50, 56, 10, 7.4, expr, o) + nabb(50, 62, 0.9));
  }
  if (stage === 2) {
    return golv(24) + ugFotter(92) +
      tofsar(50, 12, 16, 18) +
      ugVinge(-1, 27, 52, 28) + ugVinge(1, 73, 52, 28) +
      anim("hwd-andas",
        `<path d="M50 18 Q78 18 76 56 Q74 92 50 92 Q26 92 24 56 Q22 18 50 18 Z" fill="${LILA}" ${LINE}/>` +
        `<ellipse cx="50" cy="72" rx="16" ry="16" fill="${UG_MAGE}"/>` +
        fjader(50, 64, [[0, 8], [7, 10], [14, 8]]) +
        ansiktsskiva(50, 42, 10.5, 11.5) +
        ansikte(50, 42, 10.5, 7.6, expr, o) + nabb(50, 48));
  }
  // Steg 3: Stjärnugglan – stjärnmantel över vingarna, stjärna i pannan.
  return glod(50, 50, 44, "#C9D6EA", 0.6) + golv(28) + ugFotter(93) +
    `<path d="M28 30 Q8 60 16 92 L84 92 Q92 60 72 30 Q50 22 28 30 Z" fill="${UG_MANTEL}" ${LINE}/>` +
    stjarnaK(22, 72, 0.9, SKEN) + stjarnaK(78, 66, 0.8, SKEN) + stjarnaK(26, 52, 0.6, SKEN) + stjarnaK(80, 86, 0.6, SKEN) +
    tofsar(50, 6, 18, 19) +
    anim("hwd-andas",
      `<path d="M50 12 Q80 12 78 54 Q76 92 50 92 Q24 92 22 54 Q20 12 50 12 Z" fill="${LILA}" ${LINE}/>` +
      `<ellipse cx="50" cy="71" rx="17" ry="17" fill="${UG_MAGE}"/>` +
      fjader(50, 62, [[0, 9], [7, 11], [14, 9]]) +
      ansiktsskiva(50, 39, 11, 12) +
      ansikte(50, 39, 11, 8, expr, o) + nabb(50, 45, 1.1) +
      stjarnaK(50, 22, 1.2)) +
    glimtar([[10, 18, 3], [90, 20, 3], [8, 82, 2.2]], SKEN);
}

// --- Slemmis: Droppe → Slemmis → Slemkungen --------------------------------

const SL_MORK = "#6FC66F";

const bubblor = (lista) =>
  lista.map(([x, y, r, d]) => anim(`hw-bubbla${d ? " " + d : ""}`, `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="0.55"/>`)).join("");

const blank = (x, y, rx, ry) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity="0.7" transform="rotate(-25 ${x} ${y})"/>`;

function slemmis(stage, expr) {
  if (stage === 1) {
    return golv(20) + anim("hwd-studs",
      `<path d="M50 18 Q60 40 70 56 Q80 74 70 86 Q62 93 50 93 Q38 93 30 86 Q20 74 30 56 Q40 40 50 18 Z" fill="${SLEM}" ${LINE}/>` +
      blank(38, 56, 3.5, 7) +
      bubblor([[60, 80, 2.2, ""], [44, 84, 1.6, "d2"]]) +
      ansikte(50, 66, 9, 6.2, expr));
  }
  if (stage === 2) {
    return `<ellipse cx="50" cy="93" rx="38" ry="5" fill="${SL_MORK}" opacity="0.5"/>` + golv(30) + anim("hwd-studs",
      `<path d="M14 90 Q10 70 22 52 Q30 36 44 32 Q46 22 52 26 Q54 32 60 33 Q80 40 86 62 Q92 82 86 90 Q80 94 74 90 Q70 94 64 91 Q50 95 36 91 Q30 94 26 90 Q20 94 14 90 Z" fill="${SLEM}" ${LINE}/>` +
      `<path d="M20 70 Q16 78 19 82" fill="none" stroke="${SL_MORK}" stroke-width="3" stroke-linecap="round"/>` +
      blank(30, 54, 4, 8) +
      bubblor([[68, 76, 3, ""], [36, 80, 2.2, "d2"], [74, 62, 1.8, "d3"]]) +
      ansikte(50, 60, 11, 7.4, expr));
  }
  // Steg 3: Slemkungen – stor och studsig, krona, glödande bubblor.
  return glod(50, 54, 44, "#D9F5C9", 0.65) +
    `<ellipse cx="50" cy="93" rx="44" ry="5.5" fill="${SL_MORK}" opacity="0.55"/>` + golv(36) + anim("hwd-studs",
      `<path d="M8 90 Q4 64 18 44 Q30 26 50 24 Q70 26 82 44 Q96 64 92 90 Q86 95 80 90 Q76 95 68 91 Q56 96 44 91 Q34 96 28 90 Q22 95 16 90 Q12 94 8 90 Z" fill="${SLEM}" ${LINE}/>` +
      `<path d="M16 66 Q12 76 15 82 M86 70 Q89 77 86 82" fill="none" stroke="${SL_MORK}" stroke-width="3" stroke-linecap="round"/>` +
      blank(26, 48, 4.5, 9) +
      bubblor([[70, 78, 3.2, ""], [32, 80, 2.4, "d2"], [78, 60, 2, "d3"], [56, 84, 1.8, "d2"]]) +
      ansikte(50, 56, 12, 8, expr) +
      krona(50, 27, 1.35)) +
    glimtar([[10, 20, 3], [90, 22, 3.2]], SKEN);
}

/** id → (stage, expr) => SVG-innehåll. */
export const HW_DJUR_B = { mumme, spindis, skelli, uggli, slemmis };

