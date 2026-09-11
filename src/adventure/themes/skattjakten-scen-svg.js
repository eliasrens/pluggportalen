// ============================================================================
// Pluggportalen – äventyrsmotorn: themes/skattjakten-scen-svg.js  (issue #238)
// ----------------------------------------------------------------------------
// EGENRITAD (handbyggd) inline-SVG-värld för Skattjakten – ersätter den gamla
// rasterbilden (skattjakten-karta.jpg). Referensbilden var ENDAST inspiration;
// här ritas ön för hand i portalens platta vektorstil (src/art-style.js: mörk
// plommonkontur, mjuka former, glad palett) – ingen fotorealism, inga pixlar.
//
// KONSTEN FÖLJER BANANS GEOMETRI (themes/skattjakten-map.js): allt är i
// världspixlar 1536×1024, och kustlinjen/hindren ritas så de VISUELLT matchar
// kollisionen – blått hav runt kanten, ön bredast i mitten (grid-rad 4–7),
// avsmalnande upp/ned, hav i hörnen; klippor (CLIFF_NW/CLIFF_MID), damm (POND),
// å med BRO (STREAM_N/STREAM_S + gångbar lucka) samt brygga + båt vid START_AT.
// Städat hårdare (issue #286): ruiner + läger borttagna, hav glesat.
// Runda 3 (issue #289): stigen och X-markeringen HELT borta, palmerna (såg solida
// ut men var gångbara = visuellt ohederligt) ersatta av LÅG, tydligt gångbar
// grönska i flera typer, och lugnet byggs av mjuka gräs-nyanser i marken i
// stället för utspridda objekt.
//
// Scenen renderas rakt in i .adv-map (scene-scroll.js: mapEl.innerHTML) och
// skalas till lagret via .adv-map > svg { width/height:100% } (games.css).
// ============================================================================

import { O } from "../../art-style.js";
// EN GEOMETRI-KÄLLA (issue #243): kustlinjen och alla hinder bor i skattjakten-map.js
// och läses av BÅDE konsten (här) och kollisionen → de kan aldrig driva isär.
import {
  WORLD,
  ISLAND_CENTER,
  COAST,
  POND,
  STREAM_UPPER,
  STREAM_LOWER,
  BRIDGE,
  CLIFF_NW,
  CLIFF_MID,
  cliffStones,
  BLOCKING_BUSHES,
  smoothClosedPath,
  smoothOpenPath,
} from "./skattjakten-map.js";

// Världsmått (matchar WORLD i skattjakten-map.js). SVG:n ritas i dessa pixlar.
const W = WORLD.w;
const H = WORLD.h;

// --- Palett (tropisk ö, ur stilguiden) --------------------------------------
const HAV_DJUP = "#2F8FC4"; // öppet hav (samma ton som temats stamning.mark)
const HAV = "#3AA0D4";
const HAV_GRUND = "#7FC7E8"; // grunt vatten närmast stranden (him-blå)
const SAND = "#FBEFCB";
const SAND_MORK = "#EAD79E";
const GRAS = "#6FC66F";
const GRAS_LJUS = "#8FD98A";
const GRAS_MORK = "#57A85A";
const STEN = "#998B79";
const STEN_LJUS = "#BDAF9B";
const STEN_MORK = "#6E6254";
const TRA = "#B0805A";
const TRA_MORK = "#8A6242";
const VATTEN = "#5FB8E0"; // damm/å (ljusare sött vatten)
const VATTEN_LJUS = "#AEE4F2";
const TALT = "#F49E4C";
const TALT_MORK = "#EF6F6C";

const L2 = `stroke="${O}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`;
const L3 = `stroke="${O}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"`;

/** Runda tal → 1 decimal (kompakt path-data). */
const n1 = (v) => Number(v).toFixed(1);

// Kurv-matten (smoothClosed/smoothOpen) bor i skattjakten-map.js så konsten ritar
// ur EXAKT samma spline som kollisionen samplar (issue #243 r2). Alias för läsbarhet.
const smoothClosed = smoothClosedPath;
const smoothOpen = smoothOpenPath;

// --- Kustlinje: organisk blob (COAST/ISLAND_CENTER importeras från map.js så
// konst och kollision delar EXAKT samma kustlinje – issue #243). Bredast i mitten,
// smalnar upp/ned; hav biter in i hörnen. Kollisionen blockerar allt utanför COAST.
const CENTER = ISLAND_CENTER;
/** Skala en punktlista mot öns centrum (f<1 = inåt, för gräs innanför sanden). */
function inset(pts, f) {
  return pts.map(([x, y]) => [CENTER[0] + (x - CENTER[0]) * f, CENTER[1] + (y - CENTER[1]) * f]);
}

// ============================================================================
// Delkonst (varje funktion returnerar en SVG-sträng i världspixlar)
// ============================================================================

/** Havsbotten + vågtextur + grund vatten-halo runt ön. */
function ocean() {
  // Glesa, subtila vågfläckar (issue #286): större steg + lägre opacitet så havet
  // läser som en lugn yta istället för ett tätt vågmönster.
  const waves = [];
  for (let y = 120; y < H; y += 300) {
    for (let x = 80; x < W; x += 520) {
      const ox = x + ((y / 300) % 2) * 260;
      waves.push(
        `<path d="M${n1(ox)} ${y} q22 -12 44 0 t44 0" fill="none" stroke="${HAV_GRUND}" stroke-width="4" opacity="0.22"/>`
      );
    }
  }
  return (
    `<rect x="0" y="0" width="${W}" height="${H}" fill="${HAV_DJUP}"/>` +
    `<rect x="0" y="0" width="${W}" height="${H}" fill="${HAV}" opacity="0.35"/>` +
    waves.join("") +
    `<path d="${smoothClosed(inset(COAST, 1.055))}" fill="${HAV_GRUND}" opacity="0.55"/>`
  );
}

/** Landmassan: sandstrand som kant + grönt gräs inåt, med mjuka gräs-nyanser.
 *  Lugnet byggs av subtila färgfläckar i marken (issue #289) – liv utan brus –
 *  i stället för utspridda distinkta objekt. Allt är ren mark, ingen kollision. */
function land() {
  const grass = inset(COAST, 0.9);
  // Mjuka nyansfläckar: oregelbundet utspridda ellipser i mörkare/ljusare grönt
  // med LÅG opacitet – ger ängen liv på håll utan att någon enskild fläck syns
  // som ett "objekt". Mörka och ljusa zoner omlott, varierade storlekar.
  const dark = [
    [420, 380, 120, 0.09], [900, 430, 100, 0.09], [640, 700, 130, 0.08],
    [260, 560, 90, 0.08], [1120, 590, 95, 0.08], [530, 190, 80, 0.07],
    [980, 250, 110, 0.08], [790, 555, 70, 0.07],
  ]
    .map(([x, y, r, o]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${n1(r * 0.55)}" fill="${GRAS_MORK}" opacity="${o}"/>`)
    .join("");
  const bright = [
    [700, 480, 140, 0.12], [340, 300, 90, 0.1], [1240, 480, 100, 0.1],
    [500, 620, 85, 0.09], [860, 330, 95, 0.09], [720, 210, 75, 0.08],
    [420, 760, 90, 0.09],
  ]
    .map(([x, y, r, o]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${n1(r * 0.5)}" fill="${GRAS_LJUS}" opacity="${o}"/>`)
    .join("");
  return (
    `<path d="${smoothClosed(COAST)}" fill="${SAND}" ${L3}/>` +
    `<path d="${smoothClosed(inset(COAST, 0.955))}" fill="${SAND_MORK}" opacity="0.5" stroke="none"/>` +
    `<path d="${smoothClosed(grass)}" fill="${GRAS}" ${L2}/>` +
    bright + dark
  );
}

/** Damm (POND, uppe-mitten): liten blå damm med sandkant (geometri ur map.js). */
function pond() {
  const cx = POND.cx, cy = POND.cy;
  return (
    `<ellipse cx="${cx}" cy="${cy}" rx="${POND.sandRx}" ry="${POND.sandRy}" fill="${SAND_MORK}" ${L2}/>` +
    `<ellipse cx="${cx}" cy="${cy}" rx="${POND.rx}" ry="${POND.ry}" fill="${VATTEN}"/>` +
    `<ellipse cx="${cx - 26}" cy="${cy - 22}" rx="42" ry="24" fill="${VATTEN_LJUS}" opacity="0.6"/>` +
    `<path d="M${cx - 60} ${cy + 10} q60 26 120 0" fill="none" stroke="${VATTEN_LJUS}" stroke-width="5" opacity="0.7"/>` +
    lilja(cx + 34, cy + 8)
  );
}
function lilja(x, y) {
  return `<circle cx="${x}" cy="${y}" r="13" fill="${GRAS}" ${L2}/><circle cx="${x}" cy="${y}" r="4" fill="${TALT}"/>`;
}

/** Å med vattenfall (STREAM_N), bro över mellanrummet, och nedre lopp till havet
 *  (STREAM_S). Bron är den gångbara luckan y≈0.42–0.48. */
function streamAndBridge() {
  // Åns lopp (STREAM_UPPER/STREAM_LOWER) och bron (BRIDGE) kommer ur map.js så
  // kollisionen följer exakt samma vatten och samma bro-lucka (issue #243).
  const upper = smoothOpen(STREAM_UPPER);
  const lower = smoothOpen(STREAM_LOWER);
  const water = (d, w) =>
    `<path d="${d}" fill="none" stroke="${VATTEN}" stroke-width="${w}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${VATTEN_LJUS}" stroke-width="${w * 0.4}" stroke-linecap="round" opacity="0.7"/>`;
  // Litet vattenfall upptill (skum).
  const fall =
    `<rect x="1188" y="286" width="44" height="30" rx="10" fill="${VATTEN_LJUS}"/>` +
    `<ellipse cx="1210" cy="316" rx="26" ry="8" fill="#fff" opacity="0.7"/>`;
  // Bro (gångbar lucka): tvärgående plankbro med räcken över gapet y≈430–500.
  const bx = BRIDGE.cx, by = BRIDGE.cy, bw = BRIDGE.w, bh = BRIDGE.h;
  const bridge =
    `<g transform="rotate(${BRIDGE.rotDeg} ${bx} ${by})">` +
    `<rect x="${bx - bw / 2}" y="${by - bh / 2}" width="${bw}" height="${bh}" rx="8" fill="${TRA}" ${L2}/>` +
    planks(bx - bw / 2, by - bh / 2, bw, bh) +
    `<rect x="${bx - bw / 2}" y="${by - bh / 2 - 10}" width="${bw}" height="8" rx="4" fill="${TRA_MORK}" ${L2}/>` +
    `<rect x="${bx - bw / 2}" y="${by + bh / 2 + 2}" width="${bw}" height="8" rx="4" fill="${TRA_MORK}" ${L2}/>` +
    `</g>`;
  return water(upper, 40) + fall + water(lower, 40) + bridge;
}
function planks(x, y, w, h) {
  let s = "";
  for (let i = 1; i < 6; i++) s += `<line x1="${x + (w / 6) * i}" y1="${y + 3}" x2="${x + (w / 6) * i}" y2="${y + h - 3}" stroke="${TRA_MORK}" stroke-width="3" opacity="0.7"/>`;
  return s;
}

/** Klippformation (staplade stenblock). */
function cliff(rect) {
  // Stenblocken kommer ur map.js (cliffStones) → konsten ritar EXAKT de block
  // kollisionen blockerar (issue #243 r2, ingen partiell täckning).
  return cliffStones(rect)
    .map(([bx, by, r], i) =>
      `<path d="M${n1(bx - r)} ${n1(by + r * 0.7)} Q${n1(bx - r)} ${n1(by - r)} ${n1(bx)} ${n1(by - r)} ` +
      `Q${n1(bx + r)} ${n1(by - r)} ${n1(bx + r)} ${n1(by + r * 0.7)} Z" ` +
      `fill="${i % 2 ? STEN : STEN_LJUS}" ${L2}/>` +
      `<ellipse cx="${n1(bx - r * 0.3)} " cy="${n1(by - r * 0.2)}" rx="${n1(r * 0.4)}" ry="${n1(r * 0.28)}" fill="${STEN_LJUS}" opacity="0.5"/>`
    )
    .join("");
}
/** Klipporna: NV-hörnet (CLIFF_NW) + center-nedre klippkluster (CLIFF_MID).
 *  Boxarna kommer ur map.js så kollisionen blockerar exakt de ritade klustren. */
function cliffs() {
  return `<g>${cliff(CLIFF_NW)}</g>` + `<g>${cliff(CLIFF_MID)}</g>`;
}

function GULDish() { return "#F7C948"; }

/** Brygga + liten båt vid START_AT (~0.74,0.66, nere-höger, "anländer med båt"). */
function jettyBoat() {
  const x = 1137, y = 676;
  const deck =
    `<rect x="${x - 34}" y="${y - 18}" width="200" height="46" rx="8" fill="${TRA}" ${L2}/>` +
    planks2(x - 34, y - 18, 200, 46) +
    pile(x - 20, y + 24) + pile(x + 60, y + 24) + pile(x + 140, y + 24);
  // Liten båt vid bryggkanten (höger, mot havet).
  const bx = x + 210, by = y + 6;
  const boat =
    `<path d="M${bx - 70} ${by} Q${bx} ${by + 54} ${bx + 70} ${by} Z" fill="${TRA_MORK}" ${L3}/>` +
    `<path d="M${bx - 70} ${by} L${bx + 70} ${by}" stroke="${TRA}" stroke-width="10" stroke-linecap="round"/>` +
    `<rect x="${bx - 4}" y="${by - 96}" width="8" height="96" rx="3" fill="${TRA_MORK}" ${L2}/>` +
    `<path d="M${bx + 4} ${by - 92} L${bx + 60} ${by - 40} L${bx + 4} ${by - 20} Z" fill="${SAND}" ${L2}/>`;
  return deck + boat;
}
function pile(x, y) { return `<rect x="${x}" y="${y}" width="12" height="34" rx="4" fill="${TRA_MORK}" ${L2}/>`; }
function planks2(x, y, w, h) {
  let s = "";
  for (let i = 1; i < 7; i++) s += `<line x1="${x + (w / 7) * i}" y1="${y + 3}" x2="${x + (w / 7) * i}" y2="${y + h - 3}" stroke="${TRA_MORK}" stroke-width="3" opacity="0.6"/>`;
  return s;
}

/** Buske som RIKTIGT hinder (blockerar) – ritas rejäl/solid med bär så den tydligt
 *  läser som ett hinder, inte som gångbar markdekor. Placeras vid BLOCKING_BUSHES
 *  och kollisionen täcker hela kronan (issue #243 r2). */
function bush(x, y, s = 1) {
  return (
    `<ellipse cx="${x}" cy="${y + 10 * s}" rx="${38 * s}" ry="${10 * s}" fill="${O}" opacity="0.14"/>` +
    `<circle cx="${x - 20 * s}" cy="${y + 2 * s}" r="${22 * s}" fill="${GRAS_MORK}" ${L2}/>` +
    `<circle cx="${x + 20 * s}" cy="${y + 2 * s}" r="${22 * s}" fill="${GRAS_MORK}" ${L2}/>` +
    `<circle cx="${x}" cy="${y - 6 * s}" r="${26 * s}" fill="${GRAS}" ${L2}/>` +
    `<circle cx="${x - 10 * s}" cy="${y - 2 * s}" r="${14 * s}" fill="${GRAS_LJUS}" opacity="0.6"/>` +
    // bär (röda prickar) → tydligt en buske, inte gräs
    `<circle cx="${x + 8 * s}" cy="${y - 4 * s}" r="${4 * s}" fill="${TALT_MORK}"/>` +
    `<circle cx="${x - 4 * s}" cy="${y + 6 * s}" r="${4 * s}" fill="${TALT_MORK}"/>` +
    `<circle cx="${x + 16 * s}" cy="${y + 4 * s}" r="${4 * s}" fill="${TALT_MORK}"/>`
  );
}
/** Grästuvor (låg, platt markdekor) – ser TYDLIGT gångbar ut, ingen kollision. */
function grassTuft(x, y, s = 1) {
  const blade = (dx, h) =>
    `<path d="M${x + dx * s} ${y + 6 * s} q${n1(-dx * 0.4 * s)} ${n1(-h * 0.6 * s)} ${n1(dx * 0.5 * s)} ${n1(-h * s)}" fill="none" stroke="${GRAS_MORK}" stroke-width="${n1(4 * s)}" stroke-linecap="round" opacity="0.85"/>`;
  return (
    `<ellipse cx="${x}" cy="${y + 8 * s}" rx="${26 * s}" ry="${6 * s}" fill="${GRAS_MORK}" opacity="0.18"/>` +
    blade(-12, 22) + blade(-4, 30) + blade(4, 26) + blade(12, 20) + blade(0, 34)
  );
}
/** Låg marktäckande buskplätt (issue #289): PLATT liten grönskekudde utan mörk
 *  kontur – smälter in i gräset och läser tydligt som gångbar mark (till skillnad
 *  från de solida hinder-buskarna med kontur + bär). Ingen kollision. */
function groundShrub(x, y, s = 1) {
  return (
    `<ellipse cx="${x - 14 * s}" cy="${y + 2 * s}" rx="${20 * s}" ry="${10 * s}" fill="${GRAS_MORK}" opacity="0.5"/>` +
    `<ellipse cx="${x + 14 * s}" cy="${y + 3 * s}" rx="${18 * s}" ry="${9 * s}" fill="${GRAS_MORK}" opacity="0.45"/>` +
    `<ellipse cx="${x}" cy="${y - 3 * s}" rx="${22 * s}" ry="${11 * s}" fill="${GRAS_LJUS}" opacity="0.75"/>` +
    `<ellipse cx="${x - 6 * s}" cy="${y - 5 * s}" rx="${10 * s}" ry="${5 * s}" fill="#B9E8AC" opacity="0.7"/>` +
    `<circle cx="${x + 9 * s}" cy="${y - 2 * s}" r="${2.5 * s}" fill="${GRAS_MORK}" opacity="0.5"/>` +
    `<circle cx="${x - 13 * s}" cy="${y + 1 * s}" r="${2.5 * s}" fill="${GRAS_MORK}" opacity="0.45"/>`
  );
}
/** Litet lågt blad-skott (ormbunksaktigt) – låg gångbar markdekor, ingen kollision. */
function sprout(x, y, s = 1) {
  const leaf = (dx, h) =>
    `<path d="M${x} ${y + 4 * s} q${n1(dx * 0.7)} ${n1(-h * 0.7)} ${dx} ${-h}" fill="none" stroke="${GRAS_MORK}" stroke-width="${n1(4 * s)}" stroke-linecap="round" opacity="0.55"/>`;
  return (
    `<ellipse cx="${x}" cy="${y + 7 * s}" rx="${18 * s}" ry="${5 * s}" fill="${GRAS_MORK}" opacity="0.15"/>` +
    leaf(-16 * s, 18 * s) + leaf(16 * s, 18 * s) + leaf(-6 * s, 26 * s) + leaf(7 * s, 24 * s)
  );
}
/** Blomma (låg markdekor) – gångbar, ingen kollision. */
function flower(x, y) {
  const petal = (a) =>
    `<circle cx="${x + Math.cos(a) * 8}" cy="${y - 10 + Math.sin(a) * 8}" r="6" fill="#F6A6C1" ${L2}/>`;
  return (
    `<path d="M${x} ${y + 6} q-3 -12 0 -18" fill="none" stroke="${GRAS_MORK}" stroke-width="3" stroke-linecap="round"/>` +
    petal(0) + petal(1.256) + petal(2.513) + petal(3.769) + petal(5.026) +
    `<circle cx="${x}" cy="${y - 10}" r="5" fill="${GULDish()}" ${L2}/>`
  );
}
/** Sten (dekor). */
function rock(x, y, s = 1) {
  return (
    `<ellipse cx="${x}" cy="${y + 6 * s}" rx="${26 * s}" ry="${7 * s}" fill="${O}" opacity="0.1"/>` +
    `<path d="M${x - 24 * s} ${y + 8 * s} Q${x - 26 * s} ${y - 18 * s} ${x} ${y - 18 * s} Q${x + 26 * s} ${y - 18 * s} ${x + 24 * s} ${y + 8 * s} Z" fill="${STEN}" ${L2}/>` +
    `<ellipse cx="${x - 6 * s}" cy="${y - 6 * s}" rx="${10 * s}" ry="${6 * s}" fill="${STEN_LJUS}" opacity="0.6"/>`
  );
}

/** Utspridd dekor. Visuellt ÄRLIG (issue #243 r2 + #289): ALL låg grönska
 *  (tuvor, marktäckare, skott, blommor) och stenarna är gångbar markdekor utan
 *  kollision – låg och platt så den aldrig läser som hinder; endast de FÅ
 *  buskarna (BLOCKING_BUSHES) ritas solida med kontur+bär OCH blockerar. */
function decor() {
  // Runda 3 (issue #289): palmerna borta (solida-ut-men-gångbara = ohederligt).
  // I stället varierad LÅG grönska i flera typer – tuvor, marktäckande plättar,
  // små bladskott, någon blomma – glest utspridda så ön känns levande men lugn.
  // Fritt från damm/å/bro/klippor/hinder-buskar/brygga. Blockerande buskar orörda.
  const rocks = [[980, 700, 0.8], [300, 720, 0.8], [820, 380, 0.8]];
  const shrubs = [[190, 500, 1], [1270, 540, 1.1], [700, 790, 1], [450, 320, 0.85], [960, 300, 0.9]];
  const tufts = [[880, 540, 1], [430, 560, 1], [270, 620, 0.85], [760, 240, 0.9], [1010, 430, 0.85], [660, 610, 0.9]];
  const sprouts = [[340, 420, 1], [620, 480, 0.9], [1230, 420, 1], [820, 640, 0.9]];
  const flowers = [[520, 400], [820, 300], [240, 380]];
  return (
    rocks.map(([x, y, s]) => rock(x, y, s)).join("") +
    shrubs.map(([x, y, s]) => groundShrub(x, y, s)).join("") +
    tufts.map(([x, y, s]) => grassTuft(x, y, s)).join("") +
    sprouts.map(([x, y, s]) => sprout(x, y, s)).join("") +
    flowers.map(([x, y]) => flower(x, y)).join("") +
    // De få RIKTIGA hinder-buskarna (solid + kollision, delad källa map.js).
    BLOCKING_BUSHES.map((b) => bush(b.x, b.y, 1)).join("")
  );
}

// ============================================================================
// Hela ö-scenen som en inline-SVG-sträng (bakifrån och fram).
// Stigen (trail) och X-markeringen är HELT borttagna (issue #289) – kistan visar
// ändå målet när kartan är hel, och lugnet kommer ur gräs-nyanserna i land().
// ============================================================================
export const SKATTJAKTEN_SCEN_SVG =
  `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">` +
  ocean() +
  land() +
  pond() +
  streamAndBridge() +
  cliffs() +
  jettyBoat() +
  decor() +
  `</svg>`;
