// ============================================================================
// QA-seed för slut-QA av epic #844 (#848) – BARA mot emulatorerna.
// ----------------------------------------------------------------------------
// Lösenord för alla konton: lilla123 (endast emulator).
//   Mattematch "mm-848" AKTIV för 3A + 4B (inte 5E). 3A: elev3a + 15 elever,
//   4B: elev4b + Gamla Gunnar + 14 elever. elev3a = 12 rätt.
//   "mm-848-forbi" (status active men perioden slut för 1 h sedan) och
//   "mm-848-snart" (startar om 2 h) – båda bara 5E → ett svar från elev5e får
//   inte hamna någonstans. "mm-848-slut" avslutad med result (lärarhistorik).
//   Live: "qa-848-klassmatch" (Klassmatch = klientformat, multiplikation,
//   3A/4B/5E) och "qa-848-datakupp" (Datakuppen = serverformat via
//   datakuppAnswer, multiplikation, 3A/4B/5E), båda pågår 60 min.
//   elev3a:s dagsräknare för MM-mynt sätts till $MYNT (default 0).
// Konton: elev3a (3A), elev4b (4B), elev5e (5E, deltar inte), qalarare (admin).
//
//   FIRESTORE_EMULATOR_HOST=… FIREBASE_AUTH_EMULATOR_HOST=… GCLOUD_PROJECT=pluggportalen-so-2026 \
//   node admin/qa-mattematchen-844-seed.mjs
// ============================================================================
import admin from "firebase-admin";
import { buildResult } from "../src/tavling/mm-teacher-core.js";
import { myntDag } from "../src/tavling/mm-config.js";

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
const H = 3600_000;
const DAG = 24 * H;
const NAMN = ["Alma", "Omar", "Clara", "Noah", "Ella", "Liam", "Saga", "Hugo", "Maja", "Elias", "Wilma", "Adam",
  "Ebba", "Ali", "Stella", "Leo"];
const fyll = (p, n) => Array.from({ length: n }, (_, i) => `${p}${String(i + 1).padStart(2, "0")}`);

const KLASSER = {
  "k848-3a": { name: "3A", ids: ["elev3a", ...fyll("d3a", 15)] },
  "k848-4b": { name: "4B", ids: ["elev4b", "gunnar848", ...fyll("d4b", 14)] },
  "k848-5e": { name: "5E", ids: ["elev5e", ...fyll("d5e", 3)] },
};
const INLOGG = { elev3a: "Elev Trea", elev4b: "Elev Fyra", elev5e: "Elev Femma" };
const DELTAR = ["k848-3a", "k848-4b"];

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
const namnPa = (uid, i) => INLOGG[uid] || (uid === "gunnar848" ? "Gamla Gunnar" : `${NAMN[i % NAMN.length]} ${uid.slice(1, 3).toUpperCase()}${uid.slice(-2)}`);
const poang = (uid, i) => (uid === "elev3a" ? 12 : uid === "elev4b" ? 210 : uid === "gunnar848" ? 500 : uid.startsWith("d3a") ? 300 - i * 17 : 420 - i * 23);

async function tavling(cid, f) {
  for (const sub of ["answers", "liveAnswers", "studentStats", "scores", "classCounters"]) await rensa(`mathCompetitions/${cid}/${sub}`);
  await db.doc(`mathCompetitions/${cid}`).set({
    counterShards: 5, createdBy: "qalarare", createdAt: Timestamp.fromMillis(f.startAt - DAG), ...f,
    startAt: Timestamp.fromMillis(f.startAt), endAt: Timestamp.fromMillis(f.endAt),
  });
}

async function fyllPoang(cid) {
  const scores = [], stats = [], counters = [], summa = {};
  for (const classId of DELTAR) {
    KLASSER[classId].ids.forEach((uid, i) => {
      const correct = poang(uid, i);
      const lastAt = Timestamp.fromMillis(NOW - H);
      scores.push({ uid, classId, name: namnPa(uid, i), correct, lastAttemptId: "seed", lastAt });
      stats.push({ uid, classId, correct, incorrect: Math.floor(correct / 9), lastAttemptId: "seed", lastAt, c7: correct });
      summa[classId] = (summa[classId] || 0) + correct;
    });
    for (let s = 0; s < 5; s++) {
      const t = summa[classId];
      counters.push({ classId, shard: s, correct: Math.floor(t / 5) + (s < t % 5 ? 1 : 0), lastAttemptId: "seed", lastAt: Timestamp.fromMillis(NOW - H) });
    }
  }
  const b = db.batch();
  const base = `mathCompetitions/${cid}`;
  for (const s of scores) b.set(db.doc(`${base}/scores/${s.uid}`), s);
  for (const s of stats) b.set(db.doc(`${base}/studentStats/${s.uid}`), s);
  for (const c of counters) b.set(db.doc(`${base}/classCounters/${c.classId}_${c.shard}`), c);
  await b.commit();
  return { scores, stats, counters, summa };
}

async function live(sid, format, extra = {}) {
  for (const sub of ["players", "answers", "counters", "dkPlayers"]) await rensa(`liveSessions/${sid}/${sub}`);
  await db.doc(`liveSessions/${sid}`).set({
    name: format === "klassmatch" ? "3A mot 4B mot 5E" : "Datakuppen 3A/4B/5E", format, gameMode: "multiplication_0_10",
    answerKind: "free", participatingClassIds: Object.keys(KLASSER),
    classNames: Object.fromEntries(Object.entries(KLASSER).map(([id, k]) => [id, k.name])),
    classDivisors: Object.fromEntries(Object.entries(KLASSER).map(([id, k]) => [id, k.ids.length])),
    durationSeconds: 3600, countdownSeconds: 0, counterShards: 10, status: "live", showNames: true,
    createdBy: "qalarare", createdAt: Timestamp.fromMillis(NOW - 60_000),
    startedAt: Timestamp.fromMillis(NOW - 5_000), endsAt: Timestamp.fromMillis(NOW - 5_000 + H), ...extra,
  });
}

async function main() {
  await ensureUser("qalarare", "qalarare@larare.pluggportalen.local", { teacher: true, admin: true });
  for (const [id, k] of Object.entries(KLASSER)) {
    await db.doc(`classes/${id}`).set({ name: k.name, order: 1, createdAt: NOW, studentIds: k.ids });
    for (const [i, uid] of k.ids.entries()) {
      await db.doc(`students/${uid}`).set({ namn: namnPa(uid, i), username: uid, avatarId: "fox" });
      if (INLOGG[uid]) {
        await ensureUser(uid, `${uid}@elev.pluggportalen.local`);
        await db.doc(`studentData/${uid}`).set({ coins: 250, progress: {}, avatarId: "fox" });
        await rensa(`studentData/${uid}/mmMynt`);
      }
    }
  }
  await tavling("mm-848", { name: "Mattematchen 3A–4B", participatingClassIds: DELTAR, status: "active", startAt: NOW - DAG, endAt: NOW + 7 * DAG });
  const aktiv = await fyllPoang("mm-848");
  await tavling("mm-848-forbi", { name: "MM förbi (5E)", participatingClassIds: ["k848-5e"], status: "active", startAt: NOW - 7 * DAG, endAt: NOW - H });
  await tavling("mm-848-snart", { name: "MM snart (5E)", participatingClassIds: ["k848-5e"], status: "active", startAt: NOW + 2 * H, endAt: NOW + 5 * DAG });
  await tavling("mm-848-slut", { name: "Mattematchen förra månaden", participatingClassIds: DELTAR, status: "finished", startAt: NOW - 40 * DAG, endAt: NOW - 30 * DAG });
  const slut = await fyllPoang("mm-848-slut");
  const classes = Object.entries(KLASSER).map(([id, k]) => ({ id, name: k.name, studentIds: k.ids }));
  const result = buildResult({ ...slut, classes, participatingIds: DELTAR, names: [], now: NOW - 30 * DAG });
  await db.doc("mathCompetitions/mm-848-slut").update({ result, finishedAt: Timestamp.fromMillis(NOW - 30 * DAG) });

  await live("qa-848-klassmatch", "klassmatch");
  await live("qa-848-datakupp", "datakuppen", { hacking: true });

  const n = Number(process.env.MYNT) || 0;
  if (n > 0) {
    const dag = myntDag(NOW);
    await db.doc(`studentData/elev3a/mmMynt/${dag}`).set({ dag, cid: "mm-848", mynt: n, lastAttemptId: "seed", lastAt: Timestamp.now() });
  }
  const rad = Object.entries(aktiv.summa).map(([id, s]) => `${KLASSER[id].name} ${s}/${KLASSER[id].ids.length}`).join(", ");
  console.log(`✓ mm-848 aktiv (3A+4B): ${rad}; mm-848-forbi/-snart (5E); mm-848-slut (historik)`);
  console.log(`✓ Live: qa-848-klassmatch (klient) + qa-848-datakupp (server), 3A/4B/5E, 60 min`);
  console.log(`✓ elev3a/elev4b/elev5e/qalarare, lösenord ${PW}; elev3a mmMynt idag = ${n}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
