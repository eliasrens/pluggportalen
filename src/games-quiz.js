// ============================================================================
// Pluggportalen – games-quiz.js
// De frågebaserade gamemoderna:
//   • Quiz          – flervalsfrågor med direkt feedback, resultat i slutet
//   • Läsförståelse – varje fråga har en egen KORT text (passage) som visas
//                     ovanför just den frågan och byts när eleven går vidare
//                     (inte längre hela områdets text ovanför alla frågor).
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
  const allQuestions = areaData.quiz || [];

  const view = gameFrame({ subj, area, title: "Läsförståelse", emoji: "📖" });
  const body = view.querySelector("#game-body");
  app.replaceChildren(view);

  // Varje fråga bär en egen kort källtext (passage) som visas OVANFÖR just den
  // frågan – inte längre hela områdets texter ovanför alla frågor på en gång
  // (det blev rörigt). runQuestions renderar q.passage när showPassage är satt.
  //
  // Läsförståelse ska vara SJÄLVBÄRANDE: ingen fråga får visas utan sin källtext,
  // annars kan en fråga hänvisa till en text som inte syns ("enligt texten ...").
  // Nya övningar tvingas därför ha passage på ALLA frågor (se validate.js). Här
  // kör vi ändå bara de frågor som faktiskt har en passage, så även ev. gammal
  // data blir självbärande. Saknar HELA övningen passager (rent gammalt quiz)
  // faller vi tillbaka till alla frågor med en snäll ledtext, så sidan aldrig
  // ser trasig ut. Quiz-läget är oförändrat (skickar inte showPassage).
  const withPassage = allQuestions.filter(
    (q) => q && typeof q.passage === "string" && q.passage.trim()
  );
  const anyPassage = withPassage.length > 0;
  const questions = anyPassage ? withPassage : allQuestions;
  const intro = anyPassage
    ? "Läs den korta texten ovanför varje fråga och svara. Texten byts för varje ny fråga. 📖"
    : "Läs frågan noga och svara så gott du kan. 📖";

  const layout = el(`<div class="lasf-layout">
    <p class="hint lasf-intro">${intro}</p>
    <div class="lasf-quiz" id="lasf-quiz"></div>
  </div>`);
  body.replaceChildren(layout);

  const quizArea = layout.querySelector("#lasf-quiz");

  runQuestions({
    body: quizArea,
    questions,
    showPassage: true,
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
