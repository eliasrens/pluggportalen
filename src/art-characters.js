// ============================================================================
// Pluggportalen – karaktärskonst (inline SVG, helkropp)
// ----------------------------------------------------------------------------
// Alla karaktärer följer stilguiden och ankargriddet i art-style.js:
// viewBox "0 0 100 120", huvud (50,36) r≈22, ögon y=34, hals y≈58,
// höger tass (79,77), fötter y≈109. Tack vare griddet passar klädseln
// (art-wearables.js) på ALLA figurer med samma slot-koordinater.
//
// Id:na sparas i Firestore (student.avatarId) – håll dem stabila.
// ============================================================================

import {
  O, LINE, THIN, STYLE,
  eye, eyes, cheeks, smile, laugh,
  limb, feet, stdBody, head, pointyEar, roundEar, nose,
} from "./art-style.js";

export { STYLE };

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

function robotArt() {
  const metal = "#A9C2DE", dark = "#7E97B8", accent = "#F2A93B";
  return (
    // antenn
    `<line x1="50" y1="14" x2="50" y2="6" ${LINE}/>` +
    `<circle cx="50" cy="4.5" r="3.5" fill="#EF6F6C" ${THIN}/>` +
    // larvfötter
    `<rect x="31" y="103" width="16" height="9" rx="4.5" fill="${dark}" ${LINE}/>` +
    `<rect x="53" y="103" width="16" height="9" rx="4.5" fill="${dark}" ${LINE}/>` +
    // kropp med panel + lampor
    `<rect x="33" y="60" width="34" height="44" rx="10" fill="${metal}" ${LINE}/>` +
    `<rect x="40" y="72" width="20" height="14" rx="4" fill="${dark}" stroke="none"/>` +
    `<circle cx="44" cy="93" r="2.6" fill="${accent}" stroke="none"/>` +
    `<circle cx="52" cy="93" r="2.6" fill="#EF6F6C" stroke="none"/>` +
    `<circle cx="60" cy="93" r="2.6" fill="#6FC66F" stroke="none"/>` +
    // armar
    limb("M35 66 Q28 72 28 80", metal, 7) +
    `<circle cx="28" cy="81" r="5" fill="${dark}" ${THIN}/>` +
    limb("M65 66 Q76 68 78 75", metal, 7) +
    `<circle cx="79" cy="77" r="5" fill="${dark}" ${THIN}/>` +
    // huvud med skruvöron
    `<rect x="24" y="30" width="5" height="12" rx="2.5" fill="${dark}" ${THIN}/>` +
    `<rect x="71" y="30" width="5" height="12" rx="2.5" fill="${dark}" ${THIN}/>` +
    `<rect x="27" y="15" width="46" height="42" rx="13" fill="${metal}" ${LINE}/>` +
    eyes() +
    `<path d="M43 46 Q50 51 57 46" fill="none" ${LINE}/>` +
    cheeks(44)
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

// --- Katalog + API ----------------------------------------------------------

/** id → { name (svenskt namn, används i aria-label), art (SVG-innehåll) } */
export const CHARACTERS = {
  fox: { name: "Räv", art: foxArt() },
  owl: { name: "Uggla", art: owlArt() },
  cat: { name: "Katt", art: catArt() },
  dog: { name: "Hund", art: dogArt() },
  panda: { name: "Panda", art: pandaArt() },
  frog: { name: "Groda", art: frogArt() },
  unicorn: { name: "Enhörning", art: unicornArt() },
  dragon: { name: "Drake", art: dragonArt() },
  lion: { name: "Lejon", art: lionArt() },
  penguin: { name: "Pingvin", art: penguinArt() },
  koala: { name: "Koala", art: koalaArt() },
  robot: { name: "Robot", art: robotArt() },
  bjorn: { name: "Björn", art: bearArt() },
  tiger: { name: "Tiger", art: tigerArt() },
};

/**
 * Fristående helkropps-SVG för en karaktär (skalar med CSS width/height).
 * Okänt id faller tillbaka på räven så gamla sparade val aldrig kraschar.
 */
export function characterSvg(id) {
  const c = CHARACTERS[id] || CHARACTERS.fox;
  return (
    `<svg viewBox="${STYLE.viewBox}" role="img" aria-label="${c.name}" ` +
    `preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${c.art}</svg>`
  );
}
