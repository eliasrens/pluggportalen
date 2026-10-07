// ============================================================================
// Regel-tester: Mattematchens ELEVFLÖDE (#458) mot emulatorn – spec MM-test
// 1–5 med elevsidans riktiga frågor och skrivplaner:
//   • bevakarens fråga (array-contains-any på elevens klasser) är tillåten
//     och hittar bara tävlingar där klassen deltar,
//   • 100 rätt → 100 poäng (scores + studentStats), ingen valuta (studentData orörd),
//   • 60 elever → Topp 25-frågan ger exakt 25, och listning > 25 nekas,
//   • Klasskamp ur shardade räknare: 20 elever / 4000 rätt → 200,0,
//   • 📊: egen statistik läsbar, andras inte.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  doc, getDoc, getDocs, setDoc, collection, query, where, orderBy, limit,
  writeBatch, increment, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { planMathAnswerWrites, pickShard } from "../src/tavling/answer-writes.js";
import { newAttemptId } from "../src/mult/attempt-id.js";
import { createMultGenerator, checkMultAnswer, seededRng } from "../src/mult/generator.js";
import MULT from "../src/live/modes/multiplication-0-10.js";
import {
  activeCompetitionFor, topList, classStandings, statsSummary, formatScore,
} from "../src/tavling/mm-core.js";

let testEnv, elev;
const fv = { increment, serverTimestamp };
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
const comp = (over = {}) => ({
  name: "Mattematchen", participatingClassIds: ["4b", "5e"], startAt: ts(-H), endAt: ts(H),
  status: "active", counterShards: 5, createdBy: "larare1", createdAt: ts(-2 * H), ...over,
});
const ids = (p, n) => Array.from({ length: n }, (_, i) => `${p}${i}`);

/** Precis som page-mattematchen/mm-data: generator → svar → EN batch. */
function svara(db, uid, name, classId, q, raw) {
  const result = checkMultAnswer(q, raw);
  const writes = planMathAnswerWrites({
    competitionId: "mm1", attemptId: newAttemptId(), uid, classId, name,
    record: MULT.answerRecord(q, result), isCorrect: result.correct, shard: pickShard(5), fv,
  });
  const b = writeBatch(db);
  for (const w of writes) b.set(doc(db, ...w.path), w.data, w.merge ? { merge: true } : undefined);
  return b.commit();
}

before(async () => {
  ({ testEnv, elev } = await createRulesEnv("pluggportalen-rules-test-mm-elev"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "4b"), { name: "4B", studentIds: ["alma", ...ids("x", 19)] });
    await setDoc(doc(db, "classes", "5e"), { name: "5E", studentIds: ["clara"] });
    await setDoc(doc(db, "classes", "6a"), { name: "6A", studentIds: ["sixten"] });
    await setDoc(doc(db, "students", "alma"), { namn: "Alma" });
    await setDoc(doc(db, "studentData", "alma"), { coins: 37 });
    await setDoc(doc(db, "mathCompetitions", "mm1"), comp());
    await setDoc(doc(db, "mathCompetitions", "annan"), comp({ participatingClassIds: ["6a"] }));
  });
});

describe("Mattematchen elevsida (#458)", () => {
  it("MM-test 1–2: bevakarens fråga är tillåten och hittar bara klassens tävling", async () => {
    const db = elev("sixten");
    const q = query(collection(db, "mathCompetitions"), where("participatingClassIds", "array-contains-any", ["6a"]));
    const snap = await assertSucceeds(getDocs(q));
    const comps = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    assert.deepEqual(comps.map((c) => c.id), ["annan"]);
    assert.equal(activeCompetitionFor(comps, ["6a"], Date.now()).competition.id, "annan");
    const q2 = query(collection(elev("alma"), "mathCompetitions"), where("participatingClassIds", "array-contains-any", ["3x"]));
    const none = (await assertSucceeds(getDocs(q2))).docs;
    assert.equal(activeCompetitionFor(none, ["3x"], Date.now()), null);
  });

  it("MM-test 3: 100 rätt → 100 poäng, ingen valuta", async () => {
    const db = elev("alma");
    const gen = createMultGenerator({ rng: seededRng(458) });
    for (let i = 0; i < 100; i++) {
      const q = gen.next();
      await svara(db, "alma", "Alma", "4b", q, String(q.answer));
    }
    const sc = (await assertSucceeds(getDoc(doc(db, "mathCompetitions", "mm1", "scores", "alma")))).data();
    assert.equal(sc.correct, 100);
    const st = (await assertSucceeds(getDoc(doc(db, "mathCompetitions", "mm1", "studentStats", "alma")))).data();
    const s = statsSummary(st);
    assert.equal(s.correct, 100);
    assert.equal(s.incorrect, 0);
    assert.equal(s.pctCorrect, 100);
    const sd = (await getDoc(doc(db, "studentData", "alma"))).data();
    assert.equal(sd.coins, 37, "inga pluggcoins delas ut");
    // Klassräknarna (shardade) summerar till 100 → 4B (20 elever) = 5,0.
    const cc = await assertSucceeds(getDocs(collection(db, "mathCompetitions", "mm1", "classCounters")));
    const rows = classStandings(cc.docs.map((d) => d.data()),
      [{ id: "4b", name: "4B", studentIds: ids("e", 20) }, { id: "5e", name: "5E", studentIds: ["clara"] }], ["4b", "5e"]);
    assert.equal(formatScore(rows[0].score), "5,0");
    assert.equal(rows.length, 2);
  });

  it("fel svar → 0 poäng, räknas som fel i statistiken (ingen minuspoäng)", async () => {
    const db = elev("alma");
    const q = createMultGenerator({ rng: seededRng(1) }).next();
    await svara(db, "alma", "Alma", "4b", q, String(q.answer));
    await svara(db, "alma", "Alma", "4b", q, String(q.answer + 1));
    const sc = (await getDoc(doc(db, "mathCompetitions", "mm1", "scores", "alma"))).data();
    assert.equal(sc.correct, 1);
    const s = statsSummary((await getDoc(doc(db, "mathCompetitions", "mm1", "studentStats", "alma"))).data());
    assert.deepEqual([s.correct, s.incorrect, s.total, s.pctCorrect, s.pctWrong], [1, 1, 2, 50, 50]);
  });

  it("MM-test 4: 60 elever → Topp 25-frågan ger exakt 25", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      for (let i = 0; i < 60; i++) {
        await setDoc(doc(db, "mathCompetitions", "mm1", "scores", `s${i}`),
          { uid: `s${i}`, classId: "4b", name: `Elev ${i}`, correct: 10 + i });
      }
    });
    const scores = collection(elev("alma"), "mathCompetitions", "mm1", "scores");
    const snap = await assertSucceeds(getDocs(query(scores, orderBy("correct", "desc"), limit(25))));
    const top = topList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    assert.equal(top.length, 25);
    assert.equal(top[0].correct, 69);
    await assertFails(getDocs(query(scores, orderBy("correct", "desc"), limit(60))));
    await assertFails(getDocs(scores));
  });

  it("MM-test 5: 20 elever / 4000 rätt (5 shards) → 200,0", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      for (let s = 0; s < 5; s++) {
        await setDoc(doc(db, "mathCompetitions", "mm1", "classCounters", `4b_${s}`), { classId: "4b", shard: s, correct: 800 });
      }
    });
    const db = elev("clara");
    const cc = await assertSucceeds(getDocs(collection(db, "mathCompetitions", "mm1", "classCounters")));
    const klasser = (await getDocs(collection(db, "classes"))).docs.map((d) => ({ id: d.id, ...d.data() }));
    const rows = classStandings(cc.docs.map((d) => d.data()), klasser, ["4b", "5e"]);
    assert.deepEqual(rows.map((r) => [r.name, formatScore(r.score)]), [["4B", "200,0"], ["5E", "0,0"]]);
  });

  it("MM-test 6: 📊 egen statistik läsbar, andras nekas", async () => {
    const q = createMultGenerator({ rng: seededRng(2) }).next();
    await svara(elev("alma"), "alma", "Alma", "4b", q, String(q.answer));
    await assertSucceeds(getDoc(doc(elev("alma"), "mathCompetitions", "mm1", "studentStats", "alma")));
    await assertFails(getDoc(doc(elev("clara"), "mathCompetitions", "mm1", "studentStats", "alma")));
  });
});
