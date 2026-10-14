// ============================================================================
// Pluggporten – Halloween-kostymernas konst (#693, epic #689)
// ----------------------------------------------------------------------------
// Samma format och konvention som WEARABLES (art-wearables.js): varje plagg
// ritas TAJT i sin viewBox och placeras av CSS-slot-boxarna (.af-wear.af-<slot>
// i styles/08-avatar-klader.css), som träffar det gemensamma ankargriddet i
// art-style.js – därför sitter kostymerna rätt på alla avatarer, även de nya
// (de ritas på samma grid). `par` som i slot-modulerna: hattar xMidYMax,
// ansikte xMidYMid (ögonlinjen), hals/rygg xMidYMin, hand xMidYMax.
//
// Gulligt-läskigt (spec §3.4): mjuka former, inga vassa tänder, inget blod.
// Registreras lazy av hw-konst.js (registerWearables) – aldrig i bootgrafen.
// Läser aldrig säsongen: OM kostymen syns avgör avatars.js (af-kostym + CSS).
// Id:na måste matcha shop-items.js exakt (sparas i Firestore).
// ============================================================================

import { LINE, THIN } from "../art-style.js";
import { PUMPA, PUMPA_MORK, LILA, LILA_MORK, NATT, GUL, GRON, GRON_MORK, KRAM, SLEM } from "./hw-art-delar.js";

const MANTEL = "#5E5679";
const MORK = "#2F2B3A";
const ROSA = "#F890B7";

/** Spegla en x-koordinat i en viewBox med bredden w (för symmetriska plagg). */
const spegel = (d, w) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${+(w - x).toFixed(1)} ${y}`);

/** Glad stängd blick + leende (pumpahuvudet, godispåsen). */
const gladMin = (cx, y, dx, w) =>
  `<path d="M${cx - dx - 3} ${y} Q${cx - dx} ${y - 3.5} ${cx - dx + 3} ${y} M${cx + dx - 3} ${y} Q${cx + dx} ${y - 3.5} ${cx + dx + 3} ${y}" fill="none" stroke="${MORK}" stroke-width="2" stroke-linecap="round"/>` +
  `<path d="M${cx - w} ${y + 5} Q${cx} ${y + 5 + w} ${cx + w} ${y + 5}" fill="none" stroke="${MORK}" stroke-width="2" stroke-linecap="round"/>`;

const HORN_V = "M10 27 Q5 16 10 5 Q13 3 15 6 Q15 16 22 25 Z";
const ORA_V = "M8 26 Q7 11 13 3 Q20 9 26 21 Z";
const ORA_V_INRE = "M12 22 Q12 13 14 8.5 Q18 12.5 21 19 Z";
const KRAGE_V = "M22 20 Q10 16 3 2 Q1 15 8 25 Q15 29 22 26 Z";
const KRAGE_V_INRE = "M20 21 Q11 17 6 8 Q6 16 10 22 Q15 25 20 23 Z";
// Vingarna i 1:1-avatarmått (viewBox-bredd 100 = hela figuren, y + 16,8).
const VINGE_V = "M50 40 Q30 8 6 6 Q12 18 8 30 Q17 26 21 38 Q30 33 33 46 Q42 40 50 50 Z";
const VINGE_V_BEN = "M50 41 L10 9 M49 43 L12 28 M49 45 L24 37 M49 47 L34 44";

/** id → { viewBox, par, art } – samma form som WEARABLES. */
export const HW_KOSTYMER = {
  "hw-haxhatt": {
    viewBox: "0 0 60 50",
    par: "xMidYMax",
    art:
      `<path d="M17 41 Q20 25 27 14 Q33 5 46 7 Q38 11 36.5 19 Q38 31 43 41 Z" fill="${MANTEL}" ${LINE}/>` +
      `<path d="M17.5 35 Q30 38 42 35 L43 41 Q30 44 17 41 Z" fill="${PUMPA}" ${LINE}/>` +
      `<rect x="26" y="35.5" width="8" height="6.5" rx="1.5" fill="${GUL}" ${THIN}/>` +
      `<ellipse cx="30" cy="44" rx="27" ry="5.5" fill="${NATT}" ${LINE}/>` +
      `<path d="M30 22 L31.3 25 L34.5 25.3 L32.1 27.4 L32.8 30.6 L30 29 L27.2 30.6 L27.9 27.4 L25.5 25.3 L28.7 25 Z" fill="${GUL}" stroke="none"/>` +
      `<circle cx="38" cy="14" r="1.4" fill="${GUL}" stroke="none"/>`,
  },
  "hw-pumpahuvud": {
    viewBox: "0 0 60 46",
    par: "xMidYMax",
    art:
      `<path d="M28.5 15 Q27 8 31 3.5 L34.5 5.5 Q31.5 9 32.5 15 Z" fill="#6E9B4E" ${THIN}/>` +
      `<path d="M33 10 Q42 3 48 8 Q41 14 33 10 Z" fill="${GRON}" ${THIN}/>` +
      `<ellipse cx="17" cy="30" rx="13" ry="14" fill="${PUMPA_MORK}" ${LINE}/>` +
      `<ellipse cx="43" cy="30" rx="13" ry="14" fill="${PUMPA_MORK}" ${LINE}/>` +
      `<ellipse cx="30" cy="29.5" rx="14.5" ry="15.5" fill="${PUMPA}" ${LINE}/>` +
      `<path d="M23 18 Q21 29 23 42 M37 18 Q39 29 37 42" fill="none" stroke="${PUMPA_MORK}" stroke-width="1.6" stroke-linecap="round"/>` +
      gladMin(30, 28, 6, 6) +
      `<ellipse cx="20" cy="34" rx="3" ry="2" fill="${ROSA}" opacity="0.8"/>` +
      `<ellipse cx="40" cy="34" rx="3" ry="2" fill="${ROSA}" opacity="0.8"/>`,
  },
  "hw-kattoron": {
    viewBox: "0 0 60 30",
    par: "xMidYMax",
    art:
      `<path d="M7 28 Q30 18 53 28" fill="none" stroke="${MORK}" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="${ORA_V}" fill="${NATT}" ${LINE}/>` +
      `<path d="${spegel(ORA_V, 60)}" fill="${NATT}" ${LINE}/>` +
      `<path d="${ORA_V_INRE}" fill="${ROSA}" stroke="none"/>` +
      `<path d="${spegel(ORA_V_INRE, 60)}" fill="${ROSA}" stroke="none"/>` +
      `<path d="M41 22 L36 18.5 L36 25.5 Z M41 22 L46 18.5 L46 25.5 Z" fill="${PUMPA}" ${THIN}/>` +
      `<circle cx="41" cy="22" r="1.8" fill="${PUMPA_MORK}" ${THIN}/>`,
  },
  "hw-monsterhorn": {
    viewBox: "0 0 60 30",
    par: "xMidYMax",
    art:
      `<path d="M7 28 Q30 18 53 28" fill="none" stroke="${LILA_MORK}" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="${HORN_V}" fill="${SLEM}" ${LINE}/>` +
      `<path d="${spegel(HORN_V, 60)}" fill="${SLEM}" ${LINE}/>` +
      `<path d="M8.5 19 Q13 18 17 20 M8 12 Q11 11 14 12.5 M51.5 19 Q47 18 43 20 M52 12 Q49 11 46 12.5" fill="none" stroke="${GRON_MORK}" stroke-width="1.8" stroke-linecap="round"/>` +
      `<circle cx="11.5" cy="5.5" r="1.3" fill="#fff" opacity="0.8"/>` +
      `<circle cx="48.5" cy="5.5" r="1.3" fill="#fff" opacity="0.8"/>`,
  },
  // Ansiktsplaggen sitter på ögonlinjen (ögonen ≈ x19/x41, y12 i viewBoxen).
  "hw-mumiebandage": {
    viewBox: "0 0 60 26",
    par: "xMidYMid",
    art:
      `<path d="M3 3 Q30 -1 57 3 L57 8 Q30 4 3 8 Z" fill="${KRAM}" ${LINE}/>` +
      `<path d="M3 19 Q30 23 57 19 L57 24 Q30 28 3 24 Z" fill="${KRAM}" ${LINE}/>` +
      `<path d="M26 4 L34 4 L34.5 21 L25.5 21 Z" fill="#F2E6CC" ${LINE}/>` +
      `<path d="M10 4.5 L13 6.5 M44 5 L47 3.5 M12 22 L15 20.5 M45 21 L48 23 M27 10 L33 12 M27 15 L33 17" fill="none" stroke="#D9C9A8" stroke-width="1.4" stroke-linecap="round"/>` +
      `<path d="M57 21 Q60 24 58 26" fill="none" stroke="${KRAM}" stroke-width="3" stroke-linecap="round"/>`,
  },
  "hw-spokmask": {
    viewBox: "0 0 60 26",
    par: "xMidYMid",
    art:
      `<path fill-rule="evenodd" d="M4 6 Q4 1 12 1 L48 1 Q56 1 56 6 L56 18 Q52 24 48 19 Q44 24 39 19 Q34.5 24 30 19 Q25.5 24 21 19 Q16 24 12 19 Q8 24 4 18 Z ` +
      `M11.5 12 a7.5 7.5 0 1 0 15 0 a7.5 7.5 0 1 0 -15 0 Z M33.5 12 a7.5 7.5 0 1 0 15 0 a7.5 7.5 0 1 0 -15 0 Z" fill="#F4F0FF" ${LINE}/>` +
      `<ellipse cx="30" cy="9" rx="2" ry="1.4" fill="${LILA}" stroke="none"/>` +
      `<circle cx="8" cy="9" r="1.6" fill="${ROSA}" stroke="none"/>` +
      `<circle cx="52" cy="9" r="1.6" fill="${ROSA}" stroke="none"/>`,
  },
  "hw-vampyrkrage": {
    viewBox: "0 0 48 42",
    par: "xMidYMin",
    art:
      `<path d="M10 24 Q24 31 38 24 L39 33 Q24 40 9 33 Z" fill="${NATT}" ${LINE}/>` +
      `<path d="${KRAGE_V}" fill="${NATT}" ${LINE}/>` +
      `<path d="${spegel(KRAGE_V, 48)}" fill="${NATT}" ${LINE}/>` +
      `<path d="${KRAGE_V_INRE}" fill="${LILA_MORK}" stroke="none"/>` +
      `<path d="${spegel(KRAGE_V_INRE, 48)}" fill="${LILA_MORK}" stroke="none"/>` +
      `<circle cx="24" cy="25" r="4.2" fill="${GUL}" ${LINE}/>` +
      `<circle cx="24" cy="25" r="2" fill="${LILA}" stroke="none"/>`,
  },
  "hw-haxstav": {
    viewBox: "0 0 44 62",
    par: "xMidYMax",
    art:
      `<path d="M20 24 L20 58" stroke="${MORK}" stroke-width="7" stroke-linecap="round"/>` +
      `<path d="M20 24 L20 58" stroke="${LILA_MORK}" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M17.8 30 L22.2 33 M17.8 37 L22.2 40 M17.8 44 L22.2 47" stroke="${GUL}" stroke-width="1.6" stroke-linecap="round"/>` +
      `<path d="M23 3 A11 11 0 1 0 31 21 A8.5 8.5 0 1 1 23 3 Z" fill="${GUL}" ${LINE}/>` +
      `<path d="M35 7 L35 13 M32 10 L38 10" fill="none" stroke="${PUMPA}" stroke-width="2.2" stroke-linecap="round"/>` +
      `<path d="M7 30 L7 36 M4 33 L10 33" fill="none" stroke="${GRON}" stroke-width="2.2" stroke-linecap="round"/>` +
      `<circle cx="33" cy="27" r="1.6" fill="${LILA}" stroke="none"/>`,
  },
  "hw-godispase": {
    viewBox: "0 0 36 62",
    par: "xMidYMax",
    art:
      `<path d="M10 35 Q18 21 26 35" fill="none" stroke="${MORK}" stroke-width="2.6" stroke-linecap="round"/>` +
      `<path d="M18 31 L18 19" stroke="#fff" stroke-width="2" stroke-linecap="round"/>` +
      `<circle cx="18" cy="17" r="5" fill="${ROSA}" ${THIN}/>` +
      `<path d="M15.5 16 Q18 13.5 20.5 16.5 Q18 19.5 16.5 17.5" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>` +
      `<circle cx="11.5" cy="31" r="4" fill="#7FC7E8" ${THIN}/>` +
      `<path d="M22 28.5 L28 32 L22 35.5 Z" fill="${GRON}" ${THIN}/>` +
      `<path d="M6 34 L30 34 L32 58 Q18 61 4 58 Z" fill="${PUMPA}" ${LINE}/>` +
      `<path d="M6 34 L30 34 L30.4 39 L5.6 39 Z" fill="${PUMPA_MORK}" ${THIN}/>` +
      gladMin(18, 47, 5, 4.5),
  },
  // Rygg-plaggen ritas BAKOM figuren (avatarMarkup) och hänger från axellinjen.
  // Vingarna behöver bredare box än manteln: anchor "vingar" (styles/08-avatar-klader.css).
  "hw-fladdervingar": {
    viewBox: "0 0 100 60",
    par: "xMidYMin",
    anchor: "vingar",
    art:
      `<path d="${VINGE_V}" fill="${MANTEL}" ${LINE}/>` +
      `<path d="${spegel(VINGE_V, 100)}" fill="${MANTEL}" ${LINE}/>` +
      `<path d="${VINGE_V_BEN} ${spegel(VINGE_V_BEN, 100)}" fill="none" stroke="#8A7FB0" stroke-width="1.8" stroke-linecap="round"/>`,
  },
  "hw-vampyrmantel": {
    viewBox: "0 0 52 44",
    par: "xMidYMin",
    art:
      `<path d="M6 9 Q26 5 46 9 L44 40 Q26 46 8 40 Z" fill="${NATT}" ${LINE}/>` +
      `<path d="M8.5 37 Q26 43 43.5 37 L43.8 40 Q26 46 8.2 40 Z" fill="${LILA_MORK}" stroke="none"/>` +
      `<path d="M16 12 L14 38 M26 10 L26 42 M36 12 L38 38" fill="none" stroke="${MANTEL}" stroke-width="1.6" stroke-linecap="round"/>` +
      `<path d="M10 12 Q3 7 2 1 Q12 2 20 8.5 Z" fill="${LILA_MORK}" ${LINE}/>` +
      `<path d="M42 12 Q49 7 50 1 Q40 2 32 8.5 Z" fill="${LILA_MORK}" ${LINE}/>`,
  },
};
