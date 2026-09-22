// ============================================================================
// Pluggporten – LYXIGA köpbara husskal (skepp, fotboll, skyskrapa, glasvilla)
// ----------------------------------------------------------------------------
// Egen-tecknade SVG-exteriörer för de dyra husskalen (1000+ coins) i shoppens
// hus-kategori (shop-items.js). Följer EXAKT samma koordinatsystem/anslutnings-
// punkter som stugan m.fl. i art-hus-ute.js:
//   - huset ritas kring x 300–660, marklinjen (husets botten) y ≈ 512
//   - fasad/tak/vägg färgas via CSS-variablerna --hus-house / --hus-roof /
//     --hus-wall / --hus-wall2 så varje elevs palett slår igenom
//   - dörr ungefär centralt (avataren står framför i foreignObject x256–376),
//     fönster utan överlapp, inget "flygande tak" – allt bottnar på marklinjen.
// Registret LYX_HUS_SKAL spreadas in i HUS_SKAL (art-hus-ute.js), precis som
// MYSTERY_HUS_SKAL, så skalen dyker upp i "🏠 Nytt hus"-väljaren och by-vyn utan
// särfall. Id:na sparas i Firestore (ownedItems/husSkalId) → håll dem STABILA.
// Konsten är egen-tecknad; inga varumärken eller logotyper förekommer.
// ============================================================================

import { O, LINE, THIN, limb } from "./art-style.js";

const WOOD = "#B0805A";
const WOOD_DARK = "#8A6242";
const WOOD_LIGHT = "#E0B98C";

const shadow = (cx, cy, rx) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${(rx * 0.22).toFixed(1)}" fill="${O}" opacity="0.09"/>`;

// --- Skepp: egen-tecknat segelfartyg (galjonsfigur, segel, rundat skrov) -----
// Inspirerat av klassiska sagoskepp – EJ en kopia av något varumärke.
function skeppMarkup() {
  return `${shadow(480, 522, 200)}
      <!-- Master -->
      ${limb("M420 398 L420 150", WOOD_DARK, 9)}
      ${limb("M540 398 L540 172", WOOD_DARK, 9)}
      <!-- Segel (buktande) -->
      <path d="M414 178 Q350 202 356 300 Q388 288 414 300 Z" fill="#FFF3DC" ${LINE}/>
      <path d="M426 178 Q500 200 496 300 Q460 288 426 300 Z" fill="var(--hus-wall)" ${LINE}/>
      <path d="M546 198 Q606 216 600 300 Q574 290 546 300 Z" fill="var(--hus-wall)" ${LINE}/>
      <!-- Vimplar i topp -->
      ${limb("M420 150 L420 130", WOOD_DARK, 3)}
      <path d="M420 130 L458 138 L420 148 Z" fill="#EF6F6C" ${THIN}/>
      ${limb("M540 172 L540 154", WOOD_DARK, 3)}
      <path d="M540 154 L574 161 L540 170 Z" fill="#F7C948" ${THIN}/>
      <!-- Skrov (rundat) -->
      <path d="M300 398 L660 398 L636 470 Q560 512 480 512 Q400 512 324 470 Z" fill="var(--hus-house)" ${LINE}/>
      <!-- Reling ovanpå skrovet -->
      <rect x="300" y="388" width="360" height="16" rx="8" fill="var(--hus-roof)" ${LINE}/>
      <!-- Planka/rand i skrovet -->
      <path d="M316 438 Q480 466 644 438" fill="none" stroke="${O}" stroke-width="3" opacity="0.35"/>
      <!-- Galjonsfigur i fören (pekar vänster, mot avataren) -->
      <path d="M300 400 Q272 402 262 420 Q284 426 300 416 Z" fill="#F7C948" ${LINE}/>
      <circle cx="284" cy="409" r="4.5" fill="${O}" stroke="none"/>
      <!-- Hyttdörr (centralt) -->
      <path d="M452 470 L452 416 Q452 396 480 396 Q508 396 508 416 L508 470 Q480 476 452 470 Z" fill="${WOOD}" ${LINE}/>
      <path d="M480 398 L480 472" stroke="${O}" stroke-width="3"/>
      <circle cx="500" cy="440" r="4.5" fill="${WOOD_DARK}" ${THIN}/>
      <!-- Runda hyttfönster (portar) utan överlapp -->
      <circle cx="384" cy="440" r="18" fill="var(--hus-wall)" ${LINE}/>
      <path d="M384 422 L384 458 M366 440 L402 440" stroke="${O}" stroke-width="3"/>
      <circle cx="576" cy="440" r="18" fill="var(--hus-wall)" ${LINE}/>
      <path d="M576 422 L576 458 M558 440 L594 440" stroke="${O}" stroke-width="3"/>`;
}

// --- Fotboll: runt hus med svart-vita pentagon-paneler -----------------------
function fotbollMarkup() {
  // Regelbunden femhörning kring (cx,cy), radie r, rot grader.
  const pent = (cx, cy, r, rot = 0) => {
    let d = "";
    for (let i = 0; i < 5; i++) {
      const a = ((rot + i * 72 - 90) * Math.PI) / 180;
      d += (i ? "L" : "M") + (cx + r * Math.cos(a)).toFixed(1) + " " + (cy + r * Math.sin(a)).toFixed(1) + " ";
    }
    return `<path d="${d}Z" fill="${O}" ${THIN}/>`;
  };
  return `${shadow(480, 512, 170)}
      <circle cx="480" cy="362" r="150" fill="#FFF3DC" ${LINE}/>
      <!-- Sömmar från mittpanelen -->
      <path d="M480 322 L440 352 M480 322 L520 352 M446 402 L410 430 M514 402 L550 430 M440 352 L410 430 M520 352 L550 430"
        stroke="${O}" stroke-width="2.6" opacity="0.45" fill="none"/>
      <!-- Svart-vita paneler (pentagon) -->
      ${pent(480, 362, 40)}
      ${pent(392, 302, 24, 20)}
      ${pent(568, 302, 24, -20)}
      ${pent(414, 452, 24, 34)}
      ${pent(546, 452, 24, -34)}
      <!-- Dörr (i mittpanelens nederkant) -->
      <path d="M442 510 L442 432 Q442 404 480 404 Q518 404 518 432 L518 510 Z" fill="var(--hus-house)" ${LINE}/>
      <path d="M480 404 L480 510" stroke="${O}" stroke-width="3"/>
      <circle cx="506" cy="458" r="4.5" fill="#F7C948" ${THIN}/>
      <!-- Runda fönster utan överlapp -->
      <circle cx="356" cy="382" r="22" fill="var(--hus-wall)" ${LINE}/>
      <path d="M356 360 L356 404 M334 382 L378 382" stroke="${O}" stroke-width="3"/>
      <circle cx="604" cy="382" r="22" fill="var(--hus-wall)" ${LINE}/>
      <path d="M604 360 L604 404 M582 382 L626 382" stroke="${O}" stroke-width="3"/>`;
}

// --- Skyskrapa: högt smalt hus med fönsterrader/glasfasad --------------------
function skyskrapaMarkup() {
  const cols = [418, 462, 506];
  let win = "";
  for (let r = 0; r < 6; r++) {
    const y = 210 + r * 40;
    for (let c = 0; c < 3; c++) {
      const lit = (r + c) % 3 === 0; // några "tända" rutor
      win += `<rect x="${cols[c]}" y="${y}" width="30" height="26" rx="3" fill="${lit ? "#FDE9A8" : "var(--hus-wall)"}" ${THIN}/>`;
    }
  }
  return `${shadow(480, 512, 150)}
      <!-- Låg sidobyggnad (bryter siluetten, bottnar på marklinjen) -->
      <rect x="556" y="360" width="96" height="152" rx="6" fill="var(--hus-house)" ${LINE}/>
      <rect x="572" y="384" width="26" height="26" rx="3" fill="var(--hus-wall)" ${THIN}/>
      <rect x="612" y="384" width="26" height="26" rx="3" fill="var(--hus-wall)" ${THIN}/>
      <rect x="572" y="424" width="26" height="26" rx="3" fill="var(--hus-wall)" ${THIN}/>
      <rect x="612" y="424" width="26" height="26" rx="3" fill="var(--hus-wall)" ${THIN}/>
      <!-- Tornets kropp -->
      <rect x="400" y="170" width="152" height="342" rx="6" fill="var(--hus-house)" ${LINE}/>
      <!-- Glasfasad-panel -->
      <rect x="410" y="200" width="132" height="248" rx="4" fill="var(--hus-wall2)" opacity="0.4" stroke="none"/>
      ${win}
      <!-- Platt tak (vilar på kroppens överkant) + antenn -->
      <rect x="392" y="156" width="168" height="20" rx="4" fill="var(--hus-roof)" ${LINE}/>
      ${limb("M476 156 L476 116", WOOD_DARK, 4)}
      <circle cx="476" cy="112" r="6" fill="#EF6F6C" ${THIN}/>
      <!-- Entré (glasdörr) centralt -->
      <rect x="448" y="452" width="60" height="60" rx="6" fill="var(--hus-wall)" ${LINE}/>
      <path d="M478 452 L478 512" stroke="${O}" stroke-width="3"/>
      <circle cx="470" cy="484" r="3.5" fill="#F7C948"/>
      <circle cx="486" cy="484" r="3.5" fill="#F7C948"/>`;
}

// --- Glasvilla: modern lyxvilla i två plan med stora glaspartier -------------
function glasvillaMarkup() {
  return `${shadow(480, 512, 195)}
      <!-- Övervåning (indragen) -->
      <rect x="360" y="252" width="200" height="110" rx="6" fill="var(--hus-house)" ${LINE}/>
      <rect x="376" y="272" width="168" height="72" rx="4" fill="var(--hus-wall)" ${LINE}/>
      <path d="M376 308 L544 308 M432 272 L432 344 M488 272 L488 344" stroke="${O}" stroke-width="3" opacity="0.7"/>
      <rect x="352" y="244" width="216" height="14" rx="4" fill="var(--hus-roof)" ${LINE}/>
      <!-- Nedervåning (bredare) -->
      <rect x="320" y="360" width="320" height="152" rx="6" fill="var(--hus-house)" ${LINE}/>
      <rect x="332" y="352" width="336" height="14" rx="4" fill="var(--hus-roof)" ${LINE}/>
      <!-- Stor glasfront -->
      <rect x="336" y="378" width="180" height="134" rx="4" fill="var(--hus-wall)" ${LINE}/>
      <path d="M396 378 L396 512 M456 378 L456 512 M336 432 L516 432" stroke="${O}" stroke-width="3" opacity="0.7"/>
      <!-- Entrédörr (höger sida) -->
      <path d="M556 512 L556 402 Q556 384 584 384 Q612 384 612 402 L612 512 Z" fill="var(--hus-wall2)" ${LINE}/>
      <path d="M584 386 L584 512" stroke="${O}" stroke-width="3"/>
      <circle cx="604" cy="450" r="4.5" fill="#F7C948" ${THIN}/>
      <!-- Litet planteringskar vid entrén -->
      <rect x="526" y="494" width="20" height="18" rx="3" fill="${WOOD}" ${THIN}/>
      <circle cx="536" cy="490" r="9" fill="#6FC66F" ${THIN}/>`;
}

// --- Cirkustält: randigt tält med vimpel, girlang-kant och draperad öppning --
function cirkustaltMarkup() {
  // Vertikala rand-våder i tältväggen (varannan i husfärg).
  let rand = "";
  for (let i = 0; i < 4; i++) {
    const x = 356 + i * 72;
    rand += `<rect x="${x}" y="340" width="36" height="168" fill="var(--hus-house)" stroke="none"/>`;
  }
  return `${shadow(480, 522, 195)}
      <!-- Tältkupol (böljande våder) -->
      <path d="M480 172 Q336 244 324 340 L636 340 Q624 244 480 172 Z" fill="var(--hus-roof)" ${LINE}/>
      <path d="M480 172 Q414 250 402 340 L452 340 Q460 252 480 172 Z" fill="#FFF3DC" ${THIN}/>
      <path d="M480 172 Q546 250 558 340 L508 340 Q500 252 480 172 Z" fill="#FFF3DC" ${THIN}/>
      <!-- Vimpel i toppen -->
      ${limb("M480 172 L480 140", WOOD_DARK, 4)}
      <path d="M480 140 L518 148 L480 158 Z" fill="#F7C948" ${THIN}/>
      <!-- Tältvägg med ränder -->
      <rect x="332" y="336" width="296" height="176" fill="#FFF3DC" ${LINE}/>
      ${rand}
      <!-- Girlang-kant (hängande bågar) under kupolen -->
      <path d="M324 340 a19.5 13 0 0 0 39 0 a19.5 13 0 0 0 39 0 a19.5 13 0 0 0 39 0 a19.5 13 0 0 0 39 0 a19.5 13 0 0 0 39 0 a19.5 13 0 0 0 39 0 a19.5 13 0 0 0 39 0 a19.5 13 0 0 0 39 0" fill="var(--hus-roof)" ${THIN}/>
      <!-- Ingång: mörk öppning med uppknutna draperier -->
      <path d="M444 512 L444 420 Q444 396 480 396 Q516 396 516 420 L516 512 Z" fill="${O}" opacity="0.8" ${LINE}/>
      <path d="M444 512 L444 420 Q444 398 470 397 Q452 430 458 512 Z" fill="var(--hus-roof)" ${THIN}/>
      <path d="M516 512 L516 420 Q516 398 490 397 Q508 430 502 512 Z" fill="var(--hus-roof)" ${THIN}/>
      <!-- Runda fönster i väggen (utan överlapp) -->
      <circle cx="384" cy="428" r="18" fill="var(--hus-wall)" ${LINE}/>
      <path d="M384 410 L384 446 M366 428 L402 428" stroke="${O}" stroke-width="3"/>
      <circle cx="576" cy="428" r="18" fill="var(--hus-wall)" ${LINE}/>
      <path d="M576 410 L576 446 M558 428 L594 428" stroke="${O}" stroke-width="3"/>`;
}

// --- Rymdraket: parkerad raket på fenor, koner, kabinfönster och landgångslucka
function raketMarkup() {
  return `${shadow(480, 522, 165)}
      <!-- Fenor (bottnar på marklinjen) -->
      <path d="M418 396 Q352 438 344 512 L418 512 Z" fill="var(--hus-roof)" ${LINE}/>
      <path d="M542 396 Q608 438 616 512 L542 512 Z" fill="var(--hus-roof)" ${LINE}/>
      <!-- Raketkropp -->
      <path d="M418 512 L418 252 Q418 200 444 186 L516 186 Q542 200 542 252 L542 512 Z" fill="var(--hus-house)" ${LINE}/>
      <!-- Noskon + antenn -->
      <path d="M444 186 Q480 122 516 186 Z" fill="var(--hus-roof)" ${LINE}/>
      ${limb("M480 138 L480 120", WOOD_DARK, 3.5)}
      <circle cx="480" cy="118" r="5" fill="#EF6F6C" ${THIN}/>
      <!-- Nosband + sidopaneler -->
      <rect x="424" y="220" width="112" height="14" rx="7" fill="var(--hus-wall2)" ${THIN}/>
      <path d="M430 260 L430 470 M530 260 L530 470" stroke="${O}" stroke-width="3" opacity="0.3"/>
      <!-- Kabinfönster (runda, utan överlapp) -->
      <circle cx="480" cy="282" r="26" fill="var(--hus-wall)" ${LINE}/>
      <path d="M480 256 L480 308 M454 282 L506 282" stroke="${O}" stroke-width="3"/>
      <circle cx="480" cy="360" r="19" fill="var(--hus-wall)" ${LINE}/>
      <path d="M480 341 L480 379 M461 360 L499 360" stroke="${O}" stroke-width="3"/>
      <!-- Landgångslucka (dörr centralt vid marken) -->
      <path d="M448 512 L448 446 Q448 420 480 420 Q512 420 512 446 L512 512 Z" fill="var(--hus-wall2)" ${LINE}/>
      <path d="M480 421 L480 512" stroke="${O}" stroke-width="3"/>
      <circle cx="500" cy="466" r="4.5" fill="#F7C948" ${THIN}/>`;
}

// --- Godishus: pepparkakshus med glasyrtak, polkagrisar och godisknappar -----
function godishusMarkup() {
  const knappar = [[398, 292, "#EF6F6C"], [452, 258, "#58C6A9"], [508, 258, "#F7C948"], [562, 292, "#B79BE0"]]
    .map(([x, y, f]) => `<circle cx="${x}" cy="${y}" r="9" fill="${f}" ${THIN}/>`)
    .join("");
  return `${shadow(480, 522, 190)}
      <!-- Huskropp (pepparkaka) -->
      <rect x="344" y="330" width="272" height="182" rx="8" fill="var(--hus-house)" ${LINE}/>
      <!-- Kaktak med snötopp och godisknappar -->
      <path d="M324 338 L480 206 L636 338 Z" fill="var(--hus-roof)" ${LINE}/>
      <path d="M446 234 L480 206 L514 234 Q480 254 446 234 Z" fill="#FFF3DC" ${THIN}/>
      ${knappar}
      <!-- Glasyr-droppar längs takfoten -->
      <path d="M330 338 a19 14 0 0 0 38 0 a19 14 0 0 0 38 0 a19 14 0 0 0 38 0 a19 14 0 0 0 38 0 a19 14 0 0 0 38 0 a19 14 0 0 0 38 0 a19 14 0 0 0 38 0 a17 13 0 0 0 34 0" fill="#FFF3DC" ${THIN}/>
      <!-- Polkagrisar vid entrén -->
      <path d="M424 512 L424 442 Q424 424 442 428" fill="none" stroke="#EF6F6C" stroke-width="11" stroke-linecap="round"/>
      <path d="M424 512 L424 442 Q424 424 442 428" fill="none" stroke="#FFFFFF" stroke-width="11" stroke-linecap="round" stroke-dasharray="10 12"/>
      <path d="M536 512 L536 442 Q536 424 518 428" fill="none" stroke="#EF6F6C" stroke-width="11" stroke-linecap="round"/>
      <path d="M536 512 L536 442 Q536 424 518 428" fill="none" stroke="#FFFFFF" stroke-width="11" stroke-linecap="round" stroke-dasharray="10 12"/>
      <!-- Dörr (rund pepparkaksdörr med glasyrbåge) -->
      <path d="M450 512 L450 448 Q450 418 480 418 Q510 418 510 448 L510 512 Z" fill="${WOOD}" ${LINE}/>
      <path d="M458 508 L458 450 Q458 428 480 428 Q502 428 502 450 L502 508" fill="none" stroke="#FFF3DC" stroke-width="4"/>
      <circle cx="498" cy="468" r="4.5" fill="#EF6F6C" ${THIN}/>
      <!-- Polkamint-fönster (runda, utan överlapp) -->
      <circle cx="392" cy="398" r="20" fill="var(--hus-wall)" ${LINE}/>
      <path d="M392 378 L392 418 M372 398 L412 398" stroke="${O}" stroke-width="3"/>
      <circle cx="568" cy="398" r="20" fill="var(--hus-wall)" ${LINE}/>
      <path d="M568 378 L568 418 M548 398 L588 398" stroke="${O}" stroke-width="3"/>`;
}

// --- Vulkanhus: bo-i-berget-vulkan med glödande krater, lava och rökpuffar ---
function vulkanMarkup() {
  return `${shadow(480, 522, 200)}
      <!-- Rökpuffar över kratern -->
      <circle cx="510" cy="150" r="15" fill="#E4E4EE" ${THIN} opacity="0.9"/>
      <circle cx="478" cy="132" r="10" fill="#E4E4EE" ${THIN} opacity="0.8"/>
      <!-- Berget -->
      <path d="M438 196 L522 196 Q562 320 644 512 L316 512 Q398 320 438 196 Z" fill="var(--hus-house)" ${LINE}/>
      <!-- Bergsskrevor (på sluttningarna, ovanför fönstren) -->
      <path d="M432 300 Q446 312 448 338 M528 300 Q514 312 512 338" fill="none" stroke="${O}" stroke-width="3" opacity="0.3"/>
      <!-- Krater -->
      <path d="M438 196 Q480 214 522 196 Q512 178 480 178 Q448 178 438 196 Z" fill="var(--hus-roof)" ${LINE}/>
      <!-- Lava som rinner ur kratern -->
      <path d="M444 199 Q446 244 430 282 Q456 268 462 226 Q472 252 482 224 Q492 254 504 228 Q508 268 532 288 Q518 246 517 198 Q480 212 444 199 Z" fill="#F49E4C" ${THIN}/>
      <path d="M460 206 Q464 232 458 252 M498 206 Q498 234 506 256" fill="none" stroke="#EF6F6C" stroke-width="4" opacity="0.7"/>
      <!-- Grottdörr (centralt) -->
      <path d="M446 512 L446 446 Q446 416 480 416 Q514 416 514 446 L514 512 Z" fill="${WOOD}" ${LINE}/>
      <path d="M480 418 L480 512" stroke="${O}" stroke-width="3"/>
      <circle cx="500" cy="464" r="4.5" fill="${WOOD_DARK}" ${THIN}/>
      <!-- Runda grott-fönster (utan överlapp) -->
      <circle cx="396" cy="452" r="19" fill="var(--hus-wall)" ${LINE}/>
      <path d="M396 433 L396 471 M377 452 L415 452" stroke="${O}" stroke-width="3"/>
      <circle cx="564" cy="452" r="19" fill="var(--hus-wall)" ${LINE}/>
      <path d="M564 433 L564 471 M545 452 L583 452" stroke="${O}" stroke-width="3"/>`;
}

/** id → { namn, emoji, markup } – slås in i HUS_SKAL i art-hus-ute.js. */
export const LYX_HUS_SKAL = {
  skepp: { namn: "Skepp", emoji: "⛵", markup: skeppMarkup },
  fotboll: { namn: "Fotbollshus", emoji: "⚽", markup: fotbollMarkup },
  skyskrapa: { namn: "Skyskrapa", emoji: "🏢", markup: skyskrapaMarkup },
  glasvilla: { namn: "Glasvilla", emoji: "🏙️", markup: glasvillaMarkup },
  // Fler lyxskal (#350) – samma stil/anslutningspunkter, id:n STABILA (Firestore).
  cirkustalt: { namn: "Cirkustält", emoji: "🎪", markup: cirkustaltMarkup },
  raket: { namn: "Rymdraket", emoji: "🚀", markup: raketMarkup },
  godishus: { namn: "Godishus", emoji: "🍭", markup: godishusMarkup },
  vulkan: { namn: "Vulkanhus", emoji: "🌋", markup: vulkanMarkup },
};
