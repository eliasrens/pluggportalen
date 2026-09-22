// ============================================================================
// Pluggporten – laggårdens köpbara SKINS (issue #353)
// ----------------------------------------------------------------------------
// Fasad-familjer för laggården som väljs OBEROENDE av nivån: farm.barnSkin
// (data-farm.js) pekar på en post här, medan kapaciteten (spiltor/djurplatser)
// fortfarande styrs av farm.barnLevel (#333). Samma mönster som husskalen
// (LYX_HUS_SKAL i art-hus-lyx.js): egen art-modul, id:n sparas i Firestore
// (ownedItems + farm.barnSkin) → håll dem STABILA. Registret läses av
// art-gard.js (fasad + interiör-toning) och varld-lada-skin.js (väljaren).
//
// Stilguiden (art-style.js): kontur O #3B3350, platta mättade färger, rundade
// former. Varje fasad ritas i gårds-scenens koordinater (laggården i högra
// tredjedelen, mark ~y548) och MÅSTE innehålla `dorr` (skickas in färdig av
// art-gard.js – exakt samma #laggard-dorr på exakt samma plats, så kamera-
// fokus/klick-riggen aldrig påverkas av skin-valet) samt `badge(x, y)` så
// nivån fortfarande syns på fasaden. `inne` tonar interiörens väggar/golv
// (laggardScen) – spiltor/foderhoar förblir trä (de är möbler, inte väggar).
//
// OBS BOOTGRAFEN (incident #271): modulen ligger MEDVETET utanför den statiska
// bootkedjan – den importeras bara av art-gard.js/varld-lada-skin.js som båda
// är dynamiska. Importera den aldrig från bootfiler.
// ============================================================================

import { LINE, THIN, O } from "./art-style.js";

// --- Blå sjölada (lada-bla): fiskeläge-känsla – marinblått, vita knutar, ------
// hyttventil-fönster, livboj och en liten röd vimpel på höloftet.
const BLA = "#5F8FD4";
const BLA_MORK = "#46557A"; // stilguidens marin
function sjoladaFasad({ dorr, badge, shadow, level }) {
  return `<g aria-hidden="false">
    ${shadow(790, 552, 165)}
    <rect x="656" y="330" width="268" height="218" rx="10" fill="${BLA}" ${LINE}/>
    <path d="M672 386 L908 386 M672 470 L908 470" stroke="${BLA_MORK}" stroke-width="4" opacity="0.45"/>
    <path d="M636 340 L700 240 L880 240 L944 340 Z" fill="${BLA_MORK}" ${LINE}/>
    <rect x="690" y="228" width="200" height="24" rx="10" fill="#FFF3DC" ${LINE}/>
    <!-- Vimpel på loftkanten -->
    <path d="M760 228 L760 192" stroke="${O}" stroke-width="4" stroke-linecap="round"/>
    <path d="M760 194 L794 203 L760 212 Z" fill="#EF6F6C" ${THIN}/>
    <!-- Vita knutar -->
    <rect x="656" y="336" width="16" height="212" rx="6" fill="#FFF3DC" ${THIN}/>
    <rect x="908" y="336" width="16" height="212" rx="6" fill="#FFF3DC" ${THIN}/>
    <!-- Hyttventil: runt fönster i vit ram -->
    <circle cx="790" cy="292" r="26" fill="#FFF3DC" ${LINE}/>
    <circle cx="790" cy="292" r="17" fill="#9AD3F0" ${THIN}/>
    <!-- Livboj vid dörren -->
    <circle cx="690" cy="442" r="23" fill="#FFF3DC" ${LINE}/>
    <path d="M690 419 A23 23 0 0 1 713 442" fill="none" stroke="#EF6F6C" stroke-width="8"/>
    <path d="M690 465 A23 23 0 0 1 667 442" fill="none" stroke="#EF6F6C" stroke-width="8"/>
    <circle cx="690" cy="442" r="9" fill="${BLA}" ${THIN}/>
    ${dorr}
    ${badge(880, 292)}
  </g>`;
}

// --- Godislada (lada-godis): rosa väggar, mint-tak, polkagris-knutar, ---------
// peppermint-fönster och en slickepinne vid dörren. Sockersött & glatt.
const ROSA = "#F890B7";
const ROSA_MORK = "#D96A97";
const MINT = "#58C6A9";
/** Polkagris-knut: vit stolpe med röda diagonala ränder (hålls inne i stolpen). */
function polkaKnut(x) {
  const rander = [356, 396, 436, 476, 516]
    .map((y) => `<path d="M${x + 2} ${y + 11} L${x + 14} ${y}" stroke="#EF6F6C" stroke-width="7"/>`)
    .join("");
  return `<rect x="${x}" y="336" width="16" height="212" rx="6" fill="#FFF3DC" ${THIN}/>
    ${rander}
    <rect x="${x}" y="336" width="16" height="212" rx="6" fill="none" ${THIN}/>`;
}
function godisladaFasad({ dorr, badge, shadow, level }) {
  return `<g aria-hidden="false">
    ${shadow(790, 552, 165)}
    <rect x="656" y="330" width="268" height="218" rx="10" fill="${ROSA}" ${LINE}/>
    <!-- Strösselprickar på väggen -->
    <circle cx="700" cy="380" r="6" fill="#FFF3DC"/><circle cx="880" cy="420" r="6" fill="#FFF3DC"/>
    <circle cx="692" cy="500" r="6" fill="#FFF3DC"/><circle cx="902" cy="500" r="6" fill="#F7C948"/>
    <circle cx="864" cy="368" r="6" fill="#C9F0DC"/>
    <path d="M636 340 L700 240 L880 240 L944 340 Z" fill="${MINT}" ${LINE}/>
    <!-- Glasyrkant som "droppar" från taket -->
    <path d="M652 342 Q668 362 684 342 Q700 362 716 342 L864 342 Q880 362 896 342 Q912 362 928 342"
      fill="none" stroke="#FFF3DC" stroke-width="9" stroke-linecap="round"/>
    <rect x="690" y="228" width="200" height="24" rx="10" fill="#FFF3DC" ${LINE}/>
    <!-- Peppermint-fönster: vit karamell med röda kilar -->
    <circle cx="790" cy="292" r="24" fill="#FFF3DC" ${LINE}/>
    <path d="M790 292 L790 268 A24 24 0 0 1 807 275 Z M790 292 L814 292 A24 24 0 0 1 807 309 Z
      M790 292 L790 316 A24 24 0 0 1 773 309 Z M790 292 L766 292 A24 24 0 0 1 773 275 Z" fill="#EF6F6C" stroke="none"/>
    ${polkaKnut(656)}
    ${polkaKnut(908)}
    <!-- Slickepinne vid dörren -->
    <path d="M690 470 L690 420" stroke="#FFF3DC" stroke-width="7" stroke-linecap="round"/>
    <circle cx="690" cy="408" r="17" fill="#B79BE0" ${LINE}/>
    <path d="M690 408 m-9 0 a9 9 0 1 1 9 9" fill="none" stroke="#FFF3DC" stroke-width="5" stroke-linecap="round"/>
    ${dorr}
    ${badge(880, 292)}
  </g>`;
}

// --- Rymdlada (lada-rymd): silvrig rymdstation – kupoltak, antenn, nitar ------
// och ett runt luck-fönster med stjärnkik. Framtidens bondgård!
const SILVER = "#A8BAD1";
const SILVER_MORK = "#7C8DAD";
function rymdladaFasad({ dorr, badge, shadow, level }) {
  const nitar = [672, 908]
    .map((x) => [360, 420, 480, 532].map((y) => `<circle cx="${x}" cy="${y}" r="4" fill="${SILVER_MORK}"/>`).join(""))
    .join("");
  return `<g aria-hidden="false">
    ${shadow(790, 552, 165)}
    <rect x="656" y="330" width="268" height="218" rx="10" fill="${SILVER}" ${LINE}/>
    <path d="M656 402 L924 402" stroke="${SILVER_MORK}" stroke-width="4" opacity="0.6"/>
    ${nitar}
    <!-- Kupoltak med antenn och blinklampa -->
    <path d="M648 336 Q790 176 932 336 Z" fill="#C9D4E8" ${LINE}/>
    <path d="M700 302 Q790 236 880 302" fill="none" stroke="${SILVER_MORK}" stroke-width="4" opacity="0.7"/>
    <path d="M790 258 L790 196" stroke="${O}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="790" cy="188" r="9" fill="#EF6F6C" ${THIN}/>
    <!-- Runt luck-fönster med stjärna -->
    <circle cx="790" cy="368" r="24" fill="#46557A" ${LINE}/>
    <circle cx="790" cy="368" r="24" fill="none" stroke="#FFF3DC" stroke-width="4" opacity="0.5"/>
    <path d="M790 358 L793 365 L800 365 L794 370 L797 378 L790 373 L783 378 L786 370 L780 365 L787 365 Z" fill="#F7C948" stroke="none"/>
    <!-- Lysande panel vid dörren -->
    <rect x="672" y="424" width="38" height="52" rx="8" fill="#58C6A9" ${LINE}/>
    <path d="M680 438 L702 438 M680 450 L702 450 M680 462 L694 462" stroke="#FFF3DC" stroke-width="4" stroke-linecap="round"/>
    ${dorr}
    ${badge(884, 320)}
  </g>`;
}

/**
 * Registret: id → { namn, emoji, fasad(o), inne }. Id = shop-id (shop-items.js,
 * `barnSkin: true`) = värdet i farm.barnSkin – håll dem i synk och STABILA.
 * `fasad` får { level, dorr, badge, shadow } av art-gard.js; `inne` tonar
 * interiörens bakvägg/panel/golv i laggardScen (utelämnade fält = trä-default).
 */
export const LADA_SKINS = {
  "lada-bla": {
    namn: "Blå sjölada", emoji: "🌊", fasad: sjoladaFasad,
    inne: { vagg: BLA, morkt: BLA_MORK, golv: "#D9C9A3" },
  },
  "lada-godis": {
    namn: "Godislada", emoji: "🍬", fasad: godisladaFasad,
    inne: { vagg: ROSA, morkt: ROSA_MORK, golv: "#F7E1C0" },
  },
  "lada-rymd": {
    namn: "Rymdlada", emoji: "🛸", fasad: rymdladaFasad,
    inne: { vagg: SILVER, morkt: SILVER_MORK, golv: "#C3CCDE" },
  },
};
