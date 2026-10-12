// ============================================================================
// Regel-tester: Hitta rätt! (#609) – försök, personbästa, topplistor, ledare.
// ----------------------------------------------------------------------------
// Eleven får BARA skapa starten av ett eget försök (startedAt = serverns tid,
// status "open"). Allt som rör poäng skrivs av Cloud Functionen hittaRattSubmit
// (Admin SDK). Attackerna (arkitektur §4.2): skriva högre poäng direkt, sänka
// någon annans rekord, falsk klass/namn, förfalskad starttid, färdigmarkerat
// försök. Körs av `npm run test:rules` (emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { createRulesEnv } from "./helpers/rules-env.js";

let testEnv, unauth, elev, teacher;

before(async () => {
  ({ testEnv, unauth, elev, teacher } = await createRulesEnv("pluggportalen-rules-test-hitta-ratt"));
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

const BOARD = {
  packId: "sverige-stader", typ: "point", titel: "Sveriges städer", max: 2000, leaders: ["omar"],
  entries: { omar: { n: "Omar", k: "5E", s: 1943, at: 1 }, alma: { n: "Alma", k: "5E", s: 1928, at: 1 } },
};

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "hittaRattBoards", "sverige-stader"), BOARD);
    await setDoc(doc(db, "hittaRattBest", "alma"), { packs: { "sverige-stader": { typ: "point", s: 1928, max: 2000, n: 20, attempts: 3, at: 1 } } });
    await setDoc(doc(db, "hittaRattMeta", "ledare"), { packs: { "sverige-stader": { uids: ["omar"], titel: "Sveriges städer", typ: "point" } } });
    await setDoc(doc(db, "hittaRattAttempts", "forsokAlma01"), { uid: "alma", packId: "sverige-stader", startedAt: Timestamp.now(), status: "open" });
  });
});

const start = (packId = "sverige-stader", uid = "alma") => ({ uid, packId, startedAt: serverTimestamp(), status: "open" });

describe("Hitta rätt! försök: eleven skapar bara en öppen start", () => {
  it("eleven FÅR skapa sitt eget försök med serverns tid", async () => {
    await assertSucceeds(setDoc(doc(elev("alma"), "hittaRattAttempts", "forsokAlma02"), start()));
  });

  it("förfalskad starttid, färdigt försök, extra fält (poäng) eller annans uid nekas", async () => {
    const db = elev("alma");
    await assertFails(setDoc(doc(db, "hittaRattAttempts", "forsokAlma03"), { ...start(), startedAt: Timestamp.fromMillis(Date.now() - 3600_000) }));
    await assertFails(setDoc(doc(db, "hittaRattAttempts", "forsokAlma04"), { ...start(), status: "done" }));
    await assertFails(setDoc(doc(db, "hittaRattAttempts", "forsokAlma05"), { ...start(), result: { s: 2000 } }));
    await assertFails(setDoc(doc(db, "hittaRattAttempts", "forsokAlma06"), start("sverige-stader", "omar")));
    await assertFails(setDoc(doc(db, "hittaRattAttempts", "kort"), start()));
    await assertFails(setDoc(doc(db, "hittaRattAttempts", "forsokAlma07"), start("../hack")));
    await assertFails(setDoc(doc(unauth(), "hittaRattAttempts", "forsokAnon1"), start()));
  });

  it("försöket kan inte ändras eller raderas av eleven (inte ens till done)", async () => {
    const db = elev("alma");
    await assertFails(updateDoc(doc(db, "hittaRattAttempts", "forsokAlma01"), { status: "done", result: { s: 2000 } }));
    await assertFails(updateDoc(doc(db, "hittaRattAttempts", "forsokAlma01"), { startedAt: Timestamp.fromMillis(0) }));
    await assertFails(deleteDoc(doc(db, "hittaRattAttempts", "forsokAlma01")));
  });

  it("eget försök läsbart; andras bara för lärare", async () => {
    await assertSucceeds(getDoc(doc(elev("alma"), "hittaRattAttempts", "forsokAlma01")));
    await assertFails(getDoc(doc(elev("omar"), "hittaRattAttempts", "forsokAlma01")));
    await assertSucceeds(getDoc(doc(teacher(), "hittaRattAttempts", "forsokAlma01")));
  });
});

describe("Hitta rätt! attacker mot personbästa och topplista (§4.2)", () => {
  it("skriva högre poäng direkt i sitt personbästa nekas", async () => {
    const db = elev("alma");
    await assertFails(setDoc(doc(db, "hittaRattBest", "alma"), { packs: { "sverige-stader": { typ: "point", s: 2000 } } }, { merge: true }));
    await assertFails(updateDoc(doc(db, "hittaRattBest", "alma"), { "packs.sverige-stader.s": 2000 }));
    await assertFails(setDoc(doc(elev("ny"), "hittaRattBest", "ny"), { packs: { "sverige-stader": { typ: "point", s: 2000 } } }));
  });

  it("skriva högre poäng direkt i topplistan nekas", async () => {
    await assertFails(updateDoc(doc(elev("alma"), "hittaRattBoards", "sverige-stader"), { "entries.alma.s": 2000 }));
    await assertFails(setDoc(doc(elev("alma"), "hittaRattBoards", "sverige-lan"), { entries: { alma: { n: "Alma", k: "5E", r: 21, t: 1 } } }));
  });

  it("sänka/radera någon annans rekord nekas", async () => {
    await assertFails(updateDoc(doc(elev("alma"), "hittaRattBoards", "sverige-stader"), { "entries.omar.s": 1 }));
    await assertFails(setDoc(doc(elev("alma"), "hittaRattBoards", "sverige-stader"), { entries: {} }));
    await assertFails(deleteDoc(doc(elev("alma"), "hittaRattBoards", "sverige-stader")));
    await assertFails(updateDoc(doc(elev("alma"), "hittaRattBest", "omar"), { "packs.sverige-stader.s": 0 }));
  });

  it("falsk klass/namn i topplistan nekas", async () => {
    await assertFails(updateDoc(doc(elev("alma"), "hittaRattBoards", "sverige-stader"), { "entries.alma.k": "9Z", "entries.alma.n": "Omar" }));
  });

  it("bli ledare (pokal) genom att skriva hittaRattMeta nekas – även för lärare", async () => {
    await assertFails(setDoc(doc(elev("alma"), "hittaRattMeta", "ledare"), { packs: { "sverige-stader": { uids: ["alma"] } } }, { merge: true }));
    await assertFails(setDoc(doc(teacher(), "hittaRattMeta", "ledare"), { packs: {} }));
    await assertFails(updateDoc(doc(teacher(), "hittaRattBoards", "sverige-stader"), { "entries.omar.s": 1 }));
  });

  it("läsning: topplista + ledare för alla inloggade, personbästa bara ägaren/lärare", async () => {
    const snap = await assertSucceeds(getDoc(doc(elev("ines"), "hittaRattBoards", "sverige-stader")));
    assert.equal(snap.data().entries.omar.s, 1943);
    await assertSucceeds(getDoc(doc(elev("ines"), "hittaRattMeta", "ledare")));
    await assertFails(getDoc(doc(unauth(), "hittaRattBoards", "sverige-stader")));
    await assertSucceeds(getDoc(doc(elev("alma"), "hittaRattBest", "alma")));
    await assertFails(getDoc(doc(elev("omar"), "hittaRattBest", "alma")));
    await assertSucceeds(getDoc(doc(teacher(), "hittaRattBest", "alma")));
  });
});
