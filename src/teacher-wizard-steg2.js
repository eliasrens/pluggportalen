// ============================================================================
// Pluggporten – lärarsidan: wizard steg 2 "Innehåll & AI-önskemål" (teacher-wizard-steg2.js)
// ----------------------------------------------------------------------------
// Issue #442. Kompositörens små kryssrutor + innehållstyp-flikar ersätts av STORA
// klickbara kort, ett per övningstyp i EXERCISE_TYPES (Quiz & läsförståelse ·
// Para ihop · Bildpar · Räkna). Korten är oberoende av varandra (lead-beslut D-3:
// generator + quiz i samma område ska gå). Valet = state.types; vid Spara blir det
// exerciseTypes exakt som förr (teacher-wizard-state.js buildSaveValue).
// Kortet "Quiz" ger fortfarande typ-id "quiz" – inga nya typ-id (X-10, #151).
// ============================================================================

import { EXERCISE_TYPES } from "./exercise-types.js";
import { toggleType } from "./teacher-wizard-state.js";
import { el, esc } from "./teacher-shared.js";

// Kortens rubriker (kortare än katalogens etiketter). Okända typer faller
// tillbaka på katalogens label, så en ny typ i EXERCISE_TYPES får ett kort direkt.
const CARD_TITLES = {
  quiz: "Quiz & läsförståelse",
  pairs: "Para ihop & memory",
  bildpar: "Bildpar",
  generator: "Räkna (generator)",
};

/**
 * @param {object} wz  wizardens delade kontext ({ state, markDirty, sync }).
 * @returns {{element:HTMLElement, load:()=>void}}
 */
export function createStep2(wz) {
  const root = el(`<section class="wz-step" data-step="2" aria-labelledby="wz-h2">
    <h3 class="wz-step-title" id="wz-h2">Vad ska området innehålla?</h3>
    <p class="hint">Klicka på korten för att välja – du kan välja flera. Bara de valda typerna
      kommer med i AI-prompten.</p>
    <div class="wz-cards" id="ex-types" role="group" aria-label="Övningstyper på området">
      ${EXERCISE_TYPES.map(
        (t) => `<button type="button" class="wz-card" data-type="${esc(t.id)}" aria-pressed="false">
          <span class="wz-card-check" aria-hidden="true">✓</span>
          <span class="wz-card-emoji" aria-hidden="true">${esc(t.emoji)}</span>
          <span class="wz-card-title">${esc(CARD_TITLES[t.id] || t.label)}</span>
          <span class="wz-card-hint">${esc(t.hint)}</span>
        </button>`
      ).join("")}
    </div>
    <p class="hint wz-cards-empty" hidden>Inget kort valt – då innehåller prompten både quiz och par.</p>
    <div class="field" style="margin-top:16px">
      <label for="area-onskemal">✍️ Eget önskemål till AI:n (valfritt)</label>
      <textarea id="area-onskemal" class="wz-onskemal" rows="3"
        placeholder="T.ex. ämne, tema eller omfattning – vävs in i prompten"></textarea>
      <p class="hint">Har du ingen PDF/text? Beskriv ämne och ev. omfattning här, så vävs det
        in i prompten i stället för platshållaren för bifogat material.</p>
    </div>
  </section>`);

  const cards = [...root.querySelectorAll(".wz-card")];
  const emptyHint = root.querySelector(".wz-cards-empty");
  const onskemalEl = root.querySelector("#area-onskemal");

  function refreshCards() {
    const sel = new Set(wz.state.types);
    cards.forEach((c) => {
      const on = sel.has(c.dataset.type);
      c.classList.toggle("selected", on);
      c.setAttribute("aria-pressed", String(on));
    });
    emptyHint.hidden = sel.size > 0;
  }

  cards.forEach((c) =>
    c.addEventListener("click", () => {
      wz.state.types = toggleType(wz.state, c.dataset.type);
      refreshCards();
      wz.markDirty();
      wz.sync(); // Räkna av/på ändrar vilka lägen som finns.
    })
  );
  onskemalEl.addEventListener("input", () => (wz.state.onskemal = onskemalEl.value));

  function load() {
    onskemalEl.value = wz.state.onskemal || "";
    refreshCards();
  }

  return { element: root, load };
}
