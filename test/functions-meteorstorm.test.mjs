// ============================================================================
// E2E: Meteorstormens Cloud Functions (msAgera / msRatta / msLage / msAvsluta,
// #821) mot Functions- + Auth- + Firestore-EMULATORERNA. Eleverna loggar in på
// riktigt och anropar som elevsidan (httpsCallable, europe-west1); deras egna
// läsningar/skrivningar går genom firestore.rules. Med serverns riktiga klocka.
// Kärnan med styrd klocka: functions-meteorstorm-core/-quiz.test.mjs.
// Körs via:  npm run test:functions  (kräver `npm --prefix functions install`)
// ============================================================================

import assert from "node:assert/strict";
import { test, after } from "node:test";
import admin from "firebase-admin";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, connectAuthEmulator } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
process.env.FIRESTORE_EMULATOR_HOST = FS_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

const adminApp = admin.initializeApp({ projectId: PROJECT_ID }, "ms-fn-admin");
const adb = adminApp.firestore();
const { Timestamp } = admin.firestore;

const app = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT_ID }, "ms-fn-client");
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
const cdb = getFirestore(app);
connectFirestoreEmulator(cdb, FS_HOST.split(":")[0], Number(FS_HOST.split(":")[1]));
const fns = getFunctions(app, "europe-west1");
connectFunctionsEmulator(fns, FN_HOST.split(":")[0], Number(FN_HOST.split(":")[1]));
const call = (name, data) => httpsCallable(fns, name)(data).then((r) => r.data);

const PW = "meteor821";
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
let n = 0;
const att = () => `e2e-${Date.now().toString(36)}-${n++}`;
const ELEVER = { msalma: "ms4b", msbo: "ms4b", msomar: "ms4d" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

after(async () => {
  await signOut(auth).catch(() => {});
  await deleteApp(app).catch(() => {});
  await adminApp.delete().catch(() => {});
});

async function session(sid, over = {}) {
  await adb.doc(`liveSessions/${sid}`).set({
    name: "Meteorstormen", format: "meteorstorm", gameMode: "multiplication_0_10", answerKind: "free",
    participatingClassIds: ["ms4b", "ms4d"], classNames: { ms4b: "4B", ms4d: "4D" }, durationSeconds: 600, countdownSeconds: 0,
    status: "live", createdBy: "mslarare", createdAt: Timestamp.now(), msSeed: 821,
    msInstallningar: { lage: "klass-mot-klass", attacker: "milda" }, showNames: true,
    startedAt: Timestamp.fromMillis(Date.now() - 30_000), ...over,
  });
  for (const [uid, classId] of Object.entries(ELEVER)) {
    await adb.doc(`liveSessions/${sid}/players/${uid}`).set({ uid, classId, name: uid, correct: 0, incorrect: 0, joinedAt: Timestamp.fromMillis(Date.now() - 60_000) });
  }
}

test("seed: elever i egna klasser, en lärare, en pågående och en slut storm", async () => {
  for (const uid of Object.keys(ELEVER)) {
    await admin.auth(adminApp).createUser({ uid, email: email(uid), password: PW }).catch(() => {});
    await adb.doc(`students/${uid}`).set({ namn: uid });
  }
  await admin.auth(adminApp).createUser({ uid: "mslarare", email: email("mslarare"), password: PW }).catch(() => {});
  await admin.auth(adminApp).setCustomUserClaims("mslarare", { teacher: true, admin: true });
  await adb.doc("classes/ms4b").set({ name: "4B", studentIds: ["msalma", "msbo"] });
  await adb.doc("classes/ms4d").set({ name: "4D", studentIds: ["msomar"] });
  await session("ms");
  await session("ms-slut", { startedAt: Timestamp.fromMillis(Date.now() - 11 * 60_000) });
});

test("utloggad nekas", async () => {
  await signOut(auth).catch(() => {});
  assert.equal(await errCode(call("msAgera", { sid: "ms", attemptId: att(), svar: { factorA: 2, factorB: 2, answer: 4 }, typ: "skold" })), "unauthenticated");
});

test("rätt svar + handling i ett anrop → en händelse; fel svar skriver inget", async () => {
  await as("msalma");
  const fel = await call("msAgera", { sid: "ms", attemptId: att(), svar: { factorA: 2, factorB: 2, answer: 5 }, typ: "skold" });
  assert.equal(fel.correct, false);
  const r = await call("msAgera", { sid: "ms", attemptId: att(), svar: { factorA: 2, factorB: 2, answer: 4 }, typ: "skold", fel: [{ factorA: 3, factorB: 3, answer: 8 }] });
  assert.equal(r.correct, true);
  assert.equal(r.typ, "skold");
  assert.ok(r.status.stationer.length === 2);
  const ev = (await adb.collection("liveSessions/ms/msEvents").get()).docs.map((d) => d.data());
  assert.equal(ev.length, 1);
  assert.equal(ev[0].fel.length, 1);
});

test("väntetid mellan handlingar (resource-exhausted med vantaMs); efter väntan går det", async () => {
  await as("msbo");
  await call("msAgera", { sid: "ms", attemptId: att(), svar: { factorA: 5, factorB: 5, answer: 25 }, typ: "laser" });
  let kod = null;
  let detaljer = null;
  try {
    await call("msAgera", { sid: "ms", attemptId: att(), svar: { factorA: 5, factorB: 5, answer: 25 }, typ: "laser" });
  } catch (e) {
    kod = String(e.code).replace(/^functions\//, "");
    detaljer = e.details;
  }
  assert.equal(kod, "resource-exhausted");
  assert.ok(detaljer?.vantaMs > 0);
  await sleep(detaljer.vantaMs + 50);
  const r = await call("msAgera", { sid: "ms", attemptId: att(), svar: { factorA: 5, factorB: 5, answer: 25 }, typ: "spara" });
  assert.equal(r.energi, 1);
});

test("dragstrålen utan energi nekas och sparas; msLage efteråt", async () => {
  await as("msomar");
  const r = await call("msAgera", { sid: "ms", attemptId: att(), svar: { factorA: 6, factorB: 7, answer: 42 }, typ: "drag" });
  assert.equal(r.nekad, "energi");
  assert.equal(r.typ, "spara");
  const l = await call("msLage", { sid: "ms" });
  assert.deepEqual({ nr: l.nr, energi: l.energi }, { nr: 1, energi: 1 });
});

test("eleven skriver inte själv och läser inte loggen, men sitt eget msPlayers och statusen", async () => {
  await as("msalma");
  assert.equal(await errCode(setDoc(doc(cdb, "liveSessions/ms/msEvents/msalma_9"), { uid: "msalma", typ: "laser", t: Date.now() })), "permission-denied");
  assert.equal(await errCode(getDocs(collection(cdb, "liveSessions/ms/msEvents"))), "permission-denied");
  assert.equal(await errCode(getDoc(doc(cdb, "liveSessions/ms/msPublic/status"))), "ok");
  assert.equal(await errCode(getDoc(doc(cdb, "liveSessions/ms/msPlayers/msalma"))), "ok");
  assert.equal(await errCode(getDoc(doc(cdb, "liveSessions/ms/msPlayers/msomar"))), "permission-denied");
});

test("efter slutet: handling nekas; msAvsluta (elev) räknar result; läraren får samma", async () => {
  await as("msalma");
  assert.equal(await errCode(call("msAgera", { sid: "ms-slut", attemptId: att(), svar: { factorA: 1, factorB: 1, answer: 1 }, typ: "skold" })), "failed-precondition");
  const r = await call("msAvsluta", { sid: "ms-slut" });
  assert.equal(r.redan, false);
  assert.equal(r.result.format, "meteorstorm");
  const s = (await adb.doc("liveSessions/ms-slut").get()).data();
  assert.equal(s.status, "finished");
  assert.ok(s.result);
  await as("mslarare");
  const igen = await call("msAvsluta", { sid: "ms-slut" });
  assert.equal(igen.redan, true);
});

test("pågående: eleven kan inte avsluta, läraren kan", async () => {
  await as("msalma");
  assert.equal(await errCode(call("msAvsluta", { sid: "ms" })), "failed-precondition");
  await as("mslarare");
  const r = await call("msAvsluta", { sid: "ms" });
  assert.equal(r.redan, false);
  assert.ok(r.result.totalCorrect >= 4);
  assert.equal((await adb.doc("liveSessions/ms/msPlayers/msalma").get()).data().correct, 1);
});
