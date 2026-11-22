// ============================================================================
// Regel-tester: Matchdagens multiplikationssvar räknas in i Mattematchen (#879) –
// SOLOSPELET (klienten). Kör klientens egen väg: en tabellfråga i solospelets form
// (md-kallor.js tabellKalla – test/matchdagen-mm-879.test.js prövar mot den riktiga),
// svaret ur mmSvar (md-mm.js) och MM-delen ur planLiveMmWrites (ankaret liveAnswers, utan
// något Live-svar i batchen – src/tavling/mm-live.js mmRaknaIn) mot firestore.rules:
//   • rätt (flerval och skriv själv) → studentStats/scores/classCounters +1, fel → incorrect,
//   • aldrig dubbelt: samma attemptId igen nekas,
//   • inte utanför perioden, inte pausad tävling, inte en klass som inte deltar,
//   • inga mynt: kvittot/saldot mot ankaret nekas, saldot orört,
//   • ingen självtilldelning: "rätt" på ett fel svar och +2 nekas (samma regler som MM-sidan).
// Inga regeländringar – reglerna från #847 räcker. Körs av `npm run test:rules`.
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, writeBatch, increment, serverTimestamp, Timestamp } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { planLiveMmWrites, planMathAnswerWrites, planMmMyntWrites, MM_LIVE_ANKARE } from "../src/tavling/answer-writes.js";
import { mmSvar } from "../src/matchdagen/md-mm.js";
import MULTIPLICATION_0_10 from "../src/live/modes/multiplication-0-10.js";
import { makeQuestion, seededRng } from "../src/mult/generator.js";

let testEnv, elev;
const fv = { increment, serverTimestamp };
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
let seq = 0;
const aid = () => `md879${Date.now().toString(36)}x${(seq++).toString(36)}`;

function commit(db, writes) {
  const b = writeBatch(db);
  for (const w of writes) b.set(doc(db, ...w.path), w.data, w.merge ? { merge: true } : undefined);
  return b.commit();
}
const competition = (over = {}) => ({
  name: "Mattematchen november", participatingClassIds: ["3a"], startAt: ts(-H), endAt: ts(H),
  status: "active", counterShards: 4, createdBy: "larare1", createdAt: ts(-2 * H), ...over,
});
const COMPS = {
  mm1: competition(),
  slut: competition({ startAt: ts(-2 * H), endAt: ts(-H) }),
  stoppad: competition({ status: "stopped" }),
  andra: competition({ participatingClassIds: ["4b"] }),
};

/** En tabellfråga som solospelet ställer den (7:ans tabell). */
function fraga(svarssatt = "flerval") {
  const q = makeQuestion(7, 8);
  const ut = { kallTyp: "tabell", text: "7 × 8 = ?", facit: "56", data: { q } };
  if (svarssatt === "skriv") return { ...ut, typ: "skriv" };
  const { options, answerIndex } = MULTIPLICATION_0_10.choices(q, seededRng(3));
  return { ...ut, typ: "flerval", alternativ: options.map(String), ratt: answerIndex, data: { q, options } };
}
/** Elevens svar (rätt/fel) på frågan → mmSvar → klientens MM-plan. */
function soloSvar({ svarssatt = "flerval", ratt = true, cid = "mm1", attemptId = aid(), now = Date.now() } = {}) {
  const f = fraga(svarssatt);
  const facit = Number(f.facit);
  const svar = svarssatt === "flerval"
    ? (ratt ? f.ratt : (f.ratt + 1) % f.alternativ.length)
    : String(ratt ? facit : facit + 1);
  const x = mmSvar(f, svar);
  assert.ok(x, "mmSvar ger ett MM-svar");
  assert.equal(x.isCorrect, ratt);
  return planLiveMmWrites({
    competition: { id: cid, ...COMPS[cid] }, now, uid: "alma", classId: "3a", name: "Alma", attemptId, fv, rng: () => 0.3, ...x,
  });
}
/** Utan klientens egen period-/klasskontroll (en manipulerad klient). */
function tvingad({ cid, classId = "3a", attemptId = aid(), answer = 56, isCorrect = answer === 56 } = {}) {
  return planMathAnswerWrites({
    competitionId: cid, attemptId, uid: "alma", classId, name: "Alma",
    record: { factorA: 7, factorB: 8, answer, correctAnswer: 56 }, isCorrect, shard: 1, fv, ankare: MM_LIVE_ANKARE,
  });
}

before(async () => {
  ({ testEnv, elev } = await createRulesEnv("pluggportalen-rules-test-matchdagen-mm-879"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "3a"), { name: "3A", studentIds: ["alma"] });
    await setDoc(doc(db, "classes", "4b"), { name: "4B", studentIds: ["omar"] });
    await setDoc(doc(db, "students", "alma"), { namn: "Alma" });
    await setDoc(doc(db, "studentData", "alma"), { coins: 100 });
    for (const [id, c] of Object.entries(COMPS)) await setDoc(doc(db, "mathCompetitions", id), c);
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

describe("Matchdagen solo → Mattematchen (#879)", () => {
  it("rätt svar (flerval och skriv själv) → studentStats/scores/classCounters +1, ankaret i liveAnswers", async () => {
    const id = aid();
    const w = soloSvar({ attemptId: id });
    assert.deepEqual(w.map((x) => x.path[2]), [MM_LIVE_ANKARE, "studentStats", "scores", "classCounters"]);
    await assertSucceeds(commit(elev("alma"), w));
    await assertSucceeds(commit(elev("alma"), soloSvar({ svarssatt: "skriv" })));
    const st = await las("mathCompetitions", "mm1", "studentStats", "alma");
    assert.deepEqual([st.correct, st.incorrect, st.c7, st.c8, st.classId], [2, 0, 2, 2, "3a"]);
    const sc = await las("mathCompetitions", "mm1", "scores", "alma");
    assert.deepEqual([sc.correct, sc.name], [2, "Alma"]);
    assert.equal((await las("mathCompetitions", "mm1", "classCounters", "3a_1")).correct, 2);
    assert.ok(await las("mathCompetitions", "mm1", MM_LIVE_ANKARE, id));
    assert.equal(await las("mathCompetitions", "mm1", "answers", id), null, "inget MM-sidesvar");
  });

  it("fel svar → incorrect + w-tabellerna, ingen poäng", async () => {
    await assertSucceeds(commit(elev("alma"), soloSvar({ ratt: false })));
    const st = await las("mathCompetitions", "mm1", "studentStats", "alma");
    assert.deepEqual([st.correct, st.incorrect, st.w7, st.w8], [0, 1, 1, 1]);
    assert.equal(await las("mathCompetitions", "mm1", "scores", "alma"), null);
  });

  it("aldrig dubbelt: samma attemptId igen nekas", async () => {
    const id = aid();
    await assertSucceeds(commit(elev("alma"), soloSvar({ attemptId: id })));
    await assertFails(commit(elev("alma"), soloSvar({ attemptId: id })));
    assert.equal((await las("mathCompetitions", "mm1", "studentStats", "alma")).correct, 1);
  });

  it("inte utanför perioden, inte pausad, inte en klass som inte deltar (klientens plan blir tom; tvingad nekas)", async () => {
    for (const cid of ["slut", "stoppad", "andra"]) {
      assert.deepEqual(soloSvar({ cid }), [], cid);
      await assertFails(commit(elev("alma"), tvingad({ cid })));
    }
    await assertFails(commit(elev("alma"), tvingad({ cid: "mm1", classId: "4b" })));
  });

  it("inga mynt: kvitto och saldo mot ankaret nekas, saldot orört", async () => {
    const id = aid();
    const w = soloSvar({ attemptId: id });
    await assertFails(commit(elev("alma"), [...w, ...planMmMyntWrites({ competitionId: "mm1", attemptId: id, uid: "alma", dag: "2026-11-21", fv })]));
    await assertSucceeds(commit(elev("alma"), w));
    assert.equal((await las("studentData", "alma")).coins, 100);
  });

  it("ingen självtilldelning: rätt på ett fel svar och +2 nekas", async () => {
    await assertFails(commit(elev("alma"), tvingad({ cid: "mm1", answer: 55, isCorrect: true })));
    const w = soloSvar();
    w[2].data.correct = increment(2);
    await assertFails(commit(elev("alma"), w));
  });
});
