// ============================================================================
// Pluggportalen – stämningsdekor till klassbyn (by-nivån)
// ----------------------------------------------------------------------------
// Ritar dekoren som byDekor() (varld-by.js) placerar ut:
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
