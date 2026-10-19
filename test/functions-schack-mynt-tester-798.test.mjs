// ============================================================================
// Tester #798 – kantfall för schackets pluggmynt mot Functions- + Auth- + Firestore-emulatorerna.
//   samtidiga anrop på olika nycklar = alla betalas; id/nr-dubbel = en utbetalning; skräpindata
//   (typer, längder, prototypnycklar) → invalid-argument utan skrivning; lektion 12 med oavslutat
//   parti nekas; vinst som svart mot Bonden godtas; en elev kan inte läsa en annans kvitto.
// Körs som test:functions (FUNCTIONS_EMULATOR_HOST krävs om emulatorn inte ligger på 5001).
// ============================================================================
import assert from "node:assert/strict";
import { test, after } from "node:test";
import admin from "firebase-admin";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, connectAuthEmulator } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { getFirestore, connectFirestoreEmulator, doc, getDoc } from "firebase/firestore";
import { Chess } from "../src/schack/vendor/chess.js";
import { valjDrag, analysera } from "../src/schack/schack-motor.js";

const PROJECT_ID = process.env.GCLOUD_PROJECT || "pluggportalen-so-2026";
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FN_HOST = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
process.env.FIRESTORE_EMULATOR_HOST = FS_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

const adminApp = admin.initializeApp({ projectId: PROJECT_ID }, "smt-admin");
const adb = adminApp.firestore();
const app = initializeApp({ apiKey: "fake-api-key", projectId: PROJECT_ID }, "smt-client");
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
const cdb = getFirestore(app);
connectFirestoreEmulator(cdb, FS_HOST.split(":")[0], Number(FS_HOST.split(":")[1]));
const fns = getFunctions(app, "europe-west1");
connectFunctionsEmulator(fns, FN_HOST.split(":")[0], Number(FN_HOST.split(":")[1]));
const call = (name, d) => httpsCallable(fns, name, { timeout: 200_000 })(d).then((r) => r.data);

const PW = "schack798t";
const ANNA = "smtanna";
const EVA = "smteva";
const email = (u) => `${u}@elev.pluggportalen.local`;
const as = async (uid) => { await signOut(auth).catch(() => {}); await signInWithEmailAndPassword(auth, email(uid), PW); };
const errCode = async (p) => {
  try { await p; } catch (e) { return String(e?.code || "").replace(/^(functions|firestore)\//, ""); }
  return "ok";
};
const coins = async (uid) => (await adb.doc(`studentData/${uid}`).get()).data()?.coins ?? 0;
const kvitto = async (uid) => (await adb.doc(`schackMynt/${uid}`).get()).data() || {};
const nolla = () => adb.doc(`schackMynt/${ANNA}`).set({ senastFel: admin.firestore.FieldValue.delete() }, { merge: true });

/** Ett parti där eleven (vit eller svart) vinner mot Bonden. */
function spela(studentFarg, seed) {
  const c = new Chess();
  const drag = [];
  while (!c.isGameOver() && drag.length < 300) {
    const fen = c.fen();
    const d = c.turn() === studentFarg
      ? analysera(fen, { djup: 3, historik: { drag: [...drag] }, tidsgransMs: 5000 }).drag
      : valjDrag(fen, { niva: "bonden", seed: (seed + drag.length * 7919) >>> 0, historik: { drag: [...drag] } }).drag;
    drag.push(c.move(d).san);
  }
  return { c, drag };
}

const PUSSEL_TVA = (await import("node:fs")).readFileSync(new URL("../src/schack/pussel/matt-i-tva.json", import.meta.url), "utf8");
const TVA = JSON.parse(PUSSEL_TVA).pussel;
const ETT = JSON.parse((await import("node:fs")).readFileSync(new URL("../src/schack/pussel/matt-i-ett.json", import.meta.url), "utf8")).pussel;

after(async () => {
  await signOut(auth).catch(() => {});
  await deleteApp(app).catch(() => {});
  await adminApp.delete().catch(() => {});
});

test("seed", async () => {
  const a = admin.auth(adminApp);
  for (const uid of [ANNA, EVA]) await a.createUser({ uid, email: email(uid), password: PW }).catch(() => {});
  await adb.doc("classes/smt-4a").set({ name: "4A", studentIds: [ANNA, EVA], enabledModules: ["schack"] });
  for (const uid of [ANNA, EVA]) { await adb.doc(`studentData/${uid}`).set({ coins: 0 }); await adb.doc(`schackMynt/${uid}`).delete(); }
});

test("skräpindata nekas utan skrivning", async () => {
  await as(ANNA);
  const bad = [
    ["schackDatorVinst", undefined], ["schackDatorVinst", null], ["schackDatorVinst", "bonden"], ["schackDatorVinst", { niva: "constructor" }],
    ["schackDatorVinst", { niva: "bonden", seed: -1, drag: ["e4"] }], ["schackDatorVinst", { niva: "bonden", seed: 1.5, drag: ["e4"] }],
    ["schackDatorVinst", { niva: "bonden", seed: "1", drag: ["e4"] }], ["schackDatorVinst", { niva: "bonden", seed: 2 ** 32, drag: ["e4"] }],
    ["schackDatorVinst", { niva: "bonden", seed: 1, drag: [] }], ["schackDatorVinst", { niva: "bonden", seed: 1, drag: "e4" }],
    ["schackDatorVinst", { niva: "bonden", seed: 1, drag: [1, 2] }], ["schackDatorVinst", { niva: "bonden", seed: 1, drag: Array(601).fill("Nf3") }],
    ["schackDatorVinst", { niva: "bonden", seed: 1, drag: ["<script>alert(1)</script>"] }],
    ["schackLektionMynt", { nr: "1", losning: [] }], ["schackLektionMynt", { nr: 1.5, losning: [] }], ["schackLektionMynt", { nr: 0, losning: [] }],
    ["schackLektionMynt", { nr: 1, losning: {} }], ["schackLektionMynt", { nr: 1, losning: null }], ["schackLektionMynt", { nr: -1 }],
    ["schackLektionMynt", { nr: 3, losning: [[], []] }], ["schackLektionMynt", { nr: 3, losning: [["z9"]] }],
    ["schackLektionMynt", { nr: 12, losning: [] }], ["schackLektionMynt", { nr: 12, losning: { seed: 1, drag: ["e4"] } }],
    ["schackPusselMynt", { sort: "__proto__", nr: 1, drag: [] }], ["schackPusselMynt", { sort: "ett", nr: 0, drag: [] }],
    ["schackPusselMynt", { sort: "ett", nr: 1.2, drag: [] }], ["schackPusselMynt", { sort: "ett", id: {}, drag: [] }],
    ["schackPusselMynt", { sort: "ett", nr: 1, drag: "e2e4" }], ["schackPusselMynt", { sort: "ett", nr: 1, drag: ["e2e4", "e2e4", "e2e4"] }],
    ["schackPusselMynt", { sort: "ett", nr: 1, drag: [5] }], ["schackPusselMynt", { sort: "ett", nr: 1, drag: ["E2E4"] }],
  ];
  for (const [n, d] of bad) {
    await nolla();
    const k = await errCode(call(n, d));
    assert.equal(k, "invalid-argument", `${n} ${JSON.stringify(d)?.slice(0, 80)} gav ${k}`);
  }
  assert.equal(await coins(ANNA), 0);
  const k = await kvitto(ANNA);
  assert.equal(k.total ?? 0, 0);
  for (const g of ["dator", "lektioner", "pussel", "pokaler"]) assert.deepEqual(k[g] ?? {}, {}, g);
});

test("lektion 12: oavslutat parti och för kort parti nekas; vinst som svart mot Bonden godtas inte i lektion 12 (vit krävs)", async () => {
  await as(ANNA);
  const c = new Chess();
  const kort = [];
  for (const m of ["e4", "e5", "Nf3"]) { c.move(m); kort.push(m); }
  assert.equal(await errCode(call("schackLektionMynt", { nr: 12, losning: { seed: 5, drag: kort } })), "invalid-argument");
  const svart = spela("b", 777);
  if (svart.c.isCheckmate()) {
    await nolla();
    assert.equal(await errCode(call("schackLektionMynt", { nr: 12, losning: { seed: 777, drag: svart.drag } })), "invalid-argument", "lektion 12 spelas som vit");
  }
  assert.equal(await coins(ANNA), 0);
});

test("vinst som svart mot Bonden ger 200", async () => {
  await as(ANNA);
  const p = spela("b", 4242);
  assert.ok(p.c.isCheckmate() && p.c.turn() === "w", "testpartiet: svart matt");
  await nolla();
  const r = await call("schackDatorVinst", { niva: "bonden", seed: 4242, drag: p.drag });
  assert.equal(r.mynt, 200);
  assert.equal(await coins(ANNA), 200);
});

test("Bondens parti som Springaren/Tornet/Damen nekas (motorn stämmer inte)", async () => {
  await as(ANNA);
  const p = spela("w", 31337);
  for (const niva of ["springaren", "tornet", "damen"]) {
    await nolla();
    const k = await errCode(call("schackDatorVinst", { niva, seed: 31337, drag: p.drag }));
    assert.ok(["invalid-argument"].includes(k), `${niva}: ${k}`);
  }
  assert.equal(await coins(ANNA), 200);
  assert.equal((await kvitto(ANNA)).dator.springaren, undefined);
});

test("samtidiga anrop på olika nycklar betalas alla; id och nr för samma pussel = en utbetalning", async () => {
  await as(EVA);
  const reqs = [
    ...[0, 1, 2].map((i) => call("schackPusselMynt", { sort: "tva", id: TVA[i].id, drag: [TVA[i].losning[0], TVA[i].losning[2]] })),
    ...[0, 1].map((i) => call("schackPusselMynt", { sort: "ett", nr: i + 1, drag: [ETT[i].losning[0]] })),
    // samma pussel (0) via nr och via id samtidigt som ovan
    call("schackPusselMynt", { sort: "tva", nr: 1, drag: [TVA[0].losning[0], TVA[0].losning[2]] }),
  ];
  const svar = await Promise.all(reqs.map((p) => p.catch((e) => ({ fel: e.code }))));
  const betalt = svar.reduce((s, r) => s + (r.mynt || 0), 0);
  assert.equal(betalt, 25, JSON.stringify(svar));
  assert.equal(await coins(EVA), 25);
  const k = await kvitto(EVA);
  assert.equal(k.total, 25);
  assert.equal(Object.keys(k.pussel).length, 5);
});

test("en elev kan inte läsa en annans kvitto; egna läses", async () => {
  await as(EVA);
  assert.equal(await errCode(getDoc(doc(cdb, "schackMynt", ANNA))), "permission-denied");
  assert.equal(await errCode(getDoc(doc(cdb, "schackMynt", EVA))), "ok");
});
