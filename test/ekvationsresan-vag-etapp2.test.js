// ============================================================================
// Ekvationsresan (#624, E2.2 + E1.5): vågen för x i båda leden, minustal och
// decimaler. −x lyfter bort ett x-block från båda sidor; minustal är "skuld"
// (streckade röda brickor och skuld-x-block); decimaler ritas stiliserat.
// Det visuella verifieras i preview/preview-ekvationsresan-vag.html.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { viewForEquation, chooseView, statesAlong } from "../src/ekvationsresan/vag-visning.js";
import { restScene, movePhases, helpScene, scaleOperand, XB_MAX } from "../src/ekvationsresan/vag-scen.js";
import { layoutSide } from "../src/ekvationsresan/vag-layout.js";
import { pieceSvg } from "../src/ekvationsresan/vag-konst.js";
import { parseEquation, term, fromJSON, coefOf, simplifySide } from "../src/ekvationsresan/equation.js";
import { applyOperation, moveOperand } from "../src/ekvationsresan/operations.js";
import { generateTask, seededRng } from "../src/ekvationsresan/generator.js";
import { rulesFor } from "../src/ekvationsresan/config.js";
import { q, isInteger } from "../src/ekvationsresan/rational.js";
import { helpSteps } from "../src/ekvationsresan/hjalp.js";

const E = parseEquation;
const kinds = (arr, kind) => arr.pieces.filter((p) => p.kind === kind);
const flowKeys = (arr) => arr.pieces.filter((p) => p.kind !== "badge" && p.kind !== "frame").map((p) => p.key);
const xMove = (text, op, k, level = 9) => {
  const before = E(text);
  const operand = term(q(k), 1);
  const r = applyOperation(before, op, operand, rulesFor(level));
  assert.ok(r.ok, `${text} ${op}${k}x ska gå`);
  return { before, after: r.after, operand, ...movePhases(before, op, operand, r.after, "block") };
};

// --- −x: ett x-block lyfts bort från båda sidor ----------------------------------

test("3x + 4 = x + 12, −x: ett x-block lyfts bort från BÅDA sidor", () => {
  const { phases, pan } = xMove("3x + 4 = x + 12", "-", 1, 7);
  assert.equal(kinds(phases[0].L, "xb").length, 3);
  assert.equal(kinds(phases[0].R, "xb").length, 1);
  for (const S of ["L", "R"]) {
    const lifted = phases[1][S].pieces.filter((p) => p.lift);
    assert.equal(lifted.length, 1, `${S}: ett x-block lyfts`);
    assert.equal(lifted[0].kind, "xb");
    assert.ok(!flowKeys(phases[3][S]).includes(lifted[0].key), `${S}: det lyfta blocket är borta efteråt`);
    assert.equal(phases[1][S].pieces.find((p) => p.kind === "badge").text, "− x");
    // allt som finns efteråt fanns redan i mittfasen → varje bit glider, inget poppar fram
    for (const k of flowKeys(phases[3][S])) assert.ok(flowKeys(phases[2][S]).includes(k), `${S}: ${k}`);
  }
  assert.equal(kinds(phases[3].L, "xb").length, 2);
  assert.equal(kinds(phases[3].R, "xb").length, 0);
  assert.deepEqual(kinds(phases[3].R, "tile").map((p) => p.text), ["12"]);
  assert.deepEqual(pan, [0, -5, -5, 0], "båda skålarna gungar likadant");
});

// --- minustal = skuld ---------------------------------------------------------------

test("3x + 17 = 5x + 5, −5x: negativt mellanled −2x ritas som två skuld-x-block", () => {
  const { phases, after } = xMove("3x + 17 = 5x + 5", "-", 5);
  assert.equal(viewForEquation(after), "block");
  const L = phases[1].L;
  assert.equal(L.pieces.filter((p) => p.lift && p.kind === "xb").length, 3, "alla tre x-block lyfts");
  assert.equal(kinds(L, "xn").length, 2, "det som saknas blir skuld");
  assert.ok(kinds(L, "xn").every((p) => p.enter === "pop"));
  assert.equal(phases[1].R.pieces.filter((p) => p.lift).length, 5);
  assert.deepEqual(kinds(phases[3].L, "xn").map((p) => p.key), ["L:nx0", "L:nx1"]);
  assert.equal(kinds(phases[3].L, "xb").length, 0);
  for (const k of flowKeys(phases[3].L)) assert.ok(flowKeys(phases[2].L).includes(k), k);
});

test("−2x + 17 = 5, +2x: x-blocken tar ut skulden, nya x-block till höger", () => {
  const { phases } = xMove("-2x + 17 = 5", "+", 2);
  const fills = phases[1].L.pieces.filter((p) => p.at);
  assert.equal(fills.length, 2);
  assert.deepEqual(fills.map((p) => p.at).sort(), ["L:nx0", "L:nx1"], "x-blocken landar på skuld-x-blocken");
  assert.equal(kinds(phases[3].L, "xn").length + kinds(phases[3].L, "xb").length, 0, "17 = … – inget x kvar till vänster");
  assert.equal(phases[1].R.pieces.filter((p) => p.kind === "xb" && p.enter === "drop").length, 2);
  // positionen för en fyllning = skuld-blockets position (layout)
  const pos = layoutSide(phases[1].L, "block");
  for (const f of fills) assert.deepEqual([pos.get(f.key).x, pos.get(f.key).y], [pos.get(f.at).x, pos.get(f.at).y]);
});

test("minustal: skuldbricka för konstanter, skuld-x-block för x, aldrig föremål", () => {
  const s = restScene(E("-2x = -12"), "block");
  assert.equal(kinds(s.L, "xn").length, 2);
  assert.equal(kinds(s.R, "tile")[0].neg, true);
  assert.equal(kinds(s.R, "tile")[0].text, "−12");
  assert.match(pieceSvg(kinds(s.L, "xn")[0], {}, { w: 44, h: 50 }), /stroke-dasharray/);
  assert.match(pieceSvg(kinds(s.L, "xn")[0], {}, { w: 44, h: 50 }), />−x</);
  // fler än XB_MAX skuld-x → ett streckat etikettblock
  const big = restScene(E(`-${XB_MAX + 3}x = -30`), "block").L;
  assert.deepEqual(big.pieces.map((p) => [p.kind, p.neg]), [["xf", true]]);
  for (const t of ["x - 7 = -3", "-2x + 17 = 5", "3x + 17 = 5x + 5", "x + 9 = 4"]) assert.notEqual(viewForEquation(E(t)), "foremal", t);
});

// --- decimaler: stiliserad våg med etiketter ---------------------------------------

test("decimaler ritas med stiliserad våg och etiketter; x/4 är fortfarande ett bråkblock", () => {
  assert.equal(viewForEquation(E("2,5x + 4 = 19")), "stiliserad");
  assert.equal(viewForEquation(E("x + 0,5 = 3")), "stiliserad");
  assert.equal(viewForEquation(E("2x + 3 = 8")), "stiliserad", "x = 2,5");
  assert.equal(viewForEquation(E("x/4 = 6")), "block");
  const s = restScene(E("2,5x + 4 = 19"), "stiliserad");
  assert.deepEqual([s.L.pieces[0].kind, s.R.pieces[0].kind], ["label", "label"]);
  assert.equal(s.L.pieces[0].segs.map((g) => g.text).join(" "), "2,5x + 4");
  // ÷2,5: etiketten byts, badgen visar draget
  const r = applyOperation(E("2,5x = 15"), "/", term(q(5, 2), 0), rulesFor(10));
  const { phases } = movePhases(E("2,5x = 15"), "/", term(q(5, 2), 0), r.after, "stiliserad");
  assert.equal(phases[1].L.pieces.find((p) => p.kind === "badge").text, "÷ 2,5");
});

// --- genererade uppgifter nivå 7–12 ------------------------------------------------

test("nivå 7–12: decimaluppgifter är stiliserade, x-drag i block glider nyckel för nyckel", () => {
  for (let level = 7; level <= 12; level++) {
    const rng = seededRng(`vag624-${level}`);
    for (let i = 0; i < 150; i++) {
      const task = generateTask(level, { rng });
      const states = statesAlong(fromJSON(task.equation), task.optimalPath, rulesFor(level));
      const hasDecimal = states.some((s) => [...s.left, ...s.right].some((t) => !isInteger(coefOf(t)) && Math.abs(t.n) !== 1));
      if (hasDecimal) assert.equal(task.display, "stiliserad", task.text);
      assert.equal(task.display, chooseView(states));
      for (let k = 1; k < states.length; k++) {
        const step = task.optimalPath[k - 1];
        const operand = moveOperand(step);
        if (!operand.x || task.display !== "block") continue;
        const { phases } = movePhases(states[k - 1], step.op, operand, states[k], "block");
        for (const S of ["L", "R"]) {
          const xs = [states[k - 1], states[k]].map((s) => simplifySide(S === "L" ? s.left : s.right).find((t) => t.x));
          if (xs.some((t) => t && Math.abs(t.n) > XB_MAX)) continue;
          for (const key of flowKeys(phases[3][S])) assert.ok(flowKeys(phases[2][S]).includes(key), `${task.text} ${step.op}${operand.n}x ${S}: ${key}`);
        }
      }
    }
  }
});

// --- hjälpens bild med x-termer -------------------------------------------------------

test("hjälpens bild: scale.operand (−x) markerar ett x-block på båda sidor", () => {
  assert.deepEqual(scaleOperand({ action: "remove", operand: { n: 1, d: 1, x: 1 } }), term(q(1), 1));
  assert.deepEqual(scaleOperand({ action: "groups", count: 3 }), term(q(3), 0));
  assert.equal(scaleOperand({ action: "remove" }), null);
  assert.equal(scaleOperand({ action: "remove", operand: { n: -1, d: 1, x: 1 } }), null);
  const eq = E("3x + 4 = x + 12");
  const after = applyOperation(eq, "-", term(q(1), 1), rulesFor(7)).after;
  const h = helpScene(eq, { action: "remove", operand: { n: 1, d: 1, x: 1 } }, after, "block");
  assert.equal(h.L.pieces.filter((p) => p.lift).length, 1);
  assert.equal(h.R.pieces.filter((p) => p.lift).length, 1);
  // hjälpen (#623) ger just den bilden för första steget
  const s2 = helpSteps(eq, rulesFor(7)).steps.find((s) => s.step === 2);
  assert.deepEqual(scaleOperand(s2.scale), term(q(1), 1));
  assert.equal(s2.scale.action, "remove");
});
