// ============================================================================
// Pluggportalen – äventyrsmotorn: reward.js
// ----------------------------------------------------------------------------
// Banans slutbelöning går via den vanliga showResult()/awardExercise()-vägen
// (game-shared.js) så äventyret syns i statistiken och grind-skyddet fungerar
// automatiskt. BESLUT (epic-lead, åsidosätter #194:s ursprungstext): banor ger
// 1–3 STJÄRNOR (som quiz/läsförståelse/para) – INTE stjärnlöst. Belöningen är
// dock fortsatt GRIND-SKALAT (eget mode "aventyr:<tema>" som INTE ligger i
// FULL_REWARD_MODES), inte full pott varje gång. Fel svar under banan straffas
// aldrig (aldrig game over); de påverkar bara stjärnorna/baspotten.
//
// STJÄRNTRÖSKEL (utifrån antal felförsök under banan):
//   3★ = 0 fel (felfritt), 2★ = 1–2 fel, 1★ = 3+ fel.
// Samma stjärnväg som andra stjärngivande lägen: showResult räknar coins/XP och
// ritar stjärnraden (starRow) utifrån stars.
// ============================================================================

import { showResult } from "../game-shared.js";

/** 1–3 stjärnor ur antal felförsök (se tröskel i filhuvudet). */
export function starsFromMistakes(mistakes) {
  if (mistakes <= 0) return 3;
  if (mistakes <= 2) return 2;
  return 1;
}

/**
 * Dela ut äventyrets slutbelöning och visa firande-skärmen.
 * @param {object} o
 * @param {HTMLElement} o.container  där resultatkortet ritas (motorns mount)
 * @param {string} o.subj
 * @param {string} o.area
 * @param {object} o.theme          tema-config (för mode-id + namn)
 * @param {object} o.result         { stationsCleared, mistakes, elapsedMs, goal }
 * @param {() => void} o.replay     starta om banan
 */
export function awardAdventure({ container, subj, area, theme, result, replay }) {
  const goal = result.goal || result.stationsCleared || 1;
  const mistakes = result.mistakes || 0;
  const stars = starsFromMistakes(mistakes);
  // Baspott: en fast del per klarad kunskaps-station + en liten "få fel"-bonus.
  // Grind-trappan i awardExercise skalar sedan ner den vid omspel (mode ligger
  // inte i FULL_REWARD_MODES) – precis det #194 vill (grind-skalat, inte full pott).
  const baseCoins = 2 * (goal * 2 + Math.max(0, 6 - mistakes));

  const klart = theme?.texter?.klart || "Du klarade banan! 🎉";
  const scoreLine =
    mistakes === 0
      ? `${klart} Helt felfritt! 🎯`
      : `${klart} (${mistakes} felförsök på vägen – bra kämpat!)`;

  return showResult({
    container,
    subj,
    area,
    mode: `aventyr:${theme.id}`,
    stars,
    scoreLine,
    baseCoins,
    bestScore: goal,
    replay,
  });
}
