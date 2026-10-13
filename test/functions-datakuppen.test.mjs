// ============================================================================
// E2E: Datakuppens Cloud Functions (datakuppAnswer / datakuppOpenFile /
// datakuppChooseTarget / datakuppGuessCode / datakuppPickCode, #652) mot
// Functions- + Auth- + Firestore-EMULATORERNA. Eleverna loggar in på riktigt och
// anropar exakt som elevsidan (httpsCallable, europe-west1); deras direkta
// läsningar/skrivningar går genom firestore.rules. ALLA TIO attacker i spec
// docs/UTVECKLINGSUPPDRAG_DATAKUPPEN.md §2 ska nekas:
//   1 öppna samma fil två gånger          6 gissa kod mot ett annat mål
//   2 öppna en fil utan rätt svar         7 gissa flera gånger på samma hack
//   3 skriva data direkt                  8 hacka en skyddad elev
//   4 läsa en annan elevs kod             9 skicka en egen påhittad kod som "vald kod"
//   5 gissa kod utan att ha fått ett Hack 10 svara efter att tiden tagit slut
// + hela flödet: kod i lobbyn → rätt svar → fil → hack med rätt kod.
// Kärnan med styrd klocka/slump: functions-datakuppen-core/-hack.test.mjs.
//
// Körs via:  npm run test:functions  (kräver `npm --prefix functions install`)
// ============================================================================

import assert from "node:assert/strict";
import { test, after } from "node:test";
import admin from "firebase-admin";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, connectAuthEmulator } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
process.env.FIRESTORE_EMULATOR_HOST = FS_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

const adminApp = admin.initializeApp({ projectId: PROJECT_ID }, "dk-fn-admin");
const adb = adminApp.firestore();
const { Timestamp } = admin.firestore;

const app = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT_ID }, "dk-fn-client");
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
const cdb = getFirestore(app);
connectFirestoreEmulator(cdb, FS_HOST.split(":")[0], Number(FS_HOST.split(":")[1]));
const fns = getFunctions(app, "europe-west1");
connectFunctionsEmulator(fns, FN_HOST.split(":")[0], Number(FN_HOST.split(":")[1]));
const call = (name, data) => httpsCallable(fns, name)(data).then((r) => r.data);
const answer = (d) => call("datakuppAnswer", d);
const openFile = (d) => call("datakuppOpenFile", d);
const chooseTarget = (d) => call("datakuppChooseTarget", d);
const guessCode = (d) => call("datakuppGuessCode", d);
const pickCode = (d) => call("datakuppPickCode", d);

const PW = "data652";
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
const gold = async (sid, uid) => (await adb.doc(`liveSessions/${sid}/dkPlayers/${uid}`).get()).get("gold");
const secretCode = async (sid, uid) => (await adb.doc(`liveSessions/${sid}/dkSecret/${uid}`).get()).get("code");
let n = 0;
const att = () => `e2e-${Date.now().toString(36)}-${n++}`;
// Egna uid:n och egen klass – andra functions-tester kör mot samma emulatorer.
const ELEVER = ["dkalma", "dkomar", "dkleo", "dkines"];

after(async () => {
  await signOut(auth).catch(() => {});
  await deleteApp(app).catch(() => {});
  await adminApp.delete().catch(() => {});
});

async function session(sid, over = {}) {
  await adb.doc(`liveSessions/${sid}`).set({
    name: "Datakuppen 4B", format: "datakuppen", gameMode: "multiplication_0_10", answerKind: "free",
    participatingClassIds: ["dk4b"], classNames: { dk4b: "4B" }, durationSeconds: 600, countdownSeconds: 4,
    status: "live", hacking: true, showNames: true, createdBy: "larare1", createdAt: Timestamp.now(),
    startedAt: Timestamp.fromMillis(Date.now() - 60_000), ...over,
  });
  for (const uid of ELEVER) {
    await adb.doc(`liveSessions/${sid}/players/${uid}`).set({ uid, classId: "dk4b", name: uid, correct: 0, incorrect: 0 });
  }
}
async function setGold(sid, uid, g, extra = {}) {
  await adb.doc(`liveSessions/${sid}/dkPlayers/${uid}`).set({
    uid, classId: "dk4b", name: uid, gold: g, correct: 0, incorrect: 0, chests: 0,
    protectedUntil: null, lastVictimUid: null, pending: null, lastHit: null, ...extra,
  }, { merge: true });
}
async function setCode(sid, uid, kod) {
  const st = { uid, code: kod, codeVersion: 1, offers: null, offersExpiresAt: null };
  await adb.doc(`liveSessions/${sid}/dkSecret/${uid}`).set(st);
  await adb.doc(`liveSessions/${sid}/dkSelf/${uid}`).set(st);
}
/** Ett Hack ur en slumpad fil: låt tiden gå ut (servern väljer mål, gissningen uteblir). */
async function finishHack(sid) {
  const t = await chooseTarget({ sid, targetUid: null });
  if (t.result === "target") await guessCode({ sid, index: null });
}
const hackPending = () => ({
  kind: "steal", chest: "hack", attemptId: "seed-attempt", at: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 10_000),
});

test("seed: elever i egen klass dk4b, en lobby, en pågående och en slut Datakupp", async () => {
  for (const uid of ELEVER) {
    await admin.auth(adminApp).createUser({ uid, email: email(uid), password: PW }).catch(() => {});
    await adb.doc(`students/${uid}`).set({ namn: uid });
  }
  await adb.doc("classes/dk4b").set({ name: "4B", studentIds: ELEVER });
  await session("dk-lobby", { status: "lobby", startedAt: null });
  await session("dk");
  await session("dk-slut", { startedAt: Timestamp.fromMillis(Date.now() - 11 * 60_000) });
});

test("utloggad nekas", async () => {
  await signOut(auth).catch(() => {});
  assert.equal(await errCode(pickCode({ sid: "dk-lobby" })), "unauthenticated");
  assert.equal(await errCode(answer({ sid: "dk", attemptId: att(), factorA: 2, factorB: 2, answer: 4 })), "unauthenticated");
});

test("lobbyn: 4 kodförslag ur listan, eleven väljer med ett index och läser sin kod – bara sin egen", async () => {
  await as("dkalma");
  const r = await pickCode({ sid: "dk-lobby" });
  assert.equal(r.offers.length, 4);
  const val = await pickCode({ sid: "dk-lobby", index: 3 });
  assert.equal(val.code, r.offers[3]);
  assert.equal((await getDoc(doc(cdb, "liveSessions/dk-lobby/dkSelf/dkalma"))).get("code"), r.offers[3]);
});

test("§2.9: en egen påhittad kod som 'vald kod' nekas", async () => {
  await as("dkomar");
  await pickCode({ sid: "dk-lobby" });
  assert.equal(await errCode(pickCode({ sid: "dk-lobby", index: "mittlosen123" })), "invalid-argument");
  assert.equal(await errCode(setDoc(doc(cdb, "liveSessions/dk-lobby/dkSelf/dkomar"), { code: "mittlosen123" })), "permission-denied");
  await pickCode({ sid: "dk-lobby", code: "mittlosen123" });
  assert.notEqual(await secretCode("dk-lobby", "dkomar"), "mittlosen123");
});

test("§2.4: läsa en annan elevs kod nekas (elevdokumentet och serverns hemliga dokument)", async () => {
  await as("dkomar");
  assert.equal(await errCode(getDoc(doc(cdb, "liveSessions/dk-lobby/dkSelf/dkalma"))), "permission-denied");
  assert.equal(await errCode(getDoc(doc(cdb, "liveSessions/dk-lobby/dkSecret/dkalma"))), "permission-denied");
  assert.equal(await errCode(getDoc(doc(cdb, "liveSessions/dk-lobby/dkSecret/dkomar"))), "permission-denied");
});

test("hela flödet: rätt svar → fil → (Hack) → rätt kod → 15 % flyttas", async () => {
  await setGold("dk", "dkalma", 100);
  await setCode("dk", "dkalma", "f0tb01l");
  await as("dkomar");
  const id = att();
  assert.equal((await answer({ sid: "dk", attemptId: id, factorA: 6, factorB: 7, answer: 42 })).correct, true);
  const f = await openFile({ sid: "dk", attemptId: id, fileIndex: 1 });
  assert.ok(typeof f.file === "string" && typeof f.gold === "number");
  assert.equal((await getDoc(doc(cdb, "liveSessions/dk/dkPlayers/dkomar"))).get("gold"), f.gold, "eleven läser sin data");
  if (f.pending) await finishHack("dk");
  // Ett Hack (seedat, slumpen är riktig crypto här): välj Alma, gissa rätt.
  await setGold("dk", "dkomar", 0, { pending: hackPending(), lastVictimUid: null });
  const t = await chooseTarget({ sid: "dk", targetUid: "dkalma" });
  assert.equal(t.options.length, 3);
  const r = await guessCode({ sid: "dk", index: t.options.indexOf("f0tb01l") });
  assert.deepEqual([r.result, r.amount], ["hacked", 15]);
  assert.deepEqual([await gold("dk", "dkalma"), await gold("dk", "dkomar")], [85, 15]);
  await as("dkalma");
  assert.equal((await getDoc(doc(cdb, "liveSessions/dk/dkSelf/dkalma"))).get("offers").length, 4, "Alma får välja ny kod");
});

test("§2.1 + §2.2: samma fil två gånger, fil utan rätt svar", async () => {
  await as("dkleo");
  const id = att();
  await answer({ sid: "dk", attemptId: id, factorA: 3, factorB: 3, answer: 9 });
  const f = await openFile({ sid: "dk", attemptId: id, fileIndex: 0 });
  if (f.pending) await finishHack("dk");
  await new Promise((res) => setTimeout(res, 1100));
  assert.equal(await errCode(openFile({ sid: "dk", attemptId: id, fileIndex: 2 })), "already-exists");
  const wrong = att();
  assert.equal((await answer({ sid: "dk", attemptId: wrong, factorA: 3, factorB: 3, answer: 10 })).correct, false);
  assert.equal(await errCode(openFile({ sid: "dk", attemptId: wrong, fileIndex: 0 })), "failed-precondition");
  assert.equal(await errCode(openFile({ sid: "dk", attemptId: "hittat-pa-123", fileIndex: 0 })), "permission-denied");
});

test("§2.3: skriva data, skydd, hack eller händelser direkt nekas av reglerna", async () => {
  await as("dkleo");
  assert.equal(await errCode(updateDoc(doc(cdb, "liveSessions/dk/dkPlayers/dkleo"), { gold: 10000 })), "permission-denied");
  assert.equal(await errCode(updateDoc(doc(cdb, "liveSessions/dk/dkPlayers/dkleo"), { pending: { kind: "steal", chest: "hack" } })), "permission-denied");
  assert.equal(await errCode(setDoc(doc(cdb, "liveSessions/dk/dkEvents/fusk"), { type: "steal", chest: "hack", uid: "dkleo" })), "permission-denied");
  assert.equal(await errCode(setDoc(doc(cdb, "liveSessions/dk/answers/fusk-00001"), {
    uid: "dkleo", classId: "dk4b", mode: "multiplication_0_10", factorA: 1, factorB: 1, answer: 1, correctAnswer: 1,
    isCorrect: true, shard: 0,
  })), "permission-denied");
});

test("§2.5: gissa kod utan att ha fått ett Hack nekas", async () => {
  await setGold("dk", "dkines", 0, { pending: null });
  await as("dkines");
  assert.equal(await errCode(guessCode({ sid: "dk", index: 0 })), "failed-precondition");
  assert.equal(await errCode(chooseTarget({ sid: "dk", targetUid: "dkalma" })), "failed-precondition");
});

test("§2.6 + §2.7: gissa mot ett annat mål, och gissa två gånger på samma hack, nekas", async () => {
  await setGold("dk", "dkleo", 200, { protectedUntil: null });
  await setCode("dk", "dkleo", "r0b0t");
  await setGold("dk", "dkines", 0, { pending: hackPending(), lastVictimUid: null });
  await as("dkines");
  const t = await chooseTarget({ sid: "dk", targetUid: "dkleo" });
  assert.equal(await errCode(guessCode({ sid: "dk", index: 0, targetUid: "dkalma" })), "permission-denied");
  const wrong = t.options.findIndex((c) => c !== "r0b0t");
  assert.equal((await guessCode({ sid: "dk", index: wrong })).result, "wrong");
  assert.equal(await errCode(guessCode({ sid: "dk", index: t.options.indexOf("r0b0t") })), "failed-precondition");
  assert.equal(await gold("dk", "dkleo"), 200);
});

test("§2.8: hacka en skyddad elev nekas (manipulerat anrop), valet ligger kvar", async () => {
  await setGold("dk", "dkleo", 200, { protectedUntil: Timestamp.fromMillis(Date.now() + 60_000) });
  await setGold("dk", "dkines", 0, { pending: hackPending(), lastVictimUid: null });
  await as("dkines");
  const err = await chooseTarget({ sid: "dk", targetUid: "dkleo" }).then(() => null, (e) => e);
  assert.equal(String(err?.code).replace(/^functions\//, ""), "failed-precondition");
  assert.equal(err?.message, "🛡️ dkleo hann starta en brandvägg!");
  assert.ok((await adb.doc("liveSessions/dk/dkPlayers/dkines").get()).get("pending"), "valet ligger kvar");
  assert.equal(await gold("dk", "dkleo"), 200);
});

test("§2.10: svara, öppna fil, hacka eller gissa efter att tiden tagit slut nekas", async () => {
  const id = "efter-tid-0001";
  await adb.doc(`liveSessions/dk-slut/answers/${id}`).set({ uid: "dkalma", isCorrect: true, format: "datakuppen" });
  await setGold("dk-slut", "dkalma", 0, { pending: hackPending() });
  await setGold("dk-slut", "dkomar", 100);
  await as("dkalma");
  assert.equal(await errCode(answer({ sid: "dk-slut", attemptId: att(), factorA: 2, factorB: 2, answer: 4 })), "failed-precondition");
  assert.equal(await errCode(openFile({ sid: "dk-slut", attemptId: id, fileIndex: 0 })), "failed-precondition");
  assert.equal(await errCode(chooseTarget({ sid: "dk-slut", targetUid: "dkomar" })), "failed-precondition");
  assert.equal(await errCode(guessCode({ sid: "dk-slut", index: 0 })), "failed-precondition");
  assert.equal(await errCode(pickCode({ sid: "dk-slut" })), "failed-precondition");
  assert.deepEqual([await gold("dk-slut", "dkalma"), await gold("dk-slut", "dkomar")], [0, 100]);
});
