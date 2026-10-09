// ============================================================================
// Enhetstester: Snilleblixten (#556) – formatet, poängen (test 5), ställning
// med delad placering, ögonblicksbilden (facit åtskilt) och övergångarna
// (test 10: två lärare samtidigt → exakt ett steg). Regelsidan:
// test/firestore-rules-live-snilleblixt.test.js.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { requireGameMode } from "../src/live/modes/index.js";
import { requireFormat, listFormats, answerKindsFor } from "../src/live/formats/index.js";
import { validateFormat } from "../src/live/live-formats.js";
import { validateSessionInput, buildSessionDoc } from "../src/live/live-core.js";
import { answerKindDefaults, defaultSetupValues } from "../src/live/live-setup-fields.js";
import { buildQuizSnapshot } from "../src/live/modes/plugga-quiz-core.js";
import { seededRng } from "../src/mult/generator.js";
import { buildSnapshot, answerDocId, validateSetup } from "../src/live/formats/snilleblixt/snilleblixt-core.js";
import {
  pointsFor, normFree, isCorrectAnswer, scoreQuestion, rankPlayers, computeStandings, buildResult,
} from "../src/live/formats/snilleblixt/snilleblixt-poang.js";
import {
  planStep, planAnswer, canAnswer, answerProgress, autoCloseReason,
} from "../src/live/formats/snilleblixt/snilleblixt-flode.js";

const SB = requireFormat("snilleblixt");
const MULT = requireGameMode("multiplication_0_10");
const QUIZ = requireGameMode("plugga_quiz");
const SERVER = { __server: true };
const fv = { serverTimestamp: () => SERVER };
const T0 = 1_700_000_000_000;

const input = (over = {}) => ({
  name: "Snilleblixten 4B", format: "snilleblixt", gameMode: "multiplication_0_10", answerKind: "choice",
  classIds: ["4b"], classNames: { "4b": "4B" }, questionCount: 10, questionSeconds: 20,
  shuffleQuestions: true, showQuestionOnStudent: true, ...over,
});

describe("Snilleblixten: formatet", () => {
  it("registrerat: inom-klass, 1–3 klasser, lärarstyrd, free+choice, giltigt interface", () => {
    assert.deepEqual(listFormats().map((f) => f.id), ["klassmatch", "snilleblixt"]);
    assert.deepEqual(validateFormat(SB), []);
    assert.equal(SB.scope, "inom-klass");
    assert.equal(SB.minClasses, 1);
    assert.equal(SB.maxClasses, 3);
    assert.equal(SB.pacing, "lärarstyrd");
    assert.deepEqual(SB.answerKinds, ["free", "choice"]);
    assert.deepEqual(answerKindsFor(SB, MULT), ["free", "choice"]);
    assert.deepEqual(answerKindsFor(SB, QUIZ), ["choice"]);
    assert.ok(SB.compatibleGameModes(MULT) && SB.compatibleGameModes(QUIZ));
  });

  it("setupFields: antal 5/10/15/20/alla, tid 10/20/30/60 (skriv själv längre förval), slumpa + visa frågan (på)", () => {
    const f = Object.fromEntries(SB.setupFields.map((x) => [x.key, x]));
    assert.deepEqual(f.questionCount.options.map((o) => o.value), [5, 10, 15, 20, 0]);
    assert.deepEqual(f.questionSeconds.options.map((o) => o.value), [10, 20, 30, 60]);
    assert.deepEqual(answerKindDefaults(SB.setupFields, "free"), { questionSeconds: 20 });
    assert.deepEqual(answerKindDefaults(SB.setupFields, "choice"), { questionSeconds: 10 });
    const d = defaultSetupValues(SB.setupFields);
    assert.equal(d.shuffleQuestions, true);
    assert.equal(d.showQuestionOnStudent, true);
  });

  it("validering: kärnan + formatets fält; 4 klasser, okänd tid och \"alla\" med multiplikation nekas", () => {
    assert.deepEqual(validateSessionInput(input()), []);
    assert.deepEqual(validateSessionInput(input({ classIds: ["4b", "5e", "6a"] })), []);
    assert.ok(validateSessionInput(input({ classIds: ["4b", "5e", "6a", "6b"] })).some((e) => /Högst 3/.test(e)));
    assert.ok(validateSessionInput(input({ classIds: [] })).some((e) => /minst en klass/.test(e)));
    assert.ok(validateSessionInput(input({ questionSeconds: 15 })).length);
    assert.ok(validateSetup(input({ questionCount: 0 }))[0].includes("Alla"));
    assert.deepEqual(validateSetup(input({ gameMode: "plugga_quiz", questionCount: 0 })), []);
  });

  it("sessionsdokumentet: format, svarssätt, inställningar – inga Klassmatchen-fält, ingen matchklocka", () => {
    const d = buildSessionDoc(input({ answerKind: "free", shuffleQuestions: false }), { uid: "l1" });
    assert.equal(d.format, "snilleblixt");
    assert.equal(d.answerKind, "free");
    assert.equal(d.questionSeconds, 20);
    assert.equal(d.questionCount, 10);
    assert.equal(d.shuffleQuestions, false);
    assert.equal(d.showQuestionOnStudent, true);
    for (const k of ["durationSeconds", "classDivisors", "counterShards", "coinPrize", "wizards"]) assert.ok(!(k in d), k);
    // Klassmatchen har kvar sin matchklocka.
    assert.equal(buildSessionDoc({ ...input(), format: "klassmatch", answerKind: "free", classIds: ["4b", "5e"],
      durationMin: 20, divisors: { "4b": 1, "5e": 1 } }, { uid: "l1" }).durationSeconds, 1200);
  });
});

describe("Snilleblixten: ögonblicksbild och facit (§4.4)", () => {
  it("multiplikation, flerval: fyra alternativ elevsynligt, facit åtskilt och rätt", () => {
    const { questions, facit } = buildSnapshot(MULT, { answerKind: "choice", count: 15, rng: seededRng(3) });
    assert.equal(questions.length, 15);
    assert.equal(facit.length, 15);
    questions.forEach((q, i) => {
      assert.ok(!("answerIndex" in q) && !("correctAnswer" in q) && !("answer" in q));
      assert.equal(q.options.length, 4);
      const [a, b] = q.text.split(/\s*[×x·]\s*/).map(Number);
      assert.equal(q.options[facit[i].answerIndex], String(a * b));
      assert.equal(facit[i].correctAnswer, String(a * b));
      assert.ok(q.statKeys.every((k) => /^t\d+$/.test(k)));
    });
  });

  it("multiplikation, skriv själv: bara texten; utan antal kastar", () => {
    const { questions, facit } = buildSnapshot(MULT, { answerKind: "free", count: 5, rng: seededRng(1) });
    assert.ok(questions.every((q) => !q.options));
    assert.ok(facit.every((f) => /^\d+$/.test(f.correctAnswer) && !("answerIndex" in f)));
    assert.throws(() => buildSnapshot(MULT, { answerKind: "free", count: 0 }));
  });

  it("quiz: områdets frågor, passage hoppas över, \"alla\" = alla spelbara", () => {
    const quiz = [
      { id: "a", question: "Huvudstad?", options: ["Oslo", "Stockholm", "Rom"], answerIndex: 1, explanation: "S" },
      { id: "b", question: "Läs texten", passage: "Lång text", options: ["x", "y"], answerIndex: 0 },
      { id: "c", question: "Största sjön?", options: ["Vänern", "Vättern"], answerIndex: 0 },
    ];
    const { questions, facit } = buildSnapshot(QUIZ, { answerKind: "choice", count: 0, quiz, quizSnapshot: buildQuizSnapshot, rng: seededRng(2) });
    assert.equal(questions.length, 2);
    questions.forEach((q, i) => {
      assert.ok(!("answerIndex" in q));
      assert.equal(q.options[facit[i].answerIndex], facit[i].correctAnswer);
    });
    assert.ok(questions.some((q) => q.text === "Huvudstad?"));
    assert.equal(buildSnapshot(QUIZ, { answerKind: "choice", count: 5, quiz, quizSnapshot: buildQuizSnapshot }).questions.length, 2);
  });

  it("prepareCreate: questionCount = ögonblicksbildens längd, en subdoc i sbPrivate", async () => {
    const quizArea = { subjectId: "so", areaId: "vikingar", usable: 1 };
    const data = buildSessionDoc(input({ gameMode: "plugga_quiz", questionCount: 20, quizArea }), { uid: "l1" });
    assert.equal(data.quiz.areaId, "vikingar");
    const getArea = async () => ({ quiz: [{ id: "a", question: "Fråga?", options: ["1", "2"], answerIndex: 0 }] });
    const r = await SB.prepareCreate({}, data, { getArea, rng: seededRng(1) });
    assert.equal(r.data.questionCount, 1);
    assert.deepEqual(r.subdocs[0].path, ["sbPrivate", "snapshot"]);
    assert.equal(r.subdocs[0].data.questions.length, 1);
  });
});

describe("Snilleblixten: poäng (§5.5)", () => {
  it("test 5: 20 s frågetid, rätt efter 4 s (servertid) → 900", () => {
    assert.equal(pointsFor({ correct: true, atMs: T0 + 4000, openedMs: T0, questionSeconds: 20 }), 900);
  });

  it("direkt ≈ 1000, sist ≈ 500, fel/inget = 0, klämt", () => {
    const p = (ms, correct = true) => pointsFor({ correct, atMs: T0 + ms, openedMs: T0, questionSeconds: 20 });
    assert.equal(p(0), 1000);
    assert.equal(p(19_999), 500);
    assert.equal(p(10_000), 750);
    assert.equal(p(-50), 1000);
    assert.equal(p(25_000), 500);
    assert.equal(p(4000, false), 0);
    assert.equal(pointsFor({ correct: true, atMs: null, openedMs: T0, questionSeconds: 20 }), 0);
  });

  it("skriv själv rättas tolerant mot blanksteg/nollor; flerval på index", () => {
    assert.equal(normFree(" 0 56 "), "56");
    assert.equal(normFree("Gustav  Vasa"), "gustavvasa");
    assert.ok(isCorrectAnswer({ answer: " 56" }, { correctAnswer: "56" }, "free"));
    assert.ok(!isCorrectAnswer({ answer: "" }, { correctAnswer: "" }, "free"));
    assert.ok(isCorrectAnswer({ choiceIndex: 2 }, { answerIndex: 2 }, "choice"));
    assert.ok(!isCorrectAnswer({ choiceIndex: 1 }, { answerIndex: 2 }, "choice"));
  });

  const q = { index: 3, phase: "closed", openedAt: T0, closedAt: T0 + 15_000 };
  const ans = (uid, ms, extra) => ({ uid, q: 3, at: T0 + ms, ...extra });

  it("scoreQuestion: poäng ur at − openedAt, bara inom fönstret, valfördelning", () => {
    const sc = scoreQuestion({
      q, facit: { answerIndex: 1, correctAnswer: "56" }, questionSeconds: 20, answerKind: "choice",
      answers: [ans("a", 4000, { choiceIndex: 1 }), ans("b", 1000, { choiceIndex: 0 }), ans("c", 16_000, { choiceIndex: 1 }),
        ans("d", -1, { choiceIndex: 1 }), { ...ans("e", 100, { choiceIndex: 1 }), q: 2 }],
    });
    assert.deepEqual(sc.points, { a: 900, b: 0 });
    assert.deepEqual(sc.correct, { a: true, b: false });
    assert.equal(sc.answered, 2);
    assert.equal(sc.correctCount, 1);
    assert.deepEqual(sc.choiceCounts, [1, 1, 0, 0]);
  });

  it("test 7b-underlag: skriv själv – vanligaste felsvaren utan namn, högst 3", () => {
    const answers = [
      ...["a", "b", "c", "d", "e"].map((u, i) => ans(u, 1000 + i, { answer: "54" })),
      ...["f", "g", "h"].map((u, i) => ans(u, 2000 + i, { answer: "64" })),
      ans("i", 3000, { answer: "56" }), ans("j", 3000, { answer: "57" }), ans("k", 3000, { answer: "1" }),
    ];
    const sc = scoreQuestion({ q, facit: { correctAnswer: "56" }, answers, questionSeconds: 20, answerKind: "free" });
    assert.deepEqual(sc.topWrong, [{ answer: "54", n: 5 }, { answer: "64", n: 3 }, { answer: "1", n: 1 }]);
    assert.equal(sc.correctCount, 1);
    assert.ok(!JSON.stringify(sc.topWrong).includes('"a"'));
  });

  it("överhoppad fråga: inga poäng", () => {
    const sc = scoreQuestion({ q, facit: null, answers: [ans("a", 1000, { choiceIndex: 1 })], questionSeconds: 20, answerKind: "choice", skipped: true });
    assert.deepEqual(sc.points, {});
    assert.equal(sc.skipped, true);
    assert.equal(sc.answered, 1);
  });
});

describe("Snilleblixten: ställning med delad placering", () => {
  it("rankPlayers: lika poäng delar placering, nästa hoppar (1, 1, 3, 4, 4, 6)", () => {
    const r = rankPlayers([
      { uid: "a", name: "A", points: 900 }, { uid: "b", name: "B", points: 1800 }, { uid: "c", name: "C", points: 1800 },
      { uid: "d", name: "D", points: 0 }, { uid: "e", name: "E", points: 500 }, { uid: "f", name: "F", points: 500 },
    ]);
    assert.deepEqual(r.map((p) => [p.uid, p.rank]), [["b", 1], ["c", 1], ["a", 3], ["e", 4], ["f", 4], ["d", 6]]);
  });

  const s = { participatingClassIds: ["4b", "5e"], classNames: { "4b": "4B", "5e": "5E" } };
  const players = [
    { uid: "a", name: "Alma", classId: "4b" }, { uid: "b", name: "Bo", classId: "4b" },
    { uid: "c", name: "Cleo", classId: "5e" }, { uid: "d", name: "Dan", classId: "5e" },
  ];
  const scores = [
    { index: 0, points: { a: 900, b: 900, c: 0 }, correct: { a: true, b: true, c: false } },
    { index: 1, skipped: true, points: {}, correct: {} },
    { index: 2, points: { a: 500, b: 500, c: 1000 }, correct: { a: true, b: true, c: true } },
  ];

  it("computeStandings: summa över avslöjade frågor, alla anslutna med, delad etta = draw", () => {
    const st = computeStandings(s, { scores, players });
    assert.deepEqual(st.players.map((p) => [p.uid, p.points, p.rank]), [["a", 1400, 1], ["b", 1400, 1], ["c", 1000, 3], ["d", 0, 4]]);
    assert.deepEqual(st.leaderIds, ["a", "b"]);
    assert.equal(st.winnerId, null);
    assert.equal(st.draw, true);
    assert.equal(st.totalCorrect, 5);
    assert.deepEqual(st.classes.map((c) => [c.classId, c.joined, c.points]), [["4b", 2, 2800], ["5e", 2, 1000]]);
    assert.equal(computeStandings(s, { scores: scores.slice(2), players }).winnerId, "c");
    assert.equal(computeStandings(s, { scores: [], players }).leaderIds.length, 0);
  });

  it("buildResult: topplista med placering, andel rätt per fråga, ingen klassvinnare", () => {
    const r = buildResult(s, [], players, MULT, { scores });
    assert.equal(r.format, "snilleblixt");
    assert.equal(r.winner, null);
    assert.ok(!("perClass" in r) && !("winnerClasses" in r));
    assert.deepEqual(r.ranking.slice(0, 2).map((p) => [p.name, p.rank]), [["Alma", 1], ["Bo", 1]]);
    assert.deepEqual(r.perQuestion.map((q) => [q.index, q.skipped]), [[0, false], [1, true], [2, false]]);
    assert.equal(r.questionsPlayed, 2);
    assert.equal(r.players, 4);
  });
});

describe("Snilleblixten: övergångar (test 10) och svar", () => {
  const snapshot = buildSnapshot(MULT, { answerKind: "choice", count: 3, rng: seededRng(9) });
  const base = { status: "live", questionCount: 3, questionSeconds: 20, answerKind: "choice" };

  // Minimal "server": tillämpar en plan med punktnotation, serverns tid = now.
  function apply(s, plan, now) {
    const n = structuredClone(s);
    for (const [k, v] of Object.entries(plan.patch)) {
      const val = v === SERVER ? now : v;
      if (k.startsWith("q.")) n.q[k.slice(2)] = val;
      else n[k] = val && typeof val === "object" && !Array.isArray(val)
        ? Object.fromEntries(Object.entries(val).map(([kk, vv]) => [kk, vv === SERVER ? now : vv])) : val;
    }
    return n;
  }

  it("hela kedjan: öppna 0 → stäng → avslöja → nästa … → sista; frågan och facit ur ögonblicksbilden", () => {
    let s = { ...base };
    let p = planStep(s, "open", { fromIndex: -1, snapshot, fv });
    s = apply(s, p, T0);
    assert.deepEqual(s.q, { index: 0, phase: "open", openedAt: T0, question: snapshot.questions[0] });
    assert.ok(!("facit" in s.q));
    s = apply(s, planStep(s, "close", { fromIndex: 0, fv }), T0 + 5000);
    assert.equal(s.q.closedAt, T0 + 5000);
    p = planStep(s, "reveal", { fromIndex: 0, snapshot, fv, answers: [{ uid: "a", q: 0, at: T0 + 4000, choiceIndex: snapshot.facit[0].answerIndex }] });
    assert.equal(p.scores.points.a, 900);
    s = apply(s, p, T0 + 6000);
    assert.deepEqual(s.q.facit, snapshot.facit[0]);
    s = apply(s, planStep(s, "open", { fromIndex: 0, snapshot, fv }), T0 + 7000);
    assert.equal(s.q.index, 1);
    p = planStep(s, "skip", { fromIndex: 1, fv });
    assert.equal(p.scores.skipped, true);
    s = apply(s, p, T0 + 8000);
    assert.equal(s.q.phase, "skipped");
    s = apply(s, planStep(s, "open", { fromIndex: 1, snapshot, fv }), T0 + 9000);
    s = apply(s, planStep(s, "close", { fromIndex: 2, fv }), T0 + 9500);
    s = apply(s, planStep(s, "reveal", { fromIndex: 2, snapshot, fv }), T0 + 9600);
    assert.deepEqual(planStep(s, "open", { fromIndex: 2, snapshot, fv }), { noop: "sista frågan" });
    s = apply(s, planStep(s, "finish", { fv }), T0 + 9700);
    assert.equal(s.status, "finished");
    assert.ok(planStep(s, "finish", { fv }).noop);
  });

  it("test 10: två lärare trycker NÄSTA FRÅGA (samma fromIndex) → exakt ett steg", () => {
    // Transaktionerna serialiseras: den andra läser läget efter den första.
    let s = { ...base, q: { index: 0, phase: "revealed", openedAt: T0, question: snapshot.questions[0] } };
    const larare = [0, 0].map((fromIndex) => () => planStep(s, "open", { fromIndex, snapshot, fv }));
    const utfall = larare.map((tryck) => {
      const p = tryck();
      if (!p.noop) s = apply(s, p, T0 + 1000);
      return p.noop ? "noop" : "steg";
    });
    assert.deepEqual(utfall, ["steg", "noop"]);
    assert.equal(s.q.index, 1);
    // Samma för stäng/avslöja/hoppa: andra trycket är noop.
    s = apply(s, planStep(s, "close", { fromIndex: 1, fv }), T0 + 2000);
    assert.ok(planStep(s, "close", { fromIndex: 1, fv }).noop);
    s = apply(s, planStep(s, "reveal", { fromIndex: 1, snapshot, fv }), T0 + 3000);
    assert.ok(planStep(s, "reveal", { fromIndex: 1, snapshot, fv }).noop);
    assert.ok(planStep(s, "skip", { fromIndex: 1, fv }).noop);
  });

  it("noop för fel läge: inte igång, avslöja öppen fråga, stäng utan fråga", () => {
    assert.ok(planStep({ ...base, status: "lobby" }, "open", { fromIndex: -1, snapshot, fv }).noop);
    const open = { ...base, q: { index: 0, phase: "open", openedAt: T0 } };
    assert.ok(planStep(open, "reveal", { fromIndex: 0, snapshot, fv }).noop);
    assert.ok(planStep(open, "open", { fromIndex: 0, snapshot, fv }).noop);
    assert.ok(planStep(base, "close", { fromIndex: -1, fv }).noop);
  });

  it("planAnswer: id {i}_{uid}, bara val/svar + serverns tid – inget facit, ingen poäng", () => {
    const s = { ...base, q: { index: 2, phase: "open" } };
    const w = planAnswer({ sid: "x", s, uid: "alma", classId: "4b", choiceIndex: 1, fv });
    assert.deepEqual(w.path, ["liveSessions", "x", "sbAnswers", answerDocId(2, "alma")]);
    assert.deepEqual(w.data, { uid: "alma", classId: "4b", q: 2, answerKind: "choice", choiceIndex: 1, at: SERVER });
    const f = planAnswer({ sid: "x", s: { ...s, answerKind: "free" }, uid: "alma", classId: "4b", answer: " 56 ", fv });
    assert.equal(f.data.answer, "56");
    assert.throws(() => planAnswer({ sid: "x", s: { ...s, answerKind: "free" }, uid: "a", classId: "4b", answer: "  ", fv }));
    assert.throws(() => planAnswer({ sid: "x", s, uid: "a", classId: "4b", choiceIndex: 4, fv }));
  });

  it("sen anslutning, \"x av y har svarat\" och auto-stängning (test 9)", () => {
    const s = { ...base, q: { index: 0, phase: "open", openedAt: T0 } };
    const now = T0 + 5000;
    const players = [
      { uid: "a", joinedAt: T0 - 60_000, lastSeenAt: now - 1000 },
      { uid: "b", joinedAt: T0 - 60_000, lastSeenAt: now - 1000 },
      { uid: "sen", joinedAt: T0 + 1000, lastSeenAt: now },
      { uid: "borta", joinedAt: T0 - 60_000, lastSeenAt: now - 300_000 },
    ];
    assert.ok(canAnswer(s, players[0]));
    assert.ok(!canAnswer(s, players[2]));
    const one = [{ uid: "a", q: 0 }];
    assert.deepEqual(answerProgress(s, { answers: one, players, now }), { answered: 1, eligible: 2, all: false });
    assert.equal(autoCloseReason(s, { answers: one, players, now }), null);
    assert.equal(autoCloseReason(s, { answers: [...one, { uid: "b", q: 0 }], players, now }), "alla");
    assert.equal(autoCloseReason(s, { answers: one, players, now: T0 + 20_000 }), "tid");
    assert.equal(autoCloseReason({ ...s, q: { ...s.q, phase: "closed" } }, { answers: one, players, now: T0 + 30_000 }), null);
  });
});
