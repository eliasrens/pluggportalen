// ============================================================================
// E2E: Bråkresan-callables (#708) mot Functions- + Auth- + Firestore-
// EMULATORERNA, anropade exakt som klienten (src/brakresan/data.js,
// httpsCallable europe-west1). Kärnans gränsfall testas med styrd klocka i
// functions-brakresan-core/-avslut.test.mjs – här: inloggning, roller och
// att inget går förbi servern.
//
//   utloggad → unauthenticated; lärare (admin/årskurskonto) → permission-denied
//   en stubbe → failed-precondition; skräp → invalid-argument
//   eleven läser inte facit och skriver inga stjärnor/mynt/omgångar själv
//   guldjakten (#715): ägget nekas, en jakt per dag och elev även vid samtidiga anrop
//   hel omgång (om någon utmaning är byggd): svar, låst första svar,
//   avslut, belöning, omförsök utan dubbla mynt
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
import { loadAllChallenges } from "../functions/brakresan/utmaningar/index.js";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
process.env.FIRESTORE_EMULATOR_HOST = FS_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

const adminApp = admin.initializeApp({ projectId: PROJECT_ID }, "br-fn-admin");
const adb = adminApp.firestore();

const app = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT_ID }, "br-fn-client");
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
const cdb = getFirestore(app);
connectFirestoreEmulator(cdb, FS_HOST.split(":")[0], Number(FS_HOST.split(":")[1]));
const fns = getFunctions(app, "europe-west1");
connectFunctionsEmulator(fns, FN_HOST.split(":")[0], Number(FN_HOST.split(":")[1]));
const call = (name, d) => httpsCallable(fns, name)(d).then((r) => r.data);

const PW = "brak708x";
const ELEV = "breelev";
const ANNAN = "breannan";
const LARARE = "brelarare";
const AK = "brearskurs";
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

const built = (await loadAllChallenges()).find((c) => c.implemented) || null;
const STUB = (await loadAllChallenges()).find((c) => !c.implemented) || null;

after(async () => {
  await signOut(auth).catch(() => {});
  await deleteApp(app).catch(() => {});
  await adminApp.delete().catch(() => {});
});

test("seed: två elever, en admin och ett årskurskonto", async () => {
  const a = admin.auth(adminApp);
  for (const uid of [ELEV, ANNAN, LARARE, AK]) {
    await a.createUser({ uid, email: email(uid), password: PW }).catch(() => {});
  }
  await a.setCustomUserClaims(LARARE, { teacher: true, admin: true });
  await a.setCustomUserClaims(AK, { teacher: true, role: "arskurs" });
  await adb.doc(`teacherAccounts/${AK}`).set({ role: "arskurs", active: true, classIds: ["bre5a"] });
  await adb.doc("classes/bre5a").set({ name: "5A", studentIds: [ELEV, ANNAN] });
  for (const uid of [ELEV, ANNAN]) {
    await adb.recursiveDelete(adb.doc(`studentData/${uid}`));
    await adb.doc(`studentData/${uid}`).set({ coins: 50 });
  }
});

test("utloggad och lärare nekas – inget lärarflöde muterar elevdata", async () => {
  await signOut(auth).catch(() => {});
  assert.equal(await errCode(call("brakresaStartRound", { challengeId: "03" })), "unauthenticated");
  for (const uid of [LARARE, AK]) {
    await as(uid);
    for (const name of ["brakresaStartRound", "brakresaAnswer", "brakresaRework", "brakresaFinishRound", "brakresaAbortRound", "brakresaAckDragon", "brakresaHunt"]) {
      assert.equal(await errCode(call(name, { challengeId: "03", roundId: "abcdefghijkl", index: 0, answer: {}, level: 1 })), "permission-denied", `${uid} ${name}`);
    }
  }
  assert.equal((await adb.doc(`studentData/${ELEV}/brakresa/state`).get()).exists, false);
});

test("skräp → invalid-argument; en stubbe → failed-precondition", async () => {
  await as(ELEV);
  assert.equal(await errCode(call("brakresaStartRound", { challengeId: "99" })), "invalid-argument");
  assert.equal(await errCode(call("brakresaAnswer", { roundId: "../../x", index: 0, answer: {} })), "invalid-argument");
  assert.equal(await errCode(call("brakresaFinishRound", { roundId: "finnsinteallsxx" })), "not-found");
  if (STUB) assert.equal(await errCode(call("brakresaStartRound", { challengeId: STUB.id })), "failed-precondition");
});

test("eleven skriver aldrig stjärnor, mynt-händelser eller omgångar själv", async () => {
  await as(ELEV);
  const sub = (s, id) => doc(cdb, "studentData", ELEV, s, id);
  assert.equal(await errCode(setDoc(sub("brakresa", "state"), { totalStars: 150 })), "permission-denied");
  assert.equal(await errCode(setDoc(sub("brakresaRewards", "stjarna-03-1"), { amount: 40 })), "permission-denied");
  assert.equal(await errCode(setDoc(sub("brakresaRounds", "abcdefghijkl"), { status: "avslutad", correctCount: 10 })), "permission-denied");
  assert.equal(await errCode(getDoc(doc(cdb, "brakresaSecrets", "abcdefghijkl"))), "permission-denied");
});

test("guldjakten (#715): ägget nekas; samtidiga anrop → en jaktpost och en överföring", async () => {
  await as(ANNAN);
  assert.equal(await errCode(call("brakresaHunt", {})), "failed-precondition", "ingen drake = ingen jakt");
  await as(ELEV);
  await adb.doc(`studentData/${ELEV}/brakresa/state`).set({
    totalStars: 110, dragon: { id: `drake-${ELEV}`, name: "Bråkis", levelShown: 11 }, hunts: { count: 0, coins: 0, lastDate: null },
  }, { merge: true });
  const fore = (await adb.doc(`studentData/${ELEV}`).get()).data().coins;
  // Klientens "datum", "nivå" och "belopp" ignoreras – servern bestämmer.
  const svar = await Promise.all([1, 2, 3].map(() => call("brakresaHunt", { date: "2030-01-01", level: 15, amount: 200 })));
  assert.equal(new Set(svar.map((s) => s.amount)).size, 1);
  assert.equal(svar.filter((s) => !s.already).length, 1);
  const [{ amount, date, level, max }] = svar;
  assert.deepEqual([level, max], [11, 120]);
  assert.ok(amount >= 1 && amount <= 120);
  assert.notEqual(date, "2030-01-01");
  assert.equal((await adb.doc(`studentData/${ELEV}`).get()).data().coins, fore + amount);
  assert.equal((await adb.collection(`studentData/${ELEV}/brakresaHunts`).get()).size, 1);
  // Eleven läser sin jaktpost men skriver den aldrig.
  assert.equal((await getDoc(doc(cdb, "studentData", ELEV, "brakresaHunts", date))).data().amount, amount);
  assert.equal(await errCode(setDoc(doc(cdb, "studentData", ELEV, "brakresaHunts", "2030-01-01"), { amount: 200 })), "permission-denied");
  await as(ANNAN);
  assert.equal(await errCode(getDoc(doc(cdb, "studentData", ELEV, "brakresaHunts", date))), "permission-denied");
  // Återställ så att hela omgången nedan börjar från ett känt saldo.
  await adb.recursiveDelete(adb.doc(`studentData/${ELEV}`));
  await adb.doc(`studentData/${ELEV}`).set({ coins: 50 });
});

test("hel omgång genom callables: låst första svar, belöning en gång", { skip: !built && "ingen av de 50 utmaningarna är byggd ännu" }, async () => {
  await as(ELEV);
  const s = await call("brakresaStartRound", { challengeId: built.id });
  assert.equal(s.round.tasks.length, 10);
  assert.ok(s.round.tasks.every((t) => !("key" in t)), "inget facit till klienten");
  const again = await call("brakresaStartRound", { challengeId: built.id });
  assert.equal(again.roundId, s.roundId);
  // Facit läses bara av testet (Admin SDK).
  const secret = (await adb.doc(`brakresaSecrets/${s.roundId}`).get()).data();
  assert.equal(await errCode(getDoc(doc(cdb, "brakresaSecrets", s.roundId))), "permission-denied");
  for (let i = 0; i < 10; i++) {
    const ex = secret.tasks[i].key.examples;
    const r = await call("brakresaAnswer", { roundId: s.roundId, index: i, answer: i < 8 ? ex.right[0] : ex.wrong[0], helpBefore: i === 0 ? ["orientering"] : [] });
    assert.equal(r.status, "graded");
    assert.equal(r.correct, i < 8);
  }
  const igen = await call("brakresaAnswer", { roundId: s.roundId, index: 9, answer: secret.tasks[9].key.examples.right[0] });
  assert.deepEqual([igen.already, igen.correct], [true, false]);
  // Klienten kan inte skriva om sitt eget svar.
  assert.equal(await errCode(updateDoc(doc(cdb, "studentData", ELEV, "brakresaRounds", s.roundId), { correctCount: 10 })), "permission-denied");
  await as(ANNAN);
  assert.equal(await errCode(call("brakresaFinishRound", { roundId: s.roundId })), "not-found");
  assert.equal(await errCode(getDoc(doc(cdb, "studentData", ELEV, "brakresaRounds", s.roundId))), "permission-denied");
  await as(ELEV);
  const [f1, f2] = await Promise.all([call("brakresaFinishRound", { roundId: s.roundId }), call("brakresaFinishRound", { roundId: s.roundId })]);
  assert.equal(f1.reward.kind, "stjarna");
  assert.equal(f2.reward.kind, "stjarna");
  assert.equal((await getDoc(doc(cdb, "studentData", ELEV))).data().coins, 90, "40 mynt en gång");
  const st = (await getDoc(doc(cdb, "studentData", ELEV, "brakresa", "state"))).data();
  assert.deepEqual([st.totalStars, st.challenges[built.id].helpBefore, st.challenges[built.id].firstCorrect], [1, 1, 8]);
});
