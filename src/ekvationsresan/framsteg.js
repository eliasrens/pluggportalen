// ============================================================================
// Ekvationsresan – progressdokument och försök (src/ekvationsresan/framsteg.js)
// ----------------------------------------------------------------------------
// #618, spec E1.13. Ren logik (ingen Firebase) – Firestore-bryggan är
// ekv-data.js. Läsresans mönster: ett tillstånd per elev + ett dokument per
// avslutad uppgift, skrivna i EN transaktion.
//
//   studentData/{id}/ekvationsresa/progress            progressdokumentet
//   studentData/{id}/ekvationsresaAttempts/{taskId}    ett försök per uppgift
//
// Progress: nivå + fönster (anpassning.js), räknare, stjärnfördelning, hjälp,
// mynt, de senaste resultaten (lärarens trend) och den PÅGÅENDE uppgiften
// (`current`), så att eleven inte kan "hoppa" en uppgift genom att ladda om.
// Försöket: strukturerad ekvation, lösning, optimalt antal drag, elevens drag
// i ordning (replayRows bygger om räknegången), stjärnor, hjälp och mynt.
// Försökets id = uppgiftens id → samma uppgift kan bara sparas (och ge mynt)
// en gång (create-only i firestore.rules).
// Etapp 2: `skills` (färdighetsmodellen, #626) och `type` C–F ryms utan migrering.
// Försökets `skills` = { fokus, obs } (fardigheter.observera), progressens
// `skills` = modellen (fardigheter.uppdatera) – samma fält som Etapp 1 förberedde.
// C–F (#625) lägger till `answers` (elevens svar i ordning) på försöket; drag
// räknas bara för typer med en lösningsdel (A, B, F).
// Extrautmaningar (#627): egna räknare + egen pågående uppgift i `extra`;
// försöket har `extra: true`. Nivån, fönstret och huvudstatistiken rörs inte.
// ============================================================================

import { LEVEL_MIN, LEVEL_MAX, LEVELS, STAR_POINTS10, FARDIGHET } from "./config.js";
import { recordResult } from "./anpassning.js";
import { observera, uppdatera } from "./fardigheter.js";
import { hasSolvePhase, isQuestionType } from "./uppgiftstyper.js";
import { moveOperand } from "./operations.js";

export const PROGRESS_SCHEMA = 1;
export const ATTEMPT_SCHEMA = 1;
export const RECENT_MAX = 10;
export const TASK_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

const int = (v, min = 0) => (Number.isInteger(v) && v >= min ? v : min);
const clampLevel = (v) => Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, int(v, LEVEL_MIN)));

export function defaultProgress() {
  return {
    schema: PROGRESS_SCHEMA,
    level: LEVEL_MIN,
    window: [], //       stjärnor 0–3 för de senaste uppgifterna på nivån (anpassning.js)
    maxLevel: LEVEL_MIN,
    tasks: 0,
    solved: 0,
    revealed: 0, //      "Visa lösningen"
    stars: [0, 0, 0, 0], // antal uppgifter med 0/1/2/3 stjärnor
    helpTasks: 0, //     uppgifter där 💡 användes (minst steg 1)
    movesSolved: 0, //   summa drag i lösta uppgifter …
    optimalSolved: 0, // … och deras optimala drag (lärarens "drag jämfört med optimalt")
    coins: 0, //         intjänat i Ekvationsresan (saldot är studentData.coins)
    recent: [], //       [{ l: nivå, s: stjärnor }] nyast sist, högst RECENT_MAX
    current: null, //    { id, at, task } – den pågående uppgiften
    skills: {}, //       färdighetsmodellen (E2.4, #626): { [färdighet]: { v, h, n } }
    extra: defaultExtra(), // extrautmaningarna (#627) – påverkar aldrig nivån
    levelChangedAt: null,
    updatedAt: null,
  };
}

/** Extrautmaningarnas del av progress (#627). */
export function defaultExtra() {
  return { tasks: 0, solved: 0, coins: 0, current: null };
}

function normalizeExtra(raw) {
  if (!raw || typeof raw !== "object") return defaultExtra();
  const cur = raw.current;
  return {
    tasks: int(raw.tasks),
    solved: int(raw.solved),
    coins: int(raw.coins),
    current: cur && TASK_ID_RE.test(cur.id || "") && cur.task?.equation && cur.task.extra ? cur : null,
  };
}

/** Läs ett sparat dokument tåligt (saknade/trasiga fält → standard). */
export function normalizeProgress(raw) {
  const d = defaultProgress();
  if (!raw || typeof raw !== "object") return d;
  const level = clampLevel(raw.level);
  const stars = Array.isArray(raw.stars) && raw.stars.length === 4 ? raw.stars.map((n) => int(n)) : d.stars;
  const cur = raw.current;
  return {
    ...d,
    level,
    window: (Array.isArray(raw.window) ? raw.window : []).filter((s) => [0, 1, 2, 3].includes(s)).slice(-10),
    maxLevel: Math.max(level, clampLevel(raw.maxLevel)),
    tasks: int(raw.tasks),
    solved: int(raw.solved),
    revealed: int(raw.revealed),
    stars,
    helpTasks: int(raw.helpTasks),
    movesSolved: int(raw.movesSolved),
    optimalSolved: int(raw.optimalSolved),
    coins: int(raw.coins),
    recent: (Array.isArray(raw.recent) ? raw.recent : []).filter((r) => r && Number.isInteger(r.s)).slice(-RECENT_MAX),
    current: cur && TASK_ID_RE.test(cur.id || "") && cur.task?.equation ? cur : null,
    skills: raw.skills && typeof raw.skills === "object" ? raw.skills : {},
    extra: normalizeExtra(raw.extra),
    levelChangedAt: raw.levelChangedAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
}

/** Den pågående uppgiften om den hör till elevens nivå, annars null. */
export function currentTask(progress) {
  const c = progress.current;
  return c && c.task.level === progress.level ? c : null;
}

/** Sätt en ny pågående uppgift (en extrautmaning hamnar i `extra.current`). */
export function withCurrent(progress, task, { id, at }) {
  if (task.extra) return { ...progress, extra: { ...progress.extra, current: { id, at, task } }, updatedAt: at };
  return { ...progress, current: { id, at, task }, updatedAt: at };
}

/** Den pågående extrautmaningen, eller null. */
export const currentExtra = (progress) => progress.extra?.current || null;

/**
 * Försöksdokumentet för en avslutad uppgift.
 * @param {object} a
 *   a.id, a.startedAt, a.completedAt   uppgiftens id + tider (ms)
 *   a.task    generatorns uppgift
 *   a.run     losning.js-tillståndet (moves i ordning)
 *   a.help    hjalp.js-tillståndet (maxStep, log)
 *   a.result  resultat.taskResult(...)
 *   a.blocked antal spärrade drag (räknas inte som drag)
 *   a.ownMoves elevens egna drag före "Visa lösningen" – `moves` är hela den
 *             räknegång som visades, de första `moveCount` är elevens
 */
export function buildAttempt({ id, task, run, help, result, blocked = 0, ownMoves = null, startedAt = null, completedAt }) {
  // C (Nästa rad) har ingen egen lösning: dragen = räknegången eleven fyllde i.
  const moves = run ? run.moves : task.type === "C" ? task.optimalPath.map((m) => ({ op: m.op, ...moveOperand(m) })) : [];
  const attempt = {
    schema: ATTEMPT_SCHEMA,
    taskId: id,
    level: task.level,
    type: task.type,
    form: task.form,
    equation: task.equation,
    solution: task.solution,
    optimalMoves: task.optimalMoves,
    moves: moves.map((m) => ({ op: m.op, n: m.n, d: m.d, x: m.x })),
    moveCount: result.revealed && Number.isInteger(ownMoves) ? ownMoves : result.moves,
    blocked: int(blocked),
    stars: result.stars,
    solved: result.solved,
    revealed: result.revealed,
    helpMax: result.helpStep,
    helpPresses: Array.isArray(help?.log) ? help.log.length : 0,
    coins: result.coins,
    startedAt,
    completedAt,
  };
  // Elevens svar i C–F: [{ k: frågetyp, a: svaret som text | null, ok, visad? }] (≤ 40).
  if (isQuestionType(task.type)) attempt.answers = Array.isArray(result.answers) ? result.answers.slice(-40) : [];
  // Färdighetsmodellen (#626): vad försöket visar + om uppgiften valdes för att träna en svag färdighet.
  // Extrautmaningar (#627) är frivilliga och räknas inte i modellen (inga observationer).
  attempt.skills = { fokus: task.fokus || null, obs: task.extra ? {} : observera(task, attempt) };
  if (task.extra) attempt.extra = true;
  return attempt;
}

/**
 * Lägg ett försök på en EXTRAUTMANING på progress (#627): bara extra-räknarna
 * och mynten. Nivå, fönster, huvudstatistik och trend rörs inte – läget är
 * frivilligt och krävs aldrig för huvudprogressionen.
 * @returns {{ progress, change: null, from, to }}
 */
export function applyExtraCompletion(progress, attempt, { now, next = null } = {}) {
  const x = progress.extra || defaultExtra();
  const p = {
    ...progress,
    coins: progress.coins + int(attempt.coins),
    extra: { tasks: x.tasks + 1, solved: x.solved + (attempt.solved ? 1 : 0), coins: x.coins + int(attempt.coins), current: next },
    updatedAt: now,
  };
  return { progress: p, change: null, from: p.level, to: p.level };
}

/**
 * En fokusuppgift (vald av färdighetsmodellen för att träna en svag färdighet,
 * #626) som slutar med ⭐ eller ej löst räknas inte i nivåfönstret: eleven ska
 * få fler sådana uppgifter på sin nivå, inte sänkas till lättare ekvationer.
 */
export const skyddadFranFonstret = (attempt) => !!attempt.skills?.fokus && attempt.stars <= FARDIGHET.skyddStjarnor;

/**
 * Lägg ett försök på progressdokumentet. Anpassningen räknas bara om uppgiften
 * hör till elevens nuvarande nivå (läraren kan ha flyttat eleven under tiden)
 * och inte är en misslyckad fokusuppgift (skyddadFranFonstret).
 * Färdighetsmodellen (`skills`) uppdateras alltid.
 * @param {object} progress normalizeProgress-form
 * @param {object} attempt  buildAttempt-form
 * @param {{now:number, next?:{id,at,task}|null}} opts next = nästa pågående uppgift
 * @returns {{ progress, change: "up"|"down"|null, from, to }}
 */
export function applyCompletion(progress, attempt, { now, next = null } = {}) {
  let p = { ...progress };
  let change = null;
  const from = p.level;
  if (attempt.level === p.level && !skyddadFranFonstret(attempt)) {
    const r = recordResult({ level: p.level, window: p.window }, attempt.stars);
    p.level = r.state.level;
    p.window = r.state.window;
    change = r.change;
  }
  const stars = [...p.stars];
  stars[attempt.stars] += 1;
  const countMoves = attempt.solved && hasSolvePhase(attempt.type); // C–E har inga egna drag
  p = {
    ...p,
    maxLevel: Math.max(p.maxLevel, p.level),
    tasks: p.tasks + 1,
    solved: p.solved + (attempt.solved ? 1 : 0),
    revealed: p.revealed + (attempt.revealed ? 1 : 0),
    stars,
    helpTasks: p.helpTasks + (attempt.helpMax > 0 ? 1 : 0),
    movesSolved: p.movesSolved + (countMoves ? attempt.moveCount : 0),
    optimalSolved: p.optimalSolved + (countMoves ? attempt.optimalMoves : 0),
    coins: p.coins + int(attempt.coins),
    recent: [...p.recent, { l: attempt.level, s: attempt.stars }].slice(-RECENT_MAX),
    current: next,
    skills: attempt.skills?.obs ? uppdatera(p.skills, attempt.skills.obs) : p.skills,
    levelChangedAt: change ? now : p.levelChangedAt,
    updatedAt: now,
  };
  return { progress: p, change, from, to: p.level };
}

/** Fälten lärarens nivåändring rör – samma lista som firestore.rules (ekvTeacherLevelOk). */
export const TEACHER_LEVEL_FIELDS = Object.freeze(["level", "window", "maxLevel", "current", "levelChangedAt", "updatedAt"]);

/** Lärarens nivåändring (E1.12): ny nivå, nollställt fönster, ny uppgift. */
export function teacherSetLevel(progress, level, now) {
  const l = clampLevel(level);
  return { ...progress, level: l, window: [], maxLevel: Math.max(progress.maxLevel, l), current: null, levelChangedAt: now, updatedAt: now };
}

// --- för vyerna -------------------------------------------------------------

/** Nivåöversikten (E1.9): 1 ✓ 2 ✓ 3 ● 4 🔒 … */
export function levelOverview(progress) {
  return LEVELS.map(({ level, name }) => ({
    level,
    name,
    state: level < progress.level ? "done" : level === progress.level ? "current" : "locked",
  }));
}

/**
 * Sammanfattningen till lärarens klassöversikt (E1.12) – räknas ur
 * progressdokumentet, inga försök behöver läsas.
 * trend: "up" | "flat" | "down" ur de senaste resultaten (nivå väger tyngst).
 */
export function teacherSummary(progress) {
  const p = normalizeProgress(progress);
  const pct = (a, b) => (b > 0 ? Math.round((100 * a) / b) : null);
  return {
    level: p.level,
    trend: trendOf(p.recent),
    tasks: p.tasks,
    stars: { three: p.stars[3], two: p.stars[2], one: p.stars[1], none: p.stars[0] },
    solvedPct: pct(p.solved, p.tasks),
    helpPct: pct(p.helpTasks, p.tasks),
    extraMoves: p.solved > 0 ? Math.round(((p.movesSolved - p.optimalSolved) / p.solved) * 10) / 10 : null,
    coins: p.coins,
  };
}

/** ↗ / → / ↘: nivåbyte i fönstret avgör, annars poängen i nya mot gamla halvan. */
export function trendOf(recent = []) {
  if (recent.length < 4) return "flat";
  const lvl = recent[recent.length - 1].l - recent[0].l;
  if (lvl) return lvl > 0 ? "up" : "down";
  const half = Math.floor(recent.length / 2);
  const avg = (arr) => arr.reduce((s, r) => s + (STAR_POINTS10[r.s] ?? 0), 0) / arr.length;
  const diff = avg(recent.slice(half)) - avg(recent.slice(0, half));
  return diff >= 2 ? "up" : diff <= -2 ? "down" : "flat";
}
