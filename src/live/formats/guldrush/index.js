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
//   resultInputs(s) → { grPlayers } – guldet till buildResult
//
// Pluggmynt efter matchen (#557): gemensamma live-rewards.js.
// Vyerna byggs i egna issues (elevvy, projektorvyer); historiken är en enkel
// version (guldrush-history.js).
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

const notYet = (what) => () => Promise.reject(new Error(`Guldrushens ${what} är inte byggd än (epic #562)`));

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
    const { getGrPlayers } = await import("./guldrush-data.js");
    return { grPlayers: await getGrPlayers(s.id) };
  },

  projectorViews: notYet("projektorvy"),
  studentView: notYet("elevvy"),
  historyRenderer: () => import("./guldrush-history.js"),
};

export default GULDRUSH;
