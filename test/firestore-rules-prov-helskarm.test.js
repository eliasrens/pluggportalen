// ============================================================================
// Regel-tester: Prov – helskärmsläget (#810, spec §5.6) med EXAKT de
// skrivningar som src/prov/prov-elev-data.js och prov-tillfalle-data.js gör:
//   pausa         eleven: svar + pausad/pausadAt/pausOrsak/flikbyten/pausLogg i EN skrivning
//   (pausad)      alla elevens sparningar nekas – utom tidens inlämning (lamnaInPausad)
//   slappIn       läraren: BARA pausad → false + slapptInAt (+5 min i tillfällets extraTid)
//   lyssnaPausade where("pausad","==",true) – läser inget vid vanliga sparningar (mätt)
// Riggen: test/helpers/roller-env.js, plus en andra elev i 4a (e4a2).
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  addDoc, collection, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch, Timestamp,
} from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";

let env;
const MIN = 60 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
const FRAGOR = [{ id: "f1", typ: "kortsvar", fraga: "Vilken stad?", poang: 1 }];

before(async () => { env = await createRollerEnv("pluggportalen-rules-test-prov-helskarm"); });
after(async () => { if (env) await env.testEnv.cleanup(); });

const tillfalleDok = (over = {}) => ({
  provId: "p1", provNamn: "Vikingaprovet", classId: "4a", createdBy: "ak4", createdByName: "Årskurs 4",
  status: "oppet", fragor: FRAGOR, installningar: { poang: true }, tidsgransMin: null,
  helskarm: true, helskarmUndantag: [], ...over,
});
const svarRef = (db, t, uid) => doc(db, "provTillfallen", t, "svar", uid);
const tfRef = (db, t) => doc(db, "provTillfallen", t);
const startat = (uid, sedan, over = {}) => ({
  elevId: uid, classId: "4a", startad: ts(-sedan), uppdaterad: ts(-MIN), svar: {}, inlamnad: false, ...over,
});
const pausatDok = (uid, sedan, over = {}) => startat(uid, sedan, {
  pausad: true, pausadAt: ts(-MIN), pausOrsak: "flik", flikbyten: 1, pausLogg: [{ at: Date.now() - MIN, orsak: "flik" }], ...over,
});

beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    await setDoc(doc(db, "students", "e4a2"), { namn: "e4a2", username: "e4a2", classIds: ["4a"] });
    await updateDoc(doc(db, "classes", "4a"), { studentIds: ["e4a", "e4a2"] });
    await setDoc(tfRef(db, "t1"), tillfalleDok());
    await setDoc(tfRef(db, "t-tid"), tillfalleDok({ tidsgransMin: 5 }));
  });
});

// prov-elev-data.js
const starta = (db, t, uid, extra = {}) => setDoc(svarRef(db, t, uid), {
  elevId: uid, classId: "4a", startad: serverTimestamp(), uppdaterad: serverTimestamp(), svar: {}, inlamnad: false, ...extra,
});
const spara = (db, t, uid, svar, extra = {}) => updateDoc(svarRef(db, t, uid), { svar, uppdaterad: serverTimestamp(), ...extra });
const lamnaIn = (db, t, uid, svar, nar) => updateDoc(svarRef(db, t, uid), {
  svar, uppdaterad: serverTimestamp(), inlamnad: true, inlamnadNar: nar, inlamnadAt: serverTimestamp(),
});
const pausa = (db, t, uid, svar, orsak = "flik", over = {}) => updateDoc(svarRef(db, t, uid), {
  svar, uppdaterad: serverTimestamp(), pausad: true, pausadAt: serverTimestamp(), pausOrsak: orsak,
  flikbyten: 1, pausLogg: [{ at: Date.now(), orsak }], ...over,
});
const lamnaInPausad = (db, t, uid) => updateDoc(svarRef(db, t, uid), {
  uppdaterad: serverTimestamp(), inlamnad: true, inlamnadNar: "tid", inlamnadAt: serverTimestamp(),
});
// prov-tillfalle-data.js
const slappIn = (db, t, uid) => updateDoc(svarRef(db, t, uid), { pausad: false, slapptInAt: serverTimestamp() });

describe("eleven pausar (§5.6)", () => {
  it("pausen sparas med svaren i en skrivning – alla tre orsakerna", async () => {
    await env.seed(async (db) => {
      await setDoc(svarRef(db, "t1", "e4a"), startat("e4a", MIN));
      await setDoc(svarRef(db, "t1", "e4a2"), startat("e4a2", MIN));
    });
    await assertSucceeds(pausa(env.as("e4a"), "t1", "e4a", { f1: "Birka" }, "helskarm"));
    await assertSucceeds(pausa(env.as("e4a2"), "t1", "e4a2", { f1: "Birka" }, "fokus"));
  });
  it("pausen kräver serverns tid och en känd orsak", async () => {
    await env.seed((db) => setDoc(svarRef(db, "t1", "e4a"), startat("e4a", MIN)));
    await assertFails(pausa(env.as("e4a"), "t1", "e4a", {}, "flik", { pausadAt: ts(-10 * MIN) }), "påhittad tid");
    await assertFails(pausa(env.as("e4a"), "t1", "e4a", {}, "semester"), "okänd orsak");
    await assertFails(pausa(env.as("e4a"), "t1", "e4a", {}, "flik", { pausLogg: "x" }), "loggen är en lista");
  });
  it("eleven kan inte röra slapptInAt eller börja pausad / släppt", async () => {
    await assertFails(starta(env.as("e4a"), "t1", "e4a", { pausad: true }));
    await assertFails(starta(env.as("e4a"), "t1", "e4a", { slapptInAt: serverTimestamp() }));
    await assertSucceeds(starta(env.as("e4a"), "t1", "e4a", { helskarmFel: true }), "Helskärm fungerade inte");
    await assertFails(spara(env.as("e4a"), "t1", "e4a", {}, { slapptInAt: serverTimestamp() }));
  });
});

describe("pausad: reglerna nekar sparning och eleven kan inte häva pausen", () => {
  beforeEach(() => env.seed((db) => setDoc(svarRef(db, "t-tid", "e4a"), pausatDok("e4a", MIN))));

  it("sparning nekas", async () => {
    await assertFails(spara(env.as("e4a"), "t-tid", "e4a", { f1: "fusk" }));
    await assertFails(spara(env.as("e4a"), "t-tid", "e4a", {}), "inte ens utan ändrade svar");
  });
  it("eleven får inte sätta pausad: false (eller ta bort fältet, eller släppa in sig)", async () => {
    await assertFails(spara(env.as("e4a"), "t-tid", "e4a", {}, { pausad: false }));
    await assertFails(updateDoc(svarRef(env.as("e4a"), "t-tid", "e4a"), { pausad: false, slapptInAt: serverTimestamp() }));
    const { deleteField } = await import("firebase/firestore");
    await assertFails(updateDoc(svarRef(env.as("e4a"), "t-tid", "e4a"), { pausad: deleteField(), uppdaterad: serverTimestamp() }));
  });
  it("eleven får inte lämna in själv under pausen – med nya svar eller som 'elev'", async () => {
    await assertFails(lamnaIn(env.as("e4a"), "t-tid", "e4a", { f1: "fusk" }, "tid"));
    await assertFails(lamnaIn(env.as("e4a"), "t-tid", "e4a", {}, "elev"));
  });
  it("men tiden får ta slut under pausen: inlämningen med de sparade svaren", async () => {
    await assertSucceeds(lamnaInPausad(env.as("e4a"), "t-tid", "e4a"));
  });
  it("den andra eleven påverkas inte", async () => {
    await env.seed((db) => setDoc(svarRef(db, "t-tid", "e4a2"), startat("e4a2", MIN)));
    await assertSucceeds(spara(env.as("e4a2"), "t-tid", "e4a2", { f1: "Birka" }));
  });
});

describe("läraren släpper in", () => {
  beforeEach(() => env.seed(async (db) => {
    await setDoc(svarRef(db, "t-tid", "e4a"), pausatDok("e4a", MIN));
    await setDoc(svarRef(db, "t-tid", "e4a2"), pausatDok("e4a2", MIN));
  }));

  it("Släpp in: pausad → false + slapptInAt; sedan sparar eleven igen", async () => {
    await assertSucceeds(slappIn(env.ak4(), "t-tid", "e4a"));
    await assertSucceeds(spara(env.as("e4a"), "t-tid", "e4a", { f1: "Birka" }));
    // ...och kan pausas igen (andra gången).
    await assertSucceeds(pausa(env.as("e4a"), "t-tid", "e4a", { f1: "Birka" }, "helskarm", { flikbyten: 2 }));
  });
  it("läraren får BARA ändra pausad och slapptInAt – aldrig svaren", async () => {
    await assertFails(updateDoc(svarRef(env.ak4(), "t-tid", "e4a"), { pausad: false, slapptInAt: serverTimestamp(), svar: { f1: "lärarens" } }));
    await assertFails(updateDoc(svarRef(env.ak4(), "t-tid", "e4a"), { pausad: false, slapptInAt: serverTimestamp(), flikbyten: 0 }));
    await assertFails(updateDoc(svarRef(env.ak4(), "t-tid", "e4a"), { pausad: false, slapptInAt: ts(-MIN) }), "serverns tid");
    await assertFails(updateDoc(svarRef(env.ak4(), "t-tid", "e4a"), { pausad: true }), "läraren pausar inte");
    await assertFails(slappIn(env.ak5(), "t-tid", "e4a"), "annan årskurs");
    await assertFails(slappIn(env.as("e4a2"), "t-tid", "e4a"), "en klasskamrat");
  });
  it("släpp in en som inte är pausad nekas (inget att släppa)", async () => {
    await env.seed((db) => setDoc(svarRef(db, "t1", "e4a"), startat("e4a", MIN)));
    await assertFails(slappIn(env.ak4(), "t1", "e4a"));
  });
  it("+5 min förlänger tidsgränsen även i reglerna (tillfällets extraTid, #748)", async () => {
    // Startade för 8 min sedan: 5 + 2 har passerat.
    await env.seed((db) => setDoc(svarRef(db, "t-tid", "e4a"), pausatDok("e4a", 8 * MIN)));
    const db = env.ak4();
    const b = writeBatch(db);
    b.update(svarRef(db, "t-tid", "e4a"), { pausad: false, slapptInAt: serverTimestamp() });
    b.update(tfRef(db, "t-tid"), { extraTid: { e4a: 5 } });
    await assertSucceeds(b.commit());
    await assertSucceeds(spara(env.as("e4a"), "t-tid", "e4a", { f1: "Birka" }), "8 min < 5 + 5 + 2");
  });
  it("utan +5 min: släppt in efter tiden får eleven inte spara", async () => {
    await env.seed((db) => setDoc(svarRef(db, "t-tid", "e4a"), pausatDok("e4a", 8 * MIN)));
    await assertSucceeds(slappIn(env.ak4(), "t-tid", "e4a"));
    await assertFails(spara(env.as("e4a"), "t-tid", "e4a", { f1: "Birka" }));
  });
  it("Släpp in alla: en batch med alla pausade + extraTid", async () => {
    const db = env.ak4();
    const b = writeBatch(db);
    for (const uid of ["e4a", "e4a2"]) b.update(svarRef(db, "t-tid", uid), { pausad: false, slapptInAt: serverTimestamp() });
    b.update(tfRef(db, "t-tid"), { extraTid: { e4a: 5, e4a2: 5 } });
    await assertSucceeds(b.commit());
    await assertSucceeds(spara(env.as("e4a"), "t-tid", "e4a", {}));
    await assertSucceeds(spara(env.as("e4a2"), "t-tid", "e4a2", {}));
  });
  it("stänga provet går även med pausade elever", async () => {
    await assertSucceeds(updateDoc(tfRef(env.ak4(), "t-tid"), { status: "stangt", stangd: serverTimestamp() }));
    await assertSucceeds(updateDoc(svarRef(env.ak4(), "t-tid", "e4a"), { inlamnad: true, inlamnadNar: "stangt", inlamnadAt: serverTimestamp() }));
  });
});

describe("tillfällets inställning", () => {
  it("helskarm är true/false, undantag en lista – av läraren med klassen", async () => {
    await assertSucceeds(updateDoc(tfRef(env.ak4(), "t1"), { helskarm: false, helskarmUndantag: ["e4a"] }));
    await assertFails(updateDoc(tfRef(env.ak4(), "t1"), { helskarm: "nej" }));
    await assertFails(updateDoc(tfRef(env.ak4(), "t1"), { helskarmUndantag: "e4a" }));
    await assertFails(updateDoc(tfRef(env.as("e4a"), "t1"), { helskarm: false }), "eleven stänger inte av");
    await assertSucceeds(addDoc(collection(env.ak4(), "provTillfallen"), tillfalleDok({
      status: "forberett", fragor: [], helskarm: true, helskarmUndantag: ["e4a2"], skapad: serverTimestamp(),
    })));
  });
  it("utan helskärmsläge (och gamla svar) sparar eleven som förut", async () => {
    await env.seed((db) => setDoc(tfRef(db, "t-av"), tillfalleDok({ helskarm: false })));
    await assertSucceeds(starta(env.as("e4a"), "t-av", "e4a"));
    await assertSucceeds(spara(env.as("e4a"), "t-av", "e4a", { f1: "Birka" }, { flikbyten: 3 }));
    await assertSucceeds(lamnaIn(env.as("e4a"), "t-av", "e4a", { f1: "Birka" }, "elev"));
  });
});

describe("lärarens lyssnare på pausade elever", () => {
  it("läraren får lyssna (where pausad == true); eleven får inte lista klassen", async () => {
    await assertSucceeds(getDocs(query(collection(env.ak4(), "provTillfallen", "t1", "svar"), where("pausad", "==", true))));
    await assertFails(getDocs(query(collection(env.as("e4a"), "provTillfallen", "t1", "svar"), where("pausad", "==", true))));
  });

  it("MÄTNING: vanliga sparningar ger inga träffar – bara pausen och släpp in", async () => {
    await env.seed(async (db) => {
      await setDoc(svarRef(db, "t1", "e4a"), startat("e4a", MIN));
      await setDoc(svarRef(db, "t1", "e4a2"), startat("e4a2", MIN));
    });
    const handelser = [];
    const vanta = () => new Promise((r) => setTimeout(r, 400));
    const av = onSnapshot(query(collection(env.ak4(), "provTillfallen", "t1", "svar"), where("pausad", "==", true)), (s) => {
      handelser.push({ antal: s.size, andringar: s.docChanges().map((c) => `${c.type}:${c.doc.id}`) });
    });
    await vanta();
    const forsta = handelser.length;
    // 10 vanliga sparningar från två elever.
    for (let i = 0; i < 5; i++) {
      await spara(env.as("e4a"), "t1", "e4a", { f1: `svar ${i}` });
      await spara(env.as("e4a2"), "t1", "e4a2", { f1: `svar ${i}` });
    }
    await vanta();
    const efterSparningar = handelser.length;
    await pausa(env.as("e4a"), "t1", "e4a", { f1: "x" });
    await vanta();
    await slappIn(env.ak4(), "t1", "e4a");
    await vanta();
    av();
    const dokLasta = handelser.reduce((n, h) => n + h.andringar.length, 0);
    console.log(`  mätning: ${forsta} första ögonblicksbild (0 träffar), ${efterSparningar - forsta} händelser av 10 sparningar, ` +
      `${handelser.length - efterSparningar} händelser av paus + släpp in, ${dokLasta} dokumentändringar totalt`);
    assert.equal(efterSparningar - forsta, 0, "vanliga sparningar når inte lyssnaren");
    assert.deepEqual(handelser.slice(forsta).flatMap((h) => h.andringar), ["added:e4a", "removed:e4a"]);
  });
});
