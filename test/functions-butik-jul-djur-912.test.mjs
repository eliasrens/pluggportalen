// ============================================================================
// E2E (#912): Jul-djurens julklappsägg mot callablen butikKop i Functions-,
// Auth- och Firestore-EMULATORERNA, anropad som klienten (bara { itemId }).
//
//   Servern känner alla tio varorna: Jul på → varje ägg kostar 500 (skickat
//     pris ignoreras), hamnar i pets[] med eggSpecies = arten och agdaDjur-beviset
//   Jul av, eller bara Halloween på → "säljs inte just nu", inget dras
//   för lite pengar → nej, inget dras
//   kläckning + matning är klientskrivningar (data-pet.js) – reglerna släpper
//     igenom dem för Jul-arterna precis som för Halloween-arterna
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

const ARTER = ["snois", "renis", "pingvis", "pepparis", "isbjornis", "tomtis", "ravis", "snougglis", "glittris", "julklappis"];

const adminApp = admin.initializeApp({ projectId: PROJECT_ID }, "butik-juldjur-admin");
const adb = adminApp.firestore();
const app = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT_ID }, "butik-juldjur-client");
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
const fns = getFunctions(app, "europe-west1");
connectFunctionsEmulator(fns, FN_HOST.split(":")[0], Number(FN_HOST.split(":")[1]));
const cdb = getFirestore(app);
connectFirestoreEmulator(cdb, FS_HOST.split(":")[0], Number(FS_HOST.split(":")[1]));
const kop = (itemId, extra = {}) => httpsCallable(fns, "butikKop", { timeout: 60_000 })({ itemId, ...extra }).then((r) => r.data);

const PW = "butikjuldjur912";
const ELEV = "juldjurelev912";
const sd = async () => (await adb.doc(`studentData/${ELEV}`).get()).data() || {};
const satt = (data) => adb.doc(`studentData/${ELEV}`).set(data);
const sasong = (d) => adb.doc("config/season").set({ season: "vinter", halloween: false, ...d });

after(async () => {
  await signOut(auth).catch(() => {});
  await deleteApp(app).catch(() => {});
  await adb.doc("config/season").delete().catch(() => {});
  await adminApp.delete().catch(() => {});
});

test("seed + inloggning", async () => {
  await admin.auth(adminApp).createUser({ uid: ELEV, email: `${ELEV}@elev.pluggportalen.local`, password: PW }).catch(() => {});
  await satt({ coins: 6000, ownedItems: [], pets: [], xp: 0 });
  await sasong({ jul: true, julUntil: null });
  await signInWithEmailAndPassword(auth, `${ELEV}@elev.pluggportalen.local`, PW);
});

test("Jul på: servern känner alla tio julklappsäggen – 500 var, eggSpecies = arten", async () => {
  for (const art of ARTER) {
    const r = await kop("jul-djur-" + art, { price: 1 });
    assert.equal(r.ok, true, `${art}: ${JSON.stringify(r)}`);
  }
  const d = await sd();
  assert.equal(d.coins, 6000 - 10 * 500);
  assert.deepEqual(d.pets.map((p) => p.eggSpecies), ARTER);
  assert.ok(d.pets.every((p) => p.hatchedAt === null && p.eggBoughtAt > 0));
  assert.deepEqual(Object.values(d.agdaDjur).sort(), ARTER.map((a) => "jul-djur-" + a).sort(), "ägarbeviset per ägg");
  assert.deepEqual(d.ownedItems, [], "äggen hamnar aldrig i ownedItems");
});

test("för lite pengar → nej, inget dras", async () => {
  await adb.doc(`studentData/${ELEV}`).update({ coins: 499 });
  const r = await kop("jul-djur-renis");
  assert.equal(r.ok, false);
  const d = await sd();
  assert.equal(d.coins, 499);
  assert.equal(d.pets.length, 10);
});

test("Jul av, julUntil passerat eller bara Halloween på → säljs inte, inget dras", async () => {
  await adb.doc(`studentData/${ELEV}`).update({ coins: 5000 });
  for (const s of [
    { jul: false },
    { jul: true, julUntil: admin.firestore.Timestamp.fromMillis(Date.now() - 60_000) },
    { season: "host", halloween: true, jul: false },
  ]) {
    await sasong(s);
    const r = await kop("jul-djur-glittris");
    assert.equal(r.ok, false, `${JSON.stringify(s)}: ${JSON.stringify(r)}`);
    assert.equal((await sd()).coins, 5000);
  }
  await sasong({ jul: true, julUntil: null });
});

test("kläckning + matning (klientens skrivningar, som data-pet.js) går igenom reglerna", async () => {
  const d = await sd();
  const nu = Date.now();
  const klackta = d.pets.map((p) => ({ ...p, speciesId: p.eggSpecies, hatchedAt: nu, stage: 1 }));
  await updateDoc(doc(cdb, "studentData", ELEV), { pets: klackta });
  const matad = klackta.map((p, i) => (i === 1 ? { ...p, feedCount: 10, stage: 2 } : p));
  await updateDoc(doc(cdb, "studentData", ELEV), { pets: matad, floorApples: [] });
  const efter = await sd();
  assert.deepEqual(efter.pets.map((p) => p.speciesId), ARTER);
  assert.equal(efter.pets[1].stage, 2);
  assert.equal(efter.coins, 5000, "mynten orörda");
});
