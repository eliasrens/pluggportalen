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
import { mountChoiceFlow } from "../src/live/choice-flow.js";

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
  ...(answerKinds?.includes("choice") ? { choices: () => ({ options: [1, 2, 3, 4], answerIndex: 0 }) } : {}),
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

  it("riktiga multiplikationen (#552) levererar båda; med test-Snilleblixten visas valet", () => {
    assert.deepEqual(MULT.answerKinds, ["free", "choice"]);
    assert.deepEqual(validateGameMode(MULT), []);
    assert.deepEqual(answerKindsFor(BLIXT, MULT), ["free", "choice"]);
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

  it("choice kräver choices()", () => {
    const { choices, ...utan } = testMode("bad_c", ["choice"]);
    assert.match(validateGameMode(utan).join(), /choices\(\) krävs/);
  });
});

describe("svarets form (planLiveAnswerWrites)", () => {
  const fv = { increment: (n) => ({ inc: n }), serverTimestamp: () => "TS" };
  const rec = { factorA: 7, factorB: 8, answer: 56, correctAnswer: 56 };
  const plan = (record, answerKind, choiceIndex) => planLiveAnswerWrites({
    sessionId: "s", attemptId: "a1234567", uid: "alma", classId: "4b", mode: "multiplication_0_10",
    record, isCorrect: true, shard: 0, fv, ...(answerKind ? { answerKind } : {}), choiceIndex,
  });

  it("skriv själv (default): svarsdokumentet exakt som före #551", () => {
    const doc = plan(rec)[0].data;
    assert.deepEqual(Object.keys(doc).sort(),
      ["answer", "at", "classId", "correctAnswer", "factorA", "factorB", "isCorrect", "mode", "shard", "uid"]);
    assert.deepEqual(plan(rec, "free"), plan(rec));
  });

  it("flerval: answerKind + choiceIndex på dokumentet", () => {
    const doc = plan(rec, "choice", 2)[0].data;
    assert.equal(doc.answerKind, "choice");
    assert.equal(doc.choiceIndex, 2);
    assert.equal(doc.answer, 56);
  });

  it("fel form för sessionens svarssätt kastar", () => {
    assert.throws(() => plan(rec, "choice"), /choiceIndex/);
    assert.throws(() => plan(rec, "choice", 4), /choiceIndex/);
    assert.throws(() => plan(rec, "choice", 1.5), /choiceIndex/);
    assert.throws(() => plan(rec, "free", 0), /choiceIndex/);
    assert.throws(() => plan(rec, "hologram"), /okänt svarssätt/);
    assert.equal(liveAnswerKindError("choice", 0), null);
    assert.equal(liveAnswerKindError("free", undefined), null);
  });
});

describe("elevsidans svarskomponent (answer-kinds.js)", () => {
  it("skriv själv = befintliga fast-answer", async () => {
    assert.equal(hasAnswerComponent("free"), true);
    assert.equal(await loadAnswerComponent("free"), mountFastAnswer);
  });

  it("flerval är inkopplat (choice-flow.js)", () => {
    assert.equal(hasAnswerComponent("choice"), true);
  });

  it("okänt svarssätt saknas och kastar", async () => {
    assert.equal(hasAnswerComponent("hologram"), false);
    assert.equal(hasAnswerComponent("toString"), false);
    await assert.rejects(loadAnswerComponent("hologram"), /svarskomponent/);
  });
});

describe("flervalsflödet (choice-flow.js) med stub-knappar", () => {
  const stubEl = () => ({ textContent: "", classList: { add() {}, remove() {} } });
  function rig(over = {}) {
    const fb = stubEl();
    const root = { classList: { add() {}, remove() {} }, innerHTML: "", querySelector: (s) => (s === ".fa-feedback" ? fb : {}) };
    const grid = { log: [], onChoose: null };
    const mountGrid = (_el, o) => {
      grid.onChoose = o.onChoose;
      return {
        setQuestion: (q) => grid.log.push(["q", q.question, q.options.join(",")]),
        setEnabled: (on) => grid.log.push(["en", on]),
        reveal: (i) => grid.log.push(["reveal", i]),
        destroy: () => grid.log.push(["destroy"]),
      };
    };
    const answers = [];
    let n = 0;
    const flow = mountChoiceFlow(root, {
      source: { next: () => ({ key: `q${++n}`, text: `7 × ${n}`, answer: 7 * n }) },
      check: (q, raw) => ({ valid: true, correct: Number(raw) === q.answer, correctAnswer: q.answer, given: Number(raw) }),
      choices: (q) => ({ options: [q.answer + 1, q.answer, q.answer + 2, q.answer + 3], answerIndex: 1 }),
      onAnswer: (a) => answers.push(a),
      feedbackMs: { correct: 1, wrong: 1 },
      ...over,
    }, mountGrid);
    return { flow, grid, answers, fb };
  }

  it("avstängd → väntetext; på → fråga med modens alternativ", () => {
    const { flow, grid } = rig({ enabled: false, idleText: "Snart…" });
    assert.deepEqual(grid.log.at(-2), ["q", "Snart…", ""]);
    flow.setEnabled(true);
    assert.deepEqual(grid.log.at(-1), ["q", "7 × 1 = ?", "8,7,9,10"]);
    flow.destroy();
  });

  it("valt alternativ rättas på VÄRDET; attempt bär choiceIndex; ett svar per fråga", () => {
    const { flow, grid, answers, fb } = rig();
    grid.onChoose(1, 7);
    grid.onChoose(2, 9); // andra valet på samma fråga ignoreras
    assert.equal(answers.length, 1);
    assert.equal(answers[0].raw, "7");
    assert.equal(answers[0].choiceIndex, 1);
    assert.equal(answers[0].result.correct, true);
    assert.match(answers[0].attemptId, /^[A-Za-z0-9_-]{8,64}$/);
    assert.deepEqual(grid.log.at(-1), ["reveal", 1]);
    assert.equal(fb.textContent, "✅ RÄTT!");
    flow.destroy();
  });

  it("fel svar visar rätt svar, sedan nästa fråga", async () => {
    const { flow, grid, answers, fb } = rig();
    grid.onChoose(0, 8);
    assert.equal(answers[0].result.correct, false);
    assert.equal(fb.textContent, "❌ FEL – rätt svar var 7");
    await new Promise((r) => setTimeout(r, 10));
    assert.deepEqual(grid.log.at(-1), ["q", "7 × 2 = ?", "15,14,16,17"]);
    grid.onChoose(1, 14);
    assert.equal(answers.length, 2);
    assert.notEqual(answers[1].attemptId, answers[0].attemptId);
    flow.destroy();
  });

  it("avstängd under feedback → ingen ny fråga, val ignoreras", async () => {
    const { flow, grid, answers } = rig();
    grid.onChoose(1, 7);
    flow.setEnabled(false, "Matchen är slut!");
    await new Promise((r) => setTimeout(r, 10));
    assert.deepEqual(grid.log.at(-1), ["en", false]);
    grid.onChoose(1, 7);
    assert.equal(answers.length, 1);
    flow.destroy();
  });
});
