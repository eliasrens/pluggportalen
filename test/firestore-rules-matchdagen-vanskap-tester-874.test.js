// ============================================================================
// Testern #874 (Matchdagen 4): attackprov på reglerna för vänskapsmatcherna, utöver
// test/firestore-rules-matchdagen-vanskap.test.js:
//   • listningar och collection group-frågor når inte motståndarens fråga eller facit
//   • en elev med Matchdagen i en ANNAN klass läser inte lobbyn eller matchen
//   • eleven kan inte ge sig själv vänskapsmatchens pengar (kassa utan match), inte
//     ta bort eller byta namn på ett inbördes möte via mergeFields, inte skriva typ "vanskap"
//   • läraren utan klassen nekas; läraren med klassen skriver ingenting
// Körs av `npm run test:rules` (emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  collection, collectionGroup, deleteField, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where,
} from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { nyKarriar, pokalerTillDok } from "../src/matchdagen/delat/md-sasong.js";
import { marknadTillDok } from "../src/matchdagen/delat/md-trupp.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

let env;
const ID = "vanskapT";
const K0 = nyKarriar({ namn: "Blixtarna IF", farg: "#e8473f", rng: skapaPrng("vanskap-tester-874").tal });
const dok = (K) => ({ ...JSON.parse(JSON.stringify(K)), marknad: marknadTillDok(K.marknad || []), pokaler: pokalerTillDok(K.pokaler || []) });
const INB = { kompis: { v: 2, o: 1, f: 0, namn: "FC Omar" } };
const KREF = (db, uid = "e4a") => doc(db, "matchdagen", uid);
const elev = (uid = "e4a") => env.as(uid, {});

before(async () => {
  env = await createRollerEnv("pluggportalen-rules-test-matchdagen-874-tester");
});
after(async () => {
  if (env) await env.testEnv.cleanup();
});
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    await setDoc(doc(db, "classes", "4a"), { studentIds: ["e4a", "kompis"], elevModuler: { e4a: ["matchdagen"], kompis: ["matchdagen"] } }, { merge: true });
    // e4b har Matchdagen – men i 4b, inte i 4a.
    await setDoc(doc(db, "classes", "4b"), { elevModuler: { e4b: ["matchdagen"] } }, { merge: true });
    await setDoc(doc(db, "mdLobby", "4a"), { utmaningar: {}, matcher: {} });
    await setDoc(doc(db, "mdVanskap", ID), { classId: "4a", a: "e4a", b: "kompis", spelare: ["e4a", "kompis"], status: "pagar" });
    for (const uid of ["e4a", "kompis"]) {
      await setDoc(doc(db, "mdVanskap", ID, "privat", uid), { classId: "4a", fas: 1, fraga: { text: `fråga ${uid}` } });
      await setDoc(doc(db, "mdVanskap", ID, "facit", uid), { classId: "4a", bank: [{ r: { facit: "21" } }] });
      await setDoc(doc(db, "mdVanskapElev", uid), { aktiv: ID, dag: "2026-11-20", antal: 0 });
    }
    await setDoc(KREF(db), { ...dok(K0), inbordes: INB, senast: new Date() });
  });
});

describe("Testern #874: listningar och collection group", () => {
  it("eleven listar inte privat/facit i matchen och når dem inte med collection group", async () => {
    const db = elev();
    await assertFails(getDocs(collection(db, "mdVanskap", ID, "privat")));
    await assertFails(getDocs(collection(db, "mdVanskap", ID, "facit")));
    await assertFails(getDocs(collectionGroup(db, "privat")));
    await assertFails(getDocs(collectionGroup(db, "facit")));
    await assertFails(getDocs(query(collectionGroup(db, "privat"), where("classId", "==", "4a"))));
  });
  it("eleven listar inte alla matcher; med sitt eget uid i spelare går det", async () => {
    await assertFails(getDocs(collection(elev(), "mdVanskap")));
    await assertFails(getDocs(collection(elev(), "mdVanskapElev")));
    await assertFails(getDocs(collection(elev(), "mdLobby")));
    await assertSucceeds(getDocs(query(collection(elev(), "mdVanskap"), where("spelare", "array-contains", "e4a"))));
    await assertFails(getDocs(query(collection(elev(), "mdVanskap"), where("spelare", "array-contains", "kompis"))));
  });
});

describe("Testern #874: läsrätt bara i rätt klass", () => {
  it("en elev med Matchdagen i en annan klass läser varken 4a:s lobby, matchen eller spärren", async () => {
    const db = elev("e4b");
    await assertFails(getDoc(doc(db, "mdLobby", "4a")));
    await assertFails(getDoc(doc(db, "mdVanskap", ID)));
    await assertFails(getDoc(doc(db, "mdVanskap", ID, "privat", "e4a")));
    await assertFails(getDoc(doc(db, "mdVanskapElev", "e4a")));
    await assertSucceeds(getDoc(doc(db, "mdLobby", "4b"))); // sin egen klass (dokumentet saknas)
  });
  it("läraren utan klassen och en utloggad nekas allt; läraren med klassen läser men skriver inget", async () => {
    const refs = (db) => [doc(db, "mdLobby", "4a"), doc(db, "mdVanskap", ID), doc(db, "mdVanskap", ID, "privat", "kompis"),
      doc(db, "mdVanskap", ID, "facit", "kompis"), doc(db, "mdVanskapElev", "e4a")]; // hasStudent kräver ett riktigt elevkonto
    for (const r of refs(env.ak5())) await assertFails(getDoc(r));
    for (const r of refs(env.testEnv.unauthenticatedContext().firestore())) await assertFails(getDoc(r));
    for (const r of refs(env.ak4())) {
      await assertSucceeds(getDoc(r));
      await assertFails(setDoc(r, { classId: "4a" }, { merge: true }));
    }
  });
});

describe("Testern #874: karriären – kassan och de inbördes mötena", () => {
  it("eleven ger sig inte vänskapsmatchens pengar själv (kassan +100/+200 utan bokförd match)", async () => {
    for (const plus of [100, 200]) {
      await assertFails(updateDoc(KREF(elev()), { kassa: K0.kassa + plus, senast: serverTimestamp() }), `+${plus}`);
      const data = { kassa: K0.kassa + plus, senast: serverTimestamp() };
      await assertFails(setDoc(KREF(elev()), data, { mergeFields: Object.keys(data) }), `mergeFields +${plus}`);
    }
  });
  it("mergeFields med ändrade inbördes nekas (ta bort, byta namn, nolla); orörda går igenom", async () => {
    const mf = (data) => setDoc(KREF(elev()), { ...data, senast: serverTimestamp() }, { mergeFields: [...Object.keys(data), "senast"] });
    await assertFails(mf({ inbordes: {} }), "tömma");
    await assertFails(mf({ inbordes: { kompis: { ...INB.kompis, namn: "<b>x</b>" } } }), "byta namn");
    await assertFails(mf({ inbordes: { kompis: { v: 0, o: 0, f: 9, namn: "FC Omar" } } }), "nolla");
    await assertFails(updateDoc(KREF(elev()), { inbordes: deleteField(), senast: serverTimestamp() }), "deleteField");
    await assertFails(updateDoc(KREF(elev()), { "inbordes.kompis": deleteField(), senast: serverTimestamp() }), "deleteField ett möte");
    await assertSucceeds(mf({ inbordes: INB }), "samma värde");
  });
  it("eleven kan inte skriva en vänskapsmatch i sina matcher (typ vanskap utan bokförd match)", async () => {
    await assertFails(setDoc(doc(elev(), "matchdagen", "e4a", "matcher", ID), {
      datum: serverTimestamp(), sasong: 1, div: 0, typ: "vanskap", mot: "FC Omar", oss: 9, dem: 0, mal: [],
    }));
  });
  it("kompisen läser inte de inbördes mötena i någon annans karriär", async () => {
    await assertFails(getDoc(KREF(elev("kompis"))));
  });
});
