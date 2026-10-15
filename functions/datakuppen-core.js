// ============================================================================
// Pluggporten – Datakuppen 💾 på SERVERN (functions/datakuppen-core.js, #652)
// ----------------------------------------------------------------------------
// Allt som rör data, filer, koder och hack avgörs här (spec
// docs/UTVECKLINGSUPPDRAG_DATAKUPPEN.md §2): eleven skriver ALDRIG data,
// filer, skydd, koder eller händelser (firestore.rules nekar). index.js kör
// kärnan med Admin SDK:t injicerat; testerna styr klocka och slump
// (test/functions-datakuppen-core.test.mjs).
//
// SVAR OCH FILER = den gemensamma kistspelsservern (#651, kistspel-core.js
// createKistServer) med Datakuppens filtabell (./datakuppen/ = GENERERAD
// kopia av src/live/formats/datakuppen/delat/, npm run sync:kistspel):
//   answerQuestion  rättar (multiplikation/quiz/tidslinje), answers/{attemptId}
//   openFile        ett RÄTT svar → EN fil (slumpen här). Hack-filen → spelarens
//                   pending { kind: "steal", chest: "hack", expiresAt }.
//   Spärrar: ett svar per fråga, en fil per rätt svar, minsta tid mellan
//   filer, tak för data, inga anrop utanför matchtiden.
//
// KODERNA (§1.2) – bara ur listan (./datakuppen/koder.json), aldrig något
// eleven skriver: pickCode tar BARA ett index i elevens förslag.
//   pickCode        { sid, index? } – lobbyn: index null → 4 förslag (helst
//                   inte tagna/föreslagna/lockkoder i matchen); index 0–3 →
//                   välj. Matchen igång och ingen kod → servern väljer (vid
//                   elevens nästa anrop ELLER när någon försöker hacka eleven –
//                   ensureCode). Har eleven en kod avvisas ett nytt val: koden
//                   gäller HELA matchen, även efter ett hack (#719).
//
// HACKET (§1.4) i två steg, båda med trygghetsreglerna i valets ögonblick:
//   chooseTarget    { sid, targetUid? } – målet (skyddad / samma två gånger i
//                   rad / för lite data nekas; nekat val ligger kvar; inget
//                   val eller för sent → servern slumpar bland dem som går;
//                   ingen → filens fallback "Mapp"). Returnerar tre koder i
//                   slumpad ordning – inget fält avslöjar vilken som är rätt.
//   guessCode       { sid, index?, targetUid? } – EN gissning per hackförsök.
//                   Rätt → 15 % flyttas i EN transaktion (båda eleverna +
//                   händelsen), målet får 30 s skydd – koden ligger kvar.
//                   Fel → inget flyttas, koden stryks för just det paret.
//                   index null / för sent → misslyckas utan påföljd.
//
// MINNESMOMENTET: dkSecret/{hackare}.hacks[mål] = { codeVersion, decoys,
// struck, shown }. Samma lockkoder vid varje försök mot samma mål, minus de
// strukna, i ny ordning, hela matchen (målets kod byts aldrig; codeVersion
// ändras bara när koden väljs första gången). En lockkod är ALDRIG någon spelares aktuella kod
// (prövas vid varje visning; en krock byts ut).
//
// DATAMODELL (under liveSessions/{sid}, se src/live/formats/datakuppen/
// datakuppen-core.js): dkPlayers (data, skydd, pending – deltagare läser),
// dkEvents, dkMeta/leader, dkPublic/dkPrivate (quiz/facit), dkSelf/{uid}
// (elevens egen kod, förslag och pågående hackkoder – BARA eleven själv
// läser), dkSecret/{uid} (kod, förslag, lockkoder, strukna – BARA servern).
//
// FILERNA: datakuppen-server.js (kistspelsservern + delade hjälpare),
// datakuppen-koder.js (koderna), datakuppen-hack.js (hacket), den här (API:t).
//
// API (deps = { db, FieldValue, Timestamp, now?(), rng?() })
//   answerQuestion(deps, uid, { sid, attemptId, factorA?, factorB?, answer?,
//                  choiceIndex?, q?, year? }) → { attemptId, correct, correctAnswer, nextQ, correctYear? }
//   openFile(deps, uid, { sid, attemptId, fileIndex }) → { file, kind, delta,
//                  gold, protectedUntil (ms | null), pending? }
//   pickCode(deps, uid, { sid, index? }) → { code, offers, expiresAtMs, auto? }
//   chooseTarget(deps, uid, { sid, targetUid? }) → { result: "target", targetUid,
//                  targetName, options[3], expiresAtMs, auto } | { result: "fallback", file, delta, gold }
//   guessCode(deps, uid, { sid, index?, targetUid? }) → { result: "hacked"|"wrong"|
//                  "timeout"|"changed"|"protected", amount?, gold?, code?, left? }
//   noteLeader(deps, sid) · matchWindow(s) · DK_CODES · DkError (= KsError)
// ============================================================================

import { SERVER } from "./datakuppen-server.js";

export { KsError as DkError } from "./kistspel-rattning.js";
export { DK_FORMAT, DK_MODES } from "./datakuppen-server.js";
export { DK_CODES, pickCode } from "./datakuppen-koder.js";
export { chooseTarget, guessCode } from "./datakuppen-hack.js";

export const { answerQuestion, noteLeader, matchWindow } = SERVER;

// --- Filen -------------------------------------------------------------------------

/** Ett rätt svar → en av tre filer (kistmotorns openChest). */
export async function openFile(deps, uid, raw) {
  const out = await SERVER.openChest(deps, uid, { sid: raw?.sid, attemptId: raw?.attemptId, chestIndex: raw?.fileIndex ?? 0 });
  const { chest, ...rest } = out;
  return { file: chest, ...rest };
}
