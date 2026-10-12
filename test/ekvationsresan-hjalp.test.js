// ============================================================================
// Ekvationsresan (#616): hjälp, stjärnor, "Visa lösningen", anpassning, mynt –
// spec E1.14 test 12–22 + enheter.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEquation } from "../src/ekvationsresan/equation.js";
import { startRun, playMove } from "../src/ekvationsresan/losning.js";
import { generateTask, similarTask, seededRng } from "../src/ekvationsresan/generator.js";
import { helpSteps, startHelp, nextHelp, revealSolution, shouldOfferHelp } from "../src/ekvationsresan/hjalp.js";
import { starsFor, taskResult, feedbackFor, moveFeedback } from "../src/ekvationsresan/resultat.js";
import { startAdaptation, recordResult, setLevel, progressValue } from "../src/ekvationsresan/anpassning.js";
import { coinsFor, award } from "../src/ekvationsresan/mynt.js";
import { moveEffect } from "../src/ekvationsresan/solver.js";
import { FEEDBACK, HELP, LEVEL_MAX } from "../src/ekvationsresan/config.js";

/** En uppgift ur en ekvationstext (som generatorn hade gett den). */
function taskOf(text, level = 3) {
  const eq = parseEquation(text);
  const optimal = { "2x + 4 = 14": 2, "3x + 5 = 20": 2, "4x = 20": 1, "x + 4 = 11": 1 }[text];
  return { level, equation: eq, optimalMoves: optimal };
}

function play(task, inputs) {
  let run = startRun(task.equation);
  for (const input of inputs) {
    const r = playMove(run, input);
    assert.equal(r.outcome.kind, "move", `${input}: ${r.outcome.message || r.outcome.kind}`);
    run = r.run;
  }
  return run;
}

/** Tryck på hjälpknappen `n` gånger på samma ekvation. */
function pressHelp(eq, n, state = startHelp()) {
  let hint = null;
  for (let i = 0; i < n; i++) ({ state, hint } = nextHelp(state, eq));
  return { state, hint };
}

// --- hjälpen (E1.6) ----------------------------------------------------------

test("hjälp: 4x = 20 ger fråga → vardagligt + våg → operation med förslagsrad → nästan svaret", () => {
  const { steps } = helpSteps(parseEquation("4x = 20"));
  assert.deepEqual(steps.map((s) => s.kind), ["question", "everyday", "operation", "almost"]);
  assert.equal(steps[0].text, "4x betyder fyra stycken x. Hur kan du få bara ett x?");
  assert.match(steps[1].text, /fyra lika stora delar.*20/);
  assert.deepEqual(steps[1].scale, { action: "groups", count: 4 });
  assert.equal(steps[2].text, "Dividera båda leden med 4.");
  assert.equal(steps[2].row.text, "4x ÷ 4 = 20 ÷ 4");
  assert.equal(steps[3].text, "4x ÷ 4 blir x. Vad blir 20 ÷ 4?");
  // aldrig själva svaret
  for (const s of steps) assert.doesNotMatch(s.text, /\b5\b/);
});

test("hjälp: 3x + 5 = 20 styr först mot −5, vid 3x = 15 mot ÷3", () => {
  const first = helpSteps(parseEquation("3x + 5 = 20"));
  assert.deepEqual(first.focus, { op: "-", value: 5 });
  assert.equal(first.steps[2].row.text, "3x + 5 − 5 = 20 − 5");
  assert.deepEqual(first.steps[1].scale, { action: "remove", amount: 5 });
  assert.equal(first.steps[3].text, "3x + 5 − 5 blir 3x. Vad blir 20 − 5?");

  const run = play(taskOf("3x + 5 = 20"), ["-5"]);
  const second = helpSteps(run.current);
  assert.deepEqual(second.focus, { op: "/", value: 3 });
  assert.equal(second.steps[0].text, "3x betyder tre stycken x. Hur kan du få bara ett x?");
  for (const s of second.steps) assert.doesNotMatch(s.text, /\b5\b/, "aldrig svaret x = 5");
});

test("hjälp: x − 3 = 8 (+3), x/4 = 6 (·4, bråkstreck) och x i högerledet", () => {
  const sub = helpSteps(parseEquation("x − 3 = 8"));
  assert.deepEqual(sub.focus, { op: "+", value: 3 });
  assert.equal(sub.steps[3].text, "x − 3 + 3 blir x. Vad blir 8 + 3?");

  const frac = helpSteps(parseEquation("x/4 = 6"));
  assert.deepEqual(frac.focus, { op: "*", value: 4 });
  assert.deepEqual(frac.steps[1].scale, { action: "copies", count: 4 });
  assert.equal(frac.steps[2].row.text, "x/4 · 4 = 6 · 4"); // inte "0,25x"
  assert.equal(frac.steps[3].text, "x/4 · 4 blir x. Vad blir 6 · 4?");

  const swapped = helpSteps(parseEquation("14 = 2x + 4"));
  assert.equal(swapped.steps[3].text, "2x + 4 − 4 blir 2x. Vad blir 14 − 4?");
});

test("hjälp: löst ekvation ger ingen hjälp", () => {
  assert.equal(helpSteps(parseEquation("x = 5")), null);
  assert.equal(nextHelp(startHelp(), parseEquation("x = 5")).hint, null);
});

test("hjälptillstånd: ett steg per tryck, stannar på 4, börjar om vid ny ekvation, minns högsta", () => {
  const eq = parseEquation("3x + 5 = 20");
  let { state, hint } = pressHelp(eq, 1);
  assert.equal(hint.step, 1);
  ({ state, hint } = pressHelp(eq, 5, state));
  assert.equal(hint.step, 4);
  assert.equal(state.maxStep, 4);
  const after = play(taskOf("3x + 5 = 20"), ["-5"]).current;
  ({ state, hint } = nextHelp(state, after));
  assert.equal(hint.step, 1);
  assert.equal(state.maxStep, 4, "högsta steget följer med hela uppgiften");
  assert.equal(state.log.length, 7, "varje tryck loggas");
});

// --- "Visa lösningen" och erbjudandet -------------------------------------------

test("visa lösningen: hela lösningen från elevens läge, rader i MIN LÖSNING, steg för vågen", () => {
  const task = taskOf("2x + 4 = 14");
  const { run, steps } = revealSolution(startRun(task.equation));
  assert.deepEqual(steps.map((s) => `${s.op}${s.value}`), ["-4", "/2"]);
  assert.equal(run.revealed, true);
  assert.equal(run.rows.at(-1).text, "x = 5");
  assert.ok(steps.every((s) => s.rows.length && s.before && s.after));

  // från ett mellanläge fortsätter den därifrån
  const mid = revealSolution(play(task, ["-4"]));
  assert.deepEqual(mid.steps.map((s) => `${s.op}${s.value}`), ["/2"]);
});

test("erbjudande om hjälp efter optimalt + 6 drag utan att x är ensamt", () => {
  const task = taskOf("2x + 4 = 14");
  const detour = ["+1", "-1", "+1", "-1", "+1"];
  assert.equal(shouldOfferHelp(play(task, detour), task.optimalMoves), false);
  const run = play(task, [...detour, "-1", "+1", "-1"]); // 8 drag = 2 + 6
  assert.equal(shouldOfferHelp(run, task.optimalMoves), true);
  assert.equal(HELP.offerText, "Vill du ha hjälp eller se lösningen?");
  assert.equal(shouldOfferHelp(play(task, ["-4", "/2"]), task.optimalMoves), false);
});

// --- stjärnor (E1.7) – test 12–16 ---------------------------------------------

test("test 12: bara hjälp steg 1 och optimal lösning → ⭐⭐⭐", () => {
  const task = taskOf("2x + 4 = 14");
  const { state } = pressHelp(task.equation, 1);
  const res = taskResult(task, play(task, ["-4", "/2"]), state);
  assert.equal(res.stars, 3);
  assert.equal(res.feedback, "Smart lösning! 2 drag, precis så kort kunde den lösas.");
  assert.equal(res.offerRetry, false);
});

test("test 13: hjälp steg 2 och optimal lösning → högst ⭐⭐", () => {
  const task = taskOf("2x + 4 = 14");
  for (const n of [2, 3]) {
    const { state } = pressHelp(task.equation, n);
    const res = taskResult(task, play(task, ["-4", "/2"]), state);
    assert.equal(res.stars, 2, `steg ${n}`);
    assert.equal(res.offerRetry, true);
  }
});

test("test 14: hjälp steg 4 → högst ⭐", () => {
  const task = taskOf("2x + 4 = 14");
  const { state } = pressHelp(task.equation, 4);
  const res = taskResult(task, play(task, ["-4", "/2"]), state);
  assert.equal(res.stars, 1);
  assert.equal(res.solved, true);
  assert.equal(res.coins, 2, "löst med hjälp ger full grundbelöning");
});

test("test 15: visa lösningen → ej löst, inga mynt", () => {
  const task = taskOf("2x + 4 = 14");
  const { run } = revealSolution(play(task, ["-4"]));
  const res = taskResult(task, run);
  assert.equal(res.solved, false);
  assert.equal(res.stars, 0);
  assert.equal(res.points10, 0);
  assert.equal(res.coins, 0);
});

test("test 16: försök igen för ⭐⭐⭐ ger en ny, liknande ekvation", () => {
  const rng = seededRng("t16");
  for (let level = 1; level <= 6; level++) {
    const t = generateTask(level, { rng });
    const s = similarTask(t, { rng });
    assert.notEqual(s.key, t.key);
    assert.equal(s.form, t.form);
    assert.equal(s.level, t.level);
  }
  assert.equal(FEEDBACK.retryButton, "FÖRSÖK IGEN FÖR ⭐⭐⭐");
});

test("stjärnregler: drag mot optimalt (test 6: +6, −10, ÷2 → ⭐⭐) och omvägar", () => {
  const task = taskOf("2x + 4 = 14");
  const res = taskResult(task, play(task, ["+6", "-10", "/2"]));
  assert.equal(res.stars, 2);
  assert.equal(res.feedback, "Rätt! Du löste den på 3 drag. Kan du hitta en kortare väg?");
  assert.equal(starsFor({ solved: true, moves: 4, optimal: 2 }), 2);
  assert.equal(starsFor({ solved: true, moves: 5, optimal: 2 }), 1);
  assert.equal(starsFor({ solved: true, moves: 5, optimal: 2, helpStep: 1 }), 1);
  assert.equal(starsFor({ solved: false, moves: 2, optimal: 2 }), 0);
  assert.match(feedbackFor({ stars: 2, moves: 2, optimal: 2, helpStep: 2 }), /mindre hjälp/);
});

test("feedback efter onödiga och krångligare drag", () => {
  const eq = parseEquation("2x + 4 = 14");
  const r1 = playMove(startRun(eq), "+1").run.current; // 2x + 5 = 15: lika långt kvar
  assert.equal(moveFeedback(moveEffect(eq, r1)), FEEDBACK.moveSame);
  assert.equal(FEEDBACK.moveSame, "Det fungerar, men ekvationen blev inte enklare än.");
  const e2 = parseEquation("2x = 10");
  const r2 = playMove(startRun(e2), "+2").run.current; // 2x + 2 = 12: ett drag till
  assert.equal(moveFeedback(moveEffect(e2, r2)), FEEDBACK.moveFurther);
  assert.equal(moveFeedback("further"), "Båda sidor är fortfarande lika. Finns det ett drag som får x närmare att bli ensamt?");
  assert.equal(moveFeedback("closer"), null);
});

// --- anpassning (E1.9) – test 17–21 -------------------------------------------

function feed(state, stars) {
  const changes = [];
  for (const s of stars) {
    const r = recordResult(state, s);
    state = r.state;
    changes.push(r.change);
  }
  return { state, changes };
}

test("test 17: 4 × ⭐⭐⭐ i rad på nivå 1 → nivå 2, fönstret nollställt", () => {
  const { state, changes } = feed(startAdaptation(1), [3, 3, 3, 3]);
  assert.deepEqual(changes, [null, null, null, "up"]);
  assert.equal(state.level, 2);
  assert.deepEqual(state.window, []);
});

test("test 18: senaste 5 = ⭐⭐⭐ ⭐⭐⭐ ⭐⭐⭐ ⭐⭐ ⭐⭐ (4,2) → nivå upp", () => {
  const { state, changes } = feed(startAdaptation(3), [3, 3, 3, 2, 2]);
  assert.deepEqual(changes, [null, null, null, null, "up"]);
  assert.equal(state.level, 4);
});

test("regel 3: minst 7,0 av de senaste 10 utan att regel 1–2 slår till", () => {
  // varje femfönster = 3,8 (< 4,0), inga fyra ⭐⭐⭐ i rad; nio uppgifter = 7,0
  const { state, changes } = feed(startAdaptation(2), [3, 2, 2, 3, 2, 3, 2, 2, 3]);
  assert.deepEqual(changes, [null, null, null, null, null, null, null, null, "up"]);
  assert.equal(state.level, 3);
  // under minsta antal räknas inte regel 2–3: 3 3 3 2 (3,6) → ingen ändring
  assert.deepEqual(feed(startAdaptation(2), [3, 3, 3, 2]).changes, [null, null, null, null]);
});

test("test 19: en ej löst uppgift efter flera bra → ingen nivånedgång", () => {
  const { state, changes } = feed(startAdaptation(4), [2, 1, 2, 2, 0]);
  assert.ok(!changes.includes("down"));
  assert.equal(state.level, 4);
});

test("test 20: senaste 5 = ⭐ ⭐ ej ⭐ ej (0,6) → nivå ner, fönstret nollställt", () => {
  const { state, changes } = feed(startAdaptation(3), [1, 1, 0, 1, 0]);
  assert.deepEqual(changes, [null, null, null, null, "down"]);
  assert.equal(state.level, 2);
  assert.deepEqual(state.window, []);
  // gränsen 1,2 ingår: 1,1,1,1,1 = 1,0 → ner; 2,2,0,0,0 = 1,2 → ner; 2,2,1,0,0 = 1,4 → kvar
  assert.equal(feed(startAdaptation(3), [2, 2, 0, 0, 0]).state.level, 2);
  assert.equal(feed(startAdaptation(3), [2, 2, 1, 0, 0]).state.level, 3);
});

test("test 21: nivå 1 med dåliga resultat → stannar på nivå 1", () => {
  const { state, changes } = feed(startAdaptation(1), [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]);
  assert.equal(state.level, 1);
  assert.ok(changes.every((c) => c === null));
  assert.ok(state.window.length <= 10);
});

test("högsta nivån går inte över, lärarens nivåändring nollställer fönstret", () => {
  assert.equal(feed(startAdaptation(LEVEL_MAX), [3, 3, 3, 3]).state.level, LEVEL_MAX);
  const s = setLevel({ level: 2, window: [3, 3, 2] }, 5);
  assert.deepEqual(s, { level: 5, window: [] });
  assert.equal(setLevel(s, 0).level, 1);
});

test("progressionsmätaren: 0–1 ur fönstret, rör sig tydligt vid stark prestation", () => {
  assert.equal(progressValue(startAdaptation(1)), 0);
  const one = feed(startAdaptation(1), [3]).state;
  const three = feed(startAdaptation(1), [3, 3, 3]).state;
  assert.ok(progressValue(one) >= 0.25);
  assert.ok(progressValue(three) >= 0.75 && progressValue(three) < 1);
  const weak = feed(startAdaptation(1), [1, 1]).state;
  assert.ok(progressValue(weak) < progressValue(one));
  assert.equal(progressValue(startAdaptation(LEVEL_MAX)), 1);
});

// --- mynt (E1.10) – test 22 -----------------------------------------------------

test("test 22: lösta uppgifter på nivå 1, 3 och 5 ger 1, 2 och 3 mynt till vanliga saldot", async () => {
  let balance = 100;
  const calls = [];
  const addCoins = async (n) => {
    calls.push(n);
    balance += n;
    return balance;
  };
  for (const level of [1, 3, 5]) {
    const task = { ...taskOf("x + 4 = 11"), level };
    const res = taskResult(task, play(task, ["-4"]));
    await award(res.coins, { addCoins });
  }
  assert.deepEqual(calls, [1, 2, 3]);
  assert.equal(balance, 106);
});

test("mynt: nivåtabell (Etapp 2 förberedd), ej löst ger 0 och inget anrop", async () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((l) => coinsFor(l)), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
  assert.equal(coinsFor(4, { extraChallenge: true }), 7);
  assert.equal(coinsFor(5, { solved: false }), 0);
  let called = false;
  const r = await award(0, { addCoins: async () => (called = true) });
  assert.deepEqual(r, { coins: 0, balance: null });
  assert.equal(called, false);
  // ingen stjärnbonus: ⭐ och ⭐⭐⭐ ger samma mynt
  const task = taskOf("2x + 4 = 14");
  const best = taskResult(task, play(task, ["-4", "/2"]));
  const slow = taskResult(task, play(task, ["+6", "-10", "-1", "+1", "/2"]));
  assert.equal(best.stars, 3);
  assert.equal(slow.stars, 1);
  assert.equal(best.coins, slow.coins);
});
