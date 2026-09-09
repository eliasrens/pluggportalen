// ============================================================================
// Pluggportalen – lärarsidan: delade stjärn-/områdeshjälpare (teacher-class-stats.js)
// ----------------------------------------------------------------------------
// Rena hjälpfunktioner för att härleda stjärnstatistik ur en elevs progress.
// Delas mellan klassmatrisen (teacher-class.js) och per-elev-fördjupningen
// (teacher-class-detail.js). Läs-endast, ingen Firestore här.
//
// Progress-formen (se data.js):
//   progress[areaId][gamemode] = { completed, bestScore, stars, lastPlayed }
// Max 3 stjärnor per gamemode. Ett områdes möjliga stjärnor =
//   antal tillgängliga gamemodes (utifrån quiz/pairs-innehåll) × 3.
// ============================================================================

import { GAMEMODES } from "./game-shared.js";

export const MAX_STARS_PER_MODE = 3;

/** Tillgängliga gamemodes för ett område (utifrån quiz/pairs-innehåll). */
export function areaModes(area) {
  const hasQuiz = Array.isArray(area.quiz) && area.quiz.length > 0;
  const hasPairs = Array.isArray(area.pairs) && area.pairs.length > 0;
  return GAMEMODES.filter(
    (gm) => (gm.needs === "quiz" && hasQuiz) || (gm.needs === "pairs" && hasPairs)
  );
}

/** Antal möjliga stjärnor för ett område = tillgängliga gamemodes × 3. */
export function areaMaxStars(area) {
  return areaModes(area).length * MAX_STARS_PER_MODE;
}

/** Sammanställ en elevs progress för ett område ur progress-objektet. */
export function areaEarned(progress, areaId) {
  const modes = (progress && progress[areaId]) || {};
  let stars = 0;
  let completed = 0;
  let played = 0;
  for (const result of Object.values(modes)) {
    if (!result) continue;
    played++;
    if (typeof result.stars === "number") stars += Math.min(MAX_STARS_PER_MODE, result.stars);
    if (result.completed) completed++;
  }
  return { stars, completed, played };
}

/** Progress-klass (färg) utifrån andel intjänade stjärnor. */
export function progressLevel(ratio) {
  if (ratio >= 0.67) return "hog";
  if (ratio >= 0.34) return "mellan";
  if (ratio > 0) return "lag";
  return "tom";
}
