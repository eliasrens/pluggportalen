// ============================================================================
// Pluggporten – Jul-djuren 1–5 (#912): Snöis, Renis, Pingvis, Pepparis,
// Isbjörnis. Varje art = (steg 1–3, uttryck) => SVG-innehåll i viewBox 0 0 100 100.
// Steg 1 litet och bebisaktigt, steg 2 med fler kännetecken, steg 3 ståtligt med
// glöd och en julsak (tomteluva, halsduk, stjärna, bjällra). Delar: jul-djur-delar.js.
// Laddas bara via import() (#271).
// ============================================================================

import {
  O, LINE, THIN, limb, anim, golv, ansikte, glod, glimtar, fot, ISGLIMT,
  tomteluva, halsduk, julstjarna, bjallra, snoboll,
} from "./jul-djur-delar.js";
import { JULROD, GRAN, GULD, KRAM, SNOSKUGGA, PEPPAR, WOOD_DARK } from "./jul-art-delar.js";

const ISBLA = "#D6ECF8";

// --- Snöis: Snöpluttis → Snöis → Snöbollskungen ------------------------------

/** Kvistarm från axeln (x,y) åt sidan `sida` (-1 vänster, 1 höger). */
const kvist = (x, y, sida, l = 1) =>
  limb(`M${x} ${y} Q${x + sida * 10 * l} ${y - 4 * l} ${x + sida * 15 * l} ${y - 12 * l}`, WOOD_DARK, 2.6) +
  limb(`M${x + sida * 11 * l} ${y - 6 * l} L${x + sida * 17 * l} ${y - 4 * l}`, WOOD_DARK, 2);

function snois(stage, expr) {
  if (stage === 1) {
    return golv(18) +
      fot(-1, 41, 90, 5.5, 3.4, SNOSKUGGA) + fot(1, 59, 90, 5.5, 3.4, SNOSKUGGA) +
      anim("hwd-andas",
        snoboll(36, 46, 5.5) + snoboll(64, 46, 5.5) +
        snoboll(50, 66, 25) +
        ansikte(50, 64, 9, 6, expr));
  }
  const lag = stage === 3 ? { y: 75, r: 26, h: 42, hr: 22, ora: 17 } : { y: 74, r: 24, h: 45, hr: 20, ora: 16 };
  const kropp = snoboll(50 - lag.ora, lag.h - 15, 5.5) + snoboll(50 + lag.ora, lag.h - 15, 5.5) +
    snoboll(50, lag.y, lag.r) + snoboll(50, lag.h, lag.hr) +
    `<circle cx="50" cy="${lag.y - 4}" r="2.6" fill="${O}"/><circle cx="50" cy="${lag.y + 6}" r="2.6" fill="${O}"/>`;
  const armar = kvist(27, lag.y - 6, -1) + anim("hwd-flax-h", kvist(73, lag.y - 6, 1));
  if (stage === 2) {
    return golv(24) + armar + anim("hwd-andas", kropp + ansikte(50, lag.h, 8.5, 6, expr));
  }
  // Steg 3: Snöbollskungen – röd halsduk, isblå glöd, glittrande flingor.
  return glod(50, 52, 44, ISBLA, 0.6) + golv(28) + armar +
    anim("hwd-andas", kropp + halsduk(50, 60, 17) + ansikte(50, lag.h, 9, 6.4, expr)) +
    glimtar([[12, 24, 3], [88, 20, 3.5], [87, 82, 2.5]], ISGLIMT);
}

// --- Renis: Renkalv → Renis → Nordstjärneren ---------------------------------

const REN = "#B98257";
const REN_MORK = "#8A6242";
const HORN = "#D9B98C";

/** Ett horn från (x,y) åt sidan `sida`; `n` grenar (0 = bara knopp). */
function horn(x, y, sida, n) {
  if (!n) return limb(`M${x} ${y} Q${x + sida * 1} ${y - 4} ${x + sida * 3} ${y - 6}`, HORN, 3.4);
  const s = n === 2 ? 1 : 1.25;
  let d = `M${x} ${y} Q${x + sida * 6 * s} ${y - 10 * s} ${x + sida * 14 * s} ${y - 18 * s}`;
  d += ` M${x + sida * 6 * s} ${y - 9 * s} Q${x + sida * 3 * s} ${y - 16 * s} ${x + sida * 4 * s} ${y - 21 * s}`;
  if (n === 3) d += ` M${x + sida * 10 * s} ${y - 14 * s} Q${x + sida * 16 * s} ${y - 12 * s} ${x + sida * 20 * s} ${y - 14 * s}`;
  return limb(d, HORN, 3.4);
}

const renOra = (cx, cy, sida, s = 1) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${9 * s}" ry="${4.5 * s}" transform="rotate(${sida * 25} ${cx} ${cy})" fill="${REN}" ${LINE}/>`;

function renis(stage, expr) {
  if (stage === 1) {
    return golv(18) +
      fot(-1, 42, 91, 5, 3.6, REN_MORK) + fot(1, 58, 91, 5, 3.6, REN_MORK) +
      anim("hwd-andas",
        horn(43, 36, -1, 0) + horn(57, 36, 1, 0) +
        renOra(32, 46, -1) + renOra(68, 46, 1) +
        `<ellipse cx="50" cy="78" rx="18" ry="13" fill="${REN}" ${LINE}/>` +
        `<circle cx="44" cy="76" r="2.2" fill="${KRAM}"/><circle cx="56" cy="80" r="2.2" fill="${KRAM}"/>` +
        `<circle cx="50" cy="52" r="19" fill="${REN}" ${LINE}/>` +
        `<ellipse cx="50" cy="62" rx="9" ry="6.5" fill="${KRAM}" ${THIN}/>` +
        `<ellipse cx="50" cy="58.5" rx="3.5" ry="2.6" fill="${O}"/>` +
        ansikte(50, 49, 8, 5.4, expr, { munY: 16, mun: 3.2 }));
  }
  const tre = stage === 3;
  const huvud = (tre ? horn(41, 29, -1, 3) + horn(59, 29, 1, 3) : horn(41, 29, -1, 2) + horn(59, 29, 1, 2)) +
    renOra(28, 38, -1, 1.1) + renOra(72, 38, 1, 1.1) +
    `<circle cx="50" cy="44" r="20" fill="${REN}" ${LINE}/>` +
    `<ellipse cx="50" cy="55" rx="10" ry="7" fill="${KRAM}" ${THIN}/>` +
    (tre
      ? anim("hw-glod", `<circle cx="50" cy="51" r="6" fill="${JULROD}" opacity="0.45"/>`) +
        `<ellipse cx="50" cy="51" rx="4" ry="3.2" fill="${JULROD}" ${THIN}/>`
      : `<ellipse cx="50" cy="51" rx="3.8" ry="2.8" fill="${O}"/>`) +
    ansikte(50, 40, 8.5, 5.6, expr, { munY: 18, mun: 3.4 });
  const kropp = fot(-1, 40, 91, 6, 4, REN_MORK) + fot(1, 60, 91, 6, 4, REN_MORK) +
    anim("hwd-svans", `<ellipse cx="74" cy="72" rx="6" ry="4" fill="${KRAM}" ${THIN}/>`) +
    `<ellipse cx="50" cy="76" rx="23" ry="17" fill="${REN}" ${LINE}/>` +
    `<ellipse cx="50" cy="80" rx="13" ry="10" fill="${KRAM}"/>`;
  if (!tre) return golv(24) + anim("hwd-andas", kropp + huvud);
  // Steg 3: Nordstjärneren – stora horn, lysande röd nos, halsduk och bjällra.
  return glod(50, 50, 45, "#FCE3C4", 0.6) + golv(28) +
    anim("hwd-andas", kropp + huvud + halsduk(50, 63, 15) + bjallra(50, 76, 4)) +
    glimtar([[12, 30, 3], [88, 28, 3.5], [14, 82, 2.5]], GULD);
}

// --- Pingvis: Dunboll → Pingvis → Isprinsen ----------------------------------

const PING = "#46557A";
const NABB = "#F2A93B";

function pingvis(stage, expr) {
  const p = stage === 1
    ? { cy: 64, rx: 24, ry: 27, fy: 53, ogon: 7, r: 5, fena: 66 }
    : { cy: 60, rx: 27, ry: 32, fy: 48, ogon: 8, r: 5.6, fena: 62 };
  const fena = (sida) => `<ellipse cx="${50 + sida * (p.rx + 2)}" cy="${p.fena}" rx="5" ry="${stage === 1 ? 10 : 14}" ` +
    `transform="rotate(${sida * -20} ${50 + sida * (p.rx + 2)} ${p.fena})" fill="${PING}" ${LINE}/>`;
  const kropp = fot(-1, 42, 92, 6, 3.4, NABB) + fot(1, 58, 92, 6, 3.4, NABB) +
    fena(-1) + anim("hwd-flax-h", fena(1)) +
    `<ellipse cx="50" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}" fill="${PING}" ${LINE}/>` +
    `<ellipse cx="50" cy="${p.cy + 6}" rx="${p.rx - 8}" ry="${p.ry - 8}" fill="#fff"/>` +
    `<ellipse cx="50" cy="${p.fy + 2}" rx="${p.rx - 8}" ry="${stage === 1 ? 12 : 13}" fill="#fff"/>` +
    (stage === 3
      ? `<ellipse cx="${50 - p.rx + 7}" cy="${p.fy + 12}" rx="4" ry="7" fill="${GULD}"/>` +
        `<ellipse cx="${50 + p.rx - 7}" cy="${p.fy + 12}" rx="4" ry="7" fill="${GULD}"/>`
      : "") +
    (stage === 1 ? limb(`M50 ${p.cy - p.ry + 1} Q47 ${p.cy - p.ry - 5} 51 ${p.cy - p.ry - 7}`, PING, 3) : "") +
    ansikte(50, p.fy, p.ogon, p.r, expr, { utanMun: true, munY: 13, mun: 3 }) +
    `<path d="M45 ${p.fy + 6} L55 ${p.fy + 6} L50 ${p.fy + 11} Z" fill="${NABB}" ${THIN}/>`;
  if (stage === 1) return golv(17) + anim("hwd-andas", kropp);
  if (stage === 2) return golv(22) + anim("hwd-andas", kropp);
  // Steg 3: Isprinsen – gula kejsarfläckar, tomteluva, isblå glöd.
  return glod(50, 54, 44, ISBLA, 0.6) + golv(24) +
    anim("hwd-andas", kropp + tomteluva(53, 33, 1.15)) +
    glimtar([[12, 26, 3], [88, 40, 3.5], [86, 84, 2.5]], ISGLIMT);
}

// --- Pepparis: Smula → Pepparis → Kakmästaren --------------------------------

const GLASYR = `fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"`;
const vag = (x, y, n, w = 3.5) => {
  let d = `M${x} ${y}`;
  for (let i = 0; i < n; i++) d += ` q${w / 2} ${-w} ${w} 0`;
  return `<path d="${d}" ${GLASYR}/>`;
};

function pepparis(stage, expr) {
  if (stage === 1) {
    return golv(18) +
      limb("M44 80 L42 89", PEPPAR, 10) + limb("M56 80 L58 89", PEPPAR, 10) +
      limb("M39 68 Q31 66 28 60", PEPPAR, 9) + anim("hwd-flax-h", limb("M61 68 Q69 66 72 60", PEPPAR, 9)) +
      anim("hwd-andas",
        `<rect x="37" y="62" width="26" height="22" rx="11" fill="${PEPPAR}" ${LINE}/>` +
        `<circle cx="50" cy="69" r="2.4" fill="${JULROD}" ${THIN}/><circle cx="50" cy="77" r="2.4" fill="${GRAN}" ${THIN}/>` +
        `<circle cx="50" cy="46" r="19" fill="${PEPPAR}" ${LINE}/>` +
        vag(36, 36, 8) +
        ansikte(50, 47, 7.5, 5.2, expr, { linje: O }));
  }
  const tre = stage === 3;
  const kropp =
    limb("M43 80 L39 90", PEPPAR, 12) + limb("M57 80 L61 90", PEPPAR, 12) +
    `<path d="M34 89 Q39 85 44 89 M56 89 Q61 85 66 89" ${GLASYR}/>` +
    limb("M37 60 Q25 57 18 49", PEPPAR, 11) +
    anim("hwd-flax-h", limb("M63 60 Q75 57 82 49", PEPPAR, 11) + `<path d="M77 45 Q83 49 80 55" ${GLASYR}/>`) +
    `<path d="M14 47 Q20 51 17 57" ${GLASYR}/>` +
    `<rect x="35" y="52" width="30" height="31" rx="13" fill="${PEPPAR}" ${LINE}/>` +
    (tre
      ? julstjarna(50, 70, 6.5)
      : `<circle cx="50" cy="61" r="2.6" fill="${JULROD}" ${THIN}/><circle cx="50" cy="69" r="2.6" fill="${GRAN}" ${THIN}/>` +
        `<circle cx="50" cy="77" r="2.6" fill="${JULROD}" ${THIN}/>`) +
    `<circle cx="50" cy="37" r="19" fill="${PEPPAR}" ${LINE}/>` +
    vag(36, 26, 8) +
    ansikte(50, 38, 8, 5.4, expr);
  if (!tre) return golv(22) + anim("hwd-andas", kropp);
  // Steg 3: Kakmästaren – glasyrstjärna på magen och halsduk.
  return glod(50, 54, 44, "#FCE3C4", 0.6) + golv(24) +
    anim("hwd-andas", kropp + halsduk(50, 53, 13, GRAN)) +
    glimtar([[10, 24, 3], [90, 24, 3.5], [88, 80, 2.5]], GULD);
}

// --- Isbjörnis: Snönalle → Isbjörnis → Isfursten -----------------------------

const BJ = "#F7FAFD";
const BJ_INRE = "#F5C1CB";

const bjOra = (cx, cy, r) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${BJ}" ${LINE}/><circle cx="${cx}" cy="${cy}" r="${(r * 0.5).toFixed(1)}" fill="${BJ_INRE}"/>`;

function isbjornis(stage, expr) {
  if (stage === 1) {
    return golv(19) +
      fot(-1, 41, 91, 6.5, 4, BJ) + fot(1, 59, 91, 6.5, 4, BJ) +
      anim("hwd-andas",
        bjOra(35, 40, 7) + bjOra(65, 40, 7) +
        `<ellipse cx="50" cy="77" rx="20" ry="15" fill="${BJ}" ${LINE}/>` +
        `<circle cx="50" cy="56" r="20" fill="${BJ}" ${LINE}/>` +
        `<ellipse cx="50" cy="64" rx="9" ry="6.5" fill="#fff" stroke="${SNOSKUGGA}" stroke-width="1.6"/>` +
        `<ellipse cx="50" cy="60.5" rx="3.6" ry="2.6" fill="${O}"/>` +
        ansikte(50, 53, 8, 5.4, expr, { munY: 13, mun: 3.2 }));
  }
  const tre = stage === 3;
  const kropp = fot(-1, 38, 92, 8, 4.4, BJ) + fot(1, 62, 92, 8, 4.4, BJ) +
    bjOra(31, 30, 8) + bjOra(69, 30, 8) +
    `<ellipse cx="50" cy="76" rx="26" ry="18" fill="${BJ}" ${LINE}/>` +
    `<path d="M32 80 Q50 92 68 80" fill="none" stroke="${SNOSKUGGA}" stroke-width="3" stroke-linecap="round"/>` +
    `<ellipse cx="33" cy="74" rx="6" ry="8" fill="${BJ}" ${LINE}/>` +
    anim("hwd-flax-h", `<ellipse cx="67" cy="74" rx="6" ry="8" fill="${BJ}" ${LINE}/>`) +
    `<circle cx="50" cy="46" r="22" fill="${BJ}" ${LINE}/>` +
    `<ellipse cx="50" cy="56" rx="10" ry="7" fill="#fff" stroke="${SNOSKUGGA}" stroke-width="1.6"/>` +
    `<ellipse cx="50" cy="52" rx="3.8" ry="2.8" fill="${O}"/>` +
    ansikte(50, 43, 9, 5.8, expr, { munY: 15, mun: 3.4 });
  if (!tre) return golv(26) + anim("hwd-andas", kropp);
  // Steg 3: Isfursten – tomteluva och isblå glöd med flingor.
  return glod(50, 54, 45, ISBLA, 0.65) + golv(28) +
    anim("hwd-andas", kropp + tomteluva(55, 27, 1.2)) +
    glimtar([[10, 24, 3], [90, 22, 3.5], [88, 84, 2.5]], ISGLIMT);
}

export const JUL_DJUR_A = { snois, renis, pingvis, pepparis, isbjornis };
