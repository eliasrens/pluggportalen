// ============================================================================
// Enhetstester (#621): flervalets längdklassning (choice-answer.js
// textLength/keepNumbers) – korta tal (multiplikation) behåller den stora
// stilen, långa quiztexter blir "lang" (mindre text som skalar efter
// behållaren), ett långt ord tvingar "lang" så att ordet inte bryts, och tal
// med tusentalsmellanrum får hårt mellanslag. Projektorns schakt (sb-fraga.js)
// använder samma klassning. Layouten (ingen scroll, inga brutna ord) provas i
// preview/preview-live-langtext.html och preview-snilleblixt-demo.html?fragor=lastext.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { textLength, keepNumbers, TEXT_LIMITS } from "../src/live/choice-answer.js";
import { DEMO_QUIZ } from "../src/live/demo-quiz.js";
import { demoSnapshot } from "../src/live/formats/snilleblixt/sb-demo.js";

describe("textLength – alternativ", () => {
  it("multiplikationens tal är kort (oförändrad stor stil)", () => {
    assert.equal(textLength(["56", "64", "48", "66"], "alt"), "kort");
    assert.equal(textLength(["100", "-12", "3/4", "12,5"], "alt"), "kort");
    assert.equal(textLength([7, 8, 0, 81], "alt"), "kort");
  });

  it("korta ord är mellan, långa meningar lang", () => {
    assert.equal(textLength(["Oslo", "Bergen", "Trondheim", "Stavanger"], "alt"), "mellan");
    assert.equal(textLength(["Ja", "Nej, de kostar ungefär 5 000 kr"], "alt"), "lang");
  });

  it("det LÄNGSTA alternativet avgör", () => {
    assert.equal(textLength(["1", "2", "3", "En mycket lång text här"], "alt"), "lang");
  });

  it("ett långt ord ger lang även i kort text (ordet ska inte brytas)", () => {
    assert.equal(textLength(["Fotosyntesen"], "alt"), "lang");
    assert.equal(textLength(["Stockholm"], "alt"), "mellan");
  });

  it("gränserna", () => {
    const { kort, mellan } = TEXT_LIMITS.alt;
    assert.equal(textLength(["x".repeat(kort)], "alt"), "kort");
    assert.equal(textLength(["abcd ".repeat(4).slice(0, kort + 1)], "alt"), "mellan");
    assert.equal(textLength(["abcd ".repeat(10).slice(0, mellan)], "alt"), "mellan");
    assert.equal(textLength(["abcd ".repeat(10).slice(0, mellan + 1)], "alt"), "lang");
  });

  it("tomt/saknat räknas som kort, blanksteg trimmas", () => {
    assert.equal(textLength([], "alt"), "kort");
    assert.equal(textLength([null, undefined, ""], "alt"), "kort");
    assert.equal(textLength(["   56   "], "alt"), "kort");
  });
});

describe("textLength – frågan", () => {
  it("multiplikationsfrågor är korta", () => {
    for (const q of ["7 · 8 = ?", "7 × 8", "12 × 12 = ?", "56 / 8 = ?"]) assert.equal(textLength(q, "fraga"), "kort", q);
  });

  it("en kort quizfråga är mellan, en lång quizfråga lang", () => {
    assert.equal(textLength("Vad är huvudstaden i Norge?", "fraga"), "mellan");
    assert.equal(textLength(DEMO_QUIZ[0].text, "fraga"), "lang");
  });

  it("skärmdumpens fråga och alternativ (#621) klassas lang", () => {
    const q = DEMO_QUIZ[0];
    assert.equal(textLength(q.text, "fraga"), "lang");
    assert.equal(textLength(q.options, "alt"), "lang");
  });
});

describe("keepNumbers", () => {
  it("tusentalsmellanrum blir hårt mellanslag", () => {
    assert.equal(keepNumbers("Nej, de kostar ungefär 5 000 kr"), "Nej, de kostar ungefär 5 000 kr");
    assert.equal(keepNumbers("1 604 kr och 4 000 kr"), "1 604 kr och 4 000 kr");
    assert.equal(keepNumbers("12 000 000"), "12 000 000");
  });

  it("rör inte vanliga ord eller korta tal", () => {
    assert.equal(keepNumbers("7 · 8 = ?"), "7 · 8 = ?");
    assert.equal(keepNumbers("De är 4 personer"), "De är 4 personer");
    assert.equal(keepNumbers("5 1234"), "5 1234");
    assert.equal(keepNumbers(null), "");
    assert.equal(keepNumbers(56), "56");
  });
});

describe("Snilleblixtens demo med långa quizfrågor (#621)", () => {
  it("fragor=lastext: flerval med lästext, facit pekar på rätt alternativ", () => {
    const snap = demoSnapshot("choice", "lastext");
    assert.equal(snap.questions.length, 10);
    snap.questions.forEach((q, i) => {
      const src = DEMO_QUIZ[i % DEMO_QUIZ.length];
      assert.deepEqual(q.options, src.options);
      assert.equal(q.passage, src.passage || undefined);
      assert.equal(snap.facit[i].answerIndex, src.answerIndex);
      assert.equal(snap.facit[i].correctAnswer, src.options[src.answerIndex]);
    });
  });

  it("fragor=quiz: utan lästext; standard = multiplikation som förut", () => {
    assert.ok(demoSnapshot("choice", "quiz").questions.every((q) => !("passage" in q)));
    assert.equal(demoSnapshot("choice").questions[0].text, "7 × 8");
  });
});
