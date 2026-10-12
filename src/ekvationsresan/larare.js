// ============================================================================
// Ekvationsresan – lärarvyns logik (src/ekvationsresan/larare.js) · #619
// ----------------------------------------------------------------------------
// Spec E1.12. Ren logik (ingen DOM/Firestore) bakom src/teacher-ekvationsresan.js
// och teacher-ekvationsresan-elev.js, testad i test/ekvationsresan-larare.test.js:
//   * klassRader     – en rad per elev ur progressdokumentet (teacherSummary),
//                      inga försök läses (#231)
//   * sorteraRader / nastaSortering – namn, nivå, uppgifter
//   * forsokRader    – de senaste uppgifterna i elevdetaljen
//   * nivaKurva      – nivå + stjärnor över tid (äldst först) för kurvan
//   * rakneGang      – elevens räknegång som MIN LÖSNING-rader (replayRows)
//   * texter för nivåstyrningen (en elev / hela klassen)
//   * #626 (E2.5): varje rad har `fardighet` (sammanfattning.fardighetsbild) –
//     korta sammanfattningar, behärskar/svårt för, problemlösning och
//     färdighetsindikatorer ur färdighetsmodellen i SAMMA progressdokument.
// ============================================================================

import { LEVEL_MIN, LEVEL_MAX, LEVELS, BASE_RULES, rulesForTask } from "./config.js";
import { normalizeProgress, teacherSummary } from "./framsteg.js";
import { replayRows } from "./losning.js";
import { TASK_TYPES, hasSolvePhase, isQuestionType } from "./uppgiftstyper.js";
import { fardighetsbild } from "./sammanfattning.js";

/** Nivåerna läraren kan välja. */
export const NIVAER = LEVELS.map((l) => ({ level: l.level, name: l.name }));
export const NIVA_FEL = `Välj en nivå mellan ${LEVEL_MIN} och ${LEVEL_MAX}.`;

/** Strikt tolkning av ett <select>-värde → nivå eller null. */
export function tolkaNiva(v) {
  const n = typeof v === "number" ? v : /^\d+$/.test(String(v ?? "").trim()) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= LEVEL_MIN && n <= LEVEL_MAX ? n : null;
}

export const nivaNamn = (level) => (LEVELS.find((l) => l.level === level) || {}).name || "";

/** Hjälpkolumnens tooltip – den räknar alla hjälptryck (framsteg.behovdeHjalp, #647). */
export const HJALP_TITEL = "Alla hjälptryck, inklusive Visa lösningen och visade svar";

/**
 * Kolumnerna i klassöversikten. `sort` = går att sortera på (spec: namn, nivå, uppgifter).
 * "I korthet" ligger direkt efter namnet (#647) så att den syns utan sidscroll.
 */
export const KOLUMNER = [
  { key: "namn", label: "Elev", sort: true },
  { key: "korthet", label: "I korthet" }, // #626: färdighetsmodellens sammanfattning
  { key: "level", label: "Nivå", num: true, sort: true },
  { key: "trend", label: "Trend", num: true },
  { key: "tasks", label: "Uppgifter", num: true, sort: true },
  { key: "stars", label: "⭐⭐⭐ / ⭐⭐ / ⭐", num: true },
  { key: "solvedPct", label: "Lösta %", num: true },
  { key: "helpPct", label: "💡 %", num: true, title: HJALP_TITEL },
  { key: "extraMoves", label: "Drag jämfört med optimalt", num: true },
];

export const TREND = {
  up: { sym: "↗", text: "går uppåt" },
  flat: { sym: "→", text: "stabil" },
  down: { sym: "↘", text: "går nedåt" },
};

/**
 * En rad per elev. `entries` = [{ studentId, namn, progress }] där progress är
 * det råa progressdokumentet eller null (har aldrig öppnat Ekvationsresan).
 */
export function klassRader(entries) {
  return (entries || []).map(({ studentId, namn, progress }) => {
    const summary = teacherSummary(progress || null);
    return {
      studentId,
      namn: namn || studentId,
      started: !!progress && normalizeProgress(progress).tasks > 0, // en lärarsatt nivå = inte börjat än
      ...summary,
      fardighet: fardighetsbild(normalizeProgress(progress || null), { solvedPct: summary.solvedPct }),
    };
  });
}

const jamfor = (a, b) => (typeof a === "string" ? a.localeCompare(b, "sv") : a - b);

/** Sortera; lika värden ordnas på namn, ej startade elever sist vid tal-sortering. */
export function sorteraRader(rows, key = "namn", dir = "asc") {
  const sign = dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    if (key !== "namn" && a.started !== b.started) return a.started ? -1 : 1;
    const d = key === "namn" ? 0 : jamfor(a[key] ?? 0, b[key] ?? 0) * sign;
    return d || jamfor(a.namn, b.namn) * (key === "namn" ? sign : 1);
  });
}

/** Nästa sortering vid klick: samma kolumn vänder, ny talkolumn börjar störst först. */
export function nastaSortering(cur, key) {
  if (cur && cur.key === key) return { key, dir: cur.dir === "asc" ? "desc" : "asc" };
  const col = KOLUMNER.find((c) => c.key === key);
  return { key, dir: col && col.num ? "desc" : "asc" };
}

/** "+0,5" / "±0" – extra drag per löst uppgift jämfört med optimalt. null → null. */
export function dragText(extra) {
  if (extra == null) return null;
  if (extra === 0) return "±0";
  return `${extra > 0 ? "+" : "−"}${String(Math.abs(extra)).replace(".", ",")}`;
}

/** Klassens summering ovanför tabellen. */
export function klassSummering(rows) {
  const started = rows.filter((r) => r.started);
  const tasks = started.reduce((s, r) => s + r.tasks, 0);
  const levels = started.map((r) => r.level);
  return {
    started: started.length,
    total: rows.length,
    tasks,
    levelMin: levels.length ? Math.min(...levels) : null,
    levelMax: levels.length ? Math.max(...levels) : null,
  };
}

/** Millisekunder ur ms-tal eller Firestore Timestamp. */
export const ms = (v) => (typeof v === "number" ? v : v && typeof v.toMillis === "function" ? v.toMillis() : null);

/** De senaste uppgifterna (nyast först) som tabellrader i elevdetaljen. */
export function forsokRader(attempts) {
  return (attempts || []).filter(Boolean).map((a) => ({
    id: a.id || a.taskId,
    at: ms(a.completedAt),
    level: a.level,
    stars: Number.isInteger(a.stars) ? a.stars : 0,
    solved: !!a.solved,
    revealed: !!a.revealed,
    moves: Number.isInteger(a.moveCount) ? a.moveCount : (a.moves || []).length,
    optimal: a.optimalMoves ?? null,
    help: Number.isInteger(a.helpMax) ? a.helpMax : 0,
    blocked: Number.isInteger(a.blocked) ? a.blocked : 0,
    extra: !!a.extra, // extrautmaning (#627) – frivillig, påverkar inte nivån
    // Uppgiftstyp (#625): C–E har inga egna drag; C–F har elevens svar.
    type: TASK_TYPES[a.type] ? a.type : "A",
    typeName: TASK_TYPES[a.type]?.name || TASK_TYPES.A.name,
    solvePhase: hasSolvePhase(a.type),
    answers: isQuestionType(a.type) && Array.isArray(a.answers) ? a.answers : null,
  }));
}

/** Elevens svar i C–F som korta rader: "✗ 2x + 16 = 2", "✓ 2x + 2 = 16", "👁 svaret visades". */
export function svarRader(answers) {
  return (answers || []).filter((a) => a && !a.senare && !a.annan).map((a) => (a.visad ? "👁 svaret visades" : `${a.ok ? "✓" : "✗"} ${a.a ?? ""}`));
}

/** Hjälpen som text: 0 → "–", 1–3 = högsta 💡-steget, "Visa lösningen" eget. */
export function hjalpText(row) {
  if (row.revealed) return "Visa lösningen";
  return row.help > 0 ? `💡 steg ${row.help}` : "–";
}

/** Punkterna för nivåkurvan, äldst först: [{ level, stars, at }]. */
export function nivaKurva(attempts) {
  return forsokRader(attempts)
    .filter((r) => Number.isInteger(r.level) && !r.extra)
    .sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
    .map((r) => ({ level: r.level, stars: r.stars, at: r.at }));
}

/**
 * Elevens räknegång som MIN LÖSNING-rader. Vid "Visa lösningen" är de första
 * `moveCount` dragen elevens egna och resten den visade lösningen:
 *   { rows, ownRows } – ownRows = antal rader som hör till elevens egna drag.
 * Trasig data → { rows: [], ownRows: 0, error }.
 */
export function rakneGang(attempt) {
  try {
    const moves = Array.isArray(attempt.moves) ? attempt.moves : [];
    // Försökets egna spärrar: nivå 7–12 och extrautmaningar har minustal,
    // decimaler och bråk som BASE_RULES annars spärrar.
    const rules = attempt.extra || LEVELS.some((l) => l.level === attempt.level) ? rulesForTask(attempt) : BASE_RULES;
    const rows = replayRows(attempt.equation, moves, { rules });
    if (!attempt.revealed) return { rows, ownRows: rows.length };
    const own = Number.isInteger(attempt.moveCount) ? attempt.moveCount : 0;
    return { rows, ownRows: replayRows(attempt.equation, moves.slice(0, own), { rules }).length };
  } catch (err) {
    return { rows: [], ownRows: 0, error: err.message || String(err) };
  }
}

// --- nivåstyrning -------------------------------------------------------------

export const elever = (n) => `${n} ${n === 1 ? "elev" : "elever"}`;
export const genitiv = (name) => (/[sxz]$/i.test(name) ? name : `${name}s`);

export function elevSparadText(name, level) {
  return `✓ Sparat. ${name} får uppgifter på nivå ${level} – ${nivaNamn(level)} – från nästa uppgift.`;
}

export function klassBekraftelse({ className, count, level }) {
  return {
    title: "Ändra nivå för hela klassen?",
    facts: [
      { label: "Klass", value: className },
      { label: "Antal elever", value: elever(count) },
      { label: "Ny nivå", value: `Nivå ${level} – ${nivaNamn(level)}` },
    ],
    body:
      `Alla ${elever(count)} i ${className} får nivå ${level} i Ekvationsresan – även elever som redan är igång. ` +
      "Fönstret med de senaste resultaten nollställs och eleverna får en ny uppgift på nivån. " +
      "Lösta uppgifter, statistik och mynt finns kvar, och du kan ändra enskilda elever efteråt.",
    confirm: `Ja, sätt ${elever(count)} till nivå ${level}`,
  };
}

/** Resultat efter setClassLevel ({ level, updated, failed[] }) → { ok, lines }. */
export function klassResultat(result, className, nameOf = (id) => id) {
  const { level, updated = 0, failed = [] } = result || {};
  const lines = [`${elever(updated)} i ${className} satta till nivå ${level}.`];
  if (failed.length) lines.push(`Misslyckades för ${elever(failed.length)}: ${failed.map((f) => nameOf(f.studentId)).join(", ")}. Försök igen.`);
  return { ok: failed.length === 0, lines };
}

/** Elevens nivåläge i detaljen: "Nivå 3 – Två steg · fönster 2 av 10". */
export function nivaStatus(progress) {
  if (!progress) return "Eleven har inte öppnat Ekvationsresan än och börjar på nivå 1.";
  const p = normalizeProgress(progress);
  const n = p.window.length;
  return n === 0
    ? `Nivå ${p.level} – ${nivaNamn(p.level)}. Inga uppgifter på nivån än (fönstret är tomt).`
    : `Nivå ${p.level} – ${nivaNamn(p.level)}. ${n} ${n === 1 ? "uppgift" : "uppgifter"} på nivån räknas för nästa nivåbyte.`;
}
