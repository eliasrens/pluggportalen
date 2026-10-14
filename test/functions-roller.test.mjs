// ============================================================================
// E2E: rollkontrollerna i Cloud Functions (#678, spec §4.2, §7 test 13).
// ----------------------------------------------------------------------------
// Mot Functions- + Auth- + Firestore-EMULATORERNA, som lärarsidan anropar:
//   * updateStudentLogin – Årskurs 4 (4a, 4b) byter LÖSENORD för en elev i
//     4A; en elev i 5A nekas, byte av användarnamn nekas, avstängt konto och
//     konto utan dokument nekas. Admin och ett konto utan roll (övergången)
//     gör allt som förut.
//   * hittaRattSparaPack (egna kartor) – bara admin.
//   * admin-funktionerna (adminCreateTeacher …) – bara admin (test 19).
//   * claimRole – samma tolkning av claims som firestore.rules.
// Egna uid:n/klasser (r678-*) – filerna i test:functions delar emulator.
//
// Körs via:  npm run test:functions
// ============================================================================

import assert from "node:assert/strict";
import { test, after } from "node:test";
import admin from "firebase-admin";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, connectAuthEmulator } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { usernameToEmail } from "../functions/login-core.js";
import { claimRole } from "../functions/teacher-role.js";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
process.env.FIRESTORE_EMULATOR_HOST = FS_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

const adminApp = admin.initializeApp({ projectId: PROJECT_ID }, "fn-roller-admin");
const adminAuth = admin.auth(adminApp);
const adminDb = admin.firestore(adminApp);

const clientApp = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT_ID }, "fn-roller-client");
const clientAuth = getAuth(clientApp);
connectAuthEmulator(clientAuth, `http://${AUTH_HOST}`, { disableWarnings: true });
const fns = getFunctions(clientApp, "europe-west1");
connectFunctionsEmulator(fns, FN_HOST.split(":")[0], Number(FN_HOST.split(":")[1]));
const fn = (name) => (data) => httpsCallable(fns, name)(data).then((r) => r.data);
const updateLogin = fn("updateStudentLogin");
const errCode = (e) => String(e?.code || "").replace(/^functions\//, "");
const nekas = (p) => assert.rejects(p, (e) => errCode(e) === "permission-denied");

const PW = "hejsan6";
const LARARE = {
  r678admin: { teacher: true, admin: true },
  r678ak4: { teacher: true, role: "arskurs" },
  r678av: { teacher: true, role: "arskurs" },
  r678utan: { teacher: true, role: "arskurs" },
  r678gammal: { teacher: true },
  r678avadmin: { teacher: true, admin: true },
  r678nedgr: { teacher: true, admin: true },
};
const larEmail = (uid) => `${uid}@larare.pluggportalen.local`;
async function loggaIn(uid) {
  await signOut(clientAuth).catch(() => {});
  await signInWithEmailAndPassword(clientAuth, larEmail(uid), "larare123");
}

after(async () => {
  for (const uid of Object.keys(LARARE)) await adminDb.doc(`teacherAccounts/${uid}`).delete().catch(() => {});
  await signOut(clientAuth).catch(() => {});
  await deleteApp(clientApp).catch(() => {});
  await adminApp.delete().catch(() => {});
});

test("claimRole: samma tolkning som reglerna (övergången inräknad)", () => {
  assert.equal(claimRole({ teacher: true, admin: true }), "admin");
  assert.equal(claimRole({ teacher: true, role: "arskurs" }), "arskurs");
  assert.equal(claimRole({ teacher: true }), "admin", "övergången: teacher utan role/admin = admin");
  assert.equal(claimRole({ teacher: true, admin: false }), null);
  assert.equal(claimRole({ teacher: true, role: "okand" }), null);
  assert.equal(claimRole({ admin: true }), null);
  assert.equal(claimRole(undefined), null);
});

test("seed: lärarkonton, elever i 4A och 5A", async () => {
  for (const [uid, claims] of Object.entries(LARARE)) {
    await adminAuth.createUser({ uid, email: larEmail(uid), password: "larare123" });
    await adminAuth.setCustomUserClaims(uid, claims);
  }
  const konto = (uid, role, classIds, active = true) =>
    adminDb.doc(`teacherAccounts/${uid}`).set({ username: uid, displayName: uid, role, classIds, active });
  // Admin avgörs av claims – inget admin-dokument här: functions-teacher-
  // accounts räknar aktiva admin-dokument i samma emulator (sista admin).
  await konto("r678ak4", "arskurs", ["r678-4a", "r678-4b"]);
  await konto("r678av", "arskurs", ["r678-4a"], false);
  // #682 H3: admin-claims kvar i token, men kontot är avstängt / nedgraderat.
  // (Inget AKTIVT admin-dokument – sista-admin-testet räknar bara aktiva.)
  await konto("r678avadmin", "admin", [], false);
  await konto("r678nedgr", "arskurs", ["r678-4a"]);
  for (const [uid, classId] of [["r678e4a", "r678-4a"], ["r678e5a", "r678-5a"]]) {
    await adminAuth.createUser({ uid, email: usernameToEmail(uid), password: PW });
    await adminDb.doc(`students/${uid}`).set({ namn: uid, username: uid, classIds: [classId] });
    await adminDb.doc(`classes/${classId}`).set({ name: classId, studentIds: [uid] });
  }
});

test("Test 13: Årskurs 4 byter lösenord för en elev i 4A", async () => {
  await loggaIn("r678ak4");
  const res = await updateLogin({ uid: "r678e4a", password: "tiger555" });
  assert.deepEqual([res.passwordChanged, res.usernameChanged], [true, false]);
  assert.equal((await adminDb.doc("studentCredentials/r678e4a").get()).get("password"), "tiger555");
  // Samma användarnamn som förut + nytt lösenord = bara lösenord (godtas).
  await updateLogin({ uid: "r678e4a", username: "r678e4a", password: "tiger556" });
  await signOut(clientAuth);
  const inl = await signInWithEmailAndPassword(clientAuth, usernameToEmail("r678e4a"), "tiger556");
  assert.equal(inl.user.uid, "r678e4a");
  await signOut(clientAuth);
});

test("Test 13: Årskurs 4 – elev i 5A och byte av användarnamn nekas", async () => {
  await loggaIn("r678ak4");
  await nekas(updateLogin({ uid: "r678e5a", password: "tiger555" }));
  await nekas(updateLogin({ uid: "r678e4a", username: "nyttnamn" }));
  await nekas(updateLogin({ uid: "r678e4a", username: "nyttnamn", password: "tiger777" }));
  assert.equal((await adminAuth.getUser("r678e4a")).email, usernameToEmail("r678e4a"), "inget ändrades");
  assert.equal((await adminDb.doc("studentCredentials/r678e5a").get()).exists, false);
  await signOut(clientAuth);
});

test("avstängt årskurskonto och konto utan dokument nekas", async () => {
  for (const uid of ["r678av", "r678utan"]) {
    await loggaIn(uid);
    await nekas(updateLogin({ uid: "r678e4a", password: "tiger555" }));
  }
  await signOut(clientAuth);
});

test("admin och lärare utan roll (övergången) gör allt som förut", async () => {
  await loggaIn("r678admin");
  await updateLogin({ uid: "r678e5a", username: "r678e5a-ny", password: "panda777" });
  await loggaIn("r678gammal");
  await updateLogin({ uid: "r678e5a", username: "r678e5a", password: "panda778" });
  assert.equal((await adminAuth.getUser("r678e5a")).email, usernameToEmail("r678e5a"));
  await signOut(clientAuth);
});

test("egna Hitta rätt!-kartor och admin-funktionerna: bara admin (test 19)", async () => {
  await loggaIn("r678ak4");
  await nekas(fn("hittaRattSparaPack")({ pack: { namn: "Min karta" } }));
  await nekas(fn("hittaRattRaderaPack")({ packId: "e-abcdefabcdef" }));
  await nekas(fn("hittaRattSattTopplista")({ packId: "e-abcdefabcdef", pa: true }));
  await nekas(fn("adminCreateTeacher")({ username: "r678ny", displayName: "Ny", password: "hemlig1", role: "arskurs", classIds: [] }));
  await nekas(fn("adminUpdateTeacher")({ uid: "r678ak4", classIds: ["r678-4a", "r678-4b", "r678-5a"] }));
  await nekas(fn("adminSetTeacherActive")({ uid: "r678admin", active: false }));
  assert.deepEqual((await adminDb.doc("teacherAccounts/r678ak4").get()).get("classIds"), ["r678-4a", "r678-4b"]);
  await signOut(clientAuth);
});

test("H3 (#682): avstängd eller nedgraderad admin med giltig token nekas direkt", async () => {
  for (const uid of ["r678avadmin", "r678nedgr"]) {
    await loggaIn(uid);
    await nekas(updateLogin({ uid: "r678e4a", password: "tiger999" }));
    await nekas(fn("hittaRattSparaPack")({ pack: { namn: "Min karta" } }));
  }
  assert.notEqual((await adminDb.doc("studentCredentials/r678e4a").get()).get("password"), "tiger999");
  await signOut(clientAuth);
});
