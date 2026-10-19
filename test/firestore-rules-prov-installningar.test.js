// ============================================================================
// Regel-tester: Prov 2F (#759) – provets inställningar stavfel ("auto" /
// "sjalv") och färggränserna { gul, gron } (heltal, 0 < gul < grön ≤ 100) på
// provet och tillfället (kopian, och sparaGranser i Översikten).
// provInstOk/provGranserOk i firestore.rules. Gamla dokument utan fälten
// godtas (standarden auto, 60/85 gäller), och ett äldre tillfälle vars gränser
// inte längre godtas kan ändå stängas – inställningarna prövas när de ändras.
// Riggen: test/helpers/roller-env.js (ak4 har 4a, ak5 har 5a, e4a går i 4a).
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { STANDARD_INSTALLNINGAR, validateProv } from "../src/prov/prov-validera.js";
import { EXEMPEL } from "./helpers/prov-exempel.js";

let env;
const provVarde = (installningar) =>
  validateProv({ namn: "Stavning", installningar, fragor: [structuredClone(EXEMPEL.kortsvar.f)] }).value;
// Som sparaProv (provl-data.js): validerat prov + ägarfälten + tiderna.
const provDok = (installningar) => ({
  ...provVarde(installningar), createdBy: "ak4", createdByName: "Årskurs 4", skapad: serverTimestamp(), uppdaterad: serverTimestamp(),
});
// Som skapaTillfalle (prov-tillfalle-data.js).
const tillfalleDok = (installningar, over = {}) => ({
  provId: "p1", provNamn: "Stavning", classId: "4a", createdBy: "ak4", createdByName: "Årskurs 4",
  status: "forberett", fragor: [], installningar, tidsgransMin: null,
  fokus: { pa: false, doljOvrigt: true }, skapad: serverTimestamp(), ...over,
});
const OGILTIGA = [
  { gul: 0, gron: 50 }, { gul: 60, gron: 60 }, { gul: 85, gron: 60 }, { gul: 50, gron: 101 },
  { gul: 50.5, gron: 80 }, { gul: "60", gron: 85 }, { gul: 60 }, { gul: 60, gron: 85, rod: 10 },
];

before(async () => { env = await createRollerEnv("pluggportalen-rules-test-prov-installningar"); });
after(async () => { if (env) await env.testEnv.cleanup(); });
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    // Ett prov från Etapp 1: utan stavfel, med de gamla standardgränserna.
    await setDoc(doc(db, "prov", "p1"), {
      ...provVarde({}), installningar: { poang: true, nivaer: false, visaFacit: true, stavningskontroll: false, tidsgransMin: null, granser: { gul: 40, gron: 70 } },
      createdBy: "ak4", createdByName: "Årskurs 4",
    });
    await setDoc(doc(db, "provTillfallen", "t1"), tillfalleDok({ ...STANDARD_INSTALLNINGAR }, { status: "oppet" }));
    // Ett äldre tillfälle vars gränser inte längre godtas (gul 0).
    await setDoc(doc(db, "provTillfallen", "t-gammal"), tillfalleDok({ poang: true, granser: { gul: 0, gron: 5 } }, { status: "oppet" }));
  });
});

const tfRef = (db, t) => doc(db, "provTillfallen", t);

describe("prov/{id}: stavfel och färggränser (#759)", () => {
  it("läraren sparar ett prov med Rätta stavfel själv och egna gränser – och med standarden", async () => {
    await assertSucceeds(setDoc(doc(env.ak4(), "prov", "n1"), provDok({ stavfel: "sjalv", granser: { gul: 50, gron: 75 } })));
    await assertSucceeds(setDoc(doc(env.ak4(), "prov", "n2"), provDok({})));
    await assertSucceeds(setDoc(doc(env.ak4(), "prov", "n3"), provDok({ granser: { gul: 1, gron: 100 } })));
  });
  it("ett gammalt prov utan fälten går att spara om (bara namnet ändras)", async () => {
    await assertSucceeds(updateDoc(doc(env.ak4(), "prov", "p1"), { namn: "Stavning (ny)" }));
    await assertSucceeds(setDoc(doc(env.ak4(), "prov", "n4"), { namn: "Utan inställningar", fragor: [], createdBy: "ak4" }));
  });
  it("okänt stavfelsval nekas", async () => {
    await assertFails(setDoc(doc(env.ak4(), "prov", "x1"), { ...provDok({}), installningar: { ...STANDARD_INSTALLNINGAR, stavfel: "halva" } }));
    await assertFails(updateDoc(doc(env.ak4(), "prov", "p1"), { "installningar.stavfel": true }));
  });
  it("ogiltiga gränser nekas (0 < gul < grön ≤ 100, heltal, bara gul/gron)", async () => {
    for (const [i, granser] of OGILTIGA.entries()) {
      await assertFails(setDoc(doc(env.ak4(), "prov", `g${i}`), { ...provDok({}), installningar: { ...STANDARD_INSTALLNINGAR, granser } }));
    }
    await assertFails(updateDoc(doc(env.ak4(), "prov", "p1"), { "installningar.granser": { gul: 80, gron: 70 } }));
    await assertSucceeds(updateDoc(doc(env.ak4(), "prov", "p1"), { "installningar.granser": { gul: 60, gron: 85 } }));
  });
});

describe("provTillfallen/{t}: kopian och Översiktens reglage (#759)", () => {
  it("Kör i klass kopierar provets inställningar – giltiga godtas, ogiltiga nekas", async () => {
    const lar = env.ak4();
    await assertSucceeds(addDoc(collection(lar, "provTillfallen"), tillfalleDok({ ...STANDARD_INSTALLNINGAR, stavfel: "sjalv", granser: { gul: 50, gron: 75 } })));
    await assertSucceeds(addDoc(collection(lar, "provTillfallen"), tillfalleDok({ ...STANDARD_INSTALLNINGAR })));
    await assertFails(addDoc(collection(lar, "provTillfallen"), tillfalleDok({ ...STANDARD_INSTALLNINGAR, granser: { gul: 0, gron: 85 } })));
    await assertFails(addDoc(collection(lar, "provTillfallen"), tillfalleDok({ ...STANDARD_INSTALLNINGAR, stavfel: "x" })));
  });
  it("reglaget i Översikten (sparaGranser): giltiga gränser sparas, ogiltiga nekas", async () => {
    const lar = env.ak4();
    await assertSucceeds(updateDoc(tfRef(lar, "t1"), { "installningar.granser": { gul: 50, gron: 75 } }));
    await assertSucceeds(updateDoc(tfRef(lar, "t1"), { "installningar.granser": { gul: 99, gron: 100 } }));
    for (const granser of OGILTIGA) await assertFails(updateDoc(tfRef(lar, "t1"), { "installningar.granser": granser }));
  });
  it("ett äldre tillfälle med gränser som inte längre godtas kan stängas, men inte få nya ogiltiga gränser", async () => {
    const lar = env.ak4();
    await assertSucceeds(updateDoc(tfRef(lar, "t-gammal"), { status: "stangt" }));
    await assertFails(updateDoc(tfRef(lar, "t-gammal"), { "installningar.granser": { gul: 0, gron: 10 } }));
    await assertSucceeds(updateDoc(tfRef(lar, "t-gammal"), { "installningar.granser": { gul: 60, gron: 85 } }));
  });
  it("#796: läraren ändrar tillfällets gränser i alla statusar – forberett, oppet, stangt – och ingenting annat flyttas", async () => {
    const lar = env.ak4();
    await env.seed(async (db) => {
      for (const status of ["forberett", "oppet", "stangt"]) await setDoc(tfRef(db, `t-${status}`), tillfalleDok({ ...STANDARD_INSTALLNINGAR }, { status }));
    });
    for (const status of ["forberett", "oppet", "stangt"]) {
      await assertSucceeds(updateDoc(tfRef(lar, `t-${status}`), { "installningar.granser": { gul: 55, gron: 80 } }));
      await assertFails(updateDoc(tfRef(lar, `t-${status}`), { "installningar.granser": { gul: 80, gron: 55 } }));
      // Samma skrivning kan inte byta klass eller prov åt sidan.
      await assertFails(updateDoc(tfRef(lar, `t-${status}`), { "installningar.granser": { gul: 50, gron: 70 }, classId: "5a" }));
      await assertFails(updateDoc(tfRef(lar, `t-${status}`), { "installningar.granser": { gul: 50, gron: 70 }, provId: "p2" }));
      await assertFails(updateDoc(tfRef(env.ak5(), `t-${status}`), { "installningar.granser": { gul: 50, gron: 70 } }));
    }
  });
  it("eleven och en annan klass lärare ändrar aldrig inställningarna", async () => {
    await assertFails(updateDoc(tfRef(env.as("e4a"), "t1"), { "installningar.stavfel": "auto" }));
    await assertFails(updateDoc(tfRef(env.ak5(), "t1"), { "installningar.granser": { gul: 50, gron: 75 } }));
  });
});
