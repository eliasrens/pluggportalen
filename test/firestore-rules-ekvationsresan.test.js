// ============================================================================
// Regel-tester: Ekvationsresan (#618) – studentData/{id}/ekvationsresa/progress
// och studentData/{id}/ekvationsresaAttempts/{taskId}.
// ----------------------------------------------------------------------------
// Eleven själv + lärare läser; klasskamrater inte. Försöket är create-only med
// uppgiftens id (säker idempotens för mynten). Formvalidering av progress och
// försök. Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";
import { defaultProgress, buildAttempt } from "../src/ekvationsresan/framsteg.js";
import { generateTask, seededRng } from "../src/ekvationsresan/generator.js";
import { startRun, playMove } from "../src/ekvationsresan/losning.js";
import { fromJSON } from "../src/ekvationsresan/equation.js";
import { taskResult } from "../src/ekvationsresan/resultat.js";

let testEnv, unauth, elev, teacher;

const ID = "aqa0000000000000000001";
const task = generateTask(1, { rng: seededRng("regler") });
const progress = { ...defaultProgress(), current: { id: ID, at: 1, task }, updatedAt: 1 };

function attempt(id = ID) {
  let run = startRun(fromJSON(task.equation));
  for (const m of task.optimalPath) run = playMove(run, m).run;
  const result = taskResult(task, run, { maxStep: 0 });
  return buildAttempt({ id, task, run, help: { log: [] }, result, startedAt: 1, completedAt: 2 });
}

const progRef = (db, uid = "elev1") => doc(db, "studentData", uid, "ekvationsresa", "progress");
const attRef = (db, id = ID, uid = "elev1") => doc(db, "studentData", uid, "ekvationsresaAttempts", id);

before(async () => {
  ({ testEnv, unauth, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-ekvationsresan"));
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "studentData", "elev1"), { coins: 10 });
    await setDoc(progRef(db), progress);
    await setDoc(attRef(db, "aqa0000000000000000000"), attempt("aqa0000000000000000000"));
  });
});

describe("ekvationsresa/progress", () => {
  it("eleven läser och skriver sitt eget progressdokument", async () => {
    await assertSucceeds(getDoc(progRef(elev("elev1"))));
    await assertSucceeds(setDoc(progRef(elev("elev1")), { ...progress, level: 2, window: [3, 3] }));
  });

  it("klasskamrat och oinloggad får varken läsa eller skriva", async () => {
    await assertFails(getDoc(progRef(elev("elev2"))));
    await assertFails(setDoc(progRef(elev("elev2")), progress));
    await assertFails(getDoc(progRef(unauth())));
  });

  it("läraren läser och ändrar nivå (E1.12), och får radera", async () => {
    await assertSucceeds(getDoc(progRef(teacher())));
    await assertSucceeds(updateDoc(progRef(teacher()), { level: 4, window: [], current: null }));
    await assertSucceeds(deleteDoc(progRef(teacher())));
  });

  it("eleven får inte radera, och bara dokument-id 'progress' finns", async () => {
    await assertFails(deleteDoc(progRef(elev("elev1"))));
    await assertFails(setDoc(doc(elev("elev1"), "studentData", "elev1", "ekvationsresa", "annat"), progress));
  });

  it("formen: nivå 1–12, fönster ≤ 10, inga okända fält", async () => {
    await assertFails(updateDoc(progRef(elev("elev1")), { level: 0 }));
    await assertFails(updateDoc(progRef(elev("elev1")), { level: 13 }));
    await assertFails(updateDoc(progRef(elev("elev1")), { level: "3" }));
    await assertFails(updateDoc(progRef(elev("elev1")), { window: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3] }));
    await assertFails(updateDoc(progRef(elev("elev1")), { hack: true }));
    await assertSucceeds(updateDoc(progRef(elev("elev1")), { level: 12 }));
  });
});

describe("ekvationsresaAttempts (create-only, idempotens)", () => {
  it("eleven skapar ett försök med uppgiftens id och läser sina försök", async () => {
    await assertSucceeds(setDoc(attRef(elev("elev1")), attempt()));
    await assertSucceeds(getDocs(collection(elev("elev1"), "studentData", "elev1", "ekvationsresaAttempts")));
  });

  it("samma uppgift kan inte sparas igen (ingen update) – mynt kan inte delas ut två gånger", async () => {
    await assertSucceeds(setDoc(attRef(elev("elev1")), attempt()));
    await assertFails(setDoc(attRef(elev("elev1")), attempt()));
    await assertFails(updateDoc(attRef(elev("elev1")), { coins: 7 }));
  });

  it("taskId måste vara dokument-id:t, och formen kontrolleras", async () => {
    await assertFails(setDoc(attRef(elev("elev1"), "aqa0000000000000000099"), attempt()));
    await assertFails(setDoc(attRef(elev("elev1"), "kort"), attempt("kort")));
    await assertFails(setDoc(attRef(elev("elev1")), { ...attempt(), stars: 4 }));
    await assertFails(setDoc(attRef(elev("elev1")), { ...attempt(), coins: 50 }));
    await assertFails(setDoc(attRef(elev("elev1")), { ...attempt(), extra: 1 }));
  });

  it("klasskamrat får inte läsa eller skapa, eleven får inte radera", async () => {
    await assertFails(getDoc(attRef(elev("elev2"), "aqa0000000000000000000")));
    await assertFails(setDoc(attRef(elev("elev2")), attempt()));
    await assertFails(deleteDoc(attRef(elev("elev1"), "aqa0000000000000000000")));
  });

  it("läraren läser och raderar men skapar inga försök åt eleven", async () => {
    await assertSucceeds(getDoc(attRef(teacher(), "aqa0000000000000000000")));
    await assertFails(setDoc(attRef(teacher()), attempt()));
    await assertSucceeds(deleteDoc(attRef(teacher(), "aqa0000000000000000000")));
  });
});
