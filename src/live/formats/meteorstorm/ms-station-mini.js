// ============================================================================
// Meteorstormen ☄️ (#823, spec §5): ELEVSKÄRMENS LILLA STATION – en tecknad
// rymdstation (SVG) med sköldbubbla och skrovmätare, och de andra
// stationernas skrov som små mätare. Ren (HTML-strängar, ingen DOM) –
// testas i test/live-meteorstorm-elev.test.js. Projektorns stora station
// ritar C; den här är en egen, liten och lugn (inga blinkningar).
//
//   skadenivån (ms-balans.js skadeniva): hel → repor → sprickor → rok → flyter
//   sköldbubblan: synligare ju fullare skölden är (0–60), borta vid 0
//
// API
//   stationSvg({ skrov, skold, flyter }) → <svg …> (aria-hidden – texten bredvid)
//   matareHtml({ namn, skrov, flyter, egen? }) → en skrovmätare
// ============================================================================

import { skadeniva, SKOLD_TAK, SKROV_START } from "./delat/ms-balans.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const klamp = (x, lo, hi) => Math.min(hi, Math.max(lo, Number(x) || 0));

/** Den egna stationen: kropp, solpaneler, fönster, antenn + sköldbubbla. */
export function stationSvg({ skrov = SKROV_START, skold = 0, flyter = false } = {}) {
  const s = klamp(skrov, 0, SKROV_START);
  const niva = flyter || s <= 0 ? "flyter" : skadeniva(s).id;
  const andel = klamp(skold, 0, SKOLD_TAK) / SKOLD_TAK;
  const bubbla = andel > 0
    ? `<circle class="mse-st-bubbla" cx="50" cy="50" r="44" style="opacity:${(0.25 + 0.6 * andel).toFixed(2)}"></circle>`
    : "";
  // Släckta fönster vid svår skada (2 av 3 vid "rok"/"flyter").
  const slackt = (i) => (niva === "flyter" || (niva === "rok" && i < 2) ? " mse-st-slackt" : "");
  return `<svg class="mse-st mse-st-${niva}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    ${bubbla}
    <g class="mse-st-kropp">
      <rect class="mse-st-panel" x="6" y="44" width="22" height="12" rx="3"></rect>
      <rect class="mse-st-panel" x="72" y="44" width="22" height="12" rx="3"></rect>
      <line class="mse-st-arm" x1="28" y1="50" x2="34" y2="50"></line>
      <line class="mse-st-arm" x1="66" y1="50" x2="72" y2="50"></line>
      <line class="mse-st-antenn" x1="50" y1="30" x2="${niva === "rok" || niva === "flyter" ? 58 : 50}" y2="18"></line>
      <circle class="mse-st-topp" cx="${niva === "rok" || niva === "flyter" ? 58 : 50}" cy="17" r="3"></circle>
      <ellipse class="mse-st-skrov" cx="50" cy="52" rx="17" ry="20"></ellipse>
      ${[0, 1, 2].map((i) => `<circle class="mse-st-fonster${slackt(i)}" cx="${42 + i * 8}" cy="50" r="3.2"></circle>`).join("")}
      ${niva === "repor" || niva === "sprickor" || niva === "rok" || niva === "flyter"
        ? `<path class="mse-st-repa" d="M38 60 l5 -3 l3 4"></path>` : ""}
      ${niva === "sprickor" || niva === "rok" || niva === "flyter"
        ? `<path class="mse-st-spricka" d="M56 38 l-3 6 l4 3 l-3 6"></path><circle class="mse-st-lampa" cx="62" cy="64" r="2.4"></circle>` : ""}
      ${niva === "rok" || niva === "flyter" ? `<circle class="mse-st-rok" cx="66" cy="36" r="5"></circle><circle class="mse-st-rok" cx="71" cy="30" r="3.5"></circle>` : ""}
    </g>
  </svg>`;
}

/** En stations skrov som liten mätare ("4D ▓▓▓░ 64"). */
export function matareHtml({ namn = "", skrov = null, flyter = false, egen = false } = {}) {
  const v = skrov == null ? null : klamp(skrov, 0, SKROV_START);
  const ton = v == null ? "" : v <= 25 ? " mse-matare-lag" : v <= 50 ? " mse-matare-mellan" : "";
  const label = v == null ? `${namn}: väntar på stationen` : `${namn}: skrov ${Math.round(v)} av ${SKROV_START}${flyter ? ", flyter i rymden" : ""}`;
  return `<div class="mse-matare${egen ? " mse-matare-egen" : ""}${ton}" role="img" aria-label="${esc(label)}">
    <span class="mse-matare-namn">${esc(namn)}</span>
    <span class="mse-matare-bar"><i style="width:${v == null ? 0 : v}%"></i></span>
    <b class="mse-matare-tal">${v == null ? "–" : flyter && v <= 0 ? "🛰️" : Math.round(v)}</b>
  </div>`;
}
