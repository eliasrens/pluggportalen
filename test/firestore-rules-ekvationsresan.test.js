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
import assert from "node:assert/strict";
import { defaultProgress, buildAttempt, normalizeProgress, teacherSetLevel } from "../src/ekvationsresan/framsteg.js";
import { generateTask, seededRng } from "../src/ekvationsresan/generator.js";
import { startRun, playMove } from "../src/ekvationsresan/losning.js";
import { fromJSON } from "../src/ekvationsresan/equation.js";
import { taskResult } from "../src/ekvationsresan/resultat.js";

let testEnv, unauth, elev, teacher;

const ID = "aqa0000000000000000001";
const task = generateTask(1, { rng: seededRng("regler"), type: "A" });
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

describe("lärarens nivåstyrning (#619, E1.12)", () => {
  it("läraren sätter nivå med teacherSetLevel – fönstret nollställs, statistiken orörd", async () => {
    const played = { ...progress, level: 3, window: [3, 2], tasks: 7, solved: 6, coins: 9 };
    await testEnv.withSecurityRulesDisabled((ctx) => setDoc(progRef(ctx.firestore()), played));
    await assertSucceeds(setDoc(progRef(teacher()), teacherSetLevel(normalizeProgress(played), 5, 123)));
    let snap;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      snap = (await getDoc(progRef(ctx.firestore()))).data();
    });
    assert.equal(snap.level, 5);
    assert.deepEqual(snap.window, []);
    assert.equal(snap.tasks, 7);
    assert.equal(snap.coins, 9);
  });

  it("läraren kan inte behålla fönstret eller ändra statistik och mynt", async () => {
    await assertFails(updateDoc(progRef(teacher()), { level: 4, window: [3] }));
    await assertFails(updateDoc(progRef(teacher()), { level: 4, window: [], coins: 500 }));
    await assertFails(updateDoc(progRef(teacher()), { window: [], tasks: 99 }));
    await assertFails(updateDoc(progRef(teacher()), { window: [], helpTasks: 3 }));
    await assertFails(updateDoc(progRef(teacher()), { window: [], stars: [0, 0, 0, 99] }));
  });

  it("elev som aldrig öppnat modulen: läraren skapar ett tomt dokument, inte ett med statistik", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) => deleteDoc(progRef(ctx.firestore())));
    await assertFails(setDoc(progRef(teacher()), { ...teacherSetLevel(defaultProgress(), 4, 1), tasks: 3 }));
    await assertFails(setDoc(progRef(teacher()), { ...teacherSetLevel(defaultProgress(), 4, 1), window: [2] }));
    await assertSucceeds(setDoc(progRef(teacher()), teacherSetLevel(defaultProgress(), 4, 1)));
  });

  it("formen gäller även läraren (nivå 1–12)", async () => {
    await assertFails(updateDoc(progRef(teacher()), { level: 13, window: [] }));
    await assertFails(updateDoc(progRef(teacher()), { level: 0, window: [] }));
  });

  it("eleven skriver fortfarande sin statistik efter en lärarändring", async () => {
    await assertSucceeds(updateDoc(progRef(teacher()), { level: 2, window: [], current: null }));
    await assertSucceeds(updateDoc(progRef(elev("elev1")), { tasks: 1, window: [3], coins: 1 }));
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

describe("uppgiftstyperna C–F (#625): elevens svar på försöket", () => {
  const svar = (n) => Array.from({ length: n }, (_, i) => ({ k: "ekvation", a: `${i}x = 2`, ok: false }));
  it("ett försök med answers (≤ 40) går att skapa", async () => {
    const id = "aqa0000000000000000625";
    await assertSucceeds(setDoc(attRef(elev("elev1"), id), { ...attempt(id), type: "D", answers: svar(3) }));
  });
  it("answers måste vara en lista med högst 40 svar", async () => {
    await assertFails(setDoc(attRef(elev("elev1"), "aqa0000000000000000626"), { ...attempt("aqa0000000000000000626"), answers: svar(41) }));
    await assertFails(setDoc(attRef(elev("elev1"), "aqa0000000000000000627"), { ...attempt("aqa0000000000000000627"), answers: "fusk" }));
  });
});
