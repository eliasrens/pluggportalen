// ============================================================================
// Pluggporten – KLASSISKA & NATUR-husskal (skeppsvrak, trädkoja, akvariehus,
// snöglobs-hus, djungeltempel) – köpbara husskal (shop, ej lådvinst) för
// shoppens hus-kategori (shop-items.js).
// ----------------------------------------------------------------------------
// Egen-tecknade SVG-exteriörer som följer EXAKT samma koordinatsystem/anslut-
// ningspunkter som stugan m.fl. i art-hus-ute.js:
//   - huset ritas kring x 300–660, marklinjen (husets botten) y ≈ 512
//   - fasad/tak/vägg färgas via CSS-variablerna --hus-house / --hus-roof /
//     --hus-wall / --hus-wall2 så varje elevs palett slår igenom
//   - dörr/entré ungefär centralt, fönster utan överlapp, inget "flygande tak"
//     – allt bottnar (direkt eller via stam/sockel/trappa) på marklinjen.
// Registret NATUR_HUS_SKAL spreadas in i HUS_SKAL (art-hus-ute.js), precis som
// LYX_HUS_SKAL, så skalen dyker upp i "🏠 Nytt hus"-väljaren och by-vyn utan
// särfall. Id:na sparas i Firestore (ownedItems/husSkalId) → håll dem STABILA.
// Konsten är egen-tecknad; inga varumärken eller logotyper förekommer.
// ============================================================================

import { O, LINE, THIN, limb } from "./art-style.js";

const WOOD = "#B0805A";
const WOOD_DARK = "#8A6242";
const WOOD_LIGHT = "#E0B98C";

const shadow = (cx, cy, rx) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${(rx * 0.22).toFixed(1)}" fill="${O}" opacity="0.09"/>`;

// --- Skeppsvrak: halvt sjunket piratskepp, bruten mast, trasigt segel, ---------
// piratflagga, kajutdörr och runda hyttfönster. Egen tolkning, ej varumärke.
function skeppsvrakMarkup() {
  return `${shadow(480, 520, 200)}
      <!-- Sandbank runt vraket -->
      <path d="M296 500 Q480 470 664 500 L664 514 L296 514 Z" fill="#EAD9C0" ${THIN} opacity="0.8"/>
      <!-- Skrov (lutar lätt, halvt begravt i sanden) -->
      <path d="M306 428 L654 404 Q666 452 618 500 Q540 514 468 514 Q368 514 322 494 Q298 464 306 428 Z"
        fill="var(--hus-house)" ${LINE}/>
      <!-- Reling ovanpå skrovet -->
      <path d="M310 430 L650 406" fill="none" stroke="var(--hus-roof)" stroke-width="15" stroke-linecap="round"/>
      <!-- Plankrand + spruckna plankor -->
      <path d="M322 464 Q480 488 638 456" fill="none" stroke="${O}" stroke-width="3" opacity="0.3"/>
      <path d="M410 434 L404 470 M556 424 L562 460" fill="none" stroke="${O}" stroke-width="3" opacity="0.3"/>
      <!-- Bruten mast (lutar), trasig tvärslå -->
      ${limb("M474 430 L438 194", WOOD_DARK, 9)}
      ${limb("M452 258 L556 250", WOOD_DARK, 6)}
      <!-- Trasigt segel (fransad nederkant) -->
      <path d="M446 224 Q404 252 414 336 L452 320 L470 336 L486 318 L500 334 L494 236 Z"
        fill="#FFF3DC" ${LINE}/>
      <path d="M456 250 L484 246" fill="none" stroke="${O}" stroke-width="2.4" opacity="0.35"/>
      <!-- Piratflagga i masttoppen (dödskalle, egen-tecknad) -->
      ${limb("M438 194 L438 172", WOOD_DARK, 3)}
      <path d="M438 172 L506 180 L438 202 Z" fill="${O}" ${THIN}/>
      <circle cx="466" cy="187" r="6" fill="#FFF3DC" stroke="none"/>
      <circle cx="463" cy="186" r="1.4" fill="${O}"/>
      <circle cx="469" cy="186" r="1.4" fill="${O}"/>
      <path d="M458 195 L474 191 M458 191 L474 195" stroke="#FFF3DC" stroke-width="2" stroke-linecap="round"/>
      <!-- Kajutdörr (centralt) -->
      <path d="M452 510 L452 446 Q452 424 480 424 Q508 424 508 446 L508 510 Z" fill="${WOOD}" ${LINE}/>
      <path d="M462 505 L462 448 Q462 432 480 432 Q498 432 498 448 L498 505 Z" fill="${WOOD_LIGHT}" stroke="none"/>
      <circle cx="493" cy="470" r="4.5" fill="${WOOD_DARK}" ${THIN}/>
      <!-- Runda hyttfönster (portar, utan överlapp) -->
      <circle cx="372" cy="464" r="18" fill="var(--hus-wall)" ${LINE}/>
      <path d="M372 446 L372 482 M354 464 L390 464" stroke="${O}" stroke-width="3"/>
      <circle cx="590" cy="452" r="18" fill="var(--hus-wall)" ${LINE}/>
      <path d="M590 434 L590 470 M572 452 L608 452" stroke="${O}" stroke-width="3"/>`;
}

// --- Trädkoja: gigantisk ek (stam bottnar på marklinjen) med lummig krona som --
// tak, mysig stuga inbyggd i grenklyket, repstege ner till marken.
function tradkojaMarkup() {
  return `${shadow(480, 522, 190)}
      <!-- Ekens stam (bottnar brett på marklinjen) med rötter -->
      ${limb("M480 512 L480 320", WOOD, 48)}
      <path d="M456 512 Q444 486 420 480 M504 512 Q516 486 540 480" fill="none"
        stroke="${WOOD_DARK}" stroke-width="12" stroke-linecap="round"/>
      <path d="M470 400 Q436 384 416 396 M492 372 Q528 356 548 368" fill="none"
        stroke="${WOOD}" stroke-width="13" stroke-linecap="round"/>
      <!-- Lummig krona (tak) – byggd underifrån och upp så bollarna överlappar rent -->
      <circle cx="372" cy="286" r="72" fill="var(--hus-roof)" ${LINE}/>
      <circle cx="588" cy="286" r="72" fill="var(--hus-roof)" ${LINE}/>
      <circle cx="424" cy="212" r="78" fill="var(--hus-roof)" ${LINE}/>
      <circle cx="540" cy="212" r="78" fill="var(--hus-roof)" ${LINE}/>
      <circle cx="480" cy="176" r="86" fill="var(--hus-roof)" ${LINE}/>
      <!-- Löv-glimtar -->
      <circle cx="408" cy="196" r="7" fill="#6FC66F" ${THIN}/>
      <circle cx="560" cy="200" r="7" fill="#6FC66F" ${THIN}/>
      <circle cx="480" cy="150" r="7" fill="#6FC66F" ${THIN}/>
      <!-- Golvplattform under kojan -->
      <rect x="376" y="480" width="208" height="14" rx="5" fill="${WOOD_DARK}" ${LINE}/>
      <path d="M392 494 L392 508 M480 494 L480 512 M568 494 L568 508" stroke="${WOOD_DARK}"
        stroke-width="7" stroke-linecap="round"/>
      <!-- Kojans vägg (inbyggd bland grenarna) -->
      <rect x="396" y="352" width="168" height="130" rx="10" fill="var(--hus-house)" ${LINE}/>
      <!-- Litet plankspetstak -->
      <path d="M384 356 L480 300 L576 356 Z" fill="var(--hus-wall2)" ${LINE}/>
      <!-- Dörr (central) -->
      <path d="M454 480 L454 404 Q454 380 480 380 Q506 380 506 404 L506 480 Z" fill="${WOOD}" ${LINE}/>
      <path d="M480 382 L480 480" stroke="${O}" stroke-width="3"/>
      <circle cx="497" cy="434" r="4.5" fill="${WOOD_DARK}" ${THIN}/>
      <!-- Runt fönster med kryss (utan överlapp mot dörr) -->
      <circle cx="420" cy="410" r="19" fill="var(--hus-wall)" ${LINE}/>
      <path d="M420 391 L420 429 M401 410 L439 410" stroke="${O}" stroke-width="3"/>
      <circle cx="540" cy="410" r="19" fill="var(--hus-wall)" ${LINE}/>
      <path d="M540 391 L540 429 M521 410 L559 410" stroke="${O}" stroke-width="3"/>
      <!-- Repstege från plattformen ner till marken -->
      <path d="M340 486 L332 512 M368 486 L364 512" stroke="${WOOD_DARK}" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M338 494 L366 493 M336 504 L364 504 M334 512 L362 512" stroke="${WOOD}"
        stroke-width="3.5" stroke-linecap="round"/>`;
}

// --- Akvariehus: genomskinligt glashus med fiskar, bubblor och sjögräs ---------
function akvariehusMarkup() {
  // Liten fisk (kropp + stjärtfena + öga) vänd åt `dir` (1 höger, -1 vänster).
  const fisk = (cx, cy, s, färg, dir = 1) =>
    `<g transform="translate(${cx} ${cy}) scale(${dir * s} ${s})">
      <path d="M0 0 Q-14 -9 -26 0 Q-14 9 0 0 Z" fill="${färg}" ${THIN}/>
      <path d="M-26 0 L-38 -8 L-38 8 Z" fill="${färg}" ${THIN}/>
      <circle cx="-7" cy="-2" r="2.4" fill="${O}"/>
    </g>`;
  const bubbla = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFFFFF" ${THIN} opacity="0.7"/>`;
  return `${shadow(480, 516, 190)}
      <!-- Glaskropp (genomskinlig, blå-tonad) -->
      <rect x="342" y="252" width="276" height="260" rx="20" fill="var(--hus-wall)" opacity="0.5" ${LINE}/>
      <rect x="358" y="268" width="244" height="228" rx="12" fill="#7FC7E8" opacity="0.35" stroke="none"/>
      <!-- Vattenyta -->
      <path d="M358 300 Q480 312 602 300" fill="none" stroke="#FFFFFF" stroke-width="3" opacity="0.55"/>
      <!-- Glas-glimt -->
      <path d="M366 280 L366 480" fill="none" stroke="#FFFFFF" stroke-width="6" opacity="0.5" stroke-linecap="round"/>
      <!-- Sjögräs i botten -->
      <path d="M392 500 Q384 452 400 416 M410 500 Q418 456 404 428" fill="none"
        stroke="#6FC66F" stroke-width="6" stroke-linecap="round"/>
      <path d="M574 500 Q582 452 566 420 M556 500 Q548 458 562 432" fill="none"
        stroke="#58C6A9" stroke-width="6" stroke-linecap="round"/>
      <!-- Fiskar som simmar -->
      ${fisk(452, 356, 1.1, "#F49E4C", 1)}
      ${fisk(560, 400, 0.95, "#EF6F6C", -1)}
      ${fisk(408, 452, 0.85, "#F7C948", 1)}
      <!-- Bubblor -->
      ${bubbla(500, 340, 5)}${bubbla(512, 320, 3.5)}${bubbla(430, 400, 4)}${bubbla(586, 458, 4)}
      <!-- Glaslock/ram + spetstak -->
      <rect x="332" y="250" width="296" height="16" rx="6" fill="var(--hus-roof)" ${LINE}/>
      <path d="M324 254 L480 178 L636 254 Z" fill="var(--hus-roof)" ${LINE}/>
      <circle cx="480" cy="212" r="10" fill="var(--hus-wall2)" ${THIN}/>
      <!-- Glasdörr (ram, central) – bottnar på marklinjen -->
      <rect x="446" y="440" width="68" height="72" rx="6" fill="var(--hus-wall)" opacity="0.8" ${LINE}/>
      <path d="M480 440 L480 512" stroke="${O}" stroke-width="3"/>
      <circle cx="470" cy="478" r="3.5" fill="#F7C948"/>
      <circle cx="490" cy="478" r="3.5" fill="#F7C948"/>`;
}

// --- Snöglobs-hus: litet hus inuti en magisk glasklot-snöglob med fallande snö -
function snoglobshusMarkup() {
  // Snöflinga (liten fylld prick) inne i globen.
  const flinga = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFFFFF" stroke="none" opacity="0.95"/>`;
  return `${shadow(480, 528, 185)}
      <!-- Sockel (globen vilar på den, bottnar på marklinjen) -->
      <path d="M356 486 L604 486 L618 512 L342 512 Z" fill="var(--hus-roof)" ${LINE}/>
      <rect x="368" y="474" width="224" height="18" rx="8" fill="var(--hus-wall2)" ${LINE}/>
      <!-- Glasklot (r=178 → topp y≈314-178=... botten vilar på sockeln) -->
      <circle cx="480" cy="316" r="170" fill="var(--hus-wall)" opacity="0.28" ${LINE}/>
      <!-- Snö-drivor i globens botten -->
      <path d="M320 474 Q480 440 640 474 L640 486 L320 486 Z" fill="#FFFFFF" ${THIN} opacity="0.9"/>
      <!-- Litet hus inuti -->
      <rect x="414" y="368" width="132" height="112" rx="8" fill="var(--hus-house)" ${LINE}/>
      <path d="M398 372 L480 310 L562 372 Z" fill="var(--hus-roof)" ${LINE}/>
      <path d="M470 314 L490 314 L498 336 Q480 344 462 336 Z" fill="#FFF3DC" ${THIN}/>
      <!-- Liten gran bredvid -->
      <path d="M566 478 L582 440 L598 478 Z" fill="#58C6A9" ${THIN}/>
      <path d="M570 458 L582 432 L594 458 Z" fill="#6FC66F" ${THIN}/>
      <!-- Dörr (central i lilla huset) -->
      <path d="M458 480 L458 420 Q458 400 480 400 Q502 400 502 420 L502 480 Z" fill="${WOOD}" ${LINE}/>
      <circle cx="493" cy="442" r="4" fill="${WOOD_DARK}" ${THIN}/>
      <!-- Fönster -->
      <rect x="424" y="392" width="26" height="26" rx="4" fill="var(--hus-wall2)" ${THIN}/>
      <path d="M437 392 L437 418 M424 405 L450 405" stroke="${O}" stroke-width="2.4"/>
      <!-- Fallande snöflingor -->
      ${flinga(410, 300, 4)}${flinga(556, 280, 3.5)}${flinga(360, 360, 4)}${flinga(600, 360, 3.5)}
      ${flinga(480, 232, 4)}${flinga(430, 420, 3)}${flinga(540, 440, 3.5)}${flinga(342, 300, 3)}
      <!-- Glas-glimt på klotet -->
      <path d="M392 236 Q350 292 366 372" fill="none" stroke="#FFFFFF" stroke-width="7"
        opacity="0.45" stroke-linecap="round"/>`;
}

// --- Djungeltempel: uråldrig stegpyramid (maya-stil) övervuxen av lianer -------
function djungeltempelMarkup() {
  return `${shadow(480, 520, 200)}
      <!-- Stegpyramid: breda stenblock som avsmalnar uppåt -->
      <rect x="312" y="452" width="336" height="60" fill="var(--hus-house)" ${LINE}/>
      <rect x="348" y="398" width="264" height="56" fill="var(--hus-house)" ${LINE}/>
      <rect x="384" y="344" width="192" height="56" fill="var(--hus-house)" ${LINE}/>
      <!-- Topptempel + platt takskiva -->
      <rect x="420" y="290" width="120" height="56" fill="var(--hus-house)" ${LINE}/>
      <rect x="406" y="276" width="148" height="18" rx="4" fill="var(--hus-roof)" ${LINE}/>
      <!-- Sten-fogar (ristningar) -->
      <path d="M312 482 L648 482 M348 426 L612 426 M384 372 L576 372" stroke="${O}"
        stroke-width="2.4" opacity="0.25"/>
      <path d="M430 452 L430 512 M540 452 L540 512 M470 398 L470 452 M500 344 L500 398"
        stroke="${O}" stroke-width="2.4" opacity="0.25"/>
      <!-- Central trappa (ner till marklinjen) -->
      <path d="M446 512 L458 290 L522 290 L534 512 Z" fill="var(--hus-wall2)" ${LINE}/>
      <path d="M462 344 L518 344 M458 398 L522 398 M454 452 L526 452"
        stroke="${O}" stroke-width="3" opacity="0.5"/>
      <!-- Mörk tempelportal högst upp -->
      <path d="M462 346 L462 306 Q462 296 480 296 Q498 296 498 306 L498 346 Z" fill="${O}" opacity="0.85"/>
      <!-- Maya-ristad mask ovanför portalen -->
      <circle cx="480" cy="286" r="7" fill="var(--hus-roof)" ${THIN}/>
      <!-- Lianer som hänger över stenen -->
      <path d="M348 344 Q340 400 356 452" fill="none" stroke="#6FC66F" stroke-width="6" stroke-linecap="round"/>
      <path d="M612 344 Q622 402 604 452" fill="none" stroke="#58C6A9" stroke-width="6" stroke-linecap="round"/>
      <path d="M384 290 Q376 320 392 342" fill="none" stroke="#6FC66F" stroke-width="5" stroke-linecap="round"/>
      <circle cx="352" cy="404" r="7" fill="#6FC66F" ${THIN}/>
      <circle cx="608" cy="404" r="7" fill="#58C6A9" ${THIN}/>
      <circle cx="386" cy="316" r="6" fill="#6FC66F" ${THIN}/>
      <!-- Djungelväxter vid basen (utan överlapp mot trappan) -->
      <path d="M340 512 Q332 480 348 462 M356 512 Q360 484 344 470" fill="none"
        stroke="#6FC66F" stroke-width="6" stroke-linecap="round"/>
      <path d="M620 512 Q628 480 612 462 M604 512 Q600 484 616 470" fill="none"
        stroke="#58C6A9" stroke-width="6" stroke-linecap="round"/>
      <path d="M348 462 L360 452 L372 462 Z" fill="#F890B7" ${THIN}/>
      <path d="M612 462 L624 452 L636 462 Z" fill="#F7C948" ${THIN}/>`;
}

/** id → { namn, emoji, markup } – slås in i HUS_SKAL i art-hus-ute.js. */
export const NATUR_HUS_SKAL = {
  skeppsvrak: { namn: "Piratkopia (Skeppsvrak)", emoji: "🏴‍☠️", markup: skeppsvrakMarkup },
  tradkoja: { namn: "Trädkoja", emoji: "🌳", markup: tradkojaMarkup },
  akvariehus: { namn: "Akvariehus", emoji: "🐠", markup: akvariehusMarkup },
  snoglobshus: { namn: "Snöglobs-hus", emoji: "❄️", markup: snoglobshusMarkup },
  djungeltempel: { namn: "Djungeltempel", emoji: "🛕", markup: djungeltempelMarkup },
};
