// ============================================================================
// E2E (#874): vänskapsmatchernas callables mot Functions- + Auth- + Firestore-EMULATORERNA,
// anropade som klienten (src/matchdagen/vanskap/md-vanskap-moln.js, httpsCallable europe-west1).
// Kärnans gränsfall (tid, halvtid, walkover, kassa, dagstak) testas med styrd klocka i
// functions-matchdagen-vanskap.test.mjs – här: inloggning, roller, reglerna för den som läser
// och att en hel kort match (utmaning → anta → läge → lämna) går genom servern.
//
//   utloggad → unauthenticated; lärare → permission-denied; elev utan Matchdagen → failed-precondition
//   lobbyn läses av klasskompisarna med Matchdagen, inte av Cia; klienten skriver aldrig
//   matchen läses av spelarna; frågan (privat) bara av eleven själv; facit av ingen elev
//   mdFraga/mdSvar: frågan utan facit, servern rättar; mdGeUpp → walkover, kassa + inbördes + matcher
//   efter matchen: klientens S.K (vakten räknar in slutet) sparas som hela dokumentet med nytt lagnamn
//
// Körs via:  npm run test:functions  (kräver `npm --prefix functions install`)
// ============================================================================

import assert from "node:assert/strict";
import { test, after } from "node:test";
import admin from "firebase-admin";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, connectAuthEmulator } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { createMvRig, KLASS, ANNA, BO, CIA } from "./helpers/md-vanskap-rig.js";
import { bevaka } from "../src/matchdagen/vanskap/md-vy-vanskap.js";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
process.env.FIRESTORE_EMULATOR_HOST = FS_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

const rig = createMvRig("mvanrop");
const adb = rig.db;
const app = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT_ID }, "mv-fn-client");
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
const cdb = getFirestore(app);
connectFirestoreEmulator(cdb, FS_HOST.split(":")[0], Number(FS_HOST.split(":")[1]));
const fns = getFunctions(app, "europe-west1");
connectFunctionsEmulator(fns, FN_HOST.split(":")[0], Number(FN_HOST.split(":")[1]));
const call = (name, d) => httpsCallable(fns, name)(d).then((r) => r.data);

const PW = "matchdagen874";
const LARARE = "mv-larare";
const email = (u) => `${u}@elev.pluggportalen.local`;
const as = async (uid) => {
  await signOut(auth).catch(() => {});
  await signInWithEmailAndPassword(auth, email(uid), PW);
};
const errCode = async (p) => {
  try { await p; } catch (e) { return String(e?.code || "").replace(/^(functions|firestore)\//, ""); }
  return "ok";
};
const CALLS = ["mdUtmana", "mdSvara", "mdFraga", "mdSvar", "mdTick", "mdGeUpp"];

after(async () => {
  await signOut(auth).catch(() => {});
  await deleteApp(app).catch(() => {});
  await rig.app.delete().catch(() => {});
});

test("seed: Anna och Bo med Matchdagen i mv-4a, Cia utan, en lärare", async () => {
  const a = admin.auth(rig.app);
  for (const uid of [ANNA, BO, CIA, LARARE]) await a.createUser({ uid, email: email(uid), password: PW }).catch(() => {});
  await a.setCustomUserClaims(LARARE, { teacher: true, admin: true });
  await rig.rensa();
  await rig.seed();
  for (const uid of [ANNA, BO, CIA]) await adb.doc(`students/${uid}`).set({ namn: uid, classIds: [KLASS] });
});

test("utloggad → unauthenticated, lärare → permission-denied, elev utan Matchdagen → failed-precondition", async () => {
  await signOut(auth).catch(() => {});
  for (const n of CALLS) assert.equal(await errCode(call(n, { classId: KLASS, matchId: "x" })), "unauthenticated", n);
  await as(LARARE);
  for (const n of CALLS) assert.equal(await errCode(call(n, { classId: KLASS, matchId: "x" })), "permission-denied", n);
  await as(CIA);
  assert.equal(await errCode(call("mdUtmana", { classId: KLASS, till: ANNA })), "failed-precondition");
  await as(ANNA);
  assert.equal(await errCode(call("mdUtmana", { classId: KLASS, till: CIA })), "failed-precondition", "Cia har inte Matchdagen");
  assert.equal(await errCode(call("mdUtmana", { classId: "../x", till: BO })), "invalid-argument");
  assert.equal(await errCode(call("mdFraga", { matchId: "finnsinte", val: "kort" })), "not-found");
});

let matchId;
// Klientens läge före slutet: S.K som appen läste den (före matchen) och matchen medan den pågick.
const fore = {};

test("utmaningen: lobbyn läses av Bo, inte av Cia; klienten kan inte skriva den; Bo antar → matchen", async () => {
  await as(ANNA);
  const { utmaningId } = await call("mdUtmana", { classId: KLASS, till: BO });
  assert.equal(await errCode(setDoc(doc(cdb, "mdLobby", KLASS), { utmaningar: {} })), "permission-denied");
  await as(CIA);
  assert.equal(await errCode(getDoc(doc(cdb, "mdLobby", KLASS))), "permission-denied");
  await as(BO);
  const lob = (await getDoc(doc(cdb, "mdLobby", KLASS))).data();
  assert.deepEqual([lob.utmaningar[utmaningId].fran, lob.utmaningar[utmaningId].till, lob.utmaningar[utmaningId].franLag], [ANNA, BO, "Blixtarna IF"]);
  ({ matchId } = await call("mdSvara", { utmaningId, ja: true, classId: KLASS }));
  assert.match(matchId, /^[A-Za-z0-9_-]{20}$/);
  const m = (await getDoc(doc(cdb, "mdVanskap", matchId))).data();
  assert.deepEqual([m.a, m.b, m.status, m.fas.nr], [ANNA, BO, "pagar", 1]);
  assert.equal(await errCode(updateDoc(doc(cdb, "mdVanskap", matchId), { status: "slut" })), "permission-denied");
  await as(CIA);
  assert.equal(await errCode(getDoc(doc(cdb, "mdVanskap", matchId))), "permission-denied");
});

test("ett läge: frågan utan facit i det privata dokumentet (bara eleven själv), servern rättar, läget avgörs", async () => {
  await as(ANNA);
  const fa = await call("mdFraga", { matchId, val: "kort" });
  assert.equal(fa.roll, "anf");
  assert.equal(fa.fraga.typ, "flerval");
  assert.ok(!("facit" in fa.fraga) && !("ratt" in fa.fraga));
  assert.equal((await getDoc(doc(cdb, "mdVanskap", matchId, "privat", ANNA))).data().fraga.text, fa.fraga.text);
  assert.equal(await errCode(getDoc(doc(cdb, "mdVanskap", matchId, "facit", ANNA))), "permission-denied");
  assert.equal(await errCode(setDoc(doc(cdb, "mdVanskap", matchId, "privat", ANNA), { svar: { ratt: true } })), "permission-denied");
  const bank = (await adb.doc(`mdVanskap/${matchId}/facit/${ANNA}`).get()).data().bank;
  const ra = await call("mdSvar", { matchId, svar: bank[0].pub.alternativ.indexOf(bank[0].r.facit) });
  assert.deepEqual([ra.giltig, ra.ratt], [true, true]);
  await as(BO);
  assert.equal(await errCode(getDoc(doc(cdb, "mdVanskap", matchId, "privat", ANNA))), "permission-denied", "inte motståndarens fråga");
  const fb = await call("mdFraga", { matchId, val: "tackla" });
  assert.equal(fb.roll, "forsv");
  const rb = await call("mdSvar", { matchId, svar: null }); // Bos klocka tog slut
  assert.deepEqual([rb.ratt, rb.tidenUte], [false, true]);
  const m = (await getDoc(doc(cdb, "mdVanskap", matchId))).data();
  assert.equal(m.fas.nr, 2);
  assert.deepEqual([m.h.ratt.a, m.h.ratt.b], [true, false]);
});

test("Bo lämnar (mdGeUpp): walkover – Anna vinner, kassan och de inbördes mötena skrivna av servern, matchen typ vanskap", async () => {
  for (const uid of [ANNA, BO]) {
    await as(uid);
    fore[uid] = { K: (await getDoc(doc(cdb, "matchdagen", uid))).data(), m: (await getDoc(doc(cdb, "mdVanskap", matchId))).data() };
  }
  await as(BO);
  assert.deepEqual(await call("mdGeUpp", { matchId }), { status: "slut" });
  const m = (await getDoc(doc(cdb, "mdVanskap", matchId))).data();
  assert.deepEqual([m.resultat.vinnare, m.resultat.walkover, m.resultat.kassa.a, m.resultat.kassa.b], ["a", "b", 200, 0]);
  const [ka, kb] = [await rig.karriar(ANNA), await rig.karriar(BO)];
  assert.deepEqual([ka.kassa, kb.kassa], [800, 600]);
  assert.deepEqual(ka.inbordes[BO], { v: 1, namn: "FC Omar" });
  assert.deepEqual(kb.inbordes[ANNA], { f: 1, namn: "Blixtarna IF" });
  assert.equal((await rig.matchDok(ANNA, matchId)).typ, "vanskap");
  assert.equal((await rig.lobby()).matcher[matchId], undefined);
  assert.equal(await errCode(call("mdFraga", { matchId, val: "kort" })), "failed-precondition");
  // Eleven kan inte skriva de inbördes mötena själv (reglerna) – bara servern.
  await as(ANNA);
  assert.equal(await errCode(updateDoc(doc(cdb, "matchdagen", ANNA), { [`inbordes.${BO}.v`]: 9 })), "permission-denied");
});

test("efter matchen: S.K som vakten räknade in den sparas som hela dokumentet med nytt lagnamn (sparaKarriar)", async () => {
  for (const [uid, namn] of [[ANNA, "Nya Blixtarna"], [BO, "FC Omar 2"]]) {
    await as(uid);
    const slut = (await getDoc(doc(cdb, "mdVanskap", matchId))).data();
    let cb = null;
    const S = { uid, K: fore[uid].K };
    bevaka(S, { lyssnaMatch: (_id, f) => { cb = f; return () => {}; } }, matchId);
    cb(fore[uid].m); // pågick när vakten startade …
    cb(slut); // … slut: kassan och mötet räknas in lokalt, utan att läsa om karriären
    const server = (await getDoc(doc(cdb, "matchdagen", uid))).data();
    assert.deepEqual([S.K.kassa, S.K.inbordes], [server.kassa, server.inbordes], `${uid}: som servern skrev dem`);
    // sparaKarriar (md-data.js): hela dokumentet, inbördes oförändrade, nytt namn i klubben.
    const { senast, ...K } = { ...S.K, klubb: { ...S.K.klubb, namn } };
    assert.equal(await errCode(setDoc(doc(cdb, "matchdagen", uid), { ...K, senast: serverTimestamp() })), "ok", uid);
    const efter = (await getDoc(doc(cdb, "matchdagen", uid))).data();
    assert.deepEqual([efter.klubb.namn, efter.inbordes], [namn, server.inbordes]);
  }
});
