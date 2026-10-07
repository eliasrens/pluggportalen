// Enhetstester: Live gameMode-registry (#457) – src/live/game-modes.js +
// src/live/modes/. Bevisar interfacet, att multiplication_0_10 använder den
// gemensamma motorn, och att ett nytt läge kan läggas till utan kärnändring.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_GAME_MODE, getGameMode, requireGameMode, listGameModes } from "../src/live/modes/index.js";
import { registerGameMode, validateGameMode } from "../src/live/game-modes.js";
import { seededRng } from "../src/mult/generator.js";

describe("multiplication_0_10", () => {
  const mode = requireGameMode("multiplication_0_10");

  it("är förvalt och registrerat med visningsnamn/poäng/inputMode", () => {
    assert.equal(DEFAULT_GAME_MODE, "multiplication_0_10");
    assert.equal(mode.displayName, "Multiplikation 0–10 – snabbmatch");
    assert.equal(mode.pointsPerCorrect, 1);
    assert.equal(mode.inputMode, "numeric");
    assert.deepEqual(validateGameMode(mode), []);
    assert.ok(Object.isFrozen(mode));
  });

  it("createSource → frågor 0–10, utan direkt upprepning", () => {
    const src = mode.createSource({ rng: seededRng(3) });
    let prev = null;
    for (let i = 0; i < 1000; i++) {
      const q = src.next();
      assert.ok(q.a >= 0 && q.a <= 10 && q.b >= 0 && q.b <= 10);
      assert.equal(typeof q.text, "string");
      if (prev) assert.notEqual(q.key, prev.key);
      prev = q;
    }
  });

  it("checkAnswer + answerRecord + statKeys ger det reglerna och statistiken kräver", () => {
    const q = { key: "7x8", a: 7, b: 8, answer: 56, tables: [7, 8], text: "7 × 8" };
    const r = mode.checkAnswer(q, "54");
    assert.deepEqual(r, { valid: true, correct: false, given: 54, correctAnswer: 56 });
    assert.deepEqual(mode.answerRecord(q, r), { factorA: 7, factorB: 8, answer: 54, correctAnswer: 56 });
    assert.deepEqual(mode.statKeys(q), ["t7", "t8"]);
    assert.equal(mode.statCategories.length, 11);
    assert.deepEqual(mode.statCategories[0], { key: "t0", label: "0:ans tabell" });
    assert.equal(mode.checkAnswer(q, "").valid, false);
  });
});

describe("registret", () => {
  it("ett nytt läge (t.ex. addition) kan registreras utan att röra kärnan", () => {
    const addition = {
      id: "addition_test",
      displayName: "Addition (test)",
      icon: "➕",
      inputMode: "numeric",
      pointsPerCorrect: 1,
      createSource: () => ({ next: () => ({ key: "2+3", text: "2 + 3", a: 2, b: 3, answer: 5 }) }),
      checkAnswer: (q, raw) => ({ valid: raw !== "", correct: Number(raw) === q.answer, correctAnswer: q.answer }),
      answerRecord: (q, r) => ({ termA: q.a, termB: q.b, answer: Number(r.given) }),
      statKeys: () => ["all"],
      statCategories: [{ key: "all", label: "Alla" }],
    };
    registerGameMode(addition);
    assert.equal(getGameMode("addition_test").displayName, "Addition (test)");
    assert.deepEqual(listGameModes().map((m) => m.id).slice(0, 2), ["multiplication_0_10", "addition_test"]);
    assert.throws(() => registerGameMode(addition), /finns redan/);
  });

  it("ofullständiga lägen avvisas med tydliga fel; okänt id → null/kast", () => {
    assert.throws(() => registerGameMode({ id: "Bad-Id" }), /registerGameMode/);
    const errs = validateGameMode({ id: "x_y", displayName: "X", icon: "", inputMode: "voice", pointsPerCorrect: 0 });
    assert.ok(errs.some((e) => e.includes("inputMode")));
    assert.ok(errs.some((e) => e.includes("pointsPerCorrect")));
    assert.ok(errs.some((e) => e.includes("createSource")));
    assert.equal(getGameMode("geography"), null);
    assert.throws(() => requireGameMode("geography"), /Okänt/);
  });
});
