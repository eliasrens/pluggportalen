// ============================================================================
// Pluggportalen – ute-scenen: elevens hus utifrån (illustrerad SVG)
// ----------------------------------------------------------------------------
// Ritar hus-vyn (viewBox 960×600) som husvärldens "hus"-nivå använder
// (pages-varld.js). Utseendet följer design/DESIGNBESLUT-husdjur-hem-2.0.md:
//  - kontur #3B3350 (art-style.js), fönster 150×130 vid (440,330)
//  - husfasad/tak/vägg färgas via CSS-variablerna --hus-house/--hus-roof/
//    --hus-wall/--hus-wall2 (elevens palett) – golv & natur påverkas inte.
// preserveAspectRatio="slice" låter scenen FYLLA hela den stora spelcanvasen
// (himmel/gräs är övertecknade långt utanför viewBoxen i stället för att
// letterboxa). Elevens avatar ritas framför huset via foreignObject – den
// lever i scenens koordinatsystem och följer därmed alla kamerazoomar
// perfekt; storleken styrs av CSS-variabeln --varld-avatar-font (px i
// scen-koordinater).
//
// HUSSKAL: själva huset ritas av ett utbytbart "skal" ur HUS_SKAL-registret
// (husSkalMarkup). Idag finns bara "stuga", men framtida "Köp nytt hus" byter
// bara skal-id per elev – rummet/interiören påverkas inte. Både ute-scenen och
// by-vyns minihus (husMini, klassbyn i varld-by-scen.js) ritar via registret,
// så ett nytt skal slår igenom överallt.
// ============================================================================

import { O, LINE, THIN, limb } from "./art-style.js";

// Trä-färger ur stilguiden (färgas aldrig om av paletten).
const WOOD = "#B0805A";
const WOOD_DARK = "#8A6242";
const WOOD_LIGHT = "#E0B98C";

const shadow = (cx, cy, rx) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${(rx * 0.22).toFixed(1)}" fill="${O}" opacity="0.09"/>`;

const eyeDot = (x, y, r) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" ${THIN}/>` +
  `<circle cx="${x + 0.5}" cy="${y + 0.5}" r="${(r * 0.55).toFixed(1)}" fill="${O}"/>`;

function molnArt(x, y, s) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <path d="M0 20 Q-2 8 10 8 Q14 -2 26 2 Q36 -2 40 8 Q52 6 50 18 Q46 26 34 24 Q24 30 14 24 Q2 28 0 20 Z"
      fill="#FFFFFF" ${THIN} opacity="0.95"/></g>`;
}

// --- Husskal-registret ------------------------------------------------------
// Ett "skal" är hela husets exteriör (skorsten+rök, fasad, tak, dörr, fönster,
// blomlåda) ritad i ute-scenens koordinater (huset kring x 300–660, marklinje
// y≈512). Fasad/tak/vägg färgas via --hus-house/--hus-roof/--hus-wall/
// --hus-wall2 så samma skal funkar med varje elevs palett. Framtida köpbara
// hus = fler poster här; okänt/saknat id faller alltid tillbaka på stugan.

export const DEFAULT_HUS_SKAL = "stuga";

function stugaMarkup() {
  return `${shadow(480, 512, 190)}
      <rect x="560" y="150" width="40" height="80" rx="6" fill="${O}" opacity="0.15"/>
      <rect x="556" y="146" width="40" height="70" rx="6" fill="#C97B63" ${LINE}/>
      <g class="hus-rok"><circle cx="576" cy="136" r="12" fill="#fff" opacity="0.85"/></g>
      <g class="hus-rok r2"><circle cx="576" cy="136" r="9" fill="#fff" opacity="0.85"/></g>
      <g class="hus-rok r3"><circle cx="576" cy="136" r="11" fill="#fff" opacity="0.85"/></g>

      <rect x="330" y="240" width="300" height="270" rx="12" fill="var(--hus-house)" ${LINE}/>
      <path d="M300 250 L480 130 L660 250 Z" fill="var(--hus-roof)" ${LINE}/>
      <circle cx="480" cy="210" r="20" fill="#FFF3DC" ${LINE}/>
      <circle cx="480" cy="210" r="9" fill="#9AD3F0" ${THIN}/>

      <path d="M362 510 L362 420 Q362 396 390 396 Q418 396 418 420 L418 510 Z" fill="${WOOD}" ${LINE}/>
      <path d="M372 505 L372 422 Q372 406 390 406 Q408 406 408 422 L408 505 Z" fill="${WOOD_LIGHT}" stroke="none"/>
      <circle cx="404" cy="458" r="4.5" fill="${WOOD_DARK}" ${THIN}/>

      <g>
        <rect x="440" y="330" width="150" height="130" rx="10" fill="var(--hus-wall)" ${LINE}/>
        <rect x="452" y="404" width="126" height="26" rx="4" fill="var(--hus-wall2)" stroke="none"/>
        <path d="M492 362 L512 362 L518 380 L486 380 Z" fill="#F7C948" ${THIN}/>
        ${limb("M502 386 L502 402", WOOD_DARK, 3)}
        <ellipse cx="502" cy="384" rx="17" ry="3.4" fill="#FDE9A8" opacity="0.75"/>
        <circle cx="551" cy="425" r="16" fill="#6FC66F" ${THIN}/>
        <path d="M540 415 L537 402 L547 408 Z" fill="#6FC66F" ${THIN}/>
        <path d="M562 415 L565 402 L555 408 Z" fill="#6FC66F" ${THIN}/>
        ${eyeDot(545, 424, 3.6)}${eyeDot(557, 424, 3.6)}
        <path d="M515 335 L515 455 M445 395 L585 395" stroke="${O}" stroke-width="5" stroke-linecap="round"/>
        <rect x="440" y="330" width="150" height="130" rx="10" fill="none" stroke="${O}" stroke-width="6"/>
        <rect x="430" y="456" width="170" height="14" rx="7" fill="#FFF3DC" ${LINE}/>
      </g>
      <rect x="446" y="470" width="138" height="6" rx="3" fill="${WOOD_DARK}" stroke="none"/>
      <circle cx="466" cy="468" r="7" fill="#F890B7" ${THIN}/>
      <circle cx="520" cy="466" r="7" fill="#F7C948" ${THIN}/>
      <circle cx="566" cy="468" r="7" fill="#EF6F6C" ${THIN}/>`;
}

const HUS_SKAL = {
  stuga: { namn: "Stuga", markup: stugaMarkup },
};

/** Exteriör-markup för ett husskal, med säkert fallback till stugan. */
export function husSkalMarkup(skalId = DEFAULT_HUS_SKAL) {
  return (HUS_SKAL[skalId] || HUS_SKAL[DEFAULT_HUS_SKAL]).markup();
}

/** Minimal HTML/SVG-escape för text som ritas in i skylten. */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/**
 * Klasskylten vid gårdskanten (höger om gruset, vänster om blomrabatten).
 * Rad 1 = "Klass <namn>", rad 2 = byns namn om det finns. Långa texter kläms
 * med textLength så de aldrig rinner utanför brädan. Görs klickbar (role=
 * button) av husScen – klick zoomar ut till klassbyn (pages-varld.js).
 */
function skyltMarkup({ rad1, rad2 = "" }) {
  const textAttr = (t, storlek) =>
    t.length * storlek * 0.62 > 174 ? ` textLength="174" lengthAdjust="spacingAndGlyphs"` : "";
  const rader = rad2
    ? `<text x="560" y="507" font-size="24"${textAttr(rad1, 24)}>${esc(rad1)}</text>
       <text x="560" y="530" font-size="15" opacity="0.85"${textAttr(rad2, 15)}>${esc(rad2)}</text>`
    : `<text x="560" y="517" font-size="24"${textAttr(rad1, 24)}>${esc(rad1)}</text>`;
  return `${shadow(560, 585, 74)}
    ${limb("M500 582 L500 540", WOOD_DARK, 10)}
    ${limb("M620 582 L620 540", WOOD_DARK, 10)}
    <rect x="460" y="478" width="200" height="68" rx="10" fill="${WOOD}" ${LINE}/>
    <rect x="467" y="485" width="186" height="54" rx="7" fill="${WOOD_LIGHT}" stroke="none"/>
    <circle cx="475" cy="493" r="2.6" fill="${WOOD_DARK}"/>
    <circle cx="645" cy="493" r="2.6" fill="${WOOD_DARK}"/>
    <circle cx="475" cy="531" r="2.6" fill="${WOOD_DARK}"/>
    <circle cx="645" cy="531" r="2.6" fill="${WOOD_DARK}"/>
    <g fill="${O}" font-weight="800" text-anchor="middle"
      font-family="'Baloo 2','Nunito',system-ui,sans-serif">${rader}</g>`;
}

/**
 * Hela ute-scenen som SVG-sträng.
 * @param {string} avatarHtml avatarMarkup-sträng som ställs framför huset
 *   (uppdateras senare via elementet #ute-avatar). Skicka INTE evo – avataren
 *   ritas alltid i basutseende + kläder.
 * @param {object} [o]
 * @param {string} [o.skalId] husskal (framtida "Köp nytt hus"); default stugan.
 * @param {{rad1:string, rad2?:string, aria?:string}|null} [o.skylt]
 *   klasskylten vid gårdskanten; null/utelämnad → ingen skylt.
 */
export function husScen(avatarHtml, { skalId = DEFAULT_HUS_SKAL, skylt = null } = {}) {
  const sol = [0, 45, 90, 135]
    .map(
      (a) =>
        `<path d="M110 30 L110 142 M54 86 L166 86" stroke="#FDE9A8" stroke-width="10"
          stroke-linecap="round" transform="rotate(${a} 110 86)"/>`
    )
    .join("");

  // Skylten flyttad åt vänster (translate) så den står i vänstra gårdskanten
  // och inte täcker huset (huskroppen ligger x=330–630).
  const skyltHtml = skylt
    ? `<g id="klasskylt" role="button" tabindex="0" transform="translate(-360 0)"
        aria-label="${esc(skylt.aria || skylt.rad1)}">${skyltMarkup(skylt)}</g>`
    : "";

  return `<svg viewBox="0 0 960 600" role="img" aria-label="Ditt hus utifrån"
      preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="hus-himmel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9AD3F0"/><stop offset="1" stop-color="#E8F6FD"/>
    </linearGradient></defs>
    <rect x="-480" y="-300" width="1920" height="1200" fill="url(#hus-himmel)"/>
    <g class="hus-solstralar">${sol}</g>
    <circle cx="110" cy="86" r="34" fill="#F7C948" ${LINE}/>
    <g class="hus-moln" style="--t:62s">${molnArt(0, 70, 1.25)}</g>
    <g class="hus-moln" style="--t:46s;animation-delay:-18s">${molnArt(0, 150, 0.9)}</g>
    <g class="hus-moln" style="--t:75s;animation-delay:-40s">${molnArt(0, 40, 0.7)}</g>

    <path d="M-480 480 Q240 380 520 470 Q760 380 1440 460 L1440 900 L-480 900 Z" fill="#A8DA8F" ${LINE}/>
    <path d="M-480 520 Q300 470 620 525 Q820 500 1440 520 L1440 900 L-480 900 Z" fill="#8FCB74" ${LINE}/>

    <g>${limb("M800 500 L800 430", WOOD, 14)}
      <circle cx="800" cy="392" r="52" fill="#6FC66F" ${LINE}/>
      <circle cx="766" cy="416" r="30" fill="#6FC66F" ${LINE}/>
      <circle cx="836" cy="414" r="32" fill="#6FC66F" ${LINE}/>
      <circle cx="784" cy="384" r="6" fill="#EF6F6C" ${THIN}/>
      <circle cx="820" cy="404" r="6" fill="#EF6F6C" ${THIN}/></g>

    <g id="husgrupp" role="button" tabindex="0" aria-label="Gå in i huset">
      ${husSkalMarkup(skalId)}
    </g>

    <path d="M390 512 Q380 560 340 600 L470 600 Q430 556 420 512 Z" fill="#EAD9C0" ${LINE}/>
    ${skyltHtml}
    <ellipse cx="395" cy="545" rx="12" ry="5" fill="#D8C4A4" stroke="none"/>
    <ellipse cx="410" cy="575" rx="14" ry="6" fill="#D8C4A4" stroke="none"/>

    <g>${limb("M680 540 L680 495", WOOD_DARK, 6)}
      <rect x="662" y="470" width="46" height="28" rx="9" fill="#EF6F6C" ${LINE}/>
      <circle cx="702" cy="484" r="3.4" fill="#FFF3DC" ${THIN}/>
      ${limb("M668 470 L668 456", "#F7C948", 3.4)}
      <path d="M668 456 L682 460 L668 466 Z" fill="#F7C948" ${THIN}/></g>

    ${shadow(316, 538, 46)}
    <!-- Extra höjd UPPÅT (y flyttad upp lika mycket som height ökat) så burna
         hattar/kepsar som sticker upp ovanför huvudet ryms utan att klippas mot
         foreignObject-kanten. Avataren botten-justeras i CSS (.varld-avatar,
         flex align-items:flex-end) så fötterna står kvar på samma marklinje
         (foreignObject-botten y≈536) oavsett hur mycket headroom vi lägger till
         eller hur --varld-avatar-font skalas i en framtida by-nivå. -->
    <foreignObject x="256" y="346" width="120" height="190" pointer-events="none">
      <div xmlns="http://www.w3.org/1999/xhtml" class="varld-avatar" id="ute-avatar">${avatarHtml}</div>
    </foreignObject>
  </svg>`;
}

/**
 * Minihus för by-nivån (klassbyn): samma husskal + avatar-rigg som ute-scenen
 * men som fristående SVG, tätt beskuren kring huset (viewBox 230..730 ×
 * 100..560). Hela SVG:n skalas av by-tomtens CSS-storlek, så avataren (som
 * lever i samma scen-koordinater, --varld-avatar-font) krymper automatiskt i
 * exakt samma proportion som huset – parameterstyrd skalning utan extra mått.
 * Färgsätts via samma --hus-*-variabler (sätt elevens palett på tomt-elementet).
 * preserveAspectRatio "xMidYMax meet" bottnar huset i sin ruta så alla hus i
 * en by-rad står på samma marklinje.
 *
 * @param {object} [o]
 * @param {string} [o.skalId]     elevens husskal (framtida "Köp nytt hus")
 * @param {string} [o.avatarHtml] avatarMarkup-sträng som ställs framför huset
 */
export function husMini({ skalId = DEFAULT_HUS_SKAL, avatarHtml = "" } = {}) {
  return `<svg viewBox="230 100 500 460" aria-hidden="true" focusable="false"
      preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg">
    ${husSkalMarkup(skalId)}
    <foreignObject x="256" y="346" width="120" height="190" pointer-events="none">
      <div xmlns="http://www.w3.org/1999/xhtml" class="varld-avatar">${avatarHtml}</div>
    </foreignObject>
  </svg>`;
}
