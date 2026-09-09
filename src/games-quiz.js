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
import * as data from "./data.js";
import {
  gameFrame,
  runQuestions,
  showResult,
  starsFromRatio,
  pickSessionQuestions,
} from "./game-shared.js";
import { buildReadingPool, readingLevelName } from "./reading-level.js";

// --- Quiz -------------------------------------------------------------------

export async function startQuiz(ctx) {
  const { subj, area, areaData } = ctx;
  // Ny session: servera max 10 OSEDDA frågor (roterande urval). Sparar vilka som
  // serverats så nästa session ger nya, tills varvet är klart → nollställs.
  const seen = await data.getQuestionRotation(area, "quiz");
  const { questions, seen: nextSeen } = pickSessionQuestions(areaData.quiz || [], seen);
  data.saveQuestionRotation(area, "quiz", nextSeen);
  const view = gameFrame({ subj, area, title: "Quiz", emoji: "❓" });
  const body = view.querySelector("#game-body");
  app.replaceChildren(view);

  runQuestions({
    body,
    questions,
    onFinish: (correct, total) => {
      const stars = starsFromRatio(correct / total);
      // Coins ~halverade jämfört med förr: dels via 20→10 frågor (correct*2 halveras),
      // dels genom en trimmad FAST del (5→3, allt-rätt-bonus 5→2). En perfekt
      // 10-frågors-runda ger 2*(3+20+2)=50 (var 100 vid 20 frågor). XP oförändrat.
      const baseCoins = 2 * (3 + correct * 2 + (correct === total ? 2 : 0));
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

export async function startLasforstaelse(ctx) {
  const { subj, area, areaData } = ctx;
  const allQuestions = areaData.quiz || [];

  // Per-elev läsnivå (#154): eleven får sin nivås texter/frågor. Läses ur
  // studentData; saknas den → mellannivå (default). En trasig läsning ska inte
  // fälla övningen, så vi faller tillbaka på default-nivån vid fel.
  let readingLevel;
  try {
    readingLevel = await data.getReadingLevel();
  } catch {
    readingLevel = undefined; // buildReadingPool/normalize → default (nivå 2)
  }

  const view = gameFrame({ subj, area, title: "Läsförståelse", emoji: "📖" });
  const body = view.querySelector("#game-body");
  app.replaceChildren(view);

  // Innehållskälla i prioritetsordning:
  //   1) readingTexts (läsförståelse 2.0, #152) – SAMMA tema i tre nivåer. Vi
  //      bygger poolen på ELEVENS nivå (#154): svagare läsare får nivå 1:s
  //      text/frågor, starkare nivå 3:s. Varje frågas passage = nivåns brödtext.
  //   2) gammalt quiz med passage per fråga (självbärande läsförståelse).
  //   3) rent quiz utan passager – snäll ledtext, sidan ser aldrig trasig ut.
  // runQuestions renderar q.passage när showPassage är satt. Quiz-läget är
  // oförändrat (skickar inte showPassage).
  const readingPool = buildReadingPool(areaData.readingTexts, readingLevel);
  const usesLevels = readingPool.length > 0;

  const withPassage = allQuestions.filter(
    (q) => q && typeof q.passage === "string" && q.passage.trim()
  );
  const anyPassage = withPassage.length > 0;
  // Ny session: servera max 10 OSEDDA frågor ur den valda poolen, roterande
  // urval spårat per (elev, område, läge). Nivåtexterna roteras per nivå så att
  // ett nivåbyte inte drar med sig den gamla nivåns "sedda"-lista.
  const pool = usesLevels ? readingPool : anyPassage ? withPassage : allQuestions;
  const rotKey = usesLevels ? `lasforstaelse:n${readingLevel || 2}` : "lasforstaelse";
  const seen = await data.getQuestionRotation(area, rotKey);
  const { questions, seen: nextSeen } = pickSessionQuestions(pool, seen);
  data.saveQuestionRotation(area, rotKey, nextSeen);
  const intro = usesLevels
    ? `Din läsnivå: <b>${readingLevelName(readingLevel)}</b>. Läs texten ovanför varje fråga och svara. 📖`
    : anyPassage
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
      // Coins ~halverade (samma princip som quiz): 20→10 frågor + trimmad fast del
      // (6→3, allt-rätt-bonus 4→2). Perfekt 10-frågors-runda ger 2*(3+20+2)=50.
      const baseCoins = 2 * (3 + correct * 2 + (correct === total ? 2 : 0));
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
