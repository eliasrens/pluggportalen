// ============================================================================
// Pluggportalen – games-quiz.js
// De frågebaserade gamemoderna:
//   • Quiz          – flervalsfrågor med direkt feedback, resultat i slutet
//   • Läsförståelse – faktatext(erna) står kvar överst medan eleven svarar på
//                     frågorna direkt under, på samma scrollbara sida.
// Frågemotorn (runQuestions) och resultatskärmen ligger i game-shared.js.
// ============================================================================

import { app, el } from "./ui.js";
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

  // Faktatexten/faktatexterna renderas ÖVERST och står kvar hela tiden, så
  // eleven kan läsa och svara samtidigt. Frågorna körs i en egen ruta direkt
  // under texten (samma scrollbara sida) – ingen tvingande overlay.
  const textsHtml = texts
    .map(
      (t) => `<article class="read-text">
        ${t.title ? `<h3>${t.title}</h3>` : ""}
        <p>${t.body}</p>
      </article>`
    )
    .join("");

  const layout = el(`<div class="lasf-layout">
    <section class="lasf-text">
      <p class="hint lasf-intro">Läs texten och svara på frågorna under. Texten stannar kvar – titta tillbaka så ofta du vill. 📖</p>
      ${textsHtml || '<p class="hint">Ingen text för det här området ännu.</p>'}
    </section>
    <div class="lasf-quiz" id="lasf-quiz"></div>
  </div>`);
  body.replaceChildren(layout);

  const quizArea = layout.querySelector("#lasf-quiz");

  runQuestions({
    body: quizArea,
    questions,
    onFinish: (correct, total) => {
      const stars = starsFromRatio(correct / total);
      const baseCoins = 6 + correct * 2 + (correct === total ? 4 : 0);
      // Resultatskärmen ersätter hela sidan (text + frågor).
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
