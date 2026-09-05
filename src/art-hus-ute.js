// ============================================================================
// Pluggportalen – ute-scenen: elevens hus utifrån (illustrerad SVG)
// ----------------------------------------------------------------------------
// Ritar hus-vyn (viewBox 960×600) som husvärldens "hus"-nivå använder
// (pages-varld.js). Utseendet följer design/DESIGNBESLUT-husdjur-hem-2.0.md:
//  - kontur #3B3350 (art-style.js), fönster 150×130 vid (440,330)
//  - husfasad/tak/vägg färgas via CSS-variablerna --hus-house/--hus-roof/
//    --hus-wall/--hus-wall2 (elevens palett) – golv & natur påverkas inte.
// preserveAspectRatio="xMidYMid meet" ser till att HELA viewBoxen (hus + avatar
// + all natur) ALLTID ryms – inget beskärs på korta/breda eller smala/höga
// skärmar. Himmel/gräs är övertecknade långt utanför viewBoxen och scenens
// svg får overflow:visible (styles.css .varld-ute svg), så letterbox-ytan
// fylls av naturen i stället för tomma kanter; .varld-stage klipper mot ramen.
// Elevens avatar ritas framför huset via foreignObject – den
// lever i scenens koordinatsystem och följer därmed alla kamerazoomar
// perfekt; storleken styrs av CSS-variabeln --varld-avatar-font (px i
// scen-koordinater).
//
// HUSSKAL: själva huset ritas av ett utbytbart "skal" ur HUS_SKAL-registret
// (husSkalMarkup). "stuga" är default/gratis; övriga (slott, svamphus, …) köps
// i shoppen ("Köp nytt hus") och väljs via husvärldens "🏠 Nytt hus"-panel –
// aktivt val sparas i studentData.husSkalId. Bytet rör bara EXTERIÖREN; rummet/
// interiören påverkas inte. Både ute-scenen och by-vyns minihus (husMini,
// klassbyn i varld-by-scen.js) ritar via registret, så ett nytt skal slår
// igenom överallt.
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

// --- Slott: torn med tinnar + vimpel ---------------------------------------
// Samma koordinatsystem/marklinje som stugan (huset ~x300–660, y≈512) och
// samma --hus-*-variabler, så avatar/skylt/palett fortsätter sitta rätt.
function slottMarkup() {
  // Krenelering (tinnar) centrerad ovanpå ett väggsegment [x, x+w]. Tänderna
  // sitter med basen y-16..y+6 så de överlappar väggens överkant (y) → ingen
  // glipa. Bara mittkeepen har tinnar; tornen kröns av spetsiga tak i stället.
  const tinnar = (x, w, y) => {
    const step = 26, tw = 15, gap = step - tw;
    const n = Math.max(2, Math.floor((w + gap) / step));
    const span = n * tw + (n - 1) * gap;
    const start = x + (w - span) / 2;
    let s = "";
    for (let i = 0; i < n; i++)
      s += `<rect x="${(start + i * step).toFixed(1)}" y="${y - 16}" width="${tw}" height="22" fill="var(--hus-house)" ${LINE}/>`;
    return s;
  };
  // Ett fönster (rundbågigt) med enkel mittpost, centrerat på cx.
  const fonster = (cx, top, w, h) =>
    `<rect x="${cx - w / 2}" y="${top}" width="${w}" height="${h}" rx="${(w / 2).toFixed(0)}" fill="var(--hus-wall)" ${LINE}/>
     <path d="M${cx} ${top + 6} L${cx} ${top + h - 6} M${cx - w / 2 + 4} ${top + h * 0.42} L${cx + w / 2 - 4} ${top + h * 0.42}" stroke="${O}" stroke-width="3" stroke-linecap="round"/>`;
  return `${shadow(480, 512, 190)}
      <!-- Torn (ritas före mittkeepen så väggarna möts rent i skarvarna) -->
      <rect x="300" y="214" width="72" height="296" rx="4" fill="var(--hus-house)" ${LINE}/>
      <rect x="588" y="214" width="72" height="296" rx="4" fill="var(--hus-house)" ${LINE}/>
      <!-- Mittkeep, kortare än tornen -->
      <rect x="356" y="272" width="248" height="238" rx="4" fill="var(--hus-house)" ${LINE}/>
      ${tinnar(356, 248, 272)}
      <!-- Tornens spetsiga tak: basen (y=214) vilar exakt på tornets överkant -->
      <path d="M292 214 L336 150 L380 214 Z" fill="var(--hus-roof)" ${LINE}/>
      <path d="M580 214 L624 150 L668 214 Z" fill="var(--hus-roof)" ${LINE}/>
      ${limb("M336 150 L336 116", WOOD_DARK, 3)}
      <path d="M336 116 L372 124 L336 136 Z" fill="#EF6F6C" ${THIN}/>
      ${limb("M624 150 L624 116", WOOD_DARK, 3)}
      <path d="M624 116 L660 124 L624 136 Z" fill="#EF6F6C" ${THIN}/>
      <!-- Port, centrerad på keepen (x=480) -->
      <path d="M428 510 L428 372 Q428 336 480 336 Q532 336 532 372 L532 510 Z" fill="var(--hus-roof)" ${LINE}/>
      <path d="M440 505 L440 376 Q440 348 480 348 Q520 348 520 376 L520 505 Z" fill="${WOOD}" ${LINE}/>
      <path d="M480 348 L480 505 M442 424 L518 424" stroke="${O}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="508" cy="432" r="5" fill="#F7C948" ${THIN}/>
      <!-- Fönster: symmetriskt par i tornen + par i keepen, inga överlapp -->
      ${fonster(336, 300, 34, 52)}
      ${fonster(624, 300, 34, 52)}
      ${fonster(392, 298, 34, 50)}
      ${fonster(568, 298, 34, 50)}`;
}

// --- Svamphus: rund stam + prickig hatt ------------------------------------
function svampMarkup() {
  return `${shadow(480, 512, 200)}
      <path d="M380 510 L380 360 Q380 330 480 330 Q580 330 580 360 L580 510 Z" fill="var(--hus-house)" ${LINE}/>
      <path d="M300 360 Q300 210 480 210 Q660 210 660 360 Q560 336 480 336 Q400 336 300 360 Z"
        fill="var(--hus-roof)" ${LINE}/>
      <circle cx="392" cy="292" r="20" fill="var(--hus-wall)" ${THIN}/>
      <circle cx="480" cy="264" r="26" fill="var(--hus-wall)" ${THIN}/>
      <circle cx="572" cy="292" r="20" fill="var(--hus-wall)" ${THIN}/>
      <circle cx="436" cy="242" r="13" fill="var(--hus-wall)" ${THIN}/>
      <circle cx="528" cy="242" r="13" fill="var(--hus-wall)" ${THIN}/>
      <path d="M452 510 L452 396 Q452 366 480 366 Q508 366 508 396 L508 510 Z" fill="${WOOD}" ${LINE}/>
      <path d="M462 504 L462 398 Q462 376 480 376 Q498 376 498 398 L498 504 Z" fill="${WOOD_LIGHT}" stroke="none"/>
      <circle cx="493" cy="446" r="4.5" fill="${WOOD_DARK}" ${THIN}/>
      <circle cx="412" cy="404" r="22" fill="var(--hus-wall)" ${LINE}/>
      <path d="M412 384 L412 424 M392 404 L432 404" stroke="${O}" stroke-width="4"/>
      <circle cx="548" cy="404" r="22" fill="var(--hus-wall)" ${LINE}/>
      <path d="M548 384 L548 424 M528 404 L568 404" stroke="${O}" stroke-width="4"/>`;
}

const HUS_SKAL = {
  stuga: { namn: "Stuga", emoji: "🏡", markup: stugaMarkup },
  slott: { namn: "Slott", emoji: "🏰", markup: slottMarkup },
  svamphus: { namn: "Svamphus", emoji: "🍄", markup: svampMarkup },
};

/** Exteriör-markup för ett husskal, med säkert fallback till stugan. */
export function husSkalMarkup(skalId = DEFAULT_HUS_SKAL) {
  return (HUS_SKAL[skalId] || HUS_SKAL[DEFAULT_HUS_SKAL]).markup();
}

/** Känt husskal-id? (annars faller allt tillbaka på default-stugan) */
export function isHusSkal(skalId) {
  return Object.prototype.hasOwnProperty.call(HUS_SKAL, skalId);
}

/** Alla husskal som [{id, namn, emoji}] – stugan (default) alltid först. */
export function listHusSkal() {
  return Object.entries(HUS_SKAL).map(([id, s]) => ({ id, namn: s.namn, emoji: s.emoji }));
}

/**
 * Litet förhandsvisnings-SVG av ett husskal (tätt beskuret, ingen avatar).
 * Färgas via --hus-*-variabler från ett förälderelement, precis som husMini.
 */
export function husSkalPreview(skalId = DEFAULT_HUS_SKAL) {
  return `<svg viewBox="280 112 400 420" aria-hidden="true" focusable="false"
      preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg">
    ${husSkalMarkup(skalId)}
  </svg>`;
}

/**
 * Rita husskal-väljaren i `container` och lyssna på klick. Visar bara skal
 * eleven äger (default-stugan är alltid med, gratis). Förhandsvisningarna
 * färgas av elevens palett via --hus-*-variabler satta på varje knapp.
 * @param {HTMLElement} container tom behållare
 * @param {object} o
 * @param {string}   o.activeId  elevens nuvarande husskal
 * @param {Set<string>|string[]} o.owned  ägda husskal-id (utöver default)
 * @param {object}   [o.palette] {house, roof, wall, wall2} för förhandsvisning.
 *   Utelämnas den ärvs --hus-*-färgerna från ett förälderelement (t.ex. scenen)
 *   i stället – då följer förhandsvisningarna elevens palett live.
 * @param {(id:string)=>void} o.onPick körs vid NYTT val
 */
export function renderHusSkalPicker(container, { activeId, owned, palette, onPick }) {
  const ownedSet = owned instanceof Set ? owned : new Set(owned || []);
  const skinar = listHusSkal().filter((s) => s.id === DEFAULT_HUS_SKAL || ownedSet.has(s.id));
  let vald = isHusSkal(activeId) ? activeId : DEFAULT_HUS_SKAL;
  const farg = palette
    ? `--hus-house:${palette.house};--hus-roof:${palette.roof};--hus-wall:${palette.wall};--hus-wall2:${palette.wall2}`
    : "";
  const draw = () => {
    container.innerHTML = skinar
      .map(
        (s) => `<button class="hus-skal-knapp${s.id === vald ? " vald" : ""}"
          data-skal="${s.id}" aria-pressed="${s.id === vald}" title="${s.namn}" style="${farg}">
          <span class="hus-skal-bild" aria-hidden="true">${husSkalPreview(s.id)}</span>
          <span class="hus-skal-namn">${s.emoji} ${s.namn}${s.id === vald ? " ✓" : ""}</span>
        </button>`
      )
      .join("");
  };
  draw();
  container.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-skal]");
    if (!btn || btn.dataset.skal === vald) return;
    vald = btn.dataset.skal;
    draw();
    onPick(vald);
  });
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

  // Skylten: mindre och nere i VÄNSTRA gårdshörnet, klar av huset (x=330–630).
  // Positionen/skalan ligger på en YTTRE grupp – #klasskylt behåller sin egna
  // hover-transform (scale/rotate). Lägg ALDRIG transform-attribut direkt på
  // #klasskylt: CSS-hover-transformen kör över det → skylten "snäpper tillbaka".
  const skyltHtml = skylt
    ? `<g transform="translate(-226 211) scale(0.6)">
        <g id="klasskylt" role="button" tabindex="0"
          aria-label="${esc(skylt.aria || skylt.rad1)}">${skyltMarkup(skylt)}</g>
      </g>`
    : "";

  return `<svg viewBox="0 0 960 600" role="img" aria-label="Ditt hus utifrån"
      preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="hus-himmel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9AD3F0"/><stop offset="1" stop-color="#E8F6FD"/>
    </linearGradient></defs>
    <rect x="-2400" y="-1500" width="5760" height="3600" fill="url(#hus-himmel)"/>
    <g class="hus-solstralar">${sol}</g>
    <circle cx="110" cy="86" r="34" fill="#F7C948" ${LINE}/>
    <g class="hus-moln" style="--t:62s">${molnArt(0, 70, 1.25)}</g>
    <g class="hus-moln" style="--t:46s;animation-delay:-18s">${molnArt(0, 150, 0.9)}</g>
    <g class="hus-moln" style="--t:75s;animation-delay:-40s">${molnArt(0, 40, 0.7)}</g>

    <path d="M-2400 470 L-480 480 Q240 380 520 470 Q760 380 1440 460 L3360 470 L3360 2100 L-2400 2100 Z" fill="#A8DA8F" ${LINE}/>
    <path d="M-2400 520 L-480 520 Q300 470 620 525 Q820 500 1440 520 L3360 520 L3360 2100 L-2400 2100 Z" fill="#8FCB74" ${LINE}/>

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
