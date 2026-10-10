// ============================================================================
// E2E: Guldrushens Cloud Functions (guldrushAnswer / guldrushOpenChest /
// guldrushChooseVictim, #563) mot Functions- + Auth- + Firestore-EMULATORERNA.
// Eleverna loggar in på riktigt och anropar exakt som elevsidan (httpsCallable,
// europe-west1); deras direkta skrivningar går genom firestore.rules. I samma
// anda som admin/qa-kassa-attack.mjs: varje attack ska nekas.
//
//   test 13  rätt svar → kista → guldet uppdateras
//   test 15  stöld: Alma 100 → 85, Omar +15
//   test 16  stjäla från skyddad – manipulerat anrop nekas
//   test 17  manipulerat byte mot någon med mindre guld nekas
//   test 18  stöld när av → bara guld
//   test 19  samma kista två gånger, kista utan rätt svar, skriva guld direkt
//   test 20  svara/öppna efter tid ute
// Kärnan med styrd klocka/slump: functions-guldrush-core/-stold.test.mjs.
//
// Körs via:  npm run test:functions  (kräver `npm --prefix functions install`)
// ============================================================================

import assert from "node:assert/strict";
import { test, after } from "node:test";
import admin from "firebase-admin";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, connectAuthEmulator } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, serverTimestamp,
} from "firebase/firestore";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
process.env.FIRESTORE_EMULATOR_HOST = FS_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

const adminApp = admin.initializeApp({ projectId: PROJECT_ID }, "gr-fn-admin");
const adb = adminApp.firestore();
const { Timestamp } = admin.firestore;

const app = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT_ID }, "gr-fn-client");
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
const cdb = getFirestore(app);
connectFirestoreEmulator(cdb, FS_HOST.split(":")[0], Number(FS_HOST.split(":")[1]));
const fns = getFunctions(app, "europe-west1");
connectFunctionsEmulator(fns, FN_HOST.split(":")[0], Number(FN_HOST.split(":")[1]));
const call = (name, data) => httpsCallable(fns, name)(data).then((r) => r.data);
const answer = (d) => call("guldrushAnswer", d);
const openChest = (d) => call("guldrushOpenChest", d);
const chooseVictim = (d) => call("guldrushChooseVictim", d);

const PW = "guld563";
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
const gold = async (sid, uid) => (await adb.doc(`liveSessions/${sid}/grPlayers/${uid}`).get()).get("gold");
let n = 0;
const att = () => `e2e-${Date.now().toString(36)}-${n++}`;
// Egna uid:n och egen klass – functions-update-login.test.mjs kör parallellt
// mot samma emulatorer (omar, classes/4b …).
const ELEVER = ["gralma", "gromar", "grleo", "grines", "grbo"];

after(async () => {
  await signOut(auth).catch(() => {});
  await deleteApp(app).catch(() => {});
  await adminApp.delete().catch(() => {});
});

async function session(sid, over = {}) {
  await adb.doc(`liveSessions/${sid}`).set({
    name: "Guldrushen 4B", format: "guldrush", gameMode: "multiplication_0_10", answerKind: "free",
    participatingClassIds: ["gr4b"], classNames: { "gr4b": "4B" }, durationSeconds: 600, countdownSeconds: 4,
    status: "live", stealSwap: true, showNames: true, createdBy: "larare1", createdAt: Timestamp.now(),
    startedAt: Timestamp.fromMillis(Date.now() - 60_000), ...over,
  });
  for (const uid of ELEVER) {
    await adb.doc(`liveSessions/${sid}/players/${uid}`).set({ uid, classId: "gr4b", name: uid, correct: 0, incorrect: 0 });
  }
}
async function setGold(sid, uid, g, extra = {}) {
  await adb.doc(`liveSessions/${sid}/grPlayers/${uid}`).set({
    uid, classId: "gr4b", name: uid, gold: g, correct: 0, incorrect: 0, chests: 0, shield: false,
    protectedUntil: null, lastVictimUid: null, pending: null, lastHit: null, ...extra,
  }, { merge: true });
}
const pending = (kind) => ({
  kind, chest: kind === "steal" ? "stold" : "byte", attemptId: "seed-attempt",
  at: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 10_000),
});

test("seed: elever i egen klass gr4b, en pågående och en slut Guldrush-match", async () => {
  for (const uid of ELEVER) {
    await admin.auth(adminApp).createUser({ uid, email: email(uid), password: PW }).catch(() => {});
    await adb.doc(`students/${uid}`).set({ namn: uid });
  }
  await adb.doc("classes/gr4b").set({ name: "4B", studentIds: ELEVER });
  await session("gr");
  await session("gr-slut", { startedAt: Timestamp.fromMillis(Date.now() - 11 * 60_000) });
  await session("gr-snall", { stealSwap: false });
});

test("utloggad nekas; elev som inte gått med nekas", async () => {
  await signOut(auth).catch(() => {});
  assert.equal(await errCode(answer({ sid: "gr", attemptId: att(), factorA: 2, factorB: 2, answer: 4 })), "unauthenticated");
  await adb.doc("liveSessions/gr/players/grbo").delete();
  await as("grbo");
  assert.equal(await errCode(answer({ sid: "gr", attemptId: att(), factorA: 2, factorB: 2, answer: 4 })), "permission-denied");
});

test("test 13 + 19: rätt svar → en kista, guldet uppdateras; samma kista två gånger och kista utan rätt svar nekas", async () => {
  await as("gralma");
  const id = att();
  const r = await answer({ sid: "gr", attemptId: id, factorA: 6, factorB: 7, answer: 42 });
  assert.equal(r.correct, true);
  const c = await openChest({ sid: "gr", attemptId: id, chestIndex: 1 });
  assert.ok(typeof c.chest === "string" && typeof c.gold === "number");
  const mine = (await getDoc(doc(cdb, "liveSessions/gr/grPlayers/gralma"))).data();
  assert.equal(mine.gold, c.gold, "eleven läser sitt guld");
  if (c.pending) await chooseVictim({ sid: "gr", victimUid: null });
  await new Promise((res) => setTimeout(res, 1100));
  assert.equal(await errCode(openChest({ sid: "gr", attemptId: id, chestIndex: 0 })), "already-exists");
  const wrong = att();
  assert.equal((await answer({ sid: "gr", attemptId: wrong, factorA: 6, factorB: 7, answer: 41 })).correct, false);
  assert.equal(await errCode(openChest({ sid: "gr", attemptId: wrong, chestIndex: 0 })), "failed-precondition");
  assert.equal(await errCode(openChest({ sid: "gr", attemptId: "hittat-pa-123", chestIndex: 0 })), "permission-denied");
});

test("test 19: skriva guld, kistor, skydd eller händelser direkt nekas av reglerna", async () => {
  await as("gralma");
  assert.equal(await errCode(updateDoc(doc(cdb, "liveSessions/gr/grPlayers/gralma"), { gold: 10000 })), "permission-denied");
  assert.equal(await errCode(setDoc(doc(cdb, "liveSessions/gr/grPlayers/gromar"), { uid: "gromar", gold: 0 })), "permission-denied");
  assert.equal(await errCode(setDoc(doc(cdb, "liveSessions/gr/grEvents/fusk"), { type: "chest", chest: "skattkammare", uid: "gralma" })), "permission-denied");
  assert.equal(await errCode(setDoc(doc(cdb, "liveSessions/gr/answers/fusk-00001"), {
    uid: "gralma", classId: "gr4b", mode: "multiplication_0_10", factorA: 1, factorB: 1, answer: 1, correctAnswer: 1,
    isCorrect: true, shard: 0, at: serverTimestamp(),
  })), "permission-denied");
});

test("test 15: Omar får Stöld och väljer Alma → Alma 85, Omar +15", async () => {
  await setGold("gr", "gralma", 100, { protectedUntil: null });
  await setGold("gr", "gromar", 0, { pending: pending("steal"), lastVictimUid: null });
  await as("gromar");
  const r = await chooseVictim({ sid: "gr", victimUid: "gralma" });
  assert.deepEqual([r.result, r.amount, r.gold, r.victimGold], ["steal", 15, 15, 85]);
  assert.deepEqual([await gold("gr", "gralma"), await gold("gr", "gromar")], [85, 15]);
  const ev = (await adb.collection("liveSessions/gr/grEvents").where("type", "==", "steal").get()).docs.map((d) => d.data());
  assert.ok(ev.some((e) => e.uid === "gromar" && e.victimUid === "gralma" && e.amount === 15));
});

test("test 16: Alma blev just bestulen → Leos manipulerade anrop nekas", async () => {
  await setGold("gr", "grleo", 10, { pending: pending("steal") });
  await as("grleo");
  assert.equal(await errCode(chooseVictim({ sid: "gr", victimUid: "gralma" })), "failed-precondition");
  assert.equal(await gold("gr", "gralma"), 85);
});

test("test 17: Ines (minst guld) försöker byta med någon som har mindre → nekas", async () => {
  await setGold("gr", "grines", 5, { pending: pending("swap") });
  await setGold("gr", "grbo", 2);
  await adb.doc("liveSessions/gr/players/grbo").set({ uid: "grbo", classId: "gr4b", name: "grbo" });
  await as("grines");
  assert.equal(await errCode(chooseVictim({ sid: "gr", victimUid: "grbo" })), "failed-precondition");
  assert.deepEqual([await gold("gr", "grines"), await gold("gr", "grbo")], [5, 2]);
});

test("test 18: stöld & byte av → ett manipulerat väntande val ger bara en guldkista", async () => {
  await setGold("gr-snall", "grleo", 100);
  await setGold("gr-snall", "gromar", 0, { pending: pending("steal") });
  await as("gromar");
  const r = await chooseVictim({ sid: "gr-snall", victimUid: "grleo" });
  assert.equal(r.result, "fallback");
  assert.equal(await gold("gr-snall", "grleo"), 100);
});

test("test 20: svara och öppna efter tid ute nekas", async () => {
  const id = "efter-tid-0001";
  await adb.doc(`liveSessions/gr-slut/answers/${id}`).set({ uid: "gralma", isCorrect: true, format: "guldrush" });
  await setGold("gr-slut", "gralma", 0);
  await as("gralma");
  assert.equal(await errCode(answer({ sid: "gr-slut", attemptId: att(), factorA: 2, factorB: 2, answer: 4 })), "failed-precondition");
  assert.equal(await errCode(openChest({ sid: "gr-slut", attemptId: id, chestIndex: 0 })), "failed-precondition");
  assert.equal(await gold("gr-slut", "gralma"), 0);
});
