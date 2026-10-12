// ============================================================================
// Ekvationsresan (#617): den grafiska vågen – valet av visning, scenen för
// varje drag och layouten. Spec E1.5 + E1.14 test 9, 10, 11 (på datanivå;
// det visuella verifieras i preview/preview-ekvationsresan-vag.html).
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { viewForEquation, chooseView, statesAlong, taskView, viewDuring, themeFor, THEMES } from "../src/ekvationsresan/vag-visning.js";
import { restScene, movePhases, helpScene, sidePieces } from "../src/ekvationsresan/vag-scen.js";
import { layoutSide, extent, PAN } from "../src/ekvationsresan/vag-layout.js";
import { parseEquation, term, fromJSON } from "../src/ekvationsresan/equation.js";
import { applyNumber, moveOperand } from "../src/ekvationsresan/operations.js";
import { generateTask, seededRng } from "../src/ekvationsresan/generator.js";
import { LEVELS, rulesFor } from "../src/ekvationsresan/config.js";
import { q } from "../src/ekvationsresan/rational.js";

const E = parseEquation;
const kinds = (arr, kind) => arr.pieces.filter((p) => p.kind === kind);
const keys = (arr) => arr.pieces.map((p) => p.key);
const move = (text, op, value) => {
  const before = E(text);
  const r = applyNumber(before, op, value);
  assert.ok(r.ok, `${text} ${op}${value} ska gå`);
  return { before, after: r.after, operand: term(q(value), 0) };
};

// --- valet av visning --------------------------------------------------------------

test("visning: föremål för små heltal, block upp till ca 100, annars stiliserad", () => {
  assert.equal(viewForEquation(E("2x + 3 = 11")), "foremal"); //   test 9
  assert.equal(viewForEquation(E("x - 3 = 8")), "foremal"); //     x − 3 = "ta bort 3"
  assert.equal(viewForEquation(E("5x = 20")), "foremal");
  assert.equal(viewForEquation(E("5x + 13 = 48")), "block"); //    test 11: inte 48 föremål
  assert.equal(viewForEquation(E("x + 1 = 21")), "block"); //      21 > 20
  assert.equal(viewForEquation(E("6x = 12")), "block"); //         x fler än 5 gånger
  assert.equal(viewForEquation(E("x/4 = 6")), "block"); //         slutar i x = 24, och x/4 är inget föremål
  assert.equal(viewForEquation(E("x/2 = 3")), "block");
  assert.equal(viewForEquation(E("8x + 29 = 141")), "stiliserad");
  assert.equal(viewForEquation(E("x + 100 = 150")), "stiliserad");
});

test("visning: Etapp 2-fallen (x i båda leden, minustal, decimaler) ger aldrig föremål", () => {
  assert.equal(viewForEquation(E("3x + 4 = x + 12")), "block");
  assert.equal(viewForEquation(E("x - 7 = -3")), "block"); //   ett led är negativt → "skuld"-bricka
  assert.equal(viewForEquation(E("x + 9 = 4")), "block"); //    negativ lösning
  assert.equal(viewForEquation(E("2,5x + 4 = 19")), "stiliserad"); // decimaler → stiliserad med etiketter (#624)
});

test("visning: hela vägen räknas, och vågen blir aldrig mindre abstrakt än uppgiften", () => {
  assert.equal(chooseView([E("2x + 3 = 11"), E("2x = 8"), E("x = 4")]), "foremal");
  assert.equal(chooseView([E("x/4 = 6"), E("x = 24")]), "block");
  assert.equal(viewDuring("block", E("x = 4")), "block");
  assert.equal(viewDuring("foremal", E("2x + 30 = 38")), "block"); // ett krångligt drag lyfter visningen
  assert.equal(taskView({ equation: { left: [{ n: 2, d: 1, x: 1 }, { n: 3, d: 1, x: 0 }], right: [{ n: 11, d: 1, x: 0 }] } }), "foremal");
});

test("generatorns display = visningen över hela den optimala vägen, nivå 1 alltid föremål", () => {
  for (const { level } of LEVELS) {
    const rng = seededRng(`vag-${level}`);
    let prev = null;
    for (let i = 0; i < 200; i++) {
      const task = generateTask(level, { rng, previous: prev });
      prev = task;
      const states = statesAlong(fromJSON(task.equation), task.optimalPath, rulesFor(level));
      assert.equal(states.length, task.optimalMoves + 1, "vägen går att spela upp");
      assert.equal(task.display, chooseView(states), task.text);
      for (const s of states) assert.equal(viewDuring(task.display, s), task.display, `${task.text}: tillståndet ryms i uppgiftens visning`);
      if (level === 1) assert.equal(task.display, "foremal");
    }
  }
});

// --- scenen ------------------------------------------------------------------------------

test("test 9: 2x + 3 = 11 = två behållare och tre föremål mot elva föremål", () => {
  const s = restScene(E("2x + 3 = 11"), "foremal");
  assert.equal(kinds(s.L, "cont").length, 2);
  assert.equal(kinds(s.L, "item").length, 3);
  assert.equal(kinds(s.R, "item").length, 11);
  assert.equal(kinds(s.R, "cont").length, 0);
});

test("test 10: −3 lyfter bort tre föremål från BÅDA sidor", () => {
  const { before, after, operand } = move("2x + 3 = 11", "-", 3);
  const { phases, pan } = movePhases(before, "-", operand, after, "foremal");
  for (const S of ["L", "R"]) {
    const lifted = phases[1][S].pieces.filter((p) => p.lift);
    assert.equal(lifted.length, 3, `${S}: tre lyfts bort`);
    assert.ok(lifted.every((p) => p.kind === "item"));
    assert.ok(lifted.every((p) => !keys(phases[3][S]).includes(p.key)), `${S}: de lyfta är borta efteråt`);
    assert.equal(phases[1][S].pieces.find((p) => p.kind === "badge").text, "− 3");
  }
  assert.equal(kinds(phases[3].L, "cont").length, 2);
  assert.equal(kinds(phases[3].R, "item").length, 8);
  assert.deepEqual(pan, [0, -5, -5, 0], "båda skålarna gungar likadant – vågen är i balans");
});

test("test 10: ÷2 delar i två lika grupper, grupp 0 stannar och resten tonas bort", () => {
  const { before, after, operand } = move("2x = 8", "/", 2);
  const { phases } = movePhases(before, "/", operand, after, "foremal");
  for (const S of ["L", "R"]) {
    const mid = phases[1][S];
    assert.equal(mid.groups, 2);
    assert.equal(kinds(mid, "frame").length, 2);
    const flow = mid.pieces.filter((p) => p.kind !== "frame" && p.kind !== "badge");
    const sig = (g) => flow.filter((p) => p.g === g).map((p) => p.kind).sort().join();
    assert.equal(sig(0), sig(1), `${S}: grupperna är lika`);
    // före-nycklarna = alla grupper; efter-nycklarna = grupp 0
    assert.deepEqual(new Set(flow.map((p) => p.key)), new Set(keys(phases[0][S])));
    assert.deepEqual(new Set(flow.filter((p) => p.g === 0).map((p) => p.key)), new Set(keys(phases[3][S])));
  }
  assert.equal(kinds(phases[1].L, "cont").filter((p) => p.g === 0).length, 1);
  assert.equal(kinds(phases[1].R, "item").filter((p) => p.g === 0).length, 4);
});

test("·3 tredubblar: grupp 0 är det gamla innehållet, kopiorna landar på efter-nycklarna", () => {
  const { before, after, operand } = move("x + 2 = 5", "*", 3);
  const { phases } = movePhases(before, "*", operand, after, "foremal");
  for (const S of ["L", "R"]) {
    const flow = phases[1][S].pieces.filter((p) => p.kind !== "frame" && p.kind !== "badge");
    assert.deepEqual(new Set(flow.filter((p) => p.g === 0).map((p) => p.key)), new Set(keys(phases[0][S])));
    assert.deepEqual(new Set(flow.map((p) => p.key)), new Set(keys(phases[3][S])));
    assert.ok(flow.filter((p) => p.g > 0).every((p) => p.enter === "pop"));
  }
});

test("+3 på x − 3 fyller de tre hålen; +a utan hål släpper ner nya föremål", () => {
  const a = move("x - 3 = 8", "+", 3);
  const { phases } = movePhases(a.before, "+", a.operand, a.after, "foremal");
  const fills = phases[1].L.pieces.filter((p) => p.at);
  assert.equal(fills.length, 3);
  assert.ok(fills.every((p) => p.at.startsWith("L:h")));
  assert.equal(kinds(phases[3].L, "hole").length, 0);
  assert.equal(phases[1].R.pieces.filter((p) => p.enter === "drop").length, 3);
  const b = move("x = 4", "-", 2); // x − 2 = 2: hål uppstår till vänster
  const pb = movePhases(b.before, "-", b.operand, b.after, "foremal").phases;
  assert.equal(kinds(pb[1].L, "hole").length, 2);
});

test("test 11: 5x + 13 = 48 visas med block – fem x-block och talbrickor, inga föremål", () => {
  const s = restScene(E("5x + 13 = 48"), "block");
  assert.equal(kinds(s.L, "xb").length, 5);
  assert.deepEqual(kinds(s.L, "tile").map((p) => p.text), ["13"]);
  assert.deepEqual(kinds(s.R, "tile").map((p) => p.text), ["48"]);
  assert.equal([...s.L.pieces, ...s.R.pieces].filter((p) => p.kind === "item").length, 0);
  // −13: en bricka "−13" landar på båda sidor; ÷5: fem grupper med x och 7
  const m = move("5x + 13 = 48", "-", 13);
  const ph = movePhases(m.before, "-", m.operand, m.after, "block").phases;
  for (const S of ["L", "R"]) assert.equal(ph[1][S].pieces.find((p) => p.key === `${S}:chip`).text, "−13");
  const d = move("5x = 35", "/", 5);
  const pd = movePhases(d.before, "/", d.operand, d.after, "block").phases;
  assert.equal(kinds(pd[1].R, "tile").filter((p) => p.text === "7").length, 5);
  assert.equal(kinds(pd[1].L, "xb").length, 5);
});

test("block: x/4 är ett bråkblock, minustal en skuldbricka, stort x ett etikettblock", () => {
  assert.deepEqual(sidePieces(E("x/4 = 6").left, "block", "L").map((p) => p.kind), ["xf"]);
  assert.equal(sidePieces(E("x/4 = 6").left, "block", "L")[0].segs[0].den, "4");
  assert.equal(sidePieces(E("x - 7 = -3").right, "block", "R")[0].neg, true);
  assert.deepEqual(sidePieces(E("15x = 45").left, "block", "L").map((p) => p.kind), ["xf"]);
  assert.equal(restScene(E("8x + 29 = 141"), "stiliserad").L.pieces[0].kind, "label");
});

test("hjälpens bild (steg 2): grupper, markering och förslag", () => {
  const eq = E("4x = 20");
  const g = helpScene(eq, { action: "groups", count: 4 }, applyNumber(eq, "/", 4).after, "foremal");
  assert.equal(kinds(g.L, "frame").length, 4);
  assert.equal(kinds(g.R, "frame").length, 4);
  const eq2 = E("3x + 5 = 20");
  const r = helpScene(eq2, { action: "remove", amount: 5 }, applyNumber(eq2, "-", 5).after, "foremal");
  assert.equal(r.L.pieces.filter((p) => p.lift).length, 5);
  assert.equal(r.R.pieces.filter((p) => p.lift).length, 5);
  const eq3 = E("x - 3 = 8");
  const add = helpScene(eq3, { action: "add", amount: 3 }, applyNumber(eq3, "+", 3).after, "foremal");
  assert.ok(add.R.pieces.filter((p) => p.ghost).length === 3, "nya föremål visas som förslag");
  assert.equal(helpScene(eq, { action: "okänd", count: 2 }, eq, "foremal"), null);
});

// --- layouten -------------------------------------------------------------------------------

test("layout: allt ryms i skålen för alla genererade uppgifter, i varje tillstånd och fas", () => {
  for (const { level } of LEVELS) {
    const rng = seededRng(`layout-${level}`);
    for (let i = 0; i < 120; i++) {
      const task = generateTask(level, { rng });
      const states = statesAlong(fromJSON(task.equation), task.optimalPath, rulesFor(level));
      states.forEach((s, k) => {
        const phases = k === 0 ? [restScene(s, task.display)] : movePhases(states[k - 1], task.optimalPath[k - 1].op, moveOperand(task.optimalPath[k - 1]), s, task.display).phases;
        for (const ph of phases) {
          for (const S of ["L", "R"]) {
            const pos = layoutSide(ph[S], task.display);
            const e = extent(pos);
            assert.ok(e.height <= PAN.height + 40, `${task.text} (${S}) höjd ${e.height}`);
            assert.ok(e.minX >= -PAN.width / 2 - 30 && e.maxX <= PAN.width / 2 + 30, `${task.text} (${S}) bredd ${e.minX}..${e.maxX}`);
            for (const p of ph[S].pieces) assert.ok(pos.has(p.key), `${p.key} har en plats`);
          }
        }
      });
    }
  }
});

test("layout: föremål ligger inte på varandra (utom hål som fylls)", () => {
  const s = restScene(E("5x + 15 = 20"), "foremal");
  for (const S of ["L", "R"]) {
    const pos = [...layoutSide(s[S], "foremal").values()];
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const a = pos[i];
        const b = pos[j];
        const overlapX = Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 1;
        const overlapY = !(a.y <= b.y - b.h + 1 || b.y <= a.y - a.h + 1);
        assert.ok(!(overlapX && overlapY), `${S}: bit ${i} och ${j} överlappar`);
      }
    }
  }
});

test("teman: fem teman, stabilt per uppgift och varierat mellan uppgifter", () => {
  assert.deepEqual(THEMES.map((t) => t.id), ["spargris", "sack", "korg", "burk", "paket"]);
  assert.equal(themeFor({ key: "+2x+3=+11" }).id, themeFor({ key: "+2x+3=+11" }).id);
  const rng = seededRng("teman");
  const seen = new Set();
  for (let i = 0; i < 40; i++) seen.add(themeFor(generateTask(1, { rng })).id);
  assert.equal(seen.size, 5);
});
