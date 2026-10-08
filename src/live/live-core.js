// ============================================================================
// Live-kärnan: ren logik (#460) – faser, nedräkning, tid kvar, klassresultat,
// vinnare, topplista och historik-ögonblicksbild. Ingen DOM, ingen Firebase,
// INGET om multiplikation (allt mode-specifikt går via gameMode-registret).
// Testas i test/live-core.test.js.
//
// Tider in = ms (number) eller Firestore-Timestamp ({ toMillis() }); "now" är
// alltid den server-korrigerade klockan (live-clock.js serverNow()).
//
// API
//   LIVE_DURATIONS_MIN        [5,10,15,20,25,30] – lärarens val av matchlängd
//   LIVE_COUNTDOWN_SECONDS    4  (3 · 2 · 1 · KÖR!) innan svar godtas
//   LIVE_COUNTER_SHARDS       10 shardade klassräknare (40–60 elever)
//   READY_FRESH_MS            75 s – en spelare utan puls längre än så räknas
//                             inte som "redo" i lobbyn
//   toMs(t)                   → ms | null
//   sessionTimes(s)           → { startMs, t0Ms, endMs } (null före start)
//   phaseAt(s, now)           → { phase, countdown, msLeft }
//     phase: "lobby" | "countdown" | "live" | "ended" (tiden ute men status
//     ännu "live") | "finished" | "cancelled" (avbruten i lobbyn)
//     countdown: 3,2,1 eller 0 (= "KÖR!") under "countdown", annars null
//   sumCounters(docs)         → { classId: rätt } ur shardade räknare
//   classStandings(s, correctByClass, players?, now?) → [{ classId, name,
//                             correct, divisor, score, joined, ready }]
//   decideWinner(standings)   → { winnerId|null, draw, leaderIds }
//   topPlayers(players, n)    → [{ uid, name, classId, correct, incorrect }]
//   buildResult(s, standings, players, mode?) → result-map till liveSessions.result
//                             (mode = sessionens GameMode; kooperativt läge →
//                             result.cooperative + result.goalReached, #495)
//   formatScore(n)            → "20,0" (1 decimal, svensk komma)
//   formatClock(ms)           → "12:43"
//   sessionTitle(s)           → "4B MOT 5E" (klassnamn ur classNames)
//   defaultSessionName(names) → "4B mot 5E"
//   validateSessionInput(i)   → string[] fel (tom = ok)
//   buildSessionDoc(i, ctx)   → dokumentet som skapas (status "lobby")
// ============================================================================

export const LIVE_DURATIONS_MIN = [5, 10, 15, 20, 25, 30];
export const LIVE_COUNTDOWN_SECONDS = 4;
export const LIVE_COUNTER_SHARDS = 10;
export const READY_FRESH_MS = 75_000;
export const MAX_LIVE_CLASSES = 8;

/** Timestamp | Date | number → ms (null om saknas). */
export function toMs(t) {
  if (t == null) return null;
  if (typeof t === "number") return Number.isFinite(t) ? t : null;
  if (typeof t.toMillis === "function") return t.toMillis();
  if (t instanceof Date) return t.getTime();
  if (typeof t.seconds === "number") return t.seconds * 1000 + Math.floor((t.nanoseconds || 0) / 1e6);
  return null;
}

/** Officiella tider ur startedAt (endsAt är bara bekvämlighet – reglerna räknar så här). */
export function sessionTimes(s) {
  const startMs = toMs(s?.startedAt);
  if (startMs == null) return { startMs: null, t0Ms: null, endMs: null };
  const t0Ms = startMs + (Number(s.countdownSeconds) || 0) * 1000;
  return { startMs, t0Ms, endMs: t0Ms + (Number(s.durationSeconds) || 0) * 1000 };
}

/** Var är sessionen just nu (mot server-korrigerad tid)? */
export function phaseAt(s, now) {
  const durMs = (Number(s?.durationSeconds) || 0) * 1000;
  if (!s) return { phase: "lobby", countdown: null, msLeft: 0 };
  const { startMs, t0Ms, endMs } = sessionTimes(s);
  if (s.status === "finished") {
    return { phase: startMs == null ? "cancelled" : "finished", countdown: null, msLeft: 0 };
  }
  if (s.status !== "live" || startMs == null) return { phase: "lobby", countdown: null, msLeft: durMs };
  if (now < t0Ms) {
    const rem = Math.ceil((t0Ms - now) / 1000); // 4,3,2,1
    return { phase: "countdown", countdown: Math.max(0, rem - 1), msLeft: durMs };
  }
  if (now < endMs) return { phase: "live", countdown: null, msLeft: endMs - now };
  return { phase: "ended", countdown: null, msLeft: 0 };
}

/** Summera shardade räknare per klass. */
export function sumCounters(docs) {
  const out = {};
  for (const d of docs || []) {
    if (!d || typeof d.classId !== "string") continue;
    out[d.classId] = (out[d.classId] || 0) + (Number(d.correct) || 0);
  }
  return out;
}

/** Klassens nämnare (lärarens val; minst 1 så vi aldrig delar med 0). */
export function divisorFor(s, classId) {
  const n = Math.floor(Number(s?.classDivisors?.[classId]));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/**
 * Ställningen per klass, i sessionens klassordning.
 * @param {object} s sessionen
 * @param {Record<string,number>} correctByClass ur sumCounters
 * @param {object[]} [players] spelardokument (uid, classId, lastSeenAt …)
 * @param {number} [now] för "redo" (färsk puls)
 */
export function classStandings(s, correctByClass = {}, players = [], now = null) {
  return (s?.participatingClassIds || []).map((classId) => {
    const correct = Number(correctByClass[classId]) || 0;
    const divisor = divisorFor(s, classId);
    const mine = (players || []).filter((p) => p && p.classId === classId);
    const ready = now == null
      ? mine.length
      : mine.filter((p) => {
          const seen = toMs(p.lastSeenAt);
          return seen == null || now - seen <= READY_FRESH_MS;
        }).length;
    return {
      classId,
      name: s?.classNames?.[classId] || classId,
      correct,
      divisor,
      score: correct / divisor,
      joined: mine.length,
      ready,
    };
  });
}

/** Vinnare ur ställningen: exakt poäng avgör, lika = oavgjort. */
export function decideWinner(standings) {
  if (!standings?.length) return { winnerId: null, draw: false, leaderIds: [] };
  const best = Math.max(...standings.map((c) => c.score));
  const leaderIds = standings.filter((c) => c.score === best).map((c) => c.classId);
  const draw = leaderIds.length > 1;
  return { winnerId: draw ? null : leaderIds[0], draw, leaderIds };
}

/** Individuell topplista (flest rätt; lika → färre fel, sedan namn). Bara elever med ≥ 1 rätt. */
export function topPlayers(players, n = 10) {
  return (players || [])
    .filter((p) => p && p.uid && Number(p.correct) > 0)
    .map((p) => ({
      uid: p.uid,
      name: p.name || "",
      classId: p.classId,
      correct: Number(p.correct) || 0,
      incorrect: Number(p.incorrect) || 0,
    }))
    .sort((a, b) => b.correct - a.correct || a.incorrect - b.incorrect || a.name.localeCompare(b.name, "sv"))
    .slice(0, n);
}

/** Historikens ögonblicksbild (skrivs till liveSessions.result vid matchslut). */
export function buildResult(s, standings, players = [], mode = null) {
  const { winnerId, draw } = decideWinner(standings);
  const perClass = {};
  for (const c of standings) perClass[c.classId] = { correct: c.correct, divisor: c.divisor, score: c.score, players: c.joined };
  const result = {
    perClass,
    winner: draw ? "draw" : winnerId,
    totalCorrect: standings.reduce((sum, c) => sum + c.correct, 0),
    players: (players || []).length,
  };
  // Kooperativt läge: målet nått eller inte (pokal "live-avklarat"; winner
  // lämnas för vyerna men ger ingen "live-vinst"-pokal).
  if (mode?.cooperative === true && mode.id === s?.gameMode) {
    result.cooperative = true;
    result.goalReached = !!mode.goalReached(standings, s);
  }
  return result;
}

/** 20 → "20,0", 19.04 → "19,0". */
export function formatScore(n) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toFixed(1).replace(".", ",");
}

/** ms → "mm:ss" (avrundat UPPÅT så 00:00 bara visas när tiden är slut). */
export function formatClock(ms) {
  const total = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** "4B MOT 5E" – stor rubrik i lobby/projektor. */
export function sessionTitle(s) {
  const names = (s?.participatingClassIds || []).map((id) => s?.classNames?.[id] || id);
  return names.join(" MOT ").toUpperCase();
}

/** Förslag på matchnamn: "4B mot 5E". */
export function defaultSessionName(names) {
  return (names || []).filter(Boolean).join(" mot ");
}

/**
 * Validera lärarens formulär.
 * input: { name, gameMode, classIds[], durationMin, divisors{classId:n} }
 * @param {object} input
 * @param {{ knownModes?: string[] }} [opts]
 */
export function validateSessionInput(input, opts = {}) {
  const errs = [];
  const name = String(input?.name || "").trim();
  if (!name) errs.push("Ge matchen ett namn.");
  if (name.length > 80) errs.push("Namnet får vara högst 80 tecken.");
  if (!input?.gameMode || (opts.knownModes && !opts.knownModes.includes(input.gameMode))) {
    errs.push("Välj ett spelläge.");
  }
  const ids = input?.classIds || [];
  if (ids.length < 2) errs.push("Välj minst två klasser (klass mot klass).");
  if (ids.length > MAX_LIVE_CLASSES) errs.push(`Högst ${MAX_LIVE_CLASSES} klasser.`);
  if (!LIVE_DURATIONS_MIN.includes(Number(input?.durationMin))) errs.push("Välj matchlängd.");
  for (const id of ids) {
    const n = Number(input?.divisors?.[id]);
    if (!Number.isInteger(n) || n < 1 || n > 999) errs.push(`Nämnaren för ${input?.classNames?.[id] || id} måste vara ett heltal 1–999.`);
  }
  return errs;
}

/**
 * Sessionsdokumentet som skapas (createdAt sätts av anroparen = serverTimestamp).
 * @param {object} input som validateSessionInput (+ classNames)
 * @param {{ uid: string }} ctx
 */
export function buildSessionDoc(input, { uid }) {
  const classIds = [...input.classIds];
  const classDivisors = {};
  const classNames = {};
  for (const id of classIds) {
    classDivisors[id] = Math.floor(Number(input.divisors[id]));
    classNames[id] = String(input.classNames?.[id] || id);
  }
  return {
    name: String(input.name).trim(),
    gameMode: input.gameMode,
    participatingClassIds: classIds,
    classNames,
    classDivisors,
    durationSeconds: Number(input.durationMin) * 60,
    countdownSeconds: LIVE_COUNTDOWN_SECONDS,
    counterShards: LIVE_COUNTER_SHARDS,
    status: "lobby",
    createdBy: uid,
  };
}
