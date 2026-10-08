// ============================================================================
// E2E: Cloud Functionen updateStudentLogin mot Functions- + Auth- + Firestore-
// EMULATORERNA.
// ----------------------------------------------------------------------------
// Klienten anropar funktionen exakt som lärarsidan (httpsCallable, europe-west1)
// och vi verifierar resultatet med Admin SDK + en riktig elevinloggning:
//   * bara lärare (elev/utloggad nekas)
//   * byte av användarnamn: Auth-e-post, students, ALLA klassprojektioner,
//     studentCredentials; gamla namnet loggar inte längre in, nya gör det
//   * byte av lösenord sparas i studentCredentials
//   * upptaget namn / kort lösenord / lärarkonto som mål → tydliga fel
//   * Auth-fel efter Firestore-skrivningen → Firestore återställs (kärnan
//     direkt med en felande auth)
//
// Körs via:  npm run test:functions
// (kräver `npm --prefix functions install` en gång; firebase emulators:exec
// startar functions+auth+firestore, kör detta, river dem.)
// ============================================================================

import assert from "node:assert/strict";
import { test, after } from "node:test";
import admin from "firebase-admin";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, connectAuthEmulator } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { updateStudentLogin as coreUpdate, usernameToEmail } from "../functions/login-core.js";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
process.env.FIRESTORE_EMULATOR_HOST = FS_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

const adminApp = admin.initializeApp({ projectId: PROJECT_ID }, "fn-test-admin");
const adminAuth = admin.auth(adminApp);
const adminDb = admin.firestore(adminApp);

const clientApp = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT_ID }, "fn-test-client");
const clientAuth = getAuth(clientApp);
connectAuthEmulator(clientAuth, `http://${AUTH_HOST}`, { disableWarnings: true });
const fns = getFunctions(clientApp, "europe-west1");
connectFunctionsEmulator(fns, FN_HOST.split(":")[0], Number(FN_HOST.split(":")[1]));
const call = (data) => httpsCallable(fns, "updateStudentLogin")(data).then((r) => r.data);

const TEACHER_EMAIL = "teacher26@larare.pluggportalen.local";
const PW = "hejsan6";
const teacherLogin = () => signInWithEmailAndPassword(clientAuth, TEACHER_EMAIL, "larare123");
const errCode = (e) => String(e?.code || "").replace(/^functions\//, "");

after(async () => {
  await signOut(clientAuth).catch(() => {});
  await deleteApp(clientApp).catch(() => {});
  await adminApp.delete().catch(() => {});
});

test("seed: lärare, elever i två klasser med projektioner", async () => {
  const t = await adminAuth.createUser({ email: TEACHER_EMAIL, password: "larare123" });
  await adminAuth.setCustomUserClaims(t.uid, { teacher: true });
  for (const [uid, u] of [["omar", "omar861"], ["lisa", "lisa4b"], ["ann", "ann4b"]]) {
    await adminAuth.createUser({ uid, email: usernameToEmail(u), password: PW });
    await adminDb.doc(`students/${uid}`).set({ namn: uid, username: u, avatarId: "fox" });
  }
  await adminDb.doc("classes/4b").set({ name: "4B", studentIds: ["omar", "lisa", "ann"] });
  await adminDb.doc("classes/mattegrupp").set({ name: "Mattegrupp", studentIds: ["omar"] });
  // Projektionen för 4b har omars post; mattegruppens saknar den (ska INTE skapas).
  await adminDb.doc("classProjections/4b").set({
    members: { omar: { namn: "omar", username: "omar861" }, lisa: { namn: "lisa", username: "lisa4b" } },
  });
  await adminDb.doc("classProjections/mattegrupp").set({ members: {} });
});

test("elev och utloggad nekas (permission-denied / unauthenticated)", async () => {
  await assert.rejects(call({ uid: "lisa", password: "hacker1" }), (e) => errCode(e) === "permission-denied");
  await signInWithEmailAndPassword(clientAuth, usernameToEmail("lisa4b"), PW);
  await assert.rejects(call({ uid: "omar", password: "hacker1" }), (e) => errCode(e) === "permission-denied");
  await signOut(clientAuth);
});

test("läraren byter användarnamn + lösenord (Omar 4B: omar861 → omar851)", async () => {
  await teacherLogin();
  const res = await call({ uid: "omar", username: " Omar851 ", password: "tiger555" });
  assert.deepEqual(res, { uid: "omar", username: "omar851", usernameChanged: true, passwordChanged: true });

  const user = await adminAuth.getUser("omar");
  assert.equal(user.email, "omar851@elev.pluggportalen.local");
  assert.equal((await adminDb.doc("students/omar").get()).get("username"), "omar851");
  const proj = (await adminDb.doc("classProjections/4b").get()).data();
  assert.equal(proj.members.omar.username, "omar851");
  assert.equal(proj.members.omar.namn, "omar", "övriga fält i posten orörda");
  assert.equal(proj.members.lisa.username, "lisa4b");
  const mg = (await adminDb.doc("classProjections/mattegrupp").get()).data();
  assert.deepEqual(mg.members, {}, "ingen halv post skapas där eleven saknar post");
  const cred = (await adminDb.doc("studentCredentials/omar").get()).data();
  assert.equal(cred.username, "omar851");
  assert.equal(cred.password, "tiger555");
  assert.ok(cred.updatedAt, "updatedAt satt");
  await signOut(clientAuth);

  await assert.rejects(signInWithEmailAndPassword(clientAuth, usernameToEmail("omar861"), "tiger555"));
  const cred2 = await signInWithEmailAndPassword(clientAuth, usernameToEmail("omar851"), "tiger555");
  assert.equal(cred2.user.uid, "omar");
  await signOut(clientAuth);
});

test("bara lösenord: användarnamnet orört, sparat lösenord uppdateras", async () => {
  await teacherLogin();
  const res = await call({ uid: "lisa", password: "panda777" });
  assert.equal(res.usernameChanged, false);
  assert.equal(res.passwordChanged, true);
  const cred = (await adminDb.doc("studentCredentials/lisa").get()).data();
  assert.deepEqual([cred.username, cred.password], ["lisa4b", "panda777"]);
  // Bara användarnamn efteråt: det sparade lösenordet ligger kvar.
  await call({ uid: "lisa", username: "lisa4b2" });
  const cred2 = (await adminDb.doc("studentCredentials/lisa").get()).data();
  assert.deepEqual([cred2.username, cred2.password], ["lisa4b2", "panda777"]);
  await signOut(clientAuth);
});

test("tydliga fel: upptaget namn, kort lösenord, okänd elev, lärarkonto, inget att ändra", async () => {
  await teacherLogin();
  await assert.rejects(call({ uid: "ann", username: "omar851" }), (e) =>
    errCode(e) === "already-exists" && /redan taget/.test(e.message)
  );
  await assert.rejects(call({ uid: "ann", password: "kort" }), (e) => errCode(e) === "invalid-argument");
  await assert.rejects(call({ uid: "finnsinte", password: "langtlosen" }), (e) => errCode(e) === "not-found");
  const t = await adminAuth.getUserByEmail(TEACHER_EMAIL);
  await adminDb.doc(`students/${t.uid}`).set({ namn: "lärare", username: "teacher26" });
  await assert.rejects(call({ uid: t.uid, password: "larare999" }), (e) => errCode(e) === "permission-denied");
  await assert.rejects(call({ uid: "ann", username: "ann4b" }), (e) => errCode(e) === "invalid-argument");
  // Inget ändrades för ann.
  assert.equal((await adminAuth.getUser("ann")).email, usernameToEmail("ann4b"));
  assert.equal((await adminDb.doc("studentCredentials/ann").get()).exists, false);
  await signOut(clientAuth);
});

test("Auth-fel efter Firestore-skrivningen → Firestore återställs (allt eller inget)", async () => {
  // Endast det sista steget (auth.updateUser) fallerar.
  const failingAuth = {
    getUser: (uid) => adminAuth.getUser(uid),
    getUserByEmail: (e) => adminAuth.getUserByEmail(e),
    updateUser: async () => {
      throw Object.assign(new Error("boom"), { code: "auth/internal-error" });
    },
  };
  const deps = {
    auth: failingAuth,
    db: adminDb,
    FieldPath: admin.firestore.FieldPath,
    serverTimestamp: () => admin.firestore.FieldValue.serverTimestamp(),
  };
  // omar har ett sparat lösenord sedan tidigare; ann har inget dokument.
  await assert.rejects(coreUpdate(deps, { uid: "omar", username: "omar999", password: "ny12345" }), (e) =>
    e.code === "internal"
  );
  assert.equal((await adminDb.doc("students/omar").get()).get("username"), "omar851");
  assert.equal((await adminDb.doc("classProjections/4b").get()).get("members.omar.username"), "omar851");
  const cred = (await adminDb.doc("studentCredentials/omar").get()).data();
  assert.deepEqual([cred.username, cred.password], ["omar851", "tiger555"]);

  await assert.rejects(coreUpdate(deps, { uid: "ann", password: "ny12345" }));
  assert.equal((await adminDb.doc("studentCredentials/ann").get()).exists, false, "nyskapat dokument tas bort");
  assert.equal((await adminAuth.getUser("omar")).email, usernameToEmail("omar851"));
});
