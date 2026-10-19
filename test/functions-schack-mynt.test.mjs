// ============================================================================
// E2E: schackets pluggmynt (#798) mot Functions- + Auth- + Firestore-EMULATORERNA,
// anropade som klienten (src/schack/schack-moln.js mynt.*, httpsCallable europe-west1).
//
//   utloggad → unauthenticated; elev utan klass med schack / lärare → failed-precondition
//   fokusläge → failed-precondition; skräp → invalid-argument
//   vinst mot Bonden: 200 första gången, 0 andra gången (redan), coins + kvittot
//   dubbelanrop och två "flikar" samtidigt → EN utbetalning
//   Damen: 500 + pokalen (kvittot och studentData.schack.pokaler) i samma transaktion
//   fusk: fel seed, ett utbytt datordrag, olagligt drag, ingen matt, fel nivå → invalid-argument, inga mynt;
//   direkt efter ett nekat parti → resource-exhausted (30 s paus)
//   lektion: 5 en gång, fel lösning nekas; pussel: 5 en gång, fel lösning nekas,
//   redan belönat id ger 0
//   klienten kan inte skriva kvittot (reglerna) – inte ens efter en utbetalning
//
// Körs via:  npm run test:functions  (kräver `npm --prefix functions install`)
// ============================================================================

import assert from "node:assert/strict";
import { test, after } from "node:test";
import { readFileSync } from "node:fs";
import admin from "firebase-admin";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, connectAuthEmulator } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { getFirestore, connectFirestoreEmulator, doc, setDoc, updateDoc, deleteField } from "firebase/firestore";
import { Chess } from "../src/schack/vendor/chess.js";
import { valjDrag, analysera } from "../src/schack/schack-motor.js";
import { LEKTIONER } from "../src/schack/schack-lektioner.js";
import { minstaDrag } from "../src/schack/schack-stjarnjakt.js";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
process.env.FIRESTORE_EMULATOR_HOST = FS_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

const adminApp = admin.initializeApp({ projectId: PROJECT_ID }, "smy-fn-admin");
const adb = adminApp.firestore();

const app = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT_ID }, "smy-fn-client");
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
const cdb = getFirestore(app);
connectFirestoreEmulator(cdb, FS_HOST.split(":")[0], Number(FS_HOST.split(":")[1]));
const fns = getFunctions(app, "europe-west1");
connectFunctionsEmulator(fns, FN_HOST.split(":")[0], Number(FN_HOST.split(":")[1]));
const call = (name, d) => httpsCallable(fns, name, { timeout: 200_000 })(d).then((r) => r.data);

const PW = "schack798";
const KLASS = "smy-4a";
const ANNA = "smyanna";
const BO = "smybo"; // klass utan schack
const LARARE = "smyadmin";
const email = (u) => `${u}@elev.pluggportalen.local`;
const as = async (uid) => {
  await signOut(auth).catch(() => {});
  await signInWithEmailAndPassword(auth, email(uid), PW);
};
const errCode = async (p) => {
  try {
    await p;
  } catch (e) {
    return String(e?.code || "").replace(/^(functions|firestore)\//, "");
  }
  return "ok";
};
const coins = async (uid) => (await adb.doc(`studentData/${uid}`).get()).data()?.coins ?? 0;
const kvitto = async (uid) => (await adb.doc(`schackMynt/${uid}`).get()).data() || {};

/** Ett parti som i appen: datorn = valjDrag(nivå, seed + halvdrag · 7919), eleven = analysera. */
function spela(niva, seed) {
  const c = new Chess();
  const drag = [];
  while (!c.isGameOver() && drag.length < 300) {
    const fen = c.fen();
    const d = c.turn() === "w"
      ? analysera(fen, { djup: 3, historik: { drag: [...drag] }, tidsgransMs: 5000 }).drag
      : valjDrag(fen, { niva, seed: (seed + drag.length * 7919) >>> 0, historik: { drag: [...drag] } }).drag;
    drag.push(c.move(d).san);
  }
  assert.ok(c.isCheckmate() && c.turn() === "b", "testpartiet ska sluta med vits matt");
  return drag;
}
const BONDEN = { niva: "bonden", seed: 12345, drag: spela("bonden", 12345) };
const DAMEN = JSON.parse(readFileSync(new URL("./fixtures/schack-damen-vinst.json", import.meta.url), "utf8"));
const PUSSEL = JSON.parse(readFileSync(new URL("../src/schack/pussel/matt-i-tva.json", import.meta.url), "utf8")).pussel;

after(async () => {
  await signOut(auth).catch(() => {});
  await deleteApp(app).catch(() => {});
  await adminApp.delete().catch(() => {});
});

test("seed: Anna i en klass med schack, Bo i en klass utan, en lärare", async () => {
  const a = admin.auth(adminApp);
  for (const uid of [ANNA, BO, LARARE]) await a.createUser({ uid, email: email(uid), password: PW }).catch(() => {});
  await a.setCustomUserClaims(LARARE, { teacher: true, admin: true });
  await adb.doc(`classes/${KLASS}`).set({ name: "4A", studentIds: [ANNA], enabledModules: ["schack"] });
  await adb.doc("classes/smy-5a").set({ name: "5A", studentIds: [BO], enabledModules: [] });
  for (const uid of [ANNA, BO]) {
    await adb.doc(`studentData/${uid}`).set({ coins: 10 });
    await adb.doc(`schackMynt/${uid}`).delete();
  }
});

test("utloggad → unauthenticated; utan schack, lärare, fokusläge → failed-precondition; skräp → invalid-argument", async () => {
  await signOut(auth).catch(() => {});
  for (const n of ["schackDatorVinst", "schackLektionMynt", "schackPusselMynt"]) {
    assert.equal(await errCode(call(n, {})), "unauthenticated", n);
  }
  await as(BO);
  assert.equal(await errCode(call("schackDatorVinst", BONDEN)), "failed-precondition", "klassen har inte schack");
  await as(LARARE);
  assert.equal(await errCode(call("schackDatorVinst", BONDEN)), "failed-precondition", "läraren går inte i en klass");
  await as(ANNA);
  await adb.doc(`classes/${KLASS}`).update({ lock: { mal: { typ: "lasresan" }, till: Date.now() + 600_000 } });
  assert.equal(await errCode(call("schackDatorVinst", BONDEN)), "failed-precondition", "fokusläge");
  assert.equal(await errCode(call("schackPusselMynt", { sort: "tva", nr: 1, drag: [] })), "failed-precondition");
  await adb.doc(`classes/${KLASS}`).update({ lock: admin.firestore.FieldValue.delete() });
  assert.equal(await errCode(call("schackDatorVinst", { ...BONDEN, niva: "kungen" })), "invalid-argument");
  assert.equal(await errCode(call("schackDatorVinst", { ...BONDEN, niva: "__proto__" })), "invalid-argument");
  assert.equal(await errCode(call("schackLektionMynt", { nr: 13, losning: [] })), "invalid-argument");
  assert.equal(await errCode(call("schackPusselMynt", { sort: "tre", nr: 1, drag: [] })), "invalid-argument");
  assert.equal(await errCode(call("schackPusselMynt", { sort: "tva", nr: 9999, drag: [] })), "invalid-argument");
  assert.equal(await coins(ANNA), 10, "inga mynt");
});

test("fusk från konsolen: fel seed, ett utbytt datordrag, olagligt drag, ingen matt, fel nivå – inga mynt; paus efter nekat parti", async () => {
  await as(ANNA);
  const nolla = () => adb.doc(`schackMynt/${ANNA}`).set({ senastFel: admin.firestore.FieldValue.delete() }, { merge: true });
  const nekas = async (d, vad) => {
    await nolla();
    assert.equal(await errCode(call("schackDatorVinst", d)), "invalid-argument", vad);
  };
  await nekas({ ...BONDEN, seed: BONDEN.seed + 1 }, "fel seed");
  // Spärren: direkt efter ett nekat parti får nästa försök vänta (motorn är dyr).
  assert.equal(await errCode(call("schackDatorVinst", BONDEN)), "resource-exhausted", "paus efter nekat parti");
  const c = new Chess();
  c.move(BONDEN.drag[0]);
  const annat = c.moves().find((m) => m !== BONDEN.drag[1]);
  await nekas({ ...BONDEN, drag: [BONDEN.drag[0], annat, ...BONDEN.drag.slice(2)] }, "utbytt drag");
  await nekas({ ...BONDEN, drag: ["e4", "e5", "Ke3"] }, "olagligt");
  await nekas({ ...BONDEN, drag: BONDEN.drag.slice(0, -1) }, "ingen matt");
  await nekas({ ...BONDEN, niva: "tornet" }, "Bondens parti påstått mot Tornet");
  await nolla();
  assert.equal(await coins(ANNA), 10);
  const k = await kvitto(ANNA);
  assert.deepEqual(k.dator ?? {}, {}, "ingen nivå betald");
  assert.equal(k.total ?? 0, 0);
});

test("vinst mot Bonden: +200 första gången, 0 andra gången; dubbelanrop och två flikar = EN utbetalning", async () => {
  await as(ANNA);
  // Två "flikar" skickar samma vinst samtidigt.
  const [a, b] = await Promise.all([call("schackDatorVinst", BONDEN), call("schackDatorVinst", BONDEN)]);
  assert.deepEqual([a.mynt, b.mynt].sort((x, y) => x - y), [0, 200]);
  assert.equal(a.redan || b.redan, true);
  assert.equal(await coins(ANNA), 210);
  const andra = await call("schackDatorVinst", BONDEN);
  assert.deepEqual(andra, { mynt: 0, redan: true, nyckel: "bonden", pokal: false });
  // En helt ny vinst (nytt parti) mot Bonden ger heller inget.
  const ny = await call("schackDatorVinst", { niva: "bonden", seed: 99, drag: spela("bonden", 99) });
  assert.equal(ny.mynt, 0);
  assert.equal(await coins(ANNA), 210);
  const k = await kvitto(ANNA);
  assert.ok(Number.isInteger(k.dator.bonden));
  assert.equal(k.total, 200);
});

test("Damen: +500 och pokalen Damens besegrare i samma transaktion", async () => {
  await as(ANNA);
  const r = await call("schackDatorVinst", { niva: DAMEN.niva, seed: DAMEN.seed, drag: DAMEN.drag });
  assert.deepEqual(r, { mynt: 500, redan: false, nyckel: "damen", pokal: true });
  assert.equal(await coins(ANNA), 710);
  const k = await kvitto(ANNA);
  assert.ok(Number.isInteger(k.dator.damen) && k.pokaler.damen === k.dator.damen);
  const sd = (await adb.doc(`studentData/${ANNA}`).get()).data();
  assert.equal(sd.schack.pokaler.damen, k.pokaler.damen, "pokalen i studentData (huset ritar den)");
  assert.equal((await call("schackDatorVinst", DAMEN)).mynt, 0, "inte två gånger");
});

function lektionsLosning(nr) {
  const l = LEKTIONER.find((x) => x.nr === nr);
  if (l.typ === "fragor") return l.uppgifter.map((u) => u.svar[0]);
  return l.uppgifter.map((u) => minstaDrag(u).vag);
}

test("lektion: +5 en gång, fel lösning nekas; lektion 12 med ett riktigt parti", async () => {
  await as(ANNA);
  assert.equal(await errCode(call("schackLektionMynt", { nr: 2, losning: [["a5"], ["c7"]] })), "invalid-argument", "ofullständig jakt");
  assert.equal(await errCode(call("schackLektionMynt", { nr: 1, losning: ["e5", "a8", "c1", "a5", "d1", "e8", "b1"] })), "invalid-argument");
  assert.deepEqual(await call("schackLektionMynt", { nr: 2, losning: lektionsLosning(2) }), { mynt: 5, redan: false, nyckel: "2", pokal: false });
  assert.equal((await call("schackLektionMynt", { nr: 2, losning: lektionsLosning(2) })).mynt, 0);
  assert.equal((await call("schackLektionMynt", { nr: 1, losning: lektionsLosning(1) })).mynt, 5);
  assert.equal((await call("schackLektionMynt", { nr: 12, losning: { seed: BONDEN.seed, drag: BONDEN.drag } })).mynt, 5);
  assert.equal(await coins(ANNA), 725);
});

test("pussel: +5 en gång per pussel, fel lösning nekas, redan belönat id ger 0", async () => {
  await as(ANNA);
  const p = PUSSEL[0];
  assert.equal(await errCode(call("schackPusselMynt", { sort: "tva", nr: 1, drag: [p.losning[0]] })), "invalid-argument", "bara första draget");
  assert.equal(await errCode(call("schackPusselMynt", { sort: "tva", nr: 1, drag: [p.losning[2], p.losning[0]] })), "invalid-argument");
  assert.equal(await errCode(call("schackPusselMynt", { sort: "tva", nr: 2, drag: [p.losning[0], p.losning[2]] })), "invalid-argument", "pussel 1:s lösning på pussel 2");
  // id:t gäller före numret (en gammal bank i klientens cache)
  const r = await call("schackPusselMynt", { sort: "tva", nr: 7, id: p.id, drag: [p.losning[0], p.losning[2]] });
  assert.deepEqual(r, { mynt: 5, redan: false, nyckel: `tva-${p.id}`, pokal: false });
  assert.deepEqual(await call("schackPusselMynt", { sort: "tva", nr: 1, drag: [p.losning[0], p.losning[2]] }), { mynt: 0, redan: true, nyckel: `tva-${p.id}`, pokal: false });
  assert.equal(await coins(ANNA), 730);
});

test("klienten kan inte skriva kvittot eller pokalen – inte ens efter en utbetalning", async () => {
  await as(ANNA);
  assert.equal(await errCode(updateDoc(doc(cdb, "schackMynt", ANNA), { "dator.bonden": deleteField() })), "permission-denied");
  assert.equal(await errCode(setDoc(doc(cdb, "schackMynt", ANNA), {})), "permission-denied");
  assert.equal(await errCode(updateDoc(doc(cdb, "studentData", ANNA), { "schack.pokaler.tornet": 1 })), "permission-denied");
  assert.equal(await errCode(updateDoc(doc(cdb, "studentData", ANNA), { coins: 731 })), "ok", "elevens egna mynt (butiken) som förut");
});
