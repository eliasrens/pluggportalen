// ============================================================================
// Regel-tester: Bråkresan (#706, docs/BRAKRESAN.md §4, docs/BEHORIGHETER.md BR).
// ----------------------------------------------------------------------------
// Spec §13: eleven kan INTE skriva stjärnor, mynt-händelser, omgångsresultat,
// drake eller jakt – allt det skrivs av Cloud Functions (Admin SDK). Klienten
// läser: eleven sitt eget, läraren egna elever. Facit (brakresaSecrets) läser
// ingen klient. Rekommendationer: admin/årskurskonto för egna elever/klasser.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";

let env;

const SUB = ["brakresa", "brakresaRounds", "brakresaRewards", "brakresaHunts"];
const ID = { brakresa: "state", brakresaRounds: "r0000000001", brakresaRewards: "stjarna-03-1", brakresaHunts: "2026-10-14" };
const ref = (db, uid, sub) => doc(db, "studentData", uid, sub, ID[sub]);

const STATE = { schema: 1, totalStars: 1, mastered: 0, challenges: { "03": { stars: 1, firstCorrect: 8, firstTotal: 10 } } };
const DATA = {
  brakresa: STATE,
  brakresaRounds: { schema: 1, challengeId: "03", status: "avslutad", correctCount: 8, tasks: [], answers: [] },
  brakresaRewards: { eventId: "stjarna-03-1", type: "stjarna", amount: 40, challengeId: "03", starOrdinal: 1 },
  brakresaHunts: { date: "2026-10-14", level: 1, max: 10, amount: 7, status: "bekraftad" },
};

const rec = (over = {}) => ({
  teacherId: "ak4", classId: "4a", studentId: null, challengeIds: ["03", "12"], comment: "Börja här",
  active: true, createdAt: serverTimestamp(), ...over,
});
const recRef = (db, id) => doc(db, "brakresaRecommendations", id);

before(async () => {
  env = await createRollerEnv("pluggportalen-rules-test-brakresan");
});

after(async () => {
  if (env?.testEnv) await env.testEnv.cleanup();
});

beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    for (const uid of ["e4a", "e5a"]) {
      for (const sub of SUB) await setDoc(ref(db, uid, sub), DATA[sub]);
    }
    await setDoc(doc(db, "brakresaSecrets", "r0000000001"), { studentId: "e4a", tasks: [{ key: { display: "3 av 5" } }] });
    const t = Timestamp.fromMillis(1);
    await setDoc(recRef(db, "klass4a"), { ...rec(), createdAt: t });
    await setDoc(recRef(db, "elev4a"), { ...rec({ classId: null, studentId: "e4a" }), createdAt: t });
    await setDoc(recRef(db, "klass5a"), { ...rec({ teacherId: "ak5", classId: "5a" }), createdAt: t });
  });
});

describe("elevens Bråkresan-data (state, omgångar, belöningar, jakt)", () => {
  it("eleven läser sitt eget men aldrig en annan elevs", async () => {
    for (const sub of SUB) {
      await assertSucceeds(getDoc(ref(env.as("e4a"), "e4a", sub)));
      await assertFails(getDoc(ref(env.as("e4a"), "e5a", sub)));
      await assertFails(getDoc(ref(env.unauth(), "e4a", sub)));
    }
    await assertSucceeds(getDocs(collection(env.as("e4a"), "studentData", "e4a", "brakresaRounds")));
    await assertFails(getDocs(collection(env.as("e5a"), "studentData", "e4a", "brakresaRounds")));
  });

  it("eleven kan inte skriva stjärnor, mynt-händelser, omgångsresultat, drake eller jakt", async () => {
    const elev = env.as("e4a");
    await assertFails(setDoc(ref(elev, "e4a", "brakresa"), { ...STATE, totalStars: 150 }));
    await assertFails(updateDoc(ref(elev, "e4a", "brakresa"), { "challenges.03.stars": 3 }));
    await assertFails(setDoc(doc(elev, "studentData", "e4a", "brakresa", "dragon"), { level: 15 }));
    await assertFails(updateDoc(ref(elev, "e4a", "brakresaRounds"), { correctCount: 10 }));
    await assertFails(setDoc(doc(elev, "studentData", "e4a", "brakresaRounds", "ny0000001"), DATA.brakresaRounds));
    await assertFails(setDoc(doc(elev, "studentData", "e4a", "brakresaRewards", "stjarna-03-2"), DATA.brakresaRewards));
    await assertFails(setDoc(doc(elev, "studentData", "e4a", "brakresaHunts", "2026-10-15"), { ...DATA.brakresaHunts, amount: 200 }));
    for (const sub of SUB) await assertFails(deleteDoc(ref(elev, "e4a", sub)));
  });

  it("admin läser alla, årskurskontot bara egna elever; ingen lärare skriver", async () => {
    for (const sub of SUB) {
      await assertSucceeds(getDoc(ref(env.admin(), "e5a", sub)));
      await assertSucceeds(getDoc(ref(env.ak4(), "e4a", sub)));
      await assertFails(getDoc(ref(env.ak4(), "e5a", sub)));
      await assertFails(getDoc(ref(env.ak4av(), "e4a", sub)));
      await assertFails(setDoc(ref(env.admin(), "e4a", sub), DATA[sub]));
      await assertFails(setDoc(ref(env.ak4(), "e4a", sub), DATA[sub]));
    }
  });
});

describe("brakresaSecrets (facit)", () => {
  it("ingen klient läser eller skriver – inte eleven, inte admin", async () => {
    for (const db of [env.as("e4a"), env.admin(), env.ak4(), env.unauth()]) {
      await assertFails(getDoc(doc(db, "brakresaSecrets", "r0000000001")));
      await assertFails(setDoc(doc(db, "brakresaSecrets", "r2"), { tasks: [] }));
    }
  });
});

describe("brakresaRecommendations", () => {
  const recs = (db, field, value) =>
    getDocs(query(collection(db, "brakresaRecommendations"), where(field, "==", value), where("active", "==", true)));

  it("eleven läser sina egna och klassens rekommendationer, inte andras", async () => {
    await assertSucceeds(recs(env.as("e4a"), "studentId", "e4a"));
    await assertSucceeds(recs(env.as("e4a"), "classId", "4a"));
    await assertSucceeds(getDoc(recRef(env.as("e4a"), "elev4a")));
    await assertFails(getDoc(recRef(env.as("e5a"), "elev4a")));
    await assertFails(getDoc(recRef(env.as("e5a"), "klass4a")));
    await assertFails(recs(env.as("e5a"), "classId", "4a"));
    await assertFails(recs(env.as("e5a"), "studentId", "e4a"));
  });

  it("årskurskontot skapar för egna klasser och elever; admin för alla", async () => {
    await assertSucceeds(setDoc(recRef(env.ak4(), "n1"), rec()));
    await assertSucceeds(setDoc(recRef(env.ak4(), "n2"), rec({ classId: null, studentId: "e4a", comment: null })));
    await assertFails(setDoc(recRef(env.ak4(), "n3"), rec({ classId: "5a" })));
    await assertFails(setDoc(recRef(env.ak4(), "n4"), rec({ classId: null, studentId: "e5a" })));
    await assertFails(setDoc(recRef(env.ak4av(), "n5"), rec({ teacherId: "ak4av" })));
    await assertSucceeds(setDoc(recRef(env.admin(), "n6"), rec({ teacherId: "admin1", classId: "6a" })));
  });

  it("formen: exakt ett mål, kända utmaningar, kort kommentar, egen teacherId, serverns tid", async () => {
    const ak4 = env.ak4();
    await assertFails(setDoc(recRef(ak4, "f1"), rec({ studentId: "e4a" })));
    await assertFails(setDoc(recRef(ak4, "f2"), rec({ classId: null })));
    await assertFails(setDoc(recRef(ak4, "f3"), rec({ challengeIds: ["03", "51"] })));
    await assertFails(setDoc(recRef(ak4, "f4"), rec({ challengeIds: [] })));
    await assertFails(setDoc(recRef(ak4, "f5"), rec({ comment: "x".repeat(201) })));
    await assertFails(setDoc(recRef(ak4, "f6"), rec({ teacherId: "ak5" })));
    await assertFails(setDoc(recRef(ak4, "f7"), rec({ createdAt: Timestamp.fromMillis(5) })));
    await assertFails(setDoc(recRef(ak4, "f8"), rec({ active: false })));
    await assertFails(setDoc(recRef(ak4, "f9"), rec({ stars: 3 })));
  });

  it("eleven kan inte skapa, ändra eller ta bort rekommendationer", async () => {
    const elev = env.as("e4a");
    await assertFails(setDoc(recRef(elev, "e1"), rec({ teacherId: "e4a", classId: null, studentId: "e4a" })));
    await assertFails(updateDoc(recRef(elev, "elev4a"), { active: false }));
    await assertFails(deleteDoc(recRef(elev, "elev4a")));
  });

  it("läraren avslutar och tar bort; målet och skaparen kan inte bytas", async () => {
    await assertSucceeds(updateDoc(recRef(env.ak4(), "klass4a"), { active: false, endedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(recRef(env.ak4(), "elev4a"), { comment: "Prova 14 också", challengeIds: ["14"] }));
    await assertFails(updateDoc(recRef(env.ak4(), "elev4a"), { studentId: "e4b" }));
    await assertFails(updateDoc(recRef(env.ak4(), "elev4a"), { teacherId: "ak5" }));
    await assertFails(updateDoc(recRef(env.ak5(), "klass4a"), { active: false }));
    await assertFails(deleteDoc(recRef(env.ak5(), "klass4a")));
    await assertSucceeds(deleteDoc(recRef(env.ak4(), "elev4a")));
    await assertSucceeds(deleteDoc(recRef(env.admin(), "klass5a")));
  });

  it("läraren listar egna klassens rekommendationer men inte andras", async () => {
    await assertSucceeds(recs(env.ak4(), "classId", "4a"));
    await assertFails(recs(env.ak4(), "classId", "5a"));
    await assertSucceeds(recs(env.admin(), "classId", "5a"));
  });
});
