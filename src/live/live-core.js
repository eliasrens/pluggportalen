// ============================================================================
// Live-kärnan: ren logik (#460) – faser, nedräkning, tid kvar, topplista,
// formulärvalidering och sessionsdokumentet. Ingen DOM, ingen Firebase,
// INGET om multiplikation (allt mode-specifikt går via gameMode-registret)
// och INGET om klass mot klass (allt formatspecifikt – ställning, vinnare,
// nämnare, pris, result – går via formatregistret, src/live/formats/, #547).
// Testas i test/live-core.test.js + test/live-formats.test.js.
//
// Tider in = ms (number) eller Firestore-Timestamp ({ toMillis() }); "now" är
// alltid den server-korrigerade klockan (live-clock.js serverNow()).
//
// API
//   LIVE_DURATIONS_MIN        [5,10,15,20,25,30] – lärarens val av matchlängd
//   LIVE_COUNTDOWN_SECONDS    4  (3 · 2 · 1 · KÖR!) innan svar godtas
//   toMs(t)                   → ms | null (live-time.js)
//   sessionTimes(s)           → { startMs, t0Ms, endMs } (null före start)
//   phaseAt(s, now)           → { phase, countdown, msLeft }
//     phase: "lobby" | "countdown" | "live" | "ended" (tiden ute men status
//     ännu "live") | "finished" | "cancelled" (avbruten i lobbyn)
//     countdown: 3,2,1 eller 0 (= "KÖR!") under "countdown", annars null
//   topPlayers(players, n)    → [{ uid, name, classId, correct, incorrect }]
//   formatScore(n)            → "20,0" (1 decimal, svensk komma)
//   formatClock(ms)           → "12:43"
//   validateSessionInput(i)   → string[] fel (tom = ok) – kärnan + generisk
//                             kontroll av formatets setupFields (#548) + formatets
//                             validateSetup (i.format saknas = Klassmatchen)
//                             + svarssättet (#551): i.answerKind måste stödjas
//                             av BÅDE formatet och spelläget (saknas = förval)
//                             + spellägets setupFields/validateSetup (#553)
//   buildSessionDoc(i, ctx)   → dokumentet som skapas (status "lobby", format
//                             = formatets id, answerKind = "free"|"choice")
//                             + spellägets och formatets buildSessionFields
//
// Re-exporterade Klassmatchen-namn (bakåtkompatibla, logiken i
// formats/klassmatch/klassmatch-core.js): LIVE_COUNTER_SHARDS, READY_FRESH_MS,
// MAX_LIVE_CLASSES, LIVE_PRIZE_MAX, parsePrize, sessionPrize, prizeShare,
// prizeText, sumCounters, divisorFor, classStandings, decideWinner,
// buildResult, sessionTitle, defaultSessionName, DIVISOR_LOCKED_MSG.
// ============================================================================

import { toMs } from "./live-time.js";
import { requireFormat, resolveAnswerKind, DEFAULT_FORMAT } from "./formats/index.js";
import { getGameMode } from "./game-modes.js";
import { LIVE_DURATIONS_MIN, validateSetupFields } from "./live-setup-fields.js";

export { toMs };
// Klassmatchens namn (#547) – logiken bor i formatet; re-exporteras här så
// att befintliga importer (tester, kc-kassa, trollkarl) fungerar oförändrade.
// Ny kod importerar från ./formats/klassmatch/klassmatch-core.js.
export {
  LIVE_COUNTER_SHARDS, READY_FRESH_MS, MAX_LIVE_CLASSES, LIVE_PRIZE_MAX,
  parsePrize, sessionPrize, prizeShare, prizeText, sumCounters, divisorFor,
  classStandings, decideWinner, buildResult, sessionTitle, defaultSessionName, DIVISOR_LOCKED_MSG,
} from "./formats/klassmatch/klassmatch-core.js";

export { LIVE_DURATIONS_MIN };
export const LIVE_COUNTDOWN_SECONDS = 4;

const ORDTAL = ["noll", "en", "två", "tre", "fyra", "fem", "sex", "sju", "åtta"];

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

/**
 * Validera lärarens formulär: kärnan (namn, spelläge, klassantal ur formatets
 * minClasses/maxClasses, matchlängd vid pacing "tid") + formatets validateSetup.
 * input: { name, format?, gameMode, classIds[], durationMin, …formatets fält }
 *   Klassmatchen: divisors{classId:n}, coinPrize?
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
  let fmt;
  try {
    fmt = requireFormat(input?.format ?? DEFAULT_FORMAT);
  } catch {
    return [...errs, "Välj ett format."];
  }
  const ids = input?.classIds || [];
  if (ids.length < fmt.minClasses) {
    const klass = fmt.minClasses === 1 ? "klass" : "klasser";
    const hint = fmt.scope === "mellan-klasser" ? " (klass mot klass)" : "";
    errs.push(`Välj minst ${ORDTAL[fmt.minClasses]} ${klass}${hint}.`);
  }
  if (ids.length > fmt.maxClasses) errs.push(`Högst ${fmt.maxClasses} ${fmt.maxClasses === 1 ? "klass" : "klasser"}.`);
  if (fmt.pacing === "tid" && !LIVE_DURATIONS_MIN.includes(Number(input?.durationMin))) errs.push("Välj matchlängd.");
  if (input?.gameMode && !resolveAnswerKind(fmt, modeOf(input), input.answerKind)) {
    errs.push("Välj ett svarssätt som både formatet och spelläget stöder.");
  }
  const mode = modeOf(input);
  return [
    ...errs, ...validateSetupFields(fmt.setupFields, input), ...fmt.validateSetup(input),
    ...validateSetupFields(mode.setupFields, input), ...(mode.validateSetup?.(input, { format: fmt }) || []),
  ];
}

// Spelläget ur registret (fyllt av modes/index.js, som lärarformuläret laddar).
// Ej registrerat → bara "free" (spelläge utan answerKinds), som förut.
const modeOf = (input) => getGameMode(input?.gameMode) || {};

/**
 * Sessionsdokumentet som skapas (createdAt sätts av anroparen = serverTimestamp).
 * Kärnans fält + `format` + `answerKind` (låst efter start, reglerna) +
 * formatets buildSessionFields (Klassmatchen:
 * classDivisors, counterShards, coinPrize?, wizards?).
 * @param {object} input som validateSessionInput (+ classNames)
 * @param {{ uid: string }} ctx
 */
export function buildSessionDoc(input, { uid }) {
  const fmt = requireFormat(input.format ?? DEFAULT_FORMAT);
  const answerKind = resolveAnswerKind(fmt, modeOf(input), input.answerKind);
  if (!answerKind) throw new Error(`Svarssättet ${input.answerKind} stöds inte av ${fmt.id} + ${input.gameMode}`);
  const classIds = [...input.classIds];
  const classNames = {};
  for (const id of classIds) classNames[id] = String(input.classNames?.[id] || id);
  return {
    name: String(input.name).trim(),
    format: fmt.id,
    gameMode: input.gameMode,
    answerKind,
    participatingClassIds: classIds,
    classNames,
    durationSeconds: Number(input.durationMin) * 60,
    countdownSeconds: LIVE_COUNTDOWN_SECONDS,
    status: "lobby",
    createdBy: uid,
    ...(modeOf(input).buildSessionFields?.(input) || {}),
    ...fmt.buildSessionFields(input),
  };
}
