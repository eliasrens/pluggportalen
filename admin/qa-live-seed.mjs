// ============================================================================
// QA-seed för Live (#460) – BARA mot Firebase-emulatorerna.
// ----------------------------------------------------------------------------
// Två lärare (rasmus, elias – lösenord lilla123, teacher-claim), klasserna
// 4B, 5E och 3A (3A bjuds inte in → ska INTE se Live) och en AVSLUTAD match
// för historik/statistik (spec Live-test 6: 340/17 = 20,0 mot 418/22 = 19,0).
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-live-seed.mjs
//
// Simulera elever i en befintlig session (lobby: "redo"; live: rätt svar):
//   node admin/qa-live-seed.mjs --sim <sid> [--redo 15,18] [--svar 30]
//   (skriver spelare + räknare direkt med admin – bara för projektor-QA)
//
// Vägrar köra utan emulator-variablerna (skriver aldrig till produktion).
// ============================================================================
import admin from "firebase-admin";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const auth = admin.auth(app);
const db = admin.firestore(app);
const { FieldValue, Timestamp } = admin.firestore;
const PW = "lilla123";

const KLASSER = {
  "4b": { name: "4B", elever: [["alma4b", "Alma"], ["omar4b", "Omar"], ["ines4b", "Ines"], ["leo4b", "Leo"]] },
  "5e": { name: "5E", elever: [["clara5e", "Clara"], ["sam5e", "Sam"], ["ella5e", "Ella"]] },
  "3a": { name: "3A", elever: [["utan3a", "Utan"]] },
};

async function ensureUser(uid, email, claims) {
  try {
    await auth.getUser(uid);
    await auth.updateUser(uid, { email, password: PW });
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
    await auth.createUser({ uid, email, password: PW });
  }
  if (claims) await auth.setCustomUserClaims(uid, claims);
}

async function seed() {
  for (const t of ["rasmus", "elias"]) await ensureUser(t, `${t}@larare.pluggportalen.local`, { teacher: true });
  let order = 1;
  for (const [cid, k] of Object.entries(KLASSER)) {
    for (const [uid, namn] of k.elever) {
      await ensureUser(uid, `${uid}@elev.pluggportalen.local`);
      await db.doc(`students/${uid}`).set({ namn, username: uid, avatarId: "fox", classIds: [cid] });
      await db.doc(`studentData/${uid}`).set({ coins: 100, progress: {}, avatarId: "fox", avatarChosen: true });
    }
    await db.doc(`classes/${cid}`).set({ name: k.name, order: order++, createdAt: Date.now(), studentIds: k.elever.map(([u]) => u) });
  }
  // Rensa gamla Live-sessioner (inkl. underkollektioner).
  for (const d of (await db.collection("liveSessions").get()).docs) await db.recursiveDelete(d.ref);

  // En avslutad match i historiken (spec Live-test 6).
  const start = Timestamp.fromMillis(Date.now() - 26 * 3600 * 1000);
  const ref = db.collection("liveSessions").doc("historik-demo");
  await ref.set({
    name: "4B mot 5E", gameMode: "multiplication_0_10", participatingClassIds: ["4b", "5e"],
    classNames: { "4b": "4B", "5e": "5E" }, classDivisors: { "4b": 17, "5e": 22 },
    durationSeconds: 1200, countdownSeconds: 4, counterShards: 10, status: "finished",
    createdBy: "rasmus", createdByName: "rasmus", createdAt: start, startedAt: start,
    endsAt: new Timestamp(start.seconds + 1204, start.nanoseconds), finishedAt: new Timestamp(start.seconds + 1205, 0),
  });
  await ref.collection("counters").doc("4b_0").set({ classId: "4b", shard: 0, correct: 200 });
  await ref.collection("counters").doc("4b_3").set({ classId: "4b", shard: 3, correct: 140 });
  await ref.collection("counters").doc("5e_1").set({ classId: "5e", shard: 1, correct: 418 });
  const demo = [["alma4b", "Alma", "4b", 120, 4], ["omar4b", "Omar", "4b", 150, 9], ["ines4b", "Ines", "4b", 70, 3],
    ["clara5e", "Clara", "5e", 160, 2], ["sam5e", "Sam", "5e", 140, 12], ["ella5e", "Ella", "5e", 118, 6]];
  for (const [uid, name, classId, correct, incorrect] of demo) {
    await ref.collection("players").doc(uid).set({ uid, classId, name, joinedAt: start, lastSeenAt: start, correct, incorrect });
  }
  console.log("✓ lärare rasmus/elias, klasser 4B (4 elever), 5E (3), 3A (1) – lösenord", PW);
  console.log("✓ historik: 4B mot 5E (340/17 = 20,0 mot 418/22 = 19,0, result räknas vid första visning)");
}

async function sim(sid, redo, svar) {
  const ref = db.collection("liveSessions").doc(sid);
  const s = (await ref.get()).data();
  if (!s) throw new Error(`ingen session ${sid}`);
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  s.participatingClassIds.forEach((cid, i) => {
    for (let n = 0; n < (redo[i] || 0); n++) {
      const uid = `sim-${cid}-${n}`;
      batch.set(ref.collection("players").doc(uid), {
        uid, classId: cid, name: `Sim ${s.classNames?.[cid] || cid} ${n + 1}`, joinedAt: now, lastSeenAt: now,
        correct: FieldValue.increment(s.status === "live" ? svar : 0), incorrect: FieldValue.increment(0),
      }, { merge: true });
      if (s.status === "live" && svar) {
        batch.set(ref.collection("counters").doc(`${cid}_${n % s.counterShards}`),
          { classId: cid, shard: n % s.counterShards, correct: FieldValue.increment(svar) }, { merge: true });
      }
    }
  });
  await batch.commit();
  console.log(`✓ sim ${sid}: redo ${redo.join("/")}${s.status === "live" ? `, +${svar} rätt per sim-elev` : ""}`);
}

const args = process.argv.slice(2);
const at = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : null);
const job = at("--sim")
  ? sim(at("--sim"), (at("--redo") || "15,18").split(",").map(Number), Number(at("--svar") || 0))
  : seed();
job.then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
