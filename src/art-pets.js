// ============================================================================
// Pluggportalen – husdjurskonst (inline SVG för shopens "husdjur"-saker)
// ----------------------------------------------------------------------------
// Följer stilguiden i art-style.js och återanvänder de delade byggdelarna
// (eye/eyes/cheeks/nose/head/öron m.m.) så husdjuren hamnar på samma
// ankargrid och i samma värld som karaktärerna: huvud (50,36) r≈22, ögon y=34.
// De flesta husdjur ritas som gullig "byst" (huvud + liten sittande kropp) i
// viewBox 0 0 100 xx; fisk/papegoja/dino får egna proportioner.
// Id:na måste matcha shop-items.js exakt (sparas i Firestore).
// ============================================================================

import {
  O, LINE, THIN,
  eye, eyes, cheeks, smile, laugh, nose,
  head, pointyEar, limb,
} from "./art-style.js";

// Liten sittande kropp under huvudet (fötter ritas först = bakom kroppen).
function sitBody(fur, belly, feetC = fur) {
  return (
    `<ellipse cx="38" cy="90" rx="7" ry="4.5" fill="${feetC}" ${LINE}/>` +
    `<ellipse cx="62" cy="90" rx="7" ry="4.5" fill="${feetC}" ${LINE}/>` +
    `<path d="M30 60 Q24 92 50 92 Q76 92 70 60 Q50 54 30 60 Z" fill="${fur}" ${LINE}/>` +
    `<ellipse cx="50" cy="80" rx="12" ry="12" fill="${belly}"/>`
  );
}

function dogPet() {
  const fur = "#C9996B", belly = "#F0DFC2", patch = "#A97B4F";
  return (
    limb("M66 78 Q80 76 82 66", fur, 6) +
    sitBody(fur, belly) +
    head(fur) +
    `<path d="M31 20 Q19 24 22 44 Q24 54 33 49 Q29 34 34 24 Z" fill="${patch}" ${LINE}/>` +
    `<path d="M69 20 Q81 24 78 44 Q76 54 67 49 Q71 34 66 24 Z" fill="${patch}" ${LINE}/>` +
    `<circle cx="59" cy="33" r="9.5" fill="${patch}" stroke="none"/>` +
    eyes() +
    `<ellipse cx="50" cy="47" rx="9" ry="6.5" fill="${belly}" stroke="none"/>` +
    nose(44) + laugh(49, 5.5) + cheeks(44)
  );
}

function catPet() {
  const fur = "#F49E4C", belly = "#FFE9CC";
  return (
    limb("M68 84 Q84 84 82 70", fur, 6) +
    sitBody(fur, belly) +
    pointyEar(-1, fur, "#F5C1CB") + pointyEar(1, fur, "#F5C1CB") +
    head(fur) +
    eyes() +
    nose(41.5, "#E88A9C") +
    `<path d="M46 45 Q48 48 50 45 Q52 48 54 45" fill="none" ${THIN}/>` +
    `<path d="M24 40 L34 41 M24 45 L34 44 M76 40 L66 41 M76 45 L66 44" fill="none" ${THIN}/>` +
    cheeks()
  );
}

function rabbitPet() {
  const fur = "#FFFFFF", belly = "#FDEBF2", inner = "#F5C1CB";
  return (
    sitBody(fur, belly) +
    `<path d="M41 20 Q35 2 44 4 Q47 10 46 22 Z" fill="${fur}" ${LINE}/>` +
    `<path d="M59 20 Q65 2 56 4 Q53 10 54 22 Z" fill="${fur}" ${LINE}/>` +
    `<path d="M42 18 Q38 5 43 8 Q45 13 45 20 Z" fill="${inner}" stroke="none"/>` +
    `<path d="M58 18 Q62 5 57 8 Q55 13 55 20 Z" fill="${inner}" stroke="none"/>` +
    head(fur) +
    eyes() +
    nose(42, "#F890B7") +
    `<path d="M50 44 L50 47 M50 47 Q46 49.5 44 47.5 M50 47 Q54 49.5 56 47.5" fill="none" ${THIN}/>` +
    cheeks(45)
  );
}

function fishPet() {
  const fur = "#F49E4C", fin = "#F08A3C";
  return (
    `<path d="M70 40 L92 24 L88 40 L92 56 Z" fill="${fur}" ${LINE}/>` +
    `<path d="M36 22 Q48 6 60 22 Z" fill="${fin}" ${LINE}/>` +
    `<path d="M40 60 Q48 72 56 60 Z" fill="${fin}" ${LINE}/>` +
    `<ellipse cx="44" cy="42" rx="32" ry="22" fill="${fur}" ${LINE}/>` +
    `<path d="M30 24 Q26 42 30 60" fill="none" stroke="${fin}" stroke-width="3.4" stroke-linecap="round"/>` +
    `<path d="M18 30 Q15 42 18 54" fill="none" stroke="${fin}" stroke-width="3" stroke-linecap="round"/>` +
    eye(30, 38, 6) +
    `<ellipse cx="22" cy="48" rx="4" ry="2.6" fill="#FFB1B8" opacity="0.85"/>` +
    `<path d="M14 50 Q20 54 26 50" fill="none" ${THIN}/>` +
    `<circle cx="82" cy="14" r="3.2" fill="#C9EEFB" ${THIN}/>` +
    `<circle cx="90" cy="6" r="2.2" fill="#C9EEFB" ${THIN}/>`
  );
}

function parrotPet() {
  return (
    `<path d="M28 88 L66 88" fill="none" stroke="#8A6242" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M44 84 L38 100 L47 93 L50 100 L53 93 L56 100 L52 84 Z" fill="#7FC7E8" ${LINE}/>` +
    `<path d="M48 30 Q70 34 68 62 Q66 86 47 86 Q30 86 32 62 Q33 40 48 30 Z" fill="#EF6F6C" ${LINE}/>` +
    `<path d="M50 44 Q68 48 62 76 Q54 66 49 50 Z" fill="#6FC66F" ${LINE}/>` +
    `<path d="M54 52 Q64 56 62 70" fill="none" ${THIN}/>` +
    `<circle cx="45" cy="26" r="17" fill="#F7C948" ${LINE}/>` +
    `<path d="M46 10 Q50 0 54 10" fill="none" stroke="#F08A3C" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M31 24 Q16 26 24 34 Q30 36 33 32 Z" fill="#F2A93B" ${LINE}/>` +
    `<path d="M24 30 Q28 32 31 30" fill="none" ${THIN}/>` +
    eye(45, 22, 5) +
    `<ellipse cx="53" cy="30" rx="3.6" ry="2.4" fill="#FFB1B8" opacity="0.85"/>` +
    `<path d="M42 86 L42 92 M40 92 L44 92 M52 86 L52 92 M50 92 L54 92" fill="none" stroke="#F2A93B" stroke-width="2.6" stroke-linecap="round"/>`
  );
}

function dinoPet() {
  const fur = "#6FC66F", belly = "#D8F0C0", plate = "#F7C948";
  return (
    limb("M64 66 Q86 70 90 56", fur, 9) +
    `<ellipse cx="40" cy="80" rx="9" ry="7" fill="${fur}" ${LINE}/>` +
    `<ellipse cx="58" cy="80" rx="9" ry="7" fill="${fur}" ${LINE}/>` +
    `<ellipse cx="46" cy="62" rx="27" ry="19" fill="${fur}" ${LINE}/>` +
    `<ellipse cx="44" cy="66" rx="15" ry="11" fill="${belly}" stroke="none"/>` +
    limb("M58 52 Q70 28 78 22", fur, 13) +
    `<ellipse cx="80" cy="20" rx="13" ry="11" fill="${fur}" ${LINE}/>` +
    `<path d="M28 46 L32 34 L38 45 Z" fill="${plate}" ${LINE}/>` +
    `<path d="M40 42 L45 30 L51 42 Z" fill="${plate}" ${LINE}/>` +
    `<path d="M53 44 L59 34 L63 46 Z" fill="${plate}" ${LINE}/>` +
    eye(83, 17, 4.5) +
    `<circle cx="74" cy="24" r="1.6" fill="${O}"/>` +
    `<path d="M72 28 Q78 32 85 28" fill="none" ${THIN}/>` +
    `<ellipse cx="75" cy="27" rx="3.4" ry="2.2" fill="#FFB1B8" opacity="0.85"/>`
  );
}

/** id → { viewBox, art } */
export const PETS = {
  hund: { viewBox: "0 0 100 100", art: dogPet() },
  katt: { viewBox: "0 0 100 100", art: catPet() },
  kanin: { viewBox: "0 0 100 100", art: rabbitPet() },
  fisk: { viewBox: "0 0 100 76", art: fishPet() },
  papegoja: { viewBox: "0 0 84 100", art: parrotPet() },
  dinosaurie: { viewBox: "0 0 100 92", art: dinoPet() },
};
