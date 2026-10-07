// Enhetstester: gemensam multiplikationsmotor (#457) – src/mult/generator.js.
// Bevisar: alla 121 kombinationer förekommer, balans över tid (shuffle-bag),
// aldrig samma fråga direkt efter, aldrig spegel (7×8 → 8×7) direkt efter,
// och att rättningen bara godtar heltal.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createMultGenerator, makeQuestion, tablesOf, isMirror, checkMultAnswer, seededRng, DEFAULT_WEIGHT,
} from "../src/mult/generator.js";

function draw(gen, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(gen.next());
  return out;
}

// En hel påse med default-vikt = 40 lätta (×0/×1) + 81·2 övriga.
const BAG = (() => { let n = 0; for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) n += DEFAULT_WEIGHT(a, b); return n; })();

describe("createMultGenerator – täckning och balans", () => {
  it("en påse har 202 frågor och innehåller ALLA 121 kombinationer 0–10 × 0–10", () => {
    assert.equal(BAG, 202);
    const gen = createMultGenerator({ rng: seededRng(1) });
    const seen = new Set(draw(gen, BAG).map((q) => q.key));
    assert.equal(seen.size, 121);
  });

  it("varje kombination förekommer exakt vikt-gånger per påse (balans) över många påsar", () => {
    for (const seed of [2, 3, 4, 99, 12345]) {
      const gen = createMultGenerator({ rng: seededRng(seed) });
      const counts = new Map();
      const bags = 20;
      for (const q of draw(gen, BAG * bags)) counts.set(q.key, (counts.get(q.key) || 0) + 1);
      for (let a = 0; a <= 10; a++) {
        for (let b = 0; b <= 10; b++) {
          const want = DEFAULT_WEIGHT(a, b) * bags;
          const got = counts.get(`${a}x${b}`) || 0;
          // Påsgränsen kan skjuta en krockande post in i nästa påse → ±1.
          assert.ok(Math.abs(got - want) <= 1, `seed ${seed} ${a}x${b}: ${got} ≠ ${want}`);
        }
      }
    }
  });

  it("inget tabell-snedfördelning: varje tabell 2–9 får lika många frågor, lätta ca 20 %", () => {
    const gen = createMultGenerator({ rng: seededRng(7) });
    const qs = draw(gen, BAG * 10);
    const easy = qs.filter((q) => q.a <= 1 || q.b <= 1).length / qs.length;
    assert.ok(easy > 0.18 && easy < 0.22, `andel lätta ${easy}`);
    const perTable = new Array(11).fill(0);
    for (const q of qs) for (const t of q.tables) perTable[t]++;
    const mid = perTable.slice(2, 10);
    assert.ok(Math.max(...mid) - Math.min(...mid) <= 2, `tabell 2–9 obalanserad: ${mid}`);
  });

  it("aldrig samma fråga två gånger i rad (100 000 dragningar, flera frön)", () => {
    for (const seed of [11, 22, 33]) {
      const gen = createMultGenerator({ rng: seededRng(seed) });
      let prev = gen.next();
      for (let i = 0; i < 100000; i++) {
        const q = gen.next();
        assert.notEqual(q.key, prev.key, `upprepning ${q.key} vid ${i}`);
        prev = q;
      }
    }
  });

  it("aldrig spegelvänd fråga direkt efter (7×8 → 8×7), men båda förekommer över tid", () => {
    const gen = createMultGenerator({ rng: seededRng(5) });
    const qs = draw(gen, 50000);
    for (let i = 1; i < qs.length; i++) {
      assert.ok(!isMirror(qs[i - 1], qs[i]), `spegel ${qs[i - 1].key} → ${qs[i].key} vid ${i}`);
    }
    const keys = new Set(qs.map((q) => q.key));
    assert.ok(keys.has("7x8") && keys.has("8x7"));
  });

  it("håller även för små intervall (2–3) där krockar är vanliga", () => {
    const gen = createMultGenerator({ min: 2, max: 3, rng: seededRng(8) });
    const qs = draw(gen, 2000);
    for (let i = 1; i < qs.length; i++) {
      assert.notEqual(qs[i].key, qs[i - 1].key);
      assert.ok(!isMirror(qs[i - 1], qs[i]));
    }
    assert.equal(new Set(qs.map((q) => q.key)).size, 4);
  });

  it("samma frö ger samma ström (reproducerbart) och fungerar med Math.random", () => {
    const k1 = draw(createMultGenerator({ rng: seededRng(42) }), 50).map((q) => q.key);
    const k2 = draw(createMultGenerator({ rng: seededRng(42) }), 50).map((q) => q.key);
    assert.deepEqual(k1, k2);
    const q = createMultGenerator().next();
    assert.ok(q.a >= 0 && q.a <= 10 && q.b >= 0 && q.b <= 10);
  });

  it("egen vikt (likafördelning) och ogiltigt intervall kastar", () => {
    const gen = createMultGenerator({ rng: seededRng(9), weight: () => 1 });
    assert.equal(new Set(draw(gen, 121).map((q) => q.key)).size, 121);
    assert.throws(() => createMultGenerator({ min: 5, max: 2 }));
  });
});

describe("frågeform, tabeller och rättning", () => {
  it("makeQuestion bär facit, nyckel, text och tabeller", () => {
    assert.deepEqual(makeQuestion(7, 8), { key: "7x8", a: 7, b: 8, answer: 56, tables: [7, 8], text: "7 × 8" });
    assert.deepEqual(tablesOf(6, 6), [6]);
    assert.ok(isMirror(makeQuestion(7, 8), makeQuestion(8, 7)));
    assert.ok(!isMirror(makeQuestion(7, 7), makeQuestion(7, 7)));
  });

  it("checkMultAnswer: rätt, fel, blanksteg ok, tomt/skräp/negativt/decimal = ogiltigt", () => {
    const q = makeQuestion(7, 8);
    assert.deepEqual(checkMultAnswer(q, "56"), { valid: true, correct: true, given: 56, correctAnswer: 56 });
    assert.equal(checkMultAnswer(q, " 56 ").correct, true);
    assert.equal(checkMultAnswer(q, "54").correct, false);
    assert.equal(checkMultAnswer(q, "54").valid, true);
    assert.equal(checkMultAnswer(q, 56).correct, true);
    for (const bad of ["", "  ", "abc", "-56", "5.6", "5,6", "12345", null, undefined]) {
      assert.equal(checkMultAnswer(q, bad).valid, false, `"${bad}"`);
    }
    assert.equal(checkMultAnswer(makeQuestion(0, 9), "0").correct, true);
  });
});
