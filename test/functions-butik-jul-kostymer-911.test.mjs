// ============================================================================
// E2E (#911): 🎄 Jul-kostymerna och Jul-avatarerna mot callablen butikKop i
// Functions-, Auth- och Firestore-EMULATORERNA, anropad som klienten ({ itemId }).
// Lärdomen från #910: de lazy julraderna finns inte i serverns SHOP_ITEMS – köpet
// ska ändå dras till katalogpriset och sparas rätt (butik-core.js LAZY_VAROR).
//
//   Jul på  → kostym (lazy katalog) och köpavatar (shop-items.js) säljs till
//     katalogpriset, hamnar i ownedItems, ingen räknare (single-varor)
//   en ägd kostym/avatar köps inte igen – inget dras
//   Jul av → "säljs inte just nu", inget dras
//   därefter: den köpta avataren kan väljas (regeln kopAvatarOk) året runt
//
// Körs via emulators:exec --only functions,auth,firestore (FUNCTIONS_EMULATOR_HOST).
// ============================================================================

import assert from "node:assert/strict";
import { test, after } from "node:test";
import admin from "firebase-admin";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, connectAuthEmulator } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { getFirestore, connectFirestoreEmulator, doc, updateDoc } from "firebase/firestore";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
process.env.FIRESTORE_EMULATOR_HOST = FS_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

const adminApp = admin.initializeApp({ projectId: PROJECT_ID }, "butik-jul911-admin");
const adb = adminApp.firestore();
const app = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT_ID }, "butik-jul911-client");
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, FS_HOST.split(":")[0], Number(FS_HOST.split(":")[1]));
const fns = getFunctions(app, "europe-west1");
connectFunctionsEmulator(fns, FN_HOST.split(":")[0], Number(FN_HOST.split(":")[1]));
const kop = (itemId, extra = {}) => httpsCallable(fns, "butikKop", { timeout: 60_000 })({ itemId, ...extra }).then((r) => r.data);

const PW = "butikjul911";
const ELEV = "julelev911";
const sd = async () => (await adb.doc(`studentData/${ELEV}`).get()).data() || {};
const sasong = (d) => adb.doc("config/season").set({ season: "vinter", halloween: false, ...d });

after(async () => {
  await signOut(auth).catch(() => {});
  await deleteApp(app).catch(() => {});
  await adb.doc("config/season").delete().catch(() => {});
  await adminApp.delete().catch(() => {});
});

test("seed + inloggning", async () => {
  await admin.auth(adminApp).createUser({ uid: ELEV, email: `${ELEV}@elev.pluggportalen.local`, password: PW }).catch(() => {});
  await adb.doc(`studentData/${ELEV}`).set({ coins: 2000, ownedItems: ["keps"], avatarId: "fox", xp: 0 });
  await sasong({ jul: true, julUntil: null });
  await signInWithEmailAndPassword(auth, `${ELEV}@elev.pluggportalen.local`, PW);
});

test("Jul på: kostymer säljs till katalogpriset (skickat pris ignoreras), single-varor", async () => {
  const r = await kop("jul-luciakrona", { price: 1 });
  assert.equal(r.ok, true, JSON.stringify(r));
  let d = await sd();
  assert.equal(d.coins, 1880, "Luciakronan kostar 120");
  assert.deepEqual(d.ownedItems, ["keps", "jul-luciakrona"]);
  assert.equal(d.ownedCounts?.["jul-luciakrona"], undefined, "ingen räknare för kläder");
  assert.equal((await kop("jul-snoangelvingar")).ok, true);
  d = await sd();
  assert.equal(d.coins, 1630, "Snöängelvingarna kostar 250");
});

test("Jul på: köpavataren säljs till katalogpriset", async () => {
  const r = await kop("jul-av-tomtenisse");
  assert.equal(r.ok, true, JSON.stringify(r));
  const d = await sd();
  assert.equal(d.coins, 830, "Tomtenissen kostar 800");
  assert.ok(d.ownedItems.includes("jul-av-tomtenisse"));
});

test("ägd kostym och avatar köps inte igen – inget dras", async () => {
  for (const id of ["jul-luciakrona", "jul-av-tomtenisse"]) {
    const r = await kop(id);
    assert.equal(r.ok, true, JSON.stringify(r));
  }
  const d = await sd();
  assert.equal(d.coins, 830);
  assert.equal(d.ownedItems.filter((x) => x === "jul-luciakrona").length, 1);
  assert.equal(d.ownedItems.filter((x) => x === "jul-av-tomtenisse").length, 1);
});

test("för lite pengar → nej, inget dras", async () => {
  const r = await kop("jul-av-isbjorn"); // 700 av 830 – kvar 130
  assert.equal(r.ok, true, JSON.stringify(r));
  const r2 = await kop("jul-av-snogubbe"); // 450 men bara 130 kvar
  assert.equal(r2.ok, false);
  const d = await sd();
  assert.equal(d.coins, 130);
  assert.ok(!d.ownedItems.includes("jul-av-snogubbe"));
});

test("Jul av → kostym och avatar säljs inte just nu, inget dras", async () => {
  await sasong({ jul: false });
  await adb.doc(`studentData/${ELEV}`).update({ coins: 2000 });
  for (const id of ["jul-tomteluva", "jul-av-ren"]) {
    const r = await kop(id);
    assert.equal(r.ok, false, `${id}: ${JSON.stringify(r)}`);
  }
  const d = await sd();
  assert.equal(d.coins, 2000);
  assert.ok(!d.ownedItems.includes("jul-tomteluva") && !d.ownedItems.includes("jul-av-ren"));
});

test("Jul av: den köpta avataren kan väljas (kopAvatarOk), en ej köpt inte", async () => {
  await assert.rejects(updateDoc(doc(db, `studentData/${ELEV}`), { avatarId: "jul-av-ren" }));
  await updateDoc(doc(db, `studentData/${ELEV}`), { avatarId: "jul-av-tomtenisse", avatarChosen: true });
  assert.equal((await sd()).avatarId, "jul-av-tomtenisse");
});
