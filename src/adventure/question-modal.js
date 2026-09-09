// ============================================================================
// Pluggportalen – äventyrsmotorn: question-modal.js
// ----------------------------------------------------------------------------
// Frågemodalen som dyker upp OVANPÅ spelvärlden vid en station. Följer
// designsystemet: .cx-modal-overlay > .cx-modal på --z-modal (se styles.css),
// role="dialog" aria-modal="true" och en enkel fokusfälla (Tab cirkulerar inuti
// modalen) så tangentbord/skärmläsare inte hamnar bakom modalen. Själva frågan
// renderas med den DELADE renderQuestionCard() (game-questions.js) – ingen egen
// fråge-rendering här, så quiz/läsförståelse/par ser likadana ut som i vanliga
// lägen.
//
// openQuestionModal resolvar när eleven svarat OCH klickat "Fortsätt" (så man
// hinner se feedbacken), eller {cancelled:true} om man stänger utan att svara
// (motorn låter då stationen vara kvar – aldrig game over, alltid snällt).
// ============================================================================

import { el } from "../ui.js";
import { renderQuestionCard } from "../game-questions.js";

/** Enkel HTML-escape för lärar-inmatad titel/underrubrik. */
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
 * Öppna frågemodalen och lös svaret.
 * @param {object} o
 * @param {{question:string, explanation?:string, passage?:string,
 *          options: Array<{text:string, correct:boolean}>}} o.q  normaliserad fråga.
 * @param {boolean} [o.showPassage]  visa q.passage ovanför (läsförståelse).
 * @param {string} [o.title]   modalens rubrik (t.ex. temats stationPrompt).
 * @param {string} [o.emoji]   liten ikon i huvudet.
 * @param {HTMLElement} [o.host=document.body]  var overlayen läggs.
 * @returns {Promise<{correct:boolean, cancelled?:boolean}>}
 */
export function openQuestionModal({ q, showPassage = false, title = "Fråga", emoji = "❓", host = document.body }) {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement;

    const overlay = el(`<div class="cx-modal-overlay adv-q-overlay">
      <div class="cx-modal adv-q-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <button class="cx-modal-close" id="adv-q-close" title="Stäng" aria-label="Stäng">✕</button>
        <div class="cx-modal-head">
          <span class="cx-modal-avatar" aria-hidden="true">${emoji}</span>
          <div><h2 class="cx-modal-name">${esc(title)}</h2></div>
        </div>
        <div class="adv-q-body"></div>
      </div>
    </div>`);

    const modal = overlay.querySelector(".adv-q-modal");
    const body = overlay.querySelector(".adv-q-body");
    let done = false;

    function close(result) {
      if (done) return;
      done = true;
      document.removeEventListener("keydown", onKey, true);
      overlay.remove();
      // Återställ fokus dit det var (spelvärlden) så tangentstyrningen funkar igen.
      if (prevFocus && prevFocus.focus) {
        try { prevFocus.focus(); } catch {}
      }
      resolve(result);
    }

    // Fokusfälla + Escape. Capture-fas så vi hinner före ev. annat.
    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
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

    const card = renderQuestionCard({
      q,
      showPassage,
      onAnswer: () => "Fortsätt →", // en fråga i taget → alltid "fortsätt"
      onNext: () => {
        // correct avgörs av vilket alternativ som var rätt bland de valda – vi
        // läser av vilken knapp eleven markerade (chosen-correct = rätt svar).
        const gotItRight = !!card.querySelector(".quiz-opt.chosen-correct");
        close({ correct: gotItRight });
      },
    });
    body.replaceChildren(card);

    host.appendChild(overlay);
    document.addEventListener("keydown", onKey, true);

    overlay.querySelector("#adv-q-close").addEventListener("click", () =>
      close({ correct: false, cancelled: true })
    );

    // Flytta fokus in i modalen (första svarsknappen) så tangentbord funkar direkt.
    const firstOpt = modal.querySelector(".quiz-opt") || modal.querySelector("#adv-q-close");
    if (firstOpt) firstOpt.focus();
  });
}
