// ============================================================================
// Lärarkonton (#677): admin-functions mot Functions- + Auth- + Firestore-
// EMULATORERNA (spec docs/UTVECKLINGSUPPDRAG_LARARKONTON.md §3 och §7 test 19–23).
// ----------------------------------------------------------------------------
// Klienten anropar som adminsidan (httpsCallable, europe-west1) och loggar in
// som de skapade kontona på riktigt:
//   19 årskurskonto/elev/utloggad nekas alla admin-functions och andras dokument
//   20 admin skapar Årskurs 4 (4A, 4B) → inloggning, claims, eget dokument
//   21 admin tar bort 4B → syns direkt i kontots dokument, utan ny inloggning
//   22 admin stänger av → disabled i Auth, kan inte logga in eller förnya token
//   23 egen adminroll, stänga av/radera sig själv, sista aktiva admin → nekas
//   + byta lösenord, byta roll (gammal admin-token räcker inte), radera
//     (materialet blir admins), valideringsfel.
// uid/användarnamn ta-* krockar inte med andra sviter. Körs av
// `npm run test:functions`.
// ============================================================================

import assert from "node:assert/strict";
import { test, after } from "node:test";
import admin from "firebase-admin";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, collection } from "firebase/firestore";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { teacherEmail } from "../functions/teacher-accounts-core.js";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
process.env.FIRESTORE_EMULATOR_HOST = FS_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

const adminApp = admin.initializeApp({ projectId: PROJECT_ID }, "ta-test-admin");
const adminAuth = admin.auth(adminApp);
const adminDb = admin.firestore(adminApp);

/** En klient per inloggning (två kan vara inloggade samtidigt, t.ex. en gammal token). */
const clients = [];
function client(name) {
  const app = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT_ID }, `ta-${name}-${clients.length}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, FS_HOST.split(":")[0], Number(FS_HOST.split(":")[1]));
  const fns = getFunctions(app, "europe-west1");
  connectFunctionsEmulator(fns, FN_HOST.split(":")[0], Number(FN_HOST.split(":")[1]));
  const c = {
    app, auth, db,
    call: (fn, data) => httpsCallable(fns, fn)(data).then((r) => r.data),
    login: (username, pw) => signInWithEmailAndPassword(auth, teacherEmail(username), pw),
  };
  clients.push(c);
  return c;
}
const errCode = (e) => String(e?.code || "").replace(/^functions\//, "");
const rejects = (p, code, re) =>
  assert.rejects(p, (e) => {
    assert.equal(errCode(e), code, `väntade ${code}, fick ${e?.code}: ${e?.message}`);
    if (re) assert.match(e.message, re);
    return true;
  });

const PW = "larare123";
const FNS = ["adminCreateTeacher", "adminUpdateTeacher", "adminSetTeacherPassword", "adminSetTeacherActive", "adminDeleteTeacher"];
const ids = {};
const elias = client("elias");

after(async () => {
  for (const c of clients) {
    await signOut(c.auth).catch(() => {});
    await deleteApp(c.app).catch(() => {});
  }
  await adminApp.delete().catch(() => {});
});

async function seedAdmin(username, displayName, { doc: withDoc = true } = {}) {
  const u = await adminAuth.createUser({ email: teacherEmail(username), password: PW, displayName });
  await adminAuth.setCustomUserClaims(u.uid, { teacher: true, admin: true });
  if (withDoc) {
    await adminDb.doc(`teacherAccounts/${u.uid}`).set({ username, displayName, role: "admin", classIds: [], active: true });
  }
  return u.uid;
}

test("seed: två admin, en äldre admin utan dokument, klasser, en elev", async () => {
  ids.elias = await seedAdmin("ta-elias", "Elias");
  ids.rasmus = await seedAdmin("ta-rasmus", "Rasmus");
  ids.gammal = await seedAdmin("ta-gammal", "Gammal admin", { doc: false });
  for (const [id, name] of [["ta4a", "4A"], ["ta4b", "4B"], ["ta5a", "5A"]]) {
    await adminDb.doc(`classes/${id}`).set({ name, studentIds: [] });
  }
  await adminAuth.createUser({ uid: "ta-elev", email: "ta-elev@elev.pluggportalen.local", password: PW });
  await elias.login("ta-elias", PW);
});

test("test 20: admin skapar Årskurs 4 med 4A och 4B – kontot loggar in och ser sina klasser", async () => {
  const res = await elias.call("adminCreateTeacher", {
    username: " TA-Arskurs4 ", displayName: "Årskurs 4", password: "vinter-sol-42", role: "arskurs", classIds: ["ta4a", "ta4b", "ta4a"],
  });
  assert.equal(res.username, "ta-arskurs4");
  assert.deepEqual(res.classIds, ["ta4a", "ta4b"]);
  ids.ak4 = res.uid;

  const user = await adminAuth.getUser(ids.ak4);
  assert.deepEqual(user.customClaims, { teacher: true, role: "arskurs" });
  assert.equal(user.displayName, "Årskurs 4");
  const d = (await adminDb.doc(`teacherAccounts/${ids.ak4}`).get()).data();
  assert.equal(d.role, "arskurs");
  assert.equal(d.active, true);
  assert.equal(d.createdBy, ids.elias);
  assert.ok(d.createdAt && d.updatedAt);

  const ak4 = client("ak4");
  ids.ak4Client = ak4;
  const cred = await ak4.login("ta-arskurs4", "vinter-sol-42");
  const tok = await cred.user.getIdTokenResult();
  assert.equal(tok.claims.teacher, true);
  assert.equal(tok.claims.role, "arskurs");
  assert.equal(tok.claims.admin, undefined);
  const own = await getDoc(doc(ak4.db, "teacherAccounts", ids.ak4));
  assert.deepEqual(own.data().classIds, ["ta4a", "ta4b"]);
});

test("valideringsfel: upptaget namn, okänd klass, kort lösenord, okänd roll", async () => {
  await rejects(elias.call("adminCreateTeacher", { username: "ta-arskurs4", displayName: "X", password: PW, role: "arskurs" }), "already-exists", /redan taget/);
  await rejects(elias.call("adminCreateTeacher", { username: "ta-x1", displayName: "X", password: PW, role: "arskurs", classIds: ["finnsinte"] }), "invalid-argument", /finnsinte/);
  await rejects(elias.call("adminCreateTeacher", { username: "ta-x1", displayName: "X", password: "kort", role: "arskurs" }), "invalid-argument");
  await rejects(elias.call("adminCreateTeacher", { username: "ta-x1", displayName: "X", password: PW, role: "chef" }), "invalid-argument");
  await rejects(elias.call("adminCreateTeacher", { username: "Å!", displayName: "X", password: PW, role: "admin" }), "invalid-argument");
  await assert.rejects(adminAuth.getUserByEmail(teacherEmail("ta-x1")), "inget konto skapades");
});

test("test 19: årskurskonto, elev och utloggad nekas alla admin-functions och andras dokument", async () => {
  const ak4 = ids.ak4Client;
  for (const fn of FNS) {
    await rejects(ak4.call(fn, { uid: ids.rasmus, username: "ta-hack", displayName: "Hack", password: PW, role: "admin", active: false }), "permission-denied", /bara admin/);
  }
  await assert.rejects(getDoc(doc(ak4.db, "teacherAccounts", ids.elias)));
  await assert.rejects(getDocs(collection(ak4.db, "teacherAccounts")));

  const elev = client("elev");
  await signInWithEmailAndPassword(elev.auth, "ta-elev@elev.pluggportalen.local", PW);
  await rejects(elev.call("adminSetTeacherActive", { uid: ids.elias, active: false }), "permission-denied");
  const ute = client("ute");
  await rejects(ute.call("adminDeleteTeacher", { uid: ids.elias }), "permission-denied");
  assert.equal((await adminAuth.getUser(ids.elias)).disabled, false, "inget ändrades");
});

test("test 21: admin tar bort 4B – syns direkt utan att läraren loggar ut", async () => {
  const ak4 = ids.ak4Client;
  const tokenBefore = await ak4.auth.currentUser.getIdToken();
  const res = await elias.call("adminUpdateTeacher", { uid: ids.ak4, classIds: ["ta4a"], displayName: "Årskurs 4 (Lisa)" });
  assert.deepEqual(res.classIds, ["ta4a"]);
  assert.equal(res.roleChanged, false);
  // Samma inloggning, samma token – dokumentet (som reglerna läser med get()) är redan nytt.
  assert.equal(await ak4.auth.currentUser.getIdToken(), tokenBefore);
  const own = await getDoc(doc(ak4.db, "teacherAccounts", ids.ak4));
  assert.deepEqual(own.data().classIds, ["ta4a"]);
  assert.equal(own.data().displayName, "Årskurs 4 (Lisa)");
  assert.equal((await adminAuth.getUser(ids.ak4)).displayName, "Årskurs 4 (Lisa)");
  await rejects(elias.call("adminUpdateTeacher", { uid: ids.ak4 }), "invalid-argument");
  await rejects(elias.call("adminUpdateTeacher", { uid: "finnsinte", classIds: [] }), "not-found");
});

test("byta lösenord: nya fungerar, gamla inte; en elev kan inte väljas", async () => {
  await elias.call("adminSetTeacherPassword", { uid: ids.ak4, password: "host-regn-77" });
  const prov = client("prov");
  await assert.rejects(prov.login("ta-arskurs4", "vinter-sol-42"));
  await prov.login("ta-arskurs4", "host-regn-77");
  await signOut(prov.auth);
  await rejects(elias.call("adminSetTeacherPassword", { uid: "ta-elev", password: "hejsan99" }), "not-found");
  await rejects(elias.call("adminSetTeacherPassword", { uid: ids.ak4, password: "123" }), "invalid-argument");
});

test("test 22: admin stänger av Årskurs 4 – kan inte logga in eller förnya token; aktivera igen", async () => {
  const ak4 = ids.ak4Client;
  assert.deepEqual(await elias.call("adminSetTeacherActive", { uid: ids.ak4, active: false }), { uid: ids.ak4, active: false });
  assert.equal((await adminAuth.getUser(ids.ak4)).disabled, true);
  assert.equal((await adminDb.doc(`teacherAccounts/${ids.ak4}`).get()).get("active"), false);
  const prov = client("prov2");
  await assert.rejects(prov.login("ta-arskurs4", "host-regn-77"), (e) => e.code === "auth/user-disabled");
  await assert.rejects(ak4.auth.currentUser.getIdToken(true), "den gamla inloggningen kan inte förnya sin token");

  await elias.call("adminSetTeacherActive", { uid: ids.ak4, active: true });
  assert.equal((await adminAuth.getUser(ids.ak4)).disabled, false);
  assert.equal((await adminDb.doc(`teacherAccounts/${ids.ak4}`).get()).get("active"), true);
  await prov.login("ta-arskurs4", "host-regn-77");
  await signOut(prov.auth);
  await rejects(elias.call("adminSetTeacherActive", { uid: ids.ak4 }), "invalid-argument");
});

test("byta roll: årskurskonto → admin → årskurskonto; en gammal admin-token räcker inte", async () => {
  await elias.call("adminUpdateTeacher", { uid: ids.ak4, role: "admin" });
  assert.deepEqual((await adminAuth.getUser(ids.ak4)).customClaims, { teacher: true, admin: true });
  const d = (await adminDb.doc(`teacherAccounts/${ids.ak4}`).get()).data();
  assert.equal(d.role, "admin");
  assert.deepEqual(d.classIds, [], "admin har inga klasser (ser alla)");

  const nyAdmin = client("nyadmin");
  await nyAdmin.login("ta-arskurs4", "host-regn-77");
  assert.equal((await nyAdmin.auth.currentUser.getIdTokenResult()).claims.admin, true);
  await elias.call("adminUpdateTeacher", { uid: ids.ak4, role: "arskurs", classIds: ["ta4a", "ta4b"] });
  assert.deepEqual((await adminAuth.getUser(ids.ak4)).customClaims, { teacher: true, role: "arskurs" });
  // ID-token har fortfarande admin:true – servern kollar Auth-posten och nekar.
  assert.equal((await nyAdmin.auth.currentUser.getIdTokenResult()).claims.admin, true);
  await rejects(nyAdmin.call("adminSetTeacherActive", { uid: ids.elias, active: false }), "permission-denied");
});

test("test 23: egen adminroll, stänga av eller radera sig själv – nekas", async () => {
  await rejects(elias.call("adminUpdateTeacher", { uid: ids.elias, role: "arskurs" }), "permission-denied", /egen adminroll/);
  await rejects(elias.call("adminSetTeacherActive", { uid: ids.elias, active: false }), "permission-denied", /eget konto/);
  await rejects(elias.call("adminDeleteTeacher", { uid: ids.elias }), "permission-denied", /eget konto/);
  // Aktivera sig själv och byta eget namn/lösenord går bra.
  await elias.call("adminSetTeacherActive", { uid: ids.elias, active: true });
  await elias.call("adminUpdateTeacher", { uid: ids.elias, displayName: "Elias R" });
  const u = await adminAuth.getUser(ids.elias);
  assert.deepEqual([u.disabled, u.customClaims.admin], [false, true]);
});

test("test 23: det sista aktiva adminkontot kan inte stängas av, nedgraderas eller raderas", async () => {
  // Rasmus blir årskurskonto (Elias finns kvar) – tillåtet.
  await elias.call("adminUpdateTeacher", { uid: ids.rasmus, role: "arskurs" });
  // Nu är Elias det enda aktiva adminkontot i teacherAccounts. "Gammal admin"
  // har admin-claim men inget dokument (ej migrerad) och räknas inte.
  const gammal = client("gammal");
  await gammal.login("ta-gammal", PW);
  await rejects(gammal.call("adminSetTeacherActive", { uid: ids.elias, active: false }), "failed-precondition", /minst ett aktivt adminkonto/);
  await rejects(gammal.call("adminUpdateTeacher", { uid: ids.elias, role: "arskurs" }), "failed-precondition");
  await rejects(gammal.call("adminDeleteTeacher", { uid: ids.elias }), "failed-precondition");
  const e = await adminAuth.getUser(ids.elias);
  assert.deepEqual([e.disabled, e.customClaims.admin], [false, true], "Elias är orörd");
  assert.equal((await adminDb.doc(`teacherAccounts/${ids.elias}`).get()).get("role"), "admin");
  // Med Rasmus som admin igen finns två – då får en av dem stängas av.
  await elias.call("adminUpdateTeacher", { uid: ids.rasmus, role: "admin" });
  await gammal.call("adminSetTeacherActive", { uid: ids.rasmus, active: false });
  // Nu är Elias ensam aktiv igen: Rasmus (avstängd admin) räknas inte.
  await rejects(gammal.call("adminSetTeacherActive", { uid: ids.elias, active: false }), "failed-precondition");
  await gammal.call("adminSetTeacherActive", { uid: ids.rasmus, active: true });
});

test("radera: inloggning och dokument bort, materialet blir admins", async () => {
  const { uid } = await elias.call("adminCreateTeacher", { username: "ta-arskurs5", displayName: "Årskurs 5", password: PW, role: "arskurs", classIds: ["ta5a"] });
  await adminDb.doc("subjects/ta-so").set({ name: "SO" });
  await adminDb.doc("subjects/ta-so/areas/egen").set({ name: "Vikingar", createdBy: uid, createdByName: "Årskurs 5" });
  await adminDb.doc("subjects/ta-so/areas/annan").set({ name: "Medeltiden", createdBy: ids.rasmus, createdByName: "Rasmus" });
  await adminDb.doc("hittaRattPacks/e-tapack").set({ title: "Karta", ownerUid: uid, ownerNamn: "Årskurs 5" });
  await adminDb.doc("hittaRattMeta/egnaPack").set({ packs: { "e-tapack": { title: "Karta", ownerUid: uid, ownerNamn: "Årskurs 5" } } }, { merge: true });
  await adminDb.doc("hittaRattBilder/ta-bild").set({ ownerUid: uid, packId: "e-tapack" });

  const res = await elias.call("adminDeleteTeacher", { uid });
  assert.deepEqual(res, { uid, deleted: true, areas: 1, hittaRattPacks: 1 });
  await assert.rejects(adminAuth.getUser(uid), (e) => e.code === "auth/user-not-found");
  assert.equal((await adminDb.doc(`teacherAccounts/${uid}`).get()).exists, false);
  const egen = (await adminDb.doc("subjects/ta-so/areas/egen").get()).data();
  assert.deepEqual(egen, { name: "Vikingar" }, "området finns kvar utan createdBy = admins");
  assert.equal((await adminDb.doc("subjects/ta-so/areas/annan").get()).get("createdBy"), ids.rasmus, "andras material orört");
  assert.equal((await adminDb.doc("hittaRattPacks/e-tapack").get()).get("ownerUid"), ids.elias);
  const kat = (await adminDb.doc("hittaRattMeta/egnaPack").get()).get("packs")["e-tapack"];
  assert.deepEqual([kat.ownerUid, kat.ownerNamn, kat.title], [ids.elias, "Elias R", "Karta"]);
  assert.equal((await adminDb.doc("hittaRattBilder/ta-bild").get()).get("ownerUid"), ids.elias);
  await rejects(elias.call("adminDeleteTeacher", { uid }), "not-found");
  // Städa delade dokument så andra sviter inte ser dem.
  await adminDb.doc("hittaRattPacks/e-tapack").delete();
  await adminDb.doc("hittaRattBilder/ta-bild").delete();
  await adminDb.doc("hittaRattMeta/egnaPack").set({ packs: { "e-tapack": admin.firestore.FieldValue.delete() } }, { merge: true });
});
