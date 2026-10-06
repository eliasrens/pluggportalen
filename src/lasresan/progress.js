// ============================================================================
// Läsresan – elevens tillstånd och textavslut (src/lasresan/progress.js)
// ----------------------------------------------------------------------------
// Ren kärna bakom Firestore-bryggan src/data-lasresan.js: allt som räknas fram
// i completeText-transaktionen bor här så det kan testas med `node --test`
// (test/lasresan-progress.test.js). Bryggan läser/skriver bara.
//
// studentData.lasresa (se docs/DATAMODELL.md):
//   { level, highStreak, lowStreak,                  ← dold nivå (level.js)
//     worldId, stepInWorld, completedWorlds[],       ← resan (journey.js)
//     totalTexts, totalQuestions, totalCorrect, totalIncorrect, moneyEarned,
//     seenTextIds[], catStats{kategori:{q,correct}},
//     currentTextId, currentStartedAt, lastTextId, updatedAt }
// ============================================================================

import { START_LEVEL } from "./config.js";
import { applyResult, normalizeLevel, percent } from "./level.js";
import { completeStep, normalizeProgress } from "./journey.js";
import { mergeCategoryStats } from "./stats.js";
import { coinsFor } from "./rewards.js";
import { WORLDS, firstWorld } from "./worlds/index.js";

const count = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const idList = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

/** Ny elev: första världen (Skogen), före steg 1, nivå 3. */
export function defaultLasresa(registry = WORLDS) {
  const w = firstWorld(registry);
  return {
    level: START_LEVEL,
    highStreak: 0,
    lowStreak: 0,
    worldId: w ? w.id : null,
    stepInWorld: 0,
    completedWorlds: [],
    totalTexts: 0,
    totalQuestions: 0,
    totalCorrect: 0,
    totalIncorrect: 0,
    moneyEarned: 0,
    seenTextIds: [],
    catStats: {},
    currentTextId: null,
    currentStartedAt: null,
    lastTextId: null,
    updatedAt: null,
  };
}

/**
 * Tvätta ett lagrat lasresa-objekt (eller undefined = ny elev) till en
 * komplett form. Okända extra fält behålls (framåtkompatibelt).
 */
export function normalizeLasresa(raw, registry = WORLDS) {
  if (!raw || typeof raw !== "object") return defaultLasresa(registry);
  const base = defaultLasresa(registry);
  const journey = normalizeProgress(raw, registry);
  return {
    ...base,
    ...raw,
    level: normalizeLevel(raw.level ?? START_LEVEL),
    highStreak: count(raw.highStreak),
    lowStreak: count(raw.lowStreak),
    ...journey,
    totalTexts: count(raw.totalTexts),
    totalQuestions: count(raw.totalQuestions),
    totalCorrect: count(raw.totalCorrect),
    totalIncorrect: count(raw.totalIncorrect),
    moneyEarned: count(raw.moneyEarned),
    seenTextIds: [...new Set(idList(raw.seenTextIds))],
    catStats: raw.catStats && typeof raw.catStats === "object" ? mergeCategoryStats(raw.catStats) : {},
    currentTextId: typeof raw.currentTextId === "string" ? raw.currentTextId : null,
    currentStartedAt: Number.isFinite(raw.currentStartedAt) ? raw.currentStartedAt : null,
    lastTextId: typeof raw.lastTextId === "string" ? raw.lastTextId : null,
  };
}

/**
 * Starta en text. Finns redan en påbörjad text (currentTextId) returneras DEN
 * i stället – en avbruten text återupptas och man kan inte "hoppa" en dålig
 * text genom att ladda om. `force` byter ändå – BARA för fallet att den
 * påbörjade texten inte längre finns i banken (borttagen/omdöpt).
 * @returns {{lasresa:object, textId:string, resumed:boolean}}
 */
export function withStartedText(lasresa, textId, now = Date.now(), { force = false } = {}) {
  if (lasresa.currentTextId && !force) {
    return { lasresa, textId: lasresa.currentTextId, resumed: true };
  }
  return {
    lasresa: { ...lasresa, currentTextId: textId, currentStartedAt: now, updatedAt: now },
    textId,
    resumed: false,
  };
}

/**
 * Rätta elevens svar mot texten. Rättningen görs ALLTID här ur textens
 * answerIndex – UI:t skickar bara vilka alternativ eleven valde.
 * @param {object} text ReadingText
 * @param {{qid:string, chosen:(number|null)}[]} answers `chosen` = index i
 *   textens ORIGINALordning av options (även om UI:t blandar visningen)
 */
export function scoreAnswers(text, answers) {
  const byQid = new Map((answers || []).map((a) => [a && a.qid, a]));
  const perQuestion = [];
  const perCategory = {};
  let correct = 0;
  for (const q of text.questions || []) {
    const a = byQid.get(q.id);
    const chosen = a && Number.isInteger(a.chosen) ? a.chosen : null;
    const ok = chosen !== null && chosen === q.answerIndex;
    if (ok) correct += 1;
    perQuestion.push({ qid: q.id, category: q.category, chosen, correct: ok });
    const c = perCategory[q.category] || { q: 0, correct: 0 };
    perCategory[q.category] = { q: c.q + 1, correct: c.correct + (ok ? 1 : 0) };
  }
  const total = perQuestion.length;
  return { perQuestion, perCategory, correct, total, incorrect: total - correct };
}

/**
 * Bygg ett lasresaAttempts-dokument för en färdig text.
 * @returns {object} { textId, title, textType, textLevel, startedAt, completedAt,
 *   totalQuestions, correct, incorrect, percentage, earnedMoney, perQuestion[], perCategory{} }
 */
export function buildAttempt(text, answers, { startedAt = null, completedAt = Date.now(), studentId = null } = {}) {
  const s = scoreAnswers(text, answers);
  const attempt = {
    textId: text.id,
    title: text.title || text.id,
    textType: text.textType || null,
    textLevel: text.level,
    startedAt: Number.isFinite(startedAt) ? startedAt : null,
    completedAt,
    totalQuestions: s.total,
    correct: s.correct,
    incorrect: s.incorrect,
    percentage: percent(s.correct, s.total),
    earnedMoney: coinsFor(s.correct),
    perQuestion: s.perQuestion,
    perCategory: s.perCategory,
  };
  if (studentId) attempt.studentId = studentId;
  return attempt;
}

/**
 * Applicera ett färdigt försök på elevens lasresa: nivå (dold), ett steg
 * framåt, totaler, sedda texter, kategoristatistik. Rör inget annat.
 * @returns {{
 *   lasresa: object,          // nytt tillstånd att spara
 *   levelChanged: boolean,    // ALDRIG visas för eleven
 *   journey: ReturnType<completeStep>  // walk/worldCompleted/unlockedWorldId
 * }}
 */
export function applyCompletion(lasresa, attempt, registry = WORLDS, now = Date.now()) {
  const cur = normalizeLasresa(lasresa, registry);
  const lvl = applyResult(cur, { correct: attempt.correct, total: attempt.totalQuestions });
  const journey = completeStep(cur, registry);
  const seen = cur.seenTextIds.includes(attempt.textId)
    ? cur.seenTextIds
    : [...cur.seenTextIds, attempt.textId];
  const next = {
    ...cur,
    level: lvl.level,
    highStreak: lvl.highStreak,
    lowStreak: lvl.lowStreak,
    ...journey.progress,
    totalTexts: cur.totalTexts + 1,
    totalQuestions: cur.totalQuestions + attempt.totalQuestions,
    totalCorrect: cur.totalCorrect + attempt.correct,
    totalIncorrect: cur.totalIncorrect + attempt.incorrect,
    moneyEarned: cur.moneyEarned + attempt.earnedMoney,
    seenTextIds: seen,
    catStats: mergeCategoryStats(cur.catStats, attempt.perCategory),
    currentTextId: null,
    currentStartedAt: null,
    lastTextId: attempt.textId,
    updatedAt: now,
  };
  return { lasresa: next, levelChanged: lvl.changed, journey };
}
