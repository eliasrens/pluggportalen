// ============================================================================
// Regel-tester: by-synlighet per klass (#391) – classes/{id}.hiddenVillages.
// ----------------------------------------------------------------------------
// Fältet ska vara LÄSBART för klassens elever (områdesvyn filtrerar skolan på
// det) och SKRIVBART bara av lärare, och måste vara en lista om det skickas
// med. Saknat fält = allt synligt (befintliga klass-skrivningar påverkas inte).
// Riggen delas via test/helpers/rules-env.js. Körs av `npm run test:rules`
// (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  arrayRemove,
  arrayUnion,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";

let testEnv, unauth, elev, teacher;

before(async () => {
  ({ testEnv, unauth, elev, teacher } = await createRulesEnv(
    "pluggportalen-rules-test-class-villages"
  ));
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

// Seed: elev1 går i 6a (som döljer specgruppen "sp"), elev2 går i sp.
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "6a"), {
      name: "6A",
      studentIds: ["elev1"],
      hiddenVillages: ["sp"],
    });
    await setDoc(doc(db, "classes", "sp"), { name: "Spec", studentIds: ["elev2"] });
  });
});

describe("By-synlighet (#391): hiddenVillages läsbart för eleven, skrivbart för lärare", () => {
  it("klassens elev FÅR läsa hiddenVillages på sin klass", async () => {
    const snap = await assertSucceeds(getDoc(doc(elev("elev1"), "classes", "6a")));
    assert.deepEqual(snap.data().hiddenVillages, ["sp"]);
  });

  it("obehörig (ej inloggad) får INTE läsa klassen", async () => {
    await assertFails(getDoc(doc(unauth(), "classes", "6a")));
  });

  it("eleven får INTE ändra eller tömma hiddenVillages (varken egen eller annan klass)", async () => {
    await assertFails(updateDoc(doc(elev("elev1"), "classes", "6a"), { hiddenVillages: [] }));
    await assertFails(
      setDoc(doc(elev("elev2"), "classes", "6a"), { hiddenVillages: [] }, { merge: true })
    );
  });

  it("läraren FÅR sätta och tömma hiddenVillages (lista)", async () => {
    await assertSucceeds(
      setDoc(doc(teacher(), "classes", "6a"), { hiddenVillages: ["sp", "6b"] }, { merge: true })
    );
    await assertSucceeds(updateDoc(doc(teacher(), "classes", "6a"), { hiddenVillages: [] }));
  });

  it("läraren får INTE spara hiddenVillages som icke-lista eller orimligt lång lista", async () => {
    await assertFails(
      setDoc(doc(teacher(), "classes", "6a"), { hiddenVillages: "sp" }, { merge: true })
    );
    const lang = Array.from({ length: 201 }, (_, i) => `k${i}`);
    await assertFails(
      setDoc(doc(teacher(), "classes", "6a"), { hiddenVillages: lang }, { merge: true })
    );
  });

  it("genvägen 'dölj för alla': lärarens batch med arrayUnion/arrayRemove tillåts", async () => {
    const db = teacher();
    const hide = writeBatch(db);
    hide.set(doc(db, "classes", "6a"), { hiddenVillages: arrayUnion("sp") }, { merge: true });
    hide.set(doc(db, "classes", "6b"), { hiddenVillages: arrayUnion("sp") }, { merge: true });
    await assertSucceeds(hide.commit());
    const snap = await getDoc(doc(db, "classes", "6b"));
    assert.deepEqual(snap.data().hiddenVillages, ["sp"]);
    const show = writeBatch(db);
    show.set(doc(db, "classes", "6a"), { hiddenVillages: arrayRemove("sp") }, { merge: true });
    await assertSucceeds(show.commit());
  });

  it("genvägen nekas för elev (även en elev i den dolda klassen)", async () => {
    const db = elev("elev2");
    const b = writeBatch(db);
    b.set(doc(db, "classes", "6a"), { hiddenVillages: arrayRemove("sp") }, { merge: true });
    await assertFails(b.commit());
  });

  it("bakåtkompatibelt: lärarens vanliga klass-skrivningar utan fältet funkar som förut", async () => {
    await assertSucceeds(
      setDoc(doc(teacher(), "classes", "6b"), { name: "6B", studentIds: [] })
    );
    await assertSucceeds(updateDoc(doc(teacher(), "classes", "sp"), { name: "Spec 2" }));
    await assertSucceeds(deleteDoc(doc(teacher(), "classes", "sp")));
  });
});
