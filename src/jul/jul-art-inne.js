// ============================================================================
// Pluggporten – Jul-samlingens INNE-saker (#910): dekor & möbler
// ----------------------------------------------------------------------------
// Samma schema som art-decor/art-furniture: id → { viewBox, w (rem), art, flat? }.
// Registreras i art-items.js (registerItemArt) av jul-konst.js när den laddas.
// Id:na matchar jul-katalog.js exakt (sparas i Firestore) – byt bara utseendet.
// ============================================================================

import {
  O, LINE, THIN, limb, skugga, glitter, glod, stjarna5, ljus, kula, gran, bock, tomte, paket,
  JULROD, JULROD_MORK, GRAN, GRAN_MORK, GRAN_LJUS, GULD, GULD_MORK, SKEN, PEPPAR, SNOVIT, WOOD, WOOD_DARK,
} from "./jul-art-delar.js";

// Pepparkaka med vit kristyrkant: "hjarta" | "stjarna" | "gubbe", centrerad i (cx,cy).
function pepparkaka(form, cx, cy, s = 1) {
  const krist = `fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="2.5 2.5"`;
  let p;
  if (form === "hjarta") {
    p = `<path d="M0 8 Q-12 0 -10 -6 Q-8 -11 -3 -9 Q-1 -8 0 -5 Q1 -8 3 -9 Q8 -11 10 -6 Q12 0 0 8 Z" fill="${PEPPAR}" ${THIN}/>` +
      `<path d="M0 4.5 Q-8 -1 -7 -5 Q-5 -8 -2 -6.5 M0 4.5 Q8 -1 7 -5 Q5 -8 2 -6.5" ${krist}/>`;
  } else if (form === "stjarna") {
    p = stjarna5(0, 0, 10, PEPPAR, 0.5) + `<circle cx="0" cy="0" r="3" fill="none" stroke="#fff" stroke-width="1.6"/>`;
  } else {
    p = `<path d="M-3 -6 L-9 -3 Q-11 0 -8 1 L-4 0 L-6 8 Q-5 11 -2 9 L0 5 L2 9 Q5 11 6 8 L4 0 L8 1 Q11 0 9 -3 L3 -6 Z" fill="${PEPPAR}" ${THIN}/>` +
      `<circle cx="0" cy="-9" r="5" fill="${PEPPAR}" ${THIN}/>` +
      `<circle cx="-1.8" cy="-9.5" r="0.9" fill="#fff"/><circle cx="1.8" cy="-9.5" r="0.9" fill="#fff"/>` +
      `<path d="M-2 -7.5 Q0 -6 2 -7.5" ${krist} stroke-dasharray="none"/>` +
      `<circle cx="0" cy="-1" r="1" fill="#fff"/><circle cx="0" cy="2.5" r="1" fill="#fff"/>`;
  }
  return `<g transform="translate(${cx} ${cy}) scale(${s})">${p}</g>`;
}

// Liten julstrumpa som hänger i (x,y) (överkanten), färg c.
const strumpa = (x, y, c, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})">` +
  `<path d="M-7 0 L7 0 L7 16 Q7 22 13 24 Q17 27 13 31 Q8 33 0 30 Q-7 27 -7 19 Z" fill="${c}" ${THIN}/>` +
  `<rect x="-8.5" y="-3" width="17" height="7" rx="3" fill="#fff" ${THIN}/>` +
  `<path d="M-3 14 L3 14 M-3 20 L3 20" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/></g>`;

/** id → { viewBox, w (rem i rummet), art, flat? } */
export const JUL_INNE = {
  // Adventsljusstake: röd båt med lingonris och fyra ljus som lyser varmt.
  "jul-adventsljusstake": {
    viewBox: "0 0 96 72",
    w: 4,
    art:
      glod(`<ellipse cx="48" cy="28" rx="42" ry="18" fill="${SKEN}" opacity="0.5"/>`) +
      skugga(48, 68, 38) +
      ljus(20, 50, 18) + ljus(38, 50, 18) + ljus(58, 50, 18) + ljus(76, 50, 18) +
      `<path d="M8 48 L88 48 Q86 64 70 66 L26 66 Q10 64 8 48 Z" fill="${JULROD}" ${LINE}/>` +
      `<path d="M14 54 Q48 58 82 54" fill="none" stroke="${JULROD_MORK}" stroke-width="2" opacity="0.7"/>` +
      `<path d="M10 48 Q18 42 26 47 Q32 42 40 47 Q48 42 56 47 Q64 42 72 47 Q80 42 86 48" fill="none" stroke="${GRAN}" stroke-width="5" stroke-linecap="round"/>` +
      `<circle cx="29" cy="46" r="2.4" fill="${JULROD}" ${THIN}/><circle cx="48" cy="45" r="2.4" fill="${JULROD}" ${THIN}/><circle cx="67" cy="46" r="2.4" fill="${JULROD}" ${THIN}/>`,
  },
  // Julstjärna i fönstret: röd pappersstjärna i ett snöre, lyser inifrån.
  "jul-julstjarna": {
    viewBox: "0 0 72 94",
    w: 3,
    art:
      `<path d="M36 0 L36 22" stroke="${O}" stroke-width="1.6"/>` +
      glod(`<circle cx="36" cy="54" r="32" fill="${SKEN}" opacity="0.55"/>`) +
      stjarna5(36, 54, 30, JULROD, 0.5) +
      stjarna5(36, 54, 17, "#F07C6E", 0.5) +
      `<circle cx="36" cy="54" r="6" fill="${SKEN}" ${THIN}/>` +
      `<circle cx="36" cy="34" r="1.6" fill="${SKEN}"/><circle cx="52" cy="48" r="1.6" fill="${SKEN}"/><circle cx="20" cy="48" r="1.6" fill="${SKEN}"/>` +
      `<circle cx="46" cy="68" r="1.6" fill="${SKEN}"/><circle cx="26" cy="68" r="1.6" fill="${SKEN}"/>` +
      `<path d="M30 84 L36 76 L42 84" fill="none" stroke="${GULD_MORK}" stroke-width="2" stroke-linecap="round"/>`,
  },
  // Pepparkaksfat: vitt fat med hjärta, stjärna och en pepparkaksgubbe.
  "jul-pepparkaksfat": {
    viewBox: "0 0 78 52",
    w: 3.2,
    art:
      skugga(39, 48, 32) +
      `<ellipse cx="39" cy="34" rx="36" ry="13" fill="#fff" ${LINE}/>` +
      `<ellipse cx="39" cy="33" rx="27" ry="8.5" fill="none" stroke="${JULROD}" stroke-width="1.6" stroke-dasharray="3 3" opacity="0.7"/>` +
      pepparkaka("hjarta", 22, 28, 1) + pepparkaka("stjarna", 56, 28, 1) + pepparkaka("gubbe", 39, 24, 1.1),
  },
  // Liten julbock av halm med röda band.
  "jul-julbock": {
    viewBox: "0 0 66 70",
    w: 2.4,
    art: skugga(30, 66, 22) + bock(28, 66, 1.12),
  },
  // Tomtefigur: rund tomte med lång luva och vitt skägg, bredvid ett paket.
  "jul-tomtefigur": {
    viewBox: "0 0 64 84",
    w: 2.6,
    art: skugga(30, 80, 24) + paket(40, 80, 18, 14, GRAN, GULD) + tomte(26, 80, 1.6),
  },
  // Julstrumpa: röd strumpa med vit kant på en krok, en polkagris sticker upp.
  "jul-julstrumpa": {
    viewBox: "0 0 48 80",
    w: 2,
    art:
      `<path d="M12 2 Q10 6 12 10" fill="none" stroke="${WOOD_DARK}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M24 14 L24 6 Q24 2 28 2 Q32 2 32 6" fill="none" stroke="${O}" stroke-width="7.5" stroke-linecap="round"/>` +
      `<path d="M24 14 L24 6 Q24 2 28 2 Q32 2 32 6" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M24 14 L24 6 Q24 2 28 2 Q32 2 32 6" fill="none" stroke="${JULROD}" stroke-width="4" stroke-dasharray="2.5 3"/>` +
      `<path d="M7 16 L29 16 L29 46 Q29 54 38 57 Q46 61 41 69 Q34 76 20 71 Q7 66 7 52 Z" fill="${JULROD}" ${LINE}/>` +
      `<rect x="4" y="9" width="28" height="11" rx="5" fill="#fff" ${LINE}/>` +
      `<path d="M12 30 L24 30 M12 40 L24 40" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity="0.85"/>` +
      `<circle cx="18" cy="56" r="2" fill="#fff"/><circle cx="30" cy="64" r="2" fill="#fff"/>`,
  },
  // Snöglob: glaskula med ett litet rött hus och en gran i snö, på träfot.
  "jul-snoglob": {
    viewBox: "0 0 62 74",
    w: 2.6,
    art:
      skugga(31, 70, 22) +
      `<path d="M10 70 Q12 56 18 54 L44 54 Q50 56 52 70 Z" fill="${WOOD}" ${LINE}/>` +
      `<path d="M16 62 L46 62" stroke="${WOOD_DARK}" stroke-width="2"/>` +
      `<circle cx="31" cy="30" r="24" fill="#DDEFFA" ${LINE}/>` +
      `<path d="M10 40 Q31 32 52 40 Q48 52 31 53 Q14 52 10 40 Z" fill="${SNOVIT}" ${THIN}/>` +
      `<path d="M20 40 L20 30 L26 24 L32 30 L32 40 Z" fill="${JULROD}" ${THIN}/>` +
      `<rect x="24" y="33" width="4" height="7" fill="${SKEN}" stroke="none"/>` +
      `<path d="M41 22 L47 38 L35 38 Z" fill="${GRAN}" ${THIN}/>` +
      `<path d="M14 22 Q16 12 26 9" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity="0.85"/>` +
      glod(glitter(18, 30, 2) + glitter(40, 14, 2.2) + glitter(30, 18, 1.6) + glitter(46, 28, 1.6) + glitter(24, 46, 1.6)),
  },
  // Ljusslinga: grön sladd med runda lampor i olika färger som lyser.
  "jul-ljusslinga": {
    viewBox: "0 0 104 42",
    w: 4.8,
    art: (() => {
      const lampor = [[12, 13, GULD], [26, 20, JULROD], [40, 25, "#7FC7E8"], [54, 26, GULD], [68, 24, "#6FC66F"], [82, 19, JULROD], [94, 13, "#B79BE0"]];
      const sken = lampor.map(([x, y, c]) => `<circle cx="${x}" cy="${y + 9}" r="7" fill="${c}" opacity="0.45"/>`).join("");
      const glas = lampor.map(([x, y, c]) =>
        `<rect x="${x - 2.5}" y="${y - 1}" width="5" height="4" rx="1" fill="${GRAN_MORK}" ${THIN}/>` +
        `<path d="M${x - 3.5} ${y + 3} Q${x - 4.5} ${y + 9} ${x} ${y + 13} Q${x + 4.5} ${y + 9} ${x + 3.5} ${y + 3} Z" fill="${c}" ${THIN}/>` +
        `<circle cx="${x - 1.2}" cy="${y + 6}" r="1.2" fill="#fff" opacity="0.8"/>`).join("");
      return `<path d="M2 8 Q52 34 102 8" fill="none" stroke="${GRAN_MORK}" stroke-width="2.4"/>` + glod(sken) + glas;
    })(),
  },
  // Mistel: gröna blad med vita bär under en röd rosett, hänger i ett band.
  "jul-mistel": {
    viewBox: "0 0 60 82",
    w: 2.4,
    art: (() => {
      const blad = (x, y, rot) =>
        `<path transform="translate(${x} ${y}) rotate(${rot})" d="M0 0 Q6 -6 14 -2 Q8 5 0 0 Z" fill="${GRAN_LJUS}" ${THIN}/>`;
      return (
        `<path d="M30 0 L30 28" stroke="${JULROD}" stroke-width="3"/>` +
        limb("M30 30 L22 60 M30 30 L30 64 M30 30 L38 60", GRAN_MORK, 2.4) +
        blad(24, 48, 150) + blad(36, 48, 30) + blad(30, 58, 100) + blad(22, 60, 200) + blad(38, 60, -20) +
        blad(27, 40, 200) + blad(33, 40, -20) +
        `<circle cx="30" cy="62" r="3.2" fill="#fff" ${THIN}/><circle cx="25" cy="58" r="3" fill="#fff" ${THIN}/>` +
        `<circle cx="35" cy="58" r="3" fill="#fff" ${THIN}/><circle cx="30" cy="54" r="2.6" fill="#fff" ${THIN}/>` +
        `<path d="M30 28 Q16 18 18 30 Q20 36 30 30 Z M30 28 Q44 18 42 30 Q40 36 30 30 Z" fill="${JULROD}" ${THIN}/>` +
        `<path d="M28 31 L22 42 M32 31 L38 42" stroke="${JULROD}" stroke-width="3.2" stroke-linecap="round"/>` +
        `<circle cx="30" cy="29" r="3.6" fill="${JULROD_MORK}" ${THIN}/>`
      );
    })(),
  },
  // Julmatta: platt oval röd matta med vit kant, grön krans och stjärna.
  "jul-julmatta": {
    viewBox: "0 0 140 64",
    w: 7.6,
    flat: true,
    art:
      `<ellipse cx="70" cy="32" rx="64" ry="26" fill="${JULROD}" ${LINE}/>` +
      `<ellipse cx="70" cy="32" rx="56" ry="21" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="6 5"/>` +
      `<ellipse cx="70" cy="32" rx="40" ry="14" fill="${JULROD_MORK}" ${THIN}/>` +
      `<ellipse cx="70" cy="32" rx="30" ry="10" fill="none" stroke="${GRAN}" stroke-width="4"/>` +
      `<g transform="translate(70 32) scale(1 0.55)">${stjarna5(0, 0, 11, GULD)}</g>` +
      glitter(30, 30, 3.4, "#fff") + glitter(110, 30, 3.4, "#fff") + glitter(46, 46, 2.4, SKEN) + glitter(94, 18, 2.4, SKEN),
  },
  // Öppen spis: tegelspis med sprakande eld, tre strumpor och ljus på hyllan.
  "jul-oppen-spis": {
    viewBox: "0 0 104 100",
    w: 4.6,
    art:
      skugga(52, 96, 46) +
      `<rect x="8" y="24" width="88" height="70" rx="4" fill="#C9675A" ${LINE}/>` +
      `<path d="M8 40 L96 40 M8 56 L26 56 M78 56 L96 56 M8 72 L26 72 M78 72 L96 72 M30 32 L30 40 M60 32 L60 40 M18 40 L18 56 M86 40 L86 56 M18 72 L18 92 M86 72 L86 92" ` +
      `stroke="#A4473F" stroke-width="2" opacity="0.8"/>` +
      `<path d="M26 94 L26 64 Q26 46 52 46 Q78 46 78 64 L78 94 Z" fill="#3E3445" ${LINE}/>` +
      glod(`<ellipse cx="52" cy="82" rx="26" ry="16" fill="${SKEN}" opacity="0.6"/>`) +
      `<path d="M36 90 Q32 78 40 72 Q41 79 44 77 Q44 66 52 62 Q53 71 57 71 Q62 68 61 64 Q70 76 66 90 Z" fill="#F49E4C" ${THIN}/>` +
      `<path d="M44 90 Q43 82 48 79 Q50 84 53 82 Q58 86 57 90 Z" fill="${GULD}" stroke="none"/>` +
      limb("M34 92 L70 88 M36 88 L68 92", WOOD_DARK, 4) +
      `<rect x="2" y="16" width="100" height="10" rx="3" fill="${WOOD}" ${LINE}/>` +
      ljus(14, 16, 8) + ljus(90, 16, 8) +
      `<path d="M28 16 Q52 8 76 16" fill="none" stroke="${GRAN}" stroke-width="5" stroke-linecap="round"/>` +
      `<circle cx="40" cy="13" r="2.2" fill="${JULROD}" ${THIN}/><circle cx="64" cy="13" r="2.2" fill="${JULROD}" ${THIN}/>` +
      strumpa(20, 27, JULROD, 0.9) + strumpa(52, 27, GRAN, 0.7) + strumpa(84, 27, "#7FC7E8", 0.9),
  },
  // Julgran med pynt: gran i röd kruka med kulor, girlang och guldstjärna som lyser.
  "jul-julgran": {
    viewBox: "0 0 84 116",
    w: 3.6,
    art:
      skugga(42, 112, 26) +
      glod(`<circle cx="42" cy="14" r="14" fill="${SKEN}" opacity="0.7"/>`) +
      `<path d="M28 96 L56 96 L52 112 L32 112 Z" fill="${JULROD}" ${LINE}/>` +
      `<rect x="38" y="90" width="8" height="8" fill="${WOOD_DARK}" ${THIN}/>` +
      gran(42, 14, 94, 38, 3) +
      `<path d="M28 44 Q44 52 56 42 M20 66 Q42 76 64 64 M14 86 Q42 98 72 86" fill="none" stroke="${GULD}" stroke-width="2.4" stroke-linecap="round"/>` +
      kula(36, 36, 3.6, JULROD) + kula(50, 50, 3.6, "#7FC7E8") + kula(30, 58, 4, GULD) + kula(56, 72, 4, JULROD) +
      kula(26, 80, 4, "#B79BE0") + kula(44, 84, 4, GULD) + kula(62, 88, 3.6, "#7FC7E8") +
      stjarna5(42, 12, 10, GULD) +
      paket(10, 112, 16, 12, "#7FC7E8", JULROD) + paket(58, 112, 18, 10, GULD, JULROD),
  },
};
