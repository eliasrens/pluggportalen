// ============================================================================
// Ekvationsresan – extrautmaningar (#627, spec E2.6, E2.7 "Extrautmaningar
// fungerar och krävs inte för huvudprogressionen", "Mynt … extrautmaningar").
// Generering (negativa x, bråk, svårare decimaler, parenteser, kluriga),
// exakt aritmetik, skrivsätt med bråkstreck och parenteser, mynt (7), att
// nivån aldrig påverkas, och att huvudprogressionen aldrig får extrauppgifter.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { EXTRA_FORMS, formsIn, generateExtraTask, similarExtraTask, extraTitle, extraUnlocked, seededRng } from "../src/ekvationsresan/extra.js";
import { EXTRA, EXTRA_RULES, COINS, LEVELS, rulesFor, rulesForTask } from "../src/ekvationsresan/config.js";
import { generateTask } from "../src/ekvationsresan/generator.js";
import { fromJSON, toJSON, parseEquation, solve, withParens, equationKey } from "../src/ekvationsresan/equation.js";
import { startRun, playMove, replayRows } from "../src/ekvationsresan/losning.js";
import { equationRow } from "../src/ekvationsresan/notation.js";
import { parseOperand } from "../src/ekvationsresan/operand.js";
import { moveOperand } from "../src/ekvationsresan/operations.js";
import { formatSv, isInteger, isDecimal, eq as same, toQ } from "../src/ekvationsresan/rational.js";
import { taskResult } from "../src/ekvationsresan/resultat.js";
import { coinsFor } from "../src/ekvationsresan/mynt.js";
import { rowsHtml } from "../src/ekvationsresan/min-losning.js";
import { overviewHtml } from "../src/ekvationsresan/spelvy-html.js";
import { rakneGang } from "../src/ekvationsresan/larare.js";
import {
  defaultProgress, normalizeProgress, buildAttempt, applyCompletion, applyExtraCompletion,
  withCurrent, currentTask, currentExtra, levelOverview,
} from "../src/ekvationsresan/framsteg.js";

const PER_FORM = 150;

/** Kör den optimala vägen som eleven skulle: varje drag som TEXT i talfältet. */
function solveByTyping(task) {
  let run = startRun(fromJSON(task.equation), { rules: rulesForTask(task) });
  for (const step of task.optimalPath) {
    const o = moveOperand(step);
    const text = { "+": "+", "-": "-", "*": "*", "/": "/" }[step.op] + formatSv(toQ(o)).replace("−", "") + (o.x ? "x" : "");
    const r = playMove(run, text.replace(/^([+\-*/])1x$/, "$1x"));
    assert.equal(r.outcome.kind, "move", `${task.text}: "${text}" gick inte (${r.outcome.message || r.outcome.kind})`);
    run = r.run;
  }
  return run;
}

// --- generering ---------------------------------------------------------------

test("varje form: exakt lösning, optimum = formens, inga dubbletter i följd, allt går att skriva", () => {
  const rng = seededRng("extra-former");
  for (const [id, form] of Object.entries(EXTRA_FORMS)) {
    let prev = null;
    for (let i = 0; i < PER_FORM; i++) {
      const t = generateExtraTask({ rng, form: id, level: 9, previous: prev });
      assert.equal(t.extra, true);
      assert.equal(t.form, id);
      assert.equal(t.category, form.category);
      assert.equal(t.level, 9, "elevens nivå följer med som sammanhang");
      assert.notEqual(t.key, prev?.key);
      const eq = fromJSON(t.equation);
      assert.ok(same(solve(eq), toQ(t.solution)), `${t.text}: lösningen stämmer exakt`);
      assert.equal(t.optimalMoves, form.moves, `${id}: ${t.text}`);
      const run = solveByTyping(t);
      assert.ok(run.solved, `${t.text} löses av den optimala vägen`);
      assert.ok(same(run.value, toQ(t.solution)));
      prev = t;
    }
  }
});

test("kategorierna: negativa x, äkta bråk, decimaler med två siffror, parenteser", () => {
  const rng = seededRng("extra-kategorier");
  for (const id of formsIn("negativ")) {
    for (let i = 0; i < 50; i++) assert.ok(generateExtraTask({ rng, form: id }).solution.n < 0, `${id}: x < 0`);
  }
  for (const id of ["ax=b:frac", "ax+b=c:frac"]) {
    for (let i = 0; i < 50; i++) {
      const x = toQ(generateExtraTask({ rng, form: id }).solution);
      assert.ok(!isInteger(x) && !isDecimal(x, 2), `${id}: ${formatSv(x)} är ett äkta bråk`);
    }
  }
  for (const id of ["ax/b=c", "ax/b+c=d"]) {
    const t = generateExtraTask({ rng, form: id });
    assert.match(t.text, /^\dx\/\d/, `${id}: koefficienten skrivs med bråkstreck (${t.text})`);
  }
  for (const id of formsIn("decimal")) {
    const t = generateExtraTask({ rng, form: id });
    assert.match(t.text, /\d,\d\dx|\d,\d/, `${id}: decimaltal (${t.text})`);
  }
  for (const id of formsIn("parentes")) assert.match(generateExtraTask({ rng, form: id }).text, /^\d\(x [+−] \d+\)/);
  assert.match(generateExtraTask({ rng, form: "a(x+b)=c(x-d)" }).text, /^\d\(x \+ \d+\) = \d\(x − \d+\)$/);
  // Alla kategorier i config har minst en form, och slumpen når alla.
  const seen = new Set(Array.from({ length: 200 }, () => generateExtraTask({ rng }).category));
  assert.deepEqual([...seen].sort(), Object.keys(EXTRA.categories).sort());
});

test("similarExtraTask: samma form, ny ekvation och ny lösning", () => {
  const rng = seededRng("extra-liknande");
  for (const id of Object.keys(EXTRA_FORMS)) {
    const t = generateExtraTask({ rng, form: id });
    const s = similarExtraTask(t, { rng });
    assert.equal(s.form, id);
    assert.equal(s.extra, true);
    assert.notEqual(s.key, t.key);
    assert.ok(!same(toQ(s.solution), toQ(t.solution)));
  }
});

test("huvudprogressionen får aldrig extrauppgifter och har inte bråk på", () => {
  const rng = seededRng("extra-huvud");
  for (const { level } of LEVELS) {
    assert.equal(rulesFor(level).allowFractions, false);
    for (let i = 0; i < 30; i++) {
      const t = generateTask(level, { rng });
      assert.equal(t.extra, undefined);
      assert.equal(t.equation.parens, undefined);
      assert.deepEqual({ ...rulesForTask(t) }, { ...rulesFor(level) });
    }
  }
  assert.equal(rulesForTask({ extra: true, level: 3 }), EXTRA_RULES);
});

// --- skrivsätt ---------------------------------------------------------------------

const play = (eq, moves) => {
  let run = startRun(eq, { rules: EXTRA_RULES });
  for (const m of moves) run = playMove(run, m).run;
  return run;
};
const texts = (run) => run.rows.map((r) => r.text);

test("skrivsätt: parentes i uppgiften, elevens operation efter parentesen", () => {
  const eq = withParens(parseEquation("3x + 6 = 21"), { left: 3 });
  assert.equal(equationRow(eq, "start").text, "3(x + 2) = 21");
  assert.deepEqual(texts(play(eq, ["/3", "-2"])), [
    "3(x + 2) = 21",
    "3(x + 2) ÷ 3 = 21 ÷ 3",
    "x + 2 = 7",
    "x + 2 − 2 = 7 − 2",
    "x = 5",
  ]);
  // Utvecklar eleven i stället (−6 först) blir det lika rätt.
  assert.deepEqual(texts(play(eq, ["-6", "/3"])).slice(0, 3), ["3(x + 2) = 21", "3(x + 2) − 6 = 21 − 6", "3x = 15"]);
  // x − b och parentes i båda leden.
  assert.equal(equationRow(withParens(parseEquation("4x − 12 = 20"), { left: 4 }), "start").text, "4(x − 3) = 20");
  const two = withParens(parseEquation("3x + 12 = 5x − 10"), { left: 3, right: 5 });
  assert.equal(equationRow(two, "start").text, "3(x + 4) = 5(x − 2)");
  assert.deepEqual(texts(play(two, ["-3x"])).slice(1), ["3(x + 4) − 3x = 5(x − 2) − 3x", "12 = 2x − 10"]);
  // Ingen mellanrumsparentes i häftet: "3(x + 2)" ritas tätt.
  assert.match(rowsHtml(play(eq, []).rows), /3\(<\/span><span class="ekv-s ekv-s--term">x/);
});

test("skrivsätt: bråk med bråkstreck, negativa x med U+2212, decimaler med komma", () => {
  const frac = play(parseEquation("3x = 5"), ["/3"]);
  assert.deepEqual(texts(frac), ["3x = 5", "3x ÷ 3 = 5 ÷ 3", "x = 5/3"]);
  const last = frac.rows.at(-1).segments.at(-1);
  assert.equal(last.num, "5");
  assert.equal(last.den, "3");
  assert.match(rowsHtml(frac.rows), /ekv-frac"><span>5<\/span><span>3<\/span>/);
  assert.equal(equationRow(parseEquation("x = -5/7")).segments.at(-1).num, "−5");

  const twoThirds = play(fromJSON(generateExtraTask({ rng: seededRng("2x3"), form: "ax/b=c" }).equation), []);
  const seg = twoThirds.rows[0].segments[0];
  assert.ok(seg.num?.endsWith("x") && seg.den, "2x/3 har bråkstreck");

  assert.deepEqual(texts(play(parseEquation("x + 9 = 4"), ["-9"])), ["x + 9 = 4", "x + 9 − 9 = 4 − 9", "x = −5"]);
  assert.deepEqual(texts(play(parseEquation("1,25x + 0,75 = 5,75"), ["-0,75", "/1,25"])).slice(-1), ["x = 4"]);
  // Exakt: 0,1 + 0,2 blir aldrig 0,30000000000000004.
  assert.deepEqual(texts(play(parseEquation("x - 0,2 = 0,1"), ["+0,2"])).at(-1), "x = 0,3");
});

test("parentesen följer med JSON (Firestore) och syns i lärarens räknegång", () => {
  const t = generateExtraTask({ rng: seededRng("json"), form: "a(x+b)=c" });
  assert.deepEqual(Object.keys(t.equation.parens), ["left"]);
  const back = fromJSON(JSON.parse(JSON.stringify(t.equation)));
  assert.equal(equationRow(back, "start").text, t.text);
  assert.equal(equationKey(back), t.key);
  assert.deepEqual(Object.keys(toJSON(parseEquation("2x + 4 = 14"))), ["left", "right"], "vanliga ekvationer oförändrade");
  assert.throws(() => withParens(parseEquation("3x = 21"), { left: 3 }), /parentes/);

  const run = solveByTyping(t);
  const attempt = buildAttempt({ id: "aqa0000000000000000001", task: t, run, help: { log: [] }, result: taskResult(t, run), completedAt: 2 });
  assert.equal(attempt.extra, true);
  const g = rakneGang(attempt);
  assert.equal(g.error, undefined);
  assert.equal(g.rows[0].text, t.text);
  assert.deepEqual(g.rows.map((r) => r.text), run.rows.map((r) => r.text));
  // Nivå 9 med minustal på vägen räknas nu också om med nivåns spärrar.
  assert.equal(replayRows(parseEquation("2x - 4 = 4x - 18"), [{ op: "-", n: 4, d: 1, x: 1 }], { rules: rulesFor(9) }).at(-1).text, "−2x − 4 = −18");
});

// --- mynt och progression ------------------------------------------------------------

test("mynt: 7 per löst extrautmaning (konfig), 0 vid Visa lösningen", () => {
  assert.equal(COINS.extraChallenge, 7);
  const t = generateExtraTask({ rng: seededRng("mynt"), level: 12 });
  const run = solveByTyping(t);
  assert.equal(taskResult(t, run).coins, 7);
  assert.equal(taskResult(t, { ...run, revealed: true }).coins, 0);
  assert.equal(coinsFor(12, { solved: true }), 6, "nivå 12 i huvudprogressionen ger fortfarande 6");
});

test("en extrautmaning ändrar aldrig nivå, fönster eller huvudstatistik – bara extra + mynt", () => {
  const t = generateExtraTask({ rng: seededRng("prog"), level: 8 });
  const run = solveByTyping(t);
  const attempt = buildAttempt({ id: "aqa0000000000000000002", task: t, run, help: { log: [] }, result: taskResult(t, run), completedAt: 5 });
  const base = normalizeProgress({ ...defaultProgress(), level: 8, maxLevel: 8, window: [3, 3, 3], tasks: 20, solved: 18, coins: 40, recent: [{ l: 8, s: 3 }] });
  let p = base;
  for (let i = 0; i < 10; i++) p = applyExtraCompletion(p, attempt, { now: 10 + i }).progress;
  for (const k of ["level", "window", "maxLevel", "tasks", "solved", "revealed", "stars", "recent", "helpTasks", "movesSolved", "optimalSolved", "current", "levelChangedAt"]) {
    assert.deepEqual(p[k], base[k], `${k} orört`);
  }
  assert.deepEqual(p.extra, { tasks: 10, solved: 10, coins: 70, current: null });
  assert.equal(p.coins, 40 + 70);
  assert.equal(applyExtraCompletion(base, attempt, { now: 1 }).change, null);
  // Färdighetsmodellen (#626) rörs inte: inga observationer på extraförsöket.
  assert.deepEqual(attempt.skills.obs, {});
  assert.deepEqual(p.skills, base.skills);
});

test("extra.current och huvudprogressionens current lever sida vid sida", () => {
  const main = generateTask(8, { rng: seededRng("sida") });
  const xt = generateExtraTask({ rng: seededRng("sida-x"), level: 8 });
  let p = normalizeProgress({ ...defaultProgress(), level: 8, maxLevel: 8 });
  p = withCurrent(p, main, { id: "aqa0000000000000000010", at: 1 });
  p = withCurrent(p, xt, { id: "aqa0000000000000000011", at: 2 });
  assert.equal(currentTask(p).task, main);
  assert.equal(currentExtra(p).task, xt);
  // Sparat och läst igen (Firestore): båda finns kvar; ett huvudförsök rör inte extra.
  const read = normalizeProgress(JSON.parse(JSON.stringify(p)));
  assert.equal(currentExtra(read).id, "aqa0000000000000000011");
  const mainRun = solveByTyping(main);
  const a = buildAttempt({ id: "aqa0000000000000000010", task: main, run: mainRun, help: { log: [] }, result: taskResult(main, mainRun), completedAt: 3 });
  assert.equal(a.extra, undefined);
  const after = applyCompletion(read, a, { now: 4 }).progress;
  assert.deepEqual(after.extra, read.extra);
  // Äldre dokument utan extra → tom extra-del; en huvuduppgift godtas aldrig som extra.current.
  assert.deepEqual(normalizeProgress({ level: 3 }).extra, { tasks: 0, solved: 0, coins: 0, current: null });
  assert.equal(normalizeProgress({ level: 3, extra: { current: { id: "aqa0000000000000000012", task: main } } }).extra.current, null);
});

// --- nivåöversikten: diskret och frivillig -----------------------------------------------

test("översikten: länken finns bara när eleven nått minLevel, annars en lågmäld rad", () => {
  assert.equal(extraUnlocked({ maxLevel: EXTRA.minLevel - 1 }), false);
  assert.equal(extraUnlocked({ maxLevel: EXTRA.minLevel }), true);
  const p = normalizeProgress({ ...defaultProgress(), level: 8, maxLevel: 8 });
  const open = overviewHtml(levelOverview(p), { extra: { unlocked: true } });
  assert.match(open, /data-act="extra"/);
  assert.match(open, /Påverkar inte din nivå/);
  const locked = overviewHtml(levelOverview(p), { extra: { unlocked: false } });
  assert.doesNotMatch(locked, /data-act="extra"/);
  assert.match(locked, new RegExp(`nivå ${EXTRA.minLevel}`));
  assert.doesNotMatch(overviewHtml(levelOverview(p)), /extra/i, "utan extra-flagga: som förut");
  assert.equal(extraTitle({ category: "brak" }), "EXTRAUTMANING – BRÅK");
});

test("talfältet i extraläget tar x-termer och två decimaler men inga bråk", () => {
  assert.equal(parseOperand("-1,25", { rules: EXTRA_RULES }).ok, true);
  assert.equal(parseOperand("-3x", { rules: EXTRA_RULES }).ok, true);
  assert.equal(parseOperand("/1,125", { rules: EXTRA_RULES }).error, "decimalMax");
});
