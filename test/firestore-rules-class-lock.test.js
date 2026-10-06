// ============================================================================
// Regel-tester: fokusläge / klass-lås (#436) – classes/{id}.lock.
// ----------------------------------------------------------------------------
// Låset ska vara LÄSBART för klassens elever (klienten tillämpar det) och
// SKRIVBART bara av lärare, med validerad form: mal.typ i enumen, område kräver
// id, `till` ett heltal (ms) framåt i tiden och högst 24 h bort (mot SERVERNS
// klocka), doljOvrigt bool. Ett oförändrat, redan utgånget lås får inte blockera
// andra klass-skrivningar. Speglar firestore-rules-class-modules.test.js.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, deleteField, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";

let testEnv, unauth, elev, teacher;

const MIN = 60_000;
const omLock = (over = {}) => ({
  mal: { typ: "omrade", id: "so/vikingatiden", namn: "Vikingatiden" },
  till: Date.now() + 30 * MIN,
  doljOvrigt: false,
  ...over,
});

before(async () => {
  ({ testEnv, unauth, elev, teacher } = await createRulesEnv(
    "pluggportalen-rules-test-class-lock"
  ));
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

// Seed: elev1 går i 6a (låst till Läsresan), 6b har ett UTGÅNGET lås.
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "6a"), {
      name: "6A",
      studentIds: ["elev1"],
      lock: { mal: { typ: "lasresan" }, till: Date.now() + 20 * MIN, doljOvrigt: true },
    });
    await setDoc(doc(db, "classes", "6b"), {
      name: "6B",
      studentIds: ["elev2"],
      lock: { mal: { typ: "lasresan" }, till: Date.now() - 60 * MIN, doljOvrigt: false },
    });
  });
});

describe("Fokusläge (#436): lock läsbart för eleven, skrivbart för lärare", () => {
  it("klassens elev FÅR läsa låset på sin klass", async () => {
    const snap = await assertSucceeds(getDoc(doc(elev("elev1"), "classes", "6a")));
    assert.equal(snap.data().lock.mal.typ, "lasresan");
    assert.equal(snap.data().lock.doljOvrigt, true);
  });

  it("obehörig (ej inloggad) får INTE läsa klassen", async () => {
    await assertFails(getDoc(doc(unauth(), "classes", "6a")));
  });

  it("eleven får INTE låsa upp, ändra eller sätta ett lås", async () => {
    await assertFails(updateDoc(doc(elev("elev1"), "classes", "6a"), { lock: deleteField() }));
    await assertFails(
      updateDoc(doc(elev("elev1"), "classes", "6a"), { "lock.till": Date.now() + MIN })
    );
    await assertFails(
      setDoc(doc(elev("elev2"), "classes", "6b"), { lock: omLock() }, { merge: true })
    );
  });

  it("läraren FÅR låsa till ett område eller Läsresan, och låsa upp", async () => {
    await assertSucceeds(updateDoc(doc(teacher(), "classes", "6b"), { lock: omLock() }));
    await assertSucceeds(
      updateDoc(doc(teacher(), "classes", "6b"), {
        lock: { mal: { typ: "lasresan" }, till: Date.now() + 45 * MIN, doljOvrigt: true },
      })
    );
    await assertSucceeds(updateDoc(doc(teacher(), "classes", "6a"), { lock: deleteField() }));
  });

  it("läraren får INTE spara en okänd mål-typ eller ett område utan id", async () => {
    await assertFails(
      updateDoc(doc(teacher(), "classes", "6a"), { lock: omLock({ mal: { typ: "shop" } }) })
    );
    await assertFails(
      updateDoc(doc(teacher(), "classes", "6a"), { lock: omLock({ mal: { typ: "omrade" } }) })
    );
    await assertFails(
      updateDoc(doc(teacher(), "classes", "6a"), {
        lock: omLock({ mal: { typ: "omrade", id: "so/x", extra: 1 } }),
      })
    );
  });

  it("sluttiden måste ligga framåt och högst 24 h bort (serverns klocka)", async () => {
    await assertFails(
      updateDoc(doc(teacher(), "classes", "6a"), { lock: omLock({ till: Date.now() - MIN }) })
    );
    await assertFails(
      updateDoc(doc(teacher(), "classes", "6a"), {
        lock: omLock({ till: Date.now() + 25 * 60 * MIN }),
      })
    );
    await assertFails(
      updateDoc(doc(teacher(), "classes", "6a"), { lock: omLock({ till: "10:45" }) })
    );
  });

  it("fel typer och extra fält avvisas", async () => {
    await assertFails(
      updateDoc(doc(teacher(), "classes", "6a"), { lock: omLock({ doljOvrigt: "ja" }) })
    );
    await assertFails(
      updateDoc(doc(teacher(), "classes", "6a"), { lock: { ...omLock(), hack: true } })
    );
    await assertFails(updateDoc(doc(teacher(), "classes", "6a"), { lock: "lasresan" }));
  });

  it("ett oförändrat UTGÅNGET lås blockerar inte andra klass-skrivningar", async () => {
    await assertSucceeds(updateDoc(doc(teacher(), "classes", "6b"), { name: "6B 2" }));
    await assertSucceeds(
      setDoc(doc(teacher(), "classes", "6b"), { hiddenModules: ["shop"] }, { merge: true })
    );
  });

  it("bakåtkompatibelt: klass-skrivningar utan lås funkar som förut", async () => {
    await assertSucceeds(setDoc(doc(teacher(), "classes", "6c"), { name: "6C", studentIds: [] }));
    await assertSucceeds(deleteDoc(doc(teacher(), "classes", "6b")));
  });
});
