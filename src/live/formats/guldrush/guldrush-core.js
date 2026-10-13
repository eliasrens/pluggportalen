// ============================================================================
// Guldrushen 💰 (format "guldrush", #563, epic #562): ren logik – ingen DOM,
// ingen Firebase. Testas i test/live-guldrush.test.js; regelgrenen
// (firestore.rules "Guldrushen") i test/firestore-rules-live-guldrush.test.js,
// servern (functions/guldrush-core.js) i test/functions-guldrush*.test.mjs.
//
// VARJE ELEV I EGEN TAKT under matchtiden (pacing "tid"). Rätt svar → tre
// kistor, eleven väljer en. Mest guld när tiden är ute vinner. SERVERN avgör
// allt guld (Cloud Functions guldrushAnswer/OpenChest/ChooseVictim) – eleven
// skriver aldrig guld, kistor, skydd eller händelser. Datamodellen
// (docs/DATAMODELL.md "Guldrushen"):
//   liveSessions/{sid}            inställningar: stealSwap, showNames, rewards?,
//                                 durationSeconds (kärnans matchklocka)
//   …/grPublic/questions          quiz: { questions[] } elevsynligt, utan facit
//   …/grPrivate/snapshot          quiz: { facit[] } BARA lärare (+ servern)
//   …/answers/{attemptId}         elevens svar, rättat av servern (create-only),
//                                 chest/chestIndex när kistan öppnats
//   …/grPlayers/{uid}             { gold, correct, incorrect, chests,
//                                 protectedUntil, lastVictimUid, pending,
//                                 lastHit, nextQ? } – bara servern skriver
//   …/grEvents/{id}               händelseflödet (serverstämpel, stabilt id)
//   …/grMeta/leader               vem som leder (ledningsbyte-händelsen)
// Kistorna + spelreglerna: ./delat/ (delas med servern).
// Logiken (ställning, resultat, frågepool, speltid, händelsemarkör) är den
// gemensamma kistspelsmodulen (#651): src/live/kistspel/ks-core.js – här
// bara Guldrushens id, gränser och texter. Samma API som förut.
//
// API
//   GR_MIN_CLASSES / GR_MAX_CLASSES  1 / 3
//   GR_DURATIONS_MIN      [3, 5, 10, 15, 20, 30] snabbknappar (+ "Egen tid")
//   GR_CUSTOM_MIN         { min: 1, max: 60 } – "Egen tid", hela minuter
//   GR_MODES              spellägen servern kan rätta
//   GR_PRIVATE_DOC / GR_PUBLIC_DOC   ["grPrivate","snapshot"] / ["grPublic","questions"]
//   GR_MAX_QUESTIONS      100 (reglerna har samma tak)
//   durationField()       speltiden som setupFields-post
//   validateSetup(input)  → string[]
//   buildSessionFields(input) → { stealSwap, showNames }
//   sessionTitle(s) / defaultSessionName(names)
//   buildQuizPool(mode, quiz, quizSnapshot, rng?, { showPassage?, timeline?, timelineSpan? })
//                         → { questions, facit } – tidslinjefrågor (#601): kind
//                         "timeline" + span i questions, facit { year } (bara grPrivate)
//   rankByGold(rows)      → sorterad + rank, DELAD placering (1, 1, 3)
//   computeStandings(s, { players, grPlayers }) → { players, classes, totalGold,
//                           totalCorrect, leaderIds, winnerId, draw }
//   buildResult(s, _classes, players, _mode, { grPlayers, answers?, questions? })
//                         → historikens result (+ perQuestion ur svaren, #566)
//   createEventCursor()   → { take(events) } – nya händelser sedan förra
//                           gången; FÖRSTA anropet = baslinje (efter omladdning
//                           spelas inget gammalt upp, designspec §9)
// ============================================================================

import {
  KS_DURATIONS_MIN, KS_CUSTOM_MIN, KS_MAX_QUESTIONS, durationField as ksDurationField, durationError as ksDurationError,
  sessionTitle, defaultName, buildQuizPool as ksBuildQuizPool, rankByGold, computeStandings,
  buildResult as ksBuildResult, createEventCursor,
} from "../../kistspel/ks-core.js";

export { sessionTitle, rankByGold, computeStandings, createEventCursor };

export const GR_MIN_CLASSES = 1;
export const GR_MAX_CLASSES = 3;
export const GR_DURATIONS_MIN = KS_DURATIONS_MIN;
export const GR_CUSTOM_MIN = KS_CUSTOM_MIN;
export const GR_MODES = ["multiplication_0_10", "plugga_quiz"];
export const GR_PRIVATE_DOC = ["grPrivate", "snapshot"];
export const GR_PUBLIC_DOC = ["grPublic", "questions"];
export const GR_MAX_QUESTIONS = KS_MAX_QUESTIONS;

/**
 * Speltiden – formatets eget durationMin-fält (kärnan lägger då inte till
 * sitt). Snabbknappar + "Egen tid" (#589); validateSetup kontrollerar själv.
 * Reglerna (grSettingsOk) tar hela minuter 1–60 som durationSeconds.
 */
export function durationField() {
  return ksDurationField({ durations: GR_DURATIONS_MIN, custom: GR_CUSTOM_MIN });
}

/** Felet för speltiden (hela minuter 1–60) | null. Råsträngar ur "Egen tid" tas också. */
export function durationError(v) {
  return ksDurationError(v, GR_CUSTOM_MIN);
}

export function validateSetup(input) {
  const errs = [];
  const dur = durationError(input?.durationMin);
  if (dur) errs.push(dur);
  if (input?.gameMode && !GR_MODES.includes(input.gameMode)) errs.push("Det spelläget går inte i Guldrushen.");
  return errs;
}

/** Formatets fält på sessionen (matchlängden lägger kärnan, durationSeconds). */
export function buildSessionFields(input) {
  return {
    stealSwap: input?.stealSwap !== false,
    showNames: input?.showNames !== false,
  };
}

/** Förslag på namn: "Guldrushen 4B". */
export function defaultSessionName(names) {
  return defaultName("Guldrushen", names);
}

/** Quizets ögonblicksbild (grPublic + grPrivate) – ks-core buildQuizPool, högst GR_MAX_QUESTIONS. */
export function buildQuizPool(mode, quiz, quizSnapshot, rng = Math.random, opts = {}) {
  return ksBuildQuizPool(mode, quiz, quizSnapshot, rng, { ...opts, max: GR_MAX_QUESTIONS });
}

/** Historikens ögonblicksbild (ks-core buildResult, format "guldrush"). */
export function buildResult(s, _classes, players = [], _mode = null, inputs = {}) {
  return ksBuildResult("guldrush", s, players, inputs);
}
