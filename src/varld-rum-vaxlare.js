// ============================================================================
// Pluggportalen – rums-växlaren (dörrar inne + rumslista) för flerrums-huset
// ----------------------------------------------------------------------------
// Systermodul till varld-rum.js (som varld-rum-wear/mat/fonster): äger UI:t för
// att BYTA rum i ett uppgraderat hus (issue #34). Två sätt att navigera, exakt
// som uppgiften kräver:
//   * DÖRRAR inne i scenen: en dörr på vänster vägg (föregående rum) och en på
//     höger vägg (nästa rum). Dörren visas bara när det finns ett rum åt det
//     hållet.
//   * RUMSLISTA: en liten pill-rad högst upp i rummet ("Rum 1 · Rum 2 …") där
//     det aktiva rummet är markerat.
// Modulen bygger DOM-noderna EN gång och exponerar render() som uppdaterar
// markering + dörrsynlighet efter det aktiva rummet. varld-rum.js äger själva
// rums-bytet (goToRoom) och kallar hit via onPick. Noderna läggs in i scenen på
// nytt vid varje renderStage() (som annars nollställer lagret) – samma
// nod-objekt, så lyssnarna sitter kvar. Visas bara när huset har >1 rum.
// ============================================================================

import { el } from "./ui.js";
import { O, LINE, THIN } from "./art-style.js";

// En enkel, barnvänlig dörr i husvärldens SVG-stil (kontur + panel + handtag).
const dorrSvg =
  `<svg viewBox="0 0 40 64" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">` +
  `<rect x="4" y="4" width="32" height="58" rx="4" fill="#C58C55" ${LINE}/>` +
  `<rect x="9" y="10" width="22" height="20" rx="3" fill="#B0805A" ${THIN}/>` +
  `<rect x="9" y="34" width="22" height="22" rx="3" fill="#B0805A" ${THIN}/>` +
  `<circle cx="29" cy="40" r="2.6" fill="#F7C948" stroke="${O}" stroke-width="1.6"/>` +
  `</svg>`;

/**
 * Montera rums-växlaren.
 * @param {object} o
 * @param {number} o.count       antal rum (>1 för att växlaren ska vara meningsfull)
 * @param {() => number} o.getCurrent  nuvarande rum-index
 * @param {(index: number) => void} o.onPick  byt till rum `index`
 * @returns {{ listBar: HTMLElement, doorsWrap: HTMLElement, render: () => void }}
 */
export function mountRumVaxlare({ count, getCurrent, onPick }) {
  // --- Rumslistan (pill-rad högst upp) --------------------------------------
  const listBar = el(`<div class="rum-lista" role="tablist" aria-label="Byt rum"></div>`);
  for (let i = 0; i < count; i++) {
    listBar.appendChild(el(
      `<button class="rum-flik" role="tab" type="button" data-room="${i}"
        aria-selected="false" title="Gå till Rum ${i + 1}">Rum ${i + 1}</button>`
    ));
  }
  listBar.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-room]");
    if (btn) onPick(Number(btn.dataset.room));
  });

  // --- Dörrarna (vänster = föregående rum, höger = nästa rum) ----------------
  const doorsWrap = el(`<div class="rum-dorrar" aria-hidden="false">
    <button class="rum-dorr rum-dorr-vanster" type="button" data-door="prev">
      <span class="rum-dorr-svg">${dorrSvg}</span>
      <span class="rum-dorr-nr"></span>
    </button>
    <button class="rum-dorr rum-dorr-hoger" type="button" data-door="next">
      <span class="rum-dorr-svg">${dorrSvg}</span>
      <span class="rum-dorr-nr"></span>
    </button>
  </div>`);
  const doorPrev = doorsWrap.querySelector(".rum-dorr-vanster");
  const doorNext = doorsWrap.querySelector(".rum-dorr-hoger");
  doorsWrap.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-door]");
    if (!btn) return;
    const cur = getCurrent();
    onPick(btn.dataset.door === "next" ? cur + 1 : cur - 1);
  });

  function render() {
    const cur = getCurrent();
    for (const btn of listBar.querySelectorAll(".rum-flik")) {
      const active = Number(btn.dataset.room) === cur;
      btn.classList.toggle("aktiv", active);
      btn.setAttribute("aria-selected", String(active));
    }
    // Vänsterdörr → rummet innan; döljs i första rummet.
    const hasPrev = cur > 0;
    doorPrev.hidden = !hasPrev;
    if (hasPrev) {
      doorPrev.querySelector(".rum-dorr-nr").textContent = `Rum ${cur}`;
      doorPrev.title = `Gå till Rum ${cur}`;
    }
    // Högerdörr → nästa rum; döljs i sista rummet.
    const hasNext = cur < count - 1;
    doorNext.hidden = !hasNext;
    if (hasNext) {
      doorNext.querySelector(".rum-dorr-nr").textContent = `Rum ${cur + 2}`;
      doorNext.title = `Gå till Rum ${cur + 2}`;
    }
  }
  render();

  return { listBar, doorsWrap, render };
}
