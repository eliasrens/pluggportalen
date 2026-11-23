// ============================================================================
// E2E (Tester #910): 🎄 Jul-varorna mot callablen butikKop i Functions-, Auth- och
// Firestore-EMULATORERNA, anropad som klienten (bara { itemId }).
//
//   Jul på  → trädgård, dekor, möbel och hus säljs till KATALOGpriset
//   dekor/möbler/trädgård är multi-varor som förr (ownedCounts räknas upp,
//     andra exemplaret kostar igen) – som Halloweens hw-pumpalykta
//   Jul av, eller julUntil passerat → "säljs inte just nu", inget dras
//   för lite pengar för ett hus → nej, inget dras
//
// Körs via emulators:exec --only functions,auth,firestore (FUNCTIONS_EMULATOR_HOST).
// ============================================================================

import assert from "node:assert/strict";
import { test, after } from "node:test";
import admin from "firebase-admin";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, connectAuthEmulator } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
process.env.FIRESTORE_EMULATOR_HOST = FS_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

const adminApp = admin.initializeApp({ projectId: PROJECT_ID }, "butik-jul-admin");
const adb = adminApp.firestore();
const app = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT_ID }, "butik-jul-client");
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
const fns = getFunctions(app, "europe-west1");
connectFunctionsEmulator(fns, FN_HOST.split(":")[0], Number(FN_HOST.split(":")[1]));
const kop = (itemId, extra = {}) => httpsCallable(fns, "butikKop", { timeout: 60_000 })({ itemId, ...extra }).then((r) => r.data);

const PW = "butikjul910";
const ELEV = "julelev910";
const sd = async () => (await adb.doc(`studentData/${ELEV}`).get()).data() || {};
const satt = (data) => adb.doc(`studentData/${ELEV}`).set(data);
const sasong = (doc) => adb.doc("config/season").set({ season: "vinter", halloween: false, ...doc });

after(async () => {
  await signOut(auth).catch(() => {});
  await deleteApp(app).catch(() => {});
  await adb.doc("config/season").delete().catch(() => {});
  await adminApp.delete().catch(() => {});
});

test("seed + inloggning", async () => {
  await admin.auth(adminApp).createUser({ uid: ELEV, email: `${ELEV}@elev.pluggportalen.local`, password: PW }).catch(() => {});
  await satt({ coins: 10000, ownedItems: [], xp: 0 });
  await sasong({ jul: true, julUntil: null });
  await signInWithEmailAndPassword(auth, `${ELEV}@elev.pluggportalen.local`, PW);
});

test("Jul på: hus och trädgårdssak säljs till katalogpriset (skickat pris ignoreras)", async () => {
  const r = await kop("jul-pepparkakshus", { price: 1 });
  assert.equal(r.ok, true, JSON.stringify(r));
  let d = await sd();
  assert.equal(d.coins, 6000);
  assert.ok(d.ownedItems.includes("jul-pepparkakshus"));
  const r2 = await kop("jul-snogubbe");
  assert.equal(r2.ok, true, JSON.stringify(r2));
  d = await sd();
  assert.equal(d.coins, 5940);
});

test("trädgård/dekor/möbler är multi-varor: andra exemplaret dras och räknas (som Halloween)", async () => {
  const fore = await sd();
  const r = await kop("jul-snogubbe");
  assert.equal(r.ok, true, JSON.stringify(r));
  const d = await sd();
  assert.equal(d.coins, fore.coins - 60, "andra snögubben ska kosta 60");
  assert.equal(d.ownedCounts?.["jul-snogubbe"], 2, `ownedCounts: ${JSON.stringify(d.ownedCounts)}`);
});

test("dekor (julgran, möbel) räknas också i ownedCounts", async () => {
  await kop("jul-julgran");
  const d = await sd();
  assert.equal(d.ownedCounts?.["jul-julgran"], 1, `ownedCounts: ${JSON.stringify(d.ownedCounts)}`);
});

test("Jul av → säljs inte just nu, inget dras", async () => {
  await sasong({ jul: false });
  const fore = (await sd()).coins;
  const r = await kop("jul-kalke");
  assert.equal(r.ok, false);
  assert.equal((await sd()).coins, fore);
});

test("julUntil passerat → säljs inte, inget dras", async () => {
  await sasong({ jul: true, julUntil: admin.firestore.Timestamp.fromMillis(Date.now() - 60_000) });
  const fore = (await sd()).coins;
  const r = await kop("jul-kalke");
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal((await sd()).coins, fore);
});

test("för lite pengar för ett hus → nej, inget dras", async () => {
  await sasong({ jul: true, julUntil: null });
  await adb.doc(`studentData/${ELEV}`).update({ coins: 3999 });
  const r = await kop("jul-snohydda");
  assert.equal(r.ok, false);
  const d = await sd();
  assert.equal(d.coins, 3999);
  assert.ok(!d.ownedItems.includes("jul-snohydda"));
});
