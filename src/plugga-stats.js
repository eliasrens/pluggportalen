// ============================================================================
// Pluggporten – Plugga-statistik per kategori (plugga-stats.js)
// ----------------------------------------------------------------------------
// Epic #444 / issue #445: rena läs-hjälpare (ingen DOM/Firestore) som
// sammanställer en elevs – eller en hel klass – Plugga-progress: genomförda
// övningar, stjärnor, rätt-%, senaste aktivitet, per frågekategori och (för
// gammal data utan kategorier) per spelläge. Testad i test/plugga-stats.test.js.
// Jfr src/teacher-class-stats.js (stjärnor per område) och src/lasresan/stats.js.
//
// Progress-formen (se src/data-progress.js / docs/DATAMODELL.md):
//   progress[areaId][gamemode] = { completed, bestScore, stars, plays, lastPlayed,
//                                  cat?: { [kategori]: { r, t } } }   // cat = #445
//   progress[areaId].reading    = per-text-läsframsteg (#153) – INTE ett spelläge,
//                                 hoppas över här.
// Rätt-% räknas BARA ur `cat` (frågor med kategori). Saknas det (gammal data,
// eller lägen utan kategoriserade frågor) är pct null – använd då perMode
// (stjärnor per spelläge) som fallback.
//
// ⚠️ BOOTGRAF (#271): NY fil – importera den bara dynamiskt eller från moduler
// som själva laddas dynamiskt (se question-categories.js).
// ============================================================================

import { mergeCategoryCounts } from "./exercise-types.js";
import { QUESTION_CATEGORIES } from "./question-categories.js";

/** Max stjärnor per (område × spelläge) – samma tak som teacher-class-stats.js. */
export const MAX_STARS_PER_MODE = 3;

// Nycklar under progress[areaId] som inte är spellägen.
const NON_MODE_KEYS = new Set(["reading"]);

/** Andel rätt i hela procent (0–100), eller null om inget besvarats. */
export function percent(r, t) {
  return t > 0 ? Math.round((100 * r) / t) : null;
}

/**
 * Tolkar ett lastPlayed-fält (Firestore Timestamp, {seconds}, ms-tal eller
 * ISO-sträng) till ett Date, eller null. Lokal kopia av data-progress.js:s
 * toDate – den modulen drar in Firestore-SDK:t och kan inte laddas i Node.
 */
export function toDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000);
  if (typeof ts === "number") return new Date(ts);
  if (typeof ts === "string") {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function later(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return b > a ? b : a;
}

/**
 * Alla (område × spelläge)-noder i ett progress-objekt, ev. filtrerat på områden.
 * @param {object} progress
 * @param {string[]} [areaIds]  bara dessa områden (utelämnat = alla)
 * @returns {Array<{areaId:string, mode:string, node:object}>}
 */
export function exerciseNodes(progress, areaIds) {
  const only = Array.isArray(areaIds) ? new Set(areaIds) : null;
  const out = [];
  for (const [areaId, modes] of Object.entries(progress || {})) {
    if (only && !only.has(areaId)) continue;
    if (!modes || typeof modes !== "object") continue;
    for (const [mode, node] of Object.entries(modes)) {
      if (NON_MODE_KEYS.has(mode) || !node || typeof node !== "object") continue;
      out.push({ areaId, mode, node });
    }
  }
  return out;
}

/**
 * Kategori-map → lista i visningsordning (alla kända kategorier, även de utan
 * svar → t 0, pct null) med etikett/ikon/färg från question-categories.js.
 * @param {object} cat  { [kategori]: { r, t } }
 */
export function categoryBreakdown(cat) {
  const clean = mergeCategoryCounts(cat, null);
  return QUESTION_CATEGORIES.map((c) => {
    const { r, t } = clean[c.key] || { r: 0, t: 0 };
    return { key: c.key, label: c.label, short: c.short, icon: c.icon, color: c.color, hex: c.hex,
      r, t, pct: percent(r, t) };
  });
}

/** Tom ackumulator för en grupp noder (elev, spelläge eller klass). */
function emptyAcc() {
  return { played: 0, completed: 0, stars: 0, maxStars: 0, plays: 0, lastPlayed: null, cat: {} };
}

// `starry` = noden är ett stjärn-läge (#467). Memory/dolda lägen ger varken
// intjänade eller möjliga stjärnor, men räknas som spelade.
function addNode(acc, node, starry = true) {
  acc.played += 1;
  if (node.completed) acc.completed += 1;
  if (starry && typeof node.stars === "number" && node.stars > 0) {
    acc.stars += Math.min(MAX_STARS_PER_MODE, node.stars);
  }
  if (starry) acc.maxStars += MAX_STARS_PER_MODE;
  // Äldre noder saknar plays men är klarade → minst en körning (jfr awardExercise).
  acc.plays += typeof node.plays === "number" ? node.plays : node.completed ? 1 : 0;
  acc.lastPlayed = later(acc.lastPlayed, toDate(node.lastPlayed));
  acc.cat = mergeCategoryCounts(acc.cat, node.cat);
}

function mergeAcc(acc, other) {
  acc.played += other.played;
  acc.completed += other.completed;
  acc.stars += other.stars;
  acc.maxStars += other.maxStars;
  acc.plays += other.plays;
  acc.lastPlayed = later(acc.lastPlayed, other.lastPlayed);
  acc.cat = mergeCategoryCounts(acc.cat, other.cat);
}

/** Ackumulator → publikt sammandrag (totaler + rätt-% + per kategori). */
function finish(acc) {
  let answered = 0;
  let correct = 0;
  for (const v of Object.values(acc.cat)) {
    answered += v.t;
    correct += v.r;
  }
  return {
    played: acc.played,
    completed: acc.completed,
    stars: acc.stars,
    maxStars: acc.maxStars,
    starPct: percent(acc.stars, acc.maxStars),
    plays: acc.plays,
    lastPlayed: acc.lastPlayed,
    answered,
    correct,
    pct: percent(correct, answered),
    hasCategoryData: answered > 0,
    perCategory: categoryBreakdown(acc.cat),
  };
}

/** Per spelläge: Map mode → ackumulator. isStarMode(areaId, mode) → räknas stjärnorna? */
function accByMode(nodes, isStarMode) {
  const byMode = new Map();
  for (const { areaId, mode, node } of nodes) {
    if (!byMode.has(mode)) byMode.set(mode, emptyAcc());
    addNode(byMode.get(mode), node, isStarMode ? isStarMode(areaId, mode) : true);
  }
  return byMode;
}

function perModeList(byMode) {
  return [...byMode.entries()]
    .map(([mode, acc]) => ({ mode, ...finish(acc) }))
    .sort((a, b) => b.played - a.played || a.mode.localeCompare(b.mode));
}

/**
 * Sammanställ EN elevs Plugga-progress.
 * @param {object} progress  studentData.progress
 * @param {{areaIds?: string[], isStarMode?: (areaId:string, mode:string)=>boolean}} [opts]
 *   areaIds = begränsa till vissa områden; isStarMode = bara dessa lägen ger
 *   stjärnor (starScope i teacher-class-stats.js, #467). Utelämnat = alla.
 * @returns {{played:number, completed:number, stars:number, maxStars:number,
 *   starPct:(number|null), plays:number, lastPlayed:(Date|null), answered:number,
 *   correct:number, pct:(number|null), hasCategoryData:boolean,
 *   perCategory:Array, perMode:Array, areas:number}}
 *   maxStars = genomförda övningar × 3 (för områdets MÖJLIGA stjärnor, se
 *   areaMaxStars i teacher-class-stats.js som kräver områdesinnehållet).
 */
export function summarizeStudent(progress, { areaIds, isStarMode } = {}) {
  const nodes = exerciseNodes(progress, areaIds);
  return summaryFrom(nodes, accByMode(nodes, isStarMode));
}

function summaryFrom(nodes, byMode) {
  const total = emptyAcc();
  for (const acc of byMode.values()) mergeAcc(total, acc);
  return {
    ...finish(total),
    perMode: perModeList(byMode),
    areas: new Set(nodes.map((n) => n.areaId)).size,
  };
}

/**
 * Sammanställ en KLASS. entries = [{ studentId, namn, progress }].
 * Elever utan progress räknas med (nollor) men inte som aktiva.
 * @param {Array<{studentId:string, namn?:string, progress?:object}>} entries
 * @param {{areaIds?: string[], isStarMode?: Function}} [opts]  se summarizeStudent
 * @returns {{rows:Array, students:number, activeStudents:number,
 *   totals:object, perCategory:Array, perMode:Array}}
 *   rows = summarizeStudent per elev (+ studentId, namn, active).
 *   totals = hela klassens summor (samma fält som summarizeStudent, utan perMode).
 */
export function summarizeClass(entries, { areaIds, isStarMode } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const total = emptyAcc();
  const classByMode = new Map();
  const rows = list.map(({ studentId, namn, progress }) => {
    const nodes = exerciseNodes(progress, areaIds);
    const byMode = accByMode(nodes, isStarMode);
    for (const [mode, acc] of byMode) {
      if (!classByMode.has(mode)) classByMode.set(mode, emptyAcc());
      mergeAcc(classByMode.get(mode), acc);
      mergeAcc(total, acc);
    }
    const s = summaryFrom(nodes, byMode);
    return { studentId, namn: namn || studentId, active: s.played > 0, ...s };
  });
  const totals = finish(total);
  return {
    rows,
    students: rows.length,
    activeStudents: rows.filter((r) => r.active).length,
    totals,
    perCategory: totals.perCategory,
    perMode: perModeList(classByMode),
  };
}
