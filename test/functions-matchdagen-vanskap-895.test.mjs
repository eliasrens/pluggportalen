// ============================================================================
// #895: vänskapsmatchernas EN callable, mdVanskap { op } (functions/md-vanskap-anrop.js), mot
// Functions- + Auth- + Firestore-EMULATORERNA, anropad som klienten (md-vanskap-moln.js).
//   utloggad → unauthenticated; lärare → permission-denied; okänd op (även "constructor") → invalid-argument
//   varm: inget skrivs; en kort match genom mdVanskap (utmana → svara → fraga/svar båda → läge 2 → tick → geUpp)
//   ger samma resultat som de sex gamla namnen (som finns kvar för deploy-glappet)
// Tiderna per anrop skrivs som diagnostik (inte som krav – emulatorn är inte drift).
// Körs via:  npm run test:functions
// ============================================================================

import assert from "node:assert/strict";
import { test, after } from "node:test";
import admin from "firebase-admin";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, connectAuthEmulator } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { createMvRig, KLASS, ANNA, BO, CIA } from "./helpers/md-vanskap-rig.js";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
process.env.FIRESTORE_EMULATOR_HOST = FS_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

const rig = createMvRig("mv895");
const adb = rig.db;
const app = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT_ID }, "mv-895-client");
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
const fns = getFunctions(app, "europe-west1");
connectFunctionsEmulator(fns, FN_HOST.split(":")[0], Number(FN_HOST.split(":")[1]));
const mdVanskap = httpsCallable(fns, "mdVanskap");
const tider = [];
const op = async (namn, d = {}) => {
  const t0 = performance.now();
  try {
    return (await mdVanskap({ op: namn, ...d })).data;
  } finally {
    tider.push(`${namn} ${Math.round(performance.now() - t0)} ms`);
  }
};

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
const OPS = ["utmana", "svara", "fraga", "svar", "tick", "geUpp", "varm"];

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
});

test("grinden: utloggad, lärare, okänd op", async () => {
  await signOut(auth).catch(() => {});
  for (const o of [...OPS, "finnsinte"]) assert.equal(await errCode(op(o, { classId: KLASS, matchId: "x" })), "unauthenticated", o);
  await as(LARARE);
  for (const o of OPS) assert.equal(await errCode(op(o, { classId: KLASS, matchId: "x" })), "permission-denied", o);
  await as(ANNA);
  for (const o of ["finnsinte", "constructor", "__proto__", "toString", "", "mdFraga"]) {
    assert.equal(await errCode(op(o, { matchId: "x" })), "invalid-argument", o);
  }
  assert.equal(await errCode(mdVanskap({ matchId: "x" })), "invalid-argument", "utan op");
  assert.equal(await errCode(mdVanskap(null)), "invalid-argument", "utan data");
  await as(CIA);
  assert.equal(await errCode(op("utmana", { classId: KLASS, till: ANNA })), "failed-precondition");
});

test("varm svarar utan att skriva något", async () => {
  await as(ANNA);
  const fore = [(await adb.collection("mdVanskap").get()).size, (await adb.doc(`mdLobby/${KLASS}`).get()).exists];
  assert.deepEqual(await op("varm"), { varm: true });
  assert.deepEqual([(await adb.collection("mdVanskap").get()).size, (await adb.doc(`mdLobby/${KLASS}`).get()).exists], fore);
  assert.equal((await adb.doc(`mdVanskapElev/${ANNA}`).get()).exists, false);
});

test("en kort match genom mdVanskap: utmana → svara → ett läge → tick → geUpp", async () => {
  await as(ANNA);
  const { utmaningId } = await op("utmana", { classId: KLASS, till: BO });
  await as(BO);
  const { matchId } = await op("svara", { utmaningId, ja: true, classId: KLASS });
  assert.match(matchId, /^[A-Za-z0-9_-]{20}$/);
  await as(ANNA);
  const fa = await op("fraga", { matchId, val: "kort" });
  assert.equal(fa.roll, "anf");
  assert.ok(!("facit" in fa.fraga));
  const bank = (await adb.doc(`mdVanskap/${matchId}/facit/${ANNA}`).get()).data().bank;
  const ra = await op("svar", { matchId, svar: bank[0].pub.alternativ.indexOf(bank[0].r.facit) });
  assert.deepEqual([ra.giltig, ra.ratt], [true, true]);
  assert.deepEqual(await op("fraga", { matchId, val: "kort" }), { ...fa, svar: { ratt: true, facit: bank[0].r.facit } }, "samma läge igen = samma fråga, med svaret");
  await as(BO);
  assert.equal((await op("fraga", { matchId, val: "tackla" })).roll, "forsv");
  const rb = await op("svar", { matchId, svar: null });
  assert.deepEqual([rb.ratt, rb.tidenUte], [false, true]);
  const m = (await adb.doc(`mdVanskap/${matchId}`).get()).data();
  assert.equal(m.fas.nr, 2);
  assert.deepEqual([m.h.ratt.a, m.h.ratt.b], [true, false]);
  assert.deepEqual(await op("tick", { matchId }), { status: "pagar", fas: 2 }, "tiden är inte ute – inget händer");
  assert.deepEqual(await op("geUpp", { matchId }), { status: "slut" });
  const slut = (await adb.doc(`mdVanskap/${matchId}`).get()).data();
  assert.deepEqual([slut.resultat.vinnare, slut.resultat.walkover], ["a", "b"]);
  assert.equal(await errCode(op("fraga", { matchId, val: "kort" })), "failed-precondition");
  console.log(`# mdVanskap i emulatorn: ${tider.join(", ")}`);
});

test("de sex gamla namnen finns kvar (webben som redan är ute)", async () => {
  await as(ANNA);
  for (const n of ["mdUtmana", "mdSvara", "mdFraga", "mdSvar", "mdTick", "mdGeUpp"]) {
    assert.equal(await errCode(httpsCallable(fns, n)({ classId: "../x", matchId: "../x", utmaningId: "../x" })), "invalid-argument", n);
  }
});
