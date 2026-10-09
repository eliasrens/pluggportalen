// Enhetstester: svarssättet answerKind (#551, epic #550) – snittet format ∩
// spelläge, lärarens förval, sessionsfältet, svarets form (answer-writes) och
// elevsidans komponentval. Test 3b/3c körs med TEST-format och TEST-spellägen
// i registren (aldrig i produktion), så de inte beror på vilka format/lägen
// som byggts än. Regelsidan: test/firestore-rules-live-answerkind.test.js.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  requireFormat, answerKindsFor, defaultAnswerKind, resolveAnswerKind, answerKindOf,
} from "../src/live/formats/index.js";
import { registerFormat } from "../src/live/live-formats.js";
import { registerGameMode, validateGameMode } from "../src/live/game-modes.js";
import { requireGameMode } from "../src/live/modes/index.js";
import { validateSessionInput, buildSessionDoc } from "../src/live/live-core.js";
import { answerKindHtml } from "../src/live/live-setup-fields.js";
import { planLiveAnswerWrites, liveAnswerKindError } from "../src/tavling/answer-writes.js";
import { hasAnswerComponent, loadAnswerComponent } from "../src/live/answer-kinds.js";
import { mountFastAnswer } from "../src/mult/fast-answer.js";

const KM = requireFormat("klassmatch");
const MULT = requireGameMode("multiplication_0_10");

const testFormat = (id, over = {}) => ({
  id, displayName: id, icon: "🧪", scope: "inom-klass", minClasses: 1, maxClasses: 3,
  answerKinds: ["free", "choice"], pacing: "lärarstyrd", setupFields: [],
  compatibleGameModes: (m) => answerKindsFor(requireFormat(id), m).length > 0,
  validateSetup: () => [], buildSessionFields: () => ({}), sessionTitle: (s) => s.name,
  computeStandings: () => ({}), buildResult: () => ({}),
  projectorViews: async () => ({}), studentView: async () => ({}), historyRenderer: async () => ({}),
  ...over,
});
const testMode = (id, answerKinds) => ({
  id, displayName: id, icon: "🧪", inputMode: "numeric", pointsPerCorrect: 1,
  createSource: () => ({ next: () => ({ key: "q", text: "?" }) }),
  checkAnswer: () => ({ valid: true, correct: true, correctAnswer: 1 }),
  answerRecord: () => ({}), statKeys: () => [], statCategories: [],
  ...(answerKinds ? { answerKinds } : {}),
});

// "Snilleblixten" och "Guldrushen" som testformat (båda svarssätten), en
// multiplikation som kan leverera båda och ett quiz som bara har flerval.
const BLIXT = registerFormat(testFormat("test_blixt"));
const RUSH = registerFormat(testFormat("test_rush"));
const MULT2 = registerGameMode(testMode("test_mult_flerval", ["free", "choice"]));
const QUIZ = registerGameMode(testMode("test_quiz", ["choice"]));

const input = (over = {}) => ({
  name: "Fredagsmatch", format: "test_blixt", gameMode: "test_mult_flerval", classIds: ["4b"],
  classNames: { "4b": "4B" }, ...over,
});

describe("snittet format ∩ spelläge", () => {
  it("spelläge utan answerKinds = [\"free\"] (multiplikationen före #552)", () => {
    assert.deepEqual(answerKindsFor(BLIXT, {}), ["free"]);
    assert.deepEqual(answerKindsFor(BLIXT, { answerKinds: undefined }), ["free"]);
  });

  it("Klassmatchen + multiplikation: bara skriv själv, inget val", () => {
    assert.deepEqual(answerKindsFor(KM, MULT), ["free"]);
    assert.deepEqual(answerKindsFor(KM, MULT2), ["free"]);
    assert.equal(answerKindHtml(answerKindsFor(KM, MULT2), undefined), "");
    assert.deepEqual(answerKindsFor(KM, QUIZ), [], "Klassmatchen erbjuder inte quiz (bara flerval)");
    assert.equal(KM.compatibleGameModes(QUIZ), false);
  });

  it("3b: test-Snilleblixten + multiplikation → valet Skriv själv / Flerval visas, förval skriv själv", () => {
    const kinds = answerKindsFor(BLIXT, MULT2);
    assert.deepEqual(kinds, ["free", "choice"]);
    const html = answerKindHtml(kinds, undefined);
    assert.match(html, /Välj svarssätt/);
    assert.match(html, /value="free" checked/);
    assert.match(html, /✍️ Skriv själv/);
    assert.match(html, /🔘 Flerval/);
    assert.match(answerKindHtml(kinds, "choice"), /value="choice" checked/);
  });

  it("förval \"free\" om möjligt, även när formatet listar flerval först", () => {
    assert.equal(defaultAnswerKind(["choice", "free"]), "free");
    assert.equal(defaultAnswerKind(["choice"]), "choice");
    assert.equal(defaultAnswerKind([]), null);
    assert.match(answerKindHtml(["choice", "free"], "nope"), /value="free" checked/);
  });

  it("3c: test-Guldrushen + quiz → bara Flerval, inget val visas", () => {
    const kinds = answerKindsFor(RUSH, QUIZ);
    assert.deepEqual(kinds, ["choice"]);
    assert.equal(answerKindHtml(kinds, undefined), "");
    assert.equal(resolveAnswerKind(RUSH, QUIZ, undefined), "choice");
    assert.equal(resolveAnswerKind(RUSH, QUIZ, "free"), null);
  });

  it("format med bara skriv själv + quiz → inget gemensamt", () => {
    const fritt = registerFormat(testFormat("test_fritt", { answerKinds: ["free"] }));
    assert.deepEqual(answerKindsFor(fritt, QUIZ), []);
    assert.equal(resolveAnswerKind(fritt, QUIZ, undefined), null);
  });
});

describe("sessionen sparar answerKind", () => {
  it("3b: lärarens val sparas; saknat val = förvalet", () => {
    assert.deepEqual(validateSessionInput(input({ answerKind: "choice" })), []);
    assert.equal(buildSessionDoc(input({ answerKind: "choice" }), { uid: "t" }).answerKind, "choice");
    assert.equal(buildSessionDoc(input({ answerKind: "free" }), { uid: "t" }).answerKind, "free");
    assert.equal(buildSessionDoc(input(), { uid: "t" }).answerKind, "free");
  });

  it("3c: quiz → choice utan att läraren valt", () => {
    const i = input({ format: "test_rush", gameMode: "test_quiz" });
    assert.deepEqual(validateSessionInput(i), []);
    assert.equal(buildSessionDoc(i, { uid: "t" }).answerKind, "choice");
  });

  it("svarssätt som inte båda stöder nekas (formuläret) och kastar (dokumentet)", () => {
    const msg = "Välj ett svarssätt som både formatet och spelläget stöder.";
    assert.deepEqual(validateSessionInput(input({ format: "test_rush", gameMode: "test_quiz", answerKind: "free" })), [msg]);
    assert.deepEqual(validateSessionInput(input({ answerKind: "hologram" })), [msg]);
    const km = { ...input({ format: "klassmatch", classIds: ["a", "b"], durationMin: 20, divisors: { a: 1, b: 1 } }) };
    assert.deepEqual(validateSessionInput({ ...km, answerKind: "choice" }), [msg]);
    assert.deepEqual(validateSessionInput(km), []);
    assert.throws(() => buildSessionDoc({ ...km, answerKind: "choice" }, { uid: "t" }), /stöds inte/);
  });

  it("gamla sessioner utan answerKind = skriv själv", () => {
    assert.equal(answerKindOf({ name: "gammal" }), "free");
    assert.equal(answerKindOf({ answerKind: null }), "free");
    assert.equal(answerKindOf(null), "free");
    assert.equal(answerKindOf({ answerKind: "choice" }), "choice");
  });
});

describe("spelläge-interfacet: answerKinds", () => {
  it("valfritt; om det finns en icke-tom delmängd av free/choice", () => {
    assert.deepEqual(validateGameMode(testMode("ok_a")), []);
    assert.deepEqual(validateGameMode(testMode("ok_b", ["choice"])), []);
    for (const bad of [[], ["fritext"], "free", ["free", 1]]) {
      assert.match(validateGameMode(testMode("bad_x", bad)).join(), /answerKinds/);
    }
  });
});

describe("svarets form (planLiveAnswerWrites)", () => {
  const fv = { increment: (n) => ({ inc: n }), serverTimestamp: () => "TS" };
  const rec = { factorA: 7, factorB: 8, answer: 56, correctAnswer: 56 };
  const plan = (record, answerKind) => planLiveAnswerWrites({
    sessionId: "s", attemptId: "a1234567", uid: "alma", classId: "4b", mode: "multiplication_0_10",
    record, isCorrect: true, shard: 0, fv, ...(answerKind ? { answerKind } : {}),
  });

  it("skriv själv (default): svarsdokumentet exakt som före #551", () => {
    const doc = plan(rec)[0].data;
    assert.deepEqual(Object.keys(doc).sort(),
      ["answer", "at", "classId", "correctAnswer", "factorA", "factorB", "isCorrect", "mode", "shard", "uid"]);
    assert.deepEqual(plan(rec, "free"), plan(rec));
  });

  it("flerval: answerKind + choiceIndex på dokumentet", () => {
    const doc = plan({ ...rec, choiceIndex: 2 }, "choice")[0].data;
    assert.equal(doc.answerKind, "choice");
    assert.equal(doc.choiceIndex, 2);
    assert.equal(doc.answer, 56);
  });

  it("fel form för sessionens svarssätt kastar", () => {
    assert.throws(() => plan(rec, "choice"), /choiceIndex/);
    assert.throws(() => plan({ ...rec, choiceIndex: 4 }, "choice"), /choiceIndex/);
    assert.throws(() => plan({ ...rec, choiceIndex: 1.5 }, "choice"), /choiceIndex/);
    assert.throws(() => plan({ ...rec, choiceIndex: 0 }, "free"), /choiceIndex/);
    assert.throws(() => plan(rec, "hologram"), /okänt svarssätt/);
    assert.equal(liveAnswerKindError("choice", { choiceIndex: 0 }), null);
    assert.equal(liveAnswerKindError("free", {}), null);
  });
});

describe("elevsidans svarskomponent (answer-kinds.js)", () => {
  it("skriv själv = befintliga fast-answer", async () => {
    assert.equal(hasAnswerComponent("free"), true);
    assert.equal(await loadAnswerComponent("free"), mountFastAnswer);
  });

  it("okänt svarssätt saknas och kastar", async () => {
    assert.equal(hasAnswerComponent("hologram"), false);
    assert.equal(hasAnswerComponent("toString"), false);
    await assert.rejects(loadAnswerComponent("hologram"), /svarskomponent/);
  });
});
