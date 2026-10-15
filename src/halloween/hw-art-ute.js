// ============================================================================
// Pluggporten – Halloween-samlingens TRÄDGÅRDS-saker (#692)
// ----------------------------------------------------------------------------
// Samma schema som art-garden.js: id → { viewBox, w (rem, ute-scenens bas-
// bredd), art, flat? }. Placeras ute runt huset (varld-tradgard.js) precis som
// övriga trädgårdssaker. Registreras via hw-konst.js. Id:na STABILA.
// ============================================================================

import {
  O, LINE, THIN, limb, PUMPA, LILA, LILA_MORK, NATT, SKEN, GUL, GRON_MORK, KRAM, WOOD, WOOD_DARK,
  skugga, anim, oga, pumpa, spoke, glitter,
} from "./hw-art-delar.js";

const HO = "#E8C25A"; // halm
const HO_MORK = "#C99A33";

// Ett höstlöv (droppform) i (x,y), vinkel rot, färg c.
const lov = (x, y, rot, c) =>
  `<g transform="translate(${x} ${y}) rotate(${rot})">` +
  `<path d="M0 -9 Q7 -4 6 2 Q4 8 0 10 Q-4 8 -6 2 Q-7 -4 0 -9 Z" fill="${c}" ${THIN}/>` +
  `<path d="M0 -7 L0 9" stroke="${O}" stroke-width="1.2" opacity="0.5"/></g>`;

// Lysande svamp: fot + rund hatt med prickar, glöd bakom.
const svamp = (x, y, r, hatt, prick) =>
  anim("hw-glod", `<ellipse cx="${x}" cy="${y - r * 1.4}" rx="${r * 1.5}" ry="${r * 1.1}" fill="${hatt}" opacity="0.35"/>`) +
  `<path d="M${x - r * 0.35} ${y} Q${x - r * 0.45} ${y - r} ${x - r * 0.25} ${y - r * 1.25} L${x + r * 0.25} ${y - r * 1.25} Q${x + r * 0.45} ${y - r} ${x + r * 0.35} ${y} Z" fill="${KRAM}" ${LINE}/>` +
  `<path d="M${x - r} ${y - r * 1.2} Q${x - r} ${y - r * 2.3} ${x} ${y - r * 2.3} Q${x + r} ${y - r * 2.3} ${x + r} ${y - r * 1.2} Z" fill="${hatt}" ${LINE}/>` +
  `<circle cx="${x - r * 0.45}" cy="${y - r * 1.65}" r="${r * 0.16}" fill="${prick}"/>` +
  `<circle cx="${x + r * 0.35}" cy="${y - r * 1.85}" r="${r * 0.2}" fill="${prick}"/>` +
  `<circle cx="${x + r * 0.05}" cy="${y - r * 1.4}" r="${r * 0.12}" fill="${prick}"/>` +
  oga(x - r * 0.15, y - r * 0.75, r * 0.1) + oga(x + r * 0.15, y - r * 0.75, r * 0.1);

/** id → { viewBox, w, art, flat? } */
export const HW_UTE = {
  // Pumpahög: fyra pumpor i olika storlek, en med glatt ansikte.
  "hw-pumpahog": {
    viewBox: "0 0 112 80",
    w: 4.4,
    art:
      skugga(56, 76, 46) +
      pumpa(30, 58, 20) + pumpa(84, 60, 18) + pumpa(58, 62, 22) + pumpa(57, 30, 16, "glad"),
  },
  // Lövhög: rund hög av orange, röda och gula löv.
  "hw-lovhog": {
    viewBox: "0 0 112 60",
    w: 4.4,
    art:
      skugga(56, 56, 48) +
      `<path d="M8 54 Q14 24 40 20 Q56 8 74 20 Q100 24 104 54 Z" fill="#E9883A" ${LINE}/>` +
      lov(26, 40, -30, "#EF6F6C") + lov(44, 30, 20, GUL) + lov(62, 22, -10, PUMPA) + lov(80, 34, 40, "#EF6F6C") +
      lov(36, 48, 60, GUL) + lov(58, 44, -50, "#D9572F") + lov(90, 48, 10, GUL) + lov(70, 46, 80, PUMPA) +
      lov(16, 54, -80, PUMPA) + lov(100, 56, 70, "#D9572F"),
  },
  // Buu!-skylt: träskylt på stolpe med ett litet spöke som tittar fram.
  "hw-buu-skylt": {
    viewBox: "0 -12 92 112",
    text: true, // texten "Buu!" → ingen ↔ Vänd (#699)
    w: 3.6,
    art:
      skugga(46, 96, 24) +
      limb("M46 96 L46 50", WOOD_DARK, 7) +
      spoke(66, 8, 1.05, "#fff") +
      `<path d="M10 22 L80 18 L84 52 L12 56 Z" fill="${WOOD}" ${LINE}/>` +
      `<path d="M14 34 L80 31 M14 46 L82 43" stroke="${WOOD_DARK}" stroke-width="2" opacity="0.5"/>` +
      `<text x="47" y="46" text-anchor="middle" font-family="'Baloo 2', system-ui, sans-serif" font-weight="800" ` +
      `font-size="22" fill="${LILA_MORK}" stroke="#fff" stroke-width="1" paint-order="stroke" transform="rotate(-3 47 38)">Buu!</text>` +
      `<circle cx="16" cy="26" r="2" fill="${WOOD_DARK}"/><circle cx="78" cy="50" r="2" fill="${WOOD_DARK}"/>`,
  },
  // Halmbal med pumpor: halmbal med strån och två pumpor ovanpå.
  "hw-halmbal": {
    viewBox: "0 0 104 86",
    w: 4.2,
    art:
      skugga(52, 82, 44) +
      `<rect x="8" y="46" width="88" height="34" rx="6" fill="${HO}" ${LINE}/>` +
      `<path d="M14 54 L90 54 M14 64 L90 64 M14 73 L90 73" stroke="${HO_MORK}" stroke-width="2.2" stroke-linecap="round" opacity="0.8"/>` +
      `<path d="M30 46 L30 80 M74 46 L74 80" stroke="${WOOD_DARK}" stroke-width="3"/>` +
      `<path d="M8 60 L2 58 M8 70 L1 72 M96 58 L102 55 M96 70 L103 72" stroke="${HO_MORK}" stroke-width="2" stroke-linecap="round"/>` +
      pumpa(34, 34, 16, "glad") + pumpa(70, 38, 12),
  },
  // Häxhattsbrevlåda: lila brevlåda med en häxhatt som tak, på trästolpe.
  "hw-haxbrevlada": {
    viewBox: "0 0 76 112",
    w: 3,
    art:
      skugga(38, 108, 20) +
      limb("M38 108 L38 60", WOOD, 6) +
      `<path d="M12 62 L12 46 Q12 36 38 36 Q64 36 64 46 L64 62 Z" fill="${LILA}" ${LINE}/>` +
      `<path d="M18 46 L58 46" stroke="${LILA_MORK}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M4 38 Q38 28 72 38 Q60 44 38 42 Q16 44 4 38 Z" fill="${NATT}" ${LINE}/>` +
      `<path d="M22 37 L38 6 Q44 4 46 12 L52 36 Z" fill="${NATT}" ${LINE}/>` +
      `<path d="M23 34 Q38 30 51 34 L52 38 Q38 34 22 38 Z" fill="${PUMPA}" ${THIN}/>` +
      limb("M64 50 L70 50 L70 40", "#EF6F6C", 2.5) +
      `<path d="M70 40 L78 42 L70 46 Z" fill="#EF6F6C" ${THIN}/>` +
      glitter(44, 18, 3, GUL),
  },
  // Fågelskrämma: snäll säckhuvudsfigur med halmhatt och en glad liten kråka.
  "hw-fagelskramma": {
    viewBox: "0 0 104 144",
    w: 4.6,
    art:
      skugga(52, 140, 26) +
      limb("M52 140 L52 50", WOOD_DARK, 6) +
      limb("M12 72 L92 72", WOOD_DARK, 5) +
      `<path d="M30 66 L74 66 L80 108 Q52 114 24 108 Z" fill="#7FC7E8" ${LINE}/>` +
      `<rect x="56" y="84" width="12" height="12" rx="2" fill="${PUMPA}" ${THIN}/>` +
      `<path d="M30 66 L12 70 L12 80 L30 78 Z M74 66 L92 70 L92 80 L74 78 Z" fill="#7FC7E8" ${LINE}/>` +
      `<path d="M10 78 L4 84 M12 80 L10 88 M94 78 L100 84 M92 80 L94 88 M30 110 L28 118 M52 112 L52 120 M74 110 L76 118" stroke="${HO_MORK}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<circle cx="52" cy="46" r="18" fill="#E8D3A8" ${LINE}/>` +
      `<path d="M44 40 L48 44 M48 40 L44 44 M56 40 L60 44 M60 40 L56 44" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M44 52 Q52 58 60 52" fill="none" ${THIN}/><path d="M47 53 L47 56 M52 54.5 L52 57.5 M57 53 L57 56" stroke="${O}" stroke-width="1.6"/>` +
      `<ellipse cx="40" cy="50" rx="3" ry="1.8" fill="#FFB1B8" opacity="0.85"/><ellipse cx="64" cy="50" rx="3" ry="1.8" fill="#FFB1B8" opacity="0.85"/>` +
      `<path d="M26 34 Q52 26 78 34 Q66 38 52 36 Q38 38 26 34 Z" fill="${HO}" ${LINE}/>` +
      `<path d="M38 33 Q40 14 52 14 Q64 14 66 33 Z" fill="${HO}" ${LINE}/>` +
      `<path d="M38 28 Q52 24 66 28" fill="none" stroke="#EF6F6C" stroke-width="4"/>` +
      // Kråkan på armen (rund och glad).
      `<ellipse cx="84" cy="62" rx="8" ry="7" fill="${NATT}" ${THIN}/>` +
      `<path d="M90 60 L97 62 L90 64 Z" fill="${GUL}" ${THIN}/>` +
      oga(86, 59, 1.8) + `<path d="M76 62 L72 58" stroke="${NATT}" stroke-width="3" stroke-linecap="round"/>`,
  },
  // Lyktstolpe med pumpa: svart stolpe vars lykta är en lysande pumpa.
  "hw-pumpastolpe": {
    viewBox: "0 0 64 152",
    w: 2.8,
    art:
      skugga(32, 148, 18) +
      anim("hw-glod", `<circle cx="32" cy="34" r="30" fill="${SKEN}" opacity="0.45"/>`) +
      limb("M32 146 L32 50", NATT, 6) +
      `<path d="M20 148 Q32 136 44 148 Z" fill="${NATT}" ${LINE}/>` +
      `<path d="M32 86 Q42 86 46 94" fill="none" stroke="${NATT}" stroke-width="3" stroke-linecap="round"/>` +
      `<rect x="22" y="50" width="20" height="6" rx="3" fill="${NATT}" ${THIN}/>` +
      pumpa(32, 34, 20, "lykta") +
      `<path d="M10 14 Q32 2 54 14" fill="none" stroke="${NATT}" stroke-width="3" stroke-linecap="round"/>`,
  },
  // Lysande svampar: tre stora svampar i lila, mint och orange som glöder.
  "hw-lysvampar": {
    viewBox: "0 0 112 96",
    w: 4.6,
    art:
      skugga(56, 92, 46) +
      svamp(30, 90, 15, "#58C6A9", "#C9F0DC") +
      svamp(82, 90, 13, PUMPA, SKEN) +
      svamp(56, 90, 22, LILA, "#F4F0FB") +
      `<path d="M10 90 Q14 82 18 90 M96 90 Q100 84 104 90" fill="none" stroke="${GRON_MORK}" stroke-width="2.4" stroke-linecap="round"/>` +
      anim("hw-glimt", glitter(18, 40, 2.6, SKEN) + glitter(96, 46, 2.4, "#C9F0DC") + glitter(70, 24, 2.2, "#fff")),
  },
};
