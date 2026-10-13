// ============================================================================
// Datakuppen 💾 (format "datakuppen", #652, epic Datakuppen): ren logik –
// ingen DOM, ingen Firebase. Spec: docs/UTVECKLINGSUPPDRAG_DATAKUPPEN.md.
// Testas i test/live-datakuppen.test.js; regelgrenen (firestore.rules
// "Datakuppen") i test/firestore-rules-live-datakuppen.test.js, servern
// (functions/datakuppen-core.js) i test/functions-datakuppen*.test.mjs.
//
// VARJE ELEV I EGEN TAKT under matchtiden (pacing "tid"), inom klassen. Rätt
// svar → tre dolda filer; data (MB), brandvägg, virus eller Hack = välj en
// klasskamrat och knäck hens kod bland tre. Mest data när tiden är ute vinner.
// SERVERN avgör all data och alla koder (Cloud Functions datakuppAnswer/
// OpenFile/ChooseTarget/GuessCode/PickCode) – eleven skriver aldrig data,
// filer, skydd, koder eller händelser. Datamodellen:
//   liveSessions/{sid}            inställningar: hacking, showNames, rewards?,
//                                 durationSeconds (kärnans matchklocka)
//   …/dkPublic/questions          quiz: { questions[] } elevsynligt, utan facit
//   …/dkPrivate/snapshot          quiz: { facit[] } BARA lärare (+ servern)
//   …/answers/{attemptId}         elevens svar, rättat av servern (create-only),
//                                 chest/chestIndex när filen öppnats
//   …/dkPlayers/{uid}             { gold (= data i MB), correct, incorrect,
//                                 chests, protectedUntil, lastVictimUid,
//                                 pending { kind "steal", chest "hack",
//                                 expiresAt, stage?, targetUid?, targetName?,
//                                 guessExpiresAt? }, lastHit, hackAttempts,
//                                 hackSuccess, nextQ? } – bara servern skriver,
//                                 deltagare läser. INGA koder här.
//   …/dkEvents/{id}               händelseflödet (hack = type "steal", chest "hack")
//   …/dkMeta/leader               vem som leder
//   …/dkSelf/{uid}                { code, codeVersion, offers[4] | null,
//                                 offersExpiresAt, hack { targetUid, targetName,
//                                 options[3], expiresAt } | null } – BARA eleven
//                                 själv läser (som grPrivate för facit)
//   …/dkSecret/{uid}              { code, codeVersion, offers, hacks: { [mål]:
//                                 { codeVersion, decoys, struck, shown } },
//                                 hack } – BARA servern (ingen klient läser)
// Filerna, koderna och reglerna: ./delat/ (delas med servern).
// Logiken (ställning, resultat, frågepool, speltid) = kistspelsmodulen
// (src/live/kistspel/ks-core.js), som Guldrushen.
//
// API
//   DK_MIN_CLASSES / DK_MAX_CLASSES  1 / 3
//   DK_DURATIONS_MIN / DK_CUSTOM_MIN  snabbknappar 3–30 + "Egen tid" 1–60 min
//   DK_MODES, DK_PRIVATE_DOC, DK_PUBLIC_DOC, DK_MAX_QUESTIONS
//   durationField() · validateSetup(input) → string[]
//   buildSessionFields(input) → { hacking, showNames }
//   sessionTitle(s) / defaultSessionName(names) → "Datakuppen 4B"
//   buildQuizPool(mode, quiz, quizSnapshot, rng?, opts?) → { questions, facit }
//   computeStandings(s, { players, dkPlayers }) → ks-core-ställningen
//   hackStats(dkPlayers) → { attempts, success } – hela klassen (lärarstatistik)
//   buildResult(s, _classes, players, _mode, { dkPlayers, answers?, questions? })
//                         → historikens result (+ hacks: hackStats)
//   createEventCursor()
// ============================================================================

import {
  KS_DURATIONS_MIN, KS_CUSTOM_MIN, KS_MAX_QUESTIONS, durationField as ksDurationField, durationError as ksDurationError,
  sessionTitle, defaultName, buildQuizPool as ksBuildQuizPool, computeStandings as ksComputeStandings,
  buildResult as ksBuildResult, createEventCursor,
} from "../../kistspel/ks-core.js";

export { sessionTitle, createEventCursor };

export const DK_FORMAT = "datakuppen";
export const DK_MIN_CLASSES = 1;
export const DK_MAX_CLASSES = 3;
export const DK_DURATIONS_MIN = KS_DURATIONS_MIN;
export const DK_CUSTOM_MIN = KS_CUSTOM_MIN;
export const DK_MODES = ["multiplication_0_10", "plugga_quiz"];
export const DK_PRIVATE_DOC = ["dkPrivate", "snapshot"];
export const DK_PUBLIC_DOC = ["dkPublic", "questions"];
export const DK_MAX_QUESTIONS = KS_MAX_QUESTIONS;

const int = (v) => Math.max(0, Math.floor(Number(v) || 0));

/** Speltiden: snabbknappar 3–30 min + "Egen tid" 1–60 hela minuter. */
export function durationField() {
  return ksDurationField({ durations: DK_DURATIONS_MIN, custom: DK_CUSTOM_MIN });
}

export function validateSetup(input) {
  const errs = [];
  const dur = ksDurationError(input?.durationMin, DK_CUSTOM_MIN);
  if (dur) errs.push(dur);
  if (input?.gameMode && !DK_MODES.includes(input.gameMode)) errs.push("Det spelläget går inte i Datakuppen.");
  return errs;
}

/** Formatets fält på sessionen – Hackning och namn i flödet, båda på som standard. */
export function buildSessionFields(input) {
  return {
    hacking: input?.hacking !== false,
    showNames: input?.showNames !== false,
  };
}

export function defaultSessionName(names) {
  return defaultName("Datakuppen", names);
}

export function buildQuizPool(mode, quiz, quizSnapshot, rng = Math.random, opts = {}) {
  return ksBuildQuizPool(mode, quiz, quizSnapshot, rng, { ...opts, max: DK_MAX_QUESTIONS });
}

/** Ställningen – spelardokumenten heter dkPlayers (saldot `gold` = MB). */
export function computeStandings(s, { players = [], dkPlayers = [] } = {}) {
  return ksComputeStandings(s, { players, grPlayers: dkPlayers });
}

/** Hackförsök och lyckade hack för hela klassen (aldrig per elev på projektorn). */
export function hackStats(dkPlayers = []) {
  const attempts = (dkPlayers || []).reduce((n, p) => n + int(p?.hackAttempts), 0);
  const success = (dkPlayers || []).reduce((n, p) => n + int(p?.hackSuccess), 0);
  return { attempts, success };
}

export function buildResult(s, _classes, players = [], _mode = null, { dkPlayers = [], answers = null, questions = null } = {}) {
  return { ...ksBuildResult(DK_FORMAT, s, players, { grPlayers: dkPlayers, answers, questions }), hacks: hackStats(dkPlayers) };
}
