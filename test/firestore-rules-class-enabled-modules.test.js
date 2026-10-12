// ============================================================================
// Regel-tester: opt-in-moduler per klass (#605) – classes/{id}.enabledModules.
// ----------------------------------------------------------------------------
// Hitta rätt! är AV tills läraren slår på den. Fältet speglar hiddenModules
// (#412): läsbart för klassens elever (menyn + routern), skrivbart bara av
// lärare, en lista med max 20 id. Körs av `npm run test:rules` (emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";

let testEnv, elev, teacher;

before(async () => {
  ({ testEnv, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-class-enabled-modules"));
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "6a"), { name: "6A", studentIds: ["elev1"], enabledModules: ["hittaratt"] });
    await setDoc(doc(db, "classes", "6b"), { name: "6B", studentIds: ["elev2"] });
  });
});

describe("Opt-in-moduler (#605): enabledModules läsbart för eleven, skrivbart för lärare", () => {
  it("klassens elev FÅR läsa enabledModules", async () => {
    const snap = await assertSucceeds(getDoc(doc(elev("elev1"), "classes", "6a")));
    assert.deepEqual(snap.data().enabledModules, ["hittaratt"]);
  });

  it("eleven får INTE slå på eller av en modul (egen eller annan klass)", async () => {
    await assertFails(updateDoc(doc(elev("elev1"), "classes", "6a"), { enabledModules: [] }));
    await assertFails(
      setDoc(doc(elev("elev2"), "classes", "6b"), { enabledModules: ["hittaratt"] }, { merge: true })
    );
  });

  it("läraren FÅR aktivera och inaktivera (test 7)", async () => {
    await assertSucceeds(
      setDoc(doc(teacher(), "classes", "6b"), { enabledModules: ["hittaratt"] }, { merge: true })
    );
    await assertSucceeds(updateDoc(doc(teacher(), "classes", "6a"), { enabledModules: [] }));
  });

  it("läraren sparar dolda + aktiverade moduler i EN skrivning", async () => {
    await assertSucceeds(
      setDoc(
        doc(teacher(), "classes", "6a"),
        { hiddenModules: ["shop"], enabledModules: ["hittaratt"] },
        { merge: true }
      )
    );
  });

  it("läraren får INTE spara icke-lista eller orimligt lång lista", async () => {
    await assertFails(
      setDoc(doc(teacher(), "classes", "6a"), { enabledModules: "hittaratt" }, { merge: true })
    );
    const lang = Array.from({ length: 21 }, (_, i) => `m${i}`);
    await assertFails(setDoc(doc(teacher(), "classes", "6a"), { enabledModules: lang }, { merge: true }));
  });

  it("bakåtkompatibelt: klass-skrivningar utan fältet funkar som förut", async () => {
    await assertSucceeds(setDoc(doc(teacher(), "classes", "6c"), { name: "6C", studentIds: [] }));
    await assertSucceeds(updateDoc(doc(teacher(), "classes", "6a"), { name: "6A 2" }));
  });
});
