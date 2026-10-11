// ============================================================================
// Tidslinjefråga i Quiz (#599). Samma kontrakt som renderQuestionCard i
// src/game-questions.js – runQuestions sköter ordning, repetition, progress och
// resultat precis som för flervalsfrågor. Bara svarssättet skiljer: eleven drar
// på tidslinjen och låser ett år. Rätt = EXAKT år (ingen tolerans i Quiz).
// Laddas dynamiskt från games-quiz.js när området har area.timeline (#271).
// ============================================================================

import { sound } from "../fx.js";
import { mountTimelineAnswer } from "./timeline-answer.js";

export { planQuizTimeline, QUIZ_TIMELINE_ROTATION } from "./tidsjakt-core.js";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {object} o  som renderQuestionCard: q (kind "timeline", med span),
 *   progressHtml, reviewButton, onAnswer(correct) → knapptext, onNext,
 *   setCleanup(fn) – städning när kortet byts ut.
 */
export function renderTimelineCard({ q, progressHtml = "", reviewButton, onAnswer, onNext, setCleanup }) {
  const doc = document;
  const t = doc.createElement("template");
  t.innerHTML = `<div class="quiz-wrap quiz-tidslinje">
      ${progressHtml || ""}
      <div class="quiz-question">${esc(q.question)}</div>
      <div class="quiz-tl"></div>
      <div class="quiz-feedback" id="fb"></div>
      <div class="quiz-next" id="nextwrap"></div>
    </div>`;
  const wrap = t.content.firstElementChild;
  if (reviewButton) wrap.prepend(reviewButton());
  const fb = wrap.querySelector("#fb");
  const nextWrap = wrap.querySelector("#nextwrap");

  const handle = mountTimelineAnswer(wrap.querySelector(".quiz-tl"), {
    span: q.span,
    question: "",
    context: q.description || "",
    onLock(year) {
      const correct = year === q.year;
      handle.reveal(q.year);
      if (correct) {
        sound.correct();
        fb.innerHTML = `<div class="msg ok">Rätt! ✅ ${esc(q.explanation)}</div>`;
      } else {
        sound.wrong();
        fb.innerHTML = `<div class="msg soft">Inte riktigt – men bra försök! 💡 ${esc(q.explanation)}</div>`;
      }
      const label = onAnswer(correct);
      const next = doc.createElement("button");
      next.className = "btn gron";
      next.textContent = label;
      next.addEventListener("click", () => onNext());
      nextWrap.replaceChildren(next);
      next.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
      next.focus?.({ preventScroll: true });
    },
  });
  setCleanup?.(() => handle.destroy());
  return wrap;
}
