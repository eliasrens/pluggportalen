// ============================================================================
// Pluggportalen – konst för mystery-items (inline SVG)
// ----------------------------------------------------------------------------
// Egen-ritade SVG-assets för sakerna i mysteryboxen (mystery-items.js). Följer
// stilguiden i art-style.js (kontur #3B3350, mjuka former, glad palett). Konsten
// slås ihop in i de BEFINTLIGA registren så mystery-saker ritas överallt utan
// särfall:
//   MYSTERY_WEARABLES → spreadas in i WEARABLES (art-wearables.js)  – klädlådan
//   MYSTERY_DECOR     → spreadas in i ITEMS     (art-items.js)      – rummet
//   MYSTERY_HUS_SKAL  → spreadas in i HUS_SKAL  (art-hus-ute.js)    – husskal
// Id:na MÅSTE matcha mystery-items.js exakt (sparas i Firestore).
//
// Slot-konventioner (par) som i art-wearables-<slot>.js: hatt xMidYMax,
// ansikte xMidYMid, hals/rygg xMidYMin, hand xMidYMax.
// ============================================================================

import { O, LINE, THIN, limb } from "./art-style.js";

const WOOD = "#B0805A";
const WOOD_DARK = "#8A6242";
const WOOD_LIGHT = "#E0B98C";

// Liten femuddig stjärna som fylld path runt (cx,cy).
function star5(cx, cy, R, c, r = null) {
  const ri = r == null ? R * 0.42 : r;
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? R : ri;
    const a = (-90 * Math.PI) / 180 + (i * Math.PI) / 5;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return `<path d="M${pts.join(" L")} Z" fill="${c}" ${THIN}/>`;
}

// ============================================================================
// KLÄDER (bärs på avataren)
// ============================================================================

export const MYSTERY_WEARABLES = {
  // Vanlig – stjärnformade solglasögon (ansikte).
  "myst-stjarnglas": {
    viewBox: "0 0 60 24",
    par: "xMidYMid",
    art:
      `<path d="M6 12 L54 12" fill="none" stroke="${O}" stroke-width="3" stroke-linecap="round"/>` +
      star5(18, 12, 10, "#7FC7E8") +
      star5(42, 12, 10, "#F890B7"),
  },
  // Vanlig – blomsterkrans (hatt).
  "myst-blomkrans": {
    viewBox: "0 0 60 26",
    par: "xMidYMax",
    art:
      `<path d="M8 22 Q30 8 52 22" fill="none" stroke="#6FC66F" stroke-width="5" stroke-linecap="round"/>` +
      blomma(12, 20, "#F890B7") +
      blomma(24, 13, "#F7C948") +
      blomma(36, 13, "#EF6F6C") +
      blomma(48, 20, "#B79BE0"),
  },
  // Vanlig – prickig halsduk (hals).
  "myst-prickscarf": {
    viewBox: "0 0 48 44",
    par: "xMidYMin",
    art:
      `<path d="M8 6 Q24 16 40 6 Q44 12 40 16 Q24 26 8 16 Q4 12 8 6 Z" fill="#58C6A9" ${LINE}/>` +
      `<path d="M32 16 L30 40 L40 40 L38 15 Z" fill="#58C6A9" ${LINE}/>` +
      `<circle cx="16" cy="11" r="1.8" fill="#fff"/><circle cx="26" cy="14" r="1.8" fill="#fff"/>` +
      `<circle cx="35" cy="11" r="1.8" fill="#fff"/><circle cx="34" cy="24" r="1.8" fill="#fff"/>` +
      `<circle cx="35" cy="33" r="1.8" fill="#fff"/>`,
  },
  // Ovanlig – féevingar (rygg, bakom figuren).
  "myst-fevingar": {
    viewBox: "0 0 56 46",
    par: "xMidYMin",
    art:
      `<path d="M28 8 Q6 2 4 20 Q6 34 24 30 Q20 18 28 12 Z" fill="#C9F0DC" ${LINE} opacity="0.95"/>` +
      `<path d="M28 8 Q50 2 52 20 Q50 34 32 30 Q36 18 28 12 Z" fill="#C9F0DC" ${LINE} opacity="0.95"/>` +
      `<path d="M12 14 Q18 20 20 27 M44 14 Q38 20 36 27" fill="none" ${THIN}/>` +
      star5(11, 19, 3, "#F7C948") +
      star5(45, 19, 3, "#F7C948"),
  },
  // Ovanlig – månhatt (hatt).
  "myst-manhatt": {
    viewBox: "0 0 48 46",
    par: "xMidYMax",
    art:
      `<path d="M10 40 Q10 8 24 8 Q38 8 38 40 Z" fill="#46557A" ${LINE}/>` +
      `<path d="M6 40 Q24 34 42 40 Q44 45 40 45 Q24 41 8 45 Q4 45 6 40 Z" fill="#46557A" ${LINE}/>` +
      `<path d="M28 16 Q20 20 24 28 Q30 26 30 20 Q30 17 28 16 Z" fill="#FDE9A8" ${THIN}/>` +
      star5(16, 22, 2.6, "#F7C948") +
      star5(20, 32, 2, "#F7C948"),
  },
  // Ovanlig – kristalltrollspö (hand).
  "myst-trollspo": {
    viewBox: "0 0 34 62",
    par: "xMidYMax",
    art:
      limb("M17 58 L17 24", WOOD_DARK, 5) +
      star5(17, 15, 12, "#B79BE0", 5) +
      `<circle cx="17" cy="15" r="3.5" fill="#FDE9A8" stroke="none"/>` +
      star5(28, 30, 3, "#F7C948") +
      star5(7, 22, 2.4, "#F7C948"),
  },
  // Sällsynt – stjärnkrona (hatt, gyllene variant).
  "myst-stjarnkrona": {
    viewBox: "0 0 60 40",
    par: "xMidYMax",
    art:
      `<path d="M6 36 L6 12 L18 22 L30 4 L42 22 L54 12 L54 36 Z" fill="#F7C948" ${LINE}/>` +
      `<rect x="6" y="33" width="48" height="6" rx="3" fill="#F2A93B" stroke="none"/>` +
      star5(30, 9, 4.5, "#fff", 2) +
      `<circle cx="16" cy="30" r="2.6" fill="#EF6F6C" ${THIN}/>` +
      `<circle cx="44" cy="30" r="2.6" fill="#7FC7E8" ${THIN}/>`,
  },
  // Sällsynt – drakvingar (rygg).
  "myst-drakvingar": {
    viewBox: "0 0 56 46",
    par: "xMidYMin",
    art:
      `<path d="M28 10 Q8 4 4 18 L14 16 L8 26 L18 24 L14 32 Q24 30 28 16 Z" fill="#6FC66F" ${LINE}/>` +
      `<path d="M28 10 Q48 4 52 18 L42 16 L48 26 L38 24 L42 32 Q32 30 28 16 Z" fill="#6FC66F" ${LINE}/>` +
      `<path d="M16 15 Q22 20 24 27 M40 15 Q34 20 32 27" fill="none" ${THIN}/>`,
  },
};

// En liten daisy-blomma runt (cx,cy) med gul mitt.
function blomma(cx, cy, kron) {
  return (
    `<circle cx="${cx - 4}" cy="${cy}" r="3.4" fill="${kron}" stroke="none"/>` +
    `<circle cx="${cx + 4}" cy="${cy}" r="3.4" fill="${kron}" stroke="none"/>` +
    `<circle cx="${cx}" cy="${cy - 4}" r="3.4" fill="${kron}" stroke="none"/>` +
    `<circle cx="${cx}" cy="${cy + 4}" r="3.4" fill="${kron}" stroke="none"/>` +
    `<circle cx="${cx}" cy="${cy}" r="3" fill="#F7C948" ${THIN}/>`
  );
}

// ============================================================================
// DEKOR (placeras i rummet). `w` = visningsbredd i rem.
// ============================================================================

const shadow = (cx, cy, rx) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${(rx * 0.22).toFixed(1)}" fill="${O}" opacity="0.09"/>`;

export const MYSTERY_DECOR = {
  // Vanlig – lyktglob: lysande kula på en liten fot.
  "myst-lyktglob": {
    viewBox: "0 0 60 88",
    w: 3.0,
    art:
      shadow(30, 83, 20) +
      `<rect x="22" y="70" width="16" height="12" rx="4" fill="${WOOD}" ${LINE}/>` +
      `<circle cx="30" cy="42" r="26" fill="#B79BE0" ${LINE}/>` +
      `<circle cx="30" cy="42" r="16" fill="#D9C6F2" stroke="none"/>` +
      `<circle cx="24" cy="34" r="6" fill="#fff" opacity="0.7" stroke="none"/>` +
      star5(30, 42, 6, "#fff", 2.6),
  },
  // Vanlig – svamplykta: rödprickig svamp som lyser.
  "myst-svamplykta": {
    viewBox: "0 0 66 90",
    w: 3.2,
    art:
      shadow(33, 85, 22) +
      `<rect x="25" y="52" width="16" height="32" rx="7" fill="#FFF3DC" ${LINE}/>` +
      `<path d="M6 50 Q6 20 33 20 Q60 20 60 50 Q33 60 6 50 Z" fill="#EF6F6C" ${LINE}/>` +
      `<circle cx="20" cy="38" r="4" fill="#fff" stroke="none"/>` +
      `<circle cx="34" cy="32" r="5" fill="#fff" stroke="none"/>` +
      `<circle cx="47" cy="40" r="4" fill="#fff" stroke="none"/>` +
      `<circle cx="30" cy="66" r="2.4" fill="#F7C948" stroke="none"/>` +
      `<circle cx="37" cy="74" r="2.4" fill="#F7C948" stroke="none"/>`,
  },
  // Ovanlig – kristallklunga: tre spetsiga kristaller.
  "myst-kristallklunga": {
    viewBox: "0 0 74 78",
    w: 3.4,
    art:
      shadow(37, 73, 26) +
      `<path d="M14 74 L10 40 L24 34 L30 74 Z" fill="#7FC7E8" ${LINE}/>` +
      `<path d="M52 74 L46 34 L60 40 L64 74 Z" fill="#58C6A9" ${LINE}/>` +
      `<path d="M28 74 L30 24 L44 24 L46 74 Z" fill="#B79BE0" ${LINE}/>` +
      `<path d="M30 24 L37 30 L44 24 M37 30 L37 74" fill="none" ${THIN}/>` +
      star5(37, 18, 3, "#F7C948"),
  },
  // Sällsynt – regnbågsfontän (trädgårdsdekor): skål med regnbågsstråle.
  "myst-regnbagsfontan": {
    viewBox: "0 0 96 96",
    w: 4.2,
    art:
      shadow(48, 90, 34) +
      `<path d="M18 74 Q48 92 78 74 L74 82 Q48 96 22 82 Z" fill="#A9C2DE" ${LINE}/>` +
      `<ellipse cx="48" cy="72" rx="34" ry="10" fill="#7FC7E8" ${LINE}/>` +
      `<ellipse cx="48" cy="70" rx="26" ry="6" fill="#C9F0DC" stroke="none"/>` +
      båge(30, "#EF6F6C") +
      båge(24, "#F7C948") +
      båge(18, "#6FC66F") +
      båge(12, "#7FC7E8") +
      `<circle cx="48" cy="70" r="4" fill="#FDE9A8" ${THIN}/>`,
  },
};

// Regnbågsbåge (halvcirkel) över fontänskålen, centrerad i (48,70).
function båge(r, c) {
  return (
    `<path d="M${48 - r} 70 A${r} ${r} 0 0 1 ${48 + r} 70" fill="none" ` +
    `stroke="${c}" stroke-width="4.4" stroke-linecap="round"/>`
  );
}

// ============================================================================
// HUSSKAL (husets exteriör i ute-scenen; koordinater ~x300–660, mark y≈512).
// Fasad/tak/vägg färgas via --hus-house/--hus-roof/--hus-wall/--hus-wall2 så de
// följer elevens palett, precis som stugan (art-hus-ute.js).
// ============================================================================

// Trädkoja: en stuga uppe i ett stort träd, med stege.
function tradkojaMarkup() {
  return `${shadow(480, 512, 190)}
      <!-- Trädstam & krona -->
      ${limb("M480 512 L480 300", WOOD_DARK, 46)}
      <circle cx="400" cy="250" r="95" fill="#6FC66F" ${LINE}/>
      <circle cx="560" cy="250" r="95" fill="#6FC66F" ${LINE}/>
      <circle cx="480" cy="190" r="105" fill="#58C6A9" ${LINE}/>
      <circle cx="430" cy="235" r="6" fill="#F890B7" stroke="none"/>
      <circle cx="535" cy="220" r="6" fill="#F7C948" stroke="none"/>
      <circle cx="490" cy="150" r="6" fill="#EF6F6C" stroke="none"/>
      <!-- Plattform + kojan -->
      <rect x="336" y="336" width="288" height="16" rx="6" fill="${WOOD}" ${LINE}/>
      <rect x="366" y="250" width="228" height="90" rx="10" fill="var(--hus-house)" ${LINE}/>
      <path d="M348 252 L480 168 L612 252 Z" fill="var(--hus-roof)" ${LINE}/>
      <rect x="440" y="284" width="80" height="56" rx="8" fill="${WOOD_DARK}" ${LINE}/>
      <rect x="452" y="294" width="56" height="46" rx="6" fill="${WOOD_LIGHT}" stroke="none"/>
      <circle cx="500" cy="316" r="3.5" fill="${WOOD_DARK}"/>
      <rect x="386" y="272" width="44" height="40" rx="8" fill="var(--hus-wall)" ${LINE}/>
      <path d="M408 274 L408 310 M388 292 L428 292" stroke="${O}" stroke-width="3"/>
      <!-- Stege ner till marken -->
      ${limb("M420 512 L432 352", WOOD_DARK, 6)}
      ${limb("M460 512 L456 352", WOOD_DARK, 6)}
      <path d="M430 470 L458 468 M427 430 L456 428 M424 390 L454 388" stroke="${WOOD_DARK}" stroke-width="5" stroke-linecap="round"/>`;
}

// Kristallhus: hus med spetsigt kristalltak och glittrande fasett-fasad.
function kristallhusMarkup() {
  return `${shadow(480, 512, 190)}
      <rect x="340" y="270" width="280" height="242" rx="14" fill="var(--hus-house)" ${LINE}/>
      <path d="M340 270 L480 300 L620 270 L480 292 Z" fill="var(--hus-wall2)" stroke="none" opacity="0.5"/>
      <!-- Fasett-linjer i fasaden -->
      <path d="M340 350 L620 320 M340 430 L620 400 M480 300 L480 512" stroke="${O}" stroke-width="2.4" opacity="0.35" fill="none"/>
      <!-- Kristalltak: tre spetsar -->
      <path d="M320 270 L400 120 L480 270 Z" fill="var(--hus-roof)" ${LINE}/>
      <path d="M440 270 L520 150 L600 270 Z" fill="var(--hus-roof)" ${LINE}/>
      <path d="M400 120 L420 200 M520 150 L520 240" stroke="${O}" stroke-width="2.4" opacity="0.4" fill="none"/>
      <circle cx="400" cy="120" r="7" fill="#FDE9A8" ${THIN}/>
      <circle cx="520" cy="150" r="7" fill="#FDE9A8" ${THIN}/>
      <!-- Dörr -->
      <path d="M420 512 L420 400 Q420 372 452 372 Q484 372 484 400 L484 512 Z" fill="var(--hus-wall)" ${LINE}/>
      <circle cx="474" cy="446" r="4.5" fill="#F7C948" ${THIN}/>
      <!-- Glittrande fönster -->
      <rect x="510" y="360" width="80" height="80" rx="10" fill="var(--hus-wall)" ${LINE}/>
      <path d="M550 360 L550 440 M510 400 L590 400" stroke="${O}" stroke-width="4"/>
      ${star5(360, 350, 6, "#fff", 2.6)}
      ${star5(560, 470, 5, "#fff", 2.2)}`;
}

/** id → { namn, emoji, markup } – slås in i HUS_SKAL i art-hus-ute.js. */
export const MYSTERY_HUS_SKAL = {
  "myst-tradkoja": { namn: "Trädkoja", emoji: "🌳", markup: tradkojaMarkup },
  "myst-kristallhus": { namn: "Kristallhus", emoji: "🏯", markup: kristallhusMarkup },
};
