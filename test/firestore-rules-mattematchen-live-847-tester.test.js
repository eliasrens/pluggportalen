// ============================================================================
// Regel-tester (testaren, #847): försök att bryta klientvägen för "Live räknas
// in i Mattematchen". Kompletterar firestore-rules-mattematchen-live-847.test.js:
//   • ankare utan Live-svar, räknare utan ankare, dubbla räknare i en batch,
//   • ett Live-svar + answers/X + liveAnswers/X i EN batch med mynt,
//   • räknare som servern skrev (functions/mattematchen-live.js-form) och
//     sedan MM-sidans/Live-klientens vanliga skrivningar,
//   • gränsen endAt exakt, faktorer > 10, ett "rätt" som inte är rätt.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, writeBatch, increment, serverTimestamp, Timestamp } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import {
  planLiveAnswerWrites, planLiveMmWrites, planMathAnswerWrites, planMmMyntWrites, MM_LIVE_ANKARE,
} from "../src/tavling/answer-writes.js";

let testEnv, elev;
const fv = { increment, serverTimestamp };
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
let seq = 0;
const aid = () => `t847${Date.now().toString(36)}x${(seq++).toString(36)}`;
const rec = (a, b, answer) => ({ factorA: a, factorB: b, answer, correctAnswer: a * b });
const dag = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(new Date());

function commit(db, writes) {
  const b = writeBatch(db);
  for (const w of writes) b.set(doc(db, ...w.path), w.data, w.merge ? { merge: true } : undefined);
  return b.commit();
}
const MM1 = {
  name: "MM", participatingClassIds: ["3a", "4b"], startAt: ts(-H), endAt: ts(H),
  status: "active", counterShards: 4, createdBy: "larare1", createdAt: ts(-2 * H),
};
const live = (attemptId, { a = 7, b = 8, answer = 56 } = {}) => planLiveAnswerWrites({
  sessionId: "live1", attemptId, uid: "alma", classId: "3a", mode: "multiplication_0_10",
  record: rec(a, b, answer), isCorrect: answer === a * b, shard: 0, fv,
});
const mmDel = (attemptId, { a = 7, b = 8, answer = 56, ankare = MM_LIVE_ANKARE, shard = 1 } = {}) => planMathAnswerWrites({
  competitionId: "mm1", attemptId, uid: "alma", classId: "3a", name: "Alma", record: rec(a, b, answer),
  isCorrect: answer === a * b, shard, fv, ankare,
});

before(async () => { ({ testEnv, elev } = await createRulesEnv("pluggportalen-rules-test-mm-live-847-tester")); });
after(async () => { if (testEnv) await testEnv.cleanup(); });
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "3a"), { name: "3A", studentIds: ["alma"] });
    await setDoc(doc(db, "students", "alma"), { namn: "Alma" });
    await setDoc(doc(db, "mathCompetitions", "mm1"), MM1);
    await setDoc(doc(db, "liveSessions", "live1"), {
      name: "3A mot 4B", gameMode: "multiplication_0_10", participatingClassIds: ["3a", "4b"],
      classDivisors: { "3a": 20, "4b": 22 }, durationSeconds: 1200, countdownSeconds: 4, counterShards: 10,
      status: "live", startedAt: ts(-60 * 1000), createdBy: "rasmus",
    });
    await setDoc(doc(db, "liveSessions", "live1", "players", "alma"),
      { uid: "alma", classId: "3a", name: "Alma", joinedAt: ts(-H), lastSeenAt: ts(-H), correct: 0, incorrect: 0 });
  });
});
async function las(...path) {
  let out = null;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const s = await getDoc(doc(ctx.firestore(), ...path));
    out = s.exists() ? s.data() : null;
  });
  return out;
}

describe("Testaren #847: förfalskade klientbatcher", () => {
  it("ankare i liveAnswers UTAN Live-svar i batchen (lika med ett MM-sidsvar utan mynt)", async () => {
    const r = await commit(elev("alma"), mmDel(aid())).then(() => "ok", (e) => e.code);
    console.log("# ankare utan Live-svar:", r);
  });

  it("räknare utan något ankare nekas", async () => {
    const w = mmDel(aid()).slice(1);
    await assertFails(commit(elev("alma"), w));
    await assertFails(commit(elev("alma"), [w[0]]));
    await assertFails(commit(elev("alma"), [w[1]]));
  });

  it("ett ankare – räknaren +2 nekas", async () => {
    const id = aid();
    const w = mmDel(id);
    w[2] = { ...w[2], data: { ...w[2].data, correct: increment(2) } };
    await assertFails(commit(elev("alma"), [...live(id), ...w]));
  });

  it("ankare som påstår rätt men svaret är fel nekas", async () => {
    const id = aid();
    const w = mmDel(id, { a: 7, b: 8, answer: 55 });
    w[0] = { ...w[0], data: { ...w[0].data, isCorrect: true } };
    await assertFails(commit(elev("alma"), [...live(id), ...w]));
  });

  it("faktor 11/12 nekas", async () => {
    const id = aid();
    await assertFails(commit(elev("alma"), mmDel(id, { a: 11, b: 2, answer: 22 })));
    await assertFails(commit(elev("alma"), mmDel(id, { a: 12, b: 12, answer: 144 })));
  });

  it("Live-svar + liveAnswers/X + answers/X + mynt i EN batch (ett MM-bidrag)", async () => {
    const id = aid();
    const ankare = mmDel(id); // liveAnswers + stats + score + counter
    const ans = mmDel(id, { ankare: "answers" })[0];
    const mynt = planMmMyntWrites({ competitionId: "mm1", attemptId: id, uid: "alma", dag: dag(), fv });
    // F1 (rättad): ett id får inte vara både Live-ankare och MM-svar → hela batchen nekas, inget mynt.
    await assertFails(commit(elev("alma"), [...live(id), ...ankare, ans, ...mynt]));
    await assertFails(commit(elev("alma"), [...live(id), ...ankare, ans]));
    assert.equal(await las("studentData", "alma"), null);
    assert.equal(await las("mathCompetitions", "mm1", "scores", "alma"), null);
  });

  it("Live-svar + liveAnswers/X, sedan answers/X med NY bump och mynt (ett vanligt MM-svar, samma id)", async () => {
    const id = aid();
    await assertSucceeds(commit(elev("alma"), [...live(id), ...mmDel(id)]));
    const mynt = planMmMyntWrites({ competitionId: "mm1", attemptId: id, uid: "alma", dag: dag(), fv });
    const r = await commit(elev("alma"), [...mmDel(id, { ankare: "answers" }), ...mynt]).then(() => "ok", (e) => e.code);
    console.log("# samma attemptId som vanligt MM-svar efteråt:", r,
      "scores:", (await las("mathCompetitions", "mm1", "scores", "alma"))?.correct);
  });
});

describe("Testaren #847: räknare som servern skrev, sedan klientens vanliga vägar", () => {
  // Formen ur functions/mattematchen-live.js mmLiveWrites (namn = Live-spelarens namn).
  async function serverSkrev(name = "Alma") {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const at = ts(-5000);
      await setDoc(doc(db, "mathCompetitions", "mm1", "studentStats", "alma"),
        { uid: "alma", classId: "3a", correct: 3, incorrect: 1, c7: 2, c8: 1, w6: 1, lastAttemptId: "srv1", lastAt: at });
      await setDoc(doc(db, "mathCompetitions", "mm1", "scores", "alma"),
        { uid: "alma", classId: "3a", correct: 3, name, lastAttemptId: "srv1", lastAt: at });
      await setDoc(doc(db, "mathCompetitions", "mm1", "classCounters", "3a_1"),
        { classId: "3a", shard: 1, correct: 3, lastAttemptId: "srv1", lastAt: at });
    });
  }

  it("MM-sidans svar (med mynt) efter serverns skrivningar", async () => {
    await serverSkrev();
    const id = aid();
    const w = planMathAnswerWrites({
      competitionId: "mm1", attemptId: id, uid: "alma", classId: "3a", name: "Alma", record: rec(3, 4, 12),
      isCorrect: true, shard: 1, fv, mynt: { dag: dag() },
    });
    await assertSucceeds(commit(elev("alma"), w));
    assert.equal((await las("mathCompetitions", "mm1", "scores", "alma")).correct, 4);
  });

  it("Klassmatch-klientens Live-svar efter serverns skrivningar", async () => {
    await serverSkrev();
    const id = aid();
    const mm = planLiveMmWrites({
      competition: { id: "mm1", ...MM1 }, now: Date.now(), uid: "alma", classId: "3a", name: "Alma", attemptId: id,
      record: rec(7, 8, 56), isCorrect: true, fv, rng: () => 0.3,
    });
    await assertSucceeds(commit(elev("alma"), [...live(id), ...mm]));
    assert.equal((await las("mathCompetitions", "mm1", "studentStats", "alma")).c7, 3);
  });

  it("servern skrev ett annat namn (Live-spelarens) – MM-sidans svar med elevens eget namn", async () => {
    await serverSkrev("Alma S");
    const w = planMathAnswerWrites({
      competitionId: "mm1", attemptId: aid(), uid: "alma", classId: "3a", name: "Alma", record: rec(3, 4, 12), isCorrect: true, shard: 1, fv,
    });
    await assertSucceeds(commit(elev("alma"), w));
  });

  it("servern skrev scores UTAN namn (tomt Live-namn) – MM-sidans svar", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "mathCompetitions", "mm1", "scores", "alma"),
        { uid: "alma", classId: "3a", correct: 1, lastAttemptId: "srv1", lastAt: ts(-5000) });
    });
    const w = planMathAnswerWrites({
      competitionId: "mm1", attemptId: aid(), uid: "alma", classId: "3a", name: "Alma", record: rec(3, 4, 12), isCorrect: true, shard: 1, fv,
    });
    await assertSucceeds(commit(elev("alma"), w));
  });
});

describe("Testaren #847: F1 omtest (3c9b2f6) – varianter och normalvägar", () => {
  const mynt = (id) => planMmMyntWrites({ competitionId: "mm1", attemptId: id, uid: "alma", dag: dag(), fv });
  const coins = async () => (await las("studentData", "alma"))?.coins ?? 0;
  const poang = async () => (await las("mathCompetitions", "mm1", "scores", "alma"))?.correct ?? 0;

  it("liveAnswers/X först, sedan answers/X + bump + mynt i en senare batch → nekas", async () => {
    const id = aid();
    await assertSucceeds(commit(elev("alma"), [...live(id), ...mmDel(id)]));
    await assertFails(commit(elev("alma"), [...mmDel(id, { ankare: "answers", a: 3, b: 4, answer: 12 }), ...mynt(id)]));
    await assertFails(commit(elev("alma"), [mmDel(id, { ankare: "answers" })[0], ...mynt(id)]));
    assert.deepEqual([await poang(), await coins()], [1, 0]);
  });

  it("myntet ensamt i en senare batch (mot liveAnswers/X eller answers/Y) → nekas", async () => {
    const x = aid();
    await assertSucceeds(commit(elev("alma"), [...live(x), ...mmDel(x)]));
    await assertFails(commit(elev("alma"), mynt(x)));
    const y = aid();
    await assertSucceeds(commit(elev("alma"), [...mmDel(y, { ankare: "answers" }), ...mynt(y)])); // vanligt MM-svar med mynt
    assert.equal(await coins(), 1);
    await assertFails(commit(elev("alma"), mynt(y))); // samma mynt igen
    assert.equal(await coins(), 1);
  });

  it("answers/X (MM-sidan, mynt) först, sedan Live + liveAnswers/X med samma id", async () => {
    const id = aid();
    await assertSucceeds(commit(elev("alma"), [...mmDel(id, { ankare: "answers" }), ...mynt(id)]));
    const r = await commit(elev("alma"), [...live(id), ...mmDel(id)]).then(() => "ok", (e) => e.code);
    console.log("# answers/X före liveAnswers/X:", r, "poäng", await poang(), "mynt", await coins());
    assert.equal(await coins(), 1, "aldrig mer än ett mynt");
  });

  it("Live-svar + MM-delen märkt som answers/X (inget liveAnswers) + mynt – = ett MM-sidsvar", async () => {
    const id = aid();
    const r = await commit(elev("alma"), [...live(id), ...mmDel(id, { ankare: "answers" }), ...mynt(id)]).then(() => "ok", (e) => e.code);
    console.log("# Live + answers/X + mynt (ingen liveAnswers):", r, "poäng", await poang(), "mynt", await coins());
  });

  it("normalvägarna: MM-sidans svar med mynt och Live-svar som räknas", async () => {
    const a = aid();
    await assertSucceeds(commit(elev("alma"), [...mmDel(a, { ankare: "answers" }), ...mynt(a)]));
    const b = aid();
    const mm = planLiveMmWrites({
      competition: { id: "mm1", ...MM1 }, now: Date.now(), uid: "alma", classId: "3a", name: "Alma", attemptId: b,
      record: rec(6, 7, 42), isCorrect: true, fv, rng: () => 0.9,
    });
    await assertSucceeds(commit(elev("alma"), [...live(b), ...mm]));
    assert.deepEqual([await poang(), await coins()], [2, 1]);
  });
});
