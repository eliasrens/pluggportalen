// ============================================================================
// QA-seed för Mattematchen-elevsidan (#458) – BARA mot Firebase-emulatorerna.
// ----------------------------------------------------------------------------
// Bygger spec MM-test 1–6 som klickbara konton (lösenord lilla123, endast emulator):
//   elev1   – 4A deltar i en AKTIV period (test 3–6): 60 elever på topplistan
//             (Topp 25 visas), elev1 utanför topp 25, egen statistik per tabell
//   elev2   – 4C: perioden STARTAR om START_OM_S sekunder (default 120) –
//             test 2: länken dyker upp av sig själv, utan omladdning
//   elev3   – 6A: ingen tävling (test 1 – Mattematchen syns inte)
// Klasskamp: 4A (60 elever, ≈212), 4B (20 elever / 4000 rätt → 200,0), 5E, 4C.
// Idempotent: återställer allt vid varje körning. Tider = nu (reglerna
// jämför mot request.time).
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-mattematchen-seed.mjs
// ============================================================================
import admin from "firebase-admin";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const auth = admin.auth(app);
const db = admin.firestore(app);
const { Timestamp } = admin.firestore;

const PW = "lilla123"; // endast emulator
const NOW = Date.now();
const MIN = 60_000;
const DAG = 24 * 60 * MIN;
const START_OM = (Number(process.env.START_OM_S) || 120) * 1000;
const NAMN = ["Alma", "Omar", "Clara", "Noah", "Ella", "Liam", "Saga", "Hugo", "Maja", "Elias", "Wilma", "Adam",
  "Ebba", "Ali", "Stella", "Leo", "Agnes", "Melvin", "Freja", "Sam", "Nora", "Viggo", "Tyra", "Otto", "Alice",
  "Malte", "Selma", "Ivar", "Lova", "Theo"];

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

async function rensa(path) {
  const snap = await db.collection(path).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

async function elev(uid, namn, inlogg = false) {
  if (inlogg) await ensureUser(uid, `${uid}@elev.pluggportalen.local`);
  await db.doc(`students/${uid}`).set({ namn, username: uid, avatarId: "fox" });
  if (inlogg) await db.doc(`studentData/${uid}`).set({ coins: 250, progress: {}, avatarId: "fox" });
}

async function main() {
  await ensureUser("qalarare", "qalarare@larare.pluggportalen.local", { teacher: true });

  // Klasser. 4A: elev1 + 59 fyllnadselever (60 på topplistan).
  const a4 = ["elev1", ...Array.from({ length: 59 }, (_, i) => `mm-a${i}`)];
  const b4 = Array.from({ length: 20 }, (_, i) => `mm-b${i}`);
  const e5 = Array.from({ length: 24 }, (_, i) => `mm-e${i}`);
  const c4 = ["elev2", ...Array.from({ length: 17 }, (_, i) => `mm-c${i}`)];
  const KLASSER = [
    ["mm-4a", "4A", a4], ["mm-4b", "4B", b4], ["mm-5e", "5E", e5], ["mm-4c", "4C", c4], ["mm-6a", "6A", ["elev3"]],
  ];
  for (const [id, name, studentIds] of KLASSER) {
    await db.doc(`classes/${id}`).set({ name, order: 1, createdAt: NOW, studentIds });
  }
  await elev("elev1", "Astrid", true);
  await elev("elev2", "Bertil", true);
  await elev("elev3", "Cilla", true);
  for (const [, , ids] of KLASSER) {
    for (const uid of ids) if (!uid.startsWith("elev")) await elev(uid, `${NAMN[(uid.length * 7 + Number(uid.replace(/\D/g, ""))) % NAMN.length]} ${uid.slice(3).toUpperCase()}`);
  }

  // Tävlingar: aktiv (4A, 4B, 5E) + kommande om 2 min (4C).
  const aktiv = "mm-qa-oktober";
  const kommande = "mm-qa-start";
  for (const cid of [aktiv, kommande]) {
    for (const sub of ["answers", "studentStats", "scores", "classCounters"]) await rensa(`mathCompetitions/${cid}/${sub}`);
  }
  await db.doc(`mathCompetitions/${aktiv}`).set({
    name: "Mattematchen oktober", participatingClassIds: ["mm-4a", "mm-4b", "mm-5e"],
    startAt: Timestamp.fromMillis(NOW - DAG), endAt: Timestamp.fromMillis(NOW + 9 * DAG),
    status: "active", counterShards: 5, createdBy: "qalarare", createdAt: Timestamp.fromMillis(NOW - 2 * DAG),
  });
  await db.doc(`mathCompetitions/${kommande}`).set({
    name: "Mattematchen – startar snart", participatingClassIds: ["mm-4c"],
    startAt: Timestamp.fromMillis(NOW + START_OM), endAt: Timestamp.fromMillis(NOW + 7 * DAG),
    status: "active", counterShards: 5, createdBy: "qalarare", createdAt: Timestamp.fromMillis(NOW),
  });

  // Topplistan: 60 elever i 4A med fallande poäng; elev1 = 40 (utanför topp 25).
  const base = `mathCompetitions/${aktiv}`;
  let sumA = 0;
  for (let i = 0; i < a4.length; i++) {
    const uid = a4[i];
    const correct = uid === "elev1" ? 40 : 420 - i * 7;
    sumA += correct;
    const namn = (await db.doc(`students/${uid}`).get()).data().namn;
    await db.doc(`${base}/scores/${uid}`).set({ uid, classId: "mm-4a", name: namn, correct, lastAttemptId: "seed", lastAt: Timestamp.fromMillis(NOW) });
  }
  // elev1:s egen statistik (per tabell, c{t}/w{t}) – 40 rätt, 10 fel.
  await db.doc(`${base}/studentStats/elev1`).set({
    uid: "elev1", classId: "mm-4a", correct: 40, incorrect: 10, lastAttemptId: "seed", lastAt: Timestamp.fromMillis(NOW),
    c0: 6, c1: 7, c2: 8, c3: 7, c4: 6, c5: 9, c6: 5, c7: 4, c8: 5, c9: 6, c10: 8,
    w3: 1, w6: 3, w7: 5, w8: 4, w9: 2, w4: 1,
  });
  // Klassräknare (5 shards): 4A = summan ovan, 4B = 4000 (20 elever → 200,0), 5E = 4433.
  const shards = (classId, total) => Array.from({ length: 5 }, (_, s) =>
    db.doc(`${base}/classCounters/${classId}_${s}`).set({
      classId, shard: s, correct: Math.floor(total / 5) + (s < total % 5 ? 1 : 0), lastAttemptId: "seed", lastAt: Timestamp.fromMillis(NOW),
    }));
  await Promise.all([...shards("mm-4a", sumA), ...shards("mm-4b", 4000), ...shards("mm-5e", 4433)]);

  console.log(`✓ aktiv tävling ${aktiv} (4A ${sumA} rätt/60 el, 4B 4000/20 = 200,0, 5E 4433/24)`);
  console.log(`✓ ${kommande} startar ${new Date(NOW + START_OM).toLocaleTimeString("sv-SE")} för 4C (elev2)`);
  console.log(`✓ elev1/elev2/elev3 + qalarare, lösenord ${PW}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
