// ============================================================================
// Pluggporten – Klasscentret: gemensamma mått + byggdelar (#478)
// ----------------------------------------------------------------------------
// Delas av art-klasscenter-tidig.js (nivå 1–4), -mitt.js (5–7) och -sen.js
// (8–10). Ligger i en EGEN modul (inte i index-modulen art-klasscenter.js) så
// nivå-modulerna kan importera den utan importcykel.
//
// KOORDINATSYSTEM (alla 10 nivåer): viewBox "0 0 1250 800", byggnaden centrerad
// kring x=625 och står ALLTID på marklinjen y=752 (48 enheter ovanför botten,
// exakt som husMini där marken y≈512 sitter 48 över viewBox-botten 560). Raka
// byggnadsbottnar slutar på y=752 – ingen "flygande" byggnad (#376).
//
// Stil = husen i byn (art-hus-ute.js / art-style.js): platt vektor, kontur
// #3B3350 (LINE 3 / THIN 2.2), samma trä-färger. Inga gradienter/defs (id-
// krockar när flera klasscenter ritas på samma sida + platt stil).
// ============================================================================

import { O, LINE, THIN, limb, shadow } from "./art-style.js";

export { O, LINE, THIN, limb, shadow };

/** Marklinjen (y) som alla nivåer står på. */
export const G = 752;
/** Byggnadens mittlinje (x). */
export const CX = 625;

// Trä (samma som art-hus-ute.js) + sten/tegel/metall/kristall.
export const WOOD = "#B0805A";
export const WOOD_DARK = "#8A6242";
export const WOOD_LIGHT = "#E0B98C";
export const STONE = "#C9C2CF";
export const STONE_LIGHT = "#E3DEE6";
export const STONE_DARK = "#A39BAD";
export const TEGEL = "#E07A5F";
export const TEGEL_DARK = "#C4614A";
export const GLAS = "#9AD3F0";
export const GLAS_LJUS = "#D6EEFA";
export const STAL = "#A8BAD1";
export const STAL_DARK = "#7D8FA8";
export const GULD = "#F7C948";
export const KRAM = "#FFF3DC";
/** Klassens fana – färgbar per klass via CSS-variabeln --kc-fana. */
export const FANA = "var(--kc-fana, #EF6F6C)";

/**
 * Klassnamn för ambient-animation, eller "" när opts.animera === false.
 * ALL rörelse går via CSS-klasser (styles.css, "Klasscentret ambient") som
 * kompositorn kan pausa – aldrig SMIL eller per-barn-animation (#374).
 */
export const anim = (opts, cls) => (opts && opts.animera === false ? "" : ` class="${cls}"`);

/** Tre rökpuffar (samma .hus-rok-klasser som husens skorstenar). */
export function rok(x, y, opts) {
  if (opts && opts.animera === false) return "";
  return `<g class="hus-rok"><circle cx="${x}" cy="${y}" r="14" fill="#fff" opacity="0.85"/></g>
      <g class="hus-rok r2"><circle cx="${x}" cy="${y}" r="10" fill="#fff" opacity="0.85"/></g>
      <g class="hus-rok r3"><circle cx="${x}" cy="${y}" r="12" fill="#fff" opacity="0.85"/></g>`;
}

/** Tinnar centrerade över väggsegmentet [x, x+w] med överkant y (överlappar väggen). */
export function tinnar(x, w, y, fill = STONE, step = 30, tw = 18) {
  const gap = step - tw;
  const n = Math.max(2, Math.floor((w + gap) / step));
  const span = n * tw + (n - 1) * gap;
  const start = x + (w - span) / 2;
  let s = "";
  for (let i = 0; i < n; i++)
    s += `<rect x="${(start + i * step).toFixed(1)}" y="${y - 18}" width="${tw}" height="24" fill="${fill}" ${LINE}/>`;
  return s;
}

/** Rundbågigt fönster med spröjs, centrerat på cx. */
export function bagfonster(cx, top, w, h, fill = GLAS) {
  return `<rect x="${cx - w / 2}" y="${top}" width="${w}" height="${h}" rx="${(w / 2).toFixed(1)}" fill="${fill}" ${LINE}/>
      <path d="M${cx} ${top + 6} L${cx} ${top + h - 4} M${cx - w / 2 + 4} ${(top + h * 0.45).toFixed(1)} L${cx + w / 2 - 4} ${(top + h * 0.45).toFixed(1)}" stroke="${O}" stroke-width="3" stroke-linecap="round"/>`;
}

/** Fyrkantigt fönster med korspost (stugstil). */
export function fonster(x, y, w, h, fill = GLAS) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}" ${LINE}/>
      <path d="M${x + w / 2} ${y + 4} L${x + w / 2} ${y + h - 4} M${x + 4} ${y + h / 2} L${x + w - 4} ${y + h / 2}" stroke="${O}" stroke-width="3.5" stroke-linecap="round"/>`;
}

/** Rundbågig dörr/port ner till marken (eller till bas), centrerad på cx. */
export function port(cx, w, h, fill = WOOD, karm = WOOD_DARK, bas = G) {
  const r = w / 2;
  const top = bas - h;
  return `<path d="M${cx - r - 8} ${bas} L${cx - r - 8} ${top + r} Q${cx - r - 8} ${top - 8} ${cx} ${top - 8} Q${cx + r + 8} ${top - 8} ${cx + r + 8} ${top + r} L${cx + r + 8} ${bas} Z" fill="${karm}" ${LINE}/>
      <path d="M${cx - r} ${bas} L${cx - r} ${top + r} Q${cx - r} ${top} ${cx} ${top} Q${cx + r} ${top} ${cx + r} ${top + r} L${cx + r} ${bas} Z" fill="${fill}" ${LINE}/>
      <path d="M${cx} ${top + 2} L${cx} ${bas - 2}" stroke="${O}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${cx + r * 0.55}" cy="${(bas - h * 0.42).toFixed(1)}" r="5" fill="${GULD}" ${THIN}/>`;
}

/**
 * Fana på stång: stångfot (x, yFot), duken pekar åt höger. Duken vajar via
 * CSS-klassen .kc-fana (transform på EN grupp – kompositerbar, pausbar).
 */
export function fana(x, yFot, hojd, opts, farg = FANA) {
  const top = yFot - hojd;
  return `${limb(`M${x} ${yFot} L${x} ${top}`, WOOD_DARK, 4)}
      <circle cx="${x}" cy="${top - 4}" r="6" fill="${GULD}" ${THIN}/>
      <g${anim(opts, "kc-fana")}><path d="M${x + 2} ${top + 4} Q${x + 30} ${top - 4} ${x + 58} ${top + 6} L${x + 52} ${top + 22} L${x + 60} ${top + 38} Q${x + 30} ${top + 30} ${x + 2} ${top + 40} Z" fill="${farg}" ${LINE}/>
      <circle cx="${x + 26}" cy="${top + 21}" r="7" fill="${KRAM}" ${THIN}/></g>`;
}

/** Fyruddig gnistra (glitter). */
export function gnistra(cx, cy, r, fill = "#FFFFFF") {
  const k = r * 0.28;
  return `<path d="M${cx} ${cy - r} Q${cx + k} ${cy - k} ${cx + r} ${cy} Q${cx + k} ${cy + k} ${cx} ${cy + r} Q${cx - k} ${cy + k} ${cx - r} ${cy} Q${cx - k} ${cy - k} ${cx} ${cy - r} Z" fill="${fill}" ${THIN}/>`;
}
