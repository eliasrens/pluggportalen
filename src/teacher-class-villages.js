// ============================================================================
// Pluggporten – lärarsidan: synliga byar per klass (teacher-class-villages.js)
// ----------------------------------------------------------------------------
// Issue #391: läraren väljer vilka ANDRA klassers byar DENNA klass ser i
// världens områdesvy (skolan, varld-omrade.js). Vissa klasser är specgrupper →
// läraren ska kunna dölja dem. Speglar lägen-kontrollen (teacher-class-modes.js):
// ikryssat = synligt, urbockat sparas i classes/{id}.hiddenVillages via
// data.setClassHiddenVillages. Tomt = allt synligt (bakåtkompatibelt).
//
// Listar övriga klasser via deras PUBLIKA fält (namn, ev. by-namn, antal elever)
// – samma fält som elevens områdesvy redan visar (#37). Den egna klassen listas
// inte: den syns alltid för sina elever.
//
// Laddas DYNAMISKT från teacher-classes.js (vid klick på "Synliga byar") så att filen
// aldrig hamnar i den statiska bootgrafen (incident #271).
// ============================================================================

import * as data from "./data.js";
import { normalizeHiddenVillages } from "./gamemode-visibility.js";
import { el, esc, emptyState, icon } from "./teacher-shared.js";

/**
 * Rendera "🏘️ Synliga byar"-sektionen för klassen `cls` in i `host`.
 * @param {object} ctx
 * @param {object} cls        klassdokumentet (muteras: cls.hiddenVillages vid spar)
 * @param {HTMLElement} host  värd-element att fylla
 * @param {object[]} classes  ALLA klasser (lärarens klasslista)
 */
export function renderClassVillages(ctx, cls, host, classes) {
  const others = (Array.isArray(classes) ? classes : []).filter((c) => c.id !== cls.id);

  if (others.length === 0) {
    host.replaceChildren(
      emptyState(ctx, {
        icon: "school",
        title: "Inga andra byar än",
        text: "När det finns fler klasser kan du välja vilka av deras byar den här klassen ser.",
      })
    );
    return;
  }

  const hidden = new Set(normalizeHiddenVillages(cls.hiddenVillages));
  const rows = others
    .map((c) => {
      const antal = Array.isArray(c.studentIds) ? c.studentIds.length : 0;
      const by = c.by ? ` · ${esc(c.by)}` : "";
      return `<label class="member-row">
        <input type="checkbox" data-village="${esc(c.id)}"${hidden.has(c.id) ? "" : " checked"} />
        <span class="member-avatar">${icon("school", 20)}</span>
        <span class="member-name">${esc(c.name || c.id)}${by}<br><span class="hint">${antal} hus</span></span>
      </label>`;
    })
    .join("");

  const box = el(`<div>
    <p class="hint">Kryssa i de andra klassers byar som <b>${esc(cls.name || cls.id)}</b> ska
      <b>se</b> i världens områdesvy ("Andra byar"). Urbockade byar döljs för klassen.
      Klassens egen by syns alltid. Lämnar du allt ikryssat ser eleverna alla byar.</p>
    <div class="member-grid">${rows}</div>
    <div class="row-inline" style="margin-top:12px">
      <button class="btn gron small" data-act="save-villages">${icon("save", 16)}<span>Spara byar</span></button>
      <button class="btn ghost small" data-act="all-villages">Visa alla</button>
      <span class="villages-result"></span>
    </div>
  </div>`);

  const resultEl = box.querySelector(".villages-result");

  box.querySelector('[data-act="all-villages"]').addEventListener("click", () => {
    box.querySelectorAll('input[type="checkbox"]').forEach((c) => (c.checked = true));
  });

  box.querySelector('[data-act="save-villages"]').addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    // Urbockade = dolda. (Checked = synligt.)
    const picked = [...box.querySelectorAll('input[type="checkbox"]:not(:checked)')].map(
      (c) => c.dataset.village
    );
    btn.disabled = true;
    const old = btn.innerHTML;
    btn.textContent = "Sparar…";
    resultEl.innerHTML = "";
    try {
      const saved = await data.setClassHiddenVillages(cls.id, picked);
      cls.hiddenVillages = saved;
      resultEl.innerHTML = saved.length
        ? `<span class="ok-inline">✓ Sparat (${saved.length} by${saved.length === 1 ? "" : "ar"} dold${saved.length === 1 ? "" : "a"})</span>`
        : `<span class="ok-inline">✓ Sparat – klassen ser alla byar</span>`;
    } catch (err) {
      resultEl.innerHTML = `<span class="err-inline">Kunde inte spara: ${esc(err.message)}</span>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = old;
    }
  });

  host.replaceChildren(box);
}
