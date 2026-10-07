// ============================================================================
// Regel-tester: Mattematchens LÄRARSIDA (#459) mot emulatorn – lärarens
// skrivningar som mm-teacher-data.js gör ska godtas, elevers nekas:
//   • skapa, Starta nu (serverTimestamp), Stoppa, Fortsätt, Avsluta + result
//   • nollställning: radera svar/statistik/topplista/räknare + ta bort result
//   • klasstabellen: studentStats where documentId in [...] (lärare)
//   • gemensam träningsstatistik: count() på collectionGroup("answers")
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  doc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, collectionGroup, query, where,
  documentId, deleteField, serverTimestamp, getCountFromServer, Timestamp,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";

let testEnv, elev, teacher;
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
const comp = (over = {}) => ({
  name: "Mattematchen oktober", participatingClassIds: ["4a"], startAt: ts(H), endAt: ts(9 * H),
  status: "active", counterShards: 5, createdBy: "larare1", createdAt: ts(-H), ...over,
});
const svar = (uid, ok) => ({
  uid, classId: "4a", mode: "multiplication_0_10", factorA: 3, factorB: 4, answer: ok ? 12 : 1,
  correctAnswer: 12, isCorrect: ok, shard: 0, at: ts(-H),
});

before(async () => {
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-mm-larare"));
});
after(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "4a"), { name: "4A", studentIds: ["alma", "bo"] });
    await setDoc(doc(db, "mathCompetitions", "mm1"), comp());
    for (const uid of ["alma", "bo"]) {
      await setDoc(doc(db, "mathCompetitions/mm1/studentStats", uid), { uid, classId: "4a", correct: 3, incorrect: 1, c3: 3, c4: 3, w3: 1, w4: 1 });
      await setDoc(doc(db, "mathCompetitions/mm1/scores", uid), { uid, classId: "4a", name: uid, correct: 3 });
    }
    await setDoc(doc(db, "mathCompetitions/mm1/classCounters", "4a_0"), { classId: "4a", shard: 0, correct: 6 });
    await setDoc(doc(db, "mathCompetitions/mm1/answers", "a1"), svar("alma", true));
    await setDoc(doc(db, "mathCompetitions/mm1/answers", "a2"), svar("alma", false));
    await setDoc(doc(db, "liveSessions", "s1"), { name: "Live", status: "finished" });
    await setDoc(doc(db, "liveSessions/s1/answers", "l1"), svar("alma", true));
  });
});

describe("lärarens kontroller", () => {
  it("skapa, starta nu, stoppa, fortsätt, avsluta med result", async () => {
    const db = teacher();
    await assertSucceeds(addDoc(collection(db, "mathCompetitions"), { ...comp(), createdAt: serverTimestamp() }));
    const ref = doc(db, "mathCompetitions", "mm1");
    await assertSucceeds(updateDoc(ref, { status: "active", startAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { status: "stopped" }));
    await assertSucceeds(updateDoc(ref, { status: "active" }));
    await assertSucceeds(updateDoc(ref, {
      status: "finished", finishedAt: serverTimestamp(),
      result: { winner: { uid: "alma", name: "alma", classId: "4a", correct: 3 }, top: [], classes: [], students: [] },
    }));
  });
  it("elev får inte styra tävlingen", async () => {
    await assertFails(updateDoc(doc(elev("alma"), "mathCompetitions", "mm1"), { status: "finished" }));
    await assertFails(addDoc(collection(elev("alma"), "mathCompetitions"), comp()));
  });
  it("ogiltig period nekas även för lärare (slut före start)", async () => {
    await assertFails(updateDoc(doc(teacher(), "mathCompetitions", "mm1"), { endAt: ts(-2 * H), startAt: ts(-H) }));
  });
});

describe("nollställning", () => {
  it("läraren raderar svar, statistik, topplista, räknare och result", async () => {
    const db = teacher();
    for (const sub of ["answers", "studentStats", "scores", "classCounters"]) {
      const snap = await getDocs(collection(db, "mathCompetitions/mm1", sub));
      for (const d of snap.docs) await assertSucceeds(deleteDoc(d.ref));
    }
    await assertSucceeds(updateDoc(doc(db, "mathCompetitions", "mm1"), { result: deleteField() }));
  });
  it("elev får inte radera", async () => {
    const db = elev("alma");
    await assertFails(deleteDoc(doc(db, "mathCompetitions/mm1/studentStats", "alma")));
    await assertFails(deleteDoc(doc(db, "mathCompetitions/mm1/scores", "alma")));
    await assertFails(deleteDoc(doc(db, "mathCompetitions/mm1/answers", "a1")));
  });
});

describe("statistikläsningar", () => {
  it("klasstabellen: studentStats where documentId in [...]", async () => {
    const q = query(collection(teacher(), "mathCompetitions/mm1/studentStats"), where(documentId(), "in", ["alma", "bo"]));
    const snap = await assertSucceeds(getDocs(q));
    assert.equal(snap.size, 2);
  });
  it("elev får inte läsa klasskamraters statistik", async () => {
    const q = query(collection(elev("alma"), "mathCompetitions/mm1/studentStats"), where(documentId(), "in", ["alma", "bo"]));
    await assertFails(getDocs(q));
  });
  it("träningstotal MM + Live via count() på collectionGroup", async () => {
    const base = query(collectionGroup(teacher(), "answers"), where("uid", "==", "alma"));
    const all = await assertSucceeds(getCountFromServer(base));
    const ok = await assertSucceeds(getCountFromServer(query(base, where("isCorrect", "==", true))));
    assert.equal(all.data().count, 3);
    assert.equal(ok.data().count, 2);
  });
});
