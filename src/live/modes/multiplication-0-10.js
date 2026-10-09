// ============================================================================
// Live-spelläge `multiplication_0_10` – Multiplikation 0–10, snabbmatch (#457)
// ----------------------------------------------------------------------------
// Tunt GameMode-skal (se src/live/game-modes.js) runt den GEMENSAMMA
// multiplikationsmotorn src/mult/generator.js – samma motor som Mattematchen.
//
// API: export default MULTIPLICATION_0_10 (GameMode-objekt, oregistrerat).
//   answerRecord → { factorA, factorB, answer, correctAnswer } – exakt de fält
//   firestore.rules validerar för detta mode (correctAnswer == a·b, isCorrect
//   == (answer == a·b), faktorer 0–10).
//   answerKinds ["free","choice"] (#552) – samma mode levererar båda
//   svarssätten. choices(q, rng?) → { options: number[4], answerIndex } med
//   rimliga felalternativ (multChoices i motorn). Ett valt alternativ rättas
//   med checkAnswer(q, String(options[i])) – samma rättning som Skriv själv.
// ============================================================================

import { createMultGenerator, checkMultAnswer, multChoices } from "../../mult/generator.js";

const MIN = 0;
const MAX = 10;

const MULTIPLICATION_0_10 = {
  id: "multiplication_0_10",
  displayName: "Multiplikation 0–10 – snabbmatch",
  icon: "✖️",
  description: "Tabellerna 0–10. Skriv svaret och tryck ENTER – så många rätt som möjligt.",
  inputMode: "numeric",
  pointsPerCorrect: 1,
  answerKinds: ["free", "choice"],

  createSource(opts = {}) {
    return createMultGenerator({ min: MIN, max: MAX, rng: opts.rng });
  },

  checkAnswer(q, raw) {
    return checkMultAnswer(q, raw);
  },

  choices(q, rng) {
    return multChoices(q, rng);
  },

  answerRecord(q, r) {
    return { factorA: q.a, factorB: q.b, answer: r.given, correctAnswer: q.answer };
  },

  statKeys(q) {
    return q.tables.map((t) => `t${t}`);
  },

  statCategories: Array.from({ length: MAX - MIN + 1 }, (_, i) => ({
    key: `t${MIN + i}`,
    label: `${MIN + i}:ans tabell`,
  })),
};

export default MULTIPLICATION_0_10;
