// ============================================================================
// Pluggporten – lärarsidan: wizard steg 4 "Synlighet & spara" (teacher-wizard-steg4.js)
// ----------------------------------------------------------------------------
// Issue #442. Synliga spellägen (BEFINTLIG createModeVisibility), "Det här skapas"-
// sammanfattningen igen, och Spara → BEFINTLIG data.saveArea med EXAKT kompositörens
// value-sammansättning (teacher-wizard-state.js buildSaveValue). Spara-knappen
// ligger i wizardens fot (stor grön) och anropar save() härifrån.
// ============================================================================

import * as data from "./data.js";
import { createModeVisibility } from "./teacher-mode-visibility.js";
import { buildSaveValue } from "./teacher-wizard-state.js";
import { renderErrors, renderSummary } from "./teacher-wizard-steg3.js";
import { el, esc } from "./teacher-shared.js";

/**
 * @param {object} wz  wizardens delade kontext ({ state, areaInput, go, … }).
 * @param {object} deps { getSubjectId, getSubjectName }
 * @returns {{element:HTMLElement, modeVis:object, onShow:()=>void,
 *   save:()=>Promise<object|null>, clear:()=>void}}
 */
export function createStep4(wz, { getSubjectId, getSubjectName }) {
  const root = el(`<section class="wz-step" data-step="4" aria-labelledby="wz-h4">
    <h3 class="wz-step-title" id="wz-h4">Synlighet &amp; spara</h3>
    <div class="field">
      <label>👁️ Synliga lägen för eleverna</label>
      <p class="hint">Bocka i vilka spellägen som ska visas för det här arbetsområdet. Bara lägen
        området har innehåll för kan väljas.</p>
      <div class="member-grid" id="mode-visibility"></div>
    </div>
    <div id="save-result" class="composer-result wz-result" aria-live="polite"></div>
  </section>`);

  const resultEl = root.querySelector("#save-result");
  const modeVis = createModeVisibility(root.querySelector("#mode-visibility"));

  function showErrors(errors) {
    renderErrors(resultEl, errors);
    const back = el(`<button type="button" class="btn ghost wz-back3">← Till AI-verkstaden (steg 3)</button>`);
    back.addEventListener("click", () => wz.go(3));
    resultEl.firstElementChild.appendChild(back);
  }

  /** Vid varje besök: kontrollera igen så sammanfattning/fel och lägena stämmer. */
  function onShow() {
    const res = wz.areaInput.validateCurrent();
    if (res.ok) {
      modeVis.render(res.value, false);
      renderSummary(resultEl, res.value, "Klicka <b>Spara</b> för att lägga in det i ämnet.");
    } else showErrors(res.errors);
  }

  /**
   * Spara – kompositörens Spara-flöde. Returnerar det sparade värdet, eller null
   * vid fel (felet visas i steget).
   */
  async function save() {
    const subjectId = getSubjectId();
    if (!subjectId) {
      resultEl.innerHTML = `<div class="msg error">Välj ett ämne först.</div>`;
      return null;
    }
    const res = wz.areaInput.validateCurrent();
    if (!res.ok) {
      showErrors(res.errors);
      return null;
    }
    try {
      modeVis.render(res.value, false);
      const value = buildSaveValue(res.value, wz.state, modeVis.getHidden(res.value));
      await data.saveArea(subjectId, value.id, value);
      resultEl.innerHTML = `<div class="msg ok">✓ Sparat! "${esc(value.name)}" finns nu i
        ${esc(getSubjectName())}.</div>`;
      return value;
    } catch (err) {
      resultEl.innerHTML = `<div class="msg error">Kunde inte spara till databasen: ${esc(err.message)}</div>`;
      return null;
    }
  }

  return { element: root, modeVis, onShow, save, clear: () => (resultEl.innerHTML = "") };
}
