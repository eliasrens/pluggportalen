// ============================================================================
// Regel-tester: Ämnesläsning (#671). Ingen ny regel behövs – Ämnesläsningen
// skriver samma ställen som Läsresan (src/data-amneslasning.js):
//   studentData/{id}.lasresa + .amneslasning  – föräldraregeln (själv/lärare)
//   studentData/{id}/lasresaAttempts/{auto}   – försöket med source "amnesläsning"
// Testerna låser fast att just de skrivningarna (i en batch, som transaktionen)
// fungerar för eleven själv och läraren men inte för andra.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, where, writeBatch } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";

let testEnv, unauth, elev, teacher;

const attempt = {
  source: "amnesläsning", subjectId: "so", areaId: "vikingar", amnesLevel: 2,
  textId: "vikingar-handel-1", textLevel: 4, levelScale: 10, correct: 5, totalQuestions: 6,
  earnedMoney: 25, readNumber: 1, completedAt: 2,
};
const patch = {
  lasresa: { level10: 5, level: 2, pendingLevel10: null, pendingLevel: null, highStreak: 0, lowStreak: 0, worldId: "skogen", stepInWorld: 3 },
  amneslasning: { areas: { vikingar: { subjectId: "so", read: { "vikingar-handel-1": { count: 1, lastAt: 2 } }, currentTextId: null, currentStartedAt: null } }, updatedAt: 2 },
};

/** Transaktionens skrivningar som en batch: föräldern + ett nytt försök. */
function completeBatch(db, studentId) {
  const ref = doc(db, "studentData", studentId);
  const b = writeBatch(db);
  b.update(ref, patch);
  b.set(doc(collection(ref, "lasresaAttempts")), attempt);
  return b.commit();
}

before(async () => {
  ({ testEnv, unauth, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-amneslasning"));
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
    await setDoc(doc(db, "studentData", "elev1", "lasresaAttempts", "gammalt"), { textId: "lr-n3-a", correct: 4, totalQuestions: 5, completedAt: 1 });
    await setDoc(doc(db, "studentData", "elev1", "lasresaAttempts", "amnes"), attempt);
  });
});

describe("Ämnesläsning: textavslut (lasresa + amneslasning + försök)", () => {
  it("eleven FÅR avsluta en ämnestext i sitt eget dokument", async () => {
    await assertSucceeds(completeBatch(elev("elev1"), "elev1"));
  });

  it("eleven FÅR starta en text (bara amneslasning-fältet)", async () => {
    const amneslasning = { areas: { vikingar: { subjectId: "so", read: {}, currentTextId: "t1", currentStartedAt: 1 } }, updatedAt: 1 };
    await assertSucceeds(setDoc(doc(elev("elev1"), "studentData", "elev1"), { amneslasning }, { merge: true }));
  });

  it("en annan elev får INTE avsluta, starta eller läsa försöken", async () => {
    await assertFails(completeBatch(elev("elev2"), "elev1"));
    await assertFails(setDoc(doc(elev("elev2"), "studentData", "elev1"), { amneslasning: {} }, { merge: true }));
    await assertFails(getDoc(doc(elev("elev2"), "studentData", "elev1", "lasresaAttempts", "amnes")));
  });

  it("obehörig blockeras helt", async () => {
    await assertFails(completeBatch(unauth(), "elev1"));
    await assertFails(getDoc(doc(unauth(), "studentData", "elev1", "lasresaAttempts", "amnes")));
  });

  it("läraren läser alla försök och kan filtrera på source", async () => {
    await assertSucceeds(getDocs(collection(teacher(), "studentData", "elev1", "lasresaAttempts")));
    await assertSucceeds(getDocs(query(collection(teacher(), "studentData", "elev1", "lasresaAttempts"), where("source", "==", "amnesläsning"))));
    await assertSucceeds(completeBatch(teacher(), "elev2"));
  });

  it("eleven läser sina egna försök, gamla (utan source) och nya", async () => {
    const snap = await assertSucceeds(getDocs(collection(elev("elev1"), "studentData", "elev1", "lasresaAttempts")));
    if (snap.size !== 2) throw new Error(`väntade 2 försök, fick ${snap.size}`);
  });
});
