// ============================================================================
// Regel-tester: Matchdagen följer det som är synligt (#899, Veckoschema A.2, spec F.1 Regler) –
// `foljPlugga` ("Samma som Plugga") i validMatchdagenInst: en valfri bool både i
// matchdagenInst/{uid} och i classes/{id}.matchdagenInst. Gamla inställningar utan fältet går
// fortfarande att spara (deploy-glappet: en gammal webb skriver inte fältet).
// Körs av `npm run test:rules` (emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";

let env;
const INST = { omraden: [], tabeller: [], rakna: [], svarssatt: "flerval", klocka: 0, lugnt: false, paus: 60 };
const inst = (uid, over = {}) => ({ ...INST, updatedAt: serverTimestamp(), updatedBy: uid, ...over });

before(async () => {
  env = await createRollerEnv("pluggportalen-rules-test-matchdagen-folj-899");
});
after(async () => {
  if (env) await env.testEnv.cleanup();
});
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
});

describe("foljPlugga (#899) i matchdagenInst/{uid}", () => {
  const skriv = (over) => setDoc(doc(env.ak4(), "matchdagenInst", "e4a"), inst("ak4", over));
  it("true och false sparas; utan fältet (gamla inställningar) också", async () => {
    await assertSucceeds(skriv({ foljPlugga: true }));
    await assertSucceeds(skriv({ foljPlugga: false, omraden: ["so/vikingatiden"] }));
    await assertSucceeds(skriv({ foljPlugga: true, omraden: ["so/vikingatiden"], tabeller: [7] }), "valda områden står kvar bredvid");
    await assertSucceeds(skriv({}));
  });
  it("något annat än en bool nekas", async () => {
    for (const v of ["ja", 1, null, ["x"], { a: 1 }]) await assertFails(skriv({ foljPlugga: v }), JSON.stringify(v));
  });
  it("eleven skriver fortfarande aldrig", async () => {
    await assertFails(setDoc(doc(env.as("e4a", {}), "matchdagenInst", "e4a"), inst("e4a", { foljPlugga: true })));
  });
});

describe("foljPlugga (#899) i classes/{id}.matchdagenInst", () => {
  const klass = (db) => doc(db, "classes", "4a");
  it("läraren med klassen sparar Samma som Plugga för hela klassen", async () => {
    await assertSucceeds(updateDoc(klass(env.ak4()), { matchdagenInst: inst("ak4", { foljPlugga: true }) }));
    await assertSucceeds(updateDoc(klass(env.ak4()), { matchdagenInst: inst("ak4", { foljPlugga: false, tabeller: [3] }) }));
  });
  it("fel typ nekas, och en annan lärare eller eleven nekas", async () => {
    await assertFails(updateDoc(klass(env.ak4()), { matchdagenInst: inst("ak4", { foljPlugga: "true" }) }));
    await assertFails(updateDoc(klass(env.ak5()), { matchdagenInst: inst("ak5", { foljPlugga: true }) }));
    await assertFails(updateDoc(klass(env.as("e4a", {})), { matchdagenInst: inst("e4a", { foljPlugga: true }) }));
  });
});
