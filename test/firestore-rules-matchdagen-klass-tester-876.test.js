// ============================================================================
// Tester #876: regelgränser för Matchdagen för hela klassen – uttrycksgränsen (1000) när
// ALLT i klassdokumentet ändras i samma skrivning (100 elever i elevModuler, klassens
// inställningar med 60+60 långa områden, enabledModules och ett nytt fokuslås), att
// klassens matchdagenInst inte kan skrivas av en elev med Matchdagen, att en elev inte
// smyger in "matchdagen" i enabledModules, och att lärarens "Följ klassens inställningar"
// (radera matchdagenInst/{uid}) går för läraren men inte för eleven.
// Körs av `npm run test:rules` (emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";

let env;
const MD = "matchdagen";
const ELEVER = Array.from({ length: 100 }, (_, i) => `elev-${String(i).padStart(3, "0")}-${"x".repeat(20)}`);
const lang = (p, n) => Array.from({ length: n }, (_, i) => `${p}${"a".repeat(40)}${i}/omr${"b".repeat(60)}${i}`);
const INST = (uid) => ({ omraden: lang("so", 60), tabeller: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], rakna: lang("ma", 60),
  svarssatt: "skriv", klocka: 60, lugnt: true, paus: 45, updatedAt: serverTimestamp(), updatedBy: uid });
const klass = (db) => doc(db, "classes", "4a");

before(async () => { env = await createRollerEnv("pluggportalen-rules-test-matchdagen-876-tester"); });
after(async () => { if (env) await env.testEnv.cleanup(); });
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    await setDoc(doc(db, "classes", "4a"), { studentIds: ["e4a", ...ELEVER] }, { merge: true });
    await setDoc(doc(db, "matchdagenInst", "e4a"), { omraden: [], tabeller: [3], rakna: [], svarssatt: "flerval", klocka: 0, lugnt: false, paus: 60, updatedAt: new Date(), updatedBy: "ak4" });
  });
});

describe("Tester #876: klassdokumentets gränser", () => {
  it("allt ändrat i EN skrivning (100 elever, max inst, enabledModules, lås) håller sig under uttrycksgränsen", async () => {
    const elevModuler = Object.fromEntries(ELEVER.map((u) => [u, [MD]]));
    await assertSucceeds(updateDoc(klass(env.ak4()), {
      enabledModules: ["hittaratt", "schack", MD], elevModuler, matchdagenInst: INST("ak4"),
      lock: { mal: { typ: "omrade", id: "so/x", namn: "X" }, till: Date.now() + 3600_000, doljOvrigt: true },
      hiddenModules: ["shop"], lasresaStartLevel10: 5, lasresaStartLevel: 2,
    }));
    // Och sedan: bara klassens inställningar ändras medan resten ligger kvar.
    await assertSucceeds(updateDoc(klass(env.ak4()), { matchdagenInst: { ...INST("ak4"), tabeller: [] } }));
  });
  it("en elev MED Matchdagen kan varken skriva klassens inställningar eller enabledModules", async () => {
    await env.seed((db) => setDoc(doc(db, "classes", "4a"), { enabledModules: [MD], elevModuler: { e4a: [MD] } }, { merge: true }));
    const e = env.as("e4a", {});
    await assertFails(updateDoc(klass(e), { matchdagenInst: INST("e4a") }));
    await assertFails(updateDoc(klass(e), { enabledModules: [] }));
  });
  it("Följ klassens inställningar: läraren raderar elevens egna; eleven och fel lärare får inte", async () => {
    await assertFails(deleteDoc(doc(env.as("e4a", {}), "matchdagenInst", "e4a")));
    await assertFails(deleteDoc(doc(env.ak5(), "matchdagenInst", "e4a")));
    await assertSucceeds(deleteDoc(doc(env.ak4(), "matchdagenInst", "e4a")));
  });
});
