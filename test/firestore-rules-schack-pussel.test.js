// ============================================================================
// Regel-tester: pusslen "Matt i ett/två drag" (#791, docs/SCHACK.md §16).
// ----------------------------------------------------------------------------
//   studentData.schack.pussel = { ett: { losta, senast }, tva: { losta, senast } }:
//   eleven skriver sina egna framsteg med EN skrivning per nytt löst pussel
//   (losta + 1, senast = numret). losta ökar med högst 1 och sjunker aldrig,
//   senast sjunker aldrig, losta ≤ senast ≤ 1000, inga främmande nycklar – och
//   lektioner/datorPartier/aktivtParti är lika skyddade som förut. Ingen annan
//   elev och inget årskurskonto skriver.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, deleteField, increment } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";

let env;

before(async () => {
  env = await createRollerEnv("pluggportalen-rules-test-schack-pussel");
});
after(async () => {
  if (env?.testEnv) await env.testEnv.cleanup();
});

beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    await setDoc(doc(db, "studentData", "e5a"), {
      coins: 0, schack: { datorPartier: 2, lektioner: { 1: 3 }, pussel: { ett: { losta: 4, senast: 5 } } },
    });
    await setDoc(doc(db, "studentData", "e6a"), { coins: 0, schack: { datorPartier: 1, aktivtParti: "p9" } });
  });
});

const sd = (db, uid) => doc(db, "studentData", uid);
/** Precis det klienten skriver (schack-moln.js pusselLost). */
const lost = (sort, nr) => ({ [`schack.pussel.${sort}.losta`]: increment(1), [`schack.pussel.${sort}.senast`]: nr });

describe("studentData.schack.pussel – pusslens framsteg (#791)", () => {
  it("giltigt: klientens skrivning – första pusslet, nästa, ett överhoppat, den andra sorten, bredvid aktivtParti", async () => {
    await assertSucceeds(updateDoc(sd(env.elev("e4a"), "e4a"), lost("ett", 1)), "första pusslet, inget schack-fält innan");
    await assertSucceeds(updateDoc(sd(env.elev("e4a"), "e4a"), lost("ett", 2)));
    await assertSucceeds(updateDoc(sd(env.elev("e4a"), "e4a"), lost("ett", 5)), "hoppade över 3 och 4");
    await assertSucceeds(updateDoc(sd(env.elev("e4a"), "e4a"), lost("tva", 1)), "matt i två");
    await assertSucceeds(updateDoc(sd(env.elev("e5a"), "e5a"), lost("ett", 6)), "bredvid lektioner och datorPartier");
    await assertSucceeds(updateDoc(sd(env.elev("e6a"), "e6a"), lost("tva", 1)), "spärren aktivtParti står kvar");
  });
  it("giltigt: hela mappen, tillsammans med en lektion och datorPartier + 1, och oförändrat", async () => {
    await assertSucceeds(updateDoc(sd(env.elev("e4a"), "e4a"), { schack: { pussel: { ett: { losta: 1, senast: 1 }, tva: { losta: 1, senast: 3 } } } }));
    await assertSucceeds(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.pussel.ett.senast": 5 }), "oförändrat");
    await assertSucceeds(updateDoc(sd(env.elev("e5a"), "e5a"), { ...lost("ett", 7), "schack.lektioner.2": 2, "schack.datorPartier": increment(1) }));
    await assertSucceeds(setDoc(sd(env.elev("e4b"), "e4b"), { coins: 100, xp: 0, schack: { pussel: { tva: { losta: 1, senast: 2 } } } }), "hela dokumentet");
  });
  it("räknaren: losta ökar med högst 1 och sjunker aldrig, senast sjunker aldrig, losta ≤ senast", async () => {
    await assertFails(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.pussel.ett.losta": increment(2), "schack.pussel.ett.senast": 9 }), "+2");
    await assertFails(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.pussel.ett.losta": 200, "schack.pussel.ett.senast": 200 }), "hopp till 200");
    await assertFails(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.pussel.ett.losta": 3 }), "4 → 3");
    await assertFails(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.pussel.ett.senast": 4 }), "senast 5 → 4");
    await assertFails(updateDoc(sd(env.elev("e4a"), "e4a"), { "schack.pussel.tva": { losta: 1, senast: 0 } }), "losta > senast");
    await assertSucceeds(updateDoc(sd(env.elev("e5a"), "e5a"), lost("ett", 5)), "gränsfallet losta = senast = 5 går");
    await assertFails(updateDoc(sd(env.elev("e4a"), "e4a"), { "schack.pussel.ett.losta": 1 }), "losta utan senast (0)");
    await assertFails(updateDoc(sd(env.elev("e4a"), "e4a"), lost("ett", 1001)), "senast över 1000");
  });
  it("ogiltiga värden: decimaltal, text, null, negativt, lista, främmande nycklar", async () => {
    for (const v of [1.5, "2", null, -1, true]) {
      await assertFails(updateDoc(sd(env.elev("e4a"), "e4a"), { "schack.pussel.ett.senast": v }), `senast ${JSON.stringify(v)}`);
      await assertFails(updateDoc(sd(env.elev("e4a"), "e4a"), { "schack.pussel.ett": { losta: v, senast: 3 } }), `losta ${JSON.stringify(v)}`);
    }
    await assertFails(updateDoc(sd(env.elev("e4a"), "e4a"), { "schack.pussel": [1, 2] }), "lista");
    await assertFails(updateDoc(sd(env.elev("e4a"), "e4a"), { "schack.pussel.ett": 3 }), "sorten är inte en map");
    for (const k of ["tre", "1", "constructor"]) {
      await assertFails(updateDoc(sd(env.elev("e4a"), "e4a"), lost(k, 1)), `sorten ${k}`);
    }
    await assertFails(updateDoc(sd(env.elev("e4a"), "e4a"), { ...lost("ett", 1), "schack.pussel.ett.stjarnor": 3 }), "extra nyckel i sorten");
    await assertFails(updateDoc(sd(env.elev("e4a"), "e4a"), { "schack.pusselMynt": 5 }), "främmande nyckel i schack");
  });
  it("borttagning: en sort och hela pussel-fältet kan inte tas bort", async () => {
    await assertFails(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.pussel.ett": deleteField() }));
    await assertFails(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.pussel": deleteField() }));
    await assertFails(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.pussel": {} }));
    await assertFails(setDoc(sd(env.elev("e5a"), "e5a"), { coins: 0, schack: { datorPartier: 2, lektioner: { 1: 3 } } }), "skriv över utan pussel");
  });
  it("lektioner, datorPartier och aktivtParti är lika skyddade som förut, även i samma skrivning", async () => {
    await assertFails(updateDoc(sd(env.elev("e5a"), "e5a"), { ...lost("ett", 6), "schack.datorPartier": increment(2) }));
    await assertFails(updateDoc(sd(env.elev("e5a"), "e5a"), { ...lost("ett", 6), "schack.lektioner.1": 2 }), "sänkt lektion");
    await assertFails(updateDoc(sd(env.elev("e6a"), "e6a"), { ...lost("ett", 1), "schack.aktivtParti": null }));
    await assertFails(updateDoc(sd(env.elev("e5a"), "e5a"), { ...lost("ett", 6), "schack.aktivtParti": "p1" }));
  });
  it("annan elev och årskurskontot skriver aldrig någon annans pussel; admin får", async () => {
    await assertFails(updateDoc(sd(env.elev("e4a"), "e5a"), lost("ett", 6)), "annan elev");
    await assertFails(updateDoc(sd(env.ak4(), "e4a"), lost("ett", 1)), "årskurskontot");
    await assertSucceeds(updateDoc(sd(env.admin(), "e5a"), { "schack.pussel.ett.losta": 0 }), "admin (förbi reglerna)");
  });
});
