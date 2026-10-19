// ============================================================================
// Pluggporten – Halloween-samlingens INNE-saker (#692): dekor & möbler
// ----------------------------------------------------------------------------
// Samma schema som art-decor/art-furniture: id → { viewBox, w (rem), art, flat? }.
// Registreras i art-items.js (registerItemArt) av hw-konst.js när den laddas.
// Id:na matchar shop-items.js exakt (sparas i Firestore) – byt bara utseendet.
// ============================================================================

import {
  O, LINE, THIN, limb, PUMPA, PUMPA_MORK, LILA, LILA_MORK, NATT, SKEN, GUL, GRON, KRAM, SLEM,
  WOOD, WOOD_DARK, skugga, anim, oga, pumpa, fladdermus, spoke, glitter,
} from "./hw-art-delar.js";

// Spindelnät i ett hörn (övre vänstra): ekrar + bågar, beräknat en gång.
function spindelnat() {
  const ekrar = [0, 22.5, 45, 67.5, 90].map((g) => (g * Math.PI) / 180);
  const p = (r, a) => `${(4 + r * Math.cos(a)).toFixed(1)} ${(4 + r * Math.sin(a)).toFixed(1)}`;
  let d = ekrar.map((a) => `M4 4 L${p(60, a)}`).join(" ");
  for (const r of [16, 30, 44, 56]) {
    for (let i = 0; i < ekrar.length - 1; i++) {
      const mitt = (ekrar[i] + ekrar[i + 1]) / 2;
      d += ` M${p(r, ekrar[i])} Q${p(r * 0.84, mitt)} ${p(r, ekrar[i + 1])}`;
    }
  }
  return `<path d="${d}" fill="none" stroke="#F4F0FB" stroke-width="3.2" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${LILA_MORK}" stroke-width="1.2" stroke-linecap="round" opacity="0.55"/>`;
}

// Liten rund gullig spindel (åtta korta ben) i (cx,cy).
function spindel(cx, cy) {
  let ben = "";
  for (const [dx, dy] of [[-8, -4], [-9, 0], [-8, 4], [-6, 7]]) {
    ben += `M${cx} ${cy} L${cx + dx} ${cy + dy} M${cx} ${cy} L${cx - dx} ${cy + dy} `;
  }
  return `<path d="${ben}" fill="none" stroke="${NATT}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<circle cx="${cx}" cy="${cy}" r="5.5" fill="${NATT}" ${THIN}/>` +
    `<circle cx="${cx - 2}" cy="${cy - 1}" r="1.8" fill="#fff"/><circle cx="${cx + 2}" cy="${cy - 1}" r="1.8" fill="#fff"/>` +
    `<circle cx="${cx - 1.8}" cy="${cy - 0.7}" r="0.9" fill="${O}"/><circle cx="${cx + 2.2}" cy="${cy - 0.7}" r="0.9" fill="${O}"/>`;
}

// Inslaget godis (karamell med vridna ändar).
const karamell = (x, y, c, rot = 0) =>
  `<g transform="translate(${x} ${y}) rotate(${rot})">` +
  `<path d="M-9 -3 L-5 0 L-9 3 Z M9 -3 L5 0 L9 3 Z" fill="${c}" ${THIN}/>` +
  `<ellipse cx="0" cy="0" rx="5.5" ry="4" fill="${c}" ${THIN}/>` +
  `<path d="M-2 -3 L1 3 M1 -3.5 L3.5 2" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity="0.8"/></g>`;

// Ett stearinljus med fladdrande låga, ljusets botten i (x,y).
const ljus = (x, y, h) =>
  `<rect x="${x - 4}" y="${y - h}" width="8" height="${h}" rx="2" fill="${KRAM}" ${THIN}/>` +
  `<path d="M${x - 2} ${y - h + 1} Q${x - 3} ${y - h + 6} ${x - 1} ${y - h + 7}" fill="none" stroke="#F4E3C1" stroke-width="2" stroke-linecap="round"/>` +
  anim("hw-flamma",
    `<path d="M${x} ${y - h - 12} Q${x + 5} ${y - h - 5} ${x + 3} ${y - h - 2} Q${x} ${y - h + 1} ${x - 3} ${y - h - 2} Q${x - 5} ${y - h - 5} ${x} ${y - h - 12} Z" fill="${GUL}" ${THIN}/>` +
    `<ellipse cx="${x}" cy="${y - h - 4}" rx="1.6" ry="2.6" fill="#fff" opacity="0.9"/>`);

/** id → { viewBox, w (rem i rummet), art, flat? } */
export const HW_INNE = {
  // Pumpalykta: rund pumpa med lysande ögon och leende som glöder svagt.
  "hw-pumpalykta": {
    viewBox: "0 0 76 70",
    w: 3.4,
    art:
      anim("hw-glod", `<ellipse cx="38" cy="42" rx="36" ry="26" fill="${SKEN}" opacity="0.45"/>`) +
      skugga(38, 65, 26) +
      pumpa(38, 42, 30, "lykta"),
  },
  // Spindelnät i hörnet med en liten vinkande spindel i en tråd.
  "hw-spindelnat": {
    viewBox: "0 0 66 70",
    w: 3.4,
    art:
      spindelnat() +
      `<path d="M44 34 L44 52" stroke="#F4F0FB" stroke-width="1.6"/>` +
      spindel(44, 56),
  },
  // Fladdermusgirlang: ett snöre med tre runda fladdermöss och små stjärnor.
  "hw-fladdermusgirlang": {
    viewBox: "0 0 100 44",
    w: 4.8,
    art:
      `<path d="M4 6 Q50 30 96 6" fill="none" ${THIN}/>` +
      `<circle cx="4" cy="6" r="2.6" fill="${WOOD_DARK}" stroke="none"/><circle cx="96" cy="6" r="2.6" fill="${WOOD_DARK}" stroke="none"/>` +
      `<path d="M28 15 L28 20 M50 18 L50 24 M72 15 L72 20" stroke="${O}" stroke-width="1.5"/>` +
      fladdermus(28, 26, 1) + fladdermus(50, 30, 1.1) + fladdermus(72, 26, 1) +
      glitter(16, 18, 3, GUL) + glitter(39, 26, 2.6, LILA) + glitter(61, 26, 2.6, LILA) + glitter(84, 18, 3, GUL),
  },
  // Skål med godis: lila skål full av karameller och en klubba.
  "hw-godisskal": {
    viewBox: "0 0 66 54",
    w: 2.9,
    art:
      skugga(33, 50, 24) +
      limb("M44 26 L50 6", KRAM, 2.5) +
      `<circle cx="50" cy="6" r="5.5" fill="#F890B7" ${THIN}/><path d="M47 4 Q51 2 52 7" fill="none" stroke="#fff" stroke-width="1.4"/>` +
      karamell(20, 24, PUMPA, -15) + karamell(34, 21, GRON, 10) + karamell(46, 25, LILA, -5) + karamell(27, 28, GUL, 20) +
      `<path d="M6 28 Q33 34 60 28 Q58 50 33 50 Q8 50 6 28 Z" fill="${LILA}" ${LINE}/>` +
      `<path d="M14 38 Q33 42 52 38" fill="none" stroke="#fff" stroke-width="1.6" opacity="0.6" stroke-dasharray="3 4"/>` +
      `<rect x="26" y="47" width="14" height="4" rx="2" fill="${LILA_MORK}" ${THIN}/>`,
  },
  // Häxkvast lutad mot väggen, med lila band och ett glitter.
  "hw-haxkvast": {
    viewBox: "0 0 48 100",
    w: 2.3,
    art:
      skugga(20, 96, 16) +
      limb("M36 4 L20 70", WOOD, 4.5) +
      `<path d="M15 66 Q8 80 4 94 Q14 97 22 96 Q30 97 36 92 Q30 80 27 69 Z" fill="${GUL}" ${LINE}/>` +
      `<path d="M12 78 L9 92 M18 76 L17 94 M24 76 L27 93" fill="none" stroke="#D9A72E" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M14 66 Q21 70 28 68 L27 73 Q20 75 13 71 Z" fill="${LILA_MORK}" ${THIN}/>` +
      glitter(40, 20, 4, LILA) + glitter(8, 40, 3, GUL),
  },
  // Ljusstake: tre fladdrande ljus på en svängd mässingsstake.
  "hw-ljusstake": {
    viewBox: "0 0 66 92",
    w: 3,
    art:
      skugga(33, 88, 20) +
      `<path d="M14 52 Q14 64 33 64 Q52 64 52 52" fill="none" stroke="${O}" stroke-width="8" stroke-linecap="round"/>` +
      `<path d="M14 52 Q14 64 33 64 Q52 64 52 52" fill="none" stroke="${GUL}" stroke-width="4" stroke-linecap="round"/>` +
      limb("M33 46 L33 82", GUL, 4) +
      `<path d="M20 86 Q33 76 46 86 Z" fill="${GUL}" ${LINE}/>` +
      `<rect x="8" y="49" width="12" height="5" rx="2" fill="${GUL}" ${THIN}/>` +
      `<rect x="46" y="49" width="12" height="5" rx="2" fill="${GUL}" ${THIN}/>` +
      `<rect x="27" y="43" width="12" height="5" rx="2" fill="${GUL}" ${THIN}/>` +
      ljus(14, 49, 16) + ljus(52, 49, 16) + ljus(33, 43, 20),
  },
  // Spökgardin: två ljusa draperier med små spökansikten och vågig fåll.
  "hw-spokgardin": {
    viewBox: "0 0 76 88",
    w: 8,
    art:
      `<path d="M8 10 Q6 46 10 78 Q16 82 22 78 Q27 82 33 78 Q36 46 34 10 Z" fill="#F4F0FB" ${LINE}/>` +
      `<path d="M42 10 Q40 46 43 78 Q49 82 55 78 Q60 82 66 78 Q70 46 68 10 Z" fill="#F4F0FB" ${LINE}/>` +
      `<path d="M16 16 Q14 46 17 72 M60 16 Q62 46 59 72" fill="none" stroke="${LILA}" stroke-width="2" stroke-linecap="round" opacity="0.6"/>` +
      oga(18, 42, 2.4) + oga(26, 42, 2.4) + `<ellipse cx="22" cy="49" rx="2" ry="2.5" fill="${O}"/>` +
      oga(50, 46, 2.4) + oga(58, 46, 2.4) + `<path d="M51 52 Q54 55 57 52" fill="none" ${THIN}/>` +
      `<rect x="2" y="5" width="72" height="7" rx="3.5" fill="${NATT}" ${LINE}/>` +
      `<circle cx="4" cy="8.5" r="4" fill="${LILA}" ${THIN}/><circle cx="72" cy="8.5" r="4" fill="${LILA}" ${THIN}/>`,
  },
  // Gullig skelettfigur: rund tecknad skalle med stora snälla ögon, rosett
  // och vinkande hand – på en liten sockel (ingen realistisk dödskalle).
  "hw-skelettfigur": {
    viewBox: "0 0 60 96",
    w: 2.7,
    art:
      skugga(30, 92, 20) +
      `<rect x="12" y="82" width="36" height="9" rx="3" fill="${LILA_MORK}" ${LINE}/>` +
      limb("M24 72 L22 82", "#fff", 3.5) + limb("M36 72 L38 82", "#fff", 3.5) +
      limb("M22 52 Q14 58 12 64", "#fff", 3) + limb("M38 52 Q46 46 48 38", "#fff", 3) +
      `<circle cx="48" cy="36" r="3.4" fill="#fff" ${THIN}/>` +
      `<path d="M21 48 Q30 44 39 48 L37 72 Q30 75 23 72 Z" fill="#fff" ${LINE}/>` +
      `<path d="M24 55 Q30 53 36 55 M24 61 Q30 59 36 61 M25 67 Q30 65 35 67" fill="none" ${THIN} opacity="0.55"/>` +
      `<circle cx="30" cy="27" r="18" fill="#fff" ${LINE}/>` +
      `<ellipse cx="23.5" cy="26" rx="5" ry="6" fill="${NATT}"/><ellipse cx="36.5" cy="26" rx="5" ry="6" fill="${NATT}"/>` +
      `<circle cx="25" cy="24" r="2" fill="#fff"/><circle cx="38" cy="24" r="2" fill="#fff"/>` +
      `<path d="M28 33 L30 30.5 L32 33 Z" fill="${NATT}"/>` +
      `<path d="M23 37 Q30 42 37 37" fill="none" ${THIN}/>` +
      `<ellipse cx="17" cy="33" rx="3" ry="1.8" fill="#FFB1B8" opacity="0.85"/><ellipse cx="43" cy="33" rx="3" ry="1.8" fill="#FFB1B8" opacity="0.85"/>` +
      `<path d="M30 10 L21 5 L22 15 Z M30 10 L39 5 L38 15 Z" fill="${PUMPA}" ${THIN}/><circle cx="30" cy="10" r="3" fill="${PUMPA_MORK}" ${THIN}/>`,
  },
  // Kristallkula: lila glaskula på mässingsfot – virvel som glimmar.
  "hw-kristallkula": {
    viewBox: "0 0 60 70",
    w: 2.8,
    art:
      skugga(30, 66, 20) +
      anim("hw-glod", `<circle cx="30" cy="28" r="27" fill="${LILA}" opacity="0.35"/>`) +
      `<path d="M14 64 Q16 50 22 48 L38 48 Q44 50 46 64 Z" fill="${GUL}" ${LINE}/>` +
      `<path d="M20 58 L40 58" fill="none" stroke="#D9A72E" stroke-width="2"/>` +
      `<circle cx="30" cy="28" r="21" fill="#D9CCF4" ${LINE}/>` +
      `<path d="M18 32 Q26 20 34 28 Q40 34 44 24" fill="none" stroke="${LILA_MORK}" stroke-width="3" stroke-linecap="round" opacity="0.6"/>` +
      `<path d="M16 24 Q18 14 27 11" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity="0.85"/>` +
      anim("hw-glimt", glitter(24, 34, 3.6) + glitter(38, 19, 2.8) + glitter(37, 38, 2.2, SKEN)),
  },
  // Halloweenmatta: platt oval lila matta med orange kant, pumpor och stjärnor.
  "hw-halloweenmatta": {
    viewBox: "0 0 140 64",
    w: 7.6,
    flat: true,
    art:
      `<ellipse cx="70" cy="32" rx="64" ry="26" fill="${PUMPA}" ${LINE}/>` +
      `<ellipse cx="70" cy="32" rx="54" ry="20" fill="${LILA_MORK}" ${THIN}/>` +
      `<ellipse cx="70" cy="32" rx="54" ry="20" fill="none" stroke="${NATT}" stroke-width="1.6" stroke-dasharray="4 5" opacity="0.6"/>` +
      `<g transform="translate(70 34) scale(0.9)">${pumpa(0, 0, 13, "glad")}</g>` +
      glitter(36, 28, 4, SKEN) + glitter(104, 28, 4, SKEN) + glitter(50, 42, 2.6, "#fff") + glitter(90, 22, 2.6, "#fff") +
      `<circle cx="34" cy="40" r="2" fill="${GUL}"/><circle cx="106" cy="40" r="2" fill="${GUL}"/>`,
  },
  // Spöklampa: lampskärmen är ett litet spöke som lyser svagt.
  "hw-spoklampa": {
    viewBox: "0 0 56 100",
    w: 2.8,
    art:
      skugga(28, 96, 18) +
      anim("hw-glod", `<ellipse cx="28" cy="26" rx="26" ry="24" fill="${SKEN}" opacity="0.5"/>`) +
      limb("M28 40 L28 88", NATT, 3.5) +
      `<path d="M14 94 Q28 82 42 94 Z" fill="${NATT}" ${LINE}/>` +
      spoke(28, 24, 1.55, "#FFFBEF") +
      `<path d="M42 50 L42 60" stroke="${O}" stroke-width="1.6"/><circle cx="42" cy="62" r="2.4" fill="${GUL}" ${THIN}/>`,
  },
  // Häxkittel: svart gryta på korta ben, grön bubblande dryck, liten eld under.
  "hw-haxkittel": {
    viewBox: "0 0 84 84",
    w: 3.8,
    art:
      skugga(42, 80, 30) +
      anim("hw-flamma",
        `<path d="M30 80 Q28 70 34 66 Q35 72 38 70 Q38 62 44 60 Q44 68 48 68 Q52 66 52 64 Q58 72 54 80 Z" fill="${PUMPA}" ${THIN}/>` +
        `<path d="M38 80 Q38 74 42 72 Q46 76 46 80 Z" fill="${GUL}" stroke="none"/>`) +
      limb("M22 66 L18 76", NATT, 3) + limb("M62 66 L66 76", NATT, 3) +
      `<path d="M10 34 Q8 70 42 70 Q76 70 74 34 Z" fill="${NATT}" ${LINE}/>` +
      `<path d="M18 44 Q20 60 34 64" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity="0.25"/>` +
      `<ellipse cx="42" cy="34" rx="34" ry="8" fill="${SLEM}" ${LINE}/>` +
      `<ellipse cx="42" cy="34" rx="28" ry="5" fill="${GRON}" stroke="none" opacity="0.7"/>` +
      `<rect x="6" y="30" width="72" height="7" rx="3.5" fill="none" ${LINE}/>` +
      anim("hw-bubbla", `<circle cx="34" cy="30" r="4" fill="${SLEM}" ${THIN}/>`) +
      anim("hw-bubbla d2", `<circle cx="50" cy="30" r="3" fill="${SLEM}" ${THIN}/>`) +
      anim("hw-bubbla d3", `<circle cx="42" cy="28" r="2.4" fill="${SLEM}" ${THIN}/>`) +
      `<circle cx="30" cy="33" r="2" fill="#fff" opacity="0.7"/><circle cx="54" cy="35" r="1.6" fill="#fff" opacity="0.7"/>` +
      oga(36, 52, 2.2) + oga(48, 52, 2.2) + `<path d="M39 58 Q42 60 45 58" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>` +
      `<ellipse cx="29" cy="56" rx="2.6" ry="1.5" fill="#F890B7" opacity="0.7"/><ellipse cx="55" cy="56" rx="2.6" ry="1.5" fill="#F890B7" opacity="0.7"/>`,
  },
};
