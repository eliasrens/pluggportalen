// ============================================================================
// Regel-tester: Schack elev mot elev (#779, spec §6, docs/BEHORIGHETER.md SK).
// ----------------------------------------------------------------------------
//   schackKlass/{classId}: läses av klassens elever (isClassMember) och läraren
//     med klassen (hasClass); ingen klient skriver (inte ens admin)
//   schackPartier/{id}: läses av de två spelarna och läraren med klassen;
//     INTE av andra elever i samma klass; ingen klient skriver
//   studentData.schack.datorPartier: eleven ökar räknaren med högst 1 per
//     skrivning, aldrig nedåt, inga andra nycklar; läraren rör den inte
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, increment } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";

let env;
const E4A2 = "e4a2"; // andra eleven i 4a (spelar p1 mot e4a)
const E4A3 = "e4a3"; // tredje eleven i 4a (spelar inte)

const KLASS = {
  vantar: { e4a3: { namn: "E4a3", klocka: null, sedan: 1 } }, utmaningar: {},
  partier: { p1: { vit: "e4a", svart: E4A2, vitNamn: "E4a", svartNamn: "E4a2", klocka: null, start: 1 } },
  tabell: { e4a: { poang: 1020, vinster: 1, forluster: 0, remier: 0, partier: 1 } }, dold: false,
};
const PARTI = (classId, vit, svart) => ({
  classId, vit, svart, vitNamn: vit, svartNamn: svart, fen: "x", drag: [], tur: "w", status: "pagar",
  resultat: null, orsak: null, klocka: null, remiErbjudenAv: null, senastDragAt: 1, skapad: 1, uppdaterad: 1,
});

before(async () => {
  env = await createRollerEnv("pluggportalen-rules-test-schack");
});
after(async () => {
  if (env?.testEnv) await env.testEnv.cleanup();
});

beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    await setDoc(doc(db, "classes", "4a"), { name: "4A", studentIds: ["e4a", E4A2, E4A3], assignedAreas: [], enabledModules: ["schack"] });
    for (const uid of [E4A2, E4A3]) {
      await setDoc(doc(db, "students", uid), { namn: uid, username: uid, classIds: ["4a"] });
      await setDoc(doc(db, "studentData", uid), { coins: 0, xp: 0 });
    }
    await setDoc(doc(db, "schackKlass", "4a"), KLASS);
    await setDoc(doc(db, "schackKlass", "5a"), { ...KLASS, partier: {}, tabell: {} });
    await setDoc(doc(db, "schackPartier", "p1"), PARTI("4a", "e4a", E4A2));
    await setDoc(doc(db, "schackPartier", "p2"), PARTI("5a", "e5a", "e5a"));
    await setDoc(doc(db, "studentData", "e5a"), { coins: 0, schack: { datorPartier: 2 } });
  });
});

const klass = (db, id = "4a") => doc(db, "schackKlass", id);
const parti = (db, id = "p1") => doc(db, "schackPartier", id);

describe("schackKlass/{classId} – klassens elever och läraren läser, ingen skriver", () => {
  it("eleven i klassen läser; elever i andra klasser, utloggad och avstängt årskurskonto nekas", async () => {
    await assertSucceeds(getDoc(klass(env.elev("e4a"))));
    await assertSucceeds(getDoc(klass(env.elev(E4A3))));
    await assertFails(getDoc(klass(env.elev("e5a"))));
    await assertFails(getDoc(klass(env.elev("e6a"))));
    await assertFails(getDoc(klass(env.unauth())));
    await assertFails(getDoc(klass(env.elev("e4a"), "5a")));
    await assertFails(getDoc(klass(env.ak4av())));
  });
  it("läraren med klassen läser (admin, årskurs 4), årskurs 5 nekas", async () => {
    await assertSucceeds(getDoc(klass(env.admin())));
    await assertSucceeds(getDoc(klass(env.ak4())));
    await assertSucceeds(getDoc(klass(env.gammal())));
    await assertFails(getDoc(klass(env.ak5())));
    await assertSucceeds(getDoc(klass(env.ak5(), "5a")));
  });
  it("ingen klient skriver: eleven, läraren och admin nekas skapa, ändra och radera", async () => {
    for (const db of [env.elev("e4a"), env.ak4(), env.admin()]) {
      await assertFails(setDoc(klass(db, "6a"), KLASS));
      await assertFails(updateDoc(klass(db), { dold: true }));
      await assertFails(updateDoc(klass(db), { "tabell.e4a.poang": 9999 }));
      await assertFails(updateDoc(klass(db), { "vantar.e4a": { namn: "E4a", klocka: 5, sedan: 1 } }));
      await assertFails(deleteDoc(klass(db)));
    }
  });
});

describe("schackPartier/{partiId} – bara de två spelarna och läraren med klassen", () => {
  it("vit och svart läser sitt parti; en annan elev i SAMMA klass nekas, andra klasser nekas", async () => {
    await assertSucceeds(getDoc(parti(env.elev("e4a"))));
    await assertSucceeds(getDoc(parti(env.elev(E4A2))));
    await assertFails(getDoc(parti(env.elev(E4A3))));
    await assertFails(getDoc(parti(env.elev("e5a"))));
    await assertFails(getDoc(parti(env.unauth())));
    await assertFails(getDoc(parti(env.elev("e4a"), "p2")));
  });
  it("läraren med klassen läser (även med fråga på classId), årskurs 5 nekas; en elev kan inte lista", async () => {
    await assertSucceeds(getDoc(parti(env.admin())));
    await assertSucceeds(getDoc(parti(env.ak4())));
    await assertFails(getDoc(parti(env.ak5())));
    await assertSucceeds(getDocs(query(collection(env.ak4(), "schackPartier"), where("classId", "==", "4a"))));
    await assertFails(getDocs(query(collection(env.ak5(), "schackPartier"), where("classId", "==", "4a"))));
    await assertFails(getDocs(query(collection(env.elev("e4a"), "schackPartier"), where("classId", "==", "4a"))));
    await assertFails(getDocs(query(collection(env.ak4(), "schackPartier"))));
  });
  it("ingen klient skriver drag, klocka, status eller nya partier – inte heller admin", async () => {
    for (const db of [env.elev("e4a"), env.elev(E4A2), env.ak4(), env.admin()]) {
      await assertFails(updateDoc(parti(db), { fen: "y", drag: ["e4"], tur: "b" }));
      await assertFails(updateDoc(parti(db), { "klocka.vitMs": 999_999 }));
      await assertFails(updateDoc(parti(db), { status: "slut", resultat: "1-0", orsak: "matt" }));
      await assertFails(setDoc(parti(db, "p9"), PARTI("4a", "e4a", E4A3)));
      await assertFails(deleteDoc(parti(db)));
    }
  });
});

describe("studentData.schack.datorPartier – elevens egen räknare (§10)", () => {
  const sd = (db, uid) => doc(db, "studentData", uid);
  it("eleven ökar med exakt 1 (även som increment), aldrig med 2, aldrig nedåt", async () => {
    await assertSucceeds(updateDoc(sd(env.elev("e4a"), "e4a"), { "schack.datorPartier": increment(1) }));
    await assertSucceeds(updateDoc(sd(env.elev("e4a"), "e4a"), { schack: { datorPartier: 2 } }));
    await assertSucceeds(updateDoc(sd(env.elev("e4a"), "e4a"), { schack: { datorPartier: 2 } }), "oförändrad går");
    await assertFails(updateDoc(sd(env.elev("e4a"), "e4a"), { schack: { datorPartier: 4 } }));
    await assertFails(updateDoc(sd(env.elev("e4a"), "e4a"), { schack: { datorPartier: 1 } }));
    await assertFails(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.datorPartier": increment(2) }));
    await assertSucceeds(updateDoc(sd(env.elev("e5a"), "e5a"), { "schack.datorPartier": increment(1) }));
  });
  it("bara nyckeln datorPartier, heltal; fältet kan inte tas bort och inte bli något annat", async () => {
    await assertFails(updateDoc(sd(env.elev("e4a"), "e4a"), { schack: { datorPartier: 1, poang: 5000 } }));
    await assertFails(updateDoc(sd(env.elev("e4a"), "e4a"), { schack: { datorPartier: 1.5 } }));
    await assertFails(updateDoc(sd(env.elev("e4a"), "e4a"), { schack: { datorPartier: "1" } }));
    await assertFails(updateDoc(sd(env.elev("e4a"), "e4a"), { schack: "x" }));
    await assertFails(updateDoc(sd(env.elev("e5a"), "e5a"), { schack: {} }));
    await assertFails(setDoc(sd(env.elev("e5a"), "e5a"), { coins: 0 }), "fältet kan inte tas bort");
    await assertSucceeds(setDoc(sd(env.elev(E4A2), E4A2), { coins: 0, xp: 0, schack: { datorPartier: 1 } }));
    await assertSucceeds(updateDoc(sd(env.elev("e4a"), "e4a"), { coins: 5 }), "andra skrivningar påverkas inte");
  });
  it("årskurskontot skriver aldrig schack; admin får", async () => {
    await assertFails(updateDoc(sd(env.ak4(), "e4a"), { schack: { datorPartier: 1 } }));
    await assertFails(updateDoc(sd(env.elev(E4A2), "e4a"), { schack: { datorPartier: 1 } }), "inte en klasskamrat");
    await assertSucceeds(updateDoc(sd(env.admin(), "e4a"), { schack: { datorPartier: 7 } }));
  });
});
