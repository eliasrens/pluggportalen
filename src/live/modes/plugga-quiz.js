// ============================================================================
// Live-spelläge `plugga_quiz` – Quiz från Plugga (#553, epic #550)
// ----------------------------------------------------------------------------
// Tunt GameMode-skal (src/live/game-modes.js) runt plugga-quiz-core.js.
// Läraren väljer ämne + arbetsområde (setupFields → plugga-quiz-picker.js,
// laddas latt) och ser hur många frågor som kan spelas innan Skapa.
//
// BARA FLERVAL: answerKinds ["choice"] – ett quizsvar är ett av alternativen.
// Ett format med båda svarssätten visar därför inget val (svarssättet blir
// "choice"), och ett format med bara skriv själv (Klassmatchen) erbjuder
// inte läget alls (compatibleGameModes = inget gemensamt svarssätt). Det är
// också facit-skyddet: Klassmatchens elever kör frågeströmmen själva och
// skulle behöva facit i klienten – quiz erbjuds inte där.
//
// FRÅGORNA kommer INTE ur createSource() på egen hand: formatet tar en
// ögonblicksbild när sessionen skapas (buildQuizSnapshot – elevsynliga
// questions + facit åtskilda, §4.4) och skickar in dem:
//   createSource({ questions, facit?, rng?, shuffle? })
//     questions  elevsynliga frågor (snapshot.questions)
//     facit      VALFRI – samma längd; med facit kan checkAnswer rätta i
//                klienten (lärare/projektor, eller ett format som medvetet
//                ger eleven facit). Utan facit är result.correct null.
//     shuffle    true (default) = ny ordning varje varv (Guldrushen: egen
//                takt, frågorna tar aldrig slut); false = snapshotens ordning
//                (Snilleblixten: hela klassen samma fråga).
//   choices(q)  → { options, answerIndex } – alternativen är redan blandade i
//                snapshoten (samma färg för samma svar på projektor och elev);
//                answerIndex null utan facit.
//   answerRecord → { questionId, answer } (valt alternativs text). Kärnan
//                lägger till answerKind "choice" + choiceIndex. ⚠️ firestore.rules
//                har ännu INGEN gren för plugga_quiz: svar nekas tills
//                formatet (Snilleblixten/Guldrushen) lägger regeln som rättar
//                mot sitt lärarskyddade facit med get().
//   statKeys(q) → [kategori|"ovrig", "q:<id>"] – per kategori (statCategories)
//                och per fråga (etikett = frågans text i snapshoten).
//
// API: export default PLUGGA_QUIZ (GameMode-objekt, oregistrerat).
// ============================================================================

import {
  QUIZ_PASSAGE_POLICY, QUIZ_OTHER_CATEGORY, joinFacit, checkQuizAnswer, quizStatKeys, shuffled,
} from "./plugga-quiz-core.js";
import { QUESTION_CATEGORIES } from "../../question-categories.js";

export const QUIZ_AREA_FIELD = "quizArea";

const PLUGGA_QUIZ = {
  id: "plugga_quiz",
  displayName: "Quiz från Plugga",
  icon: "📚",
  description: "Quizfrågorna i ett arbetsområde – fyra alternativ, välj rätt.",
  inputMode: "text",
  pointsPerCorrect: 1,
  answerKinds: ["choice"],
  passagePolicy: QUIZ_PASSAGE_POLICY,

  setupFields: [
    {
      key: QUIZ_AREA_FIELD,
      label: "Ämne och arbetsområde",
      kind: "custom",
      load: () => import("./plugga-quiz-picker.js"),
    },
  ],

  /** input.quizArea = väljarens value(): { subjectId, areaId, subjectName, areaName, usable } */
  validateSetup(input) {
    const a = input?.[QUIZ_AREA_FIELD];
    if (!a?.subjectId || !a?.areaId) return ["Välj ämne och arbetsområde för quizet."];
    if (!(Number(a.usable) > 0)) return ["Arbetsområdet har inga quizfrågor som passar i Live – välj ett annat."];
    return [];
  },

  buildSessionFields(input) {
    const a = input[QUIZ_AREA_FIELD];
    return {
      quiz: {
        subjectId: String(a.subjectId),
        areaId: String(a.areaId),
        subjectName: String(a.subjectName || a.subjectId),
        areaName: String(a.areaName || a.areaId),
        passagePolicy: QUIZ_PASSAGE_POLICY,
      },
    };
  },

  createSource(opts = {}) {
    const pub = Array.isArray(opts.questions) ? opts.questions : [];
    if (!pub.length) throw new Error("plugga_quiz: frågor saknas – formatet skickar sessionens ögonblicksbild");
    const facit = Array.isArray(opts.facit) ? opts.facit : null;
    const all = facit ? pub.map((q, i) => joinFacit(q, facit[i])) : pub.slice();
    const rng = opts.rng || Math.random;
    const mix = opts.shuffle !== false;
    let lap = [];
    let last = null;
    return {
      next() {
        if (!lap.length) {
          lap = mix ? shuffled(all, rng) : all.slice();
          // Samma fråga två gånger i rad över varvskarven känns som en bugg.
          if (mix && lap.length > 1 && lap[0] === last) lap.push(lap.shift());
        }
        last = lap.shift();
        return last;
      },
    };
  },

  checkAnswer(q, raw) {
    return checkQuizAnswer(q, raw);
  },

  choices(q) {
    return { options: q.options.slice(), answerIndex: Number.isInteger(q.answerIndex) ? q.answerIndex : null };
  },

  answerRecord(q, r) {
    return { questionId: q.id, answer: r.given };
  },

  statKeys(q) {
    return quizStatKeys(q);
  },

  statCategories: [
    ...QUESTION_CATEGORIES.map((c) => ({ key: c.key, label: c.label })),
    { key: QUIZ_OTHER_CATEGORY, label: "Utan kategori" },
  ],
};

export default PLUGGA_QUIZ;
