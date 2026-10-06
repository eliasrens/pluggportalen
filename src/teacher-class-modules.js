// ============================================================================
// Pluggporten – lärarsidan: synliga moduler per klass (teacher-class-modules.js)
// ----------------------------------------------------------------------------
// Issue #412: läraren kryssar vilka TOP-NIVÅ-moduler (sidomenyns sektioner, t.ex.
// Plugga och Läsresan) klassens elever ser. Speglar byar-kontrollen
// (teacher-class-villages.js): ikryssat = synligt, urbockat sparas i
// classes/{id}.hiddenModules via data.setClassHiddenModules. Tomt = allt synligt
// (bakåtkompatibelt). Listan byggs ur registret TOGGLABLE_MODULES; elevens
// sidomeny (ui.renderTopbar) och routern (app.js) respekterar valet.
//
// Laddas DYNAMISKT från teacher-classes.js (vid klick på "Synliga moduler") så att
// filen aldrig hamnar i den statiska bootgrafen (incident #271).
// ============================================================================

import * as data from "./data.js";
import { TOGGLABLE_MODULES, normalizeHiddenModules } from "./gamemode-visibility.js";
import { el, esc, icon } from "./teacher-shared.js";

// Lärarsidans SVG-ikon per modul (samma ikonuppsättning som resten av lärarsidan).
const LARAR_IKON = { plugga: "grad", lasresan: "book", shop: "sparkle" };

/**
 * Rendera "Synliga moduler"-sektionen för klassen `cls` in i `host`.
 * @param {object} ctx
 * @param {object} cls        klassdokumentet (muteras: cls.hiddenModules vid spar)
 * @param {HTMLElement} host  värd-element att fylla
 */
export function renderClassModules(ctx, cls, host) {
  const hidden = new Set(normalizeHiddenModules(cls.hiddenModules));
  const rows = TOGGLABLE_MODULES.map(
    (m) => `<label class="member-row">
        <input type="checkbox" data-module="${esc(m.id)}"${hidden.has(m.id) ? "" : " checked"} />
        <span class="member-avatar">${icon(LARAR_IKON[m.id] || "eye", 20)}</span>
        <span class="member-name">${esc(m.label)}</span>
      </label>`
  ).join("");

  const box = el(`<div>
    <p class="hint">Kryssa i de delar av sidan som <b>${esc(cls.name || cls.id)}</b> ska
      <b>se</b> i elevernas meny. Urbockade delar döljs för klassen och går inte att öppna,
      inte ens via en direktlänk. Hem syns alltid. Lämnar du allt ikryssat ser eleverna allt.</p>
    <div class="member-grid">${rows}</div>
    <div class="row-inline" style="margin-top:12px">
      <button class="btn gron small" data-act="save-modules">${icon("save", 16)}<span>Spara moduler</span></button>
      <button class="btn ghost small" data-act="all-modules">Visa alla</button>
      <span class="modules-result"></span>
    </div>
  </div>`);

  const resultEl = box.querySelector(".modules-result");

  box.querySelector('[data-act="all-modules"]').addEventListener("click", () => {
    box.querySelectorAll('input[type="checkbox"]').forEach((c) => (c.checked = true));
  });

  box.querySelector('[data-act="save-modules"]').addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    // Urbockade = dolda. (Checked = synligt.)
    const picked = [...box.querySelectorAll('input[type="checkbox"]:not(:checked)')].map(
      (c) => c.dataset.module
    );
    btn.disabled = true;
    const old = btn.innerHTML;
    btn.textContent = "Sparar…";
    resultEl.innerHTML = "";
    try {
      const saved = await data.setClassHiddenModules(cls.id, picked);
      cls.hiddenModules = saved;
      const namn = TOGGLABLE_MODULES.filter((m) => saved.includes(m.id)).map((m) => m.label);
      resultEl.innerHTML = saved.length
        ? `<span class="ok-inline">✓ Sparat – dolt för klassen: ${esc(namn.join(", "))}</span>`
        : `<span class="ok-inline">✓ Sparat – klassen ser alla moduler</span>`;
    } catch (err) {
      resultEl.innerHTML = `<span class="err-inline">Kunde inte spara: ${esc(err.message)}</span>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = old;
    }
  });

  host.replaceChildren(box);
}
