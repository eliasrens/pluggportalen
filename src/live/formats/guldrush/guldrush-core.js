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
//   …/grPlayers/{uid}             { gold, correct, incorrect, chests, shield,
//                                 protectedUntil, lastVictimUid, pending,
//                                 lastHit, nextQ? } – bara servern skriver
//   …/grEvents/{id}               händelseflödet (serverstämpel, stabilt id)
//   …/grMeta/leader               vem som leder (ledningsbyte-händelsen)
// Kistorna + spelreglerna: ./delat/ (delas med servern).
//
// API
//   GR_MIN_CLASSES / GR_MAX_CLASSES  1 / 3
//   GR_DURATIONS_MIN      [5, 10, 15, 20]
//   GR_MODES              spellägen servern kan rätta
//   GR_PRIVATE_DOC / GR_PUBLIC_DOC   ["grPrivate","snapshot"] / ["grPublic","questions"]
//   GR_MAX_QUESTIONS      100 (reglerna har samma tak)
//   durationField()       speltiden som setupFields-post
//   validateSetup(input)  → string[]
//   buildSessionFields(input) → { stealSwap, showNames }
//   sessionTitle(s) / defaultSessionName(names)
//   buildQuizPool(mode, quiz, quizSnapshot, rng?, { showPassage? }) → { questions, facit }
//   rankByGold(rows)      → sorterad + rank, DELAD placering (1, 1, 3)
//   computeStandings(s, { players, grPlayers }) → { players, classes, totalGold,
//                           totalCorrect, leaderIds, winnerId, draw }
//   buildResult(s, _classes, players, _mode, { grPlayers, answers?, questions? })
//                         → historikens result (+ perQuestion ur svaren, #566)
//   createEventCursor()   → { take(events) } – nya händelser sedan förra
//                           gången; FÖRSTA anropet = baslinje (efter omladdning
//                           spelas inget gammalt upp, designspec §9)
// ============================================================================

import { withRewards } from "../../live-rewards.js";
import { toMs } from "../../live-time.js";
import { questionStats } from "./gr-historik-data.js";

export const GR_MIN_CLASSES = 1;
export const GR_MAX_CLASSES = 3;
export const GR_DURATIONS_MIN = [5, 10, 15, 20];
export const GR_MODES = ["multiplication_0_10", "plugga_quiz"];
export const GR_PRIVATE_DOC = ["grPrivate", "snapshot"];
export const GR_PUBLIC_DOC = ["grPublic", "questions"];
export const GR_MAX_QUESTIONS = 100;

const QUIZ_MODE = "plugga_quiz";
const int = (v) => Math.max(0, Math.floor(Number(v) || 0));

/** Speltiden – formatets eget durationMin-fält (kärnan lägger då inte till sitt). */
export function durationField() {
  return {
    key: "durationMin", label: "Speltid", kind: "choice", optionsCls: "live-durations",
    options: GR_DURATIONS_MIN.map((m) => ({ value: m, label: `${m} min` })), default: 10,
  };
}

export function validateSetup(input) {
  const errs = [];
  if (!GR_DURATIONS_MIN.includes(Number(input?.durationMin))) errs.push("Välj speltid (5, 10, 15 eller 20 minuter).");
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

/** "4B + 5E" – stor rubrik. */
export function sessionTitle(s) {
  return (s?.participatingClassIds || []).map((id) => s?.classNames?.[id] || id).join(" + ").toUpperCase();
}

/** Förslag på namn: "Guldrushen 4B". */
export function defaultSessionName(names) {
  const n = (names || []).filter(Boolean);
  return n.length ? `Guldrushen ${n.join(" + ")}` : "Guldrushen";
}

/**
 * Quizets frågor som ögonblicksbild (§4.4): questions[i] elevsynligt
 * (grPublic), facit[i] lärar-/serverskyddat (grPrivate). Alternativens
 * ordning blandas en gång här. quizSnapshot = plugga-quiz-core
 * buildQuizSnapshot (injiceras så att kärnan inte laddar quizkoden).
 * showPassage = lärarens ruta "Visa lästext" (session.quiz.showPassage).
 */
export function buildQuizPool(mode, quiz, quizSnapshot, rng = Math.random, { showPassage = false } = {}) {
  const snap = quizSnapshot(quiz || [], { shuffle: true, showPassage, rng });
  const questions = [];
  const facit = [];
  snap.questions.slice(0, GR_MAX_QUESTIONS).forEach((q, i) => {
    questions.push({ ...q, statKeys: mode.statKeys(q) });
    facit.push({ answerIndex: snap.facit[i].answerIndex });
  });
  return { questions, facit };
}

/** Sortera på guld – lika guld = delad placering (1, 1, 3); namn bara för ordningen. */
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
 * Ställningen: alla anslutna elever (players, även 0 guld – sen anslutning
 * startar på 0, §6.9) + guldet ur grPlayers (servern). classes = per klass,
 * med klassens totala guld (§6.8 "Tillsammans samlade 4B …").
 */
export function computeStandings(s, { players = [], grPlayers = [] } = {}) {
  const by = new Map();
  const row = (p) => ({ uid: p.uid, name: p.name || "", classId: p.classId ?? null, gold: 0, correct: 0, incorrect: 0, chests: 0, shield: false, protectedUntil: null });
  for (const p of players || []) if (p?.uid) by.set(p.uid, row(p));
  for (const g of grPlayers || []) {
    if (!g?.uid) continue;
    const r = by.get(g.uid) || row(g);
    Object.assign(r, {
      name: r.name || g.name || "", classId: r.classId ?? g.classId ?? null,
      gold: int(g.gold), correct: int(g.correct), incorrect: int(g.incorrect), chests: int(g.chests),
      shield: !!g.shield, protectedUntil: toMs(g.protectedUntil),
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
 * klassvinnare (winner null) → inga klasspokaler/klassbonus (§7.2.6).
 * classGold = klassens totala guld; Pluggmynt (#557) ur guldet (placering)
 * och rätt svar – bara elever med minst ett svar. perQuestion (#566): andel
 * rätt per fråga (multiplikation: faktorparet) med statKeys + byClass ur
 * svaren (answers, lärarens resultInputs; quiz: questions = grPublic för
 * frågetexten) – utan svar (äldre anrop) saknas fältet.
 */
export function buildResult(s, _classes, players = [], _mode = null, { grPlayers = [], answers = null, questions = null } = {}) {
  const st = computeStandings(s, { players, grPlayers });
  const perQuestion = answers ? { perQuestion: questionStats(answers, { questions, players: st.players }) } : {};
  return withRewards(s, {
    format: "guldrush",
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
 * gamla händelser spelas aldrig upp igen. events = grEvents-dokument med id.
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
