// ============================================================================
// Pluggporten – Klasscentrum-föremål som hängs upp (zon "vagg"): fana,
// troféhylla och kristallkrona (#487, epic #475 Klasscentret 2/4).
// ----------------------------------------------------------------------------
// Register-format: se index-modulen art-klasscenter-inredning.js.
// Varje sak ritas TAJT i sin egen viewBox (som möblerna i art-furniture.js),
// men i finare material: tvåtonat guld med glans, sammet, kristall.
// Ambient = bara CSS-klasser på ett fåtal grupper (anim() → "" med
// animera:false), aldrig SMIL eller id/defs (#374, flera saker per sida).
// ============================================================================

import {
  O, LINE, THIN, limb, anim, gnistra, glans, stjarnaKontur,
  GULD, GULD_MORK, GULD_LJUS, KRAM, FANA, WOOD, WOOD_DARK, GLAS, GLAS_LJUS, STAL,
} from "./art-klasscenter-delar.js";

import { KC_POKALER, kcTrofehyllaMarkup } from "./art-klasscenter-pokaler.js";

// Shoppens bild av Troféhyllan: så här kan klassens hedershylla se ut.
const TROFE_EXEMPEL = ["pokal-mm", "pokal-lasresan-500", "pokal-larare-stjarna", "pokal-live", "pokal-mm-silver", "pokal-larare-hjarta"]
  .map((art) => ({ art }));

// Guldfrans: små kulor längs en polyline [[x, y], …].
function frans(pts, r = 3.2, steg = 7) {
  let s = "";
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / steg));
    for (let k = i ? 1 : 0; k <= n; k++) {
      const t = k / n;
      s += `<circle cx="${(x1 + (x2 - x1) * t).toFixed(1)}" cy="${(y1 + (y2 - y1) * t).toFixed(1)}" r="${r}" fill="${GULD}" ${THIN}/>`;
    }
  }
  return s;
}

// Lagerkrans av blad i en båge runt (cx, cy).
function lagerkrans(cx, cy, r, fill = GULD_MORK) {
  let s = "";
  for (const sida of [-1, 1]) {
    for (let v = 200; v <= 320; v += 24) {
      const a = (v * Math.PI) / 180;
      const x = (cx + sida * r * Math.cos(a)).toFixed(1);
      const y = (cy - r * Math.sin(a)).toFixed(1);
      const rot = (sida * (v - 270) + (sida < 0 ? 180 : 0)).toFixed(0);
      s += `<ellipse cx="${x}" cy="${y}" rx="6" ry="2.8" transform="rotate(${rot} ${x} ${y})" fill="${fill}" ${THIN}/>`;
    }
  }
  return s;
}

// Tofs som hänger i en snodd från (x, y).
function tofs(x, y, l = 30) {
  return (
    `<path d="M${x} ${y} L${x} ${y + l}" stroke="${GULD_MORK}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<circle cx="${x}" cy="${y + l + 3}" r="4.2" fill="${GULD}" ${THIN}/>` +
    `<path d="M${x - 4} ${y + l + 6} L${x - 7} ${y + l + 22} Q${x} ${y + l + 25} ${x + 7} ${y + l + 22} L${x + 4} ${y + l + 6} Z" fill="${GULD}" ${THIN}/>` +
    `<path d="M${x - 2} ${y + l + 10} L${x - 3} ${y + l + 21} M${x + 2} ${y + l + 10} L${x + 3} ${y + l + 21}" stroke="${GULD_MORK}" stroke-width="1.6" stroke-linecap="round"/>`
  );
}

// Pokal med fot och handtag, står på (cx, yb); s = skala.

export const KC_INREDNING_VAGG = {
  // Klassens fana: sammetsbanér i klassens färg (--kc-fana) med guldkant,
  // lagerkrans + stjärna, guldfrans i spetsen och tofsar som gungar.
  "kc-klassfana": {
    viewBox: "0 0 100 222",
    w: 4.2,
    rita: (opts) =>
      `<path d="M14 21 L50 6 L86 21" fill="none" stroke="${GULD_MORK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<circle cx="50" cy="6" r="3.4" fill="${GULD}" ${THIN}/>` +
      `<path d="M16 22 L84 22 L84 168 L50 196 L16 168 Z" fill="${FANA}" ${LINE}/>` +
      `<path d="M70 22 L84 22 L84 168 L70 180 Z" fill="${O}" opacity="0.12"/>` +
      `<path d="M23 29 L77 29 L77 164 L50 187 L23 164 Z" fill="none" stroke="${GULD}" stroke-width="3" stroke-linejoin="round"/>` +
      frans([[16, 169], [50, 197], [84, 169]]) +
      // Krona överst.
      `<path d="M38 56 L36 42 L43 48 L50 38 L57 48 L64 42 L62 56 Z" fill="${GULD}" ${THIN}/>` +
      `<rect x="37" y="55" width="26" height="5" rx="2" fill="${GULD_MORK}" ${THIN}/>` +
      `<circle cx="50" cy="38" r="2.2" fill="#EF6F6C" ${THIN}/>` +
      // Emblem: kräm medaljong, lagerkrans, stjärna.
      lagerkrans(50, 96, 29) +
      `<circle cx="50" cy="96" r="21" fill="${KRAM}" ${LINE}/>` +
      `<circle cx="50" cy="96" r="16" fill="none" stroke="${GULD}" stroke-width="2.4"/>` +
      stjarnaKontur(50, 97, 12) +
      glans("M43 90 L47 88", 1.8) +
      // "Klassnamnet" som två krämränder.
      `<rect x="30" y="130" width="40" height="6" rx="3" fill="${KRAM}" opacity="0.9"/>` +
      `<rect x="36" y="142" width="28" height="5" rx="2.5" fill="${KRAM}" opacity="0.75"/>` +
      // Tvärstång i guld med knoppar.
      limb("M8 20 L92 20", GULD, 5) +
      glans("M14 18.6 L86 18.6", 1.4, 0.6) +
      `<circle cx="6" cy="20" r="5.2" fill="${GULD}" ${THIN}/><circle cx="94" cy="20" r="5.2" fill="${GULD}" ${THIN}/>` +
      `<g${anim(opts, "kc-pendel")}>${tofs(9, 24)}</g>` +
      `<g${anim(opts, "kc-pendel d2")}>${tofs(91, 24)}</g>` +
      `<g${anim(opts, "kc-glitter")}>${gnistra(66, 82, 5)}</g>`,
  },

  // Troféhylla = klassens hedershylla (#528): sex guldkantade, belysta
  // nischer (konsten: art-klasscenter-pokaler-mobler.js). Shoppen visar den
  // med exempelpokaler; i rummet ritas klassens egna (kc-rum-pokaler.js).
  "kc-trofehylla": {
    viewBox: KC_POKALER["kc-trofehylla"].viewBox,
    w: KC_POKALER["kc-trofehylla"].w,
    rita: (opts) => kcTrofehyllaMarkup(TROFE_EXEMPEL, opts),
  },

  // Gigantisk kristallkrona: förgylld stomme i två våningar, åtta ljus,
  // pärlgirlanger och prismor. Hela kronan gungar sakta (.kc-pendel).
  "kc-kristallkrona": {
    viewBox: "0 0 180 222",
    w: 7,
    rita: (opts) => {
      const ovre = [52, 90, 128];
      const nedre = [16, 50, 90, 130, 164];
      const ljus = (x, y) =>
        `<ellipse cx="${x}" cy="${y}" rx="8" ry="3" fill="${GULD}" ${THIN}/>` +
        `<rect x="${x - 3}" y="${y - 15}" width="6" height="14" rx="2" fill="${KRAM}" ${THIN}/>` +
        `<g${anim(opts, "kc-flamma")}><path d="M${x} ${y - 27} Q${x + 5} ${y - 20} ${x} ${y - 15} Q${x - 5} ${y - 20} ${x} ${y - 27} Z" fill="#F49E4C" ${THIN}/>` +
        `<ellipse cx="${x}" cy="${y - 18.5}" rx="1.6" ry="2.6" fill="${GULD_LJUS}" stroke="none"/></g>`;
      const prisma = (x, y, l = 12) =>
        `<path d="M${x} ${y} L${x} ${y + 4}" stroke="${GULD_MORK}" stroke-width="1.4"/>` +
        `<path d="M${x} ${y + 4} L${x + 3.6} ${y + 4 + l * 0.55} L${x} ${y + 4 + l} L${x - 3.6} ${y + 4 + l * 0.55} Z" fill="${GLAS_LJUS}" ${THIN}/>`;
      const parlor = (d) =>
        `<path d="${d}" fill="none" stroke="${O}" stroke-width="4.6" stroke-linecap="round" stroke-dasharray="0.1 6"/>` +
        `<path d="${d}" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="0.1 6"/>`;
      return (
        `<circle cx="90" cy="118" r="78" fill="${GULD_LJUS}" opacity="0.35"/>` +
        `<path d="M70 0 L110 0 Q108 10 90 11 Q72 10 70 0 Z" fill="${GULD}" ${LINE}/>` +
        `<g${anim(opts, "kc-pendel")}>` +
        // Kedja.
        [14, 24, 34].map((y) => `<ellipse cx="90" cy="${y}" rx="3.2" ry="5" fill="none" stroke="${GULD_MORK}" stroke-width="3"/>`).join("") +
        // Armar (bakom stommen).
        ovre.map((x) => limb(`M90 70 Q${(90 + x) / 2} 84 ${x} 76`, GULD, 3.6)).join("") +
        nedre.map((x) => limb(`M90 124 Q${(90 + x) / 2} ${x === 90 ? 124 : 132} ${x} ${x === 90 ? 132 : 116}`, GULD, 4)).join("") +
        // Stomme: krona, vaser och knoppar.
        `<path d="M78 40 L102 40 L98 52 L82 52 Z" fill="${GULD}" ${THIN}/>` +
        `<path d="M82 52 Q70 64 84 74 L96 74 Q110 64 98 52 Z" fill="${GULD}" ${LINE}/>` +
        `<rect x="85" y="74" width="10" height="34" rx="4" fill="${GULD}" ${THIN}/>` +
        `<path d="M76 108 Q90 102 104 108 Q110 126 90 134 Q70 126 76 108 Z" fill="${GULD}" ${LINE}/>` +
        `<path d="M92 108 Q104 108 104 112 Q106 126 92 132 Z" fill="${GULD_MORK}" opacity="0.5"/>` +
        glans("M80 112 Q80 122 86 127", 2) + glans("M83 56 Q80 64 85 70", 1.8) +
        // Pärlgirlanger mellan armändarna.
        parlor("M52 80 Q71 96 90 80 Q109 96 128 80") +
        parlor("M16 120 Q33 140 50 120 Q70 148 90 136 Q110 148 130 120 Q147 140 164 120") +
        // Ljus och prismor.
        ovre.map((x) => ljus(x, 76)).join("") +
        nedre.map((x) => ljus(x, x === 90 ? 132 : 116) + prisma(x, (x === 90 ? 132 : 116) + 3, 14)).join("") +
        // Stora mittkristallen.
        `<path d="M90 152 L101 176 L90 210 L79 176 Z" fill="${GLAS}" ${LINE}/>` +
        `<path d="M79 176 L101 176 M90 152 L90 210" stroke="${O}" stroke-width="1.6" opacity="0.5"/>` +
        `<path d="M90 156 L97 175 L90 175 Z" fill="#FFFFFF" opacity="0.6"/>` +
        `<circle cx="90" cy="150" r="3.4" fill="${GULD}" ${THIN}/>` +
        `<g${anim(opts, "kc-glitter")}>${gnistra(104, 162, 6)}</g>` +
        `<g${anim(opts, "kc-glitter d2")}>${gnistra(30, 146, 4.5)}</g>` +
        `<g${anim(opts, "kc-glitter d3")}>${gnistra(150, 148, 4.5)}</g>` +
        `</g>`
      );
    },
  },
};
