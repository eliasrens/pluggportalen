// ============================================================================
// Pluggporten – Guldrushen 💰 på SERVERN (functions/guldrush-core.js, #563)
// ----------------------------------------------------------------------------
// Allt som rör guld avgörs här (funktionsspec §6.6): eleven skriver ALDRIG
// guld, kistor, skydd eller händelser (firestore.rules nekar). Tre anropbara
// funktioner (index.js) kör kärnan med Admin SDK:t injicerat – samma mönster
// som login-core.js, så kärnan kan testas direkt mot Firestore-emulatorn med
// styrd klocka och slump (test/functions-guldrush-core.test.mjs).
//
// FLÖDET
//   answerQuestion  eleven svarar → servern rättar (multiplikation: räknar
//     om; quiz: mot det lärarskyddade facit grPrivate/snapshot) och skapar
//     answers/{attemptId} (create-only, aldrig två gånger). Quiz: servern
//     väljer elevens nästa fråga (grPlayers.nextQ) – ingen kan pröva sig fram
//     på samma fråga. TIDSLINJEFRÅGOR (#601, epic #595): en fråga med kind
//     "timeline" i grPublic svaras med { q, year } – bara ett heltalsår inom
//     frågans span (spannet läses ur grPublic, aldrig ur anropet), inget
//     choiceIndex/answer. Facit = grPrivate facit[q].year; exakt år = rätt
//     (→ kistor som vanligt). Ett omförsök med samma attemptId men ANNAT år
//     (manipulerat efter lås) nekas; ny attemptId på samma fråga nekas av nextQ.
//   openChest       ett RÄTT svar → EN kista (answers/{attemptId}.chest sätts
//     i samma transaktion – en andra öppning nekas). Slumpen här (crypto).
//     Stöld/byte → grPlayers.pending; eleven väljer offer med chooseVictim.
//   chooseVictim    stöld/byte i EN transaktion som ändrar båda elevernas guld.
//     Trygghetsreglerna (guldrush-regler.js victimProblem) kontrolleras här,
//     i ÖGONBLICKET valet görs: skyddad (protectedUntil – Sköld 60 s,
//     bestulen/bytt 30 s) går inte, inte samma offer två gånger i rad, byte
//     bara med någon som har MER guld. Ett nekat val ("🛡️ Alma hann skaffa
//     en sköld!", eller manipulerat) ligger kvar – tjuven väljer om på tiden
//     som är kvar; inget val/för sent → servern slumpar bland oskyddade;
//     ingen möjlig → vanlig guldkista (kistans fallback).
//   Alla tre: sessionen måste vara Guldrushen, status live och inom matchtiden
//     (startedAt + nedräkning ≤ nu < + matchlängd), annars nekas anropet.
//
// HÄNDELSEFLÖDET (designspec §9): varje utfall skriver grEvents/{autoId}
// { type, chest?, uid, name, classId, victim…?, amount, gold, at = serverns
// tid } i SAMMA transaktion. Ledningsbyte avgörs efteråt (noteLeader, egen
// liten transaktion mot grMeta/leader). Inga heta dokument: ett svar rör bara
// elevens egna dokument; en stöld de två elevernas.
//
// Kistkonfig + spelregler: ./guldrush/ = GENERERAD kopia av
// src/live/formats/guldrush/delat/ (npm run sync:guldrush).
// LOGIKEN är den gemensamma kistspelsservern (#651, ./kistspel-core.js
// createKistServer) – här bara Guldrushens konfiguration: format-id,
// samlingarna (grPlayers, grPrivate, grPublic, grMeta, grEvents), regler och
// texter. Beteendet är oförändrat (samma tester).
//
// API (deps = { db, FieldValue, Timestamp, now?(), rng?() })
//   answerQuestion(deps, uid, { sid, attemptId, factorA?, factorB?, answer?,
//                  choiceIndex?, q?, year? }) → { attemptId, correct, correctAnswer,
//                  nextQ, correctYear? (tidslinjefråga) }
//   openChest(deps, uid, { sid, attemptId, chestIndex }) → { chest, kind,
//                  delta, gold, protectedUntil (ms | null), pending? }
//   chooseVictim(deps, uid, { sid, victimUid? }) → { result: "steal"|"swap"|
//                  "fallback", chest, victimUid?, amount, delta, gold }
//   noteLeader(deps, sid) → uid | null (ny ledare skriven)
//   matchWindow(s) → { t0, end } | null
//   GrError(code, message) – code = HttpsError-kod, message på svenska
//                            (= KsError, ./kistspel-rattning.js)
// Rättningen (multiplikation, quiz, tidslinje): ./kistspel-rattning.js.
// ============================================================================

import { GR_RULES } from "./guldrush/chests-config.js";
import { GR_REGLER } from "./guldrush/guldrush-regler.js";
import { KsError } from "./kistspel-rattning.js";
import { createKistServer } from "./kistspel-core.js";

export { KsError as GrError };

export const GR_FORMAT = "guldrush";
export const GR_MODES = ["multiplication_0_10", "plugga_quiz"];

const SERVER = createKistServer({
  format: GR_FORMAT,
  regler: GR_REGLER,
  rules: GR_RULES,
  collections: { players: "grPlayers", private: "grPrivate", public: "grPublic", meta: "grMeta", events: "grEvents" },
  fallbackChest: "guld",
  texts: {
    wrongFormat: "Det här är ingen Guldrush-match.",
    modeUnsupported: "Spelläget stöds inte i Guldrushen.",
    pendingFirst: "Välj först vem du ska knycka från eller byta med.",
    noPending: "Det finns ingen stöld eller byte att välja.",
  },
});

export const { answerQuestion, openChest, chooseVictim, noteLeader, matchWindow } = SERVER;
