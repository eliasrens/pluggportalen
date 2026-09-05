// ============================================================================
// Pluggportalen – karaktärskonst: RITFUNKTIONERNA (inline SVG, helkropp)
// ----------------------------------------------------------------------------
// Bara konsten bor här. Alla figurer följer stilguiden och ankargriddet i
// art-style.js: viewBox "0 0 100 120", huvud (50,36) r≈22, ögon y=34, hals
// y≈58, höger tass (79,77), fötter y≈109. Tack vare griddet passar klädseln
// (art-wearables.js) på ALLA figurer med samma slot-koordinater.
//
// Katalogen (id→namn), evolutionen och API:t ligger i art-characters.js, som
// plockar upp CHARACTER_ART härifrån. En ny figur: rita en `xArt()` nedan,
// lägg den i CHARACTER_ART och ge den ett namn i art-characters.js.
//
// Id:na sparas i Firestore (student.avatarId) – håll dem stabila.
// ============================================================================

import {
  O, LINE, THIN,
  eye, eyes, cheeks, smile, laugh,
  limb, feet, stdBody, head, pointyEar, roundEar, nose,
} from "./art-style.js";
// Roboten har evolution (3 steg + grenval) och bor i en egen fil.
import { robotArt } from "./art-characters-robot.js";

// --- Karaktärerna -----------------------------------------------------------
// Varje funktion returnerar SVG-innehållet (utan <svg>-wrappern).

function foxArt() {
  const fur = "#F49E4C", belly = "#FFE9CC";
  return (
    // yvig svans med vit tipp (bakom kroppen)
    `<path d="M66 92 Q88 96 88 78 Q88 66 76 68 Q80 78 70 82 Z" fill="${fur}" ${LINE}/>` +
    `<path d="M83 71 Q88 68 88 78 Q88 84 80 88 Q86 78 83 71 Z" fill="#fff" stroke="none"/>` +
    stdBody(fur, belly) +
    pointyEar(-1, fur, "#fff") + pointyEar(1, fur, "#fff") +
    head(fur) +
    // vita kindfjun + nosparti
    `<path d="M31 44 Q40 54 50 52 Q60 54 69 44 Q62 58 50 58 Q38 58 31 44 Z" fill="#FFE9CC" stroke="none"/>` +
    `<ellipse cx="50" cy="46" rx="10" ry="7.5" fill="#fff" stroke="none"/>` +
    eyes() + nose(42.5) + smile(47, 5.5) + cheeks()
  );
}

function owlArt() {
  const fur = "#B08154", belly = "#F2E3C4", beak = "#F2A93B";
  return (
    // örontofsar
    `<path d="M30 22 L26 6 L40 14 Z" fill="${fur}" ${LINE}/>` +
    `<path d="M70 22 L74 6 L60 14 Z" fill="${fur}" ${LINE}/>` +
    // äggformad kropp = huvud + mage i ett
    `<path d="M50 14 C26 14 24 42 26 68 C28 96 36 106 50 106 C64 106 72 96 74 68 C76 42 74 14 50 14 Z" fill="${fur}" ${LINE}/>` +
    // vingar
    `<path d="M27 56 Q16 70 26 84 Q32 76 33 62 Z" fill="#96683F" ${LINE}/>` +
    `<path d="M73 56 Q84 70 74 84 Q68 76 67 62 Z" fill="#96683F" ${LINE}/>` +
    // ljus mage med fjäderbågar
    `<path d="M35 62 Q50 54 65 62 Q68 92 50 98 Q32 92 35 62 Z" fill="${belly}" stroke="none"/>` +
    `<path d="M40 74 Q44 79 48 74 M52 74 Q56 79 60 74 M44 84 Q48 89 52 84" fill="none" ${THIN}/>` +
    // ansiktsskiva + stora ugglögon
    `<path d="M32 34 Q50 22 68 34 Q60 46 50 46 Q40 46 32 34 Z" fill="${belly}" stroke="none"/>` +
    eyes(34, 10, 7.5) +
    `<path d="M50 39 L45 45 Q50 49 55 45 Z" fill="${beak}" ${THIN}/>` +
    cheeks(46, 17) +
    // fötter
    `<path d="M40 106 L36 113 M40 106 L40 114 M40 106 L44 113 M60 106 L56 113 M60 106 L60 114 M60 106 L64 113" fill="none" stroke="${beak}" stroke-width="3.4" stroke-linecap="round"/>`
  );
}

function catArt() {
  const fur = "#A8BAD1", belly = "#E8EFF9";
  return (
    // svans som ringlar
    limb("M64 98 Q84 102 84 86 Q84 76 74 78", fur, 7) +
    stdBody(fur, belly) +
    pointyEar(-1, fur, "#F5C1CB") + pointyEar(1, fur, "#F5C1CB") +
    head(fur) +
    eyes() +
    nose(41.5, "#E88A9C") +
    `<path d="M46 45 Q48 48 50 45 Q52 48 54 45" fill="none" ${THIN}/>` +
    // morrhår
    `<path d="M24 40 L34 41 M24 46 L34 45 M76 40 L66 41 M76 46 L66 45" fill="none" ${THIN}/>` +
    cheeks()
  );
}

function dogArt() {
  const fur = "#C9996B", belly = "#F0DFC2", patch = "#A97B4F";
  return (
    // viftande svans
    limb("M65 96 Q80 92 82 80", fur, 7) +
    stdBody(fur, belly) +
    head(fur) +
    // hängande öron (framför huvudkanten)
    `<path d="M31 20 Q20 24 23 44 Q25 54 33 49 Q29 34 34 24 Z" fill="${patch}" ${LINE}/>` +
    `<path d="M69 20 Q80 24 77 44 Q75 54 67 49 Q71 34 66 24 Z" fill="${patch}" ${LINE}/>` +
    // fläck runt ena ögat
    `<circle cx="59" cy="33" r="9.5" fill="${patch}" stroke="none"/>` +
    eyes() +
    `<ellipse cx="50" cy="47" rx="9" ry="6.5" fill="${belly}" stroke="none"/>` +
    nose(44) + laugh(49, 5.5) + cheeks(44)
  );
}

function pandaArt() {
  const dark = "#4C4661";
  return (
    feet(dark) +
    `<path d="M35 62 C29 82 29 104 50 104 C71 104 71 82 65 62 Q50 55 35 62 Z" fill="#fff" ${LINE}/>` +
    limb("M37 66 Q29 72 28 80", dark) +
    `<circle cx="28" cy="81" r="5.3" fill="${dark}" ${THIN}/>` +
    limb("M63 66 Q75 68 78 75", dark) +
    `<circle cx="79" cy="77" r="5.3" fill="${dark}" ${THIN}/>` +
    roundEar(-1, dark, dark) + roundEar(1, dark, dark) +
    head("#fff") +
    // svarta ögonfläckar
    `<ellipse cx="41" cy="34" rx="8.5" ry="9.5" fill="${dark}" stroke="none" transform="rotate(-14 41 34)"/>` +
    `<ellipse cx="59" cy="34" rx="8.5" ry="9.5" fill="${dark}" stroke="none" transform="rotate(14 59 34)"/>` +
    eyes(34, 9, 5) +
    nose(43, dark) + smile(47, 5.5) + cheeks(45)
  );
}

function frogArt() {
  const fur = "#6FC66F", belly = "#D8F0C0";
  return (
    stdBody(fur, belly) +
    // ögonbulor på hjässan
    `<circle cx="38" cy="18" r="9.5" fill="${fur}" ${LINE}/>` +
    `<circle cx="62" cy="18" r="9.5" fill="${fur}" ${LINE}/>` +
    head(fur) +
    eye(38, 17, 6) + eye(62, 17, 6) +
    `<circle cx="46" cy="36" r="1.4" fill="${O}"/><circle cx="54" cy="36" r="1.4" fill="${O}"/>` +
    `<path d="M34 42 Q50 54 66 42" fill="none" ${LINE}/>` +
    cheeks(45, 19)
  );
}

function unicornArt() {
  const fur = "#fff";
  const mane = ["#F890B7", "#B79BE0", "#7FC7E8"];
  return (
    // regnbågssvans
    `<path d="M64 94 Q82 96 84 82" fill="none" stroke="${mane[0]}" stroke-width="9" stroke-linecap="round"/>` +
    `<path d="M66 90 Q78 90 80 80" fill="none" stroke="${mane[2]}" stroke-width="5" stroke-linecap="round"/>` +
    stdBody(fur, "#FDEBF2", "#F5C1CB") +
    pointyEar(-1, fur, "#F5C1CB") + pointyEar(1, fur, "#F5C1CB") +
    // gyllene horn
    `<path d="M50 -1 L46.5 16 L53.5 16 Z" fill="#F7C948" ${LINE}/>` +
    head(fur) +
    // man i tre färger längs sidan
    `<path d="M30 18 Q24 26 28 36 Q34 30 36 22 Z" fill="${mane[0]}" ${THIN}/>` +
    `<path d="M28 34 Q24 42 30 50 Q35 43 34 35 Z" fill="${mane[1]}" ${THIN}/>` +
    `<path d="M32 48 Q30 56 37 60 Q40 53 37 47 Z" fill="${mane[2]}" ${THIN}/>` +
    eyes() +
    `<ellipse cx="50" cy="46" rx="9" ry="6.5" fill="#FDEBF2" stroke="none"/>` +
    `<circle cx="47" cy="45" r="1.3" fill="${O}"/><circle cx="53" cy="45" r="1.3" fill="${O}"/>` +
    smile(49, 5) + cheeks(44)
  );
}

function dragonArt() {
  const fur = "#58C6A9", belly = "#C9F0DC", wing = "#9ADBC8";
  return (
    // vingar bakom kroppen
    `<path d="M28 62 Q10 56 12 74 Q20 70 24 76 Q26 68 32 70 Z" fill="${wing}" ${LINE}/>` +
    `<path d="M72 62 Q90 56 88 74 Q80 70 76 76 Q74 68 68 70 Z" fill="${wing}" ${LINE}/>` +
    // svans med spadspets
    limb("M64 98 Q82 100 86 88", fur, 7) +
    `<path d="M83 90 L92 80 L94 92 Z" fill="${fur}" ${LINE}/>` +
    stdBody(fur, belly) +
    // magplattor
    `<path d="M42 76 Q50 72 58 76 M41 85 Q50 81 59 85 M42 94 Q50 90 58 94" fill="none" ${THIN}/>` +
    // små horn
    `<path d="M38 17 L34 5 L44 12 Z" fill="#FFF3DC" ${LINE}/>` +
    `<path d="M62 17 L66 5 L56 12 Z" fill="#FFF3DC" ${LINE}/>` +
    head(fur) +
    eyes() +
    // nosbula med näsborrar
    `<ellipse cx="50" cy="45" rx="10" ry="6.5" fill="${belly}" stroke="none"/>` +
    `<circle cx="46" cy="43.5" r="1.5" fill="${O}"/><circle cx="54" cy="43.5" r="1.5" fill="${O}"/>` +
    laugh(48, 5.5) + cheeks(44)
  );
}

function lionArt() {
  const fur = "#F3B24A", mane = "#E08A3C", belly = "#FBE3B0";
  return (
    // svans med tofs
    limb("M64 98 Q82 100 84 86", fur, 6) +
    `<circle cx="85" cy="84" r="4.5" fill="${mane}" ${THIN}/>` +
    stdBody(fur, belly) +
    // taggig man bakom huvudet
    `<path d="M50 8 L57 14 L66 11 L69 19 L78 20 L76 28 L83 33 L77 39 L80 47 L71 48 L69 56 L61 53 L55 60 L50 54 L45 60 L39 53 L31 56 L29 48 L20 47 L23 39 L17 33 L24 28 L22 20 L31 19 L34 11 L43 14 Z" fill="${mane}" ${LINE}/>` +
    head(fur, 20) +
    eyes() +
    `<ellipse cx="50" cy="46" rx="9" ry="6.5" fill="${belly}" stroke="none"/>` +
    nose(43) + smile(48, 5) + cheeks(44, 16)
  );
}

function penguinArt() {
  const fur = "#46557A", beak = "#F2A93B";
  return (
    // äggformad kropp
    `<path d="M50 14 C26 14 24 44 26 70 C28 96 36 106 50 106 C64 106 72 96 74 70 C76 44 74 14 50 14 Z" fill="${fur}" ${LINE}/>` +
    // vingar
    `<path d="M27 58 Q15 70 25 84 Q31 76 32 62 Z" fill="${fur}" ${LINE}/>` +
    `<path d="M73 58 Q85 70 75 84 Q69 76 68 62 Z" fill="${fur}" ${LINE}/>` +
    // vitt ansikte + mage i ett
    `<path d="M50 22 C38 22 34 30 35 44 C30 56 32 88 50 96 C68 88 70 56 65 44 C66 30 62 22 50 22 Z" fill="#fff" stroke="none"/>` +
    eyes() +
    `<path d="M44 41 Q50 38 56 41 Q53 48 50 48 Q47 48 44 41 Z" fill="${beak}" ${THIN}/>` +
    cheeks(45, 15) +
    `<ellipse cx="40" cy="108" rx="8" ry="4.6" fill="${beak}" ${LINE}/>` +
    `<ellipse cx="60" cy="108" rx="8" ry="4.6" fill="${beak}" ${LINE}/>`
  );
}

function koalaArt() {
  const fur = "#A6ADBD", belly = "#DDE2EC";
  return (
    stdBody(fur, belly) +
    // stora fluffiga öron
    roundEar(-1, fur, "#E5A9B8", 10.5) + roundEar(1, fur, "#E5A9B8", 10.5) +
    head(fur) +
    eyes() +
    `<ellipse cx="50" cy="43" rx="4.6" ry="6" fill="#4C4661" stroke="none"/>` +
    smile(50, 4.5) + cheeks(45)
  );
}

function bearArt() {
  const fur = "#B0805A", belly = "#E9D3AE", muzzle = "#F1DFC0";
  return (
    stdBody(fur, belly) +
    roundEar(-1, fur, muzzle) + roundEar(1, fur, muzzle) +
    head(fur) +
    eyes() +
    `<ellipse cx="50" cy="45" rx="9.5" ry="7" fill="${muzzle}" stroke="none"/>` +
    nose(42.5) + smile(48, 5) + cheeks(44)
  );
}

function tigerArt() {
  const fur = "#F08A3C", belly = "#FFE9CC", stripe = "#46405C";
  return (
    // randig svans
    limb("M64 98 Q82 100 84 86", fur, 7) +
    stdBody(fur, belly) +
    roundEar(-1, fur, "#FFE9CC", 8) + roundEar(1, fur, "#FFE9CC", 8) +
    head(fur) +
    // ränder på huvudets sidor + pannan
    `<path d="M29 30 Q34 31 37 30 Q34 34 29 34 Z" fill="${stripe}" stroke="none"/>` +
    `<path d="M71 30 Q66 31 63 30 Q66 34 71 34 Z" fill="${stripe}" stroke="none"/>` +
    `<path d="M46 16 L48 22 L50 16 L52 22 L54 16 Q52 14 50 14 Q48 14 46 16 Z" fill="${stripe}" stroke="none"/>` +
    eyes() +
    `<ellipse cx="50" cy="46" rx="9.5" ry="7" fill="#fff" stroke="none"/>` +
    nose(42.5, "#E5697E") +
    `<path d="M46 46 Q48 49 50 46 Q52 49 54 46" fill="none" ${THIN}/>` +
    cheeks()
  );
}

function rabbitArt() {
  const fur = "#EDE9F0", belly = "#FBF7FB", inner = "#F5C1CB";
  return (
    // ludden svans
    `<circle cx="66" cy="96" r="6" fill="#fff" ${LINE}/>` +
    stdBody(fur, belly) +
    // långa upprättstående öron
    `<path d="M42 22 Q34 -2 43 1 Q47 10 47 23 Z" fill="${fur}" ${LINE}/>` +
    `<path d="M58 22 Q66 -2 57 1 Q53 10 53 23 Z" fill="${fur}" ${LINE}/>` +
    `<path d="M43 19 Q39 4 43 6 Q45 12 45 20 Z" fill="${inner}" stroke="none"/>` +
    `<path d="M57 19 Q61 4 57 6 Q55 12 55 20 Z" fill="${inner}" stroke="none"/>` +
    head(fur) +
    eyes() +
    nose(43, "#E88A9C") +
    `<path d="M46 46 Q48 49 50 46 Q52 49 54 46" fill="none" ${THIN}/>` +
    // framtänder
    `<rect x="47.6" y="48" width="4.8" height="4" rx="1.2" fill="#fff" ${THIN}/>` +
    cheeks()
  );
}

function pigArt() {
  const fur = "#F5A9C0", belly = "#FBD3E0", snout = "#EF9BB4";
  return (
    // liten virvelsvans
    `<path d="M64 96 Q74 96 74 88 Q74 82 68 84" fill="none" stroke="${O}" stroke-width="3" stroke-linecap="round"/>` +
    stdBody(fur, belly) +
    // triangelöron
    `<path d="M34 22 L30 9 L45 18 Z" fill="${fur}" ${LINE}/>` +
    `<path d="M66 22 L70 9 L55 18 Z" fill="${fur}" ${LINE}/>` +
    head(fur) +
    eyes() +
    // trynet
    `<ellipse cx="50" cy="46" rx="9" ry="6.5" fill="${snout}" ${THIN}/>` +
    `<ellipse cx="46.5" cy="46" rx="1.6" ry="2.3" fill="${O}" stroke="none"/>` +
    `<ellipse cx="53.5" cy="46" rx="1.6" ry="2.3" fill="${O}" stroke="none"/>` +
    smile(52, 4) + cheeks()
  );
}

function cowArt() {
  const fur = "#F2F1F4", belly = "#fff", spot = "#6E6A7A", muzzle = "#F5C1CB";
  return (
    limb("M64 98 Q82 100 84 88", fur, 6) +
    `<circle cx="85" cy="86" r="4" fill="${spot}" ${THIN}/>` +
    stdBody(fur, belly) +
    // öron på sidan
    `<ellipse cx="29" cy="30" rx="7" ry="4.5" fill="${fur}" ${LINE}/>` +
    `<ellipse cx="71" cy="30" rx="7" ry="4.5" fill="${fur}" ${LINE}/>` +
    // horn
    `<path d="M41 18 Q36 10 41 8 Q43 13 44 19 Z" fill="#FFF3DC" ${THIN}/>` +
    `<path d="M59 18 Q64 10 59 8 Q57 13 56 19 Z" fill="#FFF3DC" ${THIN}/>` +
    head(fur) +
    // svart fläck på pannan
    `<path d="M31 30 Q40 24 43 33 Q40 42 31 38 Z" fill="${spot}" stroke="none"/>` +
    eyes() +
    // mule
    `<ellipse cx="50" cy="47" rx="11" ry="7.5" fill="${muzzle}" stroke="none"/>` +
    `<circle cx="46" cy="46" r="1.6" fill="${O}"/><circle cx="54" cy="46" r="1.6" fill="${O}"/>` +
    smile(50, 4) + cheeks(44)
  );
}

function monkeyArt() {
  const fur = "#A9764E", face = "#E7C39B";
  return (
    // svans
    limb("M64 98 Q86 98 84 78", fur, 6) +
    stdBody(fur, face) +
    // stora runda öron på sidan
    `<circle cx="27" cy="35" r="7.5" fill="${fur}" ${LINE}/>` +
    `<circle cx="27" cy="35" r="4" fill="${face}" stroke="none"/>` +
    `<circle cx="73" cy="35" r="7.5" fill="${fur}" ${LINE}/>` +
    `<circle cx="73" cy="35" r="4" fill="${face}" stroke="none"/>` +
    head(fur) +
    // ljus ansiktsmask
    `<path d="M36 33 Q50 25 64 33 Q66 52 50 54 Q34 52 36 33 Z" fill="${face}" stroke="none"/>` +
    eyes() +
    nose(44, O, 2.4, 1.7) +
    `<path d="M46 48 Q50 51 54 48" fill="none" ${THIN}/>` +
    cheeks(44)
  );
}

function hamsterArt() {
  const fur = "#E9B872", belly = "#FBEED2";
  return (
    stdBody(fur, belly) +
    roundEar(-1, fur, "#F5C1CB", 6) + roundEar(1, fur, "#F5C1CB", 6) +
    head(fur) +
    eyes() +
    // proppfulla kindpåsar
    `<circle cx="33" cy="45" r="7.5" fill="${belly}" stroke="none"/>` +
    `<circle cx="67" cy="45" r="7.5" fill="${belly}" stroke="none"/>` +
    nose(42, "#E88A9C") +
    `<path d="M47.5 45 Q50 47 52.5 45" fill="none" ${THIN}/>` +
    cheeks(43, 21)
  );
}

function mouseArt() {
  const fur = "#B9BAC6", belly = "#EDE9F0", inner = "#F5C1CB";
  return (
    // lång svans
    `<path d="M64 98 Q86 96 84 78" fill="none" stroke="${O}" stroke-width="3" stroke-linecap="round"/>` +
    stdBody(fur, belly) +
    // stora runda öron
    `<circle cx="31" cy="18" r="11" fill="${fur}" ${LINE}/>` +
    `<circle cx="31" cy="18" r="6" fill="${inner}" stroke="none"/>` +
    `<circle cx="69" cy="18" r="11" fill="${fur}" ${LINE}/>` +
    `<circle cx="69" cy="18" r="6" fill="${inner}" stroke="none"/>` +
    head(fur) +
    eyes() +
    nose(44, "#E88A9C") +
    // morrhår
    `<path d="M24 43 L34 44 M24 48 L34 47 M76 43 L66 44 M76 48 L66 47" fill="none" ${THIN}/>` +
    cheeks()
  );
}

function chickArt() {
  const fur = "#F7D94A", belly = "#FBEE9C", beak = "#F2A93B";
  return (
    stdBody(fur, belly, beak) +
    // fjädertofs
    `<path d="M45 15 L43 4 L48 11 L50 2 L52 11 L57 4 L55 15 Z" fill="${fur}" ${THIN}/>` +
    head(fur) +
    eyes() +
    // näbb
    `<path d="M44 44 L50 40 L56 44 L50 49 Z" fill="${beak}" ${THIN}/>` +
    cheeks(46)
  );
}

function sheepArt() {
  const wool = "#F4F1F6", face = "#5E5766";
  const puff = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${wool}" ${LINE}/>`;
  return (
    feet(face) +
    // ulliga puffar runt kroppen (bakom)
    puff(34, 70, 8) + puff(66, 70, 8) + puff(32, 88, 8) + puff(68, 88, 8) + puff(40, 100, 8) + puff(60, 100, 8) +
    `<path d="M35 62 C29 82 29 104 50 104 C71 104 71 82 65 62 Q50 55 35 62 Z" fill="${wool}" ${LINE}/>` +
    limb("M37 66 Q29 72 28 80", face) +
    `<circle cx="28" cy="81" r="5" fill="${face}" ${THIN}/>` +
    limb("M63 66 Q75 68 78 75", face) +
    `<circle cx="79" cy="77" r="5" fill="${face}" ${THIN}/>` +
    // hängande öron
    `<ellipse cx="27" cy="35" rx="6.5" ry="4" fill="${face}" ${LINE}/>` +
    `<ellipse cx="73" cy="35" rx="6.5" ry="4" fill="${face}" ${LINE}/>` +
    head(face) +
    // ullig lugg över pannan
    `<path d="M29 30 Q31 17 41 23 Q45 14 50 22 Q55 14 59 23 Q69 17 71 30 Q60 33 50 32 Q40 33 29 30 Z" fill="${wool}" ${LINE}/>` +
    eyes() +
    nose(45, face, 2.6, 2) +
    smile(48, 4) + cheeks(45, 17)
  );
}

function hedgehogArt() {
  const spike = "#8A6242", face = "#E7C9A5", belly = "#F3E3CE";
  return (
    feet(face) +
    // taggig kropp (sicksack överkant)
    `<path d="M32 66 Q30 60 34 58 L37 64 L41 55 L45 63 L50 54 L55 63 L59 55 L63 64 L66 58 Q70 60 68 66 C72 86 70 104 50 104 C30 104 28 86 32 66 Z" fill="${spike}" ${LINE}/>` +
    `<ellipse cx="50" cy="90" rx="12" ry="12" fill="${belly}"/>` +
    limb("M37 68 Q29 74 28 82", face) +
    `<circle cx="28" cy="83" r="5" fill="${face}" ${THIN}/>` +
    limb("M63 68 Q75 70 78 77", face) +
    `<circle cx="79" cy="79" r="5" fill="${face}" ${THIN}/>` +
    head(face) +
    // taggkrona över huvudet
    `<path d="M30 34 L33 20 L37 30 L41 15 L45 28 L50 13 L55 28 L59 15 L63 30 L67 20 L70 34 Q50 30 30 34 Z" fill="${spike}" ${LINE}/>` +
    eyes() +
    nose(47, O, 2.6, 2) +
    smile(50, 4) + cheeks(44)
  );
}

function wolfArt() {
  const fur = "#8E93A3", belly = "#DDE0E8", inner = "#C9CCD6";
  return (
    limb("M64 98 Q82 100 84 88", fur, 7) +
    stdBody(fur, belly) +
    pointyEar(-1, fur, inner) + pointyEar(1, fur, inner) +
    head(fur) +
    // ljust nosparti
    `<path d="M31 44 Q40 54 50 52 Q60 54 69 44 Q62 58 50 58 Q38 58 31 44 Z" fill="${belly}" stroke="none"/>` +
    `<ellipse cx="50" cy="46" rx="9" ry="7" fill="#EEF0F4" stroke="none"/>` +
    eyes() + nose(43) + smile(48, 5) + cheeks()
  );
}

function deerArt() {
  const fur = "#C89B6A", belly = "#F0DFC2", muzzle = "#F3E3CE", horn = "#8A6242";
  return (
    stdBody(fur, belly) +
    // hornkronor
    `<path d="M41 18 Q38 6 42 4 M41 12 Q36 9 34 11 M42 8 Q38 3 35 4" fill="none" stroke="${horn}" stroke-width="2.6" stroke-linecap="round"/>` +
    `<path d="M59 18 Q62 6 58 4 M59 12 Q64 9 66 11 M58 8 Q62 3 65 4" fill="none" stroke="${horn}" stroke-width="2.6" stroke-linecap="round"/>` +
    // öron
    `<ellipse cx="29" cy="28" rx="6.5" ry="4" fill="${fur}" ${LINE}/>` +
    `<ellipse cx="71" cy="28" rx="6.5" ry="4" fill="${fur}" ${LINE}/>` +
    head(fur) +
    // ljusa prickar på kinderna
    `<circle cx="35" cy="30" r="1.6" fill="#fff" stroke="none"/>` +
    `<circle cx="65" cy="30" r="1.6" fill="#fff" stroke="none"/>` +
    eyes() +
    `<ellipse cx="50" cy="47" rx="8" ry="6" fill="${muzzle}" stroke="none"/>` +
    nose(44, O, 3, 2.3) + smile(50, 4) + cheeks(44)
  );
}

function raccoonArt() {
  const fur = "#9AA0AD", belly = "#E4E6EC", mask = "#3B3350", inner = "#C9CCD6";
  return (
    // randig svans
    limb("M64 98 Q84 100 84 82", fur, 7) +
    `<circle cx="84" cy="82" r="4.6" fill="${mask}" ${THIN}/>` +
    stdBody(fur, belly) +
    pointyEar(-1, fur, inner) + pointyEar(1, fur, inner) +
    head(fur) +
    // svart mask över ögonen
    `<path d="M30 34 Q40 27 50 32 Q60 27 70 34 Q66 45 59 45 Q54 43 50 40 Q46 43 41 45 Q34 45 30 34 Z" fill="${mask}" stroke="none"/>` +
    eyes() +
    `<ellipse cx="50" cy="48" rx="7" ry="5" fill="#fff" stroke="none"/>` +
    nose(46) + smile(50, 4) + cheeks(44, 17)
  );
}

function turtleArt() {
  const skin = "#8FCB7A", shell = "#7B9E5A", belly = "#D8F0C0";
  return (
    feet(skin) +
    `<path d="M35 62 C29 82 29 104 50 104 C71 104 71 82 65 62 Q50 55 35 62 Z" fill="${skin}" ${LINE}/>` +
    limb("M37 66 Q29 72 28 80", skin) +
    `<circle cx="28" cy="81" r="5.3" fill="${skin}" ${THIN}/>` +
    limb("M63 66 Q75 68 78 75", skin) +
    `<circle cx="79" cy="77" r="5.3" fill="${skin}" ${THIN}/>` +
    // sköld
    `<path d="M30 88 Q28 60 50 60 Q72 60 70 88 Z" fill="${shell}" ${LINE}/>` +
    `<path d="M50 61 L50 88 M37 66 L33 85 M63 66 L67 85 M31 77 L69 77" fill="none" ${THIN}/>` +
    head(skin) +
    eyes() +
    nose(45, O, 2, 1.6) +
    smile(47, 5) + cheeks(44)
  );
}

function beeArt() {
  const fur = "#F7C948", stripe = "#3B3350", wing = "#DDEBF7";
  return (
    // vingar bakom
    `<ellipse cx="31" cy="58" rx="10" ry="14" fill="${wing}" ${THIN} opacity="0.9"/>` +
    `<ellipse cx="69" cy="58" rx="10" ry="14" fill="${wing}" ${THIN} opacity="0.9"/>` +
    feet(stripe) +
    `<path d="M35 62 C29 82 29 104 50 104 C71 104 71 82 65 62 Q50 55 35 62 Z" fill="${fur}" ${LINE}/>` +
    // ränder
    `<path d="M33 74 H67 M31 86 H69 M35 98 H65" fill="none" stroke="${stripe}" stroke-width="5" stroke-linecap="round"/>` +
    limb("M37 66 Q29 72 28 80", fur) +
    `<circle cx="28" cy="81" r="5.3" fill="${fur}" ${THIN}/>` +
    limb("M63 66 Q75 68 78 75", fur) +
    `<circle cx="79" cy="77" r="5.3" fill="${fur}" ${THIN}/>` +
    // antenner
    `<path d="M43 16 Q40 6 37 6 M57 16 Q60 6 63 6" fill="none" ${THIN}/>` +
    `<circle cx="37" cy="5.5" r="2" fill="${stripe}" stroke="none"/>` +
    `<circle cx="63" cy="5.5" r="2" fill="${stripe}" stroke="none"/>` +
    head(fur) +
    eyes() + smile(47, 5) + cheeks()
  );
}

function elephantArt() {
  const fur = "#A9AEC0", belly = "#D7DAE6", inner = "#C9B3C0";
  return (
    stdBody(fur, belly) +
    // stora öron
    `<ellipse cx="27" cy="36" rx="11" ry="13" fill="${fur}" ${LINE}/>` +
    `<ellipse cx="73" cy="36" rx="11" ry="13" fill="${fur}" ${LINE}/>` +
    `<ellipse cx="28" cy="36" rx="6" ry="8" fill="${inner}" stroke="none"/>` +
    `<ellipse cx="72" cy="36" rx="6" ry="8" fill="${inner}" stroke="none"/>` +
    head(fur) +
    eyes(32, 9, 5) +
    // snabel
    `<path d="M50 40 Q45 52 48 61 Q50 67 56 65" fill="none" stroke="${O}" stroke-width="9.5" stroke-linecap="round"/>` +
    `<path d="M50 40 Q45 52 48 61 Q50 67 56 65" fill="none" stroke="${fur}" stroke-width="6" stroke-linecap="round"/>` +
    cheeks(40, 17)
  );
}

function goatArt() {
  const fur = "#EDE9F0", belly = "#FBF7FB", horn = "#C9B79A", muzzle = "#F3E3CE";
  return (
    stdBody(fur, belly) +
    // bakåtböjda horn
    `<path d="M41 18 Q35 8 41 4 Q44 10 44 18 Z" fill="${horn}" ${THIN}/>` +
    `<path d="M59 18 Q65 8 59 4 Q56 10 56 18 Z" fill="${horn}" ${THIN}/>` +
    // hängöron
    `<ellipse cx="27" cy="37" rx="7" ry="4" fill="${fur}" ${LINE}/>` +
    `<ellipse cx="73" cy="37" rx="7" ry="4" fill="${fur}" ${LINE}/>` +
    head(fur) +
    eyes() +
    `<ellipse cx="50" cy="47" rx="7.5" ry="5.5" fill="${muzzle}" stroke="none"/>` +
    nose(45, O, 2.6, 2) + smile(50, 4) +
    // getskägg
    `<path d="M46 54 Q50 65 54 54 Z" fill="${fur}" ${LINE}/>` +
    cheeks(44)
  );
}

// --- Konstkatalog: id → SVG-innehåll ---------------------------------------
// Håll id:na stabila (sparade val). Roboten hämtas som grundkonst; dess
// evolutionssteg definieras i art-characters-robot.js.
export const CHARACTER_ART = {
  fox: foxArt(),
  owl: owlArt(),
  cat: catArt(),
  dog: dogArt(),
  panda: pandaArt(),
  frog: frogArt(),
  unicorn: unicornArt(),
  dragon: dragonArt(),
  lion: lionArt(),
  penguin: penguinArt(),
  koala: koalaArt(),
  robot: robotArt(),
  bjorn: bearArt(),
  tiger: tigerArt(),
  rabbit: rabbitArt(),
  pig: pigArt(),
  cow: cowArt(),
  monkey: monkeyArt(),
  hamster: hamsterArt(),
  mouse: mouseArt(),
  chick: chickArt(),
  sheep: sheepArt(),
  hedgehog: hedgehogArt(),
  wolf: wolfArt(),
  deer: deerArt(),
  raccoon: raccoonArt(),
  turtle: turtleArt(),
  bee: beeArt(),
  elephant: elephantArt(),
  goat: goatArt(),
};
