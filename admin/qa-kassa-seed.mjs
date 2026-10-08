// ============================================================================
// QA-seed för klasskassan (#526) – BARA mot Firebase-emulatorerna.
// ----------------------------------------------------------------------------
// Körs EFTER admin/qa-live-seed.mjs (lärare rasmus/elias, 4B/5E/3A, lösenord
// lilla123). Lägger till:
//   • historik-demo (4B 20,0 mot 5E 19,0) får mynt-pris 1000 – result saknas,
//     så första gången läraren öppnar matchen i historiken räknas result och
//     4B:s kassa får +1000 (en gång).
//   • oavgjort-demo: 4B 10,0 mot 5E 10,0, pris 1001 → 500 var.
//   • en lobby "Fredagsmatch" med pris 1000 (projektorns/elevens prisrad).
//   • alma4b = klasskassör i 4B (omar4b är vanlig elev), alla elever 500 mynt.
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8526 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9526 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-kassa-seed.mjs
//
// Vägrar köra utan emulator-variablerna (skriver aldrig till produktion).
// ============================================================================
import admin from "firebase-admin";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const db = admin.firestore(app);
const { Timestamp, FieldValue } = admin.firestore;

const BAS = {
  gameMode: "multiplication_0_10", participatingClassIds: ["4b", "5e"], classNames: { "4b": "4B", "5e": "5E" },
  durationSeconds: 600, countdownSeconds: 4, counterShards: 10, createdBy: "rasmus", createdByName: "rasmus",
};

async function seed() {
  const hist = await db.doc("liveSessions/historik-demo").get();
  if (!hist.exists) throw new Error("kör admin/qa-live-seed.mjs först");
  await db.doc("liveSessions/historik-demo").update({ coinPrize: 1000 });

  const start = Timestamp.fromMillis(Date.now() - 3 * 3600 * 1000);
  const ref = db.doc("liveSessions/oavgjort-demo");
  await db.recursiveDelete(ref);
  await ref.set({
    ...BAS, name: "Oavgjort 4B mot 5E", classDivisors: { "4b": 17, "5e": 22 }, status: "finished", coinPrize: 1001,
    createdAt: start, startedAt: start, endsAt: new Timestamp(start.seconds + 604, 0), finishedAt: new Timestamp(start.seconds + 605, 0),
  });
  await ref.collection("counters").doc("4b_0").set({ classId: "4b", shard: 0, correct: 170 });
  await ref.collection("counters").doc("5e_0").set({ classId: "5e", shard: 0, correct: 220 });
  for (const [uid, name, classId, correct] of [["alma4b", "Alma", "4b", 170], ["clara5e", "Clara", "5e", 220]]) {
    await ref.collection("players").doc(uid).set({ uid, classId, name, joinedAt: start, lastSeenAt: start, correct, incorrect: 0 });
  }

  await db.doc("liveSessions/fredag-lobby").set({
    ...BAS, name: "Fredagsmatch", classDivisors: { "4b": 4, "5e": 3 }, status: "lobby", coinPrize: 1000,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Rensa kassan (+ kassa-donationer) så scenariot börjar från noll.
  for (const cid of ["4b", "5e"]) {
    await db.recursiveDelete(db.collection(`classCenters/${cid}/kassa`));
    await db.recursiveDelete(db.collection(`classCenters/${cid}/kassaHistorik`));
  }
  await db.doc("classCenters/4b").set({ kassorer: ["alma4b"] }, { merge: true });
  for (const uid of ["alma4b", "omar4b", "ines4b", "leo4b", "clara5e", "sam5e", "ella5e"]) {
    await db.doc(`studentData/${uid}`).set({ coins: 500 }, { merge: true });
  }
  console.log("✓ kassa: historik-demo pris 1000 (betalas när läraren öppnar matchen), oavgjort-demo 1001 → 500 var,");
  console.log("  lobby Fredagsmatch pris 1000, kassör alma4b i 4B, elever 500 mynt");
}

seed().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
