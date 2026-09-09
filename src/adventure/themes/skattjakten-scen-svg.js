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
// ruiner (RUINS), å med BRO (STREAM_N/STREAM_S + gångbar lucka), läger, brygga
// + båt vid START_AT och diskreta röda X vid CHEST_CANDIDATES.
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
  RUINS,
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
const ROD = "#EF6F6C"; // X-markeringar
const RUIN = "#C9BCA6";
const RUIN_MORK = "#9C8F79";

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
  const waves = [];
  for (let y = 90; y < H; y += 150) {
    for (let x = 60; x < W; x += 260) {
      const ox = x + ((y / 150) % 2) * 130;
      waves.push(
        `<path d="M${n1(ox)} ${y} q22 -12 44 0 t44 0" fill="none" stroke="${HAV_GRUND}" stroke-width="4" opacity="0.35"/>`
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

/** Landmassan: sandstrand som kant + grönt gräs inåt, med lite texturfläckar. */
function land() {
  const grass = inset(COAST, 0.9);
  const patches = [
    [430, 360, 70], [900, 430, 90], [640, 640, 80], [1080, 560, 60],
    [330, 560, 55], [760, 300, 60], [520, 760, 55], [1180, 470, 50],
  ]
    .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.62}" fill="${GRAS_MORK}" opacity="0.22"/>`)
    .join("");
  const bright = [
    [700, 420, 120], [500, 520, 90], [900, 620, 90],
  ]
    .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.5}" fill="${GRAS_LJUS}" opacity="0.35"/>`)
    .join("");
  return (
    `<path d="${smoothClosed(COAST)}" fill="${SAND}" ${L3}/>` +
    `<path d="${smoothClosed(inset(COAST, 0.955))}" fill="${SAND_MORK}" opacity="0.5" stroke="none"/>` +
    `<path d="${smoothClosed(grass)}" fill="${GRAS}" ${L2}/>` +
    bright + patches
  );
}

/** Slingrande sandstig som binder ihop spawn-platserna (blockerar inte). */
function trail() {
  const pts = [
    [1120, 690], [960, 660], [760, 600], [620, 560], [470, 512],
    [372, 420], [320, 340], [430, 285], [610, 292], [770, 315], [960, 320],
  ];
  const d = smoothOpen(pts);
  return (
    `<path d="${d}" fill="none" stroke="${SAND_MORK}" stroke-width="42" stroke-linecap="round" opacity="0.9"/>` +
    `<path d="${d}" fill="none" stroke="${SAND}" stroke-width="30" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${SAND_MORK}" stroke-width="30" stroke-linecap="round" stroke-dasharray="2 34" opacity="0.6"/>`
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
    lilja(cx + 34, cy + 8) + lilja(cx - 40, cy + 30)
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

/** Ruiner (RUINS, uppe-höger): brutna stenpelare + fundament. (x,y) = konstens
 *  origo ur map.js; hela footprinten blockeras i kollisionen (issue #243). */
function ruins() {
  const x = RUINS.x, y = RUINS.y;
  const col = (cx, top, w) =>
    `<rect x="${cx - w / 2}" y="${top}" width="${w}" height="${y + 165 - top}" rx="6" fill="${RUIN}" ${L2}/>` +
    `<line x1="${cx}" y1="${top + 6}" x2="${cx}" y2="${y + 158}" stroke="${RUIN_MORK}" stroke-width="4" opacity="0.6"/>`;
  return (
    `<ellipse cx="${x + 165}" cy="${y + 168}" rx="185" ry="26" fill="${O}" opacity="0.1"/>` +
    `<rect x="${x + 10}" y="${y + 150}" width="310" height="22" rx="8" fill="${RUIN_MORK}" ${L2}/>` +
    col(x + 55, y + 40, 46) + col(x + 150, y + 12, 46) + col(x + 250, y + 66, 46) +
    `<rect x="${x + 120}" y="${y + 4}" width="120" height="20" rx="6" fill="${RUIN}" ${L2}/>` +
    `<rect x="${x + 240}" y="${y + 110}" width="60" height="30" rx="6" fill="${RUIN}" ${L2}/>`
  );
}

/** Läger/tält (~0.2,0.36, vänster) med lägereld. */
function camp() {
  const x = 307, y = 369;
  return (
    `<ellipse cx="${x}" cy="${y + 60}" rx="120" ry="24" fill="${O}" opacity="0.1"/>` +
    `<path d="M${x - 78} ${y + 58} L${x} ${y - 66} L${x + 78} ${y + 58} Z" fill="${TALT}" ${L3}/>` +
    `<path d="M${x} ${y - 66} L${x} ${y + 58} L${x - 78} ${y + 58} Z" fill="${TALT_MORK}" ${L2}/>` +
    `<path d="M${x - 24} ${y + 58} L${x} ${y + 14} L${x + 24} ${y + 58} Z" fill="${O}" opacity="0.55"/>` +
    // liten lägereld till höger om tältet
    `<ellipse cx="${x + 128}" cy="${y + 52}" rx="30" ry="10" fill="${STEN}" opacity="0.7"/>` +
    `<path d="M${x + 128} ${y + 14} q18 20 0 38 q-18 -18 0 -38 Z" fill="${TALT}" ${L2}/>` +
    `<path d="M${x + 128} ${y + 26} q9 12 0 24 q-9 -10 0 -24 Z" fill="${GULDish()}"/>`
  );
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

/** Palm (dekor, blockerar inte). */
function palm(x, y, s = 1) {
  const t = (d) => `<path d="${d}" fill="none" stroke="${TRA_MORK}" stroke-width="${16 * s}" stroke-linecap="round"/>`;
  const leaf = (dx, dy) =>
    `<path d="M${x} ${y - 108 * s} q${dx} ${dy} ${dx * 1.5} ${dy + 22 * s}" fill="none" stroke="${GRAS_MORK}" stroke-width="${13 * s}" stroke-linecap="round"/>`;
  return (
    `<ellipse cx="${x}" cy="${y + 6}" rx="${34 * s}" ry="${9 * s}" fill="${O}" opacity="0.1"/>` +
    t(`M${x} ${y} Q${x - 12 * s} ${y - 60 * s} ${x + 6 * s} ${y - 108 * s}`) +
    leaf(-70 * s, -8 * s) + leaf(-40 * s, 30 * s) + leaf(70 * s, -8 * s) + leaf(40 * s, 30 * s) + leaf(0, -40 * s) +
    `<circle cx="${x + 6 * s}" cy="${y - 108 * s}" r="${10 * s}" fill="${TRA}"/>`
  );
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
function grassTuft(x, y) {
  const blade = (dx, h) =>
    `<path d="M${x + dx} ${y + 6} q${-dx * 0.4} ${-h * 0.6} ${dx * 0.5} ${-h}" fill="none" stroke="${GRAS_MORK}" stroke-width="4" stroke-linecap="round" opacity="0.85"/>`;
  return (
    `<ellipse cx="${x}" cy="${y + 8}" rx="26" ry="6" fill="${GRAS_MORK}" opacity="0.18"/>` +
    blade(-12, 22) + blade(-4, 30) + blade(4, 26) + blade(12, 20) + blade(0, 34)
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

/** Utspridd dekor. Visuellt ÄRLIG (issue #243 r2): palmer, stenar, grästuvor och
 *  blommor är LÅG/tydligt gångbar markdekor utan kollision; endast de FÅ buskarna
 *  (BLOCKING_BUSHES) ritas solida OCH blockerar. */
function decor() {
  const palms = [[150, 470, 1.1], [1300, 470, 1], [430, 830, 0.9], [1060, 780, 0.95], [760, 470, 0.8], [250, 300, 0.85]];
  const rocks = [[600, 500], [980, 700], [300, 720], [820, 380], [500, 640], [1220, 640]];
  // Låg, gångbar markdekor där buskarna förr stod (+ lite till).
  const flowers = [[520, 400], [1000, 400], [1180, 560], [360, 640], [820, 300]];
  const tufts = [[880, 540], [640, 720], [430, 560], [1060, 470], [720, 760]];
  return (
    palms.map(([x, y, s]) => palm(x, y, s)).join("") +
    rocks.map(([x, y]) => rock(x, y)).join("") +
    tufts.map(([x, y]) => grassTuft(x, y)).join("") +
    flowers.map(([x, y]) => flower(x, y)).join("") +
    // De få RIKTIGA hinder-buskarna (solid + kollision, delad källa map.js).
    BLOCKING_BUSHES.map((b) => bush(b.x, b.y, 1)).join("")
  );
}

/** Diskret röd X på marken vid skattens kandidatplatser (CHEST_CANDIDATES). */
function xMarks() {
  const marks = [[1014, 287], [722, 573], [353, 696]];
  return marks
    .map(([x, y]) =>
      `<g opacity="0.85"><circle cx="${x}" cy="${y}" r="30" fill="none" stroke="${ROD}" stroke-width="4" stroke-dasharray="8 8" opacity="0.6"/>` +
      `<path d="M${x - 18} ${y - 18} L${x + 18} ${y + 18} M${x + 18} ${y - 18} L${x - 18} ${y + 18}" stroke="${ROD}" stroke-width="9" stroke-linecap="round"/></g>`
    )
    .join("");
}

// ============================================================================
// Hela ö-scenen som en inline-SVG-sträng (bakifrån och fram).
// ============================================================================
export const SKATTJAKTEN_SCEN_SVG =
  `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">` +
  ocean() +
  land() +
  trail() +
  pond() +
  streamAndBridge() +
  cliffs() +
  ruins() +
  camp() +
  jettyBoat() +
  xMarks() +
  decor() +
  `</svg>`;
