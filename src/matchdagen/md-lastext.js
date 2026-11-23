// ============================================================================
// Matchdagen (#905): vilka av ett Plugga-områdes quizfrågor som används, och med
// vilken lästext – ren, delad av klienten (md-kallor.js omradeKalla) och servern
// (functions/md-vanskap-fragor.js, kopian functions/matchdagen/kallor/matchdagen/
// via npm run sync:matchdagen). Lästext-regeln är Live-lägets (quiz-passage.js,
// #582), inte en kopia:
//   lastext AV  som Matchdagen före #905: bara frågor UTAN lästext (plainQuizPool
//               utan reserven – en fråga med lästext tas aldrig med, inte heller
//               i ett område med bara sådana).
//   lastext PÅ  alla frågor; lästexten följer med (kontext). maxPassage = längsta
//               lästext: Infinity i elevens egna matcher, VANSKAP_LASTEXT_MAX (Live-
//               gränsen 300) i vänskapsmatcherna, där tiden är synkad – en längre
//               text gör att frågan hoppas över där.
//
//   quizUrval(quiz, { lastext?, maxPassage?, giltig? }) → [{ i, kontext }]
//     i = plats i area.quiz (källans nyckel quiz:i), kontext = lästexten ("" = ingen)
//     giltig(i) = sidans egen formkontroll (klienten omradetsSaker, servern flervalOk)
// ============================================================================

import { QUIZ_PASSAGE_MAX, passageCheck } from "../live/modes/quiz-passage.js";

/** Längsta lästext i en vänskapsmatch (tecken) – samma som Live. */
export const VANSKAP_LASTEXT_MAX = QUIZ_PASSAGE_MAX;

export function quizUrval(quiz, { lastext = false, maxPassage = Infinity, giltig = () => true } = {}) {
  const ut = [];
  (Array.isArray(quiz) ? quiz : []).forEach((q, i) => {
    const { passage, reason } = passageCheck(q, { showPassage: lastext === true, maxPassage });
    if (!reason && giltig(i)) ut.push({ i, kontext: passage });
  });
  return ut;
}
