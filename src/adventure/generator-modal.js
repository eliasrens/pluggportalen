// ============================================================================
// Pluggportalen – äventyrsmotorn: generator-modal.js  (issue #296 del A)
// ----------------------------------------------------------------------------
// UTMANINGSMODALEN för äventyr som körs på ett GENERATOR-område (#279): i stället
// för en flervalsfråga (question-modal.js) visas en GENERERAD räkneuppgift på ett
// A4-kort med en flyktig kladdyta och ett svarsfält som rättas mot generatorns
// facit. Kortet + kladdytan + FÖRSTORA-knappen är EXAKT samma delade komponent som
// Räkna-läget (scratchpad.js, #280/#296 del B), och rättningen återanvänder den rena
// rakna-core-logiken (checkAnswer/problemDisplay/expectedAnswerText). Ingen ny
// spel-/belönings-logik: motorn (engine.js) driver äventyret vidare på {correct}
// precis som med quiz/par – coins/XP via den vanliga game-shared-loopen, grind orörd.
//
// Följer question-modal.js designmässigt: .cx-modal-overlay > .cx-modal på
// --z-modal, role="dialog" aria-modal="true", ✕-stäng och en enkel fokusfälla.
// openGeneratorModal resolvar {correct} när eleven svarat OCH tryckt "Fortsätt",
// eller {correct:false, cancelled:true} om man stänger utan att svara (motorn låter
// då stationen vara kvar – aldrig game over, alltid snällt).
//
// FÖRSTORA + Escape: modalen äger Escape (stäng), så kladdkortet skapas med
// handleEscape:false och modalen fäller själv IN en utfälld kladdyta på Escape
// innan den stänger. Tangenttryck i modalen bubblar inte vidare till motorns
// window-lyssnare (annars skulle piltangenter i svarsfältet preventDefault:as).
//
// BOOT-SÄKERHET: laddas bara via den dynamiska generator-adaptern (generator-
// adapter.js ← adventure/index.js, redan utanför bootgrafen). Får aldrig statiskt
// importeras av en bootfil.
// ============================================================================

import { el } from "../ui.js";
import { createScratchCard } from "../scratchpad.js";
import { problemDisplay, checkAnswer, expectedAnswerText } from "../rakna-core.js";

/** Enkel HTML-escape för uppgiftstext/titel. */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Öppna generator-utmaningsmodalen och lös svaret.
 * @param {object} o
 * @param {{problem:object, answer:number}} o.item  adapterns problem + facit
 * @param {string} [o.title]  modalens rubrik (temats stationTitle)
 * @param {string} [o.emoji]  liten ikon i huvudet (temats progressIcon)
 * @param {HTMLElement} [o.host=document.body]  var overlayen läggs
 * @returns {Promise<{correct:boolean, cancelled?:boolean}>}
 */
export function openGeneratorModal({ item, title = "Räkneuppgift", emoji = "🔢", host = document.body }) {
  return new Promise((resolve) => {
    const { problem, answer } = item;
    const prevFocus = document.activeElement;
    let answered = false; // en rättning per uppgift
    let done = false;

    const hint = problem.hasRemainder
      ? `Svara med kvot och rest, t.ex. <b>3 rest 1</b>.`
      : `Skriv ditt slutsvar. Använd komma för decimaler (t.ex. 3,5).`;

    const overlay = el(`<div class="cx-modal-overlay adv-q-overlay adv-gen-overlay">
      <div class="cx-modal adv-q-modal adv-gen-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <button class="cx-modal-close" id="adv-gen-close" title="Stäng" aria-label="Stäng">✕</button>
        <div class="cx-modal-head">
          <span class="cx-modal-avatar" aria-hidden="true">${esc(emoji)}</span>
          <div><h2 class="cx-modal-name">${esc(title)}</h2></div>
        </div>
        <div class="adv-gen-body">
          <div class="adv-gen-stage"></div>
          <form class="rakna-answer adv-gen-answer" autocomplete="off">
            <label class="rakna-answer-label" for="adv-gen-svar">Ditt svar</label>
            <div class="rakna-answer-row">
              <input id="adv-gen-svar" class="rakna-input" type="text" inputmode="text"
                     autocomplete="off" autocorrect="off" spellcheck="false"
                     enterkeyhint="done" placeholder="Skriv slutsvaret" />
              <button type="submit" class="btn gron rakna-submit">Svara</button>
            </div>
            <p class="hint rakna-hint">${hint}</p>
            <div class="rakna-feedback" id="adv-gen-feedback" role="status" aria-live="polite"></div>
          </form>
        </div>
      </div>
    </div>`);

    const modal = overlay.querySelector(".adv-gen-modal");

    // Delat kladdkort (A4 + canvas + verktyg + förstora). handleEscape:false –
    // modalen äger Escape (se onKey nedan) och fäller själv in en utfälld kladdyta.
    const scratch = createScratchCard({
      taskHtml: `${esc(problemDisplay(problem))} <span class="a4-eq">=</span>`,
      handleEscape: false,
    });
    overlay.querySelector(".adv-gen-stage").appendChild(scratch.card);

    const form = overlay.querySelector(".adv-gen-answer");
    const input = overlay.querySelector(".rakna-input");
    const submitBtn = overlay.querySelector(".rakna-submit");
    const feedback = overlay.querySelector("#adv-gen-feedback");

    // Uppgiften (fråga + svarsfält) får INTE försvinna när kladdytan förstoras
    // (#312): svarsrutan följer med in i det utfällda kortet. Frågan syns redan i
    // kortets rubrik, så förstora ger mer ritutrymme utan att dölja uppgiften.
    scratch.enlarge.setAnswer(form);

    function close(result) {
      if (done) return;
      done = true;
      document.removeEventListener("keydown", onKey, true);
      scratch.destroy(); // plockar bort canvas/förstora-lyssnare + ev. body-lås
      overlay.remove();
      if (prevFocus && prevFocus.focus) {
        try { prevFocus.focus(); } catch {}
      }
      resolve(result);
    }

    // Fokusfälla + Escape (capture-fas, som question-modal). Escape fäller först in
    // en utfälld kladdyta; annars stänger den modalen (avbryt).
    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (scratch.enlarge.isFull()) {
          scratch.enlarge.exit();
          return;
        }
        close({ correct: false, cancelled: true });
        return;
      }
      if (e.key !== "Tab") return;
      const items = [...modal.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (answered) return; // "Fortsätt"-knappen sköter stängningen
      const ok = checkAnswer(problem, answer, input.value);
      answered = true;
      input.readOnly = true;
      submitBtn.hidden = true;
      if (ok) {
        feedback.className = "rakna-feedback ratt";
        feedback.innerHTML = `✅ Rätt! Bra jobbat.`;
      } else {
        feedback.className = "rakna-feedback fel";
        feedback.innerHTML = `❌ Inte riktigt. Rätt svar: <b>${esc(expectedAnswerText(problem, answer))}</b>`;
      }
      const nextBtn = el(
        `<button type="button" class="btn gron adv-gen-next">Fortsätt →</button>`
      );
      nextBtn.addEventListener("click", () => close({ correct: ok }));
      feedback.appendChild(nextBtn);
      nextBtn.focus();
    });

    host.appendChild(overlay);
    document.addEventListener("keydown", onKey, true);
    // Tangenttryck i modalen ska INTE nå motorns window-lyssnare (den preventDefault:ar
    // piltangenter/WASD → skulle blockera markörflytt i svarsfältet). Escape hanteras
    // ovan i capture-fas (som fortfarande hinner före), så det påverkas inte.
    overlay.addEventListener("keydown", (e) => e.stopPropagation(), false);

    overlay.querySelector("#adv-gen-close").addEventListener("click", () =>
      close({ correct: false, cancelled: true })
    );

    input.focus();
  });
}
