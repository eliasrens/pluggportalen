// ============================================================================
// Pluggportalen – lärarsidan: den fokuserade kompositören (teacher-composer.js)
// ----------------------------------------------------------------------------
// Issue #303. Kompositören är overlay-läget där ett arbetsområde skapas/redigeras.
// All wiring bor här (utbruten ur teacher-content.js för att hålla båda under
// radtaket). Fabriken createComposer() bygger overlay-DOM:en (buildComposerView),
// väver ihop metod-växeln (guidat / material), innehållstyp-växeln, räkne-
// generatorn, årskurs, AI-prompt, kontrollera/spara och synliga lägen – och
// returnerar { element, openNew, openEdit, close }.
//
// BOOT-SÄKERT: den här filen (och dess tunga imports – teacher-generator.js,
// teacher-area-input.js) laddas DYNAMISKT av teacher-content.js, så inget nytt
// hamnar i den statiska bootgrafen (jfr #271/#290). Ingen funktion från gamla
// innehållssidan är borttagen – bara omgrupperad.
// ============================================================================

import * as data from "./data.js";
import { buildComposerView } from "./teacher-content-view.js";
import { createGeneratorControl } from "./teacher-generator.js";
import { createAreaInput } from "./teacher-area-input.js";
import { EXAMPLE_JSON, buildAreaPrompt } from "./prompts.js";
import { areaExerciseTypes, normalizeExerciseTypes, hasGeneratorContent } from "./exercise-types.js";
import { normalizeGrade } from "./grades.js";
import { createModeVisibility } from "./teacher-mode-visibility.js";
import { esc, copyText } from "./teacher-shared.js";

/**
 * Skapa kompositör-overlayen.
 * @param {object} deps
 * @param {() => string|null} deps.getSubjectId   valt ämnes id (för Spara).
 * @param {() => string} deps.getSubjectName      valt ämnes namn (för rubriken).
 * @param {() => void} deps.onSaved               anropas efter lyckad Spara (ladda om biblioteket).
 * @returns {{element:HTMLElement, openNew:()=>void, openEdit:(area:object)=>void, close:()=>void}}
 */
export function createComposer({ getSubjectId, getSubjectName, onSaved }) {
  const composer = buildComposerView();

  const nameEl = composer.querySelector("#area-name");
  const gradeSel = composer.querySelector("#area-grade");
  const exTypesBox = composer.querySelector("#ex-types");
  const onskemalEl = composer.querySelector("#area-onskemal");
  const jsonEl = composer.querySelector("#json");
  const resultEl = composer.querySelector("#result");
  const composerTitle = composer.querySelector("#composer-title");
  const composerSub = composer.querySelector("#composer-sub");

  const getSelectedTypes = () =>
    [...exTypesBox.querySelectorAll('input[type="checkbox"]:checked')].map((c) => c.value);
  const setSelectedTypes = (types) => {
    const want = new Set(types || []);
    exTypesBox.querySelectorAll('input[type="checkbox"]').forEach((c) => (c.checked = want.has(c.value)));
  };
  const getSelectedGrade = () => normalizeGrade(gradeSel.value);
  const setSelectedGrade = (grade) => (gradeSel.value = normalizeGrade(grade) || "");

  // Synliga lägen (per område) – oförändrad fabrik (issue #200/#207).
  const modeVis = createModeVisibility(composer.querySelector("#mode-visibility"));
  const renderModeVisibility = modeVis.render;
  const getSelectedHiddenModes = modeVis.getHidden;

  // Räknegenerator-kontrollen; ändring uppdaterar synliga lägen direkt.
  let areaInput;
  const generatorCtl = createGeneratorControl(composer.querySelector("#generator-config"), () =>
    areaInput?.syncModeVisibility()
  );

  // Väv ihop material + generator + namn + årskurs → validering (samma väg för
  // guidat och material). getName gör att namn-fältet vinner över ev. name i JSON.
  areaInput = createAreaInput({
    jsonEl,
    generatorCtl,
    getSelectedGrade,
    modeVis,
    getName: () => nameEl.value,
  });
  const { validateCurrent, syncModeVisibility } = areaInput;

  jsonEl.addEventListener("input", () => syncModeVisibility());
  nameEl.addEventListener("input", () => syncModeVisibility());

  // --- Metod-växel (guidat / material) --------------------------------------
  const methodTabs = [...composer.querySelectorAll(".method-tab")];
  const methodPanes = [...composer.querySelectorAll(".composer-method")];
  function setMethod(method) {
    methodTabs.forEach((t) => {
      const on = t.dataset.method === method;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", String(on));
    });
    methodPanes.forEach((p) => (p.hidden = p.dataset.method !== method));
  }
  methodTabs.forEach((t) => t.addEventListener("click", () => setMethod(t.dataset.method)));

  // --- Innehållstyp-växel i guidat (quiz / par / generator) -----------------
  const ctypeTabs = [...composer.querySelectorAll(".ctype-tab")];
  const ctypePanes = [...composer.querySelectorAll(".ctype-pane")];
  function setCtype(ctype) {
    ctypeTabs.forEach((t) => t.classList.toggle("active", t.dataset.ctype === ctype));
    const paneFor = ctype === "generator" ? "generator" : "text";
    ctypePanes.forEach((p) => (p.hidden = p.dataset.ctypePane !== paneFor));
    if (ctype === "generator") {
      setSelectedTypes([]); // rent generator-område; "generator" läggs till vid Spara.
    } else if (ctype === "quiz" || ctype === "pairs") {
      const cur = new Set(getSelectedTypes()); // behåll ev. redan valda (både quiz och par möjligt).
      cur.add(ctype);
      setSelectedTypes([...cur]);
    }
    syncModeVisibility();
  }
  ctypeTabs.forEach((t) => t.addEventListener("click", () => setCtype(t.dataset.ctype)));

  // --- AI-prompt / material-knappar (oförändrad logik) ----------------------
  composer.querySelector("#copy-area-prompt").addEventListener("click", (e) =>
    copyText(buildAreaPrompt(getSelectedTypes(), onskemalEl.value, getSelectedGrade()), e.currentTarget)
  );
  composer.querySelector("#file").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      jsonEl.value = String(reader.result || "");
      syncModeVisibility();
      resultEl.innerHTML = `<div class="msg ok">Laddade filen "${esc(file.name)}". Klicka Kontrollera eller Spara.</div>`;
    };
    reader.onerror = () => (resultEl.innerHTML = `<div class="msg error">Kunde inte läsa filen.</div>`);
    reader.readAsText(file);
    e.target.value = "";
  });
  composer.querySelector("#example").addEventListener("click", () => {
    jsonEl.value = EXAMPLE_JSON;
    syncModeVisibility();
  });
  composer.querySelector("#clear").addEventListener("click", () => {
    jsonEl.value = "";
    syncModeVisibility();
    resultEl.innerHTML = "";
  });

  // --- Kontrollera / spara --------------------------------------------------
  function showErrors(errors) {
    resultEl.innerHTML = `<div class="msg error">
      <div style="margin-bottom:6px">Något ser inte klart ut ännu – rätta det här:</div>
      <ul class="error-list">${errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
    </div>`;
  }
  function showValidSummary(value) {
    const bits = [];
    if (value.generator)
      bits.push(`räknegenerator: <b>${esc(value.generator.topic)}</b> (${value.generator.variants.length} varianter · oändligt antal uppgifter)`);
    if (value.quiz.length) bits.push(`${value.quiz.length} frågor`);
    if (value.pairs.length) bits.push(`${value.pairs.length} par`);
    if (value.texts.length) bits.push(`${value.texts.length} texter`);
    if (value.readingTexts.length) bits.push(`${value.readingTexts.length} nivåtexter`);
    resultEl.innerHTML = `<div class="msg ok">
      ✓ <b>Ser bra ut!</b> Det här skapas: <b>${esc(value.name)}</b>${bits.length ? " – " + bits.join(", ") : ""}.
      Klicka <b>Spara</b> för att lägga in det i ämnet.
    </div>`;
  }

  composer.querySelector("#check").addEventListener("click", () => {
    const res = validateCurrent();
    if (res.ok) {
      renderModeVisibility(res.value, false);
      showValidSummary(res.value);
    } else showErrors(res.errors);
  });

  composer.querySelector("#save").addEventListener("click", async () => {
    const subjectId = getSubjectId();
    if (!subjectId) {
      resultEl.innerHTML = `<div class="msg error">Välj ett ämne först.</div>`;
      return;
    }
    const res = validateCurrent();
    if (!res.ok) return showErrors(res.errors);
    const saveBtn = composer.querySelector("#save");
    saveBtn.disabled = true;
    const old = saveBtn.textContent;
    saveBtn.textContent = "Sparar…";
    try {
      renderModeVisibility(res.value, false);
      const exerciseTypes = normalizeExerciseTypes([
        ...getSelectedTypes(),
        ...(res.value.generator ? ["generator"] : []),
      ]);
      const value = {
        ...res.value,
        exerciseTypes,
        grade: getSelectedGrade(),
        hiddenModes: getSelectedHiddenModes(res.value),
      };
      await data.saveArea(subjectId, value.id, value);
      resultEl.innerHTML = `<div class="msg ok">✓ Sparat! "${esc(value.name)}" finns nu i
        ${esc(getSubjectName())}.</div>`;
      await onSaved();
      close();
    } catch (err) {
      resultEl.innerHTML = `<div class="msg error">Kunde inte spara till databasen: ${esc(err.message)}</div>`;
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = old;
    }
  });

  // --- Öppna / stänga --------------------------------------------------------
  function resetComposer() {
    nameEl.value = "";
    setSelectedTypes(["quiz"]);
    setSelectedGrade(null);
    onskemalEl.value = "";
    jsonEl.value = "";
    generatorCtl.render({});
    resultEl.innerHTML = "";
    setCtype("quiz");
    setMethod("guidat");
    syncModeVisibility();
  }

  function fillComposerFromArea(a) {
    nameEl.value = a.name || "";
    setSelectedTypes(areaExerciseTypes(a));
    setSelectedGrade(a.grade);
    onskemalEl.value = "";
    generatorCtl.render(a);
    const { id, exerciseTypes, grade, generator, name, ...rest } = a;
    jsonEl.value = JSON.stringify({ id, ...rest }, null, 2);
    resultEl.innerHTML = "";
    if (hasGeneratorContent(a)) {
      setCtype("generator");
      setMethod("guidat");
    } else {
      setMethod("material");
    }
    renderModeVisibility(a, true);
  }

  function open(title, area) {
    composerTitle.textContent = title;
    composerSub.innerHTML = `I ämnet <b>${esc(getSubjectName() || "—")}</b>`;
    if (area) fillComposerFromArea(area);
    else resetComposer();
    composer.hidden = false;
    document.body.classList.add("composer-open");
    setTimeout(() => nameEl.focus(), 0);
  }
  function close() {
    composer.hidden = true;
    document.body.classList.remove("composer-open");
  }

  composer.querySelector("#composer-close").addEventListener("click", close);
  composer.addEventListener("mousedown", (e) => {
    if (e.target === composer) close(); // backdrop-klick.
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !composer.hidden) close();
  });

  return {
    element: composer,
    openNew: () => open("Nytt arbetsområde", null),
    openEdit: (a) => open(`Redigera: ${a.name}`, a),
    close,
  };
}
