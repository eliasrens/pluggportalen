// ============================================================================
// Pluggporten – Klasscentrets pokaler + statistiktavla: kodritad konst (#496,
// epic #474 Klasscentret 3/4)
// ----------------------------------------------------------------------------
// Index-modul, samma format som KC_INREDNING (art-klasscenter-inredning.js):
// art-nyckel → { viewBox, w, rita(opts) }.
//   Pokaler   nyckel = pokaltypens `art` (src/klasscenter/kc-pokal-typer.js):
//             "pokal-mm", "pokal-live", "pokal-live-klar" + reserven "pokal".
//             Alla delar viewBox POKAL_VB (100 × 140).        → -figurer.js
//   Möbler    "kc-pokalhylla" (8 platser, KC_POKALHYLLA_PLATSER) och
//             "kc-statistiktavla" (värdefält KC_STATISTIK_FALT). → -mobler.js
// opts.animera === false → ingen ambient (glitter, raketflamma, tavlans glöd).
//
// 🔴 Bootgraf: importera ALDRIG denna modul statiskt från app.js-grafen – den
// laddas dynamiskt (import()) av rummet (#271).
// ============================================================================

import { KC_POKALER_FIGURER, POKAL_VB } from "./art-klasscenter-pokaler-figurer.js";
import { KC_POKALER_MOBLER, KC_POKALHYLLA_PLATSER, KC_STATISTIK_FALT } from "./art-klasscenter-pokaler-mobler.js";

export { POKAL_VB, KC_POKALHYLLA_PLATSER, KC_STATISTIK_FALT };

/** art-nyckel → { viewBox, w, rita(opts) } */
export const KC_POKALER = Object.freeze({ ...KC_POKALER_FIGURER, ...KC_POKALER_MOBLER });

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Inre markup (utan <svg>-ram) för en art-nyckel, eller null om konst saknas. */
export function kcPokalMarkup(art, opts = {}) {
  const it = KC_POKALER[art];
  return it ? it.rita(opts) : null;
}

/**
 * Fristående <svg> för en pokal/pokalmöbel, eller null om art-nyckeln saknar
 * konst. Pokal-objekt från normaliseraPokal har alltid en ritbar art (okänd
 * typ → "pokal"). Skalar med CSS width/height, centreras.
 * @param {string} art t.ex. "pokal-mm", "kc-statistiktavla"
 * @param {object} [opts]
 * @param {boolean} [opts.animera=true] false → inga ambient-klasser.
 * @param {string} [opts.aria] tillgänglig etikett; utelämnad → aria-hidden.
 * @param {string} [opts.klass] extra CSS-klass på <svg>.
 * Banden/rosetten och raketens fenor följer --kc-fana (klassens färg).
 */
export function kcPokalSvg(art, opts = {}) {
  const it = KC_POKALER[art];
  if (!it) return null;
  const a11y = opts.aria ? `role="img" aria-label="${esc(opts.aria)}"` : `aria-hidden="true" focusable="false"`;
  const klass = `kc-pokal-svg${opts.klass ? ` ${esc(opts.klass)}` : ""}`;
  return (
    `<svg class="${klass}" data-art="${esc(art)}" viewBox="${it.viewBox}" ${a11y} ` +
    `preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${it.rita(opts)}</svg>`
  );
}

/** Visningsstorlek i rem { w, h } (h ur viewBox-proportionen), eller null. */
export function kcPokalStorlek(art) {
  const it = KC_POKALER[art];
  if (!it) return null;
  const [, , vw, vh] = it.viewBox.split(" ").map(Number);
  return { w: it.w, h: +((it.w * vh) / vw).toFixed(2) };
}

/**
 * Pokalhyllan MED pokaler auto-placerade i platserna (i den ordning de ges,
 * t.ex. normaliseraPokaler() = nyast först). Fler pokaler än platser → de
 * överskjutande ritas inte (anroparen ser det via .length).
 * Varje pokal blir en nästlad <svg class="kc-pokal-plats" data-pokal-id …>
 * så rummet kan hänga hover-tooltip på den (event-delegering).
 * @param {Array<{art?: string, id?: string, titel?: string}>} pokaler
 * @param {object} [opts] som kcPokalSvg; opts.aria = hyllans etikett.
 */
export function kcPokalhyllaSvg(pokaler = [], opts = {}) {
  const hylla = KC_POKALER["kc-pokalhylla"];
  const platser = pokaler.slice(0, KC_POKALHYLLA_PLATSER.length).map((p, i) => {
    const art = KC_POKALER_FIGURER[p?.art] ? p.art : "pokal";
    const { x, y, w, h } = KC_POKALHYLLA_PLATSER[i];
    const id = p?.id ? ` data-pokal-id="${esc(p.id)}"` : "";
    const aria = p?.titel ? ` role="img" aria-label="${esc(p.titel)}"` : "";
    return (
      `<svg class="kc-pokal-plats" data-art="${art}"${id}${aria} x="${x}" y="${y}" width="${w}" height="${h}" ` +
      `viewBox="${POKAL_VB}" overflow="visible">${KC_POKALER_FIGURER[art].rita(opts)}</svg>`
    );
  }).join("");
  const a11y = opts.aria ? `role="group" aria-label="${esc(opts.aria)}"` : `aria-hidden="true" focusable="false"`;
  const klass = `kc-pokal-svg${opts.klass ? ` ${esc(opts.klass)}` : ""}`;
  return (
    `<svg class="${klass}" data-art="kc-pokalhylla" viewBox="${hylla.viewBox}" ${a11y} ` +
    `preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${hylla.rita(opts)}${platser}</svg>`
  );
}
