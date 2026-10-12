// ============================================================================
// Hitta rätt! – kartans stil (src/hitta-ratt/karta/karta-stil.js) · #606
// ----------------------------------------------------------------------------
// CSS:en bor här och injiceras en gång av kartmotorn (som Läsresans
// ui-map-stil.js), så modulen aldrig rör styles.css eller bootgrafen.
// Allt är prefixat hr-. Färgerna bygger på appens --bla/--gron/--gul/--rod/
// --text (01-grund.css) med reservvärden, så kartan ser rätt ut även i en
// fristående preview. Linjebredder skalas inte vid zoom (non-scaling-stroke).
// ============================================================================

const CSS = `
.hr-karta {
  --hr-hav: #cfe9f8; --hr-sjo: #cfe9f8; --hr-sjo-kant: #9ccbe6;
  --hr-land: #fbf3dc; --hr-land-bak: #e9e2cf; --hr-grans: #a99b7d;
  --hr-alv: #8ec9ec; --hr-hover: #fff7cf;
  --hr-vald: var(--gul, #f2c94c); --hr-ratt: var(--gron, #27ae60); --hr-fel: var(--rod, #eb5757);
  --hr-mork: var(--text, #22314a); --hr-nal: var(--bla, #2f80ed); --hr-fokus: var(--bla-mork, #1b5fc0);
  position: absolute; inset: 0; overflow: hidden; background: var(--hr-hav);
  touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
  cursor: grab; outline: none; font-family: var(--font, "Baloo 2", system-ui, sans-serif);
}
.hr-karta.drar { cursor: grabbing; }
/* outline (inte inset-skugga) – ritas ovanpå SVG:n. */
.hr-karta:focus-visible { outline: 3px solid var(--hr-fokus); outline-offset: -3px; }
.hr-svg { display: block; width: 100%; height: 100%; }
.hr-hav { fill: var(--hr-hav); }
.hr-kamera path { vector-effect: non-scaling-stroke; stroke-linejoin: round; stroke-linecap: round; }
.hr-bakgrund { fill: var(--hr-land-bak); stroke: var(--hr-grans); stroke-width: 0.6; pointer-events: none; }
.hr-omrade { fill: var(--hr-land); stroke: var(--hr-grans); stroke-width: 0.9; }
.hr-karta.lage-omrade:not(.last) .hr-omrade { cursor: pointer; }
@media (hover: hover) {
  .hr-karta.lage-omrade:not(.last):not(.drar) .hr-omrade:hover { fill: var(--hr-hover); }
}
/* Gränser per moment: "svag" = orienteringsstöd, av = bara kust och landsgränser. */
.hr-karta.granser-svag .hr-omrade { stroke: var(--hr-grans); stroke-opacity: 0.45; stroke-width: 0.6; }
.hr-karta.granser-av .hr-omrade { stroke: var(--hr-land); stroke-width: 0.8; }
.hr-omrade.vald, .hr-karta.lage-omrade:not(.last) .hr-omrade.vald:hover { fill: var(--hr-vald); }
.hr-omrade.ratt { fill: var(--hr-ratt); }
/* Lärarvyns valda områden (redigering.js, #636) – blå fyllning + kontur. */
.hr-omrade.markerad, .hr-karta.lage-omrade:not(.last) .hr-omrade.markerad:hover { fill: #a9cdf7; stroke: var(--hr-fokus); stroke-width: 2.2; stroke-opacity: 1; }
.hr-sjoar { fill: var(--hr-sjo); stroke: var(--hr-sjo-kant); stroke-width: 0.6; pointer-events: none; }
.hr-vattendrag { fill: none; stroke: var(--hr-alv); stroke-width: 1.1; pointer-events: none; }
.hr-val-kontur, .hr-ratt-kontur, .hr-fel-kontur { fill: none; pointer-events: none; }
.hr-val-kontur { stroke: var(--hr-mork); stroke-width: 2.6; stroke-dasharray: 7 4; }
.hr-fel-kontur { stroke: #8f1d1d; stroke-width: 2.4; stroke-dasharray: 3 3; }
.hr-ratt-kontur { stroke: #14532d; stroke-width: 3.2; }

/* --- Skärmlagret: ringar, nålar, linje, etiketter (konstant storlek) ------- */
.hr-skarm { pointer-events: none; }
/* Diskret ring (#639), men hela cirkeln är klickyta. Utan färg: vald =
   streckad, rätt = heldragen och tjock, fel = prickad. */
.hr-ring { fill: rgba(255, 255, 255, 0.01); stroke: var(--hr-mork); stroke-opacity: 0.35; stroke-width: 1; pointer-events: all; cursor: pointer; }
.hr-ring:hover { stroke-opacity: 0.8; }
.hr-ring.vald, .hr-ring.ratt, .hr-ring.markerad { stroke: var(--hr-fokus); stroke-opacity: 1; stroke-width: 2.2; fill: rgba(47, 128, 237, 0.45); }
.hr-ring.fel { stroke-opacity: 1; }
.hr-ring.vald { stroke: var(--hr-mork); stroke-width: 2; stroke-dasharray: 4 3; fill: rgba(242, 201, 76, 0.5); }
.hr-ring.ratt { stroke: #14532d; stroke-width: 2.5; fill: rgba(39, 174, 96, 0.5); }
.hr-ring.fel { stroke: #8f1d1d; stroke-width: 2.2; stroke-dasharray: 0.1 4; stroke-linecap: round; fill: rgba(235, 87, 87, 0.45); }
.hr-karta.last .hr-ring { pointer-events: none; cursor: inherit; }
.hr-nal path { stroke: #fff; stroke-width: 2.5; }
.hr-nal-giss path { fill: var(--hr-nal); }
.hr-nal-ratt path { fill: var(--hr-ratt); }
.hr-nal-prick { fill: #fff; }
.hr-nal-ratt .hr-nal-prick { fill: #14532d; }
.hr-karta:not(.last) .hr-nal-giss { pointer-events: all; cursor: move; }
.hr-nal-giss.landar { animation: hr-landa 0.22s ease-out; }
@keyframes hr-landa { from { opacity: 0.4; } to { opacity: 1; } }
.hr-linje { stroke: var(--hr-mork); stroke-width: 2.5; stroke-dasharray: 6 5; }
.hr-etikett text { font: 800 15px/1 var(--font, "Baloo 2", system-ui, sans-serif); fill: var(--hr-mork);
  paint-order: stroke; stroke: #fff; stroke-width: 4px; stroke-linejoin: round; }
.hr-etikett.km text { font-size: 14px; font-weight: 700; }
.hr-sikte { display: none; stroke: var(--hr-mork); stroke-width: 2; fill: none; }
.hr-karta:not(.last):focus-visible .hr-sikte { display: inline; }

/* --- Kontroller och attribution -------------------------------------------- */
.hr-kontroller { position: absolute; right: 10px; bottom: 24px; display: grid; gap: 6px; z-index: 1; }
.hr-kontroller button { width: 44px; height: 44px; border-radius: 12px; border: 2px solid rgba(34, 49, 74, 0.2);
  background: rgba(255, 255, 255, 0.95); font: 800 24px/1 var(--font, "Baloo 2", system-ui, sans-serif);
  color: var(--hr-mork); cursor: pointer; box-shadow: 0 3px 0 rgba(0, 0, 0, 0.1); padding: 0;
  display: grid; place-items: center; touch-action: manipulation; }
.hr-kontroller button:hover { background: #fff; }
.hr-kontroller button:focus-visible { outline: 3px solid var(--hr-fokus); outline-offset: 2px; }
.hr-kontroller button:disabled { opacity: 0.45; cursor: default; }
.hr-attribution { position: absolute; left: 8px; bottom: 4px; font-size: 11px; line-height: 1.2;
  color: rgba(34, 49, 74, 0.6); pointer-events: none; }
`;

export function ensureKartaCss() {
  if (typeof document === "undefined" || document.getElementById("hitta-ratt-karta-css")) return;
  const el = document.createElement("style");
  el.id = "hitta-ratt-karta-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
