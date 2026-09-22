// ============================================================================
// Pluggporten – porten: elev-inloggningens grind-scen (issue #338)
// ----------------------------------------------------------------------------
// Ritar "framdörren" till spelvärlden: en trägrind mellan två stolpar med
// skylten Pluggporten, himmel/gräs i samma stil som ute-scenen
// (art-hus-ute.js) och staket som fortsätter utanför viewBoxen så letterbox-
// ytan fylls (samma övertecknings-knep som husScen; scenens svg får
// overflow:visible i styles.css .port-scen).
//
// VIKTIGT (#339, öppnings-animationen): grindens två halvor är SEPARATA
// grupper – #port-halva-vanster och #port-halva-hoger – med gångjärnen i
// ytterkanterna. transform-origin per halva sätts i styles.css
// (transform-box:fill-box), så animationen kan rotera/skala varje halva kring
// sitt eget gångjärn utan att röra den här filen.
//
// Modulen laddas DYNAMISKT från pages-elev.js (aldrig statiskt!) så att
// bootgrafen inte växer med en ny fil (#271) – ett fel här kan då aldrig
// fälla inloggningen till en vit sida (formuläret har en panel-fallback).
// ============================================================================

import { O, LINE, THIN, limb } from "./art-style.js";

// Trä-färger ur stilguiden (samma som hus-exteriörerna).
const WOOD = "#B0805A";
const WOOD_DARK = "#8A6242";
const WOOD_LIGHT = "#E0B98C";
const METALL = "#46557A"; // gångjärn (marin ur paletten)

const shadow = (cx, cy, rx) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${(rx * 0.22).toFixed(1)}" fill="${O}" opacity="0.09"/>`;

function molnArt(x, y, s) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <path d="M0 20 Q-2 8 10 8 Q14 -2 26 2 Q36 -2 40 8 Q52 6 50 18 Q46 26 34 24 Q24 30 14 24 Q2 28 0 20 Z"
      fill="#FFFFFF" ${THIN} opacity="0.95"/></g>`;
}

/** Enkel blomma i gräset (samma stil som rabatten framför huset). */
function blomma(x, y, farg) {
  return `<circle cx="${x}" cy="${y}" r="7" fill="${farg}" ${THIN}/>`;
}

// --- Grindhalvorna -----------------------------------------------------------
// Spjälorna är kapslar (helrundade rects) vars toppar bildar en mjuk båge som
// är HÖGST mot mitten – klassisk sagoboks-grind. Tvärslåar + diagonal ritas
// framför spjälorna; gångjärnen (metall) sitter i halvans ytterkant, mot
// stolpen, så #339 kan svänga halvan kring just den kanten.
const GRIND_TOPP = 316; // spjältopp (högsta, mot mitten)
const GRIND_BOTTEN = 506; // spjälbotten (på gräslinjen)

function grindHalva(id, x0, x1, gangjarnVanster) {
  const n = Math.max(5, Math.round((x1 - x0) / 34)); // ~34 enheter per spjäla
  const gap = 5;
  const w = (x1 - x0 - gap * (n - 1)) / n;
  // Yttersta spjälmittens avstånd från grindmitten (x=480) – normerar bågen
  // för BÅDA halvorna (vänster har x0 nära stolpen, höger har x1 där).
  const maxAvst = Math.max(
    Math.abs(480 - (x0 + w / 2)),
    Math.abs(480 - (x1 - w / 2))
  );
  let spjalor = "";
  for (let i = 0; i < n; i++) {
    const x = x0 + i * (w + gap);
    const xc = x + w / 2;
    // 0 vid grindmitten (x=480) → 1 ute vid stolpen; kvadraten ger mjuk båge.
    const t = Math.min(1, Math.abs(480 - xc) / maxAvst);
    const toppY = GRIND_TOPP + t * t * 36;
    spjalor += `<rect x="${x.toFixed(1)}" y="${toppY.toFixed(1)}" width="${w.toFixed(1)}"
      height="${(GRIND_BOTTEN - toppY).toFixed(1)}" rx="${(w / 2).toFixed(1)}" fill="${WOOD}" ${LINE}/>`;
  }
  const rx0 = x0 + 3;
  const rx1 = x1 - 3;
  const hingeX = gangjarnVanster ? x0 - 8 : x1 - 20;
  const diag = gangjarnVanster
    ? `M${rx0 + 8} 466 L${rx1 - 8} 404`
    : `M${rx1 - 8} 466 L${rx0 + 8} 404`;
  return `<g id="${id}" class="port-halva">
    ${spjalor}
    <rect x="${rx0}" y="392" width="${rx1 - rx0}" height="17" rx="8.5" fill="${WOOD_LIGHT}" ${LINE}/>
    <rect x="${rx0}" y="454" width="${rx1 - rx0}" height="17" rx="8.5" fill="${WOOD_LIGHT}" ${LINE}/>
    ${limb(diag, WOOD_DARK, 7)}
    <rect x="${hingeX}" y="388" width="28" height="11" rx="5.5" fill="${METALL}" ${THIN}/>
    <rect x="${hingeX}" y="450" width="28" height="11" rx="5.5" fill="${METALL}" ${THIN}/>
  </g>`;
}

// --- Staket åt sidorna -------------------------------------------------------
// Lägre än grinden och övertecknat långt utanför viewBoxen (±2400) så det
// fyller letterboxen på breda skärmar, precis som himlen/gräset.
function staket(fromX, toX) {
  let stolpar = "";
  for (let x = fromX; x <= toX; x += 120) {
    stolpar += `<rect x="${x}" y="382" width="18" height="130" rx="9" fill="${WOOD}" ${LINE}/>`;
  }
  return `<g>
    ${stolpar}
    <rect x="${fromX - 30}" y="408" width="${toX - fromX + 78}" height="14" rx="7" fill="${WOOD_LIGHT}" ${LINE}/>
    <rect x="${fromX - 30}" y="458" width="${toX - fromX + 78}" height="14" rx="7" fill="${WOOD_LIGHT}" ${LINE}/>
  </g>`;
}

/** Hög portal-stolpe (ren trästolpe, utan lykta – issue #340). */
function stolpe(cx) {
  return `<g>
    <rect x="${cx - 30}" y="140" width="60" height="372" rx="10" fill="${WOOD}" ${LINE}/>
    <rect x="${cx - 20}" y="152" width="14" height="348" rx="7" fill="${WOOD_LIGHT}" stroke="none"/>
  </g>`;
}

/** Skylten "Pluggporten" som hänger i tvärbalken mellan stolparna.
    OBS: skyltens NEDERKANT (y=238) styr var login-kortet börjar –
    .port-login-toppformeln i styles.css utgår från just den linjen. */
function skylt() {
  return `<g>
    ${limb("M400 154 L412 178", WOOD_DARK, 4)}
    ${limb("M560 154 L548 178", WOOD_DARK, 4)}
    <rect x="336" y="176" width="288" height="62" rx="10" fill="${WOOD}" ${LINE}/>
    <rect x="344" y="184" width="272" height="46" rx="7" fill="${WOOD_LIGHT}" stroke="none"/>
    <circle cx="352" cy="192" r="2.6" fill="${WOOD_DARK}"/>
    <circle cx="608" cy="192" r="2.6" fill="${WOOD_DARK}"/>
    <circle cx="352" cy="222" r="2.6" fill="${WOOD_DARK}"/>
    <circle cx="608" cy="222" r="2.6" fill="${WOOD_DARK}"/>
    <text x="480" y="217" font-size="28" fill="${O}" font-weight="800" text-anchor="middle"
      font-family="'Baloo 2','Nunito',system-ui,sans-serif"
      textLength="240" lengthAdjust="spacingAndGlyphs">Pluggporten</text>
  </g>`;
}

/**
 * Hela port-scenen som SVG-sträng (viewBox 960×600, samma konvention som
 * husScen). Inloggningskortet är HTML och läggs OVANPÅ scenen av
 * pages-elev.js (.port-login i styles.css) – framför den stängda grinden.
 */
export function portScen() {
  const sol = [0, 45, 90, 135]
    .map(
      (a) =>
        `<path d="M110 30 L110 142 M54 86 L166 86" stroke="#FDE9A8" stroke-width="10"
          stroke-linecap="round" transform="rotate(${a} 110 86)"/>`
    )
    .join("");

  return `<svg viewBox="0 0 960 600" role="img" aria-label="Porten till Pluggporten"
      preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="port-himmel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9AD3F0"/><stop offset="1" stop-color="#E8F6FD"/>
    </linearGradient></defs>
    <rect x="-2400" y="-1500" width="5760" height="3600" fill="url(#port-himmel)"/>
    <g class="hus-solstralar">${sol}</g>
    <circle cx="110" cy="86" r="34" fill="#F7C948" ${LINE}/>
    <g class="hus-moln" style="--t:62s">${molnArt(0, 66, 1.2)}</g>
    <g class="hus-moln" style="--t:46s;animation-delay:-18s">${molnArt(0, 150, 0.85)}</g>
    <g class="hus-moln" style="--t:75s;animation-delay:-40s">${molnArt(0, 36, 0.65)}</g>

    <path d="M-2400 470 L-480 480 Q240 380 520 470 Q760 380 1440 460 L3360 470 L3360 2100 L-2400 2100 Z" fill="#A8DA8F" ${LINE}/>
    <path d="M-2400 520 L-480 520 Q300 470 620 525 Q820 500 1440 520 L3360 520 L3360 2100 L-2400 2100 Z" fill="#8FCB74" ${LINE}/>

    <!-- Träd åt sidorna (samma stil som ute-scenens träd) -->
    <g>${limb("M96 500 L96 430", WOOD, 14)}
      <circle cx="96" cy="392" r="52" fill="#6FC66F" ${LINE}/>
      <circle cx="62" cy="416" r="30" fill="#6FC66F" ${LINE}/>
      <circle cx="132" cy="414" r="32" fill="#6FC66F" ${LINE}/>
      <circle cx="80" cy="384" r="6" fill="#EF6F6C" ${THIN}/>
      <circle cx="116" cy="404" r="6" fill="#EF6F6C" ${THIN}/></g>
    <g>${limb("M864 502 L864 438", WOOD, 12)}
      <circle cx="864" cy="400" r="46" fill="#6FC66F" ${LINE}/>
      <circle cx="834" cy="422" r="26" fill="#6FC66F" ${LINE}/>
      <circle cx="896" cy="420" r="28" fill="#6FC66F" ${LINE}/>
      <circle cx="878" cy="392" r="6" fill="#EF6F6C" ${THIN}/></g>

    <!-- Staket ut mot kanterna (och långt utanför – fyller letterboxen) -->
    ${staket(-2400, 120)}
    ${staket(840, 3360)}

    ${shadow(480, 514, 300)}

    <!-- Grindhalvorna: SEPARATA animerbara element (#339). Ritas före
         stolparna så halvornas ytterkanter (gångjärnen) går in bakom dem.
         Öppningen är bred (230–730) så grinden syns på båda sidor om
         login-kortet (.port-login är max 340 px brett). -->
    ${grindHalva("port-halva-vanster", 230, 477, true)}
    ${grindHalva("port-halva-hoger", 483, 730, false)}

    <!-- Stolpar + tvärbalk + skylt -->
    ${stolpe(200)}
    ${stolpe(760)}
    <rect x="160" y="128" width="640" height="26" rx="12" fill="${WOOD_DARK}" ${LINE}/>
    ${skylt()}

    <!-- Grusgången fram till grinden -->
    <path d="M430 512 Q410 560 356 600 L604 600 Q550 560 530 512 Z" fill="#EAD9C0" ${LINE}/>
    <ellipse cx="452" cy="548" rx="12" ry="5" fill="#D8C4A4" stroke="none"/>
    <ellipse cx="502" cy="576" rx="14" ry="6" fill="#D8C4A4" stroke="none"/>

    <!-- Blommor vid stolparna -->
    ${blomma(212, 508, "#F890B7")}${blomma(232, 516, "#F7C948")}
    ${blomma(730, 510, "#EF6F6C")}${blomma(752, 518, "#F890B7")}
  </svg>`;
}
