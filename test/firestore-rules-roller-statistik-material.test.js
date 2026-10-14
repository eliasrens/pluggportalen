// ============================================================================
// Regel-tester: roller – statistik och material (#678, spec §7 test 1–8).
// ----------------------------------------------------------------------------
// Årskurs 4 (4a, 4b) läser statistik och sparade lösenord bara för sina
// klasser och elever; admin läser allt. Material: årskurskontot skapar med
// createdBy = sig själv, ändrar/raderar bara sitt eget, duplicerar andras
// och rör aldrig ämnesdokumentet. Riggen: test/helpers/roller-env.js.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, Timestamp,
} from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";

let env;
const H = 3600 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);

before(async () => { env = await createRollerEnv("pluggportalen-rules-test-roller-statistik"); });
after(async () => { if (env) await env.testEnv.cleanup(); });

beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    for (const [uid, classId] of [["e4a", "4a"], ["e5a", "5a"]]) {
      await setDoc(doc(db, "studentData", uid, "lasresaAttempts", "f1"), { textId: "a", correct: 3 });
      await setDoc(doc(db, "studentData", uid, "ekvationsresa", "progress"), { level: 2, window: [] });
      await setDoc(doc(db, "studentData", uid, "ekvationsresaAttempts", "uppgift1"), { level: 2 });
      await setDoc(doc(db, "mathCompetitions", "mm1", "studentStats", uid), { uid, classId, correct: 5 });
      await setDoc(doc(db, "mathCompetitions", "mm1", "answers", `svar-${uid}`), { uid, classId, isCorrect: true });
      await setDoc(doc(db, "liveSessions", "s1", "answers", `svar-${uid}`), { uid, classId, isCorrect: true });
      await setDoc(doc(db, "classCenters", classId, "expMembers", uid), { uid, exp: 3 });
      await setDoc(doc(db, "classCenters", classId, "kassa", "saldo"), { saldo: 10, lastTxId: "x" });
      await setDoc(doc(db, "classCenters", classId, "donations", "d1"), { uid, itemId: "klassfana", amount: 5 });
      await setDoc(doc(db, "classCenters", classId), { inredningSparr: [] });
      await setDoc(doc(db, "hittaRattBest", uid), { best: 1 });
      await setDoc(doc(db, "hittaRattAttempts", `forsok-${uid}`), { uid, packId: "sverige", status: "open" });
    }
    await setDoc(doc(db, "mathCompetitions", "mm1"), { name: "MM", participatingClassIds: ["4a", "5a"] });
    await setDoc(doc(db, "liveSessions", "s1"), {
      name: "4A mot 5A", participatingClassIds: ["4a", "5a"], status: "finished", startedAt: ts(-H),
    });
  });
});

// Allt "statistik och elevdata" för en elev i klassen.
function statistik(db, uid, classId) {
  return [
    getDoc(doc(db, "studentData", uid)),
    getDoc(doc(db, "studentData", uid, "lasresaAttempts", "f1")),
    getDocs(collection(db, "studentData", uid, "lasresaAttempts")),
    getDoc(doc(db, "studentData", uid, "ekvationsresa", "progress")),
    getDoc(doc(db, "studentData", uid, "ekvationsresaAttempts", "uppgift1")),
    getDoc(doc(db, "mathCompetitions", "mm1", "studentStats", uid)),
    getDoc(doc(db, "mathCompetitions", "mm1", "answers", `svar-${uid}`)),
    getDoc(doc(db, "classCenters", classId, "expMembers", uid)),
    getDoc(doc(db, "classCenters", classId, "kassa", "saldo")),
    getDocs(collection(db, "classCenters", classId, "donations")),
    getDoc(doc(db, "classCenters", classId)),
    getDoc(doc(db, "hittaRattBest", uid)),
    getDoc(doc(db, "hittaRattAttempts", `forsok-${uid}`)),
  ];
}

describe("Test 1: Årskurs 4 läser statistik för 4A", () => {
  it("elevdata, Läsresan, Ekvationsresan, Mattematchen, Klasscentret, Hitta rätt!", async () => {
    for (const p of statistik(env.ak4(), "e4a", "4a")) await assertSucceeds(p);
  });
  it("sparade lösenord för sina elever (inloggningskort)", async () => {
    await assertSucceeds(getDoc(doc(env.ak4(), "studentCredentials", "e4a")));
    await assertSucceeds(getDoc(doc(env.ak4(), "studentCredentials", "e4b")));
  });
  it("listor filtrerade på sina klasser: Mattematchen-statistik och Live-/träningssvar", async () => {
    const db = env.ak4();
    const s = await assertSucceeds(getDocs(query(collection(db, "mathCompetitions", "mm1", "studentStats"),
      where("classId", "in", ["4a", "4b"]))));
    assert.deepEqual(s.docs.map((d) => d.id), ["e4a"]);
    await assertSucceeds(getDocs(query(collection(db, "liveSessions", "s1", "answers"), where("classId", "==", "4a"))));
    await assertSucceeds(getDocs(query(collectionGroup(db, "answers"), where("classId", "==", "4a"))));
  });
});

describe("Test 2: Årskurs 4 läser statistik och lösenord för en elev i 5A – nekas", () => {
  it("varje statistikkälla för 5A nekas", async () => {
    for (const p of statistik(env.ak4(), "e5a", "5a")) await assertFails(p);
  });
  it("sparade lösenord och olistade frågor nekas", async () => {
    const db = env.ak4();
    await assertFails(getDoc(doc(db, "studentCredentials", "e5a")));
    await assertFails(getDocs(collection(db, "studentCredentials")));
    await assertFails(getDocs(collection(db, "mathCompetitions", "mm1", "studentStats")));
    await assertFails(getDocs(query(collectionGroup(db, "answers"), where("classId", "==", "5a"))));
  });
  it("Årskurs 5 läser inte 4A", async () => {
    await assertFails(getDoc(doc(env.ak5(), "studentData", "e4a")));
    await assertFails(getDoc(doc(env.ak5(), "studentCredentials", "e4a")));
  });
});

describe("Test 3: admin läser allt", () => {
  it("statistik och lösenord för alla klasser, även olistat", async () => {
    const db = env.admin();
    for (const [uid, classId] of [["e4a", "4a"], ["e5a", "5a"]]) {
      for (const p of statistik(db, uid, classId)) await assertSucceeds(p);
    }
    await assertSucceeds(getDocs(collection(db, "studentCredentials")));
    await assertSucceeds(getDocs(collection(db, "studentData")));
    await assertSucceeds(getDocs(collection(db, "mathCompetitions", "mm1", "studentStats")));
    await assertSucceeds(getDocs(collectionGroup(db, "answers")));
  });
});

describe("Material: test 4–8", () => {
  const omr = (db, id) => doc(db, "subjects", "so", "areas", id);

  it("Test 4: Årskurs 4 skapar ett område med createdBy = sig själv", async () => {
    await assertSucceeds(setDoc(omr(env.ak4(), "nytt"), { title: "Ny", createdBy: "ak4", createdByName: "Årskurs 4" }));
    await assertFails(setDoc(omr(env.ak4(), "utan"), { title: "Utan ägare" }));
    await assertFails(setDoc(omr(env.ak4(), "falskt"), { title: "Falsk", createdBy: "ak5" }));
    // Bara i ett befintligt ämne.
    await assertFails(setDoc(doc(env.ak4(), "subjects", "nytt-amne", "areas", "x"), { title: "x", createdBy: "ak4" }));
  });

  it("Test 5: Årskurs 4 ändrar och raderar sitt eget område", async () => {
    await assertSucceeds(updateDoc(omr(env.ak4(), "ak4-omr"), { title: "Medeltiden 2" }));
    await assertFails(updateDoc(omr(env.ak4(), "ak4-omr"), { createdBy: "ak5" }));
    await assertSucceeds(deleteDoc(omr(env.ak4(), "ak4-omr")));
  });

  it("Test 6: Årskurs 4 ändrar/raderar inte Årskurs 5:s eller admins område", async () => {
    for (const id of ["ak5-omr", "admin-omr"]) {
      await assertFails(updateDoc(omr(env.ak4(), id), { title: "Kapat" }));
      await assertFails(updateDoc(omr(env.ak4(), id), { createdBy: "ak4" }));
      await assertFails(setDoc(omr(env.ak4(), id), { title: "Över", createdBy: "ak4" }));
      await assertFails(deleteDoc(omr(env.ak4(), id)));
    }
    // Admin ändrar fortfarande allt.
    await assertSucceeds(updateDoc(omr(env.admin(), "ak5-omr"), { title: "Admin ändrade" }));
  });

  it("Test 7: Årskurs 4 duplicerar admins område – kopian ägs av Årskurs 4", async () => {
    const db = env.ak4();
    const src = (await assertSucceeds(getDoc(omr(db, "admin-omr")))).data();
    await assertSucceeds(setDoc(omr(db, "admin-omr-kopia"), { ...src, title: `${src.title} (kopia)`, createdBy: "ak4", createdByName: "Årskurs 4" }));
    await assertSucceeds(updateDoc(omr(db, "admin-omr-kopia"), { title: "Min version" }));
    await assertSucceeds(deleteDoc(omr(db, "admin-omr-kopia")));
  });

  it("Test 8: Årskurs 4 skapar eller ändrar inte ett ämne; admin gör det", async () => {
    await assertFails(setDoc(doc(env.ak4(), "subjects", "nytt"), { name: "Nytt" }));
    await assertFails(updateDoc(doc(env.ak4(), "subjects", "so"), { name: "SO 2" }));
    await assertFails(deleteDoc(doc(env.ak4(), "subjects", "so")));
    await assertSucceeds(setDoc(doc(env.admin(), "subjects", "nytt"), { name: "Nytt" }));
    await assertSucceeds(updateDoc(doc(env.admin(), "subjects", "so"), { name: "SO 2" }));
  });

  it("alla inloggade (även årskurskonton) läser allt material", async () => {
    await assertSucceeds(getDocs(collection(env.ak4(), "subjects", "so", "areas")));
    await assertSucceeds(getDoc(omr(env.ak5(), "ak4-omr")));
  });
});
