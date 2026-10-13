// ============================================================================
// Kistspel 🎁 – formatets KÄRNA som ren logik (#651, utbruten ur Guldrushens
// guldrush-core.js #563/#566/#589/#601). Ingen DOM, ingen Firebase. Gemensamt
// för alla kistformat (Guldrushen, Datakuppen): speltiden, quizets
// ögonblicksbild, ställningen (saldo = `gold`, delad placering), historikens
// resultat och händelsemarkören. Formatet sätter sina egna ord/id runt det
// (src/live/formats/guldrush/guldrush-core.js).
//
// API
//   KS_DURATIONS_MIN      [3, 5, 10, 15, 20, 30] snabbknappar (+ "Egen tid")
//   KS_CUSTOM_MIN         { min: 1, max: 60 } – "Egen tid", hela minuter
//   KS_MAX_QUESTIONS      100 (reglerna har samma tak)
//   durationField({ durations?, custom? })   speltiden som setupFields-post
//   durationError(v, custom?)                felet | null
//   sessionTitle(s)       "4B + 5E" (versaler)
//   defaultName(prefix, names) → "Guldrushen 4B" | "Guldrushen"
//   buildQuizPool(mode, quiz, quizSnapshot, rng?, { showPassage?, timeline?,
//                 timelineSpan?, max? }) → { questions, facit }
//   rankByGold(rows)      → sorterad + rank, DELAD placering (1, 1, 3)
//   computeStandings(s, { players, grPlayers }) → { players, classes, totalGold,
//                           totalCorrect, leaderIds, winnerId, draw }
//                           (grPlayers = formatets spelardokument, servern skriver)
//   buildResult(format, s, players, { grPlayers, answers?, questions? })
//                         → historikens result (+ perQuestion, pluggmynt)
//   createEventCursor()   → { take(events) } – FÖRSTA anropet = baslinje
// ============================================================================

import { withRewards } from "../live-rewards.js";
import { toMs } from "../live-time.js";
import { questionStats } from "./ks-historik-data.js";

export const KS_DURATIONS_MIN = [3, 5, 10, 15, 20, 30];
export const KS_CUSTOM_MIN = { min: 1, max: 60 };
export const KS_MAX_QUESTIONS = 100;

const int = (v) => Math.max(0, Math.floor(Number(v) || 0));

/**
 * Speltiden – formatets eget durationMin-fält (kärnan lägger då inte till
 * sitt). Snabbknappar + "Egen tid" (#589); validateSetup kontrollerar själv
 * (durationError). Reglerna tar hela minuter 1–60 som durationSeconds.
 */
export function durationField({ durations = KS_DURATIONS_MIN, custom = KS_CUSTOM_MIN } = {}) {
  return {
    key: "durationMin", label: "Speltid", kind: "choice", optionsCls: "live-durations", validate: false,
    options: durations.map((m) => ({ value: m, label: `${m} min` })), default: 10,
    custom: { label: "Egen tid", ...custom, unit: "min" },
  };
}

/** Felet för speltiden (hela minuter min–max) | null. Råsträngar ur "Egen tid" tas också. */
export function durationError(v, { min, max } = KS_CUSTOM_MIN) {
  if (v == null || String(v).trim() === "") return `Skriv in hur många minuter matchen ska vara (${min}–${max}).`;
  const n = typeof v === "number" ? v : /^\s*\d+\s*$/.test(String(v)) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? null : `Speltiden måste vara hela minuter mellan ${min} och ${max}.`;
}

/** "4B + 5E" – stor rubrik. */
export function sessionTitle(s) {
  return (s?.participatingClassIds || []).map((id) => s?.classNames?.[id] || id).join(" + ").toUpperCase();
}

/** Förslag på namn: "<prefix> 4B". */
export function defaultName(prefix, names) {
  const n = (names || []).filter(Boolean);
  return n.length ? `${prefix} ${n.join(" + ")}` : prefix;
}

/**
 * Quizets frågor som ögonblicksbild (§4.4): questions[i] elevsynligt
 * (formatets publika dokument), facit[i] lärar-/serverskyddat (privata).
 * Alternativens ordning blandas en gång här. quizSnapshot = plugga-quiz-core
 * buildQuizSnapshot (injiceras så att kärnan inte laddar quizkoden).
 * timeline/timelineSpan (#601): områdets tidslinjefrågor blandas in – servern
 * rättar dem mot facit { year }.
 */
export function buildQuizPool(mode, quiz, quizSnapshot, rng = Math.random, {
  showPassage = false, timeline = null, timelineSpan = null, max = KS_MAX_QUESTIONS,
} = {}) {
  const opts = { shuffle: true, showPassage, rng };
  if (timeline) Object.assign(opts, { timeline, timelineSpan });
  const snap = quizSnapshot(quiz || [], opts);
  const questions = [];
  const facit = [];
  snap.questions.slice(0, max).forEach((q, i) => {
    questions.push({ ...q, statKeys: mode.statKeys(q) });
    const f = snap.facit[i];
    facit.push(q.kind === "timeline" ? { year: f.year } : { answerIndex: f.answerIndex });
  });
  return { questions, facit };
}

/** Sortera på saldo – lika = delad placering (1, 1, 3); namn bara för ordningen. */
export function rankByGold(rows) {
  const sorted = [...(rows || [])].sort((a, b) =>
    b.gold - a.gold || String(a.name || "").localeCompare(String(b.name || ""), "sv") || String(a.uid).localeCompare(String(b.uid)));
  let rank = 0;
  return sorted.map((p, i) => {
    if (i === 0 || p.gold !== sorted[i - 1].gold) rank = i + 1;
    return { ...p, rank };
  });
}

/**
 * Ställningen: alla anslutna elever (players, även 0 – sen anslutning
 * startar på 0) + saldot ur formatets spelardokument (servern). classes = per
 * klass, med klassens totala saldo.
 */
export function computeStandings(s, { players = [], grPlayers = [] } = {}) {
  const by = new Map();
  const row = (p) => ({ uid: p.uid, name: p.name || "", classId: p.classId ?? null, gold: 0, correct: 0, incorrect: 0, chests: 0, protectedUntil: null });
  for (const p of players || []) if (p?.uid) by.set(p.uid, row(p));
  for (const g of grPlayers || []) {
    if (!g?.uid) continue;
    const r = by.get(g.uid) || row(g);
    Object.assign(r, {
      name: r.name || g.name || "", classId: r.classId ?? g.classId ?? null,
      gold: int(g.gold), correct: int(g.correct), incorrect: int(g.incorrect), chests: int(g.chests),
      protectedUntil: toMs(g.protectedUntil),
    });
    by.set(g.uid, r);
  }
  const ranked = rankByGold([...by.values()]);
  const leaders = ranked.filter((p) => p.rank === 1 && p.gold > 0);
  const classes = (s?.participatingClassIds || []).map((classId) => {
    const mine = ranked.filter((p) => p.classId === classId);
    return {
      classId, name: s?.classNames?.[classId] || classId, joined: mine.length,
      gold: mine.reduce((n, p) => n + p.gold, 0), correct: mine.reduce((n, p) => n + p.correct, 0),
    };
  });
  return {
    players: ranked,
    classes,
    totalGold: ranked.reduce((n, p) => n + p.gold, 0),
    totalCorrect: ranked.reduce((n, p) => n + p.correct, 0),
    leaderIds: leaders.map((p) => p.uid),
    winnerId: leaders.length === 1 ? leaders[0].uid : null,
    draw: leaders.length > 1,
  };
}

/**
 * Historikens ögonblicksbild (liveSessions.result, en gång vid slut). Ingen
 * klassvinnare (winner null) → inga klasspokaler/klassbonus. classGold =
 * klassens totala saldo; Pluggmynt (#557) ur saldot (placering) och rätt
 * svar – bara elever med minst ett svar. perQuestion (#566): andel rätt per
 * fråga ur svaren (utan svar saknas fältet).
 */
export function buildResult(format, s, players = [], { grPlayers = [], answers = null, questions = null } = {}) {
  const st = computeStandings(s, { players, grPlayers });
  const perQuestion = answers ? { perQuestion: questionStats(answers, { questions, players: st.players }) } : {};
  return withRewards(s, {
    format,
    winner: null,
    ranking: st.players.map(({ uid, name, classId, gold, correct, incorrect, chests, rank }) =>
      ({ uid, name, classId, gold, correct, answered: correct + incorrect, chests, rank })),
    totalGold: st.totalGold,
    classGold: Object.fromEntries(st.classes.map((c) => [c.classId, c.gold])),
    totalCorrect: st.totalCorrect,
    players: (players || []).length,
    ...perQuestion,
  }, st.players.map((p) => ({ uid: p.uid, score: p.gold, correct: p.correct, answered: p.correct + p.incorrect })));
}

/**
 * Händelseflödets markör: take(events) → händelser som inte setts förut, äldst
 * först. Första anropet (vyn startar/laddas om) blir baslinjen och ger [] –
 * gamla händelser spelas aldrig upp igen. events = händelsedokument med id.
 */
export function createEventCursor() {
  let seen = null;
  return {
    take(events) {
      const list = (events || []).filter((e) => e?.id);
      if (!seen) {
        seen = new Set(list.map((e) => e.id));
        return [];
      }
      const fresh = list.filter((e) => !seen.has(e.id));
      fresh.forEach((e) => seen.add(e.id));
      return fresh.sort((a, b) => (toMs(a.at) ?? Infinity) - (toMs(b.at) ?? Infinity));
    },
  };
}
