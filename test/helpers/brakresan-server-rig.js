// ============================================================================
// Bråkresan (#708): testrigg för serverkärnan (functions/brakresan-core.js)
// direkt mot Firestore-emulatorn med Admin SDK och styrd klocka. Utmaningarna
// injiceras (deps.loadChallenge) – testfixturen ur brakresan-fixtur.js under
// valfritt id – så kärnan testas oberoende av vilka av de 50 som är byggda.
// ============================================================================

import admin from "firebase-admin";
import { fixture } from "./brakresan-fixtur.js";
import { stubChallenge } from "../../functions/brakresan/schema/kontrakt.js";

export function createBrRig(name) {
  const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
  process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
  const app = admin.initializeApp({ projectId: PROJECT_ID }, `${name}-${process.pid}`);
  const db = app.firestore();
  const { FieldValue, Timestamp } = admin.firestore;
  const ctl = { clock: Date.parse("2026-10-14T10:00:00Z"), challenges: {} };

  /** Utmaningen "NN": fixturen (byggd) om den registrerats med useChallenge, annars en stubbe. */
  const loadChallenge = async (id) => ctl.challenges[id] || stubChallenge(id);
  const useChallenge = (id, overrides = {}) => {
    ctl.challenges[id] = fixture({ id, ...overrides });
    return ctl.challenges[id];
  };
  const deps = { db, FieldValue, Timestamp, now: () => ctl.clock, loadChallenge };

  const state = async (uid) => (await db.doc(`studentData/${uid}/brakresa/state`).get()).data();
  const round = async (uid, roundId) => (await db.doc(`studentData/${uid}/brakresaRounds/${roundId}`).get()).data();
  const coins = async (uid) => (await db.doc(`studentData/${uid}`).get()).data()?.coins ?? 0;
  const rewards = async (uid) => (await db.collection(`studentData/${uid}/brakresaRewards`).get()).docs.map((d) => d.id).sort();

  /** Ett rätt eller fel svar på uppgift i, ur de SPARADE uppgifternas exempel (bara testet läser facit). */
  async function svar(roundId, i, ratt = true) {
    const t = (await db.doc(`brakresaSecrets/${roundId}`).get()).data().tasks[i];
    return ratt ? t.key.examples.right[0] : t.key.examples.wrong[0];
  }

  async function rensa(prefix) {
    for (const coll of ["studentData", "classes"]) {
      const s = await db.collection(coll).get();
      for (const d of s.docs.filter((x) => x.id.startsWith(prefix))) await db.recursiveDelete(d.ref);
    }
    const sec = await db.collection("brakresaSecrets").where("studentId", ">=", prefix).where("studentId", "<", `${prefix}`).get();
    await Promise.all(sec.docs.map((d) => d.ref.delete()));
  }

  return { app, db, FieldValue, Timestamp, ctl, deps, useChallenge, state, round, coins, rewards, svar, rensa };
}
