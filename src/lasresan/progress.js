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
//     currentTextId, currentStartedAt, lastTextId, updatedAt,
//     pendingLevel, levelSetAt, levelSetBy }      ← lärarstyrd nivå (#505,
//                                                   level-control.js)
// Nivåskalan 1–10 (#519): i MINNET bär level/pendingLevel ny skala och objektet
// har `levelScale: 10`; LAGRAT ligger ny skala i level10/pendingLevel10 och
// level/pendingLevel är en spegel i gammal skala (level-scale.js). Bryggorna
// skriver därför alltid toStoredLasresa(…) – aldrig minnesformen direkt.
// ============================================================================

import { START_LEVEL } from "./config.js";
import { applyResult, normalizeLevel, percent } from "./level.js";
import { completeStep, normalizeProgress } from "./journey.js";
import { mergeCategoryStats } from "./stats.js";
import { coinsFor } from "./rewards.js";
import { applyPendingLevel, effectiveStartLevel, parseTeacherLevel, LEVEL_SET_BY_TEACHER } from "./level-control.js";
import { LEVEL_SCALE, isScaledLasresa, readStoredLevels } from "./level-scale.js";
import { WORLDS, firstWorld } from "./worlds/index.js";

const count = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const idList = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

/**
 * Ny elev: första världen (Skogen), före steg 1, på startnivån (klassens
 * lasresaStartLevel om satt, annars START_LEVEL).
 */
export function defaultLasresa(registry = WORLDS, startLevel = START_LEVEL) {
  const w = firstWorld(registry);
  return {
    level: effectiveStartLevel(startLevel),
    levelScale: LEVEL_SCALE,
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
    pendingLevel: null,
    levelSetAt: null,
    levelSetBy: null,
  };
}

/**
 * Tvätta ett lagrat lasresa-objekt (eller undefined = ny elev) till en
 * komplett form. Okända extra fält behålls (framåtkompatibelt).
 * `startLevel` = klassens startnivå (#505): används BARA när objektet saknas
 * (eleven har inte börjat) eller saknar nivå. En väntande lärarnivå
 * (pendingLevel) läggs på plats direkt om ingen text är påbörjad.
 * Lagrad data migreras till skalan 1–10 (#519, level-scale.readStoredLevels:
 * gammal nivå +3); ett redan normaliserat objekt (`levelScale: 10`) rörs inte.
 */
export function normalizeLasresa(raw, registry = WORLDS, { startLevel = START_LEVEL } = {}) {
  if (!raw || typeof raw !== "object") return defaultLasresa(registry, startLevel);
  const base = defaultLasresa(registry, startLevel);
  const journey = normalizeProgress(raw, registry);
  const lv = isScaledLasresa(raw)
    ? { level: raw.level == null ? null : normalizeLevel(raw.level), pendingLevel: parseTeacherLevel(raw.pendingLevel) }
    : readStoredLevels(raw);
  // eslint-disable-next-line no-unused-vars
  const { level10, pendingLevel10, ...rest } = raw;
  return applyPendingLevel({
    ...base,
    ...rest,
    level: lv.level ?? base.level,
    levelScale: LEVEL_SCALE,
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
    pendingLevel: lv.pendingLevel,
    levelSetAt: Number.isFinite(raw.levelSetAt) ? raw.levelSetAt : null,
    levelSetBy: raw.levelSetBy === LEVEL_SET_BY_TEACHER ? LEVEL_SET_BY_TEACHER : null,
  });
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
  // En väntande lärarnivå gäller från den här texten (den förra är borta).
  const base = applyPendingLevel({ ...lasresa, currentTextId: null });
  return {
    lasresa: { ...base, currentTextId: textId, currentStartedAt: now, updatedAt: now },
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
 * @returns {object} { textId, title, textType, textLevel, levelScale, startedAt, completedAt,
 *   totalQuestions, correct, incorrect, percentage, earnedMoney, perQuestion[], perCategory{} }
 *   `levelScale: 10` = textLevel är på skalan 1–10 (gamla försök saknar den, #519).
 */
export function buildAttempt(text, answers, { startedAt = null, completedAt = Date.now(), studentId = null } = {}) {
  const s = scoreAnswers(text, answers);
  const attempt = {
    textId: text.id,
    title: text.title || text.id,
    textType: text.textType || null,
    textLevel: text.level,
    levelScale: LEVEL_SCALE,
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
 * Har läraren satt en nivå medan texten var påbörjad (pendingLevel) räknas
 * resultatet som vanligt, men nästa text hämtas från lärarens nivå (streaks 0).
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
  const out = applyPendingLevel(next);
  return { lasresa: out, levelChanged: out.level !== cur.level, journey };
}
