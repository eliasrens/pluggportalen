// ============================================================================
// Pluggporten – Halloween-djuren 1–5 (#695): Spökis, Pumpis, Fladdis, Gruffe,
// Svartis. Varje art = (steg 1–3, uttryck) => SVG-innehåll i viewBox 0 0 100 100.
// Steg 1 litet och bebisaktigt, steg 2 med fler kännetecken, steg 3 ståtligt med
// glöd/krona/accessoar. Delar + animationsklasser: hw-djur-delar.js.
// Laddas bara via import() (#271).
// ============================================================================

import {
  O, LINE, THIN, limb, anim, golv, ansikte, krona, glod, glimtar, fot, stjarnaK, mane,
} from "./hw-djur-delar.js";
import { PUMPA, PUMPA_MORK, LILA, LILA_MORK, GUL, GRON, GRON_MORK, KRAM, SKEN } from "./hw-art-delar.js";

const VIT = "#FFFFFF";
const SPOK_SKUGGA = "#E5DDF5";

// --- Spökis: Dimfjun → Spökis → Slottsspöket --------------------------------

function spokKropp(x0, x1, top, botten, toppY) {
  // Rund topp + vågig fåll (4 bågar) mellan x0 och x1.
  const mitt = (x0 + x1) / 2;
  const r = (x1 - x0) / 2;
  const steg = (x1 - x0) / 4;
  let fall = "";
  for (let i = 0; i < 4; i++) {
    const a = x1 - i * steg;
    const b = a - steg;
    fall += ` Q${(a - steg / 2).toFixed(1)} ${botten + 8} ${b.toFixed(1)} ${botten}`;
  }
  return `<path d="M${x0} ${botten} L${x0} ${toppY} Q${x0} ${top} ${mitt} ${top} Q${x1} ${top} ${x1} ${toppY} L${x1} ${botten}${fall} Z" fill="${VIT}" ${LINE}/>` +
    `<ellipse cx="${x0 + r * 0.38}" cy="${toppY + 6}" rx="${(r * 0.12).toFixed(1)}" ry="${(r * 0.32).toFixed(1)}" fill="${SPOK_SKUGGA}"/>`;
}

function spokis(stage, expr) {
  if (stage === 1) {
    return golv(15) + anim("hwd-svav",
      limb("M50 30 Q45 20 52 17 Q58 16 57 22", VIT, 4) +
      anim("hwd-andas", spokKropp(25, 75, 28, 76, 52)) +
      ansikte(50, 52, 9, 6.5, expr));
  }
  if (stage === 2) {
    return golv(20) + anim("hwd-svav",
      limb("M50 20 Q45 10 53 8 Q59 8 58 14", VIT, 4) +
      `<path d="M25 60 Q12 62 14 72 Q21 75 26 68 Z" fill="${VIT}" ${LINE}/>` +
      anim("hwd-flax-h", `<path d="M75 56 Q87 46 90 55 Q88 64 75 65 Z" fill="${VIT}" ${LINE}/>`) +
      anim("hwd-andas", spokKropp(22, 78, 20, 84, 46)) +
      ansikte(50, 46, 10, 7, expr));
  }
  // Steg 3: Slottsspöket – krona, kedja av stjärnor, mjuk lila glöd.
  return glod(50, 48, 44, "#E5D8F7", 0.6) + golv(24) + anim("hwd-svav",
    anim("hwd-flax-v", `<path d="M22 58 Q6 48 6 60 Q10 70 23 68 Z" fill="${VIT}" ${LINE}/>`) +
    anim("hwd-flax-h", `<path d="M78 58 Q94 48 94 60 Q90 70 77 68 Z" fill="${VIT}" ${LINE}/>`) +
    anim("hwd-andas", spokKropp(19, 81, 22, 86, 50)) +
    `<path d="M24 66 Q50 82 76 66" fill="none" stroke="${GUL}" stroke-width="1.8" stroke-dasharray="1 3" stroke-linecap="round"/>` +
    stjarnaK(28, 69, 0.8) + stjarnaK(39, 74.5, 0.9) + stjarnaK(50, 76.5, 1.1) + stjarnaK(61, 74.5, 0.9) + stjarnaK(72, 69, 0.8) +
    ansikte(50, 46, 11, 7.5, expr) +
    krona(57, 25, 1.15)) +
    glimtar([[12, 22, 3], [88, 26, 3.5], [84, 82, 2.5]], "#C9B6F0");
}

// --- Pumpis: Pumpafrö → Pumpaknopp → Lyktkungen -----------------------------

function pumpaKropp(cx, cy, rx, ry, rander = false) {
  const sido = rx * 0.42;
  return `<ellipse cx="${cx - sido}" cy="${cy}" rx="${(rx * 0.62).toFixed(1)}" ry="${ry}" fill="${PUMPA_MORK}" ${LINE}/>` +
    `<ellipse cx="${cx + sido}" cy="${cy}" rx="${(rx * 0.62).toFixed(1)}" ry="${ry}" fill="${PUMPA_MORK}" ${LINE}/>` +
    `<ellipse cx="${cx}" cy="${cy}" rx="${(rx * 0.64).toFixed(1)}" ry="${(ry * 1.02).toFixed(1)}" fill="${PUMPA}" ${LINE}/>` +
    (rander ? anim("hw-glod",
      `<path d="M${cx - sido * 1.5} ${cy - ry * 0.6} Q${cx - sido * 1.8} ${cy} ${cx - sido * 1.5} ${cy + ry * 0.6}" fill="none" stroke="${SKEN}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M${cx + sido * 1.5} ${cy - ry * 0.6} Q${cx + sido * 1.8} ${cy} ${cx + sido * 1.5} ${cy + ry * 0.6}" fill="none" stroke="${SKEN}" stroke-width="2.4" stroke-linecap="round"/>`) : "");
}

const blad = (x, y, rot, s = 1) =>
  `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" d="M0 0 Q4 -9 13 -8 Q11 1 0 0 Z" fill="${GRON}" ${THIN}/>`;

function pumpis(stage, expr) {
  if (stage === 1) {
    return golv(20) +
      fot(-1, 41, 90, 6, 3.6, PUMPA_MORK) + fot(1, 59, 90, 6, 3.6, PUMPA_MORK) +
      anim("hwd-andas",
        limb("M50 44 Q49 36 52 32", GRON_MORK, 3.5) + blad(52, 33, -20, 1.3) +
        limb("M51 38 Q42 34 44 28 Q46 25 48 28", GRON_MORK, 1.6) +
        pumpaKropp(50, 66, 28, 24) +
        ansikte(50, 63, 9, 6, expr));
  }
  if (stage === 2) {
    return golv(26) +
      fot(-1, 39, 91, 7, 4, GRON_MORK) + fot(1, 61, 91, 7, 4, GRON_MORK) +
      anim("hwd-andas",
        limb("M50 34 Q49 26 53 21", GRON_MORK, 4) +
        blad(52, 24, -30, 1.4) + blad(49, 26, 200, 1.2) +
        limb("M53 22 Q62 14 66 20 Q68 25 63 25", GRON_MORK, 1.6) +
        pumpaKropp(50, 61, 32, 28) +
        ansikte(50, 57, 10, 6.8, expr)) +
      limb("M24 66 Q14 68 13 76", GRON_MORK, 3.5) + blad(13, 76, 110, 0.9) +
      anim("hwd-flax-h", limb("M76 64 Q86 60 88 52", GRON_MORK, 3.5) + blad(88, 52, -60, 0.9));
  }
  // Steg 3: Lyktkungen – lyser inifrån, bladkrona + guldkrona, liten lykta.
  return glod(50, 56, 44, SKEN, 0.65) + golv(30) +
    fot(-1, 37, 92, 8, 4.4, GRON_MORK) + fot(1, 63, 92, 8, 4.4, GRON_MORK) +
    anim("hwd-andas",
      blad(50, 26, -40, 1.6) + blad(48, 28, 220, 1.5) + blad(50, 28, -95, 1.2) +
      limb("M50 34 Q49 26 51 22", GRON_MORK, 4) +
      pumpaKropp(50, 61, 36, 30, true) +
      ansikte(50, 57, 11, 7.2, expr) +
      krona(50, 22, 1.2)) +
    limb("M22 64 Q12 66 11 74", GRON_MORK, 4) + blad(11, 74, 110, 1) +
    anim("hwd-flax-h",
      limb("M78 62 Q86 64 86 70", GRON_MORK, 4) +
      `<path d="M86 70 L86 74" stroke="${O}" stroke-width="1.6"/>` +
      `<rect x="81" y="74" width="10" height="12" rx="3" fill="${GUL}" ${THIN}/>` +
      anim("hw-glod", `<circle cx="86" cy="80" r="3.2" fill="${KRAM}"/>`));
}

// --- Fladdis: Fladderfjun → Nattvinge → Månfladdraren -----------------------

const FL_PALS = "#5B4A7A";
const FL_VINGE = "#4C4661";
const FL_MAGE = "#B79BE0";
const FL_INRE = "#F5C1CB";

function flOron(cx, top, h, w) {
  return `<path d="M${cx - w} ${top + h} Q${cx - w - 6} ${top + 4} ${cx - w + 2} ${top} Q${cx - 6} ${top + h * 0.5} ${cx - 4} ${top + h} Z" fill="${FL_PALS}" ${LINE}/>` +
    `<path d="M${cx + w} ${top + h} Q${cx + w + 6} ${top + 4} ${cx + w - 2} ${top} Q${cx + 6} ${top + h * 0.5} ${cx + 4} ${top + h} Z" fill="${FL_PALS}" ${LINE}/>` +
    `<path d="M${cx - w + 1} ${top + h - 2} Q${cx - w - 2} ${top + 7} ${cx - w + 3} ${top + 5} Q${cx - 8} ${top + h * 0.6} ${cx - 7} ${top + h - 2} Z" fill="${FL_INRE}"/>` +
    `<path d="M${cx + w - 1} ${top + h - 2} Q${cx + w + 2} ${top + 7} ${cx + w - 3} ${top + 5} Q${cx + 8} ${top + h * 0.6} ${cx + 7} ${top + h - 2} Z" fill="${FL_INRE}"/>`;
}

/** Bågad fladdervinge från axeln (sx,sy), spann s (negativ = åt vänster). */
function flVinge(sx, sy, s, hojd) {
  const d = (k) => (sx + s * k).toFixed(1);
  const path = `M${sx} ${sy} Q${d(0.4)} ${sy - hojd} ${d(1)} ${sy - hojd * 0.55} ` +
    `Q${d(0.86)} ${sy - hojd * 0.1} ${d(0.9)} ${sy + hojd * 0.15} Q${d(0.72)} ${sy} ${d(0.62)} ${sy + hojd * 0.3} ` +
    `Q${d(0.46)} ${sy + hojd * 0.12} ${d(0.34)} ${sy + hojd * 0.4} Q${d(0.18)} ${sy + hojd * 0.2} ${sx} ${sy + hojd * 0.35} Z`;
  return anim(s < 0 ? "hwd-flax-v" : "hwd-flax-h",
    `<path d="${path}" fill="${FL_VINGE}" ${LINE}/>` +
    `<path d="M${sx} ${sy + 2} L${d(0.62)} ${sy + hojd * 0.22} M${sx} ${sy + 1} L${d(0.88)} ${sy - hojd * 0.3}" fill="none" stroke="${LILA}" stroke-width="1.6" stroke-linecap="round"/>`);
}

function fladdis(stage, expr) {
  const lj = { linje: SKEN };
  if (stage === 1) {
    return golv(18) + anim("hwd-svav",
      flVinge(30, 62, -20, 16) + flVinge(70, 62, 20, 16) +
      flOron(50, 22, 22, 20) +
      anim("hwd-andas",
        `<circle cx="50" cy="62" r="26" fill="${FL_PALS}" ${LINE}/>` +
        `<path d="M44 37 Q47 30 50 36 Q53 30 56 37" fill="${FL_PALS}" ${THIN}/>` +
        `<ellipse cx="50" cy="75" rx="13" ry="9" fill="${FL_MAGE}"/>`) +
      ansikte(50, 58, 9.5, 7, expr, lj));
  }
  if (stage === 2) {
    return golv(22) +
      fot(-1, 42, 90, 5, 3.4, FL_VINGE) + fot(1, 58, 90, 5, 3.4, FL_VINGE) +
      flVinge(30, 56, -28, 26) + flVinge(70, 56, 28, 26) +
      flOron(50, 12, 24, 22) +
      anim("hwd-andas",
        `<ellipse cx="50" cy="60" rx="25" ry="28" fill="${FL_PALS}" ${LINE}/>` +
        `<path d="M43 33 Q47 25 50 32 Q53 25 57 33" fill="${FL_PALS}" ${THIN}/>` +
        `<ellipse cx="50" cy="74" rx="14" ry="12" fill="${FL_MAGE}"/>`) +
      ansikte(50, 52, 10, 7, expr, lj);
  }
  // Steg 3: Månfladdraren – stora vingar, månskära på bröstet, stjärnglitter.
  return glod(50, 50, 44, "#C9B6F0", 0.5) + golv(26) +
    fot(-1, 41, 91, 6, 3.6, FL_VINGE) + fot(1, 59, 91, 6, 3.6, FL_VINGE) +
    flVinge(30, 54, -29, 32) + flVinge(70, 54, 29, 32) +
    flOron(50, 6, 26, 23) +
    anim("hwd-andas",
      `<ellipse cx="50" cy="58" rx="27" ry="31" fill="${FL_PALS}" ${LINE}/>` +
      `<path d="M42 30 Q46 21 50 28 Q54 21 58 30" fill="${FL_PALS}" ${THIN}/>` +
      `<ellipse cx="50" cy="74" rx="15" ry="13" fill="${FL_MAGE}"/>` +
      mane(48, 75, 6, SKEN)) +
    ansikte(50, 48, 10.5, 7.2, expr, lj) +
    glimtar([[10, 18, 3], [90, 20, 3.5], [16, 84, 2.4], [86, 86, 2.6]], SKEN);
}

// --- Gruffe: Ägglöga → Skymningsdrake → Månskensdraken ----------------------

const GR_PALS = "#B79BE0";
const GR_MAGE = "#C9F0DC";
const GR_TAGG = "#9BE07A";

const hjartSvans = (d, tx, ty) =>
  anim("hwd-svans", limb(d, GR_PALS, 6) +
    `<path transform="translate(${tx} ${ty})" d="M0 3 Q-6 -2 -3 -5 Q0 -6 0 -3 Q0 -6 3 -5 Q6 -2 0 3 Z" fill="${GR_TAGG}" ${THIN}/>`);

const runtaggar = (pts) => pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${GR_TAGG}" ${THIN}/>`).join("");

function grVinge(sx, sy, s, h) {
  const d = (k) => (sx + s * k).toFixed(1);
  return anim(s < 0 ? "hwd-flax-v" : "hwd-flax-h",
    `<path d="M${sx} ${sy} Q${d(0.5)} ${sy - h} ${d(1)} ${sy - h * 0.8} Q${d(0.8)} ${sy - h * 0.2} ${d(0.9)} ${sy + h * 0.15} ` +
    `Q${d(0.6)} ${sy - h * 0.05} ${d(0.5)} ${sy + h * 0.3} Q${d(0.3)} ${sy + h * 0.1} ${sx} ${sy + h * 0.3} Z" fill="${GR_TAGG}" ${LINE}/>` +
    `<path d="M${sx} ${sy + 2} L${d(0.88)} ${sy - h * 0.7}" stroke="#6FC66F" stroke-width="1.6" stroke-linecap="round"/>`);
}

const horn = (x, y, dir, h) =>
  `<path d="M${x - 3.5} ${y} Q${x + dir * 2} ${y - h} ${x + dir * 6} ${y - h * 0.9} Q${x + dir * 3} ${y - h * 0.4} ${x + 3.5} ${y} Z" fill="${KRAM}" ${THIN}/>`;

function gruffe(stage, expr) {
  if (stage === 1) {
    // Ägglöga: sitter kvar i sitt kläckta skal.
    return golv(24) +
      anim("hwd-andas",
        horn(40, 34, -1, 9) + horn(60, 34, 1, 9) +
        runtaggar([[50, 33, 3.4]]) +
        `<circle cx="50" cy="56" r="25" fill="${GR_PALS}" ${LINE}/>` +
        ansikte(50, 54, 9.5, 6.8, expr)) +
      `<path d="M22 70 L28 64 L34 71 L41 63 L48 71 L55 63 L62 71 L69 64 L75 71 L78 70 Q80 94 50 94 Q20 94 22 70 Z" fill="${KRAM}" ${LINE}/>` +
      `<circle cx="34" cy="83" r="2.6" fill="${GR_TAGG}"/><circle cx="64" cy="80" r="2" fill="${GR_TAGG}"/><circle cx="56" cy="88" r="1.6" fill="${GR_TAGG}"/>` +
      `<ellipse cx="33" cy="70" rx="5" ry="3.6" fill="${GR_PALS}" ${THIN}/><ellipse cx="67" cy="70" rx="5" ry="3.6" fill="${GR_PALS}" ${THIN}/>`;
  }
  if (stage === 2) {
    return golv(26) +
      hjartSvans("M64 84 Q84 88 86 74", 87, 70) +
      grVinge(36, 58, -22, 22) + grVinge(64, 58, 22, 22) +
      fot(-1, 40, 90, 7, 4.4, GR_PALS) + fot(1, 60, 90, 7, 4.4, GR_PALS) +
      anim("hwd-andas",
        `<path d="M32 60 Q26 92 50 92 Q74 92 68 60 Q50 54 32 60 Z" fill="${GR_PALS}" ${LINE}/>` +
        `<ellipse cx="50" cy="78" rx="11" ry="12" fill="${GR_MAGE}"/>` +
        `<path d="M44 72 L56 72 M43 78 L57 78 M44 84 L56 84" stroke="#9FD8B9" stroke-width="1.6" stroke-linecap="round"/>` +
        horn(37, 22, -1, 10) + horn(63, 22, 1, 10) +
        runtaggar([[50, 15, 3.6], [42, 17, 2.8], [58, 17, 2.8]]) +
        `<circle cx="50" cy="38" r="22" fill="${GR_PALS}" ${LINE}/>` +
        ansikte(50, 37, 9, 6.4, expr));
  }
  // Steg 3: Månskensdraken – stora vingar, krökta horn, månsten i pannan.
  return glod(50, 50, 44, "#D9F5C9", 0.55) + golv(28) +
    hjartSvans("M66 86 Q90 90 92 72", 93, 68) +
    grVinge(34, 56, -28, 32) + grVinge(66, 56, 28, 32) +
    fot(-1, 39, 91, 8, 4.6, GR_PALS) + fot(1, 61, 91, 8, 4.6, GR_PALS) +
    anim("hwd-andas",
      `<path d="M30 58 Q22 93 50 93 Q78 93 70 58 Q50 51 30 58 Z" fill="${GR_PALS}" ${LINE}/>` +
      `<ellipse cx="50" cy="77" rx="12.5" ry="13.5" fill="${GR_MAGE}"/>` +
      `<path d="M43 70 L57 70 M42 77 L58 77 M43 84 L57 84" stroke="#9FD8B9" stroke-width="1.6" stroke-linecap="round"/>` +
      `<path d="M37 24 Q28 10 36 6 Q32 14 41 21 Z" fill="${KRAM}" ${THIN}/>` +
      `<path d="M63 24 Q72 10 64 6 Q68 14 59 21 Z" fill="${KRAM}" ${THIN}/>` +
      runtaggar([[50, 15, 4], [41, 17, 3], [59, 17, 3]]) +
      `<circle cx="50" cy="38" r="22" fill="${GR_PALS}" ${LINE}/>` +
      mane(50, 24, 4, SKEN) +
      ansikte(50, 39, 9.5, 6.6, expr)) +
    glimtar([[12, 16, 3], [88, 14, 3], [90, 84, 2.4]], SKEN);
}

// --- Svartis: Kattunge → Häxkatt → Månmagikern -----------------------------

const SV_PALS = "#3F3A52";
const SV_LJUS = "#5A5470";
const SV_INRE = "#F5C1CB";

function svOron(cx, cy, r) {
  const ora = (dir) => {
    const x = cx + dir * r * 0.62;
    return `<path d="M${x - dir * r * 0.3} ${cy - r * 0.55} L${x + dir * r * 0.12} ${cy - r * 1.32} L${x + dir * r * 0.5} ${cy - r * 0.42} Z" fill="${SV_PALS}" ${LINE}/>` +
      `<path d="M${x - dir * r * 0.12} ${cy - r * 0.6} L${x + dir * r * 0.12} ${cy - r * 1.1} L${x + dir * r * 0.34} ${cy - r * 0.55} Z" fill="${SV_INRE}"/>`;
  };
  return ora(-1) + ora(1);
}

const morrhar = (cx, cy) =>
  `<path d="M${cx - 12} ${cy} L${cx - 24} ${cy - 3} M${cx - 12} ${cy + 3} L${cx - 24} ${cy + 4} ` +
  `M${cx + 12} ${cy} L${cx + 24} ${cy - 3} M${cx + 12} ${cy + 3} L${cx + 24} ${cy + 4}" stroke="${SV_LJUS}" stroke-width="1.4" stroke-linecap="round"/>`;

const svNos = (cx, cy) => `<path d="M${cx - 2} ${cy} L${cx + 2} ${cy} L${cx} ${cy + 2} Z" fill="${SV_INRE}"/>`;

function haxhatt(cx, by, s, stjarnor = false) {
  return `<g transform="translate(${cx} ${by}) scale(${s}) rotate(-8)">` +
    `<path d="M-12 0 Q-6 -10 -3 -22 Q0 -30 7 -27 Q3 -20 9 0 Z" fill="${LILA_MORK}" ${LINE}/>` +
    `<path d="M-10.5 -4 Q-1 -7 8.5 -4 L9 0 Q-1 -3 -11.5 0 Z" fill="${GRON}" stroke="none"/>` +
    `<ellipse cx="-1" cy="0" rx="18" ry="4" fill="${LILA_MORK}" ${LINE}/>` +
    (stjarnor ? stjarnaK(-1, -13, 0.6) + mane(3, -20, 2.5, GUL) : `<rect x="-3.5" y="-6.5" width="5" height="4.5" rx="1" fill="${GUL}" stroke="${O}" stroke-width="1"/>`) +
    `</g>`;
}

function svartis(stage, expr) {
  const o = { iris: GUL, linje: SKEN };
  if (stage === 1) {
    return golv(20) +
      anim("hwd-svans", limb("M64 82 Q82 84 80 70 Q79 64 74 66", SV_PALS, 5)) +
      anim("hwd-andas",
        `<ellipse cx="50" cy="80" rx="20" ry="13" fill="${SV_PALS}" ${LINE}/>` +
        `<ellipse cx="41" cy="91" rx="5" ry="3" fill="${SV_PALS}" ${THIN}/><ellipse cx="59" cy="91" rx="5" ry="3" fill="${SV_PALS}" ${THIN}/>` +
        svOron(50, 52, 25) +
        `<circle cx="50" cy="52" r="25" fill="${SV_PALS}" ${LINE}/>` +
        morrhar(50, 60) + svNos(50, 58) +
        ansikte(50, 50, 10, 7, expr, o));
  }
  if (stage === 2) {
    return golv(24) +
      anim("hwd-svans", limb("M66 84 Q88 84 86 64 Q85 56 79 58", SV_PALS, 6)) +
      fot(-1, 40, 90, 7, 4.2, SV_PALS) + fot(1, 60, 90, 7, 4.2, SV_PALS) +
      anim("hwd-andas",
        `<path d="M32 60 Q26 92 50 92 Q74 92 68 60 Q50 54 32 60 Z" fill="${SV_PALS}" ${LINE}/>` +
        `<ellipse cx="50" cy="76" rx="9" ry="11" fill="${SV_LJUS}"/>` +
        svOron(50, 42, 22) +
        `<circle cx="50" cy="42" r="22" fill="${SV_PALS}" ${LINE}/>` +
        morrhar(50, 50) + svNos(50, 48) +
        ansikte(50, 41, 9, 6.4, expr, o) +
        haxhatt(46, 26, 0.78));
  }
  // Steg 3: Månmagikern – stjärnmantel, stor hatt med måne, trollstav.
  return glod(50, 50, 44, "#D7C8F2", 0.55) + golv(28) +
    anim("hwd-svans", limb("M68 84 Q92 84 90 62 Q89 54 83 56", SV_PALS, 6)) +
    `<path d="M30 58 Q16 80 22 94 L78 94 Q84 80 70 58 Z" fill="${LILA_MORK}" ${LINE}/>` +
    stjarnaK(28, 82, 0.7, SKEN) + stjarnaK(72, 78, 0.8, SKEN) + stjarnaK(24, 68, 0.5, SKEN) +
    fot(-1, 40, 91, 7, 4.2, SV_PALS) + fot(1, 60, 91, 7, 4.2, SV_PALS) +
    anim("hwd-andas",
      `<path d="M33 62 Q27 92 50 92 Q73 92 67 62 Q50 56 33 62 Z" fill="${SV_PALS}" ${LINE}/>` +
      `<ellipse cx="50" cy="78" rx="9" ry="10" fill="${SV_LJUS}"/>` +
      `<path d="M36 61 Q50 69 64 61" fill="none" stroke="${GUL}" stroke-width="3" stroke-linecap="round"/>` +
      svOron(50, 46, 21) +
      `<circle cx="50" cy="46" r="21" fill="${SV_PALS}" ${LINE}/>` +
      morrhar(50, 54) + svNos(50, 52) +
      ansikte(50, 45, 9, 6.4, expr, o) +
      haxhatt(46, 30, 0.95, true)) +
    anim("hwd-flax-h", limb("M66 66 Q78 62 82 52", SV_PALS, 5) +
      limb("M82 54 L88 36", "#8A6242", 2.4) + stjarnaK(89, 33, 1.1)) +
    glimtar([[12, 20, 3], [92, 22, 2.6], [10, 60, 2.2]], SKEN);
}

/** id → (stage, expr) => SVG-innehåll. */
export const HW_DJUR_A = { spokis, pumpis, fladdis, gruffe, svartis };

