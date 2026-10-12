// ============================================================================
// Ekvationsresan – stjärnor och feedback (src/ekvationsresan/resultat.js)
// ----------------------------------------------------------------------------
// #616, spec E1.7. Ren logik. Stjärnorna sätts av antal drag mot optimalt OCH
// högsta hjälpsteget (config.STARS); det lägsta vinner:
//
//   ⭐⭐⭐  löst, drag ≤ optimalt, ingen hjälp utöver steg 1
//   ⭐⭐    löst, drag ≤ optimalt + 2, eller hjälp steg 2–3
//   ⭐      löst på annat sätt, eller hjälp steg 4
//   0      ej löst ("Visa lösningen" använd, eller avbruten)
//
// taskResult samlar allt spelvyn och datalagret behöver efter en uppgift:
// stjärnor, poäng (anpassning.js), mynt (mynt.js), feedback och om knappen
// "FÖRSÖK IGEN FÖR ⭐⭐⭐" ska visas.
// ============================================================================

import { STARS, STAR_POINTS10, FEEDBACK } from "./config.js";
import { coinsFor } from "./mynt.js";

/** Högsta antal stjärnor efter ett hjälpsteg (0–4). */
export function helpCap(helpStep = 0) {
  const s = Math.max(0, Math.min(4, Math.floor(Number(helpStep) || 0)));
  return STARS.helpCap[s];
}

/** Stjärnor av antal drag (utan hjälpgränsen). */
export function moveStars(moves, optimal) {
  if (moves <= optimal) return 3;
  return moves <= optimal + STARS.extraMovesForTwo ? 2 : 1;
}

/**
 * Stjärnor för en uppgift.
 * @param {{solved:boolean, revealed?:boolean, moves:number, optimal:number, helpStep?:number}} r
 * @returns {0|1|2|3}
 */
export function starsFor({ solved, revealed = false, moves, optimal, helpStep = 0 }) {
  if (!solved || revealed) return 0;
  return Math.min(moveStars(moves, optimal), helpCap(helpStep));
}

/** Poäng för anpassningen i tiondelar: ⭐⭐⭐ 10, ⭐⭐ 6, ⭐ 2, ej löst 0. */
export const points10 = (stars) => STAR_POINTS10[stars] ?? 0;

/** Kort, relevant feedback efter uppgiften. */
export function feedbackFor({ stars, moves, optimal, helpStep = 0 }) {
  if (stars === 0) return FEEDBACK.revealed();
  if (stars === 3) return FEEDBACK.three(moves);
  const byHelp = helpCap(helpStep) === stars && moveStars(moves, optimal) > stars;
  if (stars === 2) return byHelp ? FEEDBACK.twoHelp(moves) : FEEDBACK.twoMoves(moves);
  return byHelp ? FEEDBACK.oneHelp() : FEEDBACK.oneMoves(moves);
}

/**
 * Feedback efter ett GILTIGT drag (effekt från solver.moveEffect). Ett giltigt
 * drag kallas aldrig fel; "closer" behöver ingen kommentar (null).
 */
export function moveFeedback(effect) {
  if (effect === "same") return FEEDBACK.moveSame;
  if (effect === "further") return FEEDBACK.moveFurther;
  return null;
}

/**
 * Resultatet av en avslutad uppgift.
 * @param {object} task  generatorns uppgift (level, optimalMoves)
 * @param {object} run   losning.js-tillståndet (solved, moves, revealed?)
 * @param {{maxStep:number}} [help] hjälptillståndet (hjalp.js)
 * @returns {{solved, revealed, moves, optimal, helpStep, stars, points10, coins, feedback, offerRetry}}
 */
export function taskResult(task, run, help = { maxStep: 0 }) {
  const revealed = !!run.revealed;
  const solved = !!run.solved && !revealed;
  const moves = run.moves.length;
  const optimal = task.optimalMoves;
  const helpStep = help?.maxStep || 0;
  const stars = starsFor({ solved, revealed, moves, optimal, helpStep });
  return {
    solved,
    revealed,
    moves,
    optimal,
    helpStep,
    stars,
    points10: points10(stars),
    coins: coinsFor(task.level, { solved }),
    feedback: feedbackFor({ stars, moves, optimal, helpStep }),
    offerRetry: stars === 1 || stars === 2,
  };
}
