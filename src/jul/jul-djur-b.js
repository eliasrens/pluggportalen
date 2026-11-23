// ============================================================================
// Pluggporten – Jul-djuren 6–10 (#912): Tomtis, Rävis, Snöugglis, Glittris,
// Julklappis. Varje art = (steg 1–3, uttryck) => SVG-innehåll i viewBox 0 0 100 100.
// Samma stegtrappa som jul-djur-a.js. Laddas bara via import() (#271).
// ============================================================================

import {
  O, LINE, THIN, limb, anim, golv, ansikte, glod, glimtar, fot, ISGLIMT,
  tomteluva, halsduk, julstjarna, stjarna5,
} from "./jul-djur-delar.js";
import { JULROD, JULROD_MORK, GRAN, GULD, GULD_MORK, SKEN, KRAM, SNOVIT, SNOSKUGGA, HUD } from "./jul-art-delar.js";

const STOVEL = "#5A4A3A";

// --- Tomtis: Nisse → Tomtis → Tomtefar ---------------------------------------

function tomtis(stage, expr) {
  const p = stage === 1
    ? { kx: 32, ky: 90, ty: 64, fy: 56, fr: 14, by: 43, sk: 70, ogon: 6.5, r: 4.4, toppY: 20 }
    : { kx: 27, ky: 92, ty: 58, fy: 48, fr: 16, by: 33, sk: 66, ogon: 7, r: 4.8, toppY: 10 };
  const tre = stage === 3;
  const topp = tre
    ? julstjarna(70, p.toppY + 6, 6)
    : `<circle cx="68" cy="${p.toppY + 6}" r="4.2" fill="${SNOVIT}" ${THIN}/>`;
  const fig =
    fot(-1, 42, p.ky, 6, 3.6, STOVEL) + fot(1, 58, p.ky, 6, 3.6, STOVEL) +
    `<path d="M${p.kx} ${p.ky - 1} Q${p.kx - 2} ${p.ty + 2} 50 ${p.ty} Q${100 - p.kx + 2} ${p.ty + 2} ${100 - p.kx} ${p.ky - 1} Z" fill="${JULROD}" ${LINE}/>` +
    `<path d="M${p.kx + 1} ${p.ky - 4} Q50 ${p.ky + 1} ${99 - p.kx} ${p.ky - 4}" fill="none" stroke="${SNOVIT}" stroke-width="4" stroke-linecap="round"/>` +
    (stage === 1 ? "" :
      limb(`M${p.kx + 3} ${p.ty + 12} Q${p.kx - 8} ${p.ty + 18} ${p.kx - 8} ${p.ty + 26}`, JULROD, 7) +
      `<circle cx="${p.kx - 8}" cy="${p.ty + 28}" r="4.5" fill="${GRAN}" ${THIN}/>` +
      anim("hwd-flax-h", limb(`M${97 - p.kx} ${p.ty + 12} Q${108 - p.kx} ${p.ty + 18} ${108 - p.kx} ${p.ty + 26}`, JULROD, 7) +
        `<circle cx="${108 - p.kx}" cy="${p.ty + 28}" r="4.5" fill="${GRAN}" ${THIN}/>`)) +
    `<circle cx="50" cy="${p.fy}" r="${p.fr}" fill="${HUD}" ${LINE}/>` +
    `<path d="M${50 - p.fr} ${p.fy + 2} Q${50 - p.fr + 1} ${p.sk + 6} 50 ${p.sk + 8} Q${50 + p.fr - 1} ${p.sk + 6} ${50 + p.fr} ${p.fy + 2} ` +
    `Q${50 + p.fr * 0.5} ${p.fy + 9} 50 ${p.fy + 7} Q${50 - p.fr * 0.5} ${p.fy + 9} ${50 - p.fr} ${p.fy + 2} Z" fill="#fff" ${THIN}/>` +
    `<path d="M${50 - p.fr - 2} ${p.by + 6} Q${50 - p.fr} ${p.toppY + 14} 56 ${p.toppY + 6} Q64 ${p.toppY} 68 ${p.toppY + 6} ` +
    `Q62 ${p.toppY + 10} ${50 + p.fr + 2} ${p.by + 6} Z" fill="${JULROD}" ${LINE}/>` +
    `<rect x="${50 - p.fr - 4}" y="${p.by}" width="${2 * p.fr + 8}" height="7" rx="3.5" fill="${SNOVIT}" ${THIN}/>` +
    topp +
    `<circle cx="50" cy="${p.fy + 4}" r="2.4" fill="#F2A08F" ${THIN}/>` +
    ansikte(50, p.fy, p.ogon, p.r, expr, { munY: 9.5, mun: 2.6, kinder: false });
  if (!tre) return golv(stage === 1 ? 18 : 24) + anim("hwd-andas", fig);
  // Steg 3: Tomtefar – stjärna i luvtoppen och en lysande lykta.
  return glod(50, 52, 44, SKEN, 0.6) + golv(26) +
    anim("hwd-andas", fig) +
    `<path d="M88 64 L88 69" stroke="${O}" stroke-width="1.6"/>` +
    `<rect x="82" y="69" width="12" height="14" rx="3" fill="${GULD}" ${THIN}/>` +
    anim("hw-glod", `<circle cx="88" cy="76" r="3.6" fill="${KRAM}"/>`) +
    glimtar([[12, 22, 3], [88, 30, 3], [10, 74, 2.5]], GULD);
}

// --- Rävis: Rävunge → Rävis → Norrskensräven ---------------------------------

const RAV = "#F2F4F8";
const RAV_INRE = "#F5C1CB";
const NORRSKEN = "#C9F0DC";

const ravOra = (x, y, sida, h) =>
  `<path d="M${x} ${y} L${x + sida * 3} ${y - h} L${x + sida * 14} ${y - 4} Z" fill="${RAV}" ${LINE}/>` +
  `<path d="M${x + sida * 3} ${y - 3} L${x + sida * 4} ${y - h + 7} L${x + sida * 10} ${y - 5} Z" fill="${RAV_INRE}"/>`;

function ravis(stage, expr) {
  const p = stage === 1
    ? { hy: 54, hrx: 19, hry: 17, oh: 18, ky: 78, krx: 17, kry: 13, svans: 1, ogon: 8, r: 5.2 }
    : { hy: 46, hrx: 21, hry: 19, oh: 24, ky: 76, krx: 22, kry: 16, svans: 1.3, ogon: 8.5, r: 5.6 };
  const s = p.svans;
  const fig =
    anim("hwd-svans", `<path d="M64 ${p.ky + 6} Q${64 + 24 * s} ${p.ky + 4} ${62 + 22 * s} ${p.ky - 18 * s} ` +
      `Q${64 + 14 * s} ${p.ky - 6} 64 ${p.ky - 2} Z" fill="${RAV}" ${LINE}/>` +
      `<path d="M${62 + 22 * s} ${p.ky - 18 * s} Q${62 + 18 * s} ${p.ky - 10 * s} ${62 + 15 * s} ${p.ky - 8 * s}" fill="none" stroke="${SNOSKUGGA}" stroke-width="3" stroke-linecap="round"/>`) +
    fot(-1, 42, 91, 5.5, 3.6, RAV) + fot(1, 58, 91, 5.5, 3.6, RAV) +
    `<ellipse cx="50" cy="${p.ky}" rx="${p.krx}" ry="${p.kry}" fill="${RAV}" ${LINE}/>` +
    `<ellipse cx="50" cy="${p.ky + 3}" rx="${p.krx * 0.55}" ry="${p.kry * 0.6}" fill="#fff"/>` +
    ravOra(50 - p.hrx + 4, p.hy - p.hry + 8, -1, p.oh) + ravOra(50 + p.hrx - 4, p.hy - p.hry + 8, 1, p.oh) +
    `<path d="M${50 - p.hrx} ${p.hy} Q${50 - p.hrx} ${p.hy - p.hry} 50 ${p.hy - p.hry} Q${50 + p.hrx} ${p.hy - p.hry} ${50 + p.hrx} ${p.hy} ` +
    `Q${50 + p.hrx + 3} ${p.hy + p.hry * 0.7} 50 ${p.hy + p.hry} Q${50 - p.hrx - 3} ${p.hy + p.hry * 0.7} ${50 - p.hrx} ${p.hy} Z" fill="${RAV}" ${LINE}/>` +
    `<ellipse cx="50" cy="${p.hy + 7}" rx="3" ry="2.2" fill="${O}"/>` +
    ansikte(50, p.hy - 1, p.ogon, p.r, expr, { munY: 12, mun: 3 });
  if (stage === 1) return golv(18) + anim("hwd-andas", fig);
  if (stage === 2) return golv(24) + anim("hwd-andas", fig);
  // Steg 3: Norrskensräven – grön halsduk och norrskensglöd.
  return glod(50, 54, 45, NORRSKEN, 0.65) + golv(26) +
    anim("hwd-andas", fig + halsduk(50, 62, 15, GRAN)) +
    glimtar([[12, 22, 3], [86, 18, 3.5], [12, 80, 2.5]], ISGLIMT);
}

// --- Snöugglis: Fjunboll → Snöugglis → Vinterugglan --------------------------

const UGGLA = "#FBFCFE";
const PRICK = "#9AA6B8";
const NABB = "#6B6F80";

function snougglis(stage, expr) {
  const p = stage === 1
    ? { cy: 64, rx: 22, ry: 25, fy: 58, ogon: 8.5, r: 6 }
    : { cy: 60, rx: 26, ry: 30, fy: 50, ogon: 9.5, r: 6.6 };
  const vinge = (sida) => `<path d="M${50 + sida * (p.rx - 4)} ${p.cy - 8} Q${50 + sida * (p.rx + 10)} ${p.cy + 4} ` +
    `${50 + sida * (p.rx - 2)} ${p.cy + p.ry - 6} Q${50 + sida * (p.rx - 8)} ${p.cy + 6} ${50 + sida * (p.rx - 4)} ${p.cy - 8} Z" fill="${UGGLA}" ${LINE}/>`;
  const prickar = stage === 1 ? "" :
    [[40, 72], [50, 76], [60, 72], [44, 82], [56, 82], [36, 64], [64, 64]]
      .map(([x, y]) => `<path d="M${x - 2.5} ${y} q2.5 2.5 5 0" fill="none" stroke="${PRICK}" stroke-width="1.8" stroke-linecap="round"/>`).join("");
  const tofsar = stage === 1 ? "" :
    `<path d="M${50 - p.rx + 6} ${p.cy - p.ry + 10} L${50 - p.rx + 4} ${p.cy - p.ry - 2} L${50 - p.rx + 16} ${p.cy - p.ry + 5} Z" fill="${UGGLA}" ${THIN}/>` +
    `<path d="M${50 + p.rx - 6} ${p.cy - p.ry + 10} L${50 + p.rx - 4} ${p.cy - p.ry - 2} L${50 + p.rx - 16} ${p.cy - p.ry + 5} Z" fill="${UGGLA}" ${THIN}/>`;
  const fig =
    fot(-1, 43, 91, 5, 3.2, GULD) + fot(1, 57, 91, 5, 3.2, GULD) +
    tofsar + vinge(-1) + anim("hwd-flax-h", vinge(1)) +
    `<ellipse cx="50" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}" fill="${UGGLA}" ${LINE}/>` +
    `<ellipse cx="50" cy="${p.fy}" rx="${p.rx - 5}" ry="${stage === 1 ? 11 : 13}" fill="#EEF3F8"/>` +
    prickar +
    ansikte(50, p.fy, p.ogon, p.r, expr, { iris: GULD, utanMun: true, munY: 12, mun: 3 }) +
    `<path d="M47 ${p.fy + 5} L53 ${p.fy + 5} L50 ${p.fy + 10} Z" fill="${NABB}" ${THIN}/>`;
  if (stage === 1) return golv(17) + anim("hwd-andas", fig);
  if (stage === 2) return golv(22) + anim("hwd-andas", fig);
  // Steg 3: Vinterugglan – tomteluva och isblå glöd.
  return glod(50, 54, 44, "#D6ECF8", 0.6) + golv(24) +
    anim("hwd-andas", fig + tomteluva(53, 33, 1.1, -14)) +
    glimtar([[12, 26, 3], [88, 40, 3.5], [86, 84, 2.5]], ISGLIMT);
}

// --- Glittris: Gnistis → Glittris → Julstjärnan ------------------------------

function glittris(stage, expr) {
  const p = stage === 1 ? { cy: 60, R: 27, ogon: 7, r: 5 } : stage === 2 ? { cy: 56, R: 33, ogon: 8, r: 5.6 } : { cy: 58, R: 34, ogon: 8.5, r: 5.8 };
  const kropp = stjarna5(50, p.cy, p.R, GULD, 0.6) +
    (stage === 1 ? "" : stjarna5(50, p.cy + 1, p.R * 0.55, SKEN, 0.62).replace(/stroke="[^"]*" stroke-width="[^"]*"/, 'stroke="none"')) +
    `<ellipse cx="${50 - p.R * 0.38}" cy="${p.cy - p.R * 0.28}" rx="3" ry="2" fill="#fff" opacity="0.8"/>`;
  const fig = anim("hwd-andas", kropp + ansikte(50, p.cy + 1, p.ogon, p.r, expr));
  if (stage === 1) return golv(14) + anim("hwd-svav", fig);
  const stjarnor = stjarna5(16, 34, 4, SKEN) + stjarna5(84, 30, 5, SKEN) + stjarna5(86, 76, 3.5, SKEN);
  if (stage === 2) return golv(18) + anim("hwd-svav", fig) + stjarnor;
  // Steg 3: Julstjärnan – liten tomteluva på toppuddén och gyllene glöd.
  return glod(50, 56, 46, SKEN, 0.7) + golv(20) +
    anim("hwd-svav", fig + tomteluva(50, p.cy - p.R + 11, 0.72, -8)) +
    glimtar([[14, 30, 3.5], [86, 26, 4], [84, 82, 3], [16, 78, 2.5]], GULD_MORK);
}

// --- Julklappis: Paketis → Julklappis → Klappkungen --------------------------

/** Rosett: knuten mitt i (x,y), bredd ≈ 24·s. */
const rosett = (x, y, s, c = GULD) =>
  `<g transform="translate(${x} ${y}) scale(${s})">` +
  `<path d="M0 0 Q-14 -12 -13 -2 Q-12 6 0 0 Z" fill="${c}" ${THIN}/>` +
  `<path d="M0 0 Q14 -12 13 -2 Q12 6 0 0 Z" fill="${c}" ${THIN}/>` +
  `<path d="M-1 1 L-6 9 M1 1 L6 9" stroke="${GULD_MORK}" stroke-width="3" stroke-linecap="round"/>` +
  `<circle cx="0" cy="0" r="3.2" fill="${GULD_MORK}" ${THIN}/></g>`;

function julklappis(stage, expr) {
  if (stage === 1) {
    return golv(20) +
      fot(-1, 40, 91, 5.5, 3.4, JULROD_MORK) + fot(1, 60, 91, 5.5, 3.4, JULROD_MORK) +
      anim("hwd-andas",
        `<rect x="29" y="52" width="42" height="38" rx="7" fill="${JULROD}" ${LINE}/>` +
        `<rect x="46" y="52" width="8" height="38" fill="${GULD}"/>` +
        `<path d="M46 52 L46 90 M54 52 L54 90" stroke="${GULD_MORK}" stroke-width="1.2"/>` +
        rosett(50, 51, 0.85) +
        ansikte(50, 69, 10, 5.6, expr));
  }
  const tre = stage === 3;
  const fig =
    fot(-1, 38, 92, 6.5, 3.8, JULROD_MORK) + fot(1, 62, 92, 6.5, 3.8, JULROD_MORK) +
    limb("M25 66 Q15 68 13 76", JULROD, 6) + anim("hwd-flax-h", limb("M75 66 Q85 64 88 56", JULROD, 6)) +
    `<rect x="25" y="48" width="50" height="42" rx="7" fill="${JULROD}" ${LINE}/>` +
    `<rect x="46" y="48" width="8" height="42" fill="${GULD}"/>` +
    `<rect x="21" y="38" width="58" height="13" rx="5" fill="${JULROD}" ${LINE}/>` +
    `<rect x="46" y="38" width="8" height="13" fill="${GULD}"/>` +
    `<circle cx="31" cy="83" r="2" fill="${KRAM}"/><circle cx="69" cy="58" r="2" fill="${KRAM}"/><circle cx="68" cy="83" r="2" fill="${KRAM}"/>` +
    rosett(50, 37, tre ? 1.25 : 1.05) +
    ansikte(50, 66, 11, 6.2, expr);
  if (!tre) return golv(26) + anim("hwd-andas", fig);
  // Steg 3: Klappkungen – en stjärnlapp i rosetten och gyllene glöd.
  return glod(50, 56, 46, SKEN, 0.65) + golv(28) +
    anim("hwd-andas", fig +
      `<path d="M58 36 Q66 32 70 26" fill="none" stroke="${GULD_MORK}" stroke-width="1.6"/>` +
      julstjarna(72, 22, 7)) +
    glimtar([[12, 24, 3], [90, 46, 3], [10, 60, 2.5]], GULD_MORK);
}

export const JUL_DJUR_B = { tomtis, ravis, snougglis, glittris, julklappis };
