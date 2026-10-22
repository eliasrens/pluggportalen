// ============================================================================
// Testrigg för Meteorstormens serverkärna (#821) – functions-meteorstorm-core
// och -quiz. Admin SDK mot Firestore-emulatorn, STYRD klocka (ctl.clock) och
// ett eget minne per session (deps(sid) → nyttMinne), så att varje test börjar
// med en kall "instans". Skrivningar/läsningar räknas inte här (se
// admin/ms-kvot-sim.mjs).
//
// API
//   db, ctl { clock }, T0 (stormen börjar), END, START
//   deps(minne?)           → deps med styrd klocka, sleep = 0, roll ur auth.teacher
//   makeSession(over?, players?) → sid (live, Klass mot klass 4b mot 4d, 10 min)
//   makeQuiz(over?)        → sid med quiz (msPublic/msPrivate, 4 frågor)
//   events(sid) · ev(sid, id) · msPlayer(sid, uid) · status(sid) · session(sid)
//   att() · code(promise) → "ok" | felkod
//   mult(a, b, svar?)      → svar-objektet för multiplikation
// ============================================================================

import assert from "node:assert/strict";
import { after } from "node:test";
import admin from "firebase-admin";
import { KsError, nyttMinne } from "../../functions/meteorstorm-core.js";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
const app = admin.initializeApp({ projectId: PROJECT_ID }, `ms-core-${process.pid}-${Math.random()}`);
export const db = app.firestore();
export const { FieldValue, Timestamp } = admin.firestore;
after(() => app.delete());

export const START = Date.now() - 120_000; // STARTA för två minuter sedan
export const T0 = START + 4000; // + nedräkningen
export const END = T0 + 600_000;
export const ctl = { clock: T0 + 60_000 };

export function deps(minne = nyttMinne()) {
  return {
    db, FieldValue, Timestamp, minne,
    now: () => ctl.clock,
    sleep: async () => {},
    roll: async (auth) => (auth?.teacher ? { role: "admin" } : null),
  };
}

const newSid = () => `ms-${Math.random().toString(36).slice(2, 10)}`;
const name = (uid) => uid[0].toUpperCase() + uid.slice(1);
const col = (s, c) => db.collection(`liveSessions/${s}/${c}`);
export const ev = async (s, id) => (await col(s, "msEvents").doc(id).get()).data();
export const events = async (s) => (await col(s, "msEvents").get()).docs.map((d) => ({ id: d.id, ...d.data() }));
export const msPlayer = async (s, uid) => (await col(s, "msPlayers").doc(uid).get()).data();
export const status = async (s) => (await col(s, "msPublic").doc("status").get()).data();
export const session = async (s) => (await db.doc(`liveSessions/${s}`).get()).data();

export const KLASSER = { alma: "4b", bo: "4b", cleo: "4b", omar: "4d", dina: "4d" };

export async function makeSession(over = {}, players = Object.keys(KLASSER)) {
  const id = newSid();
  await db.doc(`liveSessions/${id}`).set({
    name: "Meteorstormen", format: "meteorstorm", gameMode: "multiplication_0_10", answerKind: "free",
    participatingClassIds: ["4b", "4d"], classNames: { "4b": "4B", "4d": "4D" }, durationSeconds: 600, countdownSeconds: 4,
    status: "live", createdBy: "larare1", msSeed: 4711, msInstallningar: { lage: "klass-mot-klass", attacker: "milda" },
    showNames: true, startedAt: Timestamp.fromMillis(START), ...over,
  });
  for (const uid of players) {
    await col(id, "players").doc(uid).set({
      uid, classId: KLASSER[uid], name: name(uid), correct: 0, incorrect: 0, joinedAt: Timestamp.fromMillis(START - 10_000),
    });
  }
  return id;
}

export const QUESTIONS = [
  { id: "q0", text: "Fråga 0", options: ["a", "b", "c", "d"], statKeys: ["k0"] },
  { id: "q1", text: "Fråga 1", options: ["a", "b", "c", "d"] },
  { id: "q2", text: "Fråga 2", options: ["a", "b", "c", "d"] },
  { id: "q3", text: "Fråga 3", options: ["a", "b", "c", "d"] },
];
export const FACIT = [{ answerIndex: 0 }, { answerIndex: 1 }, { answerIndex: 2 }, { answerIndex: 3 }];

export async function makeQuiz(over = {}) {
  const id = await makeSession({ gameMode: "plugga_quiz", answerKind: "choice", questionCount: 4, ...over });
  await col(id, "msPublic").doc("questions").set({ questions: QUESTIONS });
  await col(id, "msPrivate").doc("snapshot").set({ facit: FACIT });
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
