// ============================================================================
// Pluggportalen – dekorkonst (inline SVG för shopens "dekor"-saker)
// ----------------------------------------------------------------------------
// Följer stilguiden i art-style.js OCH designfacit i
// design/DESIGNBESLUT-husdjur-hem-2.0.md: kontur #3B3350 (stroke 3 / tunt 2.2),
// tvåtonat trä, mjuk kontaktskugga under golvsaker, rikare detaljer (sömmar,
// glans, randiga krukor). `w` = visningsbredd i rem i rummet. Id:na måste
// matcha shop-items.js exakt (sparas i Firestore) – byt bara utseendet.
// ============================================================================

import { O, LINE, THIN, limb, shadow, stjarna } from "./art-style.js";

const WOOD = "#B0805A";
const WOOD_DARK = "#8A6242";

// En femuddig stjärna som path ("d"). rot=-90 sätter en udd rakt uppåt.
function star(cx, cy, R, r, rot = -90) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = (rot * Math.PI) / 180 + (i * Math.PI) / 5;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return "M" + pts.join(" L") + " Z";
}

// En regnbågsbåge (halvcirkel) centrerad i (32,38).
const arc = (r, c) =>
  `<path d="M${32 - r} 38 A${r} ${r} 0 0 1 ${32 + r} 38" fill="none" ` +
  `stroke="${c}" stroke-width="4.6" stroke-linecap="round"/>`;

// Litet vitt bubbligt moln med kontur.
const cloud = (cx, cy) =>
  `<path d="M${cx - 9} ${cy} Q${cx - 11} ${cy - 6} ${cx - 4} ${cy - 6} ` +
  `Q${cx - 2} ${cy - 11} ${cx + 3} ${cy - 7} Q${cx + 11} ${cy - 8} ${cx + 10} ${cy} Z" ` +
  `fill="#fff" ${LINE}/>`;

/** id → { viewBox, w (rem i rummet), art } */
export const DECOR = {
  // Krukväxt (designfacit): stor monstera i randig kruka med fatkant.
  krukvaxt: {
    viewBox: "0 0 74 104",
    w: 3.8,
    art:
      shadow(37, 99, 26) +
      limb("M37 74 L37 46", "#4E9B5E", 4) +
      `<path d="M37 56 Q18 52 14 32 Q30 26 39 44 Z" fill="#6FC66F" ${LINE}/>` +
      `<path d="M20 46 Q28 44 33 48" fill="none" ${THIN}/>` +
      `<path d="M37 50 Q56 46 62 26 Q44 20 35 40 Z" fill="#6FC66F" ${LINE}/>` +
      `<path d="M55 38 Q47 37 42 42" fill="none" ${THIN}/>` +
      `<path d="M37 44 Q34 20 48 10 Q58 24 41 42 Z" fill="#58C6A9" ${LINE}/>` +
      `<path d="M26 74 L48 74 L45 98 L29 98 Z" fill="#F49E4C" ${LINE}/>` +
      `<path d="M31 78 L30 94 M37 78 L37 94 M43 78 L44 94" stroke="#FFE9CC" stroke-width="3" stroke-linecap="round"/>` +
      `<rect x="23" y="70" width="28" height="7" rx="3.5" fill="#F08A3C" ${LINE}/>`,
  },
  // Världskarta: trälister upptill/nedtill, upphängningssnöre & kompassros.
  "poster-varld": {
    viewBox: "0 0 56 72",
    w: 3.6,
    art:
      `<path d="M7 12 L28 3 L49 12" fill="none" ${THIN}/>` +
      `<circle cx="28" cy="3" r="2" fill="${WOOD_DARK}" stroke="none"/>` +
      `<rect x="7" y="15" width="42" height="46" rx="2" fill="#C9EEFB" ${LINE}/>` +
      `<path d="M13 22 Q22 19 25 27 Q22 36 14 33 Q10 27 13 22 Z" fill="#6FC66F" stroke="none"/>` +
      `<path d="M30 20 Q40 20 42 28 Q38 34 31 31 Q28 25 30 20 Z" fill="#6FC66F" stroke="none"/>` +
      `<path d="M18 42 Q28 38 32 46 Q28 55 20 52 Q14 47 18 42 Z" fill="#58C6A9" stroke="none"/>` +
      `<path d="M38 44 Q45 44 45 51 Q41 55 37 51 Q35 47 38 44 Z" fill="#6FC66F" stroke="none"/>` +
      `<path d="M7 28 H49 M7 46 H49 M28 15 V61" fill="none" stroke="#8FD0EA" stroke-width="1.4"/>` +
      `<path d="${star(42, 24, 4.6, 1.9)}" fill="#EF6F6C" stroke="none"/>` +
      `<rect x="5" y="10" width="46" height="6" rx="3" fill="${WOOD}" ${LINE}/>` +
      `<rect x="5" y="60" width="46" height="6" rx="3" fill="${WOOD}" ${LINE}/>`,
  },
  // Tavla: dubbelram med passepartout, soligt landskap & litet moln.
  tavla: {
    viewBox: "0 0 60 58",
    w: 3.8,
    art:
      `<rect x="4" y="4" width="52" height="48" rx="4" fill="#F7C948" ${LINE}/>` +
      `<path d="M8 8 L14 14 M52 8 L46 14 M8 48 L14 42 M52 48 L46 42" fill="none" stroke="#F2A93B" stroke-width="2.2" stroke-linecap="round"/>` +
      `<rect x="10" y="10" width="40" height="36" rx="2" fill="#FFF3DC" stroke="none"/>` +
      `<rect x="13" y="13" width="34" height="30" rx="1.5" fill="#7FC7E8" stroke="none"/>` +
      `<circle cx="39" cy="21" r="4.6" fill="#FDE9A8" ${THIN}/>` +
      `<ellipse cx="22" cy="20" rx="5" ry="2.2" fill="#fff" opacity="0.9"/>` +
      `<path d="M13 43 Q22 30 30 38 Q38 30 47 43 Z" fill="#6FC66F" stroke="none"/>` +
      `<rect x="13" y="13" width="34" height="30" rx="1.5" fill="none" ${THIN}/>`,
  },
  // Stjärnljus: glödande halos bakom stjärnorna + gnistkryss.
  stjarnor: {
    viewBox: "0 0 60 60",
    w: 3.6,
    art:
      `<circle cx="24" cy="26" r="21" fill="#FDE9A8" opacity="0.4"/>` +
      `<circle cx="45" cy="16" r="12" fill="#FDE9A8" opacity="0.35"/>` +
      `<circle cx="44" cy="42" r="11" fill="#C9EEFB" opacity="0.4"/>` +
      `<path d="${star(24, 26, 17, 7.5)}" fill="#F7C948" ${LINE}/>` +
      `<path d="${star(45, 16, 9, 4)}" fill="#F890B7" ${LINE}/>` +
      `<path d="${star(44, 42, 8, 3.6)}" fill="#7FC7E8" ${LINE}/>` +
      `<circle cx="21" cy="23" r="2.2" fill="#FFF9E8" stroke="none"/>` +
      `<path d="M14 46 L14 53 M10.5 49.5 L17.5 49.5" fill="none" stroke="#F7C948" stroke-width="2.4" stroke-linecap="round"/>`,
  },
  // Regnbåge med moln i båda ändar.
  regnbage: {
    viewBox: "0 0 64 42",
    w: 4.6,
    art:
      arc(26, "#EF6F6C") + arc(21.5, "#F49E4C") + arc(17, "#F7C948") +
      arc(12.5, "#6FC66F") + arc(8, "#7FC7E8") +
      cloud(10, 37) + cloud(54, 37),
  },
  // Akvarium: träbord, grus, växter, två fiskar & bubblor.
  akvarium: {
    viewBox: "0 0 68 62",
    w: 4.6,
    art:
      shadow(34, 58, 28) +
      `<rect x="10" y="48" width="48" height="7" rx="3.5" fill="${WOOD}" ${LINE}/>` +
      `<path d="M15 50.5 H40" stroke="#E0B98C" stroke-width="2.2" stroke-linecap="round"/>` +
      `<rect x="6" y="8" width="56" height="42" rx="7" fill="#9BD3EF" ${LINE}/>` +
      `<path d="M11 16 Q34 20 57 16" fill="none" stroke="#C9EEFB" stroke-width="2.6" stroke-linecap="round"/>` +
      `<path d="M10 45 Q34 41 58 45 L58 47 L10 47 Z" fill="#EAD9C0" stroke="none"/>` +
      `<circle cx="18" cy="44.5" r="1.6" fill="#D8C4A4"/><circle cx="40" cy="43.5" r="1.6" fill="#D8C4A4"/><circle cx="52" cy="44.5" r="1.4" fill="#D8C4A4"/>` +
      `<path d="M16 45 Q12 33 17 26" fill="none" stroke="#6FC66F" stroke-width="3.4" stroke-linecap="round"/>` +
      `<path d="M21 45 Q24 35 21 28" fill="none" stroke="#58C6A9" stroke-width="3" stroke-linecap="round"/>` +
      `<ellipse cx="35" cy="28" rx="8.5" ry="5.6" fill="#F49E4C" ${THIN}/>` +
      `<path d="M43 28 L50 23 L48 28 L50 33 Z" fill="#F49E4C" ${THIN}/>` +
      `<path d="M35 23.5 Q37 20 39 23" fill="none" stroke="#F08A3C" stroke-width="2" stroke-linecap="round"/>` +
      `<circle cx="31.5" cy="27" r="1.6" fill="${O}"/>` +
      `<ellipse cx="49" cy="40" rx="5" ry="3.4" fill="#F890B7" ${THIN}/>` +
      `<path d="M54 40 L58 37.5 L57 40 L58 42.5 Z" fill="#F890B7" ${THIN}/>` +
      `<circle cx="47" cy="39.4" r="1.1" fill="${O}"/>` +
      `<circle cx="46" cy="19" r="2.2" fill="#C9EEFB" ${THIN}/>` +
      `<circle cx="50" cy="13" r="1.6" fill="#C9EEFB" ${THIN}/>`,
  },
  // Vimpelgirlang: sydda vimplar med prickar & rosetter i ändarna.
  girlang: {
    viewBox: "0 0 72 44",
    w: 5.6,
    art:
      `<path d="M4 8 Q36 22 68 8" fill="none" ${LINE}/>` +
      `<path d="M10 11 L22 11 L16 27 Z" fill="#EF6F6C" ${THIN}/>` +
      `<circle cx="16" cy="15.5" r="1.8" fill="#FFB1B8" stroke="none"/>` +
      `<path d="M23 15 L35 15 L29 31 Z" fill="#F7C948" ${THIN}/>` +
      `<circle cx="29" cy="19.5" r="1.8" fill="#FDE9A8" stroke="none"/>` +
      `<path d="M37 16 L49 16 L43 32 Z" fill="#6FC66F" ${THIN}/>` +
      `<circle cx="43" cy="20.5" r="1.8" fill="#C9F0DC" stroke="none"/>` +
      `<path d="M50 15 L62 15 L56 31 Z" fill="#7FC7E8" ${THIN}/>` +
      `<circle cx="56" cy="19.5" r="1.8" fill="#C9EEFB" stroke="none"/>` +
      `<path d="M2 6 L6 4 L5 8 L6 12 L2 10 Z" fill="#B79BE0" ${THIN}/>` +
      `<path d="M70 6 L66 4 L67 8 L66 12 L70 10 Z" fill="#B79BE0" ${THIN}/>`,
  },
  // Ballongbukett: tre ballonger med glans, knut & rosett.
  ballonger: {
    viewBox: "0 0 56 66",
    w: 3.6,
    art:
      `<path d="M18 32 Q28 44 28 58 M38 30 Q30 44 28 58 M28 40 L28 58" fill="none" ${THIN}/>` +
      `<ellipse cx="18" cy="18" rx="13" ry="15" fill="#EF6F6C" ${LINE}/>` +
      `<path d="M15 33 L21 33 L18 37 Z" fill="#EF6F6C" stroke="none"/>` +
      `<ellipse cx="38" cy="16" rx="13" ry="15" fill="#7FC7E8" ${LINE}/>` +
      `<path d="M35 31 L41 31 L38 35 Z" fill="#7FC7E8" stroke="none"/>` +
      `<ellipse cx="28" cy="30" rx="12" ry="14" fill="#F7C948" ${LINE}/>` +
      `<ellipse cx="13" cy="12" rx="3.4" ry="4.6" fill="#fff" opacity="0.45"/>` +
      `<ellipse cx="33" cy="10" rx="3.4" ry="4.6" fill="#fff" opacity="0.45"/>` +
      `<ellipse cx="23" cy="25" rx="3" ry="4" fill="#fff" opacity="0.4"/>` +
      `<path d="M24 58 L28 60 L32 58 L31 62 L25 62 Z" fill="#F890B7" ${THIN}/>`,
  },
  // Kaktus: randig kruka med fatkant, blomma & mjuk kontaktskugga.
  kaktus: {
    viewBox: "0 0 48 68",
    w: 3.2,
    art:
      shadow(24, 64, 17) +
      `<path d="M18 46 L15 62 L33 62 L30 46 Z" fill="#F49E4C" ${LINE}/>` +
      `<path d="M21 50 L20 59 M24 50 L24 59 M27 50 L28 59" stroke="#FFE9CC" stroke-width="2.6" stroke-linecap="round"/>` +
      `<path d="M18 44 Q13 30 18 16 Q24 10 30 16 Q35 30 30 44 Z" fill="#6FC66F" ${LINE}/>` +
      `<path d="M12 38 Q6 34 8 26 Q11 22 15 26 L15 34" fill="#6FC66F" ${LINE}/>` +
      `<path d="M36 34 Q42 30 40 22 Q37 18 33 22 L33 30" fill="#6FC66F" ${LINE}/>` +
      `<path d="M24 20 L24 40 M20 28 L28 28" fill="none" ${THIN}/>` +
      `<rect x="14" y="42" width="20" height="7" rx="3.5" fill="#F08A3C" ${LINE}/>` +
      `<path d="${star(24, 13, 4.4, 2)}" fill="#F890B7" ${THIN}/>` +
      `<circle cx="24" cy="13" r="1.5" fill="#FDE9A8" stroke="none"/>`,
  },
  // Väggklocka: träring, timmarkeringar runt om & blank urtavla.
  vaggklocka: {
    viewBox: "0 0 56 56",
    w: 3.0,
    art:
      `<circle cx="28" cy="28" r="24" fill="${WOOD}" ${LINE}/>` +
      `<circle cx="28" cy="28" r="19.5" fill="#FFF3DC" ${THIN}/>` +
      `<path d="M28 11 L28 15 M45 28 L41 28 M28 45 L28 41 M11 28 L15 28" fill="none" ${THIN}/>` +
      `<g stroke="${O}" stroke-width="1.6" stroke-linecap="round" opacity="0.55">` +
      `<path d="M36.5 13.3 L35 15.9 M42.7 19.5 L40.1 21 M42.7 36.5 L40.1 35 M36.5 42.7 L35 40.1 M19.5 42.7 L21 40.1 M13.3 36.5 L15.9 35 M13.3 19.5 L15.9 21 M19.5 13.3 L21 15.9"/></g>` +
      `<path d="M17 18 Q20 14.5 24 13" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity="0.8"/>` +
      `<path d="M28 28 L28 17" fill="none" stroke="${O}" stroke-width="2.6" stroke-linecap="round"/>` +
      `<path d="M28 28 L37 32" fill="none" stroke="${O}" stroke-width="2.6" stroke-linecap="round"/>` +
      `<circle cx="28" cy="28" r="2.4" fill="#EF6F6C"/>`,
  },
};
