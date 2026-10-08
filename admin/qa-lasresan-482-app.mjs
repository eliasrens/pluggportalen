// ============================================================================
// Läsresan-slut-QA (#515): appens dataväg speglad för Node – BARA emulatorn.
// ----------------------------------------------------------------------------
// Samma rena funktioner och transaktioner som src/data-lasresan.js och
// src/data-lasresan-niva.js, men via npm-paketet firebase (klient-SDK, reglerna
// gäller) i stället för gstatic-URL:erna. Används av qa-lasresan-482-kontroll.mjs.
// ============================================================================
import { readFileSync } from "node:fs";
import admin from "firebase-admin";
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, runTransaction,
} from "firebase/firestore";
import { normalizeLasresa, withStartedText, applyCompletion, buildAttempt } from "../src/lasresan/progress.js";
import { withTeacherLevel, effectiveStartLevel, classStartLevelOf } from "../src/lasresan/level-control.js";
import { toStoredLasresa } from "../src/lasresan/level-scale.js";
import { pickText } from "../src/lasresan/picker.js";
import { coinsFor } from "../src/lasresan/rewards.js";
import { WORLDS } from "../src/lasresan/worlds/index.js";

const FS = process.env.FIRESTORE_EMULATOR_HOST;
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!FS || !AUTH) {
  console.error("Avbryter: sätt FIRESTORE_EMULATOR_HOST och FIREBASE_AUTH_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
export const PROJECT = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
export const PW = "lilla123";
const adminApp = admin.initializeApp({ projectId: PROJECT });
export const adb = admin.firestore(adminApp);
const aauth = admin.auth(adminApp);

// --- Banken (samma filer som loadBank hämtar) ------------------------------------
const BANK_DIR = new URL("../src/lasresan/content/bank/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", BANK_DIR), "utf8"));
export const BANK = Object.values(manifest.levels).flat().flatMap((f) => JSON.parse(readFileSync(new URL(f, BANK_DIR), "utf8")));
export const TEXT = new Map(BANK.map((t) => [t.id, t]));

// --- Hjälpare ---------------------------------------------------------------------
export async function som(uid, email = `${uid}@elev.pluggportalen.local`) {
  const app = initializeApp({ projectId: PROJECT, apiKey: "qa" }, `${uid}-${Math.random()}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH}`, { disableWarnings: true });
  const db = getFirestore(app);
  const [host, port] = FS.split(":");
  connectFirestoreEmulator(db, host, Number(port));
  const cred = await signInWithEmailAndPassword(auth, email, PW);
  return { db, uid: cred.user.uid };
}
export const larare = () => som("qalarare", "qalarare@larare.pluggportalen.local");


// Elevens klass = klassen vars studentIds innehåller eleven (getClassForStudent).
export async function startnivaFor(db, uid) {
  const snap = await getDocs(collection(db, "classes"));
  const cls = snap.docs.map((d) => d.data()).find((c) => Array.isArray(c.studentIds) && c.studentIds.includes(uid));
  return effectiveStartLevel(classStartLevelOf(cls));
}

// Läraren: setStudentLevel (data-lasresan-niva.js) – EN transaktion.
export async function sattNiva(db, uid, level) {
  const ref = doc(db, "studentData", uid);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const sd = snap.exists() ? snap.data() : null;
    const out = withTeacherLevel(normalizeLasresa(sd && sd.lasresa, WORLDS), level, Date.now());
    if (snap.exists()) tx.update(ref, { lasresa: toStoredLasresa(out.lasresa) });
    else tx.set(ref, { coins: 0, progress: {}, lasresa: toStoredLasresa(out.lasresa) });
    return out.applied;
  });
}

// Eleven: getLasresa (läser startnivån bara om lasresa saknas).
export async function lasresaFor(db, uid) {
  const sd = (await getDoc(doc(db, "studentData", uid))).data();
  const raw = sd && sd.lasresa;
  const startLevel = raw ? undefined : await startnivaFor(db, uid);
  return normalizeLasresa(raw, WORLDS, { startLevel });
}

// Eleven: nextTextFor + startText (page-lasresan.js / data-lasresan.js).
export async function nastaText(db, uid) {
  const lr = await lasresaFor(db, uid);
  if (lr.currentTextId && TEXT.has(lr.currentTextId)) return { text: TEXT.get(lr.currentTextId), resumed: true, lr };
  const picked = pickText(lr.level, lr.seenTextIds, BANK, { lastTextId: lr.lastTextId });
  const startLevel = await startnivaFor(db, uid);
  const ref = doc(db, "studentData", uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const sd = snap.exists() ? snap.data() : null;
    const cur = normalizeLasresa(sd && sd.lasresa, WORLDS, { startLevel });
    const out = withStartedText(cur, picked.id, Date.now(), { force: !!lr.currentTextId });
    if (!out.resumed) tx.update(ref, { lasresa: toStoredLasresa(out.lasresa) });
  });
  return { text: picked, resumed: false, lr };
}

// Svar med exakt `ratt` rätta (resten fel alternativ).
export function svar(text, ratt) {
  return text.questions.map((q, i) => ({ qid: q.id, chosen: i < ratt ? q.answerIndex : (q.answerIndex + 1) % q.options.length }));
}

// Eleven: completeText (data-lasresan.js) + award → addCoins.
export async function lasKlart(db, uid, text, ratt) {
  const ref = doc(db, "studentData", uid);
  const now = Date.now();
  const res = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const cur = normalizeLasresa(snap.data().lasresa, WORLDS);
    if (cur.currentTextId !== text.id) return { ok: false };
    const attempt = buildAttempt(text, svar(text, ratt), { startedAt: cur.currentStartedAt, completedAt: now, studentId: uid });
    const { lasresa } = applyCompletion(cur, attempt, WORLDS, now);
    tx.set(doc(collection(ref, "lasresaAttempts")), attempt);
    tx.update(ref, { lasresa: toStoredLasresa(lasresa) });
    return { ok: true, attempt, lasresa };
  });
  if (res.ok) {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      tx.update(ref, { coins: (snap.data().coins || 0) + coinsFor(res.attempt.correct) });
    });
  }
  return res;
}

// Dump (admin) – det som ska överleva ett nivåbyte.
export async function dump(uid) {
  const sd = (await adb.doc(`studentData/${uid}`).get()).data() || {};
  const at = await adb.collection(`studentData/${uid}/lasresaAttempts`).get();
  const lr = { ...(sd.lasresa || {}) };
  for (const k of ["level", "highStreak", "lowStreak", "pendingLevel", "levelSetAt", "levelSetBy", "updatedAt"]) delete lr[k];
  const rest = { ...sd };
  delete rest.lasresa;
  return {
    lasresa: lr, rest,
    attempts: at.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.id < b.id ? -1 : 1)),
  };
}
export const stabil = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x)
  ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
export const lika = (a, b) => stabil(a) === stabil(b);

export async function seedElev(uid, namn, klass, lasresa) {
  const email = `${uid}@elev.pluggportalen.local`;
  try { await aauth.getUser(uid); await aauth.updateUser(uid, { email, password: PW }); }
  catch (e) { if (e.code !== "auth/user-not-found") throw e; await aauth.createUser({ uid, email, password: PW }); }
  await adb.doc(`students/${uid}`).set({ namn, username: uid, avatarId: "fox", classIds: [klass] });
  const sd = { coins: 50, progress: {}, avatarId: "fox", ownedItems: ["hatt-1"] };
  if (lasresa) sd.lasresa = lasresa;
  await adb.doc(`studentData/${uid}`).set(sd);
  const old = await adb.collection(`studentData/${uid}/lasresaAttempts`).get();
  await Promise.all(old.docs.map((d) => d.ref.delete()));
}
export const igang = (level, over = {}) => ({
  level, highStreak: 0, lowStreak: 0, worldId: "skogen", stepInWorld: 3, completedWorlds: [],
  totalTexts: 3, totalQuestions: 21, totalCorrect: 15, totalIncorrect: 6, moneyEarned: 45,
  seenTextIds: [`lr-n${level}-x1`, `lr-n${level}-x2`, `lr-n${level}-x3`], catStats: { fakta: { q: 9, correct: 7 } },
  currentTextId: null, currentStartedAt: null, lastTextId: `lr-n${level}-x3`, updatedAt: 1, ...over,
});

