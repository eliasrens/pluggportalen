// ============================================================================
// Pluggporten – Jul-konstens delade byggdelar (#910, epic #906)
// ----------------------------------------------------------------------------
// Samma stil som Halloween-varorna (#692): runda former, mörk kontur (O, LINE,
// THIN ur art-style.js) och varma ljus. Det som lyser har EN mjuk glöd per sak
// – den delade anim("hw-glod") ur Halloween-konsten (samma klass och keyframes
// i 33-halloween.css, av vid prefers-reduced-motion), inga egna animationer
// per sak. Lågorna är stilla.
// Laddas bara via import() (#271) – aldrig i den statiska bootgrafen.
// ============================================================================

import { O, LINE, THIN, limb, skugga, anim, oga, glitter } from "../halloween/hw-art-delar.js";

export const JULROD = "#D94F4F";
export const JULROD_MORK = "#B23A3F";
export const GRAN = "#3F8C6B";
export const GRAN_MORK = "#2F6B55";
export const GRAN_LJUS = "#58A77F";
export const GULD = "#F7C948";
export const GULD_MORK = "#D9A72E";
export const SKEN = "#FDE9A8";
export const KRAM = "#FFF3DC";
export const PEPPAR = "#C77D45";
export const PEPPAR_MORK = "#9E5B2C";
export const HALM = "#E8C25A";
export const HALM_MORK = "#C99A33";
export const SNOVIT = "#EEF3F8";
export const SNOSKUGGA = "#C9D7E6";
export const IS = "#BFE3F2";
export const IS_MORK = "#8CC3DD";
export const HUD = "#F6D2B8";
export const WOOD = "#B0805A";
export const WOOD_DARK = "#8A6242";

/** Den delade mjuka glöden (samma som Halloween-svamparna). */
export const glod = (inner) => anim("hw-glod", inner);

/** Femuddig stjärna i (cx,cy) med yttre radie r. */
export function stjarna5(cx, cy, r, fill, inre = 0.46) {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const v = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * inre : r;
    d += `${i ? "L" : "M"}${(cx + rr * Math.cos(v)).toFixed(1)} ${(cy + rr * Math.sin(v)).toFixed(1)} `;
  }
  return `<path d="${d}Z" fill="${fill}" ${THIN}/>`;
}

/** Stearinljus med stilla låga, ljusets botten i (x,y), höjd h. */
export function ljus(x, y, h, farg = KRAM) {
  return (
    `<rect x="${x - 4}" y="${y - h}" width="8" height="${h}" rx="2" fill="${farg}" ${THIN}/>` +
    `<path d="M${x} ${y - h - 12} Q${x + 5} ${y - h - 5} ${x + 3} ${y - h - 2} Q${x} ${y - h + 1} ${x - 3} ${y - h - 2} ` +
    `Q${x - 5} ${y - h - 5} ${x} ${y - h - 12} Z" fill="${GULD}" ${THIN}/>` +
    `<ellipse cx="${x}" cy="${y - h - 4}" rx="1.6" ry="2.6" fill="#fff" opacity="0.9"/>`
  );
}

/** Julgranskula med upphängning och glans. */
export function kula(cx, cy, r, c) {
  return (
    `<rect x="${cx - r * 0.35}" y="${cy - r - 2.5}" width="${r * 0.7}" height="3" rx="1" fill="${GULD}" ${THIN}/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" ${THIN}/>` +
    `<circle cx="${(cx - r * 0.35).toFixed(1)}" cy="${(cy - r * 0.35).toFixed(1)}" r="${(r * 0.3).toFixed(1)}" fill="#fff" opacity="0.75"/>`
  );
}

/**
 * Julgran i våningar: spetsen i (cx, topp), nedersta våningens botten i y
 * `botten`, halvbredd hw. Våningarna överlappar, mörkast längst bak.
 */
export function gran(cx, topp, botten, hw, vaningar = 3) {
  const h = (botten - topp) / vaningar;
  let s = "";
  for (let i = 0; i < vaningar; i++) {
    const y0 = topp + i * h * 0.78;
    const y1 = topp + (i + 1) * h + (i === vaningar - 1 ? 0 : h * 0.12);
    const b = hw * (0.5 + (0.5 * (i + 1)) / vaningar);
    s += `<path d="M${cx} ${y0.toFixed(1)} L${(cx + b).toFixed(1)} ${y1.toFixed(1)} Q${cx} ${(y1 + h * 0.2).toFixed(1)} ` +
      `${(cx - b).toFixed(1)} ${y1.toFixed(1)} Z" fill="${i % 2 ? GRAN_LJUS : GRAN}" ${LINE}/>`;
  }
  return s;
}

/**
 * Halmbock (julbock) som tittar åt höger, fötterna i (x,y), skala s
 * (s=1 ≈ 46 bred, 54 hög). Röda band runt kropp och hals.
 */
export function bock(x, y, s = 1) {
  return (
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    limb("M-12 -14 L-13 0 M-5 -14 L-5 0 M6 -14 L6 0 M13 -14 L14 0", HALM, 3.2) +
    `<path d="M-16 -20 Q-24 -24 -22 -32" fill="none" stroke="${HALM_MORK}" stroke-width="3" stroke-linecap="round"/>` +
    `<rect x="-17" y="-28" width="34" height="15" rx="7" fill="${HALM}" ${LINE}/>` +
    `<path d="M-12 -24 L10 -24 M-12 -19 L12 -19" stroke="${HALM_MORK}" stroke-width="1.4" opacity="0.8"/>` +
    `<rect x="-9" y="-28.5" width="4" height="16" fill="${JULROD}" ${THIN}/>` +
    `<rect x="5" y="-28.5" width="4" height="16" fill="${JULROD}" ${THIN}/>` +
    limb("M12 -24 L18 -36", HALM, 5) +
    `<path d="M17 -40 Q12 -52 4 -47 M21 -41 Q22 -54 13 -52" fill="none" stroke="${HALM_MORK}" stroke-width="3" stroke-linecap="round"/>` +
    `<ellipse cx="22" cy="-38" rx="8" ry="5.5" fill="${HALM}" ${LINE}/>` +
    `<path d="M14 -32 Q18 -28 22 -32" fill="none" stroke="${JULROD}" stroke-width="3" stroke-linecap="round"/>` +
    oga(23, -39, 1.4) +
    `</g>`
  );
}

/** Liten tomte (sittande, rund) – fötterna/botten i (x,y), skala s (s=1 ≈ 34 hög). */
export function tomte(x, y, s = 1) {
  return (
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    `<path d="M-14 0 Q-16 -18 0 -22 Q16 -18 14 0 Z" fill="${JULROD}" ${LINE}/>` +
    `<path d="M-14 -2 Q0 2 14 -2" fill="none" stroke="${SNOVIT}" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="0" cy="-27" r="9" fill="${HUD}" ${THIN}/>` +
    `<path d="M-9 -27 Q-10 -12 0 -11 Q10 -12 9 -27 Q5 -22 0 -23 Q-5 -22 -9 -27 Z" fill="#fff" ${THIN}/>` +
    `<circle cx="0" cy="-25" r="2.2" fill="#F2A08F" ${THIN}/>` +
    oga(-3.6, -29, 1.3) + oga(3.6, -29, 1.3) +
    `<path d="M-11 -31 Q-4 -50 15 -45 Q8 -41 11 -31 Z" fill="${JULROD}" ${THIN}/>` +
    `<rect x="-12" y="-34" width="24" height="5" rx="2.5" fill="#fff" ${THIN}/>` +
    `<circle cx="15" cy="-45" r="3" fill="#fff" ${THIN}/>` +
    `</g>`
  );
}

/** Julklapp (paket med rosett), nederkant i y, vänster x. */
export function paket(x, y, w, h, c, band = GULD) {
  const m = x + w / 2;
  return (
    `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" rx="2" fill="${c}" ${THIN}/>` +
    `<path d="M${m} ${y - h} L${m} ${y}" stroke="${band}" stroke-width="3"/>` +
    `<path d="M${m} ${y - h} Q${m - 7} ${y - h - 7} ${m - 5} ${y - h - 1} Z M${m} ${y - h} Q${m + 7} ${y - h - 7} ${m + 5} ${y - h - 1} Z" fill="${band}" ${THIN}/>`
  );
}

export { O, LINE, THIN, limb, skugga, oga, glitter };
