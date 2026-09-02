// ============================================================================
// Pluggportalen – möbelkonst (inline SVG för shopens "mobler"-saker)
// ----------------------------------------------------------------------------
// Följer stilguiden i art-style.js OCH designfacit i
// design/DESIGNBESLUT-husdjur-hem-2.0.md: kontur #3B3350 (stroke 3 / tunt 2.2),
// tvåtonat trä (#B0805A/#8A6242/#E0B98C), textilier med sömmar, mjuk
// kontaktskugga (#3B3350 op 0.09) under varje golvsak.
// Varje sak ritas TAJT i sin egen viewBox och skalas av renderingen
// (preserveAspectRatio="xMidYMid meet"). `w` = visningsbredd i rem i rummet
// (höjden räknas ut ur viewBox-proportionen). Id:na måste matcha
// shop-items.js exakt (sparas i Firestore) – byt bara utseendet, aldrig id.
// ============================================================================

import { LINE, THIN, limb, shadow, stjarna } from "./art-style.js";

const WOOD = "#B0805A";
const WOOD_DARK = "#8A6242";
const WOOD_LIGHT = "#E0B98C";

// Liten bokrygg i bokhyllan.
const book = (x, y, w, h, c, rot = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.6" fill="${c}" ${THIN}` +
  (rot ? ` transform="rotate(${rot} ${x + w / 2} ${y + h / 2})"` : "") +
  `/>`;

/** id → { viewBox, w (rem i rummet), art } */
export const FURNITURE = {
  // Pall: stoppad sits med söm, svarvade ben och tvärslå.
  stol: {
    viewBox: "0 0 60 68",
    w: 3.2,
    art:
      shadow(30, 63, 23) +
      limb("M17 34 L12 60", WOOD_DARK, 5) +
      limb("M43 34 L48 60", WOOD_DARK, 5) +
      limb("M15 50 L45 50", WOOD_DARK, 3.5) +
      `<rect x="6" y="21" width="48" height="15" rx="7" fill="${WOOD}" ${LINE}/>` +
      `<rect x="12" y="27" width="18" height="3.5" rx="1.7" fill="${WOOD_LIGHT}" stroke="none"/>` +
      `<rect x="9" y="12" width="42" height="13" rx="6.5" fill="#F890B7" ${LINE}/>` +
      `<path d="M16 18 Q30 14.5 44 18" fill="none" stroke="#FDEBF2" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="0.1 5"/>`,
  },
  // Himmelsäng (designfacit): volangtäcke, hjärtgavel & drömstjärnor.
  sang: {
    viewBox: "0 0 124 88",
    w: 7.2,
    art:
      shadow(62, 82, 52) +
      limb("M14 66 L12 79", WOOD_DARK, 5) +
      limb("M104 66 L106 79", WOOD_DARK, 5) +
      `<rect x="4" y="10" width="14" height="60" rx="6" fill="${WOOD}" ${LINE}/>` +
      `<path d="M8 24 C8 18 14 18 14 24 C14 18 20 18 20 24 Q20 29 14 32 Q8 29 8 24 Z" transform="translate(-3 0)" fill="#F890B7" ${THIN}/>` +
      `<rect x="102" y="30" width="12" height="40" rx="5" fill="${WOOD}" ${LINE}/>` +
      `<rect x="12" y="42" width="96" height="18" rx="7" fill="#FFF3DC" ${LINE}/>` +
      `<path d="M46 42 L108 42 L108 58 Q100 66 92 58 Q84 66 76 58 Q68 66 60 58 Q52 66 46 58 Z" fill="#7FC7E8" ${LINE}/>` +
      `<path d="M52 48 Q77 44 102 48" fill="none" stroke="#C9EEFB" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="0.1 6"/>` +
      `<rect x="18" y="32" width="26" height="15" rx="7" fill="#F890B7" ${LINE}/>` +
      `<path d="M24 39 Q31 36 38 39" fill="none" ${THIN}/>` +
      `<circle cx="88" cy="50" r="3" fill="#F7C948" stroke="none"/><circle cx="68" cy="52" r="2.4" fill="#F7C948" stroke="none"/>`,
  },
  // Golvlampa: randig skärm, varm ljusglöd och tvåtonad fot.
  lampa: {
    viewBox: "0 0 56 84",
    w: 3.3,
    art:
      shadow(28, 79, 19) +
      limb("M28 32 L28 70", WOOD, 4) +
      `<ellipse cx="28" cy="72" rx="15" ry="5" fill="${WOOD}" ${LINE}/>` +
      `<ellipse cx="28" cy="70.5" rx="9" ry="2.6" fill="${WOOD_LIGHT}" stroke="none"/>` +
      `<ellipse cx="28" cy="33" rx="19" ry="3.8" fill="#FDE9A8" opacity="0.75"/>` +
      `<path d="M16 8 L40 8 L48 31 L8 31 Z" fill="#F7C948" ${LINE}/>` +
      `<path d="M23 8 L16 31 M33 8 L40 31" fill="none" stroke="#F2A93B" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M19.5 11 L13.5 28" fill="none" stroke="#FDE9A8" stroke-width="2.6" stroke-linecap="round"/>` +
      `<circle cx="28" cy="6" r="2.6" fill="${WOOD_DARK}" ${THIN}/>`,
  },
  // Bokhylla (designfacit): rundad topp, böcker, pokal, foto & liten växt.
  bokhylla: {
    viewBox: "0 0 78 110",
    w: 4.5,
    art:
      shadow(39, 104, 32) +
      `<path d="M10 100 L10 22 Q10 6 39 6 Q68 6 68 22 L68 100 Z" fill="${WOOD}" ${LINE}/>` +
      `<path d="M14 96 L14 24 Q14 11 39 11 Q64 11 64 24 L64 96 Z" fill="${WOOD_LIGHT}" stroke="none"/>` +
      `<path d="M14 42 L64 42 M14 68 L64 68" fill="none" ${LINE}/>` +
      book(18, 24, 7, 17, "#EF6F6C") + book(26, 27, 6, 14, "#6FC66F") +
      book(33, 25, 7, 16, "#7FC7E8") + book(42, 27, 6, 14, "#F7C948", 9) +
      `<path d="M52 41 L52 33 Q52 28 57 28 Q62 28 62 33 L62 41 Z" fill="#B79BE0" ${THIN}/>` +
      book(18, 50, 7, 16, "#F49E4C") + book(26, 48, 6, 18, "#58C6A9") +
      `<path d="M40 52 Q40 48 44 48 Q48 48 48 52 Q48 56 44 58 Q40 56 40 52 Z" fill="#F7C948" ${THIN}/>` +
      `<rect x="41.5" y="58" width="5" height="4" fill="${WOOD_DARK}" ${THIN}/>` +
      book(53, 49, 7, 17, "#F890B7") +
      `<rect x="18" y="76" width="20" height="18" rx="3" fill="#EAD9C0" ${THIN}/>` +
      `<circle cx="28" cy="85" r="2" fill="${WOOD_DARK}"/>` +
      `<path d="M46 94 L46 82 M46 84 Q39 82 40 74 Q47 74 46 84 M46 86 Q53 84 52 76 Q45 76 46 86" fill="#6FC66F" ${THIN}/>` +
      `<path d="M42 94 L58 94 L56 100 L44 100 Z" fill="#F49E4C" ${THIN}/>`,
  },
  // Dator: skärm med soligt diagram, glans, tangentbord & mus.
  dator: {
    viewBox: "0 0 72 68",
    w: 4.3,
    art:
      shadow(36, 64, 30) +
      `<rect x="33" y="38" width="6" height="9" fill="#7E97B8" ${LINE}/>` +
      `<rect x="24" y="45" width="24" height="5" rx="2.5" fill="#7E97B8" ${LINE}/>` +
      `<rect x="8" y="4" width="56" height="36" rx="6" fill="#46557A" ${LINE}/>` +
      `<rect x="12" y="8" width="48" height="28" rx="3" fill="#9BD3EF" stroke="none"/>` +
      `<path d="M16 33 L42 9" fill="none" stroke="#C9EEFB" stroke-width="5" stroke-linecap="round" opacity="0.55"/>` +
      `<circle cx="22" cy="17" r="4.5" fill="#F7C948" stroke="none"/>` +
      `<path d="M18 30 L28 21 L36 27 L44 18 L54 26" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<rect x="6" y="55" width="44" height="9" rx="4" fill="#A9C2DE" ${LINE}/>` +
      `<path d="M12 59.5 H44" fill="none" ${THIN}/>` +
      `<ellipse cx="62" cy="59" rx="5.5" ry="4.2" fill="#FFF3DC" ${THIN}/>` +
      `<path d="M62 55.5 L62 59" fill="none" ${THIN}/>`,
  },
  // TV på mediabänk: solnedgångsscen på skärmen och tvåtonad bänk.
  tv: {
    viewBox: "0 0 96 74",
    w: 5.4,
    art:
      shadow(48, 69, 40) +
      limb("M18 58 L16 67", WOOD_DARK, 4) +
      limb("M78 58 L80 67", WOOD_DARK, 4) +
      `<rect x="43" y="45" width="10" height="6" fill="#46405C" ${LINE}/>` +
      `<rect x="8" y="50" width="80" height="10" rx="5" fill="${WOOD}" ${LINE}/>` +
      `<path d="M14 53 H50" stroke="${WOOD_LIGHT}" stroke-width="2.6" stroke-linecap="round"/>` +
      `<rect x="14" y="6" width="68" height="40" rx="5" fill="#46405C" ${LINE}/>` +
      `<rect x="18" y="10" width="60" height="32" rx="2.5" fill="#7FC7E8" stroke="none"/>` +
      `<circle cx="64" cy="20" r="5.5" fill="#F7C948" stroke="none"/>` +
      `<ellipse cx="32" cy="17" rx="7" ry="3" fill="#fff" opacity="0.9"/>` +
      `<path d="M18 42 Q32 24 48 36 Q62 24 78 42 Z" fill="#6FC66F" stroke="none"/>` +
      `<path d="M22 39 L52 12" fill="none" stroke="#C9EEFB" stroke-width="4.5" stroke-linecap="round" opacity="0.45"/>`,
  },
  // Solmatta (designfacit): färgringar & stjärnor.
  matta: {
    viewBox: "0 0 140 64",
    w: 7.6,
    art:
      `<ellipse cx="70" cy="32" rx="64" ry="26" fill="#F890B7" ${LINE}/>` +
      `<ellipse cx="70" cy="32" rx="52" ry="20" fill="#FFF3DC" ${THIN}/>` +
      `<ellipse cx="70" cy="32" rx="34" ry="13" fill="#7FC7E8" ${THIN}/>` +
      `<ellipse cx="70" cy="32" rx="16" ry="6.5" fill="#F7C948" ${THIN}/>` +
      stjarna(34, 29, 0.9, "#F890B7") + stjarna(104, 36, 0.9, "#F890B7"),
  },
  // Sittpuff: sydda kilar, knapp i toppen och mjuk glans.
  sittpuff: {
    viewBox: "0 0 68 58",
    w: 4.0,
    art:
      shadow(34, 53, 26) +
      `<path d="M10 44 Q4 20 34 15 Q64 20 58 44 Q34 53 10 44 Z" fill="#58C6A9" ${LINE}/>` +
      `<path d="M34 15 Q29 30 15 43 M34 15 Q39 30 53 43 M34 16 L34 49" fill="none" ${THIN}/>` +
      `<path d="M16 27 Q20 20 27 18" fill="none" stroke="#C9F0DC" stroke-width="3" stroke-linecap="round"/>` +
      `<circle cx="34" cy="17" r="3.6" fill="#C9F0DC" ${THIN}/>`,
  },
  // Byrå: tre lådor med dubbla knoppar, bokstapel & foto på toppen.
  byra: {
    viewBox: "0 0 72 88",
    w: 4.3,
    art:
      shadow(36, 83, 30) +
      limb("M14 74 L12 81", WOOD_DARK, 4) +
      limb("M58 74 L60 81", WOOD_DARK, 4) +
      `<rect x="14" y="10" width="18" height="4.5" rx="2" fill="#7FC7E8" ${THIN}/>` +
      `<rect x="16" y="5.5" width="14" height="4.5" rx="2" fill="#EF6F6C" ${THIN}/>` +
      `<rect x="42" y="2" width="16" height="13" rx="2" fill="#F7C948" ${THIN}/>` +
      `<rect x="45" y="5" width="10" height="7" rx="1" fill="#7FC7E8" stroke="none"/>` +
      `<rect x="8" y="16" width="56" height="58" rx="5" fill="${WOOD}" ${LINE}/>` +
      `<rect x="12" y="19" width="28" height="3.5" rx="1.7" fill="${WOOD_LIGHT}" stroke="none"/>` +
      `<rect x="13" y="25" width="46" height="13" rx="3" fill="${WOOD_LIGHT}" ${LINE}/>` +
      `<rect x="13" y="42" width="46" height="13" rx="3" fill="${WOOD_LIGHT}" ${LINE}/>` +
      `<rect x="13" y="59" width="46" height="13" rx="3" fill="${WOOD_LIGHT}" ${LINE}/>` +
      `<circle cx="27" cy="31.5" r="2.2" fill="${WOOD_DARK}"/><circle cx="45" cy="31.5" r="2.2" fill="${WOOD_DARK}"/>` +
      `<circle cx="27" cy="48.5" r="2.2" fill="${WOOD_DARK}"/><circle cx="45" cy="48.5" r="2.2" fill="${WOOD_DARK}"/>` +
      `<circle cx="27" cy="65.5" r="2.2" fill="${WOOD_DARK}"/><circle cx="45" cy="65.5" r="2.2" fill="${WOOD_DARK}"/>`,
  },
  // Skrivbord: skiva med glans, hurts med handtag, bokstapel & pennburk.
  skrivbord: {
    viewBox: "0 0 108 78",
    w: 6.0,
    art:
      shadow(54, 73, 46) +
      limb("M14 36 L10 70", WOOD_DARK, 5) +
      `<rect x="62" y="34" width="38" height="36" rx="4" fill="${WOOD}" ${LINE}/>` +
      `<path d="M64 46 L98 46 M64 58 L98 58" fill="none" ${THIN}/>` +
      `<path d="M75 40 L87 40 M75 52 L87 52 M75 64 L87 64" fill="none" stroke="${WOOD_DARK}" stroke-width="2.6" stroke-linecap="round"/>` +
      `<rect x="4" y="26" width="100" height="10" rx="5" fill="#C9996B" ${LINE}/>` +
      `<path d="M10 29 H58" stroke="${WOOD_LIGHT}" stroke-width="2.6" stroke-linecap="round"/>` +
      `<rect x="14" y="14" width="20" height="5.5" rx="2" fill="#EF6F6C" ${THIN}/>` +
      `<rect x="16" y="8.5" width="16" height="5.5" rx="2" fill="#7FC7E8" ${THIN}/>` +
      `<path d="M47 8 L47 15 M52 5.5 L52 15" stroke="#EF6F6C" stroke-width="2.6" stroke-linecap="round"/>` +
      `<path d="M52 5.5 L52 15" stroke="#F7C948" stroke-width="2.6" stroke-linecap="round"/>` +
      `<rect x="42" y="14" width="15" height="12" rx="2.5" fill="#B79BE0" ${THIN}/>`,
  },
  // Mysfåtölj (designfacit): pläd, stjärnkudde & kulfötter.
  fatolj: {
    viewBox: "0 0 104 92",
    w: 5.6,
    art:
      shadow(52, 86, 44) +
      `<circle cx="22" cy="82" r="5" fill="${WOOD_DARK}" ${THIN}/>` +
      `<circle cx="82" cy="82" r="5" fill="${WOOD_DARK}" ${THIN}/>` +
      `<path d="M18 62 Q10 20 34 14 Q52 8 70 14 Q94 20 86 62 Z" fill="#B79BE0" ${LINE}/>` +
      `<path d="M30 24 Q52 16 74 24" fill="none" ${THIN}/>` +
      `<rect x="8" y="40" width="20" height="40" rx="10" fill="#9C7ED0" ${LINE}/>` +
      `<rect x="76" y="40" width="20" height="40" rx="10" fill="#9C7ED0" ${LINE}/>` +
      `<rect x="22" y="56" width="60" height="26" rx="10" fill="#C9B3EC" ${LINE}/>` +
      stjarna(38, 36, 1.5, "#F7C948") +
      `<path d="M60 56 L82 56 L82 74 Q71 80 60 74 Z" fill="#EF6F6C" ${THIN}/>` +
      `<path d="M64 60 H78 M64 66 H78" stroke="#FFB1B8" stroke-width="2.2" stroke-linecap="round"/>`,
  },
};
