// ============================================================================
// Regel-tester: Matchdagen – visa lästext till frågorna (#905, spec §3) – `lastext` i
// validMatchdagenInst: en valfri bool både i matchdagenInst/{uid} och i
// classes/{id}.matchdagenInst. Utan fältet (gamla inställningar, en gammal webb under
// deploy-glappet) går det fortfarande att spara – saknas = true (md-inst.js normalizeInst).
// Körs av `npm run test:rules` (emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";

let env;
const INST = { omraden: [], tabeller: [], rakna: [], svarssatt: "flerval", klocka: 0, lugnt: false, paus: 60, foljPlugga: true };
const inst = (uid, over = {}) => ({ ...INST, updatedAt: serverTimestamp(), updatedBy: uid, ...over });

before(async () => {
  env = await createRollerEnv("pluggportalen-rules-test-matchdagen-lastext-905");
});
after(async () => {
  if (env) await env.testEnv.cleanup();
});
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
});

describe("lastext (#905) i matchdagenInst/{uid}", () => {
  const skriv = (over) => setDoc(doc(env.ak4(), "matchdagenInst", "e4a"), inst("ak4", over));
  it("true och false sparas; utan fältet också", async () => {
    await assertSucceeds(skriv({ lastext: true }));
    await assertSucceeds(skriv({ lastext: false, foljPlugga: false, omraden: ["so/vikingatiden"] }));
    await assertSucceeds(skriv({}));
  });
  it("något annat än en bool nekas", async () => {
    for (const v of ["ja", 1, 0, null, ["x"], { a: 1 }]) await assertFails(skriv({ lastext: v }), JSON.stringify(v));
  });
  it("eleven skriver fortfarande aldrig", async () => {
    await assertFails(setDoc(doc(env.as("e4a", {}), "matchdagenInst", "e4a"), inst("e4a", { lastext: true })));
  });
});

describe("lastext (#905) i classes/{id}.matchdagenInst", () => {
  const klass = (db) => doc(db, "classes", "4a");
  it("läraren med klassen sparar lästexten för hela klassen", async () => {
    await assertSucceeds(updateDoc(klass(env.ak4()), { matchdagenInst: inst("ak4", { lastext: false }) }));
    await assertSucceeds(updateDoc(klass(env.ak4()), { matchdagenInst: inst("ak4", { lastext: true, tabeller: [3] }) }));
  });
  it("fel typ nekas, och en annan lärare eller eleven nekas", async () => {
    await assertFails(updateDoc(klass(env.ak4()), { matchdagenInst: inst("ak4", { lastext: "true" }) }));
    await assertFails(updateDoc(klass(env.ak5()), { matchdagenInst: inst("ak5", { lastext: true }) }));
    await assertFails(updateDoc(klass(env.as("e4a", {})), { matchdagenInst: inst("e4a", { lastext: true }) }));
  });
});
