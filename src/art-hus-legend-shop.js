// ============================================================================
// Pluggporten – LEGENDARISKA köpbara husskal (kristallgrotta, drakgrotta,
// månbas, kändisvilla, maktpyramid) – de dyraste husskalen i shoppen
// (shop-items.js, 13 000–15 000 coins). KÖPBARA, ej lådvinster.
// ----------------------------------------------------------------------------
// Egen-tecknade SVG-exteriörer som följer EXAKT samma koordinatsystem/anslut-
// ningspunkter som stugan m.fl. i art-hus-ute.js:
//   - huset ritas kring x 300–660, marklinjen (husets botten) y ≈ 512
//   - fasad/tak/vägg färgas via CSS-variablerna --hus-house / --hus-roof /
//     --hus-wall / --hus-wall2 så varje elevs palett slår igenom
//   - dörr/entré ungefär centralt, fönster utan överlapp, inget "flygande tak"
//     – allt bottnar (direkt eller via sockel/energistråle) på marklinjen.
// Registret LEGEND_SHOP_HUS_SKAL spreadas in i HUS_SKAL (art-hus-ute.js), precis
// som LYX/NATUR/RETRO/NOJE_HUS_SKAL, så skalen dyker upp i "🏠 Nytt hus"-väljaren
// och by-vyn utan särfall. Id:na sparas i Firestore (ownedItems/husSkalId) →
// håll dem STABILA. Konsten är egen-tecknad; INGA varumärken eller logotyper.
//
// OBS: tre av dessa tangerar tema med LÅDHUSEN i art-hus-legendary.js (Drakborg,
// Rymdstation, Gyllene pyramid). Dessa är HELT NYA, separata hus med egna id och
// egen ritning – gjorda visuellt distinkta. Rör INTE art-hus-legendary.js.
// ============================================================================

import { O, LINE, THIN, limb } from "./art-style.js";

const WOOD = "#B0805A";
const WOOD_DARK = "#8A6242";
const CREAM = "#FFF3DC";
const GOLD = "#F7C948";
const GOLD_DARK = "#C89B4A";
const SILVER = "#C9D3E0";
const SILVER_DARK = "#8FA0B8";
const RED = "#EF6F6C";
const LEAF = "#6FC66F";
const LEAF_DARK = "#4E9E52";
const AQUA = "#7FC7E8";
const RAINBOW = ["#EF6F6C", "#F49E4C", "#F7C948", "#6FC66F", "#7FC7E8", "#B79BE0"];

const shadow = (cx, cy, rx) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${(rx * 0.22).toFixed(1)}" fill="${O}" opacity="0.09"/>`;

// Femuddig fylld stjärna kring (cx,cy) – glitter/stjärnstoft-accenter.
function star5(cx, cy, R, c, r = R * 0.42) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = (-90 * Math.PI) / 180 + (i * Math.PI) / 5;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return `<path d="M${pts.join(" L")} Z" fill="${c}" ${THIN}/>`;
}

// Glittrande kristall/juvel: en spetsig ädelsten (romb med facett-linjer).
function kristall(cx, cy, w, h, fill) {
  const t = cy - h / 2, b = cy + h / 2, l = cx - w / 2, r = cx + w / 2;
  const sh = t + h * 0.32; // "skuldra" där topp-facetten möter sidorna
  return `<path d="M${cx} ${t} L${r} ${sh} L${cx} ${b} L${l} ${sh} Z" fill="${fill}" ${THIN}/>
      <path d="M${l} ${sh} L${cx} ${sh} L${r} ${sh} M${cx} ${t} L${cx} ${b}"
        stroke="#fff" stroke-width="1.4" opacity="0.55" fill="none"/>`;
}

// ============================================================================
// 1. MAGISK KRISTALLGROTTA 💎 – berghus vars väggar är täckta av glittrande,
//    självlysande kristaller i regnbågens färger.
// ============================================================================
function kristallgrottaMarkup() {
  // Kristaller strödda över bergssidan (fasta regnbågsfärger, ej palett).
  const gems = [
    [372, 340, 22, 40], [418, 300, 18, 34], [560, 336, 24, 44], [600, 388, 16, 30],
    [356, 430, 18, 34], [612, 458, 16, 30], [430, 458, 14, 26], [548, 470, 14, 26],
  ]
    .map(([x, y, w, h], i) => kristall(x, y, w, h, RAINBOW[i % RAINBOW.length]))
    .join("");
  // Små gnistror ovanför berget.
  const gnistror = [[430, 230], [530, 210], [480, 180]]
    .map(([x, y], i) => star5(x, y, 6 - i, "#fff", 2)).join("");
  return `${shadow(480, 516, 198)}
      ${gnistror}
      <!-- Berget (grotta) -->
      <path d="M436 214 L524 214 Q566 336 646 512 L314 512 Q394 336 436 214 Z" fill="var(--hus-house)" ${LINE}/>
      <!-- Kristallformad topp (istället för krater) -->
      ${kristall(480, 210, 52, 96, "var(--hus-roof)")}
      <!-- Glittrande kristaller över bergssidorna -->
      ${gems}
      <!-- Grottöppning (dörr) med lysande kristall-båge, central -->
      <path d="M440 512 L440 428 Q440 396 480 396 Q520 396 520 428 L520 512 Z" fill="${O}" opacity="0.85" ${LINE}/>
      <path d="M456 512 L456 434 Q456 410 480 410 Q504 410 504 434 L504 512 Z" fill="var(--hus-wall)" opacity="0.6" stroke="none"/>
      <path d="M440 428 Q480 388 520 428" fill="none" stroke="${AQUA}" stroke-width="5" stroke-linecap="round"/>
      <circle cx="480" cy="404" r="7" fill="#fff" ${THIN}/>
      <!-- Runda kristall-fönster (utan överlapp) -->
      <circle cx="404" cy="452" r="19" fill="var(--hus-wall)" ${LINE}/>
      <path d="M404 433 L404 471 M385 452 L423 452" stroke="${O}" stroke-width="3"/>
      <circle cx="576" cy="418" r="19" fill="var(--hus-wall)" ${LINE}/>
      <path d="M576 399 L576 437 M557 418 L595 418" stroke="${O}" stroke-width="3"/>`;
}

// ============================================================================
// 2. DRAKGROTTA 🐲 – mäktig borg byggd av drakfjäll, rykande rök ur skorstenen,
//    drakhuvud vid porten. (HELT distinkt från lådans "Drakborg".)
// ============================================================================
function drakgrottaMarkup() {
  // Fjäll-mönster (överlappande bågar) över borgkroppen, klippt mot väggen.
  let fjall = "";
  for (let row = 0; row < 5; row++) {
    const y = 320 + row * 40;
    const off = row % 2 ? 26 : 0;
    for (let x = 344 + off; x < 620; x += 52)
      fjall += `<path d="M${x} ${y} q26 -22 52 0" fill="none" stroke="${O}" stroke-width="2.2" opacity="0.3"/>`;
  }
  const kropp = "M348 320 L348 512 L612 512 L612 320 Q480 262 348 320 Z";
  return `${shadow(480, 514, 196)}
      <!-- Skorsten med rykande rök -->
      <rect x="392" y="248" width="40" height="86" rx="6" fill="var(--hus-wall2)" ${LINE}/>
      <g class="hus-rok"><circle cx="412" cy="238" r="13" fill="#fff" opacity="0.8"/></g>
      <g class="hus-rok r2"><circle cx="412" cy="238" r="9" fill="#fff" opacity="0.8"/></g>
      <g class="hus-rok r3"><circle cx="412" cy="238" r="11" fill="#fff" opacity="0.8"/></g>
      <!-- Borgkropp av drakfjäll -->
      <defs><clipPath id="drakg-fjall"><path d="${kropp}"/></clipPath></defs>
      <path d="${kropp}" fill="var(--hus-house)" ${LINE}/>
      <g clip-path="url(#drakg-fjall)">${fjall}</g>
      <path d="${kropp}" fill="none" ${LINE}/>
      <!-- Fjäll-krön längs takryggen -->
      <path d="M348 320 Q414 296 480 294 Q546 296 612 320" fill="none" ${LINE}/>
      <path d="M420 300 L432 274 L446 300 M480 296 L492 268 L504 296 M540 300 L552 276 L566 300"
        fill="var(--hus-roof)" ${THIN}/>
      <!-- Drakhuvud ovanför porten (grön drake, egen ritning) -->
      <path d="M446 384 Q432 356 456 344 Q446 366 468 366 Q470 344 486 348 Q478 366 498 368 Q516 356 512 384 Q480 372 446 384 Z"
        fill="var(--hus-roof)" ${LINE}/>
      <path d="M448 356 L438 340 M512 356 L522 340" stroke="${O}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="464" cy="366" r="3.4" fill="${GOLD}"/>
      <circle cx="496" cy="366" r="3.4" fill="${GOLD}"/>
      <!-- Spetsig borgport (drakgap), central -->
      <path d="M440 512 L440 408 Q440 388 480 388 Q520 388 520 408 L520 512 Z" fill="${O}" opacity="0.85" ${LINE}/>
      <path d="M448 512 L448 414 L472 512 M512 512 L512 414 L488 512" fill="${GOLD}" ${THIN}/>
      <!-- Tornfönster (utan överlapp) -->
      <rect x="370" y="404" width="30" height="42" rx="15" fill="var(--hus-wall)" ${LINE}/>
      <path d="M385 408 L385 442" stroke="${O}" stroke-width="3"/>
      <rect x="560" y="404" width="30" height="42" rx="15" fill="var(--hus-wall)" ${LINE}/>
      <path d="M575 408 L575 442" stroke="${O}" stroke-width="3"/>`;
}

// ============================================================================
// 3. MÅNBAS 🌘 – toppmodern silvrig rymdstation med kupoler och landningsplatta.
//    (HELT distinkt från lådans svävande "Rymdstation".)
// ============================================================================
function manbasMarkup() {
  // Blinkljus längs huvudkupolens sockel.
  const ljus = [408, 448, 512, 552]
    .map((x, i) => `<circle cx="${x}" cy="424" r="5" fill="${i % 2 ? RED : GOLD}" ${THIN}/>`)
    .join("");
  return `${shadow(480, 520, 200)}
      <!-- Landningsplatta på marken -->
      <ellipse cx="480" cy="506" rx="182" ry="26" fill="var(--hus-wall2)" ${LINE}/>
      <ellipse cx="480" cy="504" rx="120" ry="15" fill="none" stroke="${GOLD}" stroke-width="3" stroke-dasharray="10 12" opacity="0.8"/>
      <path d="M420 504 L436 496 M544 496 L560 504" stroke="${O}" stroke-width="3" stroke-linecap="round"/>
      <!-- Sidokupol (mindre), höger, på ett ben ner till plattan -->
      <rect x="586" y="452" width="14" height="46" fill="${SILVER_DARK}" ${THIN}/>
      <path d="M556 452 Q556 402 596 402 Q636 402 636 452 Z" fill="${SILVER}" ${LINE}/>
      <rect x="576" y="430" width="20" height="20" rx="4" fill="var(--hus-wall)" ${THIN}/>
      <!-- Sidokupol (mindre), vänster -->
      <rect x="360" y="458" width="14" height="42" fill="${SILVER_DARK}" ${THIN}/>
      <path d="M336 458 Q336 414 372 414 Q408 414 408 458 Z" fill="${SILVER}" ${LINE}/>
      <rect x="356" y="438" width="18" height="18" rx="4" fill="var(--hus-wall)" ${THIN}/>
      <!-- Förbindelserör mellan kupolerna -->
      <rect x="398" y="466" width="164" height="20" rx="10" fill="${SILVER_DARK}" ${THIN}/>
      <!-- Huvudkupol (stor, silvrig) -->
      <path d="M338 452 Q338 300 480 300 Q622 300 622 452 Z" fill="var(--hus-house)" ${LINE}/>
      <ellipse cx="480" cy="452" rx="142" ry="20" fill="${SILVER}" ${THIN}/>
      ${ljus}
      <!-- Glans-streck på kupolen -->
      <path d="M400 400 Q420 340 480 330" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="0.6"/>
      <!-- Antenn med blinkljus i toppen -->
      ${limb("M480 300 L480 262", SILVER_DARK, 4)}
      <circle cx="480" cy="256" r="8" fill="${RED}" ${LINE}/>
      <circle cx="480" cy="256" r="3" fill="#FDE9A8"/>
      <!-- Runda kupol-fönster (portholes, utan överlapp) -->
      <circle cx="416" cy="392" r="20" fill="var(--hus-wall)" ${LINE}/>
      <path d="M416 372 L416 412 M396 392 L436 392" stroke="${O}" stroke-width="3"/>
      <circle cx="544" cy="392" r="20" fill="var(--hus-wall)" ${LINE}/>
      <path d="M544 372 L544 412 M524 392 L564 392" stroke="${O}" stroke-width="3"/>
      <!-- Sluss-dörr (central, ner till plattan) -->
      <path d="M448 494 L448 418 Q448 396 480 396 Q512 396 512 418 L512 494 Z" fill="var(--hus-wall2)" ${LINE}/>
      <path d="M480 398 L480 494" stroke="${O}" stroke-width="3"/>
      <circle cx="470" cy="470" r="3.5" fill="${GOLD}"/>
      <circle cx="490" cy="470" r="3.5" fill="${GOLD}"/>`;
}

// ============================================================================
// 4. KÄNDISVILLA (Hollywood-stil) 🌟 – lyxig herrgård med stor pool, palmer och
//    röd matta vid entrén.
// ============================================================================
function kandisvillaMarkup() {
  // Pelare framför nedervåningen.
  const pelare = (x) =>
    `<rect x="${x}" y="400" width="16" height="108" fill="${CREAM}" ${LINE}/>
     <rect x="${x - 4}" y="396" width="24" height="10" rx="3" fill="${CREAM}" ${THIN}/>
     <rect x="${x - 4}" y="502" width="24" height="10" rx="3" fill="${CREAM}" ${THIN}/>`;
  return `${shadow(480, 514, 200)}
      <!-- Pool (vänster, på marken) -->
      <ellipse cx="360" cy="500" rx="66" ry="18" fill="${AQUA}" ${LINE}/>
      <path d="M320 498 Q360 490 400 498 M330 504 Q360 498 392 504" fill="none" stroke="#fff" stroke-width="2.4" opacity="0.7"/>
      <!-- Palm (höger, bakom villan) -->
      ${limb("M628 508 L620 400", WOOD, 9)}
      <path d="M620 400 Q580 384 560 400 M620 400 Q660 384 680 402 M620 400 Q604 366 596 372 M620 400 Q636 366 648 374"
        fill="none" stroke="${LEAF_DARK}" stroke-width="9" stroke-linecap="round"/>
      <path d="M620 400 Q582 388 566 402 M620 400 Q658 388 676 404 M620 400 Q606 370 600 376 M620 400 Q634 370 642 378"
        fill="none" stroke="${LEAF}" stroke-width="5" stroke-linecap="round"/>
      <circle cx="620" cy="400" r="6" fill="${WOOD_DARK}" ${THIN}/>
      <!-- Villa: övervåning (indragen) -->
      <rect x="404" y="300" width="168" height="96" rx="6" fill="var(--hus-house)" ${LINE}/>
      <rect x="396" y="292" width="184" height="14" rx="4" fill="var(--hus-roof)" ${LINE}/>
      <rect x="424" y="322" width="46" height="52" rx="4" fill="var(--hus-wall)" ${LINE}/>
      <path d="M447 322 L447 374 M424 348 L470 348" stroke="${O}" stroke-width="3" opacity="0.7"/>
      <rect x="506" y="322" width="46" height="52" rx="4" fill="var(--hus-wall)" ${LINE}/>
      <path d="M529 322 L529 374 M506 348 L552 348" stroke="${O}" stroke-width="3" opacity="0.7"/>
      <!-- Nedervåning (bredare) med pelare -->
      <rect x="384" y="392" width="208" height="120" rx="6" fill="var(--hus-house)" ${LINE}/>
      ${pelare(416)}
      ${pelare(528)}
      <!-- Röd matta vid entrén (central, ner till marken) -->
      <path d="M452 512 L508 512 L524 560 L436 560 Z" fill="${RED}" ${LINE}/>
      <path d="M452 512 L508 512 L512 524 L448 524 Z" fill="#C94E4B" stroke="none"/>
      <!-- Entrédörr (glasglittrig, central) -->
      <path d="M456 512 L456 420 Q456 398 480 398 Q504 398 504 420 L504 512 Z" fill="var(--hus-wall2)" ${LINE}/>
      <path d="M480 400 L480 512" stroke="${O}" stroke-width="3"/>
      <circle cx="470" cy="458" r="3.5" fill="${GOLD}"/>
      <circle cx="490" cy="458" r="3.5" fill="${GOLD}"/>
      <!-- Stjärn-accenter (Hollywood) -->
      ${star5(480, 276, 9, GOLD, 3.4)}
      ${star5(360, 470, 6, "#fff", 2.2)}`;
}

// ============================================================================
// 5. DEN GYLLENE SVÄVANDE MAKTPYRAMIDEN 🔺 – exklusiv guldpyramid som SVÄVAR i
//    luften, omgiven av magiskt energifält, svävande hologram & stjärnstoft.
//    (HELT distinkt från lådans mark-stående "Gyllene pyramid".)
// ============================================================================
function maktpyramidMarkup() {
  // Stjärnstoft runt pyramiden.
  const stoft = [[338, 300], [628, 288], [372, 220], [590, 232], [480, 168], [412, 452], [560, 452]]
    .map(([x, y], i) => star5(x, y, 3 + (i % 3), "#FDE9A8", 1.4)).join("");
  return `${shadow(480, 520, 176)}
      <!-- Magiskt energifält (aura-ovaler) runt hela pyramiden -->
      <ellipse cx="480" cy="336" rx="196" ry="180" fill="none" stroke="${AQUA}" stroke-width="4" opacity="0.35"/>
      <ellipse cx="480" cy="336" rx="168" ry="156" fill="none" stroke="${GOLD}" stroke-width="3" opacity="0.4"/>
      ${stoft}
      <!-- Energistråle ner till marken (så pyramiden inte "flyger" fritt) -->
      <path d="M436 452 L524 452 L556 508 L404 508 Z" fill="${AQUA}" opacity="0.25" stroke="none"/>
      <path d="M462 452 L498 452 L508 508 L452 508 Z" fill="${GOLD}" opacity="0.3" stroke="none"/>
      <ellipse cx="480" cy="508" rx="90" ry="14" fill="${AQUA}" opacity="0.3" stroke="none"/>
      <!-- Svävande pyramid (basen y≈452, spets y≈176) -->
      <path d="M320 452 L480 176 L640 452 Z" fill="var(--hus-house)" ${LINE}/>
      <!-- Solbelyst höger sida -->
      <path d="M480 176 L640 452 L480 452 Z" fill="${GOLD}" opacity="0.3" stroke="none"/>
      <!-- Gyllene stenskift-linjer -->
      <path d="M384 342 L576 342 M352 398 L608 398" stroke="${GOLD_DARK}" stroke-width="2.4" opacity="0.5" fill="none"/>
      <path d="M480 176 L480 452" stroke="${O}" stroke-width="2.2" opacity="0.25"/>
      <!-- Toppsten med lysande makt-juvel -->
      <path d="M452 244 L480 176 L508 244 Z" fill="var(--hus-roof)" ${LINE}/>
      <circle cx="480" cy="222" r="9" fill="${GOLD}" ${LINE}/>
      <circle cx="480" cy="222" r="4" fill="#FDE9A8"/>
      ${star5(480, 168, 9, "#FDE9A8", 3.4)}
      <!-- Svävande hologram (halvgenomskinliga rutor med symbol) bredvid pyramiden -->
      <g opacity="0.55">
        <rect x="286" y="340" width="46" height="40" rx="5" fill="${AQUA}" ${THIN}/>
        <path d="M296 360 L316 360 M306 350 L306 370" stroke="#fff" stroke-width="2.4"/>
      </g>
      <g opacity="0.55">
        <rect x="626" y="356" width="46" height="40" rx="5" fill="${AQUA}" ${THIN}/>
        <circle cx="649" cy="376" r="10" fill="none" stroke="#fff" stroke-width="2.4"/>
      </g>
      <!-- Lysande portal (dörr) -->
      <path d="M440 452 L440 344 Q440 316 480 316 Q520 316 520 344 L520 452 Z" fill="var(--hus-wall)" ${LINE}/>
      <path d="M456 452 L456 350 Q456 332 480 332 Q504 332 504 350 L504 452 Z" fill="#FDE9A8" opacity="0.6" stroke="none"/>
      <path d="M480 332 L480 452" stroke="${GOLD_DARK}" stroke-width="3" stroke-linecap="round"/>
      <!-- Rundfönster i sidorna (utan överlapp) -->
      <circle cx="404" cy="418" r="16" fill="var(--hus-wall)" ${LINE}/>
      <path d="M404 402 L404 434 M388 418 L420 418" stroke="${O}" stroke-width="3"/>
      <circle cx="556" cy="418" r="16" fill="var(--hus-wall)" ${LINE}/>
      <path d="M556 402 L556 434 M540 418 L572 418" stroke="${O}" stroke-width="3"/>`;
}

/** id → { namn, emoji, markup } – slås in i HUS_SKAL i art-hus-ute.js. */
export const LEGEND_SHOP_HUS_SKAL = {
  kristallgrotta: { namn: "Magisk Kristallgrotta", emoji: "💎", markup: kristallgrottaMarkup },
  drakgrotta: { namn: "Drakgrotta", emoji: "🐲", markup: drakgrottaMarkup },
  manbas: { namn: "Månbas", emoji: "🌘", markup: manbasMarkup },
  kandisvilla: { namn: "Kändisvilla", emoji: "🌟", markup: kandisvillaMarkup },
  maktpyramid: { namn: "Gyllene Maktpyramiden", emoji: "🔺", markup: maktpyramidMarkup },
};
