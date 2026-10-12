// ============================================================================
// Regel-tester: Kartmästare-pokalerna (Hitta rätt! #610, test 12).
// ----------------------------------------------------------------------------
// Pokalen ritas ur hittaRattMeta/ledare – bara Cloud Functionen skriver den.
// Eleven sparar bara PLACERINGEN (studentData.room.placements["hrpokal-…"]),
// som inte ger någon pokal i sig. Här: ingen kan göra sig själv till ledare,
// ta någon annans pokal eller behålla en tappad pokal genom skrivningar; alla
// inloggade kan läsa ledarna (kompisens hus), utloggade inte.
// Körs av `npm run test:rules` (emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";

let testEnv, unauth, elev, teacher;

before(async () => {
  ({ testEnv, unauth, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-hitta-ratt-pokal"));
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

const LEDARE = {
  packs: {
    "sverige-stader": { uids: ["omar", "clara"], titel: "Sveriges städer", typ: "point" },
    "sverige-landskap": { uids: ["alma"], titel: "Sveriges landskap", typ: "area" },
  },
};

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "hittaRattMeta", "ledare"), LEDARE);
    await setDoc(doc(db, "studentData", "omar"), { coins: 5, room: { placements: { "hrpokal-sverige-stader": { x: 50, y: 80 } } } });
    await setDoc(doc(db, "studentData", "alma"), { coins: 5, room: { placements: {} } });
  });
});

describe("Kartmästare: ledarna kan bara skrivas av servern", () => {
  it("bli ledare / lägga till sig som delad etta nekas – för elev och lärare", async () => {
    const alma = elev("alma");
    await assertFails(setDoc(doc(alma, "hittaRattMeta", "ledare"), { packs: { "sverige-stader": { uids: ["alma"] } } }, { merge: true }));
    await assertFails(updateDoc(doc(alma, "hittaRattMeta", "ledare"), { "packs.sverige-stader.uids": ["omar", "clara", "alma"] }));
    await assertFails(setDoc(doc(alma, "hittaRattMeta", "alma"), LEDARE));
    await assertFails(setDoc(doc(teacher(), "hittaRattMeta", "ledare"), { packs: { "sverige-stader": { uids: ["alma"] } } }, { merge: true }));
  });

  it("ta bort någons pokal (ledarbyte på egen hand) eller radera ledarna nekas", async () => {
    const alma = elev("alma");
    await assertFails(updateDoc(doc(alma, "hittaRattMeta", "ledare"), { "packs.sverige-stader.uids": ["clara"] }));
    await assertFails(deleteDoc(doc(alma, "hittaRattMeta", "ledare")));
    await assertFails(deleteDoc(doc(teacher(), "hittaRattMeta", "ledare")));
  });

  it("tappad ledare kan inte behålla pokalen genom att skriva tillbaka sig själv", async () => {
    const omar = elev("omar");
    await assertFails(setDoc(doc(omar, "hittaRattMeta", "ledare"), LEDARE));
    await assertFails(updateDoc(doc(omar, "hittaRattMeta", "ledare"), { "packs.sverige-landskap.uids": ["alma", "omar"] }));
  });

  it("läsning: alla inloggade (eget och kompisars hus), inte utloggade", async () => {
    await assertSucceeds(getDoc(doc(elev("alma"), "hittaRattMeta", "ledare")));
    await assertSucceeds(getDoc(doc(elev("nyelev"), "hittaRattMeta", "ledare")));
    await assertSucceeds(getDoc(doc(teacher(), "hittaRattMeta", "ledare")));
    await assertFails(getDoc(doc(unauth(), "hittaRattMeta", "ledare")));
  });
});

describe("Kartmästare: placeringen är elevens egen (befintlig studentData-regel)", () => {
  it("eleven flyttar och plockar bort sin pokal i sitt eget rum", async () => {
    const omar = elev("omar");
    await assertSucceeds(updateDoc(doc(omar, "studentData", "omar"), { "room.placements": { "hrpokal-sverige-stader": { x: 30, y: 85 } } }));
    await assertSucceeds(updateDoc(doc(omar, "studentData", "omar"), { "room.placements": {} }));
  });

  it("ingen kan flytta eller städa bort någon annans pokal", async () => {
    await assertFails(updateDoc(doc(elev("alma"), "studentData", "omar"), { "room.placements": {} }));
    await assertFails(updateDoc(doc(unauth(), "studentData", "omar"), { "room.placements": {} }));
  });
});
