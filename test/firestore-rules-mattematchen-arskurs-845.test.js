// ============================================================================
// Regel-tester: årskurs på topplisteposten (#845). Kör den RIKTIGA skriv-
// planen (planMathAnswerWrites med arskurs) mot firestore.rules i emulatorn:
//   • arskurs godtas bara när det stämmer med klassnamnet ("4B" → 4,
//     "10A" → 10, "Fritids"/"Klass 3" → 0 = Övriga) – fel värde/typ nekas,
//   • utan arskurs skrivs posten som före #845 (gamla klienter),
//   • en gammal post utan fältet får det vid nästa rätta svar,
//   • ett oförändrat arskurs kostar ingen ny kontroll (uppdatering går),
//   • elevens Topp 25 per årskurs (where + orderBy + limit 25) tillåts,
//     > 25 nekas som förut.
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
import { planMathAnswerWrites } from "../src/tavling/answer-writes.js";
import { arskursAvKlass, arskursKod } from "../src/tavling/arskurs.js";

let testEnv, elev;
const fv = { increment, serverTimestamp };
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
let seq = 0;
const aid = () => `att845${Date.now().toString(36)}x${(seq++).toString(36)}`;

function commit(db, writes) {
  const b = writeBatch(db);
  for (const w of writes) b.set(doc(db, ...w.path), w.data, w.merge ? { merge: true } : undefined);
  return b.commit();
}
/** Samma plan som elevsidan (mm-data.submitAnswer): 7×8 = 56, rätt. */
function mm(uid, classId, name, over = {}) {
  return planMathAnswerWrites({
    competitionId: "mm1", attemptId: aid(), uid, classId, name,
    record: { factorA: 7, factorB: 8, answer: 56, correctAnswer: 56 }, isCorrect: true, shard: 0, fv, ...over,
  });
}
/** Planen med ett "manipulerat" arskurs på topplisteposten. */
function mmMed(uid, classId, name, arskurs) {
  const w = mm(uid, classId, name);
  w[2].data.arskurs = arskurs;
  return w;
}
const KLASSER = [
  ["4b", "4B", ["alma"]], ["10a", "10A", ["tio"]], ["3a", "3A", ["tre"]],
  ["fri", "Fritids", ["frida"]], ["k3", "Klass 3", ["kalle"]], ["7x", "7", ["sju"]],
];

before(async () => {
  ({ testEnv, elev } = await createRulesEnv("pluggportalen-rules-test-mm-arskurs-845"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [id, name, studentIds] of KLASSER) {
      await setDoc(doc(db, "classes", id), { name, studentIds });
      for (const uid of studentIds) await setDoc(doc(db, "students", uid), { namn: uid[0].toUpperCase() + uid.slice(1) });
    }
    await setDoc(doc(db, "mathCompetitions", "mm1"), {
      name: "Mattematchen", participatingClassIds: KLASSER.map((k) => k[0]), startAt: ts(-H), endAt: ts(H),
      status: "active", counterShards: 5, createdBy: "larare1", createdAt: ts(-2 * H),
    });
  });
});

describe("#845 arskurs på topplisteposten", () => {
  it("rätt årskurs ur klassnamnet godtas: 4B → 4, 10A → 10, 7 → 7", async () => {
    for (const [uid, classId, name, ak] of [["alma", "4b", "Alma", 4], ["tio", "10a", "Tio", 10], ["sju", "7x", "Sju", 7]]) {
      assert.equal(arskursKod(arskursAvKlass(KLASSER.find((k) => k[0] === classId)[1])), ak);
      await assertSucceeds(commit(elev(uid), mm(uid, classId, name, { arskurs: ak })));
      const sc = (await getDoc(doc(elev(uid), "mathCompetitions", "mm1", "scores", uid))).data();
      assert.equal(sc.arskurs, ak);
      assert.equal(sc.correct, 1);
    }
  });

  it("Övriga (0) godtas för namn utan inledande siffra – inte för 4B", async () => {
    await assertSucceeds(commit(elev("frida"), mm("frida", "fri", "Frida", { arskurs: 0 })));
    await assertSucceeds(commit(elev("kalle"), mm("kalle", "k3", "Kalle", { arskurs: 0 })));
    await assertFails(commit(elev("alma"), mmMed("alma", "4b", "Alma", 0)));
  });

  it("fel årskurs nekas: 4B med 5, 10A med 1, Klass 3 med 3, negativt, sträng", async () => {
    await assertFails(commit(elev("alma"), mmMed("alma", "4b", "Alma", 5)));
    await assertFails(commit(elev("tio"), mmMed("tio", "10a", "Tio", 1)));
    await assertFails(commit(elev("kalle"), mmMed("kalle", "k3", "Kalle", 3)));
    await assertFails(commit(elev("alma"), mmMed("alma", "4b", "Alma", -1)));
    await assertFails(commit(elev("alma"), mmMed("alma", "4b", "Alma", "4")));
    await assertFails(commit(elev("alma"), mmMed("alma", "4b", "Alma", 4.5)));
  });

  it("utan arskurs skrivs posten som före #845; nästa rätta svar fyller på fältet", async () => {
    await assertSucceeds(commit(elev("alma"), mm("alma", "4b", "Alma")));
    let sc = (await getDoc(doc(elev("alma"), "mathCompetitions", "mm1", "scores", "alma"))).data();
    assert.equal("arskurs" in sc, false);
    await assertSucceeds(commit(elev("alma"), mm("alma", "4b", "Alma", { arskurs: 4 })));
    sc = (await getDoc(doc(elev("alma"), "mathCompetitions", "mm1", "scores", "alma"))).data();
    assert.deepEqual([sc.arskurs, sc.correct], [4, 2]);
    // …men inte med fel värde, och ett satt värde kan inte bytas till ett fel.
    await assertFails(commit(elev("alma"), mmMed("alma", "4b", "Alma", 3)));
    await assertSucceeds(commit(elev("alma"), mm("alma", "4b", "Alma", { arskurs: 4 })));
  });

  it("arskurs kan inte smygas in utan +1 (direkt skrivning nekas)", async () => {
    await assertSucceeds(commit(elev("alma"), mm("alma", "4b", "Alma", { arskurs: 4 })));
    await assertFails(setDoc(doc(elev("alma"), "mathCompetitions", "mm1", "scores", "alma"), { arskurs: 4 }, { merge: true }));
    await assertFails(setDoc(doc(elev("alma"), "mathCompetitions", "mm1", "scores", "alma"), { arskurs: 3 }, { merge: true }));
  });

  it("Topp 25 per årskurs: where + orderBy + limit 25 tillåts för elever, > 25 nekas", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      for (let i = 0; i < 30; i++) {
        await setDoc(doc(db, "mathCompetitions", "mm1", "scores", `s${i}`),
          { uid: `s${i}`, classId: i % 2 ? "4b" : "3a", name: `Elev ${i}`, correct: 10 + i, arskurs: i % 2 ? 4 : 3 });
      }
      // Post från före #845 (utan arskurs) – syns bara under Alla.
      await setDoc(doc(db, "mathCompetitions", "mm1", "scores", "gammal"), { uid: "gammal", classId: "4b", name: "Gammal", correct: 99 });
    });
    const scores = collection(elev("alma"), "mathCompetitions", "mm1", "scores");
    const ak4 = await assertSucceeds(getDocs(query(scores, where("arskurs", "==", 4), orderBy("correct", "desc"), limit(25))));
    assert.equal(ak4.size, 15);
    assert.ok(ak4.docs.every((d) => d.data().arskurs === 4));
    assert.equal(ak4.docs[0].data().correct, 39);
    const alla = await assertSucceeds(getDocs(query(scores, orderBy("correct", "desc"), limit(25))));
    assert.equal(alla.docs[0].id, "gammal");
    await assertFails(getDocs(query(scores, where("arskurs", "==", 4), orderBy("correct", "desc"), limit(26))));
    await assertFails(getDocs(query(scores, where("arskurs", "==", 4))));
  });
});
