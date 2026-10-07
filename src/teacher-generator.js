// ============================================================================
// Pluggporten – lärarsidan: räknegenerator-kontroll (teacher-generator.js)
// ----------------------------------------------------------------------------
// Issue #279 / #322 / #470. En liten fabrik (samma mönster som teacher-mode-visibility.js)
// som stänger om en DOM-behållare (#generator-config) och sköter val av ETT ELLER
// FLERA räknesätt (topics) för ett arbetsområde:
//   • kryssrutor för räknesätten (generator-katalogens listTopics(), #278/#290)
//   • för varje ikryssat räknesätt ett eget block med kryssrutor för varianterna
//     (listVariants(topic)) och INSTÄLLNINGAR (issue #322): talstorlek och – för
//     topics där det är relevant – bildstöd på/av.
// Blocken för alla räknesätt ritas EN gång och visas/döljs med kryssen, så ett
// räknesätt som kryssas ur och i igen behåller sina val.
//
// Valet lagras på området som area.generator =
//   { topics: [{ topic, variants, talstorlek?, bildstod? }, …], grade? }
// (gamla { topic, variants, … } läses bakåtkompatibelt via normalizeGenerator).
// Eleven får de valda räknesätten blandade jämnt (shuffle-bag i rakna-core.js).
// Varianter är INNEHÅLL (vilka slags tal), inte spellägen. Kontrollen läser BARA
// katalogen från exercise-types.js – aldrig adaptern eller plugin-lagret direkt.
//
//   render(area)        – fyll kryssrutorna/inställningarna ur ett områdes generator.
//   getGenerator(grade) – läs av valet → { topics, grade? } | null.
// ============================================================================

import {
  listTopics,
  listVariants,
  normalizeGenerator,
  TALSTORLEK_OPTIONS,
  topicSupportsBildstod,
  BILDSTOD_DEFAULT,
} from "./exercise-types.js";
import { topicLabel, variantLabel } from "./teacher-generator-labels.js";
import { esc } from "./teacher-shared.js";

/** Ett räknesätts block: varianter + talstorlek + ev. bildstöd (dolt tills ikryssat). */
function topicBlockHtml(topic) {
  const variants = listVariants(topic)
    .map(
      (v) => `<label class="member-row gen-chip">
        <input type="checkbox" value="${esc(v)}" checked />
        <span class="member-name">${esc(variantLabel(v))}</span>
      </label>`
    )
    .join("");
  const bildstod = topicSupportsBildstod(topic)
    ? `<label class="gen-inline"><input type="checkbox" data-gen="bildstod" />
        🖼️ Bildstöd (prickar/grupper)</label>`
    : "";
  return `<fieldset class="gen-block" data-topic="${esc(topic)}" hidden>
    <legend>${esc(topicLabel(topic))}</legend>
    <div class="gen-chips" data-gen="variants">${variants}</div>
    <p class="gen-warn" hidden>Kryssa i minst en variant – annars tas räknesättet inte med.</p>
    <div class="gen-settings">
      <label class="gen-inline">Talstorlek
        <select class="select" data-gen="talstorlek">
          <option value="">Standard (följ årskurs)</option>
          ${TALSTORLEK_OPTIONS.map((o) => `<option value="${esc(o.id)}">${esc(o.label)}</option>`).join("")}
        </select>
      </label>
      ${bildstod}
    </div>
  </fieldset>`;
}

/**
 * Skapa räknegenerator-UI:t kring en behållare.
 * @param {HTMLElement} box behållaren (#generator-config) att rita i.
 * @param {() => void} [onChange] anropas när räknesätt/varianter/inställningar ändras
 *   (för att t.ex. uppdatera synliga-lägen-listan så räkna-läget dyker upp direkt).
 */
export function createGeneratorControl(box, onChange = () => {}) {
  const topics = listTopics();

  box.innerHTML = `
    <div class="field" style="margin:0">
      <label>Räknesätt</label>
      <p class="hint">Kryssa i ett eller flera räknesätt – uppgifterna genereras automatiskt och
        <b>blandas jämnt</b> mellan dem. Inga kryss = ingen räknegenerator.</p>
      <div class="gen-chips gen-topics">
        ${topics
          .map(
            (t) => `<label class="member-row gen-chip">
              <input type="checkbox" value="${esc(t)}" />
              <span class="member-name">${esc(topicLabel(t))}</span>
            </label>`
          )
          .join("")}
      </div>
    </div>
    <div class="gen-blocks">${topics.map(topicBlockHtml).join("")}</div>`;

  const topicBox = box.querySelector(".gen-topics");
  const blockOf = (topic) => box.querySelector(`.gen-block[data-topic="${CSS.escape(topic)}"]`);
  const topicChk = (topic) => topicBox.querySelector(`input[value="${CSS.escape(topic)}"]`);

  // Varna i blocket när ett ikryssat räknesätt saknar varianter (tas annars tyst bort).
  function refreshWarn(block) {
    const none = !block.querySelector('[data-gen="variants"] input:checked');
    block.querySelector(".gen-warn").hidden = !none;
  }

  // Sätt ett blocks varianter/inställningar ur ett (normaliserat) räknesätt, eller
  // till defaults (alla varianter, standard-talstorlek, bildstöd PÅ) när entry är null.
  function fillBlock(topic, entry) {
    const block = blockOf(topic);
    if (!block) return;
    const on = entry ? new Set(entry.variants) : null;
    for (const c of block.querySelectorAll('[data-gen="variants"] input')) {
      c.checked = on ? on.has(c.value) : true;
    }
    block.querySelector('[data-gen="talstorlek"]').value = entry?.talstorlek || "";
    const bild = block.querySelector('[data-gen="bildstod"]');
    if (bild) bild.checked = typeof entry?.bildstod === "boolean" ? entry.bildstod : BILDSTOD_DEFAULT;
    refreshWarn(block);
  }

  function setTopicOn(topic, on) {
    const chk = topicChk(topic);
    if (chk) chk.checked = on;
    const block = blockOf(topic);
    if (block) block.hidden = !on;
  }

  topicBox.addEventListener("change", (e) => {
    const t = e.target;
    if (t?.type !== "checkbox") return;
    setTopicOn(t.value, t.checked);
    onChange();
  });
  box.querySelector(".gen-blocks").addEventListener("change", (e) => {
    const block = e.target?.closest?.(".gen-block");
    if (block) refreshWarn(block);
    onChange();
  });

  /**
   * Fyll kontrollen ur ett områdes sparade generator-config (nytt eller gammalt
   * format; saknas den → inga räknesätt). Ogiltiga värden rensas via normalizeGenerator.
   * @param {object} area
   */
  function render(area) {
    const gen = normalizeGenerator(area?.generator);
    const byTopic = new Map((gen?.topics || []).map((t) => [t.topic, t]));
    for (const topic of topics) {
      fillBlock(topic, byTopic.get(topic) || null);
      setTopicOn(topic, byTopic.has(topic));
    }
  }

  /**
   * Läs av valet till en generator-config, eller null om inget räknesätt med minst
   * en variant är ikryssat. Årskursen (områdets) vävs in när den är satt.
   * @param {string|null} [grade] områdets valda årskurs ("ak1".."ak9"|null).
   * @returns {{topics:object[], grade?:string}|null}
   */
  function getGenerator(grade) {
    const chosen = [];
    for (const chk of topicBox.querySelectorAll("input:checked")) {
      const block = blockOf(chk.value);
      if (!block) continue;
      const entry = {
        topic: chk.value,
        variants: [...block.querySelectorAll('[data-gen="variants"] input:checked')].map((c) => c.value),
        talstorlek: block.querySelector('[data-gen="talstorlek"]').value,
      };
      const bild = block.querySelector('[data-gen="bildstod"]');
      if (bild) entry.bildstod = bild.checked;
      chosen.push(entry);
    }
    if (chosen.length === 0) return null;
    // normalizeGenerator gör sista rensningen (kända varianter, ≥1 per räknesätt;
    // känd talstorlek; bildstöd bara där det stöds) och lägger bara till grade när satt.
    return normalizeGenerator({ topics: chosen, grade });
  }

  return { render, getGenerator };
}
