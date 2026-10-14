// ============================================================================
// Guldrushen + tidslinjefrågor (#601, epic #595): SERVERNS rättning
// (functions/kistspel-rattning.js via guldrush-core.js answerQuestion) mot
// Firestore-emulatorn – samma rigg som functions-guldrush-core.test.mjs.
//
//   • exakt år = rätt → kista som vanligt; fel år → ❌ + rätt år (correctYear)
//   • attack: fel form (choiceIndex/answer, sträng, decimal, utanför spannet,
//     inget år, år på en flervalsfråga) nekas – inget skrivs
//   • attack: år som byts efter lås (samma attemptId) eller ny attemptId på
//     samma fråga nekas – det låsta svaret står kvar
//   • år före vår tideräkning ("44 f.Kr.")
// Körs av `npm run test:functions` (Firestore-emulatorn behövs).
// ============================================================================

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { answerQuestion, openChest } from "../functions/guldrush-core.js";
import { db, deps, ctl, reset, rngFor, makeSession, gp, att, code } from "./helpers/guldrush-core-rig.js";

beforeEach(reset);

const SPAN = { min: 1500, max: 1600 };
const QUESTIONS = [
  { id: "q1", key: "0:q1", text: "Huvudstad?", options: ["Oslo", "Stockholm", "Bergen", "Åbo"], statKeys: ["ovrig", "q:q1"] },
  { id: "tl-blodbad", key: "1:tl-blodbad", kind: "timeline", text: "Vilket år var Stockholms blodbad?",
    event: "Stockholms blodbad", span: SPAN, statKeys: ["tidslinje", "q:tl-blodbad"] },
];
const FACIT = [{ answerIndex: 1 }, { year: 1520 }];

async function tlSession(questions = QUESTIONS, facit = FACIT) {
  const s = await makeSession({ gameMode: "plugga_quiz", answerKind: "choice", questionCount: questions.length, quiz: { timeline: true } });
  await db.doc(`liveSessions/${s}/grPublic/questions`).set({ questions });
  await db.doc(`liveSessions/${s}/grPrivate/snapshot`).set({ facit });
  return s;
}
const answers = async (s) => (await db.collection(`liveSessions/${s}/answers`).get()).docs.map((d) => d.data());

describe("Guldrushen: tidslinjefrågor rättas på servern", () => {
  it("exakt år = rätt → svarsdokument (timeline, year) och en kista som vanligt", async () => {
    const s = await tlSession();
    const id = att();
    const r = await answerQuestion(deps, "alma", { sid: s, attemptId: id, q: 1, year: 1520 });
    assert.deepEqual([r.correct, r.correctAnswer, r.correctYear, r.nextQ], [true, "1520", 1520, 0]);
    const a = (await db.doc(`liveSessions/${s}/answers/${id}`).get()).data();
    assert.equal(a.answerKind, "timeline");
    assert.equal(a.year, 1520);
    assert.equal(a.isCorrect, true);
    assert.equal(a.questionId, "tl-blodbad");
    assert.deepEqual(a.statKeys, ["tidslinje", "q:tl-blodbad"]);
    assert.ok(!("choiceIndex" in a));
    ctl.roll = rngFor("mycket_guld");
    const c = await openChest(deps, "alma", { sid: s, attemptId: id, chestIndex: 2 });
    assert.deepEqual([c.chest, c.gold], ["mycket_guld", 50]);
    assert.equal((await gp(s, "alma")).correct, 1);
  });

  it("fel år → ❌ (correct false) + rätt år; ingen kista; nästa fråga är en vanlig", async () => {
    const s = await tlSession();
    const id = att();
    const r = await answerQuestion(deps, "alma", { sid: s, attemptId: id, q: 1, year: 1521 });
    assert.deepEqual([r.correct, r.correctAnswer, r.correctYear, r.nextQ], [false, "1520", 1520, 0]);
    assert.equal(await code(openChest(deps, "alma", { sid: s, attemptId: id, chestIndex: 0 })), "failed-precondition");
    const p = await gp(s, "alma");
    assert.deepEqual([p.correct, p.incorrect, p.gold], [0, 1, 0]);
    // Den vanliga flervalsfrågan rättas som förut i samma match.
    const r2 = await answerQuestion(deps, "alma", { sid: s, attemptId: att(), q: 0, choiceIndex: 1 });
    assert.deepEqual([r2.correct, r2.correctAnswer, r2.nextQ], [true, "Stockholm", 1]);
    assert.ok(!("correctYear" in r2));
  });

  it("attack: tidslinjesvar med fel form nekas – inget skrivs", async () => {
    const s = await tlSession();
    const bad = [
      { year: 1520, choiceIndex: 0 },
      { choiceIndex: 1 },
      { year: 1520, answer: "1520" },
      { year: "1520" },
      { year: 1520.5 },
      { year: 1499 },
      { year: 1601 },
      { year: null },
      {},
    ];
    for (const extra of bad) {
      assert.equal(await code(answerQuestion(deps, "alma", { sid: s, attemptId: att(), q: 1, ...extra })), "invalid-argument", JSON.stringify(extra));
    }
    // Ett år på en flervalsfråga är också fel form.
    assert.equal(await code(answerQuestion(deps, "alma", { sid: s, attemptId: att(), q: 0, choiceIndex: 1, year: 1520 })), "invalid-argument");
    assert.equal((await answers(s)).length, 0);
    assert.equal(await gp(s, "alma"), undefined, "inga räknare");
  });

  it("attack: år som byts efter lås nekas; det låsta svaret står kvar", async () => {
    const s = await tlSession();
    const id = att();
    await answerQuestion(deps, "alma", { sid: s, attemptId: id, q: 1, year: 1519 });
    // Samma försök med ett annat (rätt) år → nekas.
    assert.equal(await code(answerQuestion(deps, "alma", { sid: s, attemptId: id, q: 1, year: 1520 })), "already-exists");
    // Nytt försök på samma fråga → nekas (servern har valt nästa fråga).
    assert.equal(await code(answerQuestion(deps, "alma", { sid: s, attemptId: att(), q: 1, year: 1520 })), "failed-precondition");
    const list = await answers(s);
    assert.equal(list.length, 1);
    assert.deepEqual([list[0].year, list[0].isCorrect], [1519, false]);
    // Omförsök efter nätfel med SAMMA år → samma utfall, inget nytt räknas.
    const again = await answerQuestion(deps, "alma", { sid: s, attemptId: id, q: 1, year: 1519 });
    assert.deepEqual([again.correct, again.correctYear], [false, 1520]);
    assert.deepEqual([(await gp(s, "alma")).incorrect, (await gp(s, "alma")).correct], [1, 0]);
  });

  it("år före vår tideräkning: rätt år visas som \"44 f.Kr.\"", async () => {
    const q = { ...QUESTIONS[1], id: "tl-caesar", span: { min: -500, max: 100 } };
    const s = await tlSession([QUESTIONS[0], q], [FACIT[0], { year: -44 }]);
    const r = await answerQuestion(deps, "alma", { sid: s, attemptId: att(), q: 1, year: -45 });
    assert.deepEqual([r.correct, r.correctAnswer, r.correctYear], [false, "44 f.Kr.", -44]);
    const ok = await answerQuestion(deps, "omar", { sid: s, attemptId: att(), q: 1, year: -44 });
    assert.equal(ok.correct, true);
  });
});
