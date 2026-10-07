// ============================================================================
// Pluggporten – Klasscentrum-föremålen: kodritad konst (#487, epic #475)
// ----------------------------------------------------------------------------
// Index-modul. Register keyat på katalogens art-nyckel
// (src/klasscenter/kc-shop-items.js, fältet `art`) → { viewBox, w, rita }:
//   viewBox  sakens egen tajta viewBox (som möblerna i art-furniture.js)
//   w        visningsbredd i rem om saken visas som vanlig rums-sak
//            (höjd ur viewBox-proportionen, som itemSize i art-items.js);
//            rummet kan i stället skala efter katalogens `storlek`.
//   rita     (opts) → inre SVG-markup; opts.animera === false → ingen ambient.
// Själva konsten: -vagg.js (fana, troféhylla, kristallkrona), -golv.js
// (lounge, akvarium, flygel), -prakt.js (guldstaty, fontän).
// Ligger INTE i shop-items.js/HUS_SKAL – föremålen ägs av klassen, inte eleven.
//
// 🔴 Bootgraf: importera ALDRIG denna modul statiskt från app.js-grafen – den
// laddas dynamiskt (import()) där Klasscentrum-föremålen visas (#271).
// ============================================================================

import { KC_INREDNING_VAGG } from "./art-klasscenter-inredning-vagg.js";
import { KC_INREDNING_GOLV } from "./art-klasscenter-inredning-golv.js";
import { KC_INREDNING_PRAKT } from "./art-klasscenter-inredning-prakt.js";

/** art-nyckel → { viewBox, w, rita(opts) } */
export const KC_INREDNING = Object.freeze({ ...KC_INREDNING_VAGG, ...KC_INREDNING_GOLV, ...KC_INREDNING_PRAKT });

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Inre markup (utan <svg>-ram) för en art-nyckel, eller null om konst saknas. */
export function kcInredningMarkup(art, opts = {}) {
  const it = KC_INREDNING[art];
  return it ? it.rita(opts) : null;
}

/**
 * Fristående <svg> för ett Klasscentrum-föremål, eller null om art-nyckeln
 * saknar konst (anroparen visar då katalogens emoji). Skalar med CSS
 * width/height och centreras (preserveAspectRatio "xMidYMid meet").
 * @param {string} art katalogens art-nyckel, t.ex. "kc-fontan"
 * @param {object} [opts]
 * @param {boolean} [opts.animera=true] false → inga ambient-klasser (glitter,
 *   vatten, fiskar, gungande krona …). Ambienten är ren CSS i styles.css
 *   ("Klasscentret ambient") och av med prefers-reduced-motion.
 * @param {string} [opts.aria] tillgänglig etikett; utelämnad → aria-hidden.
 * @param {string} [opts.klass] extra CSS-klass på <svg>.
 * Fanans färg styrs med CSS-variabeln --kc-fana på ett förälderelement.
 */
export function kcInredningSvg(art, opts = {}) {
  const it = KC_INREDNING[art];
  if (!it) return null;
  const a11y = opts.aria ? `role="img" aria-label="${esc(opts.aria)}"` : `aria-hidden="true" focusable="false"`;
  const klass = `kc-inredning-svg${opts.klass ? ` ${esc(opts.klass)}` : ""}`;
  return (
    `<svg class="${klass}" data-art="${esc(art)}" viewBox="${it.viewBox}" ${a11y} ` +
    `preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${it.rita(opts)}</svg>`
  );
}

/** Visningsstorlek i rem { w, h } (h ur viewBox-proportionen), eller null. */
export function kcInredningStorlek(art) {
  const it = KC_INREDNING[art];
  if (!it) return null;
  const [, , vw, vh] = it.viewBox.split(" ").map(Number);
  return { w: it.w, h: +((it.w * vh) / vw).toFixed(2) };
}
