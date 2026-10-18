// ============================================================================
// Schackbrädet – delarna runt och ovanpå brädet (#775, §2.2–2.3): spelarraden
// (avatar, namn, tur, tagna pjäser), pilarna, förvandlingsväljaren och
// slutrutan. Rena markup-funktioner; schack-bradet.js sätter in dem.
// ============================================================================

import { pjasSvg } from "./schack-pjaser.js";
import { PJAS_NAMN } from "./schack-text.js";

const FILER = "abcdefgh";

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** Rutans mitt i brädets koordinater 0–800 (vänd efter orienteringen). */
export function rutaMitt(ruta, orientering) {
  const fil = FILER.indexOf(ruta[0]);
  const rad = Number(ruta[1]) - 1;
  const kol = orientering === "w" ? fil : 7 - fil;
  const rd = orientering === "w" ? 7 - rad : rad;
  return { x: kol * 100 + 50, y: rd * 100 + 50 };
}

/** Pilarna som SVG-innehåll (viewBox 0 0 800 800). */
export function pilarSvg(pilar, orientering) {
  return pilar
    .map((p) => {
      const a = rutaMitt(p.from, orientering);
      const b = rutaMitt(p.to, orientering);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      // Linjen slutar där spetsen börjar; spetsen är en egen triangel.
      const spets = 34;
      const sx = b.x - ux * spets;
      const sy = b.y - uy * spets;
      const px = -uy * 26;
      const py = ux * 26;
      return (
        `<g class="schack-pil schack-pil-${esc(p.farg)}">` +
        `<line x1="${a.x + ux * 22}" y1="${a.y + uy * 22}" x2="${sx}" y2="${sy}" stroke-width="18" stroke-linecap="round"/>` +
        `<path d="M${b.x} ${b.y} L${sx + px} ${sy + py} L${sx - px} ${sy - py} Z" stroke-width="6" stroke-linejoin="round"/>` +
        `</g>`
      );
    })
    .join("");
}

/** Liten standardavatar: en cirkel med en pjäs i spelarens färg. */
function standardAvatar(farg) {
  return `<span class="schack-avatar-standard">${pjasSvg(farg, "p")}</span>`;
}

/**
 * En spelarrad: avatar, namn, "På tur"-markering, tagna pjäser och +N.
 * @param {"w"|"b"} farg
 * @param {object} state  kontrollens tillstånd
 * @param {string} [avatarHtml]  färdig avatar-markup (t.ex. avatarMarkup()), annars standard
 */
export function spelareHtml(farg, state, avatarHtml) {
  const namn = state.namn[farg] || (farg === "w" ? "Vit" : "Svart");
  const paTur = !state.slut && state.tur === farg;
  const tagna = state.tagna[farg].map((t) => pjasSvg(farg === "w" ? "b" : "w", t)).join("");
  const fordel = state.fordel[farg] ? `<span class="schack-fordel">+${state.fordel[farg]}</span>` : "";
  const tagnaText = state.tagna[farg].length
    ? `har tagit ${state.tagna[farg].map((t) => PJAS_NAMN[t]).join(", ")}`
    : "har inte tagit någon pjäs";
  return (
    `<span class="schack-avatar">${avatarHtml || standardAvatar(farg)}</span>` +
    `<span class="schack-spelare-text">` +
    `<span class="schack-spelare-namn">${esc(namn)}${paTur ? ` <span class="schack-tur">På tur</span>` : ""}</span>` +
    `<span class="schack-tagna" aria-label="${esc(namn)} ${tagnaText}">${tagna}${fordel}</span>` +
    `</span>`
  );
}

/** Förvandlingsväljarens knappar: dam först (förvald), sedan torn, löpare, springare. */
export function forvandlingHtml(farg) {
  const val = [["q", "Dam"], ["r", "Torn"], ["b", "Löpare"], ["n", "Springare"]];
  return (
    `<p class="schack-forvandling-rubrik">Bonden blir…</p>` +
    `<div class="schack-forvandling-val">` +
    val
      .map(([t, text], i) =>
        `<button type="button" class="schack-forvandling-knapp${i === 0 ? " forvald" : ""}" data-pjas="${t}" aria-label="${text}${i === 0 ? " (förvald)" : ""}">` +
        `${pjasSvg(farg, t)}<span>${text}</span></button>`)
      .join("") +
    `</div>` +
    `<button type="button" class="btn ghost liten schack-forvandling-avbryt">Avbryt</button>`
  );
}

/** Slutrutan: rubrik, förklaring och knappar ({text, id}). */
export function slutHtml(status, knappar) {
  return (
    `<div class="schack-slut-kort schack-ton-${esc(status.ton)}">` +
    `<h3 class="schack-slut-rubrik">${esc(status.text)}</h3>` +
    (status.orsak ? `<p class="schack-slut-orsak">${esc(status.orsak)}</p>` : "") +
    `<div class="schack-slut-knappar">` +
    knappar.map((k, i) => `<button type="button" class="btn liten${i ? " ghost" : ""}" data-slut="${i}">${esc(k.text)}</button>`).join("") +
    `</div></div>`
  );
}
