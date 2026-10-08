// ============================================================================
// Pluggporten – Klasscentrets pokaler, del 2 (#528): Mattematchen silver/
// brons, Läsresan-milstolparna och lärarens pokalmotiv.
// ----------------------------------------------------------------------------
// Samma format och stil som art-klasscenter-pokaler-figurer.js (viewBox
// POKAL_VB 100 × 140, står på y≈134, tvåtonad metall med glans, kontur O,
// inga gradienter/defs/id). Nycklarna är pokaltypernas `art`/`artFran` i
// src/klasscenter/kc-pokal-typer.js:
//   pokal-mm-silver, pokal-mm-brons
//   pokal-lasresan-{100|250|500|1000}  brons → silver → guld → guld + ädelsten
//   pokal-larare-{guld|stjarna|hjarta|medalj}  (LARAR_MOTIV)
// Ambient = bara CSS-klasser via anim() (#374).
// 🔴 Bootgraf: laddas bara dynamiskt (via art-klasscenter-pokaler.js).
// ============================================================================

import {
  O, LINE, THIN, shadow, anim, gnistra, glans, stjarnaKontur,
  GULD, GULD_MORK, GULD_LJUS, KRAM, FANA, WOOD, WOOD_DARK, STAL, STAL_DARK, SAMMET,
} from "./art-klasscenter-delar.js";
import { POKAL_VB, sockel, bagare, rosett } from "./art-klasscenter-pokaler-figurer.js";

const POKAL_W = 3.2;
const BRONS = "#D98C4A";
const BRONS_MORK = "#B26E35";
const ROD = "#E5484D";
const ROD_MORK = "#B8323A";
const ROSA = "#F59BB0";
const GRON = "#7BC67E";
const ADEL = "#4FC3E8";

// Siffrorna 2 och 3 som graverade linjer i medaljongen (mitt 50, 46).
const SIFFRA = {
  2: "M45 41 Q45.5 36 50 36 Q55 36 55 40.5 Q55 44 45 55 L55.5 55",
  3: "M45 38 Q50 33.5 54.5 37.5 Q56.5 42 50 44.5 Q57 46 55 51.5 Q50 57 44.5 52",
};

// Placeringspokal: bägare i metallen c/cm, medaljong med siffran, rosett.
function platsPokal(c, cm, siffra, opts) {
  return (
    sockel() +
    bagare(c, cm) +
    `<circle cx="50" cy="46" r="14" fill="${KRAM}" ${THIN}/>` +
    `<circle cx="50" cy="46" r="10.6" fill="none" stroke="${c}" stroke-width="1.8"/>` +
    `<path d="${SIFFRA[siffra]}" fill="none" stroke="${cm}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` +
    rosett(50, 86) +
    `<g${anim(opts, "kc-glitter")}>${gnistra(80, 16, 4.6)}</g>`
  );
}

// Läsresan: uppslagen bok på en pokalfot, stjärnor ovanför (en per nivå).
function bokPokal(c, cm, stjarnor, opts, adel = false) {
  const pos = [[50, 24], [34, 30], [66, 30], [50, 10]].slice(0, stjarnor);
  return (
    sockel() +
    `<path d="M36 104 L64 104 L57 94 L43 94 Z" fill="${cm}" ${THIN}/>` +
    `<rect x="45" y="82" width="10" height="13" fill="${c}" ${THIN}/>` +
    // Pärmen (metall) under sidorna.
    `<path d="M50 66 Q32 56 10 61 L10 88 Q32 84 50 92 Q68 84 90 88 L90 61 Q68 56 50 66 Z" fill="${c}" ${LINE}/>` +
    `<path d="M50 64 Q34 54 15 58 L15 85 Q34 81 50 89 Z" fill="${KRAM}" ${THIN}/>` +
    `<path d="M50 64 Q66 54 85 58 L85 85 Q66 81 50 89 Z" fill="${KRAM}" ${THIN}/>` +
    [0, 1, 2].map((i) =>
      `<path d="M21 ${65 + i * 6} Q33 ${62 + i * 6} 45 ${67 + i * 6} M55 ${67 + i * 6} Q67 ${62 + i * 6} 79 ${65 + i * 6}" ` +
      `fill="none" stroke="${cm}" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>`).join("") +
    // Bokmärke i klassens färg.
    `<path d="M62 60 L62 80 L65.5 76.5 L69 80 L69 58 Z" fill="${FANA}" ${THIN}/>` +
    glans("M14 62 Q30 58 44 64", 1.6, 0.6) +
    pos.map(([x, y]) => stjarnaKontur(x, y, 7.5, c)).join("") +
    (adel ? `<path d="M50 40 L58 48 L50 56 L42 48 Z" fill="${ADEL}" ${THIN}/>` + glans("M47 45 L50 42", 1.4, 0.9) : "") +
    `<g${anim(opts, "kc-glitter")}>${gnistra(84, 40, 4.6)}</g>` +
    (stjarnor > 2 ? `<g${anim(opts, "kc-glitter d2")}>${gnistra(16, 40, 4)}</g>` : "")
  );
}

// Lärarmotivens gemensamma fot: träsockel med guldlist + band i klassens färg.
function lararFot() {
  return (
    shadow(50, 134, 36) +
    `<rect x="22" y="110" width="56" height="24" rx="3" fill="${WOOD_DARK}" ${LINE}/>` +
    `<rect x="26" y="104" width="48" height="9" rx="3" fill="${WOOD}" ${LINE}/>` +
    `<rect x="34" y="118" width="32" height="10" rx="2" fill="${GULD}" ${THIN}/>` +
    `<path d="M39 123 L61 123" stroke="${GULD_MORK}" stroke-width="1.4" stroke-linecap="round"/>`
  );
}

const fig = (rita) => ({ viewBox: POKAL_VB, w: POKAL_W, rita });

export const KC_POKALER_FLER = {
  "pokal-mm-silver": fig((opts) => platsPokal(STAL, STAL_DARK, 2, opts)),
  "pokal-mm-brons": fig((opts) => platsPokal(BRONS, BRONS_MORK, 3, opts)),

  "pokal-lasresan-100": fig((opts) => bokPokal(BRONS, BRONS_MORK, 1, opts)),
  "pokal-lasresan-250": fig((opts) => bokPokal(STAL, STAL_DARK, 2, opts)),
  "pokal-lasresan-500": fig((opts) => bokPokal(GULD, GULD_MORK, 3, opts)),
  "pokal-lasresan-1000": fig((opts) => bokPokal(GULD, GULD_MORK, 4, opts, true)),

  // Lärarens guldpokal: bägare med ett rött äpple i medaljongen.
  "pokal-larare-guld": fig((opts) =>
    sockel() +
    bagare(GULD, GULD_MORK) +
    `<circle cx="50" cy="46" r="14" fill="${KRAM}" ${THIN}/>` +
    `<path d="M50 41 Q42 36 39 44 Q37 53 45 57 Q48 58 50 56.5 Q52 58 55 57 Q63 53 61 44 Q58 36 50 41 Z" fill="${ROD}" ${THIN}/>` +
    `<path d="M50 41 Q50 37 52 34" fill="none" stroke="${WOOD_DARK}" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M52 36 Q57 32 59 36 Q55 38 52 36 Z" fill="${GRON}" ${THIN}/>` +
    glans("M43 45 Q43 50 45 52", 1.4, 0.8) +
    rosett(50, 86) +
    `<g${anim(opts, "kc-glitter")}>${gnistra(80, 16, 5)}</g>` +
    `<g${anim(opts, "kc-glitter d2")}>${gnistra(16, 64, 4)}</g>`),

  // Stjärna på guldstav med band i klassens färg.
  "pokal-larare-stjarna": fig((opts) =>
    lararFot() +
    `<path d="M44 58 L32 92 L38 88 L41 95 L52 62 Z" fill="${FANA}" ${THIN}/>` +
    `<path d="M56 58 L68 92 L62 88 L59 95 L48 62 Z" fill="${FANA}" ${THIN}/>` +
    `<rect x="46" y="62" width="8" height="43" fill="${GULD}" ${THIN}/>` +
    `<circle cx="50" cy="42" r="34" fill="${GULD_LJUS}" opacity="0.4"/>` +
    stjarnaKontur(50, 44, 36, GULD, LINE) +
    stjarnaKontur(50, 45, 22, GULD_MORK, `stroke="none"`) +
    stjarnaKontur(50, 45, 18, GULD, `stroke="none"`) +
    glans("M38 30 L44 22", 2, 0.75) +
    `<g${anim(opts, "kc-glitter")}>${gnistra(86, 14, 5)}</g>` +
    `<g${anim(opts, "kc-glitter d3")}>${gnistra(14, 30, 4)}</g>`),

  // Stort rött hjärta på stav, mindre rosa hjärta i mitten.
  "pokal-larare-hjarta": fig((opts) =>
    lararFot() +
    `<rect x="46" y="74" width="8" height="31" fill="${GULD}" ${THIN}/>` +
    `<path d="M50 30 Q38 10 22 20 Q8 32 20 52 Q32 68 50 80 Q68 68 80 52 Q92 32 78 20 Q62 10 50 30 Z" fill="${ROD}" ${LINE}/>` +
    `<path d="M66 18 Q80 20 82 34 Q82 50 66 64 Q76 46 66 18 Z" fill="${ROD_MORK}" opacity="0.5"/>` +
    `<path d="M50 44 Q44 34 36 39 Q30 45 36 53 Q42 60 50 65 Q58 60 64 53 Q70 45 64 39 Q56 34 50 44 Z" fill="${ROSA}" ${THIN}/>` +
    glans("M24 32 Q22 42 30 52", 2.4, 0.7) +
    `<g${anim(opts, "kc-glitter")}>${gnistra(86, 18, 5)}</g>` +
    `<g${anim(opts, "kc-glitter d2")}>${gnistra(14, 62, 4)}</g>`),

  // Medalj på band i ett litet ställ (två stolpar + tvärslå).
  "pokal-larare-medalj": fig((opts) =>
    lararFot() +
    `<rect x="18" y="14" width="6" height="92" rx="2" fill="${WOOD}" ${THIN}/>` +
    `<rect x="76" y="14" width="6" height="92" rx="2" fill="${WOOD}" ${THIN}/>` +
    `<rect x="14" y="10" width="72" height="8" rx="3" fill="${WOOD_DARK}" ${LINE}/>` +
    `<path d="M34 18 L46 62 L54 62 L42 18 Z" fill="${SAMMET}" ${THIN}/>` +
    `<path d="M66 18 L54 62 L46 62 L58 18 Z" fill="${FANA}" ${THIN}/>` +
    `<rect x="43" y="58" width="14" height="8" rx="2" fill="${GULD_MORK}" ${THIN}/>` +
    `<circle cx="50" cy="82" r="18" fill="${GULD}" ${LINE}/>` +
    `<circle cx="50" cy="82" r="12.5" fill="none" stroke="${GULD_MORK}" stroke-width="2"/>` +
    stjarnaKontur(50, 83, 8.5, GULD_LJUS) +
    glans("M38 76 Q38 70 44 67", 1.8, 0.8) +
    `<path d="M50 100 L50 104" stroke="${O}" stroke-width="1.4"/>` +
    `<g${anim(opts, "kc-glitter")}>${gnistra(72, 70, 4.6)}</g>`),
};
