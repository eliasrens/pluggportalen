// ============================================================================
// Datakuppen (slut-QA #656, spec §6 test 16): alla tre frågetyperna rättas av
// SERVERN (functions/datakuppen-core.js answerQuestion → kistspel-rattning.js)
// och ett rätt svar ger en fil – mot Firestore-emulatorn, samma rigg som
// functions-datakuppen-core.test.mjs.
//
//   multiplikation  skriv själv + flerval (choiceIndex krävs)
//   quiz            flerval mot facit i dkPrivate (bara den fråga servern gav)
//   tidslinje       exakt år = rätt; fel form nekas; fel år → rätt år visas
// Körs av `npm run test:functions`.
// ============================================================================

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { answerQuestion, openFile } from "../functions/datakuppen-core.js";
import { db, deps, ctl, reset, rngFor, makeSession, gp, att, code } from "./helpers/datakuppen-core-rig.js";

beforeEach(reset);

const QUESTIONS = [
  { id: "q1", key: "0:q1", text: "Huvudstad?", options: ["Oslo", "Stockholm", "Bergen", "Åbo"], statKeys: ["ovrig", "q:q1"] },
  { id: "tl-blodbad", key: "1:tl-blodbad", kind: "timeline", text: "Vilket år var Stockholms blodbad?",
    event: "Stockholms blodbad", span: { min: 1500, max: 1600 }, statKeys: ["tidslinje", "q:tl-blodbad"] },
];
const FACIT = [{ answerIndex: 1 }, { year: 1520 }];

async function quizSession() {
  const s = await makeSession({ gameMode: "plugga_quiz", answerKind: "choice", questionCount: 2, quiz: { timeline: true } });
  await db.doc(`liveSessions/${s}/dkPublic/questions`).set({ questions: QUESTIONS });
  await db.doc(`liveSessions/${s}/dkPrivate/snapshot`).set({ facit: FACIT });
  return s;
}

async function fileAfter(s, uid, id) {
  ctl.clock += 2_000;
  ctl.roll = rngFor("mapp");
  const f = await openFile(deps, uid, { sid: s, attemptId: id, fileIndex: 1 });
  assert.equal(f.file, "mapp");
  return f;
}

describe("test 16: frågetyperna i Datakuppen", () => {
  it("multiplikation, skriv själv: rätt → fil; fel → ingen fil", async () => {
    const s = await makeSession();
    const ok = att();
    assert.equal((await answerQuestion(deps, "alma", { sid: s, attemptId: ok, factorA: 7, factorB: 8, answer: "56" })).correct, true);
    await fileAfter(s, "alma", ok);
    const no = att();
    const r = await answerQuestion(deps, "alma", { sid: s, attemptId: no, factorA: 7, factorB: 8, answer: 54 });
    assert.deepEqual([r.correct, r.correctAnswer], [false, 56]);
    assert.equal(await code(openFile(deps, "alma", { sid: s, attemptId: no, fileIndex: 0 })), "failed-precondition");
    // Skriv själv tar inget alternativ.
    assert.equal(await code(answerQuestion(deps, "alma", { sid: s, attemptId: att(), factorA: 2, factorB: 2, answer: 4, choiceIndex: 0 })), "invalid-argument");
    const p = await gp(s, "alma");
    assert.deepEqual([p.correct, p.incorrect, p.gold], [1, 1, 25]);
  });

  it("multiplikation, flerval: choiceIndex krävs, rätt → fil", async () => {
    const s = await makeSession({ answerKind: "choice" });
    assert.equal(await code(answerQuestion(deps, "omar", { sid: s, attemptId: att(), factorA: 3, factorB: 4, answer: 12 })), "invalid-argument");
    const id = att();
    const r = await answerQuestion(deps, "omar", { sid: s, attemptId: id, factorA: 3, factorB: 4, answer: 12, choiceIndex: 2 });
    assert.equal(r.correct, true);
    const a = (await db.doc(`liveSessions/${s}/answers/${id}`).get()).data();
    assert.deepEqual([a.answerKind, a.choiceIndex, a.isCorrect], ["choice", 2, true]);
    await fileAfter(s, "omar", id);
  });

  it("quiz från Plugga: facit ur dkPrivate, rätt → fil; tidslinjefrågan i samma match", async () => {
    const s = await quizSession();
    const id = att();
    const r = await answerQuestion(deps, "leo", { sid: s, attemptId: id, q: 0, choiceIndex: 1 });
    assert.deepEqual([r.correct, r.correctAnswer, r.nextQ], [true, "Stockholm", 1]);
    await fileAfter(s, "leo", id);
    // Servern gav fråga 1 (tidslinjen) – fel form nekas, exakt år = rätt.
    for (const extra of [{ choiceIndex: 1 }, { year: "1520" }, { year: 1499 }, { year: 1520, answer: "1520" }]) {
      assert.equal(await code(answerQuestion(deps, "leo", { sid: s, attemptId: att(), q: 1, ...extra })), "invalid-argument", JSON.stringify(extra));
    }
    const tl = att();
    const t = await answerQuestion(deps, "leo", { sid: s, attemptId: tl, q: 1, year: 1520 });
    assert.deepEqual([t.correct, t.correctYear], [true, 1520]);
    const a = (await db.doc(`liveSessions/${s}/answers/${tl}`).get()).data();
    assert.deepEqual([a.answerKind, a.year, a.statKeys], ["timeline", 1520, ["tidslinje", "q:tl-blodbad"]]);
    await fileAfter(s, "leo", tl);
    assert.equal((await gp(s, "leo")).correct, 2);
  });

  it("tidslinje, fel år → rätt år visas och ingen fil; quiz på en fråga servern inte gav nekas", async () => {
    const s = await quizSession();
    await answerQuestion(deps, "ines", { sid: s, attemptId: att(), q: 0, choiceIndex: 0 });
    const id = att();
    const r = await answerQuestion(deps, "ines", { sid: s, attemptId: id, q: 1, year: 1521 });
    assert.deepEqual([r.correct, r.correctAnswer, r.correctYear], [false, "1520", 1520]);
    assert.equal(await code(openFile(deps, "ines", { sid: s, attemptId: id, fileIndex: 0 })), "failed-precondition");
    // Nästa fråga är 0 igen – att svara på 1 nu nekas.
    assert.equal(await code(answerQuestion(deps, "ines", { sid: s, attemptId: att(), q: 1, year: 1520 })), "failed-precondition");
  });
});
