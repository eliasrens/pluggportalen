// ============================================================================
// Pluggporten – trädgårds- & utomhussaker (inline SVG-uppslagning)
// ----------------------------------------------------------------------------
// Konsten för shop-kategorin "Trädgård & utomhus" (#132): saker eleven köper och
// placerar UTOMHUS runt huset (art-hus-ute.js/varld-tradgard.js). Samma schema
// som art-decor/art-furniture: id → { viewBox, w (rem), art, flat? }; flat:true
// = markplacerad sak (rabatt/parkering/damm) som ritas UNDER övriga, som rummets
// mattor. GARDEN spridas in i ITEMS (art-items.js) → itemSvg(id) funkar för både
// shop-miniatyr och scen. Stilguide art-style.js (kontur O via LINE/THIN), samma
// trä-/grönska-palett som ute-scenen. Håll id:na STABILA – de lagras i
// studentData.garden.placements + ownedItems (Firestore); `emoji` = fallback.
// ============================================================================

import { O, LINE, THIN, limb } from "./art-style.js";

// Palett – samma gröna/trä-toner som ute-scenen (färgas aldrig om av paletten).
const LOV = "#6FC66F";
const LOV_MORK = "#4E9B5E";
const WOOD = "#B0805A";
const WOOD_DARK = "#8A6242";

const shadow = (cx, cy, rx) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${(rx * 0.22).toFixed(1)}" fill="${O}" opacity="0.12"/>`;

// Fordonshjul: däck + fälg – delas av bilarna (#351). Cykelns ekerhjul är egna.
const hjul = (cx, cy, r) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${O}" ${LINE}/>` +
  `<circle cx="${cx}" cy="${cy}" r="${(r * 0.42).toFixed(1)}" fill="#C7C2CE" ${THIN}/>`;

/**
 * id → { viewBox, w (rem, ute-scenens bas-bredd), art, flat? }.
 * Höjden härleds ur viewBox-proportionen (itemSize i art-items.js).
 */
export const GARDEN = {
  // --- Träd: kraftig stam + tre lövklumpar med några äpplen ----------------
  trad: {
    viewBox: "0 0 120 150",
    w: 5.4,
    art:
      shadow(60, 146, 40) +
      limb("M60 146 L60 78", WOOD, 15) +
      `<path d="M52 110 Q42 100 40 112" fill="none" ${THIN}/>` +
      `<circle cx="60" cy="60" r="42" fill="${LOV}" ${LINE}/>` +
      `<circle cx="30" cy="82" r="26" fill="${LOV}" ${LINE}/>` +
      `<circle cx="92" cy="80" r="28" fill="${LOV}" ${LINE}/>` +
      `<path d="M40 46 Q52 40 60 50" fill="none" ${THIN}/>` +
      `<circle cx="46" cy="54" r="6" fill="#EF6F6C" ${THIN}/>` +
      `<circle cx="82" cy="70" r="6" fill="#EF6F6C" ${THIN}/>` +
      `<circle cx="66" cy="88" r="6" fill="#EF6F6C" ${THIN}/>`,
  },

  // --- Buske: låg rund grönska med små blommor -----------------------------
  buske: {
    viewBox: "0 0 110 74",
    w: 4.6,
    art:
      shadow(55, 70, 40) +
      `<circle cx="30" cy="46" r="24" fill="${LOV_MORK}" ${LINE}/>` +
      `<circle cx="80" cy="46" r="24" fill="${LOV_MORK}" ${LINE}/>` +
      `<circle cx="55" cy="34" r="28" fill="${LOV}" ${LINE}/>` +
      `<path d="M40 40 Q55 32 70 40" fill="none" ${THIN}/>` +
      `<circle cx="34" cy="46" r="4.6" fill="#F890B7" ${THIN}/>` +
      `<circle cx="76" cy="48" r="4.6" fill="#F7C948" ${THIN}/>` +
      `<circle cx="58" cy="28" r="4.6" fill="#F890B7" ${THIN}/>`,
  },

  // --- Blomrabatt (flat): jordremsa med rad av glada blommor ---------------
  blomrabatt: {
    viewBox: "0 0 130 60",
    w: 5.2,
    flat: true,
    art:
      `<path d="M8 44 Q65 30 122 44 L118 54 Q65 44 12 54 Z" fill="#8A6242" ${LINE}/>` +
      blommaVid(28, 40, "#F890B7") +
      blommaVid(58, 34, "#F7C948") +
      blommaVid(88, 40, "#EF6F6C") +
      blommaVid(108, 44, "#B892E0"),
  },

  // --- Parkeringsruta (flat): asfalt med vit ram + stort P ------------------
  parkering: {
    viewBox: "0 0 120 96",
    w: 5.6,
    flat: true,
    art:
      `<path d="M14 26 L106 26 L112 88 L8 88 Z" fill="#6E6A73" ${LINE}/>` +
      `<path d="M24 34 L98 34 L102 80 L18 80 Z" fill="none" stroke="#FFFFFF" stroke-width="4"/>` +
      `<path d="M50 44 L50 70 M50 44 L64 44 Q72 44 72 52 Q72 60 64 60 L50 60"
        fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  // --- Bil: gullig sidobild med tak, fönster & två hjul --------------------
  bil: {
    viewBox: "0 0 150 92",
    w: 6.4,
    art:
      shadow(75, 86, 58) +
      `<path d="M14 66 L14 52 Q14 46 22 46 L44 46 L58 24 Q62 18 72 18 L104 18
        Q112 18 116 26 L126 46 L136 48 Q142 50 142 58 L142 66 Z"
        fill="#EF6F6C" ${LINE}/>` +
      `<path d="M60 44 L70 26 L86 26 L86 44 Z" fill="#C9EEFB" ${THIN}/>` +
      `<path d="M92 44 L92 26 L102 26 Q108 26 111 32 L118 44 Z" fill="#C9EEFB" ${THIN}/>` +
      `<rect x="20" y="56" width="26" height="7" rx="3.5" fill="#FFE9CC" stroke="none"/>` +
      `<circle cx="44" cy="72" r="15" fill="#3B3350" ${LINE}/>` +
      `<circle cx="44" cy="72" r="6" fill="#C7C2CE" ${THIN}/>` +
      `<circle cx="112" cy="72" r="15" fill="#3B3350" ${LINE}/>` +
      `<circle cx="112" cy="72" r="6" fill="#C7C2CE" ${THIN}/>`,
  },

  // --- Cykel: ram, sadel, styre & två ekerhjul -----------------------------
  cykel: {
    viewBox: "0 0 140 96",
    w: 6.0,
    art:
      shadow(70, 90, 56) +
      `<circle cx="34" cy="66" r="24" fill="none" stroke="${O}" stroke-width="5"/>` +
      `<circle cx="106" cy="66" r="24" fill="none" stroke="${O}" stroke-width="5"/>` +
      `<circle cx="34" cy="66" r="3.4" fill="${O}"/>` +
      `<circle cx="106" cy="66" r="3.4" fill="${O}"/>` +
      ekrar(34, 66, 22) + ekrar(106, 66, 22) +
      `<path d="M34 66 L70 66 L52 38 Z M70 66 L92 38 M52 38 L92 38"
        fill="none" stroke="#EF6F6C" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M106 66 L92 38" fill="none" stroke="#EF6F6C" stroke-width="6" stroke-linecap="round"/>` +
      limb("M92 38 L100 30", O, 4) +
      `<path d="M96 30 L112 30" fill="none" stroke="${O}" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M44 40 L60 40" fill="none" stroke="${WOOD_DARK}" stroke-width="6" stroke-linecap="round"/>` +
      limb("M70 66 L70 54", O, 4),
  },

  // --- Mer till trädgården (#351): fontän, gungställning & anddamm ---------
  fontan: { viewBox: "0 0 110 108", w: 4.6, art:
    shadow(55, 102, 40) +
    `<path d="M10 82 Q55 72 100 82 L95 99 Q55 91 15 99 Z" fill="#B9B4C2" ${LINE}/>` +
    `<path d="M26 82 Q55 76 84 82 L82 90 Q55 85 28 90 Z" fill="#8ED4F2" ${THIN}/>` +
    limb("M55 80 L55 54", "#8F8A99", 8) +
    `<path d="M38 52 Q55 46 72 52 L67 61 Q55 57 43 61 Z" fill="#B9B4C2" ${LINE}/>` +
    `<path d="M55 50 L55 26 M55 48 Q40 26 34 44 M55 48 Q70 26 76 44" fill="none" stroke="#8ED4F2" stroke-width="4" stroke-linecap="round"/>` +
    `<circle cx="55" cy="20" r="3.4" fill="#C9EEFB" ${THIN}/><circle cx="31" cy="38" r="2.6" fill="#C9EEFB" ${THIN}/><circle cx="79" cy="38" r="2.6" fill="#C9EEFB" ${THIN}/>`,
  },
  gunga: { viewBox: "0 0 140 110", w: 6.0, art:
    shadow(70, 104, 56) +
    limb("M10 104 L26 16", WOOD, 6) + limb("M42 104 L26 16", WOOD, 6) +
    limb("M98 104 L114 16", WOOD, 6) + limb("M130 104 L114 16", WOOD, 6) +
    limb("M20 14 L120 14", WOOD_DARK, 6) +
    `<path d="M60 18 L60 74 M84 18 L84 74" fill="none" stroke="${WOOD_DARK}" stroke-width="3"/>` +
    `<rect x="52" y="72" width="40" height="9" rx="4" fill="#EF6F6C" ${LINE}/>`,
  },
  damm: { viewBox: "0 0 130 70", w: 5.8, flat: true, art:
    `<path d="M14 38 Q16 16 48 14 Q84 12 106 22 Q124 30 116 48 Q106 62 64 62 Q22 62 14 38 Z" fill="#7FC7E8" ${LINE}/>` +
    `<path d="M28 30 Q38 25 48 30 M78 48 Q88 43 98 48" fill="none" stroke="#C9EEFB" stroke-width="3" stroke-linecap="round"/>` +
    `<ellipse cx="98" cy="30" rx="9" ry="4.5" fill="${LOV}" ${THIN}/>` +
    `<ellipse cx="46" cy="44" rx="11" ry="7" fill="#F7C948" ${LINE}/>` +
    `<circle cx="56" cy="33" r="5.5" fill="#F7C948" ${LINE}/>` +
    `<path d="M61 32 L68 34 L61 36 Z" fill="#F2933E" ${THIN}/>` +
    `<circle cx="57.5" cy="31.5" r="1.2" fill="${O}"/>`,
  },

  // --- Coola bilar (#351, sidovy som "bil"): sportbil & monstertruck -------
  sportbil: { viewBox: "0 0 160 84", w: 6.8, art:
    shadow(80, 78, 62) +
    limb("M20 46 L18 34", O, 4) +
    `<path d="M6 32 L32 36" fill="none" stroke="${O}" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M10 62 L10 52 Q10 44 22 42 L48 38 Q70 22 96 24 L120 28 Q142 32 150 46 Q154 50 154 56 L154 62 Z" fill="#F7C948" ${LINE}/>` +
    `<path d="M62 36 L78 27 L92 28 L96 38 Z" fill="#C9EEFB" ${THIN}/>` +
    `<path d="M52 46 L118 46" fill="none" stroke="${O}" stroke-width="4" stroke-linecap="round"/>` +
    `<rect x="142" y="46" width="10" height="5" rx="2.5" fill="#FFE9CC" stroke="none"/>` +
    hjul(42, 64, 14) + hjul(124, 64, 14),
  },
  monstertruck: { viewBox: "0 0 150 110", w: 6.6, art:
    shadow(75, 104, 58) +
    `<path d="M16 56 L16 36 Q16 30 24 30 L66 30 L66 14 Q66 8 74 8 L98 8 Q106 8 110 16 L118 32 L126 34 Q134 36 134 44 L134 56 Z" fill="#B892E0" ${LINE}/>` +
    `<path d="M72 28 L72 14 L96 14 Q100 14 102 18 L108 28 Z" fill="#C9EEFB" ${THIN}/>` +
    `<path d="M24 40 Q34 34 44 40 Q54 46 62 40" fill="none" stroke="#F7C948" stroke-width="4" stroke-linecap="round"/>` +
    limb("M40 56 L40 72", O, 5) + limb("M112 56 L112 72", O, 5) +
    hjul(40, 82, 22) + hjul(112, 82, 22),
  },
};

// ============================================================================
// Grödor i gårdens odlingsbädd (#329) – frö-påsar (shop) + växt-steg (bädden)
// ============================================================================
// Grödans id = shop-sakens id (crop_*). Fröpåsarna nedan spridas in i GARDEN
// så itemSvg(id) ger shop-miniatyren; själva växten i bädden ritas per
// tillväxtsteg av cropStageArt(cropId, stage) med MARKEN i origo (0,0) och
// växten uppåt i minus-y – varld-odling.js placerar den med translate i
// gårds-scenens koordinater. Steg (farm-core.js): 0 sådd, 1 grodd, 2 växer,
// 3 = FARM_MAX_GROWTH_STAGE = skördeklar (glittrar).

const JORD = "#7A5A40";
const MOROT = "#F2933E";
const BAR = "#8B7BE8";
const PUMPA = "#F0A24B";
const SALLAD = "#8FD46A";

// Liten jordhög vid origo – grunden i steg 0/1.
const jordhog = () =>
  `<path d="M-16 0 Q0 -10 16 0 Z" fill="${JORD}" ${THIN}/>`;

// Ett litet ✨-glitter vid (x, y) – markerar skördeklar gröda.
const glitter = (x, y, s = 1) =>
  `<path d="M${x} ${y - 6 * s} L${x + 1.6 * s} ${y - 1.6 * s} L${x + 6 * s} ${y} L${x + 1.6 * s} ${y + 1.6 * s} L${x} ${y + 6 * s} L${x - 1.6 * s} ${y + 1.6 * s} L${x - 6 * s} ${y} L${x - 1.6 * s} ${y - 1.6 * s} Z" fill="#F7C948" ${THIN}/>`;

// Morotsblast: n blad ur (0,0) uppåt, skala s.
function blast(n, s) {
  const dx = [-8, 0, 8, -4, 4];
  let out = "";
  for (let i = 0; i < n; i++) {
    const x = dx[i % dx.length] * s;
    out += `<path d="M0 0 Q${x} ${-14 * s} ${x * 1.6} ${-22 * s}" fill="none" stroke="${LOV_MORK}" stroke-width="${3.5 * s}" stroke-linecap="round"/>`;
  }
  return out;
}

// Ett klöverblad (tre småblad) med mitten i (x, y), skala s.
function kloverblad(x, y, s, farg = LOV) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <circle cx="0" cy="-5" r="5" fill="${farg}" ${THIN}/>
    <circle cx="-4.6" cy="2.6" r="5" fill="${farg}" ${THIN}/>
    <circle cx="4.6" cy="2.6" r="5" fill="${farg}" ${THIN}/></g>`;
}

// Delade tidiga steg: 0 = sådd (jordhög + frön), 1 = grodd (två hjärtblad).
function saddArt() {
  return jordhog() +
    `<circle cx="-5" cy="-4" r="1.8" fill="#5C4433"/>` +
    `<circle cx="4" cy="-5" r="1.8" fill="#5C4433"/>` +
    `<circle cx="0" cy="-2.5" r="1.8" fill="#5C4433"/>`;
}
function groddArt() {
  return jordhog() +
    `<path d="M0 -4 L0 -14" fill="none" stroke="${LOV_MORK}" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M0 -14 Q-7 -18 -8 -24 Q-1 -24 0 -14 Q1 -24 8 -24 Q7 -18 0 -14 Z" fill="${LOV}" ${THIN}/>`;
}

/**
 * Grödorna som kan sås i odlingsbädden: id → { name, emoji, mat (vilka djur
 * skörden är tänkt för – visas som hint i odlings-panelen) }. Id:na är samma
 * som shop-sakerna ovan/nedan och lagras i Firestore – håll dem STABILA.
 */
export const CROPS = {
  crop_carrot: { name: "Morot", emoji: "🥕", mat: "kaniner och hästar" },
  crop_clover: { name: "Klöver", emoji: "☘️", mat: "kor, får och grisar" },
  crop_berries: { name: "Magiska bär", emoji: "🫐", mat: "mysterydjur" },
  // Fler sorters djurmat (#349): godis-grödor som ALLA husdjur blir glada av
  // (mata i rummet → hjärtan). Inget bondgårdsdjur har dem som favorit
  // (FODER_FOR), så trivsel-loopen påverkas inte.
  crop_pumpkin: { name: "Pumpa", emoji: "🎃", mat: "alla husdjur" },
  crop_lettuce: { name: "Sallad", emoji: "🥬", mat: "alla husdjur" },
};

// Sena steg (2 växer / 3 skördeklar) per gröda.
const CROP_STAGE_ART = {
  crop_carrot: [
    () => saddArt(),
    () => groddArt(),
    () => jordhog() + blast(3, 0.8),
    () =>
      jordhog() +
      `<path d="M-7 -2 Q0 24 0 26 Q0 24 7 -2 Z" fill="${MOROT}" ${THIN}/>` +
      `<path d="M-4 6 L3 6 M-3 13 L2 13" stroke="#C96F23" stroke-width="1.8" stroke-linecap="round"/>` +
      blast(5, 1.1) + glitter(14, -20, 0.9),
  ],
  crop_clover: [
    () => saddArt(),
    () => groddArt(),
    () =>
      jordhog() +
      `<path d="M-8 -3 L-10 -14 M0 -4 L0 -18 M8 -3 L10 -12" fill="none" stroke="${LOV_MORK}" stroke-width="2.6" stroke-linecap="round"/>` +
      kloverblad(-10, -18, 0.7) + kloverblad(0, -23, 0.85) + kloverblad(10, -16, 0.65),
    () =>
      jordhog() +
      `<path d="M-11 -3 L-14 -20 M0 -4 L0 -26 M11 -3 L14 -18" fill="none" stroke="${LOV_MORK}" stroke-width="3" stroke-linecap="round"/>` +
      kloverblad(-14, -25, 0.95) + kloverblad(0, -32, 1.15) + kloverblad(14, -23, 0.9) +
      `<circle cx="0" cy="-40" r="4.5" fill="#F890B7" ${THIN}/>` + glitter(-19, -34, 0.8),
  ],
  crop_berries: [
    () => saddArt(),
    () => groddArt(),
    () =>
      jordhog() +
      `<circle cx="0" cy="-18" r="12" fill="${LOV_MORK}" ${THIN}/>` +
      `<circle cx="-4" cy="-20" r="2.6" fill="${BAR}" ${THIN}/>` +
      `<circle cx="5" cy="-15" r="2.6" fill="${BAR}" ${THIN}/>`,
    () =>
      jordhog() +
      `<circle cx="-9" cy="-14" r="10" fill="${LOV_MORK}" ${THIN}/>` +
      `<circle cx="9" cy="-15" r="10" fill="${LOV_MORK}" ${THIN}/>` +
      `<circle cx="0" cy="-24" r="12" fill="${LOV}" ${THIN}/>` +
      `<circle cx="-9" cy="-16" r="3.4" fill="${BAR}" ${THIN}/>` +
      `<circle cx="9" cy="-17" r="3.4" fill="${BAR}" ${THIN}/>` +
      `<circle cx="0" cy="-27" r="3.4" fill="${BAR}" ${THIN}/>` +
      `<circle cx="-3" cy="-19" r="2.6" fill="#B9AFF5" ${THIN}/>` +
      glitter(16, -28, 0.9) + glitter(-17, -32, 0.7),
  ],
  crop_pumpkin: [
    () => saddArt(),
    () => groddArt(),
    () =>
      jordhog() +
      `<path d="M0 -3 Q-9 -8 -15 -6" fill="none" stroke="${LOV_MORK}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<ellipse cx="10" cy="-8" rx="7" ry="6" fill="${SALLAD}" ${THIN}/>` +
      `<ellipse cx="-2" cy="-8" rx="9" ry="7" fill="${LOV}" ${THIN}/>`,
    () =>
      jordhog() +
      `<path d="M-13 -2 Q-19 -12 -10 -18" fill="none" stroke="${LOV_MORK}" stroke-width="2.6" stroke-linecap="round"/>` +
      `<ellipse cx="0" cy="-12" rx="15" ry="11.5" fill="${PUMPA}" ${THIN}/>` +
      `<path d="M-6 -22 Q-8 -12 -6 -2 M6 -22 Q8 -12 6 -2" fill="none" stroke="#D07E2A" stroke-width="1.8" stroke-linecap="round"/>` +
      `<path d="M0 -23 L0 -28" fill="none" stroke="${LOV_MORK}" stroke-width="3" stroke-linecap="round"/>` +
      glitter(18, -26, 0.9),
  ],
  crop_lettuce: [
    () => saddArt(),
    () => groddArt(),
    () =>
      jordhog() +
      `<path d="M-7 -2 Q-10 -14 -4 -17 Q-4 -7 -1 -2 Z" fill="${SALLAD}" ${THIN}/>` +
      `<path d="M7 -2 Q10 -14 4 -17 Q4 -7 1 -2 Z" fill="${SALLAD}" ${THIN}/>` +
      `<path d="M0 -2 Q-3 -18 0 -21 Q3 -18 0 -2 Z" fill="${LOV}" ${THIN}/>`,
    () =>
      jordhog() +
      `<circle cx="-8" cy="-9" r="8.5" fill="${SALLAD}" ${THIN}/>` +
      `<circle cx="8" cy="-9" r="8.5" fill="${SALLAD}" ${THIN}/>` +
      `<circle cx="0" cy="-15" r="9.5" fill="${LOV}" ${THIN}/>` +
      `<path d="M-5 -16 Q0 -20 5 -16" fill="none" ${THIN}/>` +
      glitter(16, -24, 0.85),
  ],
};

/**
 * SVG-snutt för en gröda vid ett tillväxtsteg, ritad med marken i origo och
 * växten uppåt (minus-y, ryms inom ca ±20 × −45). Okänd gröda/steg → "".
 * @param {string} cropId  t.ex. "crop_carrot"
 * @param {number} stage   0–3 (FARM_MAX_GROWTH_STAGE)
 */
export function cropStageArt(cropId, stage) {
  const steg = CROP_STAGE_ART[cropId];
  const fn = steg && steg[Math.min(steg.length - 1, Math.max(0, Math.round(stage) || 0))];
  return fn ? fn() : "";
}

// Fröpåse till shoppen: stående papperspåse med grödans bild + frö-prickar.
function froPase(motiv) {
  return (
    shadow(32, 76, 22) +
    `<path d="M12 10 Q32 4 52 10 L54 68 Q32 74 10 68 Z" fill="#FFF3DC" ${LINE}/>` +
    `<path d="M12 10 Q32 4 52 10 L51 22 Q32 27 13 22 Z" fill="${LOV}" ${LINE}/>` +
    `<g transform="translate(32 56)">${motiv}</g>` +
    `<circle cx="20" cy="62" r="1.8" fill="#5C4433"/>` +
    `<circle cx="44" cy="60" r="1.8" fill="#5C4433"/>`
  );
}

// Shop-miniatyrer för fröerna (spridas in i ITEMS via art-items.js precis som
// övriga GARDEN-poster). De placeras aldrig i trädgården (isSeedItem-filter) –
// posterna här används bara som katalog-bild.
GARDEN.crop_carrot = { viewBox: "0 0 64 84", w: 2.6, art: froPase(
  `<path d="M-5 -14 Q0 12 0 14 Q0 12 5 -14 Z" fill="${MOROT}" ${THIN}/>` + blast(3, 0.7)
) };
GARDEN.crop_clover = { viewBox: "0 0 64 84", w: 2.6, art: froPase(kloverblad(0, -8, 1.5)) };
GARDEN.crop_berries = { viewBox: "0 0 64 84", w: 2.6, art: froPase(
  `<circle cx="0" cy="-8" r="11" fill="${LOV_MORK}" ${THIN}/>` +
  `<circle cx="-4" cy="-10" r="3" fill="${BAR}" ${THIN}/>` +
  `<circle cx="5" cy="-5" r="3" fill="${BAR}" ${THIN}/>` +
  `<circle cx="2" cy="-13" r="2.4" fill="#B9AFF5" ${THIN}/>`
) };
GARDEN.crop_pumpkin = { viewBox: "0 0 64 84", w: 2.6, art: froPase(
  `<ellipse cx="0" cy="-7" rx="11" ry="8.5" fill="${PUMPA}" ${THIN}/>` +
  `<path d="M-4 -14 Q-5 -7 -4 0 M4 -14 Q5 -7 4 0" fill="none" stroke="#D07E2A" stroke-width="1.6" stroke-linecap="round"/>` +
  `<path d="M0 -15 L0 -19" fill="none" stroke="${LOV_MORK}" stroke-width="2.6" stroke-linecap="round"/>`
) };
GARDEN.crop_lettuce = { viewBox: "0 0 64 84", w: 2.6, art: froPase(
  `<circle cx="-5" cy="-5" r="6.5" fill="${SALLAD}" ${THIN}/>` +
  `<circle cx="5" cy="-5" r="6.5" fill="${SALLAD}" ${THIN}/>` +
  `<circle cx="0" cy="-10" r="7" fill="${LOV}" ${THIN}/>`
) };

// En liten glad blomma på en stjälk vid (x, markY) – används i rabatten.
function blommaVid(x, markY, farg) {
  const top = markY - 20;
  return (
    `<path d="M${x} ${markY} L${x} ${top + 6}" fill="none" stroke="${LOV_MORK}" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="${x - 6}" cy="${top}" r="5" fill="${farg}" ${THIN}/>` +
    `<circle cx="${x + 6}" cy="${top}" r="5" fill="${farg}" ${THIN}/>` +
    `<circle cx="${x}" cy="${top - 6}" r="5" fill="${farg}" ${THIN}/>` +
    `<circle cx="${x}" cy="${top + 6}" r="5" fill="${farg}" ${THIN}/>` +
    `<circle cx="${x}" cy="${top}" r="4.5" fill="#F7C948" ${THIN}/>`
  );
}

// Fyra ekrar i ett cykelhjul (kors) med radie r kring (cx, cy).
function ekrar(cx, cy, r) {
  return (
    `<path d="M${cx - r} ${cy} L${cx + r} ${cy} M${cx} ${cy - r} L${cx} ${cy + r}"
      fill="none" stroke="${O}" stroke-width="2"/>`
  );
}
