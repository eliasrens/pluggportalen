// ============================================================================
// Pluggporten – Klasscentret nivå 5–7 (#478): byhus → rådhus → borg
// ----------------------------------------------------------------------------
// Samma koordinater som övriga nivåer (art-klasscenter-delar.js: viewBox
// 1250×800, mitt x=625, marklinje y=G=752). Returnerar INRE markup.
// ============================================================================

import {
  O, LINE, THIN, limb, shadow, G, CX, rok, tinnar, bagfonster, port, fana,
  WOOD, WOOD_DARK, WOOD_LIGHT, STONE, STONE_LIGHT, STONE_DARK, TEGEL, TEGEL_DARK,
  GULD, KRAM, FANA,
} from "./art-klasscenter-delar.js";
import { stjarna } from "./art-style.js";

// Glest stenmönster (förskjutna kvaderstenar) inom [x, x+w] × [y, y+h].
// Bara var tredje sten ritas → läsbar textur utan att bli plottrigt.
function stenmonster(x, y, w, h, sw = 56, sh = 26) {
  let s = "";
  let rad = 0;
  for (let yy = y + 8; yy + sh <= y + h - 4; yy += sh, rad++) {
    const off = rad % 2 ? sw / 2 : 0;
    let i = 0;
    for (let xx = x + 8 + off; xx + sw - 6 <= x + w - 6; xx += sw, i++) {
      if ((i + rad * 2) % 3) continue;
      s += `<rect x="${xx}" y="${yy}" width="${sw - 6}" height="${sh - 6}" rx="5" fill="${STONE_LIGHT}" stroke="${STONE_DARK}" stroke-width="2"/>`;
    }
  }
  return s;
}

// Tegeltak: triangel (vänster bas xl, höger bas xr, bas y, topp ty) med rader
// av tegelpannor (bågar) som följer takets lutning.
function tegeltak(xl, xr, y, ty) {
  const cx = (xl + xr) / 2;
  const hw0 = (xr - xl) / 2;
  let rader = "";
  for (let yy = ty + 30; yy < y - 4; yy += 24) {
    const hw = (hw0 * (yy - ty)) / (y - ty) - 10;
    const n = Math.max(1, Math.round((hw * 2) / 34));
    const step = (hw * 2) / n;
    let d = `M${(cx - hw).toFixed(1)} ${yy}`;
    for (let i = 1; i <= n; i++) d += ` Q${(cx - hw + step * (i - 0.5)).toFixed(1)} ${yy + 12} ${(cx - hw + step * i).toFixed(1)} ${yy}`;
    rader += `<path d="${d}" fill="none" stroke="${TEGEL_DARK}" stroke-width="2.6" stroke-linecap="round"/>`;
  }
  return `<path d="M${xl} ${y} L${cx} ${ty} L${xr} ${y} Z" fill="${TEGEL}" ${LINE}/>${rader}
      <path d="M${xl - 6} ${y} L${xr + 6} ${y}" stroke="${O}" stroke-width="9" stroke-linecap="round"/>
      <path d="M${xl - 6} ${y} L${xr + 6} ${y}" stroke="${TEGEL_DARK}" stroke-width="4.5" stroke-linecap="round"/>`;
}

// Liten buske (tre bollar) med botten på marken.
const buske = (cx, r = 26) => `<circle cx="${cx - r * 0.8}" cy="${G - r * 0.8}" r="${r * 0.8}" fill="#6FC66F" ${LINE}/>
      <circle cx="${cx + r * 0.8}" cy="${G - r * 0.8}" r="${r * 0.8}" fill="#6FC66F" ${LINE}/>
      <circle cx="${cx}" cy="${G - r * 1.1}" r="${r}" fill="#6FC66F" ${LINE}/>`;

// Pelare (kolonn) med kapitäl och bas, från y1 ner till y2.
const pelare = (cx, y1, y2, w = 28) => `<rect x="${cx - w / 2}" y="${y1}" width="${w}" height="${y2 - y1}" fill="${KRAM}" ${LINE}/>
      <path d="M${cx - w / 6} ${y1 + 10} L${cx - w / 6} ${y2 - 10} M${cx + w / 6} ${y1 + 10} L${cx + w / 6} ${y2 - 10}" stroke="${STONE_DARK}" stroke-width="2"/>
      <rect x="${cx - w / 2 - 7}" y="${y1 - 12}" width="${w + 14}" height="14" rx="3" fill="${STONE_LIGHT}" ${LINE}/>
      <rect x="${cx - w / 2 - 7}" y="${y2}" width="${w + 14}" height="12" rx="3" fill="${STONE_LIGHT}" ${LINE}/>`;

// Pilglugg (smal öppning i borgmur/torn).
const glugg = (cx, y, h = 40) => `<rect x="${cx - 6}" y="${y}" width="12" height="${h}" rx="6" fill="#4C4661" ${THIN}/>`;

// Hängande vimpel-banér med klassfärg + guldkant.
const baner = (cx, y, h = 110) => `<path d="M${cx - 24} ${y} L${cx + 24} ${y} L${cx + 24} ${y + h} L${cx} ${y + h - 22} L${cx - 24} ${y + h} Z" fill="${FANA}" ${LINE}/>
      <path d="M${cx - 24} ${y + 14} L${cx + 24} ${y + 14}" stroke="${GULD}" stroke-width="5"/>
      ${stjarna(cx, y + 50, 3.2, GULD)}`;

// --- 5. Byhus i sten med tegelpannor + liten anslagstavla --------------------
function byhus(opts) {
  const lapp = (x, y, w, h, f, rot) => `<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${f}" ${THIN}/>
        <path d="M${x + 6} ${y + 10} L${x + w - 6} ${y + 10} M${x + 6} ${y + 18} L${x + w - 10} ${y + 18}" stroke="${O}" stroke-width="1.6" opacity="0.45"/>
        <circle cx="${x + w / 2}" cy="${y + 3}" r="3" fill="#EF6F6C"/></g>`;
  return `${shadow(CX + 40, G, 360)}
      <!-- Skorsten i tegel + rök -->
      <rect x="712" y="${G - 400}" width="56" height="130" rx="4" fill="${TEGEL}" ${LINE}/>
      <rect x="704" y="${G - 412}" width="72" height="18" rx="4" fill="${TEGEL_DARK}" ${LINE}/>
      ${rok(740, G - 428, opts)}
      <!-- Stenhuset -->
      <rect x="390" y="${G - 236}" width="470" height="236" rx="6" fill="${STONE}" ${LINE}/>
      ${stenmonster(390, G - 236, 470, 236)}
      ${tegeltak(352, 898, G - 220, G - 392)}
      <!-- Gavelfönster -->
      <circle cx="625" cy="${G - 284}" r="26" fill="${KRAM}" ${LINE}/>
      <circle cx="625" cy="${G - 284}" r="13" fill="#9AD3F0" ${THIN}/>
      <!-- Dörr med trappsten -->
      ${port(625, 84, 150)}
      <rect x="566" y="${G - 12}" width="118" height="12" rx="4" fill="${STONE_DARK}" ${LINE}/>
      <!-- Fönster med luckor -->
      ${bagfonster(470, G - 182, 70, 96)}
      ${bagfonster(780, G - 182, 70, 96)}
      <rect x="422" y="${G - 184}" width="18" height="98" rx="3" fill="#6FC66F" ${THIN}/>
      <rect x="500" y="${G - 184}" width="18" height="98" rx="3" fill="#6FC66F" ${THIN}/>
      <rect x="732" y="${G - 184}" width="18" height="98" rx="3" fill="#6FC66F" ${THIN}/>
      <rect x="810" y="${G - 184}" width="18" height="98" rx="3" fill="#6FC66F" ${THIN}/>
      <rect x="426" y="${G - 84}" width="88" height="14" rx="6" fill="${WOOD_LIGHT}" ${LINE}/>
      <rect x="736" y="${G - 84}" width="88" height="14" rx="6" fill="${WOOD_LIGHT}" ${LINE}/>
      <!-- Anslagstavla med lappar (klassens meddelanden) -->
      ${limb(`M930 ${G} L930 ${G - 150}`, WOOD_DARK, 9)}
      ${limb(`M1060 ${G} L1060 ${G - 150}`, WOOD_DARK, 9)}
      <path d="M904 ${G - 162} L995 ${G - 196} L1086 ${G - 162} Z" fill="${TEGEL}" ${LINE}/>
      <rect x="914" y="${G - 160}" width="162" height="98" rx="6" fill="${WOOD}" ${LINE}/>
      <rect x="922" y="${G - 152}" width="146" height="82" rx="4" fill="#E8C99A" stroke="none"/>
      ${lapp(930, G - 146, 40, 32, "#FFFFFF", -4)}
      ${lapp(978, G - 140, 38, 30, "#FDE9A8", 3)}
      ${lapp(1024, G - 148, 38, 34, "#C9F0DC", -2)}
      ${lapp(950, G - 106, 44, 30, "#FFD0E2", 2)}
      ${lapp(1004, G - 104, 46, 30, "#FFFFFF", -3)}
      <!-- Bänk + buske på andra sidan -->
      ${buske(330, 30)}
      ${limb(`M200 ${G - 40} L290 ${G - 40}`, WOOD, 10)}
      ${limb(`M212 ${G} L212 ${G - 40} M278 ${G} L278 ${G - 40}`, WOOD_DARK, 6)}`;
}

// --- 6. Rådhus med pelare och klocktorn --------------------------------------
function radhus() {
  const visare = `<path d="M625 ${G - 432} L625 ${G - 458} M625 ${G - 432} L643 ${G - 424}" stroke="${O}" stroke-width="5" stroke-linecap="round"/>`;
  let timmar = "";
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    timmar += `<circle cx="${(625 + 32 * Math.sin(a)).toFixed(1)}" cy="${(G - 432 - 32 * Math.cos(a)).toFixed(1)}" r="${i % 3 ? 2 : 3.6}" fill="${O}"/>`;
  }
  return `${shadow(CX, G, 400)}
      <!-- Klocktornet (bakom huvudbyggnaden) -->
      <rect x="560" y="${G - 560}" width="130" height="310" fill="${STONE_LIGHT}" ${LINE}/>
      <rect x="548" y="${G - 572}" width="154" height="18" rx="4" fill="${STONE_DARK}" ${LINE}/>
      <path d="M546 ${G - 572} L625 ${G - 686} L704 ${G - 572} Z" fill="#46557A" ${LINE}/>
      ${limb(`M625 ${G - 686} L625 ${G - 718}`, GULD, 4)}
      <circle cx="625" cy="${G - 722}" r="9" fill="${GULD}" ${THIN}/>
      <!-- Klockstapelns öppning med klocka (ovanför urtavlan) -->
      <path d="M596 ${G - 484} L596 ${G - 522} Q625 ${G - 550} 654 ${G - 522} L654 ${G - 484} Z" fill="#4C4661" ${THIN}/>
      <path d="M610 ${G - 488} Q610 ${G - 518} 625 ${G - 518} Q640 ${G - 518} 640 ${G - 488} Z" fill="${GULD}" ${THIN}/>
      <circle cx="625" cy="${G - 432}" r="42" fill="${KRAM}" ${LINE}/>
      ${timmar}${visare}
      <circle cx="625" cy="${G - 432}" r="5" fill="${O}"/>
      <!-- Huvudbyggnaden med flygelfönster -->
      <rect x="320" y="${G - 262}" width="610" height="262" fill="#F3E9D8" ${LINE}/>
      <rect x="306" y="${G - 280}" width="638" height="22" rx="5" fill="${STONE_DARK}" ${LINE}/>
      ${bagfonster(372, G - 220, 48, 84)}${bagfonster(436, G - 220, 48, 84)}
      ${bagfonster(814, G - 220, 48, 84)}${bagfonster(878, G - 220, 48, 84)}
      ${bagfonster(372, G - 110, 48, 70)}${bagfonster(436, G - 110, 48, 70)}
      ${bagfonster(814, G - 110, 48, 70)}${bagfonster(878, G - 110, 48, 70)}
      <!-- Portiken: gavelfält + pelare -->
      <path d="M470 ${G - 238} L625 ${G - 326} L780 ${G - 238} Z" fill="${KRAM}" ${LINE}/>
      ${stjarna(625, G - 268, 4.4, GULD)}
      <rect x="470" y="${G - 242}" width="310" height="20" rx="3" fill="${STONE_LIGHT}" ${LINE}/>
      ${pelare(506, G - 208, G - 34)}${pelare(562, G - 208, G - 34)}
      ${pelare(688, G - 208, G - 34)}${pelare(744, G - 208, G - 34)}
      ${port(625, 64, 150, WOOD, WOOD_DARK)}
      <!-- Trappan -->
      <rect x="456" y="${G - 24}" width="338" height="12" rx="3" fill="${STONE_LIGHT}" ${LINE}/>
      <rect x="436" y="${G - 12}" width="378" height="12" rx="3" fill="${STONE}" ${LINE}/>
      ${buske(290, 28)}${buske(960, 28)}`;
}

// --- 7. Mindre borg med stenmurar och klassens fana --------------------------
function borg(opts) {
  return `${shadow(CX, G, 440)}
      <!-- Ringmur mellan hörntornen -->
      <rect x="270" y="${G - 170}" width="710" height="170" fill="${STONE}" ${LINE}/>
      ${tinnar(270, 710, G - 170)}
      ${stenmonster(270, G - 170, 710, 170)}
      <!-- Hörntorn -->
      <rect x="196" y="${G - 268}" width="110" height="268" rx="4" fill="${STONE}" ${LINE}/>
      <rect x="944" y="${G - 268}" width="110" height="268" rx="4" fill="${STONE}" ${LINE}/>
      ${tinnar(196, 110, G - 268)}${tinnar(944, 110, G - 268)}
      ${glugg(251, G - 220)}${glugg(251, G - 130)}${glugg(999, G - 220)}${glugg(999, G - 130)}
      ${limb(`M251 ${G - 286} L251 ${G - 340}`, WOOD_DARK, 3)}
      <path d="M251 ${G - 340} L286 ${G - 330} L251 ${G - 318} Z" fill="${FANA}" ${THIN}/>
      ${limb(`M999 ${G - 286} L999 ${G - 340}`, WOOD_DARK, 3)}
      <path d="M999 ${G - 340} L1034 ${G - 330} L999 ${G - 318} Z" fill="${FANA}" ${THIN}/>
      <!-- Huvudkeep med klassens fana -->
      <rect x="490" y="${G - 340}" width="270" height="340" rx="4" fill="${STONE}" ${LINE}/>
      ${stenmonster(490, G - 340, 270, 340, 50)}
      ${tinnar(490, 270, G - 340)}
      ${fana(625, G - 358, 130, opts)}
      ${baner(535, G - 318)}${baner(715, G - 318)}
      ${bagfonster(625, G - 300, 44, 70, "#FDE9A8")}
      <!-- Porten med fällgaller -->
      ${port(625, 110, 180, "#4C4661", STONE_DARK)}
      <path d="M588 ${G - 160} L588 ${G - 6} M612 ${G - 176} L612 ${G - 6} M638 ${G - 176} L638 ${G - 6} M662 ${G - 160} L662 ${G - 6} M574 ${G - 130} L676 ${G - 130} M572 ${G - 80} L678 ${G - 80} M572 ${G - 34} L678 ${G - 34}" stroke="${WOOD_DARK}" stroke-width="5" stroke-linecap="round"/>
      <!-- Facklor vid porten -->
      ${limb(`M548 ${G - 120} L548 ${G - 150}`, WOOD, 6)}
      <path d="M538 ${G - 150} Q548 ${G - 184} 558 ${G - 150} Z" fill="#F08A3C" ${THIN}/>
      ${limb(`M702 ${G - 120} L702 ${G - 150}`, WOOD, 6)}
      <path d="M692 ${G - 150} Q702 ${G - 184} 712 ${G - 150} Z" fill="#F08A3C" ${THIN}/>`;
}

/** Nivå 5–7 → markup-funktion(opts). */
export const KLASSCENTER_MITT = { 5: byhus, 6: radhus, 7: borg };
