// ============================================================================
// Pluggporten – porten VARIANT B: majestätisk portal (issue #342)
// ----------------------------------------------------------------------------
// En grandiosare version av inloggningens framdörr: hög stenvalvbåge buren av
// pelare med kapitäl och sockel, smidesgrind i två halvor med guldspetsar och
// snirklar, vimplar på pelarkrönen, gryningshimmel och en stentrappa upp mot
// öppningen. Samma platta 2D-stil med mörka konturer som resten av spelet
// (art-style.js) – mer omsorgsfullt ritad, INTE 3D/fotorealistisk.
//
// Variant A (art-port.js) är ORÖRD och är fortsatt den som live-inloggningen
// använder. Den här modulen är ett ALTERNATIV att jämföra i
// preview-port-varianter.html tills användaren valt. Väljs B behöver
// pages-elev.js bara byta importen – därför speglar modulen A:s hela kontrakt:
//   • viewBox 960×600 med "meet" + överteckning långt utanför viewBoxen så
//     letterbox-ytan fylls (helskärm kant till kant, .port-scen i styles.css).
//   • Grindhalvorna är SEPARATA grupper #port-halva-vanster/#port-halva-hoger
//     (class .port-halva) med gångjärnen i ytterkanterna, så
//     öppnings-animationen (#339, styles.css transform-origin) funkar direkt.
//   • Skyltens NEDERKANT ligger på y=238 – .port-login-toppformeln i
//     styles.css utgår från just den linjen.
//   • Grindöppningen är bred (230–730) så porten syns runt login-skylten.
// Laddas (precis som A) alltid DYNAMISKT – aldrig in i bootgrafen (#271).
// ============================================================================

import { O, LINE, THIN, limb, stjarna } from "./art-style.js";

// Sten ur paletten (stålblå/gråblå + ljus deriverad fog) – pelare och mur.
const STEN = "#A9C2DE";
const STEN_LJUS = "#DCE7F2";
const STEN_MORK = "#8FA6C6";
// Smide (marin) med guld till spetsar och ornament.
const JARN = "#46557A";
const JARN_LJUS = "#5A6C96";
const GULD = "#F7C948";
const BARNSTEN = "#F2A93B";
// Trä till skylten (samma som A/husen).
const WOOD = "#B0805A";
const WOOD_DARK = "#8A6242";
const WOOD_LIGHT = "#E0B98C";

const skugga = (cx, cy, rx) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${(rx * 0.2).toFixed(1)}" fill="${O}" opacity="0.1"/>`;

/** Gryningstonat moln (varmvit, samma form-språk som A/husscenen). */
function moln(x, y, s) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <path d="M0 20 Q-2 8 10 8 Q14 -2 26 2 Q36 -2 40 8 Q52 6 50 18 Q46 26 34 24 Q24 30 14 24 Q2 28 0 20 Z"
      fill="#FFF9EE" ${THIN} opacity="0.95"/></g>`;
}

function blomma(x, y, farg) {
  return `<circle cx="${x}" cy="${y}" r="7" fill="${farg}" ${THIN}/>`;
}

/** Liten fågel i skyn (två mjuka vingbågar). */
function fagel(x, y, s = 1) {
  return `<path d="M${x} ${y} q${7 * s} ${-7 * s} ${14 * s} 0 q${7 * s} ${-7 * s} ${14 * s} 0"
    fill="none" ${THIN}/>`;
}

// --- Pelare med sockel, kapitäl, krönklot och vimpel -------------------------
// Mjuk skuggning = en halvtransparent kontur-lila remsa längs skuggsidan
// (fortfarande platt stil, ingen gradient på formerna).
function pelare(cx, vimpelFarg, vimpelDir, vimpelFas) {
  // Vimpeln svajar milt kring sitt fäste vid stången (.portb-vimpel, se
  // <style>-blocket i portScenMajestic – EGNA portb-klasser, rör aldrig
  // .port-halva/#339). transform-box:fill-box → origin i flaggans stångkant.
  const flag = `M${cx} 58 L${cx + 64 * vimpelDir} 71 L${cx} 84 Z`;
  const origin = vimpelDir === 1 ? "left" : "right";
  return `<g>
    <!-- sockel i två steg -->
    <rect x="${cx - 52}" y="466" width="104" height="48" rx="8" fill="${STEN}" ${LINE}/>
    <rect x="${cx - 43}" y="440" width="86" height="30" rx="7" fill="${STEN_LJUS}" ${LINE}/>
    <!-- skaft med kannelyr-ränder -->
    <rect x="${cx - 33}" y="148" width="66" height="298" rx="8" fill="${STEN}" ${LINE}/>
    <rect x="${cx - 22}" y="160" width="10" height="274" rx="5" fill="${STEN_LJUS}" stroke="none"/>
    <rect x="${cx - 4}" y="160" width="10" height="274" rx="5" fill="${STEN_LJUS}" stroke="none"/>
    <rect x="${cx + 16}" y="160" width="12" height="274" rx="6" fill="${O}" opacity="0.08" stroke="none"/>
    <!-- kapitäl: vulst + kronplatta -->
    <rect x="${cx - 40}" y="128" width="80" height="24" rx="9" fill="${STEN_LJUS}" ${LINE}/>
    <rect x="${cx - 47}" y="108" width="94" height="24" rx="7" fill="${STEN}" ${LINE}/>
    <!-- krönklot i guld + vimpel -->
    <circle cx="${cx}" cy="98" r="13" fill="${GULD}" ${LINE}/>
    ${limb(`M${cx} 88 L${cx} 56`, WOOD_DARK, 5)}
    <g class="portb-vimpel" style="transform-origin:${origin} center${vimpelFas ? `;animation-duration:4.6s;animation-delay:-1.7s` : ""}">
      <path d="${flag}" fill="${vimpelFarg}" ${LINE}/>
    </g>
  </g>`;
}

// --- Valvbågen mellan pelarna ------------------------------------------------
// Stenband med slutsten och guldnitar; skylten hänger i kedjor under bågen.
function valvbage() {
  // Guldnitar längs bågens mittlinje (kvadratisk Bézier 233,150 → 480,55 → 727,150).
  let nitar = "";
  for (const t of [0.18, 0.34, 0.66, 0.82]) {
    const mt = 1 - t;
    const x = mt * mt * 233 + 2 * mt * t * 480 + t * t * 727;
    const y = mt * mt * 150 + 2 * mt * t * 55 + t * t * 150;
    nitar += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="${GULD}" ${THIN}/>`;
  }
  return `<g>
    <path d="M233 152 Q480 26 727 152 L707 152 Q480 84 253 152 Z" fill="${STEN}" ${LINE}/>
    <!-- mjuk skugga på bågens undersida -->
    <path d="M263 150 Q480 90 697 150" fill="none" stroke="${O}" stroke-width="7" opacity="0.08" stroke-linecap="round"/>
    <!-- slutsten med stjärna (sitter I bågbandet, sticker upp lite) -->
    <path d="M460 62 L500 62 L492 126 L468 126 Z" fill="${STEN_LJUS}" ${LINE}/>
    ${stjarna(480, 92, 2.2, BARNSTEN)}
    ${nitar}
  </g>`;
}

/** Skylten "Pluggporten" – hänger i kedjor under valvet. NEDERKANT y=238
    (samma linje som i A – .port-login-toppformeln i styles.css). */
function skylt() {
  const lank = (x, y) =>
    `<circle cx="${x}" cy="${y}" r="4" fill="none" ${THIN}/>`;
  // Kedjornas fästen: guldnitar PÅ bågbandet (undersidan ligger på y≈121 vid
  // x≈400/560); översta länken börjar i niten så kedjan sitter fast utan
  // glapp, nedersta går omlott med skyltens överkant (y=170).
  return `<g>
    <circle cx="399" cy="114" r="6" fill="${GULD}" ${THIN}/>
    <circle cx="561" cy="114" r="6" fill="${GULD}" ${THIN}/>
    ${lank(399, 124)}${lank(401, 136)}${lank(403, 148)}${lank(405, 160)}${lank(408, 171)}
    ${lank(561, 124)}${lank(559, 136)}${lank(557, 148)}${lank(555, 160)}${lank(552, 171)}
    <rect x="328" y="170" width="304" height="68" rx="12" fill="${WOOD_DARK}" ${LINE}/>
    <rect x="338" y="179" width="284" height="50" rx="8" fill="${WOOD_LIGHT}" stroke="none"/>
    <circle cx="346" cy="187" r="3" fill="${GULD}" ${THIN}/>
    <circle cx="614" cy="187" r="3" fill="${GULD}" ${THIN}/>
    <circle cx="346" cy="221" r="3" fill="${GULD}" ${THIN}/>
    <circle cx="614" cy="221" r="3" fill="${GULD}" ${THIN}/>
    <text x="480" y="214" font-size="28" fill="${O}" font-weight="800" text-anchor="middle"
      font-family="'Baloo 2','Nunito',system-ui,sans-serif"
      textLength="248" lengthAdjust="spacingAndGlyphs">Pluggporten</text>
  </g>`;
}

// --- Smidesgrindens halvor ---------------------------------------------------
// Vertikala järnspjälor med guldspets, vars toppar bildar en båge som är
// HÖGST mot mitten (ekar valvbågen). Tvärslåar + snirkel-ornament ritas
// framför; gångjärnen sitter i halvans ytterkant mot pelaren (#339).
const GRIND_BOTTEN = 506;

function smidesHalva(id, x0, x1, gangjarnVanster) {
  const n = Math.max(6, Math.round((x1 - x0) / 30));
  const step = (x1 - x0 - 8) / (n - 1);
  const maxAvst = Math.max(Math.abs(480 - (x0 + 4)), Math.abs(480 - (x1 - 4)));
  let spjalor = "";
  for (let i = 0; i < n; i++) {
    const xc = x0 + 4 + i * step;
    const t = Math.min(1, Math.abs(480 - xc) / maxAvst);
    const toppY = 262 + t * t * 58;
    spjalor += limb(`M${xc.toFixed(1)} ${toppY.toFixed(1)} L${xc.toFixed(1)} ${GRIND_BOTTEN}`, JARN, 6);
    // Guldspets (liten romb) på varje spjältopp.
    spjalor += `<path d="M${xc.toFixed(1)} ${(toppY - 16).toFixed(1)} L${(xc + 5.5).toFixed(1)} ${(toppY - 5).toFixed(1)}
      L${xc.toFixed(1)} ${(toppY + 4).toFixed(1)} L${(xc - 5.5).toFixed(1)} ${(toppY - 5).toFixed(1)} Z" fill="${GULD}" ${THIN}/>`;
  }
  // Snirkel-ornament: två spegelvända voluter mellan tvärslåarna.
  const mitt = (x0 + x1) / 2;
  const snirkel = `
    <path d="M${mitt - 52} 444 Q${mitt - 52} 414 ${mitt - 24} 414 Q${mitt - 6} 414 ${mitt - 6} 428 Q${mitt - 6} 440 ${mitt - 18} 440 Q${mitt - 27} 440 ${mitt - 27} 431"
      fill="none" stroke="${JARN_LJUS}" stroke-width="5" stroke-linecap="round"/>
    <path d="M${mitt + 52} 444 Q${mitt + 52} 414 ${mitt + 24} 414 Q${mitt + 6} 414 ${mitt + 6} 428 Q${mitt + 6} 440 ${mitt + 18} 440 Q${mitt + 27} 440 ${mitt + 27} 431"
      fill="none" stroke="${JARN_LJUS}" stroke-width="5" stroke-linecap="round"/>`;
  const rx0 = x0 + 2;
  const rx1 = x1 - 2;
  const hingeX = gangjarnVanster ? x0 - 9 : x1 - 19;
  // Ringhandtag på halvans INNERkant (mot grindmitten).
  const handtagX = gangjarnVanster ? x1 - 14 : x0 + 14;
  return `<g id="${id}" class="port-halva">
    ${spjalor}
    <rect x="${rx0}" y="386" width="${rx1 - rx0}" height="12" rx="6" fill="${JARN_LJUS}" ${THIN}/>
    <rect x="${rx0}" y="452" width="${rx1 - rx0}" height="12" rx="6" fill="${JARN_LJUS}" ${THIN}/>
    <rect x="${rx0}" y="488" width="${rx1 - rx0}" height="10" rx="5" fill="${JARN_LJUS}" ${THIN}/>
    ${snirkel}
    <rect x="${hingeX}" y="382" width="28" height="12" rx="6" fill="${JARN}" ${THIN}/>
    <rect x="${hingeX}" y="448" width="28" height="12" rx="6" fill="${JARN}" ${THIN}/>
    <circle cx="${handtagX}" cy="424" r="9" fill="none" stroke="${GULD}" stroke-width="5"/>
  </g>`;
}

// --- Stenmur åt sidorna ------------------------------------------------------
// Låg mur med täcksten, övertecknad långt utanför viewBoxen (±2400) så den
// fyller letterboxen på breda skärmar (samma knep som himlen/gräset).
function stenmur(fromX, toX) {
  let fogar = "";
  for (let x = fromX + 40; x <= toX; x += 88) {
    fogar += `<path d="M${x} 452 L${x} 470 M${x + 44} 476 L${x + 44} 494" stroke="${STEN_MORK}" stroke-width="3" stroke-linecap="round"/>`;
  }
  return `<g>
    <rect x="${fromX - 30}" y="446" width="${toX - fromX + 60}" height="66" fill="${STEN}" ${LINE}/>
    <rect x="${fromX - 30}" y="472" width="${toX - fromX + 60}" height="4" fill="${STEN_MORK}" stroke="none"/>
    ${fogar}
    <rect x="${fromX - 30}" y="430" width="${toX - fromX + 60}" height="20" rx="8" fill="${STEN_LJUS}" ${LINE}/>
  </g>`;
}

/** Bred, inbjudande stentrappa upp mot grindöppningen. */
function trappa() {
  return `<g>
    <path d="M330 560 L630 560 L664 600 L296 600 Z" fill="#EAD9C0" ${LINE}/>
    <path d="M356 532 L604 532 L630 560 L330 560 Z" fill="#F4E7D2" ${LINE}/>
    <path d="M376 508 L584 508 L604 532 L356 532 Z" fill="#EAD9C0" ${LINE}/>
    <path d="M356 532 L604 532" stroke="${O}" stroke-width="3" opacity="0.12" stroke-linecap="round"/>
    <ellipse cx="452" cy="576" rx="13" ry="5" fill="#D8C4A4" stroke="none"/>
    <ellipse cx="524" cy="548" rx="11" ry="4.5" fill="#D8C4A4" stroke="none"/>
  </g>`;
}

/**
 * Hela den majestätiska port-scenen som SVG-sträng (viewBox 960×600, samma
 * konvention som portScen i art-port.js). Login-kortet är HTML och läggs
 * OVANPÅ scenen (.port-login i styles.css) – framför den stängda grinden.
 */
export function portScenMajestic() {
  const sol = [0, 45, 90, 135]
    .map(
      (a) =>
        `<path d="M110 44 L110 168 M48 106 L172 106" stroke="#FDE9A8" stroke-width="10"
          stroke-linecap="round" transform="rotate(${a} 110 106)"/>`
    )
    .join("");

  return `<svg viewBox="0 0 960 600" role="img" aria-label="Porten till Pluggporten"
      preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="portb-himmel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8FBEEA"/><stop offset="0.55" stop-color="#CDE6F6"/>
      <stop offset="1" stop-color="#FCE8CC"/>
    </linearGradient></defs>
    <!-- Vimpel-svaj: EGNA portb-klasser (aldrig .port-halva – #339:s
         grindhalvor styrs oförändrat från styles.css). Stilen bor i SVG:n så
         den följer med scenen överallt (även fristående previews). Höger
         vimpel fasas via inline animation-duration/-delay. -->
    <style>
      .portb-vimpel {
        transform-box: fill-box;
        animation: portb-vimpel-svaj 4s ease-in-out infinite;
      }
      @keyframes portb-vimpel-svaj {
        0%, 100% { transform: rotate(0deg); }
        30% { transform: rotate(3.5deg); }
        65% { transform: rotate(-2.5deg); }
      }
      @media (prefers-reduced-motion: reduce) {
        .portb-vimpel { animation: none; }
      }
    </style>
    <rect x="-2400" y="-1500" width="5760" height="3600" fill="url(#portb-himmel)"/>

    <!-- Gryningssol med mjuk gloria -->
    <circle cx="110" cy="106" r="52" fill="${GULD}" opacity="0.25" stroke="none"/>
    <g class="hus-solstralar">${sol}</g>
    <circle cx="110" cy="106" r="36" fill="${GULD}" ${LINE}/>

    <g class="hus-moln" style="--t:64s">${moln(0, 60, 1.25)}</g>
    <g class="hus-moln" style="--t:47s;animation-delay:-16s">${moln(0, 156, 0.9)}</g>
    <g class="hus-moln" style="--t:78s;animation-delay:-42s">${moln(0, 30, 0.6)}</g>
    ${fagel(292, 108)}${fagel(636, 76, 0.75)}

    <!-- Mjuka kullar i fjärran ger scenen djup -->
    <path d="M-2400 468 Q-200 380 560 452 Q1100 400 3360 462 L3360 700 L-2400 700 Z" fill="#C9F0DC" ${LINE}/>
    <path d="M-2400 480 L-480 486 Q240 402 520 478 Q780 408 1440 470 L3360 478 L3360 2100 L-2400 2100 Z" fill="#A8DA8F" ${LINE}/>
    <path d="M-2400 526 L-480 526 Q300 478 620 530 Q820 506 1440 526 L3360 526 L3360 2100 L-2400 2100 Z" fill="#8FCB74" ${LINE}/>

    <!-- Träd åt sidorna (samma stil som ute-scenen, lite frodigare) -->
    <g>${limb("M84 502 L84 424", WOOD, 15)}
      <circle cx="84" cy="380" r="58" fill="#6FC66F" ${LINE}/>
      <circle cx="44" cy="408" r="33" fill="#6FC66F" ${LINE}/>
      <circle cx="124" cy="406" r="35" fill="#6FC66F" ${LINE}/>
      <circle cx="66" cy="370" r="6" fill="#EF6F6C" ${THIN}/>
      <circle cx="106" cy="394" r="6" fill="#EF6F6C" ${THIN}/></g>
    <g>${limb("M876 504 L876 434", WOOD, 13)}
      <circle cx="876" cy="394" r="50" fill="#6FC66F" ${LINE}/>
      <circle cx="842" cy="418" r="28" fill="#6FC66F" ${LINE}/>
      <circle cx="910" cy="416" r="30" fill="#6FC66F" ${LINE}/>
      <circle cx="892" cy="386" r="6" fill="#EF6F6C" ${THIN}/></g>

    <!-- Stenmur ut mot kanterna (fyller letterboxen) -->
    ${stenmur(-2400, 132)}
    ${stenmur(828, 3360)}

    ${skugga(480, 514, 310)}

    <!-- Grindhalvorna: SEPARATA animerbara element (#339). Ritas före
         pelarna så ytterkanterna (gångjärnen) går in bakom dem. Öppningen
         är bred (230–730) så grinden syns runt login-skylten. -->
    ${smidesHalva("port-halva-vanster", 230, 477, true)}
    ${smidesHalva("port-halva-hoger", 483, 730, false)}

    <!-- Pelare + valvbåge + hängande skylt -->
    ${pelare(195, "#F890B7", 1, false)}
    ${pelare(765, GULD, -1, true)}
    ${valvbage()}
    ${skylt()}

    <!-- Buskar och blommor vid pelarnas socklar -->
    <circle cx="266" cy="506" r="22" fill="#58C6A9" ${LINE}/>
    <circle cx="296" cy="512" r="15" fill="#6FC66F" ${LINE}/>
    <circle cx="694" cy="508" r="20" fill="#58C6A9" ${LINE}/>
    <circle cx="666" cy="514" r="14" fill="#6FC66F" ${LINE}/>
    ${blomma(138, 512, "#F890B7")}${blomma(316, 520, "#F7C948")}
    ${blomma(644, 522, "#EF6F6C")}${blomma(822, 514, "#B79BE0")}

    <!-- Trappan upp till öppningen -->
    ${trappa()}
  </svg>`;
}
