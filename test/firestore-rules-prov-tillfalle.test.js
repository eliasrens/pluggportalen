// ============================================================================
// Regel-tester: provtillfällets flöde (#740, spec §5 + testlistan) med EXAKT
// de skrivningar som src/prov/prov-tillfalle-data.js och prov-elev-data.js gör:
//   Kör i klass → Öppna (batch: frågor + facit) → fokuslås typ "prov" →
//   eleven startar/sparar/lämnar in (även automatiskt när tiden är slut) →
//   Stäng (status först, sedan inlämnad-markeringar) → Öppna igen → Radera.
// Riggen: test/helpers/roller-env.js (ak4 har 4a/4b, eleven e4a går i 4a).
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  addDoc, collection, deleteDoc, deleteField, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where,
  writeBatch, Timestamp,
} from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { delaUppProv } from "../src/prov/prov-modell.js";
import { validateProv, STANDARD_INSTALLNINGAR } from "../src/prov/prov-validera.js";
import { EXEMPEL } from "./helpers/prov-exempel.js";

let env;
const MIN = 60 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
const PROV = validateProv({ namn: "Vikingaprovet", fragor: Object.values(EXEMPEL).map((e) => structuredClone(e.f)) }).value;

before(async () => { env = await createRollerEnv("pluggportalen-rules-test-prov-tillfalle"); });
after(async () => { if (env) await env.testEnv.cleanup(); });
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed((db) => setDoc(doc(db, "prov", "p1"), { ...PROV, createdBy: "ak4", createdByName: "Årskurs 4" }));
});

const elev = () => env.as("e4a");
const tfRef = (db, t) => doc(db, "provTillfallen", t);
const svarRef = (db, t, uid = "e4a") => doc(db, "provTillfallen", t, "svar", uid);

// skapaTillfalle (prov-tillfalle-data.js)
const korIKlass = (db, over = {}) => addDoc(collection(db, "provTillfallen"), {
  provId: "p1", provNamn: PROV.namn, classId: "4a", createdBy: "ak4", createdByName: "Årskurs 4",
  status: "forberett", fragor: [], installningar: { ...STANDARD_INSTALLNINGAR }, tidsgransMin: 40,
  fokus: { pa: true, doljOvrigt: true }, skapad: serverTimestamp(), ...over,
});
// oppnaTillfalle, förberett → öppet (en batch)
async function oppna(db, t) {
  const { fragor, facit, bedomningsstod } = delaUppProv(PROV);
  const b = writeBatch(db);
  b.update(tfRef(db, t), { fragor, provNamn: PROV.namn, installningar: { ...STANDARD_INSTALLNINGAR }, status: "oppet", oppnad: serverTimestamp() });
  b.set(doc(db, "provTillfallen", t, "privat", "facit"), { facit, bedomningsstod });
  return b.commit();
}
// startaProv / sparaSvar / lamnaIn (prov-elev-data.js)
const starta = (db, t) => setDoc(svarRef(db, t), {
  elevId: "e4a", classId: "4a", startad: serverTimestamp(), uppdaterad: serverTimestamp(), svar: {}, inlamnad: false,
});
const spara = (db, t, svar) => updateDoc(svarRef(db, t), { svar, uppdaterad: serverTimestamp() });
const lamnaIn = (db, t, svar, nar) => updateDoc(svarRef(db, t), {
  svar, uppdaterad: serverTimestamp(), inlamnad: true, inlamnadNar: nar, inlamnadAt: serverTimestamp(),
});

describe("Kör i klass → Öppna → skriva → lämna in (§5.2, §5.5)", () => {
  it("hela flödet med lärarens och elevens riktiga skrivningar", async () => {
    const ref = await assertSucceeds(korIKlass(env.ak4()));
    const t = ref.id;
    await assertFails(getDoc(tfRef(elev(), t)), "förberett syns inte för eleven");
    await assertSucceeds(oppna(env.ak4(), t));
    // Fokusläget: låset till just det här tillfället.
    await assertSucceeds(updateDoc(doc(env.ak4(), "classes", "4a"), {
      lock: { mal: { typ: "prov", id: t, namn: PROV.namn }, till: Date.now() + 50 * MIN, doljOvrigt: true },
    }));
    // Elevens lyssnare (prov-watch.js) hittar provet – utan facit.
    const lista = await assertSucceeds(getDocs(query(collection(elev(), "provTillfallen"), where("classId", "in", ["4a"]), where("status", "==", "oppet"))));
    assert.deepEqual(lista.docs.map((d) => d.id), [t]);
    const elevFragor = JSON.stringify(lista.docs[0].data().fragor);
    for (const hemligt of ["Björkö\",\"ratt", "Miklagård", "godkanda", "Nämner djur"]) assert.ok(!elevFragor.includes(hemligt), hemligt);
    await assertFails(getDoc(doc(elev(), "provTillfallen", t, "privat", "facit")));
    // Starta, spara (hela mapen), lämna in.
    await assertSucceeds(starta(elev(), t));
    await assertSucceeds(spara(elev(), t, { q1: 0, q4: "Birka", q5: ["Miklagård", ""], q6: ["Åska", "", ""], q7: [] }));
    await assertSucceeds(lamnaIn(elev(), t, { q1: 0, q4: "Birka" }, "elev"));
    await assertFails(spara(elev(), t, { q1: 1 }), "inget mer efter inlämning");
    await assertFails(lamnaIn(elev(), t, { q1: 1 }, "elev"), "inte två gånger");
  });

  it("tidsgränsen: den automatiska inlämningen ('tid') går igenom inom marginalen – inte efter", async () => {
    const t = (await korIKlass(env.ak4(), { tidsgransMin: 5 })).id;
    await oppna(env.ak4(), t);
    await env.seed((db) => setDoc(svarRef(db, t), { elevId: "e4a", classId: "4a", startad: ts(-5.5 * MIN), uppdaterad: ts(-MIN), svar: {}, inlamnad: false }));
    await assertSucceeds(lamnaIn(elev(), t, { q4: "Birka" }, "tid"), "tiden slut för 30 s sedan – inom 2 min");
    const t2 = (await korIKlass(env.ak4(), { tidsgransMin: 5 })).id;
    await oppna(env.ak4(), t2);
    await env.seed((db) => setDoc(svarRef(db, t2), { elevId: "e4a", classId: "4a", startad: ts(-7.5 * MIN), uppdaterad: ts(-3 * MIN), svar: {}, inlamnad: false }));
    await assertFails(spara(elev(), t2, { q4: "sent" }), "efter gränsen + marginalen");
    await assertFails(lamnaIn(elev(), t2, { q4: "sent" }, "tid"));
  });
});

describe("Stäng och öppna igen (§5.4)", () => {
  it("stängt: alla som inte lämnat in markeras, eleven kan inte skriva mer, låset tas bort; öppna igen ger tillbaka", async () => {
    const t = (await korIKlass(env.ak4())).id;
    await oppna(env.ak4(), t);
    await starta(elev(), t);
    await spara(elev(), t, { q4: "Birk" });
    // stangTillfalle: status först …
    await assertSucceeds(updateDoc(tfRef(env.ak4(), t), { status: "stangt", stangd: serverTimestamp() }));
    await assertFails(spara(elev(), t, { q4: "Birka" }), "stängt = inga fler sparningar");
    await assertFails(lamnaIn(elev(), t, { q4: "Birka" }, "elev"));
    // … sedan svaren (lärarens lista), markeringen och låset bort.
    const lar = env.ak4();
    const svar = await assertSucceeds(getDocs(collection(lar, "provTillfallen", t, "svar")));
    const b = writeBatch(lar);
    svar.docs.filter((d) => !d.data().inlamnad).forEach((d) => b.update(d.ref, { inlamnad: true, inlamnadNar: "stangt", inlamnadAt: serverTimestamp() }));
    await assertSucceeds(b.commit());
    const efter = (await getDoc(svarRef(elev(), t))).data();
    assert.equal(efter.inlamnad, true);
    assert.equal(efter.inlamnadNar, "stangt");
    assert.deepEqual(efter.svar, { q4: "Birk" }, "elevens senast sparade svar gäller");
    await assertSucceeds(updateDoc(doc(env.ak4(), "classes", "4a"), { lock: deleteField() }));
    // Eleven läser fortfarande sitt stängda tillfälle (provsidan: "Provet är stängt").
    await assertSucceeds(getDoc(tfRef(elev(), t)));
    // Öppna igen: status + stängningens markering tillbaka → eleven fortsätter.
    await assertSucceeds(updateDoc(tfRef(env.ak4(), t), { status: "oppet", oppnad: serverTimestamp(), stangd: deleteField() }));
    await assertSucceeds(updateDoc(svarRef(env.ak4(), t), { inlamnad: false, inlamnadNar: deleteField(), inlamnadAt: deleteField() }));
    await assertSucceeds(spara(elev(), t, { q4: "Birka" }));
  });

  it("öppna igen hoppar över den som redan fått tillbaka provet (#743 F4)", async () => {
    const t = (await korIKlass(env.ak4())).id;
    await oppna(env.ak4(), t);
    await starta(elev(), t);
    await updateDoc(tfRef(env.ak4(), t), { status: "stangt", stangd: serverTimestamp() });
    await updateDoc(svarRef(env.ak4(), t), { inlamnad: true, inlamnadNar: "stangt", inlamnadAt: serverTimestamp() });
    const rattRef = (db) => doc(db, "provTillfallen", t, "rattning", "e4a");
    await env.seed((db) => setDoc(rattRef(db), { elevId: "e4a", classId: "4a", fragor: {}, aterlamnad: true }));
    await updateDoc(tfRef(env.ak4(), t), { status: "oppet", oppnad: serverTimestamp(), stangd: deleteField() });
    const oppnaIgen = () => updateDoc(svarRef(env.ak4(), t), { inlamnad: false, inlamnadNar: deleteField(), inlamnadAt: deleteField() });
    await assertFails(oppnaIgen(), "tillbakalämnad = slutgiltig");
    await assertFails(spara(elev(), t, { q4: "Birka" }));
    // Ångrad tillbakalämning (aterlamnad false) eller ingen rättning alls → öppna igen går.
    await env.seed((db) => updateDoc(rattRef(db), { aterlamnad: false }));
    await assertSucceeds(oppnaIgen());
    await updateDoc(svarRef(env.ak4(), t), { inlamnad: true, inlamnadNar: "stangt", inlamnadAt: serverTimestamp() });
    await env.seed((db) => deleteDoc(rattRef(db)));
    await assertSucceeds(oppnaIgen());
    await assertSucceeds(spara(elev(), t, { q4: "Birka" }));
  });

  it("en annan årskurs kan inte stänga, öppna eller låsa klassen till provet", async () => {
    const t = (await korIKlass(env.ak4())).id;
    await assertFails(oppna(env.ak5(), t));
    await oppna(env.ak4(), t);
    await assertFails(updateDoc(tfRef(env.ak5(), t), { status: "stangt", stangd: serverTimestamp() }));
    await assertFails(updateDoc(doc(env.ak5(), "classes", "4a"), {
      lock: { mal: { typ: "prov", id: t, namn: "x" }, till: Date.now() + 30 * MIN, doljOvrigt: true },
    }));
  });
});

describe("Radera (§3: klientbatch)", () => {
  it("svar, rättningar, facit och sist tillfället", async () => {
    const t = (await korIKlass(env.ak4())).id;
    await oppna(env.ak4(), t);
    await starta(elev(), t);
    await env.seed((db) => setDoc(doc(db, "provTillfallen", t, "rattning", "e4a"), { elevId: "e4a", classId: "4a", fragor: {}, aterlamnad: false }));
    const db = env.ak4();
    const [svar, ratt] = await Promise.all([
      getDocs(collection(db, "provTillfallen", t, "svar")), getDocs(collection(db, "provTillfallen", t, "rattning")),
    ]);
    const b = writeBatch(db);
    [...svar.docs, ...ratt.docs].forEach((d) => b.delete(d.ref));
    b.delete(doc(db, "provTillfallen", t, "privat", "facit"));
    await assertSucceeds(b.commit());
    await assertSucceeds(deleteDoc(tfRef(db, t)));
    await env.seed(async (adm) => {
      assert.equal((await getDocs(collection(adm, "provTillfallen", t, "svar"))).size, 0);
      assert.equal((await getDoc(tfRef(adm, t))).exists(), false);
    });
  });
});
