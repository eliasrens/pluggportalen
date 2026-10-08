// ============================================================================
// Regel-tester: sparade elevlösenord – studentCredentials/{uid}.
// ----------------------------------------------------------------------------
// BARA lärare läser/skriver. En elev får aldrig läsa något dokument här – inte
// ens sitt eget – och kan inte lista samlingen. Lärarens skrivning valideras:
// bara { username, password?, updatedAt }, lösenord minst 6 tecken.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";

let testEnv, unauth, elev, teacher;

before(async () => {
  ({ testEnv, unauth, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-credentials"));
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "studentCredentials", "elev1"), {
      username: "elev1",
      password: "katt482",
      updatedAt: 1,
    });
  });
});

describe("studentCredentials: bara lärare", () => {
  it("läraren läser, listar och tar bort", async () => {
    const snap = await assertSucceeds(getDoc(doc(teacher(), "studentCredentials", "elev1")));
    assert.equal(snap.data().password, "katt482");
    await assertSucceeds(getDocs(collection(teacher(), "studentCredentials")));
    await assertSucceeds(deleteDoc(doc(teacher(), "studentCredentials", "elev1")));
  });

  it("eleven får INTE läsa sitt eget sparade lösenord", async () => {
    await assertFails(getDoc(doc(elev("elev1"), "studentCredentials", "elev1")));
  });

  it("en annan elev / utloggad får varken läsa eller lista", async () => {
    await assertFails(getDoc(doc(elev("elev2"), "studentCredentials", "elev1")));
    await assertFails(getDocs(collection(elev("elev2"), "studentCredentials")));
    await assertFails(getDoc(doc(unauth(), "studentCredentials", "elev1")));
  });

  it("elever får inte skriva eller ta bort", async () => {
    await assertFails(
      setDoc(doc(elev("elev1"), "studentCredentials", "elev1"), { username: "elev1", password: "hemlig1" })
    );
    await assertFails(deleteDoc(doc(elev("elev1"), "studentCredentials", "elev1")));
    await assertFails(setDoc(doc(unauth(), "studentCredentials", "x"), { username: "x" }));
  });

  it("läraren skriver giltig form (med och utan lösenord)", async () => {
    await assertSucceeds(
      setDoc(doc(teacher(), "studentCredentials", "ny1"), {
        username: "ny1",
        password: "sol123",
        updatedAt: serverTimestamp(),
      })
    );
    await assertSucceeds(setDoc(doc(teacher(), "studentCredentials", "ny2"), { username: "ny2" }));
  });

  it("lärarens skrivning valideras: okända fält, kort lösenord, fel typ nekas", async () => {
    const ref = doc(teacher(), "studentCredentials", "ny3");
    await assertFails(setDoc(ref, { username: "ny3", password: "kort" }));
    await assertFails(setDoc(ref, { username: "ny3", password: 123456 }));
    await assertFails(setDoc(ref, { username: 5 }));
    await assertFails(setDoc(ref, { username: "ny3", coins: 100 }));
  });
});
