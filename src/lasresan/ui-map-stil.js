// ============================================================================
// Läsresan – kartvyns stil (src/lasresan/ui-map-stil.js)  ·  issue #400
// ----------------------------------------------------------------------------
// CSS:en bor här (injiceras en gång av ui-map.js) i stället för i styles.css,
// så Läsresans karta inte rör de delade bootfilerna (#401 bygger parallellt).
// Allt är prefixat lr- och responsivt: kartan är en skalande SVG, klickytor
// och text skalar med den. prefers-reduced-motion stänger av all rörelse.
// ============================================================================

const CSS = `
.lr-karta { position: relative; border-radius: 18px; overflow: hidden;
  box-shadow: 0 6px 24px rgba(59, 51, 80, 0.18); line-height: 0; }
.lr-karta svg.lr-scen { display: block; width: 100%; height: auto; }
/* Kort skärm (#429): hela kartan ska synas utan vertikal scroll. Bredden
   kapas så att höjden (bredd / --lr-ar) ryms under --lr-ovan (avståndet från
   sidtoppen, satt av page-lasresan.js). Golv 360px så den aldrig blir pytte. */
.lr-karta { margin-inline: auto;
  max-width: max(360px, calc((100vh - var(--lr-ovan, 24px)) * var(--lr-ar, 1.6)));
  max-width: max(360px, calc((100dvh - var(--lr-ovan, 24px)) * var(--lr-ar, 1.6))); }

/* --- Världsväljare (pills inne i kartans övre vänstra hörn) --------------- */
.lr-varldar { position: absolute; top: 10px; left: 10px; z-index: 3;
  display: flex; gap: 6px; flex-wrap: wrap; line-height: 1.2; }
.lr-varld-pill { border: 2px solid rgba(59, 51, 80, 0.35); border-radius: 999px;
  padding: 6px 14px; font: 700 14px/1.2 inherit; font-family: inherit;
  background: rgba(255, 248, 231, 0.92); color: #3b3350; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px; }
.lr-varld-pill:hover { background: #fff; }
.lr-varld-pill[aria-pressed="true"] { background: #f7c948; border-color: #3b3350; }
.lr-varld-pill:disabled { opacity: 0.6; cursor: not-allowed; }

/* --- Stegmarkörer i SVG:n -------------------------------------------------- */
.lr-steg { cursor: default; }
.lr-steg--nasta { cursor: pointer; }
.lr-steg--nasta:focus { outline: none; }
.lr-steg--nasta:focus .lr-steg-ring,
.lr-steg--nasta:hover .lr-steg-ring { stroke-width: 7; }
.lr-puls { transform-origin: center; transform-box: fill-box;
  animation: lr-puls 1.7s ease-in-out infinite; }
@keyframes lr-puls {
  0%, 100% { transform: scale(1); opacity: 0.9; }
  50% { transform: scale(1.35); opacity: 0.25; }
}

/* --- Avataren -------------------------------------------------------------- */
.lr-avatar { will-change: transform; }
.lr-avatar-inner { line-height: 1; }
.lr-avatar--gar .lr-avatar-inner { animation: lr-bob 0.38s ease-in-out infinite; }
@keyframes lr-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-7px); }
}

/* --- Firande (värld klar) --------------------------------------------------- */
.lr-firande { position: absolute; inset: 0; z-index: 4; display: grid;
  place-items: center; background: rgba(59, 51, 80, 0.35); line-height: 1.4;
  animation: lr-tona 0.4s ease-out; }
@keyframes lr-tona { from { opacity: 0; } to { opacity: 1; } }
.lr-firande-kort { background: #fff8e7; border: 3px solid #3b3350;
  border-radius: 20px; padding: clamp(16px, 4vw, 32px) clamp(22px, 5vw, 44px);
  text-align: center; box-shadow: 0 10px 30px rgba(59, 51, 80, 0.3);
  max-width: min(86%, 420px); animation: lr-studs 0.5s cubic-bezier(0.2, 1.6, 0.4, 1); }
@keyframes lr-studs { from { transform: scale(0.6); } to { transform: scale(1); } }
.lr-firande-kort .lr-stor { font-size: clamp(34px, 7vw, 56px); line-height: 1.1; }
.lr-firande-kort h3 { margin: 8px 0 2px; font-size: clamp(18px, 4vw, 26px); color: #3b3350; }
.lr-firande-kort p { margin: 4px 0 0; font-size: clamp(14px, 3vw, 17px); color: #3b3350; }
.lr-konfetti { position: absolute; top: -12px; width: 10px; height: 16px;
  border-radius: 3px; opacity: 0.95; animation: lr-fall linear forwards; }
@keyframes lr-fall {
  to { transform: translateY(110vh) rotate(720deg); opacity: 0.7; }
}

@media (prefers-reduced-motion: reduce) {
  .lr-puls, .lr-avatar--gar .lr-avatar-inner, .lr-konfetti { animation: none; }
  .lr-firande, .lr-firande-kort { animation: none; }
}
`;

/** Injicera kartans CSS en gång per sida. */
export function ensureMapCss() {
  if (typeof document === "undefined" || document.getElementById("lasresan-map-css")) return;
  const el = document.createElement("style");
  el.id = "lasresan-map-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
