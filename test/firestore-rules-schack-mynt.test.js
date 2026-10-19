// ============================================================================
// Regel-tester: schackets pluggmynt (#798, docs/SCHACK.md §18).
// ----------------------------------------------------------------------------
//   schackMynt/{uid} = kvittot – bara Cloud Functions skriver (Admin SDK). Ingen
//   klient (eleven själv, en annan elev, årskurskontot, admin) kan skapa, ändra
//   eller radera det; eleven och läraren med eleven läser det.
//   studentData.schack.pokaler = schackets pokaler (servern skriver) – eleven kan
//   varken skapa, ändra eller ta bort dem, men övriga skrivningar (mynt, guidens
//   framsteg …) fungerar med pokalen på plats. Ett årskurskonto kan inte ge mynt
//   med en schackpokal i samma skrivning.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, increment } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";

let env;

before(async () => {
  env = await createRollerEnv("pluggportalen-rules-test-schack-mynt");
});
after(async () => {
  if (env?.testEnv) await env.testEnv.cleanup();
});

const KVITTO = { dator: { bonden: 1 }, lektioner: { 1: 1 }, pussel: { "ett-HiVCC": 1 }, pokaler: {}, total: 210, uppdaterad: 1 };

beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    await setDoc(doc(db, "schackMynt", "e4a"), KVITTO);
    await setDoc(doc(db, "studentData", "e5a"), {
      coins: 700, schack: { datorPartier: 3, lektioner: { 1: 3 }, pokaler: { damen: 123 } },
    });
  });
});

const kvitto = (db, uid) => doc(db, "schackMynt", uid);
const sd = (db, uid) => doc(db, "studentData", uid);

describe("schackMynt/{uid} – kvittot (#798)", () => {
  it("läsning: eleven själv, årskurskontot med eleven och admin – inte en annan elev eller annan årskurs", async () => {
    await assertSucceeds(getDoc(kvitto(env.elev("e4a"), "e4a")));
    await assertSucceeds(getDoc(kvitto(env.elev("e4b"), "e4b")), "saknat eget kvitto");
    await assertSucceeds(getDoc(kvitto(env.ak4(), "e4a")));
    await assertSucceeds(getDoc(kvitto(env.admin(), "e4a")));
    await assertFails(getDoc(kvitto(env.elev("e4b"), "e4a")), "klasskamrat");
    await assertFails(getDoc(kvitto(env.ak5(), "e4a")), "annan årskurs");
    await assertFails(getDoc(kvitto(env.testEnv.unauthenticatedContext().firestore(), "e4a")), "utloggad");
  });
  it("ingen klient skapar kvittot – inte eleven, inte läraren, inte admin", async () => {
    await assertFails(setDoc(kvitto(env.elev("e4b"), "e4b"), { dator: { damen: 1 }, total: 500 }));
    await assertFails(setDoc(kvitto(env.elev("e4b"), "e4b"), {}));
    await assertFails(setDoc(kvitto(env.elev("e4b"), "e4a"), { dator: {} }), "någon annans");
    await assertFails(setDoc(kvitto(env.ak4(), "e4b"), { dator: {} }));
    await assertFails(setDoc(kvitto(env.admin(), "e4b"), { dator: {} }));
  });
  it("ingen klient ändrar eller raderar kvittot (t.ex. tar bort Bonden för att få 200 mynt igen)", async () => {
    await assertFails(updateDoc(kvitto(env.elev("e4a"), "e4a"), { "dator.bonden": deleteField() }));
    await assertFails(updateDoc(kvitto(env.elev("e4a"), "e4a"), { "dator.damen": 1 }));
    await assertFails(setDoc(kvitto(env.elev("e4a"), "e4a"), {}));
    await assertFails(deleteDoc(kvitto(env.elev("e4a"), "e4a")));
    await assertFails(updateDoc(kvitto(env.ak4(), "e4a"), { total: 0 }));
    await assertFails(deleteDoc(kvitto(env.admin(), "e4a")));
  });
});

describe("studentData.schack.pokaler – bara servern (#798)", () => {
  it("eleven kan inte ge sig själv pokalen", async () => {
    await assertFails(updateDoc(sd(env.elev("e4a"), "e4a"), { "schack.pokaler.damen": 1 }));
    await assertFails(updateDoc(sd(env.elev("e4a"), "e4a"), { schack: { pokaler: { damen: 1 } } }));
    await assertFails(setDoc(sd(env.elev("e4b"), "e4b"), { coins: 0, schack: { pokaler: { damen: 1 } } }), "nytt dokument");
    await assertFails(setDoc(sd(env.elev("e4a"), "e4a"), { schack: { pokaler: {} } }, { merge: true }), "tom map är också en ändring");
  });
  it("eleven kan inte ändra eller ta bort en pokal servern gett", async () => {
    await assertFails(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.pokaler.damen": 999 }));
    await assertFails(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.pokaler.damen": deleteField() }));
    await assertFails(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.pokaler": deleteField() }));
    await assertFails(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.pokaler.tornet": 1 }), "en till pokal");
  });
  it("med pokalen på plats fungerar elevens vanliga skrivningar (mynt, guiden, räknaren)", async () => {
    await assertSucceeds(updateDoc(sd(env.elev("e5a"), "e5a"), { coins: increment(-50) }), "köp i butiken");
    await assertSucceeds(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.lektioner.2": 3 }));
    await assertSucceeds(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.datorPartier": increment(1) }));
    await assertSucceeds(setDoc(sd(env.elev("e5a"), "e5a"), { xp: 5 }, { merge: true }));
  });
  it("årskurskontot kan inte skriva en pokal (inte ens med mynt i samma skrivning); admin får", async () => {
    await assertFails(updateDoc(sd(env.ak4(), "e4a"), { "schack.pokaler.damen": 1 }));
    await assertFails(updateDoc(sd(env.ak4(), "e4a"), { coins: 600, "schack.pokaler.damen": 1 }));
    await assertSucceeds(updateDoc(sd(env.admin(), "e4a"), { "schack.pokaler.damen": 1 }));
  });
});
