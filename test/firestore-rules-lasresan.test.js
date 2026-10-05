// ============================================================================
// Regel-tester: Läsresan (#399) – studentData/{id}/lasresaAttempts/{autoId}.
// ----------------------------------------------------------------------------
// Försöken (ett per färdig text) följer studentData-skrivmodellen: eleven själv
// eller läraren. Läsning är STRIKTARE än studentData (inga klasskamrater) –
// försöken bär resultat per fråga. Elevens Läsresan-tillstånd
// (studentData.lasresa) ligger i föräldradokumentet och styrs av samma regel
// som resten av studentData. Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";

let testEnv, unauth, elev, teacher;

const attempt = { textId: "lr-n3-bollen-som-forsvann", correct: 6, totalQuestions: 8, completedAt: 1 };

before(async () => {
  ({ testEnv, unauth, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-lasresan"));
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "studentData", "elev1"), { coins: 10 });
    await setDoc(doc(db, "studentData", "elev2"), { coins: 10 });
    await setDoc(doc(db, "studentData", "elev1", "lasresaAttempts", "a1"), attempt);
  });
});

describe("lasresaAttempts: eleven själv + lärare", () => {
  it("eleven FÅR skapa och läsa sina egna försök", async () => {
    await assertSucceeds(setDoc(doc(elev("elev1"), "studentData", "elev1", "lasresaAttempts", "a2"), attempt));
    await assertSucceeds(getDoc(doc(elev("elev1"), "studentData", "elev1", "lasresaAttempts", "a1")));
    await assertSucceeds(getDocs(collection(elev("elev1"), "studentData", "elev1", "lasresaAttempts")));
  });

  it("en annan elev får INTE läsa eller skriva försöken", async () => {
    await assertFails(getDoc(doc(elev("elev2"), "studentData", "elev1", "lasresaAttempts", "a1")));
    await assertFails(getDocs(collection(elev("elev2"), "studentData", "elev1", "lasresaAttempts")));
    await assertFails(setDoc(doc(elev("elev2"), "studentData", "elev1", "lasresaAttempts", "x"), attempt));
    await assertFails(updateDoc(doc(elev("elev2"), "studentData", "elev1", "lasresaAttempts", "a1"), { correct: 8 }));
    await assertFails(deleteDoc(doc(elev("elev2"), "studentData", "elev1", "lasresaAttempts", "a1")));
  });

  it("läraren FÅR läsa och skriva alla elevers försök", async () => {
    await assertSucceeds(getDoc(doc(teacher(), "studentData", "elev1", "lasresaAttempts", "a1")));
    await assertSucceeds(getDocs(collection(teacher(), "studentData", "elev1", "lasresaAttempts")));
    await assertSucceeds(setDoc(doc(teacher(), "studentData", "elev2", "lasresaAttempts", "t"), attempt));
  });

  it("obehörig (ej inloggad) blockeras helt", async () => {
    await assertFails(getDoc(doc(unauth(), "studentData", "elev1", "lasresaAttempts", "a1")));
    await assertFails(setDoc(doc(unauth(), "studentData", "elev1", "lasresaAttempts", "y"), attempt));
  });

  it("eleven får skriva sitt eget lasresa-tillstånd (föräldraregeln), inte andras", async () => {
    await assertSucceeds(updateDoc(doc(elev("elev1"), "studentData", "elev1"), { lasresa: { level: 3 } }));
    await assertFails(updateDoc(doc(elev("elev2"), "studentData", "elev1"), { lasresa: { level: 7 } }));
  });

  it("andra subkollektioner under studentData är fortfarande stängda", async () => {
    await assertFails(setDoc(doc(elev("elev1"), "studentData", "elev1", "annat", "z"), { a: 1 }));
  });
});
