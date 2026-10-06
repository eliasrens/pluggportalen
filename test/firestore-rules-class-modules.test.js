// ============================================================================
// Regel-tester: modul-synlighet per klass (#412) – classes/{id}.hiddenModules.
// ----------------------------------------------------------------------------
// Fältet ska vara LÄSBART för klassens elever (sidomenyn + routern filtrerar på
// det) och SKRIVBART bara av lärare, och måste vara en lista om det skickas
// med. Saknat fält = allt synligt (befintliga klass-skrivningar påverkas inte).
// Speglar firestore-rules-class-villages.test.js. Körs av `npm run test:rules`
// (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";

let testEnv, unauth, elev, teacher;

before(async () => {
  ({ testEnv, unauth, elev, teacher } = await createRulesEnv(
    "pluggportalen-rules-test-class-modules"
  ));
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

// Seed: elev1 går i 6a, som döljer Läsresan.
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "6a"), {
      name: "6A",
      studentIds: ["elev1"],
      hiddenModules: ["lasresan"],
    });
    await setDoc(doc(db, "classes", "6b"), { name: "6B", studentIds: ["elev2"] });
  });
});

describe("Modul-synlighet (#412): hiddenModules läsbart för eleven, skrivbart för lärare", () => {
  it("klassens elev FÅR läsa hiddenModules på sin klass", async () => {
    const snap = await assertSucceeds(getDoc(doc(elev("elev1"), "classes", "6a")));
    assert.deepEqual(snap.data().hiddenModules, ["lasresan"]);
  });

  it("obehörig (ej inloggad) får INTE läsa klassen", async () => {
    await assertFails(getDoc(doc(unauth(), "classes", "6a")));
  });

  it("eleven får INTE tömma eller ändra hiddenModules (varken egen eller annan klass)", async () => {
    await assertFails(updateDoc(doc(elev("elev1"), "classes", "6a"), { hiddenModules: [] }));
    await assertFails(
      setDoc(doc(elev("elev2"), "classes", "6b"), { hiddenModules: ["plugga"] }, { merge: true })
    );
  });

  it("läraren FÅR sätta och tömma hiddenModules (lista)", async () => {
    await assertSucceeds(
      setDoc(doc(teacher(), "classes", "6a"), { hiddenModules: ["lasresan", "plugga"] }, { merge: true })
    );
    await assertSucceeds(updateDoc(doc(teacher(), "classes", "6a"), { hiddenModules: [] }));
  });

  it("läraren får INTE spara hiddenModules som icke-lista eller orimligt lång lista", async () => {
    await assertFails(
      setDoc(doc(teacher(), "classes", "6a"), { hiddenModules: "lasresan" }, { merge: true })
    );
    const lang = Array.from({ length: 21 }, (_, i) => `m${i}`);
    await assertFails(
      setDoc(doc(teacher(), "classes", "6a"), { hiddenModules: lang }, { merge: true })
    );
  });

  it("hiddenModules och hiddenVillages valideras oberoende av varandra", async () => {
    await assertSucceeds(
      setDoc(
        doc(teacher(), "classes", "6a"),
        { hiddenModules: ["plugga"], hiddenVillages: ["6b"] },
        { merge: true }
      )
    );
    await assertFails(
      setDoc(doc(teacher(), "classes", "6a"), { hiddenVillages: "6b" }, { merge: true })
    );
  });

  it("bakåtkompatibelt: lärarens vanliga klass-skrivningar utan fältet funkar som förut", async () => {
    await assertSucceeds(setDoc(doc(teacher(), "classes", "6c"), { name: "6C", studentIds: [] }));
    await assertSucceeds(updateDoc(doc(teacher(), "classes", "6b"), { name: "6B 2" }));
    await assertSucceeds(deleteDoc(doc(teacher(), "classes", "6b")));
  });
});
