// ============================================================================
// Live: realtids-datalagret för projektorvyer (#460) – det #461:s grafiska
// vyer (Raketrace/Statistik/Dragkamp) prenumererar på. Vyerna själva räknar
// ingenting: de får ett färdigt tillstånd ~4 ggr/s och vid varje Firestore-
// ändring (svar syns inom ~1 s).
//
// API
//   subscribeLiveSession(sid, cb, opts?) → unsubscribe()
//     opts.teacher  true (default) = lyssna även på klassräknare + spelare
//                   (bara lärare får läsa dem) och sköt lärarsysslorna:
//                   fyll saknad endsAt, markera slut vid 00:00, skriv
//                   historikens result en gång.
//     opts.uid      inloggades uid (klocksynk via liveClock/{uid})
//     opts.topN     topplistans längd (default 10)
//     opts.onError  (err) => void
//   cb(state) där state = {
//     sessionId, session,            // rådokumentet (null = raderad/okänd)
//     status,                        // "lobby" | "live" | "finished"
//     phase, countdown, msLeft,      // se live-core phaseAt (server-korrigerat)
//     clock,                         // "12:43"
//     classes, totalCorrect, leaderIds, winnerId, draw,  // ur sessionens
//                                    // FORMAT (computeStandings, #547) –
//                                    // Klassmatchen: classes = [{ classId, name,
//                                    // correct, divisor, score, joined, ready }]
//     top: [{ uid, name, classId, correct, incorrect }],
//     result,                        // sparad historik (efter slut) eller null
//     now,                           // server-korrigerad tid för renderingen
//   }
//
// Formatet (formatOf(session), saknat = Klassmatchen) avgör ställningen,
// historikens result och om klassräknarna (classCounters) ska lyssnas på.
//
// Återanslutning: Firestore-lyssnarna återupptas själva efter avbrott, och en
// omladdning prenumererar bara på nytt – allt tillstånd kommer från servern.
// ============================================================================

import {
  watchSession, watchCounters, watchPlayers, autoFinish, fillEndsAt, writeResultIfMissing,
} from "./live-data.js";
import { phaseAt, topPlayers, formatClock } from "./live-core.js";
import { serverNow, syncLiveClock } from "./live-clock.js";
import { getGameMode } from "./modes/index.js";
import { formatOf } from "./formats/index.js";

// Okänt format (session från en nyare klient): ingen ställning, inget result.
const NO_STANDINGS = { classes: [], totalCorrect: 0, leaderIds: [], winnerId: null, draw: false };

const TICK_MS = 250;
// Vänta in svar som committats precis före slutet innan resultatet fryses.
const RESULT_SETTLE_MS = 2500;

/**
 * Prenumerera på en Live-session. Se API ovan.
 * @returns {() => void}
 */
export function subscribeLiveSession(sid, cb, opts = {}) {
  const teacher = opts.teacher !== false;
  const topN = opts.topN ?? 10;
  const onError = opts.onError || ((e) => console.warn("Live-flödet:", e));
  let session;
  let counters = [];
  let players = [];
  let lastKey = "";
  let countersOn = false;
  let closed = false;
  let finishTried = false;
  let resultTimer = 0;
  let endsTried = false;
  const unsubs = [];

  syncLiveClock(opts.uid).then(() => emit(true));

  function compute() {
    const now = serverNow();
    const s = session || null;
    const ph = phaseAt(s, now);
    const fmt = formatOf(s);
    const standings = s && fmt ? fmt.computeStandings(s, { counters, players, now }) : NO_STANDINGS;
    return {
      sessionId: sid,
      session: s,
      status: s?.status || null,
      phase: ph.phase,
      countdown: ph.countdown,
      msLeft: ph.msLeft,
      clock: formatClock(ph.msLeft),
      ...standings,
      top: topPlayers(players, topN),
      result: s?.result || null,
      now,
    };
  }

  function chores(st) {
    if (!st.session) return;
    // Matchslut vid 00:00: lärare direkt, elever med lite spridning (så inte
    // 60 elevdatorer skriver samtidigt – första skrivningen vinner ändå).
    if (st.phase === "ended" && !finishTried) {
      finishTried = true;
      const delay = teacher ? 300 : 1500 + Math.random() * 4000;
      setTimeout(async () => {
        if (closed || session?.status !== "live") return;
        // Nekad (klockan låg lite före servern)? Försök igen om en stund.
        if (!(await autoFinish(sid))) setTimeout(() => { finishTried = false; }, 3000);
      }, delay);
    }
    if (!teacher) return;
    if (st.status === "live" && !st.session.endsAt && !endsTried) {
      endsTried = true;
      fillEndsAt(sid).catch(() => {});
    }
    if (st.phase === "finished" && !st.result && !resultTimer) {
      resultTimer = setTimeout(async () => {
        const fmt = formatOf(session);
        if (closed || session?.result || !fmt) return;
        try {
          // Format som räknar result ur egna dokument (Snilleblixten: sbScores).
          const extra = fmt.resultInputs ? await fmt.resultInputs(session) : undefined;
          if (closed || session?.result) return;
          const final = compute();
          const result = fmt.buildResult(session, final.classes, players, getGameMode(session?.gameMode), extra);
          await writeResultIfMissing(sid, result);
        } catch (err) {
          onError(err);
        }
      }, RESULT_SETTLE_MS);
    }
  }

  function emit(force = false) {
    if (closed || session === undefined) return;
    const st = compute();
    // Rita bara om något syns ändrat (sekund-upplöst klocka, poäng, status …).
    const key = JSON.stringify([st.status, st.phase, st.countdown, st.clock, st.classes, st.top, !!st.result,
      st.session?.classDivisors, st.session?.endsAt?.seconds]);
    chores(st);
    if (!force && key === lastKey) return;
    lastKey = key;
    cb(st);
  }

  unsubs.push(watchSession(sid, (s) => {
    session = s;
    // Klassräknarna (Klassmatchen) – först när formatet är känt.
    if (teacher && s && !countersOn && formatOf(s)?.classCounters) {
      countersOn = true;
      unsubs.push(watchCounters(sid, (docs) => { counters = docs; emit(); }, onError));
    }
    if (s?.status !== "live") finishTried = s?.status === "finished";
    emit(true);
  }, onError));
  if (teacher) unsubs.push(watchPlayers(sid, (docs) => { players = docs; emit(); }, onError));
  const iv = setInterval(() => emit(), TICK_MS);
  const onVis = () => { if (!document.hidden) emit(true); };
  document.addEventListener("visibilitychange", onVis);

  return () => {
    closed = true;
    clearInterval(iv);
    clearTimeout(resultTimer);
    document.removeEventListener("visibilitychange", onVis);
    unsubs.forEach((u) => u());
  };
}
