// ============================================================================
// Regel-tester: Matchdagen för hela klassen (#876) – classes/{id}.enabledModules med
// "matchdagen", klassens inställningar classes/{id}.matchdagenInst och vänskapslobbyn.
// ----------------------------------------------------------------------------
//   • läraren med klassen (och admin) slår på Matchdagen för klassen och sparar
//     klassens inställningar i EN skrivning; formen = matchdagenInst/{uid}
//   • eleven skriver aldrig klassens inställningar; årskurskontot utan klassen nekas
//   • en oförändrad (även gammal/trasig) map stoppar inte andra klass-skrivningar
//   • mdLobby/{classId}: med Matchdagen på för klassen läser alla klassens elever
// Rollerna ur test/helpers/roller-env.js (admin1, ak4 = årskurskonto 4a/4b, ak5 = 5a).
// Körs av `npm run test:rules` (emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteField, doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";

let env;
const MD = "matchdagen";
const INST = { omraden: ["so/vikingatiden"], tabeller: [3, 7], rakna: [], svarssatt: "flerval", klocka: 0, lugnt: false, paus: 60 };
const inst = (uid, over = {}) => ({ ...INST, updatedAt: serverTimestamp(), updatedBy: uid, ...over });
const klass = (db) => doc(db, "classes", "4a");
const elev = (uid = "e4a") => env.as(uid, {});

before(async () => {
  env = await createRollerEnv("pluggportalen-rules-test-matchdagen-876");
});
after(async () => {
  if (env) await env.testEnv.cleanup();
});
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    await setDoc(doc(db, "classes", "4a"), { studentIds: ["e4a", "kompis"] }, { merge: true });
    await setDoc(doc(db, "students", "kompis"), { namn: "kompis", username: "kompis", classIds: ["4a"] });
    await setDoc(doc(db, "mdLobby", "4a"), { utmaningar: {}, matcher: {} });
  });
});

describe("Matchdagen för klassen + klassens inställningar (#876)", () => {
  it("årskurskontot med klassen slår på och sparar inställningarna i en skrivning", async () => {
    await assertSucceeds(updateDoc(klass(env.ak4()), { enabledModules: [MD], matchdagenInst: inst("ak4") }));
    const snap = await assertSucceeds(getDoc(klass(elev("kompis"))));
    assert.deepEqual(snap.data().matchdagenInst.tabeller, [3, 7], "klassens elever läser dem (klassdokumentet)");
    await assertSucceeds(updateDoc(klass(env.ak4()), { enabledModules: [], matchdagenInst: inst("ak4", { tabeller: [] }) }));
    await assertSucceeds(updateDoc(klass(env.admin()), { matchdagenInst: inst("admin1", { svarssatt: "skriv", klocka: 60 }) }));
  });
  it("eleven, årskurskontot utan klassen och ett avstängt konto nekas", async () => {
    await assertFails(updateDoc(klass(elev()), { matchdagenInst: inst("e4a") }));
    await assertFails(updateDoc(klass(elev()), { enabledModules: [MD] }));
    await assertFails(updateDoc(klass(env.ak5()), { matchdagenInst: inst("ak5") }));
    await assertFails(updateDoc(klass(env.ak4av()), { matchdagenInst: inst("ak4av") }));
  });
  it("formen valideras som matchdagenInst/{uid}", async () => {
    const skriv = (v) => updateDoc(klass(env.ak4()), { matchdagenInst: v });
    await assertFails(skriv(inst("ak4", { klocka: 45 })));
    await assertFails(skriv(inst("ak4", { tabeller: [11] })));
    await assertFails(skriv(inst("ak4", { omraden: ["matte"] })));
    await assertFails(skriv(inst("ak4", { hemligt: 1 })));
    await assertFails(skriv(inst("ak4", { updatedBy: "admin1" })), "någon annans uid");
    await assertFails(skriv({ ...INST, updatedAt: new Date(0), updatedBy: "ak4" }), "inte serverns tid");
    const { paus, ...utanPaus } = inst("ak4");
    assert.equal(paus, 60);
    await assertFails(skriv(utanPaus));
    await assertFails(skriv([3, 7]), "inte en map");
    await assertFails(skriv("tabell 3"));
    await assertSucceeds(skriv(inst("ak4", { omraden: Array.from({ length: 60 }, (_, i) => `so/a${i}`), tabeller: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] })));
  });
  it("en oförändrad map stoppar inte andra klass-skrivningar; fältet kan tas bort", async () => {
    // Gammal/trasig map (t.ex. skriven av admin-skript) ligger kvar – andra fält går ändå att spara.
    await env.seed((db) => setDoc(doc(db, "classes", "4a"), { matchdagenInst: { gammal: true } }, { merge: true }));
    await assertSucceeds(updateDoc(klass(env.ak4()), { hiddenModules: ["shop"] }));
    await assertFails(updateDoc(klass(env.ak4()), { matchdagenInst: { gammal: false } }));
    await assertSucceeds(updateDoc(klass(env.ak4()), { matchdagenInst: deleteField() }));
  });
});

describe("vänskapslobbyn med Matchdagen för klassen (#876)", () => {
  it("klassen av: elever utan elevModuler läser inte lobbyn", async () => {
    await assertFails(getDoc(doc(elev(), "mdLobby", "4a")));
    await assertFails(getDoc(doc(elev("kompis"), "mdLobby", "4a")));
  });
  it("klassen på: alla klassens elever läser lobbyn, andra klasser inte", async () => {
    await env.seed((db) => setDoc(doc(db, "classes", "4a"), { enabledModules: [MD] }, { merge: true }));
    await assertSucceeds(getDoc(doc(elev(), "mdLobby", "4a")));
    await assertSucceeds(getDoc(doc(elev("kompis"), "mdLobby", "4a")));
    await assertFails(getDoc(doc(elev("e4b"), "mdLobby", "4a")));
    await assertFails(getDoc(doc(elev("e5a"), "mdLobby", "4a")));
  });
});
