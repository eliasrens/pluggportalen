#!/usr/bin/env node
// ============================================================================
// Bråkresan – säkerhetsprober mot EMULATORN (#717 slut-QA, spec §13/§15).
// ----------------------------------------------------------------------------
// Som en riktig klient (Auth + reglerna + callables), efter att
// qa-brakresan-preview.sh seedat och någon elev spelat (qa-brakresan-spela.mjs):
//   eleven: kan inte skriva stjärnor/omgångar/belöningar/jakt, läser inte facit
//           eller andras Bråkresan-data, kan inte svara i andras omgångar
//   läraren: alla brakresa*-callables nekas (testläget skriver inget)
//   utloggad: nekas
//   node admin/qa-brakresan-attack.mjs [elev=elev1] [annan=qa-femtio]
// Samma miljövariabler som qa-brakresan-spela.mjs. Kod 1 vid något oväntat.
// ============================================================================
import admin from "firebase-admin";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, connectAuthEmulator } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, increment,
} from "firebase/firestore";

const PROJECT = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const FS = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8719";
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9719";
const FN = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5719";
process.env.FIRESTORE_EMULATOR_HOST = FS;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH;
const [ELEV = "elev1", ANNAN = "qa-femtio"] = process.argv.slice(2);

const adb = admin.initializeApp({ projectId: PROJECT }).firestore();
const app = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT });
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${AUTH}`, { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, FS.split(":")[0], Number(FS.split(":")[1]));
const fns = getFunctions(app, "europe-west1");
connectFunctionsEmulator(fns, FN.split(":")[0], Number(FN.split(":")[1]));
const call = (name, d) => httpsCallable(fns, name)(d).then((r) => r.data);
const code = async (p) => { try { await p; return "ok"; } catch (e) { return String(e?.code || e).replace(/^(functions|firestore)\//, ""); } };

let fel = 0;
const rad = async (vad, p, vantat) => {
  const c = await code(p);
  const ok = Array.isArray(vantat) ? vantat.includes(c) : c === vantat;
  if (!ok) fel++;
  console.log(`${ok ? "✓" : "❌"} ${vad}: ${c}${ok ? "" : ` (väntat ${vantat})`}`);
  return c;
};
const as = async (user, domain = "elev") => {
  await signOut(auth).catch(() => {});
  await signInWithEmailAndPassword(auth, `${user}@${domain}.pluggportalen.local`, "lilla123");
};
const NEKAD = "permission-denied";

// Underlag ur emulatorn (admin): en avslutad och en aktiv omgång för den andra eleven.
const annanRounds = await adb.collection(`studentData/${ANNAN}/brakresaRounds`).limit(1).get();
const annanRound = annanRounds.docs[0]?.id;
const egnaRounds = await adb.collection(`studentData/${ELEV}/brakresaRounds`).limit(1).get();
const egenRound = egnaRounds.docs[0]?.id;
const fore = (await adb.doc(`studentData/${ELEV}/brakresa/state`).get()).data();
const coinsFore = (await adb.doc(`studentData/${ELEV}`).get()).data()?.coins;

console.log(`— utloggad`);
await signOut(auth).catch(() => {});
await rad("brakresaStartRound", call("brakresaStartRound", { challengeId: "01" }), "unauthenticated");
await rad("läsa elevens state", getDoc(doc(db, `studentData/${ELEV}/brakresa/state`)), NEKAD);

console.log(`— eleven ${ELEV}`);
await as(ELEV);
const s = `studentData/${ELEV}`;
await rad("läsa eget state", getDoc(doc(db, `${s}/brakresa/state`)), "ok");
await rad("skriva eget state (150 stjärnor)", setDoc(doc(db, `${s}/brakresa/state`), { totalStars: 150 }, { merge: true }), NEKAD);
await rad("skapa belöning stjarna-01-1", setDoc(doc(db, `${s}/brakresaRewards/stjarna-01-9`), { amount: 40 }), NEKAD);
await rad("skapa jaktpost", setDoc(doc(db, `${s}/brakresaHunts/2026-10-16`), { amount: 200 }), NEKAD);
await rad("skapa omgång", setDoc(doc(db, `${s}/brakresaRounds/falsk`), { status: "avslutad", correctCount: 10 }), NEKAD);
if (egenRound) {
  await rad("ändra egen omgång (correctCount)", updateDoc(doc(db, `${s}/brakresaRounds/${egenRound}`), { correctCount: 10 }), NEKAD);
  await rad("ta bort egen omgång", deleteDoc(doc(db, `${s}/brakresaRounds/${egenRound}`)), NEKAD);
  await rad("läsa facit (brakresaSecrets) för egen omgång", getDoc(doc(db, `brakresaSecrets/${egenRound}`)), NEKAD);
}
await rad("lista brakresaSecrets", getDocs(collection(db, "brakresaSecrets")), NEKAD);
await rad(`läsa ${ANNAN}s state`, getDoc(doc(db, `studentData/${ANNAN}/brakresa/state`)), NEKAD);
await rad(`lista ${ANNAN}s omgångar`, getDocs(collection(db, `studentData/${ANNAN}/brakresaRounds`)), NEKAD);
await rad(`lista ${ANNAN}s belöningar`, getDocs(collection(db, `studentData/${ANNAN}/brakresaRewards`)), NEKAD);
if (annanRound) {
  await rad(`svara i ${ANNAN}s omgång`, call("brakresaAnswer", { roundId: annanRound, index: 0, answer: { type: "number", value: 1 }, helpBefore: [] }), ["not-found", NEKAD, "invalid-argument"]);
  await rad(`avsluta ${ANNAN}s omgång`, call("brakresaFinishRound", { roundId: annanRound }), ["not-found", NEKAD]);
}
await rad("klientfält ignoreras i jakten (amount: 9999)", call("brakresaHunt", { amount: 9999, level: 15, date: "2020-01-01" }).then((r) => {
  if (r.amount > 200) throw Object.assign(new Error("för stort fynd"), { code: "FEL" });
}), ["ok", "failed-precondition"]);
await rad("byta drakens namn till HTML", call("brakresaRenameDragon", { name: "<img src=x onerror=alert(1)>" }).then((r) => {
  if (/[<>"']/.test(r.name)) throw Object.assign(new Error(r.name), { code: "FEL-OSANERAT" });
}), ["ok", "failed-precondition"]);
// Kända, dokumenterade öppningar (BRAKRESAN.md §8 punkt 2–3) – rapporteras, fäller inte körningen.
const mirror = await code(updateDoc(doc(db, s), { brakdrake: { id: "drake-falsk", level: 15, name: "Fejk" } }));
console.log(`ℹ studentData.brakdrake (husets spegel) skrivbart av eleven: ${mirror}`);
const mynt = await code(updateDoc(doc(db, s), { coins: increment(1) }));
console.log(`ℹ studentData.coins skrivbart av eleven (appbrett sedan tidigare): ${mynt}`);

console.log(`— lärare (admin) qalarare`);
await as("qalarare", "larare");
await rad(`läsa ${ELEV}s state`, getDoc(doc(db, `${s}/brakresa/state`)), "ok");
await rad(`skriva ${ELEV}s state`, setDoc(doc(db, `${s}/brakresa/state`), { totalStars: 0 }, { merge: true }), NEKAD);
await rad("läsa facit", getDocs(collection(db, "brakresaSecrets")), NEKAD);
for (const fn of ["brakresaStartRound", "brakresaFinishRound", "brakresaHunt", "brakresaRenameDragon", "brakresaAckDragon"]) {
  await rad(`${fn} som lärare`, call(fn, { challengeId: "01", roundId: egenRound || "x", name: "x", level: 1 }), NEKAD);
}

const efter = (await adb.doc(`studentData/${ELEV}/brakresa/state`).get()).data();
const coinsEfter = (await adb.doc(`studentData/${ELEV}`).get()).data()?.coins;
console.log(`state.totalStars före/efter: ${fore?.totalStars}/${efter?.totalStars} · mynt före/efter: ${coinsFore}/${coinsEfter} (+1 = egen increment ovan, + ev. jaktfynd)`);
await signOut(auth).catch(() => {});
console.log(fel ? `❌ ${fel} oväntade utfall` : "✓ alla prober som väntat");
process.exit(fel ? 1 : 0);
