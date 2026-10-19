// ============================================================================
// E2E: Schack-callables (#779) mot Functions- + Auth- + Firestore-EMULATORERNA,
// anropade som klienten (src/schack/schack-moln.js, httpsCallable europe-west1).
// Kärnans gränsfall (klocka, 5 min, 24 h, tabell) testas med styrd klocka i
// functions-schack-core/-parti.test.mjs – här: inloggning, roller, grinden
// och att ett helt kort parti går genom servern utan att klienten skriver.
//
//   utloggad → unauthenticated; elev utanför klassen → permission-denied
//   modul av / fokusläge → failed-precondition; skräp → invalid-argument
//   lobby → parti → narrmatt: partiet bort ur partier, tabellen för båda
//   lärarcallables: elev → permission-denied, årskurs utan klassen → permission-denied,
//   årskurs med klassen och admin → ok
//   klienten läser sitt parti och klassdokumentet, men inte andras parti
//
// Körs via:  npm run test:functions  (kräver `npm --prefix functions install`)
// ============================================================================

import assert from "node:assert/strict";
import { test, after } from "node:test";
import admin from "firebase-admin";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, connectAuthEmulator } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { getFirestore, connectFirestoreEmulator, doc, getDoc, updateDoc } from "firebase/firestore";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
process.env.FIRESTORE_EMULATOR_HOST = FS_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

const adminApp = admin.initializeApp({ projectId: PROJECT_ID }, "sc-fn-admin");
const adb = adminApp.firestore();

const app = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT_ID }, "sc-fn-client");
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
const cdb = getFirestore(app);
connectFirestoreEmulator(cdb, FS_HOST.split(":")[0], Number(FS_HOST.split(":")[1]));
const fns = getFunctions(app, "europe-west1");
connectFunctionsEmulator(fns, FN_HOST.split(":")[0], Number(FN_HOST.split(":")[1]));
const call = (name, d) => httpsCallable(fns, name)(d).then((r) => r.data);

const PW = "schack779";
const KLASS = "sce-4a";
const ANNA = "sceanna";
const BO = "scebo";
const CIA = "scecia";
const DAN = "scedan"; // annan klass
const ADMIN = "sceadmin";
const AK = "sceak"; // årskurskonto med sce-4a
const AK5 = "sceak5"; // årskurskonto utan
const email = (u) => `${u}@elev.pluggportalen.local`;
const as = async (uid) => {
  await signOut(auth).catch(() => {});
  await signInWithEmailAndPassword(auth, email(uid), PW);
};
const errCode = async (p) => {
  try {
    await p;
  } catch (e) {
    return String(e?.code || "").replace(/^(functions|firestore)\//, "");
  }
  return "ok";
};

after(async () => {
  await signOut(auth).catch(() => {});
  await deleteApp(app).catch(() => {});
  await adminApp.delete().catch(() => {});
});

test("seed: tre elever i sce-4a med schack på, en elev i annan klass, admin och två årskurskonton", async () => {
  const a = admin.auth(adminApp);
  for (const uid of [ANNA, BO, CIA, DAN, ADMIN, AK, AK5]) {
    await a.createUser({ uid, email: email(uid), password: PW }).catch(() => {});
  }
  await a.setCustomUserClaims(ADMIN, { teacher: true, admin: true });
  await a.setCustomUserClaims(AK, { teacher: true, role: "arskurs" });
  await a.setCustomUserClaims(AK5, { teacher: true, role: "arskurs" });
  for (const coll of ["schackKlass", "schackPartier"]) {
    const s = await adb.collection(coll).get();
    await Promise.all(s.docs.filter((d) => d.id.startsWith("sce")).map((d) => d.ref.delete()));
  }
  await adb.doc(`classes/${KLASS}`).set({ name: "4A", studentIds: [ANNA, BO, CIA], enabledModules: ["schack"] });
  await adb.doc("classes/sce-5a").set({ name: "5A", studentIds: [DAN], enabledModules: ["schack"] });
  await adb.doc(`classProjections/${KLASS}`).set({ members: { [ANNA]: { namn: "Anna" }, [BO]: { namn: "Bo" }, [CIA]: { namn: "Cia" } } });
  for (const uid of [ANNA, BO, CIA, DAN]) {
    await adb.doc(`students/${uid}`).set({ namn: uid, classIds: [uid === DAN ? "sce-5a" : KLASS] });
    await adb.doc(`studentData/${uid}`).set({ coins: 0 });
  }
  await adb.doc(`teacherAccounts/${AK}`).set({ role: "arskurs", classIds: [KLASS], active: true });
  await adb.doc(`teacherAccounts/${AK5}`).set({ role: "arskurs", classIds: ["sce-5a"], active: true });
});

test("utloggad → unauthenticated för alla elva callables", async () => {
  await signOut(auth).catch(() => {});
  for (const n of ["schackVanta", "schackSlutaVanta", "schackGaMed", "schackUtmana", "schackSvara", "schackDrag", "schackGeUpp",
    "schackRemi", "schackKravaVinst", "schackLarareAvsluta", "schackLarareTopplista"]) {
    assert.equal(await errCode(call(n, { classId: KLASS })), "unauthenticated", n);
  }
});

test("grinden: elev utanför klassen, lärare, modul av, fokusläge och skräp nekas med rätt kod", async () => {
  await as(DAN);
  assert.equal(await errCode(call("schackVanta", { classId: KLASS, klocka: null })), "permission-denied");
  await as(ADMIN);
  assert.equal(await errCode(call("schackVanta", { classId: KLASS, klocka: null })), "permission-denied", "läraren står inte i studentIds");
  await as(ANNA);
  assert.equal(await errCode(call("schackVanta", { classId: KLASS, klocka: 7 })), "invalid-argument");
  assert.equal(await errCode(call("schackDrag", { partiId: "x", from: "e2", to: "e4" })), "not-found");
  await adb.doc(`classes/${KLASS}`).update({ enabledModules: [] });
  assert.equal(await errCode(call("schackVanta", { classId: KLASS, klocka: null })), "failed-precondition");
  await adb.doc(`classes/${KLASS}`).update({ enabledModules: ["schack"], lock: { mal: { typ: "lasresan" }, till: Date.now() + 600_000 } });
  assert.equal(await errCode(call("schackVanta", { classId: KLASS, klocka: null })), "failed-precondition");
  await adb.doc(`classes/${KLASS}`).update({ lock: admin.firestore.FieldValue.delete() });
});

let partiId;
let vit;
let svart;

test("lobbyn: Anna väntar, Bo går med → partiet skapas; Cia kan inte få ett andra parti med Anna", async () => {
  await as(ANNA);
  assert.deepEqual(await call("schackVanta", { classId: KLASS, klocka: null }), { klocka: null });
  await as(BO);
  const r = await call("schackGaMed", { classId: KLASS, motstandare: ANNA });
  partiId = r.partiId;
  assert.match(partiId, /^[A-Za-z0-9]{20}$/);
  assert.ok(["w", "b"].includes(r.farg));
  vit = r.farg === "w" ? BO : ANNA;
  svart = vit === BO ? ANNA : BO;
  await as(CIA);
  assert.equal(await errCode(call("schackUtmana", { classId: KLASS, till: ANNA, klocka: 5 })), "failed-precondition");
  const k = (await adb.doc(`schackKlass/${KLASS}`).get()).data();
  assert.deepEqual(Object.keys(k.partier), [partiId]);
  assert.deepEqual(k.vantar, {});
});

test("klienten läser klassdokumentet och sitt parti men inte andras parti, och kan inte skriva", async () => {
  await as(ANNA);
  assert.equal((await getDoc(doc(cdb, "schackKlass", KLASS))).data().partier[partiId].vit, vit);
  assert.equal((await getDoc(doc(cdb, "schackPartier", partiId))).data().status, "pagar");
  assert.equal(await errCode(updateDoc(doc(cdb, "schackPartier", partiId), { tur: "b" })), "permission-denied");
  assert.equal(await errCode(updateDoc(doc(cdb, "schackKlass", KLASS), { dold: true })), "permission-denied");
  await as(CIA);
  assert.equal(await errCode(getDoc(doc(cdb, "schackPartier", partiId))), "permission-denied");
  await as(DAN);
  assert.equal(await errCode(getDoc(doc(cdb, "schackKlass", KLASS))), "permission-denied");
  await as(AK);
  assert.equal((await getDoc(doc(cdb, "schackPartier", partiId))).data().classId, KLASS);
});

test("ett helt parti genom servern: fel tur nekas, narrmatt avslutar och tabellen uppdateras för båda", async () => {
  await as(svart);
  assert.equal(await errCode(call("schackDrag", { partiId, from: "e7", to: "e5" })), "failed-precondition");
  await as(vit);
  assert.equal(await errCode(call("schackDrag", { partiId, from: "e2", to: "e5" })), "invalid-argument");
  const r1 = await call("schackDrag", { partiId, from: "f2", to: "f3" });
  assert.equal(r1.san, "f3");
  await as(svart);
  await call("schackDrag", { partiId, from: "e7", to: "e5" });
  await as(vit);
  await call("schackDrag", { partiId, from: "g2", to: "g4" });
  await as(svart);
  assert.equal(await errCode(call("schackKravaVinst", { partiId })), "failed-precondition");
  const r4 = await call("schackDrag", { partiId, from: "d8", to: "h4" });
  assert.deepEqual([r4.san, r4.slut], ["Qh4#", { resultat: "0-1", orsak: "matt" }]);
  const p = (await adb.doc(`schackPartier/${partiId}`).get()).data();
  assert.deepEqual([p.status, p.resultat, p.orsak, p.drag], ["slut", "0-1", "matt", ["f3", "e5", "g4", "Qh4#"]]);
  const k = (await adb.doc(`schackKlass/${KLASS}`).get()).data();
  assert.deepEqual(k.partier, {});
  assert.deepEqual(k.tabell[svart], { poang: 1020, vinster: 1, forluster: 0, remier: 0, partier: 1 });
  assert.deepEqual(k.tabell[vit], { poang: 987, vinster: 0, forluster: 1, remier: 0, partier: 1 });
  assert.equal(await errCode(call("schackGeUpp", { partiId })), "failed-precondition", "partiet är slut");
});

test("utmaning → svara ja → remi via erbjudande; lärarcallables kräver läraren med klassen", async () => {
  await as(ANNA);
  const { utmaningId } = await call("schackUtmana", { classId: KLASS, till: CIA, klocka: 10 });
  await as(CIA);
  const r = await call("schackSvara", { utmaningId, ja: true });
  const p2 = r.partiId;
  assert.equal((await adb.doc(`schackPartier/${p2}`).get()).data().klocka.minuter, 10);
  assert.equal(await errCode(call("schackLarareAvsluta", { partiId: p2 })), "permission-denied", "elev");
  await as(AK5);
  assert.equal(await errCode(call("schackLarareAvsluta", { partiId: p2 })), "permission-denied", "lärare utan klassen");
  assert.equal(await errCode(call("schackLarareTopplista", { classId: KLASS, dold: true })), "permission-denied");
  await as(AK);
  assert.deepEqual(await call("schackLarareTopplista", { classId: KLASS, dold: true }), { dold: true, nollstalld: false });
  assert.deepEqual(await call("schackLarareAvsluta", { partiId: p2 }), { slut: { resultat: null, orsak: "avbrutet" } });
  const k = (await adb.doc(`schackKlass/${KLASS}`).get()).data();
  assert.deepEqual(k.partier, {});
  assert.equal(Object.keys(k.tabell).length, 2, "avbrutet rör inte tabellen");
  assert.equal(k.dold, true);
  await as(ADMIN);
  assert.deepEqual(await call("schackLarareTopplista", { classId: KLASS, nollstall: true, dold: false }), { dold: false, nollstalld: true });
  assert.deepEqual((await adb.doc(`schackKlass/${KLASS}`).get()).data().tabell, {});
});

test("studentData.schack.datorPartier: eleven ökar med 1 via klienten (regeln), inte med 2", async () => {
  await as(ANNA);
  const { increment } = await import("firebase/firestore");
  await updateDoc(doc(cdb, "studentData", ANNA), { "schack.datorPartier": increment(1) });
  assert.equal((await adb.doc(`studentData/${ANNA}`).get()).data().schack.datorPartier, 1);
  assert.equal(await errCode(updateDoc(doc(cdb, "studentData", ANNA), { "schack.datorPartier": increment(2) })), "permission-denied");
});
