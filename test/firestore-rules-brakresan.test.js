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
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, deleteField, collection, query, where, serverTimestamp, Timestamp,
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

  it("lärarvyn (K #716): en fråga per egen elev, aldrig andra elevers", async () => {
    await assertSucceeds(recs(env.ak4(), "studentId", "e4a"));
    await assertFails(recs(env.ak4(), "studentId", "e5a"));
    await assertSucceeds(recs(env.admin(), "studentId", "e5a"));
  });
});

describe("lärarvyns läsningar (K #716)", () => {
  const rounds = (db, uid) => collection(db, "studentData", uid, "brakresaRounds");
  it("omgångar per utmaning, per period och stjärnhändelser – bara egna elever", async () => {
    const ak4 = env.ak4();
    await assertSucceeds(getDocs(query(rounds(ak4, "e4a"), where("challengeId", "==", "03"))));
    await assertSucceeds(getDocs(query(rounds(ak4, "e4a"), where("startedAt", ">=", new Date(0)))));
    await assertSucceeds(getDocs(query(collection(ak4, "studentData", "e4a", "brakresaRewards"), where("type", "==", "stjarna"))));
    await assertFails(getDocs(query(rounds(ak4, "e5a"), where("challengeId", "==", "03"))));
    await assertFails(getDocs(query(collection(ak4, "studentData", "e5a", "brakresaRewards"), where("type", "==", "stjarna"))));
  });
});

describe("studentData.brakdrake – husets spegel av draken (#750, BRAKRESAN.md §8.3)", () => {
  const DRAKE = { id: "drake-e4a", level: 4, name: "Bråkis", pos: { x: 40, y: 80 }, room: 0, stowed: false };
  const sd = (db, uid) => doc(db, "studentData", uid);

  beforeEach(async () => {
    await env.seed(async (db) => {
      await updateDoc(sd(db, "e4a"), { brakdrake: DRAKE, room: { placements: {} }, farm: { placedAnimals: {} } });
      await deleteDoc(sd(db, "e6a")); // e6a har inget studentData-dokument än
    });
  });

  it("eleven kan inte skapa en drake – varken i ett nytt dokument eller ett befintligt", async () => {
    const drake = { id: "fusk", level: 15, name: "Fusk" };
    await assertFails(updateDoc(sd(env.as("e4b"), "e4b"), { brakdrake: drake }));
    await assertFails(setDoc(sd(env.as("e4b"), "e4b"), { brakdrake: drake }, { merge: true }));
    await assertFails(updateDoc(sd(env.as("e4b"), "e4b"), { "brakdrake.pos": { x: 50, y: 80 } }));
    await assertFails(setDoc(sd(env.as("e6a"), "e6a"), { coins: 0, brakdrake: drake }));
    await assertSucceeds(setDoc(sd(env.as("e6a"), "e6a"), { coins: 0, xp: 0 }));
  });

  it("eleven kan inte ändra id, level, name eller stage", async () => {
    const elev = sd(env.as("e4a"), "e4a");
    await assertFails(updateDoc(elev, { "brakdrake.level": 15 }));
    await assertFails(updateDoc(elev, { "brakdrake.id": "annan" }));
    await assertFails(updateDoc(elev, { "brakdrake.name": "Nytt namn" }));
    await assertFails(updateDoc(elev, { "brakdrake.stage": 3 }));
    await assertFails(updateDoc(elev, { brakdrake: { ...DRAKE, level: 15 } }));
    await assertFails(updateDoc(elev, { "brakdrake.pos": { x: 10, y: 80 }, "brakdrake.level": 15 }));
  });

  it("eleven kan inte ta bort draken eller byta ut den mot något annat", async () => {
    const elev = sd(env.as("e4a"), "e4a");
    await assertFails(updateDoc(elev, { brakdrake: deleteField() }));
    await assertFails(updateDoc(elev, { brakdrake: null }));
    await assertFails(updateDoc(elev, { brakdrake: "drake" }));
    await assertFails(setDoc(elev, { coins: 100, xp: 0 })); // hela dokumentet utan draken
  });

  it("eleven flyttar draken, byter rum och lägger den i lådan (rum-drake.js)", async () => {
    const elev = sd(env.as("e4a"), "e4a");
    await assertSucceeds(updateDoc(elev, { "brakdrake.pos": { x: 55.5, y: 82 } }));
    await assertSucceeds(updateDoc(elev, { "brakdrake.stowed": true }));
    await assertSucceeds(updateDoc(elev, { "brakdrake.room": 2, "brakdrake.pos": { x: 20, y: 75 } }));
    await assertSucceeds(updateDoc(elev, { brakdrake: { ...DRAKE, room: 1, stowed: true } }));
  });

  it("andra studentData-skrivningar fungerar som förut – med och utan drake", async () => {
    for (const uid of ["e4a", "e4b"]) {
      const elev = sd(env.as(uid), uid);
      await assertSucceeds(updateDoc(elev, { coins: 60, ownedItems: ["soffa"] }));
      await assertSucceeds(updateDoc(elev, { "room.placements.soffa": { x: 10, y: 20 } }));
      await assertSucceeds(updateDoc(elev, { "farm.placedAnimals.ko1": { x: 30, y: 40, room: 1 } }));
      await assertSucceeds(setDoc(elev, { husLast: true }, { merge: true }));
    }
    // Hela dokumentet skrivet med oförändrad drake (diffen rör inte brakdrake).
    let hela;
    await env.seed(async (db) => { hela = (await getDoc(sd(db, "e4a"))).data(); });
    await assertSucceeds(setDoc(sd(env.as("e4a"), "e4a"), { ...hela, coins: 1 }));
  });

  it("en klasskamrat skriver aldrig; admin och servern skriver draken, årskurskontot inte", async () => {
    await assertFails(updateDoc(sd(env.as("e4b"), "e4a"), { "brakdrake.pos": { x: 1, y: 80 } }));
    await assertSucceeds(updateDoc(sd(env.admin(), "e4a"), { "brakdrake.level": 5 }));
    await assertSucceeds(updateDoc(sd(env.admin(), "e4b"), { brakdrake: { id: "d2", level: 1, name: "Bråkis" } }));
    await assertFails(updateDoc(sd(env.ak4(), "e4a"), { "brakdrake.level": 6 }));
    await assertFails(updateDoc(sd(env.ak4(), "e4a"), { "brakdrake.pos": { x: 1, y: 80 } }));
  });
});
