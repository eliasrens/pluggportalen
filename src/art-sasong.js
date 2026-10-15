// ============================================================================
// Pluggporten – säsongsdekor: löv, fladdermöss, måne, pumpor, vinkande djur (#691)
// ----------------------------------------------------------------------------
// Ren SVG-konst i stilguidens stil (art-style.js) – gulligt-läskigt, aldrig
// otäckt: stora ögon, runda former, inga tänder. Används av season-world.js
// (lövlagret + fladdermöss) och inloggningsskärmarna (porten + lärarspärren).
// Synligheten styrs av klasserna .sz-bara-host / .sz-bara-halloween /
// .sz-dolj-halloween (styles/32-sasong.css) mot <html data-sasong
// data-halloween>, så ett säsongsbyte är bara ett attributbyte – ingen
// omritning. Laddas BARA med import() (#271).
// ============================================================================

import { O, LINE, THIN, stjarna, lovhog, pumpaDekor } from "./art-style.js";

// --- Löven ------------------------------------------------------------------
// Fyra varianter som ritas EN gång (som strängar) och återanvänds av alla löv.
const LOV_FARGER = ["#F08A3C", "#EF6F6C", "#F7C948", "#C8743C"];
const LOV_FORMER = [
  // lönnlöv (mjukt), rundat björklöv, ekblad, smalt pilblad
  "M12 1 L15 7 L21 5 L18 11 L23 14 L16 15 L15 22 L12 18 L9 22 L8 15 L1 14 L6 11 L3 5 L9 7 Z",
  "M12 2 Q22 8 18 18 Q12 23 6 18 Q2 8 12 2 Z",
  "M12 1 Q16 4 14 7 Q19 8 16 12 Q20 15 15 17 Q14 22 12 23 Q10 22 9 17 Q4 15 8 12 Q5 8 10 7 Q8 4 12 1 Z",
  "M12 1 Q19 9 12 23 Q5 9 12 1 Z",
];

/** Lövvariant i (0–3) som liten SVG-sträng (24×24). */
export function lovSvg(i) {
  const n = ((i % 4) + 4) % 4;
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
    <path d="${LOV_FORMER[n]}" fill="${LOV_FARGER[n]}" stroke="${O}" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M12 4 L12 21" stroke="${O}" stroke-width="1" stroke-linecap="round" opacity="0.55"/></svg>`;
}

/** Gullig rund fladdermus (64×40) – flyger förbi i Halloween-kvällen. */
export function fladderSvg() {
  return `<svg viewBox="0 0 64 40" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 20 Q12 6 2 14 Q8 16 6 22 Q12 20 14 26 Q18 20 24 24 Z" fill="#5B4A8B" ${THIN}/>
    <path d="M40 20 Q52 6 62 14 Q56 16 58 22 Q52 20 50 26 Q46 20 40 24 Z" fill="#5B4A8B" ${THIN}/>
    <path d="M24 12 L25 4 L29 10 Z M40 12 L39 4 L35 10 Z" fill="#6E5BA3" ${THIN}/>
    <ellipse cx="32" cy="20" rx="10" ry="10" fill="#6E5BA3" ${THIN}/>
    <circle cx="28.5" cy="18" r="3.2" fill="#fff"/><circle cx="35.5" cy="18" r="3.2" fill="#fff"/>
    <circle cx="29" cy="18.6" r="1.7" fill="${O}"/><circle cx="36" cy="18.6" r="1.7" fill="${O}"/>
    <path d="M29.5 24 Q32 26 34.5 24" fill="none" stroke="${O}" stroke-width="1.2" stroke-linecap="round"/>
    <ellipse cx="26" cy="23" rx="1.8" ry="1" fill="#FFB1B8"/><ellipse cx="38" cy="23" rx="1.8" ry="1" fill="#FFB1B8"/></svg>`;
}

/** Stor gul måne med mjuk gloria och några kratrar. */
function mane(x, y, r) {
  return `<circle cx="${x}" cy="${y}" r="${r * 1.45}" fill="#FDE9A8" opacity="0.18" stroke="none"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="#FDE9A8" ${LINE}/>
    <circle cx="${x - r * 0.35}" cy="${y - r * 0.2}" r="${r * 0.16}" fill="#F2D27A" stroke="none"/>
    <circle cx="${x + r * 0.3}" cy="${y + r * 0.32}" r="${r * 0.12}" fill="#F2D27A" stroke="none"/>
    <circle cx="${x + r * 0.22}" cy="${y - r * 0.38}" r="${r * 0.08}" fill="#F2D27A" stroke="none"/>`;
}

/** Plats för ett Halloween-djur som vinkar (fylls av season-world.js). */
function vinkdjur(x, y, s = 1) {
  return `<g class="sz-bara-halloween" transform="translate(${x} ${y}) scale(${s})"><g class="sz-vinkdjur"></g></g>`;
}

/** Lyktpumpa som lyser svagt (för inloggningens förgrund). */
function lyktpumpa(x, y, s = 1) {
  return `<g class="sz-bara-halloween" transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="-14" rx="27" ry="19" fill="#F49E4C" opacity="0.22" stroke="none"/>
    <ellipse cx="0" cy="-14" rx="20" ry="15" fill="#F49E4C" ${LINE}/>
    <path d="M-7 -28 Q0 -14 -7 1 M7 -28 Q0 -14 7 1" fill="none" ${THIN}/>
    <path d="M0 -28 q1 -7 6 -8" fill="none" stroke="#6FA85B" stroke-width="4" stroke-linecap="round"/>
    <path d="M-10 -18 l3.5 -5 l3.5 5 Z M3 -18 l3.5 -5 l3.5 5 Z" fill="#FDE9A8" ${THIN}/>
    <path d="M-8 -9 Q0 -3 8 -9 Q0 -6 -8 -9 Z" fill="#FDE9A8" ${THIN}/></g>`;
}

/**
 * Säsongsdekor till elevernas port-scen (viewBox 960×600, art-port-majestic.js).
 * Allt ligger RUNT login-skylten (x≈340–620, y≈230–460) – aldrig bakom text.
 * @returns {{bak:string, fram:string}}
 */
export function portDekor() {
  const stjarnor = [[300, 60], [420, 120], [560, 40], [700, 140], [880, 210], [40, 230], [250, 190], [640, 210]]
    .map(([x, y], i) => stjarna(x, y, i % 3 ? 1.2 : 1.8, "#FDE9A8"))
    .join("");
  const bak = `<g class="sz-bara-halloween">${stjarnor}${mane(110, 104, 44)}</g>`;
  // Halloween-djuret som vinkar (spec §1.5) står framför vänstra pelarfoten;
  // konsten fylls i lazy av season-world.js (src/halloween/, bara när Halloween är på).
  const fram = `${lovhog(112, 552, 1.5)}${lovhog(852, 550, 1.4)}${lovhog(318, 572, 1)}${lovhog(642, 574, 1)}
    ${lyktpumpa(96, 560, 1.35)}${pumpaDekor(48, 588, 0.9)}${lyktpumpa(842, 556, 1.2)}${pumpaDekor(300, 584, 0.75)}
    ${vinkdjur(176, 468, 0.95)}`;
  return { bak, fram };
}

/**
 * Dekor till lärarspärren (#/larare): en helskärms-SVG i hörnen runt panelen
 * (meet mot en bred ram – panelen ligger i mitten, dekoren i kanterna).
 */
export function gateDekorSvg() {
  return `<svg class="sz-gate-svg" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMax slice"
      aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
    <g class="sz-bara-halloween">${mane(1080, 110, 52)}${stjarna(940, 70, 1.6, "#FDE9A8")}${stjarna(160, 90, 1.4, "#FDE9A8")}${stjarna(260, 180, 1.1, "#FDE9A8")}
      </g>${vinkdjur(1060, 560, 1.15)}
    ${lovhog(90, 690, 2)}${lovhog(1110, 690, 1.8)}${lovhog(230, 696, 1.2)}
    ${lyktpumpa(110, 690, 1.8)}${pumpaDekor(200, 696, 1.2)}${lyktpumpa(1010, 692, 1.5)}
  </svg>`;
}
