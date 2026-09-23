// ============================================================================
// Pluggporten – STIL & RETRO-husskal (bibliotekstorn, detektivbyrå, discolokal,
// cyberpunk-residens, trojansk häst) – köpbara husskal (shop, ej lådvinst) för
// shoppens hus-kategori (shop-items.js).
// ----------------------------------------------------------------------------
// Egen-tecknade SVG-exteriörer som följer EXAKT samma koordinatsystem/anslut-
// ningspunkter som stugan m.fl. i art-hus-ute.js:
//   - huset ritas kring x 300–660, marklinjen (husets botten) y ≈ 512
//   - fasad/tak/vägg färgas via CSS-variablerna --hus-house / --hus-roof /
//     --hus-wall / --hus-wall2 så varje elevs palett slår igenom
//   - dörr/entré ungefär centralt, fönster utan överlapp, inget "flygande tak"
//     – allt bottnar (direkt eller via sockel/hjul/ben) på marklinjen.
// Registret RETRO_HUS_SKAL spreadas in i HUS_SKAL (art-hus-ute.js), precis som
// LYX/NATUR_HUS_SKAL, så skalen dyker upp i "🏠 Nytt hus"-väljaren och by-vyn
// utan särfall. Id:na sparas i Firestore (ownedItems/husSkalId) → håll STABILA.
// Konsten är egen-tecknad; INGA varumärken eller logotyper förekommer.
// ============================================================================

import { O, LINE, THIN, limb } from "./art-style.js";

const WOOD = "#B0805A";
const WOOD_DARK = "#8A6242";
const WOOD_LIGHT = "#E0B98C";
const PAGE = "#FFF3DC";
const GOLD = "#F7C948";
const NEON_PINK = "#F890B7";
const NEON_CYAN = "#7FC7E8";
const NEON_MINT = "#58C6A9";

const shadow = (cx, cy, rx) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${(rx * 0.22).toFixed(1)}" fill="${O}" opacity="0.09"/>`;

// --- Bibliotekstorn: smalt torn av staplade gigantiska böcker + bokstäver ------
function bibliotekstornMarkup() {
  // En bok = färgat omslag + krämfärgad sidkant (pages) + titelband på ryggen.
  // pageDir: +1 sidkant åt höger, -1 åt vänster (ger den lutande bokstapeln).
  const bok = (x, y, w, h, pageDir, band) => {
    const px = pageDir > 0 ? x + w - 14 : x;
    return (
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="var(--hus-house)" ${LINE}/>` +
      `<rect x="${px}" y="${y + 5}" width="14" height="${h - 10}" fill="${PAGE}" ${THIN}/>` +
      `<path d="M${px + 2} ${y + 12} L${px + 12} ${y + 12} M${px + 2} ${y + h / 2} L${px + 12} ${y + h / 2} M${px + 2} ${y + h - 12} L${px + 12} ${y + h - 12}" stroke="${O}" stroke-width="1.6" opacity="0.4"/>` +
      `<rect x="${pageDir > 0 ? x + 16 : x + w - 74}" y="${y + h / 2 - 8}" width="58" height="16" rx="4" fill="${band}" ${THIN}/>`
    );
  };
  return `${shadow(480, 516, 150)}
      <!-- Staplade böcker (bottnar brett på marklinjen, smalnar uppåt) -->
      ${bok(372, 468, 216, 44, 1, "var(--hus-roof)")}
      ${bok(384, 424, 196, 44, -1, GOLD)}
      ${bok(378, 380, 200, 44, 1, "var(--hus-wall2)")}
      ${bok(392, 336, 176, 44, -1, NEON_PINK)}
      ${bok(386, 292, 184, 44, 1, "var(--hus-roof)")}
      ${bok(400, 250, 160, 42, -1, NEON_MINT)}
      <!-- Gigantisk bokstav "A" ovanpå (av tjocka streck, som en bokstavsstapel) -->
      ${limb("M456 244 L480 176 L504 244", WOOD_DARK, 11)}
      ${limb("M466 220 L494 220", WOOD_DARK, 9)}
      <!-- En liggande bok som lutande "vindflöjel" i toppen -->
      <path d="M500 188 L540 176 L546 194 L506 206 Z" fill="var(--hus-wall)" ${THIN}/>
      <!-- Bibliotekets entré (central, i bottenboken) -->
      <path d="M452 512 L452 452 Q452 432 480 432 Q508 432 508 452 L508 512 Z" fill="${WOOD}" ${LINE}/>
      <path d="M480 434 L480 512" stroke="${O}" stroke-width="3"/>
      <circle cx="467" cy="476" r="4" fill="${GOLD}" ${THIN}/>
      <circle cx="493" cy="476" r="4" fill="${GOLD}" ${THIN}/>
      <!-- Runt läsrums-fönster (utan överlapp) -->
      <circle cx="480" cy="358" r="20" fill="var(--hus-wall)" ${LINE}/>
      <path d="M480 338 L480 378 M460 358 L500 358" stroke="${O}" stroke-width="3"/>`;
}

// --- Detektivbyrå: murrig retrobyggnad med förstoringsglas & ledtrådar ---------
function detektivbyraMarkup() {
  return `${shadow(480, 518, 185)}
      <!-- Fasad (smal, murrig tegelbyggnad) -->
      <rect x="352" y="300" width="256" height="212" rx="6" fill="var(--hus-house)" ${LINE}/>
      <!-- Takgesims + litet spetstak -->
      <rect x="340" y="286" width="280" height="20" rx="5" fill="var(--hus-roof)" ${LINE}/>
      <path d="M366 288 L480 224 L594 288 Z" fill="var(--hus-roof)" ${LINE}/>
      <!-- Tegel-fogar (murrig struktur) -->
      <path d="M352 340 L608 340 M352 388 L608 388 M352 436 L608 436" stroke="${O}" stroke-width="2" opacity="0.22"/>
      <path d="M420 316 L420 340 M500 316 L500 340 M460 340 L460 388 M540 388 L540 436" stroke="${O}" stroke-width="2" opacity="0.22"/>
      <!-- Frostad glasdörr (klassisk byrådörr, central) -->
      <rect x="446" y="418" width="68" height="94" rx="5" fill="var(--hus-wall)" opacity="0.9" ${LINE}/>
      <circle cx="480" cy="452" r="16" fill="var(--hus-wall2)" opacity="0.7" ${THIN}/>
      <path d="M472 452 L488 452 M480 444 L480 460" stroke="${O}" stroke-width="2" opacity="0.5"/>
      <circle cx="503" cy="470" r="3.5" fill="${GOLD}"/>
      <!-- Fönster med persienner -->
      <rect x="376" y="330" width="52" height="60" rx="4" fill="var(--hus-wall)" ${LINE}/>
      <path d="M378 342 L426 342 M378 354 L426 354 M378 366 L426 366 M378 378 L426 378" stroke="${O}" stroke-width="2.4" opacity="0.5"/>
      <rect x="532" y="330" width="52" height="60" rx="4" fill="var(--hus-wall)" ${LINE}/>
      <path d="M534 342 L582 342 M534 354 L582 354 M534 366 L582 366 M534 378 L582 378" stroke="${O}" stroke-width="2.4" opacity="0.5"/>
      <!-- Ledtrådar på fasaden: fotspår + frågetecken -->
      <ellipse cx="392" cy="470" rx="7" ry="4" fill="${O}" opacity="0.4" transform="rotate(-20 392 470)"/>
      <ellipse cx="408" cy="490" rx="7" ry="4" fill="${O}" opacity="0.4" transform="rotate(-20 408 490)"/>
      <path d="M556 452 Q556 440 566 440 Q576 440 576 450 Q576 458 566 462 L566 470" fill="none" stroke="${O}" stroke-width="3" opacity="0.45"/>
      <circle cx="566" cy="480" r="2.4" fill="${O}" opacity="0.45"/>
      <!-- Stort förstoringsglas (lutar mot fasaden, bottnar via handtaget) -->
      ${limb("M596 508 L556 452", WOOD_DARK, 8)}
      <circle cx="540" cy="428" r="34" fill="var(--hus-wall)" opacity="0.45" stroke="${O}" stroke-width="7"/>
      <path d="M520 414 Q528 404 540 404" fill="none" stroke="#FFFFFF" stroke-width="4" opacity="0.6" stroke-linecap="round"/>
      <!-- Skylt över dörren (namnlös, bara ett band) -->
      <rect x="428" y="400" width="104" height="14" rx="4" fill="var(--hus-wall2)" ${THIN}/>`;
}

// --- Discolokal: neonskyltar, dansgolv i fönstret & diskokula på taket ---------
function discolokalMarkup() {
  // Facett-ruta på diskokulan.
  const facett = (x, y) => `<rect x="${x}" y="${y}" width="9" height="9" fill="#FFFFFF" opacity="0.6" stroke="none"/>`;
  return `${shadow(480, 518, 190)}
      <!-- Byggnad (klubblokal) -->
      <rect x="336" y="330" width="288" height="182" rx="8" fill="var(--hus-house)" ${LINE}/>
      <!-- Platt tak med list -->
      <rect x="324" y="316" width="312" height="18" rx="6" fill="var(--hus-roof)" ${LINE}/>
      <!-- Stolpe + diskokula på taket -->
      ${limb("M480 316 L480 296", WOOD_DARK, 4)}
      <circle cx="480" cy="266" r="30" fill="var(--hus-wall)" ${LINE}/>
      <path d="M456 254 L504 254 M452 266 L508 266 M456 278 L504 278 M470 240 L470 292 M490 240 L490 292" stroke="${O}" stroke-width="1.6" opacity="0.4"/>
      ${facett(464, 250)}${facett(486, 258)}${facett(470, 272)}${facett(490, 244)}
      <!-- Ljusstrålar från kulan -->
      <path d="M480 296 L360 340 M480 296 L600 340 M480 296 L430 348 M480 296 L530 348" stroke="${GOLD}" stroke-width="2.4" opacity="0.35" stroke-linecap="round"/>
      <!-- Neonskyltar på fasaden (blinkande ramar) -->
      <rect x="356" y="352" width="70" height="30" rx="6" fill="none" stroke="${NEON_PINK}" stroke-width="5"/>
      <path d="M368 367 L378 367 M388 360 L388 374 M400 360 L400 374 L410 374" stroke="${NEON_PINK}" stroke-width="3" stroke-linecap="round"/>
      <rect x="534" y="352" width="70" height="30" rx="6" fill="none" stroke="${NEON_CYAN}" stroke-width="5"/>
      <circle cx="552" cy="367" r="6" fill="none" stroke="${NEON_CYAN}" stroke-width="3"/>
      <path d="M568 360 L568 374 M580 360 L588 367 L580 374" stroke="${NEON_CYAN}" stroke-width="3" stroke-linecap="round"/>
      <!-- Stort fönster med rutigt dansgolv -->
      <rect x="430" y="398" width="100" height="70" rx="6" fill="var(--hus-wall2)" ${LINE}/>
      <rect x="440" y="440" width="20" height="20" fill="${NEON_PINK}" opacity="0.85" stroke="none"/>
      <rect x="480" y="440" width="20" height="20" fill="${NEON_CYAN}" opacity="0.85" stroke="none"/>
      <rect x="460" y="440" width="20" height="20" fill="${GOLD}" opacity="0.85" stroke="none"/>
      <rect x="500" y="440" width="20" height="20" fill="${NEON_MINT}" opacity="0.85" stroke="none"/>
      <path d="M440 440 L520 440" stroke="${O}" stroke-width="2" opacity="0.4"/>
      <!-- Entré med rund lampa-marquee (bottnar på marklinjen) -->
      <path d="M448 512 L448 480 Q448 470 462 470 L498 470 Q512 470 512 480 L512 512 Z" fill="var(--hus-roof)" ${LINE}/>
      <path d="M480 470 L480 512" stroke="${O}" stroke-width="3"/>
      <circle cx="440" cy="474" r="4" fill="${GOLD}" ${THIN}/>
      <circle cx="480" cy="464" r="4" fill="${GOLD}" ${THIN}/>
      <circle cx="520" cy="474" r="4" fill="${GOLD}" ${THIN}/>`;
}

// --- Cyberpunk-residens: holografiska skärmar & lysande kablar (egen design) ---
function cyberpunkMarkup() {
  return `${shadow(480, 520, 195)}
      <!-- Lägre annex (vänster) -->
      <path d="M312 512 L312 402 L404 402 L404 512 Z" fill="var(--hus-house)" ${LINE}/>
      <!-- Huvudtorn (avsatt tak) -->
      <path d="M396 512 L396 288 L560 288 L560 340 L620 340 L620 512 Z" fill="var(--hus-house)" ${LINE}/>
      <!-- Neon-kantremsor -->
      <path d="M396 288 L560 288 L560 340 L620 340" fill="none" stroke="${NEON_CYAN}" stroke-width="4" opacity="0.9"/>
      <path d="M312 402 L404 402" fill="none" stroke="${NEON_PINK}" stroke-width="4" opacity="0.9"/>
      <!-- Antenn/spira med blink -->
      ${limb("M478 288 L478 240", WOOD_DARK, 4)}
      <circle cx="478" cy="234" r="6" fill="${NEON_PINK}" ${THIN}/>
      <path d="M478 234 Q460 226 452 234 M478 234 Q496 226 504 234" stroke="${NEON_CYAN}" stroke-width="2.4" opacity="0.6" fill="none" stroke-linecap="round"/>
      <!-- Holografiska skärmar (abstrakta staplar, inga logotyper/text) -->
      <rect x="416" y="312" width="60" height="80" rx="4" fill="${NEON_CYAN}" opacity="0.35" ${THIN}/>
      <path d="M424 372 L424 356 M436 372 L436 340 M448 372 L448 348 M460 372 L460 332" stroke="${NEON_CYAN}" stroke-width="3" stroke-linecap="round"/>
      <rect x="492" y="312" width="52" height="64" rx="4" fill="${NEON_PINK}" opacity="0.32" ${THIN}/>
      <path d="M500 344 Q512 328 524 344 Q532 356 536 344" fill="none" stroke="${NEON_PINK}" stroke-width="3" stroke-linecap="round"/>
      <!-- Fönster-rutnät i annexet -->
      <rect x="326" y="418" width="30" height="30" rx="3" fill="var(--hus-wall)" opacity="0.7" ${THIN}/>
      <rect x="362" y="418" width="30" height="30" rx="3" fill="var(--hus-wall)" opacity="0.7" ${THIN}/>
      <!-- Lysande kablar som slingrar sig ner till marken -->
      ${limb("M620 360 Q648 430 624 512", NEON_MINT, 5)}
      ${limb("M312 440 Q292 480 316 512", NEON_PINK, 4)}
      <path d="M560 340 Q592 380 568 440" fill="none" stroke="${NEON_CYAN}" stroke-width="3" opacity="0.7" stroke-linecap="round"/>
      <!-- Glödande entré (central) -->
      <rect x="454" y="430" width="64" height="82" rx="5" fill="var(--hus-wall2)" ${LINE}/>
      <path d="M486 430 L486 512" stroke="${NEON_CYAN}" stroke-width="3" opacity="0.8"/>
      <path d="M462 446 L510 446" stroke="${NEON_PINK}" stroke-width="3" opacity="0.7"/>`;
}

// --- Trojansk häst: fin trähäst på hjulplattform (inspiration från Troja) ------
function trojanskhastMarkup() {
  return `${shadow(480, 520, 200)}
      <!-- Hjulplattform (bottnar på marklinjen) -->
      <rect x="336" y="486" width="288" height="18" rx="6" fill="${WOOD_DARK}" ${LINE}/>
      <circle cx="382" cy="504" r="18" fill="${WOOD}" ${LINE}/>
      <circle cx="382" cy="504" r="6" fill="${WOOD_DARK}" ${THIN}/>
      <circle cx="578" cy="504" r="18" fill="${WOOD}" ${LINE}/>
      <circle cx="578" cy="504" r="6" fill="${WOOD_DARK}" ${THIN}/>
      <!-- Fyra ben (trästolpar ner till plattformen) -->
      ${limb("M418 486 L410 396", WOOD, 15)}
      ${limb("M458 486 L456 400", WOOD, 15)}
      ${limb("M540 486 L548 396", WOOD, 15)}
      ${limb("M500 486 L502 400", WOOD, 15)}
      <!-- Kropp (stor trädkonstruktion) -->
      <path d="M372 410 Q372 356 440 348 L560 348 Q612 352 612 402 Q612 440 552 444 L420 444 Q372 442 372 410 Z"
        fill="var(--hus-house)" ${LINE}/>
      <!-- Sadeltäcke (accent) -->
      <path d="M436 350 Q500 344 566 352 L558 388 Q500 380 448 388 Z" fill="var(--hus-roof)" ${LINE}/>
      <path d="M470 356 L462 384 M508 354 L504 382 M544 356 L548 384" stroke="${O}" stroke-width="2" opacity="0.3"/>
      <!-- Plank-fogar över kroppen -->
      <path d="M400 402 L600 400 M410 420 L590 420" stroke="${O}" stroke-width="2.2" opacity="0.28"/>
      <path d="M448 356 L446 442 M508 350 L508 444 M560 352 L556 442" stroke="${O}" stroke-width="2.2" opacity="0.28"/>
      <!-- Hals + huvud (vänstervänt) -->
      <path d="M372 410 Q332 388 332 336 Q332 300 372 296 L404 296 Q404 340 400 408 Z"
        fill="var(--hus-house)" ${LINE}/>
      <path d="M332 336 Q300 330 292 300 Q288 284 306 280 L360 296 Q356 320 372 340 Z"
        fill="var(--hus-house)" ${LINE}/>
      <!-- Öron -->
      <path d="M356 292 L350 268 L372 284 Z" fill="var(--hus-house)" ${LINE}/>
      <path d="M382 290 L384 266 L400 286 Z" fill="var(--hus-house)" ${LINE}/>
      <!-- Man (accent längs halsen) -->
      <path d="M372 300 Q356 316 360 340 Q364 300 388 296 Q374 292 372 300 Z" fill="var(--hus-roof)" ${THIN}/>
      <!-- Öga + nos-detalj -->
      <circle cx="322" cy="302" r="5" fill="${O}"/>
      <path d="M296 292 L306 288" stroke="${O}" stroke-width="2.4" opacity="0.5"/>
      <!-- Svans (accent, ner mot plattformen) -->
      <path d="M612 400 Q640 430 626 484" fill="none" stroke="var(--hus-roof)" stroke-width="12" stroke-linecap="round"/>
      <!-- Lucka/hemlig port i buken (central) -->
      <path d="M456 444 L456 408 Q456 394 480 394 Q504 394 504 408 L504 444 Z" fill="${WOOD}" ${LINE}/>
      <path d="M480 396 L480 444" stroke="${O}" stroke-width="3"/>
      <circle cx="495" cy="420" r="3.5" fill="${WOOD_DARK}" ${THIN}/>`;
}

/** id → { namn, emoji, markup } – slås in i HUS_SKAL i art-hus-ute.js. */
export const RETRO_HUS_SKAL = {
  bibliotekstorn: { namn: "Bibliotekstorn", emoji: "📚", markup: bibliotekstornMarkup },
  detektivbyra: { namn: "Detektivbyrå", emoji: "🔍", markup: detektivbyraMarkup },
  discolokal: { namn: "Discolokal", emoji: "🪩", markup: discolokalMarkup },
  cyberpunk: { namn: "Cyberpunk-residens", emoji: "🌆", markup: cyberpunkMarkup },
  trojanskhast: { namn: "Trojansk häst", emoji: "🐴", markup: trojanskhastMarkup },
};
