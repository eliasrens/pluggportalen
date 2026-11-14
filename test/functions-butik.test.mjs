// ============================================================================
// E2E: butiken på servern (#854, epic #851) – callablen butikKop mot Functions-,
// Auth- och Firestore-EMULATORERNA, anropad som klienten (src/butik-kop.js:
// httpsCallable europe-west1, bara { itemId }).
//
//   utloggad → unauthenticated; lärare → permission-denied; utan itemId → invalid-argument
//   ett köp per typ sänker saldot med KATALOGpriset (ett skickat pris ignoreras):
//     klädsak, möbel (multi), frö, husskal, ägg, Halloween-ägg, värmelampa, äpple,
//     vanligt djur, gårdsdjur, gårdsuppgradering, mysterylåda (ny vara + dubblett)
//   ägg, djur och gårdsdjur får sin post i agdaDjur
//   okänd vara, mystery-vara direkt, Halloween utanför säsong, för lite pengar → ok:false, inget dras
//   två parallella köp av samma single-vara drar bara en gång
//
// Körs via:  npm run test:functions  (kräver FUNCTIONS_EMULATOR_HOST + `npm --prefix functions install`)
// ============================================================================

import assert from "node:assert/strict";
import { test, after } from "node:test";
import admin from "firebase-admin";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, connectAuthEmulator } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { MYSTERY_ITEMS, dupCoins } from "../src/mystery-items.js";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
process.env.FIRESTORE_EMULATOR_HOST = FS_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

const adminApp = admin.initializeApp({ projectId: PROJECT_ID }, "butik-fn-admin");
const adb = adminApp.firestore();

const app = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT_ID }, "butik-fn-client");
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
const fns = getFunctions(app, "europe-west1");
connectFunctionsEmulator(fns, FN_HOST.split(":")[0], Number(FN_HOST.split(":")[1]));
const kop = (itemId, extra = {}) => httpsCallable(fns, "butikKop", { timeout: 60_000 })({ itemId, ...extra }).then((r) => r.data);

const PW = "butik854";
const ELEV = "butikelev";
const LARARE = "butiklarare";
const email = (u) => `${u}@elev.pluggportalen.local`;
const som = async (uid) => {
  await signOut(auth).catch(() => {});
  await signInWithEmailAndPassword(auth, email(uid), PW);
};
const felkod = async (p) => {
  try {
    await p;
  } catch (e) {
    return String(e?.code || "").replace(/^functions\//, "");
  }
  return "ok";
};
const sd = async () => (await adb.doc(`studentData/${ELEV}`).get()).data() || {};
const satt = (data) => adb.doc(`studentData/${ELEV}`).set(data);
const sasong = (halloween) => adb.doc("config/season").set({ season: "host", halloween });

after(async () => {
  await signOut(auth).catch(() => {});
  await deleteApp(app).catch(() => {});
  await adb.doc("config/season").delete().catch(() => {});
  await adminApp.delete().catch(() => {});
});

test("seed: en elev och en lärare", async () => {
  const a = admin.auth(adminApp);
  for (const uid of [ELEV, LARARE]) await a.createUser({ uid, email: email(uid), password: PW }).catch(() => {});
  await a.setCustomUserClaims(LARARE, { teacher: true, admin: true });
  await satt({ coins: 100000, ownedItems: [], xp: 0 });
  await sasong(false);
});

test("utloggad → unauthenticated, lärare → permission-denied, utan itemId → invalid-argument", async () => {
  await signOut(auth).catch(() => {});
  assert.equal(await felkod(kop("keps")), "unauthenticated");
  await som(LARARE);
  assert.equal(await felkod(kop("keps")), "permission-denied");
  await som(ELEV);
  assert.equal(await felkod(httpsCallable(fns, "butikKop")({})), "invalid-argument");
  assert.equal(await felkod(kop(5)), "invalid-argument");
  assert.equal((await sd()).coins, 100000, "inget drogs");
});

test("varor (K1): katalogpriset dras – ett skickat pris ignoreras; single en gång, multi räknas upp", async () => {
  await som(ELEV);
  await satt({ coins: 1000, ownedItems: [] });
  const keps = await kop("keps", { price: 0 });
  assert.deepEqual([keps.ok, keps.coins, keps.owned], [true, 980, ["keps"]]);
  const igen = await kop("keps");
  assert.deepEqual([igen.ok, igen.coins], [true, 980], "redan ägd → no-op");
  const s1 = await kop("soffa", { price: 1 });
  const s2 = await kop("soffa");
  assert.deepEqual([s1.coins, s2.coins, s2.counts.soffa], [820, 660, 2]);
  const fro = await kop("crop_carrot");
  assert.equal(fro.counts.crop_carrot, 1);
  const d = await sd();
  assert.equal(d.coins, 635);
  assert.deepEqual(d.ownedItems, ["keps", "soffa", "crop_carrot"]);
  assert.deepEqual(d.ownedCounts, { soffa: 2, crop_carrot: 1 });
});

test("husskal och gårdsuppgraderingar (K8) i ordning", async () => {
  await som(ELEV);
  await satt({ coins: 2000, ownedItems: [] });
  assert.equal((await kop("slott")).coins, 1600);
  const fel = await kop("lada-3");
  assert.deepEqual([fel.ok, fel.error], [false, "fel nivå"]);
  const l2 = await kop("lada-2");
  assert.deepEqual([l2.ok, l2.coins, l2.farm.barnLevel], [true, 1150, 2]);
  const l3 = await kop("lada-3");
  assert.deepEqual([l3.ok, l3.coins, l3.farm.barnLevel], [true, 350, 3]);
  const d = await sd();
  assert.equal(d.farm.barnLevel, 3);
  assert.deepEqual(d.ownedItems, ["slott"], "uppgraderingar hamnar aldrig i ownedItems");
});

test("ägg, Halloween-ägg, värmelampa och äpple (K3–K5); äggen får agdaDjur", async () => {
  await som(ELEV);
  await satt({ coins: 1000, ownedItems: [], pets: [] });
  const agg = await kop("mystery-egg", { price: 1 });
  assert.equal(agg.coins, 800);
  assert.equal(await felkod(kop("hw-djur-spokis")), "ok");
  assert.equal((await sd()).coins, 800, "Halloween-ägget nekas utanför säsong");
  await sasong(true);
  const hw = await kop("hw-djur-spokis");
  assert.equal(hw.coins, 300);
  assert.equal(hw.pets[1].eggSpecies, "spokis");
  await sasong(false);
  const lampa = await kop("varmelampa");
  assert.equal(lampa.coins, 180);
  assert.ok(lampa.pets.every((p) => p.hasHeatLamp));
  const apple = await kop("apple");
  assert.deepEqual([apple.coins, apple.appleCount], [175, 1]);
  const d = await sd();
  assert.equal(d.coins, 175);
  assert.equal(d.appleCount, 1);
  assert.deepEqual(d.ownedItems, ["varmelampa"]);
  assert.deepEqual(d.agdaDjur, { [d.pets[0].id]: "mystery-egg", [d.pets[1].id]: "hw-djur-spokis" });
});

test("vanligt djur (K6) och gårdsdjur (K7) får agdaDjur.<uid> = varu-id", async () => {
  await som(ELEV);
  await satt({ coins: 500, ownedItems: [], roomAnimals: [] });
  const hund = await kop("hund", { price: 1 });
  assert.equal(hund.coins, 340);
  const grisKop = await kop("animal_pig");
  assert.equal(grisKop.coins, 160);
  const d = await sd();
  const [rum] = d.roomAnimals;
  const [gris] = d.farm.animals;
  assert.equal(rum.id, "hund");
  assert.equal(gris.id, "animal_pig");
  assert.deepEqual(d.agdaDjur, { [rum.uid]: "hund", [gris.uid]: "animal_pig" });
  assert.equal(d.farm.barnLevel ?? 1, 1, "resten av gården orörd");
});

test("mysterylådan (K2/E6): ny vara, sedan säker dubblett – lottat på servern", async () => {
  await som(ELEV);
  await satt({ coins: 1000, ownedItems: [] });
  const ny = await kop("mysterybox", { price: 1, legendaryChance: 1 });
  assert.equal(ny.ok, true);
  assert.equal(ny.duplicate, false);
  assert.equal(ny.coins, 500);
  assert.ok(MYSTERY_ITEMS.some((it) => it.id === ny.item.id));
  assert.deepEqual((await sd()).ownedItems, [ny.item.id]);
  // Eleven äger alla vinster → varje lottning är en dubblett.
  await satt({ coins: 500, ownedItems: MYSTERY_ITEMS.map((it) => it.id) });
  const dub = await kop("mysterybox");
  assert.equal(dub.duplicate, true);
  assert.equal(dub.refund, dupCoins(dub.item.rarity));
  assert.equal(dub.coins, dub.refund);
  assert.equal((await sd()).coins, dub.refund);
});

test("nekat: okänd vara, mystery-vara direkt, Halloween utanför säsong, för lite pengar – inget dras", async () => {
  await som(ELEV);
  await satt({ coins: 300, ownedItems: [] });
  const vinst = MYSTERY_ITEMS.find((it) => !it.existingShopItem).id;
  for (const id of ["finnsinte", "__proto__", vinst, "hw-pumpalykta", "hw-av-spoke", "hw-haxhatt", "monstertruck"]) {
    const r = await kop(id);
    assert.equal(r.ok, false, id);
    assert.equal(r.coins, 300, id);
  }
  const d = await sd();
  assert.equal(d.coins, 300);
  assert.deepEqual(d.ownedItems, []);
});

test("två parallella köp av samma single-vara drar bara en gång", async () => {
  await som(ELEV);
  await satt({ coins: 1000, ownedItems: [] });
  const svar = await Promise.all([kop("krona"), kop("krona"), kop("krona")]);
  assert.ok(svar.every((r) => r.ok));
  const d = await sd();
  assert.equal(d.coins, 850, "Krona 150 – en gång");
  assert.deepEqual(d.ownedItems, ["krona"]);
  // Multi-varor: tre parallella köp = tre exemplar, var och ett betalt.
  await Promise.all([kop("stol"), kop("stol"), kop("stol")]);
  const e = await sd();
  assert.equal(e.coins, 760);
  assert.equal(e.ownedCounts.stol, 3);
});
