// ============================================================================
// E2E: Hitta rätt! hittaRattSubmit (#609) mot Functions- + Auth- + Firestore-
// EMULATORERNA. Eleverna loggar in på riktigt, skapar försöket genom
// firestore.rules och anropar functionen exakt som klienten (hr-data.js,
// httpsCallable europe-west1). Varje attack ska nekas.
//
//   test 3   lika poäng → delad plats 1 (namn + klass)
//   test 6   sämre försök → personbästat ligger kvar
//   + coins, idempotent omförsök, annans försök, direkta skrivningar
// Kärnan med styrd klocka: functions-hitta-ratt-core.test.mjs.
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
  getFirestore, connectFirestoreEmulator, collection, doc, getDoc, setDoc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { PACKS } from "../functions/hitta-ratt/packs.js";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
process.env.FIRESTORE_EMULATOR_HOST = FS_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

const adminApp = admin.initializeApp({ projectId: PROJECT_ID }, "hr-fn-admin");
const adb = adminApp.firestore();

const app = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT_ID }, "hr-fn-client");
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
const cdb = getFirestore(app);
connectFirestoreEmulator(cdb, FS_HOST.split(":")[0], Number(FS_HOST.split(":")[1]));
const fns = getFunctions(app, "europe-west1");
connectFunctionsEmulator(fns, FN_HOST.split(":")[0], Number(FN_HOST.split(":")[1]));
const submit = (d) => httpsCallable(fns, "hittaRattSubmit")(d).then((r) => r.data);

const PW = "hitta609";
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
// Egna uid:n, egen klass och eget pack – andra function-tester kör parallellt.
const ELEVER = { hreomar: "Omar", hreclara: "Clara", hrealma: "Alma" };
const PACK = PACKS["europa-huvudstader-20"];

after(async () => {
  await signOut(auth).catch(() => {});
  await deleteApp(app).catch(() => {});
  await adminApp.delete().catch(() => {});
});

/** Starta ett försök SOM KLIENTEN (genom reglerna). */
async function starta(uid, packId = PACK.id) {
  const ref = doc(collection(cdb, "hittaRattAttempts"));
  await setDoc(ref, { uid, packId, startedAt: serverTimestamp(), status: "open" });
  return ref.id;
}
const svar = (exakta, kmFel = 300) =>
  PACK.items.map((it, i) => ({ itemId: it.id, lon: it.lon, lat: i < exakta ? it.lat : it.lat - kmFel / 111.2 }));

test("seed: elever i klassen hre5e (Hitta rätt! aktiverad) + en i hre6c (inte aktiverad)", async () => {
  for (const [uid, namn] of Object.entries({ ...ELEVER, hreute: "Ute" })) {
    await admin.auth(adminApp).createUser({ uid, email: email(uid), password: PW }).catch(() => {});
    await adb.doc(`students/${uid}`).set({ namn });
    await adb.doc(`studentData/${uid}`).set({ coins: 0 });
  }
  await adb.doc("classes/hre5e").set({ name: "5E", studentIds: ["hreomar", "hrealma"], enabledModules: ["hittaratt"] });
  await adb.doc("classes/hre5a").set({ name: "5A", studentIds: ["hreclara"], enabledModules: ["hittaratt"] });
  await adb.doc("classes/hre6c").set({ name: "6C", studentIds: ["hreute"] });
  for (const d of (await adb.collection("hittaRattBoards").get()).docs) if (d.id === PACK.id) await d.ref.delete();
});

test("utloggad nekas; klass utan Hitta rätt! nekas", async () => {
  await signOut(auth).catch(() => {});
  assert.equal(await errCode(submit({ attemptId: "abcdefgh12", svar: [] })), "unauthenticated");
  await as("hreute");
  const id = await starta("hreute");
  assert.equal(await errCode(submit({ attemptId: id, svar: svar(20) })), "permission-denied");
});

test("test 3: samma poäng → delad plats 1 med namn och klass; coins = godkända", async () => {
  await as("hreomar");
  const o = await submit({ attemptId: await starta("hreomar"), svar: svar(18, 40) });
  assert.equal(o.coins, 20);
  await as("hreclara");
  const c = await submit({ attemptId: await starta("hreclara"), svar: svar(18, 40) });
  assert.equal(c.result.s, o.result.s);
  assert.deepEqual(c.top.map((r) => [r.n, r.k, r.plats]), [["Clara", "5A", 1], ["Omar", "5E", 1]]);
  assert.equal((await getDoc(doc(cdb, "studentData/hreclara"))).data().coins, 20);
  const board = (await getDoc(doc(cdb, "hittaRattBoards", PACK.id))).data();
  assert.deepEqual(board.leaders, ["hreclara", "hreomar"]);
});

test("test 6 + idempotens: sämre försök ändrar inte rekordet; omförsök ger 0 nya coins", async () => {
  await as("hrealma");
  const bra = await submit({ attemptId: await starta("hrealma"), svar: svar(20) });
  assert.equal(bra.result.s, 2000);
  const id = await starta("hrealma");
  const samre = await submit({ attemptId: id, svar: svar(2, 300) });
  assert.equal(samre.nyttRekord, false);
  const igen = await submit({ attemptId: id, svar: svar(20) });
  assert.deepEqual([igen.coins, igen.result.s], [0, samre.result.s]);
  const pb = (await getDoc(doc(cdb, "hittaRattBest/hrealma"))).data().packs[PACK.id];
  assert.deepEqual([pb.s, pb.attempts], [2000, 2]);
  assert.equal((await getDoc(doc(cdb, "studentData/hrealma"))).data().coins, 20 + samre.result.godkanda);
});

test("attacker: annans försök, skriva poäng/rekord/topplista direkt, avsluta försöket själv", async () => {
  await as("hreomar");
  const omarsId = await starta("hreomar");
  await as("hreclara");
  assert.equal(await errCode(submit({ attemptId: omarsId, svar: svar(20) })), "permission-denied");
  assert.equal(await errCode(updateDoc(doc(cdb, "hittaRattBoards", PACK.id), { "entries.hreclara.s": 9999 })), "permission-denied");
  assert.equal(await errCode(updateDoc(doc(cdb, "hittaRattBoards", PACK.id), { "entries.hrealma.s": 0 })), "permission-denied");
  assert.equal(await errCode(setDoc(doc(cdb, "hittaRattBest/hreclara"), { packs: { [PACK.id]: { s: 9999 } } })), "permission-denied");
  assert.equal(await errCode(setDoc(doc(cdb, "hittaRattMeta/ledare"), { packs: { [PACK.id]: { uids: ["hreclara"] } } }, { merge: true })), "permission-denied");
  const mitt = await starta("hreclara");
  assert.equal(await errCode(updateDoc(doc(cdb, "hittaRattAttempts", mitt), { status: "done" })), "permission-denied");
  const board = (await adb.doc(`hittaRattBoards/${PACK.id}`).get()).data();
  assert.equal(board.entries.hrealma.s, 2000, "Almas rekord orört");
});
