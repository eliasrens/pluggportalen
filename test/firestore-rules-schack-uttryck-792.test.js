// ============================================================================
// Regel-tester (#792 F1): schackOk() validerar bara de schack-nycklar som ÄNDRAS.
// ----------------------------------------------------------------------------
//   Firestore avbryter en regel efter 1000 utvärderade uttryck, och schackOk körs
//   på VARJE studentData-skrivning. Med FULLT tillstånd (alla 12 lektioner,
//   pussel ett + två, datorPartier, aktivtParti, bråkdrake och köpt avatar) ska
//   orelaterade skrivningar, en lektionsförbättring och ett nytt pussel gå
//   igenom – även det värsta fallet: allt ändrat i EN skrivning – och fusket
//   ska fortfarande nekas.
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteField, increment } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";

let env;

before(async () => {
  env = await createRollerEnv("pluggportalen-rules-test-schack-uttryck-792");
});
after(async () => {
  if (env?.testEnv) await env.testEnv.cleanup();
});

const ALLA = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const FULLT = {
  datorPartier: 7,
  aktivtParti: "p9",
  lektioner: Object.fromEntries(ALLA.map((k) => [k, 2])),
  pussel: { ett: { losta: 40, senast: 52 }, tva: { losta: 9, senast: 11 } },
};
const sd = (db, uid) => doc(db, "studentData", uid);
const e5a = () => sd(env.elev("e5a"), "e5a");

beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    await setDoc(sd(db, "e5a"), {
      coins: 500, stars: 3, avatarId: "fox", ownedItems: ["hw-av-mumie"],
      brakdrake: { id: "d1", level: 3, name: "Glöd", stage: 1, pos: { x: 1, y: 2 }, room: 0, stowed: false },
      schack: FULLT,
    });
  });
});

describe("schackOk med fullt tillstånd – bara ändrade nycklar valideras (#792 F1)", () => {
  it("orelaterade skrivningar går igenom: mynt, stjärnor, köpt avatar, draken", async () => {
    await assertSucceeds(updateDoc(e5a(), { coins: increment(5) }), "coins");
    await assertSucceeds(updateDoc(e5a(), { stars: increment(1) }), "stars");
    await assertSucceeds(updateDoc(e5a(), { avatarId: "hw-av-mumie" }), "köpt avatar");
    await assertSucceeds(updateDoc(e5a(), { "brakdrake.pos": { x: 4, y: 4 }, "brakdrake.room": 2 }), "draken flyttas");
    await assertSucceeds(updateDoc(e5a(), { coins: increment(1), avatarId: "fox", "brakdrake.stowed": true }), "allt utom schack på en gång");
  });
  it("hela dokumentet skrivs om (setDoc) med samma schack-fält", async () => {
    const snap = await getDoc(e5a());
    await assertSucceeds(setDoc(e5a(), { ...snap.data(), coins: 501 }));
  });
  it("schackens egna skrivningar går igenom: datorPartier + 1, lektion, pussel", async () => {
    await assertSucceeds(updateDoc(e5a(), { "schack.datorPartier": increment(1) }), "datorPartier + 1");
    await assertSucceeds(updateDoc(e5a(), { "schack.lektioner.12": 3 }), "lektion 12 förbättras");
    await assertSucceeds(updateDoc(e5a(), { "schack.lektioner.1": 2 }), "lektion 1 oförändrad");
    await assertSucceeds(updateDoc(e5a(), { "schack.pussel.ett.losta": increment(1), "schack.pussel.ett.senast": 53 }), "pussel ett");
    await assertSucceeds(updateDoc(e5a(), { "schack.pussel.tva.losta": increment(1), "schack.pussel.tva.senast": 30 }), "pussel två");
  });
  it("värsta fallet: alla 12 lektioner, båda pusslen och datorPartier ändras i EN skrivning", async () => {
    const data = { "schack.datorPartier": increment(1) };
    for (const k of ALLA) data[`schack.lektioner.${k}`] = 3;
    for (const s of ["ett", "tva"]) {
      data[`schack.pussel.${s}.losta`] = increment(1);
      data[`schack.pussel.${s}.senast`] = FULLT.pussel[s].senast + 1;
    }
    await assertSucceeds(updateDoc(e5a(), data));
  });
  it("fusket nekas fortfarande: lektioner", async () => {
    await assertFails(updateDoc(e5a(), { "schack.lektioner.7": 1 }), "2 → 1");
    await assertFails(updateDoc(e5a(), { "schack.lektioner.7": 4 }), "4 stjärnor");
    await assertFails(updateDoc(e5a(), { "schack.lektioner.7": "3" }), "text");
    await assertFails(updateDoc(e5a(), { "schack.lektioner.7": deleteField() }), "ta bort lektion");
    await assertFails(updateDoc(e5a(), { "schack.lektioner.13": 3 }), "främmande lektion");
    await assertFails(updateDoc(e5a(), { "schack.lektioner": { 1: 3 } }), "hela mappen ersätts, 2–12 försvinner");
    await assertFails(updateDoc(e5a(), { "schack.lektioner.12": 3, "schack.lektioner.3": 1 }), "en förbättring döljer en sänkning");
  });
  it("fusket nekas fortfarande: pussel, datorPartier, aktivtParti, främmande nycklar", async () => {
    await assertFails(updateDoc(e5a(), { "schack.pussel.ett.senast": 51 }), "senast sänkt");
    await assertFails(updateDoc(e5a(), { "schack.pussel.ett.losta": increment(2), "schack.pussel.ett.senast": 60 }), "losta + 2");
    await assertFails(updateDoc(e5a(), { "schack.pussel.tva": deleteField() }), "sort tas bort");
    await assertFails(updateDoc(e5a(), { "schack.pussel.tre": { losta: 1, senast: 1 } }), "främmande sort");
    await assertFails(updateDoc(e5a(), { "schack.pussel.ett.fusk": 1 }), "främmande pusselnyckel");
    await assertFails(updateDoc(e5a(), { "schack.datorPartier": increment(2) }), "datorPartier + 2");
    await assertFails(updateDoc(e5a(), { "schack.datorPartier": 3 }), "datorPartier sänkt");
    await assertFails(updateDoc(e5a(), { "schack.aktivtParti": null }), "spärren släpps");
    await assertFails(updateDoc(e5a(), { "schack.aktivtParti": deleteField() }), "spärren tas bort");
    await assertFails(updateDoc(e5a(), { "schack.fusk": 1 }), "främmande schack-nyckel");
    await assertFails(updateDoc(e5a(), { schack: deleteField() }), "hela schack-fältet bort");
    await assertFails(updateDoc(e5a(), { coins: increment(1), "schack.lektioner.5": 1 }), "orelaterad skrivning döljer en sänkning");
  });
  it("en annan elev och fel avatar nekas", async () => {
    await assertFails(updateDoc(sd(env.elev("e4a"), "e5a"), { "schack.lektioner.12": 3 }), "e4a skriver e5a:s lektion");
    await assertFails(updateDoc(sd(env.elev("e4a"), "e5a"), { coins: increment(1) }), "e4a skriver e5a:s mynt");
    await assertFails(updateDoc(e5a(), { avatarId: "hw-av-vampyr" }), "ej köpt avatar");
    await assertFails(updateDoc(e5a(), { "brakdrake.level": 9 }), "drakens nivå");
  });
});
