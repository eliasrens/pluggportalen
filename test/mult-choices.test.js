// Enhetstester: flerval för multiplikation 0–10 (#552) – multDistractors/
// multChoices i src/mult/generator.js + att `multiplication_0_10` levererar
// båda svarssätten. Bevisar för ALLA a×b i 0–10: 4 unika icke-negativa
// alternativ, facit med, rimliga fel (tabellgrannar först) och att facits
// plats fördelas jämnt.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeQuestion, multDistractors, multChoices, seededRng, checkMultAnswer } from "../src/mult/generator.js";
import { requireGameMode } from "../src/live/modes/index.js";

const ALLA = [];
for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) ALLA.push(makeQuestion(a, b));

describe("multChoices – alla a×b i 0–10", () => {
  it("4 unika, icke-negativa heltal med facit på answerIndex (många frön)", () => {
    for (const seed of [1, 2, 3, 42, 999]) {
      const rng = seededRng(seed);
      for (const q of ALLA) {
        const { options, answerIndex } = multChoices(q, rng);
        assert.equal(options.length, 4, q.key);
        assert.equal(new Set(options).size, 4, `${q.key}: dubblett ${options}`);
        assert.ok(options.every((n) => Number.isInteger(n) && n >= 0), `${q.key}: ${options}`);
        assert.equal(options[answerIndex], q.answer, q.key);
        assert.equal(options.filter((n) => n === q.answer).length, 1, q.key);
      }
    }
  });

  it("felalternativen är rimliga: tabellgrannar när de finns, annars nära facit", () => {
    for (const q of ALLA) {
      const { a, b, answer } = q;
      const grannar = new Set([a * (b - 1), a * (b + 1), (a - 1) * b, (a + 1) * b].filter((n) => n >= 0 && n !== answer));
      const fel = multDistractors(q, seededRng(a * 11 + b));
      assert.equal(fel.length, 3);
      assert.ok(!fel.includes(answer));
      const antalGrannar = fel.filter((n) => grannar.has(n)).length;
      assert.equal(antalGrannar, Math.min(3, grannar.size), `${q.key}: ${fel} (grannar ${[...grannar]})`);
      // Inget fel ligger orimligt långt bort (högst ett par tabellsteg).
      for (const n of fel) assert.ok(Math.abs(n - answer) <= 2 * Math.max(a, b, 5), `${q.key}: ${n} för långt från ${answer}`);
    }
  });

  it("exemplet 7×8: alla fel är tabellgrannar (48, 49, 63, 64) – inga slumptal", () => {
    const tillatna = new Set([48, 49, 63, 64]);
    for (let s = 0; s < 50; s++) {
      for (const n of multDistractors(makeQuestion(7, 8), seededRng(s))) assert.ok(tillatna.has(n), `${n}`);
    }
  });

  it("facits plats fördelas jämnt över 1–4", () => {
    const rng = seededRng(7);
    const pos = [0, 0, 0, 0];
    const varv = 40;
    for (let i = 0; i < varv; i++) for (const q of ALLA) pos[multChoices(q, rng).answerIndex]++;
    const n = varv * ALLA.length;
    for (const p of pos) assert.ok(Math.abs(p / n - 0.25) < 0.02, `fördelning ${pos}`);
  });

  it("seedbar: samma frö → samma alternativ, olika frön → varierar", () => {
    const q = makeQuestion(6, 7);
    assert.deepEqual(multChoices(q, seededRng(5)), multChoices(q, seededRng(5)));
    const olika = new Set(Array.from({ length: 20 }, (_, s) => multChoices(q, seededRng(s)).options.join(",")));
    assert.ok(olika.size > 5);
  });
});

describe("multiplication_0_10 – båda svarssätten", () => {
  const MULT = requireGameMode("multiplication_0_10");

  it("deklarerar answerKinds [free, choice] och choices()", () => {
    assert.deepEqual([...MULT.answerKinds], ["free", "choice"]);
    assert.equal(typeof MULT.choices, "function");
  });

  it("ett valt alternativ rättas med samma checkAnswer som Skriv själv", () => {
    const src = MULT.createSource({ rng: seededRng(3) });
    for (let i = 0; i < 300; i++) {
      const q = src.next();
      const { options, answerIndex } = MULT.choices(q, seededRng(i));
      options.forEach((opt, j) => {
        const r = MULT.checkAnswer(q, String(opt));
        assert.equal(r.valid, true);
        assert.equal(r.correct, j === answerIndex);
        assert.deepEqual(r, checkMultAnswer(q, String(opt)));
      });
    }
  });
});
