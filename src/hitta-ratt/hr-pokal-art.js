// ============================================================================
// Hitta rätt! – Kartmästare-pokalen, kodritad (src/hitta-ratt/hr-pokal-art.js) · #610
// ----------------------------------------------------------------------------
// En jordglobspokal på träsockel: guldring runt globen, stjärna överst,
// rosett på skaftet och mässingsskylt. Varje pack får en EGEN pokal:
//   • globens motiv följer packens kategori (Sverige, Europa, världen,
//     kända platser),
//   • markören följer typen (punkt = röd kartnål, område = markerat fält),
//   • rosettens färg väljs stabilt ur packId.
// Glittret återanvänder .kc-glitter (styles.css, pausas vid zoom/reduced motion).
// Stil = art-style.js (platt, kontur O, inga gradienter/defs/id – flera
// pokaler på samma sida får inte krocka). Samma viewBox som Klasscentrets
// pokaler (100 × 140, står på y≈134) men visas något mindre (POKAL_W).
// Laddas bara DYNAMISKT (rummet/kompisens rum), aldrig i bootgrafen (#271).
// ============================================================================

import { O, LINE, THIN, shadow } from "../art-style.js";

export const POKAL_VB = "0 0 100 140";
/** Bredd i rums-enheter. Klasscentrets pokaler är ≈ 3,17 – den här är något mindre. */
export const POKAL_W = 2.85;
/** { w, h } i rums-enheter (rumSakHtml). */
export const POKAL_STORLEK = Object.freeze({ w: POKAL_W, h: +((POKAL_W * 140) / 100).toFixed(2) });

const GULD = "#F7C948";
const GULD_MORK = "#E0A82E";
const GULD_LJUS = "#FFE7A0";
const HAV = "#7FC7E8";
const HAV_MORK = "#5AA9CF";
const LAND = "#6FC66F";
const LAND_MORK = "#4FA65A";
const KRAM = "#FFF3DC";
const WOOD = "#B0805A";
const WOOD_DARK = "#8A6242";
const ROD = "#EF6F6C";

/** Rosettfärger – packens färg väljs stabilt ur id:t. */
const BAND = ["#EF6F6C", "#B79BE0", "#58C6A9", "#F49E4C", "#F890B7", "#46557A", "#7FC7E8"];

/** Stabil hash (djb2) → index i BAND. */
export function bandFarg(packId) {
  let h = 5381;
  for (const c of String(packId || "")) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  return BAND[h % BAND.length];
}

/** Globens motiv ur packId-prefixet (officiella pack: sverige-/europa-/varlden-, *-kanda-platser). */
export function motivFor(packId) {
  const id = String(packId || "");
  if (id.includes("kanda-platser")) return "platser";
  if (id.startsWith("sverige")) return "sverige";
  if (id.startsWith("europa")) return "europa";
  return "varlden";
}

// Landmassor på globen (cx 50, cy 50, r 26), klippta för hand inom cirkeln.
const MOTIV = {
  // Skandinaviska halvön: lång smal Sverige-form i mitten.
  sverige:
    `<path d="M54 27 Q60 28 59 34 Q57 40 58 46 Q60 54 55 62 Q52 70 47 72 Q44 70 46 64 Q44 58 47 52 Q46 44 49 38 Q49 30 54 27 Z" fill="${LAND}" ${THIN}/>` +
    `<path d="M47 30 Q42 34 40 42 Q38 48 41 52 Q44 44 46 38 Z" fill="${LAND_MORK}" ${THIN}/>` +
    `<path d="M63 40 Q66 42 65 46 Q63 47 62 44 Z" fill="${LAND}" ${THIN}/>`,
  // Europa: kontinent med Iberiska halvön och Italiens stövel.
  europa:
    `<path d="M30 40 Q36 32 46 34 Q52 28 60 30 Q70 32 72 42 Q70 48 64 48 Q60 54 62 60 Q57 58 56 52 Q50 50 46 54 Q40 56 36 52 Q30 54 28 48 Z" fill="${LAND}" ${THIN}/>` +
    `<path d="M52 52 Q55 58 58 64 Q56 66 54 62 Q51 58 52 52 Z" fill="${LAND}" ${THIN}/>` +
    `<path d="M44 30 Q46 24 50 26 Q49 31 44 30 Z" fill="${LAND_MORK}" ${THIN}/>`,
  // Världen: två kontinenter + meridianer.
  varlden:
    `<path d="M28 38 Q34 30 42 34 Q44 42 38 46 Q40 54 36 62 Q30 58 30 50 Q26 44 28 38 Z" fill="${LAND}" ${THIN}/>` +
    `<path d="M52 32 Q62 28 70 36 Q74 44 68 48 Q64 46 60 50 Q62 58 58 66 Q52 62 54 54 Q50 48 52 40 Z" fill="${LAND}" ${THIN}/>` +
    `<path d="M50 24 Q40 50 50 76 M50 24 Q60 50 50 76" fill="none" stroke="${HAV_MORK}" stroke-width="1.4"/>`,
  // Kända platser: världen + ett litet torn (landmärke) på kontinenten.
  platser:
    `<path d="M28 40 Q36 30 46 34 Q48 44 42 50 Q42 58 36 62 Q30 56 30 50 Q26 46 28 40 Z" fill="${LAND}" ${THIN}/>` +
    `<path d="M54 34 Q64 30 72 40 Q72 50 64 52 Q60 60 56 66 Q52 58 54 50 Q50 42 54 34 Z" fill="${LAND}" ${THIN}/>` +
    `<path d="M60 52 L63 36 L66 52 Z M61 46 L65 46" fill="${KRAM}" ${THIN}/>`,
};

// Markören på globen: kartnål (punktpack) eller markerat område (områdespack).
function markor(typ, motiv) {
  if (typ === "area") {
    const [x, y] = motiv === "sverige" ? [52, 50] : motiv === "europa" ? [42, 44] : [62, 42];
    return `<circle cx="${x}" cy="${y}" r="6.5" fill="${GULD_LJUS}" opacity="0.85" stroke="${O}" stroke-width="1.8" stroke-dasharray="3 2.2"/>`;
  }
  const [x, y] = motiv === "sverige" ? [53, 42] : motiv === "europa" ? [48, 40] : [40, 40];
  return (
    `<path d="M${x} ${y + 12} Q${x - 7} ${y + 2} ${x - 7} ${y - 3} A7 7 0 1 1 ${x + 7} ${y - 3} Q${x + 7} ${y + 2} ${x} ${y + 12} Z" fill="${ROD}" ${THIN}/>` +
    `<circle cx="${x}" cy="${y - 3}" r="2.6" fill="#FFFFFF" stroke="none"/>`
  );
}

function stjarna(cx, cy, r) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    p.push(`${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `<path d="M${p.join(" L")} Z" fill="${GULD}" ${THIN}/>`;
}

/**
 * Inre markup (utan <svg>-ram) för packens pokal.
 * @param {{ packId: string, typ?: "point"|"area" }} p
 * @param {{ animera?: boolean }} [opts] false → ingen glitter-klass
 */
export function kartmastareMarkup({ packId, typ }, opts = {}) {
  const motiv = motivFor(packId);
  const band = bandFarg(packId);
  const glitter = opts.animera === false ? "" : ` class="kc-glitter"`;
  return (
    shadow(50, 134, 32) +
    // Träsockel + mässingsskylt.
    `<rect x="24" y="114" width="52" height="20" rx="3" fill="${WOOD_DARK}" ${LINE}/>` +
    `<rect x="28" y="107" width="44" height="9" rx="3" fill="${WOOD}" ${LINE}/>` +
    `<rect x="36" y="119" width="28" height="9" rx="2" fill="${GULD}" ${THIN}/>` +
    `<path d="M40 122.4 L60 122.4 M43 125.2 L57 125.2" stroke="${GULD_MORK}" stroke-width="1.3" stroke-linecap="round"/>` +
    // Fot + skaft.
    `<path d="M38 107 L62 107 L56 98 L44 98 Z" fill="${GULD_MORK}" ${THIN}/>` +
    `<rect x="46" y="84" width="8" height="15" fill="${GULD}" ${THIN}/>` +
    // Rosett i packens färg.
    `<path d="M48 92 L41 106 L45.5 103.5 L47.5 108 L51 95 Z" fill="${band}" ${THIN}/>` +
    `<path d="M52 92 L59 106 L54.5 103.5 L52.5 108 L49 95 Z" fill="${band}" ${THIN}/>` +
    `<circle cx="50" cy="92" r="3.6" fill="${band}" ${THIN}/>` +
    // Globen (motiv + markör ritade för r 26, skalade till r 31).
    `<circle cx="50" cy="50" r="31" fill="${HAV}" ${LINE}/>` +
    `<g transform="translate(50 50) scale(1.19) translate(-50 -50)">${MOTIV[motiv]}${markor(typ, motiv)}</g>` +
    `<path d="M29 34 Q35 25 45 22" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.7"/>` +
    `<circle cx="50" cy="50" r="31" fill="none" ${LINE}/>` +
    // Meridianbåge i guld (som en skrivbordsglob) + axelknoppar.
    `<path d="M50 13 A37 37 0 0 1 50 87" fill="none" stroke="${O}" stroke-width="7.4" stroke-linecap="round"/>` +
    `<path d="M50 13 A37 37 0 0 1 50 87" fill="none" stroke="${GULD}" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M80 30 A37 37 0 0 1 84 50" fill="none" stroke="${GULD_LJUS}" stroke-width="1.6" stroke-linecap="round"/>` +
    `<circle cx="50" cy="19" r="3" fill="${GULD_MORK}" ${THIN}/>` +
    `<circle cx="50" cy="81" r="3" fill="${GULD_MORK}" ${THIN}/>` +
    // Stjärna överst.
    stjarna(50, 8.5, 8) +
    `<g${glitter}><path d="M88 18 L89.6 22.4 L94 24 L89.6 25.6 L88 30 L86.4 25.6 L82 24 L86.4 22.4 Z" fill="${GULD_LJUS}" ${THIN}/></g>`
  );
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Fristående <svg> för packens pokal.
 * @param {{ packId: string, typ?: string }} p
 * @param {{ animera?: boolean, aria?: string }} [opts] aria utelämnad → aria-hidden
 */
export function kartmastareSvg(p, opts = {}) {
  const a11y = opts.aria ? `role="img" aria-label="${esc(opts.aria)}"` : `aria-hidden="true" focusable="false"`;
  return (
    `<svg class="hr-pokal-svg" data-pack="${esc(p.packId)}" viewBox="${POKAL_VB}" ${a11y} ` +
    `preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${kartmastareMarkup(p, opts)}</svg>`
  );
}
