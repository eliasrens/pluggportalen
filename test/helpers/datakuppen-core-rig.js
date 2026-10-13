// ============================================================================
// Testrigg för Datakuppens serverkärna (#652) – delas av
// functions-datakuppen-core.test.mjs och functions-datakuppen-hack.test.mjs.
// Admin SDK mot Firestore-emulatorn, STYRD klocka (ctl.clock) och STYRD slump
// (ctl.roll, eller ctl.rng = egen funktion) via deps.
//
// API
//   db, deps, ctl { clock, roll, rng? }, START/T0/END, reset()
//   rngFor(fileId, hacking?) → slumptal som ger just den filen
//   makeSession(over?, players?) → sid (live, 10 min, startad för 1 min sedan)
//   setGold(sid, uid, gold, extra?) · setCode(sid, uid, code, version?, extra?)
//   hackPending(at?) · giveHack(sid, uid, gold?, extra?)
//   gp / self / secret (sid, uid) · events(sid) · rightAnswer(sid, uid) → attemptId
//   att() · code(promise) → "ok" | felkod
// ============================================================================

import assert from "node:assert/strict";
import { after } from "node:test";
import admin from "firebase-admin";
import { answerQuestion, DkError } from "../../functions/datakuppen-core.js";
import { DK_RULES } from "../../src/live/formats/datakuppen/delat/files-config.js";
import { chestTable } from "../../src/live/formats/datakuppen/delat/datakuppen-regler.js";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
const app = admin.initializeApp({ projectId: PROJECT_ID }, `dk-core-${process.pid}-${Math.random()}`);
export const db = app.firestore();
export const { FieldValue, Timestamp } = admin.firestore;
after(() => app.delete());

export const START = Date.now() - 60_000; // matchen startade för en minut sedan
export const T0 = START + 4_000;
export const END = T0 + 600_000;
export const ctl = { clock: START + 30_000, roll: 0.5, rng: null };
export const deps = { db, FieldValue, Timestamp, now: () => ctl.clock, rng: () => (ctl.rng ? ctl.rng() : ctl.roll) };
export function reset() {
  ctl.clock = START + 30_000;
  ctl.roll = 0.5;
  ctl.rng = null;
}

// Slumptal som ger filen `id` (mitten av dess intervall i tabellen).
export function rngFor(id, hacking = true) {
  const rows = chestTable(hacking);
  const total = rows.reduce((n, r) => n + r.weight, 0);
  let acc = 0;
  for (const r of rows) {
    if (r.chest.id === id) return (acc + r.weight / 2) / total;
    acc += r.weight;
  }
  throw new Error(`ingen fil ${id}`);
}

const newSid = () => `dk-${Math.random().toString(36).slice(2, 10)}`;
const name = (uid) => uid[0].toUpperCase() + uid.slice(1);
const doc = (s, col, uid) => db.doc(`liveSessions/${s}/${col}/${uid}`);
export const gp = async (s, uid) => (await doc(s, "dkPlayers", uid).get()).data();
export const self = async (s, uid) => (await doc(s, "dkSelf", uid).get()).data();
export const secret = async (s, uid) => (await doc(s, "dkSecret", uid).get()).data();
export const events = async (s) => (await db.collection(`liveSessions/${s}/dkEvents`).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
export const code = async (p) => {
  try {
    await p;
  } catch (e) {
    assert.ok(e instanceof DkError, `DkError väntades, fick ${e}`);
    return e.code;
  }
  return "ok";
};

export async function makeSession(over = {}, players = ["alma", "omar", "leo", "ines"]) {
  const id = newSid();
  await db.doc(`liveSessions/${id}`).set({
    name: "Datakuppen 4B", format: "datakuppen", gameMode: "multiplication_0_10", answerKind: "free",
    participatingClassIds: ["4b"], classNames: { "4b": "4B" }, durationSeconds: 600, countdownSeconds: 4,
    status: "live", hacking: true, showNames: true, createdBy: "larare1",
    startedAt: Timestamp.fromMillis(START), ...over,
  });
  for (const uid of players) {
    await doc(id, "players", uid).set({ uid, classId: "4b", name: name(uid), correct: 0, incorrect: 0 });
  }
  return id;
}

/** Spelaren med data (+ fält) – som om servern redan skrivit. */
export async function setGold(s, uid, gold, extra = {}) {
  await doc(s, "dkPlayers", uid).set({
    uid, classId: "4b", name: name(uid), gold, correct: 0, incorrect: 0, chests: 0,
    protectedUntil: null, lastVictimUid: null, pending: null, lastHit: null, ...extra,
  }, { merge: true });
}

/** Elevens aktuella kod (server- och elevdokumentet) – som om hen valt den. */
export async function setCode(s, uid, kod, version = 1, extra = {}) {
  const st = { uid, code: kod, codeVersion: version, offers: null, offersExpiresAt: null, ...extra };
  await doc(s, "dkSecret", uid).set(st, { merge: true });
  await doc(s, "dkSelf", uid).set(st, { merge: true });
}

export const hackPending = (at = ctl.clock) =>
  ({ kind: "steal", chest: "hack", attemptId: "x-attempt-1", at: Timestamp.fromMillis(at), expiresAt: Timestamp.fromMillis(at + DK_RULES.victimPickMs) });

/** Spelaren har just öppnat en Hack-fil (väntar på att välja mål). */
export async function giveHack(s, uid, gold = 0, extra = {}) {
  await setGold(s, uid, gold, { pending: hackPending(), ...extra });
}

let n = 0;
export const att = () => `att-${Date.now().toString(36)}-${n++}`;
/** Ett rätt multiplikationssvar via servern → attemptId. */
export async function rightAnswer(s, uid) {
  const id = att();
  const r = await answerQuestion(deps, uid, { sid: s, attemptId: id, factorA: 3, factorB: 4, answer: 12 });
  assert.equal(r.correct, true);
  return id;
}
