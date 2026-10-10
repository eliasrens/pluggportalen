// ============================================================================
// Live-format `guldrush` – Guldrushen 💰 (#563, epic #562)
// ----------------------------------------------------------------------------
// Varje elev svarar i egen takt under speltiden (pacing "tid", kärnans
// matchklocka). Rätt svar → tre kistor; guld, stöld, byte, sköld … Mest guld
// vinner. SERVERN avgör allt guld (functions/guldrush-core.js) – se
// guldrush-core.js för datamodellen och ./delat/ för kistorna + reglerna.
//
// Utöver format-interfacet (live-formats.js):
//   prepareCreate(input, data, { rng?, getArea? }) → { data, subdocs }
//     quiz: frågorna som ögonblicksbild – grPublic/questions (elevsynligt,
//     utan facit) + grPrivate/snapshot (facit, bara lärare/servern) i SAMMA
//     batch som sessionen; questionCount = antal frågor. Multiplikation:
//     inget att kopiera (servern räknar om facit).
//   privateDocs   grPrivate + grPublic – raderas med en lobby
//   resultInputs(s) → { grPlayers, answers, questions } – guldet + svaren
//     (statistik per fråga, #566) till buildResult
//
// Pluggmynt efter matchen (#557): gemensamma live-rewards.js.
// Elevvyn (#564): guldrush-student.js – egen spelyta (createStage) med
// kistor, offerväljare och stöldnotis. Projektorvyerna (#565):
// guldrush-projector.js – Skattkammaren + Statistik, lobby, pallplats.
// Historiken + Statistik → Live (#566): guldrush-history.js. Demoläget:
// gr-demo.js (preview-guldrush-demo.html).
//
// API: export default GULDRUSH (format-objekt, oregistrerat).
// ============================================================================

import { answerKindsFor } from "../../live-formats.js";
import {
  GR_MIN_CLASSES, GR_MAX_CLASSES, GR_MODES, GR_PRIVATE_DOC, GR_PUBLIC_DOC,
  durationField, validateSetup, buildSessionFields, sessionTitle, defaultSessionName,
  buildQuizPool, computeStandings, buildResult,
} from "./guldrush-core.js";
import { rewardsSetupField, validateRewards, rewardSessionFields } from "../../live-rewards.js";

const GULDRUSH = {
  id: "guldrush",
  displayName: "Guldrushen",
  icon: "💰",
  description: "Samla guld, öppna kistor, stjäl från varandra.",
  scope: "inom-klass",
  minClasses: GR_MIN_CLASSES,
  maxClasses: GR_MAX_CLASSES,
  answerKinds: ["free", "choice"],
  pacing: "tid",
  minQuestions: 5,
  privateDocs: [GR_PRIVATE_DOC, GR_PUBLIC_DOC],

  setupFields: [
    durationField(),
    {
      key: "stealSwap", kind: "toggle", label: "Stöld och byte", default: true,
      hint: "av = bara guld i kistorna – en snällare variant",
    },
    { key: "showNames", kind: "toggle", label: "Visa namn i händelseflödet på projektorn", default: true },
    rewardsSetupField(),
  ],

  compatibleGameModes(mode) {
    return GR_MODES.includes(mode?.id) && answerKindsFor(GULDRUSH, mode).length > 0;
  },

  validateSetup: (input) => [...validateSetup(input), ...validateRewards(input?.rewards)],
  buildSessionFields: (input) => ({ ...buildSessionFields(input), ...rewardSessionFields(input?.rewards) }),
  sessionTitle,
  defaultSessionName,
  computeStandings,
  buildResult,

  async prepareCreate(input, data, ctx = {}) {
    if (data.gameMode !== "plugga_quiz") return { data: {}, subdocs: [] };
    const { getGameMode } = await import("../../game-modes.js");
    const mode = getGameMode(data.gameMode);
    if (!mode) throw new Error(`Okänt spelläge: ${data.gameMode}`);
    const getArea = ctx.getArea || (await import("../../../data-content.js")).getArea;
    const area = await getArea(data.quiz.subjectId, data.quiz.areaId);
    const { buildQuizSnapshot } = await import("../../modes/plugga-quiz-core.js");
    const pool = buildQuizPool(mode, area?.quiz || [], buildQuizSnapshot, ctx.rng);
    if (!pool.questions.length) throw new Error("Det finns inga frågor att spela.");
    return {
      data: { questionCount: pool.questions.length },
      subdocs: [
        { path: GR_PUBLIC_DOC, data: { questions: pool.questions } },
        { path: GR_PRIVATE_DOC, data: { facit: pool.facit } },
      ],
    };
  },

  async resultInputs(s) {
    const { getGrPlayers, getAnswers, getQuestions } = await import("./guldrush-data.js");
    // Svaren → andel rätt per fråga/tabell (#566). Läses EN gång vid slut;
    // misslyckas läsningen blir det ett result utan perQuestion (som förut).
    const [grPlayers, answers, questions] = await Promise.all([
      getGrPlayers(s.id),
      getAnswers(s.id).catch(() => null),
      s.gameMode === "plugga_quiz" ? getQuestions(s.id).catch(() => null) : null,
    ]);
    return { grPlayers, answers, questions };
  },

  // Skattkammaren (#565): Skattkammaren + Statistik, lobby, pallplats.
  projectorViews: () => import("./guldrush-projector.js"),
  // Varje spelarändring (anslutning, puls) → nytt tillstånd: lobbyns
  // skattjägare studsar in direkt, sena elever syns i ställningen.
  emitOnPlayers: true,
  studentView: () => import("./guldrush-student.js"),
  historyRenderer: () => import("./guldrush-history.js"),
};

export default GULDRUSH;
