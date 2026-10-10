// ============================================================================
// Snilleblixten slut-QA (#561, epic #555) – kläder i klassprojektionen, BARA
// emulatorn. Kör efter admin/qa-snilleblixt-preview.sh (qa-mm-live-seed ger
// 4B b01–b20 och 5E e01–e22 som alla är "fox" utan kläder). Ger varje elev i
// 4B och 5E ett eget djur och kläder ur demots garderob (sb-demo demoOutfit),
// i BÅDE studentData (så elevens egen self-publish behåller utseendet) och
// classProjections/{klass} (det Live läser, designspec §4.2).
//
//   b02  trollkarlshatt + mantel (cape)  → designtest 1 (manteln bakom figuren)
//   b03  husLast: true                    → designtest 3 (huslås)
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8564 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9564 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-snilleblixt-slut-seed.mjs
// ============================================================================
import admin from "firebase-admin";
import { demoOutfit } from "../src/live/formats/snilleblixt/sb-demo.js";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const db = admin.firestore(app);

const DJUR = ["fox", "owl", "cat", "dog", "panda", "frog", "unicorn", "dragon", "lion", "penguin", "koala", "robot", "bjorn",
  "tiger", "rabbit", "pig", "cow", "monkey", "hamster", "mouse", "chick", "sheep", "hedgehog", "wolf", "deer", "raccoon",
  "turtle", "bee", "elephant", "goat"];

let n = 0;
for (const cid of ["4b", "5e"]) {
  const c = (await db.doc(`classes/${cid}`).get()).data();
  const members = {};
  for (const [i, uid] of (c?.studentIds || []).entries()) {
    const st = (await db.doc(`students/${uid}`).get()).data() || {};
    // b02 = index 0 i garderoben (trollkarlshatt + cape); b01 får index 1.
    const k = uid === "b02" ? 0 : uid === "b01" ? 1 : (i + (cid === "5e" ? 9 : 2)) % 30;
    const look = { avatarId: DJUR[k], avatarItems: demoOutfit(k), husLast: uid === "b03" };
    await db.doc(`studentData/${uid}`).set({ ...look, ownedItems: look.avatarItems }, { merge: true });
    members[uid] = {
      namn: st.namn || uid, username: uid, ...look, paletteId: null, husSkalId: null,
      stars: 0, xp: 0, completed: 0, plays: 0,
    };
    n++;
  }
  await db.doc(`classProjections/${cid}`).set({ members });
}
console.log(`✓ ${n} elever i 4B + 5E har djur + kläder i studentData och klassprojektionen (b02 hatt+mantel, b03 husLast)`);
process.exit(0);
