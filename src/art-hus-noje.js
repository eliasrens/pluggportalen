// ============================================================================
// Pluggporten – MASKINER & NÖJE-husskal (tidstorn/steampunk, gamer-håla,
// fruktpalats, arkadhall, hajk-tält) – köpbara husskal (shop, ej lådvinst) för
// shoppens hus-kategori (shop-items.js).
// ----------------------------------------------------------------------------
// Egen-tecknade SVG-exteriörer som följer EXAKT samma koordinatsystem/anslut-
// ningspunkter som stugan m.fl. i art-hus-ute.js:
//   - huset ritas kring x 300–660, marklinjen (husets botten) y ≈ 512
//   - fasad/tak/vägg färgas via CSS-variablerna --hus-house / --hus-roof /
//     --hus-wall / --hus-wall2 så varje elevs palett slår igenom
//   - dörr/entré ungefär centralt, fönster utan överlapp, inget "flygande tak"
//     – allt bottnar (direkt eller via sockel/hjul/ben) på marklinjen.
// Registret NOJE_HUS_SKAL spreadas in i HUS_SKAL (art-hus-ute.js), precis som
// LYX/NATUR/RETRO_HUS_SKAL, så skalen dyker upp i "🏠 Nytt hus"-väljaren och
// by-vyn utan särfall. Id:na sparas i Firestore (ownedItems/husSkalId) → håll
// dem STABILA. Konsten är egen-tecknad; INGA varumärken eller logotyper.
// ============================================================================

import { O, LINE, THIN, limb } from "./art-style.js";

const WOOD = "#B0805A";
const WOOD_DARK = "#8A6242";
const CREAM = "#FFF3DC";
const GOLD = "#F7C948";
const BRASS = "#C89B4A";
const BRASS_DARK = "#9A7433";
const NEON_PINK = "#F890B7";
const NEON_CYAN = "#7FC7E8";
const NEON_MINT = "#58C6A9";
const LEAF = "#6FC66F";
const LEAF_DARK = "#4E9E52";
const FIRE = "#F49E4C";

const shadow = (cx, cy, rx) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${(rx * 0.22).toFixed(1)}" fill="${O}" opacity="0.09"/>`;

// Kugghjul (cog): tandad skiva med nav-hål. n = antal tänder.
function kugghjul(cx, cy, r, n, fill) {
  const pts = n * 2;
  let d = "";
  for (let i = 0; i < pts; i++) {
    const rad = i % 2 === 0 ? r : r * 0.8;
    const a = ((i * (360 / pts) - 90) * Math.PI) / 180;
    d += (i ? "L" : "M") + (cx + rad * Math.cos(a)).toFixed(1) + " " + (cy + rad * Math.sin(a)).toFixed(1) + " ";
  }
  return `<path d="${d}Z" fill="${fill}" ${LINE}/>
      <circle cx="${cx}" cy="${cy}" r="${(r * 0.5).toFixed(1)}" fill="none" stroke="${O}" stroke-width="3"/>
      <circle cx="${cx}" cy="${cy}" r="${(r * 0.2).toFixed(1)}" fill="${O}" stroke="none"/>`;
}

// --- Tidstorn (Steampunk): mässingstorn med kugghjul, ångpipor & mätare --------
function tidstornMarkup() {
  // Nitar längs en lodrät kant.
  let nitar = "";
  for (let y = 278; y < 500; y += 28) nitar += `<circle cx="372" cy="${y}" r="3" fill="${BRASS_DARK}"/><circle cx="548" cy="${y}" r="3" fill="${BRASS_DARK}"/>`;
  return `${shadow(480, 516, 178)}
      <!-- Ångpipor bakom tornet (rök stiger) -->
      <rect x="556" y="300" width="26" height="212" rx="9" fill="var(--hus-wall2)" ${LINE}/>
      <rect x="592" y="344" width="22" height="168" rx="9" fill="var(--hus-wall2)" ${LINE}/>
      <rect x="552" y="294" width="34" height="14" rx="6" fill="${BRASS}" ${THIN}/>
      <g class="hus-rok"><circle cx="569" cy="284" r="13" fill="#fff" opacity="0.85"/></g>
      <g class="hus-rok r2"><circle cx="569" cy="284" r="9" fill="#fff" opacity="0.85"/></g>
      <g class="hus-rok r3"><circle cx="569" cy="284" r="11" fill="#fff" opacity="0.85"/></g>
      <!-- Tornkropp (mässing) + nit-rader -->
      <rect x="360" y="264" width="200" height="248" rx="12" fill="var(--hus-house)" ${LINE}/>
      ${nitar}
      <!-- Kupoltak med spira -->
      <path d="M344 268 Q480 194 616 268 Z" fill="var(--hus-roof)" ${LINE}/>
      ${limb("M480 214 L480 182", BRASS_DARK, 4)}
      <circle cx="480" cy="176" r="7" fill="${GOLD}" ${THIN}/>
      <!-- Stort kugghjul + två mindre på fasaden -->
      ${kugghjul(428, 344, 50, 10, "var(--hus-roof)")}
      ${kugghjul(520, 402, 30, 8, BRASS)}
      ${kugghjul(392, 430, 22, 8, BRASS)}
      <!-- Rund tryckmätare (urtavla) -->
      <circle cx="480" cy="344" r="24" fill="${CREAM}" ${LINE}/>
      <path d="M480 344 L494 332" stroke="${O}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="480" cy="344" r="3" fill="${O}"/>
      <!-- Mässingsdörr (central, med gångjärnsband) -->
      <path d="M450 512 L450 448 Q450 420 480 420 Q510 420 510 448 L510 512 Z" fill="${BRASS}" ${LINE}/>
      <path d="M480 422 L480 512" stroke="${O}" stroke-width="3"/>
      <path d="M456 452 L504 452 M456 486 L504 486" stroke="${BRASS_DARK}" stroke-width="4"/>
      <circle cx="496" cy="470" r="4.5" fill="${GOLD}" ${THIN}/>
      <!-- Runda kobber-fönster utan överlapp -->
      <circle cx="392" cy="480" r="15" fill="var(--hus-wall)" ${LINE}/>
      <path d="M392 465 L392 495 M377 480 L407 480" stroke="${O}" stroke-width="3"/>`;
}

// --- Gamer-håla: hus format som en spelkontroll med RGB-glöd (egen design) ------
function gamerhalanMarkup() {
  // Kontroll-silhuett: bred kropp som flikar ner i två grepp mot marklinjen.
  return `${shadow(480, 518, 190)}
      <!-- RGB-glöd bakom kontrollen -->
      <path d="M360 360 L600 360 Q650 360 650 430 Q654 512 590 512 L560 512 Q536 476 480 476 Q424 476 400 512 L370 512 Q306 512 310 430 Q310 360 360 360 Z"
        fill="none" stroke="${NEON_CYAN}" stroke-width="10" opacity="0.5"/>
      <!-- Kontroll-kropp -->
      <path d="M366 372 L594 372 Q636 372 636 434 Q640 508 586 508 Q550 512 534 484 Q512 470 480 470 Q448 470 426 484 Q410 512 374 508 Q320 508 324 434 Q324 372 366 372 Z"
        fill="var(--hus-house)" ${LINE}/>
      <!-- RGB-remsa längs överkanten -->
      <path d="M372 384 L588 384" stroke="${NEON_PINK}" stroke-width="5" opacity="0.85" stroke-linecap="round"/>
      <path d="M400 384 L520 384" stroke="${NEON_MINT}" stroke-width="5" opacity="0.7" stroke-linecap="round"/>
      <!-- Styrkors (D-pad) till vänster -->
      <path d="M392 414 L412 414 L412 402 L432 402 L432 414 L452 414 L452 434 L432 434 L432 446 L412 446 L412 434 L392 434 Z"
        fill="var(--hus-wall2)" ${LINE}/>
      <!-- Knappar till höger (RGB) -->
      <circle cx="548" cy="404" r="13" fill="${NEON_MINT}" ${LINE}/>
      <circle cx="576" cy="428" r="13" fill="${NEON_PINK}" ${LINE}/>
      <circle cx="520" cy="428" r="13" fill="${NEON_CYAN}" ${LINE}/>
      <circle cx="548" cy="452" r="13" fill="${GOLD}" ${LINE}/>
      <!-- Central glödande skärm-dörr (bottnar på marklinjen mellan greppen) -->
      <rect x="452" y="428" width="56" height="84" rx="8" fill="var(--hus-wall)" ${LINE}/>
      <rect x="460" y="436" width="40" height="40" rx="4" fill="${NEON_CYAN}" opacity="0.55" stroke="none"/>
      <path d="M480 428 L480 512" stroke="${O}" stroke-width="3"/>
      <circle cx="470" cy="492" r="3.5" fill="${GOLD}"/>
      <circle cx="490" cy="492" r="3.5" fill="${GOLD}"/>
      <!-- Analog-spakar (små runda knappar) -->
      <circle cx="420" cy="470" r="10" fill="var(--hus-wall2)" ${THIN}/>
      <circle cx="540" cy="488" r="10" fill="var(--hus-wall2)" ${THIN}/>`;
}

// --- Fruktpalats: knasigt hus format som en jättestor ananas --------------------
function fruktpalatsMarkup() {
  // Rutmönster (ananas-fjäll): korsande diagonaler över kroppen.
  let rutor = "";
  for (let i = -3; i <= 4; i++) {
    const off = i * 56;
    rutor += `<path d="M${384 + off} 300 L${520 + off} 512" stroke="${O}" stroke-width="2" opacity="0.28"/>`;
    rutor += `<path d="M${576 - off} 300 L${440 - off} 512" stroke="${O}" stroke-width="2" opacity="0.28"/>`;
  }
  // Blad-krona i toppen (gröna spetsar).
  const blad = [[-64, -70, LEAF_DARK], [-30, -104, LEAF], [4, -118, LEAF_DARK], [40, -104, LEAF], [70, -68, LEAF_DARK]]
    .map(([dx, dy, f]) => `<path d="M${480 + dx * 0.4} 300 Q${480 + dx} ${300 + dy} ${480 + dx * 1.3} ${306 + dy} Q${480 + dx * 0.9} ${300 + dy * 0.5} ${480 + dx * 0.15} 300 Z" fill="${f}" ${LINE}/>`)
    .join("");
  const kropp = "M480 300 Q384 300 380 402 Q380 512 480 512 Q580 512 580 402 Q576 300 480 300 Z";
  return `${shadow(480, 518, 190)}
      <defs><clipPath id="frukt-fjall"><path d="${kropp}"/></clipPath></defs>
      <!-- Ananas-kropp (rund, gyllene) -->
      <path d="${kropp}" fill="var(--hus-house)" ${LINE}/>
      <!-- Fjäll-rutnät (klippt mot kroppen så inga linjer sticker ut) -->
      <g clip-path="url(#frukt-fjall)">${rutor}</g>
      <path d="${kropp}" fill="none" ${LINE}/>
      <!-- Bladkrona ovanpå -->
      ${blad}
      <!-- Entré (rund fruktdörr, central) -->
      <path d="M450 512 L450 448 Q450 418 480 418 Q510 418 510 448 L510 512 Z" fill="${WOOD}" ${LINE}/>
      <path d="M458 508 L458 450 Q458 428 480 428 Q502 428 502 450 L502 508" fill="none" stroke="${CREAM}" stroke-width="4"/>
      <circle cx="497" cy="466" r="4.5" fill="${LEAF}" ${THIN}/>
      <!-- Runda fönster (utan överlapp) -->
      <circle cx="408" cy="392" r="21" fill="var(--hus-wall)" ${LINE}/>
      <path d="M408 371 L408 413 M387 392 L429 392" stroke="${O}" stroke-width="3"/>
      <circle cx="552" cy="392" r="21" fill="var(--hus-wall)" ${LINE}/>
      <path d="M552 371 L552 413 M531 392 L573 392" stroke="${O}" stroke-width="3"/>`;
}

// --- Arkadhall: retrobyggnad med arkadmaskiner, blinkljus & neon-skylt ----------
function arkadhallMarkup() {
  // Marquee-glödlampor runt skyltbandet.
  let lampor = "";
  for (let x = 352; x <= 608; x += 32) lampor += `<circle cx="${x}" cy="300" r="5" fill="${GOLD}" ${THIN}/>`;
  // En arkadmaskin (upprätt kabinett med lyst skärm).
  const kabinett = (x, screen) =>
    `<path d="M${x} 500 L${x} 380 Q${x} 372 ${x + 8} 372 L${x + 52} 372 Q${x + 60} 372 ${x + 60} 380 L${x + 60} 500 Z" fill="var(--hus-wall2)" ${LINE}/>
     <rect x="${x + 8}" y="${386}" width="44" height="34" rx="3" fill="${screen}" opacity="0.85" ${THIN}/>
     <path d="M${x + 8} 430 L${x + 52} 430" stroke="${O}" stroke-width="2" opacity="0.4"/>
     <circle cx="${x + 20}" cy="446" r="4" fill="${NEON_PINK}"/>
     <circle cx="${x + 40}" cy="446" r="4" fill="${NEON_CYAN}"/>`;
  return `${shadow(480, 518, 190)}
      <!-- Byggnad (arkadhall) -->
      <rect x="340" y="312" width="280" height="200" rx="8" fill="var(--hus-house)" ${LINE}/>
      <!-- Neon-skyltband (abstrakta former, inga logotyper) -->
      <rect x="332" y="284" width="296" height="34" rx="8" fill="var(--hus-roof)" ${LINE}/>
      <rect x="352" y="292" width="256" height="18" rx="5" fill="none" stroke="${NEON_CYAN}" stroke-width="4"/>
      <path d="M400 301 L420 301 M440 295 L440 307 M460 295 L460 307 L474 307 M498 295 L498 307 M518 295 L530 301 L518 307 M548 295 L548 307"
        stroke="${NEON_PINK}" stroke-width="3.4" stroke-linecap="round" fill="none"/>
      ${lampor}
      <!-- Stort skyltfönster med två arkadmaskiner inuti -->
      <rect x="360" y="356" width="150" height="156" rx="6" fill="var(--hus-wall)" opacity="0.4" ${LINE}/>
      ${kabinett(374, NEON_CYAN)}
      ${kabinett(444, NEON_PINK)}
      <!-- Blinkljus-ram runt fönstret -->
      <rect x="360" y="356" width="150" height="156" rx="6" fill="none" stroke="${GOLD}" stroke-width="3" stroke-dasharray="4 12" opacity="0.7"/>
      <!-- Entré (central-höger, bottnar på marklinjen) med lampor -->
      <path d="M534 512 L534 396 Q534 372 562 372 Q590 372 590 396 L590 512 Z" fill="var(--hus-wall2)" ${LINE}/>
      <path d="M562 374 L562 512" stroke="${O}" stroke-width="3"/>
      <circle cx="576" cy="452" r="4.5" fill="${GOLD}" ${THIN}/>
      <circle cx="534" cy="392" r="4" fill="${NEON_PINK}"/>
      <circle cx="590" cy="392" r="4" fill="${NEON_CYAN}"/>`;
}

// --- Hajk-tält (Glamping): lyxigt tält med ljusslingor, fuskpäls & eldstad ------
function hajktaltMarkup() {
  // Ljusslinga (girlang) med hängande lampor mellan två stolpar.
  const lampor = [[372, 258], [412, 246], [452, 238], [492, 238], [532, 246], [572, 258]]
    .map(([x, y], i) => `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 16}" stroke="${WOOD_DARK}" stroke-width="1.6"/>
      <circle cx="${x}" cy="${y + 20}" r="5" fill="${[GOLD, NEON_PINK, NEON_CYAN][i % 3]}" ${THIN}/>`)
    .join("");
  // Fuskpäls-kant (fluffiga bucklor) längs tältfoten.
  let pals = "";
  for (let x = 336; x < 616; x += 26) pals += `<circle cx="${x}" cy="504" r="13" fill="#FFFFFF" ${THIN}/>`;
  return `${shadow(480, 520, 200)}
      <!-- Ljusslinga över tältet -->
      <path d="M360 268 Q480 224 600 268" fill="none" stroke="${WOOD_DARK}" stroke-width="2.4"/>
      ${lampor}
      <!-- A-tält (två våder) -->
      <path d="M480 232 L340 508 L620 508 Z" fill="var(--hus-roof)" ${LINE}/>
      <path d="M480 232 L410 508 L470 508 Q474 372 480 232 Z" fill="${CREAM}" ${THIN}/>
      <path d="M480 232 L550 508 L490 508 Q486 372 480 232 Z" fill="var(--hus-wall)" opacity="0.6" ${THIN}/>
      <!-- Toppspira med vimpel -->
      ${limb("M480 232 L480 206", WOOD_DARK, 4)}
      <path d="M480 206 L516 214 L480 224 Z" fill="${NEON_PINK}" ${THIN}/>
      <!-- Fuskpäls-kant längs marklinjen -->
      ${pals}
      <!-- Ingång: mörk öppning med uppknutna draperier (central) -->
      <path d="M446 508 L446 416 Q446 392 480 392 Q514 392 514 416 L514 508 Z" fill="${O}" opacity="0.82" ${LINE}/>
      <path d="M446 508 L446 416 Q446 394 472 393 Q454 448 460 508 Z" fill="var(--hus-roof)" ${THIN}/>
      <path d="M514 508 L514 416 Q514 394 488 393 Q506 448 500 508 Z" fill="var(--hus-roof)" ${THIN}/>
      <!-- Sprakande eldstad framför tältet (höger, egen liten scen) -->
      <ellipse cx="628" cy="508" rx="34" ry="9" fill="${O}" opacity="0.12"/>
      ${limb("M612 508 L644 496", WOOD, 7)}
      ${limb("M644 508 L612 496", WOOD_DARK, 7)}
      <path d="M628 494 Q616 476 628 458 Q634 472 640 466 Q650 484 640 500 Q634 504 628 494 Z" fill="${FIRE}" ${THIN}/>
      <path d="M628 494 Q622 482 628 470 Q632 480 636 476 Q642 490 634 498 Q630 500 628 494 Z" fill="${GOLD}" stroke="none"/>`;
}

/** id → { namn, emoji, markup } – slås in i HUS_SKAL i art-hus-ute.js. */
export const NOJE_HUS_SKAL = {
  tidstorn: { namn: "Tidstorn", emoji: "⚙️", markup: tidstornMarkup },
  gamerhalan: { namn: "Gamer-håla", emoji: "🎮", markup: gamerhalanMarkup },
  fruktpalats: { namn: "Fruktpalats", emoji: "🍍", markup: fruktpalatsMarkup },
  arkadhall: { namn: "Arkadhall", emoji: "🕹️", markup: arkadhallMarkup },
  hajktalt: { namn: "Hajk-tält", emoji: "⛺", markup: hajktaltMarkup },
};
