// ============================================================================
// Testaren #847: Live räknas in i Mattematchen genom de RIKTIGA callables i
// functions-emulatorn (datakuppAnswer + msAgera, som klienten anropar dem):
// rätt → scores/studentStats/classCounters +1, fel → incorrect, omförsöket
// räknas inte, inga MM-mynt (studentData orört), Live-räkningen som förut.
// Kräver emulatorerna functions,auth,firestore (FUNCTIONS_EMULATOR_HOST).
// ============================================================================

import assert from "node:assert/strict";
import { test, after } from "node:test";
import admin from "firebase-admin";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, connectAuthEmulator } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { multFor } from "../functions/meteorstorm/ms-anrop.js";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
process.env.FIRESTORE_EMULATOR_HOST = FS_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

const adminApp = admin.initializeApp({ projectId: PROJECT_ID }, "mm847-fn-admin");
const adb = adminApp.firestore();
const { Timestamp } = admin.firestore;
const app = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT_ID }, "mm847-fn-client");
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
const fns = getFunctions(app, "europe-west1");
connectFunctionsEmulator(fns, FN_HOST.split(":")[0], Number(FN_HOST.split(":")[1]));
const call = (name, data) => httpsCallable(fns, name)(data).then((r) => r.data);

const PW = "mm847pw";
const email = (u) => `${u}@elev.pluggportalen.local`;
const as = async (uid) => { await signOut(auth).catch(() => {}); await signInWithEmailAndPassword(auth, email(uid), PW); };
let n = 0;
const att = () => `mm847-${Date.now().toString(36)}-${n++}`;
const CID = "mm847cb";
const H = 3600 * 1000;
const mm = async (sub, id) => (await adb.doc(`mathCompetitions/${CID}/${sub}/${id}`).get()).data();

after(async () => {
  await signOut(auth).catch(() => {});
  await deleteApp(app).catch(() => {});
  await adb.doc(`mathCompetitions/${CID}`).delete().catch(() => {});
  await adminApp.delete().catch(() => {});
});

test("seed: elev i k847 + aktiv Mattematch för k847", async () => {
  for (const uid of ["mmdk", "mmms"]) {
    await admin.auth(adminApp).createUser({ uid, email: email(uid), password: PW }).catch(() => {});
    await adb.doc(`students/${uid}`).set({ namn: uid });
  }
  await adb.doc("classes/k847").set({ name: "4X", studentIds: ["mmdk", "mmms"] });
  await adb.doc(`mathCompetitions/${CID}`).set({
    name: "MM 847 callable", participatingClassIds: ["k847"], status: "active", counterShards: 2,
    startAt: Timestamp.fromMillis(Date.now() - H), endAt: Timestamp.fromMillis(Date.now() + H), createdBy: "larare1",
  });
});

test("datakuppAnswer: rätt +1, fel incorrect, omförsök räknas inte, inga MM-mynt", async () => {
  await adb.doc("liveSessions/dk847").set({
    name: "Datakuppen 4X", format: "datakuppen", gameMode: "multiplication_0_10", answerKind: "free",
    participatingClassIds: ["k847"], classNames: { k847: "4X" }, durationSeconds: 600, countdownSeconds: 4,
    status: "live", hacking: true, showNames: true, createdBy: "larare1", createdAt: Timestamp.now(),
    startedAt: Timestamp.fromMillis(Date.now() - 60_000),
  });
  await adb.doc("liveSessions/dk847/players/mmdk").set({ uid: "mmdk", classId: "k847", name: "Mmdk", correct: 0, incorrect: 0 });
  await as("mmdk");
  const id = att();
  assert.equal((await call("datakuppAnswer", { sid: "dk847", attemptId: id, factorA: 7, factorB: 8, answer: 56 })).correct, true);
  await call("datakuppAnswer", { sid: "dk847", attemptId: id, factorA: 7, factorB: 8, answer: 56 }); // omförsök
  assert.equal((await call("datakuppAnswer", { sid: "dk847", attemptId: att(), factorA: 3, factorB: 9, answer: 28 })).correct, false);
  const st = await mm("studentStats", "mmdk");
  assert.deepEqual([st.correct, st.incorrect, st.c7, st.c8, st.w3, st.w9], [1, 1, 1, 1, 1, 1]);
  assert.equal((await mm("scores", "mmdk")).correct, 1);
  const cc = (await adb.collection(`mathCompetitions/${CID}/classCounters`).get()).docs.reduce((s, d) => s + d.get("correct"), 0);
  assert.equal(cc, 1);
  assert.equal((await adb.doc("studentData/mmdk").get()).exists, false, "inga MM-mynt");
  const p = (await adb.doc("liveSessions/dk847/dkPlayers/mmdk").get()).data();
  assert.deepEqual([p.correct, p.incorrect], [1, 1], "Live-räkningen");
});

test("msAgera: rätt svar i en länk räknas i Mattematchen", async () => {
  await adb.doc("liveSessions/ms847").set({
    name: "Meteorstormen", format: "meteorstorm", gameMode: "multiplication_0_10", answerKind: "free",
    participatingClassIds: ["k847"], classNames: { k847: "4X" }, durationSeconds: 600, countdownSeconds: 4,
    status: "live", createdBy: "larare1", msSeed: 4711, msInstallningar: { lage: "en-klass" },
    showNames: true, startedAt: Timestamp.fromMillis(Date.now() - 60_000),
  });
  await adb.doc("liveSessions/ms847/players/mmms").set({ uid: "mmms", classId: "k847", name: "Mmms", correct: 0, incorrect: 0, joinedAt: Timestamp.fromMillis(Date.now() - 70_000) });
  await as("mmms");
  const { a, b } = multFor(4711, "mmms", 0);
  const r = await call("msAgera", { sid: "ms847", attemptId: att(), typ: "skold", svar: { k: 0, factorA: a, factorB: b, answer: a * b } });
  assert.ok(r);
  const st = await mm("studentStats", "mmms");
  assert.equal(st?.correct, 1, JSON.stringify(r));
  assert.equal((await mm("scores", "mmms")).correct, 1);
  assert.equal((await adb.doc("studentData/mmms").get()).exists, false, "inga MM-mynt");
});
