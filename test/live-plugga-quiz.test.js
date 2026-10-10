// Enhetstester: Live-spelläget plugga_quiz (#553, epic #550) – urval,
// normalisering, för-få-varning, passage-regeln, facit-uppdelningen och
// registreringen (bara flerval; Klassmatchen erbjuder inte quiz).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeOptionText, prepareQuizQuestion, selectQuizQuestions, summarizeQuizArea, quizAreaMessage,
  minQuestionsFor, buildQuizSnapshot, joinFacit, checkQuizAnswer, quizStatKeys,
  QUIZ_DEFAULT_MIN_QUESTIONS, QUIZ_PASSAGE_POLICY, QUIZ_PASSAGE_MAX, QUIZ_TEXT_REF_WORDS, refersToText,
  countPassageQuestions,
} from "../src/live/modes/plugga-quiz-core.js";
import { requireGameMode, listGameModes } from "../src/live/modes/index.js";
import { validateGameMode } from "../src/live/game-modes.js";
import { requireFormat, answerKindsFor, resolveAnswerKind } from "../src/live/formats/index.js";
import { registerFormat, validateFormat } from "../src/live/live-formats.js";
import { answerKindHtml } from "../src/live/live-setup-fields.js";
import { validateSessionInput, buildSessionDoc } from "../src/live/live-core.js";
import { QUESTION_CATEGORY_KEYS } from "../src/exercise-types.js";

const QUIZ = requireGameMode("plugga_quiz");
const KM = requireFormat("klassmatch");

const fraga = (id, over = {}) => ({
  id, question: `Fråga ${id}?`, options: ["A", "B", "C", "D"], answerIndex: 1, explanation: `För att ${id}.`, ...over,
});
const seqRng = (vals) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};

// Test-Guldrushen: båda svarssätten (som spec §6.2), minQuestions 8.
const testFormat = (id, over = {}) => ({
  id, displayName: id, icon: "🧪", scope: "inom-klass", minClasses: 1, maxClasses: 3,
  answerKinds: ["free", "choice"], pacing: "lärarstyrd", setupFields: [],
  compatibleGameModes: (m) => answerKindsFor(requireFormat(id), m).length > 0,
  validateSetup: () => [], buildSessionFields: () => ({}), sessionTitle: (s) => s.name,
  computeStandings: () => ({}), buildResult: () => ({}),
  projectorViews: async () => ({}), studentView: async () => ({}), historyRenderer: async () => ({}),
  ...over,
});
const RUSH = registerFormat(testFormat("test_quiz_rush", { displayName: "Guldrushen", minQuestions: 8 }));

describe("plugga_quiz – registreringen", () => {
  it("är ett giltigt, registrerat spelläge med bara flerval", () => {
    assert.deepEqual(validateGameMode(QUIZ), []);
    assert.ok(listGameModes().some((m) => m.id === "plugga_quiz"));
    assert.deepEqual(QUIZ.answerKinds, ["choice"]);
    assert.equal(QUIZ.passagePolicy, "fallback");
  });

  it("3c: Guldrushen-/testformat + quiz → bara Flerval, inget val visas", () => {
    const kinds = answerKindsFor(RUSH, QUIZ);
    assert.deepEqual(kinds, ["choice"]);
    assert.equal(answerKindHtml(kinds, undefined), "");
    assert.equal(resolveAnswerKind(RUSH, QUIZ, undefined), "choice");
    assert.equal(resolveAnswerKind(RUSH, QUIZ, "free"), null);
  });

  it("Klassmatchen erbjuder inte quiz (bara skriv själv – facit skulle hamna hos eleven)", () => {
    assert.equal(KM.compatibleGameModes(QUIZ), false);
    assert.deepEqual(answerKindsFor(KM, QUIZ), []);
  });

  it("statKeys: kategorier ur QUESTION_CATEGORY_KEYS + ovrig, och per fråga", () => {
    assert.deepEqual(QUIZ.statCategories.map((c) => c.key), [...QUESTION_CATEGORY_KEYS, "ovrig"]);
    assert.deepEqual(QUIZ.statKeys({ id: "q1", category: "fakta" }), ["fakta", "q:q1"]);
    assert.deepEqual(QUIZ.statKeys({ id: "q2" }), ["ovrig", "q:q2"]);
    assert.deepEqual(quizStatKeys({ id: "q3", category: "hittepå" }), ["ovrig", "q:q3"]);
  });
});

describe("normalisering och urval", () => {
  it("normalizeOptionText: blanksteg ihop, trim, NFC", () => {
    assert.equal(normalizeOptionText("  Gustav \t Vasa\n"), "Gustav Vasa");
    assert.equal(normalizeOptionText("Gävle"), "Gävle");
    assert.equal(normalizeOptionText(1523), "1523");
    assert.equal(normalizeOptionText(null), "");
  });

  it("alternativ som blir lika efter normalisering slås ihop; facit pekar om", () => {
    const r = prepareQuizQuestion(fraga("x", { options: ["Oslo", " Stockholm ", "Stockholm", "Bergen"], answerIndex: 2 }));
    assert.equal(r.ok, true);
    assert.deepEqual(r.q.options, ["Oslo", "Stockholm", "Bergen"]);
    assert.equal(r.q.answerIndex, 1);
    assert.equal(new Set(r.q.options).size, r.q.options.length, "alla alternativ unika");
  });

  it("blandat område: bara frågorna utan passage används (som Pluggas plainQuizPool)", () => {
    assert.equal(QUIZ_PASSAGE_POLICY, "fallback");
    assert.deepEqual(prepareQuizQuestion(fraga("p", { passage: "En text …" })), { ok: false, reason: "passage" });
    assert.equal(prepareQuizQuestion(fraga("p", { passage: "   " })).ok, true, "tom passage = vanlig fråga");
    const { usable, skipped } = selectQuizQuestions([fraga("a", { passage: "t" }), fraga("b"), fraga("c", { passage: "t" }), fraga("d")]);
    assert.deepEqual(usable.map((q) => q.id), ["b", "d"]);
    assert.ok(usable.every((q) => !("passage" in q)));
    assert.equal(skipped.passage, 2);
  });

  it("rutan av, bara passage-frågor (t.ex. Vikingatiden 2.0, #582) → används UTAN passage", () => {
    const quiz = Array.from({ length: 6 }, (_, i) => fraga(`v${i}`, { passage: `  Vikingatiden  pågick ${i}. ` }));
    const s = summarizeQuizArea(quiz);
    assert.equal(s.usable, 6);
    assert.equal(s.empty, false);
    assert.equal(s.withPassage, 6);
    assert.deepEqual(s.skipped, {});
    assert.match(quizAreaMessage(s).text, /6 frågor kan användas \(av 6/);
    assert.ok(selectQuizQuestions(quiz).usable.every((q) => !("passage" in q)));
    const { questions } = buildQuizSnapshot(quiz);
    assert.equal(questions.length, 6);
    assert.equal(JSON.stringify(questions).includes("Vikingatiden pågick"), false, "passagen skickas inte med");
  });

  it("rutan av: frågor som kräver texten (\"Enligt texten …\") filtreras bort", () => {
    const quiz = [
      fraga("a", { question: "Enligt texten, vad gjorde vikingarna?", passage: "t" }),
      fraga("b", { question: "Vad gör författaren i början?", passage: "t" }),
      fraga("c", { question: "Vilka år räknas som vikingatiden?", passage: "t" }),
    ];
    const { usable, skipped } = selectQuizQuestions(quiz);
    assert.deepEqual(usable.map((q) => q.id), ["c"]);
    assert.equal(skipped["kraver-text"], 2);
    assert.match(quizAreaMessage(summarizeQuizArea(quiz)).text, /2 som hänvisar till texten/);
  });

  it("refersToText: orden i QUIZ_TEXT_REF_WORDS, skiftlägesokänsligt och som hela ord", () => {
    for (const w of QUIZ_TEXT_REF_WORDS) assert.equal(refersToText(`Vad säger ${w.toUpperCase()} om det?`), true, w);
    assert.equal(refersToText("ENLIGT TEXTEN?"), true);
    assert.equal(refersToText("Vilka år räknas som vikingatiden?"), false);
    assert.equal(refersToText("Hur många stycken fanns det?"), false);
    assert.equal(refersToText("Vad betyder enlighet?"), false);
  });

  it("rutan på: alla frågor används, passagen följer med och text-hänvisningar är tillåtna", () => {
    const quiz = [
      fraga("a"),
      fraga("b", { question: "Enligt texten, vad?", passage: "  Kort  text. " }),
      fraga("c", { passage: "Annan text." }),
    ];
    const { usable } = selectQuizQuestions(quiz, { showPassage: true });
    assert.deepEqual(usable.map((q) => q.id), ["a", "b", "c"]);
    assert.equal(usable[1].passage, "Kort text.", "normaliserad");
    assert.equal("passage" in usable[0], false);
    assert.equal(summarizeQuizArea(quiz, { showPassage: true }).usable, 3);
    assert.equal(summarizeQuizArea(quiz).usable, 1, "rutan av: bara frågan utan passage");
    assert.equal(countPassageQuestions(quiz), 2);
  });

  it("rutan på: passage längre än QUIZ_PASSAGE_MAX hoppas över", () => {
    assert.equal(QUIZ_PASSAGE_MAX, 300);
    const lang = "x".repeat(301);
    const opt = { showPassage: true };
    assert.equal(prepareQuizQuestion(fraga("l", { passage: lang }), 0, opt).reason, "lang-passage");
    assert.equal(prepareQuizQuestion(fraga("k", { passage: "x".repeat(300) }), 0, opt).ok, true);
    const s = summarizeQuizArea([fraga("a", { passage: lang }), fraga("b", { passage: "kort" })], opt);
    assert.equal(s.usable, 1);
    assert.equal(s.skipped["lang-passage"], 1);
    assert.match(quizAreaMessage(s).text, /1 med för lång text/);
    assert.equal(summarizeQuizArea([fraga("a", { passage: lang })]).usable, 1, "rutan av: lång passage spelar ingen roll");
  });

  it("för många / för få olika alternativ och ofullständiga frågor hoppas över", () => {
    assert.equal(prepareQuizQuestion(fraga("m", { options: ["1", "2", "3", "4", "5"] })).reason, "for-manga-alternativ");
    assert.equal(prepareQuizQuestion(fraga("f", { options: ["Ja", " Ja"], answerIndex: 0 })).reason, "fa-alternativ");
    assert.equal(prepareQuizQuestion(fraga("i", { answerIndex: 4 })).reason, "invalid");
    assert.equal(prepareQuizQuestion(fraga("i", { question: "  " })).reason, "invalid");
    assert.equal(prepareQuizQuestion(null).reason, "invalid");
    // Fem alternativ varav två dubbletter → fyra kvar = spelbar.
    const ok = prepareQuizQuestion(fraga("d", { options: ["a", "b", "c", "d", "a "], answerIndex: 4 }));
    assert.equal(ok.ok, true);
    assert.equal(ok.q.answerIndex, 0);
    assert.equal(prepareQuizQuestion(fraga("t", { options: ["Sant", "Falskt"], answerIndex: 1 })).ok, true, "2 alternativ räcker");
  });

  it("kategori bara ur QUESTION_CATEGORY_KEYS (alias normaliseras, okänd tas bort)", () => {
    assert.equal(prepareQuizQuestion(fraga("a", { category: "Begreppsförståelse" })).q.category, "begrepp");
    assert.equal(prepareQuizQuestion(fraga("b", { category: "fakta" })).q.category, "fakta");
    assert.equal("category" in prepareQuizQuestion(fraga("c", { category: "sport" })).q, false);
  });

  it("dubblettfrågor (samma text) används en gång; dubbla id görs unika", () => {
    const { usable, skipped } = selectQuizQuestions([
      fraga("q1"), fraga("q2", { question: "  Fråga   q1? " }), fraga("q1", { question: "Annan?" }),
    ]);
    assert.deepEqual(usable.map((q) => q.id), ["q1", "q1-2"]);
    assert.equal(skipped.dubblett, 1);
  });
});

describe("antal frågor och för-få-varningen", () => {
  it("minQuestions ur formatet, annars 5", () => {
    assert.equal(minQuestionsFor(RUSH), 8);
    assert.equal(minQuestionsFor(KM), QUIZ_DEFAULT_MIN_QUESTIONS);
    assert.equal(minQuestionsFor(undefined), 5);
    assert.deepEqual(validateFormat(testFormat("x_ok", { minQuestions: 3 })), []);
    assert.match(validateFormat(testFormat("x_bad", { minQuestions: 0 })).join(), /minQuestions/);
  });

  it("räknar total/användbara och varnar under tröskeln", () => {
    const quiz = [fraga("a"), fraga("b"), fraga("c", { passage: "Läs!" })];
    const s = summarizeQuizArea(quiz, { minQuestions: 8 });
    assert.equal(s.total, 3);
    assert.equal(s.usable, 2);
    assert.equal(s.tooFew, true);
    assert.equal(s.empty, false);
    const m = quizAreaMessage(s, "Guldrushen");
    assert.equal(m.level, "warn");
    assert.match(m.text, /Bara 2 frågor kan användas – för få\. Guldrushen behöver minst 8\./);
    assert.match(m.text, /1 läsförståelsefråga/);
  });

  it("tillräckligt många → ok med antalet", () => {
    const s = summarizeQuizArea(Array.from({ length: 6 }, (_, i) => fraga(`q${i}`)));
    assert.equal(s.tooFew, false);
    const m = quizAreaMessage(s);
    assert.equal(m.level, "ok");
    assert.match(m.text, /6 frågor kan användas \(av 6/);
  });

  it("inga användbara / inga alls → stopp", () => {
    assert.equal(quizAreaMessage(summarizeQuizArea([])).level, "error");
    assert.match(quizAreaMessage(summarizeQuizArea(undefined)).text, /inga quizfrågor/);
    assert.match(quizAreaMessage(summarizeQuizArea([fraga("a", { options: ["Ja"] , answerIndex: 0 })])).text, /Inga av områdets 1 fråga/);
  });
});

describe("ögonblicksbild + facit (§4.4)", () => {
  const quiz = Array.from({ length: 10 }, (_, i) => fraga(`q${i}`, { answerIndex: i % 4, category: "fakta" }));

  it("elevsynliga frågor saknar facit; facit ligger parallellt", () => {
    const { questions, facit } = buildQuizSnapshot(quiz, { count: 5, rng: seqRng([0.3, 0.7, 0.1, 0.9]) });
    assert.equal(questions.length, 5);
    assert.equal(facit.length, 5);
    for (const q of questions) {
      assert.deepEqual(Object.keys(q).sort(), ["category", "id", "key", "options", "text"]);
      assert.equal(JSON.stringify(q).includes("answerIndex"), false);
      assert.equal(JSON.stringify(q).includes("För att"), false, "förklaringen är facit");
    }
    questions.forEach((q, i) => {
      assert.equal(facit[i].id, q.id);
      const orig = quiz.find((o) => o.id === q.id);
      assert.equal(q.options[facit[i].answerIndex], orig.options[orig.answerIndex], "facit följer blandningen");
    });
  });

  it("rutan på: passagen är elevsynlig (questions), facit oförändrat", () => {
    const pq = Array.from({ length: 3 }, (_, i) => fraga(`p${i}`, { passage: "Kort text." }));
    const { questions, facit } = buildQuizSnapshot(pq, { shuffle: false, shuffleOptions: false, showPassage: true });
    assert.equal(questions.length, 3);
    for (const q of questions) assert.deepEqual(Object.keys(q).sort(), ["id", "key", "options", "passage", "text"]);
    assert.equal(questions[0].passage, "Kort text.");
    assert.deepEqual(Object.keys(facit[0]).sort(), ["answerIndex", "explanation", "id"]);
  });

  it("count saknas/\"alla\" = alla; shuffle:false = områdets ordning", () => {
    assert.equal(buildQuizSnapshot(quiz).questions.length, 10);
    assert.equal(buildQuizSnapshot(quiz, { count: "alla" }).questions.length, 10);
    assert.equal(buildQuizSnapshot(quiz, { count: 50 }).questions.length, 10);
    const { questions } = buildQuizSnapshot(quiz, { shuffle: false, shuffleOptions: false });
    assert.deepEqual(questions.map((q) => q.id), quiz.map((q) => q.id));
    assert.deepEqual(questions[0].options, ["A", "B", "C", "D"]);
  });

  it("joinFacit kräver matchande id", () => {
    const { questions, facit } = buildQuizSnapshot(quiz, { count: 2 });
    assert.equal(joinFacit(questions[0], facit[0]).answerIndex, facit[0].answerIndex);
    assert.throws(() => joinFacit(questions[0], facit[1]), /facit saknas/);
  });
});

describe("spelläget i flödet", () => {
  const { questions, facit } = buildQuizSnapshot([fraga("a"), fraga("b"), fraga("c")], { rng: seqRng([0.5]) });

  it("checkAnswer rättar det valda alternativet (whitespace-tolerant)", () => {
    const q = joinFacit(questions[0], facit[0]);
    const right = q.options[q.answerIndex];
    const wrong = q.options.find((o) => o !== right);
    assert.deepEqual(QUIZ.checkAnswer(q, ` ${right} `), { valid: true, correct: true, given: right, correctAnswer: right });
    assert.equal(QUIZ.checkAnswer(q, wrong).correct, false);
    assert.equal(QUIZ.checkAnswer(q, "finns inte").valid, false);
    assert.equal(QUIZ.checkAnswer(q, "").valid, false);
  });

  it("utan facit: giltigt val men correct null (formatet rättar)", () => {
    const r = QUIZ.checkAnswer(questions[0], questions[0].options[2]);
    assert.equal(r.valid, true);
    assert.equal(r.correct, null);
    assert.equal(QUIZ.choices(questions[0]).answerIndex, null);
  });

  it("choices = snapshotens ordning; answerRecord = frågans id + valt svar", () => {
    const q = joinFacit(questions[1], facit[1]);
    assert.deepEqual(QUIZ.choices(q), { options: q.options, answerIndex: q.answerIndex });
    const r = QUIZ.checkAnswer(q, q.options[0]);
    assert.deepEqual(QUIZ.answerRecord(q, r), { questionId: q.id, answer: q.options[0] });
  });

  it("createSource: alla frågor varje varv, aldrig samma två gånger i rad; shuffle:false = ordningen", () => {
    assert.throws(() => QUIZ.createSource({}), /frågor saknas/);
    const src = QUIZ.createSource({ questions, facit, rng: Math.random });
    const seen = Array.from({ length: 30 }, () => src.next());
    for (let i = 0; i < 30; i += 3) assert.equal(new Set(seen.slice(i, i + 3).map((q) => q.id)).size, 3);
    for (let i = 1; i < 30; i++) assert.notEqual(seen[i].id, seen[i - 1].id);
    assert.ok(seen.every((q) => Number.isInteger(q.answerIndex)), "med facit kan klienten rätta");
    const fast = QUIZ.createSource({ questions, shuffle: false });
    assert.deepEqual([fast.next(), fast.next(), fast.next(), fast.next()].map((q) => q.id),
      [...questions.map((q) => q.id), questions[0].id]);
  });
});

describe("lärarformuläret: ämne + område", () => {
  const input = (over = {}) => ({
    name: "Quizfredag", format: "test_quiz_rush", gameMode: "plugga_quiz", classIds: ["4b"],
    classNames: { "4b": "4B" }, ...over,
  });
  const area = { subjectId: "so", areaId: "vikingar", subjectName: "SO", areaName: "Vikingatiden", usable: 12, total: 14 };

  it("utan valt område → fel; inga användbara frågor → fel", () => {
    assert.match(validateSessionInput(input()).join(), /Välj ämne och arbetsområde/);
    assert.match(validateSessionInput(input({ quizArea: { ...area, usable: 0 } })).join(), /inga quizfrågor som passar/);
  });

  it("rutan \"Visa lästext\" sparas på sessionen (quiz.showPassage)", () => {
    const doc = buildSessionDoc(input({ quizArea: { ...area, showPassage: true } }), { uid: "larare" });
    assert.equal(doc.quiz.showPassage, true);
  });

  it("giltigt → sessionen får quiz-fältet och svarssättet choice", () => {
    const i = input({ quizArea: area });
    assert.deepEqual(validateSessionInput(i), []);
    const doc = buildSessionDoc(i, { uid: "larare" });
    assert.equal(doc.answerKind, "choice");
    assert.equal(doc.gameMode, "plugga_quiz");
    assert.deepEqual(doc.quiz, {
      subjectId: "so", areaId: "vikingar", subjectName: "SO", areaName: "Vikingatiden", passagePolicy: "fallback", showPassage: false,
    });
  });

  it("multiplikationen påverkas inte av quizets fält", () => {
    const i = input({ gameMode: "multiplication_0_10" });
    assert.deepEqual(validateSessionInput(i), []);
    assert.equal("quiz" in buildSessionDoc(i, { uid: "larare" }), false);
  });
});
