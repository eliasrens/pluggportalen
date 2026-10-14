// ============================================================================
// Regel-tester: roller – klasser och elever (#678, spec §7 test 9–14).
// ----------------------------------------------------------------------------
// Årskurs 4 (4a, 4b) ändrar BARA synlighet, fokusläge och startnivå för sina
// klasser, aldrig namn/elevlista, och skapar/raderar varken klasser eller
// elevkonton. Elevlösenord skriver bara Cloud Functionen (test 13 i
// test/functions-roller.test.mjs) – reglerna nekar klientskrivning. Läsresans
// och Ekvationsresans nivå får ändras, coins aldrig.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, deleteField, doc, getDoc, runTransaction, setDoc, updateDoc } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { normalizeLasresa } from "../src/lasresan/progress.js";
import { teacherLevelFieldPaths, withTeacherLevel } from "../src/lasresan/level-control.js";
import { classStartLevelFields, toStoredLasresa } from "../src/lasresan/level-scale.js";
import { defaultProgress, teacherSetLevel } from "../src/ekvationsresan/framsteg.js";

let env;

before(async () => { env = await createRollerEnv("pluggportalen-rules-test-roller-klasser"); });
after(async () => { if (env) await env.testEnv.cleanup(); });
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    for (const uid of ["e4a", "e5a"]) {
      await setDoc(doc(db, "studentData", uid, "ekvationsresa", "progress"), { ...defaultProgress(), tasks: 4, coins: 12 });
    }
  });
});

const klass = (db, id) => doc(db, "classes", id);
const lock = () => ({ mal: { typ: "lasresan" }, till: Date.now() + 3600 * 1000, doljOvrigt: false });
// Allt §2.1 tillåter på en klass, ett fält i taget (som lärarvyn skriver).
const tillatet = () => [
  { assignedAreas: [{ subjectId: "so", areaId: "admin-omr" }] },
  { hiddenModes: ["memory"] },
  { areaModes: { "admin-omr": { hiddenModes: ["quiz"] } } },
  { hiddenModules: ["lasresan"] },
  { hiddenModules: [], enabledModules: ["hittaratt"] },
  { lock: lock() },
  { lock: deleteField() },
  classStartLevelFields(6),
];

describe("Test 9: Årskurs 4 ändrar synlighet, fokusläge och startnivå för 4A", () => {
  it("varje tillåtet fält godtas, för båda sina klasser", async () => {
    for (const id of ["4a", "4b"]) {
      for (const f of tillatet()) await assertSucceeds(setDoc(klass(env.ak4(), id), f, { merge: true }));
    }
    const d = (await getDoc(klass(env.ak4(), "4a"))).data();
    assert.equal(d.lasresaStartLevel10, 6);
    assert.equal(d.name, "4A");
  });
  it("valideringen gäller fortfarande (för långt lås, fel startnivå)", async () => {
    await assertFails(updateDoc(klass(env.ak4(), "4a"), { lock: { ...lock(), till: Date.now() + 48 * 3600 * 1000 } }));
    await assertFails(updateDoc(klass(env.ak4(), "4a"), { lasresaStartLevel10: 11 }));
  });
});

describe("Test 10: Årskurs 4 ändrar samma sak för 5A – nekas", () => {
  it("varje fält nekas för en klass kontot inte har", async () => {
    for (const f of tillatet()) await assertFails(setDoc(klass(env.ak4(), "5a"), f, { merge: true }));
    // Årskurs 5 får däremot.
    await assertSucceeds(updateDoc(klass(env.ak5(), "5a"), { hiddenModes: ["memory"] }));
  });
});

describe("Test 11: Årskurs 4 ändrar name eller studentIds för 4A – nekas", () => {
  it("namn, elevlista, byar och påhittade fält nekas, även blandat med tillåtna", async () => {
    const db = env.ak4();
    await assertFails(updateDoc(klass(db, "4a"), { name: "Nytt namn" }));
    await assertFails(updateDoc(klass(db, "4a"), { studentIds: ["e4a", "e5a"] }));
    await assertFails(updateDoc(klass(db, "4a"), { hiddenVillages: ["4b"] }));
    await assertFails(updateDoc(klass(db, "4a"), { order: 3 }));
    await assertFails(updateDoc(klass(db, "4a"), { assignedAreas: [], name: "Smyg" }));
    await assertSucceeds(updateDoc(klass(env.admin(), "4a"), { name: "4A Admin", studentIds: ["e4a"] }));
  });
});

describe("Test 12: Årskurs 4 skapar eller raderar en klass eller ett elevkonto – nekas", () => {
  it("klasser", async () => {
    await assertFails(setDoc(klass(env.ak4(), "4c"), { name: "4C", studentIds: [] }));
    await assertFails(deleteDoc(klass(env.ak4(), "4a")));
    await assertSucceeds(setDoc(klass(env.admin(), "4c"), { name: "4C", studentIds: [] }));
    await assertSucceeds(deleteDoc(klass(env.admin(), "4c")));
  });
  it("elevkonton: skapa, byta namn/användarnamn, flytta, radera", async () => {
    const db = env.ak4();
    await assertFails(setDoc(doc(db, "students", "ny"), { namn: "Ny", username: "ny", classIds: ["4a"] }));
    await assertFails(updateDoc(doc(db, "students", "e4a"), { namn: "Annat namn" }));
    await assertFails(updateDoc(doc(db, "students", "e4a"), { username: "nytt" }));
    await assertFails(updateDoc(doc(db, "students", "e4a"), { classIds: ["4b"] }));
    await assertFails(deleteDoc(doc(db, "students", "e4a")));
    await assertSucceeds(setDoc(doc(env.admin(), "students", "ny"), { namn: "Ny", username: "ny", classIds: ["4a"] }));
  });
  it("elevdata nollställs eller raderas inte", async () => {
    const db = env.ak4();
    await assertFails(deleteDoc(doc(db, "studentData", "e4a")));
    await assertFails(setDoc(doc(db, "studentData", "e4a"), { coins: 0, xp: 0 }));
    await assertFails(deleteDoc(doc(db, "studentData", "e4a", "ekvationsresa", "progress")));
    await assertFails(setDoc(doc(db, "studentData", "nyelev"), { coins: 0 }));
  });
});

describe("Test 13 (reglerna): sparade lösenord skrivs aldrig av årskurskontot", () => {
  it("inte ens för en elev i 4A – bytet går via updateStudentLogin", async () => {
    const db = env.ak4();
    await assertFails(setDoc(doc(db, "studentCredentials", "e4a"), { username: "e4a", password: "nytt123" }));
    await assertFails(updateDoc(doc(db, "studentCredentials", "e4a"), { password: "nytt123" }));
    await assertFails(deleteDoc(doc(db, "studentCredentials", "e4a")));
    await assertSucceeds(updateDoc(doc(env.admin(), "studentCredentials", "e4a"), { password: "nytt123" }));
  });
});

describe("Test 14: Läsresan- och Ekvationsresan-nivå för en elev i 4A; coins nekas", () => {
  // Samma skrivning som src/data-lasresan-niva.js setStudentLevel.
  const setLevel = (db, uid, level) => runTransaction(db, async (tx) => {
    const ref = doc(db, "studentData", uid);
    const sd = (await tx.get(ref)).data();
    const out = toStoredLasresa(withTeacherLevel(normalizeLasresa(sd.lasresa), level, Date.now()).lasresa);
    if (sd.lasresa) tx.update(ref, teacherLevelFieldPaths(out));
    else tx.update(ref, { lasresa: out });
  });
  const ekv = (db, uid) => doc(db, "studentData", uid, "ekvationsresa", "progress");

  it("Läsresan: nivån sätts för en elev som börjat och en som inte börjat", async () => {
    await assertSucceeds(setLevel(env.ak4(), "e4a", 9));
    await assertSucceeds(setLevel(env.ak4(), "e4b", 3));
    const sd = (await getDoc(doc(env.admin(), "studentData", "e4a"))).data();
    assert.equal(sd.lasresa.level10, 9);
    assert.equal(sd.lasresa.moneyEarned, 36, "resultat och pengar orörda");
    assert.equal(sd.coins, 100);
  });

  it("Ekvationsresan: lärarens nivåbyte för 4A godtas", async () => {
    const db = env.ak4();
    const cur = (await getDoc(ekv(db, "e4a"))).data();
    await assertSucceeds(setDoc(ekv(db, "e4a"), teacherSetLevel(cur, 5, 123)));
    await assertFails(updateDoc(ekv(db, "e4a"), { window: [], coins: 500 }));
  });

  it("coins, andra Läsresan-fält och annat i studentData nekas", async () => {
    const db = env.ak4();
    const ref = doc(db, "studentData", "e4a");
    await assertFails(updateDoc(ref, { coins: 1000 }));
    await assertFails(updateDoc(ref, { coins: 1000, "lasresa.level10": 5 }));
    await assertFails(updateDoc(ref, { "lasresa.moneyEarned": 999 }));
    await assertFails(updateDoc(ref, { "lasresa.seenTextIds": [] }));
    await assertFails(updateDoc(ref, { xp: 5000 }));
    await assertFails(updateDoc(ref, { ownedItems: ["guldkrona"] }));
    // En "ny" Läsresa med påhittade resultat nekas.
    await assertFails(updateDoc(doc(db, "studentData", "e4b"), { lasresa: { level: 4, level10: 7, moneyEarned: 500 } }));
    await assertSucceeds(updateDoc(doc(env.admin(), "studentData", "e4a"), { coins: 1000 }));
  });

  it("nivåer för en elev i 5A nekas", async () => {
    await assertFails(setLevel(env.ak4(), "e5a", 9));
    const cur = (await getDoc(ekv(env.admin(), "e5a"))).data();
    await assertFails(setDoc(ekv(env.ak4(), "e5a"), teacherSetLevel(cur, 5, 123)));
  });
});
