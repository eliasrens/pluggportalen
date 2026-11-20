// ============================================================================
// Regel-tester (Tester #870): försök att bryta kvalet (matchdagen/{uid}.kval) och
// straffarna (matcher/{id}.straffar) utöver test/firestore-rules-matchdagen-kval.test.js
// – färgens ankring, tomma/halva mappar, en ny klubb (create) med trasigt kval,
// klasskamraten, ett ospelat kval i Superligan och matchdokumentets straffar = null.
// Körs av `npm run test:rules` (emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { matchKlar, nastaMatch, nyKarriar } from "../src/matchdagen/delat/md-sasong.js";
import { kvalKlar } from "../src/matchdagen/delat/md-kval.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

let env;
const NU = Date.UTC(2026, 10, 20, 9);
const STAT = { skott: 5, skottPaMal: 3, pass: 12, passOk: 9, tacklingar: 6, vunnaBollar: 4, raddningar: 2, horner: 1, derasSkott: 3,
  fragor: 28, ratt: 20, perKalla: { "tabell:7": { fragor: 28, ratt: 20 } }, sekunder: 420 };
const res = (oss, dem, extra = {}) => ({ oss, dem, utfall: oss > dem ? "vinst" : oss < dem ? "forlust" : "oavgjort", mal: [], stat: STAT, ...extra });
const kopia = (x) => JSON.parse(JSON.stringify(x));

const r = skapaPrng("tester-870").tal;
let K = nyKarriar({ namn: "Blixtarna IF", farg: "#e8473f", rng: r });
const START = kopia(K);
for (let i = 0; nastaMatch(K); i++) K = matchKlar(K, { res: res(4, 0), rng: r, nu: NU, matchId: `m${i}` }).K;
const VANTAR = kopia(K);
const KVAL = kvalKlar(VANTAR, { res: res(2, 2, { straffar: [30, 29], vann: true }), nu: NU, matchId: "s1-d0-kval-t" });

const ref = (db, uid = "e4a") => doc(db, "matchdagen", uid);
const mref = (db, id = "s1-d0-kval-t", uid = "e4a") => doc(db, "matchdagen", uid, "matcher", id);
const medTid = (K0, over = {}) => ({ ...kopia(K0), senast: serverTimestamp(), ...over });
const kvalMed = (over) => ({ ...VANTAR.kval, ...over });
const motMed = (over) => kvalMed({ mot: { ...VANTAR.kval.mot, ...over } });

before(async () => {
  env = await createRollerEnv("pluggportalen-rules-test-matchdagen-tester-870");
});
after(async () => {
  if (env) await env.testEnv.cleanup();
});
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    await setDoc(doc(db, "classes", "4a"), { studentIds: ["e4a", "kompis"], elevModuler: { e4a: ["matchdagen"], kompis: ["matchdagen"] } }, { merge: true });
    await setDoc(doc(db, "students", "kompis"), { namn: "kompis", username: "kompis", classIds: ["4a"] });
    await setDoc(ref(db), { ...START, senast: new Date() });
  });
});

describe("kvalet (Tester #870)", () => {
  it("färgen är exakt #rrggbb – inget före eller efter", async () => {
    const db = env.as("e4a", {});
    for (const farg of ["#123456;x", "#1234567", "x#123456", "#12345", "#12345g", " #123456"]) {
      await assertFails(setDoc(ref(db), medTid(VANTAR, { kval: motMed({ farg }) })), farg);
    }
    await assertSucceeds(setDoc(ref(db), medTid(VANTAR, { kval: motMed({ farg: "#A1b2C3" }) })));
  });
  it("tom map, halva motståndare, mot = null och sasong som decimaltal nekas", async () => {
    const db = env.as("e4a", {});
    await assertFails(setDoc(ref(db), medTid(VANTAR, { kval: {} })), "{}");
    await assertFails(setDoc(ref(db), medTid(VANTAR, { kval: kvalMed({ mot: null }) })), "mot null");
    await assertFails(setDoc(ref(db), medTid(VANTAR, { kval: kvalMed({ mot: { namn: "X" } }) })), "mot utan färg/styrka");
    await assertFails(setDoc(ref(db), medTid(VANTAR, { kval: kvalMed({ sasong: 1.5 }) })), "sasong 1.5");
    await assertFails(setDoc(ref(db), medTid(VANTAR, { kval: kvalMed({ straffar: null }) })), "straffar null");
    await assertFails(setDoc(ref(db), medTid(VANTAR, { kval: kvalMed({ straffar: { 0: 4, 1: 3 } }) })), "straffar som map");
    await assertFails(setDoc(ref(db), medTid(VANTAR, { kval: kvalMed({ mot: { ...VANTAR.kval.mot, styrka: -0.1 } }) })), "styrka < 0");
  });
  it("en ny klubb (create) prövar kvalet också", async () => {
    await env.seed(async (sdb) => { const { deleteDoc } = await import("firebase/firestore"); await deleteDoc(ref(sdb)); });
    const db = env.as("e4a", {});
    await assertFails(setDoc(ref(db), medTid(START, { kval: kvalMed({ div: "<img src=x onerror=alert(1)>" }) })), "HTML i div vid create");
    await assertFails(setDoc(ref(db), medTid(START, { kval: "<b>kval</b>" })), "text vid create");
    await assertSucceeds(setDoc(ref(db), medTid(START, { kval: null })), "kval: null vid create (nyKarriar)");
  });
  it("Superligan (div 7) kan inte ha ett kval att spela; Elitligan (div 6) kan", async () => {
    const db = env.as("e4a", {});
    await assertFails(setDoc(ref(db), medTid(VANTAR, { div: 7, kval: kvalMed({ div: 7 }) })));
    await assertSucceeds(setDoc(ref(db), medTid(VANTAR, { div: 6, kval: kvalMed({ div: 6 }) })));
  });
  it("det längsta straffresultatet (sudden death till taket) går att spara", async () => {
    const db = env.as("e4a", {});
    await assertSucceeds(setDoc(ref(db), medTid(KVAL.K)));
    await assertSucceeds(setDoc(mref(db), { ...KVAL.match, datum: serverTimestamp() }));
  });
  it("klasskamraten (med egen Matchdagen) kan varken läsa eller skriva kvalet", async () => {
    await env.seed((sdb) => setDoc(ref(sdb), { ...VANTAR, senast: new Date() }));
    const kompis = env.as("kompis", {});
    await assertFails(updateDoc(ref(kompis), { kval: null, senast: serverTimestamp() }));
    await assertFails(updateDoc(ref(kompis), { "kval.spelad": true, senast: serverTimestamp() }));
    await assertFails(setDoc(mref(kompis), { ...KVAL.match, datum: serverTimestamp() }));
    const { getDoc } = await import("firebase/firestore");
    await assertFails(getDoc(ref(kompis)));
  });
  it("matchdokumentet: straffar = null eller tre tal nekas, typ kval utan omg går", async () => {
    const db = env.as("e4a", {});
    assertOk(KVAL.match.typ === "kval" && !("omg" in KVAL.match));
    await assertFails(setDoc(mref(db, "a"), { ...KVAL.match, straffar: null, datum: serverTimestamp() }));
    await assertFails(setDoc(mref(db, "b"), { ...KVAL.match, straffar: [1, 2, 3], datum: serverTimestamp() }));
    await assertSucceeds(setDoc(mref(db, "c"), { ...KVAL.match, datum: serverTimestamp() }));
  });
});

function assertOk(v) {
  if (!v) throw new Error("fel uppställning av testdata");
}
