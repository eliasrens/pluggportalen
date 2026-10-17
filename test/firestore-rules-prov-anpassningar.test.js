// ============================================================================
// Regel-tester: Prov – anpassningar (#748, spec §14) med EXAKT de skrivningar
// som src/prov/prov-tillfalle-data.js och prov-elev-data.js gör:
//   extraTid  elevens egen tidsgräns = tidsgränsen + extraTid[uid] (+ 2 min)
//   elevIds   omprov: bara de valda eleverna startar och skriver
//   flikbyten följer med elevens sparningar – bara ett rimligt heltal
// Riggen: test/helpers/roller-env.js, plus en andra elev i 4a (e4a2).
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch, Timestamp,
} from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";

let env;
const MIN = 60 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
const FRAGOR = [{ id: "f1", typ: "kortsvar", fraga: "Vilken stad?", poang: 1 }];

before(async () => { env = await createRollerEnv("pluggportalen-rules-test-prov-anpassningar"); });
after(async () => { if (env) await env.testEnv.cleanup(); });

const tillfalleDok = (over = {}) => ({
  provId: "p1", provNamn: "Vikingaprovet", classId: "4a", createdBy: "ak4", createdByName: "Årskurs 4",
  status: "oppet", fragor: FRAGOR, installningar: { poang: true }, tidsgransMin: null, ...over,
});
const svarRef = (db, t, uid) => doc(db, "provTillfallen", t, "svar", uid);
const tfRef = (db, t) => doc(db, "provTillfallen", t);
// Ett svar som startade för `sedan` ms sedan.
const startat = (uid, sedan, over = {}) => ({
  elevId: uid, classId: "4a", startad: ts(-sedan), uppdaterad: ts(-MIN), svar: {}, inlamnad: false, ...over,
});

beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    // En andra elev i 4a.
    await setDoc(doc(db, "students", "e4a2"), { namn: "e4a2", username: "e4a2", classIds: ["4a"] });
    await updateDoc(doc(db, "classes", "4a"), { studentIds: ["e4a", "e4a2"] });
    // 5 minuters tidsgräns; e4a har 10 minuter extra (spec-exemplet +15 är längre än testet behöver).
    await setDoc(tfRef(db, "t-extra"), tillfalleDok({ tidsgransMin: 5, extraTid: { e4a: 10 } }));
    // Omprov för bara e4a.
    await setDoc(tfRef(db, "t-omprov"), tillfalleDok({ elevIds: ["e4a"], omprovAv: "t-extra" }));
  });
});

// prov-elev-data.js
const starta = (db, t, uid) => setDoc(svarRef(db, t, uid), {
  elevId: uid, classId: "4a", startad: serverTimestamp(), uppdaterad: serverTimestamp(), svar: {}, inlamnad: false,
});
const spara = (db, t, uid, svar, flik = {}) => updateDoc(svarRef(db, t, uid), { svar, uppdaterad: serverTimestamp(), ...flik });
const lamnaIn = (db, t, uid, svar, nar, flik = {}) => updateDoc(svarRef(db, t, uid), {
  svar, uppdaterad: serverTimestamp(), inlamnad: true, inlamnadNar: nar, inlamnadAt: serverTimestamp(), ...flik,
});

describe("extra tid per elev (§14)", () => {
  it("eleven med extra tid får skriva efter klassens gräns – bara hon", async () => {
    // Startade för 10 min sedan: klassens gräns (5 + 2) har passerat, e4a:s (5 + 10 + 2) inte.
    await env.seed(async (db) => {
      await setDoc(svarRef(db, "t-extra", "e4a"), startat("e4a", 10 * MIN));
      await setDoc(svarRef(db, "t-extra", "e4a2"), startat("e4a2", 10 * MIN));
    });
    await assertSucceeds(spara(env.as("e4a"), "t-extra", "e4a", { f1: "Birka" }));
    await assertFails(spara(env.as("e4a2"), "t-extra", "e4a2", { f1: "Birka" }), "utan extra tid: efter gränsen");
    await assertFails(lamnaIn(env.as("e4a2"), "t-extra", "e4a2", { f1: "Birka" }, "tid"));
    await assertSucceeds(lamnaIn(env.as("e4a"), "t-extra", "e4a", { f1: "Birka" }, "elev"));
  });

  it("även den extra tiden tar slut (+ 2 min marginal)", async () => {
    await env.seed(async (db) => {
      await setDoc(svarRef(db, "t-extra", "e4a"), startat("e4a", 16 * MIN));
      await setDoc(doc(db, "provTillfallen", "t-sen"), tillfalleDok({ tidsgransMin: 5, extraTid: { e4a: 10 } }));
      await setDoc(svarRef(db, "t-sen", "e4a"), startat("e4a", 18 * MIN));
    });
    await assertSucceeds(lamnaIn(env.as("e4a"), "t-extra", "e4a", {}, "tid"), "15 min + 1 min in i marginalen");
    await assertFails(spara(env.as("e4a"), "t-sen", "e4a", { f1: "sent" }), "18 min > 5 + 10 + 2");
    await assertFails(lamnaIn(env.as("e4a"), "t-sen", "e4a", { f1: "sent" }, "tid"));
  });

  it("ogiltig extra tid räknas som ingen (sträng, för mycket)", async () => {
    await env.seed(async (db) => {
      await setDoc(tfRef(db, "t-fel"), tillfalleDok({ tidsgransMin: 5, extraTid: { e4a: "10", e4a2: 500 } }));
      await setDoc(svarRef(db, "t-fel", "e4a"), startat("e4a", 10 * MIN));
      await setDoc(svarRef(db, "t-fel", "e4a2"), startat("e4a2", 10 * MIN));
    });
    await assertFails(spara(env.as("e4a"), "t-fel", "e4a", { f1: "x" }));
    await assertFails(spara(env.as("e4a2"), "t-fel", "e4a2", { f1: "x" }));
  });

  it("läraren ger extra tid medan provet pågår (sparaExtraTid) – och då får eleven fortsätta", async () => {
    await env.seed((db) => setDoc(svarRef(db, "t-extra", "e4a2"), startat("e4a2", 10 * MIN)));
    await assertFails(spara(env.as("e4a2"), "t-extra", "e4a2", { f1: "x" }));
    await assertSucceeds(updateDoc(tfRef(env.ak4(), "t-extra"), { extraTid: { e4a: 10, e4a2: 15 } }));
    await assertSucceeds(spara(env.as("e4a2"), "t-extra", "e4a2", { f1: "x" }));
    await assertSucceeds(updateDoc(tfRef(env.ak4(), "t-extra"), { extraTid: {} }), "tömma");
    await assertFails(updateDoc(tfRef(env.ak4(), "t-extra"), { extraTid: ["e4a"] }), "bara en map");
    await assertFails(updateDoc(tfRef(env.ak5(), "t-extra"), { extraTid: { e4a: 60 } }), "annan årskurs");
    await assertFails(updateDoc(tfRef(env.as("e4a"), "t-extra"), { extraTid: { e4a: 60 } }), "eleven själv");
  });

  it("Kör i klass med extra tid (skapaTillfalle)", async () => {
    await assertSucceeds(addDoc(collection(env.ak4(), "provTillfallen"), tillfalleDok({
      status: "forberett", fragor: [], tidsgransMin: 40, extraTid: { e4a: 15 }, skapad: serverTimestamp(),
    })));
  });
});

describe("omprov för valda elever (§14)", () => {
  it("bara eleven i elevIds kan starta och skriva", async () => {
    await assertSucceeds(starta(env.as("e4a"), "t-omprov", "e4a"));
    await assertSucceeds(spara(env.as("e4a"), "t-omprov", "e4a", { f1: "Birka" }));
    await assertFails(starta(env.as("e4a2"), "t-omprov", "e4a2"), "i klassen men inte vald");
    // Fanns det ändå ett svar (seedat) får hen inte skriva i det.
    await env.seed((db) => setDoc(svarRef(db, "t-omprov", "e4a2"), startat("e4a2", MIN)));
    await assertFails(spara(env.as("e4a2"), "t-omprov", "e4a2", { f1: "x" }));
    await assertFails(lamnaIn(env.as("e4a2"), "t-omprov", "e4a2", { f1: "x" }, "elev"));
  });

  it("vald men inte i klassen räcker inte", async () => {
    await env.seed((db) => setDoc(tfRef(db, "t-omprov-5a"), tillfalleDok({ elevIds: ["e5a"] })));
    await assertFails(setDoc(svarRef(env.as("e5a"), "t-omprov-5a", "e5a"), {
      elevId: "e5a", classId: "4a", startad: serverTimestamp(), uppdaterad: serverTimestamp(), svar: {}, inlamnad: false,
    }));
  });

  it("elevens lyssnare fungerar som förut – omprovet syns i frågan, klienten filtrerar", async () => {
    for (const uid of ["e4a", "e4a2"]) {
      const snap = await assertSucceeds(getDocs(query(collection(env.as(uid), "provTillfallen"),
        where("classId", "in", ["4a"]), where("status", "==", "oppet"))));
      assert.deepEqual(snap.docs.map((d) => d.id).sort(), ["t-extra", "t-omprov"]);
    }
    // Omprovet saknar facit – eleven läser det, men aldrig facit.
    await env.seed((db) => setDoc(doc(db, "provTillfallen", "t-omprov", "privat", "facit"), { facit: { f1: { godkanda: ["Birka"] } } }));
    await assertFails(getDoc(doc(env.as("e4a2"), "provTillfallen", "t-omprov", "privat", "facit")));
  });

  it("läraren skapar omprovet (skapaTillfalle) – elevIds en lista med 1–100 elever", async () => {
    const ny = (over) => addDoc(collection(env.ak4(), "provTillfallen"), tillfalleDok({
      status: "forberett", fragor: [], fokus: { pa: false, doljOvrigt: true }, skapad: serverTimestamp(), ...over,
    }));
    await assertSucceeds(ny({ elevIds: ["e4a", "e4a2"], omprovAv: "t-extra", extraTid: { e4a2: 10 } }));
    await assertFails(ny({ elevIds: [] }), "tom lista");
    await assertFails(ny({ elevIds: "e4a" }), "inte en lista");
    await assertFails(ny({ elevIds: Array.from({ length: 101 }, (_, i) => `e${i}`) }), "för många");
    await assertFails(addDoc(collection(env.ak5(), "provTillfallen"), tillfalleDok({ status: "forberett", elevIds: ["e4a"] })), "annan årskurs");
  });

  it("elevIds byts aldrig – ett omprov förblir ett omprov (och ett vanligt prov vanligt)", async () => {
    await assertFails(updateDoc(tfRef(env.ak4(), "t-omprov"), { elevIds: ["e4a", "e4a2"] }));
    await assertFails(updateDoc(tfRef(env.ak4(), "t-extra"), { elevIds: ["e4a"] }));
    await assertSucceeds(updateDoc(tfRef(env.ak4(), "t-omprov"), { status: "stangt", stangd: serverTimestamp() }));
  });
});

describe("flikbyten (§14, bara information)", () => {
  it("följer med sparningen och inlämningen som ett heltal 0–10000", async () => {
    await env.seed((db) => setDoc(svarRef(db, "t-omprov", "e4a"), startat("e4a", MIN)));
    const db = env.as("e4a");
    await assertSucceeds(spara(db, "t-omprov", "e4a", { f1: "B" }, { flikbyten: 2 }));
    await assertFails(spara(db, "t-omprov", "e4a", { f1: "B" }, { flikbyten: "2" }));
    await assertFails(spara(db, "t-omprov", "e4a", { f1: "B" }, { flikbyten: -1 }));
    await assertFails(spara(db, "t-omprov", "e4a", { f1: "B" }, { flikbyten: 10001 }));
    await assertSucceeds(lamnaIn(db, "t-omprov", "e4a", { f1: "Birka" }, "elev", { flikbyten: 3 }));
    const lar = await assertSucceeds(getDoc(svarRef(env.ak4(), "t-omprov", "e4a")));
    assert.equal(lar.data().flikbyten, 3);
  });

  it("stängningens markering fungerar med flikbyten i dokumentet; läraren ändrar dem inte", async () => {
    await env.seed((db) => setDoc(svarRef(db, "t-omprov", "e4a"), startat("e4a", MIN, { flikbyten: 1 })));
    await assertFails(updateDoc(svarRef(env.ak4(), "t-omprov", "e4a"), { flikbyten: 0 }), "läraren ändrar inte flikbytena");
    await updateDoc(tfRef(env.ak4(), "t-omprov"), { status: "stangt", stangd: serverTimestamp() });
    const lar = env.ak4();
    const b = writeBatch(lar);
    b.update(svarRef(lar, "t-omprov", "e4a"), { inlamnad: true, inlamnadNar: "stangt", inlamnadAt: serverTimestamp() });
    await assertSucceeds(b.commit());
  });
});
