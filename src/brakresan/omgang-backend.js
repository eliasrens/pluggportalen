// ============================================================================
// Bråkresan – omgångsvyns backends (src/brakresan/omgang-backend.js) · #709 D
// ----------------------------------------------------------------------------
// Omgångsvyn (omgang.js) pratar bara med ett backend-objekt:
//
//   state()                         → { stars, activeRoundId, activeAnswered, status }
//   start({ restart?, replaceRoundId? }) → { roundId, resumed, round }
//   answer(roundId, index, answer, helpBefore) → graded | invalid (data.js-formen)
//   rework(roundId, index, { answer?, helpAfter?, attemptId? })
//   finish(roundId)                 → finishRound-svaret
//   abort(roundId)
//   newAttemptId(), saveStatus, drafts, demo (bool)
//
// serverBackend()   = elevens riktiga omgångar: callables via data.js (lat –
//                     Firebase laddas först här, aldrig i bootgrafen).
// demoBackend(id)   = "testomgång" helt i klienten (demo.js): samma generator,
//                     plan och bedömning, men INGA anrop och inga skrivningar.
//                     För lärarens testläge (K) och förhandsvisning utan server;
//                     resultatet lovar aldrig stjärnor eller mynt.
// Ren logik utan Firebase-import i demoBackend: testas i Node
// (test/brakresan-omgang-backend.test.js).
// ============================================================================

import { challengeStatus, ROUND_SIZE } from "./schema/regler.js";
import { createSaveStatus, createDrafts } from "./data-core.js";

export async function serverBackend(challengeId) {
  const data = await import("./data.js");
  return {
    demo: false,
    async state() {
      const s = await data.getState();
      const e = s.challenges?.[challengeId] || {};
      return { stars: e.stars || 0, activeRoundId: e.activeRoundId || null, activeAnswered: e.activeAnswered || 0, status: challengeStatus(e) };
    },
    start: (o = {}) => data.startRound(challengeId, o),
    answer: (roundId, index, answer, helpBefore) => data.answer(roundId, index, answer, helpBefore),
    rework: (roundId, index, o) => data.rework(roundId, index, o),
    finish: (roundId) => data.finishRound(roundId),
    abort: (roundId) => data.abortRound(roundId),
    newAttemptId: () => data.newAttemptId(),
    saveStatus: data.saveStatus,
    drafts: data.drafts,
  };
}

const minne = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

/** Testomgång i klienten. `seed` för lärarens "byt variant" och för tester. */
export function demoBackend(challengeId, { seed = null } = {}) {
  const saveStatus = createSaveStatus();
  let round = null;
  let full = null; // { challenge, tasks } – hela uppgifterna (med facit) finns bara här, i demoläget
  let raknare = 0;
  const demo = () => import("./demo.js");
  const utfall = (index) => {
    const a = round.answers[index];
    return { status: "graded", correct: a.first.correct, reason: a.first.reason, message: a.first.message, reveal: a.reveal,
      answeredCount: round.answeredCount, correctCount: round.correctCount, already: true };
  };
  return {
    demo: true,
    async state() {
      return { stars: 0, activeRoundId: round?.status === "aktiv" ? round.roundId : null, activeAnswered: round?.answeredCount || 0,
        status: challengeStatus(round?.status === "aktiv" ? { activeRoundId: round.roundId, activeAnswered: round.answeredCount } : {}) };
    },
    async start({ restart = false } = {}) {
      if (round?.status === "aktiv" && !restart) return { roundId: round.roundId, resumed: true, round };
      const d = await demo();
      const r = await d.demoRound(challengeId, seed ? `${seed}-${++raknare}` : undefined);
      full = r;
      round = {
        roundId: `demo-${r.seed}`, challengeId, mode: "lararetest", status: "aktiv", version: r.challenge.version,
        tasks: r.tasks.map(d.publicTask),
        answers: r.tasks.map((_, i) => ({ index: i, first: null, helpBefore: [], helpAfter: [], rework: [], reveal: null })),
        answeredCount: 0, correctCount: 0,
      };
      return { roundId: round.roundId, resumed: false, round };
    },
    async answer(roundId, index, answer, helpBefore = []) {
      if (!round || roundId !== round.roundId) throw new Error("Okänd testomgång.");
      if (round.answers[index].first) return utfall(index);
      const d = await demo();
      const g = d.gradeDemo(full.challenge, full.tasks[index], answer);
      if (g.status === "invalid") return { status: "invalid", error: g.error, message: g.message };
      round.answers[index] = { ...round.answers[index], first: { answer, correct: g.correct, reason: g.reason ?? null, message: g.message ?? null },
        helpBefore: [...helpBefore], reveal: g.reveal };
      round.answeredCount = round.answers.filter((a) => a.first).length;
      round.correctCount = round.answers.filter((a) => a.first?.correct).length;
      return { ...utfall(index), already: false };
    },
    async rework(roundId, index, { answer = null, helpAfter = [] } = {}) {
      const a = round?.answers[index];
      if (!a?.first || a.first.correct) throw new Error("Bearbetning görs efter ett svar som inte var rätt.");
      a.helpAfter = [...new Set([...a.helpAfter, ...helpAfter])];
      if (!answer) return { status: "ok", reworkCount: a.rework.length };
      const g = (await demo()).gradeDemo(full.challenge, full.tasks[index], answer);
      if (g.status === "invalid") return { status: "invalid", error: g.error, message: g.message };
      a.rework.push({ answer, correct: g.correct });
      return { status: "graded", correct: g.correct, message: g.message ?? null, reworkCount: a.rework.length };
    },
    async finish(roundId) {
      if (!round || roundId !== round.roundId) throw new Error("Okänd testomgång.");
      if (round.answeredCount < ROUND_SIZE) throw new Error("Alla tio uppgifter är inte besvarade.");
      round.status = "avslutad";
      const reward = { kind: "ingen", eventId: null, coins: 0, starOrdinal: null };
      return {
        roundId, challengeId, correctCount: round.correctCount, reward, rewardText: null, stars: 0, totalStars: 0,
        message: `Testomgång: ${round.correctCount} av 10 rätt. Inga stjärnor eller mynt sparas.`,
        dragon: { levelBefore: 0, levelAfter: 0, hatched: false }, coinsAfter: null, already: false,
      };
    },
    async abort() {
      if (round) round.status = "avbruten";
      return { status: "avbruten" };
    },
    /** Lärarens granskning (K): hela uppgiften med facit. Finns bara i demoläget. */
    fullTask: (index) => full?.tasks[index] ?? null,
    newAttemptId: () => `demo-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
    saveStatus,
    drafts: createDrafts(minne()),
  };
}
