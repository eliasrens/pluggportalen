// ============================================================================
// Pluggporten – Klasscentret: kodritad byggnad, en nivå per post i kc-niva.js NIVAER (#478, epic #476)
// ----------------------------------------------------------------------------
// Index-modul: klasscenterSvg(niva, opts) + KLASSCENTER_NIVAER + mått.
// Själva konsten ligger i art-klasscenter-tidig.js (1–4), -mitt.js (5–7) och
// -sen.js (8–10); delade mått/byggdelar i art-klasscenter-delar.js.
//
// 🔴 Bootgraf: importera ALDRIG denna modul statiskt från app.js-grafen – den
// laddas dynamiskt (import()) där Klasscentret visas (#271/#454-lärdomen).
// ============================================================================

import { G, CX } from "./art-klasscenter-delar.js";
import { KLASSCENTER_TIDIG } from "./art-klasscenter-tidig.js";
import { KLASSCENTER_MITT } from "./art-klasscenter-mitt.js";
import { KLASSCENTER_SEN } from "./art-klasscenter-sen.js";
import { NIVAER } from "./klasscenter/kc-niva.js";

/**
 * Gemensamt fotavtryck för ALLA nivåer – så by-vyn kan skala utan per-nivå-mått.
 *
 *  - viewBox "0 0 1250 800" (bredd 1250 × höjd 800), byggnaden centrerad kring
 *    x=625 och med botten på marklinjen y=752 (48 enheter ovan viewBox-botten).
 *  - husMini (art-hus-ute.js) har viewBox-bredd 500 (230..730) × höjd 460
 *    (100..560) och sin mark y≈512, OCKSÅ 48 enheter ovan botten.
 *  - ⇒ Rendera klasscentret med CSS-bredd = 2,5 × minihusets bredd
 *    (KLASSCENTER_MATT.skalaMotMinihus) så blir 1 viewBox-enhet exakt lika
 *    många px i båda → samma skala, och med preserveAspectRatio "xMidYMax meet"
 *    (båda SVG:erna bottnar) hamnar marklinjerna på samma höjd när rutorna
 *    bottenjusteras i samma by-rad. Höjden blir då 800/460 ≈ 1,74 × minihusets.
 *  - Byggnadens faktiska bredd växer med nivån (nivå 1 ≈ 0,7 minihus, nivå 10
 *    ≈ hela viewBoxen ≈ 2,4 minihus) – rutan är alltid 2,5 tomter bred, så
 *    by-layouten reserverar en fast plats och tidiga nivåer står luftigt i den.
 */
export const KLASSCENTER_MATT = Object.freeze({
  viewBox: "0 0 1250 800",
  bredd: 1250,
  hojd: 800,
  markY: G,
  mittX: CX,
  minihusBredd: 500,
  minihusHojd: 460,
  skalaMotMinihus: 2.5,
});

/**
 * Nivåerna i ordning – härleds ur kc-niva.js NIVAER (EN sanningskälla, ren
 * logik utan beroenden). Ny nivå = ny post där + ny rit-funktion i MARKUP.
 */
export const KLASSCENTER_NIVAER = Object.freeze(
  NIVAER.map(({ niva, namn, emoji }) => Object.freeze({ niva, namn, emoji }))
);

const MARKUP = { ...KLASSCENTER_TIDIG, ...KLASSCENTER_MITT, ...KLASSCENTER_SEN };

/** Klampa godtycklig nivå till heltal 1..antal nivåer (okänt/NaN → 1). */
export function klampaNiva(niva) {
  const n = Math.round(Number(niva));
  if (!Number.isFinite(n)) return 1;
  return Math.min(KLASSCENTER_NIVAER.length, Math.max(1, n));
}

/** Inre markup (utan <svg>-ram) för en nivå – för den som vill bädda in i egen scen. */
export function klasscenterMarkup(niva, opts = {}) {
  return MARKUP[klampaNiva(niva)](opts);
}

/**
 * Klasscentrets byggnad som fristående SVG-sträng.
 * @param {number} niva 1..antal nivåer (clampas; okänt → 1)
 * @param {object} [opts]
 * @param {boolean} [opts.animera=true] false → inga ambient-klasser alls
 *   (rök/fana/glitter). Ambienten är ren CSS (styles.css "Klasscentret
 *   ambient") och pausas av samma WAAPI-paus som husens rök under kamerazoom.
 * @param {string} [opts.aria] tillgänglig etikett; utelämnad → aria-hidden.
 * @param {string} [opts.klass] extra CSS-klass på <svg>.
 * Fanans färg styrs med CSS-variabeln --kc-fana på ett förälderelement.
 */
export function klasscenterSvg(niva, opts = {}) {
  const n = klampaNiva(niva);
  const a11y = opts.aria
    ? `role="img" aria-label="${String(opts.aria).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)}"`
    : `aria-hidden="true" focusable="false"`;
  const klass = `klasscenter-svg${opts.klass ? ` ${opts.klass}` : ""}`;
  return `<svg class="${klass}" data-niva="${n}" viewBox="${KLASSCENTER_MATT.viewBox}" ${a11y}
      preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg">
    ${MARKUP[n](opts)}
  </svg>`;
}
