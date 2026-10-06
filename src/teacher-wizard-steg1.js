// ============================================================================
// Pluggporten – lärarsidan: wizard steg 1 "Grundinställningar" (teacher-wizard-steg1.js)
// ----------------------------------------------------------------------------
// Issue #442. Bara namn, årskurs och symbol (emoji). Emojiväljaren är kompositörens
// (#307) oförändrad: textfältet är sanningskällan, rutnätet skriver in i det,
// tomt → 📖 (validate defaultar). Allt skrivs till wizardens gemensamma state.
// Laddas dynamiskt via teacher-wizard.js (boot-säkert, #271).
// ============================================================================

import { GRADES, normalizeGrade } from "./grades.js";
import { COVER_EMOJI_CHOICES } from "./teacher-content-view.js";
import { el, esc } from "./teacher-shared.js";

/**
 * @param {object} wz  wizardens delade kontext ({ state, markDirty, sync }).
 * @returns {{element:HTMLElement, load:()=>void, focus:()=>void}}
 */
export function createStep1(wz) {
  const root = el(`<section class="wz-step" data-step="1" aria-labelledby="wz-h1">
    <h3 class="wz-step-title" id="wz-h1">Grundinställningar</h3>
    <div class="wz-basics">
      <div class="field">
        <label for="area-name">Namn på området</label>
        <input id="area-name" class="wz-name" placeholder="T.ex. Vikingatiden eller Multiplikationsträning" />
      </div>
      <div class="field">
        <label for="area-grade">Årskurs (valfritt)</label>
        <select id="area-grade" class="select">
          <option value="">Ospecificerad</option>
          ${GRADES.map((g) => `<option value="${esc(g.id)}">${esc(g.label)}</option>`).join("")}
        </select>
        <p class="hint">Styr AI-prompten (språk och svårighetsgrad) och gör att du kan
          filtrera biblioteket per årskurs. Lämna <b>Ospecificerad</b> om området passar
          flera årskurser.</p>
      </div>
    </div>
    <div class="field">
      <label for="area-emoji">Symbol (emoji)</label>
      <p class="hint">Visas i biblioteket och på elevernas områdeskort. Klicka en emoji eller
        skriv in en egen. Lämna tomt för standard 📖.</p>
      <div class="emoji-picker">
        <div class="emoji-grid" id="area-emoji-grid" role="listbox" aria-label="Välj symbol för området">
          ${COVER_EMOJI_CHOICES.map(
            (e) => `<button type="button" class="emoji-choice" data-emoji="${esc(e)}"
              role="option" aria-label="Välj ${esc(e)}">${esc(e)}</button>`
          ).join("")}
        </div>
        <div class="row-inline emoji-custom">
          <span class="emoji-preview" id="area-emoji-preview" aria-hidden="true">📖</span>
          <input id="area-emoji" class="emoji-input" maxlength="8"
            placeholder="Egen emoji, t.ex. 🛶" aria-label="Egen emoji" />
        </div>
      </div>
    </div>
  </section>`);

  const nameEl = root.querySelector("#area-name");
  const gradeSel = root.querySelector("#area-grade");
  const emojiEl = root.querySelector("#area-emoji");
  const emojiGrid = root.querySelector("#area-emoji-grid");
  const emojiPreview = root.querySelector("#area-emoji-preview");

  function refreshEmojiPicker() {
    const cur = emojiEl.value.trim();
    emojiPreview.textContent = cur || "📖";
    emojiGrid.querySelectorAll(".emoji-choice").forEach((b) => {
      const on = b.dataset.emoji === cur;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", String(on));
    });
  }

  nameEl.addEventListener("input", () => {
    wz.state.name = nameEl.value;
    wz.sync();
  });
  gradeSel.addEventListener("change", () => {
    wz.state.grade = normalizeGrade(gradeSel.value);
    wz.sync();
  });
  emojiEl.addEventListener("input", () => {
    wz.state.emoji = emojiEl.value.trim();
    refreshEmojiPicker();
  });
  emojiGrid.querySelectorAll(".emoji-choice").forEach((b) =>
    b.addEventListener("click", () => {
      emojiEl.value = b.dataset.emoji;
      wz.state.emoji = b.dataset.emoji;
      refreshEmojiPicker();
      wz.markDirty();
    })
  );

  /** Fyll kontrollerna från state (vid öppning). */
  function load() {
    nameEl.value = wz.state.name || "";
    gradeSel.value = normalizeGrade(wz.state.grade) || "";
    emojiEl.value = wz.state.emoji || "";
    refreshEmojiPicker();
  }

  return { element: root, load, focus: () => nameEl.focus() };
}
