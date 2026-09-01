// ============================================================================
// Pluggportalen – games-quiz.js
// De frågebaserade gamemoderna:
//   • Quiz          – flervalsfrågor med direkt feedback, resultat i slutet
//   • Läsförståelse – läs faktatext(er) och svara sedan på frågor; texten går
//                     att titta tillbaka på under tiden.
// Frågemotorn (runQuestions) och resultatskärmen ligger i game-shared.js.
// ============================================================================

import { app, el } from "./ui.js";
import { sound } from "./fx.js";
import {
  gameFrame,
  runQuestions,
  showResult,
  starsFromRatio,
} from "./game-shared.js";

// --- Quiz -------------------------------------------------------------------

export function startQuiz(ctx) {
  const { subj, area, areaData } = ctx;
  const questions = areaData.quiz || [];
  const view = gameFrame({ subj, area, title: "Quiz", emoji: "❓" });
  const body = view.querySelector("#game-body");
  app.replaceChildren(view);

  runQuestions({
    body,
    questions,
    onFinish: (correct, total) => {
      const stars = starsFromRatio(correct / total);
      const baseCoins = 5 + correct * 2 + (correct === total ? 5 : 0);
      showResult({
        container: body,
        subj, area, mode: "quiz",
        stars,
        scoreLine: `Du hade ${correct} av ${total} rätt.`,
        baseCoins,
        bestScore: correct,
        replay: () => startQuiz(ctx),
      });
    },
  });
}

// --- Läsförståelse ----------------------------------------------------------

export function startLasforstaelse(ctx) {
  const { subj, area, areaData } = ctx;
  const texts = areaData.texts || [];
  const questions = areaData.quiz || [];

  const view = gameFrame({ subj, area, title: "Läsförståelse", emoji: "📖" });
  const body = view.querySelector("#game-body");
  app.replaceChildren(view);

  // --- Läsfas: visa faktatexterna ---
  function renderReading() {
    const textsHtml = texts
      .map(
        (t) => `<article class="read-text">
          <h3>${t.title}</h3>
          <p>${t.body}</p>
        </article>`
      )
      .join("");
    const wrap = el(`<div>
      <p class="hint center">Läs texten noga. Sedan får du svara på frågor – du kan titta tillbaka på texten när du vill. 📖</p>
      ${textsHtml || '<p class="hint">Ingen text för det här området ännu.</p>'}
      <button class="btn stor gron" id="start-q">Jag har läst – starta frågorna!</button>
    </div>`);
    wrap.querySelector("#start-q").addEventListener("click", () => {
      sound.click();
      renderQuiz();
    });
    body.replaceChildren(wrap);
  }

  // Knapp + overlay för att "titta tillbaka" på texten under frågorna.
  function reviewButton() {
    const b = el(`<button class="btn ghost liten review-btn">📖 Visa texten</button>`);
    b.addEventListener("click", openTextOverlay);
    return b;
  }

  function openTextOverlay() {
    const textsHtml = texts
      .map((t) => `<article class="read-text"><h3>${t.title}</h3><p>${t.body}</p></article>`)
      .join("");
    const overlay = el(`<div class="overlay">
      <div class="overlay-card">
        <div class="overlay-head">
          <h2>Texten 📖</h2>
          <button class="btn liten" id="close">Stäng</button>
        </div>
        <div class="overlay-body">${textsHtml}</div>
      </div>
    </div>`);
    const close = () => overlay.remove();
    overlay.querySelector("#close").addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    document.body.appendChild(overlay);
  }

  function renderQuiz() {
    runQuestions({
      body,
      questions,
      reviewButton,
      onFinish: (correct, total) => {
        const stars = starsFromRatio(correct / total);
        const baseCoins = 6 + correct * 2 + (correct === total ? 4 : 0);
        showResult({
          container: body,
          subj, area, mode: "lasforstaelse",
          stars,
          scoreLine: `Du hade ${correct} av ${total} rätt.`,
          baseCoins,
          bestScore: correct,
          replay: () => startLasforstaelse(ctx),
        });
      },
    });
  }

  renderReading();
}
