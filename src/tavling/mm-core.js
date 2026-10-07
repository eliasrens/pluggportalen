// ============================================================================
// Mattematchen – ren elevlogik (#458): period-läge, synlighet, Topp 25,
// Klasskamp och elevens egen statistik.
// ----------------------------------------------------------------------------
// Inga DOM-/Firebase-beroenden → testas i Node (test/mm-core.test.js) och kan
// återanvändas av lärarsidan. Datamodellen: docs/DATAMODELL.md
// ("Mattematchen & Live").
//
// API
//   toMs(t)                               → ms (Timestamp | Date | ms | {seconds})
//   competitionPhase(comp, now)           → "kommande"|"aktiv"|"pausad"|"avslutad"
//   activeCompetitionFor(comps, myClassIds, now)
//                                         → { competition, classId } | null
//   nextBoundary(comps, myClassIds, now)  → ms för nästa start/slut (eller null)
//   topList(scores, n = 25)               → [{ rank, uid, name, classId, correct }] (≤ n)
//   classStandings(counters, classes, participatingIds)
//                                         → [{ rank, classId, name, correct, students, score }]
//   statsSummary(stats)                   → { correct, incorrect, total, pctCorrect,
//                                             pctWrong, tables: [{ table, correct, wrong, total, pct }] }
//   formatScore(n)  → "184,7"   formatPct(n) → "94 %"   formatLeft(ms) → "2 dagar"
// ============================================================================

export const TOP_N = 25;
export const TABLES = Array.from({ length: 11 }, (_, i) => i);

/** Firestore-Timestamp, Date, ms eller {seconds,nanoseconds} → ms (NaN om okänt). */
export function toMs(t) {
  if (t == null) return NaN;
  if (typeof t === "number") return t;
  if (t instanceof Date) return t.getTime();
  if (typeof t.toMillis === "function") return t.toMillis();
  if (typeof t.seconds === "number") return t.seconds * 1000 + Math.floor((t.nanoseconds || 0) / 1e6);
  return NaN;
}

/**
 * Visad status (samma definition som DATAMODELL.md): bara "aktiv" godtar svar.
 * @param {{status:string,startAt:*,endAt:*}} comp
 * @param {number} now ms
 */
export function competitionPhase(comp, now) {
  const start = toMs(comp?.startAt);
  const end = toMs(comp?.endAt);
  if (!comp || comp.status === "finished" || !(end > now)) return "avslutad";
  if (comp.status === "stopped") return "pausad";
  if (comp.status !== "active" || !Number.isFinite(start)) return "avslutad";
  return now < start ? "kommande" : "aktiv";
}

/**
 * Elevens aktiva Mattematch: en tävling i läget "aktiv" där någon av elevens
 * klasser deltar. Flera samtidiga → den som startade senast. classId = första
 * av ELEVENS klasser (i klasslistans ordning) som deltar – svaren räknas dit.
 * @param {object[]} comps  [{ id, ...MathCompetition }]
 * @param {string[]} myClassIds
 * @param {number} now
 */
export function activeCompetitionFor(comps, myClassIds, now) {
  let best = null;
  for (const c of Array.isArray(comps) ? comps : []) {
    if (competitionPhase(c, now) !== "aktiv") continue;
    const deltar = Array.isArray(c.participatingClassIds) ? c.participatingClassIds : [];
    const classId = (myClassIds || []).find((id) => deltar.includes(id));
    if (!classId) continue;
    if (!best || toMs(c.startAt) > toMs(best.competition.startAt)) best = { competition: c, classId };
  }
  return best;
}

/** Nästa tidpunkt (ms > now) då någon av elevens tävlingar startar eller slutar. */
export function nextBoundary(comps, myClassIds, now) {
  let next = null;
  for (const c of Array.isArray(comps) ? comps : []) {
    const deltar = Array.isArray(c.participatingClassIds) ? c.participatingClassIds : [];
    if (!(myClassIds || []).some((id) => deltar.includes(id))) continue;
    for (const t of [toMs(c.startAt), toMs(c.endAt)]) {
      if (Number.isFinite(t) && t > now && (next == null || t < next)) next = t;
    }
  }
  return next;
}

/** Placering med delade platser: 1, 2, 2, 4 … (lika värde = samma plats). */
function rank(rows, key) {
  let prev = null;
  rows.forEach((r, i) => {
    r.rank = prev && prev[key] === r[key] ? prev.rank : i + 1;
    prev = r;
  });
  return rows;
}

/**
 * Individuell topplista: EXAKT de n bästa (aldrig fler), flest rätt först;
 * lika → namn i bokstavsordning så listan inte hoppar mellan visningar.
 * @param {object[]} scores  scores-dokument { uid, name, classId, correct }
 */
export function topList(scores, n = TOP_N) {
  const rows = (Array.isArray(scores) ? scores : [])
    .map((s) => ({ uid: s.uid || s.id, name: String(s.name || "Elev"), classId: s.classId || "",
      correct: Math.max(0, Number(s.correct) || 0) }))
    .filter((s) => s.correct > 0)
    .sort((a, b) => b.correct - a.correct || a.name.localeCompare(b.name, "sv"))
    .slice(0, Math.max(0, n));
  return rank(rows, "correct");
}

/**
 * Klasskampen: ALLA deltagande klasser, rätt / klassens elevantal (1 decimal).
 * Klass utan elever får 0 (ingen division med noll). Klass utan svar finns med.
 * @param {object[]} counters  classCounters-shards { classId, correct }
 * @param {object[]} classes   klassdokument { id, name, studentIds }
 * @param {string[]} participatingIds
 */
export function classStandings(counters, classes, participatingIds) {
  const sum = new Map();
  for (const c of Array.isArray(counters) ? counters : []) {
    if (!c?.classId) continue;
    sum.set(c.classId, (sum.get(c.classId) || 0) + Math.max(0, Number(c.correct) || 0));
  }
  const byId = new Map((classes || []).map((k) => [k.id, k]));
  const rows = [...new Set(participatingIds || [])].map((classId) => {
    const k = byId.get(classId);
    const students = Array.isArray(k?.studentIds) ? k.studentIds.length : 0;
    const correct = sum.get(classId) || 0;
    const score = students > 0 ? Math.round((correct / students) * 10) / 10 : 0;
    return { classId, name: String(k?.name || classId), correct, students, score };
  });
  rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "sv"));
  return rank(rows, "score");
}

const pct = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

/**
 * Elevens egen statistik ur studentStats-dokumentet (saknade fält = 0).
 * Per tabell: c{t}/w{t} (7×8 räknas i både 7:an och 8:an).
 * pctWrong = 100 − pctCorrect när eleven svarat (summan blir alltid 100).
 */
export function statsSummary(stats) {
  const s = stats || {};
  const n = (k) => Math.max(0, Number(s[k]) || 0);
  const correct = n("correct");
  const incorrect = n("incorrect");
  const total = correct + incorrect;
  const pctCorrect = pct(correct, total);
  const tables = TABLES.map((t) => {
    const c = n(`c${t}`);
    const w = n(`w${t}`);
    return { table: t, correct: c, wrong: w, total: c + w, pct: pct(c, c + w) };
  });
  return { correct, incorrect, total, pctCorrect, pctWrong: total > 0 ? 100 - pctCorrect : 0, tables };
}

/** 184.7 → "184,7" (alltid 1 decimal, svensk komma). */
export function formatScore(n) {
  return (Number(n) || 0).toFixed(1).replace(".", ",");
}

/** 94 → "94 %" (hårt mellanslag). */
export function formatPct(n) {
  return `${Math.round(Number(n) || 0)} %`;
}

/** Kvarvarande tid i barnvänlig form: "3 dagar", "5 tim", "12 min", "under en minut". */
export function formatLeft(ms) {
  const min = Math.floor(Math.max(0, ms) / 60000);
  if (min < 1) return "under en minut";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} tim`;
  return `${Math.floor(h / 24)} dagar`;
}
