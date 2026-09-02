// ============================================================================
// Pluggportalen – Mitt hem (hus-vyn, #/elev/hus)
// ----------------------------------------------------------------------------
// Ingången till elevens rum: huset visas UTIFRÅN (illustrerat i appens
// SVG-stil) med ett fönster där man skymtar in i rummet. Klick på huset →
// zoom-övergång mot fönstret och vidare in i rummet (#/elev/rum).
//
// Utseendet följer design/DESIGNBESLUT-husdjur-hem-2.0.md:
//  - scen viewBox 960×600, kontur #3B3350 (art-style.js)
//  - husets fönster 150×130 vid (440,330) som visar väggfärgen + glimt av rummet
//  - zoom-origin 48,5 % / 52 % (mot fönstret), 900 ms
//  - husfasad/tak/vägg färgas av elevens palett (room.paletteId, delas med
//    rummets väggfärg via room-palettes.js) – golv & natur påverkas inte.
// ============================================================================

import * as data from "./data.js";
import { app, el, go, loading, renderTopbar, pageError } from "./ui.js";
import { O, LINE, THIN, limb } from "./art-style.js";
import { getPalette, paletteIdFromStudentData } from "./room-palettes.js";

// Trä/golv-färger ur stilguiden (färgas aldrig om av paletten).
const WOOD = "#B0805A";
const WOOD_DARK = "#8A6242";
const WOOD_LIGHT = "#E0B98C";

// --- Små rit-hjälpare (samma stil som prototypen) ---------------------------

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

// --- Scenen: elevens hus utifrån (viewBox 960×600) --------------------------
// Palettfärgerna (hus/tak/vägg/panel) läses via CSS-variabler som sätts på
// stage-elementet – så återanvänder ev. palettväljare exakt samma scen.

function husScen() {
  const sol = [0, 45, 90, 135]
    .map(
      (a) =>
        `<path d="M110 30 L110 142 M54 86 L166 86" stroke="#FDE9A8" stroke-width="10"
          stroke-linecap="round" transform="rotate(${a} 110 86)"/>`
    )
    .join("");

  return `<svg viewBox="0 0 960 600" role="img" aria-label="Ditt hus utifrån"
      preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="hus-himmel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9AD3F0"/><stop offset="1" stop-color="#E8F6FD"/>
    </linearGradient></defs>
    <rect width="960" height="600" fill="url(#hus-himmel)"/>
    <g class="hus-solstralar">${sol}</g>
    <circle cx="110" cy="86" r="34" fill="#F7C948" ${LINE}/>
    <g class="hus-moln" style="--t:62s">${molnArt(0, 70, 1.25)}</g>
    <g class="hus-moln" style="--t:46s;animation-delay:-18s">${molnArt(0, 150, 0.9)}</g>
    <g class="hus-moln" style="--t:75s;animation-delay:-40s">${molnArt(0, 40, 0.7)}</g>

    <path d="M-10 480 Q240 380 520 470 Q760 380 970 460 L970 610 L-10 610 Z" fill="#A8DA8F" ${LINE}/>
    <path d="M-10 520 Q300 470 620 525 Q820 500 970 520 L970 610 L-10 610 Z" fill="#8FCB74" ${LINE}/>

    <g>${limb("M800 500 L800 430", WOOD, 14)}
      <circle cx="800" cy="392" r="52" fill="#6FC66F" ${LINE}/>
      <circle cx="766" cy="416" r="30" fill="#6FC66F" ${LINE}/>
      <circle cx="836" cy="414" r="32" fill="#6FC66F" ${LINE}/>
      <circle cx="784" cy="384" r="6" fill="#EF6F6C" ${THIN}/>
      <circle cx="820" cy="404" r="6" fill="#EF6F6C" ${THIN}/></g>

    <g id="husgrupp" role="button" tabindex="0" aria-label="Gå in i huset">
      ${shadow(480, 512, 190)}
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
      <circle cx="566" cy="468" r="7" fill="#EF6F6C" ${THIN}/>
    </g>

    <path d="M390 512 Q380 560 340 600 L470 600 Q430 556 420 512 Z" fill="#EAD9C0" ${LINE}/>
    <ellipse cx="395" cy="545" rx="12" ry="5" fill="#D8C4A4" stroke="none"/>
    <ellipse cx="410" cy="575" rx="14" ry="6" fill="#D8C4A4" stroke="none"/>

    <g>${limb("M680 540 L680 495", WOOD_DARK, 6)}
      <rect x="662" y="470" width="46" height="28" rx="9" fill="#EF6F6C" ${LINE}/>
      <circle cx="702" cy="484" r="3.4" fill="#FFF3DC" ${THIN}/>
      ${limb("M668 470 L668 456", "#F7C948", 3.4)}
      <path d="M668 456 L682 460 L668 466 Z" fill="#F7C948" ${THIN}/></g>
  </svg>`;
}

// --- Sidan ------------------------------------------------------------------

export async function pageElevHus() {
  if (!data.isLoggedIn()) return go("#/elev");
  loading();
  await renderTopbar();
  const session = data.getSession();

  let sd;
  try {
    sd = await data.getStudentData();
  } catch (err) {
    return pageError("Kunde inte ladda ditt hem", err);
  }

  // Husets färger = elevens palettval (delas med rummets väggfärg).
  const pal = getPalette(paletteIdFromStudentData(sd));

  const view = el(`<div>
    <a class="back-link" id="back">← Till startsidan</a>
    <div class="panel center">
      <h1>${session.namn ? session.namn + "s" : "Mitt"} hus 🏠</h1>
      <p class="hint">Här bor du! Klicka på huset för att gå in i ditt rum.</p>
    </div>
    <div class="hus-stage" id="stage"
      style="--hus-house:${pal.house};--hus-roof:${pal.roof};--hus-wall:${pal.wall};--hus-wall2:${pal.wall2}">
      <div class="hus-scen" id="scen">${husScen()}</div>
      <div class="hus-hint" id="hint">🏠 Klicka på huset för att gå in!</div>
    </div>
  </div>`);

  view.querySelector("#back").addEventListener("click", () => go("#/elev/hem"));

  const stage = view.querySelector("#stage");
  const husgrupp = view.querySelector("#husgrupp");

  // Gå in: zooma mot fönstret (origin 48,5 %/52 %) och landa i rummet.
  let paVagIn = false;
  function gaIn() {
    if (paVagIn) return;
    paVagIn = true;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return go("#/elev/rum");
    stage.classList.add("gar-in");
    view.querySelector("#hint").textContent = "Välkommen hem! 🏡";
    setTimeout(() => go("#/elev/rum"), 750);
  }

  husgrupp.addEventListener("click", gaIn);
  husgrupp.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      gaIn();
    }
  });

  app.replaceChildren(view);
}
