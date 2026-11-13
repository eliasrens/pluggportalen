// ============================================================================
// QA-seed för årskursfiltret i Mattematchen (#845) – BARA mot emulatorerna.
// ----------------------------------------------------------------------------
// Lösenord för alla konton: lilla123 (endast emulator).
//   elev3a  – 3A, deltar i den AKTIVA matchen "Mattematchen årskurs"
//             (3A + 3B + 4B + Fritids): 🏆 ska ha filtret Alla · Åk 3 · Åk 4 ·
//             Övriga med Åk 3 förvald. elev3a har 12 poäng (utanför Åk 3:s
//             topp men syns i "Du: …"-raden).
//   elev4b  – 4B i samma match (Åk 4 förvald).
//   elevfri – "Fritids" (Övriga förvald).
//   qalarare – admin: #/larare/mattematchen → Följ (aktiv) + historik
//             ("Mattematchen våras" är avslutad med sparat result).
// Topplistan: 30 elever/åk 3, 30 i 4B (Topp 25 per årskurs = exakt 25),
// 3 på Fritids, och EN gammal post utan `arskurs` (Gamla Gunnar, 4B, 500 p)
// som bara ska synas under Alla. Idempotent.
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//   GCLOUD_PROJECT=pluggportalen-so-2026 node admin/qa-mattematchen-arskurs-seed.mjs
// ============================================================================
import admin from "firebase-admin";
import { buildResult } from "../src/tavling/mm-teacher-core.js";
import { arskursAvKlass, arskursKod } from "../src/tavling/arskurs.js";

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
const DAG = 24 * 60 * 60_000;
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

const fyll = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}${String(i + 1).padStart(2, "0")}`);
const namnFor = (uid, i) => `${NAMN[i % NAMN.length]} ${uid.slice(0, 1).toUpperCase()}${uid.slice(-2)}`;

/** Klasserna: id → { name, studentIds }. */
const KLASSER = {
  "ak-3a": { name: "3A", studentIds: ["elev3a", ...fyll("c3a", 15)] },
  "ak-3b": { name: "3B", studentIds: fyll("c3b", 15) },
  "ak-4b": { name: "4B", studentIds: ["elev4b", "gunnar", ...fyll("c4b", 28)] },
  "ak-fri": { name: "Fritids", studentIds: ["elevfri", ...fyll("cfr", 2)] },
};
const DELTAR = Object.keys(KLASSER);
const AKTIV = "mm-qa-arskurs";
const SLUT = "mm-qa-arskurs-slut";

/** Poäng per elev (deterministiskt): 3A/3B 30–300 i steg, 4B 25–430, Fritids 7/19/42. */
function poang(classId, uid, i) {
  if (uid === "elev3a") return 12;
  if (uid === "elev4b") return 310;
  if (uid === "elevfri") return 19;
  if (uid === "gunnar") return 500;
  if (classId === "ak-3a") return 300 - i * 18;
  if (classId === "ak-3b") return 291 - i * 17;
  if (classId === "ak-4b") return 430 - i * 13;
  return 7 + i * 35;
}

async function seedTavling(cid, { startAt, endAt, status, result }) {
  for (const sub of ["answers", "studentStats", "scores", "classCounters"]) await rensa(`mathCompetitions/${cid}/${sub}`);
  const dok = {
    name: cid === AKTIV ? "Mattematchen årskurs" : "Mattematchen våras",
    participatingClassIds: DELTAR, startAt: Timestamp.fromMillis(startAt), endAt: Timestamp.fromMillis(endAt),
    status, counterShards: 5, createdBy: "qalarare", createdAt: Timestamp.fromMillis(startAt - DAG),
  };
  if (result) Object.assign(dok, { result, finishedAt: Timestamp.fromMillis(endAt) });
  await db.doc(`mathCompetitions/${cid}`).set(dok);
  const scores = [];
  const stats = [];
  const counters = [];
  const summa = {};
  for (const [classId, k] of Object.entries(KLASSER)) {
    const arskurs = arskursKod(arskursAvKlass(k.name));
    k.studentIds.forEach((uid, i) => {
      const correct = poang(classId, uid, i);
      const name = uid.startsWith("elev") ? { elev3a: "Elev Trea", elev4b: "Elev Fyra", elevfri: "Elev Fritids" }[uid]
        : uid === "gunnar" ? "Gamla Gunnar" : namnFor(uid, i);
      const sc = { uid, classId, name, correct, lastAttemptId: "seed", lastAt: Timestamp.fromMillis(NOW) };
      if (uid !== "gunnar") sc.arskurs = arskurs; // Gunnar = post från före #845
      scores.push(sc);
      stats.push({ uid, classId, correct, incorrect: Math.floor(correct / 9), lastAttemptId: "seed", lastAt: Timestamp.fromMillis(NOW),
        c7: Math.floor(correct / 3), c8: Math.floor(correct / 3), c9: correct - 2 * Math.floor(correct / 3), w7: Math.floor(correct / 9) });
      summa[classId] = (summa[classId] || 0) + correct;
    });
    for (let s = 0; s < 5; s++) {
      counters.push({ classId, shard: s, correct: Math.floor(summa[classId] / 5) + (s < summa[classId] % 5 ? 1 : 0),
        lastAttemptId: "seed", lastAt: Timestamp.fromMillis(NOW) });
    }
  }
  const base = `mathCompetitions/${cid}`;
  let b = db.batch();
  let n = 0;
  const put = (ref, data) => { b.set(ref, data); if (++n % 400 === 0) { const c = b; b = db.batch(); return c.commit(); } };
  for (const s of scores) await put(db.doc(`${base}/scores/${s.uid}`), s);
  for (const s of stats) await put(db.doc(`${base}/studentStats/${s.uid}`), s);
  for (const c of counters) await put(db.doc(`${base}/classCounters/${c.classId}_${c.shard}`), c);
  await b.commit();
  return { scores, stats, counters, summa };
}

async function main() {
  await ensureUser("qalarare", "qalarare@larare.pluggportalen.local", { teacher: true, admin: true });
  for (const [id, k] of Object.entries(KLASSER)) {
    await db.doc(`classes/${id}`).set({ name: k.name, order: 1, createdAt: NOW, studentIds: k.studentIds });
    for (const [i, uid] of k.studentIds.entries()) {
      if (uid.startsWith("elev")) await elev(uid, { elev3a: "Elev Trea", elev4b: "Elev Fyra", elevfri: "Elev Fritids" }[uid], true);
      else await elev(uid, uid === "gunnar" ? "Gamla Gunnar" : namnFor(uid, i));
    }
  }
  const aktiv = await seedTavling(AKTIV, { startAt: NOW - DAG, endAt: NOW + 9 * DAG, status: "active" });
  // Avslutad match med sparat result (samma data) → historikens filter.
  const classes = Object.entries(KLASSER).map(([id, k]) => ({ id, name: k.name, studentIds: k.studentIds }));
  const result = buildResult({
    scores: aktiv.scores, stats: aktiv.stats, counters: aktiv.counters, classes, participatingIds: DELTAR, names: [], now: NOW - 20 * DAG,
  });
  await seedTavling(SLUT, { startAt: NOW - 34 * DAG, endAt: NOW - 20 * DAG, status: "finished", result });

  const rad = Object.entries(aktiv.summa).map(([id, s]) => `${KLASSER[id].name} ${s}/${KLASSER[id].studentIds.length}`).join(", ");
  console.log(`✓ ${AKTIV} aktiv (3A+3B+4B+Fritids): ${rad}; Gamla Gunnar (4B, 500 p) saknar arskurs`);
  console.log(`✓ ${SLUT} avslutad med result (historik)`);
  console.log(`✓ elev3a (3A) / elev4b (4B) / elevfri (Fritids) / qalarare, lösenord ${PW}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
