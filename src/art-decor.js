// ============================================================================
// Pluggportalen – dekorkonst (inline SVG för shopens "dekor"-saker)
// ----------------------------------------------------------------------------
// Följer stilguiden i art-style.js: kontur #3B3350, stroke 3 (tunt 2.2),
// mjuka rundade former och samma palett som karaktärerna. Varje sak ritas
// tajt i sin egen viewBox och skalas av renderingen. Id:na måste matcha
// shop-items.js exakt (sparas i Firestore).
// ============================================================================

import { O, LINE, THIN } from "./art-style.js";

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

/** id → { viewBox, art } */
export const DECOR = {
  krukvaxt: {
    viewBox: "0 0 56 66",
    art:
      `<path d="M28 42 Q14 26 20 8 Q30 22 28 42 Z" fill="#6FC66F" ${LINE}/>` +
      `<path d="M28 42 Q42 26 36 8 Q28 22 28 42 Z" fill="#58C6A9" ${LINE}/>` +
      `<path d="M28 42 Q28 20 28 6 Q34 18 28 42 Z" fill="#6FC66F" ${LINE}/>` +
      `<path d="M22 24 Q25 30 27 34 M34 24 Q31 30 29 34" fill="none" ${THIN}/>` +
      `<path d="M15 40 L41 40 L37 62 L19 62 Z" fill="#F08A3C" ${LINE}/>` +
      `<rect x="12" y="35" width="32" height="8" rx="3" fill="#F49E4C" ${LINE}/>` +
      `<path d="M20 51 L36 51" fill="none" ${THIN}/>`,
  },
  "poster-varld": {
    viewBox: "0 0 56 64",
    art:
      `<rect x="5" y="4" width="46" height="6" rx="3" fill="#B0805A" ${LINE}/>` +
      `<rect x="7" y="9" width="42" height="50" rx="3" fill="#C9EEFB" ${LINE}/>` +
      `<path d="M13 18 Q22 15 25 23 Q22 32 14 29 Q10 23 13 18 Z" fill="#6FC66F" stroke="none"/>` +
      `<path d="M30 16 Q40 16 42 24 Q38 30 31 27 Q28 21 30 16 Z" fill="#6FC66F" stroke="none"/>` +
      `<path d="M20 38 Q30 34 34 42 Q30 52 22 49 Q16 44 20 38 Z" fill="#58C6A9" stroke="none"/>` +
      `<path d="M38 40 Q45 40 45 48 Q41 52 37 48 Q35 44 38 40 Z" fill="#6FC66F" stroke="none"/>` +
      `<path d="M7 24 H49 M7 40 H49 M28 9 V59" fill="none" stroke="#8FD0EA" stroke-width="1.4"/>` +
      `<circle cx="24" cy="22" r="2.6" fill="#EF6F6C" ${THIN}/>`,
  },
  tavla: {
    viewBox: "0 0 60 56",
    art:
      `<rect x="6" y="5" width="48" height="45" rx="3" fill="#F7C948" ${LINE}/>` +
      `<rect x="12" y="11" width="36" height="33" rx="2" fill="#7FC7E8" stroke="none"/>` +
      `<circle cx="40" cy="20" r="5" fill="#FDE9A8" ${THIN}/>` +
      `<path d="M12 44 Q22 28 32 38 Q40 30 48 44 Z" fill="#6FC66F" stroke="none"/>` +
      `<rect x="12" y="11" width="36" height="33" rx="2" fill="none" ${THIN}/>`,
  },
  stjarnor: {
    viewBox: "0 0 60 60",
    art:
      `<path d="${star(24, 26, 17, 7.5)}" fill="#F7C948" ${LINE}/>` +
      `<path d="${star(45, 16, 9, 4)}" fill="#F890B7" ${LINE}/>` +
      `<path d="${star(44, 42, 8, 3.6)}" fill="#7FC7E8" ${LINE}/>` +
      `<path d="M14 46 L14 53 M10.5 49.5 L17.5 49.5" fill="none" stroke="#F7C948" stroke-width="2.4" stroke-linecap="round"/>`,
  },
  regnbage: {
    viewBox: "0 0 64 42",
    art:
      arc(26, "#EF6F6C") + arc(21.5, "#F49E4C") + arc(17, "#F7C948") +
      arc(12.5, "#6FC66F") + arc(8, "#7FC7E8") +
      cloud(10, 37) + cloud(54, 37),
  },
  akvarium: {
    viewBox: "0 0 64 56",
    art:
      `<rect x="10" y="46" width="44" height="6" rx="3" fill="#B0805A" ${LINE}/>` +
      `<rect x="6" y="8" width="52" height="40" rx="7" fill="#9BD3EF" ${LINE}/>` +
      `<path d="M11 16 Q32 20 53 16" fill="none" stroke="#C9EEFB" stroke-width="2.6" stroke-linecap="round"/>` +
      `<path d="M16 46 Q13 34 18 28" fill="none" stroke="#6FC66F" stroke-width="3.4" stroke-linecap="round"/>` +
      `<path d="M20 46 Q23 36 20 30" fill="none" stroke="#58C6A9" stroke-width="3" stroke-linecap="round"/>` +
      `<ellipse cx="34" cy="30" rx="9" ry="6" fill="#F49E4C" ${THIN}/>` +
      `<path d="M43 30 L50 25 L48 30 L50 35 Z" fill="#F49E4C" ${THIN}/>` +
      `<circle cx="30" cy="29" r="1.6" fill="${O}"/>` +
      `<circle cx="46" cy="18" r="2.2" fill="#C9EEFB" ${THIN}/>` +
      `<circle cx="50" cy="12" r="1.6" fill="#C9EEFB" ${THIN}/>`,
  },
};
