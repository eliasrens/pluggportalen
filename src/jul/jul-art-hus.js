// ============================================================================
// Pluggporten – Jul-samlingens HUSSKAL (#910): pepparkakshus, tomteverkstad, snöhydda
// ----------------------------------------------------------------------------
// Samma mått och placering som Halloween-husen (hw-art-hus.js) och stugan i
// art-hus-ute.js: huset kring x 300–660, marklinjen y ≈ 512, dörren centralt
// (x ≈ 452–508, avataren står till vänster, x 256–376), fönstren kring y 340–410.
// Fasta julfärger i stället för elevens --hus-*-palett – det ÄR deras utseende.
// Vinterns snötäcke läggs på av art-hus-ute.js (snoTak, #908) på allt som
// vänder sig uppåt – ingen egen snö per hus. Registreras i HUS_SKAL
// (registerHusSkal) av jul-konst.js → "🏠 Nytt hus", byn och kompisbesök ritar
// dem utan särfall. Id === skal-id === shop-id (Firestore, STABILT).
// ============================================================================

import {
  O, LINE, THIN, limb, skugga, glod, stjarna5, ljus, paket,
  JULROD, JULROD_MORK, GRAN, GRAN_MORK, GRAN_LJUS, GULD, SKEN, PEPPAR, PEPPAR_MORK, SNOVIT, SNOSKUGGA,
  WOOD_DARK,
} from "./jul-art-delar.js";

const VARM = "#F7B34C";
const KRISTYR = "#FFFDF8";

// Kristyrkant: vågig vit linje längs en sträcka (x0,y0)→(x1,y1), n bågar.
function kristyr(x0, y0, x1, y1, n, djup = 9) {
  let d = `M${x0} ${y0}`;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    const mx = x0 + (x1 - x0) * (t - 0.5 / n);
    const my = y0 + (y1 - y0) * (t - 0.5 / n) + djup;
    d += ` Q${mx.toFixed(1)} ${my.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `<path d="${d}" fill="none" stroke="${O}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${KRISTYR}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// Fönster med spröjs och varmt sken (x,y = övre vänstra hörnet); `ram` = ramfärg.
const fonster = (x, y, w, h, ram, sprojs = 2) => {
  let s = `<rect x="${x - 5}" y="${y - 5}" width="${w + 10}" height="${h + 10}" rx="7" fill="${ram}" ${LINE}/>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${VARM}" ${THIN}/>` +
    glod(`<rect x="${x + 4}" y="${y + 4}" width="${w - 8}" height="${h - 8}" rx="3" fill="${SKEN}" opacity="0.9"/>`);
  for (let i = 1; i < sprojs; i++) s += `<path d="M${x + (w * i) / sprojs} ${y} L${x + (w * i) / sprojs} ${y + h}" stroke="${O}" stroke-width="3"/>`;
  return s + `<path d="M${x} ${y + h / 2} L${x + w} ${y + h / 2}" stroke="${O}" stroke-width="3"/>`;
};

// Godisknapp (rund, med glans).
const godis = (cx, cy, r, c) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" ${THIN}/>` +
  `<circle cx="${cx - r * 0.35}" cy="${cy - r * 0.35}" r="${r * 0.3}" fill="#fff" opacity="0.8"/>`;

// Polkagris (käpp) stående på marken i x.
const polkagris = (x, h) =>
  `<path d="M${x} 512 L${x} ${512 - h} Q${x} ${500 - h} ${x + 10} ${500 - h} Q${x + 20} ${500 - h} ${x + 20} ${512 - h}" fill="none" stroke="${O}" stroke-width="10" stroke-linecap="round"/>` +
  `<path d="M${x} 512 L${x} ${512 - h} Q${x} ${500 - h} ${x + 10} ${500 - h} Q${x + 20} ${500 - h} ${x + 20} ${512 - h}" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>` +
  `<path d="M${x} 512 L${x} ${512 - h} Q${x} ${500 - h} ${x + 10} ${500 - h} Q${x + 20} ${500 - h} ${x + 20} ${512 - h}" fill="none" stroke="${JULROD}" stroke-width="6" stroke-dasharray="5 6"/>`;

// Pepparkakshus: brunt hus med vit kristyr längs takfot och hörn, godisknappar
// på taket, kristyrramade fönster och polkagrisar vid dörren.
function pepparkakshusMarkup() {
  const knappar = [[392, 268, JULROD], [440, 236, "#6FC66F"], [480, 206, GULD], [520, 236, "#7FC7E8"], [568, 268, JULROD],
    [424, 286, GULD], [480, 250, JULROD], [536, 286, "#6FC66F"]];
  return `${skugga(480, 514, 196)}
      <!-- Skorsten -->
      <rect x="566" y="168" width="40" height="90" rx="4" fill="${PEPPAR_MORK}" ${LINE}/>
      ${kristyr(562, 172, 610, 172, 3, 7)}
      <!-- Väggarna -->
      <rect x="332" y="296" width="296" height="216" rx="6" fill="${PEPPAR}" ${LINE}/>
      <path d="M344 300 L344 506 M616 300 L616 506" stroke="${KRISTYR}" stroke-width="6" stroke-linecap="round" stroke-dasharray="2 12"/>
      <!-- Taket med kristyrkant och godisknappar -->
      <path d="M304 314 L480 172 L656 314 Z" fill="${PEPPAR_MORK}" ${LINE}/>
      <path d="M346 294 L480 190 L614 294" fill="none" stroke="${PEPPAR}" stroke-width="4" opacity="0.6"/>
      ${knappar.map(([x, y, c]) => godis(x, y, 10, c)).join("")}
      ${kristyr(304, 314, 480, 172, 6, 10)}
      ${kristyr(480, 172, 656, 314, 6, 10)}
      <!-- Fönster med kristyrram -->
      ${fonster(362, 346, 64, 62, KRISTYR)}
      ${fonster(534, 346, 64, 62, KRISTYR)}
      <!-- Dörr (centralt) med kristyrbåge -->
      <path d="M452 512 L452 448 Q452 418 480 418 Q508 418 508 448 L508 512 Z" fill="${JULROD_MORK}" ${LINE}/>
      <path d="M444 512 L444 446 Q444 408 480 408 Q516 408 516 446 L516 512" fill="none" stroke="${KRISTYR}" stroke-width="6" stroke-linecap="round" stroke-dasharray="3 9"/>
      <circle cx="497" cy="468" r="5" fill="${GULD}" ${THIN}/>
      <!-- Godisrad längs grunden + polkagrisar -->
      ${[350, 380, 410, 550, 580, 610].map((x, i) => godis(x, 500, 8, [JULROD, "#6FC66F", GULD][i % 3])).join("")}
      ${polkagris(424, 54)}
      ${polkagris(520, 54)}`;
}

// Tomteverkstad: röd stuga med vita knutar, stort spröjsat verkstadsfönster,
// krans på dörren, verkstadsskylt med ett paket och klappar vid trappan.
function tomteverkstadMarkup() {
  return `${skugga(480, 514, 196)}
      <!-- Skorsten -->
      <rect x="560" y="176" width="38" height="84" rx="3" fill="#8E8A9A" ${LINE}/>
      <rect x="554" y="170" width="50" height="14" rx="3" fill="#6E6A7A" ${LINE}/>
      <!-- Röda väggar med vita knutar och panel -->
      <rect x="326" y="290" width="308" height="222" fill="#C9474F" ${LINE}/>
      <path d="M352 300 L352 506 M378 300 L378 506 M582 300 L582 506 M608 300 L608 506" stroke="${JULROD_MORK}" stroke-width="2.4" opacity="0.6"/>
      <rect x="326" y="290" width="16" height="222" fill="${SNOVIT}" ${LINE}/>
      <rect x="618" y="290" width="16" height="222" fill="${SNOVIT}" ${LINE}/>
      <!-- Taket -->
      <path d="M300 304 L480 178 L660 304 Z" fill="#46557A" ${LINE}/>
      <path d="M300 304 L660 304" stroke="${SNOVIT}" stroke-width="8" stroke-linecap="round"/>
      <path d="M340 290 L480 196 L620 290 M370 290 L480 214 L590 290" fill="none" stroke="#5B6B92" stroke-width="3" opacity="0.7"/>
      <!-- Verkstadsskylt i gaveln (ett paket) -->
      <circle cx="480" cy="254" r="28" fill="${SNOVIT}" ${LINE}/>
      ${paket(466, 270, 28, 22, GRAN, GULD)}
      <!-- Stora verkstadsfönster (många rutor) -->
      ${fonster(356, 340, 76, 66, SNOVIT, 3)}
      ${fonster(530, 340, 76, 66, SNOVIT, 3)}
      <rect x="350" y="410" width="88" height="10" rx="3" fill="${SNOVIT}" ${THIN}/>
      <rect x="524" y="410" width="88" height="10" rx="3" fill="${SNOVIT}" ${THIN}/>
      <!-- Dörr (centralt) med krans -->
      <rect x="452" y="420" width="56" height="92" rx="4" fill="${GRAN_MORK}" ${LINE}/>
      <path d="M460 430 L500 430 L500 466 L460 466 Z M460 474 L500 474 L500 504 L460 504 Z" fill="none" stroke="${GRAN}" stroke-width="3"/>
      <circle cx="480" cy="446" r="15" fill="none" stroke="${O}" stroke-width="10"/>
      <circle cx="480" cy="446" r="15" fill="none" stroke="${GRAN_LJUS}" stroke-width="6"/>
      <path d="M472 458 L480 452 L488 458 L484 464 L480 458 L476 464 Z" fill="${JULROD}" ${THIN}/>
      <circle cx="497" cy="482" r="4.5" fill="${GULD}" ${THIN}/>
      <!-- Lykta vid dörren och klappar -->
      ${limb("M534 512 L534 452", "#46557A", 4)}
      <rect x="524" y="428" width="20" height="26" rx="5" fill="${SKEN}" ${LINE}/>
      ${ljus(534, 450, 6)}
      ${paket(372, 512, 30, 24, "#7FC7E8", JULROD)}
      ${paket(404, 512, 22, 18, GULD, JULROD)}
      ${paket(566, 512, 26, 20, JULROD, GULD)}`;
}

// Snöhydda: rund iglo av snöblock med en ingångstunnel vars dörröppning lyser
// varmt, två små runda isfönster och en lykta i snön.
function snohyddaMarkup() {
  const block = [
    "M330 450 Q480 432 630 450", "M342 392 Q480 372 618 392", "M368 336 Q480 316 592 336", "M408 284 Q480 270 552 284",
    "M400 512 L404 450 M520 512 L516 450 M560 450 L566 392 M460 450 L458 392 M396 392 L404 336 M520 392 L518 336",
    "M450 336 L452 284 M560 336 L548 284",
  ];
  const isfonster = (cx) =>
    `<circle cx="${cx}" cy="372" r="22" fill="#A9D3EA" ${LINE}/>` +
    `<circle cx="${cx}" cy="372" r="15" fill="${VARM}" ${THIN}/>` +
    glod(`<circle cx="${cx}" cy="372" r="11" fill="${SKEN}" opacity="0.9"/>`);
  return `${skugga(480, 514, 190)}
      <!-- Kupolen -->
      <path d="M318 512 Q314 252 480 248 Q646 252 642 512 Z" fill="${SNOVIT}" ${LINE}/>
      <path d="M360 300 Q410 262 470 258" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" opacity="0.9"/>
      ${block.map((d) => `<path d="${d}" fill="none" stroke="${SNOSKUGGA}" stroke-width="4" stroke-linecap="round"/>`).join("")}
      ${isfonster(388)}
      ${isfonster(572)}
      <!-- Ingångstunneln med varm dörröppning -->
      <path d="M430 512 L430 452 Q430 400 480 400 Q530 400 530 452 L530 512 Z" fill="${SNOVIT}" ${LINE}/>
      <path d="M430 466 Q480 456 530 466" fill="none" stroke="${SNOSKUGGA}" stroke-width="4"/>
      <path d="M452 512 L452 458 Q452 428 480 428 Q508 428 508 458 L508 512 Z" fill="${VARM}" ${LINE}/>
      ${glod(`<path d="M460 512 L460 460 Q460 438 480 438 Q500 438 500 460 L500 512 Z" fill="${SKEN}" opacity="0.9"/>`)}
      <!-- Lykta och en liten gran i snön -->
      ${limb("M584 512 L584 462", WOOD_DARK, 4)}
      <rect x="574" y="438" width="20" height="26" rx="5" fill="${SKEN}" ${LINE}/>
      ${ljus(584, 460, 6)}
      <path d="M360 512 L380 446 L400 512 Z" fill="${GRAN}" ${LINE}/>
      ${stjarna5(380, 444, 7, GULD)}
      <path d="M340 512 Q352 500 366 504 Q376 496 390 506 Q402 502 412 512 Z" fill="${SNOVIT}" ${THIN}/>`;
}

/** id → { namn, emoji, markup } – slås in i HUS_SKAL (registerHusSkal). */
export const JUL_HUS_SKAL = {
  "jul-pepparkakshus": { namn: "Pepparkakshus", emoji: "🏠", markup: pepparkakshusMarkup },
  "jul-tomteverkstad": { namn: "Tomteverkstad", emoji: "🛠️", markup: tomteverkstadMarkup },
  "jul-snohydda": { namn: "Snöhydda", emoji: "🏔️", markup: snohyddaMarkup },
};

/** Butiksbilder (itemSvg) – tätt beskuret husskal, samma utsnitt som Halloween-husen. */
export const JUL_HUS_BILDER = Object.fromEntries(
  Object.entries(JUL_HUS_SKAL).map(([id, s]) => [id, { viewBox: "290 110 380 420", w: 4.6, art: s.markup() }])
);
