// ============================================================================
// QA-seed för Klasscentrets lärarsektion (#491, epic #475) – BARA emulatorn.
// ----------------------------------------------------------------------------
// Kör först admin/qa-klasscenter-by-seed.mjs och admin/qa-klasscenter-rum-seed.mjs.
// Den här lägger till, för klass qa-kc ("QA-klass 4A", kc01 … kc14):
//   • lärarkontot qalarare (lösen lilla123, claim teacher:true)
//   • donationsposter bakom de upplåsta föremålen + en pågående insamling
//     (flygel 1 850 / 6 000) så "Vem har donerat" har innehåll
//   • tre sparningar i layout-historiken (kc01, kc02, kc01) – version 3 visas nu
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8511 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9511 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-klasscenter-larare-seed.mjs
//
// Idempotent. Vägrar köra utan emulator-variablerna (skriver aldrig till produktion).
// ============================================================================

import admin from "firebase-admin";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const db = admin.firestore(app);
const auth = admin.auth(app);
const PW = "lilla123";
const nu = Date.now();
const ts = (minSedan) => admin.firestore.Timestamp.fromMillis(nu - minSedan * 60_000);

async function larare() {
  const uid = "qalarare";
  const email = "qalarare@larare.pluggportalen.local";
  try {
    await auth.getUser(uid);
    await auth.updateUser(uid, { email, password: PW });
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
    await auth.createUser({ uid, email, password: PW });
  }
  await auth.setCustomUserClaims(uid, { teacher: true });
  console.log("✓ lärare qalarare / lilla123");
}

// [elev, föremål, belopp, minuter sedan]
const DONATIONER = [
  ["kc01", "klassfana", 1200, 3000], ["kc02", "klassfana", 800, 2900],
  ["kc04", "lounge", 1500, 2000], ["kc01", "lounge", 1000, 1900], ["kc05", "lounge", 500, 1800],
  ["kc02", "akvarium", 4000, 1500],
  ["kc06", "guldstaty", 2500, 1200], ["kc07", "guldstaty", 2500, 1100],
  ["kc01", "kristallkrona", 6000, 900], ["kc03", "kristallkrona", 4000, 800],
  ["kc02", "flygel", 600, 300], ["kc08", "flygel", 250, 200], ["kc02", "flygel", 1000, 30],
];

async function donationer() {
  const col = db.collection("classCenters/qa-kc/donations");
  const gamla = await col.get();
  for (const d of gamla.docs) await d.ref.delete();
  for (const [i, [uid, itemId, amount, min]] of DONATIONER.entries()) {
    await col.doc(`qa-d${i}`).set({ uid, itemId, amount, at: ts(min) });
  }
  await db.doc("classCenters/qa-kc/fund/flygel").set({
    targetPrice: 6000, fundedAmount: 1850, isUnlocked: false, unlockedAt: null, lastDonationId: "qa-d12",
  });
  console.log(`✓ qa-kc: ${DONATIONER.length} donationer, flygel 1850/6000`);
}

async function historik() {
  const versioner = [
    { version: 1, savedBy: "kc01", min: 1440, pi: { lounge: { x: 30, y: 80, z: 0 } } },
    { version: 2, savedBy: "kc02", min: 600, pi: { lounge: { x: 30, y: 80, z: 0 }, guldstaty: { x: 70, y: 78, z: 1 }, klassfana: { x: 50, y: 30, z: 2 } } },
    { version: 3, savedBy: "kc01", min: 20, pi: { akvarium: { x: 12, y: 90, z: 0 } } },
  ];
  const h = await db.collection("classCenters/qa-kc/layoutHistory").get();
  for (const d of h.docs) await d.ref.delete();
  for (const v of versioner) {
    await db.doc(`classCenters/qa-kc/layoutHistory/${v.version % 10}`).set({
      placedItems: v.pi, version: v.version, savedBy: v.savedBy, savedAt: ts(v.min),
    });
  }
  const sista = versioner[versioner.length - 1];
  await db.doc("classCenters/qa-kc/layout/current").set({
    placedItems: sista.pi, version: sista.version, updatedBy: sista.savedBy, updatedAt: ts(sista.min),
  });
  console.log("✓ qa-kc: historik v1–v3 (v3 visas)");
}

async function main() {
  await larare();
  await donationer();
  await historik();
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
