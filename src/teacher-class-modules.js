// ============================================================================
// Pluggporten – lärarsidan: synliga moduler per klass (teacher-class-modules.js)
// ----------------------------------------------------------------------------
// Issue #412: läraren kryssar vilka TOP-NIVÅ-moduler (sidomenyns sektioner, t.ex.
// Plugga och Läsresan) klassens elever ser. Speglar byar-kontrollen
// (teacher-class-villages.js): ikryssat = synligt, urbockat sparas i
// classes/{id}.hiddenModules via data.setClassHiddenModules. Tomt = allt synligt
// (bakåtkompatibelt). Listan byggs ur registret TOGGLABLE_MODULES; elevens
// sidomeny (ui.renderTopbar) och routern (app.js) respekterar valet.
// Opt-in-moduler (#605, Hitta rätt!) är AV som standard: ikryssat sparas i
// stället i classes/{id}.enabledModules (samma knapp, samma skrivning).
//
// Laddas DYNAMISKT från teacher-classes.js (vid klick på "Synliga moduler") så att
// filen aldrig hamnar i den statiska bootgrafen (incident #271).
// ============================================================================

import * as data from "./data.js";
import { TOGGLABLE_MODULES, normalizeHiddenModules, normalizeEnabledModules } from "./gamemode-visibility.js";
import { el, esc, icon } from "./teacher-shared.js";

// Lärarsidans SVG-ikon per modul (samma ikonuppsättning som resten av lärarsidan).
const LARAR_IKON = { plugga: "grad", lasresan: "book", shop: "sparkle", hittaratt: "pin", ekvationsresan: "sliders", brakresan: "brak" };
// Schack (#776): en bonde i samma linjestil – ligger här (lazy modul) i stället för i
// teacher-shared.js ICONS, som är en bootfil på gränsen till 400 rader (#271).
const SCHACK_LARAR_IKON = `<svg class="t-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="6.5" r="2.6"/><path d="M9.5 10.5h5"/><path d="M10.2 10.5c0 2.6-1.6 4.3-2.4 6.3h8.4c-.8-2-2.4-3.7-2.4-6.3"/><path d="M6 19.5h12"/></svg>`;

/**
 * Rendera "Synliga moduler"-sektionen för klassen `cls` in i `host`.
 * @param {object} ctx
 * @param {object} cls        klassdokumentet (muteras: cls.hiddenModules vid spar)
 * @param {HTMLElement} host  värd-element att fylla
 */
export function renderClassModules(ctx, cls, host) {
  const hidden = new Set(normalizeHiddenModules(cls.hiddenModules));
  const enabled = new Set(normalizeEnabledModules(cls.enabledModules));
  const synlig = (m) => (m.optIn ? enabled.has(m.id) && !hidden.has(m.id) : !hidden.has(m.id));
  const rows = TOGGLABLE_MODULES.map(
    (m) => `<label class="member-row">
        <input type="checkbox" data-module="${esc(m.id)}"${m.optIn ? ' data-opt-in="1"' : ""}${synlig(m) ? " checked" : ""} />
        <span class="member-avatar">${m.id === "schack" ? SCHACK_LARAR_IKON : icon(LARAR_IKON[m.id] || "eye", 20)}</span>
        <span class="member-name">${esc(m.label)}${m.optIn ? ' <span class="hint">(av som standard)</span>' : ""}</span>
      </label>`
  ).join("");

  const box = el(`<div>
    <p class="hint">Kryssa i de delar av sidan som <b>${esc(cls.name || cls.id)}</b> ska
      <b>se</b> i elevernas meny. Urbockade delar döljs för klassen och går inte att öppna,
      inte ens via en direktlänk. Hem syns alltid. Delar märkta <i>av som standard</i> syns
      först när du kryssar i dem.</p>
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
    // Urbockade = dolda. (Checked = synligt.) Opt-in: ikryssade = aktiverade.
    const picked = [...box.querySelectorAll('input[type="checkbox"]:not([data-opt-in]):not(:checked)')].map(
      (c) => c.dataset.module
    );
    const pa = [...box.querySelectorAll('input[data-opt-in]:checked')].map((c) => c.dataset.module);
    btn.disabled = true;
    const old = btn.innerHTML;
    btn.textContent = "Sparar…";
    resultEl.innerHTML = "";
    try {
      const saved = await data.setClassHiddenModules(cls.id, picked, pa);
      cls.hiddenModules = saved;
      cls.enabledModules = normalizeEnabledModules(pa);
      const av = TOGGLABLE_MODULES.filter((m) => m.optIn && !pa.includes(m.id)).map((m) => m.id);
      const namn = TOGGLABLE_MODULES.filter((m) => saved.includes(m.id) || av.includes(m.id)).map((m) => m.label);
      resultEl.innerHTML = namn.length
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
