// ============================================================================
// Regel-tester: teacherAccounts/{uid} (#677, spec §1.2 och §7 test 19).
// ----------------------------------------------------------------------------
// Bara admin (claims teacher + admin) läser och skriver samlingen. Ett konto
// läser sitt EGET dokument (årskurskontot behöver sina classIds). Årskurskonto,
// elev och utloggad nekas allt annat. Resten av rollreglerna kommer i del B.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";

let testEnv, unauth, elev;
const as = (uid, claims) => testEnv.authenticatedContext(uid, claims).firestore();
const adminDb = () => as("admin1", { teacher: true, admin: true });
const ak4 = () => as("ak4", { teacher: true, role: "arskurs" });

before(async () => {
  ({ testEnv, unauth, elev } = await createRulesEnv("pluggportalen-rules-test-teacher-accounts"));
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "teacherAccounts/admin1"), { username: "teacher26", displayName: "Elias", role: "admin", classIds: [], active: true });
    await setDoc(doc(db, "teacherAccounts/ak4"), { username: "arskurs4", displayName: "Årskurs 4", role: "arskurs", classIds: ["4a", "4b"], active: true });
    await setDoc(doc(db, "teacherAccounts/ak5"), { username: "arskurs5", displayName: "Årskurs 5", role: "arskurs", classIds: ["5a"], active: true });
  });
});

describe("teacherAccounts – admin", () => {
  it("admin läser listan och enskilda konton", async () => {
    await assertSucceeds(getDocs(collection(adminDb(), "teacherAccounts")));
    await assertSucceeds(getDoc(doc(adminDb(), "teacherAccounts/ak4")));
  });
  it("admin skriver", async () => {
    await assertSucceeds(updateDoc(doc(adminDb(), "teacherAccounts/ak4"), { classIds: ["4a"] }));
    await assertSucceeds(setDoc(doc(adminDb(), "teacherAccounts/ny"), { role: "arskurs", classIds: [] }));
    await assertSucceeds(deleteDoc(doc(adminDb(), "teacherAccounts/ny")));
  });
});

describe("teacherAccounts – test 19: årskurskonto", () => {
  it("läser sitt EGET dokument", async () => {
    await assertSucceeds(getDoc(doc(ak4(), "teacherAccounts/ak4")));
  });
  it("läser inte andras dokument eller listan", async () => {
    await assertFails(getDoc(doc(ak4(), "teacherAccounts/ak5")));
    await assertFails(getDoc(doc(ak4(), "teacherAccounts/admin1")));
    await assertFails(getDocs(collection(ak4(), "teacherAccounts")));
  });
  it("ändrar inte sitt eget eller andras dokument, skapar inte och raderar inte", async () => {
    await assertFails(updateDoc(doc(ak4(), "teacherAccounts/ak4"), { classIds: ["4a", "4b", "5a"] }));
    await assertFails(updateDoc(doc(ak4(), "teacherAccounts/ak4"), { role: "admin" }));
    await assertFails(updateDoc(doc(ak4(), "teacherAccounts/ak5"), { active: false }));
    await assertFails(setDoc(doc(ak4(), "teacherAccounts/ny"), { role: "admin" }));
    await assertFails(deleteDoc(doc(ak4(), "teacherAccounts/ak5")));
  });
  it("ett påhittat admin-claim utan teacher räcker inte", async () => {
    await assertFails(getDocs(collection(as("x", { admin: true }), "teacherAccounts")));
  });
});

describe("teacherAccounts – elev och utloggad", () => {
  it("nekas allt (utom ett eget dokument, som elever inte har)", async () => {
    await assertFails(getDoc(doc(elev("elev1"), "teacherAccounts/ak4")));
    await assertFails(getDocs(collection(elev("elev1"), "teacherAccounts")));
    await assertFails(setDoc(doc(elev("elev1"), "teacherAccounts/elev1"), { role: "admin" }));
    await assertFails(getDoc(doc(unauth(), "teacherAccounts/ak4")));
  });
});
