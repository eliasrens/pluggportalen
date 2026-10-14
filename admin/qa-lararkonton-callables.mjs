// ============================================================================
// QA #682: varje callable anropad med en annan roll (spec §4.2, §3.4).
// ----------------------------------------------------------------------------
// Mot Functions- + Auth- + Firestore-EMULATORERNA. Rollerna: elev, Årskurs 4,
// lärare utan roll (övergången), Årskurs 4 med en GAMMAL token efter att 4B
// tagits bort och efter att kontot stängts av, och en admin med en gammal
// token efter att hen nedgraderats eller stängts av (via de riktiga
// admin-funktionerna). "OKLART" = godtas i dag, se docs/QA-RAPPORT-lararkonton.md.
//
//   firebase emulators:exec --only functions,auth,firestore --project pluggportalen-so-2026 \
//     "FUNCTIONS_EMULATOR_HOST=127.0.0.1:<port> node --test admin/qa-lararkonton-callables.mjs"
// Kör i en FÄRSK emulator (skapar egna q682-konton och ett admin-dokument).
// ============================================================================

import assert from "node:assert/strict";
import { test, after } from "node:test";
import admin from "firebase-admin";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, connectAuthEmulator } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { usernameToEmail } from "../functions/login-core.js";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
const adminApp = admin.initializeApp({ projectId: PROJECT_ID }, "qa682-admin");
const adminAuth = admin.auth(adminApp);
const adminDb = admin.firestore(adminApp);

const larEmail = (uid) => `${uid}@larare.pluggportalen.local`;
const apps = [];
/** En egen klient per användare – token ligger kvar i minnet (som en öppen flik). */
async function klient(email, password) {
  const app = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT_ID }, `qa682-${apps.length}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
  await signInWithEmailAndPassword(auth, email, password);
  const fns = getFunctions(app, "europe-west1");
  const [h, p] = FN_HOST.split(":");
  connectFunctionsEmulator(fns, h, Number(p));
  return (name, data = {}) => httpsCallable(fns, name)(data).then((r) => r.data);
}
const code = (e) => String(e?.code || "").replace(/^functions\//, "");
const nekas = (p, koder = ["permission-denied"]) =>
  assert.rejects(p, (e) => koder.includes(code(e)) || assert.fail(`fel kod: ${code(e)} ${e.message}`));

const LARARFN = ["hittaRattSparaPack", "hittaRattRaderaPack", "hittaRattSattTopplista"];
const ADMINFN = {
  adminCreateTeacher: { username: "q682ny", displayName: "Ny", password: "hemlig1", role: "admin" },
  adminUpdateTeacher: { uid: "q682ak4", role: "admin" },
  adminSetTeacherPassword: { uid: "q682boss", password: "kapat123" },
  adminSetTeacherActive: { uid: "q682boss", active: false },
  adminDeleteTeacher: { uid: "q682boss" },
};
const ELEVFN = ["guldrushAnswer", "guldrushOpenChest", "guldrushChooseVictim", "datakuppAnswer",
  "datakuppOpenFile", "datakuppChooseTarget", "datakuppGuessCode", "datakuppPickCode", "hittaRattSubmit"];

after(async () => {
  for (const a of apps) await deleteApp(a).catch(() => {});
  await adminApp.delete().catch(() => {});
});

test("seed: admin (med dokument), Årskurs 4, övergång, elever i 4A/4B/5A", async () => {
  const larare = {
    q682boss: { teacher: true, admin: true }, q682adm2: { teacher: true, admin: true },
    q682adm3: { teacher: true, admin: true }, q682ak4: { teacher: true, role: "arskurs" },
    q682gammal: { teacher: true },
  };
  for (const [uid, claims] of Object.entries(larare)) {
    await adminAuth.createUser({ uid, email: larEmail(uid), password: "larare123" });
    await adminAuth.setCustomUserClaims(uid, claims);
    const role = claims.admin ? "admin" : claims.role;
    if (role) await adminDb.doc(`teacherAccounts/${uid}`).set({
      username: uid, displayName: uid, role, active: true, classIds: role === "arskurs" ? ["q682-4a", "q682-4b"] : [],
    });
  }
  for (const [uid, classId] of [["q682e4a", "q682-4a"], ["q682e4b", "q682-4b"], ["q682e5a", "q682-5a"]]) {
    await adminAuth.createUser({ uid, email: usernameToEmail(uid), password: "elev123" });
    await adminDb.doc(`students/${uid}`).set({ namn: uid, username: uid, classIds: [classId] });
    await adminDb.doc(`classes/${classId}`).set({ name: classId, studentIds: [uid] });
  }
});

test("elev: alla lärar- och adminfunktioner nekas", async () => {
  const call = await klient(usernameToEmail("q682e4a"), "elev123");
  await nekas(call("updateStudentLogin", { uid: "q682e4a", password: "nytt123" }));
  for (const n of LARARFN) await nekas(call(n, { packId: "e-abcdefabcdef" }));
  for (const [n, d] of Object.entries(ADMINFN)) await nekas(call(n, d));
});

test("Årskurs 4: admin- och kartfunktioner nekas; lösenord bara i egna klasser; elevfunktioner ger inget", async () => {
  const call = await klient(larEmail("q682ak4"), "larare123");
  for (const n of LARARFN) await nekas(call(n, { packId: "e-abcdefabcdef" }));
  for (const [n, d] of Object.entries(ADMINFN)) await nekas(call(n, d));
  await nekas(call("updateStudentLogin", { uid: "q682e5a", password: "nytt123" }));
  await nekas(call("updateStudentLogin", { uid: "q682e4a", username: "kapad" }));
  await nekas(call("updateStudentLogin", { uid: "q682boss", password: "kapat123" }), ["permission-denied", "not-found"]);
  assert.equal((await call("updateStudentLogin", { uid: "q682e4a", password: "nytt123" })).passwordChanged, true);
  // Elevfunktionerna: läraren är ingen spelare – inget skrivs.
  for (const n of ELEVFN) {
    await assert.rejects(call(n, { sid: "finnsinte", attemptId: "abcdefgh1234", packId: "sverige" }));
  }
  assert.equal((await adminDb.doc("teacherAccounts/q682boss").get()).get("active"), true);
});

test("övergången (teacher utan roll): som admin i updateStudentLogin, men inte i admin-funktionerna", async () => {
  const call = await klient(larEmail("q682gammal"), "larare123");
  assert.equal((await call("updateStudentLogin", { uid: "q682e5a", password: "nytt124" })).passwordChanged, true);
  for (const [n, d] of Object.entries(ADMINFN)) await nekas(call(n, d));
});

test("gammal token: Årskurs 4 efter att 4B tagits bort, och efter avstängning", async () => {
  const ak4 = await klient(larEmail("q682ak4"), "larare123");
  const boss = await klient(larEmail("q682boss"), "larare123");
  await boss("adminUpdateTeacher", { uid: "q682ak4", classIds: ["q682-4a"] });
  await nekas(ak4("updateStudentLogin", { uid: "q682e4b", password: "nytt125" }));
  assert.equal((await ak4("updateStudentLogin", { uid: "q682e4a", password: "nytt126" })).passwordChanged, true);
  await boss("adminSetTeacherActive", { uid: "q682ak4", active: false });
  await nekas(ak4("updateStudentLogin", { uid: "q682e4a", password: "nytt127" }));
  await assert.rejects(signInWithEmailAndPassword(getAuth(apps[0]), larEmail("q682ak4"), "larare123"));
});

test("gammal admin-token efter nedgradering: admin-funktionerna nekas (färska claims)", async () => {
  const adm2 = await klient(larEmail("q682adm2"), "larare123");
  const boss = await klient(larEmail("q682boss"), "larare123");
  await boss("adminUpdateTeacher", { uid: "q682adm2", role: "arskurs", classIds: ["q682-4a"] });
  for (const [n, d] of Object.entries(ADMINFN)) await nekas(adm2(n, d), ["permission-denied", "failed-precondition"]);
  assert.equal((await adminAuth.getUser("q682boss")).disabled, false);
});

test("OKLART: gammal admin-token efter nedgradering/avstängning – updateStudentLogin godtas (≤ 1 h)", async () => {
  const adm2 = await klient(larEmail("q682adm2"), "larare123"); // ny inloggning = arskurs-token…
  await nekas(adm2("updateStudentLogin", { uid: "q682e5a", username: "kapad5a" }));
  // …men en token från FÖRE avstängningen:
  const adm3 = await klient(larEmail("q682adm3"), "larare123");
  const boss = await klient(larEmail("q682boss"), "larare123");
  await boss("adminSetTeacherActive", { uid: "q682adm3", active: false });
  const res = await adm3("updateStudentLogin", { uid: "q682e5a", username: "q682e5a-kapad", password: "kapat99" });
  assert.equal(res.usernameChanged, true, "avstängd admin byter fortfarande en elevs användarnamn");
  for (const [n, d] of Object.entries(ADMINFN)) await nekas(adm3(n, d), ["permission-denied", "failed-precondition"]);
});
