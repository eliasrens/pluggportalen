// ============================================================================
// E2E: Kurragömmas Cloud Functions (kgStarta / kgAnslut / kgLas / kgSvara /
// kgLeta / kgTick / kgAvsluta, #838) mot Functions- + Auth- + Firestore- +
// Realtime Database-EMULATORERNA. Eleverna loggar in på riktigt och anropar som
// elevsidan (httpsCallable, europe-west1); deras egna läsningar går genom
// firestore.rules och database.rules.json. Med serverns riktiga klocka.
// Kärnan med styrd klocka: functions-kurragomma-core/-leta.test.mjs.
// Körs via:  npm run test:functions  (kräver `npm --prefix functions install`)
// ============================================================================

import assert from "node:assert/strict";
import { test, after } from "node:test";
import admin from "firebase-admin";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, connectAuthEmulator } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { getFirestore, connectFirestoreEmulator, doc, getDoc } from "firebase/firestore";
import { getDatabase, connectDatabaseEmulator, ref, set, get } from "firebase/database";
import { ON } from "../src/live/formats/kurragomma/delat/kg-karta.js";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
const DB_HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST || "127.0.0.1:9000";
process.env.FIRESTORE_EMULATOR_HOST = FS_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
process.env.FIREBASE_DATABASE_EMULATOR_HOST = DB_HOST;
const hp = (h) => [h.split(":")[0], Number(h.split(":")[1])];
// Emulatorn laddar database.rules.json i namnrymden {projekt}-default-rtdb – samma som servern
// väljer (kurragomma-rtdb.js kgDatabaseUrl) – så klientens läsningar går genom reglerna.
const DB_URL = `http://${DB_HOST}?ns=${PROJECT_ID}-default-rtdb`;

const adminApp = admin.initializeApp({ projectId: PROJECT_ID, databaseURL: DB_URL }, "kg-fn-admin");
const adb = adminApp.firestore();
const { Timestamp } = admin.firestore;

const app = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT_ID, databaseURL: DB_URL }, "kg-fn-client");
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
const cdb = getFirestore(app);
connectFirestoreEmulator(cdb, ...hp(FS_HOST));
const rtdb = getDatabase(app);
connectDatabaseEmulator(rtdb, ...hp(DB_HOST));
const fns = getFunctions(app, "europe-west1");
connectFunctionsEmulator(fns, ...hp(FN_HOST));
const call = (name, data) => httpsCallable(fns, name)(data).then((r) => r.data);

const PW = "kurra838";
const email = (u) => `${u}@elev.pluggportalen.local`;
const as = async (uid) => {
  await signOut(auth).catch(() => {});
  await signInWithEmailAndPassword(auth, email(uid), PW);
};
const errCode = async (p) => {
  try {
    await p;
  } catch (e) {
    return String(e?.code || "").replace(/^(functions|firestore)\//, "").replace(/^PERMISSION_DENIED.*/, "permission-denied");
  }
  return "ok";
};
let n = 0;
const att = () => `e2e-${Date.now().toString(36)}-${n++}`;
const ELEVER = ["kgalma", "kgbo", "kgcleo"];
const LADA = ON.foremal.find((f) => f.typ === "lada");

after(async () => {
  await signOut(auth).catch(() => {});
  await deleteApp(app).catch(() => {});
  adminApp.database().goOffline();
  await adminApp.delete().catch(() => {});
});

// gomtid är högst 60 s (GOMTIDER_S) – matchen i gömfasen skapas först i sitt eget test,
// så att emulatorns kallstart inte äter upp gömfasen.
async function session(sid, { sedan = 2000, gomtid = 60 } = {}) {
  await adb.doc(`liveSessions/${sid}`).set({
    name: "Kurragömma", format: "kurragomma", gameMode: "multiplication_0_10", answerKind: "free",
    participatingClassIds: ["kg4b"], classNames: { kg4b: "4B" }, durationSeconds: gomtid + 300, countdownSeconds: 0,
    status: "live", createdBy: "kglarare", createdAt: Timestamp.now(), showNames: true,
    kgInstallningar: { gomtid, startsokare: 1, tystnad: true, karta: "on" },
    startedAt: Timestamp.fromMillis(Date.now() - sedan),
  });
  for (const uid of ELEVER) {
    await adb.doc(`liveSessions/${sid}/players/${uid}`).set({ uid, classId: "kg4b", name: uid, correct: 0, incorrect: 0, joinedAt: Timestamp.fromMillis(Date.now() - 60_000), lastSeenAt: Timestamp.now() });
  }
}

test("seed: elever i klassen, en lärare och en match i letfasen", async () => {
  for (const uid of ELEVER) {
    await admin.auth(adminApp).createUser({ uid, email: email(uid), password: PW }).catch(() => {});
    await adb.doc(`students/${uid}`).set({ namn: uid });
  }
  await admin.auth(adminApp).createUser({ uid: "kglarare", email: email("kglarare"), password: PW }).catch(() => {});
  await admin.auth(adminApp).setCustomUserClaims("kglarare", { teacher: true, admin: true });
  await adb.doc("classes/kg4b").set({ name: "4B", studentIds: ELEVER });
  await session("kg-leta", { sedan: 200_000 });
});

test("utloggad nekas", async () => {
  await signOut(auth).catch(() => {});
  assert.equal(await errCode(call("kgAnslut", { sid: "kg" })), "unauthenticated");
});

test("läraren startar: startsökare, gömfasen; eleven läser sitt eget kgPlayers men inte andras", async () => {
  await session("kg", { sedan: 0 });
  await as("kglarare");
  const r = await call("kgStarta", { sid: "kg" });
  assert.equal(r.fas, "gom");
  const roller = {};
  for (const u of ELEVER) roller[u] = (await adb.doc(`liveSessions/kg/kgPlayers/${u}`).get()).data().roll;
  assert.equal(Object.values(roller).filter((x) => x === "sokare").length, 1);
  const sokare = ELEVER.find((u) => roller[u] === "sokare");
  const gomd = ELEVER.find((u) => roller[u] === "gomd");
  await as(gomd);
  assert.equal((await getDoc(doc(cdb, "liveSessions", "kg", "kgPlayers", gomd))).data().roll, "gomd");
  assert.equal(await errCode(getDoc(doc(cdb, "liveSessions", "kg", "kgPlayers", sokare))), "permission-denied");
  assert.equal(await errCode(getDoc(doc(cdb, "liveSessions", "kg", "kgSecret", gomd))), "permission-denied");
  // Rörelsekanalen: gömmaren kan inte skriva pos, sökaren skriver sin egen; båda läser status.
  assert.equal(await errCode(set(ref(rtdb, `kg/kg/pos/${gomd}`), { x: 1, z: 1, yaw: 0, t: Date.now() })), "permission-denied");
  assert.deepEqual((await get(ref(rtdb, "kg/kg/status"))).val(), { fas: "gom", lasta: 0, gomda: 2, sokare: 1 });
  await as(sokare);
  assert.equal(await errCode(set(ref(rtdb, `kg/kg/pos/${sokare}`), { x: 1, z: 1, yaw: 0, t: Date.now() })), "ok");
  assert.equal(await errCode(set(ref(rtdb, `kg/kg/pos/${sokare}`), { x: 1, z: 1, yaw: 0, t: Date.now(), namn: "x" })), "permission-denied");
});

test("gömmaren ansluter, låser (ogiltig plats flyttas) och läser sitt eget kgSelf; sökaren laddar under blundandet", async () => {
  const kp = async (u) => (await adb.doc(`liveSessions/kg/kgPlayers/${u}`).get()).data();
  const gomd = (await Promise.all(ELEVER.map(async (u) => [u, (await kp(u)).roll]))).find(([, r]) => r === "gomd")[0];
  const sokare = (await Promise.all(ELEVER.map(async (u) => [u, (await kp(u)).roll]))).find(([, r]) => r === "sokare")[0];
  await as(gomd);
  const a = await call("kgAnslut", { sid: "kg" });
  assert.equal(a.roll, "gomd");
  assert.equal(a.fas, "gom");
  assert.equal(await errCode(call("kgSvara", { sid: "kg", attemptId: att(), factorA: 2, factorB: 3, answer: 6 })), "failed-precondition");
  const l = await call("kgLas", { sid: "kg", x: LADA.x, z: LADA.z });
  assert.equal(l.flyttad, true);
  assert.equal(l.gomstalle.namn, "vid ladan");
  assert.deepEqual((await getDoc(doc(cdb, "liveSessions", "kg", "kgSelf", gomd))).data().gomstalle, l.gomstalle);
  const igen = await call("kgAnslut", { sid: "kg" });
  assert.deepEqual(igen.gomstalle, l.gomstalle);
  await as(sokare);
  const s = await call("kgSvara", { sid: "kg", attemptId: att(), factorA: 2, factorB: 3, answer: 6 });
  assert.deepEqual({ correct: s.correct, laddningar: s.laddningar, vissling: s.vissling }, { correct: true, laddningar: 1, vissling: false });
  assert.equal(await errCode(call("kgLeta", { sid: "kg", x: 0, z: 0 })), "failed-precondition", "sökarna blundar");
});

test("letfasen (lat start i kgAnslut): placering, vissling utan namn, sökning, tick och lärarens avslut", async () => {
  await as("kgalma");
  const a = await call("kgAnslut", { sid: "kg-leta" });
  assert.equal(a.fas, "leta");
  const roller = {};
  for (const u of ELEVER) roller[u] = (await adb.doc(`liveSessions/kg-leta/kgPlayers/${u}`).get()).data();
  const sokare = ELEVER.find((u) => roller[u].roll === "sokare");
  const gomda = ELEVER.filter((u) => roller[u].roll === "gomd");
  assert.equal(gomda.length, 2);
  for (const u of gomda) assert.equal(roller[u].harLast, true, "placerad av servern (ingen låste)");
  await as(gomda[0]);
  const fel = await call("kgSvara", { sid: "kg-leta", attemptId: att(), factorA: 2, factorB: 3, answer: 7 });
  assert.equal(fel.vissling, true);
  const hand = Object.values((await get(ref(rtdb, "kg/kg-leta/hand"))).val() || {});
  assert.equal(hand.filter((h) => h.typ === "vissling").length, 1);
  assert.ok(!("namn" in hand[0]) && !("uid" in hand[0]));
  await as(sokare);
  await call("kgSvara", { sid: "kg-leta", attemptId: att(), factorA: 2, factorB: 3, answer: 6 });
  const g = (await adb.doc(`liveSessions/kg-leta/kgSecret/${gomda[0]}`).get()).data();
  const r = await call("kgLeta", { sid: "kg-leta", x: g.x, z: g.z });
  assert.deepEqual(r.hittade.map((h) => h.uid), [gomda[0]]);
  assert.equal((await adb.doc(`liveSessions/kg-leta/kgPlayers/${gomda[0]}`).get()).data().roll, "sokare");
  await as("kglarare");
  const t = await call("kgTick", { sid: "kg-leta" });
  assert.equal(t.fas, "leta");
  assert.equal(await errCode(call("kgTick", { sid: "finns-inte" })), "not-found");
  const { result, redan } = await call("kgAvsluta", { sid: "kg-leta" });
  assert.equal(redan, false);
  assert.equal(result.format, "kurragomma");
  assert.equal(result.klaradeSig, 1);
  assert.equal(result.gomstallen.length, 2);
  assert.equal((await adb.doc("liveSessions/kg-leta").get()).data().status, "finished");
  assert.equal((await adminApp.database().ref("kg/kg-leta").once("value")).val(), null, "/kg/{sid} borttaget");
  const igen = await call("kgAvsluta", { sid: "kg-leta" });
  assert.equal(igen.redan, true);
});

test("lärarens vissling (#840): eleven nekas, läraren visslar – händelsen ser ut som en vanlig vissling; spamskyddet 5 s", async () => {
  await session("kg-vissla", { sedan: 200_000 });
  await as("kgalma");
  await call("kgAnslut", { sid: "kg-vissla" }); // lat start + placering
  const roller = {};
  for (const u of ELEVER) roller[u] = (await adb.doc(`liveSessions/kg-vissla/kgPlayers/${u}`).get()).data().roll;
  const gomd = ELEVER.find((u) => roller[u] === "gomd");
  const sokare = ELEVER.find((u) => roller[u] === "sokare");
  assert.equal(await errCode(call("kgLarareVissla", { sid: "kg-vissla", uid: gomd })), "permission-denied", "en elev");
  await as("kglarare");
  assert.equal(await errCode(call("kgLarareVissla", { sid: "kg-vissla", uid: sokare })), "failed-precondition", "inte gömd");
  const r = await call("kgLarareVissla", { sid: "kg-vissla", uid: gomd });
  assert.equal(r.visslade, true);
  assert.equal(await errCode(call("kgLarareVissla", { sid: "kg-vissla", uid: gomd })), "resource-exhausted", "inom 5 s");
  const hand = Object.values((await adminApp.database().ref("kg/kg-vissla/hand").once("value")).val() || {});
  assert.equal(hand.length, 1);
  assert.deepEqual(Object.keys(hand[0]).sort(), ["plats", "t", "typ", "x", "z"], "identisk form – inget uid, namn eller lärarmarkering");
  const ev = (await adb.collection("liveSessions/kg-vissla/kgEvents").get()).docs.map((d) => d.data());
  assert.equal(ev.filter((e) => e.typ === "vissling" && e.larare === true).length, 1);
  assert.equal((await adb.doc(`liveSessions/kg-vissla/kgPlayers/${gomd}`).get()).data().roll, "gomd");
  // Läraren läser de gömda (Vissla-panelen) men aldrig kgSelf/kgSecret
  assert.equal(await errCode(getDoc(doc(cdb, "liveSessions", "kg-vissla", "kgSecret", gomd))), "permission-denied");
});
