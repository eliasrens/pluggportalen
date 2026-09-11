// ============================================================================
// Pluggportalen – lärarsidan: innehållsinmatning (teacher-content.js)
// ----------------------------------------------------------------------------
// #/larare/innehall: ämnesväljare, skapa ämne, klistra in/ladda upp JSON,
// kontrollera/spara (src/validate.js + src/data.js), lista/ersätt/ta bort
// arbetsområden.
// ============================================================================

import * as data from "./data.js";
import { buildAreaList } from "./teacher-content-list.js";
import { buildContentView } from "./teacher-content-view.js";
import { wireNewSubjectForm } from "./teacher-subject-form.js";
import { EXAMPLE_JSON, buildAreaPrompt } from "./prompts.js";
import { areaExerciseTypes, normalizeExerciseTypes } from "./exercise-types.js";
import { normalizeGrade, filterSortAreas } from "./grades.js";
import { createModeVisibility } from "./teacher-mode-visibility.js";
import {
  el,
  esc,
  isTeacher,
  teacherNav,
  teacherHead,
  emptyState,
  wireHashLinks,
  renderGate,
  copyText,
} from "./teacher-shared.js";

export async function pageLarareInnehall(ctx) {
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);

  ctx.app.replaceChildren(el(`<div class="spinner">Laddar ämnen…</div>`));

  let subjects = [];
  try {
    subjects = await data.getSubjects();
  } catch (err) {
    ctx.app.replaceChildren(
      el(`<div class="panel"><div class="msg error">Kunde inte ladda ämnen: ${esc(err.message)}</div></div>`)
    );
    return;
  }

  // Räknegenerator-UI:t (issue #279) laddas DYNAMISKT här – först när läraren är
  // på #/larare/innehall – så teacher-generator.js/teacher-area-input.js aldrig
  // hamnar i den statiska bootgrafen (index.html → app.js → teacher.js →
  // teacher-content.js). En NY fil i bootgrafen kan 404:a under en icke-atomär
  // Pages-deploy → vit sida för alla (bevisad rotorsak #271, issue #290). Fångas
  // här och visas som ett snällt fel INNE i vyn – aldrig vit sida.
  let createGeneratorControl, createAreaInput;
  try {
    ({ createGeneratorControl } = await import("./teacher-generator.js"));
    ({ createAreaInput } = await import("./teacher-area-input.js"));
  } catch (err) {
    console.error("Räknegenerator-modulen kunde inte laddas:", err);
    const container = el(`<div class="teacher-page"></div>`);
    container.appendChild(teacherNav(ctx, "innehall"));
    container.appendChild(
      teacherHead(ctx, {
        emoji: "📚",
        title: "Innehåll",
        lead: "Innehållssidan kunde inte laddas fullständigt.",
      })
    );
    container.appendChild(
      el(`<div class="panel"><div class="msg error">Kunde inte ladda innehållsverktygen just nu.
        Prova att ladda om sidan om en stund.</div></div>`)
    );
    ctx.app.replaceChildren(container);
    return;
  }

  // Valt ämne: SO först om det finns, annars första.
  let selected = subjects.find((s) => s.id === "so")?.id || subjects[0]?.id || null;

  const view = buildContentView();

  // --- Ämnesväljare ---------------------------------------------------------
  const subjectSel = view.querySelector("#subject");
  function fillSubjectOptions() {
    subjectSel.innerHTML = subjects
      .map((s) => `<option value="${esc(s.id)}">${esc(s.icon || "")} ${esc(s.name)} (${esc(s.id)})</option>`)
      .join("");
    if (selected) subjectSel.value = selected;
  }
  fillSubjectOptions();

  subjectSel.addEventListener("change", () => {
    selected = subjectSel.value;
    refreshAreaList();
  });

  wireHashLinks(ctx, view);

  // --- Nytt ämne ------------------------------------------------------------
  wireNewSubjectForm({
    toggleBtn: view.querySelector("#new-subject"),
    formEl: view.querySelector("#new-subject-form"),
    subjects,
    onCreated: (id) => {
      selected = id;
      fillSubjectOptions();
      refreshAreaList();
    },
  });

  // --- Övningstyper (kryssrutor) -------------------------------------------
  // Styr både vad som sparas på området (value.exerciseTypes) och AI-prompten
  // som knappen kopierar. Se src/exercise-types.js och buildAreaPrompt.
  const exTypesBox = view.querySelector("#ex-types");
  const onskemalEl = view.querySelector("#area-onskemal");
  const gradeSel = view.querySelector("#area-grade");

  function getSelectedTypes() {
    return [...exTypesBox.querySelectorAll('input[type="checkbox"]:checked')].map((c) => c.value);
  }
  function setSelectedTypes(types) {
    const want = new Set(types || []);
    exTypesBox.querySelectorAll('input[type="checkbox"]').forEach((c) => {
      c.checked = want.has(c.value);
    });
  }
  // Årskurs: select-värdet "" betyder ospecificerad (null). normalizeGrade gör
  // läsningen robust mot äldre/okända värden.
  const getSelectedGrade = () => normalizeGrade(gradeSel.value);
  const setSelectedGrade = (grade) => {
    gradeSel.value = normalizeGrade(grade) || "";
  };

  // --- Synliga lägen (kryssrutor, per område) -------------------------------
  // UI:t bor i teacher-mode-visibility.js (issue #207). render() ritar utifrån ett
  // områdes innehåll, getHidden() läser av value.hiddenModes och autoFromJson()
  // ritar DIREKT ur redigeringsrutan så listan aldrig är tom tills man klickar
  // Kontrollera. Lägena härleds generiskt ur GAMEMODES – nya lägen dyker upp av
  // sig själva; ikryssat = synligt, urbockat = dolt (issue #200).
  const modeBox = view.querySelector("#mode-visibility");
  const modeVis = createModeVisibility(modeBox);
  const renderModeVisibility = modeVis.render;
  const getSelectedHiddenModes = modeVis.getHidden;

  // --- Räknegenerator (issue #279) ------------------------------------------
  // Egen kontroll (topic + varianter) vid sidan av JSON-rutan. Valet lagras som
  // area.generator och tänder räkna-läget. När läraren ändrar den uppdaterar vi
  // synliga-lägen-listan direkt (räkna dyker upp/försvinner). areaInput binder
  // ihop JSON-rutan med generator-/årskurs-kontrollerna (teacher-area-input.js)
  // och sätts så fort jsonEl finns – onChange läser den via closure.
  let areaInput;
  const generatorCtl = createGeneratorControl(view.querySelector("#generator-config"), () =>
    areaInput?.syncModeVisibility()
  );

  view.querySelector("#copy-area-prompt").addEventListener("click", (e) =>
    copyText(buildAreaPrompt(getSelectedTypes(), onskemalEl.value, getSelectedGrade()), e.currentTarget)
  );

  // --- Lista befintliga arbetsområden --------------------------------------
  const areaListEl = view.querySelector("#area-list");
  const jsonEl = view.querySelector("#json");
  const editSel = view.querySelector("#edit-area-select");
  const gradeFilterSel = view.querySelector("#area-grade-filter");
  const sortSel = view.querySelector("#area-sort");
  let currentAreas = []; // senast hämtade områden, filtreras/sorteras vid render

  // Ladda ett område i redigeringsrutan. Övningstyper och årskurs hör hemma i
  // egna kontrollerna (inte i JSON:en), så vi lyfter ut dem och fyller dem där.
  function loadAreaForEdit(a) {
    setSelectedTypes(areaExerciseTypes(a));
    setSelectedGrade(a.grade);
    generatorCtl.render(a);
    renderModeVisibility(a, true);
    // Övningstyper, årskurs och generator-konfigen hör hemma i egna kontrollerna
    // (inte i JSON:en) – lyft ut dem så JSON-rutan bara visar innehållet.
    const { id, exerciseTypes, grade, generator, ...rest } = a;
    jsonEl.value = JSON.stringify({ id, ...rest }, null, 2);
    jsonEl.scrollIntoView({ behavior: "smooth", block: "center" });
    view.querySelector("#result").innerHTML =
      `<div class="msg ok">Laddade "${esc(a.name)}" i rutan. Ändra och spara för att ersätta.</div>`;
  }

  // Väljaren "Redigera ett befintligt område" (issue #207): fylls ur currentAreas
  // (alla områden i ämnet, oberoende av listans filter) så läraren slipper
  // hand-klistra JSON. Val → ladda in samma väg som listans "Ersätt".
  function fillEditAreaOptions() {
    const opts = ['<option value="">— Välj ett område att redigera —</option>'];
    for (const a of currentAreas) {
      opts.push(
        `<option value="${esc(a.id)}">${esc(a.coverEmoji || "📖")} ${esc(a.name)} (${esc(a.id)})</option>`
      );
    }
    editSel.innerHTML = opts.join("");
  }
  editSel.addEventListener("change", () => {
    const a = currentAreas.find((x) => x.id === editSel.value);
    if (a) loadAreaForEdit(a);
  });

  // Rendera listan ur currentAreas enligt filter-/sorteringsvalen (ingen ny
  // hämtning – körs både efter hämtning och när läraren ändrar filter/sortering).
  function renderAreaList() {
    fillEditAreaOptions(); // väljaren speglar alltid alla områden i ämnet
    if (currentAreas.length === 0) {
      areaListEl.replaceChildren(
        emptyState(ctx, {
          emoji: "🗂️",
          title: "Inga arbetsområden i ämnet ännu",
          text: "Klistra in eller ladda upp en JSON nedan för att lägga in det första området.",
        })
      );
      return;
    }
    const shown = filterSortAreas(currentAreas, {
      filter: gradeFilterSel.value,
      sort: sortSel.value,
    });
    if (shown.length === 0) {
      areaListEl.innerHTML = `<p class="hint">Inga arbetsområden matchar filtret. Ändra "Visa årskurs" ovan.</p>`;
      return;
    }
    areaListEl.replaceChildren(
      buildAreaList(shown, {
        ctx,
        subjectId: selected,
        onEdit: loadAreaForEdit,
        onRefresh: refreshAreaList,
      })
    );
  }

  gradeFilterSel.addEventListener("change", renderAreaList);
  sortSel.addEventListener("change", renderAreaList);

  async function refreshAreaList() {
    if (!selected) {
      areaListEl.innerHTML = `<p class="hint">Inget ämne valt.</p>`;
      return;
    }
    areaListEl.innerHTML = `<div class="spinner">Laddar…</div>`;
    try {
      currentAreas = await data.getAreas(selected);
    } catch (err) {
      areaListEl.innerHTML = `<div class="msg error">Kunde inte ladda arbetsområden: ${esc(err.message)}</div>`;
      return;
    }
    renderAreaList();
  }

  // Väv ihop JSON-rutan med generator-/årskurs-kontrollerna (teacher-area-input.js):
  // validateCurrent() validerar helheten, syncModeVisibility() håller synliga-lägen-
  // listan aktuell. Sätts nu när jsonEl finns (generatorCtl.onChange läser via closure).
  areaInput = createAreaInput({ jsonEl, generatorCtl, getSelectedGrade, modeVis });
  const { validateCurrent, syncModeVisibility } = areaInput;

  // Rita synliga-lägen-listan DIREKT ur redigeringsrutan (issue #207) så den inte
  // är tom tills man klickar Kontrollera. Körs vid inladdning och medan man skriver.
  syncModeVisibility();
  jsonEl.addEventListener("input", () => syncModeVisibility());

  // --- Filuppladdning / exempel / rensa ------------------------------------
  view.querySelector("#file").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      jsonEl.value = String(reader.result || "");
      syncModeVisibility();
      view.querySelector("#result").innerHTML =
        `<div class="msg ok">Laddade filen "${esc(file.name)}". Klicka Kontrollera eller Spara.</div>`;
    };
    reader.onerror = () => {
      view.querySelector("#result").innerHTML =
        `<div class="msg error">Kunde inte läsa filen.</div>`;
    };
    reader.readAsText(file);
    e.target.value = ""; // så samma fil kan väljas igen
  });

  view.querySelector("#example").addEventListener("click", () => {
    jsonEl.value = EXAMPLE_JSON;
    syncModeVisibility();
  });
  view.querySelector("#clear").addEventListener("click", () => {
    jsonEl.value = "";
    generatorCtl.render({}); // nollställ även räknegeneratorn
    syncModeVisibility(); // → tom-state
    editSel.value = "";
    view.querySelector("#result").innerHTML = "";
  });

  // --- Kontrollera / spara --------------------------------------------------
  const resultEl = view.querySelector("#result");

  function showErrors(errors) {
    resultEl.innerHTML = `<div class="msg error">
      <div style="margin-bottom:6px">JSON:en kunde inte sparas. Rätta det här:</div>
      <ul class="error-list">${errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
    </div>`;
  }

  function showValidSummary(value) {
    const gen = value.generator
      ? `, räknegenerator: ${esc(value.generator.topic)} (${value.generator.variants.length} varianter)`
      : "";
    resultEl.innerHTML = `<div class="msg ok">
      ✓ Giltig JSON! <b>${esc(value.name)}</b> (id: <code>${esc(value.id)}</code>) –
      ${value.texts.length} texter, ${value.quiz.length} frågor, ${value.pairs.length} par${value.readingTexts.length ? `, ${value.readingTexts.length} nivåtexter` : ""}${gen}.
      Klicka <b>Spara till databasen</b> för att lägga in den i ämnet.
    </div>`;
  }

  view.querySelector("#check").addEventListener("click", () => {
    const res = validateCurrent();
    if (res.ok) {
      // Uppdatera synliga-lägen-listan efter innehållet, men behåll lärarens val.
      renderModeVisibility(res.value, false);
      showValidSummary(res.value);
    } else showErrors(res.errors);
  });

  view.querySelector("#save").addEventListener("click", async () => {
    if (!selected) {
      resultEl.innerHTML = `<div class="msg error">Välj ett ämne först.</div>`;
      return;
    }
    const res = validateCurrent();
    if (!res.ok) {
      showErrors(res.errors);
      return;
    }
    const saveBtn = view.querySelector("#save");
    saveBtn.disabled = true;
    const old = saveBtn.textContent;
    saveBtn.textContent = "Sparar…";
    try {
      // Synka synliga-lägen-listan mot innehållet som sparas (behåll lärarens
      // i-/urbockningar) innan vi läser av vilka lägen som ska döljas.
      renderModeVisibility(res.value, false);
      // Övningstyper: lärarens kryssrutor + "generator" när en räknegenerator är
      // vald (den har en egen kontroll, inte en kryssruta i AI-rutan).
      const exerciseTypes = normalizeExerciseTypes([
        ...getSelectedTypes(),
        ...(res.value.generator ? ["generator"] : []),
      ]);
      // Lärarens kryssrutor (övningstyper) och årskurs-väljaren är de uttryckliga
      // valen och vinner över det som ligger i/härleds ur JSON:en. res.value bär
      // redan den validerade generator-konfigen (vävd in i validateCurrent).
      const value = {
        ...res.value,
        exerciseTypes,
        grade: getSelectedGrade(),
        hiddenModes: getSelectedHiddenModes(res.value),
      };
      await data.saveArea(selected, value.id, value);
      resultEl.innerHTML = `<div class="msg ok">✓ Sparat! "${esc(value.name)}" finns nu i ämnet
        ${esc(subjects.find((s) => s.id === selected)?.name || selected)}.</div>`;
      refreshAreaList();
    } catch (err) {
      resultEl.innerHTML = `<div class="msg error">Kunde inte spara till databasen: ${esc(err.message)}</div>`;
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = old;
    }
  });

  const container = el(`<div class="teacher-page"></div>`);
  container.appendChild(teacherNav(ctx, "innehall"));
  container.appendChild(
    teacherHead(ctx, {
      emoji: "📚",
      title: "Innehåll",
      lead: `Välj ämne, klistra in eller ladda upp en arbetsområdes-JSON, kontrollera
        att den är giltig och spara till databasen. Behöver du en JSON? Kryssa i övningstyper
        och kopiera en <b>AI-prompt</b> nedan som skapar den åt dig.`,
    })
  );
  container.appendChild(view);
  ctx.app.replaceChildren(container);
  refreshAreaList();
}
