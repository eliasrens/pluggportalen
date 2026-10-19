// ============================================================================
// Schackpokalen "Damens besegrare" (#798), kodritad: en guldbägare med två
// handtag på träsockel, och ur bägaren reser sig en svart schackdam med krona.
// Samma stil och mått som Kartmästare-pokalen (hr-pokal-art.js): art-style.js
// (platt, kontur O, inga gradienter/defs/id), viewBox 100 × 140 som står på
// y≈134, glittret återanvänder .kc-glitter. Laddas bara DYNAMISKT (huset,
// kompisens hus, slutrutan mot Damen) – aldrig i bootgrafen (#271).
//
//   schackPokalSvg({ aria?, animera?, klass? }) → fristående <svg>
// ============================================================================

import { O, LINE, THIN, shadow } from "../art-style.js";

export const POKAL_VB = "0 0 100 140";

const GULD = "#F7C948";
const GULD_MORK = "#E0A82E";
const GULD_LJUS = "#FFE7A0";
const WOOD = "#B0805A";
const WOOD_DARK = "#8A6242";
const DAM = "#46557A";
const DAM_LJUS = "#6A7AA3";
const BAND = "#B79BE0";

/** Inre markup (utan <svg>-ram). */
export function schackPokalMarkup(opts = {}) {
  const glitter = opts.animera === false ? "" : ` class="kc-glitter"`;
  return (
    shadow(50, 134, 32) +
    // Träsockel + mässingsskylt.
    `<rect x="24" y="114" width="52" height="20" rx="3" fill="${WOOD_DARK}" ${LINE}/>` +
    `<rect x="28" y="107" width="44" height="9" rx="3" fill="${WOOD}" ${LINE}/>` +
    `<rect x="36" y="119" width="28" height="9" rx="2" fill="${GULD}" ${THIN}/>` +
    `<path d="M40 122.4 L60 122.4 M43 125.2 L57 125.2" stroke="${GULD_MORK}" stroke-width="1.3" stroke-linecap="round"/>` +
    // Fot + skaft + rosett.
    `<path d="M38 107 L62 107 L56 98 L44 98 Z" fill="${GULD_MORK}" ${THIN}/>` +
    `<rect x="46" y="86" width="8" height="13" fill="${GULD}" ${THIN}/>` +
    `<path d="M48 92 L41 106 L45.5 103.5 L47.5 108 L51 95 Z" fill="${BAND}" ${THIN}/>` +
    `<path d="M52 92 L59 106 L54.5 103.5 L52.5 108 L49 95 Z" fill="${BAND}" ${THIN}/>` +
    `<circle cx="50" cy="92" r="3.6" fill="${BAND}" ${THIN}/>` +
    // Schackdamen (bakom bägarens kant): kropp, krage, huvud och krona med kulor.
    `<path d="M38 60 Q40 44 44 36 L56 36 Q60 44 62 60 Z" fill="${DAM}" ${LINE}/>` +
    `<path d="M41 36 L59 36 L57 31 L43 31 Z" fill="${DAM_LJUS}" ${THIN}/>` +
    `<circle cx="50" cy="25" r="6.5" fill="${DAM}" ${LINE}/>` +
    `<path d="M40 19 L43 11 L46.5 17 L50 8 L53.5 17 L57 11 L60 19 Z" fill="${GULD}" ${THIN}/>` +
    `<circle cx="43" cy="10" r="2.2" fill="${GULD_LJUS}" ${THIN}/><circle cx="50" cy="6.5" r="2.4" fill="${GULD_LJUS}" ${THIN}/>` +
    `<circle cx="57" cy="10" r="2.2" fill="${GULD_LJUS}" ${THIN}/>` +
    `<path d="M45 42 Q44 50 43 57" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity="0.5"/>` +
    // Bägaren med handtag.
    `<path d="M27 52 Q14 52 15 64 Q16 75 32 76" fill="none" stroke="${O}" stroke-width="7.4" stroke-linecap="round"/>` +
    `<path d="M27 52 Q14 52 15 64 Q16 75 32 76" fill="none" stroke="${GULD}" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M73 52 Q86 52 85 64 Q84 75 68 76" fill="none" stroke="${O}" stroke-width="7.4" stroke-linecap="round"/>` +
    `<path d="M73 52 Q86 52 85 64 Q84 75 68 76" fill="none" stroke="${GULD}" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M24 50 L76 50 Q76 80 56 86 L44 86 Q24 80 24 50 Z" fill="${GULD}" ${LINE}/>` +
    `<rect x="22" y="47" width="56" height="7" rx="3" fill="${GULD_MORK}" ${THIN}/>` +
    `<path d="M31 58 Q32 72 42 80" fill="none" stroke="${GULD_LJUS}" stroke-width="3" stroke-linecap="round"/>` +
    // Litet schackrutmönster på bägaren.
    `<rect x="44" y="60" width="12" height="12" fill="${GULD_LJUS}" ${THIN}/>` +
    `<rect x="44" y="60" width="6" height="6" fill="${O}"/><rect x="50" y="66" width="6" height="6" fill="${O}"/>` +
    `<g${glitter}><path d="M86 22 L87.6 26.4 L92 28 L87.6 29.6 L86 34 L84.4 29.6 L80 28 L84.4 26.4 Z" fill="${GULD_LJUS}" ${THIN}/></g>`
  );
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Fristående <svg>.
 * @param {{ aria?: string, animera?: boolean, klass?: string }} [opts] aria utelämnad → aria-hidden
 */
export function schackPokalSvg(opts = {}) {
  const a11y = opts.aria ? `role="img" aria-label="${esc(opts.aria)}"` : `aria-hidden="true" focusable="false"`;
  return (
    `<svg class="hr-pokal-svg schack-pokal-svg${opts.klass ? ` ${esc(opts.klass)}` : ""}" viewBox="${POKAL_VB}" ${a11y} ` +
    `preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${schackPokalMarkup(opts)}</svg>`
  );
}
