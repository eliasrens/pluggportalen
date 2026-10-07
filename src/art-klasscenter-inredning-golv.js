// ============================================================================
// Pluggporten – Klasscentrum-föremål på golvet: lounge-soffa, akvarium och
// flygel (#487, epic #475 Klasscentret 2/4). Statyn + fontänen ligger i
// art-klasscenter-inredning-prakt.js.
// ----------------------------------------------------------------------------
// Register-format: se index-modulen art-klasscenter-inredning.js. Varje golv-
// sak har kontaktskugga och står på botten av sin viewBox (som art-furniture).
// Ambient = bara CSS-klasser på ett fåtal grupper (anim() → "" med
// animera:false), aldrig SMIL eller id/defs (#374).
// ============================================================================

import {
  O, LINE, THIN, limb, shadow, anim, gnistra, glans, stjarnaKontur,
  GULD, GULD_MORK, GULD_LJUS, KRAM, WOOD, WOOD_DARK, STONE, STONE_DARK,
  SAMMET, SAMMET_MORK, SAMMET_LJUS, VATTEN, VATTEN_LJUS,
} from "./art-klasscenter-delar.js";

const LACK = "#FBF8FF";
const LACK_SKUGGA = "#E3DCEE";
const SAND = "#F2D9A0";
const SJOGRAS = "#58C6A9";
const KORALL = "#F890B7";

// Tecknad fisk som simmar åt höger, nos i (x, y).
const fisk = (x, y, s, kropp, fena) =>
  `<g transform="translate(${x} ${y}) scale(${s})">` +
  `<path d="M-22 0 L-32 -8 L-30 0 L-32 8 Z" fill="${fena}" ${THIN}/>` +
  `<ellipse cx="-11" cy="0" rx="13" ry="8.5" fill="${kropp}" ${THIN}/>` +
  `<path d="M-14 -8 Q-10 -14 -4 -7" fill="${fena}" ${THIN}/>` +
  `<path d="M-15 -6 Q-12 0 -15 6" fill="none" stroke="${O}" stroke-width="1.4" opacity="0.5"/>` +
  `<circle cx="-4" cy="-2" r="2.2" fill="#fff" stroke="${O}" stroke-width="1.2"/><circle cx="-3.6" cy="-1.8" r="1" fill="${O}"/>` +
  `</g>`;

export const KC_INREDNING_GOLV = {
  // Stor lounge-soffa: chesterfield i kunglig sammet med knapptufsning,
  // rullade armstöd, guldnitar, guldfötter och en krönt medaljong.
  "kc-lounge": {
    viewBox: "0 0 260 150",
    w: 10.5,
    rita: (opts) => {
      let knappar = "";
      for (const [y, x0] of [[46, 52], [60, 63]])
        for (let x = x0; x <= 210; x += 22) knappar += `<circle cx="${x}" cy="${y}" r="2.3" fill="${SAMMET_MORK}" stroke="none"/>`;
      let nitar = "";
      for (let x = 40; x <= 220; x += 9) nitar += `<circle cx="${x}" cy="120" r="1.7" fill="${GULD_MORK}" stroke="none"/>`;
      const arm = (x, sida) =>
        `<rect x="${x}" y="60" width="40" height="64" rx="14" fill="${SAMMET}" ${LINE}/>` +
        `<ellipse cx="${x + 20}" cy="64" rx="22" ry="12" fill="${SAMMET_LJUS}" ${LINE}/>` +
        `<circle cx="${x + 20 - sida * 10}" cy="64" r="6" fill="none" stroke="${SAMMET_MORK}" stroke-width="2.2"/>` +
        `<circle cx="${x + 20 - sida * 10}" cy="64" r="2.2" fill="${GULD}" stroke="none"/>`;
      return (
        shadow(130, 142, 120) +
        [28, 92, 168, 232].map((x) => `<path d="M${x - 7} 126 L${x + 7} 126 L${x + 4} 140 L${x - 4} 140 Z" fill="${GULD}" ${THIN}/>`).join("") +
        // Rygg (kamelrygg) med tufsning.
        `<path d="M24 76 Q20 26 72 28 Q130 8 188 28 Q240 26 236 76 Z" fill="${SAMMET}" ${LINE}/>` +
        `<path d="M46 36 Q130 18 214 36" fill="none" stroke="${SAMMET_LJUS}" stroke-width="3" stroke-linecap="round" opacity="0.8"/>` +
        knappar +
        `<path d="M52 46 L63 60 L74 46 L85 60 L96 46 L107 60 L118 46 L129 60 L140 46 L151 60 L162 46 L173 60 L184 46 L195 60 L206 46" fill="none" stroke="${SAMMET_MORK}" stroke-width="1.4" opacity="0.55"/>` +
        // Krönt medaljong på ryggen.
        `<ellipse cx="130" cy="20" rx="14" ry="11" fill="${GULD}" ${LINE}/>` +
        stjarnaKontur(130, 21, 6.5, KRAM) +
        `<path d="M120 10 L118 2 L124 6 L130 0 L136 6 L142 2 L140 10 Z" fill="${GULD}" ${THIN}/>` +
        // Sits och dynor.
        `<rect x="34" y="86" width="192" height="36" rx="10" fill="${SAMMET}" ${LINE}/>` +
        [40, 101, 162].map((x) => `<rect x="${x}" y="76" width="58" height="26" rx="10" fill="${SAMMET_LJUS}" ${LINE}/>` +
          `<path d="M${x + 8} 84 Q${x + 29} 80 ${x + 50} 84" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity="0.45"/>`).join("") +
        arm(4, -1) + arm(216, 1) +
        // Guldlist med nitar.
        `<rect x="30" y="114" width="200" height="12" rx="5" fill="${GULD}" ${LINE}/>` +
        nitar + glans("M40 117 L220 117", 1.4, 0.55) +
        // Prydnadskuddar.
        `<rect x="44" y="56" width="30" height="26" rx="8" transform="rotate(-12 59 69)" fill="${GULD}" ${LINE}/>` +
        `<rect x="186" y="56" width="30" height="26" rx="8" transform="rotate(12 201 69)" fill="${KRAM}" ${LINE}/>` +
        stjarnaKontur(201, 69, 6, GULD) +
        `<circle cx="59" cy="69" r="4.5" fill="none" stroke="${GULD_MORK}" stroke-width="2"/>` +
        `<g${anim(opts, "kc-glitter")}>${gnistra(146, 12, 5)}</g>` +
        `<g${anim(opts, "kc-glitter d2")}>${gnistra(30, 52, 4)}</g>`
      );
    },
  },

  // Akvarium: förgyllt skåp, sjögräs, korall, minislott, skattkista med guld,
  // tre fiskar som simmar (.kc-fisk) och bubblor (.kc-bubbla).
  "kc-akvarium": {
    viewBox: "0 0 200 200",
    w: 7.8,
    rita: (opts) =>
      shadow(100, 194, 88) +
      // Skåp med guldramade luckor och lejontassar.
      [32, 168].map((x) => `<ellipse cx="${x}" cy="188" rx="9" ry="5" fill="${GULD}" ${THIN}/>`).join("") +
      `<rect x="22" y="132" width="156" height="56" rx="6" fill="${WOOD_DARK}" ${LINE}/>` +
      `<rect x="32" y="142" width="62" height="38" rx="4" fill="${WOOD}" stroke="${GULD}" stroke-width="2.6"/>` +
      `<rect x="106" y="142" width="62" height="38" rx="4" fill="${WOOD}" stroke="${GULD}" stroke-width="2.6"/>` +
      `<circle cx="88" cy="161" r="2.6" fill="${GULD}" ${THIN}/><circle cx="112" cy="161" r="2.6" fill="${GULD}" ${THIN}/>` +
      // Vatten, sand och växter.
      `<rect x="14" y="30" width="172" height="106" rx="8" fill="${VATTEN}" stroke="none"/>` +
      `<rect x="18" y="36" width="164" height="7" rx="3" fill="${VATTEN_LJUS}" stroke="none"/>` +
      `<path d="M14 122 Q58 110 100 118 Q142 126 186 114 L186 136 L14 136 Z" fill="${SAND}" stroke="none"/>` +
      limb("M34 126 Q26 110 36 96 Q46 84 36 70", SJOGRAS, 4) +
      limb("M44 126 Q50 112 44 100", SJOGRAS, 3.4) +
      limb("M170 122 Q178 104 168 90 Q160 78 170 64", SJOGRAS, 4) +
      `<path d="M146 122 L146 104 M146 112 L138 100 M146 108 L154 96 M138 100 L136 92 M154 96 L158 90" fill="none" stroke="${O}" stroke-width="7" stroke-linecap="round"/>` +
      `<path d="M146 122 L146 104 M146 112 L138 100 M146 108 L154 96 M138 100 L136 92 M154 96 L158 90" fill="none" stroke="${KORALL}" stroke-width="3.6" stroke-linecap="round"/>` +
      // Minislott.
      `<rect x="58" y="96" width="30" height="28" fill="${STONE}" ${THIN}/>` +
      `<rect x="54" y="82" width="12" height="42" fill="${STONE}" ${THIN}/><rect x="80" y="82" width="12" height="42" fill="${STONE}" ${THIN}/>` +
      `<path d="M54 82 L60 72 L66 82 Z M80 82 L86 72 L92 82 Z" fill="#EF6F6C" ${THIN}/>` +
      `<path d="M67 124 L67 112 Q73 104 79 112 L79 124 Z" fill="${STONE_DARK}" ${THIN}/>` +
      // Skattkista med guld.
      `<rect x="108" y="108" width="26" height="16" rx="2" fill="${WOOD}" ${THIN}/>` +
      `<path d="M108 108 L112 98 L130 98 L134 108 Z" fill="${WOOD_DARK}" ${THIN}/>` +
      `<ellipse cx="121" cy="107" rx="10" ry="3.4" fill="${GULD}" ${THIN}/>` +
      `<rect x="119" y="112" width="4" height="5" rx="1" fill="${GULD}" stroke="none"/>` +
      `<g${anim(opts, "kc-glitter")}>${gnistra(128, 100, 4.5)}</g>` +
      // Fiskar och bubblor.
      `<g${anim(opts, "kc-fisk")}>${fisk(74, 62, 1, "#F49E4C", "#F08A3C")}</g>` +
      `<g${anim(opts, "kc-fisk d2")}>${fisk(146, 56, 0.85, GULD, "#46557A")}</g>` +
      `<g${anim(opts, "kc-fisk d3")}>${fisk(118, 86, 0.7, "#EF6F6C", KRAM)}</g>` +
      `<g${anim(opts, "kc-bubbla")}>` +
      [[36, 60, 3], [40, 50, 2.2], [35, 42, 1.6]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#FFFFFF" stroke-width="1.6"/>`).join("") +
      `</g><g${anim(opts, "kc-bubbla d2")}>` +
      [[160, 70, 2.6], [164, 60, 1.8]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#FFFFFF" stroke-width="1.6"/>`).join("") +
      `</g>` +
      // Glasreflex + ram med guldhörn.
      `<path d="M28 116 L60 40 M38 118 L66 52" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.3"/>` +
      `<rect x="14" y="30" width="172" height="106" rx="8" fill="none" ${LINE}/>` +
      [[14, 30], [186, 30], [14, 136], [186, 136]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="${GULD}" ${THIN}/>`).join("") +
      // Lock med guldlist och krönt medaljong.
      `<rect x="8" y="18" width="184" height="15" rx="5" fill="${WOOD}" ${LINE}/>` +
      `<rect x="16" y="26" width="168" height="2.6" rx="1.3" fill="${GULD}" stroke="none"/>` +
      `<path d="M86 18 Q86 4 100 4 Q114 4 114 18 Z" fill="${GULD}" ${LINE}/>` +
      `<circle cx="100" cy="12" r="3.4" fill="${VATTEN}" ${THIN}/>`,
  },

  // Flygel: vitlackerad konsertflygel med guldlist, uppfällt lock med
  // guldinsida, guldben med hjul, pedallyra och noter som svävar (.kc-svava).
  "kc-flygel": {
    viewBox: "0 0 240 210",
    w: 9.6,
    rita: (opts) => {
      let tangenter = "";
      for (let x = 12; x < 58; x += 6) tangenter += `M${x} 96 L${x} 106 `;
      let svarta = "";
      for (const x of [14, 20, 32, 38, 44]) svarta += `<rect x="${x + 0.6}" y="96" width="3.4" height="6" rx="0.8" fill="${O}" stroke="none"/>`;
      const ben = (x) =>
        limb(`M${x} 134 Q${x - 4} 160 ${x} 188`, GULD, 7) +
        `<ellipse cx="${x}" cy="150" rx="7" ry="4" fill="${GULD_MORK}" ${THIN}/>` +
        `<circle cx="${x}" cy="194" r="5" fill="${GULD_MORK}" ${THIN}/>`;
      return (
        shadow(124, 200, 110) +
        ben(34) + ben(206) +
        // Pedallyra.
        `<path d="M110 134 Q100 160 108 182 L122 182 Q130 160 120 134 Z" fill="${GULD}" ${THIN}/>` +
        `<path d="M112 142 L112 176 M115 140 L115 178 M118 142 L118 176" stroke="${GULD_MORK}" stroke-width="1.4"/>` +
        `<rect x="102" y="182" width="26" height="6" rx="2" fill="${GULD_MORK}" ${THIN}/>` +
        // Uppfällt lock (insidan guld) + lockstötta.
        `<path d="M62 94 L226 94 Q236 56 196 34 Q150 12 84 24 Z" fill="${LACK}" ${LINE}/>` +
        `<path d="M74 88 L214 88 Q222 60 190 42 Q150 22 92 30 Z" fill="${GULD_LJUS}" stroke="${GULD}" stroke-width="2.4"/>` +
        limb("M160 96 L150 44", GULD_MORK, 2.4) +
        glans("M98 32 Q150 22 192 40", 2.2, 0.8) +
        // Notställ med notblad.
        `<path d="M40 92 L50 64 L92 64 L82 92 Z" fill="${GULD}" ${THIN}/>` +
        `<path d="M48 88 L56 68 L84 68 L76 88 Z" fill="${KRAM}" ${THIN}/>` +
        `<path d="M56 74 L80 74 M54 80 L78 80" stroke="${O}" stroke-width="1" opacity="0.6"/>` +
        `<circle cx="62" cy="80" r="1.8" fill="${O}"/><circle cx="72" cy="74" r="1.8" fill="${O}"/>` +
        // Lådan: vit lack med svängd stjärt och guldlist.
        `<path d="M8 92 L190 92 Q234 92 234 114 Q234 136 210 136 L8 136 Z" fill="${LACK}" ${LINE}/>` +
        `<path d="M8 124 L222 124 Q232 120 233 116 L233 120 Q232 136 210 136 L8 136 Z" fill="${LACK_SKUGGA}" stroke="none"/>` +
        `<rect x="10" y="118" width="214" height="4" rx="2" fill="${GULD}" stroke="none"/>` +
        `<path d="M8 92 L190 92 Q234 92 234 114 Q234 136 210 136 L8 136 Z" fill="none" ${LINE}/>` +
        glans("M70 100 L190 100", 2, 0.9) +
        // Klaviatur.
        `<rect x="10" y="94" width="50" height="14" rx="2" fill="#FFFFFF" ${THIN}/>` +
        `<path d="${tangenter.trim()}" stroke="${O}" stroke-width="0.9" opacity="0.55"/>` + svarta +
        `<rect x="4" y="90" width="8" height="22" rx="3" fill="${LACK}" ${THIN}/>` +
        `<circle cx="140" cy="128" r="3" fill="${GULD}" ${THIN}/>` +
        // Svävande noter.
        `<g${anim(opts, "kc-svava")}><path d="M20 58 L20 40 L30 37 L30 55" fill="none" stroke="${SAMMET}" stroke-width="2.4" stroke-linecap="round"/>` +
        `<ellipse cx="17" cy="58" rx="4" ry="3" fill="${SAMMET}"/><ellipse cx="27" cy="55" rx="4" ry="3" fill="${SAMMET}"/></g>` +
        `<g${anim(opts, "kc-svava d2")}><path d="M118 20 L118 4" stroke="${SAMMET_MORK}" stroke-width="2.4" stroke-linecap="round"/>` +
        `<ellipse cx="115" cy="20" rx="4" ry="3" fill="${SAMMET_MORK}"/><path d="M118 4 Q126 8 124 14" fill="none" stroke="${SAMMET_MORK}" stroke-width="2" stroke-linecap="round"/></g>` +
        `<g${anim(opts, "kc-glitter")}>${gnistra(206, 50, 5)}</g>`
      );
    },
  },
};
