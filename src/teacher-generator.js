// ============================================================================
// Pluggportalen – lärarsidan: räknegenerator-kontroll (teacher-generator.js)
// ----------------------------------------------------------------------------
// Issue #279. En liten fabrik (samma mönster som teacher-mode-visibility.js) som
// stänger om en DOM-behållare (#generator-config) och sköter val av EN
// räknegenerator för ett arbetsområde:
//   • en topic-väljare (matte-generator-adapterns listTopics(), #278)
//   • kryssrutor för varianterna som ingår (listVariants(topic))
//
// Valet lagras på området som area.generator = { topic, variants, grade? }.
// Varianter är INNEHÅLL (vilka slags tal), inte spellägen. Kontrollen använder
// BARA adapterns publika gränssnitt – aldrig plugin-lagret direkt.
//
//   render(area)        – fyll väljaren/kryssrutorna ur ett områdes generator.
//   getGenerator(grade) – läs av valet → { topic, variants, grade? } eller null.
// ============================================================================

import { listTopics, listVariants } from "./matte-generator.js";
import { normalizeGenerator } from "./exercise-types.js";
import { esc } from "./teacher-shared.js";

// Första valet: inget generator-innehåll (området är ett vanligt quiz/par-område).
const NONE_VALUE = "";

/** Snygga till ett variantnamn för visning ("stora-tal" → "Stora tal"). */
function variantLabel(name) {
  const s = String(name || "").replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Snygga till ett topic-namn för visning ("multiplikation" → "Multiplikation"). */
function topicLabel(name) {
  const s = String(name || "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Skapa räknegenerator-UI:t kring en behållare.
 * @param {HTMLElement} box behållaren (#generator-config) att rita i.
 * @param {() => void} [onChange] anropas när topic/varianter ändras (för att t.ex.
 *   uppdatera synliga-lägen-listan så räkna-läget dyker upp/försvinner direkt).
 */
export function createGeneratorControl(box, onChange = () => {}) {
  const topics = listTopics();

  // Statisk stomme: topic-väljare + (dynamisk) variant-lista.
  box.innerHTML = `
    <div class="field" style="margin:0">
      <label for="gen-topic">Tal-typ (topic)</label>
      <p class="hint">Välj en räkne-topic så genereras uppgifterna automatiskt – inget innehåll
        klistras in. Lämna <b>Ingen</b> för ett vanligt quiz-/par-område.</p>
      <select id="gen-topic" class="select">
        <option value="${NONE_VALUE}">— Ingen räknegenerator —</option>
        ${topics.map((t) => `<option value="${esc(t)}">${esc(topicLabel(t))}</option>`).join("")}
      </select>
    </div>
    <div class="field" id="gen-variants-field" hidden style="margin:8px 0 0">
      <label>Varianter som ingår</label>
      <p class="hint">Kryssa i vilka slags tal området ska öva – minst en. Varianter är
        <b>innehåll</b> (vilka tal), inte spellägen.</p>
      <div class="member-grid" id="gen-variants"></div>
    </div>`;

  const topicSel = box.querySelector("#gen-topic");
  const variantsField = box.querySelector("#gen-variants-field");
  const variantsBox = box.querySelector("#gen-variants");

  // Rita variant-kryssrutorna för ett topic. `checkedSet` avgör vilka som är
  // ikryssade; är den null bockas ALLA i (rimlig standard när man just valt topic).
  function renderVariants(topic, checkedSet) {
    if (!topic) {
      variantsField.hidden = true;
      variantsBox.innerHTML = "";
      return;
    }
    const variants = listVariants(topic);
    variantsField.hidden = false;
    variantsBox.innerHTML = variants
      .map((v) => {
        const on = checkedSet ? checkedSet.has(v) : true;
        return `<label class="member-row">
          <input type="checkbox" value="${esc(v)}"${on ? " checked" : ""} />
          <span class="member-avatar">🔢</span>
          <span class="member-name">${esc(variantLabel(v))}</span>
        </label>`;
      })
      .join("");
  }

  topicSel.addEventListener("change", () => {
    // Nytt topic → rita om varianterna (alla ikryssade som standard).
    renderVariants(topicSel.value, null);
    onChange();
  });
  variantsBox.addEventListener("change", () => onChange());

  /**
   * Fyll kontrollen ur ett områdes sparade generator-config (bakåtkompatibelt:
   * saknas den → Ingen). Ogiltiga värden rensas via normalizeGenerator.
   * @param {object} area
   */
  function render(area) {
    const gen = normalizeGenerator(area?.generator);
    if (!gen) {
      topicSel.value = NONE_VALUE;
      renderVariants("", null);
      return;
    }
    topicSel.value = gen.topic;
    renderVariants(gen.topic, new Set(gen.variants));
  }

  /**
   * Läs av valet till en generator-config, eller null om ingen topic valts eller
   * ingen variant kryssats. Årskursen (områdets) vävs in när den är satt.
   * @param {string|null} [grade] områdets valda årskurs ("ak1".."ak9"|null).
   * @returns {{topic:string, variants:string[], grade?:string}|null}
   */
  function getGenerator(grade) {
    const topic = topicSel.value;
    if (!topic) return null;
    const variants = [...variantsBox.querySelectorAll('input[type="checkbox"]:checked')].map((c) => c.value);
    // normalizeGenerator gör sista rensningen (kända varianter, ≥1) och lägger
    // bara till grade när den är satt.
    return normalizeGenerator({ topic, variants, grade });
  }

  return { render, getGenerator };
}
