// ============================================================================
// Lärarkonton (#677): migreringsskriptet admin/migrate-teacher-admins.mjs mot
// Auth- + Firestore- (+ Functions-) EMULATORERNA. Spec §6.1 och §7 test 24.
// ----------------------------------------------------------------------------
//   * torrkörning är standard: listan skrivs ut, inget ändras
//   * --apply: alla med teacher:true (utom årskurskonton) får admin:true och
//     ett teacherAccounts-dokument; verifieringslistan skrivs ut
//   * idempotent: andra körningen säger "redan admin"
//   * de migrerade lärarna kan göra allt som förut (updateStudentLogin) och
//     dessutom admin-functions (adminCreateTeacher)
// uid tm-* krockar inte med andra sviter (de andra svitens lärare finns också
// i emulatorn och migreras – vi tittar bara på tm-raderna). Körs av
// `npm run test:functions`.
// ============================================================================

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, connectAuthEmulator } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { teacherEmail } from "../functions/teacher-accounts-core.js";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
process.env.FIRESTORE_EMULATOR_HOST = FS_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

const adminApp = admin.initializeApp({ projectId: PROJECT_ID }, "tm-test-admin");
const adminAuth = admin.auth(adminApp);
const adminDb = admin.firestore(adminApp);

const clientApp = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT_ID }, "tm-test-client");
const clientAuth = getAuth(clientApp);
connectAuthEmulator(clientAuth, `http://${AUTH_HOST}`, { disableWarnings: true });
const fns = getFunctions(clientApp, "europe-west1");
connectFunctionsEmulator(fns, FN_HOST.split(":")[0], Number(FN_HOST.split(":")[1]));
const call = (fn, data) => httpsCallable(fns, fn)(data).then((r) => r.data);

const SCRIPT = fileURLToPath(new URL("../admin/migrate-teacher-admins.mjs", import.meta.url));
const run = async (...args) => {
  const { stdout } = await promisify(execFile)(process.execPath, [SCRIPT, ...args], {
    env: { ...process.env, FIRESTORE_EMULATOR_HOST: FS_HOST, FIREBASE_AUTH_EMULATOR_HOST: AUTH_HOST },
  });
  return stdout;
};
const row = (out, username) => out.split("\n").find((l) => new RegExp(`\\s${username}\\s`).test(l)) || "";
const PW = "larare123";

after(async () => {
  await signOut(clientAuth).catch(() => {});
  await deleteApp(clientApp).catch(() => {});
  await adminApp.delete().catch(() => {});
});

test("seed: två gamla lärarkonton, ett årskurskonto, en elev", async () => {
  await adminAuth.createUser({ uid: "tm-anna", email: teacherEmail("tm-anna"), password: PW, displayName: "Anna" });
  await adminAuth.setCustomUserClaims("tm-anna", { teacher: true });
  await adminAuth.createUser({ uid: "tm-bo", email: teacherEmail("tm-bo"), password: PW, disabled: true });
  await adminAuth.setCustomUserClaims("tm-bo", { teacher: true });
  await adminAuth.createUser({ uid: "tm-ak6", email: teacherEmail("tm-ak6"), password: PW });
  await adminAuth.setCustomUserClaims("tm-ak6", { teacher: true, role: "arskurs" });
  await adminDb.doc("teacherAccounts/tm-ak6").set({ username: "tm-ak6", displayName: "Årskurs 6", role: "arskurs", classIds: ["tm6a"], active: true });
  await adminAuth.createUser({ uid: "tm-elev", email: "tm-elev@elev.pluggportalen.local", password: PW });
  await adminDb.doc("students/tm-elev").set({ namn: "Tm", username: "tm-elev" });
});

test("test 24: torrkörning (standard) skriver ut listan men ändrar inget", async () => {
  const out = await run();
  assert.match(out, /TORRKÖRNING/);
  assert.match(row(out, "tm-anna"), /blir admin.*Anna/);
  assert.match(row(out, "tm-bo"), /blir admin.*avstängt/);
  assert.match(row(out, "tm-ak6"), /hoppas över \(årskurskonto\)/);
  assert.equal(row(out, "tm-elev"), "", "elever listas inte");
  assert.deepEqual((await adminAuth.getUser("tm-anna")).customClaims, { teacher: true });
  assert.equal((await adminDb.doc("teacherAccounts/tm-anna").get()).exists, false);
});

test("test 24: --apply gör alla gamla lärare till admin och verifierar", async () => {
  const out = await run("--apply");
  assert.match(out, /SKRIVER/);
  assert.match(out, /✓ admin:true\s+tm-anna /);
  assert.match(out, /✓ admin:true\s+tm-bo /);
  assert.match(out, /✓ Klart/);
  assert.deepEqual((await adminAuth.getUser("tm-anna")).customClaims, { teacher: true, admin: true });
  const anna = (await adminDb.doc("teacherAccounts/tm-anna").get()).data();
  assert.equal(anna.username, "tm-anna");
  assert.equal(anna.displayName, "Anna");
  assert.equal(anna.role, "admin");
  assert.equal(anna.active, true);
  assert.deepEqual(anna.classIds, []);
  assert.equal(anna.createdBy, "migrering");
  assert.equal((await adminDb.doc("teacherAccounts/tm-bo").get()).get("active"), false, "avstängt konto förblir avstängt");
  // Årskurskontot är orört.
  assert.deepEqual((await adminAuth.getUser("tm-ak6")).customClaims, { teacher: true, role: "arskurs" });
  assert.equal((await adminDb.doc("teacherAccounts/tm-ak6").get()).get("role"), "arskurs");
  assert.equal((await adminAuth.getUser("tm-elev")).customClaims, undefined, "eleven orörd");
});

test("test 24: andra körningen ändrar inget (idempotent)", async () => {
  const before = (await adminDb.doc("teacherAccounts/tm-anna").get()).get("updatedAt");
  const out = await run("--apply");
  assert.match(row(out, "tm-anna"), /redan admin/);
  assert.match(row(out, "tm-bo"), /redan admin/);
  assert.ok((await adminDb.doc("teacherAccounts/tm-anna").get()).get("updatedAt").isEqual(before));
});

test("test 24: en migrerad lärare kan allt som förut – och admin-functions", async () => {
  await signInWithEmailAndPassword(clientAuth, teacherEmail("tm-anna"), PW);
  const tok = await clientAuth.currentUser.getIdTokenResult(true);
  assert.deepEqual([tok.claims.teacher, tok.claims.admin], [true, true]);
  const res = await call("updateStudentLogin", { uid: "tm-elev", password: "nytt-losen1" });
  assert.equal(res.passwordChanged, true);
  const ny = await call("adminCreateTeacher", { username: "tm-ak7", displayName: "Årskurs 7", password: PW, role: "arskurs", classIds: [] });
  assert.equal((await adminDb.doc(`teacherAccounts/${ny.uid}`).get()).get("createdBy"), "tm-anna");
});
