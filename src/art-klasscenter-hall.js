// ============================================================================
// Pluggporten – Klasscentrets hall (rummets bakgrund, #490, epic #475)
// ----------------------------------------------------------------------------
// En pampig hall som matchar byggnadens nivå – fyra teman i stället för tio
// interiörer: trähall (nivå 1–3), stenhall (4–6), borgsal (7–8) och palats
// (9–10). Samma uppbyggnad överallt: vägg med pelare och välvda fönster, en
// stor portal i mitten (där klassens saker gärna samlas), golv i perspektiv
// och en löparmatta från portalen.
//
// viewBox 2400×1000 med preserveAspectRatio "xMidYMid slice": vanliga scener
// (bredd/höjd < 2,4) skalas efter HÖJDEN och beskärs i sidled → golvlinjen
// ligger kvar på exakt GOLV_TOPP % (drag-klamringen, rum-promenad-golv.js).
// Ingen animation, inga id/defs (#374: kameran zoomar genom hallen).
//
// 🔴 Bootgraf: importeras bara dynamiskt (klasscenter/kc-rum-vy.js, #271).
// ============================================================================

import { O, LINE, THIN } from "./art-style.js";

/** Golvlinjen i procent av scenhöjden (samma som Mitt rums FLOOR_TOP). */
export const GOLV_TOPP = 62;

const W = 2400;
const H = 1000;
const GY = (GOLV_TOPP / 100) * H; // 620
const MX = W / 2;

export const HALL_TEMAN = Object.freeze({
  tra: { vagg: "#D6A06A", vagg2: "#B98552", list: "#8A5A32", golv: "#DDB07A", golv2: "#C29462", pelare: "#A9733F", pelare2: "#86572D", accent: "#F2C14E", matta: "#B8484A", matta2: "#F2C14E", glas: "#BFE6F7" },
  sten: { vagg: "#D9D1C4", vagg2: "#C1B6A4", list: "#8F8576", golv: "#B4AEA5", golv2: "#9C958B", pelare: "#ECE5D8", pelare2: "#C3B9A7", accent: "#7FA6D9", matta: "#3F6FB5", matta2: "#F2D16B", glas: "#BFE6F7" },
  borg: { vagg: "#A7A5B2", vagg2: "#8E8C99", list: "#5E5C66", golv: "#8A8792", golv2: "#77747F", pelare: "#C0BECA", pelare2: "#9A98A4", accent: "#F2C14E", matta: "#B3282D", matta2: "#F2C14E", glas: "#9FD3F0" },
  palats: { vagg: "#F6F0FD", vagg2: "#E6DBF5", list: "#B9A6DA", golv: "#FFFFFF", golv2: "#E6DDF4", pelare: "#FFFFFF", pelare2: "#D6C8EE", accent: "#E7B93E", matta: "#7C5CD6", matta2: "#E7B93E", glas: "#CDEBFF" },
});

/** Byggnadens nivå (1–10, högre = sista temat) → hallens tema. */
export function hallTema(niva) {
  const n = Math.max(1, Math.floor(Number(niva)) || 1);
  return n <= 3 ? "tra" : n <= 6 ? "sten" : n <= 8 ? "borg" : "palats";
}

const PELARE_X = [200, 600, 1000, 1400, 1800, 2200];
const FONSTER_X = [400, 800, 1600, 2000];

function pelare(x, t, tema) {
  const b = 74;
  let s = `<rect x="${x - b / 2}" y="70" width="${b}" height="${GY - 70}" fill="${t.pelare}" ${LINE}/>` +
    `<rect x="${x - b / 2 + 12}" y="90" width="12" height="${GY - 130}" fill="${t.pelare2}" stroke="none" opacity="0.6"/>` +
    `<rect x="${x - b / 2 - 12}" y="${GY - 40}" width="${b + 24}" height="40" rx="4" fill="${t.pelare2}" ${LINE}/>` +
    `<rect x="${x - b / 2 - 14}" y="62" width="${b + 28}" height="34" rx="4" fill="${t.pelare2}" ${LINE}/>`;
  if (tema === "palats") {
    s += `<rect x="${x - b / 2 - 14}" y="62" width="${b + 28}" height="10" fill="${t.accent}" ${THIN}/>` +
      `<rect x="${x - b / 2 - 12}" y="${GY - 40}" width="${b + 24}" height="8" fill="${t.accent}" ${THIN}/>`;
  }
  if (tema === "borg") {
    // Fackla på pelaren (statisk låga).
    s += `<rect x="${x - 6}" y="300" width="12" height="46" rx="3" fill="#6B4A2E" ${THIN}/>` +
      `<path d="M${x} 252 Q${x + 22} 282 ${x + 10} 300 L${x - 10} 300 Q${x - 22} 282 ${x} 252 Z" fill="#F7A23B" ${THIN}/>` +
      `<path d="M${x} 274 Q${x + 9} 288 ${x + 4} 298 L${x - 4} 298 Q${x - 9} 288 ${x} 274 Z" fill="#FFE07A" stroke="none"/>`;
  }
  return s;
}

function fonster(x, t) {
  const w = 150;
  const top = 150;
  const bot = 430;
  const arch = `M${x - w / 2} ${bot} L${x - w / 2} ${top + w / 2} A${w / 2} ${w / 2} 0 0 1 ${x + w / 2} ${top + w / 2} L${x + w / 2} ${bot} Z`;
  return `<path d="${arch}" fill="${t.glas}" ${LINE}/>` +
    `<path d="M${x} ${top + 4} L${x} ${bot} M${x - w / 2} ${top + w / 2 + 40} L${x + w / 2} ${top + w / 2 + 40}" stroke="${O}" stroke-width="5" fill="none"/>` +
    `<path d="M${x - 40} ${bot - 30} L${x - 10} ${top + 120}" stroke="#fff" stroke-width="10" opacity="0.5" stroke-linecap="round"/>` +
    `<rect x="${x - w / 2 - 14}" y="${bot}" width="${w + 28}" height="18" rx="6" fill="${t.pelare2}" ${THIN}/>`;
}

function vaggMonster(t, tema) {
  if (tema === "tra") {
    let d = "";
    for (let y = 130; y < GY - 130; y += 46) d += `M0 ${y} H${W} `;
    return `<path d="${d}" stroke="${t.list}" stroke-width="3" opacity="0.35" fill="none"/>`;
  }
  if (tema === "sten" || tema === "borg") {
    let d = "";
    for (let r = 0, y = 110; y < GY - 130; r++, y += 60) {
      d += `M0 ${y} H${W} `;
      for (let x = (r % 2) * 90; x < W; x += 180) d += `M${x} ${y} V${y + 60} `;
    }
    return `<path d="${d}" stroke="${t.list}" stroke-width="3" opacity="0.3" fill="none"/>`;
  }
  // Palats: marmorådror.
  let d = "";
  for (let x = 120; x < W; x += 330) d += `M${x} 120 Q${x + 60} 260 ${x + 20} 360 T${x + 70} 520 `;
  return `<path d="${d}" stroke="${t.list}" stroke-width="3" opacity="0.3" fill="none"/>`;
}

function portal(t, tema) {
  const w = 300;
  const top = 160;
  const arch = `M${MX - w / 2} ${GY} L${MX - w / 2} ${top + w / 2} A${w / 2} ${w / 2} 0 0 1 ${MX + w / 2} ${top + w / 2} L${MX + w / 2} ${GY} Z`;
  const ram = `M${MX - w / 2 - 30} ${GY} L${MX - w / 2 - 30} ${top + w / 2} A${w / 2 + 30} ${w / 2 + 30} 0 0 1 ${MX + w / 2 + 30} ${top + w / 2} L${MX + w / 2 + 30} ${GY} Z`;
  const krona = tema === "tra"
    ? `<circle cx="${MX}" cy="${top - 14}" r="30" fill="${t.accent}" ${LINE}/>`
    : `<path d="M${MX - 50} ${top - 4} L${MX - 50} ${top - 46} L${MX - 25} ${top - 22} L${MX} ${top - 58} L${MX + 25} ${top - 22} L${MX + 50} ${top - 46} L${MX + 50} ${top - 4} Z" fill="${t.accent}" ${LINE}/>`;
  return `<path d="${ram}" fill="${t.pelare}" ${LINE}/>` +
    `<path d="${arch}" fill="${t.list}" ${LINE}/>` +
    `<path d="${arch}" fill="#000" opacity="0.18" stroke="none"/>` +
    krona;
}

function golv(t) {
  let d = "";
  // Perspektiv: linjer mot en flyktpunkt mitt över portalen.
  for (let i = -12; i <= 12; i++) d += `M${MX + i * 110} ${GY} L${MX + i * 300} ${H} `;
  // Tvärlinjer tätare längre bort.
  for (let k = 1; k <= 7; k++) {
    const y = GY + (H - GY) * Math.pow(k / 7, 1.7);
    d += `M0 ${y.toFixed(1)} H${W} `;
  }
  const matta = `M${MX - 150} ${GY} L${MX + 150} ${GY} L${MX + 330} ${H} L${MX - 330} ${H} Z`;
  const mattaKant = `M${MX - 130} ${GY + 4} L${MX - 298} ${H} M${MX + 130} ${GY + 4} L${MX + 298} ${H}`;
  return `<rect x="0" y="${GY}" width="${W}" height="${H - GY}" fill="${t.golv}"/>` +
    `<path d="${d}" stroke="${t.golv2}" stroke-width="4" fill="none"/>` +
    `<path d="${matta}" fill="${t.matta}" ${LINE}/>` +
    `<path d="${mattaKant}" stroke="${t.matta2}" stroke-width="8" fill="none"/>`;
}

/**
 * Hallens bakgrundslager (HTML-sträng) för byggnadens nivå. Läggs FÖRST i
 * scenen (under alla saker); tar inte emot pekhändelser (.room-bg).
 */
export function kcHallHtml(niva) {
  const tema = hallTema(niva);
  const t = HALL_TEMAN[tema];
  const tak = tema === "tra"
    ? `<rect x="0" y="0" width="${W}" height="70" fill="${t.pelare2}" ${LINE}/>` +
      PELARE_X.map((x) => `<path d="M${x - 200} 70 L${x} 20 L${x + 200} 70" stroke="${t.list}" stroke-width="10" fill="none"/>`).join("")
    : `<rect x="0" y="0" width="${W}" height="70" fill="${t.vagg2}" ${LINE}/>` +
      `<rect x="0" y="58" width="${W}" height="12" fill="${t.accent}" opacity="0.8" stroke="none"/>`;
  return `<div class="room-bg kc-hall-bg" data-tema="${tema}" aria-hidden="true">` +
    `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" focusable="false">` +
    `<rect x="0" y="0" width="${W}" height="${GY}" fill="${t.vagg}"/>` +
    vaggMonster(t, tema) +
    `<rect x="0" y="${GY - 130}" width="${W}" height="130" fill="${t.vagg2}" stroke="none"/>` +
    `<path d="M0 ${GY - 130} H${W}" stroke="${t.list}" stroke-width="6"/>` +
    tak +
    FONSTER_X.map((x) => fonster(x, t)).join("") +
    portal(t, tema) +
    PELARE_X.map((x) => pelare(x, t, tema)).join("") +
    golv(t) +
    `<path d="M0 ${GY} H${W}" stroke="${O}" stroke-width="6"/>` +
    `</svg></div>`;
}
