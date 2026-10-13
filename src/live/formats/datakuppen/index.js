// ============================================================================
// Live-format `datakuppen` – Datakuppen 💾 (#652, epic Datakuppen)
// ----------------------------------------------------------------------------
// Varje elev svarar i egen takt under speltiden (pacing "tid", kärnans
// matchklocka), inom klassen. Rätt svar → tre dolda filer; data, brandvägg,
// virus eller Hack (knäck en klasskamrats kod). Mest data vinner. SERVERN
// avgör all data och alla koder (functions/datakuppen-core.js) – se
// datakuppen-core.js för datamodellen och ./delat/ för filerna, koderna och
// reglerna. Spec: docs/UTVECKLINGSUPPDRAG_DATAKUPPEN.md.
//
// Utöver format-interfacet (live-formats.js), som Guldrushen:
//   prepareCreate  quiz: dkPublic/questions (utan facit) + dkPrivate/snapshot
//                  (facit, bara lärare/servern) i SAMMA batch som sessionen.
//   timelineQuestions   true – "Ta med tidslinjefrågor"
//   privateDocs    dkPrivate + dkPublic – raderas med en lobby
//   resultInputs(s) → { dkPlayers, answers, questions }
//
// Lärarens inställningar (§3): innehåll + svarssätt (kärnan), speltid
// (snabbknappar 3–30 + egen tid 1–60), Hackning på/av, namn i flödet,
// Pluggmynt (live-rewards), 1–3 klasser.
// Vyerna byggs i epicens nästa delar: elevvyn (datakuppen-student.js),
// projektorn (datakuppen-projector.js, #654: Nätverket + Statistik, lobby,
// pallplats), historiken (datakuppen-history.js). Bakgrundsmusik (#654):
// `music` → assets/hackerlaget-dark-loop.ogg, spelas av projektorskalet
// (proj-music.js) – bara projektorn och elevskärmsfönstret, aldrig elevdatorn.
//
// API: export default DATAKUPPEN (format-objekt, oregistrerat).
// ============================================================================

import { answerKindsFor } from "../../live-formats.js";
import {
  DK_MIN_CLASSES, DK_MAX_CLASSES, DK_MODES, DK_PRIVATE_DOC, DK_PUBLIC_DOC,
  durationField, validateSetup, buildSessionFields, sessionTitle, defaultSessionName,
  buildQuizPool, computeStandings, buildResult,
} from "./datakuppen-core.js";
import { rewardsSetupField, validateRewards, rewardSessionFields } from "../../live-rewards.js";

const DATAKUPPEN = {
  id: "datakuppen",
  displayName: "Datakuppen",
  icon: "💾",
  description: "Samla data, öppna filer, knäck varandras koder.",
  scope: "inom-klass",
  minClasses: DK_MIN_CLASSES,
  maxClasses: DK_MAX_CLASSES,
  answerKinds: ["free", "choice"],
  pacing: "tid",
  minQuestions: 5,
  timelineQuestions: true,
  privateDocs: [DK_PRIVATE_DOC, DK_PUBLIC_DOC],
  // Som Guldrushen: tyst lobby, matchen ≈ 30 % av effekternas volym.
  music: { src: new URL("./assets/hackerlaget-dark-loop.ogg", import.meta.url).href, level: 0.3, lobby: 0 },

  setupFields: [
    durationField(),
    {
      key: "hacking", kind: "toggle", label: "Hackning", default: true,
      hint: "av = bara datafiler – en snällare variant",
    },
    { key: "showNames", kind: "toggle", label: "Visa namn i händelseflödet på projektorn", default: true },
    rewardsSetupField(),
  ],

  compatibleGameModes(mode) {
    return DK_MODES.includes(mode?.id) && answerKindsFor(DATAKUPPEN, mode).length > 0;
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
    const opts = { showPassage: data.quiz.showPassage === true };
    if (data.quiz.timeline === true && Array.isArray(area?.timeline) && area.timeline.length) {
      Object.assign(opts, { timeline: area.timeline, timelineSpan: area.timelineSpan || null });
    }
    const pool = buildQuizPool(mode, area?.quiz || [], buildQuizSnapshot, ctx.rng, opts);
    if (!pool.questions.length) throw new Error("Det finns inga frågor att spela.");
    return {
      data: { questionCount: pool.questions.length },
      subdocs: [
        { path: DK_PUBLIC_DOC, data: { questions: pool.questions } },
        { path: DK_PRIVATE_DOC, data: { facit: pool.facit } },
      ],
    };
  },

  async resultInputs(s) {
    const { getDkPlayers, getAnswers, getQuestions } = await import("./datakuppen-data.js");
    const [dkPlayers, answers, questions] = await Promise.all([
      getDkPlayers(s.id),
      getAnswers(s.id).catch(() => null),
      s.gameMode === "plugga_quiz" ? getQuestions(s.id).catch(() => null) : null,
    ]);
    return { dkPlayers, answers, questions };
  },

  emitOnPlayers: true,
  projectorViews: () => import("./datakuppen-projector.js"),
  studentView: () => import("./datakuppen-student.js"),
  historyRenderer: () => import("./datakuppen-history.js"),
};

export default DATAKUPPEN;
