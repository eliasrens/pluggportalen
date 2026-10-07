// ============================================================================
// Pluggporten – lärarsidan: delade stjärn-/områdeshjälpare (teacher-class-stats.js)
// ----------------------------------------------------------------------------
// Rena hjälpfunktioner för att härleda stjärnstatistik ur en elevs progress.
// Delas mellan klassmatrisen (teacher-class.js) och per-elev-fördjupningen
// (teacher-class-detail.js). Läs-endast, ingen Firestore här.
//
// Progress-formen (se data.js):
//   progress[areaId][gamemode] = { completed, bestScore, stars, lastPlayed }
// Max 3 stjärnor per gamemode. Ett områdes möjliga stjärnor = områdets
// STJÄRN-lägen × 3, där stjärn-lägena är EN gemensam definition (#467):
// areaStarModes i gamemode-visibility.js (underlag + äventyr, utan Memory,
// klassens synlighet invägd). Intjänat räknas över SAMMA lägen → aldrig > möjligt.
// ============================================================================

import { areaStarModes } from "./gamemode-visibility.js";

export const MAX_STARS_PER_MODE = 3;

/** Områdets stjärn-lägen (areaStarModes) – klassen väger in dolda lägen. */
export function areaModes(area, cls = null) {
  return areaStarModes(area, cls);
}

/** Antal möjliga stjärnor för ett område = stjärn-lägen × 3. */
export function areaMaxStars(area, cls = null) {
  return areaModes(area, cls).length * MAX_STARS_PER_MODE;
}

/**
 * Sammanställ en elevs progress för ett område ur progress-objektet.
 * `played`/`completed` räknar alla spelade lägen; `stars` bara stjärn-lägena
 * när `starModeIds` ges (annars alla – bakåtkompatibelt).
 * @param {object} progress
 * @param {string} areaId
 * @param {string[]} [starModeIds]  t.ex. areaModes(area, cls).map((m) => m.id)
 */
export function areaEarned(progress, areaId, starModeIds) {
  const modes = (progress && progress[areaId]) || {};
  const counts = Array.isArray(starModeIds) ? new Set(starModeIds) : null;
  let stars = 0;
  let completed = 0;
  let played = 0;
  for (const [mode, result] of Object.entries(modes)) {
    if (!result) continue;
    played++;
    if (typeof result.stars === "number" && result.stars > 0 && (!counts || counts.has(mode))) {
      stars += Math.min(MAX_STARS_PER_MODE, result.stars);
    }
    if (result.completed) completed++;
  }
  return { stars, completed, played };
}

/**
 * Stjärn-urvalet för flera områden (Per område/djupdykningen, #467): summan av
 * möjliga stjärnor + ett filter för summarizeClass({ isStarMode }) så intjänat
 * räknas över exakt samma lägen som möjligt.
 * @param {object[]} areas
 * @param {object|null} [cls]
 * @returns {{maxStars:number, isStarMode:(areaId:string, mode:string)=>boolean}}
 */
export function starScope(areas, cls = null) {
  const byArea = new Map((areas || []).map((a) => [a.id, new Set(areaModes(a, cls).map((m) => m.id))]));
  let maxStars = 0;
  for (const ids of byArea.values()) maxStars += ids.size * MAX_STARS_PER_MODE;
  return { maxStars, isStarMode: (areaId, mode) => !!byArea.get(areaId)?.has(mode) };
}

/** Progress-klass (färg) utifrån andel intjänade stjärnor. */
export function progressLevel(ratio) {
  if (ratio >= 0.67) return "hog";
  if (ratio >= 0.34) return "mellan";
  if (ratio > 0) return "lag";
  return "tom";
}
