// ============================================================================
// Läsresan – statistik (src/lasresan/stats.js)
// ----------------------------------------------------------------------------
// Ren aggregering (ingen DOM/Firestore), testad i test/lasresan-stats.test.js.
// Används av elevens "Min läsning" (UTAN nivå), lärarens klasstabell och
// elevdetalj (MED nivå). Källor:
//   * studentData.lasresa – löpande totaler + catStats (billigt, 1 dokument)
//   * lasresaAttempts[]   – ett försök per text (per text / senaste texter)
// ============================================================================

import { AMNES_SOURCE, CATEGORIES, CATEGORY_LABELS } from "./config.js";
import { percent } from "./level.js";

export { percent };

const num = (v) => (Number.isFinite(v) && v > 0 ? v : 0);

/**
 * Lägg ihop två kategori-maps { kategori: {q, correct} }. Okända kategorier
 * behålls (framtida frågetyper ska inte tappas).
 */
export function mergeCategoryStats(base, add) {
  const out = {};
  for (const src of [base || {}, add || {}]) {
    for (const [cat, v] of Object.entries(src)) {
      const cur = out[cat] || { q: 0, correct: 0 };
      out[cat] = { q: cur.q + num(v && v.q), correct: cur.correct + num(v && v.correct) };
    }
  }
  return out;
}

/**
 * Kategori-map → lista i visningsordning med procent. Kända kategorier först
 * (CATEGORIES-ordning, även de utan frågor → q 0), sedan ev. nya.
 */
export function categoryBreakdown(catStats) {
  const stats = catStats || {};
  const keys = [...CATEGORIES, ...Object.keys(stats).filter((k) => !CATEGORIES.includes(k))];
  return keys.map((category) => {
    const q = num(stats[category] && stats[category].q);
    const correct = num(stats[category] && stats[category].correct);
    return { category, label: CATEGORY_LABELS[category] || category, q, correct, pct: percent(correct, q) };
  });
}

/**
 * Elevens totaler ur studentData.lasresa. `includeLevel` styr om den DOLDA
 * nivån tas med – false för allt eleven ser, true för lärarvyn.
 */
export function summarize(lasresa, { includeLevel = false } = {}) {
  const l = lasresa || {};
  const out = {
    texts: num(l.totalTexts),
    questions: num(l.totalQuestions),
    correct: num(l.totalCorrect),
    incorrect: num(l.totalIncorrect),
    pct: percent(num(l.totalCorrect), num(l.totalQuestions)),
    money: num(l.moneyEarned),
    worldId: l.worldId || null,
    stepInWorld: num(l.stepInWorld),
    completedWorlds: Array.isArray(l.completedWorlds) ? l.completedWorlds : [],
  };
  if (includeLevel) out.level = l.level;
  return out;
}

/**
 * Aggregera en lista försök (lasresaAttempts). Ger totaler, per kategori och
 * per text (en rad per textId: antal försök, senaste och bästa procent).
 */
export function aggregateAttempts(attempts) {
  const list = Array.isArray(attempts) ? attempts : [];
  let questions = 0, correct = 0, money = 0;
  let perCategory = {};
  const perTextMap = new Map();
  for (const a of list) {
    if (!a) continue;
    questions += num(a.totalQuestions);
    correct += num(a.correct);
    money += num(a.earnedMoney);
    perCategory = mergeCategoryStats(perCategory, a.perCategory);
    const row = perTextMap.get(a.textId) || {
      textId: a.textId, title: a.title || a.textId, textLevel: a.textLevel,
      attempts: 0, bestPct: 0, lastPct: 0, lastCompletedAt: 0,
    };
    const pct = Number.isFinite(a.percentage) ? a.percentage : percent(a.correct, a.totalQuestions);
    row.attempts += 1;
    row.bestPct = Math.max(row.bestPct, pct);
    if (num(a.completedAt) >= row.lastCompletedAt) {
      row.lastCompletedAt = num(a.completedAt);
      row.lastPct = pct;
    }
    perTextMap.set(a.textId, row);
  }
  const perText = [...perTextMap.values()].sort((x, y) => y.lastCompletedAt - x.lastCompletedAt);
  return {
    totals: { texts: list.length, questions, correct, incorrect: questions - correct, pct: percent(correct, questions), money },
    perCategory: categoryBreakdown(perCategory),
    perText,
  };
}

/**
 * Rader för lärarens klasstabell. entries = [{ studentId, namn, lasresa }].
 * lasresa null/saknas → eleven har inte börjat (nollor, nivå = null).
 */
export function classRows(entries) {
  return (entries || []).map(({ studentId, namn, lasresa }) => {
    const s = summarize(lasresa, { includeLevel: true });
    return { studentId, namn: namn || studentId, started: !!lasresa, ...s, level: lasresa ? s.level : null };
  });
}

/**
 * Sortera klassrader på en nyckel ("namn", "texts", "pct", "level", …).
 * Saknade värden (t.ex. nivå för elev som inte börjat) hamnar alltid sist.
 */
export function sortRows(rows, key = "namn", dir = "asc") {
  const sign = dir === "desc" ? -1 : 1;
  return [...(rows || [])].sort((a, b) => {
    const x = a[key], y = b[key];
    if (x == null || y == null) return (x == null) - (y == null);
    if (typeof x === "string" || typeof y === "string") {
      return sign * String(x).localeCompare(String(y), "sv");
    }
    return sign * (x - y);
  });
}

// ---------------------------------------------------------------------------
// Källfilter (#674, Ämnesläsning): Alla / Läsresan / Ämnesläsning.
// Läsresans totaler bor i studentData.lasresa, ämnesläsningens i
// studentData.amneslasning.totals (samma fältnamn, denormaliserade i samma
// transaktion som försöket) – så lärartabellen läser fortfarande bara ETT
// dokument per elev. Gamla försök utan `source` räknas som Läsresan.
// ---------------------------------------------------------------------------

export const SOURCE_FILTERS = [
  { key: "alla", label: "Alla" },
  { key: "lasresan", label: "Läsresan" },
  { key: "amnes", label: "Ämnesläsning" },
];
export const DEFAULT_SOURCE_FILTER = "alla";

/** Giltig filternyckel (okänd → "alla"). */
export function parseSourceFilter(v) {
  return SOURCE_FILTERS.some((f) => f.key === v) ? v : DEFAULT_SOURCE_FILTER;
}

const TOTAL_KEYS = ["totalTexts", "totalQuestions", "totalCorrect", "totalIncorrect", "moneyEarned"];

/**
 * Lasresa-format med totalerna för filtret. Läsresans resa/nivå (worldId,
 * level, …) följer alltid med orörd – bara totalerna och catStats byts.
 * `amnesTotals` = studentData.amneslasning.totals (saknas → nollor).
 *   "lasresan" → `lasresa` oförändrad (samma objekt)
 *   "amnes"    → bara ämnestotalerna
 *   "alla"     → summan
 * lasresa null + inga ämnestexter → null (eleven har inte börjat).
 */
export function totalsForSource(lasresa, amnesTotals, source = DEFAULT_SOURCE_FILTER) {
  const f = parseSourceFilter(source);
  if (f === "lasresan") return lasresa || null;
  const a = amnesTotals || {};
  if (!lasresa && !(num(a.totalTexts) > 0)) return null;
  const base = lasresa || {};
  const out = { ...base };
  for (const k of TOTAL_KEYS) out[k] = (f === "alla" ? num(base[k]) : 0) + num(a[k]);
  out.catStats = mergeCategoryStats(f === "alla" ? base.catStats : null, a.catStats);
  return out;
}

/** Försökets källa: "amnes" eller "lasresan" (saknad/okänd source = Läsresan). */
export function attemptSourceKey(attempt) {
  return attempt && attempt.source === AMNES_SOURCE ? "amnes" : "lasresan";
}

/** Försök som hör till filtret ("alla" → alla). */
export function filterAttempts(attempts, source = DEFAULT_SOURCE_FILTER) {
  const f = parseSourceFilter(source);
  const list = (Array.isArray(attempts) ? attempts : []).filter(Boolean);
  return f === "alla" ? list : list.filter((a) => attemptSourceKey(a) === f);
}
