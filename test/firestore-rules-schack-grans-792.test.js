// ============================================================================
// Regel-tester (#792, slut-QA Etapp 3): schackOk() får aldrig bli så dyr att Firestore
// avbryter utvärderingen ("maximum of 1000 expressions to evaluate"). Regeln körs på VARJE
// skrivning till studentData när dokumentet har ett schack-fält – går den över gränsen
// nekas ALLA elevens skrivningar (mynt, stjärnor, avatar), inte bara schackens.
// Fylls studentData med många lektioner och/eller pusselframsteg ska en orelaterad
// skrivning, nästa lektion, nästa pussel och datorPartier + 1 fortfarande gå igenom.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, increment } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";

let env;

before(async () => {
  env = await createRollerEnv("pluggportalen-rules-test-schack-grans-792");
});
after(async () => {
  if (env?.testEnv) await env.testEnv.cleanup();
});

const lek = (k) => Object.fromEntries(Array.from({ length: k }, (_, i) => [String(i + 1), 3]));
const PUSSEL = { ett: { losta: 6, senast: 8 }, tva: { losta: 2, senast: 2 } };
const sd = (db, uid) => doc(db, "studentData", uid);

async function satt(lektioner, pussel) {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    await setDoc(sd(db, "e5a"), {
      coins: 10, stars: 1,
      schack: { datorPartier: 1, aktivtParti: null, lektioner: lek(lektioner), ...(pussel ? { pussel } : {}) },
    });
  });
}

describe("schackOk håller sig under Firestores gräns på 1000 uttryck (#792 F1)", () => {
  const tillstand = [
    ["11 lektioner", 11, null],
    ["12 lektioner (hela guiden)", 12, null],
    ["8 lektioner + pussel ett", 8, { ett: PUSSEL.ett }],
    ["9 lektioner + pussel ett", 9, { ett: PUSSEL.ett }],
    ["6 lektioner + pussel ett och två", 6, PUSSEL],
    ["12 lektioner + pussel ett och två", 12, PUSSEL],
  ];
  for (const [namn, k, pussel] of tillstand) {
    it(`${namn}: orelaterade skrivningar (coins, stars) och datorPartier + 1 går igenom`, async () => {
      await satt(k, pussel);
      const db = env.elev("e5a");
      await assertSucceeds(updateDoc(sd(db, "e5a"), { coins: increment(1) }), "coins + 1");
      await assertSucceeds(updateDoc(sd(db, "e5a"), { stars: increment(1) }), "stars + 1");
      await assertSucceeds(updateDoc(sd(db, "e5a"), { "schack.datorPartier": increment(1) }), "datorPartier + 1");
    });
    it(`${namn}: en förbättrad lektion och ett nytt pussel sparas`, async () => {
      await satt(k, pussel);
      const db = env.elev("e5a");
      await assertSucceeds(updateDoc(sd(db, "e5a"), { "schack.lektioner.1": 3 }), "lektion 1 oförändrad");
      await assertSucceeds(updateDoc(sd(db, "e5a"), {
        "schack.pussel.ett.losta": increment(1), "schack.pussel.ett.senast": (pussel?.ett?.senast || 0) + 1,
      }), "pussel ett + 1");
    });
  }
  it("fusket nekas fortfarande i ett fyllt tillstånd (sänkta stjärnor, främmande nyckel)", async () => {
    await satt(6, PUSSEL);
    const db = env.elev("e5a");
    await assertFails(updateDoc(sd(db, "e5a"), { "schack.lektioner.1": 1 }), "3 → 1");
    await assertFails(updateDoc(sd(db, "e5a"), { "schack.fusk": 1 }), "främmande nyckel");
    await assertFails(updateDoc(sd(db, "e5a"), { "schack.pussel.ett.senast": 3 }), "senast sänkt");
  });
});
