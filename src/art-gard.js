// ============================================================================
// Pluggporten – gårds-scenerna: baksidan/gården + laggårdens interiör (SVG)
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
import { barnPlaceCountForLevel } from "./farm-core.js";
import { LADA_SKINS } from "./art-lada-skins.js";

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
// Utseendet styrs av odlingsbäddens nivå (farm.gardenTier, #333):
//   1  Enkel odlingsbädd – bar jordplätt med enkel kant
//   2  Dubbel odlingslåda – träramad låda med mittdelare (två lådor)
//   3  Växthus – dubbellådan under ett glasat växthus-skelett
// Grödorna (#odling-slots) ritas EFTER gruppen → de hamnar ovanpå glaset.
function odlingsbadd(tier = 1) {
  const rader = (tier === 1 ? [478, 508] : [468, 492, 516])
    .map(
      (y) =>
        `<path d="M112 ${y} Q205 ${y - 10} 298 ${y}" fill="none" stroke="#5C4433" stroke-width="7" stroke-linecap="round" opacity="0.55"/>`
    )
    .join("");
  const jord = `${shadow(205, 552, 130)}
    <rect x="88" y="438" width="234" height="102" rx="12" fill="#7A5A40" ${LINE}/>
    <rect x="100" y="450" width="210" height="78" rx="8" fill="#8F6A4B" stroke="none"/>
    ${rader}`;
  // Nivå 1: bara jordplätten med en låg, enkel kant runt om.
  let ram = `<rect x="84" y="434" width="242" height="110" rx="12" fill="none" stroke="${WOOD}" stroke-width="7" opacity="0.9"/>`;
  if (tier >= 2) {
    // Nivå 2+: full träram (sarg) + mittdelare → läser som en DUBBEL låda.
    ram = `<rect x="82" y="430" width="246" height="18" rx="8" fill="${WOOD}" ${LINE}/>
    <rect x="82" y="532" width="246" height="16" rx="8" fill="${WOOD}" ${LINE}/>
    <rect x="76" y="430" width="16" height="118" rx="7" fill="${WOOD_DARK}" ${LINE}/>
    <rect x="318" y="430" width="16" height="118" rx="7" fill="${WOOD_DARK}" ${LINE}/>
    <rect x="198" y="434" width="14" height="110" rx="6" fill="${WOOD}" ${THIN} opacity="0.95"/>`;
  }
  // Nivå 3: glasat växthus-skelett ÖVER lådan. Glaset är nästan genomskinligt
  // (grödorna ritas dessutom ovanpå hela gruppen) – gavelram i ljust trä.
  const vaxthus = tier >= 3
    ? `<path d="M64 436 L64 372 L205 322 L346 372 L346 436" fill="#9AD3F0" opacity="0.22" stroke="none"/>
    <path d="M64 436 L64 372 L205 322 L346 372 L346 436" fill="none" stroke="${WOOD_LIGHT}" stroke-width="9" stroke-linejoin="round"/>
    <path d="M64 436 L64 372 L205 322 L346 372 L346 436" fill="none" stroke="${O}" stroke-width="2.5" stroke-linejoin="round" opacity="0.35"/>
    <path d="M134 347 L134 436 M205 322 L205 430 M276 347 L276 436" stroke="${WOOD_LIGHT}" stroke-width="6" stroke-linecap="round"/>
    <path d="M64 400 L346 400" stroke="${WOOD_LIGHT}" stroke-width="5" stroke-linecap="round" opacity="0.85"/>
    <circle cx="205" cy="316" r="7" fill="${WOOD_LIGHT}" ${THIN}/>`
    : "";
  return `<g aria-hidden="true">
    ${jord}
    ${ram}
    ${vaxthus}
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

/**
 * Hagens FRAMKANT som egen SVG (issue #345): den främre slanan + stolp-
 * stumparna under den, i exakt samma koordinater som hage() ritar dem.
 * gard-djur.js lägger den i ett eget lager OVANPÅ djur-overlayn, så djurens
 * ben döljs bakom främre slanan → djuren ser ut att stå INNANFÖR gärdsgården
 * (bakre staketet ligger kvar i scenen bakom dem). Utan djur är lagret
 * pixel-identiskt med scenens staket (limb ritar samma streck en gång till).
 */
export function hageForgrund() {
  const stumpar = [372, 452, 532, 612]
    .map((x) => `${limb(`M${x} 548 L${x} 506`, WOOD_DARK, 9)}`)
    .join("");
  return `<svg viewBox="0 0 960 600" aria-hidden="true"
      preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    ${stumpar}
    ${limb("M364 516 L620 516", WOOD, 7)}
  </svg>`;
}

// --- Zon 3: laggårds-byggnaden (höger) --------------------------------------
// Fasaden: SKIN (#353, farm.barnSkin → LADA_SKINS) väljer fasad-FAMILJ; utan
// skin styrs den av laggårdens nivå (farm.barnLevel, #333):
//   1  Litet skjul – trärött snedtaks-skjul
//   2  Röd trälada – klassisk röd ladugård med vita knutar
//   3  Stor herrgårdslaggård – bredare, högre, med takkupol och två fönster
// Alla fasader har samma dubbeldörr (#laggard-dorr) på samma plats, så kamerans
// dörr-fokus (varld-gard.js) och klick-riggen fungerar oförändrat – plus en
// nivå-badge uppe på fasaden (kapaciteten syns oavsett skin). Dörr-gruppens
// klick-/tangentbords-rigg sätts i varld-gard.js; här bara role/tabindex/aria.
function laggard(level = 1, skin = null) {
  const dorr = `<g id="laggard-dorr" role="button" tabindex="0" aria-label="Gå in i laggården">
      <rect x="724" y="398" width="132" height="150" rx="8" fill="#FFF3DC" ${LINE}/>
      <rect x="734" y="408" width="54" height="140" rx="4" fill="${WOOD}" ${LINE}/>
      <rect x="792" y="408" width="54" height="140" rx="4" fill="${WOOD}" ${LINE}/>
      <path d="M736 412 L786 544 M786 412 L736 544" stroke="${WOOD_DARK}" stroke-width="5" stroke-linecap="round"/>
      <path d="M794 412 L844 544 M844 412 L794 544" stroke="${WOOD_DARK}" stroke-width="5" stroke-linecap="round"/>
      <circle cx="782" cy="478" r="5" fill="${O}" ${THIN}/>
      <circle cx="798" cy="478" r="5" fill="${O}" ${THIN}/>
    </g>`;
  // Nivå-badgen: liten träskylt med nivåsiffran, så uppgraderingen syns direkt.
  const badge = (x, y) => `<g aria-hidden="true">
      <circle cx="${x}" cy="${y}" r="19" fill="#FFF3DC" ${LINE}/>
      <text x="${x}" y="${y + 8}" text-anchor="middle" font-size="24" font-weight="800"
        fill="${O}" style="font-family:inherit">${level}</text>
    </g>`;
  // Skin-fasad (#353): okänt/inget skin → de klassiska nivå-fasaderna nedan.
  const s = skin && LADA_SKINS[skin];
  if (s) return s.fasad({ level, dorr, badge, shadow });
  if (level <= 1) {
    // Litet skjul: trä-färgad fasad med enkelt snedtak och en liten lykta.
    return `<g aria-hidden="false">
    ${shadow(786, 552, 140)}
    <rect x="668" y="386" width="236" height="162" rx="10" fill="${WOOD}" ${LINE}/>
    <path d="M668 402 L904 402 M668 448 L716 448 M864 448 L904 448" stroke="${WOOD_DARK}" stroke-width="4" opacity="0.4"/>
    <path d="M648 398 L688 316 L906 330 L922 398 Z" fill="${WOOD_DARK}" ${LINE}/>
    <rect x="676" y="420" width="40" height="46" rx="6" fill="#9AD3F0" ${LINE}/>
    <path d="M696 424 L696 462 M680 443 L712 443" stroke="${O}" stroke-width="3" stroke-linecap="round"/>
    ${dorr}
    ${badge(700, 352)}
  </g>`;
  }
  if (level === 2) {
    // Röd trälada (ursprungsfasaden från #328).
    return `<g aria-hidden="false">
    ${shadow(790, 552, 165)}
    <rect x="656" y="330" width="268" height="218" rx="10" fill="#C4574A" ${LINE}/>
    <path d="M636 340 L700 240 L880 240 L944 340 Z" fill="${WOOD_DARK}" ${LINE}/>
    <rect x="690" y="228" width="200" height="24" rx="10" fill="#C4574A" ${LINE}/>
    <rect x="656" y="336" width="16" height="212" rx="6" fill="#FFF3DC" ${THIN}/>
    <rect x="908" y="336" width="16" height="212" rx="6" fill="#FFF3DC" ${THIN}/>
    <circle cx="790" cy="292" r="20" fill="#FFF3DC" ${LINE}/>
    <path d="M790 276 L790 308 M774 292 L806 292" stroke="${O}" stroke-width="3.5" stroke-linecap="round"/>
    ${dorr}
    <rect x="676" y="420" width="40" height="46" rx="6" fill="#9AD3F0" ${LINE}/>
    <path d="M696 424 L696 462 M680 443 L712 443" stroke="${O}" stroke-width="3" stroke-linecap="round"/>
    ${badge(880, 292)}
  </g>`;
  }
  // Nivå 3: stor herrgårdslaggård – bredare och högre, kupol med vindflöjel,
  // dubbla höloftsfönster och vita knutar hela vägen.
  return `<g aria-hidden="false">
    ${shadow(786, 554, 185)}
    <rect x="624" y="300" width="326" height="248" rx="10" fill="#C4574A" ${LINE}/>
    <path d="M604 312 L676 212 L898 212 L946 312 Z" fill="${WOOD_DARK}" ${LINE}/>
    <rect x="664" y="200" width="246" height="24" rx="10" fill="#C4574A" ${LINE}/>
    <!-- Takkupol med vindflöjel -->
    <rect x="758" y="158" width="64" height="48" rx="8" fill="#FFF3DC" ${LINE}/>
    <path d="M750 162 L790 132 L830 162 Z" fill="${WOOD_DARK}" ${LINE}/>
    <path d="M790 132 L790 104 M778 112 L804 112" stroke="${O}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="790" cy="184" r="9" fill="#9AD3F0" ${THIN}/>
    <!-- Vita knutar -->
    <rect x="624" y="306" width="16" height="242" rx="6" fill="#FFF3DC" ${THIN}/>
    <rect x="934" y="306" width="16" height="242" rx="6" fill="#FFF3DC" ${THIN}/>
    <!-- Dubbla runda höloftsfönster -->
    <circle cx="712" cy="262" r="19" fill="#FFF3DC" ${LINE}/>
    <path d="M712 247 L712 277 M697 262 L727 262" stroke="${O}" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="868" cy="262" r="19" fill="#FFF3DC" ${LINE}/>
    <path d="M868 247 L868 277 M853 262 L883 262" stroke="${O}" stroke-width="3.5" stroke-linecap="round"/>
    ${dorr}
    <!-- Fönster på båda sidor om dörren -->
    <rect x="656" y="416" width="44" height="50" rx="6" fill="#9AD3F0" ${LINE}/>
    <path d="M678 420 L678 462 M660 441 L696 441" stroke="${O}" stroke-width="3" stroke-linecap="round"/>
    <rect x="878" y="416" width="44" height="50" rx="6" fill="#9AD3F0" ${LINE}/>
    <path d="M900 420 L900 462 M882 441 L918 441" stroke="${O}" stroke-width="3" stroke-linecap="round"/>
    ${badge(790, 330)}
  </g>`;
}

/**
 * Hela gårds-scenen ("Baksida & Gården") som SVG-sträng: himmel i övre halvan,
 * gräs i nedre, tre zoner (odlingsbädd/hage/laggård). Samma viewBox/stil som
 * husScen så kamerazoomen känns som samma värld. Odlingsbäddens och laggårdens
 * utseende styrs av elevens nivåer (#333) + valt lada-skin (#353) –
 * varld-gard.js skickar in dem.
 * @param {{gardenTier?: number, barnLevel?: number, barnSkin?: string|null}} [nivaer]
 */
export function gardScen({ gardenTier = 1, barnLevel = 1, barnSkin = null } = {}) {
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

    ${odlingsbadd(gardenTier)}
    ${hage()}
    ${laggard(barnLevel, barnSkin)}
  </svg>`;
}

/**
 * Laggårds-fasaden tätt beskuren som egen SVG – förhandsvisning i lada-skin-
 * väljaren (#353, varld-lada-skin.js). skin null = klassiska nivå-fasaden.
 */
export function ladaPreview(skin = null, level = 1) {
  return `<svg viewBox="596 88 368 500" aria-hidden="true" focusable="false"
      preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg">${laggard(level, skin)}</svg>`;
}

// --- Interiören: inne i laggården -------------------------------------------

/** Ett bås (spilta): väggpanel-avdelare med överliggare. x = vänsterkant. */
function spilta(x, arm = 220) {
  return `${limb(`M${x} 470 L${x} 250`, WOOD_DARK, 10)}
    <rect x="${x - 6}" y="250" width="12" height="150" rx="5" fill="${WOOD}" ${LINE}/>
    ${limb(`M${x} 322 L${x + arm} 322`, WOOD, 8)}`;
}

/** En foderho framför ett bås, centrerad på cx vid golvlinjen. s = skala i
 * bredd (fler spiltor per nivå → smalare hoar så alla ryms på golvet). */
function foderho(cx, s = 1) {
  return `${shadow(cx, 512, 74 * s)}
    <path d="M${cx - 70 * s} 452 L${cx + 70 * s} 452 L${cx + 54 * s} 500 L${cx - 54 * s} 500 Z" fill="${WOOD}" ${LINE}/>
    <path d="M${cx - 56 * s} 460 L${cx + 56 * s} 460 L${cx + 46 * s} 492 L${cx - 46 * s} 492 Z" fill="${WOOD_DARK}" stroke="none"/>
    <!-- Lite hö i hoarna så rummet inte känns kalt -->
    <path d="M${cx - 44 * s} 462 Q${cx} 446 ${cx + 44 * s} 462" fill="none" stroke="#E3C86B" stroke-width="6" stroke-linecap="round"/>`;
}

/**
 * Spiltraden i interiören: en foderho per djurplats (barnPlaceCountForLevel,
 * #333) med spilt-avdelare mellan – nivå 1 ger 2 platser, nivå 3 hela 8, så
 * hoarna skalas ner ju fler de är för att alla ska rymmas längs golvet.
 */
function spiltRad(platser) {
  const s = platser <= 2 ? 1 : platser <= 4 ? 0.72 : 0.45;
  const steg = 960 / platser;
  let ut = "";
  for (let i = 1; i < platser; i++) ut += spilta(Math.round(i * steg), Math.min(220, steg - 40));
  for (let i = 0; i < platser; i++) ut += foderho(Math.round(steg / 2 + i * steg), s);
  return ut;
}

/**
 * Laggårdens interiör som SVG-sträng: träpanelväggar samt spiltor/bås med
 * foderhoar – antalet styrs av laggårdens nivå (farm.barnLevel, #333; 2/4/8
 * platser). Ett valt lada-skin (#353) TONAR vägg/panel/golv (LADA_SKINS[].inne)
 * så insidan matchar fasaden – spiltor/foderhoar förblir trä (möbler, inte
 * väggar) och layouten/zonerna är identiska oavsett skin. Samma viewBox-princip
 * som rummet: väggar/golv övertecknade utanför viewBoxen. Djuren i ladan ritas
 * ovanpå av gard-djur.js.
 * @param {number} [barnLevel] laggårdens nivå (1–3)
 * @param {string|null} [barnSkin] valt lada-skin (farm.barnSkin) eller null
 */
export function laggardScen(barnLevel = 1, barnSkin = null) {
  const platser = barnPlaceCountForLevel(barnLevel);
  const ton = (barnSkin && LADA_SKINS[barnSkin] && LADA_SKINS[barnSkin].inne) || {};
  const vagg = ton.vagg || WOOD, morkt = ton.morkt || WOOD_DARK, golv = ton.golv || "#D9B98C";
  // Liggande panelbrädor på bakväggen (streck i väggfärgens mörkare ton).
  const panel = [96, 168, 240, 312, 384]
    .map((y) => `<path d="M-2400 ${y} L3360 ${y}" stroke="${morkt}" stroke-width="4" opacity="0.35"/>`)
    .join("");
  return `<svg viewBox="0 0 960 600" role="img" aria-label="Inne i laggården"
      preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    <!-- Bakvägg i panel + golv, båda övertecknade utanför viewBoxen -->
    <rect x="-2400" y="-1500" width="5760" height="3600" fill="${vagg}"/>
    ${panel}
    <rect x="-2400" y="430" width="5760" height="1700" fill="${golv}"/>
    <path d="M-2400 430 L3360 430" stroke="${O}" stroke-width="6"/>
    <!-- Takbjälke -->
    <rect x="-2400" y="52" width="5760" height="26" fill="${morkt}" ${LINE}/>

    <!-- Fönster på bakväggen: dagsljus in i laggården -->
    <rect x="430" y="140" width="104" height="92" rx="10" fill="#9AD3F0" ${LINE}/>
    <path d="M482 146 L482 226 M436 186 L528 186" stroke="${O}" stroke-width="4" stroke-linecap="round"/>
    <rect x="422" y="228" width="120" height="12" rx="6" fill="${WOOD_LIGHT}" ${THIN}/>

    <!-- Bås (spiltor) med varsin foderho – en per djurplats i nivån -->
    ${spiltRad(platser)}
    <!-- Osynlig promenad-zon: djurens (#330) rörelseyta på ladugårdsgolvet,
         nedanför foderhoarna så djuren inte "kliver upp" i dem. Mäts av
         gard-djur.js precis som #hage-zon. -->
    <rect id="lada-zon" x="170" y="500" width="640" height="72" fill="none" stroke="none" pointer-events="none"/>
    <!-- En höbal i hörnet som detalj (bara när spiltorna inte når ända ut) -->
    ${platser <= 2 ? `<g>${shadow(80, 522, 60)}
      <rect x="28" y="446" width="110" height="70" rx="12" fill="#E3C86B" ${LINE}/>
      <path d="M36 470 L130 470 M36 492 L130 492" stroke="#B99A3B" stroke-width="4" stroke-linecap="round"/>
      ${limb("M28 480 L138 480", WOOD_DARK, 5)}</g>` : ""}
  </svg>`;
}
