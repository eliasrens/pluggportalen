// ============================================================================
// Tävlingssvar → Firestore-skrivningar (#457) – Mattematchen + Live.
// ----------------------------------------------------------------------------
// Ren modul: beskriver EXAKT vilken batch ett svar ska bli för att
// firestore.rules ska godta det (se kommentaren "MATTEMATCHEN + LIVE" där).
// Ingen Firebase-import – anroparen skickar in SDK:ns sentinel-fabriker
// (`increment`, `serverTimestamp`) och kör sedan skrivningarna i EN writeBatch.
// Regeltesterna (test/firestore-rules-mattematchen-live.test.js) kör samma
// planer, så kontraktet kan inte glida isär.
//
// API
//   pickShard(shards, rng?)             → heltal 0..shards-1
//   counterId(classId, shard)           → "4b_3" (klassräknarens dokument-id)
//   planMathAnswerWrites(args)          → Write[]  (Mattematchen)
//     args: { competitionId, attemptId, uid, classId, name, record,
//             isCorrect, shard, fv: { increment, serverTimestamp }, mynt? }
//     record = mode.answerRecord(q, r) för multiplikation:
//             { factorA, factorB, answer, correctAnswer }
//     mynt = { dag } (#846) – BARA MM-sidans egna svar: ett rätt svar får då
//             två skrivningar till: dagsräknaren studentData/{uid}/mmMynt/{dag}
//             (+1, reglerna: högst 50/dag, bara med ett NYTT rätt svar i samma
//             batch) och saldot studentData/{uid}.coins (+1). Utelämnad/null
//             = inga mynt (svar nr 51+, och Live-svar som räknas in i MM –
//             Live betalar redan). Talen: mm-config.js. Fel svar → aldrig mynt.
//     ankare = "answers" (default, MM-sidan) | "liveAnswers" (#847: ett Live-
//             svar som räknas in i Mattematchen – svarsdokumentet hamnar i
//             mathCompetitions/{cid}/liveAnswers/{attemptId}, samma form och
//             samma regler; mmMyntOk betalar aldrig mot det och lärarens
//             träningstotal (collectionGroup "answers") räknar det inte två
//             gånger). Kombineras aldrig med mynt (kastar).
//   planLiveMmWrites({ competition, now, uid, classId, name, attemptId, record,
//             isCorrect, fv, rng? }) → Write[] (#847) – ett Live-svar i
//             multiplikation räknas i elevens Mattematch: planMathAnswerWrites
//             med ankaret liveAnswers, eller [] om tävlingen saknas, inte är
//             "aktiv" vid now (serverkorrigerad tid) eller Live-klassen inte deltar
//   planMmMyntWrites({ competitionId, attemptId, uid, dag, fv }) → Write[2]
//             (kvittot + saldot ovan; planMathAnswerWrites använder den)
//   planLiveAnswerWrites(args)          → Write[]  (Live)
//     args: { sessionId, attemptId, uid, classId, mode, record, isCorrect,
//             shard, fv, answerKind?, choiceIndex? }
//     answerKind = sessionens svarssätt (#551, answerKindOf(session)):
//       "free"   (default) – dokumentet exakt som före #551, inget extra fält
//                  (choiceIndex får inte skickas)
//       "choice" – choiceIndex = valda knappen (heltal 0–3); dokumentet får
//                  modens record + answerKind: "choice" + choiceIndex.
//       Fel form → kastar (reglerna nekar också ett svar i fel svarssätt).
//   liveAnswerKindError(answerKind, choiceIndex) → string | null (felet ovan)
//   TIDSLINJEFRÅGOR (#600, epic #595) – svarssättet gäller PER FRÅGA:
//   questionAnswerKind(question, sessionKind) → "timeline" för en fråga med
//     kind "timeline", annars sessionens svarssätt (oförändrat för allt annat)
//   timelineAnswerError(year, span) → string | null – ett tidslinjesvar är ett
//     HELTALSÅR inom frågans spann { min, max } (firestore.rules kollar samma)
//   answerShapeError({ kind, choiceIndex?, answer?, year?, span? }) → string | null
//     – svarets form för FRÅGANS svarssätt: choice = bara choiceIndex 0–3,
//     free = bara answer (sträng), timeline = bara year (inom span). Fel form
//     för frågans kind (t.ex. choiceIndex på en tidslinjefråga) → fel.
//     Används av Snilleblixtens svarsplan (och Guldrushen, #601).
//   planLiveJoin({ sessionId, uid, classId, name, fv }) → Write (spelare/"redo")
//   planLiveHeartbeat({ sessionId, uid, fv })           → Write
//   Write = { path: string[], data: object, merge: boolean }
//     path är dokumentets segment, t.ex. ["mathCompetitions", cid, "answers", aid];
//     kör som batch.set(doc(db, ...path), data, merge ? { merge: true } : undefined).
//
// Skrivningar per svar: MM rätt = 4 (svar, elevstatistik, topplista, klass-
// shard) + 2 med mynt (dagsräknare, saldo), MM fel = 2 (svar, elevstatistik);
// Live rätt = 3 (svar, spelare, klass-shard), Live fel = 2. Ett Live-svar som
// räknas in i Mattematchen (#847, src/tavling/mm-live.js) får MM:s 4 resp. 2
// till, med ankaret i liveAnswers.
// ============================================================================

import { MYNT_KVITTON, MYNT_PER_RATT } from "./mm-config.js";
import { competitionPhase } from "./mm-core.js";

export const MULT_MODE = "multiplication_0_10";
/** Ankaret för Live-svar som räknas in i Mattematchen (#847). */
export const MM_LIVE_ANKARE = "liveAnswers";

/** Slumpa klassräknar-shard. */
export function pickShard(shards, rng = Math.random) {
  const n = Math.max(1, Math.floor(shards || 1));
  return Math.min(n - 1, Math.floor(rng() * n));
}

/** Dokument-id för en klassräknar-shard. */
export function counterId(classId, shard) {
  return `${classId}_${shard}`;
}

function answerDoc({ uid, classId, mode, record, isCorrect, shard, fv }) {
  return { uid, classId, mode, ...record, isCorrect: !!isCorrect, shard, at: fv.serverTimestamp() };
}

/**
 * Mattematchen: ett svar → batch-skrivningar.
 * @returns {{path:string[], data:object, merge:boolean}[]}
 */
export function planMathAnswerWrites(args) {
  const { competitionId: cid, attemptId, uid, classId, name, record, isCorrect, shard, fv, mynt = null, ankare = "answers" } = args;
  if (ankare !== "answers" && ankare !== MM_LIVE_ANKARE) throw new Error(`planMathAnswerWrites: okänt ankare ${ankare}`);
  if (ankare === MM_LIVE_ANKARE && mynt) throw new Error("planMathAnswerWrites: Live-svar ger inga MM-mynt");
  const base = ["mathCompetitions", cid];
  const ok = !!isCorrect;
  const tableKeys = [...new Set([record.factorA, record.factorB])].map((t) => `${ok ? "c" : "w"}${t}`);
  const stats = {
    uid, classId,
    correct: fv.increment(ok ? 1 : 0),
    incorrect: fv.increment(ok ? 0 : 1),
    lastAttemptId: attemptId,
    lastAt: fv.serverTimestamp(),
  };
  for (const k of tableKeys) stats[k] = fv.increment(1);
  const writes = [
    { path: [...base, ankare, attemptId], data: answerDoc({ uid, classId, mode: MULT_MODE, record, isCorrect: ok, shard, fv }), merge: false },
    { path: [...base, "studentStats", uid], data: stats, merge: true },
  ];
  if (ok) {
    writes.push({
      path: [...base, "scores", uid],
      data: { uid, classId, name, correct: fv.increment(1), lastAttemptId: attemptId, lastAt: fv.serverTimestamp() },
      merge: true,
    });
    writes.push({
      path: [...base, "classCounters", counterId(classId, shard)],
      data: { classId, shard, correct: fv.increment(1), lastAttemptId: attemptId, lastAt: fv.serverTimestamp() },
      merge: true,
    });
    if (mynt) writes.push(...planMmMyntWrites({ competitionId: cid, attemptId, uid, dag: mynt.dag, fv }));
  }
  return writes;
}

/**
 * Live räknas in i Mattematchen (#847): MM-delen av ett Live-svars batch.
 * Tom lista när svaret inte ska räknas (ingen/inaktiv tävling, klassen deltar inte).
 * @returns {{path:string[], data:object, merge:boolean}[]}
 */
export function planLiveMmWrites({ competition: c, now, uid, classId, name, attemptId, record, isCorrect, fv, rng }) {
  if (!c?.id || !Array.isArray(c.participatingClassIds) || !c.participatingClassIds.includes(classId)) return [];
  if (competitionPhase(c, now) !== "aktiv") return [];
  return planMathAnswerWrites({
    competitionId: c.id, attemptId, uid, classId, name, record, isCorrect,
    shard: pickShard(c.counterShards, rng), fv, ankare: MM_LIVE_ANKARE,
  });
}

/**
 * Pluggmynt för ett rätt MM-svar (#846): dagsräknaren +1 och saldot +1, i
 * samma batch som svaret (reglerna kräver det). Bara MM-sidans svar.
 * @returns {{path:string[], data:object, merge:boolean}[]}
 */
export function planMmMyntWrites({ competitionId, attemptId, uid, dag, fv }) {
  if (typeof dag !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dag)) throw new Error(`planMmMyntWrites: ogiltig dag ${dag}`);
  return [
    {
      path: ["studentData", uid, MYNT_KVITTON, dag],
      data: { dag, cid: competitionId, mynt: fv.increment(MYNT_PER_RATT), lastAttemptId: attemptId, lastAt: fv.serverTimestamp() },
      merge: true,
    },
    { path: ["studentData", uid], data: { coins: fv.increment(MYNT_PER_RATT) }, merge: true },
  ];
}

/** Passar svarets form sessionens svarssätt? null = ok. */
export function liveAnswerKindError(answerKind, choiceIndex) {
  if (answerKind === "choice") {
    const i = choiceIndex;
    return Number.isInteger(i) && i >= 0 && i <= 3 ? null : "flervalssvar kräver choiceIndex 0–3";
  }
  if (answerKind === "free") return choiceIndex !== undefined ? "skriv själv-svar får inte ha choiceIndex" : null;
  return `okänt svarssätt: ${answerKind}`;
}

/** Frågans svarssätt: tidslinjefrågor åsidosätter sessionens (#600). */
export function questionAnswerKind(question, sessionKind) {
  return question?.kind === "timeline" ? "timeline" : sessionKind;
}

/** Ett tidslinjesvar: heltalsår inom frågans spann. null = ok. */
export function timelineAnswerError(year, span) {
  if (!Number.isInteger(year)) return "tidslinjesvar kräver ett heltalsår";
  if (!span || !Number.isInteger(span.min) || !Number.isInteger(span.max)) return "tidslinjefrågan saknar spann";
  if (year < span.min || year > span.max) return `året ${year} ligger utanför frågans spann ${span.min}–${span.max}`;
  return null;
}

/** Passar svarets form frågans svarssätt? null = ok. */
export function answerShapeError({ kind, choiceIndex, answer, year, span } = {}) {
  const has = { choiceIndex: choiceIndex !== undefined, answer: answer !== undefined, year: year !== undefined };
  const only = (k) => Object.entries(has).every(([n, v]) => n === k || !v);
  if (kind === "timeline") {
    if (!only("year")) return "tidslinjesvar får bara ha year";
    return timelineAnswerError(year, span);
  }
  if (kind === "choice") {
    if (!only("choiceIndex")) return "flervalssvar får bara ha choiceIndex";
    return liveAnswerKindError("choice", choiceIndex);
  }
  if (kind === "free") {
    if (!only("answer")) return "skriv själv-svar får bara ha answer";
    return typeof answer === "string" && answer.trim() !== "" ? null : "skriv själv-svar kräver en text";
  }
  return `okänt svarssätt: ${kind}`;
}

/**
 * Live: ett svar → batch-skrivningar. Spelardokumentet måste redan finnas
 * (planLiveJoin) – sen anslutning = join + sedan svar.
 */
export function planLiveAnswerWrites(args) {
  const { sessionId: sid, attemptId, uid, classId, mode, record, isCorrect, shard, fv, answerKind = "free", choiceIndex } = args;
  const err = liveAnswerKindError(answerKind, choiceIndex);
  if (err) throw new Error(`planLiveAnswerWrites: ${err}`);
  const base = ["liveSessions", sid];
  const ok = !!isCorrect;
  const rec = answerKind === "free" ? record : { ...record, answerKind, choiceIndex };
  const writes = [
    { path: [...base, "answers", attemptId], data: answerDoc({ uid, classId, mode, record: rec, isCorrect: ok, shard, fv }), merge: false },
    {
      path: [...base, "players", uid],
      data: {
        correct: fv.increment(ok ? 1 : 0),
        incorrect: fv.increment(ok ? 0 : 1),
        lastAttemptId: attemptId,
        lastAt: fv.serverTimestamp(),
        lastSeenAt: fv.serverTimestamp(),
      },
      merge: true,
    },
  ];
  if (ok) {
    writes.push({
      path: [...base, "counters", counterId(classId, shard)],
      data: { classId, shard, correct: fv.increment(1), lastAttemptId: attemptId, lastAt: fv.serverTimestamp() },
      merge: true,
    });
  }
  return writes;
}

/** Live "Gå med" (lobby eller sen anslutning). Skapar spelardokumentet. */
export function planLiveJoin({ sessionId, uid, classId, name, fv }) {
  return {
    path: ["liveSessions", sessionId, "players", uid],
    data: { uid, classId, name, joinedAt: fv.serverTimestamp(), lastSeenAt: fv.serverTimestamp(), correct: 0, incorrect: 0 },
    merge: false,
  };
}

/** Live närvaro-puls (t.ex. var 20:e s i lobbyn). */
export function planLiveHeartbeat({ sessionId, uid, fv }) {
  return { path: ["liveSessions", sessionId, "players", uid], data: { lastSeenAt: fv.serverTimestamp() }, merge: true };
}
