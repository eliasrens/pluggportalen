// ============================================================================
// Regel-tester: roller – övergången och kontots läge (#678, §6.2, §7 test 25).
// ----------------------------------------------------------------------------
// Test 25: ett konto med teacher:true UTAN role och admin (gammal token före
// migreringen) behandlas som admin – isLegacyTeacher() i firestore.rules,
// som tas bort när migreringen är verifierad. Dessutom: ett årskurskonto
// gäller bara med ett AKTIVT kontodokument vars roll stämmer, och en
// klassändring i dokumentet slår igenom direkt (test 21/22 på regelsidan).
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, getDocs, collection, setDoc, updateDoc, Timestamp } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";

let env;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);

before(async () => { env = await createRollerEnv("pluggportalen-rules-test-roller-overgang"); });
after(async () => { if (env) await env.testEnv.cleanup(); });
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
});

describe("Test 25: teacher:true utan role behandlas som admin under övergången", () => {
  it("gör allt som admin: ämnen, klasser, elevkonton, mynt, lösenord, Mattematchen", async () => {
    const db = env.gammal();
    await assertSucceeds(setDoc(doc(db, "subjects", "nytt"), { name: "Nytt" }));
    await assertSucceeds(updateDoc(doc(db, "subjects", "so", "areas", "ak5-omr"), { title: "Ändrat" }));
    await assertSucceeds(updateDoc(doc(db, "classes", "5a"), { name: "5A ny", studentIds: [] }));
    await assertSucceeds(setDoc(doc(db, "students", "ny"), { namn: "Ny", classIds: ["6a"] }));
    await assertSucceeds(updateDoc(doc(db, "studentData", "e6a"), { coins: 999 }));
    await assertSucceeds(getDocs(collection(db, "studentCredentials")));
    await assertSucceeds(updateDoc(doc(db, "studentCredentials", "e6a"), { password: "nytt123" }));
    await assertSucceeds(setDoc(doc(db, "mathCompetitions", "mm"), {
      name: "MM", participatingClassIds: ["6a"], startAt: ts(0), endAt: ts(3600e3), status: "active", counterShards: 2,
    }));
    await assertSucceeds(getDocs(collection(db, "teacherAccounts")));
  });

  it("bara exakt teacher:true utan role/admin – admin:false eller okänd roll räknas inte", async () => {
    for (const claims of [{ teacher: true, admin: false }, { teacher: true, role: "okand" }, { admin: true }]) {
      const db = env.as("x", claims);
      await assertFails(updateDoc(doc(db, "classes", "4a"), { assignedAreas: [] }));
      await assertFails(getDoc(doc(db, "studentCredentials", "e4a")));
    }
  });
});

describe("Kontots läge (get() på teacherAccounts)", () => {
  it("avstängt årskurskonto (active:false) nekas läsning och skrivning", async () => {
    const db = env.ak4av();
    await assertFails(getDoc(doc(db, "studentData", "e4a")));
    await assertFails(getDoc(doc(db, "studentCredentials", "e4a")));
    await assertFails(updateDoc(doc(db, "classes", "4a"), { assignedAreas: [] }));
    await assertFails(setDoc(doc(db, "subjects", "so", "areas", "x"), { title: "x", createdBy: "ak4av" }));
  });

  it("årskurs-claims utan kontodokument nekas", async () => {
    const db = env.as("utankonto", { teacher: true, role: "arskurs" });
    await assertFails(updateDoc(doc(db, "classes", "4a"), { assignedAreas: [] }));
    await assertFails(getDoc(doc(db, "studentData", "e4a")));
  });

  it("dokumentets roll måste vara arskurs (en uppgradering väntar på ny token)", async () => {
    await env.seed((db) => updateDoc(doc(db, "teacherAccounts", "ak4"), { role: "admin" }));
    await assertFails(updateDoc(doc(env.ak4(), "classes", "4a"), { assignedAreas: [] }));
  });

  it("stängs kontot av slår det igenom direkt, utan ny token (test 22)", async () => {
    await assertSucceeds(updateDoc(doc(env.ak4(), "classes", "4a"), { assignedAreas: [] }));
    await env.seed((db) => updateDoc(doc(db, "teacherAccounts", "ak4"), { active: false }));
    await assertFails(updateDoc(doc(env.ak4(), "classes", "4a"), { assignedAreas: [] }));
  });

  it("admin tar bort 4B från Årskurs 4 – slår igenom direkt (test 21)", async () => {
    await assertSucceeds(getDoc(doc(env.ak4(), "studentData", "e4b")));
    await env.seed((db) => updateDoc(doc(db, "teacherAccounts", "ak4"), { classIds: ["4a"] }));
    await assertFails(getDoc(doc(env.ak4(), "studentData", "e4b")));
    await assertFails(updateDoc(doc(env.ak4(), "classes", "4b"), { assignedAreas: [] }));
    await assertSucceeds(updateDoc(doc(env.ak4(), "classes", "4a"), { assignedAreas: [] }));
  });

  it("elever påverkas inte av rollreglerna", async () => {
    const db = env.elev("e4a");
    await assertSucceeds(getDoc(doc(db, "studentData", "e4a")));
    await assertSucceeds(getDoc(doc(db, "studentData", "e5a")));
    await assertSucceeds(updateDoc(doc(db, "studentData", "e4a"), { xp: 5 }));
    await assertFails(getDoc(doc(db, "studentCredentials", "e4a")));
    await assertFails(deleteDoc(doc(db, "subjects", "so", "areas", "admin-omr")));
  });
});

// #682 H3 (§3.4): en admin som stängs av eller nedgraderas tappar rätten
// direkt – reglerna läser teacherAccounts/{uid} (adminAccountOk), inte bara
// token. Saknat dokument = claims avgör (övergången, admin före migreringen).
describe("H3: avstängd eller nedgraderad admin med giltig token", () => {
  // Funktioner (inte promises) – annars nekas de innan assertFails hunnit vänta.
  const adminSkriv = (db) => [
    () => setDoc(doc(db, "students", "ny"), { namn: "x", classIds: ["5a"] }),
    () => updateDoc(doc(db, "studentData", "e5a"), { coins: 99999 }),
    () => getDoc(doc(db, "studentCredentials", "e5a")),
    () => setDoc(doc(db, "subjects", "nytt"), { name: "Nytt" }),
  ];
  it("aktivt admindokument: allt som förut", async () => {
    for (const f of adminSkriv(env.admin())) await assertSucceeds(f());
  });
  it("avstängd (active:false) – samma token nekas direkt", async () => {
    await env.seed((db) => updateDoc(doc(db, "teacherAccounts", "admin1"), { active: false }));
    for (const f of adminSkriv(env.admin())) await assertFails(f());
  });
  it("nedgraderad till årskurskonto i dokumentet – admin-claim ger ingen adminrätt", async () => {
    await env.seed((db) => updateDoc(doc(db, "teacherAccounts", "admin1"), { role: "arskurs", classIds: ["5a"] }));
    for (const f of adminSkriv(env.admin())) await assertFails(f());
    // Inte heller årskursrätt förrän ny token (claims säger fortfarande admin).
    await assertFails(getDoc(doc(env.admin(), "studentData", "e5a")));
  });
  it("lärare utan roll och utan dokument (övergången) fungerar som förut", async () => {
    for (const f of adminSkriv(env.gammal())) await assertSucceeds(f());
  });
  it("lärare utan roll vars dokument stängts av eller fått rollen arskurs nekas", async () => {
    await env.seed((db) => setDoc(doc(db, "teacherAccounts", "gammal"),
      { username: "gammal", displayName: "gammal", role: "admin", classIds: [], active: false }));
    for (const f of adminSkriv(env.gammal())) await assertFails(f());
    await env.seed((db) => setDoc(doc(db, "teacherAccounts", "gammal"),
      { username: "gammal", displayName: "gammal", role: "admin", classIds: [], active: true }));
    for (const f of adminSkriv(env.gammal())) await assertSucceeds(f());
  });
});
