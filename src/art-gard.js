// ============================================================================
// Pluggportalen – gårds-scenerna: baksidan/gården + laggårdens interiör (SVG)
// ----------------------------------------------------------------------------
// Ritar de TVÅ nya nivåerna bakom huset (issue #328) i samma stil och samma
// koordinatsystem som ute-scenen (art-hus-ute.js): viewBox 960×600, kontur O
// (art-style.js), himmel/gräs övertecknade långt utanför viewBoxen så
// letterbox-ytan fylls (styles.css ger lagrets svg overflow:visible).
//
//   gardScen()     "Baksida & Gården": gräs i nedre halvan, himmel i övre.
//                  Tre placeholder-zoner (ingen odlings-/djur-logik än):
//                  odlingsbädd (vänster), hage/inhägnad (mitten) och
//                  laggårds-byggnaden med dörr (höger). Dörren (#laggard-dorr)
//                  görs klickbar av varld-gard.js → laggårds-interiören.
//   laggardScen()  "Inne i Laggården": träpanel, spiltor/bås och foderhoar –
//                  också ett tomt skal som fylls av kommande djur-issues.
//
// OBS: modulen ligger MEDVETET utanför den statiska bootgrafen – den importeras
// bara dynamiskt via varld-gard.js (se incident #271: inga nya filer i boot-
// kedjan). Allt är %-baserat via viewBox + preserveAspectRatio, precis som
// husScen, så scenerna skalar med .varld-stage utan egna mått.
// ============================================================================

import { O, LINE, THIN, limb } from "./art-style.js";

// Samma trä-färger som stilguiden/art-hus-ute.js (färgas aldrig om av paletten).
const WOOD = "#B0805A";
const WOOD_DARK = "#8A6242";
const WOOD_LIGHT = "#E0B98C";

const shadow = (cx, cy, rx) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${(rx * 0.22).toFixed(1)}" fill="${O}" opacity="0.09"/>`;

function molnArt(x, y, s) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <path d="M0 20 Q-2 8 10 8 Q14 -2 26 2 Q36 -2 40 8 Q52 6 50 18 Q46 26 34 24 Q24 30 14 24 Q2 28 0 20 Z"
      fill="#FFFFFF" ${THIN} opacity="0.95"/></g>`;
}

// --- Zon 1: odlingsbädden (vänster) -----------------------------------------
// En träramad bädd med jordrader – tom placeholder tills odlings-logiken kommer.
function odlingsbadd() {
  const rader = [468, 492, 516]
    .map(
      (y) =>
        `<path d="M112 ${y} Q205 ${y - 10} 298 ${y}" fill="none" stroke="#5C4433" stroke-width="7" stroke-linecap="round" opacity="0.55"/>`
    )
    .join("");
  return `<g aria-hidden="true">
    ${shadow(205, 552, 130)}
    <rect x="88" y="438" width="234" height="102" rx="12" fill="#7A5A40" ${LINE}/>
    <rect x="100" y="450" width="210" height="78" rx="8" fill="#8F6A4B" stroke="none"/>
    ${rader}
    <!-- Träram (sarg) ovanpå jorden så bädden läser som en riktig odlingslåda -->
    <rect x="82" y="430" width="246" height="18" rx="8" fill="${WOOD}" ${LINE}/>
    <rect x="82" y="532" width="246" height="16" rx="8" fill="${WOOD}" ${LINE}/>
    <rect x="76" y="430" width="16" height="118" rx="7" fill="${WOOD_DARK}" ${LINE}/>
    <rect x="318" y="430" width="16" height="118" rx="7" fill="${WOOD_DARK}" ${LINE}/>
  </g>
  <!-- Grödorna (#329): varld-odling.js ritar elevens odlings-slots här -
       aria-hidden får därför INTE ligga på den här gruppen. -->
  <g id="odling-slots"></g>`;
}

/**
 * Mittpunkter (scen-koordinater) för odlingsbäddens slots – används av
 * varld-odling.js för att placera grödor & klickytor i bädden. Upp till 4
 * slots ryms på en rad; fler (odlingsbädds-nivå 2–3) läggs i två rader.
 * @param {number} count antal slots (slotCountForTier)
 * @returns {Array<{x:number, y:number}>}
 */
export function odlingSlotPos(count) {
  const pos = [];
  const perRad = count <= 4 ? count : Math.ceil(count / 2);
  const rader = count <= 4 ? 1 : 2;
  for (let i = 0; i < count; i++) {
    const rad = Math.floor(i / perRad);
    const kol = i % perRad;
    // Bäddens inre yta: x ≈ 100–310, jordrader vid y 468/492/516.
    const x = 205 + (kol - (perRad - 1) / 2) * (200 / Math.max(1, perRad - 1) || 0);
    const y = rader === 1 ? 505 : rad === 0 ? 486 : 524;
    pos.push({ x: Math.round(x), y });
  }
  return pos;
}

// --- Zon 2: hagen/inhägnaden (mitten) ---------------------------------------
// Enkel trägärdsgård (stolpar + två slanor) – tom hage i väntan på djuren.
function hage() {
  const stolpar = [372, 452, 532, 612]
    .map((x) => `${limb(`M${x} 548 L${x} 448`, WOOD_DARK, 9)}`)
    .join("");
  return `<g aria-hidden="true">
    ${shadow(492, 556, 150)}
    ${stolpar}
    ${limb("M364 472 L620 472", WOOD, 7)}
    ${limb("M364 516 L620 516", WOOD, 7)}
    <!-- Grindögla på sista stolpen som liten detalj -->
    <circle cx="612" cy="472" r="7" fill="none" stroke="${WOOD_DARK}" stroke-width="4"/>
    <!-- Lite gräs-tuvor inne i hagen -->
    <path d="M430 540 q4 -14 8 0 M442 540 q4 -10 8 0" fill="none" stroke="#6FA85B" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M540 536 q4 -14 8 0 M552 536 q4 -10 8 0" fill="none" stroke="#6FA85B" stroke-width="3.5" stroke-linecap="round"/>
    <!-- Osynlig promenad-zon: bondgårdsdjurens (#330) rörelseyta INNANFÖR
         gärdsgården. gard-djur.js mäter rektangeln i procent av lagret
         (getBoundingClientRect) så zonen följer scenen oavsett skärmformat. -->
    <rect id="hage-zon" x="378" y="478" width="228" height="64" fill="none" stroke="none" pointer-events="none"/>
  </g>`;
}

// --- Zon 3: laggårds-byggnaden (höger) --------------------------------------
// Röd ladugård med vita knutar och en stor dubbeldörr. Dörr-gruppen
// (#laggard-dorr) görs klickbar (→ interiören) av varld-gard.js; själva
// klick-/tangentbords-riggen sätts där, här bara role/tabindex/aria.
function laggard() {
  return `<g aria-hidden="false">
    ${shadow(790, 552, 165)}
    <!-- Fasad -->
    <rect x="656" y="330" width="268" height="218" rx="10" fill="#C4574A" ${LINE}/>
    <!-- Tak -->
    <path d="M636 340 L700 240 L880 240 L944 340 Z" fill="${WOOD_DARK}" ${LINE}/>
    <rect x="690" y="228" width="200" height="24" rx="10" fill="#C4574A" ${LINE}/>
    <!-- Vita knutar -->
    <rect x="656" y="336" width="16" height="212" rx="6" fill="#FFF3DC" ${THIN}/>
    <rect x="908" y="336" width="16" height="212" rx="6" fill="#FFF3DC" ${THIN}/>
    <!-- Litet runt höloftsfönster -->
    <circle cx="790" cy="292" r="20" fill="#FFF3DC" ${LINE}/>
    <path d="M790 276 L790 308 M774 292 L806 292" stroke="${O}" stroke-width="3.5" stroke-linecap="round"/>
    <!-- Dubbeldörren med kryss-beslag: klick → in i laggården -->
    <g id="laggard-dorr" role="button" tabindex="0" aria-label="Gå in i laggården">
      <rect x="724" y="398" width="132" height="150" rx="8" fill="#FFF3DC" ${LINE}/>
      <rect x="734" y="408" width="54" height="140" rx="4" fill="${WOOD}" ${LINE}/>
      <rect x="792" y="408" width="54" height="140" rx="4" fill="${WOOD}" ${LINE}/>
      <path d="M736 412 L786 544 M786 412 L736 544" stroke="${WOOD_DARK}" stroke-width="5" stroke-linecap="round"/>
      <path d="M794 412 L844 544 M844 412 L794 544" stroke="${WOOD_DARK}" stroke-width="5" stroke-linecap="round"/>
      <circle cx="782" cy="478" r="5" fill="${O}" ${THIN}/>
      <circle cx="798" cy="478" r="5" fill="${O}" ${THIN}/>
    </g>
    <!-- Ett litet fönster till vänster om dörren -->
    <rect x="676" y="420" width="40" height="46" rx="6" fill="#9AD3F0" ${LINE}/>
    <path d="M696 424 L696 462 M680 443 L712 443" stroke="${O}" stroke-width="3" stroke-linecap="round"/>
  </g>`;
}

/**
 * Hela gårds-scenen ("Baksida & Gården") som SVG-sträng: himmel i övre halvan,
 * gräs i nedre, tre placeholder-zoner (odlingsbädd/hage/laggård). Samma
 * viewBox/stil som husScen så kamerazoomen känns som samma värld.
 */
export function gardScen() {
  return `<svg viewBox="0 0 960 600" role="img" aria-label="Gården på baksidan av huset"
      preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="gard-himmel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9AD3F0"/><stop offset="1" stop-color="#E8F6FD"/>
    </linearGradient></defs>
    <rect x="-2400" y="-1500" width="5760" height="3600" fill="url(#gard-himmel)"/>
    <g class="hus-moln" style="--t:58s">${molnArt(0, 80, 1.1)}</g>
    <g class="hus-moln" style="--t:44s;animation-delay:-16s">${molnArt(0, 160, 0.8)}</g>

    <!-- Gräset fyller nedre halvan (horisont ~y300), övertecknat åt alla håll -->
    <path d="M-2400 310 L-480 316 Q240 280 520 312 Q760 284 1440 306 L3360 310 L3360 2100 L-2400 2100 Z" fill="#A8DA8F" ${LINE}/>
    <path d="M-2400 380 L-480 380 Q300 350 620 384 Q820 362 1440 380 L3360 380 L3360 2100 L-2400 2100 Z" fill="#8FCB74" ${LINE}/>

    <!-- Ett träd i bakkanten som binder ihop med framsidan -->
    <g>${limb("M60 396 L60 336", WOOD, 12)}
      <circle cx="60" cy="304" r="42" fill="#6FC66F" ${LINE}/>
      <circle cx="32" cy="324" r="24" fill="#6FC66F" ${LINE}/>
      <circle cx="90" cy="322" r="26" fill="#6FC66F" ${LINE}/></g>

    ${odlingsbadd()}
    ${hage()}
    ${laggard()}
  </svg>`;
}

// --- Interiören: inne i laggården -------------------------------------------

/** Ett bås (spilta): väggpanel-avdelare med överliggare. x = vänsterkant. */
function spilta(x) {
  return `${limb(`M${x} 470 L${x} 250`, WOOD_DARK, 10)}
    <rect x="${x - 6}" y="250" width="12" height="150" rx="5" fill="${WOOD}" ${LINE}/>
    ${limb(`M${x} 322 L${x + 220} 322`, WOOD, 8)}`;
}

/** En foderho framför ett bås, centrerad på cx vid golvlinjen. */
function foderho(cx) {
  return `${shadow(cx, 512, 74)}
    <path d="M${cx - 70} 452 L${cx + 70} 452 L${cx + 54} 500 L${cx - 54} 500 Z" fill="${WOOD}" ${LINE}/>
    <path d="M${cx - 56} 460 L${cx + 56} 460 L${cx + 46} 492 L${cx - 46} 492 Z" fill="${WOOD_DARK}" stroke="none"/>
    <!-- Lite hö i hoarna så rummet inte känns kalt -->
    <path d="M${cx - 44} 462 Q${cx} 446 ${cx + 44} 462" fill="none" stroke="#E3C86B" stroke-width="6" stroke-linecap="round"/>`;
}

/**
 * Laggårdens interiör som SVG-sträng: träpanelväggar, tre spiltor/bås och
 * foderhoar – ett tomt skal (djuren kommer i senare issues). Samma viewBox-
 * princip som rummet: väggar/golv övertecknade utanför viewBoxen.
 */
export function laggardScen() {
  // Liggande panelbrädor på bakväggen (streck i väggfärgens mörkare ton).
  const panel = [96, 168, 240, 312, 384]
    .map((y) => `<path d="M-2400 ${y} L3360 ${y}" stroke="${WOOD_DARK}" stroke-width="4" opacity="0.35"/>`)
    .join("");
  return `<svg viewBox="0 0 960 600" role="img" aria-label="Inne i laggården"
      preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    <!-- Bakvägg i träpanel + halmgolv, båda övertecknade utanför viewBoxen -->
    <rect x="-2400" y="-1500" width="5760" height="3600" fill="${WOOD}"/>
    ${panel}
    <rect x="-2400" y="430" width="5760" height="1700" fill="#D9B98C"/>
    <path d="M-2400 430 L3360 430" stroke="${O}" stroke-width="6"/>
    <!-- Takbjälke -->
    <rect x="-2400" y="52" width="5760" height="26" fill="${WOOD_DARK}" ${LINE}/>

    <!-- Fönster på bakväggen: dagsljus in i laggården -->
    <rect x="430" y="140" width="104" height="92" rx="10" fill="#9AD3F0" ${LINE}/>
    <path d="M482 146 L482 226 M436 186 L528 186" stroke="${O}" stroke-width="4" stroke-linecap="round"/>
    <rect x="422" y="228" width="120" height="12" rx="6" fill="${WOOD_LIGHT}" ${THIN}/>

    <!-- Tre bås (spiltor) med varsin foderho – tomma placeholders för djuren -->
    ${spilta(150)}
    ${spilta(600)}
    ${foderho(260)}
    ${foderho(710)}
    <!-- Osynlig promenad-zon: djurens (#330) rörelseyta på ladugårdsgolvet,
         nedanför foderhoarna så djuren inte "kliver upp" i dem. Mäts av
         gard-djur.js precis som #hage-zon. -->
    <rect id="lada-zon" x="170" y="500" width="640" height="72" fill="none" stroke="none" pointer-events="none"/>
    <!-- En höbal i hörnet som detalj -->
    <g>${shadow(80, 522, 60)}
      <rect x="28" y="446" width="110" height="70" rx="12" fill="#E3C86B" ${LINE}/>
      <path d="M36 470 L130 470 M36 492 L130 492" stroke="#B99A3B" stroke-width="4" stroke-linecap="round"/>
      ${limb("M28 480 L138 480", WOOD_DARK, 5)}</g>
  </svg>`;
}
