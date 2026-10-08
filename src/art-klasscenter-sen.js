// ============================================================================
// Pluggporten – Klasscentret nivå 8–10 (#478): slott → högkvarter → kristall
// ----------------------------------------------------------------------------
// Samma koordinater som övriga nivåer (art-klasscenter-delar.js: viewBox
// 1250×800, mitt x=625, marklinje y=G=752). Returnerar INRE markup.
// Ambient (glitter/svävande kristaller/blinkande antennljus) = få CSS-klassade
// grupper, aldrig per-element-animation i mängd (#374).
// ============================================================================

import {
  O, LINE, THIN, limb, shadow, G, CX, anim, tinnar, bagfonster, port, fana, gnistra,
  WOOD, WOOD_DARK, STONE, STONE_LIGHT, STONE_DARK, GLAS, GLAS_LJUS, STAL, STAL_DARK,
  GULD, KRAM, FANA,
} from "./art-klasscenter-delar.js";
import { stjarna } from "./art-style.js";

const TAK = "#7E6CC9";

// Spetsigt torntak (kon) på ett torn [x, x+w] med överkant y, topp h högre,
// guldband i fogen + liten vimpel i klassfärg.
function konTak(x, w, y, h, vimpel = true) {
  const cx = x + w / 2;
  return `<path d="M${x - 12} ${y} L${cx} ${y - h} L${x + w + 12} ${y} Z" fill="${TAK}" ${LINE}/>
      <path d="M${cx - w * 0.18} ${y - h * 0.3} L${cx} ${y - h + 6}" stroke="#A99BE6" stroke-width="6" stroke-linecap="round"/>
      <rect x="${x - 14}" y="${y - 4}" width="${w + 28}" height="12" rx="5" fill="${GULD}" ${THIN}/>
      ${vimpel ? `${limb(`M${cx} ${y - h} L${cx} ${y - h - 40}`, WOOD_DARK, 3)}
      <path d="M${cx} ${y - h - 40} L${cx + 34} ${y - h - 31} L${cx} ${y - h - 20} Z" fill="${FANA}" ${THIN}/>` : ""}`;
}

// Torn med fönster: [x, x+w] från marken upp till y.
const torn = (x, w, y) => `<rect x="${x}" y="${y}" width="${w}" height="${G - y}" rx="4" fill="${STONE_LIGHT}" ${LINE}/>
      ${bagfonster(x + w / 2, y + 40, w * 0.36, w * 0.6, "#FDE9A8")}`;

// --- 8. Ståtligt slott med tinnar och torn -----------------------------------
function slott(opts) {
  return `${shadow(CX, G, 520)}
      <!-- Yttre torn + mur -->
      ${torn(130, 100, G - 320)}${torn(1020, 100, G - 320)}
      ${konTak(130, 100, G - 320, 120)}${konTak(1020, 100, G - 320, 120)}
      <rect x="226" y="${G - 190}" width="798" height="190" fill="${STONE}" ${LINE}/>
      ${tinnar(226, 798, G - 190, STONE)}
      <!-- Inre torn -->
      ${torn(320, 104, G - 420)}${torn(826, 104, G - 420)}
      ${konTak(320, 104, G - 420, 150)}${konTak(826, 104, G - 420, 150)}
      ${bagfonster(372, G - 250, 36, 60, "#FDE9A8")}${bagfonster(878, G - 250, 36, 60, "#FDE9A8")}
      <!-- Huvudslottet + mitt-torn med klassens fana -->
      <rect x="560" y="${G - 520}" width="130" height="200" fill="${STONE_LIGHT}" ${LINE}/>
      ${konTak(560, 130, G - 520, 140, false)}
      ${fana(625, G - 660, 80, opts)}
      ${bagfonster(625, G - 488, 46, 74, "#FDE9A8")}
      <rect x="440" y="${G - 360}" width="370" height="360" fill="${STONE}" ${LINE}/>
      ${tinnar(440, 370, G - 360, STONE)}
      <rect x="440" y="${G - 300}" width="370" height="14" fill="${STONE_DARK}" ${THIN}/>
      ${bagfonster(500, G - 270, 50, 86, "#FDE9A8")}${bagfonster(750, G - 270, 50, 86, "#FDE9A8")}
      ${bagfonster(500, G - 150, 50, 80, "#FDE9A8")}${bagfonster(750, G - 150, 50, 80, "#FDE9A8")}
      <!-- Balkong över porten -->
      <path d="M560 ${G - 262} L690 ${G - 262} L676 ${G - 240} L574 ${G - 240} Z" fill="${STONE_DARK}" ${LINE}/>
      ${bagfonster(625, G - 330, 52, 68, "#FDE9A8")}
      <!-- Stora porten i guld/trä -->
      ${port(625, 124, 200, WOOD, GULD)}
      <path d="M574 ${G - 110} L676 ${G - 110}" stroke="${O}" stroke-width="3" stroke-linecap="round"/>
      <!-- Trappa + guldglitter på tornspetsarna -->
      <rect x="534" y="${G - 12}" width="182" height="12" rx="4" fill="${STONE_DARK}" ${LINE}/>
      <g${anim(opts, "kc-glitter")}>${gnistra(372, G - 600, 10)}</g>
      <g${anim(opts, "kc-glitter d2")}>${gnistra(906, G - 610, 9)}</g>`;
}

// Glasfasad: ram i stål, rutnät av mullioner, diagonala reflexer.
function glasfasad(x, y, w, h, cols, rows, ruta = GLAS) {
  let nat = "";
  for (let i = 1; i < cols; i++) nat += `M${(x + (w * i) / cols).toFixed(1)} ${y + 4} L${(x + (w * i) / cols).toFixed(1)} ${y + h - 4} `;
  for (let j = 1; j < rows; j++) nat += `M${x + 4} ${(y + (h * j) / rows).toFixed(1)} L${x + w - 4} ${(y + (h * j) / rows).toFixed(1)} `;
  const r1 = Math.min(w, h) * 0.35;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${ruta}" ${LINE}/>
      <path d="M${x + w * 0.12} ${y + h * 0.35} L${x + w * 0.12 + r1} ${y + h * 0.35 - r1} L${x + w * 0.12 + r1 + 26} ${y + h * 0.35 - r1} L${x + w * 0.12 + 26} ${y + h * 0.35} Z" fill="#FFFFFF" opacity="0.45"/>
      <path d="M${x + w * 0.5} ${y + h * 0.8} L${x + w * 0.5 + r1 * 0.6} ${y + h * 0.8 - r1 * 0.6} L${x + w * 0.5 + r1 * 0.6 + 14} ${y + h * 0.8 - r1 * 0.6} L${x + w * 0.5 + 14} ${y + h * 0.8} Z" fill="#FFFFFF" opacity="0.4"/>
      <path d="${nat}" stroke="${STAL_DARK}" stroke-width="3" stroke-linecap="round"/>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="none" stroke="${O}" stroke-width="4"/>`;
}

// --- 9. Modernt skinande högkvarter i glas och stål -------------------------
function hogkvarter(opts) {
  return `${shadow(CX, G, 540)}
      <!-- Låga ytterflyglar: takträdgård vänster, solpaneler höger -->
      <circle cx="160" cy="${G - 206}" r="24" fill="#6FC66F" ${LINE}/><circle cx="214" cy="${G - 212}" r="30" fill="#6FC66F" ${LINE}/><circle cx="266" cy="${G - 204}" r="22" fill="#6FC66F" ${LINE}/>
      ${glasfasad(110, G - 190, 200, 190, 4, 3, GLAS_LJUS)}
      <path d="M960 ${G - 166} L1000 ${G - 196} L1046 ${G - 196} L1006 ${G - 166} Z M1040 ${G - 166} L1080 ${G - 196} L1126 ${G - 196} L1086 ${G - 166} Z" fill="#46557A" ${THIN}/>
      ${glasfasad(940, G - 160, 200, 160, 4, 3, GLAS_LJUS)}
      <!-- Mellanflyglar -->
      ${glasfasad(296, G - 400, 230, 400, 4, 8)}
      <path d="M720 ${G - 430} Q840 ${G - 520} 960 ${G - 430} Z" fill="${STAL}" ${LINE}/>
      ${glasfasad(720, G - 440, 240, 440, 4, 8)}
      <!-- Huvudtornet + antenn -->
      ${limb(`M625 ${G - 650} L625 ${G - 718}`, STAL_DARK, 6)}
      <g${anim(opts, "kc-blink")}><circle cx="625" cy="${G - 724}" r="9" fill="#EF6F6C" ${THIN}/></g>
      <rect x="560" y="${G - 664}" width="130" height="24" rx="6" fill="${STAL}" ${LINE}/>
      ${glasfasad(506, G - 644, 238, 644, 5, 14)}
      <!-- Stålbalkar i fasaden (vertikala pelare) -->
      ${limb(`M506 ${G} L506 ${G - 644}`, STAL, 10)}${limb(`M744 ${G} L744 ${G - 644}`, STAL, 10)}
      <!-- Klassens emblem högt upp -->
      <circle cx="625" cy="${G - 576}" r="38" fill="${KRAM}" ${LINE}/>
      <circle cx="625" cy="${G - 576}" r="28" fill="${FANA}" ${THIN}/>
      ${stjarna(625, G - 576, 3.8, GULD)}
      <!-- Entré: skärmtak + glasdörrar -->
      <rect x="534" y="${G - 128}" width="182" height="20" rx="6" fill="${STAL}" ${LINE}/>
      <rect x="566" y="${G - 108}" width="118" height="108" fill="${GLAS_LJUS}" ${LINE}/>
      <path d="M625 ${G - 108} L625 ${G}" stroke="${O}" stroke-width="3"/>
      <path d="M612 ${G - 60} L612 ${G - 40} M638 ${G - 60} L638 ${G - 40}" stroke="${STAL_DARK}" stroke-width="5" stroke-linecap="round"/>
      <rect x="546" y="${G - 12}" width="158" height="12" rx="4" fill="${STONE}" ${LINE}/>
      ${fana(1180, G, 250, opts)}
      ${fana(60, G, 210, opts)}
      <g${anim(opts, "kc-glitter")}>${gnistra(560, G - 520, 12)}</g>
      <g${anim(opts, "kc-glitter d2")}>${gnistra(830, G - 330, 10)}</g>
      <g${anim(opts, "kc-glitter d3")}>${gnistra(380, G - 260, 9)}</g>`;
}

// Kristallprisma från plattformen (bas b) upp h, bredd w, med ljus fasett.
function kristall(cx, w, h, fill, ljus) {
  const b = G - 44, t = b - h, axel = t + w * 0.7;
  return `<path d="M${cx - w / 2} ${b} L${cx - w / 2} ${axel} L${cx} ${t} L${cx + w / 2} ${axel} L${cx + w / 2} ${b} Z" fill="${fill}" ${LINE}/>
      <path d="M${cx - w / 2} ${b} L${cx - w / 2} ${axel} L${cx} ${t} L${cx - w * 0.1} ${axel + w * 0.12} L${cx - w * 0.1} ${b} Z" fill="${ljus}" ${THIN}/>
      <path d="M${cx - w * 0.32} ${b - 24} L${cx - w * 0.32} ${axel + w * 0.1}" stroke="#FFFFFF" stroke-width="${Math.max(4, w * 0.05)}" stroke-linecap="round" opacity="0.75"/>`;
}

// Liten svävande romb-kristall.
const romb = (cx, cy, r, fill) => `<path d="M${cx} ${cy - r * 1.4} L${cx + r} ${cy} L${cx} ${cy + r * 1.4} L${cx - r} ${cy} Z" fill="${fill}" ${THIN}/>
      <path d="M${cx} ${cy - r * 1.4} L${cx - r} ${cy} L${cx} ${cy} Z" fill="#FFFFFF" opacity="0.55"/>`;

// --- 10. Episkt futuristiskt kristallpalats ---------------------------------
function kristallpalats(opts) {
  return `${shadow(CX, G, 580)}
      <!-- Trappstegsplattform på marken -->
      <rect x="80" y="${G - 24}" width="1090" height="24" rx="6" fill="#B79BE0" ${LINE}/>
      <rect x="130" y="${G - 44}" width="990" height="24" rx="6" fill="#DCCBF5" ${LINE}/>
      <!-- Kristalltorn utifrån och in (inre överlappar yttre) -->
      ${kristall(160, 80, 180, GULD, "#FDE9A8")}${kristall(1090, 80, 180, GULD, "#FDE9A8")}
      ${kristall(252, 104, 290, "#F890B7", "#FFD0E2")}${kristall(998, 104, 290, "#F890B7", "#FFD0E2")}
      ${kristall(352, 124, 400, "#7FC7E8", GLAS_LJUS)}${kristall(898, 124, 400, "#7FC7E8", GLAS_LJUS)}
      ${kristall(472, 150, 520, "#58C6A9", "#C9F0DC")}${kristall(778, 150, 520, "#58C6A9", "#C9F0DC")}
      ${kristall(625, 210, 660, "#B79BE0", "#E6DAFA")}
      <!-- Ljusstjärna på mittspiran -->
      <g${anim(opts, "kc-glitter")}>${gnistra(625, G - 726, 24, GULD)}</g>
      <!-- Kupolhall framför spirorna -->
      <path d="M392 ${G - 44} L392 ${G - 170} Q625 ${G - 330} 858 ${G - 170} L858 ${G - 44} Z" fill="${KRAM}" ${LINE}/>
      <path d="M412 ${G - 172} Q625 ${G - 306} 838 ${G - 172}" fill="none" stroke="${GULD}" stroke-width="7" stroke-linecap="round"/>
      ${bagfonster(462, G - 160, 48, 96, "#E6DAFA")}${bagfonster(788, G - 160, 48, 96, "#E6DAFA")}
      ${bagfonster(540, G - 190, 44, 110, GLAS_LJUS)}${bagfonster(710, G - 190, 44, 110, GLAS_LJUS)}
      ${port(625, 96, 152, "#B79BE0", GULD, G - 44)}
      ${stjarna(625, G - 250, 4.4, GULD)}
      <!-- Svävande kristaller + glitter -->
      <g${anim(opts, "kc-svava")}>${romb(250, G - 560, 18, "#58C6A9")}${romb(1004, G - 590, 16, "#F890B7")}</g>
      <g${anim(opts, "kc-svava d2")}>${romb(130, G - 360, 14, "#B79BE0")}${romb(1124, G - 380, 14, "#7FC7E8")}</g>
      <g${anim(opts, "kc-glitter d2")}>${gnistra(410, G - 600, 12)}${gnistra(860, G - 470, 10)}</g>
      <g${anim(opts, "kc-glitter d3")}>${gnistra(300, G - 410, 9)}${gnistra(940, G - 640, 12)}${gnistra(560, G - 420, 8)}</g>`;
}

/** Nivå 8–10 → markup-funktion(opts). */
export const KLASSCENTER_SEN = { 8: slott, 9: hogkvarter, 10: kristallpalats };
