// ============================================================================
// Guldrushen slut-QA (#567) – RIGGEN som qa-guldrush-slut-kontroll.mjs och
// qa-guldrush-slut-pris.mjs delar: en firebase-klient per elev (inloggad,
// riktiga Cloud Functions-anrop + regler), sessioner i emulatorn, rapport.
// BARA emulatorn (FIRESTORE_/FIREBASE_AUTH_/FUNCTIONS_EMULATOR_HOST krävs).
// ============================================================================
import admin from "firebase-admin";
import { writeFileSync, mkdirSync } from "node:fs";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, connectAuthEmulator } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, addDoc, collection, serverTimestamp,
} from "firebase/firestore";

const FS = process.env.FIRESTORE_EMULATOR_HOST;
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const FN = process.env.FUNCTIONS_EMULATOR_HOST;
if (!FS || !AUTH || !FN) {
  console.error("Avbryter: sätt FIRESTORE_/FIREBASE_AUTH_/FUNCTIONS_EMULATOR_HOST (bara emulator).");
  process.exit(1);
}
const PROJECT = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const aapp = admin.initializeApp({ projectId: PROJECT });
const adb = aapp.firestore();
const { Timestamp, FieldValue } = admin.firestore;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync("/tmp/gr567", { recursive: true });
// --- En klient per elev ----------------------------------------------------------
const clients = new Map();
async function client(uid) {
  if (clients.has(uid)) return clients.get(uid);
  const app = initializeApp({ apiKey: "qa", projectId: PROJECT }, `elev-${uid}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH}`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, FS.split(":")[0], Number(FS.split(":")[1]));
  const fns = getFunctions(app, "europe-west1");
  connectFunctionsEmulator(fns, FN.split(":")[0], Number(FN.split(":")[1]));
  await signInWithEmailAndPassword(auth, `${uid}@elev.pluggportalen.local`, "lilla123");
  const call = (name) => (data) => httpsCallable(fns, name, { timeout: 30_000 })(data).then((r) => r.data);
  const c = { uid, db, answer: call("guldrushAnswer"), openChest: call("guldrushOpenChest"), chooseVictim: call("guldrushChooseVictim") };
  clients.set(uid, c);
  return c;
}
const code = (err) => String(err?.code || err?.message || err).replace(/^functions\//, "");
async function fel(p) {
  try {
    const v = await p;
    return { ok: true, v };
  } catch (err) {
    return { ok: false, code: code(err), msg: String(err?.message || "") };
  }
}

// --- Rapport ------------------------------------------------------------------
const rader = [];
function check(id, text, pass, detail = "") {
  rader.push({ id, text, pass: !!pass, detail });
  console.log(`${pass ? "✅" : "❌"} ${id} ${text}${detail ? ` – ${detail}` : ""}`);
}
function spara(namn) {
  writeFileSync(`/tmp/gr567/${namn}.json`, JSON.stringify(rader, null, 2));
  const bad = rader.filter((r) => !r.pass).length;
  console.log(`\n${rader.length - bad}/${rader.length} gröna → /tmp/gr567/${namn}.json`);
}

// --- Sessioner -------------------------------------------------------------------
async function klassElever(cid) {
  const c = (await adb.doc(`classes/${cid}`).get()).data();
  const out = [];
  for (const uid of c.studentIds) out.push({ uid, classId: cid, name: (await adb.doc(`students/${uid}`).get()).get("namn") || uid });
  return out;
}

/** Ny PÅGÅENDE match (startad för 6 s sedan, nedräkning 4 s). */
async function nySession(sid, { classIds = ["4b"], sek = 600, stealSwap = true, mode = "multiplication_0_10", kind = "free", rewards, extra = {} } = {}) {
  const ref = adb.doc(`liveSessions/${sid}`);
  await adb.recursiveDelete(ref);
  const now = Date.now();
  await ref.set({
    name: `QA #567 ${sid}`, format: "guldrush", gameMode: mode, answerKind: kind,
    participatingClassIds: classIds, classNames: { "4b": "4B", "5e": "5E" }, durationSeconds: sek, countdownSeconds: 4,
    status: "live", stealSwap, showNames: true, createdBy: "elias", createdByName: "Elias",
    createdAt: Timestamp.fromMillis(now - 60_000), startedAt: Timestamp.fromMillis(now - 6_000),
    endsAt: Timestamp.fromMillis(now - 6_000 + 4_000 + sek * 1000),
    rewards: rewards || { firstPrize: 100, perCorrect: 5, cap: 300 }, ...extra,
  });
  return ref;
}

/** Eleven går med som i appen (live-data joinLiveSession) – under reglerna. */
async function gaMed(sid, uid, classId) {
  const c = await client(uid);
  const name = (await adb.doc(`students/${uid}`).get()).get("namn") || "";
  await setDoc(doc(c.db, "liveSessions", sid, "players", uid), {
    uid, classId, name, joinedAt: serverTimestamp(), lastSeenAt: serverTimestamp(), correct: 0, incorrect: 0,
  });
  return c;
}

let nAtt = 0;
const nyttId = () => `qa567-${Date.now().toString(36)}-${(nAtt++).toString(36)}`;
/** Ett svar via Cloud Functionen (multiplikation). */
async function svara(c, sid, ratt = true) {
  const a = 2 + (nAtt % 8);
  const b = 3 + ((nAtt * 3) % 7);
  const attemptId = nyttId();
  const r = await c.answer({ sid, attemptId, factorA: a, factorB: b, answer: ratt ? a * b : a * b + 1 });
  return { attemptId, ...r };
}
const gp = async (sid, uid) => (await adb.doc(`liveSessions/${sid}/grPlayers/${uid}`).get()).data() || null;
/** Sätt elevens guld/skydd (uppsättning, som om matchen pågått en stund). */
const setGp = async (sid, uid, data) => {
  const ref = adb.doc(`liveSessions/${sid}/grPlayers/${uid}`);
  // Som serverns första svar (guldrush-core answerQuestion) – uid/namn/klass finns alltid.
  const base = (await ref.get()).exists ? {} : { uid, classId: (await adb.doc(`liveSessions/${sid}/players/${uid}`).get()).get("classId") || "4b",
    name: (await adb.doc(`students/${uid}`).get()).get("namn") || uid, gold: 0, chests: 0, shield: false, protectedUntil: null,
    lastVictimUid: null, pending: null, lastHit: null, correct: 0, incorrect: 0 };
  return ref.set({ ...base, ...data }, { merge: true });
};
/** "Kistan blev Stöld/Byte": väntande val, kopplat till ett riktigt rätt svar. */
async function tvingaVal(sid, uid, kind, attemptId) {
  const t = Date.now();
  await adb.doc(`liveSessions/${sid}/answers/${attemptId}`).update({ chest: kind === "swap" ? "byte" : "stold" });
  await setGp(sid, uid, { pending: { kind, chest: kind === "swap" ? "byte" : "stold", attemptId, at: Timestamp.fromMillis(t), expiresAt: Timestamp.fromMillis(t + 10_000) } });
}

async function saldon(uids) {
  const out = {};
  for (const u of uids) out[u] = Number((await adb.doc(`studentData/${u}`).get()).get("coins")) || 0;
  return out;
}

export { adb, Timestamp, FieldValue, sleep, client, code, fel, check, spara, klassElever, nySession, gaMed, nyttId, svara, gp, setGp, tvingaVal, saldon };
