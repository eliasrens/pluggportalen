// ============================================================================
// Tester: Ekvationsresan – spelvyns logik, data och modul (#618).
// ----------------------------------------------------------------------------
// Ren logik utan webbläsare: progressdokument/försök (framsteg.js), MIN
// LÖSNING-renderingen (min-losning.js), talfältets text (talfalt.js), mynt per
// nivå (test 22), klassynlighet (test 23) och bootgrafen (107, #271).
// Flödet i webbläsaren (test 26, 27, nivå 1 → 2) verifieras mot emulatorn.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultProgress, normalizeProgress, buildAttempt, applyCompletion, currentTask,
  teacherSetLevel, levelOverview, teacherSummary, trendOf,
} from "../src/ekvationsresan/framsteg.js";
import { generateTask, similarTask, seededRng } from "../src/ekvationsresan/generator.js";
import { startRun, playMove } from "../src/ekvationsresan/losning.js";
import { parseEquation, fromJSON, toJSON } from "../src/ekvationsresan/equation.js";
import { taskResult } from "../src/ekvationsresan/resultat.js";
import { revealSolution } from "../src/ekvationsresan/hjalp.js";
import { rowsHtml } from "../src/ekvationsresan/min-losning.js";
import { withOp, cleanInput } from "../src/ekvationsresan/talfalt.js";
import { modulesHiddenForStudent, moduleForRoute, OPT_IN_MODULES } from "../src/gamemode-visibility.js";

const rng = seededRng("spelvy");

/** Spela en uppgift med givna drag (eller den optimala vägen) → försök. */
function play(task, moves = task.optimalPath, { help = 0, reveal = false } = {}) {
  let run = startRun(fromJSON(task.equation));
  for (const m of moves) run = playMove(run, m).run;
  if (reveal) run = revealSolution(run).run;
  const result = taskResult(task, run, { maxStep: help });
  return { run, result, attempt: buildAttempt({ id: "a".repeat(10), task, run, help: { log: [] }, result, completedAt: 5 }) };
}

test("progress: ny elev = nivå 1, tomt fönster, inga uppgifter; trasiga fält tål vi", () => {
  const p = normalizeProgress(null);
  assert.equal(p.level, 1);
  assert.deepEqual(p.window, []);
  assert.deepEqual(p.stars, [0, 0, 0, 0]);
  const q = normalizeProgress({ level: 99, window: [3, "x", 7, 2], stars: "x", current: { id: "kort" } });
  assert.equal(q.level, 12);
  assert.deepEqual(q.window, [3, 2]);
  assert.equal(q.current, null, "ogiltigt uppgifts-id släpps");
});

test("försöket: strukturerad ekvation, lösning, optimalt, dragen i ordning, stjärnor, hjälp, mynt", () => {
  const task = generateTask(3, { rng });
  const { attempt } = play(task);
  assert.deepEqual(attempt.equation, task.equation);
  assert.deepEqual(attempt.solution, task.solution);
  assert.equal(attempt.optimalMoves, task.optimalMoves);
  assert.equal(attempt.moves.length, task.optimalMoves);
  assert.ok(attempt.moves.every((m) => ["+", "-", "*", "/"].includes(m.op) && Number.isInteger(m.n)));
  assert.equal(attempt.stars, 3);
  assert.equal(attempt.solved, true);
  assert.equal(attempt.coins, 2);
  assert.deepEqual(Object.keys(attempt.skills), ["fokus", "obs"], "färdighetsmodellens observation (#626)");
  assert.equal(JSON.stringify(attempt).includes("undefined"), false);
});

test("test 22: lösta uppgifter på nivå 1, 3 och 5 ger 1, 2 och 3 mynt; Visa lösningen 0", () => {
  for (const [level, coins] of [[1, 1], [3, 2], [5, 3]]) {
    const { result } = play(generateTask(level, { rng }));
    assert.equal(result.coins, coins, `nivå ${level}`);
  }
  const { result } = play(generateTask(3, { rng }), [], { reveal: true });
  assert.equal(result.coins, 0);
  assert.equal(result.solved, false);
});

test("applyCompletion: räknare, stjärnfördelning, mynt, senaste och nästa uppgift", () => {
  const task = generateTask(1, { rng });
  const { attempt } = play(task);
  const next = { id: "b".repeat(10), at: 9, task: generateTask(1, { rng, previous: task }) };
  const r = applyCompletion(defaultProgress(), attempt, { now: 9, next });
  assert.equal(r.progress.tasks, 1);
  assert.equal(r.progress.solved, 1);
  assert.deepEqual(r.progress.stars, [0, 0, 0, 1]);
  assert.equal(r.progress.coins, 1);
  assert.deepEqual(r.progress.window, [3]);
  assert.deepEqual(r.progress.recent, [{ l: 1, s: 3 }]);
  assert.equal(currentTask(r.progress).id, next.id);
  assert.equal(r.change, null);
});

test("hela flödet nivå 1 → 2: fyra ⭐⭐⭐ i rad ger nivå 2, nollställt fönster", () => {
  let p = defaultProgress();
  let change = null;
  let prev = null;
  for (let i = 0; i < 4; i++) {
    const task = generateTask(p.level, { rng, previous: prev });
    prev = task;
    const r = applyCompletion(p, play(task).attempt, { now: i });
    p = r.progress;
    change = r.change;
  }
  assert.equal(change, "up");
  assert.equal(p.level, 2);
  assert.deepEqual(p.window, []);
  assert.equal(p.maxLevel, 2);
  assert.equal(levelOverview(p).map((l) => l.state).join(","), "done,current" + ",locked".repeat(10));
  assert.equal(generateTask(p.level, { rng }).level, 2);
});

test("#643: nådd nivå som eleven åkt ner från visas ✓, bara nivåer över högsta nådda är 🔒", () => {
  const p = normalizeProgress({ level: 2, maxLevel: 4 });
  assert.equal(levelOverview(p).map((l) => l.state).join(","), "done,current,done,done" + ",locked".repeat(8));
  // Äldre dokument utan maxLevel: nuvarande nivå gäller.
  assert.equal(levelOverview({ level: 3 }).map((l) => l.state).join(","), "done,done,current" + ",locked".repeat(9));
  // Nivå ner via anpassningen behåller maxLevel.
  const ner = applyCompletion({ ...normalizeProgress({ level: 3, maxLevel: 3 }), window: [0, 0, 0, 0] }, { level: 3, stars: 0, solved: false, revealed: true, helpMax: 4, moveCount: 0, optimalMoves: 2, coins: 0 }, { now: 1 });
  assert.equal(ner.change, "down");
  assert.equal(ner.progress.maxLevel, 3);
  assert.equal(levelOverview(ner.progress)[2].state, "done");
});

test("ett försök från en annan nivå (läraren flyttade eleven) rör inte fönstret", () => {
  const p = teacherSetLevel(defaultProgress(), 3, 1);
  assert.equal(p.current, null);
  const r = applyCompletion(p, play(generateTask(1, { rng })).attempt, { now: 2 });
  assert.equal(r.progress.level, 3);
  assert.deepEqual(r.progress.window, []);
  assert.equal(r.progress.tasks, 1);
});

test("currentTask: bara om uppgiften hör till elevens nivå", () => {
  const task = generateTask(2, { rng });
  const p = { ...defaultProgress(), current: { id: "c".repeat(10), at: 1, task } };
  assert.equal(currentTask(p), null);
  assert.ok(currentTask({ ...p, level: 2 }));
});

test("Försök igen: liknande uppgift, aldrig samma", () => {
  const task = generateTask(4, { rng });
  const again = similarTask(task, { rng });
  assert.notEqual(again.key, task.key);
  assert.equal(again.level, task.level);
  assert.equal(again.form, task.form);
});

test("lärarsammanfattning och trend", () => {
  assert.equal(trendOf([{ l: 1, s: 3 }, { l: 1, s: 3 }, { l: 2, s: 2 }, { l: 2, s: 3 }]), "up");
  assert.equal(trendOf([{ l: 3, s: 3 }, { l: 3, s: 3 }, { l: 3, s: 0 }, { l: 3, s: 1 }]), "down");
  assert.equal(trendOf([{ l: 3, s: 2 }]), "flat");
  const s = teacherSummary({ ...defaultProgress(), tasks: 4, solved: 3, helpTasks: 1, movesSolved: 8, optimalSolved: 6, stars: [1, 0, 1, 2] });
  assert.equal(s.solvedPct, 75);
  assert.equal(s.helpPct, 25);
  assert.equal(s.extraMoves, 0.7);
  assert.deepEqual(s.stars, { three: 2, two: 1, one: 0, none: 1 });
});

test("MIN LÖSNING: −4 och ÷2 i rött, parentes vid fördelning, aldrig 2x + 4 ÷ 2", () => {
  let run = startRun(parseEquation("2x + 4 = 14"));
  run = playMove(run, "/2").run;
  run = playMove(run, "-2").run;
  const html = rowsHtml(run.rows);
  assert.match(html, /ekv-rod">÷ 2</);
  assert.match(html, /ekv-rod">− 2</);
  assert.match(html, /ekv-s--paren">\(<\/span><span class="ekv-s ekv-s--term">2x<\/span>/, "parentesen tätt intill");
  assert.ok(!run.rows.some((r) => r.text.includes("2x + 4 ÷ 2")));
  assert.equal((html.match(/ekv-rad--nytt-drag/g) || []).length, 2, "varje drag börjar ett nytt stycke");
});

test("MIN LÖSNING: x/4 ritas med bråkstreck, 5 = x får sista raden x = 5", () => {
  const html = rowsHtml(startRun(parseEquation("x/4 = 6")).rows);
  assert.match(html, /ekv-frac"><span>x<\/span><span>4<\/span>/);
  let run = startRun(parseEquation("14 = x + 9"));
  run = playMove(run, "-9").run;
  assert.equal(run.solved, true);
  assert.match(rowsHtml(run.rows), /ekv-rad--final[^>]*aria-label="x = 5"/);
});

test("talfältet: knapparna skriver tecknet först, tangentbordets text rensas", () => {
  assert.equal(withOp("4", "-"), "−4");
  assert.equal(withOp("+4", "/"), "÷4");
  assert.equal(withOp("", "*"), "·");
  assert.equal(cleanInput("-4a "), "-4");
  assert.equal(cleanInput(":2"), ":2");
  assert.equal(cleanInput("1234567890"), "12345678");
});

test("test 23: Ekvationsresan är opt-in – av som standard, på när klassen slår på den", () => {
  assert.ok(OPT_IN_MODULES.includes("ekvationsresan"));
  assert.equal(moduleForRoute("/elev/ekvationsresan"), "ekvationsresan");
  const av = [{ id: "6a", studentIds: ["e1"] }];
  assert.ok(modulesHiddenForStudent(av, "e1").includes("ekvationsresan"));
  const pa = [{ id: "6a", studentIds: ["e1"], enabledModules: ["ekvationsresan"] }];
  assert.ok(!modulesHiddenForStudent(pa, "e1").includes("ekvationsresan"));
  const dold = [{ id: "6a", studentIds: ["e1"], enabledModules: ["ekvationsresan"], hiddenModules: ["ekvationsresan"] }];
  assert.ok(modulesHiddenForStudent(dold, "e1").includes("ekvationsresan"));
});

test("uppgiften kan sparas i Firestore: bara JSON-värden (inga undefined, inga klasser)", () => {
  const task = generateTask(6, { rng });
  assert.deepEqual(JSON.parse(JSON.stringify(task)), task);
  assert.deepEqual(toJSON(fromJSON(task.equation)), task.equation);
});

// --- bootgrafen (#271) -------------------------------------------------------
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
function staticBootGraph() {
  const start = join(SRC, "app.js");
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const file = queue.shift();
    let src;
    try {
      src = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const re = /\b(?:import|export)\s+(?:[\w*{}\s,$]+?\s+from\s+)?["'](\.[^"']+)["']/g;
    let m;
    while ((m = re.exec(src))) {
      const next = resolve(dirname(file), m[1]);
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

test("bootgrafen: Ekvationsresan laddas bara dynamiskt, grafen är kvar på 107", () => {
  const g = staticBootGraph();
  assert.ok(![...g].some((f) => f.includes(`${join(SRC, "ekvationsresan")}`)), "ingen ekvationsresan-fil i bootgrafen");
  assert.equal(g.size, 107);
});

test("Visa lösningen: moves = hela visade räknegången, moveCount = elevens egna drag", () => {
  const task = generateTask(3, { rng });
  let run = startRun(fromJSON(task.equation));
  run = playMove(run, "+1").run;
  const own = run.moves.length;
  run = revealSolution(run).run;
  const result = taskResult(task, run, { maxStep: 0 });
  const a = buildAttempt({ id: "d".repeat(10), task, run, help: { log: [] }, result, ownMoves: own, completedAt: 1 });
  assert.equal(a.moveCount, 1);
  assert.ok(a.moves.length > 1);
  assert.equal(a.revealed, true);
  assert.equal(a.coins, 0);
});
