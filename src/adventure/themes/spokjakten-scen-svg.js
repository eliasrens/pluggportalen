// ============================================================================
// Pluggportalen – äventyrsmotorn: themes/spokjakten-scen-svg.js  (issue #252)
// ----------------------------------------------------------------------------
// EGENRITAD (handbyggd) inline-SVG-värld för Spökjakten – motorns scroll-läge.
// SPEGLAR Skattjakten (skattjakten-scen-svg.js): en komplett inline-SVG-STRÄNG
// (ingen serverad .svg-fil → undviker strikt-XML "attribute redefined"-fällan),
// ritad i portalens platta vektorstil (src/art-style.js: mörk plommonkontur,
// mjuka former). En MYSIG månskensnatt på en liten kyrkogård/by – ALDRIG läskig.
//
// VISIBLE = WALKABLE (lektionen från Skattjakten #243 & Gruvan #224): ALLT här
// ritas ur EXAKT samma geometrikonstanter som kollisionspredikatet i
// spokjakten-map.js (isBlockedWorld). En geometri-källa → konst och kollision
// kan aldrig driva isär:
//   • Gläntans grund/gräs ritas ur OUTER-splinen → exakt där man får gå.
//   • Trädridå/natt ritas UTANFÖR samma spline → exakt där man blockeras.
//   • Hus på HOUSE-boxen, damm på POND-ellipsen, gravstenar på GRAVESTONES,
//     staket på FENCE_SEGMENTS, lyktstolpar på LANTERNS – alla på de koordinater
//     kollisionen blockerar. Stigarna (PATH_MAIN/PATH_SIDE) är ren dekor/gångbart.
//
// Scenen renderas rakt in i .adv-map (scene-scroll.js: mapEl.innerHTML) och
// skalas till lagret via .adv-map > svg { width/height:100% } (games.css).
// ============================================================================

import { O } from "../../art-style.js";
// EN GEOMETRI-KÄLLA (issue #252): gläntan och alla hinder bor i spokjakten-map.js
// och läses av BÅDE konsten (här) och kollisionen → de kan aldrig driva isär.
import {
  WORLD,
  CLEARING_CENTER,
  OUTER,
  HOUSE,
  POND,
  GRAVESTONES,
  GRAVE_BLOCK_DY,
  FENCE_SEGMENTS,
  LANTERNS,
  PATH_MAIN,
  PATH_SIDE,
  smoothClosedPath,
  smoothOpenPath,
} from "./spokjakten-map.js";

// Världsmått (matchar WORLD i spokjakten-map.js). SVG:n ritas i dessa pixlar.
const W = WORLD.w;
const H = WORLD.h;
const CX = CLEARING_CENTER[0];
const CY = CLEARING_CENTER[1];

// --- Palett (mysig månskensnatt – samma som spokjakten.js) ------------------
const NATT = "#171B38";      // djup natt bortom trädridån (mörkast)
const NATT_LJUS = "#202648"; // lite ljusare natt (dis mot himlen)
const GRAS = "#33506E";      // glänta/gräs i månsken (svalt blågrönt)
const GRAS_LJUS = "#436A82";
const GRAS_MORK = "#2A4258";
const STIG = "#3F4566";      // kullerstensstig
const STIG_LJUS = "#535A84";
const STEN = "#9AA2C0";      // gravsten (blek i månljus)
const STEN_LJUS = "#C2C8DE";
const STEN_MORK = "#6E769A";
const TRA = "#4A3A55";       // trädstam / trä (mörk plommon)
const TRA_LJUS = "#5E4A6A";
const LOV = "#2E4E52";       // löv (dov nattgrön)
const LOV_MORK = "#243E42";
const LOV_LJUS = "#3E6A64";
const LYKTA_GLOD = "#FFD27A"; // varmt lyktsken
const LYKTA_LJUS = "#FFF0C4";
const METALL = "#4A4466";    // svart-lila metall
const FONSTER = "#FFCF6E";   // glödande fönster
const VATTEN = "#3C6E8C";    // dammvatten i månsken
const VATTEN_LJUS = "#9FD8EF";
const MANE = "#FBF3D0";      // måne

const L2 = `stroke="${O}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`;
const L3 = `stroke="${O}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"`;

/** Runda tal → 1 decimal (kompakt path-data). */
const n1 = (v) => Number(v).toFixed(1);

// Kurv-matten (smoothClosed/smoothOpen) bor i spokjakten-map.js så konsten ritar
// ur EXAKT samma spline som kollisionen samplar. Alias för läsbarhet.
const smoothClosed = smoothClosedPath;
const smoothOpen = smoothOpenPath;

/** Skala en punktlista mot gläntans centrum (f<1 = inåt, f>1 = utåt). */
function scalePts(pts, f) {
  return pts.map(([x, y]) => [CX + (x - CX) * f, CY + (y - CY) * f]);
}

// ============================================================================
// Delkonst (varje funktion returnerar en SVG-sträng i världspixlar)
// ============================================================================

/** Djup natt + stjärnor + måne (fyller hela världen; trädridån ritas ovanpå). */
function nightSky() {
  // Glesa, deterministiskt utspridda stjärnor över natt-bandet (ej i gläntan).
  let stars = "";
  const seeds = [
    [120, 90], [360, 60], [640, 40], [980, 54], [1300, 96], [1460, 240],
    [60, 300], [1490, 470], [40, 560], [1470, 700], [120, 860], [360, 960],
    [720, 995], [1060, 975], [1380, 900], [220, 170], [1200, 120], [80, 430],
  ];
  for (let i = 0; i < seeds.length; i++) {
    const [x, y] = seeds[i];
    const r = 1.4 + (i % 3) * 0.8;
    stars +=
      `<circle cx="${x}" cy="${y}" r="${r}" fill="#EAF0FF" opacity="${(0.45 + (i % 4) * 0.12).toFixed(2)}"/>`;
  }
  // Måne uppe-vänster (i natt-hörnet utanför gläntan), mjukt sken.
  const mx = 150, my = 130;
  const moon =
    `<defs><radialGradient id="sp-moon" cx="50%" cy="50%" r="50%">` +
    `<stop offset="0%" stop-color="${MANE}" stop-opacity="0.55"/>` +
    `<stop offset="60%" stop-color="${MANE}" stop-opacity="0.14"/>` +
    `<stop offset="100%" stop-color="${MANE}" stop-opacity="0"/></radialGradient></defs>` +
    `<circle cx="${mx}" cy="${my}" r="150" fill="url(#sp-moon)"/>` +
    `<circle cx="${mx}" cy="${my}" r="58" fill="${MANE}"/>` +
    `<circle cx="${mx - 18}" cy="${my - 10}" r="12" fill="#E9DFB6" opacity="0.55"/>` +
    `<circle cx="${mx + 22}" cy="${my + 16}" r="8" fill="#E9DFB6" opacity="0.5"/>`;
  return (
    `<rect x="0" y="0" width="${W}" height="${H}" fill="${NATT}"/>` +
    `<rect x="0" y="0" width="${W}" height="${H * 0.42}" fill="${NATT_LJUS}" opacity="0.6"/>` +
    stars +
    moon
  );
}

/** Gläntan: månljust gräs innanför OUTER-splinen (= exakt det gångbara). */
function clearing() {
  const inner = scalePts(OUTER, 0.9);
  // Mjuka ljusare månskensfläckar på gräset (ren dekor).
  const patches = [
    [560, 360, 120], [980, 420, 110], [700, 640, 120], [420, 500, 90],
    [1080, 620, 90], [820, 300, 80],
  ]
    .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${(r * 0.52).toFixed(0)}" fill="${GRAS_LJUS}" opacity="0.16"/>`)
    .join("");
  const dark = [
    [300, 640, 80], [1180, 500, 70], [640, 220, 70], [900, 760, 80],
  ]
    .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${(r * 0.5).toFixed(0)}" fill="${GRAS_MORK}" opacity="0.3"/>`)
    .join("");
  return (
    `<path d="${smoothClosed(OUTER)}" fill="${GRAS}"/>` +
    // svalt månsken faller uppifrån över gläntan
    `<path d="${smoothClosed(inner)}" fill="${GRAS_LJUS}" opacity="0.1"/>` +
    patches + dark
  );
}

/** Trädridå/natt runt gläntan: dova nattgröna kronor längs OUTER-kanten, så
 *  den synliga skogskanten ligger PRECIS där kollisionen börjar blockera. */
function treeRidge() {
  // Samla ridå-punkter: varje OUTER-punkt + mittpunkten till nästa, på två ringar
  // (strax utanför och strax på kanten) så ridån blir tät och hugger gränsen.
  const ring = [];
  const n = OUTER.length;
  for (let i = 0; i < n; i++) {
    const a = OUTER[i];
    const b = OUTER[(i + 1) % n];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    ring.push([a, i]);
    ring.push([mid, i + 0.5]);
  }
  let crowns = "";
  for (let k = 0; k < ring.length; k++) {
    const [p, idx] = ring[k];
    // Växla mellan yttre och kant-nära ring + varierad storlek (deterministiskt).
    const f = (k % 2 === 0) ? 1.055 : 1.005;
    const ex = CX + (p[0] - CX) * f;
    const ey = CY + (p[1] - CY) * f;
    const r = 44 + ((Math.floor(idx * 3) % 4) * 9);
    crowns += crown(ex, ey, r, k);
  }
  return crowns;
}
/** En dov trädkrona (3 klumpar) – natt-grön, mörk kontur. */
function crown(x, y, r, k) {
  const lift = (k % 3 === 0) ? 0.7 : 0.55;
  return (
    `<ellipse cx="${n1(x)}" cy="${n1(y + r * 0.5)}" rx="${n1(r)}" ry="${n1(r * 0.3)}" fill="${O}" opacity="0.2"/>` +
    `<circle cx="${n1(x - r * 0.55)}" cy="${n1(y + r * 0.15)}" r="${n1(r * 0.66)}" fill="${LOV_MORK}" ${L2}/>` +
    `<circle cx="${n1(x + r * 0.55)}" cy="${n1(y + r * 0.15)}" r="${n1(r * 0.62)}" fill="${LOV_MORK}" ${L2}/>` +
    `<circle cx="${n1(x)}" cy="${n1(y - r * 0.3)}" r="${n1(r * 0.78)}" fill="${LOV}" ${L2}/>` +
    `<circle cx="${n1(x - r * 0.2)}" cy="${n1(y - r * 0.25)}" r="${n1(r * 0.3)}" fill="${LOV_LJUS}" opacity="${lift}"/>`
  );
}

/** Slingrande kullerstensstigar (PATH_MAIN/PATH_SIDE) – ren dekor / gångbart. */
function paths() {
  const stroke = (d, w, c) =>
    `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const dMain = smoothOpen(PATH_MAIN);
  const dSide = smoothOpen(PATH_SIDE);
  // Bred bädd + ljusare mitt + kullersten-prickar (dash) så den läser som stig.
  const band = (d) =>
    stroke(d, 46, GRAS_MORK) +
    stroke(d, 36, STIG) +
    stroke(d, 24, STIG_LJUS) +
    `<path d="${d}" fill="none" stroke="${STIG}" stroke-width="24" stroke-linecap="round" stroke-dasharray="3 26" opacity="0.7"/>`;
  return band(dMain) + band(dSide);
}

/** Damm (POND, nere-vänster): sött månsken-vatten med strandkant + månspegling.
 *  Strandkant ritas ut till bankRx/bankRy, vattnet till rx/ry – kollisionen
 *  blockerar strax innanför strandkanten (POND_BLOCK_* i map.js). */
function pond() {
  const { cx, cy, rx, ry, bankRx, bankRy } = POND;
  return (
    `<ellipse cx="${cx}" cy="${cy + 6}" rx="${bankRx}" ry="${bankRy}" fill="${GRAS_MORK}" ${L2}/>` +
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${VATTEN}" ${L2}/>` +
    `<ellipse cx="${cx - 22}" cy="${cy - 20}" rx="${rx * 0.5}" ry="${ry * 0.42}" fill="${VATTEN_LJUS}" opacity="0.22"/>` +
    // månspegling + krusning
    `<ellipse cx="${cx + 18}" cy="${cy - 8}" rx="26" ry="10" fill="${MANE}" opacity="0.3"/>` +
    `<path d="M${cx - 56} ${cy + 14} q56 20 112 0" fill="none" stroke="${VATTEN_LJUS}" stroke-width="4" opacity="0.5"/>` +
    // ett par vassstrån vid kanten
    `<path d="M${cx - bankRx + 10} ${cy + 24} q-3 -26 4 -42 M${cx - bankRx + 22} ${cy + 28} q-2 -22 6 -36" ` +
    `fill="none" stroke="${LOV}" stroke-width="4" stroke-linecap="round" opacity="0.8"/>`
  );
}

/** Gammalt hus (HOUSE-footprint, uppe-höger) med varmt glödande fönster – mysigt. */
function house() {
  const { x, y, w, h } = HOUSE;
  const cx = x + w / 2;
  const winGrad =
    `<defs><radialGradient id="sp-win" cx="50%" cy="50%" r="60%">` +
    `<stop offset="0%" stop-color="${LYKTA_LJUS}"/>` +
    `<stop offset="100%" stop-color="${FONSTER}"/></radialGradient>` +
    `<radialGradient id="sp-house-glow" cx="50%" cy="50%" r="50%">` +
    `<stop offset="0%" stop-color="${LYKTA_GLOD}" stop-opacity="0.22"/>` +
    `<stop offset="100%" stop-color="${LYKTA_GLOD}" stop-opacity="0"/></radialGradient></defs>`;
  // Varmt sken ut i natten (ren dekor/ljus – blockerar inte).
  const glow = `<circle cx="${cx}" cy="${y + h * 0.55}" r="${w * 0.9}" fill="url(#sp-house-glow)"/>`;
  // Väggar (fyller större delen av boxen) + tak (tält) upptill inom boxen.
  const walls = `<rect x="${x + 8}" y="${y + 86}" width="${w - 16}" height="${h - 90}" rx="6" fill="${TRA}" ${L3}/>`;
  const roof = `<path d="M${x + 2} ${y + 98} L${cx} ${y + 8} L${x + w - 2} ${y + 98} Z" fill="${TRA_LJUS}" ${L3}/>`;
  const roofShade = `<path d="M${cx} ${y + 8} L${x + w - 2} ${y + 98} L${cx} ${y + 98} Z" fill="${O}" opacity="0.14"/>`;
  // Två glödande fönster + ett enkelt spröjs.
  const wy = y + 118;
  const win = (wx) =>
    `<rect x="${wx}" y="${wy}" width="48" height="48" rx="4" fill="url(#sp-win)" ${L2}/>` +
    `<path d="M${wx + 24} ${wy} v48 M${wx} ${wy + 24} h48" stroke="${METALL}" stroke-width="4"/>`;
  // Dörr.
  const door = `<rect x="${cx - 22}" y="${y + h - 70}" width="44" height="66" rx="6" fill="${TRA_MORK()}" ${L2}/>` +
    `<circle cx="${cx + 12}" cy="${y + h - 36}" r="3.5" fill="${LYKTA_GLOD}"/>`;
  return (
    winGrad + glow +
    `<ellipse cx="${cx}" cy="${y + h - 2}" rx="${w * 0.5}" ry="16" fill="${O}" opacity="0.18"/>` +
    walls + roof + roofShade +
    win(x + 34) + win(x + w - 82) +
    door
  );
}
function TRA_MORK() { return "#3A2E44"; }

/** Gravsten – bågformad, mjuk & vänlig häll. Ritas INOM block-ellipsen (rx30/ry36
 *  centrerad GRAVE_BLOCK_DY ovan foten) så kollisionen täcker hela den ritade stenen. */
function gravestone(g) {
  const cx = g.x;
  const cyc = g.y + GRAVE_BLOCK_DY; // block-ellipsens centrum
  const topY = cyc - 34;
  const shoulderY = cyc - 6;
  const yb = cyc + 22;
  const hw = 24; // halvbredd (< block rx 30)
  return (
    `<ellipse cx="${cx}" cy="${yb + 6}" rx="30" ry="8" fill="${O}" opacity="0.18"/>` +
    `<rect x="${cx - 27}" y="${yb}" width="54" height="10" rx="3" fill="${STEN_MORK}" ${L2}/>` +
    `<path d="M${cx - hw} ${yb} V${shoulderY} Q${cx - hw} ${topY} ${cx} ${topY} ` +
    `Q${cx + hw} ${topY} ${cx + hw} ${shoulderY} V${yb} Z" fill="${STEN}" ${L2}/>` +
    `<path d="M${cx - hw + 7} ${yb} V${shoulderY + 2} Q${cx - hw + 7} ${topY + 9} ${cx} ${topY + 9} ` +
    `Q${cx + hw - 7} ${topY + 9} ${cx + hw - 7} ${shoulderY + 2} V${yb}" fill="none" stroke="${STEN_LJUS}" stroke-width="3" opacity="0.6"/>` +
    `<path d="M${cx - 9} ${cyc - 2} h18 M${cx} ${cyc - 11} v26" stroke="${STEN_MORK}" stroke-width="3.6" stroke-linecap="round"/>`
  );
}
function gravestones() {
  return GRAVESTONES.map((g) => gravestone(g)).join("");
}

/** Lågt trästaket längs ett FENCE_SEGMENT (håller sig inom FENCE_HALF_WIDTH). */
function fenceSeg(seg) {
  const [a, b] = seg;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;     // längs linjen
  const px = -uy, py = ux;                 // vinkelrätt (för de två skenorna)
  const rail = (off) => {
    const ax = a[0] + px * off, ay = a[1] + py * off;
    const bx = b[0] + px * off, by = b[1] + py * off;
    return `<path d="M${n1(ax)} ${n1(ay)} L${n1(bx)} ${n1(by)}" stroke="${TRA}" stroke-width="7" stroke-linecap="round"/>`;
  };
  // Stolpar utmed segmentet.
  let stakes = "";
  const step = 46;
  for (let d = 0; d <= len; d += step) {
    const sx = a[0] + ux * d, sy = a[1] + uy * d;
    stakes +=
      `<path d="M${n1(sx - px * 3)} ${n1(sy - py * 3 + 6)} ` +
      `L${n1(sx - px * 3)} ${n1(sy - py * 3 - 10)} L${n1(sx)} ${n1(sy - py * 3 - 16)} ` +
      `L${n1(sx + px * 3)} ${n1(sy + py * 3 - 10)} L${n1(sx + px * 3)} ${n1(sy + py * 3 + 6)} Z" ` +
      `fill="${TRA_LJUS}" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/>`;
  }
  return rail(-6) + rail(6) + stakes;
}
function fences() {
  return FENCE_SEGMENTS.map((s) => fenceSeg(s)).join("");
}

/** Lykta: smal stolpe (= det enda som blockerar, LANTERN_BLOCK_R) + varmt sken
 *  som lyser upp stigen (skenet är gångbart ljus, ritas som mjuk halo). */
function lantern(l, i) {
  const { x, y } = l;
  const gid = `sp-lglow-${i}`;
  return (
    `<defs><radialGradient id="${gid}" cx="50%" cy="40%" r="55%">` +
    `<stop offset="0%" stop-color="${LYKTA_LJUS}" stop-opacity="0.9"/>` +
    `<stop offset="50%" stop-color="${LYKTA_GLOD}" stop-opacity="0.32"/>` +
    `<stop offset="100%" stop-color="${LYKTA_GLOD}" stop-opacity="0"/></radialGradient></defs>` +
    `<circle cx="${x}" cy="${y - 44}" r="96" fill="url(#${gid})"/>` +
    // fot-skugga
    `<ellipse cx="${x}" cy="${y + 6}" rx="16" ry="5" fill="${O}" opacity="0.18"/>` +
    // smal stolpe (inom LANTERN_BLOCK_R = 18)
    `<rect x="${x - 5}" y="${y - 56}" width="10" height="62" rx="4" fill="${METALL}" ${L2}/>` +
    `<path d="M${x - 12} ${y + 4} h24" stroke="${METALL}" stroke-width="6" stroke-linecap="round"/>` +
    // lykthus med glödande ljus
    `<path d="M${x - 14} ${y - 60} h28 l-4 -10 h-20 Z" fill="${METALL}" ${L2}/>` +
    `<rect x="${x - 13}" y="${y - 88}" width="26" height="28" rx="4" fill="${LYKTA_GLOD}" ${L2}/>` +
    `<rect x="${x - 8}" y="${y - 83}" width="16" height="18" rx="2" fill="${LYKTA_LJUS}"/>` +
    `<path d="M${x} ${y - 90} v-5" stroke="${METALL}" stroke-width="3.4" stroke-linecap="round"/>`
  );
}
function lanterns() {
  return LANTERNS.map((l, i) => lantern(l, i)).join("");
}

/** Mjuka dimslingor utspridda över gläntan (ren dekor – mysig nattdimma). */
function mist() {
  const wisps = [
    [260, 560, 360, 0.12], [620, 820, 420, 0.1], [980, 690, 380, 0.1],
    [820, 420, 340, 0.09], [460, 300, 300, 0.08], [1160, 560, 300, 0.09],
  ];
  return wisps
    .map(([x, y, w, op]) =>
      `<path d="M${x - w / 2} ${y} q${w / 4} -22 ${w / 2} 0 t${w / 2} 0" fill="none" ` +
      `stroke="#EAF0FF" stroke-width="16" stroke-linecap="round" opacity="${op}"/>`
    )
    .join("");
}

// ============================================================================
// Hela natt-scenen som en inline-SVG-sträng (bakifrån och fram).
// ============================================================================
export const SPOKJAKTEN_SCEN_SVG =
  `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">` +
  nightSky() +   // djup natt + stjärnor + måne (hela världen)
  clearing() +   // månljust gräs innanför OUTER (= gångbart)
  treeRidge() +  // dov trädridå PÅ gläntans kant (= natt/blockerat)
  paths() +      // slingrande kullerstensstigar (dekor/gångbart)
  pond() +       // damm (blockerat)
  fences() +     // staket (blockerat)
  gravestones() +// gravstenar (blockerat)
  house() +      // gammalt hus med varmt fönster (blockerat)
  lanterns() +   // lyktor: smal stolpe blockerar, skenet gångbart
  mist() +       // nattdimma (dekor)
  `</svg>`;
