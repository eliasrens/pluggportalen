// ============================================================================
// Pluggporten – lärarsidan: "Skapa nytt område"-wizarden (teacher-wizard.js)
// ----------------------------------------------------------------------------
// Issue #442 (epic #438). Ersätter kompositörens långa formulär (#303) med en
// 4-stegs wizard i en modal:
//   1 Grundinställningar  (teacher-wizard-steg1.js)
//   2 Innehåll & AI       (teacher-wizard-steg2.js)
//   3 AI-verkstaden       (teacher-wizard-steg3.js)
//   4 Synlighet & spara   (teacher-wizard-steg4.js)
// Den här filen är STEGMOTORN: modal-skal, klickbar stegindikator, Föregående/
// Nästa/Spara, ✕/Esc/backdrop med varning om osparad data, och sömmen
// createAreaInput (befintlig) mellan stegens kontroller.
//
// STATE BEVARAS: alla fyra stegen monteras EN gång och växlas med hidden, så
// DOM-kontrollerna (och fabrikerna bakom materialrutan, generatorn och lägena)
// lever kvar när man backar/hoppar. Övrigt state (namn, årskurs, emoji, typer,
// önskemål) bor i ett gemensamt objekt, wz.state (teacher-wizard-state.js).
//
// Gränssnittet utåt är kompositörens: { element, openNew, openEdit, close }.
// BOOT-SÄKERT: laddas DYNAMISKT av teacher-content.js (#271/#290) – ingen av
// wizard-filerna får importeras statiskt från bootgrafen.
// ============================================================================

import { createAreaInput } from "./teacher-area-input.js";
import {
  WIZARD_STEPS,
  blankState,
  jsonFromArea,
  stateFromArea,
  startStepFor,
  wantsGenerator,
} from "./teacher-wizard-state.js";
import { normalizeGrade } from "./grades.js";
import { createStep1 } from "./teacher-wizard-steg1.js";
import { createStep2 } from "./teacher-wizard-steg2.js";
import { createStep3 } from "./teacher-wizard-steg3.js";
import { createStep4 } from "./teacher-wizard-steg4.js";
import { el, esc, icon } from "./teacher-shared.js";

/**
 * Skapa wizard-modalen.
 * @param {object} deps
 * @param {() => string|null} deps.getSubjectId   valt ämnes id (för Spara).
 * @param {() => string} deps.getSubjectName      valt ämnes namn (för rubriken).
 * @param {() => (void|Promise<void>)} deps.onSaved anropas efter lyckad Spara (ladda om tabellen).
 * @returns {{element:HTMLElement, openNew:()=>void, openEdit:(area:object)=>void, close:()=>void}}
 */
export function createAreaWizard({ getSubjectId, getSubjectName, onSaved }) {
  const overlay = el(`<div class="studio-composer-overlay wz-overlay" hidden>
    <div class="studio-composer wz-dialog" role="dialog" aria-modal="true" aria-labelledby="wz-title">
      <button type="button" class="cx-modal-close" id="wz-close" aria-label="Stäng wizarden">✕</button>
      <header class="wz-head">
        <div class="wz-titles">
          <h2 id="wz-title" class="composer-title">Nytt arbetsområde</h2>
          <p class="composer-sub" id="wz-sub"></p>
        </div>
        <ol class="wz-stepper" aria-label="Steg">
          ${WIZARD_STEPS.map(
            (s) => `<li><button type="button" class="wz-stepbtn" data-go="${s.nr}">
              <span class="wz-stepnr">${s.nr}</span><span class="wz-steplabel">${esc(s.title)}</span>
            </button></li>`
          ).join("")}
        </ol>
      </header>
      <div class="wz-body"></div>
      <div class="wz-leave" role="alertdialog" aria-labelledby="wz-leave-text" hidden>
        <span id="wz-leave-text">⚠️ Du har ändringar som inte är sparade. Stänga ändå?</span>
        <span class="row-inline">
          <button type="button" class="btn ghost" id="wz-stay">Fortsätt redigera</button>
          <button type="button" class="btn danger" id="wz-discard">Stäng utan att spara</button>
        </span>
      </div>
      <footer class="wz-foot">
        <button type="button" class="btn ghost" id="wz-prev">← Föregående</button>
        <span class="wz-pos" id="wz-pos" aria-live="polite"></span>
        <button type="button" class="btn" id="wz-next">Nästa →</button>
        <button type="button" class="btn gron wz-save" id="wz-save">${icon("save", 20)}<span>Spara</span></button>
      </footer>
    </div>
  </div>`);

  const body = overlay.querySelector(".wz-body");
  const stepBtns = [...overlay.querySelectorAll(".wz-stepbtn")];
  const prevBtn = overlay.querySelector("#wz-prev");
  const nextBtn = overlay.querySelector("#wz-next");
  const saveBtn = overlay.querySelector("#wz-save");
  const posEl = overlay.querySelector("#wz-pos");
  const leaveBar = overlay.querySelector(".wz-leave");

  let current = 1;
  let dirty = false;

  // Delad kontext för stegen. state byts ut vid varje öppning – stegen läser
  // alltid wz.state (aldrig en egen kopia).
  const wz = {
    state: blankState(),
    areaInput: null,
    modeVis: null,
    markDirty: () => (dirty = true),
    sync: () => wz.areaInput?.syncModeVisibility(),
    go: (n) => go(n),
  };

  const s1 = createStep1(wz);
  const s2 = createStep2(wz);
  const s3 = createStep3(wz);
  const s4 = createStep4(wz, { getSubjectId, getSubjectName });
  const steps = { 1: s1, 2: s2, 3: s3, 4: s4 };
  body.append(s1.element, s2.element, s3.element, s4.element);
  wz.modeVis = s4.modeVis;

  // Generatorn räknas bara när kortet Räkna är valt. Avbockat kort → ingen
  // generator i det som valideras/sparas, men kontrollens val står kvar om
  // läraren väljer kortet igen (state bevaras).
  const generatorCtl = {
    render: s3.generatorCtl.render,
    getGenerator: (grade) => (wantsGenerator(wz.state) ? s3.generatorCtl.getGenerator(grade) : null),
  };
  // BEFINTLIG söm: material + generator + namn + emoji + årskurs → validateArea.
  wz.areaInput = createAreaInput({
    jsonEl: s3.jsonEl,
    generatorCtl,
    getSelectedGrade: () => normalizeGrade(wz.state.grade),
    modeVis: s4.modeVis,
    getName: () => wz.state.name,
    getCoverEmoji: () => wz.state.emoji,
  });
  // Kortet Räkna valt (#470) → minst ett räknesätt med minst en variant krävs;
  // annars skulle området tyst sparas utan räknegenerator.
  const validateBase = wz.areaInput.validateCurrent;
  wz.areaInput.validateCurrent = () => {
    const res = validateBase();
    if (!wantsGenerator(wz.state) || s3.generatorCtl.getGenerator(null)) return res;
    const msg = "Räknegenerator: kryssa i minst ett räknesätt med minst en variant (eller välj bort kortet Räkna i steg 2).";
    return { ...res, ok: false, errors: [...(res.errors || []), msg] };
  };

  // Allt läraren skriver/väljer i wizarden gör den "smutsig" (varning vid stäng).
  body.addEventListener("input", wz.markDirty);
  body.addEventListener("change", wz.markDirty);

  // --- Stegmotorn ------------------------------------------------------------
  function go(n) {
    current = Math.min(4, Math.max(1, n));
    for (const [nr, step] of Object.entries(steps)) step.element.hidden = Number(nr) !== current;
    stepBtns.forEach((b) => {
      const nr = Number(b.dataset.go);
      b.classList.toggle("active", nr === current);
      b.classList.toggle("done", nr < current);
      if (nr === current) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });
    prevBtn.disabled = current === 1;
    nextBtn.hidden = current === 4;
    saveBtn.hidden = current !== 4;
    posEl.textContent = `Steg ${current} av 4 · ${WIZARD_STEPS[current - 1].title}`;
    steps[current].onShow?.();
    body.scrollTop = 0;
  }
  stepBtns.forEach((b) => b.addEventListener("click", () => go(Number(b.dataset.go))));
  prevBtn.addEventListener("click", () => go(current - 1));
  nextBtn.addEventListener("click", () => go(current + 1));

  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    const old = saveBtn.innerHTML;
    saveBtn.textContent = "Sparar…";
    try {
      const saved = await s4.save();
      if (!saved) return;
      dirty = false; // inte varna vid stängningen efter lyckad Spara (X-13).
      await onSaved();
      close();
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = old;
    }
  });

  // --- Öppna / stänga ----------------------------------------------------------
  function onKey(e) {
    if (e.key !== "Escape" || overlay.hidden) return;
    if (!leaveBar.hidden) leaveBar.hidden = true; // Esc i varningen = fortsätt redigera.
    else requestClose();
  }
  function onBeforeUnload(e) {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = "";
  }
  // Byter routern sida medan wizarden är öppen försvinner den med vyn – städa då
  // lyssnarna och scroll-låset (X-12).
  function onHashChange() {
    teardown();
  }
  function teardown() {
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("beforeunload", onBeforeUnload);
    window.removeEventListener("hashchange", onHashChange);
    document.body.classList.remove("composer-open");
  }

  function open(title, area) {
    overlay.querySelector("#wz-title").textContent = title;
    overlay.querySelector("#wz-sub").innerHTML = `I ämnet <b>${esc(getSubjectName() || "—")}</b>`;
    wz.state = area ? stateFromArea(area) : blankState();
    s1.load();
    s2.load();
    s3.load(area ? jsonFromArea(area) : "", area);
    s4.clear();
    if (area) s4.modeVis.render(area, true);
    else wz.sync();
    dirty = false;
    leaveBar.hidden = true;
    overlay.hidden = false;
    teardown(); // aldrig dubbla lyssnare
    document.body.classList.add("composer-open");
    document.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("hashchange", onHashChange);
    go(startStepFor(area));
    if (!area) setTimeout(() => s1.focus(), 0);
  }

  function close() {
    overlay.hidden = true;
    leaveBar.hidden = true;
    dirty = false;
    teardown();
  }

  /** ✕ / Esc / backdrop: varna först om något är osparat. */
  function requestClose() {
    if (!dirty) return close();
    leaveBar.hidden = false;
    overlay.querySelector("#wz-stay").focus();
  }

  overlay.querySelector("#wz-close").addEventListener("click", requestClose);
  overlay.querySelector("#wz-stay").addEventListener("click", () => (leaveBar.hidden = true));
  overlay.querySelector("#wz-discard").addEventListener("click", close);
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) requestClose(); // backdrop-klick.
  });

  return {
    element: overlay,
    openNew: () => open("Nytt arbetsområde", null),
    openEdit: (a) => open(`Redigera: ${a.name}`, a),
    close,
  };
}
