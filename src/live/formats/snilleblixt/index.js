// ============================================================================
// Live-format `snilleblixt` – Snilleblixten ⚡ (#556, epic #555)
// ----------------------------------------------------------------------------
// Hela klassen (1–3 klasser, alla tävlar individuellt) får SAMMA fråga
// samtidigt; läraren går vidare fråga för fråga (pacing "lärarstyrd"). Rätt
// och snabbt ger mest poäng (500–1000, ur serverstämplar). Datamodell, poäng
// och faser: snilleblixt-core.js / -poang.js / -flode.js; Firestore:
// snilleblixt-data.js (LAT); regler: firestore.rules "Snilleblixten".
//
// Utöver format-interfacet (live-formats.js):
//   prepareCreate(input, data, { rng?, getArea? }) → Promise<{ data, subdocs }>
//     live-data createLiveSession kör den före skapandet: frågorna kopieras
//     som ögonblicksbild till sbPrivate/snapshot (lärarskyddat, samma batch
//     som sessionen) och questionCount = ögonblicksbildens längd.
//   privateDocs         [["sbPrivate","snapshot"]] – raderas med en lobby
//   resultInputs(s)     → Promise<{ scores }> – buildResult behöver sbScores
//                         (live-feed / historiken hämtar dem före buildResult)
//
// Vyerna byggs i egna issues: studentView #558, projectorViews #559,
// historyRenderer #560 (här en enkel topplista tills dess).
//
// API: export default SNILLEBLIXT (format-objekt, oregistrerat).
// ============================================================================

import { answerKindsFor } from "../../live-formats.js";
import {
  SB_MIN_CLASSES, SB_MAX_CLASSES, SB_QUESTION_SECONDS, SB_DEFAULT_SECONDS, SB_PRIVATE_DOC,
  buildSnapshot, validateSetup, buildSessionFields, sessionTitle, defaultSessionName,
} from "./snilleblixt-core.js";
import { computeStandings, buildResult } from "./snilleblixt-poang.js";

const notYet = (what, issue) => () => Promise.reject(new Error(`Snilleblixtens ${what} är inte byggd än (#${issue})`));

const SNILLEBLIXT = {
  id: "snilleblixt",
  displayName: "Snilleblixten",
  icon: "⚡",
  description: "Hela klassen, samma fråga – snabbast rätt vinner.",
  scope: "inom-klass",
  minClasses: SB_MIN_CLASSES,
  maxClasses: SB_MAX_CLASSES,
  answerKinds: ["free", "choice"],
  pacing: "lärarstyrd",
  minQuestions: 5,
  privateDocs: [SB_PRIVATE_DOC],

  setupFields: [
    {
      key: "questionCount", kind: "choice", label: "Antal frågor", default: 10,
      hint: "\"Alla\" = alla frågor i quiz-området",
      options: [5, 10, 15, 20].map((n) => ({ value: n, label: String(n) })).concat({ value: 0, label: "Alla" }),
    },
    {
      key: "questionSeconds", kind: "choice", label: "Tid per fråga", default: SB_DEFAULT_SECONDS.free,
      hint: "skriv själv tar längre tid än att klicka",
      defaultByAnswerKind: SB_DEFAULT_SECONDS,
      options: SB_QUESTION_SECONDS.map((s) => ({ value: s, label: `${s} s` })),
    },
    { key: "shuffleQuestions", kind: "toggle", label: "Slumpa frågeordningen", default: true },
    {
      key: "showQuestionOnStudent", kind: "toggle", label: "Visa frågan på elevernas skärmar", default: true,
      hint: "av = eleverna ser bara svarsknapparna/svarsfältet",
    },
  ],

  compatibleGameModes(mode) {
    return answerKindsFor(SNILLEBLIXT, mode).length > 0;
  },

  validateSetup,
  buildSessionFields,
  sessionTitle,
  defaultSessionName,
  computeStandings,
  buildResult,

  async prepareCreate(input, data, ctx = {}) {
    const { getGameMode } = await import("../../game-modes.js");
    const mode = getGameMode(data.gameMode);
    if (!mode) throw new Error(`Okänt spelläge: ${data.gameMode}`);
    const opts = { answerKind: data.answerKind, count: data.questionCount, shuffle: data.shuffleQuestions, rng: ctx.rng };
    if (mode.id === "plugga_quiz") {
      const getArea = ctx.getArea || (await import("../../../data-content.js")).getArea;
      const area = await getArea(data.quiz.subjectId, data.quiz.areaId);
      opts.quiz = area?.quiz || [];
      opts.quizSnapshot = (await import("../../modes/plugga-quiz-core.js")).buildQuizSnapshot;
    }
    const snap = buildSnapshot(mode, opts);
    if (!snap.questions.length) throw new Error("Det finns inga frågor att spela.");
    return {
      data: { questionCount: snap.questions.length },
      subdocs: [{ path: SB_PRIVATE_DOC, data: snap }],
    };
  },

  async resultInputs(s) {
    const { getScores } = await import("./snilleblixt-data.js");
    return { scores: await getScores(s.id) };
  },

  projectorViews: notYet("projektorvy", 559),
  studentView: notYet("elevvy", 558),
  historyRenderer: () => import("./snilleblixt-history.js"),
};

export default SNILLEBLIXT;
