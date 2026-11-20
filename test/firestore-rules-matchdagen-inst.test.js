// ============================================================================
// Regel-tester: Matchdagen 1a (#867) – classes/{id}.elevModuler och matchdagenInst/{uid}.
// ----------------------------------------------------------------------------
// Spec docs/UTVECKLINGSUPPDRAG_MATCHDAGEN.md §1.1–1.2, §15 (Regler):
//   • elevModuler skrivs av lärare med hasClass(classId), formen valideras
//     (≤ 100 elever, bara klassens elever, bara ["matchdagen"]); eleven skriver aldrig
//   • enabledModules får innehålla "matchdagen" (hela klassen, #876 – mer i
//     firestore-rules-matchdagen-klass.test.js)
//   • matchdagenInst: läraren med hasStudent(uid) skriver och läser, eleven läser
//     sitt eget och skriver aldrig, klasskamrater läser inte
// Rollerna ur test/helpers/roller-env.js (admin1, ak4 = årskurskonto 4a/4b, ak5 = 5a).
// Körs av `npm run test:rules` (emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";

let env;
const MD = "matchdagen";
const INST = { omraden: ["so/vikingatiden"], tabeller: [3, 7], rakna: [], svarssatt: "flerval", klocka: 0, lugnt: false, paus: 60 };
const inst = (uid, over = {}) => ({ ...INST, updatedAt: serverTimestamp(), updatedBy: uid, ...over });

before(async () => {
  env = await createRollerEnv("pluggportalen-rules-test-matchdagen-inst");
});
after(async () => {
  if (env) await env.testEnv.cleanup();
});
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    // 4a får en andra elev (klasskamrat) som inte har Matchdagen.
    await setDoc(doc(db, "classes", "4a"), { studentIds: ["e4a", "kompis"], elevModuler: { e4a: [MD] } }, { merge: true });
    await setDoc(doc(db, "students", "kompis"), { namn: "kompis", username: "kompis", classIds: ["4a"] });
    await setDoc(doc(db, "matchdagenInst", "e4a"), { ...INST, updatedBy: "admin1" });
  });
});

describe("elevModuler (#867): bara lärare med klassen, bara rätt form", () => {
  it("klassens elev (och klasskamraten) läser fältet – menyn behöver det", async () => {
    const snap = await assertSucceeds(getDoc(doc(env.as("kompis", {}), "classes", "4a")));
    assert.deepEqual(snap.data().elevModuler, { e4a: [MD] });
  });
  it("eleven får inte slå på Matchdagen för sig själv eller ta bort den", async () => {
    await assertFails(updateDoc(doc(env.as("kompis", {}), "classes", "4a"), { elevModuler: { e4a: [MD], kompis: [MD] } }));
    await assertFails(updateDoc(doc(env.as("e4a", {}), "classes", "4a"), { elevModuler: {} }));
  });
  it("årskurskontot med klassen slår på och av per elev", async () => {
    await assertSucceeds(updateDoc(doc(env.ak4(), "classes", "4a"), { elevModuler: { e4a: [MD], kompis: [MD] } }));
    await assertSucceeds(updateDoc(doc(env.ak4(), "classes", "4a"), { elevModuler: {} }));
    await assertSucceeds(updateDoc(doc(env.admin(), "classes", "4a"), { elevModuler: { kompis: [MD] } }));
  });
  it("årskurskontot UTAN klassen (och avstängt konto) nekas", async () => {
    await assertFails(updateDoc(doc(env.ak5(), "classes", "4a"), { elevModuler: { kompis: [MD] } }));
    await assertFails(updateDoc(doc(env.ak4av(), "classes", "4a"), { elevModuler: { kompis: [MD] } }));
  });
  it("formen: bara klassens elever, bara [\"matchdagen\"], en map, ≤ 100", async () => {
    const skriv = (v) => updateDoc(doc(env.admin(), "classes", "4a"), { elevModuler: v });
    await assertFails(skriv({ e5a: [MD] }), "elev i en annan klass");
    await assertFails(skriv({ e4a: ["schack"] }), "okänd/klassvis modul");
    await assertFails(skriv({ e4a: [MD, MD] }));
    await assertFails(skriv({ e4a: [] }), "tom lista – ta bort nyckeln i stället");
    await assertFails(skriv({ e4a: MD }));
    await assertFails(skriv([MD]));
    const ids = Array.from({ length: 101 }, (_, i) => `x${i}`);
    await env.seed((db) => setDoc(doc(db, "classes", "stor"), { name: "Stor", studentIds: ids }));
    await assertFails(updateDoc(doc(env.admin(), "classes", "stor"),
      { elevModuler: Object.fromEntries(ids.map((id) => [id, [MD]])) }), "101 elever");
    await assertSucceeds(updateDoc(doc(env.admin(), "classes", "stor"),
      { elevModuler: Object.fromEntries(ids.slice(0, 100).map((id) => [id, [MD]])) }), "100 elever");
  });
  it("en oförändrad (gammal) map stoppar inte andra klass-skrivningar", async () => {
    // e4a tas ur klassen men står kvar i elevModuler – låset/synligheten går ändå att spara.
    await assertSucceeds(updateDoc(doc(env.admin(), "classes", "4a"), { studentIds: ["kompis"] }));
    await assertSucceeds(updateDoc(doc(env.ak4(), "classes", "4a"), { hiddenModules: ["shop"] }));
    // …men en ÄNDRAD map med den gamla eleven nekas (klienten rensar bort hen).
    await assertFails(updateDoc(doc(env.ak4(), "classes", "4a"), { elevModuler: { e4a: [MD], kompis: [MD] } }));
    await assertSucceeds(updateDoc(doc(env.ak4(), "classes", "4a"), { elevModuler: { kompis: [MD] } }));
  });
  it("Matchdagen kan också slås på för hela klassen (enabledModules, #876)", async () => {
    await assertSucceeds(updateDoc(doc(env.admin(), "classes", "4a"), { enabledModules: [MD] }));
    await assertSucceeds(updateDoc(doc(env.ak4(), "classes", "4a"), { enabledModules: ["schack", MD] }));
    await assertSucceeds(updateDoc(doc(env.ak4(), "classes", "4a"), { enabledModules: ["schack"] }));
    await assertFails(updateDoc(doc(env.ak5(), "classes", "4a"), { enabledModules: [MD] }), "utan klassen");
  });
});

describe("matchdagenInst/{uid} (#867): läraren skriver, eleven läser", () => {
  it("eleven läser sitt eget, aldrig en klasskamrats", async () => {
    const snap = await assertSucceeds(getDoc(doc(env.as("e4a", {}), "matchdagenInst", "e4a")));
    assert.deepEqual(snap.data().tabeller, [3, 7]);
    await assertFails(getDoc(doc(env.as("kompis", {}), "matchdagenInst", "e4a")));
  });
  it("eleven skriver aldrig – inte ens sitt eget", async () => {
    await assertFails(setDoc(doc(env.as("e4a", {}), "matchdagenInst", "e4a"), inst("e4a", { klocka: 60 })));
    await assertFails(updateDoc(doc(env.as("e4a", {}), "matchdagenInst", "e4a"), { tabeller: [] }));
    await assertFails(deleteDoc(doc(env.as("e4a", {}), "matchdagenInst", "e4a")));
  });
  it("årskurskontot med eleven läser, skapar, ändrar och raderar", async () => {
    await assertSucceeds(getDoc(doc(env.ak4(), "matchdagenInst", "e4a")));
    await assertSucceeds(setDoc(doc(env.ak4(), "matchdagenInst", "kompis"), inst("ak4")));
    await assertSucceeds(setDoc(doc(env.ak4(), "matchdagenInst", "e4a"), inst("ak4", { svarssatt: "skriv", klocka: 30, lugnt: true, paus: 0 })));
    await assertSucceeds(deleteDoc(doc(env.ak4(), "matchdagenInst", "kompis")));
    await assertSucceeds(setDoc(doc(env.admin(), "matchdagenInst", "e5a"), inst("admin1")));
  });
  it("årskurskontot utan eleven nekas (läsa och skriva)", async () => {
    await assertFails(getDoc(doc(env.ak5(), "matchdagenInst", "e4a")));
    await assertFails(setDoc(doc(env.ak5(), "matchdagenInst", "e4a"), inst("ak5")));
    await assertFails(setDoc(doc(env.ak4av(), "matchdagenInst", "e4a"), inst("ak4av")));
  });
  it("formen valideras: kända fält, giltiga val, serverns tid och egen uid", async () => {
    const skriv = (over) => setDoc(doc(env.ak4(), "matchdagenInst", "e4a"), inst("ak4", over));
    await assertFails(skriv({ svarssatt: "gissa" }));
    await assertFails(skriv({ klocka: 45 }));
    await assertFails(skriv({ paus: 90 }));
    await assertFails(skriv({ lugnt: "ja" }));
    await assertFails(skriv({ tabeller: [11] }));
    await assertFails(skriv({ tabeller: "3" }));
    await assertFails(skriv({ omraden: [7] }), "inte strängar");
    await assertFails(skriv({ omraden: ["so/a", 7] }), "en sträng och ett tal");
    await assertFails(skriv({ rakna: ["matte"] }), "inte ämne/område");
    await assertFails(skriv({ rakna: ["so/a|so/b"] }), "\"|\" i en nyckel");
    await assertFails(skriv({ omraden: [{ so: "a" }] }), "en map i listan");
    await assertFails(skriv({ omraden: Array.from({ length: 61 }, (_, i) => `so/a${i}`) }));
    await assertFails(skriv({ hemligt: 1 }));
    await assertFails(skriv({ updatedBy: "admin1" }));
    await assertFails(setDoc(doc(env.ak4(), "matchdagenInst", "e4a"), { ...INST, updatedAt: new Date(0), updatedBy: "ak4" }));
    const { paus, ...utanPaus } = inst("ak4");
    assert.equal(paus, 60);
    await assertFails(setDoc(doc(env.ak4(), "matchdagenInst", "e4a"), utanPaus));
    await assertSucceeds(skriv({ omraden: Array.from({ length: 60 }, (_, i) => `so/a${i}`), tabeller: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }));
  });
  it("lärarpanelens batch: elevModuler + matchdagenInst i en skrivning", async () => {
    const db = env.ak4();
    const b = writeBatch(db);
    b.update(doc(db, "classes", "4a"), { elevModuler: { e4a: [MD], kompis: [MD] } });
    b.set(doc(db, "matchdagenInst", "kompis"), inst("ak4", { tabeller: [5] }));
    await assertSucceeds(b.commit());
    const snap = await assertSucceeds(getDoc(doc(env.as("kompis", {}), "matchdagenInst", "kompis")));
    assert.deepEqual(snap.data().tabeller, [5]);
  });
});
