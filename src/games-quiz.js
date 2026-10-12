// ============================================================================
// Pluggporten – games-quiz.js
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
  plainQuizPool,
  hasPassage,
} from "./game-shared.js";

// --- Quiz -------------------------------------------------------------------

export async function startQuiz(ctx) {
  const { subj, area, areaData } = ctx;
  // Quiz visar ingen källtext → servera bara RÄKNE-/vanliga frågor (utan passage).
  // Läsförståelse-frågor (med passage) hålls isär och körs bara i Läsförståelse.
  const pool = plainQuizPool(areaData.quiz || []);
  // Ny session: servera max 10 OSEDDA frågor (roterande urval). Sparar vilka som
  // serverats så nästa session ger nya, tills varvet är klart → nollställs.
  // Tidslinjefrågor (#599): har området area.timeline blandas några in (samma
  // händelser som Tidsjakten, ingen kopia) och besvaras på tidslinjen. Dynamisk
  // import (#271) – ett område utan tidslinje kör exakt som förr.
  const tl = await quizTimeline(areaData, area, pool.length);
  const seen = await data.getQuestionRotation(area, "quiz");
  const { questions, seen: nextSeen } = pickSessionQuestions(pool, seen, tl?.plan.quizLimit);
  data.saveQuestionRotation(area, "quiz", nextSeen);
  const view = gameFrame({ subj, area, title: "Quiz", emoji: "❓" });
  const body = view.querySelector("#game-body");
  app.replaceChildren(view);

  runQuestions({
    body,
    questions: tl ? [...questions, ...tl.plan.timeline] : questions,
    renderTimeline: tl?.renderTimelineCard,
    onFinish: (correct, total, catStats) => {
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
        catStats,
        classResult: { ratt: correct, totalt: total },
        replay: () => startQuiz(ctx),
      });
    },
  });
}

/**
 * Tidslinjefrågorna till en quizomgång, eller null (inga händelser / modulen
 * gick inte att ladda → vanligt quiz). Roteras för sig, så quizets egen
 * frågerotation är orörd.
 */
async function quizTimeline(areaData, area, quizCount) {
  if (!Array.isArray(areaData.timeline) || areaData.timeline.length === 0) return null;
  try {
    const m = await import("./timeline/quiz-tidslinje.js");
    const seen = await data.getQuestionRotation(area, m.QUIZ_TIMELINE_ROTATION);
    const plan = m.planQuizTimeline(areaData, quizCount, seen);
    if (plan.timeline.length === 0) return null;
    data.saveQuestionRotation(area, m.QUIZ_TIMELINE_ROTATION, plan.seen);
    return { plan, renderTimelineCard: m.renderTimelineCard };
  } catch {
    return null;
  }
}

// --- Läsförståelse ----------------------------------------------------------

export async function startLasforstaelse(ctx) {
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
  const withPassage = allQuestions.filter(hasPassage);
  const anyPassage = withPassage.length > 0;
  // Ny session: servera max 10 OSEDDA frågor ur den valda poolen (passager om de
  // finns, annars alla), roterande urval spårat per (elev, område, läge).
  const pool = anyPassage ? withPassage : allQuestions;
  const seen = await data.getQuestionRotation(area, "lasforstaelse");
  const { questions, seen: nextSeen } = pickSessionQuestions(pool, seen);
  data.saveQuestionRotation(area, "lasforstaelse", nextSeen);
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
    onFinish: (correct, total, catStats) => {
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
        catStats,
        classResult: { ratt: correct, totalt: total },
        replay: () => startLasforstaelse(ctx),
      });
    },
  });
}
