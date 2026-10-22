// ============================================================================
// Live-format `meteorstorm` – Meteorstormen ☄️ (epic #819)
// ----------------------------------------------------------------------------
// Klasser försvarar var sin rymdstation mot en förutbestämd meteorstorm; rätt
// svar ger energi till 🛡️ sköld, 🔫 laser eller 🌀 dragstråle. Motorn (A,
// #820) och servern (B, #821): docs/METEORSTORMEN.md.
//
// Formatobjektet byggs av två delar:
//   ms-format-elev.js  (D, #823) lärarformuläret, sessionen, quizets
//                      ögonblicksbild, resultatet/pluggmynten, elevskärmen,
//                      historiken
//   projektordelen     (C, #822) computeStandings, projectorViews, music …
//                      – tills C landar: en minimal ställning och en lat
//                      projektorvy (meteorstorm-projector.js)
// Registreras i src/live/formats/index.js (C).
//
// API: export default METEORSTORM (format-objekt, oregistrerat).
// ============================================================================

import { answerKindsFor } from "../../live-formats.js";
import { MS_ELEV_DELAR, MS_MODES, MS_MIN_CLASSES, MS_MAX_CLASSES } from "./ms-format-elev.js";

const METEORSTORM = {
  id: "meteorstorm",
  displayName: "Meteorstormen",
  icon: "☄️",
  description: "Försvara rymdstationen – sköld, laser och dragstråle.",
  scope: "inom-klass",
  minClasses: MS_MIN_CLASSES,
  maxClasses: MS_MAX_CLASSES,
  answerKinds: ["free", "choice"],
  pacing: "tid",

  ...MS_ELEV_DELAR,

  compatibleGameModes(mode) {
    return MS_MODES.includes(mode?.id) && answerKindsFor(METEORSTORM, mode).length > 0;
  },

  // Projektordelen (C, #822) ersätter de här två.
  computeStandings: (s) => ({ classes: (s?.participatingClassIds || []).map((classId) => ({ classId, name: s?.classNames?.[classId] || classId })), totalCorrect: 0, leaderIds: [], winnerId: null, draw: false }),
  projectorViews: () => import("./meteorstorm-projector.js"),
};

export default METEORSTORM;
