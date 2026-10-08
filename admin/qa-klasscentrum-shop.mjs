// ============================================================================
// QA för shoppens Klasscentrum-flik (#488, epic #475) – BARA emulatorn.
// ----------------------------------------------------------------------------
// Lösenord för alla: lilla123.
//
//   seed                     klass qa-ks "QA-klass 5A": ks01 + ks02 (3 000 mynt
//                            var), ks99 utan klass (500 mynt); tömmer insamlingen
//   donera <uid> <id> <n>    donera SOM ELEVEN (klient-SDK + reglerna, samma
//                            korDonation som webbläsaren) – "elev B"
//   lyssna <uid> [sek]       prenumerera som eleven och skriv ut varje ändring
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8488 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9488 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-klasscentrum-shop.mjs seed
//
// Vägrar köra utan emulator-variablerna (skriver aldrig till produktion).
// ============================================================================
import admin from "firebase-admin";
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  collection, connectFirestoreEmulator, doc, getDocFromServer, getFirestore, increment, onSnapshot,
  serverTimestamp, writeBatch,
} from "firebase/firestore";
import { korDonation, normaliseraFunds } from "../src/klasscenter/kc-fund-plan.js";

const FS = process.env.FIRESTORE_EMULATOR_HOST;
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!FS || !AUTH) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const PROJECT = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const PW = "lilla123";
const KLASS = "qa-ks";
const email = (uid) => `${uid}@elev.pluggportalen.local`;

async function seed() {
  const app = admin.initializeApp({ projectId: PROJECT });
  const auth = admin.auth(app);
  const db = admin.firestore(app);
  const elever = [["ks01", "Alva", "fox", 3000], ["ks02", "Ebbe", "owl", 3000], ["ks99", "Saga", "cat", 500]];
  for (const [uid, namn, avatarId, coins] of elever) {
    try {
      await auth.getUser(uid);
      await auth.updateUser(uid, { email: email(uid), password: PW });
    } catch (e) {
      if (e.code !== "auth/user-not-found") throw e;
      await auth.createUser({ uid, email: email(uid), password: PW });
    }
    const classIds = uid === "ks99" ? [] : [KLASS];
    await db.doc(`students/${uid}`).set({ namn, username: uid, avatarId, classIds });
    await db.doc(`studentData/${uid}`).set({ progress: {}, avatarId, coins, xp: 0, room: { paletteId: "mint" } });
  }
  await db.doc(`classes/${KLASS}`).set({ name: "QA-klass 5A", order: 1, createdAt: Date.now(), studentIds: ["ks01", "ks02"] });
  for (const sub of ["fund", "donations"]) {
    const snap = await db.collection(`classCenters/${KLASS}/${sub}`).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  console.log("✓ qa-ks: ks01 + ks02 (3000 mynt), ks99 utan klass (500); insamlingen tömd");
}

async function somElev(uid) {
  const app = initializeApp({ projectId: PROJECT, apiKey: "qa" }, uid);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH}`, { disableWarnings: true });
  const db = getFirestore(app);
  const [host, port] = FS.split(":");
  connectFirestoreEmulator(db, host, Number(port));
  await signInWithEmailAndPassword(auth, email(uid), PW);
  return db;
}

async function donera(uid, itemId, n) {
  const db = await somElev(uid);
  const sdk = { doc, collection, getDocFromServer, writeBatch, increment, serverTimestamp };
  const res = await korDonation(sdk, db, { classId: KLASS, uid, itemId, amount: Number(n) });
  console.log(JSON.stringify(res));
}

async function lyssna(uid, sek = 60) {
  const db = await somElev(uid);
  onSnapshot(collection(db, "classCenters", KLASS, "fund"), (snap) => {
    const f = normaliseraFunds(snap.docs);
    const rad = Object.values(f).filter((x) => x.fundedAmount > 0)
      .map((x) => `${x.itemId} ${x.fundedAmount} / ${x.targetPrice}${x.isUnlocked ? " KÖPT" : ""}`);
    console.log(`[${new Date().toISOString().slice(11, 19)}] ${uid} ser: ${rad.join(", ") || "(inget insamlat)"}`);
  }, (err) => console.error("lyssna:", err.code || err));
  await new Promise((r) => setTimeout(r, Number(sek) * 1000));
}

const [cmd, ...arg] = process.argv.slice(2);
const kor = { seed, donera: () => donera(...arg), lyssna: () => lyssna(...arg) }[cmd];
if (!kor) {
  console.error("Användning: seed | donera <uid> <itemId> <belopp> | lyssna <uid> [sek]");
  process.exit(1);
}
kor().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
