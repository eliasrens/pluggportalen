// ============================================================================
// Testrigg för Kurragömmas serverkärna (#838) – functions-kurragomma-core,
// -leta och -tick. Admin SDK mot Firestore- OCH Realtime Database-emulatorn,
// STYRD klocka (ctl.clock) och styrd slump (ctl.rng), eget minne per deps()
// (nyttMinne) så varje test börjar med en kall "instans".
//
// API
//   db, rtdb, ctl { clock, rng }, START (STARTA), T0 (KÖR! = gömfasen börjar),
//   GOMSLUT (= T0 + 30 s), END (= T0 + 30 s + 10 min)
//   deps(minne?)              → deps med styrd klocka/slump, roll ur auth.teacher
//   makeSession(over?, players?) → sid (live, klass 4b, 5 elever, startsökare 1 = alma
//                                med rng 0; gömtid 30 s, speltid 10 min)
//   kgPlayer/self/secret(sid, uid) · events(sid) · session(sid) · kanal(sid) (RTDB /kg/{sid})
//   puls(sid, uid, ms)        players.lastSeenAt = ms (elevens närvaropuls)
//   pos(sid, uid, { x, z, t }) sökarens egen pos i RTDB (som klienten)
//   att() · mult(a, b, svar?) · code(promise) → "ok" | felkod
//   LADA                      ett fast föremål (ladan) ur kartan
// ============================================================================

import assert from "node:assert/strict";
import { after } from "node:test";
import admin from "firebase-admin";
import { KsError, nyttMinne } from "../../functions/kurragomma-core.js";
import { ON } from "../../src/live/formats/kurragomma/delat/kg-karta.js";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
process.env.FIREBASE_DATABASE_EMULATOR_HOST ||= "127.0.0.1:9000";
const app = admin.initializeApp({
  projectId: PROJECT_ID, databaseURL: `http://${process.env.FIREBASE_DATABASE_EMULATOR_HOST}?ns=${PROJECT_ID}-default-rtdb`,
}, `kg-core-${process.pid}-${Math.random()}`);
export const db = app.firestore();
export const rtdb = app.database();
export const { FieldValue, Timestamp } = admin.firestore;
after(async () => {
  rtdb.goOffline();
  await app.delete();
});

export const START = Date.now() - 120_000; // STARTA för två minuter sedan
export const T0 = START + 4000; // + nedräkningen = KÖR!
export const GOMTID_MS = 30_000;
export const GOMSLUT = T0 + GOMTID_MS;
export const END = GOMSLUT + 600_000;
export const ctl = { clock: T0 + 1000, rng: () => 0 };
export const LADA = ON.foremal.find((f) => f.typ === "lada");

export function deps(minne = nyttMinne()) {
  return {
    db, rtdb, FieldValue, Timestamp, minne,
    now: () => ctl.clock,
    rng: () => ctl.rng(),
    roll: async (auth) => (auth?.teacher ? { role: "admin" } : null),
  };
}

const newSid = () => `kg-${Math.random().toString(36).slice(2, 10)}`;
const name = (uid) => uid[0].toUpperCase() + uid.slice(1);
const col = (s, c) => db.collection(`liveSessions/${s}/${c}`);
export const kgPlayer = async (s, uid) => (await col(s, "kgPlayers").doc(uid).get()).data();
export const self = async (s, uid) => (await col(s, "kgSelf").doc(uid).get()).data();
export const secret = async (s, uid) => (await col(s, "kgSecret").doc(uid).get()).data();
export const events = async (s) => (await col(s, "kgEvents").orderBy("t").get()).docs.map((d) => ({ id: d.id, ...d.data() }));
export const answers = async (s) => (await col(s, "answers").get()).docs.map((d) => ({ id: d.id, ...d.data() }));
export const session = async (s) => (await db.doc(`liveSessions/${s}`).get()).data();
export const kanal = async (s) => (await rtdb.ref(`kg/${s}`).once("value")).val();
export const puls = (s, uid, ms) => col(s, "players").doc(uid).update({ lastSeenAt: Timestamp.fromMillis(ms) });
export const pos = (s, uid, p) => rtdb.ref(`kg/${s}/pos/${uid}`).set({ x: p.x, z: p.z, yaw: p.yaw || 0, t: p.t });

export const ELEVER = ["alma", "bo", "cleo", "dina", "emil"];

export async function makeSession(over = {}, players = ELEVER) {
  const id = newSid();
  await db.doc(`liveSessions/${id}`).set({
    name: "Kurragömma 4B", format: "kurragomma", gameMode: "multiplication_0_10", answerKind: "free",
    participatingClassIds: ["4b"], classNames: { "4b": "4B" }, durationSeconds: 630, countdownSeconds: 4,
    status: "live", createdBy: "larare1", kgInstallningar: { gomtid: 30, startsokare: 1, tystnad: true, karta: "on" },
    showNames: true, startedAt: Timestamp.fromMillis(START), ...over,
  });
  for (const uid of players) {
    await col(id, "players").doc(uid).set({
      uid, classId: "4b", name: name(uid), correct: 0, incorrect: 0,
      joinedAt: Timestamp.fromMillis(START - 10_000), lastSeenAt: Timestamp.fromMillis(ctl.clock),
    });
  }
  return id;
}

export const QUESTIONS = [
  { id: "q0", text: "Fråga 0", options: ["a", "b", "c", "d"], statKeys: ["k0"] },
  { id: "q1", text: "Fråga 1", options: ["a", "b", "c", "d"] },
  { id: "q2", text: "Fråga 2", options: ["a", "b", "c", "d"] },
];
export const FACIT = [{ answerIndex: 0 }, { answerIndex: 1 }, { answerIndex: 2 }];

export async function makeQuiz(over = {}) {
  const id = await makeSession({ gameMode: "plugga_quiz", answerKind: "choice", questionCount: 3, ...over });
  await col(id, "kgPublic").doc("questions").set({ questions: QUESTIONS });
  await col(id, "kgPrivate").doc("snapshot").set({ facit: FACIT });
  return id;
}

let n = 0;
export const att = () => `att-${Date.now().toString(36)}-${n++}`;
export const mult = (a, b, svar = a * b) => ({ factorA: a, factorB: b, answer: svar });

export const code = async (p) => {
  try {
    await p;
  } catch (e) {
    assert.ok(e instanceof KsError, `KsError väntades, fick ${e?.stack || e}`);
    return e.code;
  }
  return "ok";
};
