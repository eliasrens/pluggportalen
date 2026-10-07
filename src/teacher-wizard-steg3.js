// ============================================================================
// Pluggporten – lärarsidan: wizard steg 3 "AI-verkstaden" (teacher-wizard-steg3.js)
// ----------------------------------------------------------------------------
// Issue #442. Prompt-fokus med maximal yta:
//   • stor "Kopiera AI-prompt för valda typer" – BEFINTLIG buildAreaPrompt(types,
//     önskemål, årskurs) + copyText (visar "✓ Kopierat!"),
//   • bildpar-hjälpen (bildnycklar) när kortet Bildpar är valt,
//   • räknegeneratorn (BEFINTLIG createGeneratorControl) när kortet Räkna är valt,
//   • stor materialruta + Ladda upp fil / Infoga exempel / Rensa,
//   • Kontrollera → BEFINTLIG createAreaInput.validateCurrent (via wz.areaInput).
// Ingen logik är ny – bara kompositörens knappar i en ny presentation.
// ============================================================================

import { EXAMPLE_JSON, buildAreaPrompt } from "./prompts.js";
import { normalizeGrade } from "./grades.js";
import { listPairImageKeys } from "./pair-images.js";
import { createGeneratorControl } from "./teacher-generator.js";
import { aiTypes, summaryParts, wantsGenerator } from "./teacher-wizard-state.js";
import { el, esc, icon, copyText } from "./teacher-shared.js";

/** Rita valideringsfel (kompositörens showErrors). */
export function renderErrors(box, errors) {
  box.innerHTML = `<div class="msg error">
    <div style="margin-bottom:6px">Något ser inte klart ut ännu – rätta det här:</div>
    <ul class="error-list">${errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
  </div>`;
}

/** Rita "✓ Ser bra ut! Det här skapas: …" (kompositörens showValidSummary). */
export function renderSummary(box, value, tail) {
  const { generator, bits } = summaryParts(value);
  const parts = [
    ...(generator
      ? [`räknegenerator: <b>${esc(generator.topic)}</b> (${generator.variants} varianter · oändligt antal uppgifter)`]
      : []),
    ...bits,
  ];
  box.innerHTML = `<div class="msg ok">
    ✓ <b>Ser bra ut!</b> Det här skapas: <b>${esc(value.name)}</b>${parts.length ? " – " + parts.join(", ") : ""}.
    ${tail}
  </div>`;
}

/**
 * @param {object} wz  wizardens delade kontext ({ state, markDirty, sync, areaInput, modeVis }).
 * @returns {{element:HTMLElement, jsonEl:HTMLTextAreaElement, generatorCtl:object,
 *   resultEl:HTMLElement, load:(json:string, area:object|null)=>void, onShow:()=>void}}
 */
export function createStep3(wz) {
  const root = el(`<section class="wz-step" data-step="3" aria-labelledby="wz-h3">
    <h3 class="wz-step-title" id="wz-h3">AI-verkstaden</h3>

    <div class="wz-prompt" id="wz-prompt">
      <button type="button" class="btn gron wz-copy" id="copy-area-prompt">${icon("copy", 22)}<span>Kopiera AI-prompt för valda typer</span></button>
      <p class="wz-instr">🤖 Klistra in prompten i Claude (eller annan AI) tillsammans med din
        PDF/lektionstext. Klistra sedan in AI:ns svar i rutan nedan.</p>
      <p class="hint wz-bildpar" id="wz-bildpar" hidden>🖼️ <b>Bildpar:</b> ett par kan visa en färdig
        bild i stället för text – sätt <code>termImage</code>/<code>defImage</code> till en bildnyckel:
        ${listPairImageKeys().map((k) => `<code>${esc(k.key)}</code> (${esc(k.name)})`).join(", ")}.</p>
    </div>

    <div class="wz-generator" id="wz-generator" hidden>
      <label class="wz-sub">🔢 Räknegenerator</label>
      <p class="hint">Låt området <b>generera</b> räkneuppgifter automatiskt – välj tal-typ och
        varianter. Inget material behöver klistras in; området tänder <b>räkna-läget</b>.</p>
      <div id="generator-config"></div>
    </div>

    <div class="wz-material">
      <div class="wz-material-head">
        <label class="wz-sub" for="json">Klistra in / ladda upp material från AI här</label>
        <div class="row-inline">
          <label class="btn ghost file-btn">${icon("upload")} Ladda upp fil
            <input type="file" id="file" accept=".json,application/json" hidden />
          </label>
          <button type="button" class="btn ghost" id="example">Infoga exempel</button>
          <button type="button" class="btn ghost" id="clear">Rensa</button>
        </div>
      </div>
      <p class="hint wz-material-gen" hidden>Rent räkneområde? Då kan rutan lämnas tom.</p>
      <textarea id="json" class="json-input wz-json" spellcheck="false"
        placeholder='Klistra in AI:ns svar här, t.ex. { "name": "Vikingatiden", "quiz": [ ... ] }'></textarea>
    </div>

    <div class="wz-check-row">
      <button type="button" class="btn ghost" id="check">${icon("check")}<span>Kontrollera</span></button>
      <div id="result" class="composer-result wz-result" aria-live="polite"></div>
    </div>
  </section>`);

  const jsonEl = root.querySelector("#json");
  const resultEl = root.querySelector("#result");
  const promptBox = root.querySelector("#wz-prompt");
  const bildparHint = root.querySelector("#wz-bildpar");
  const genBox = root.querySelector("#wz-generator");
  const genHint = root.querySelector(".wz-material-gen");
  const materialBox = root.querySelector(".wz-material");

  // Räknegenerator-kontrollen (oförändrad fabrik); ändring → synliga lägen följer.
  const generatorCtl = createGeneratorControl(root.querySelector("#generator-config"), () => wz.sync());

  root.querySelector("#copy-area-prompt").addEventListener("click", (e) =>
    copyText(buildAreaPrompt(aiTypes(wz.state), wz.state.onskemal, normalizeGrade(wz.state.grade)), e.currentTarget)
  );

  jsonEl.addEventListener("input", () => wz.sync());
  root.querySelector("#file").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      jsonEl.value = String(reader.result || "");
      wz.markDirty();
      wz.sync();
      resultEl.innerHTML = `<div class="msg ok">Laddade filen "${esc(file.name)}". Klicka Kontrollera.</div>`;
    };
    reader.onerror = () => (resultEl.innerHTML = `<div class="msg error">Kunde inte läsa filen.</div>`);
    reader.readAsText(file);
    e.target.value = "";
  });
  root.querySelector("#example").addEventListener("click", () => {
    jsonEl.value = EXAMPLE_JSON;
    wz.markDirty();
    wz.sync();
  });
  root.querySelector("#clear").addEventListener("click", () => {
    jsonEl.value = "";
    wz.markDirty();
    wz.sync();
    resultEl.innerHTML = "";
  });

  root.querySelector("#check").addEventListener("click", () => {
    const res = wz.areaInput.validateCurrent();
    if (res.ok) {
      wz.modeVis.render(res.value, false);
      renderSummary(resultEl, res.value, "Gå vidare med <b>Nästa</b> för att välja synlighet och spara.");
    } else renderErrors(resultEl, res.errors);
  });

  /** Visa/göm delarna efter korten i steg 2 (anropas varje gång steget visas). */
  function onShow() {
    const ai = aiTypes(wz.state);
    const gen = wantsGenerator(wz.state);
    // Prompt-ytan: när något AI-kort är valt, eller inget kort alls (prompten ger då
    // både quiz och par). Ett rent Räkna-område byter prompten mot generatorn.
    promptBox.hidden = gen && ai.length === 0;
    bildparHint.hidden = !ai.includes("bildpar");
    genBox.hidden = !gen;
    genHint.hidden = !(gen && ai.length === 0);
    // Rent räkneområde: generatorn först. Generator + quiz/par (D-3): prompten och
    // materialrutan först, generatorn under – AI-flödet ska inte tryckas ner.
    if (ai.length === 0) materialBox.before(genBox);
    else materialBox.after(genBox);
  }

  /** Fyll materialrutan + generatorn (vid öppning). */
  function load(json, area) {
    jsonEl.value = json;
    generatorCtl.render(area || {});
    resultEl.innerHTML = "";
  }

  return { element: root, jsonEl, generatorCtl, resultEl, load, onShow };
}
