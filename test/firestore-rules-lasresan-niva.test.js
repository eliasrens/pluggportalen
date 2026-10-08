// ============================================================================
// Regel-tester: Läsresan lärarstyrd nivå (#505).
// ----------------------------------------------------------------------------
//   * classes/{id}.lasresaStartLevel – bara lärare skriver, heltal 1–7 (saknat
//     fält = standardnivån). Elever läser det (klientens startnivå).
//   * studentData/{id}.lasresa.{level, pendingLevel, levelSetBy, levelSetAt} –
//     lärare får sätta ANDRA elevers nivå; en elev får inte röra någon annans.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteField, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";

let testEnv, unauth, elev, teacher;

before(async () => {
  ({ testEnv, unauth, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-lasresan-niva"));
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "classes", "6a"), { name: "6A", studentIds: ["elev1", "elev2"], lasresaStartLevel: 2 });
    await setDoc(doc(db, "classes", "6b"), { name: "6B", studentIds: ["elev3"] });
    await setDoc(doc(db, "studentData", "elev1"), { coins: 10, lasresa: { level: 5, totalTexts: 3, currentTextId: "t" } });
    await setDoc(doc(db, "studentData", "elev2"), { coins: 10 });
  });
});

describe("classes.lasresaStartLevel: bara lärare, heltal 1–7", () => {
  it("klassens elev FÅR läsa startnivån", async () => {
    const snap = await assertSucceeds(getDoc(doc(elev("elev1"), "classes", "6a")));
    assert.equal(snap.data().lasresaStartLevel, 2);
  });

  it("läraren FÅR sätta, ändra och ta bort startnivån", async () => {
    const ref = doc(teacher(), "classes", "6b");
    await assertSucceeds(setDoc(ref, { lasresaStartLevel: 1 }, { merge: true }));
    await assertSucceeds(updateDoc(ref, { lasresaStartLevel: 7 }));
    await assertSucceeds(updateDoc(ref, { lasresaStartLevel: deleteField() }));
    await assertSucceeds(
      setDoc(doc(teacher(), "classes", "ny"), { name: "Ny", studentIds: [], lasresaStartLevel: 4 })
    );
  });

  it("ogiltiga värden nekas även för läraren (0, 8, sträng, decimal, null)", async () => {
    const ref = doc(teacher(), "classes", "6a");
    for (const bad of [0, 8, -1, "3", 3.5, null, true]) {
      await assertFails(updateDoc(ref, { lasresaStartLevel: bad }));
    }
  });

  it("andra klass-skrivningar påverkas inte (fältet saknas / står kvar oförändrat)", async () => {
    await assertSucceeds(updateDoc(doc(teacher(), "classes", "6a"), { name: "6A!" }));
    await assertSucceeds(updateDoc(doc(teacher(), "classes", "6b"), { name: "6B!" }));
  });

  it("elev får INTE sätta klassens startnivå (inte ens giltig, inte ens sin egen klass)", async () => {
    await assertFails(updateDoc(doc(elev("elev1"), "classes", "6a"), { lasresaStartLevel: 1 }));
    await assertFails(setDoc(doc(elev("elev3"), "classes", "6b"), { lasresaStartLevel: 1 }, { merge: true }));
    await assertFails(updateDoc(doc(elev("elev1"), "classes", "6a"), { lasresaStartLevel: deleteField() }));
  });

  it("obehörig (ej inloggad) får varken läsa eller skriva", async () => {
    await assertFails(getDoc(doc(unauth(), "classes", "6a")));
    await assertFails(updateDoc(doc(unauth(), "classes", "6a"), { lasresaStartLevel: 1 }));
  });
});

describe("studentData.lasresa: lärare sätter elevers nivå", () => {
  const set = { level: 5, totalTexts: 3, currentTextId: "t", pendingLevel: 1, levelSetBy: "teacher", levelSetAt: 1 };

  it("läraren FÅR sätta nivå/pendingLevel på en elev (befintligt och nytt lasresa)", async () => {
    await assertSucceeds(updateDoc(doc(teacher(), "studentData", "elev1"), { lasresa: set }));
    await assertSucceeds(
      updateDoc(doc(teacher(), "studentData", "elev2"), { lasresa: { level: 1, levelSetBy: "teacher", levelSetAt: 1 } })
    );
    await assertSucceeds(setDoc(doc(teacher(), "studentData", "elev9"), { lasresa: { level: 3 } }));
  });

  it("en annan elev får INTE ändra någons nivå", async () => {
    await assertFails(updateDoc(doc(elev("elev2"), "studentData", "elev1"), { lasresa: set }));
    await assertFails(updateDoc(doc(elev("elev2"), "studentData", "elev1"), { "lasresa.pendingLevel": 7 }));
  });

  it("obehörig får inte ändra nivån", async () => {
    await assertFails(updateDoc(doc(unauth(), "studentData", "elev1"), { "lasresa.level": 1 }));
  });
});
