// ============================================================================
// Pluggportalen – bondgårdsdjurens SIDOPROFILER för hagen & laggården (#336)
// ----------------------------------------------------------------------------
// Häst/ko/gris i tydlig SIDOVY (lång kropp, fyra ben, hals + huvud, svans) så
// silhuetten direkt läses som rätt djur ute på gården. RUMMET och "Mina djur"
// behåller chibi-framifrån-figurerna i art-pets.js (uttryckligt användarval) –
// den här modulen används BARA av gard-djur.js. Figurerna ritas VÄNDA ÅT HÖGER
// (promenad-CSS:ens .vand-vanster speglar dem åt vänster). Samma platta stil,
// palett och konturlinjer som art-pets.js (primitiverna i art-style.js).
//
// OBS BOOTGRAFEN (incident #271): modulen ligger MEDVETET utanför den statiska
// bootkedjan – den importeras bara av gard-djur.js (som själv bara nås
// dynamiskt via varld-gard.js). Importera den ALDRIG från art-items.js/PETS.
// ============================================================================

import { O, LINE, THIN, eye, limb } from "./art-style.js";

/** Fyra ben i sidovy: bortre paret ritas FÖRE kroppen, närmre EFTER. */
function sideLegs(fur, xs, top, bottom) {
  return xs.map(([x1, x2]) => limb(`M${x1} ${top} L${x2} ${bottom}`, fur, 7)).join("");
}

function horseSide() {
  const fur = "#C08A5A", mane = "#7A5238", mule = "#EFD9BC";
  return (
    `<path d="M29 42 Q13 46 16 68 Q22 62 24 54 Q21 66 27 71 Q31 58 31 47 Z" fill="${mane}" ${LINE}/>` +
    sideLegs(fur, [[43, 41], [77, 79]], 62, 84) +
    `<ellipse cx="58" cy="53" rx="33" ry="20" fill="${fur}" ${LINE}/>` +
    sideLegs(fur, [[51, 49], [85, 87]], 65, 86) +
    `<path d="M80 46 Q84 26 96 16 L107 24 Q103 40 93 52 Z" fill="${fur}" ${LINE}/>` +
    `<path d="M89 13 Q80 30 81 45 Q88 38 91 28 Q93 20 92 13 Z" fill="${mane}" ${LINE}/>` +
    `<path d="M94 11 L97 1 L103 9 Z" fill="${fur}" ${LINE}/>` +
    `<ellipse cx="100" cy="22" rx="13" ry="11" fill="${fur}" ${LINE}/>` +
    `<path d="M90 12 Q94 5 100 9 Q99 14 95 16 Z" fill="${mane}" ${LINE}/>` +
    `<ellipse cx="110" cy="27" rx="7.5" ry="6" fill="${mule}" ${THIN}/>` +
    `<ellipse cx="112.5" cy="26" rx="1.7" ry="2.3" fill="#8A6242" stroke="none"/>` +
    `<path d="M106 31 Q110 34 114 31" fill="none" ${THIN}/>` +
    eye(100, 20, 4.5) +
    `<ellipse cx="103" cy="29" rx="3.4" ry="2.2" fill="#FFB1B8" opacity="0.85"/>`
  );
}

function cowSide() {
  const fur = "#F5EFE3", patch = "#8B7BAA", mule = "#F5C1CB", horn = "#EAD9A8";
  return (
    limb("M27 46 Q15 52 17 68", fur, 4.5) +
    `<ellipse cx="17" cy="70" rx="4.2" ry="6" fill="${patch}" ${THIN}/>` +
    sideLegs(fur, [[42, 40], [73, 75]], 62, 84) +
    `<ellipse cx="56" cy="53" rx="33" ry="21" fill="${fur}" ${LINE}/>` +
    `<path d="M37 42 Q28 52 37 61 Q48 63 50 52 Q48 41 37 42 Z" fill="${patch}" stroke="none"/>` +
    `<path d="M64 60 Q60 71 71 72 Q80 69 76 60 Q70 55 64 60 Z" fill="${patch}" stroke="none"/>` +
    sideLegs(fur, [[50, 48], [81, 83]], 65, 86) +
    `<path d="M78 44 Q80 30 90 24 L100 32 Q98 44 90 52 Z" fill="${fur}" ${LINE}/>` +
    `<ellipse cx="83" cy="29" rx="8.5" ry="5.5" fill="${fur}" ${LINE} transform="rotate(-30 83 29)"/>` +
    `<path d="M87 21 Q83 12 89 10 Q93 15 92 22 Z" fill="${horn}" ${THIN}/>` +
    `<path d="M99 18 Q100 10 105 12 Q105 18 102 21 Z" fill="${horn}" ${THIN}/>` +
    `<circle cx="95" cy="34" r="15" fill="${fur}" ${LINE}/>` +
    `<path d="M86 24 Q81 33 86 42 Q93 41 94 33 Q93 25 86 24 Z" fill="${patch}" stroke="none"/>` +
    `<ellipse cx="105" cy="41" rx="8" ry="6.2" fill="${mule}" ${THIN}/>` +
    `<ellipse cx="107.5" cy="40" rx="1.7" ry="2.3" fill="#D98A9C" stroke="none"/>` +
    eye(98, 30, 4.5) +
    `<ellipse cx="98" cy="49" rx="3.4" ry="2.2" fill="#FFB1B8" opacity="0.85"/>`
  );
}

function pigSide() {
  const fur = "#F2A9B8", belly = "#FBD6DC", inner = "#E88A9C";
  return (
    `<path d="M26 50 Q13 48 15 40 Q17 34 23 38" fill="none" stroke="${O}" stroke-width="9" stroke-linecap="round"/>` +
    `<path d="M26 50 Q13 48 15 40 Q17 34 23 38" fill="none" stroke="${fur}" stroke-width="5" stroke-linecap="round"/>` +
    sideLegs(fur, [[46, 44], [74, 76]], 68, 82) +
    `<ellipse cx="60" cy="53" rx="35" ry="23" fill="${fur}" ${LINE}/>` +
    `<ellipse cx="56" cy="64" rx="20" ry="10" fill="${belly}" stroke="none"/>` +
    sideLegs(fur, [[54, 52], [82, 84]], 70, 84) +
    `<circle cx="96" cy="38" r="16" fill="${fur}" ${LINE}/>` +
    `<path d="M87 26 Q82 12 96 16 Q96 24 92 28 Z" fill="${fur}" ${LINE}/>` +
    `<path d="M89 24 Q86 16 93 18 Q93 23 91 25 Z" fill="${inner}" stroke="none"/>` +
    `<ellipse cx="111" cy="41" rx="5.5" ry="7" fill="${inner}" ${LINE}/>` +
    `<ellipse cx="112" cy="41" rx="1.6" ry="2.6" fill="#B95F72" stroke="none"/>` +
    `<path d="M103 49 Q107 52 111 49" fill="none" ${THIN}/>` +
    eye(98, 34, 4.5) +
    `<ellipse cx="101" cy="45" rx="3.4" ry="2.2" fill="#FFB1B8" opacity="0.85"/>`
  );
}

/** id → sidoprofil { viewBox, art, w } (w = bredd i rem, före gårds-koeffen). */
export const FARM_SIDE = {
  animal_horse: { viewBox: "0 0 122 92", art: horseSide(), w: 5.6 },
  animal_cow: { viewBox: "0 0 122 92", art: cowSide(), w: 5.2 },
  animal_pig: { viewBox: "0 0 122 88", art: pigSide(), w: 4.6 },
};

/** Fristående sido-<svg> för ett bondgårdsdjur, eller null (ej bondgårdsdjur). */
export function farmSideSvg(id, name) {
  const it = FARM_SIDE[id];
  if (!it) return null;
  return (
    `<svg viewBox="${it.viewBox}" role="img" aria-label="${name || id}" ` +
    `preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${it.art}</svg>`
  );
}

/** Visningsstorlek för sidoprofilen (samma kontrakt som itemSize). */
export function farmSideSize(id) {
  const it = FARM_SIDE[id];
  if (!it) return null;
  const vb = it.viewBox.split(" ").map(Number);
  return { w: it.w, h: vb[2] > 0 ? +((it.w * vb[3]) / vb[2]).toFixed(2) : it.w };
}

