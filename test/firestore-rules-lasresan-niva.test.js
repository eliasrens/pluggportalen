// ============================================================================
// Regel-tester: Läsresan lärarstyrd nivå (#505, skala 1–10 i #519).
// ----------------------------------------------------------------------------
//   * classes/{id}.lasresaStartLevel10 – bara lärare skriver, heltal 1–10;
//     spegeln lasresaStartLevel (gammal skala) heltal 1–7 (saknade fält =
//     standardnivån). Elever läser dem (klientens startnivå).
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

describe("classes.lasresaStartLevel10 (1–10) + spegeln lasresaStartLevel (1–7): bara lärare", () => {
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

  it("läraren FÅR sätta nya skalans startnivå 1–10 (med spegel, som klienten skriver)", async () => {
    const ref = doc(teacher(), "classes", "6b");
    for (let lvl = 1; lvl <= 10; lvl++) {
      const spegel = Math.min(7, Math.max(1, lvl - 3));
      await assertSucceeds(setDoc(ref, { lasresaStartLevel10: lvl, lasresaStartLevel: spegel }, { merge: true }));
    }
    await assertSucceeds(updateDoc(ref, { lasresaStartLevel10: deleteField(), lasresaStartLevel: deleteField() }));
    await assertSucceeds(
      setDoc(doc(teacher(), "classes", "ny10"), { name: "Ny", studentIds: [], lasresaStartLevel10: 2, lasresaStartLevel: 1 })
    );
  });

  it("ogiltiga nya-skala-värden nekas även för läraren (0, 11, sträng, decimal, null)", async () => {
    const ref = doc(teacher(), "classes", "6a");
    for (const bad of [0, 11, -1, "4", 4.5, null, true]) {
      await assertFails(updateDoc(ref, { lasresaStartLevel10: bad }));
    }
    // Spegeln är fortfarande gammal skala: 8–10 hör hemma i lasresaStartLevel10.
    await assertFails(updateDoc(ref, { lasresaStartLevel10: 10, lasresaStartLevel: 10 }));
  });

  it("andra klass-skrivningar påverkas inte (fältet saknas / står kvar oförändrat)", async () => {
    await assertSucceeds(updateDoc(doc(teacher(), "classes", "6a"), { name: "6A!" }));
    await assertSucceeds(updateDoc(doc(teacher(), "classes", "6b"), { name: "6B!" }));
  });

  it("elev får INTE sätta klassens startnivå (inte ens giltig, inte ens sin egen klass)", async () => {
    await assertFails(updateDoc(doc(elev("elev1"), "classes", "6a"), { lasresaStartLevel: 1 }));
    await assertFails(updateDoc(doc(elev("elev1"), "classes", "6a"), { lasresaStartLevel10: 1 }));
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

  it("läraren FÅR skriva lagringsformen för skala 1–10 (level10/pendingLevel10 + spegel)", async () => {
    const lasresa = { ...set, level: 6, level10: 9, pendingLevel: 1, pendingLevel10: 2 };
    await assertSucceeds(updateDoc(doc(teacher(), "studentData", "elev1"), { lasresa }));
    await assertSucceeds(updateDoc(doc(elev("elev1"), "studentData", "elev1"), { lasresa }));
  });

  it("en annan elev får INTE ändra någons nivå", async () => {
    await assertFails(updateDoc(doc(elev("elev2"), "studentData", "elev1"), { lasresa: set }));
    await assertFails(updateDoc(doc(elev("elev2"), "studentData", "elev1"), { "lasresa.pendingLevel": 7 }));
    await assertFails(updateDoc(doc(elev("elev2"), "studentData", "elev1"), { "lasresa.level10": 10 }));
  });

  it("obehörig får inte ändra nivån", async () => {
    await assertFails(updateDoc(doc(unauth(), "studentData", "elev1"), { "lasresa.level": 1 }));
  });
});
