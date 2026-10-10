// ============================================================================
// Snilleblixten (#556): POÄNG OCH STÄLLNING – ren logik ur verifierad data
// (serverstämplar + lärarskyddat facit). Lärarklienten kör scoreQuestion vid
// avslöjandet och skriver resultatet till sbScores/{i}; alla vyer räknar
// ställningen ur de dokumenten. Se snilleblixt-core.js för datamodellen.
//
// API
//   SB_MAX_POINTS / SB_MIN_POINTS  1000 / 500
//   pointsFor({ correct, atMs, openedMs, questionSeconds }) → 0 | 500–1000
//                         rätt = round(1000 − 500 × t/frågetid), t klämt 0..frågetid
//   normFree(s)           → jämförelseform för skriv själv ("  056 " → "56")
//   isCorrectAnswer(a, facit, kind) → bool
//   questionWindow(q, questionSeconds) → { startMs, endMs } | null –
//                         [openedAt, min(closedAt, openedAt + frågetid))
//   scoreQuestion({ q, facit, answers, questionSeconds, answerKind, skipped? })
//                         → sbScores-dokumentet { index, skipped, answered,
//                           correctCount, points{uid}, correct{uid},
//                           choiceCounts? (flerval), topWrong? (skriv själv) }
//   rankPlayers(list)     → sorterad, rank med DELAD placering (1, 1, 3)
//   computeStandings(s, { scores, players }) → { players, classes, totalCorrect,
//                           leaderIds, winnerId, draw }
//   buildResult(s, _classes, players, mode, { scores, questions? }) → historikens
//                         result (+ rewards, live-rewards.js #557). questions =
//                         ögonblicksbildens frågor → perQuestion text/statKeys (#560)
// ============================================================================

import { toMs } from "../../live-time.js";
import { withRewards } from "../../live-rewards.js";

export const SB_MAX_POINTS = 1000;
export const SB_MIN_POINTS = 500;

/** Poäng för ett svar (§5.5). Tider i ms ur serverstämplar. */
export function pointsFor({ correct, atMs, openedMs, questionSeconds }) {
  if (!correct) return 0;
  const total = Number(questionSeconds) * 1000;
  if (!(total > 0) || atMs == null || openedMs == null) return 0;
  const t = Math.min(total, Math.max(0, atMs - openedMs));
  return Math.round(SB_MAX_POINTS - (SB_MAX_POINTS - SB_MIN_POINTS) * (t / total));
}

/** Skriv själv: blanksteg bort, gemener, tal utan inledande nollor. */
export function normFree(s) {
  const t = String(s ?? "").normalize("NFC").replace(/\s+/g, "").toLowerCase();
  return /^-?\d+$/.test(t) ? String(Number(t)) : t;
}

/** Är svarsdokumentet rätt mot frågans facit? */
export function isCorrectAnswer(a, facit, kind) {
  if (!a || !facit) return false;
  if (kind === "choice") return Number.isInteger(a.choiceIndex) && a.choiceIndex === facit.answerIndex;
  const given = normFree(a.answer);
  return given !== "" && given === normFree(facit.correctAnswer);
}

/** Frågans svarsfönster i ms: [openedAt, min(closedAt, openedAt + frågetid)). */
export function questionWindow(q, questionSeconds) {
  const startMs = toMs(q?.openedAt);
  if (startMs == null) return null;
  const limit = startMs + Number(questionSeconds) * 1000;
  const closed = toMs(q?.closedAt);
  return { startMs, endMs: closed == null ? limit : Math.min(limit, closed) };
}

/**
 * Frågans poäng ur verifierad data → sbScores/{index}. answers = frågans
 * svarsdokument (alla, lärarens läsning). Svar utanför fönstret räknas inte.
 * skipped = överhoppad fråga: inga poäng, men raden finns för historiken.
 */
export function scoreQuestion({ q, facit, answers = [], questionSeconds, answerKind, skipped = false }) {
  const win = questionWindow(q, questionSeconds);
  const out = {
    index: q.index, skipped: !!skipped, answered: 0, correctCount: 0, points: {}, correct: {},
  };
  const choiceCounts = [0, 0, 0, 0];
  const wrong = new Map();
  for (const a of answers) {
    if (!a || a.q !== q.index || typeof a.uid !== "string") continue;
    const at = toMs(a.at);
    if (!win || at == null || at < win.startMs || at >= win.endMs) continue;
    out.answered++;
    if (answerKind === "choice" && Number.isInteger(a.choiceIndex) && a.choiceIndex < 4) choiceCounts[a.choiceIndex]++;
    if (skipped) continue;
    const ok = isCorrectAnswer(a, facit, answerKind);
    out.correct[a.uid] = ok;
    out.points[a.uid] = pointsFor({ correct: ok, atMs: at, openedMs: win.startMs, questionSeconds });
    if (ok) out.correctCount++;
    else if (answerKind === "free") {
      const k = normFree(a.answer);
      wrong.set(k, (wrong.get(k) || 0) + 1);
    }
  }
  if (answerKind === "choice") out.choiceCounts = choiceCounts;
  // Vanligaste felsvaren (skriv själv, §5.3 steg 6) – utan namn, högst 3.
  if (answerKind === "free") {
    out.topWrong = [...wrong].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "sv"))
      .slice(0, 3).map(([answer, n]) => ({ answer, n }));
  }
  return out;
}

/** Sortera och ge placering – lika poäng = delad placering (1, 1, 3). */
export function rankPlayers(list) {
  const sorted = [...list].sort((a, b) =>
    b.points - a.points || String(a.name || "").localeCompare(String(b.name || ""), "sv") || String(a.uid).localeCompare(String(b.uid)));
  let rank = 0;
  return sorted.map((p, i) => {
    if (i === 0 || p.points !== sorted[i - 1].points) rank = i + 1;
    return { ...p, rank };
  });
}

/**
 * Ställningen: alla anslutna elever (även 0 poäng) + poängen ur sbScores.
 * classes = per deltagande klass (anslutna + klassens poäng) för vyer med
 * flera klasser. winnerId = ensam etta (uid), draw = flera delar 1:a.
 */
export function computeStandings(s, { scores = [], players = [] } = {}) {
  const by = new Map();
  for (const p of players || []) {
    if (p?.uid) by.set(p.uid, { uid: p.uid, name: p.name || "", classId: p.classId, points: 0, correct: 0, answered: 0 });
  }
  for (const sc of scores || []) {
    if (!sc || sc.skipped) continue;
    for (const [uid, pts] of Object.entries(sc.points || {})) {
      const row = by.get(uid) || { uid, name: "", classId: null, points: 0, correct: 0, answered: 0 };
      row.points += Number(pts) || 0;
      row.answered++;
      if (sc.correct?.[uid]) row.correct++;
      by.set(uid, row);
    }
  }
  const ranked = rankPlayers([...by.values()]);
  const leaders = ranked.filter((p) => p.rank === 1 && p.points > 0);
  const classes = (s?.participatingClassIds || []).map((classId) => {
    const mine = ranked.filter((p) => p.classId === classId);
    return {
      classId, name: s?.classNames?.[classId] || classId, joined: mine.length,
      points: mine.reduce((n, p) => n + p.points, 0), correct: mine.reduce((n, p) => n + p.correct, 0),
    };
  });
  return {
    players: ranked,
    classes,
    totalCorrect: ranked.reduce((n, p) => n + p.correct, 0),
    leaderIds: leaders.map((p) => p.uid),
    winnerId: leaders.length === 1 ? leaders[0].uid : null,
    draw: leaders.length > 1,
  };
}

/**
 * Historikens ögonblicksbild (liveSessions.result, skrivs en gång vid slut).
 * Ingen klassvinnare (winner null, inget perClass) → inga klasspokaler/
 * klassbonus/mynt-pris via kc-koppling (§7.2.6). Pluggmynt (#557): rewards
 * {uid: { rank, correct, prize, correctCoins, total }} om sessionen har
 * belöningar – placering ur poängen, bara elever med minst ett räknat svar.
 * perQuestion (#560, andel rätt per fråga): { index, skipped, answered,
 * correct, text?, statKeys?, byClass{classId: { answered, correct }} } –
 * text/statKeys ur ögonblicksbildens frågor (lärarens resultInputs), byClass
 * för Statistik → Live per klass.
 */
export function buildResult(s, _classes, players = [], _mode = null, { scores = [], questions = null } = {}) {
  const st = computeStandings(s, { scores, players });
  const classOf = new Map(st.players.map((p) => [p.uid, p.classId]));
  const perQuestion = [...(scores || [])].sort((a, b) => a.index - b.index).map((sc) => {
    const row = { index: sc.index, skipped: !!sc.skipped, answered: Number(sc.answered) || 0, correct: Number(sc.correctCount) || 0 };
    const q = questions?.[sc.index];
    if (q?.text) row.text = String(q.text).slice(0, 200);
    if (Array.isArray(q?.statKeys)) row.statKeys = q.statKeys.filter((k) => typeof k === "string");
    const byClass = {};
    for (const [uid, ok] of Object.entries(sc.correct || {})) {
      const c = classOf.get(uid);
      if (!c) continue;
      const b = (byClass[c] ||= { answered: 0, correct: 0 });
      b.answered++;
      if (ok) b.correct++;
    }
    row.byClass = byClass;
    return row;
  });
  return withRewards(s, {
    format: "snilleblixt",
    winner: null,
    ranking: st.players.map(({ uid, name, classId, points, correct, answered, rank }) => ({ uid, name, classId, points, correct, answered, rank })),
    perQuestion,
    questionsPlayed: perQuestion.filter((q) => !q.skipped).length,
    totalCorrect: st.totalCorrect,
    players: (players || []).length,
  }, st.players.map((p) => ({ uid: p.uid, score: p.points, correct: p.correct, answered: p.answered })));
}
