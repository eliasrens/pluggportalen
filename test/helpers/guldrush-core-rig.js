// ============================================================================
// Testrigg för Guldrushens serverkärna (#563) – delas av
// functions-guldrush-core.test.mjs och functions-guldrush-stold.test.mjs.
// Admin SDK mot Firestore-emulatorn, STYRD klocka (ctl.clock) och STYRD slump
// (ctl.roll) via deps, så varje kista och skyddstid går att testa exakt.
//
// API
//   db, deps, ctl { clock, roll }, START/T0/END, reset()
//   rngFor(chestId, stealSwap?) → slumptal som ger just den kistan
//   makeSession(over?, players?) → sid (live, 10 min, startad för 1 min sedan)
//   setGold(sid, uid, gold, extra?) · pending(kind, chest?, at?) · gp(sid, uid)
//   events(sid) · rightAnswer(sid, uid) → attemptId · att() · code(promise)
// ============================================================================

import assert from "node:assert/strict";
import { after } from "node:test";
import admin from "firebase-admin";
import { answerQuestion, GrError } from "../../functions/guldrush-core.js";
import { GR_RULES } from "../../src/live/formats/guldrush/delat/chests-config.js";
import { chestTable } from "../../src/live/formats/guldrush/delat/guldrush-regler.js";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
const app = admin.initializeApp({ projectId: PROJECT_ID }, `gr-core-${process.pid}`);
export const db = app.firestore();
export const { FieldValue, Timestamp } = admin.firestore;
after(() => app.delete());

export const START = Date.now() - 60_000; // matchen startade för en minut sedan
export const T0 = START + 4_000;
export const END = T0 + 600_000;
export const ctl = { clock: START + 30_000, roll: 0.5 };
export const deps = { db, FieldValue, Timestamp, now: () => ctl.clock, rng: () => ctl.roll };
export function reset() {
  ctl.clock = START + 30_000;
  ctl.roll = 0.5;
}

// Slumptal som ger kistan `id` (mitten av dess intervall i tabellen).
export function rngFor(id, stealSwap = true) {
  const rows = chestTable(stealSwap);
  const total = rows.reduce((n, r) => n + r.weight, 0);
  let acc = 0;
  for (const r of rows) {
    if (r.chest.id === id) return (acc + r.weight / 2) / total;
    acc += r.weight;
  }
  throw new Error(`ingen kista ${id}`);
}

const sid = () => `gr-${Math.random().toString(36).slice(2, 10)}`;
export const sRef = (s) => db.doc(`liveSessions/${s}`);
export const gp = async (s, uid) => (await db.doc(`liveSessions/${s}/grPlayers/${uid}`).get()).data();
export const events = async (s) => (await db.collection(`liveSessions/${s}/grEvents`).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
export const code = async (p) => {
  try {
    await p;
  } catch (e) {
    assert.ok(e instanceof GrError, `GrError väntades, fick ${e}`);
    return e.code;
  }
  return "ok";
};

export async function makeSession(over = {}, players = ["alma", "omar", "leo", "ines"]) {
  const id = sid();
  await sRef(id).set({
    name: "Guldrushen 4B", format: "guldrush", gameMode: "multiplication_0_10", answerKind: "free",
    participatingClassIds: ["4b"], classNames: { "4b": "4B" }, durationSeconds: 600, countdownSeconds: 4,
    status: "live", stealSwap: true, showNames: true, createdBy: "larare1",
    startedAt: Timestamp.fromMillis(START), ...over,
  });
  for (const uid of players) {
    await db.doc(`liveSessions/${id}/players/${uid}`).set({ uid, classId: "4b", name: uid[0].toUpperCase() + uid.slice(1), correct: 0, incorrect: 0 });
  }
  return id;
}

/** Spelaren med guld (+ fält) – som om servern redan skrivit. */
export async function setGold(s, uid, gold, extra = {}) {
  await db.doc(`liveSessions/${s}/grPlayers/${uid}`).set({
    uid, classId: "4b", name: uid[0].toUpperCase() + uid.slice(1), gold, correct: 0, incorrect: 0, chests: 0,
    shield: false, protectedUntil: null, lastVictimUid: null, pending: null, lastHit: null, ...extra,
  }, { merge: true });
}
export const pending = (kind, chest = kind === "steal" ? "stold" : "byte", at = ctl.clock) =>
  ({ kind, chest, attemptId: "x-attempt-1", at: Timestamp.fromMillis(at), expiresAt: Timestamp.fromMillis(at + GR_RULES.victimPickMs) });

let n = 0;
export const att = () => `att-${Date.now().toString(36)}-${n++}`;
/** Ett rätt multiplikationssvar via servern → attemptId. */
export async function rightAnswer(s, uid) {
  const id = att();
  const r = await answerQuestion(deps, uid, { sid: s, attemptId: id, factorA: 3, factorB: 4, answer: 12 });
  assert.equal(r.correct, true);
  return id;
}
