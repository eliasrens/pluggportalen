// ============================================================================
// Pluggporten – stämningsdekor till klassbyn (by-nivån)
// ----------------------------------------------------------------------------
// Placerar (byDekor) och ritar stämningsdekoren i byns layout (varld-by.js):
//
//  UPPSTÅENDE dekor (träd, gran, buske, lyktstolpe) ritas som EGNA små SVG:er
//  i absolut-positionerade element (.by-dekor i varld-by-scen.js), precis som
//  husens minihus. Skälet: markens SVG har preserveAspectRatio="none" (procent
//  1:1), vilket skulle klämma/tänja runda trädkronor med skärmens proportioner.
//  En egen SVG med "xMidYMax meet" håller formen och bottnar mot markpunkten.
//
//  PLATT markdekor (damm, blomrabatter, grästuvor) tål tänjningen (dammar och
//  rabatter FÅR vara breda) och ritas direkt i markens 0 0 100 100-SVG via
//  dekorMarkSvg() – noll extra DOM-noder.
//
// Samma stilguide som allt annat: kontur #3B3350 (art-style.js), platta färger,
// mjuka former. Inga filter/gradienter – billigt även ×20 i en stor by.
// ============================================================================

import { O, LINE, THIN, limb } from "./art-style.js";

const WOOD = "#B0805A";
const WOOD_DARK = "#8A6242";
const GRON = "#6FC66F";
const GRAN_GRON = "#58B368";
const JARN = "#5B5470"; // lyktstolpens smide – konturnära men lite ljusare

/** Yttermått (bredd × höjd i % av by-lagret, före skalfaktorn s) per dekortyp. */
export const DEKOR_MATT = {
  trad: { w: 9, h: 15 },
  gran: { w: 8, h: 16 },
  buske: { w: 8, h: 5.6 },
  lykta: { w: 4.6, h: 11 },
};

const svgWrap = (viewBox, inner) =>
  `<svg viewBox="${viewBox}" preserveAspectRatio="xMidYMax meet" aria-hidden="true"
    focusable="false" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

function tradArt() {
  return svgWrap(
    "0 0 110 132",
    `<ellipse cx="55" cy="126" rx="26" ry="5.5" fill="${O}" opacity="0.09"/>
    ${limb("M55 124 L55 76", WOOD, 9)}
    <circle cx="55" cy="52" r="30" fill="${GRON}" ${LINE}/>
    <circle cx="30" cy="68" r="18" fill="${GRON}" ${LINE}/>
    <circle cx="80" cy="66" r="19" fill="${GRON}" ${LINE}/>
    <circle cx="44" cy="46" r="4.5" fill="#EF6F6C" ${THIN}/>
    <circle cx="67" cy="60" r="4.5" fill="#F890B7" ${THIN}/>`
  );
}

function granArt() {
  return svgWrap(
    "0 0 96 140",
    `<ellipse cx="48" cy="134" rx="23" ry="5" fill="${O}" opacity="0.09"/>
    ${limb("M48 132 L48 112", WOOD_DARK, 8)}
    <path d="M18 118 L48 84 L78 118 Z" fill="${GRAN_GRON}" ${LINE}/>
    <path d="M23 94 L48 60 L73 94 Z" fill="${GRAN_GRON}" ${LINE}/>
    <path d="M28 70 L48 38 L68 70 Z" fill="${GRAN_GRON}" ${LINE}/>`
  );
}

function buskeArt() {
  return svgWrap(
    "0 0 110 64",
    `<ellipse cx="55" cy="58" rx="33" ry="5" fill="${O}" opacity="0.09"/>
    <circle cx="33" cy="42" r="18" fill="${GRON}" ${LINE}/>
    <circle cx="77" cy="43" r="16" fill="${GRON}" ${LINE}/>
    <circle cx="55" cy="33" r="20" fill="${GRON}" ${LINE}/>
    <circle cx="48" cy="28" r="3.6" fill="#F890B7" ${THIN}/>
    <circle cx="66" cy="38" r="3.6" fill="#F7C948" ${THIN}/>`
  );
}

function lyktaArt() {
  return svgWrap(
    "0 0 48 132",
    `<ellipse cx="24" cy="127" rx="12" ry="3.6" fill="${O}" opacity="0.09"/>
    <circle cx="24" cy="27" r="18" fill="#F7C948" opacity="0.25"/>
    ${limb("M24 124 L24 42", JARN, 5.5)}
    <rect x="13" y="116" width="22" height="9" rx="3.5" fill="${JARN}" ${THIN}/>
    <path d="M13 42 L35 42 L31 17 L17 17 Z" fill="#FDE9A8" ${LINE}/>
    <circle cx="24" cy="31" r="4.2" fill="#F7C948" ${THIN}/>
    <path d="M10 17 L38 17 L24 6 Z" fill="${JARN}" ${LINE}/>`
  );
}

/** Uppstående dekor: typ → färdig mini-SVG-sträng. */
export const DEKOR_ART = { trad: tradArt, gran: granArt, buske: buskeArt, lykta: lyktaArt };

/**
 * Platt markdekor som SVG-innehåll för by-markens 0 0 100 100-SVG:
 * dammen (om byDekor hittade plats) + blomrabatter och grästuvor.
 * Ritas EFTER vägen så rabatterna ligger ovanpå gräset, aldrig på vägen
 * (placeringarna är redan kollisionstestade i byDekor).
 */
export function dekorMarkSvg({ damm, platta }) {
  const f = (n) => Number(n.toFixed(2));
  const delar = [];

  if (damm) {
    const { x, y, rx, ry } = damm;
    delar.push(
      `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx + 0.9)}" ry="${f(ry + 0.5)}" fill="#8FCB74"/>
      <ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="#7EC4EA" stroke="${O}" stroke-width="0.35"/>
      <ellipse cx="${f(x - rx * 0.3)}" cy="${f(y - ry * 0.35)}" rx="${f(rx * 0.42)}" ry="${f(ry * 0.36)}" fill="#A9DCF4"/>
      <circle cx="${f(x + rx * 0.45)}" cy="${f(y + ry * 0.25)}" r="0.85" fill="${GRON}" stroke="${O}" stroke-width="0.2"/>
      <path d="M${f(x - rx - 0.4)} ${f(y)} q-0.3 -2.6 0.5 -3.6 M${f(x - rx + 0.9)} ${f(y + 0.5)} q0.4 -2.2 1.2 -2.8"
        stroke="#5FA152" stroke-width="0.45" fill="none" stroke-linecap="round"/>`
    );
  }

  for (const [i, p] of platta.entries()) {
    if (p.typ === "blommor") {
      // Liten blomrabatt: tre prickblommor i olika färger + gröna blad.
      const c = [
        ["#F890B7", "#F7C948", "#EF6F6C"],
        ["#F7C948", "#B79BE0", "#F890B7"],
      ][i % 2];
      delar.push(
        `<ellipse cx="${f(p.x)}" cy="${f(p.y + 0.4)}" rx="2.5" ry="0.9" fill="#8FCB74"/>
        <circle cx="${f(p.x - 1.3)}" cy="${f(p.y)}" r="0.6" fill="${c[0]}" stroke="${O}" stroke-width="0.18"/>
        <circle cx="${f(p.x + 0.2)}" cy="${f(p.y - 0.5)}" r="0.6" fill="${c[1]}" stroke="${O}" stroke-width="0.18"/>
        <circle cx="${f(p.x + 1.4)}" cy="${f(p.y + 0.1)}" r="0.6" fill="${c[2]}" stroke="${O}" stroke-width="0.18"/>`
      );
    } else {
      // Grästuva: tre korta strån.
      delar.push(
        `<path d="M${f(p.x - 1)} ${f(p.y)} q0.2 -1.7 0.9 -2.1 M${f(p.x)} ${f(p.y)} q0 -2 0.5 -2.4 M${f(p.x + 1)} ${f(p.y)} q-0.1 -1.5 0.6 -2"
          stroke="#7CBF63" stroke-width="0.45" fill="none" stroke-linecap="round"/>`
      );
    }
  }

  return delar.join("");
}

/**
 * Placera stämningsdekor i byn: träd/granar/buskar/lyktstolpar (uppstående,
 * ritas som egna element av by-scenen) + platt markdekor (damm, blomrabatter,
 * grästuvor – ritas direkt i markens SVG). Allt är deterministiskt (samma by →
 * samma dekor) och kollisionstestat mot tomter, vägsträckor och U-svängar,
 * så det funkar för få som många hus utan att något hamnar i vägen.
 * (Bor här i stället för i varld-by.js för 400-radersgränsen, #483.)
 *
 * @returns {{
 *   uppst: Array<{typ:"trad"|"gran"|"buske"|"lykta", x:number, y:number, s:number}>,
 *   platta: Array<{typ:"blommor"|"tuva", x:number, y:number, s:number}>,
 *   damm: {x:number, y:number, rx:number, ry:number} | null,
 * }}
 *   `x,y` är dekorens markpunkt (bottenmitt) i %, `s` en skalfaktor som följer
 *   husens storlek (mindre by-celler → mindre dekor).
 */
export function byDekor(layout) {
  const { tomter, cellW, radHojd, vagHojd, rader, vagY, klasscenter: kc } = layout;
  const s = Math.max(0.55, Math.min(1, radHojd / 26));
  const placerade = []; // markpunkter som tagit plats: {x, y, rx}

  // Är en dekor med MARKPUNKT (x,y), halvbredd rx och höjd h (uppåt från
  // marken) fri? Husen är bottentunga i sina tomtboxar, så en dekor vars
  // markpunkt ligger klart OVANFÖR husets mitt får stå "bakom" huset (kronan
  // tittar upp över taket – målarordningen via z-index gör resten). Blockerat
  // är: att stå PÅ ett hus, PÅ vägen/U-svängarna, eller ovanpå annan dekor.
  const fri = (x, y, rx, h) => {
    if (x < 2 || x > 98 || y > 96.5 || y - h < 2.5) return false;
    for (const t of tomter) {
      if (
        Math.abs(x - t.x) < cellW * 0.42 + rx * 0.6 &&
        y > t.y - radHojd * 0.35 &&
        y - h < t.y + radHojd * 0.5
      )
        return false;
    }
    // Klasscentret (#480): hela rutan + luften för mätaren ovanför är fredad –
    // ingen dekor varken ovanpå eller med krona in i byggnaden.
    if (kc && Math.abs(x - kc.x) < kc.bredd * 0.5 + rx * 0.6 && y > kc.topp - 6 && y - h < kc.botten) {
      return false;
    }
    for (let rad = 0; rad < rader; rad++) {
      if (Math.abs(y - vagY(rad, x)) < vagHojd * 0.5 + 1.2) return false;
    }
    for (let rad = 0; rad < rader - 1; rad++) {
      // U-svängens kantzon mellan rad och rad+1 (höger på jämna rader).
      const hoger = rad % 2 === 0;
      const kantX = hoger ? 96 : 4;
      if (
        y > vagY(rad, kantX) - 1.5 &&
        y < vagY(rad + 1, kantX) + vagHojd * 0.5 + 1.5 &&
        (hoger ? x > 91 - rx : x < 9 + rx)
      )
        return false;
    }
    for (const p of placerade) {
      if (Math.abs(x - p.x) < (p.rx + rx) * 0.8 + 1 && Math.abs(y - p.y) < 3.5) return false;
    }
    return true;
  };
  const ta = (x, y, rx) => placerade.push({ x, y, rx });

  // --- Damm: en liten spegeldamm nedanför sista vägsträckan om det får plats.
  let damm = null;
  {
    const rx = 8.5 * s + 1.5;
    const ry = 3.4 * s + 0.6;
    for (const x of [78, 22, 60, 38]) {
      const y = vagY(rader - 1, x) + vagHojd * 0.5 + ry + 2.4;
      if (fri(x, y + ry, rx + 1, ry * 2 + 1)) {
        damm = { x, y, rx, ry };
        ta(x, y + ry, rx + 1);
        break;
      }
    }
  }

  const uppst = [];

  // --- Lyktstolpar: vid vägkanten i gluggen mellan två grannhus (husen fyller
  // inte hela sin cell, så mittemellan är visuellt fritt). Max 4, glesare i
  // stora byar. Ingen fri()-koll mot hus här – gluggen ÄR mellan husen.
  let lyktor = 0;
  for (let rad = 0; rad < rader && lyktor < 4; rad++) {
    if (rader > 2 && rad % 2 === 1) continue;
    const iRad = tomter.filter((t) => t.rad === rad);
    if (!iRad.length) continue;
    let x;
    if (iRad.length > 1) {
      const k = (rad * 2) % (iRad.length - 1);
      x = (iRad[k].x + iRad[k + 1].x) / 2;
    } else {
      x = Math.min(94, iRad[0].x + cellW * 0.8);
    }
    // Gluggen mellan vänster- och höger-huset är Klasscentret – ingen lykta där.
    if (kc && rad === kc.rad && Math.abs(x - kc.x) < kc.bredd / 2 + 2) continue;
    const lyktY = vagY(rad, x) - vagHojd * 0.42;
    uppst.push({ typ: "lykta", x, y: lyktY, s });
    ta(x, lyktY, 2.3 * s);
    lyktor++;
  }

  // --- Träd, granar, buskar + platt dekor: deterministisk gyllene-snittspridning
  // över hela lagret, filtrerad genom fri(). Mängden följer byns storlek.
  const platta = [];
  const typer = ["trad", "buske", "tuva", "gran", "blommor", "buske", "trad", "blommor"];
  // Halvbredd + höjd (i %, före s) för kollisionstestet – matchar DEKOR_MATT
  // ovan (platta typer har små fasta mått).
  const matt = { trad: [4.5, 15], gran: [4, 16], buske: [4, 5.6], blommor: [2, 1.6], tuva: [1.6, 2.2] };
  const maxUppst = Math.min(12, 4 + Math.ceil(tomter.length * 0.6)) + lyktor;
  const maxPlatta = Math.min(8, 3 + Math.ceil(tomter.length * 0.4));
  for (let i = 0; i < 70 && (uppst.length < maxUppst || platta.length < maxPlatta); i++) {
    const typ = typer[i % typer.length];
    const star = typ === "trad" || typ === "gran" || typ === "buske";
    if (star ? uppst.length >= maxUppst : platta.length >= maxPlatta) continue;
    const x = 2 + ((i * 61.8 + 13) % 96);
    const y = 10 + ((i * 35.1 + 29) % 86);
    const rx = matt[typ][0] * (star ? s : 1);
    const h = matt[typ][1] * (star ? s : 1);
    if (!fri(x, y, rx, h)) continue;
    ta(x, y, rx);
    (star ? uppst : platta).push({ typ, x, y, s });
  }

  return { uppst, platta, damm };
}
