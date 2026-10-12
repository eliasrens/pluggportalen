// ============================================================================
// Ekvationsresan (#619, E1.12): lärarvyns logik – src/ekvationsresan/larare.js.
// Klassöversikten ur progressdokumentet (test 25), sortering, elevdetaljens
// räknegång (replayRows → MIN LÖSNING) och nivåstyrningen (test 24).
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateTask, seededRng } from "../src/ekvationsresan/generator.js";
import { startRun, playMove } from "../src/ekvationsresan/losning.js";
import { fromJSON } from "../src/ekvationsresan/equation.js";
import { taskResult } from "../src/ekvationsresan/resultat.js";
import { revealSolution } from "../src/ekvationsresan/hjalp.js";
import { applyCompletion, buildAttempt, normalizeProgress, teacherSetLevel, TEACHER_LEVEL_FIELDS } from "../src/ekvationsresan/framsteg.js";
import { rowsHtml } from "../src/ekvationsresan/min-losning.js";
import {
  KOLUMNER, klassRader, sorteraRader, nastaSortering, dragText, klassSummering, forsokRader, hjalpText,
  nivaKurva, rakneGang, tolkaNiva, klassBekraftelse, klassResultat, nivaStatus,
} from "../src/ekvationsresan/larare.js";

const rng = seededRng("larare");
let n = 0;

/** Spela en uppgift → försök (som spelvyn sparar det). */
function play(level, { extra = 0, help = 0, reveal = false, at = ++n } = {}) {
  const task = generateTask(level, { rng });
  let run = startRun(fromJSON(task.equation));
  // Omväg: +1 och −1 först (giltiga drag) ger extra drag.
  for (let i = 0; i < extra; i++) run = playMove(playMove(run, "+1").run, "-1").run;
  let own = run.moves.length;
  if (reveal) run = revealSolution(run).run;
  else for (const m of task.optimalPath) run = playMove(run, m).run;
  const result = taskResult(task, run, { maxStep: help });
  return buildAttempt({ id: `t${String(at).padStart(9, "0")}`, task, run, help: { log: Array(help).fill(1) }, result, ownMoves: own, completedAt: at });
}

function student(level, plays) {
  let p = normalizeProgress({ level, maxLevel: level });
  const attempts = [];
  for (const o of plays) {
    const a = play(p.level, o);
    attempts.push(a);
    p = applyCompletion(p, a, { now: a.completedAt }).progress;
  }
  return { progress: p, attempts: attempts.reverse() }; // listAttempts: nyast först
}

test("test 25: klassöversiktens kolumner och värden räknas ur progressdokumentet", () => {
  assert.deepEqual(KOLUMNER.map((c) => c.label), ["Elev", "I korthet", "Nivå", "Trend", "Uppgifter", "⭐⭐⭐ / ⭐⭐ / ⭐", "Lösta %", "💡 %", "Drag jämfört med optimalt"]);
  const a = student(3, [{}, {}, { extra: 1 }, { help: 1 }, { reveal: true }]);
  const rows = klassRader([
    { studentId: "a", namn: "Astrid", progress: a.progress },
    { studentId: "b", namn: "Bo", progress: null },
  ]);
  const [ra, rb] = rows;
  assert.equal(ra.started, true);
  assert.equal(ra.tasks, 5);
  assert.equal(ra.level, 3);
  assert.equal(ra.stars.three, 3, "💡 steg 1 behåller ⭐⭐⭐");
  assert.equal(ra.stars.two, 1, "omvägen (+2 drag) ger ⭐⭐");
  assert.equal(ra.stars.none, 1, "Visa lösningen = ej löst");
  assert.equal(ra.solvedPct, 80);
  assert.equal(ra.helpPct, 40, "💡 % = alla hjälptryck: 💡 och Visa lösningen (#647)");
  assert.equal(ra.extraMoves, 0.5, "2 extra drag / 4 lösta");
  assert.equal(dragText(ra.extraMoves), "+0,5");
  assert.equal(rb.started, false);
  assert.equal(rb.level, 1);
  const satt = klassRader([{ studentId: "c", progress: teacherSetLevel(normalizeProgress(null), 4, 1) }])[0];
  assert.deepEqual([satt.started, satt.level], [false, 4], "lärarsatt nivå utan uppgifter = ej börjat, men nivån syns");
  assert.equal(rb.solvedPct, null);
  assert.deepEqual(klassSummering(rows), { started: 1, total: 2, tasks: 5, levelMin: 3, levelMax: 3 });
});

test("trend: ↗ efter nivå upp, ↘ när poängen sjunker, → annars", () => {
  const up = student(1, [{}, {}, {}, {}, {}]); // 4 × ⭐⭐⭐ → nivå 2
  assert.equal(up.progress.level, 2);
  assert.equal(klassRader([{ studentId: "u", progress: up.progress }])[0].trend, "up");
  const down = student(2, [{}, {}, {}, { reveal: true }, { reveal: true }, { reveal: true }]);
  assert.equal(klassRader([{ studentId: "d", progress: down.progress }])[0].trend, "down");
  assert.equal(klassRader([{ studentId: "f", progress: student(2, [{}, {}]).progress }])[0].trend, "flat");
});

test("sortering: namn (sv), nivå och uppgifter; ej startade sist", () => {
  const rows = [
    { studentId: "1", namn: "Örjan", started: true, level: 2, tasks: 9 },
    { studentId: "2", namn: "Alva", started: false, level: 1, tasks: 0 },
    { studentId: "3", namn: "Bo", started: true, level: 4, tasks: 3 },
    { studentId: "4", namn: "Ärla", started: true, level: 2, tasks: 12 },
  ];
  assert.deepEqual(sorteraRader(rows, "namn", "asc").map((r) => r.namn), ["Alva", "Bo", "Ärla", "Örjan"]);
  assert.deepEqual(sorteraRader(rows, "namn", "desc").map((r) => r.namn), ["Örjan", "Ärla", "Bo", "Alva"]);
  assert.deepEqual(sorteraRader(rows, "level", "desc").map((r) => r.namn), ["Bo", "Ärla", "Örjan", "Alva"]);
  assert.deepEqual(sorteraRader(rows, "tasks", "asc").map((r) => r.namn), ["Bo", "Örjan", "Ärla", "Alva"]);
  assert.deepEqual(nastaSortering({ key: "namn", dir: "asc" }, "tasks"), { key: "tasks", dir: "desc" });
  assert.deepEqual(nastaSortering({ key: "tasks", dir: "desc" }, "tasks"), { key: "tasks", dir: "asc" });
  assert.deepEqual(KOLUMNER.filter((c) => c.sort).map((c) => c.key), ["namn", "level", "tasks"]);
});

test("test 25: elevdetaljen – senaste uppgifterna, kurvan och elevens räknegång", () => {
  const s = student(2, [{}, { extra: 1, help: 2 }, { reveal: true }]);
  const rows = forsokRader(s.attempts);
  assert.equal(rows.length, 3);
  const [rev, omvag, rak] = rows;
  assert.deepEqual([rak.stars, rak.moves, rak.optimal, rak.solved], [3, rak.optimal, rak.optimal, true]);
  assert.equal(omvag.moves, omvag.optimal + 2);
  assert.equal(hjalpText(omvag), "💡 steg 2");
  assert.equal(hjalpText(rev), "Visa lösningen");
  assert.equal(rev.solved, false);
  assert.deepEqual(nivaKurva(s.attempts).map((p) => p.level), [2, 2, 2], "äldst först");

  // Räknegången: elevens faktiska drag (omvägen +1, −1 syns) i MIN LÖSNING-renderaren.
  const g = rakneGang(s.attempts[1]);
  assert.equal(g.ownRows, g.rows.length);
  const html = rowsHtml(g.rows);
  assert.match(html, /ekv-rod/, "elevens operationer i rött");
  assert.ok(g.rows.some((r) => r.kind === "op" && /\+\s*1/.test(r.text)), "omvägen +1 finns med");
  assert.match(g.rows[g.rows.length - 1].text, /^x = /);

  // Visa lösningen: elevens rader först, resten = den visade lösningen.
  const gr = rakneGang(s.attempts[0]);
  assert.ok(gr.ownRows < gr.rows.length);
  assert.equal(rakneGang({ equation: { trasig: true }, moves: [] }).rows.length, 0);
});

test("test 24: nivåstyrning – nollställer fönstret, rör bara nivåfälten", () => {
  const s = student(3, [{}, {}, { reveal: true }]);
  assert.ok(s.progress.window.length > 0);
  const next = teacherSetLevel(s.progress, 5, 99);
  assert.equal(next.level, 5);
  assert.deepEqual(next.window, []);
  assert.equal(next.current, null, "ny uppgift på nivån vid nästa besök");
  const changed = Object.keys(next).filter((k) => JSON.stringify(next[k]) !== JSON.stringify(s.progress[k]));
  assert.ok(changed.every((k) => TEACHER_LEVEL_FIELDS.includes(k)), `bara nivåfält: ${changed}`);
  assert.equal(next.tasks, 3);
  assert.equal(tolkaNiva("4"), 4);
  assert.equal(tolkaNiva("12"), 12);
  assert.equal(tolkaNiva("13"), null);
  assert.equal(tolkaNiva("x"), null);
  assert.match(nivaStatus(next), /fönstret är tomt/);
  assert.match(nivaStatus(null), /inte öppnat/);
  const c = klassBekraftelse({ className: "5A", count: 1, level: 2 });
  assert.equal(c.confirm, "Ja, sätt 1 elev till nivå 2");
  assert.match(c.body, /nollställs/);
  const r = klassResultat({ level: 2, updated: 3, failed: [{ studentId: "x" }] }, "5A", () => "Xena");
  assert.equal(r.ok, false);
  assert.deepEqual(r.lines, ["3 elever i 5A satta till nivå 2.", "Misslyckades för 1 elev: Xena. Försök igen."]);
});

test("bootgrafen: lärarvyns filer laddas bara dynamiskt", () => {
  const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
  const cls = readFileSync(join(SRC, "teacher-class.js"), "utf8");
  assert.match(cls, /import\("\.\/teacher-ekvationsresan\.js"\)/);
  assert.doesNotMatch(cls, /^import .*teacher-ekvationsresan/m);
  for (const f of ["app.js", "teacher-shared.js", "teacher-class.js", "teacher-classes-sections.js"]) {
    assert.doesNotMatch(readFileSync(join(SRC, f), "utf8"), /^\s*import [^(]*["'][^"']*(teacher-ekvationsresan|ekvationsresan\/)/m, f);
  }
});
