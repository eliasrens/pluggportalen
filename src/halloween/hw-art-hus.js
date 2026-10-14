// ============================================================================
// Pluggporten – Halloween-samlingens HUSSKAL (#692): gulligt spökhus + pumpahus
// ----------------------------------------------------------------------------
// Samma koordinatsystem som stugan i art-hus-ute.js: huset kring x 300–660,
// marklinjen y ≈ 512, dörren ungefär centralt (avataren står till vänster,
// x 256–376). Husen har egna, fasta Halloween-färger (spöklila resp. pumpa)
// i stället för elevens --hus-*-palett – det ÄR deras utseende. Registreras i
// HUS_SKAL (registerHusSkal) av hw-konst.js → "🏠 Nytt hus", byn och kompis-
// besök ritar dem utan särfall. Id === skal-id === shop-id (Firestore, STABILT).
// ============================================================================

import {
  O, LINE, THIN, limb, PUMPA, PUMPA_MORK, LILA, LILA_MORK, NATT, SKEN, GUL, GRON, GRON_MORK,
  skugga, anim, pumpa, fladdermus, spoke,
} from "./hw-art-delar.js";

const SPOK_VAGG = "#A99BD6";
const SPOK_VAGG_MORK = "#8C7DC0";
const FONSTER = "#D9C2FF";

// Lila lysande fönster med spröjs (x,y = övre vänstra hörnet).
const lilaFonster = (x, y, w, h) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${FONSTER}" ${LINE}/>` +
  anim("hw-glod", `<rect x="${x + 4}" y="${y + 4}" width="${w - 8}" height="${h - 8}" rx="4" fill="#F4E9FF" opacity="0.8"/>`) +
  `<path d="M${x + w / 2} ${y} L${x + w / 2} ${y + h} M${x} ${y + h / 2} L${x + w} ${y + h / 2}" stroke="${O}" stroke-width="3"/>`;

function spokhusMarkup() {
  return `${skugga(480, 514, 196)}
      <!-- Sned skorsten -->
      <path d="M590 210 L606 150 L636 156 L626 236 Z" fill="${NATT}" ${LINE}/>
      <!-- Lutande torn till vänster med krokig spira -->
      <path d="M318 512 L330 260 L404 252 L410 512 Z" fill="${SPOK_VAGG_MORK}" ${LINE}/>
      <path d="M314 266 Q350 200 362 120 Q372 136 384 128 Q378 190 418 258 Z" fill="${NATT}" ${LINE}/>
      <circle cx="384" cy="126" r="7" fill="${GUL}" ${THIN}/>
      <circle cx="366" cy="318" r="22" fill="${FONSTER}" ${LINE}/>
      ${anim("hw-glod", `<circle cx="366" cy="318" r="15" fill="#F4E9FF" opacity="0.8"/>`)}
      <path d="M366 296 L366 340 M344 318 L388 318" stroke="${O}" stroke-width="3"/>
      <!-- Huvudhuset (lite snett) -->
      <path d="M398 512 L404 296 L642 306 L634 512 Z" fill="${SPOK_VAGG}" ${LINE}/>
      <path d="M410 360 L636 366 M408 430 L634 434" stroke="${O}" stroke-width="2.4" opacity="0.18"/>
      <!-- Snett, krokigt tak med en böjd topp -->
      <path d="M380 312 Q440 250 486 176 Q500 150 520 160 Q512 176 526 196 Q590 260 664 320 Z" fill="${NATT}" ${LINE}/>
      <path d="M420 290 L620 300 M450 250 L580 258" stroke="${LILA}" stroke-width="3" stroke-linecap="round" opacity="0.45"/>
      <!-- Runt vindsfönster med ett spöke som tittar ut -->
      <circle cx="516" cy="250" r="22" fill="${FONSTER}" ${LINE}/>
      ${spoke(516, 254, 1.1)}
      <!-- Lila fönster utan överlapp -->
      ${lilaFonster(418, 344, 56, 60)}
      ${lilaFonster(566, 346, 56, 60)}
      <!-- Dörr (centralt), rundad topp -->
      <path d="M452 512 L452 444 Q452 414 482 414 Q512 414 512 444 L512 512 Z" fill="${LILA_MORK}" ${LINE}/>
      <path d="M482 418 L482 510" stroke="${O}" stroke-width="2.4" opacity="0.4"/>
      <circle cx="500" cy="466" r="5" fill="${GUL}" ${THIN}/>
      <!-- Pumpa vid trappan och fladdermöss runt taket -->
      ${pumpa(560, 494, 18, "lykta")}
      ${fladdermus(430, 200, 1.7)}
      ${fladdermus(618, 236, 1.4)}
      ${fladdermus(548, 128, 1.2)}`;
}

function pumpahusMarkup() {
  const lob = (cx, rx, ry, f) => `<ellipse cx="${cx}" cy="${512 - ry}" rx="${rx}" ry="${ry}" fill="${f}" ${LINE}/>`;
  const rund = (cx, cy, r) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${SKEN}" ${LINE}/>` +
    anim("hw-glod", `<circle cx="${cx}" cy="${cy}" r="${r - 6}" fill="#FFF8DE" opacity="0.9"/>`) +
    `<path d="M${cx} ${cy - r} L${cx} ${cy + r} M${cx - r} ${cy} L${cx + r} ${cy}" stroke="${O}" stroke-width="3"/>`;
  return `${skugga(480, 514, 190)}
      <!-- Skaft = skorsten, med blad och en ranka -->
      <path d="M468 184 L462 128 Q480 116 498 128 L492 184 Z" fill="${GRON_MORK}" ${LINE}/>
      <path d="M496 146 Q540 112 586 138 Q556 168 498 158 Z" fill="${GRON}" ${LINE}/>
      <path d="M520 144 Q544 138 566 142" fill="none" ${THIN}/>
      <path d="M464 160 Q432 142 438 118 Q446 104 458 114" fill="none" stroke="${GRON_MORK}" stroke-width="5" stroke-linecap="round"/>
      <!-- Pumpakroppen: lober bakifrån och fram -->
      ${lob(366, 108, 150, PUMPA_MORK)}
      ${lob(594, 108, 150, PUMPA_MORK)}
      ${lob(418, 112, 168, PUMPA)}
      ${lob(542, 112, 168, PUMPA)}
      ${lob(480, 100, 178, "#F7A95A")}
      <path d="M396 300 Q384 400 404 494 M564 300 Q576 400 556 494" fill="none" stroke="${O}" stroke-width="2.4" opacity="0.2"/>
      <!-- Runda fönster som glada ögon + litet vindsfönster -->
      ${rund(404, 356, 28)}
      ${rund(556, 356, 28)}
      ${rund(480, 262, 16)}
      <!-- Blomlåda med lila blommor under vänstra fönstret -->
      <rect x="374" y="390" width="60" height="14" rx="4" fill="${LILA_MORK}" ${THIN}/>
      <circle cx="388" cy="388" r="5" fill="${LILA}" ${THIN}/><circle cx="404" cy="386" r="5" fill="#F890B7" ${THIN}/><circle cx="420" cy="388" r="5" fill="${LILA}" ${THIN}/>
      <!-- Dörr (centralt), grön och rundad -->
      <path d="M448 512 L448 440 Q448 404 480 404 Q512 404 512 440 L512 512 Z" fill="${GRON_MORK}" ${LINE}/>
      <path d="M458 506 L458 442 Q458 414 480 414 Q502 414 502 442 L502 506 Z" fill="${GRON}" stroke="none"/>
      <circle cx="496" cy="462" r="5" fill="${GUL}" ${THIN}/>
      <!-- Lykta vid dörren + en liten fladdermus -->
      ${limb("M548 512 L548 452", NATT, 4)}
      <rect x="538" y="430" width="20" height="24" rx="5" fill="${SKEN}" ${LINE}/>
      ${anim("hw-glod", `<circle cx="548" cy="442" r="18" fill="${SKEN}" opacity="0.45"/>`)}
      ${fladdermus(640, 250, 1.5)}`;
}

/** id → { namn, emoji, markup } – slås in i HUS_SKAL (registerHusSkal). */
export const HW_HUS_SKAL = {
  "hw-spokhus": { namn: "Gulligt spökhus", emoji: "🏚️", markup: spokhusMarkup },
  "hw-pumpahus": { namn: "Pumpahus", emoji: "🎃", markup: pumpahusMarkup },
};

/** Butiksbilder (itemSvg) – tätt beskuret husskal, samma fasta färger. */
export const HW_HUS_BILDER = Object.fromEntries(
  Object.entries(HW_HUS_SKAL).map(([id, s]) => [id, { viewBox: "290 110 380 420", w: 4.6, art: s.markup() }])
);
