// ============================================================================
// Pluggportalen – lärarsidan: synliga lägen per KLASS (teacher-class-modes.js)
// ----------------------------------------------------------------------------
// Utbruten del av teacher-classes.js (fil-cap): renderar sektionen "Synliga
// lägen för klassen" på ett klasskort. Läraren bockar UR spellägen/spel som ska
// döljas för HELA klassen (issue #208), utöver per-område-valet (#200).
//
// Listan härleds GENERISKT ur GAMEMODES, så nya lägen/spel (inkl. äventyrsspelen)
// dyker upp automatiskt. Ikryssat = synligt; urbockat sparas i
// classes/{id}.hiddenModes. Tomt = allt synligt (bakåtkompatibelt).
//
// Skiljer sig från per-område-kryssrutorna (teacher-content.js) på en punkt:
// här filtreras INTE på innehåll (has-gaten) – klass-valet gäller alla klassens
// områden, och vilka lägen ett enskilt område faktiskt har underlag för avgörs
// per område. Elev-gaten (gamemode-visibility.js) tar unionen klass ∪ område.
// ============================================================================

import * as data from "./data.js";
import { GAMEMODES, isModeHiddenForClass } from "./game-shared.js";
import { el, esc } from "./teacher-shared.js";

/**
 * Rendera och koppla "Synliga lägen för klassen"-sektionen in i `modesEl`.
 * @param {object} ctx        lärar-context (ej använt här, hålls för symmetri)
 * @param {object} cls        klassdokumentet (muteras: cls.hiddenModes vid spar)
 * @param {HTMLElement} modesEl värd-element att fylla
 */
export function renderClassModes(ctx, cls, modesEl) {
  const rows = GAMEMODES.map((gm) => {
    const checked = isModeHiddenForClass(cls, gm.id) ? "" : " checked";
    return `<label class="member-row">
      <input type="checkbox" data-mode="${esc(gm.id)}"${checked} />
      <span class="member-avatar">${esc(gm.emoji)}</span>
      <span class="member-name">${esc(gm.name)}<br><span class="hint">${esc(gm.sub)}</span></span>
    </label>`;
  }).join("");

  const box = el(`<div>
    <p class="hint">Kryssa i de lägen/spel klassen ska <b>se</b>. Ur-bockade lägen döljs
      för hela klassen i alla dess områden. Lämnar du allt ikryssat ser eleverna allt
      (per-område-valet i Innehåll gäller fortfarande ovanpå detta).</p>
    <div class="member-grid">${rows}</div>
    <div class="row-inline" style="margin-top:12px">
      <button class="btn gron small" data-act="save-modes">💾 Spara lägen</button>
      <button class="btn ghost small" data-act="all-modes">Visa alla</button>
      <span class="modes-result"></span>
    </div>
  </div>`);

  const resultEl = box.querySelector(".modes-result");

  box.querySelector('[data-act="all-modes"]').addEventListener("click", () => {
    box.querySelectorAll('input[type="checkbox"]').forEach((c) => (c.checked = true));
  });

  box.querySelector('[data-act="save-modes"]').addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    // Urbockade = dolda. (Checked = synligt.)
    const hidden = [...box.querySelectorAll('input[type="checkbox"]:not(:checked)')].map(
      (c) => c.dataset.mode
    );
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = "Sparar…";
    resultEl.innerHTML = "";
    try {
      const saved = await data.setClassHiddenModes(cls.id, hidden);
      cls.hiddenModes = saved;
      resultEl.innerHTML = saved.length
        ? `<span class="ok-inline">✓ Sparat (${saved.length} läge${saved.length === 1 ? "" : "n"} dolda)</span>`
        : `<span class="ok-inline">✓ Sparat – klassen ser alla lägen</span>`;
    } catch (err) {
      resultEl.innerHTML = `<span class="err-inline">Kunde inte spara: ${esc(err.message)}</span>`;
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  });

  modesEl.replaceChildren(box);
}
