// ============================================================================
// Ekvationsresan – finputs efter Etapp 2 (#647, epic #646).
//   O1  "I korthet" direkt efter namnet i klassöversikten
//   O2  "Hjälp %" → "💡 %" med tooltip; räknar alla hjälptryck som meningarna
//   O3  talfältet tar ÷ ett negativt tal från nivå 9 (/-2, ÷ -2, ÷ (−2), ÷ −2)
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rulesFor, OPERAND_MESSAGES } from "../src/ekvationsresan/config.js";
import { parseOperand } from "../src/ekvationsresan/operand.js";
import { parseEquation } from "../src/ekvationsresan/equation.js";
import { startRun, playMove, replayRows } from "../src/ekvationsresan/losning.js";
import { movePhases } from "../src/ekvationsresan/vag-scen.js";
import { applyOperation } from "../src/ekvationsresan/operations.js";
import { cleanInput } from "../src/ekvationsresan/talfalt.js";
import { behovdeHjalp, applyCompletion, normalizeProgress, teacherSummary } from "../src/ekvationsresan/framsteg.js";
import { KOLUMNER, HJALP_TITEL } from "../src/ekvationsresan/larare.js";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");
const MINUS2 = { n: -2, d: 1, x: 0 };

test("O3: ÷ negativt tal tas emot från nivå 9 i alla skrivsätt", () => {
  for (const text of ["/-2", "÷ -2", "÷ (−2)", "÷ −2", "÷(-2)", ":-2", "/ (−2)"]) {
    assert.deepEqual(parseOperand(text, { rules: rulesFor(9) }), { ok: true, op: "/", operand: MINUS2 }, text);
  }
  assert.deepEqual(parseOperand("(−2)", { op: "/", rules: rulesFor(9) }).operand, MINUS2, "÷-knappen + (−2)");
  assert.deepEqual(parseOperand("/-2,5", { rules: rulesFor(10) }).operand, { n: -5, d: 2, x: 0 }, "decimal från nivå 10");
  assert.deepEqual(parseOperand("/-12", { rules: rulesFor(12) }).operand, { n: -12, d: 1, x: 0 });
});

test("O3: under nivå 9 blir det samma vänliga avvisning som förut", () => {
  for (const level of [1, 7, 8]) {
    for (const text of ["/-2", "÷ -2", "÷ (−2)", "÷ −2"]) {
      const r = parseOperand(text, { rules: rulesFor(level) });
      assert.equal(r.ok, false, `nivå ${level} ${text}`);
      assert.equal(r.error, "syntax");
      assert.equal(r.message, OPERAND_MESSAGES.syntax);
    }
  }
});

test("O3: minustecknet U+2212 normaliseras, övriga drag oförändrade", () => {
  assert.deepEqual(parseOperand("−4", { rules: rulesFor(9) }), { ok: true, op: "-", operand: { n: 4, d: 1, x: 0 } });
  assert.deepEqual(parseOperand("/2", { rules: rulesFor(9) }).operand, { n: 2, d: 1, x: 0 });
  assert.equal(parseOperand("*-2", { rules: rulesFor(9) }).error, "syntax", "bara division tar negativt tal");
  assert.equal(parseOperand("+-2", { rules: rulesFor(9) }).error, "syntax");
  assert.equal(parseOperand("÷(2)", { rules: rulesFor(9) }).error, "syntax");
  assert.equal(parseOperand("/-2x", { rules: rulesFor(9) }).operand.x, 1, "x-term → spärras sedan som xProduct");
  assert.equal(applyOperation(parseEquation("-2x = -12"), "/", parseOperand("/-2x", { rules: rulesFor(9) }).operand, rulesFor(9)).block, "xProduct");
  assert.equal(playMove(startRun(parseEquation("-2x = -12"), { rules: rulesFor(9) }), "/-0").outcome.block, "div0");
});

test("O3 spelvy: −2x = −12, ÷ (−2) ger x = 6 med parentes i räknegången", () => {
  const run0 = startRun(parseEquation("-2x = -12"), { rules: rulesFor(9) });
  const { run, outcome } = playMove(run0, "÷ -2");
  assert.equal(outcome.kind, "move");
  assert.equal(run.solved, true);
  assert.deepEqual(run.rows.map((r) => r.text), ["−2x = −12", "−2x ÷ (−2) = −12 ÷ (−2)", "x = 6"]);
  const op = run.rows[1].segments.filter((s) => s.mark === "op").map((s) => s.text);
  assert.deepEqual(op, ["÷ (−2)", "÷ (−2)"], "operationen ritas röd med parentes");
  assert.deepEqual(replayRows(parseEquation("-2x = -12"), run.moves, { rules: rulesFor(9) }).map((r) => r.text), run.rows.map((r) => r.text),
    "lärarens räknegång byggs om likadant ur sparade drag");
  // Flera termer: parentes runt ledet och runt talet.
  const two = playMove(startRun(parseEquation("-2x + 4 = -8"), { rules: rulesFor(9) }), "/(−2)").run;
  assert.equal(two.rows[1].text, "(−2x + 4) ÷ (−2) = −8 ÷ (−2)");
  assert.equal(two.rows.at(-1).text, "x − 2 = 4");
});

test("O3 vågen: brickan visar ÷ (−2)", () => {
  const before = parseEquation("-2x = -12");
  const r = applyOperation(before, "/", MINUS2, rulesFor(9));
  for (const view of ["block", "stiliserad"]) {
    const { phases } = movePhases(before, "/", r.operand, r.after, view);
    const badge = phases[1].L.pieces.find((p) => p.kind === "badge");
    assert.equal(badge.text, "÷ (−2)", view);
  }
});

test("talfältet släpper igenom ÷ (−2) men inte annat", () => {
  assert.equal(cleanInput("÷ (−2)"), "÷(−2)");
  assert.equal(cleanInput("/ -2a"), "/-2");
});

test("O1: klassöversikten har I korthet direkt efter namnet", () => {
  assert.deepEqual(KOLUMNER.slice(0, 2).map((c) => c.key), ["namn", "korthet"]);
  const src = readFileSync(join(SRC, "teacher-ekvationsresan.js"), "utf8");
  const row = src.slice(src.indexOf("function rowHtml"), src.indexOf("function headHtml"));
  const order = ["lrt-name", "ekt-korthet", "lrt-lvl", "ekt-trend", "r.helpPct", "drag == null ? dash"].map((k) => row.indexOf(k));
  assert.ok(order.every((i) => i > 0), "alla celler finns");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "cellerna i samma ordning som KOLUMNER");
});

test("O2: rubriken heter 💡 % med tooltip om alla hjälptryck", () => {
  const col = KOLUMNER.find((c) => c.key === "helpPct");
  assert.equal(col.label, "💡 %");
  assert.equal(col.title, HJALP_TITEL);
  assert.equal(HJALP_TITEL, "Alla hjälptryck, inklusive Visa lösningen och visade svar");
  assert.ok(!KOLUMNER.some((c) => c.label === "Hjälp %"));
});

test("O2: 💡 % räknar 💡, Visa lösningen och visade svar – som meningarna", () => {
  assert.equal(behovdeHjalp({ helpMax: 0 }), false);
  assert.equal(behovdeHjalp({ helpMax: 1 }), true);
  assert.equal(behovdeHjalp({ helpMax: 0, revealed: true }), true);
  assert.equal(behovdeHjalp({ helpMax: 0, answers: [{ visad: false }, { visad: true }] }), true);
  assert.equal(behovdeHjalp({ helpMax: 0, answers: [{ visad: false }] }), false);
  let p = normalizeProgress(null);
  const base = { level: 1, stars: 3, solved: true, coins: 0 };
  for (const a of [{ helpMax: 0 }, { helpMax: 2 }, { helpMax: 0, revealed: true, solved: false, stars: 0 }, { helpMax: 0, answers: [{ visad: true }] }]) {
    p = applyCompletion(p, { ...base, ...a }, { now: 1 }).progress;
  }
  assert.equal(p.helpTasks, 3);
  assert.equal(teacherSummary(p).helpPct, 75);
});
