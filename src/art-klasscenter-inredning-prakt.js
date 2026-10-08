// ============================================================================
// Pluggporten – Klasscentrum-praktföremålen på golvet: guldstaty och pampig
// fontän (#487, epic #475 Klasscentret 2/4).
// ----------------------------------------------------------------------------
// Register-format: se index-modulen art-klasscenter-inredning.js. Golv-saker
// har kontaktskugga och står på botten av sin viewBox (som art-furniture).
// Ambient = bara CSS-klasser på ett fåtal grupper (anim() → "" med
// animera:false), aldrig SMIL eller id/defs (#374).
// ============================================================================

import {
  O, LINE, THIN, limb, shadow, anim, gnistra, glans, stjarnaKontur,
  GULD, GULD_MORK, GULD_LJUS, MARMOR, MARMOR_SKUGGA, MARMOR_ADER, VATTEN, VATTEN_LJUS,
} from "./art-klasscenter-delar.js";

// Ådring i marmor.
const ader = (d) => `<path d="${d}" fill="none" stroke="${MARMOR_ADER}" stroke-width="1.4" stroke-linecap="round" opacity="0.7"/>`;

export const KC_INREDNING_PRAKT = {
  // Guldstaty: en glad elevfigur i blankt guld som håller en stjärna mot
  // taket, med lagerkrans, på marmorpiedestal med mässingsskylt.
  "kc-guldstaty": {
    viewBox: "0 0 120 262",
    w: 5,
    rita: (opts) =>
      shadow(60, 255, 50) +
      // Piedestal.
      `<rect x="12" y="226" width="96" height="28" rx="4" fill="${MARMOR}" ${LINE}/>` +
      `<rect x="22" y="170" width="76" height="58" fill="${MARMOR}" ${LINE}/>` +
      `<rect x="78" y="172" width="18" height="54" fill="${MARMOR_SKUGGA}" stroke="none"/>` +
      `<rect x="22" y="170" width="76" height="58" fill="none" ${LINE}/>` +
      `<rect x="14" y="160" width="92" height="14" rx="4" fill="${MARMOR}" ${LINE}/>` +
      `<rect x="16" y="232" width="88" height="4" rx="2" fill="${GULD}" stroke="none"/>` +
      ader("M28 176 Q36 190 30 204 M86 232 Q76 240 84 250 M70 210 Q64 220 72 226") +
      `<rect x="38" y="186" width="44" height="22" rx="3" fill="${GULD}" ${LINE}/>` +
      `<path d="M46 194 L74 194 M50 200 L70 200" stroke="${GULD_MORK}" stroke-width="2" stroke-linecap="round"/>` +
      // Statyns fotplatta.
      `<ellipse cx="60" cy="160" rx="34" ry="6" fill="${GULD_MORK}" ${THIN}/>` +
      // Figuren (house-stil: stort huvud, liten kropp) i guld.
      `<ellipse cx="48" cy="154" rx="10" ry="5.5" fill="${GULD_MORK}" ${LINE}/>` +
      `<ellipse cx="72" cy="154" rx="10" ry="5.5" fill="${GULD_MORK}" ${LINE}/>` +
      `<path d="M40 104 C32 128 34 152 60 152 C86 152 88 128 80 104 Q60 96 40 104 Z" fill="${GULD}" ${LINE}/>` +
      `<path d="M64 102 Q80 104 82 120 Q86 146 64 152 Q76 132 64 102 Z" fill="${GULD_MORK}" opacity="0.45"/>` +
      `<ellipse cx="57" cy="128" rx="11" ry="12" fill="${GULD_LJUS}" opacity="0.6"/>` +
      limb("M42 110 Q28 120 38 134", GULD, 8) +
      limb("M78 108 Q94 86 92 48", GULD, 8) +
      `<circle cx="92" cy="44" r="6" fill="${GULD}" ${THIN}/>` +
      // Huvud med lagerkrans och slutna glada ögon.
      `<circle cx="60" cy="74" r="28" fill="${GULD}" ${LINE}/>` +
      `<path d="M70 50 Q92 62 84 88 Q78 100 62 102 Q84 84 70 50 Z" fill="${GULD_MORK}" opacity="0.4"/>` +
      `<path d="M47 73 Q51 67 55 73 M65 73 Q69 67 73 73" fill="none" ${LINE}/>` +
      `<path d="M53 83 Q60 90 67 83" fill="none" ${LINE}/>` +
      `<ellipse cx="44" cy="82" rx="4.3" ry="2.8" fill="${GULD_MORK}" opacity="0.6"/>` +
      `<ellipse cx="76" cy="82" rx="4.3" ry="2.8" fill="${GULD_MORK}" opacity="0.6"/>` +
      [[34, 60, -60], [40, 52, -40], [48, 47, -18], [86, 60, 60], [80, 52, 40], [72, 47, 18]]
        .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="6" ry="3" transform="rotate(${r} ${x} ${y})" fill="${GULD_MORK}" ${THIN}/>`).join("") +
      glans("M42 60 Q46 52 54 50", 2.6, 0.85) + glans("M46 110 Q42 122 44 132", 2, 0.6) +
      // Stjärnan.
      stjarnaKontur(92, 24, 18, GULD, LINE) +
      `<path d="M92 12 L95 21 L92 24 Z" fill="#FFFFFF" opacity="0.6"/>` +
      `<g${anim(opts, "kc-glitter")}>${gnistra(112, 14, 6)}</g>` +
      `<g${anim(opts, "kc-glitter d2")}>${gnistra(20, 96, 5)}</g>` +
      `<g${anim(opts, "kc-glitter d3")}>${gnistra(100, 128, 4.5)}</g>`,
  },

  // Pampig fontän: tre marmorskålar med guldband, guldknopp med vattenstråle
  // (.kc-vatten), forsande kaskader (.kc-kaskad), önskemynt i bassängen.
  "kc-fontan": {
    viewBox: "0 0 220 262",
    w: 8.6,
    rita: (opts) => {
      const kaskad = (d) =>
        `<path d="${d}" fill="none" stroke="${O}" stroke-width="7.4" stroke-linecap="round" opacity="0.85"/>` +
        `<path d="${d}" fill="none" stroke="${VATTEN}" stroke-width="4.6" stroke-linecap="round"/>` +
        `<path d="${d}" fill="none" stroke="${VATTEN_LJUS}" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="6 7"/>`;
      return (
        shadow(110, 255, 104) +
        // Stora bassängen.
        `<path d="M22 206 L198 206 L188 250 L32 250 Z" fill="${MARMOR}" ${LINE}/>` +
        `<path d="M160 206 L198 206 L188 250 L156 250 Z" fill="${MARMOR_SKUGGA}" stroke="none"/>` +
        `<path d="M22 206 L198 206 L188 250 L32 250 Z" fill="none" ${LINE}/>` +
        `<rect x="28" y="224" width="164" height="6" rx="3" fill="${GULD}" ${THIN}/>` +
        ader("M48 212 Q56 228 50 242 M132 236 Q142 244 136 250") +
        `<ellipse cx="110" cy="198" rx="94" ry="11" fill="${VATTEN}" ${LINE}/>` +
        `<path d="M40 196 Q110 188 180 196" fill="none" stroke="${VATTEN_LJUS}" stroke-width="2.4" stroke-linecap="round"/>` +
        [[62, 199], [146, 197], [90, 202]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="4" ry="1.8" fill="${GULD}" stroke="${GULD_MORK}" stroke-width="1"/>`).join("") +
        `<rect x="10" y="200" width="200" height="14" rx="7" fill="${MARMOR}" ${LINE}/>` +
        glans("M24 204 L196 204", 1.6, 0.8) +
        // Kaskader: översta → mellersta → bassängen.
        `<g${anim(opts, "kc-kaskad")}>` +
        kaskad("M54 124 Q36 140 34 196") + kaskad("M166 124 Q184 140 186 196") +
        kaskad("M78 76 Q62 88 60 118") + kaskad("M142 76 Q158 88 160 118") +
        `</g>` +
        // Pelare och mellersta skålen.
        `<rect x="96" y="128" width="28" height="74" fill="${MARMOR}" ${LINE}/>` +
        `<rect x="94" y="166" width="32" height="7" rx="3" fill="${GULD}" ${THIN}/>` +
        `<path d="M48 120 L172 120 Q164 152 110 156 Q56 152 48 120 Z" fill="${MARMOR}" ${LINE}/>` +
        `<path d="M138 122 L172 120 Q164 150 120 156 Q150 142 138 122 Z" fill="${MARMOR_SKUGGA}" stroke="none"/>` +
        `<path d="M56 134 Q110 146 164 134" fill="none" stroke="${GULD}" stroke-width="4" stroke-linecap="round"/>` +
        ader("M66 128 Q72 138 68 146") +
        `<ellipse cx="110" cy="120" rx="62" ry="8" fill="${VATTEN}" ${LINE}/>` +
        // Övre pelare och översta skålen.
        `<rect x="102" y="76" width="16" height="46" fill="${MARMOR}" ${LINE}/>` +
        `<path d="M72 74 L148 74 Q142 96 110 98 Q78 96 72 74 Z" fill="${MARMOR}" ${LINE}/>` +
        `<path d="M80 82 Q110 90 140 82" fill="none" stroke="${GULD}" stroke-width="3" stroke-linecap="round"/>` +
        `<ellipse cx="110" cy="74" rx="38" ry="6" fill="${VATTEN}" ${LINE}/>` +
        // Guldknopp med strålen.
        `<g${anim(opts, "kc-vatten")}>` +
        kaskad("M110 56 L110 14") +
        kaskad("M110 16 Q90 12 82 40") + kaskad("M110 16 Q130 12 138 40") +
        `</g>` +
        `<path d="M100 74 Q100 60 110 54 Q120 60 120 74 Z" fill="${GULD}" ${LINE}/>` +
        `<circle cx="110" cy="52" r="5" fill="${GULD}" ${THIN}/>` +
        glans("M104 70 Q104 62 108 58", 1.8) +
        stjarnaKontur(110, 140, 6, GULD) +
        `<g${anim(opts, "kc-glitter")}>${gnistra(82, 46, 4.5, VATTEN_LJUS)}</g>` +
        `<g${anim(opts, "kc-glitter d2")}>${gnistra(150, 112, 4.5, VATTEN_LJUS)}</g>` +
        `<g${anim(opts, "kc-glitter d3")}>${gnistra(30, 186, 4.5, GULD_LJUS)}</g>`
      );
    },
  },
};
