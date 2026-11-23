// ============================================================================
// Pluggporten – Jul-djurens delade byggdelar (#912, epic #906)
// ----------------------------------------------------------------------------
// Djuren delar uttryckssystemet med Halloween-djuren (ansikte, golv, glöd,
// glimtar, fötter och animationsklasserna .hwd-* / .hw-glod / .hw-glimt i
// 33-halloween.css, av vid prefers-reduced-motion) – här bara julsakerna som
// steg 3 bär: tomteluva, halsduk, stjärna och bjällra (i <g class="jd-julsak">).
// Ritas i viewBox 0 0 100 100 med golvet vid y≈95, som övriga husdjur.
// Laddas bara via import() (#271).
// ============================================================================

import { O, LINE, THIN, limb, anim, glitter, golv, ansikte, glod, glimtar, fot } from "../halloween/hw-djur-delar.js";
import { JULROD, JULROD_MORK, GULD, GULD_MORK, KRAM, SNOVIT, SNOSKUGGA, stjarna5 } from "./jul-art-delar.js";

export { O, LINE, THIN, limb, anim, glitter, golv, ansikte, glod, glimtar, fot, stjarna5 };

/** Isblå glimt för vita djur (vita glimtar syns inte mot snön). */
export const ISGLIMT = "#8CC3DD";

const julsak = (inner) => `<g class="jd-julsak">${inner}</g>`;

/** Tomteluva: brättets mitt i (cx,y), bredd ≈ 26·s, tippen böjd åt höger. */
export function tomteluva(cx, y, s = 1, rot = -10) {
  return julsak(`<g transform="translate(${cx} ${y}) rotate(${rot}) scale(${s})">` +
    `<path d="M-12 0 Q-10 -16 2 -22 Q12 -26 18 -18 Q10 -16 12 0 Z" fill="${JULROD}" ${LINE}/>` +
    `<path d="M-2 -16 Q4 -20 10 -19" fill="none" stroke="${JULROD_MORK}" stroke-width="2" stroke-linecap="round"/>` +
    `<rect x="-14.5" y="-4" width="29" height="8" rx="4" fill="${SNOVIT}" ${THIN}/>` +
    `<circle cx="18.5" cy="-18" r="4.2" fill="${SNOVIT}" ${THIN}/></g>`);
}

/** Halsduk runt halsen: mitt (cx,y), halvbredd w, med en hängande snibb. */
export function halsduk(cx, y, w, c = JULROD, rand = KRAM) {
  const x0 = cx - w;
  const x1 = cx + w;
  return julsak(
    `<path d="M${x0} ${y - 2} Q${cx} ${y + 5} ${x1} ${y - 2} L${x1} ${y + 4} Q${cx} ${y + 11} ${x0} ${y + 4} Z" fill="${c}" ${THIN}/>` +
    `<path d="M${cx + w * 0.35} ${y + 5} L${cx + w * 0.3} ${y + 19} L${cx + w * 0.62} ${y + 18} L${cx + w * 0.62} ${y + 3} Z" fill="${c}" ${THIN}/>` +
    `<path d="M${cx + w * 0.32} ${y + 14} L${cx + w * 0.62} ${y + 13.5}" stroke="${rand}" stroke-width="2"/>` +
    `<path d="M${cx - w * 0.5} ${y + 2.5} L${cx - w * 0.5} ${y + 8} M${cx} ${y + 3.5} L${cx} ${y + 9}" stroke="${rand}" stroke-width="2"/>`);
}

/** Guldstjärna med kontur (julgransstjärnan), mitt (cx,cy), radie r. */
export const julstjarna = (cx, cy, r) => julsak(stjarna5(cx, cy, r, GULD, 0.5) +
  `<circle cx="${cx - r * 0.18}" cy="${cy - r * 0.2}" r="${(r * 0.16).toFixed(1)}" fill="#fff" opacity="0.8"/>`);

/** Liten bjällra (hänger i ett band), mitt (cx,cy), radie r. */
export const bjallra = (cx, cy, r) => julsak(
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${GULD}" ${THIN}/>` +
  `<path d="M${cx - r * 0.6} ${cy + r * 0.2} L${cx + r * 0.6} ${cy + r * 0.2}" stroke="${GULD_MORK}" stroke-width="1.6" stroke-linecap="round"/>` +
  `<circle cx="${cx}" cy="${cy + r * 0.5}" r="${(r * 0.22).toFixed(1)}" fill="${O}"/>`);

/** Rundad snöboll med skugga och glans. */
export const snoboll = (cx, cy, r) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${SNOVIT}" ${LINE}/>` +
  `<path d="M${cx - r * 0.75} ${cy + r * 0.35} Q${cx} ${cy + r * 1.05} ${cx + r * 0.75} ${cy + r * 0.35}" fill="none" stroke="${SNOSKUGGA}" stroke-width="${(r * 0.16).toFixed(1)}" stroke-linecap="round"/>` +
  `<ellipse cx="${cx - r * 0.38}" cy="${cy - r * 0.45}" rx="${(r * 0.2).toFixed(1)}" ry="${(r * 0.12).toFixed(1)}" fill="#fff"/>`;
