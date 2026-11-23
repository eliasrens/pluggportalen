// ============================================================================
// Pluggporten – Jul-samlingens TRÄDGÅRDS-saker (#910)
// ----------------------------------------------------------------------------
// Samma schema som art-garden.js: id → { viewBox, w (rem, ute-scenens bas-
// bredd), art, flat? }. Placeras ute runt huset (varld-tradgard.js) precis som
// övriga trädgårdssaker. Registreras via jul-konst.js. Id:na STABILA.
// Sakerna har egen snö där den hör till saken (snögubben, snölyktan) – den
// ritas året runt, som Halloweens pumpor.
// ============================================================================

import {
  O, LINE, THIN, limb, skugga, oga, glitter, glod, ljus, bock, paket,
  JULROD, JULROD_MORK, GRAN, GRAN_MORK, GRAN_LJUS, GULD, GULD_MORK, SKEN, SNOVIT, SNOSKUGGA, IS, IS_MORK,
  WOOD, WOOD_DARK,
} from "./jul-art-delar.js";

const BRUN = "#9C6A44";
const BRUN_LJUS = "#C08A5C";

// Snöboll med kontur och en ljus glans.
const snoboll = (cx, cy, r) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${SNOVIT}" ${LINE}/>` +
  `<path d="M${cx - r * 0.55} ${cy - r * 0.2} Q${cx - r * 0.35} ${cy - r * 0.62} ${cx + r * 0.1} ${cy - r * 0.68}" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`;

// Granruska (en kvist med barr) från (x,y) i vinkel rot, längd l.
const ruska = (x, y, rot, l, c = GRAN) =>
  `<g transform="translate(${x} ${y}) rotate(${rot})">` +
  `<path d="M0 0 Q${l * 0.5} -${l * 0.22} ${l} 0 Q${l * 0.5} ${l * 0.22} 0 0 Z" fill="${c}" ${THIN}/>` +
  `<path d="M2 0 L${l - 3} 0" stroke="${GRAN_MORK}" stroke-width="1.4"/></g>`;

// Talgboll i grönt nät som hänger i ett snöre från (x,y).
const talgboll = (x, y, l) =>
  `<path d="M${x} ${y} L${x} ${y + l}" stroke="${O}" stroke-width="1.4"/>` +
  `<circle cx="${x}" cy="${y + l + 6}" r="6.5" fill="#E8D3A8" ${THIN}/>` +
  `<circle cx="${x - 2.5}" cy="${y + l + 4}" r="1" fill="${WOOD_DARK}"/><circle cx="${x + 2}" cy="${y + l + 8}" r="1" fill="${WOOD_DARK}"/>` +
  `<circle cx="${x + 2.5}" cy="${y + l + 3.5}" r="0.9" fill="${WOOD_DARK}"/>` +
  `<path d="M${x - 6} ${y + l + 6} Q${x} ${y + l + 9} ${x + 6} ${y + l + 6}" fill="none" stroke="${GRAN_MORK}" stroke-width="1.2"/>`;

/** id → { viewBox, w, art, flat? } */
export const JUL_UTE = {
  // Snögubbe: tre snöbollar, hög hatt, röd halsduk, morotsnäsa och kvast.
  "jul-snogubbe": {
    viewBox: "0 0 84 120",
    w: 3.2,
    art:
      skugga(40, 116, 30) +
      limb("M66 112 L68 50", WOOD_DARK, 3.5) +
      `<path d="M60 52 Q68 30 76 52 Z" fill="#E8C25A" ${THIN}/>` +
      limb("M24 70 L8 58", WOOD_DARK, 3) +
      snoboll(40, 94, 22) + snoboll(40, 62, 16) + snoboll(40, 36, 13) +
      `<circle cx="40" cy="56" r="1.9" fill="${O}"/><circle cx="40" cy="66" r="1.9" fill="${O}"/>` +
      `<path d="M27 47 Q40 53 53 47 L53 52 Q40 58 27 52 Z" fill="${JULROD}" ${THIN}/>` +
      `<path d="M46 52 L50 66 L43 66 L41 53 Z" fill="${JULROD}" ${THIN}/>` +
      oga(35, 34, 1.9) + oga(45, 34, 1.9) +
      `<path d="M40 38 L52 40 L40 41.5 Z" fill="#F2A23A" ${THIN}/>` +
      `<path d="M35 44 Q40 46 45 44" fill="none" stroke="${O}" stroke-width="1.4" stroke-linecap="round"/>` +
      `<path d="M28 25 L52 25 M31 25 L32 8 L48 8 L49 25" fill="#46557A" ${LINE}/>` +
      `<path d="M32 21 L48 21" stroke="${JULROD}" stroke-width="3"/>`,
  },
  // Snölykta: pyramid av snöbollar med ett ljus som lyser inifrån.
  "jul-snolykta": {
    viewBox: "0 0 82 86",
    w: 3.2,
    art: (() => {
      let s = skugga(41, 82, 36) + glod(`<ellipse cx="41" cy="56" rx="30" ry="24" fill="${SKEN}" opacity="0.6"/>`);
      const rader = [[4, 72, 9], [3, 56, 9], [2, 40, 9], [1, 24, 9]];
      for (const [n, y, r] of rader) {
        for (let i = 0; i < n; i++) {
          const x = 41 + (i - (n - 1) / 2) * 18;
          s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${SNOVIT}" ${THIN}/>`;
        }
      }
      // Ljuset syns i glipan mellan bollarna.
      s += `<path d="M34 64 Q41 54 48 64 Q41 68 34 64 Z" fill="#F7B34C" ${THIN}/>` +
        `<ellipse cx="41" cy="61" rx="2" ry="3.4" fill="#fff" opacity="0.9"/>` +
        `<path d="M28 76 Q41 80 54 76" fill="none" stroke="${SNOSKUGGA}" stroke-width="2.4" stroke-linecap="round"/>`;
      return s;
    })(),
  },
  // Kälke: röd trä-kälke med böjda medar och ett rep.
  "jul-kalke": {
    viewBox: "0 0 104 58",
    w: 4,
    art:
      skugga(52, 54, 44) +
      `<path d="M8 48 L84 48 Q98 48 98 36 Q98 28 90 30" fill="none" stroke="${O}" stroke-width="7" stroke-linecap="round"/>` +
      `<path d="M8 48 L84 48 Q98 48 98 36 Q98 28 90 30" fill="none" stroke="${GULD_MORK}" stroke-width="3.5" stroke-linecap="round"/>` +
      limb("M22 46 L22 34 M50 46 L50 34 M76 46 L76 34", WOOD_DARK, 3.5) +
      `<rect x="10" y="24" width="76" height="12" rx="4" fill="${JULROD}" ${LINE}/>` +
      `<path d="M30 24 L30 36 M50 24 L50 36 M70 24 L70 36" stroke="${JULROD_MORK}" stroke-width="2"/>` +
      `<path d="M92 30 Q84 10 60 14 Q44 16 40 24" fill="none" stroke="${WOOD}" stroke-width="2.4" stroke-linecap="round"/>`,
  },
  // Granris med ljus: en hög granruskor med tre marschaller som lyser.
  "jul-granris": {
    viewBox: "0 0 104 66",
    w: 4.2,
    art:
      skugga(52, 62, 46) +
      glod(`<ellipse cx="52" cy="30" rx="46" ry="20" fill="${SKEN}" opacity="0.5"/>`) +
      ruska(8, 54, -10, 40, GRAN_MORK) + ruska(96, 54, 190, 40, GRAN_MORK) + ruska(30, 58, -30, 36) + ruska(74, 58, 210, 36) +
      `<path d="M16 60 Q52 40 88 60 Z" fill="${GRAN}" ${LINE}/>` +
      ruska(20, 58, -50, 30, GRAN_LJUS) + ruska(84, 58, 230, 30, GRAN_LJUS) +
      `<rect x="25" y="34" width="12" height="18" rx="2" fill="${BRUN_LJUS}" ${THIN}/>` + ljus(31, 34, 2, "#F7B34C") +
      `<rect x="46" y="28" width="12" height="22" rx="2" fill="${BRUN_LJUS}" ${THIN}/>` + ljus(52, 28, 2, "#F7B34C") +
      `<rect x="67" y="34" width="12" height="18" rx="2" fill="${BRUN_LJUS}" ${THIN}/>` + ljus(73, 34, 2, "#F7B34C") +
      `<circle cx="40" cy="56" r="2.6" fill="${JULROD}" ${THIN}/><circle cx="62" cy="57" r="2.6" fill="${JULROD}" ${THIN}/>`,
  },
  // Stor julbock: halmbocken i stort format (som utanför stora köpcentret).
  "jul-stor-julbock": {
    viewBox: "0 0 112 120",
    w: 4.4,
    art: skugga(52, 116, 42) + bock(48, 116, 2.05),
  },
  // Släde med ren: en glad ren med röd mule drar en röd släde med paket.
  "jul-slade": {
    viewBox: "0 0 188 104",
    w: 7,
    art:
      skugga(96, 100, 86) +
      // Släden (till höger).
      `<path d="M98 94 L176 94 Q186 94 186 84" fill="none" stroke="${O}" stroke-width="6" stroke-linecap="round"/>` +
      `<path d="M98 94 L176 94 Q186 94 186 84" fill="none" stroke="${GULD}" stroke-width="3" stroke-linecap="round"/>` +
      limb("M116 92 L116 82 M162 92 L162 82", GULD_MORK, 3) +
      paket(118, 58, 18, 16, GRAN, GULD) + paket(138, 60, 20, 22, "#7FC7E8", JULROD) + paket(158, 58, 14, 12, GULD, JULROD) +
      `<path d="M104 56 L176 56 Q182 56 182 64 L180 84 L110 84 Q102 84 100 76 Q98 64 104 56 Z" fill="${JULROD}" ${LINE}/>` +
      `<path d="M108 62 Q140 68 176 62" fill="none" stroke="${GULD}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M100 74 Q86 70 78 64" fill="none" stroke="${WOOD_DARK}" stroke-width="2.4"/>` +
      // Renen (till vänster, tittar åt vänster).
      limb("M44 72 L40 96 M54 74 L54 96 M70 74 L72 96 M80 72 L84 96", BRUN, 4) +
      `<path d="M40 50 Q38 76 60 78 Q84 78 86 58 Q86 46 70 46 L50 46 Q40 46 40 50 Z" fill="${BRUN_LJUS}" ${LINE}/>` +
      `<path d="M84 52 Q92 48 92 42" fill="none" stroke="${BRUN}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M50 60 Q62 66 78 60" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.5"/>` +
      `<path d="M42 54 Q54 62 68 54" fill="none" stroke="${JULROD}" stroke-width="5" stroke-linecap="round"/>` +
      `<circle cx="50" cy="60" r="3" fill="${GULD}" ${THIN}/><circle cx="60" cy="61" r="3" fill="${GULD}" ${THIN}/>` +
      limb("M44 50 L32 34", BRUN_LJUS, 9) +
      `<path d="M26 20 Q18 8 22 2 M24 14 L14 10 M34 20 Q38 6 46 4 M38 12 L46 14" fill="none" stroke="${WOOD_DARK}" stroke-width="3.2" stroke-linecap="round"/>` +
      `<ellipse cx="26" cy="30" rx="13" ry="10" fill="${BRUN_LJUS}" ${LINE}/>` +
      `<path d="M36 22 Q44 18 42 26 Z" fill="${BRUN_LJUS}" ${THIN}/>` +
      `<circle cx="14" cy="33" r="4.6" fill="${JULROD}" ${THIN}/><circle cx="12.6" cy="31.6" r="1.4" fill="#fff" opacity="0.8"/>` +
      oga(26, 27, 1.9) + `<ellipse cx="22" cy="35" rx="2.4" ry="1.4" fill="#FFB1B8"/>`,
  },
  // Fågelbord med talgbollar: litet fågelbord med tak på en stolpe, en domherre äter.
  "jul-fagelbord": {
    viewBox: "0 0 80 124",
    w: 3,
    art:
      skugga(40, 120, 20) +
      limb("M40 120 L40 62", WOOD, 6) +
      `<path d="M28 120 Q40 110 52 120 Z" fill="${WOOD_DARK}" ${LINE}/>` +
      `<rect x="12" y="56" width="56" height="8" rx="2" fill="${WOOD}" ${LINE}/>` +
      limb("M18 56 L18 30 M62 56 L62 30", WOOD_DARK, 3) +
      `<path d="M4 32 L40 8 L76 32 Z" fill="${JULROD}" ${LINE}/>` +
      `<path d="M14 28 L40 12 L66 28" fill="none" stroke="${JULROD_MORK}" stroke-width="2" opacity="0.7"/>` +
      talgboll(14, 33, 22) + talgboll(66, 33, 30) +
      `<circle cx="30" cy="54" r="1.6" fill="${GULD_MORK}"/><circle cx="34" cy="55" r="1.6" fill="${GULD_MORK}"/><circle cx="50" cy="54" r="1.6" fill="${GULD_MORK}"/>` +
      // Domherren: grå rygg, röd mage, svart mössa.
      `<path d="M54 52 L62 50 L58 54 Z" fill="#46557A" ${THIN}/>` +
      `<ellipse cx="44" cy="47" rx="10" ry="8" fill="#9AA3B5" ${THIN}/>` +
      `<path d="M36 46 Q38 56 48 54 Q42 50 36 46 Z" fill="#E86A4E" ${THIN}/>` +
      `<circle cx="36" cy="42" r="6" fill="#9AA3B5" ${THIN}/>` +
      `<path d="M31 41 Q32 35 38 36 Q40 38 40 40 Z" fill="${O}"/>` +
      `<path d="M30 43 L26 44 L30 45 Z" fill="${O}"/>` +
      `<path d="M31 44 Q33 48 37 47" fill="#E86A4E" stroke="none"/>` +
      oga(34, 41.5, 1.3),
  },
  // Isskulptur som glittrar: en stor isstjärna på ett isblock som glimmar.
  "jul-isskulptur": {
    viewBox: "0 0 84 116",
    w: 3.4,
    art:
      skugga(42, 112, 32) +
      glod(`<circle cx="42" cy="42" r="38" fill="${IS}" opacity="0.6"/>`) +
      `<path d="M14 112 L18 82 L66 82 L70 112 Z" fill="${IS}" ${LINE}/>` +
      `<path d="M22 88 L24 106 M56 88 L58 106" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity="0.8"/>` +
      `<path d="M36 82 L38 68 L46 68 L48 82 Z" fill="${IS_MORK}" ${THIN}/>` +
      `<path d="M42 8 L50 30 L74 30 L55 44 L62 68 L42 54 L22 68 L29 44 L10 30 L34 30 Z" fill="#DDF1FB" ${LINE}/>` +
      `<path d="M42 18 L46 32 L60 32 L49 40 L53 54 L42 46 L31 54 L35 40 L24 32 L38 32 Z" fill="${IS}" stroke="none"/>` +
      `<path d="M30 30 L36 20" stroke="#fff" stroke-width="3" stroke-linecap="round"/>` +
      glod(glitter(20, 18, 4, "#fff") + glitter(66, 14, 3.4, "#fff") + glitter(70, 60, 3, "#fff") + glitter(16, 74, 3, "#fff") + glitter(54, 96, 2.6, "#fff")),
  },
};
