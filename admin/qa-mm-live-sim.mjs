// ============================================================================
// QA-simulator för Mattematchen + Live (#462) – "många elever" mot EMULATORN.
// ----------------------------------------------------------------------------
// Till skillnad från qa-live-seed.mjs --sim (admin, förbi reglerna) loggar den
// här in som RIKTIGA elever (klient-SDK + Auth-emulatorn) och skriver exakt de
// batcher appen skriver (src/tavling/answer-writes.js) → firestore.rules
// prövar varje svar precis som i klassrummet. Kör efter admin/qa-mm-live-seed.mjs.
//
//   E="FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099"
//   env $E node admin/qa-mm-live-sim.mjs join  <sid> 4b:15 5e:18     # n första eleverna "redo"
//   env $E node admin/qa-mm-live-sim.mjs svar  <sid> 4b=340 5e=418   # fyll klassens rätt till målet
//   env $E node admin/qa-mm-live-sim.mjs prova <sid> <uid>           # ETT svar → godkänt/nekat
//   env $E node admin/qa-mm-live-sim.mjs dubbel <sid> <uid>          # samma attemptId två gånger
//   env $E node admin/qa-mm-live-sim.mjs mm <competitionId> <uid> <n> # n rätt i Mattematchen
//
// "svar" läser nuvarande klassräknare (admin, bara läsning) och lägger sedan
// till skillnaden som rätta svar fördelade över de anslutna sim-eleverna
// (plus ~10 % fel som inte räknas) – riktiga UI-elevers svar räknas in i målet.
// Vägrar köra utan emulator-variablerna.
// ============================================================================
import admin from "firebase-admin";
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from "firebase/auth";
import {
  initializeFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, writeBatch, increment, serverTimestamp,
} from "firebase/firestore";
import { planLiveAnswerWrites, planLiveJoin, planMathAnswerWrites, pickShard } from "../src/tavling/answer-writes.js";

const FS = process.env.FIRESTORE_EMULATOR_HOST;
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!FS || !AUTH) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const PROJECT = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const adb = admin.firestore(admin.initializeApp({ projectId: PROJECT }));
const fv = { increment, serverTimestamp };
const MODE = "multiplication_0_10";
const KLASS_PREFIX = { "4b": "b", "5e": "e", "4a": "a", "3a": "c" };
const uidsFor = (cid, n) => Array.from({ length: n }, (_, i) => `${KLASS_PREFIX[cid]}${String(i + 1).padStart(2, "0")}`);
const attemptId = () => `sim${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

/** Inloggad klient-db för en elev (egen app-instans per elev). */
const clients = new Map();
async function as(uid) {
  if (clients.has(uid)) return clients.get(uid);
  const app = initializeApp({ apiKey: "demo-key", projectId: PROJECT }, uid);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH}`, { disableWarnings: true });
  const db = initializeFirestore(app, {});
  const [h, p] = FS.split(":");
  connectFirestoreEmulator(db, h, Number(p));
  await signInWithEmailAndPassword(auth, `${uid}@elev.pluggportalen.local`, "lilla123"); // endast emulator
  clients.set(uid, db);
  return db;
}

function fraga(ok) {
  const a = Math.floor(Math.random() * 11);
  const b = Math.floor(Math.random() * 11);
  const svar = ok ? a * b : a * b + 1;
  return { factorA: a, factorB: b, answer: svar, correctAnswer: a * b };
}

async function commit(db, writes) {
  const b = writeBatch(db);
  for (const w of writes) b.set(doc(db, ...w.path), w.data, w.merge ? { merge: true } : undefined);
  await b.commit();
}

async function liveSvar(sid, s, uid, ok, id = attemptId()) {
  const db = await as(uid);
  const classId = s.participatingClassIds.find((c) => uid.startsWith(KLASS_PREFIX[c]));
  await commit(db, planLiveAnswerWrites({
    sessionId: sid, attemptId: id, uid, classId, mode: MODE, record: fraga(ok), isCorrect: ok,
    shard: pickShard(s.counterShards), fv,
  }));
}

async function session(sid) {
  const s = (await adb.doc(`liveSessions/${sid}`).get()).data();
  if (!s) throw new Error(`ingen session ${sid}`);
  return s;
}

/** Kör fn på listan med högst `par` samtidiga. */
async function parallellt(list, par, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: par }, async () => {
    while (i < list.length) await fn(list[i++]);
  }));
}

async function join(sid, specs) {
  for (const spec of specs) {
    const [cid, n] = spec.split(":");
    await parallellt(uidsFor(cid, Number(n)), 6, async (uid) => {
      const db = await as(uid);
      const ref = doc(db, "liveSessions", sid, "players", uid);
      if ((await getDoc(ref)).exists()) return;
      const name = (await getDoc(doc(db, "students", uid))).data()?.namn || "";
      const w = planLiveJoin({ sessionId: sid, uid, classId: cid, name, fv });
      await setDoc(doc(db, ...w.path), w.data);
    });
    console.log(`✓ ${n} elever från ${cid} har gått med i ${sid}`);
  }
}

async function svar(sid, specs) {
  const s = await session(sid);
  const counters = (await adb.collection(`liveSessions/${sid}/counters`).get()).docs.map((d) => d.data());
  const players = (await adb.collection(`liveSessions/${sid}/players`).get()).docs.map((d) => d.id);
  const t0 = Date.now();
  let skickade = 0;
  for (const spec of specs) {
    const [cid, mal] = spec.split("=");
    const nu = counters.filter((c) => c.classId === cid).reduce((a, c) => a + (c.correct || 0), 0);
    const elever = players.filter((u) => u.startsWith(KLASS_PREFIX[cid]) && /^\w\d\d$/.test(u)).sort();
    const kvar = Number(mal) - nu;
    if (kvar < 0) throw new Error(`${cid} har redan ${nu} > ${mal}`);
    // Varje elev får sina rätt + några fel, i slumpad ordning, ett svar i taget.
    const jobb = elever.map((uid, i) => {
      const ratt = Math.floor(kvar / elever.length) + (i < kvar % elever.length ? 1 : 0);
      const lista = [...Array(ratt).fill(true), ...Array(Math.round(ratt / 9)).fill(false)].sort(() => Math.random() - 0.5);
      return { uid, lista };
    });
    await parallellt(jobb, 12, async ({ uid, lista }) => {
      for (const ok of lista) {
        await liveSvar(sid, s, uid, ok);
        skickade++;
      }
    });
    console.log(`✓ ${cid}: ${nu} → ${mal} rätt (${kvar} nya rätta svar från ${elever.length} elever)`);
  }
  console.log(`  ${skickade} batcher på ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

async function prova(sid, uid) {
  const s = await session(sid);
  try {
    await liveSvar(sid, s, uid, true);
    console.log(`GODKÄNT: ${uid} fick svara i ${sid} (status ${s.status})`);
  } catch (e) {
    console.log(`NEKAT: ${uid} i ${sid} (status ${s.status}) → ${e.code || e.message}`);
  }
}

async function dubbel(sid, uid) {
  const s = await session(sid);
  const id = attemptId();
  await liveSvar(sid, s, uid, true, id);
  console.log(`1:a svaret (${id}) godkänt`);
  try {
    await liveSvar(sid, s, uid, true, id);
    console.log("FEL: 2:a svaret med SAMMA attemptId godkändes");
  } catch (e) {
    console.log(`2:a svaret med samma attemptId nekat → ${e.code || e.message}`);
  }
}

async function mm(cid, uid, n) {
  const db = await as(uid);
  const classId = Object.keys(KLASS_PREFIX).find((c) => uid.startsWith(KLASS_PREFIX[c]));
  const name = (await getDoc(doc(db, "students", uid))).data()?.namn || "";
  for (let i = 0; i < n; i++) {
    await commit(db, planMathAnswerWrites({
      competitionId: cid, attemptId: attemptId(), uid, classId, name, record: fraga(true), isCorrect: true,
      shard: pickShard(5), fv,
    }));
  }
  console.log(`✓ ${uid}: ${n} rätt i ${cid}`);
}

const [cmd, ...rest] = process.argv.slice(2);
const jobs = {
  join: () => join(rest[0], rest.slice(1)),
  svar: () => svar(rest[0], rest.slice(1)),
  prova: () => prova(rest[0], rest[1]),
  dubbel: () => dubbel(rest[0], rest[1]),
  mm: () => mm(rest[0], rest[1], Number(rest[2] || 1)),
};
if (!jobs[cmd]) {
  console.error("Användning: join|svar|prova|dubbel|mm – se filhuvudet.");
  process.exit(1);
}
jobs[cmd]().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
