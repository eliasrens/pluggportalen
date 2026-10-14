// ============================================================================
// Guldrushen (#564): FRÅGA → SVAR i egen takt (funktionsspec §6.1, DEL 2).
//   Skriv själv  src/mult/fast-answer.js – fokus ligger kvar genom svars-
//                cyklerna (ENTER → nästa direkt). Bara multiplikation.
//   Flerval      choice-answer.js (#552): fyra knappar, färg + form, 1–4.
//                Multiplikation: alternativen ur spelläget; quiz: frågorna
//                ur grPublic (utan facit) och SERVERN väljer nästa fråga
//                (svarets nextQ, §4.4 – ingen kan pröva sig fram).
// Rättningen som räknas görs alltid av servern (send → guldrushAnswer).
// Multiplikationens facit är inte hemligt (a·b), så klienten visar rätt/fel
// direkt och låter kistorna dyka upp medan svaret är på väg (tempot, §6.7) –
// kistan öppnas ändå först när servern bekräftat rätt svar. Quiz väntar på
// serverns besked.
// Fel → kort ❌ och nästa fråga direkt, inga kistor.
// Tidslinjefråga (#601, epic #595, kind "timeline" i grPublic): i stället för
//                alternativen visas tidslinjen (src/timeline/timeline-answer.js,
//                kompakt, laddas latt) – dra, finjustera, lås → send({ q, year }).
//                Servern rättar (exakt år = rätt → kistor). Fel → kort ❌ +
//                rätt år på linjen en stund, sedan nästa fråga.
//
// Flödet är den gemensamma kistspelsmodulen (#651): src/live/kistspel/
// ks-fraga.js – här bara tidslinjerutans klass (gr-svar-tl).
//
// API
//   createQuestionFlow(host, { mode, answerKind, send, onCorrect, onProblem,
//                              questions? }) → { show(), hide(), setNextQ(n), destroy() }
//     send(payload) → Promise<{ correct, correctAnswer, nextQ }>  (attemptId med)
//     onCorrect({ attemptId, answerP })  rätt svar → vyn visar kistorna
//     onProblem(err)  svaret kom inte fram / nekades
//     questions()     quizets elevsynliga frågor
// ============================================================================

import { createQuestionFlow as ksCreateQuestionFlow } from "../../kistspel/ks-fraga.js";

export function createQuestionFlow(host, opts) {
  return ksCreateQuestionFlow(host, { ...opts, tlCls: "gr-svar-tl" });
}
