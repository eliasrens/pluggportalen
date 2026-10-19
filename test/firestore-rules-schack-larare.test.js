// ============================================================================
// Regel-tester: lärarens Schack-sektion (#781, tester). Det sektionen läser:
//   schackKlass/{classId}   (lyssnaKlass)            – hasClass
//   schackPartier/{id}      (lyssnaParti, åskådaren)  – hasClass via partiets classId
//   studentData/{uid}       (statistiken, 1 getDoc per elev, bara på knapptryck)
//                                                      – hasStudent (admin/årskurskonto med eleven)
// Lärare utan klassen ska inte se något; en nekad elevläsning ska vara ett
// nekat anrop (UI:t visar "–"), aldrig ett tyst läckage.
// Körs mot emulatorn: firebase emulators:exec --only firestore "node --test test/firestore-rules-schack-larare.test.js"
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";

let env;

before(async () => {
  env = await createRollerEnv("pluggportalen-rules-test-schack-larare");
});
after(async () => {
  if (env?.testEnv) await env.testEnv.cleanup();
});

beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    await setDoc(doc(db, "schackKlass", "4a"), { vantar: {}, utmaningar: {}, partier: { p1: { vit: "e4a", svart: "e4a2", vitNamn: "A", svartNamn: "B", klocka: null, start: 1 } }, tabell: {}, dold: false });
    await setDoc(doc(db, "schackKlass", "5a"), { vantar: {}, utmaningar: {}, partier: {}, tabell: {}, dold: true });
    await setDoc(doc(db, "schackPartier", "p1"), { classId: "4a", vit: "e4a", svart: "e4a2", status: "pagar", drag: [] });
    await setDoc(doc(db, "schackPartier", "p5"), { classId: "5a", vit: "e5a", svart: "e5a", status: "pagar", drag: [] });
    await setDoc(doc(db, "studentData", "e4a"), { coins: 1, schack: { datorPartier: 3, aktivtParti: null } });
    await setDoc(doc(db, "studentData", "e5a"), { coins: 1, schack: { datorPartier: 9, aktivtParti: null } });
    await setDoc(doc(db, "studentData", "e4b"), { coins: 1 }); // aldrig spelat schack
  });
});

describe("lärarens läsningar", () => {
  it("klassdokumentet och partiet: årskurs 4 ser 4a men inte 5a; admin och gammal lärare ser allt; avstängd/elev/utloggad nekas", async () => {
    for (const [vem, db] of [["ak4", env.ak4()], ["admin", env.admin()], ["gammal", env.gammal()]]) {
      await assertSucceeds(getDoc(doc(db, "schackKlass", "4a")), vem);
      await assertSucceeds(getDoc(doc(db, "schackPartier", "p1")), vem);
    }
    await assertFails(getDoc(doc(env.ak4(), "schackKlass", "5a")));
    await assertFails(getDoc(doc(env.ak4(), "schackPartier", "p5")));
    await assertFails(getDoc(doc(env.ak5(), "schackKlass", "4a")));
    await assertFails(getDoc(doc(env.ak5(), "schackPartier", "p1")));
    await assertFails(getDoc(doc(env.ak4av(), "schackKlass", "4a")));
    await assertFails(getDoc(doc(env.ak4av(), "schackPartier", "p1")));
    await assertFails(getDoc(doc(env.unauth(), "schackKlass", "4a")));
    await assertFails(getDoc(doc(env.unauth(), "schackPartier", "p1")));
  });

  it("statistiken: studentData för egna klassens elever läses, andra klassers nekas (UI:t visar –)", async () => {
    await assertSucceeds(getDoc(doc(env.ak4(), "studentData", "e4a")));
    await assertSucceeds(getDoc(doc(env.ak4(), "studentData", "e4b")));
    await assertSucceeds(getDoc(doc(env.admin(), "studentData", "e5a")));
    await assertFails(getDoc(doc(env.ak4(), "studentData", "e5a")));
    await assertFails(getDoc(doc(env.ak5(), "studentData", "e4a")));
    await assertFails(getDoc(doc(env.ak4av(), "studentData", "e4a")));
    await assertFails(getDoc(doc(env.unauth(), "studentData", "e4a")));
  });

  it("saknat studentData-dokument för en elev i klassen: årskurskontot får ett tomt svar, inget fel", async () => {
    await env.seed((db) => deleteDoc(doc(db, "studentData", "e4b")));
    const snap = await assertSucceeds(getDoc(doc(env.ak4(), "studentData", "e4b")));
    if (snap.exists()) throw new Error("dokumentet borde saknas");
  });
});
