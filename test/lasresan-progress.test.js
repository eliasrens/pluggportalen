// ============================================================================
// Läsresan (#399): elevens tillstånd + textavslut – progress.js, rewards.js.
// Kärnan bakom data-lasresan.completeText (samma funktioner körs i
// Firestore-transaktionen). Spec-acceptanstest 1, 2, 3 (via flera texter),
// 7 (nivå oförändrad vid världsbyte) och 8.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultLasresa, normalizeLasresa, withStartedText, scoreAnswers, buildAttempt, applyCompletion,
} from "../src/lasresan/progress.js";
import { coinsFor, award } from "../src/lasresan/rewards.js";

/** Text med n frågor (alla rätt svar = index 2, kategorier roterar). */
function makeText(id, n, level = 4) {
  const cats = ["fakta", "ordforstaelse", "mellan_raderna", "helhet_slutsats"];
  return {
    id, title: `Text ${id}`, level, textType: "story", topic: "test", body: "x",
    questions: Array.from({ length: n }, (_, i) => ({
      id: `q${i + 1}`, question: "?", options: ["a", "b", "c", "d"], answerIndex: 2, category: cats[i % 4],
    })),
  };
}
/** Svar med `correct` rätt (de första) av textens frågor. */
const answersFor = (text, correct) =>
  text.questions.map((q, i) => ({ qid: q.id, chosen: i < correct ? q.answerIndex : (q.answerIndex + 1) % 4 }));

/** Starta + avsluta en text på ett tillstånd. */
function finish(lasresa, text, correct) {
  const started = withStartedText(lasresa, text.id, 1000).lasresa;
  const attempt = buildAttempt(text, answersFor(text, correct), { startedAt: started.currentStartedAt, completedAt: 2000 });
  return { attempt, ...applyCompletion(started, attempt, undefined, 2000) };
}

test("Test 1: ny elev (inget lasresa-fält) → Skogen, före steg 1, nivå 4", () => {
  const l = normalizeLasresa(undefined);
  assert.equal(l.worldId, "skogen");
  assert.equal(l.stepInWorld, 0);
  assert.equal(l.level, 4);
  assert.deepEqual(l, defaultLasresa());
});

test("Test 2: 6 rätt av 8 → 75 %, 18 kr, registrerad, highStreak 1, +1 steg", () => {
  const text = makeText("t1", 8);
  const { attempt, lasresa, journey, levelChanged } = finish(defaultLasresa(), text, 6);
  assert.equal(attempt.percentage, 75);
  assert.equal(attempt.earnedMoney, 18);
  assert.equal(attempt.correct, 6);
  assert.equal(attempt.incorrect, 2);
  assert.equal(attempt.totalQuestions, 8);
  assert.equal(attempt.perQuestion.length, 8);
  assert.equal(attempt.startedAt, 1000);
  assert.equal(attempt.completedAt, 2000);
  assert.deepEqual(lasresa.seenTextIds, ["t1"]);
  assert.equal(lasresa.lastTextId, "t1");
  assert.equal(lasresa.currentTextId, null);
  assert.equal(lasresa.highStreak, 1);
  assert.equal(lasresa.level, 4);
  assert.equal(levelChanged, false);
  assert.equal(lasresa.stepInWorld, 1);
  assert.deepEqual(journey.walk, { worldId: "skogen", fromStep: 0, toStep: 1 });
  assert.deepEqual(
    [lasresa.totalTexts, lasresa.totalQuestions, lasresa.totalCorrect, lasresa.totalIncorrect, lasresa.moneyEarned],
    [1, 8, 6, 2, 18]
  );
});

test("Test 3 hela vägen: 75/80/71 % → nivå 5, tre steg framåt", () => {
  let l = defaultLasresa();
  let changed;
  for (const [id, n, c] of [["a", 8, 6], ["b", 5, 4], ["c", 7, 5]]) {
    ({ lasresa: l, levelChanged: changed } = finish(l, makeText(id, n), c));
  }
  assert.equal(l.level, 5);
  assert.equal(changed, true);
  assert.equal(l.stepInWorld, 3);
});

test("dåligt resultat → ändå +1 steg (progressionen går alltid framåt)", () => {
  const { lasresa } = finish(defaultLasresa(), makeText("t", 6), 0);
  assert.equal(lasresa.stepInWorld, 1);
  assert.equal(lasresa.lowStreak, 1);
});

test("Test 7: text 20 i Skogen → Öknen, nivån orörd av världsbytet", () => {
  const before = { ...defaultLasresa(), stepInWorld: 19, level: 5, highStreak: 1 };
  const { lasresa, journey } = finish(before, makeText("t20", 6), 3); // 50 % = mitt
  assert.equal(journey.unlockedWorldId, "oknen");
  assert.equal(lasresa.worldId, "oknen");
  assert.equal(lasresa.stepInWorld, 0);
  assert.deepEqual(lasresa.completedWorlds, ["skogen"]);
  assert.equal(lasresa.level, 5);
});

test("Test 8: 4 rätt av 7 → exakt 12 kr", () => {
  assert.equal(coinsFor(4), 12);
  assert.equal(buildAttempt(makeText("t", 7), answersFor(makeText("t", 7), 4)).earnedMoney, 12);
});

test("award: lägger pengarna via addCoins (befintligt saldo), 0 rätt → inget anrop", async () => {
  const calls = [];
  const addCoins = async (amount, sid) => { calls.push([amount, sid]); return 100 + amount; };
  assert.deepEqual(await award(4, { studentId: "elev1", addCoins }), { coins: 12, balance: 112 });
  assert.deepEqual(calls, [[12, "elev1"]]);
  assert.deepEqual(await award(0, { addCoins }), { coins: 0, balance: null });
  assert.equal(calls.length, 1);
});

test("påbörjad text återupptas (kan inte hoppas över), force byter", () => {
  const started = withStartedText(defaultLasresa(), "t1", 5).lasresa;
  const again = withStartedText(started, "t2", 6);
  assert.equal(again.resumed, true);
  assert.equal(again.textId, "t1");
  assert.equal(again.lasresa.currentStartedAt, 5);
  assert.equal(withStartedText(started, "t2", 7, { force: true }).textId, "t2");
});

test("scoreAnswers: obesvarad/ogiltig fråga = fel, per kategori summeras", () => {
  const text = makeText("t", 5);
  const s = scoreAnswers(text, [{ qid: "q1", chosen: 2 }, { qid: "q2", chosen: "2" }]);
  assert.equal(s.correct, 1);
  assert.equal(s.total, 5);
  assert.equal(s.perQuestion[1].chosen, null);
  assert.deepEqual(s.perCategory.fakta, { q: 2, correct: 1 }); // q1 + q5
});

test("catStats och seenTextIds ackumuleras, samma text räknas inte dubbelt i seen", () => {
  const text = makeText("t", 4 + 1);
  let { lasresa } = finish(defaultLasresa(), text, 5);
  ({ lasresa } = finish(lasresa, text, 0));
  assert.deepEqual(lasresa.seenTextIds, ["t"]);
  assert.deepEqual(lasresa.catStats.fakta, { q: 4, correct: 2 });
  assert.equal(lasresa.totalTexts, 2);
});

test("normalizeLasresa tvättar trasig data och behåller okända fält", () => {
  const l = normalizeLasresa({ level: 42, highStreak: -3, seenTextIds: ["a", "a", 5], extra: "kvar" });
  assert.equal(l.level, 10);
  assert.equal(l.highStreak, 0);
  assert.deepEqual(l.seenTextIds, ["a"]);
  assert.equal(l.extra, "kvar");
  assert.equal(l.worldId, "skogen");
});
