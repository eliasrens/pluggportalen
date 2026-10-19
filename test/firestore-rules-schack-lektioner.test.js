// ============================================================================
// Regel-tester: guiden "Lär dig schack" (#790, docs/SCHACK.md §15).
// ----------------------------------------------------------------------------
//   studentData.schack.lektioner = { "1".."12": 1–3 }: eleven skriver sina
//   egna framsteg (EN fältväg per lektion), heltal 1–3, stjärnor sänks aldrig
//   och tas aldrig bort, inga främmande nycklar – och datorPartier/aktivtParti
//   är lika skyddade som förut. Ingen annan elev och inget årskurskonto skriver.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, deleteField, increment } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";

let env;

before(async () => {
  env = await createRollerEnv("pluggportalen-rules-test-schack-lektioner");
});
after(async () => {
  if (env?.testEnv) await env.testEnv.cleanup();
});

beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    await setDoc(doc(db, "studentData", "e5a"), { coins: 0, schack: { datorPartier: 2, lektioner: { 1: 3, 2: 1 } } });
    await setDoc(doc(db, "studentData", "e6a"), { coins: 0, schack: { datorPartier: 1, aktivtParti: "p9", lektioner: { 4: 2 } } });
  });
});

const sd = (db, uid) => doc(db, "studentData", uid);

describe("studentData.schack.lektioner – guidens framsteg (#790)", () => {
  it("giltigt: en lektion i taget som fältväg, även den första och bredvid aktivtParti", async () => {
    await assertSucceeds(updateDoc(sd(env.elev("e4a"), "e4a"), { "schack.lektioner.1": 2 }), "första lektionen, inget schack-fält innan");
    await assertSucceeds(updateDoc(sd(env.elev("e4a"), "e4a"), { "schack.lektioner.12": 3 }));
    await assertSucceeds(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.lektioner.2": 3 }), "förbättring 1 → 3");
    await assertSucceeds(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.lektioner.7": 1 }), "ny lektion");
    await assertSucceeds(updateDoc(sd(env.elev("e6a"), "e6a"), { "schack.lektioner.4": 3 }), "spärren aktivtParti står kvar");
    await assertSucceeds(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.lektioner.1": 3 }), "oförändrad går");
  });
  it("giltigt: hela mappen på en gång (alla 12) och tillsammans med datorPartier + 1", async () => {
    const alla = Object.fromEntries([...Array(12)].map((_, i) => [String(i + 1), 3]));
    await assertSucceeds(updateDoc(sd(env.elev("e4a"), "e4a"), { schack: { lektioner: alla } }));
    await assertSucceeds(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.datorPartier": increment(1), "schack.lektioner.12": 1 }));
    await assertSucceeds(setDoc(sd(env.elev("e4b"), "e4b"), { coins: 100, xp: 0, schack: { lektioner: { 3: 2 } } }), "hela dokumentet med lektioner");
  });
  it("ogiltigt värde: 0, 4, decimaltal, text, null, negativt och en lektion som inte är en map", async () => {
    for (const v of [0, 4, 2.5, "3", null, -1, true]) {
      await assertFails(updateDoc(sd(env.elev("e4a"), "e4a"), { "schack.lektioner.3": v }), `värdet ${JSON.stringify(v)}`);
    }
    await assertFails(updateDoc(sd(env.elev("e4a"), "e4a"), { "schack.lektioner": [3, 3] }), "lista");
    await assertFails(updateDoc(sd(env.elev("e4a"), "e4a"), { "schack.lektioner": "alla" }), "text");
  });
  it("sänkning: stjärnor sänks aldrig och en klarad lektion kan inte tas bort", async () => {
    await assertFails(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.lektioner.1": 2 }), "3 → 2");
    await assertFails(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.lektioner.1": deleteField() }), "ta bort lektion 1");
    await assertFails(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.lektioner": {} }), "töm mappen");
    await assertFails(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.lektioner": { 2: 1 } }), "mappen utan lektion 1");
    await assertFails(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.lektioner": deleteField() }), "ta bort fältet");
    await assertFails(updateDoc(sd(env.elev("e5a"), "e5a"), { schack: { datorPartier: 2 } }), "hela schack utan lektioner");
    await assertFails(setDoc(sd(env.elev("e5a"), "e5a"), { coins: 0, schack: { datorPartier: 2 } }), "skriv över dokumentet utan lektioner");
  });
  it("främmande nyckel: bara lektion 1–12, inga andra nycklar i schack", async () => {
    for (const k of ["0", "13", "01", "a", "pussel", "constructor"]) {
      await assertFails(updateDoc(sd(env.elev("e4a"), "e4a"), { [`schack.lektioner.${k}`]: 3 }), `lektion ${k}`);
    }
    await assertFails(updateDoc(sd(env.elev("e4a"), "e4a"), { "schack.pussel": { 1: 3 } }), "pussel kommer i 3B");
    await assertFails(updateDoc(sd(env.elev("e4a"), "e4a"), { "schack.stjarnor": 36 }));
  });
  it("datorPartier och aktivtParti är lika skyddade som förut, även i samma skrivning som en lektion", async () => {
    await assertFails(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.datorPartier": increment(2), "schack.lektioner.3": 3 }));
    await assertFails(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.datorPartier": 1, "schack.lektioner.3": 3 }));
    await assertFails(updateDoc(sd(env.elev("e6a"), "e6a"), { "schack.aktivtParti": null, "schack.lektioner.4": 3 }));
    await assertFails(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.aktivtParti": "p1", "schack.lektioner.3": 3 }));
  });
  it("annan elev och årskurskontot skriver aldrig någon annans lektioner; admin får", async () => {
    await assertFails(updateDoc(sd(env.elev("e4a"), "e5a"), { "schack.lektioner.3": 3 }), "annan elev");
    await assertFails(updateDoc(sd(env.elev("e6a"), "e5a"), { "schack.lektioner.2": 3 }), "annan elev, förbättring");
    await assertFails(updateDoc(sd(env.ak4(), "e4a"), { "schack.lektioner.1": 3 }), "årskurskontot");
    await assertSucceeds(updateDoc(sd(env.admin(), "e5a"), { "schack.lektioner.1": 1 }), "admin (förbi reglerna)");
  });
});
