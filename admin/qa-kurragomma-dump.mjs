// Kurragömma (#839, TESTAREN): dumpa en match i emulatorerna – sessionens kg*-fält,
// kgPlayers/kgSecret/kgEvents/coinReceipts och RTDB kg/{sid}. BARA emulator.
//   FIRESTORE_EMULATOR_HOST=… FIREBASE_DATABASE_EMULATOR_HOST=… node admin/qa-kurragomma-dump.mjs <sid>
import admin from "firebase-admin";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_DATABASE_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_DATABASE_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
admin.initializeApp({ projectId: "pluggportalen-so-2026", databaseURL: `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}/?ns=pluggportalen-so-2026-default-rtdb` });
const db = admin.firestore();
const sid = process.argv[2];
const ms = (_k, v) => (v && v._seconds != null ? v._seconds * 1000 + Math.round((v._nanoseconds || 0) / 1e6) : v);
const s = (await db.doc(`liveSessions/${sid}`).get()).data() || {};
console.log(JSON.stringify(Object.fromEntries(Object.entries(s).filter(([k]) => /^(kg|status|startedAt|finishedAt|durationSeconds|result)/.test(k))), ms));
for (const c of ["kgPlayers", "kgSecret", "kgEvents", "coinReceipts"]) {
  const q = await db.collection(`liveSessions/${sid}/${c}`).get();
  console.log(c, q.size, JSON.stringify(q.docs.map((d) => ({ id: d.id, ...d.data() })), ms));
}
console.log("rtdb", JSON.stringify((await admin.database().ref(`kg/${sid}`).get()).val()));
process.exit(0);
