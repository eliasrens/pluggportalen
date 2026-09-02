// ============================================================================
// Pluggportalen – VISUELL STILGUIDE + delade SVG-byggdelar
// ----------------------------------------------------------------------------
// Detta är den gemensamma stilguiden för ALL handritad SVG-konst i portalen:
// karaktärer (art-characters.js), klädsel (art-wearables.js) och kommande
// möbel-/rums-konst. Följ den så känns allt som samma värld.
//
//  Stil: platt vektor, mjuka rundade former, tydliga mörka konturer,
//  glad harmonisk palett, stora uttrycksfulla ögon, korta gulliga proportioner
//  (stort huvud ≈ halva figuren, liten kropp, små armar/ben).
//
//  PALETT (hex):
//    Kontur (alla linjer)     #3B3350   (mörk plommonlila – aldrig ren svart)
//    Kind-rosa                #FFB1B8
//    Vit                      #FFFFFF   Kräm  #FFF3DC
//    Sol-gul   #F7C948   Orange #F49E4C   Röd-orange #F08A3C
//    Bärnsten  #F2A93B   Brun   #B0805A   Mörkbrun    #8A6242
//    Grön      #6FC66F   Mint   #58C6A9   Ljusmint    #C9F0DC
//    Him-blå   #7FC7E8   Stålblå #A9C2DE  Gråblå      #A8BAD1
//    Marin     #46557A   Lila   #B79BE0   Rosa        #F890B7
//    Röd       #EF6F6C   Mörk detalj (panda m.m.)     #4C4661
//
//  KONTUR: stroke #3B3350, stroke-width 3 (tunna detaljer 2.2),
//  alltid stroke-linecap="round" och stroke-linejoin="round".
//
//  VIEWBOX-KONVENTION: alla karaktärer ritas i viewBox "0 0 100 120"
//  (bredd 100 × höjd 120). Figuren står på "golvet" y≈116. Möbler/rumssaker
//  får egen viewBox efter sakens proportioner men samma kontur och palett.
//
//  GEMENSAMT ANKARGRID (så att klädsel passar ALLA figurer):
//    Huvudets mitt      (50, 36), radie ≈ 22  → hjässan vid y ≈ 14
//    Ögon               y = 34, x = 41 och 59, radie 6   (slot "ansikte")
//    Nos/mun            y ≈ 42–48
//    Hals/krage         y ≈ 58                           (slot "hals")
//    Kropp              y ≈ 58–104, mage centrerad (50, 86)
//    Höger tass/hand    (79, 77)                         (slot "hand")
//    Fötter             y ≈ 106–115
// ============================================================================

export const O = "#3B3350"; // konturfärg
export const LINE = `stroke="${O}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
export const THIN = `stroke="${O}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"`;

export const STYLE = {
  viewBox: "0 0 100 120",
  outline: O,
  strokeWidth: 3,
  cheek: "#FFB1B8",
  anchors: {
    head: { cx: 50, cy: 36, r: 22 },
    eyes: { y: 34, dx: 9 },
    neckY: 58,
    hand: { x: 79, y: 77 },
    feetY: 109,
  },
};

// --- Delade kroppsdelar (håller alla figurer på samma ankargrid) ------------

/** Ett stort blankt tecknat öga med pupill och glimt. */
export function eye(x, y, r = 6) {
  return (
    `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" ${THIN}/>` +
    `<circle cx="${x + 0.8}" cy="${y + 0.9}" r="${(r * 0.55).toFixed(1)}" fill="${O}"/>` +
    `<circle cx="${x + 2.1}" cy="${y - 1}" r="${(r * 0.2).toFixed(1)}" fill="#fff"/>`
  );
}

/** Ögonparet på ankarpositionen. */
export const eyes = (y = 34, dx = 9, r = 6) => eye(50 - dx, y, r) + eye(50 + dx, y, r);

/** Rosiga kinder. */
export function cheeks(y = 43, dx = 18) {
  return (
    `<ellipse cx="${50 - dx}" cy="${y}" rx="4.3" ry="2.8" fill="#FFB1B8" opacity="0.85"/>` +
    `<ellipse cx="${50 + dx}" cy="${y}" rx="4.3" ry="2.8" fill="#FFB1B8" opacity="0.85"/>`
  );
}

/** Enkelt glatt leende. */
export function smile(y = 46, w = 6.5) {
  return `<path d="M ${50 - w} ${y} Q 50 ${y + w} ${50 + w} ${y}" fill="none" ${LINE}/>`;
}

/** Stort öppet skratt med tunga. */
export function laugh(y = 44, w = 8) {
  return (
    `<path d="M ${50 - w} ${y} Q 50 ${y + w * 1.5} ${50 + w} ${y} Z" fill="#7C4A57" ${LINE}/>` +
    `<path d="M ${50 - w * 0.45} ${y + w * 0.55} Q 50 ${y + w * 1.05} ${50 + w * 0.45} ${y + w * 0.55} Z" fill="#FF9AA6" stroke="none"/>`
  );
}

/** Arm/ben/svans som rundad "kapsel": konturpass under + färgpass över. */
export function limb(d, color, w = 8) {
  return (
    `<path d="${d}" fill="none" stroke="${O}" stroke-width="${w + 4.5}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`
  );
}

/** Två fötter på golvet (ritas före kroppen så kroppskanten går omlott). */
export function feet(color) {
  return (
    `<ellipse cx="40" cy="109" rx="8" ry="5.2" fill="${color}" ${LINE}/>` +
    `<ellipse cx="60" cy="109" rx="8" ry="5.2" fill="${color}" ${LINE}/>`
  );
}

/** Standardkropp: fötter + rund kropp + mage + två armar (höger mot handankaret). */
export function stdBody(fur, belly, feetColor = fur) {
  return (
    feet(feetColor) +
    `<path d="M35 62 C29 82 29 104 50 104 C71 104 71 82 65 62 Q50 55 35 62 Z" fill="${fur}" ${LINE}/>` +
    `<ellipse cx="50" cy="87" rx="12.5" ry="13.5" fill="${belly}"/>` +
    limb("M37 66 Q29 72 28 80", fur) +
    `<circle cx="28" cy="81" r="5.3" fill="${fur}" ${THIN}/>` +
    limb("M63 66 Q75 68 78 75", fur) +
    `<circle cx="79" cy="77" r="5.3" fill="${fur}" ${THIN}/>`
  );
}

/** Standardhuvud (cirkel) på ankarpositionen. */
export function head(fur, r = 22) {
  return `<circle cx="50" cy="36" r="${r}" fill="${fur}" ${LINE}/>`;
}

/** Spetsigt öra (räv/katt) med innerfärg. dir = -1 vänster, 1 höger. */
export function pointyEar(dir, fur, inner) {
  const x = 50 + dir * 14;
  return (
    `<path d="M ${x - dir * 6} 24 L ${x + dir * 4} 3 L ${x + dir * 12} 20 Z" fill="${fur}" ${LINE}/>` +
    `<path d="M ${x - dir * 1.5} 19 L ${x + dir * 4} 8.5 L ${x + dir * 8} 17 Z" fill="${inner}" stroke="none"/>`
  );
}

/** Runt öra (björn/koala/panda) med innerfärg. */
export function roundEar(dir, fur, inner, r = 8.5) {
  const x = 50 + dir * 15;
  return (
    `<circle cx="${x}" cy="17" r="${r}" fill="${fur}" ${LINE}/>` +
    `<circle cx="${x}" cy="17" r="${(r * 0.55).toFixed(1)}" fill="${inner}" stroke="none"/>`
  );
}

/** Liten nos (oval). */
export function nose(y = 41.5, color = O, rx = 3.2, ry = 2.5) {
  return `<ellipse cx="50" cy="${y}" rx="${rx}" ry="${ry}" fill="${color}" stroke="none"/>`;
}

// --- Rums-/möbelhjälpare (designfacit: design/DESIGNBESLUT-husdjur-hem-2.0.md) --

/** Mjuk kontaktskugga under en sak (kontur-lila, låg opacitet). */
export function shadow(cx, cy, rx) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${(rx * 0.22).toFixed(1)}" fill="${O}" opacity="0.09"/>`;
}

/** Liten dekorstjärna (fylld, utan kontur). */
export function stjarna(x, y, s, c) {
  return (
    `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -5 L1.4 -1.5 L5 -1.2 ` +
    `L2.3 1.1 L3.1 4.8 L0 2.8 L-3.1 4.8 L-2.3 1.1 L-5 -1.2 L-1.4 -1.5 Z" fill="${c}" stroke="none"/>`
  );
}
