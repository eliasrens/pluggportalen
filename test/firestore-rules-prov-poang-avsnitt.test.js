// ============================================================================
// Regel-tester: Prov 3A (#762, spec §2.2/§2.3) – halvpoäng, poängkriterier,
// visaPoangForElev/visaKriterier och avsnitt.
//   - provet sparas med halvpoäng, avsnitt och kriterier (validateProv-värdet);
//     visaPoangForElev/visaKriterier måste vara true/false
//   - tillfället får inställningarna (kopian) och avsnitt i frågorna
//   - privat/facit.kriterier läser eleven aldrig
//   - rattning.kriterier bara i en tillbakalämnad rättning – eleven kan inte
//     läsa kriterierna före tillbakalämningen, och ångra tar bort dem
//   - halvpoäng i rättningen (totalPoang 7.5) godtas
// Riggen: test/helpers/roller-env.js (ak4 har 4a, eleven e4a går i 4a).
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { delaUppProv } from "../src/prov/prov-modell.js";
import { STANDARD_INSTALLNINGAR, tillfalleInstallningar, validateProv } from "../src/prov/prov-validera.js";
import { aterlamnadDok, bedom, godkannAlla, nyRattning, sparDok } from "../src/prov/prov-rattning-logik.js";

let env;
const PROV = validateProv({
  namn: "Vikingaprovet",
  installningar: { visaPoangForElev: false, visaKriterier: true },
  fragor: [
    { id: "a1", typ: "avsnitt", titel: "Del 1 – Begrepp", instruktion: "Svara kort." },
    { id: "q1", typ: "flerval", fraga: "Var låg Birka?", alternativ: ["Björkö", "Gotland"], ratt: 0, poang: 1.5 },
    { id: "a2", typ: "avsnitt", titel: "Del 2 – Skriv och förklara" },
    { id: "q2", typ: "fritext", fraga: "Varför reste vikingarna?", poang: 6, kriterier: ["1 p: nämner en orsak", "+1 p: förklarar varför"] },
  ],
}).value;
const { fragor, facit, bedomningsstod, kriterier } = delaUppProv(PROV);
const q2 = fragor.find((f) => f.id === "q2");
const SVAR = { q1: 0, q2: "För att handla." };

before(async () => { env = await createRollerEnv("pluggportalen-rules-test-prov-poang-avsnitt"); });
after(async () => { if (env) await env.testEnv.cleanup(); });
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    await setDoc(doc(db, "provTillfallen", "t1"), {
      provId: "p1", provNamn: PROV.namn, classId: "4a", createdBy: "ak4", status: "stangt", fragor,
      installningar: tillfalleInstallningar(PROV.installningar), tidsgransMin: null,
    });
    await setDoc(doc(db, "provTillfallen", "t1", "privat", "facit"), { facit, bedomningsstod, kriterier });
    await setDoc(doc(db, "provTillfallen", "t1", "svar", "e4a"), { elevId: "e4a", classId: "4a", svar: SVAR, inlamnad: true, inlamnadNar: "elev" });
  });
});

const elev = () => env.as("e4a");
const rattRef = (db) => doc(db, "provTillfallen", "t1", "rattning", "e4a");
const provDok = (over = {}) => ({ ...PROV, createdBy: "ak4", createdByName: "Årskurs 4", skapad: serverTimestamp(), uppdaterad: serverTimestamp(), ...over });
// Rättad: q1 rätt (1,5 p) + q2 4,5 av 6 → 6 av 7,5.
const rattad = () => bedom(godkannAlla(nyRattning({ elevId: "e4a", classId: "4a", provNamn: PROV.namn, fragor, svar: SVAR, facit }), fragor), q2, { poang: 4.5 }, fragor);

describe("prov/{id}: halvpoäng, avsnitt, kriterier och de nya valen (#762)", () => {
  it("validateProv-värdet med halvpoäng, avsnitt och kriterier sparas", async () => {
    assert.equal(PROV.fragor[1].poang, 1.5);
    assert.deepEqual(PROV.fragor[3].kriterier, ["1 p: nämner en orsak", "+1 p: förklarar varför"]);
    await assertSucceeds(setDoc(doc(env.ak4(), "prov", "n1"), provDok()));
  });
  it("visaPoangForElev och visaKriterier måste vara true/false", async () => {
    await assertSucceeds(setDoc(doc(env.ak4(), "prov", "n2"), provDok({ installningar: { ...STANDARD_INSTALLNINGAR } })));
    await assertFails(setDoc(doc(env.ak4(), "prov", "x1"), provDok({ installningar: { ...STANDARD_INSTALLNINGAR, visaPoangForElev: "ja" } })));
    await assertFails(setDoc(doc(env.ak4(), "prov", "x2"), provDok({ installningar: { ...STANDARD_INSTALLNINGAR, visaKriterier: 1 } })));
  });
  it("ett gammalt prov utan de nya fälten går som förut", async () => {
    await assertSucceeds(setDoc(doc(env.ak4(), "prov", "g1"), provDok({ installningar: { poang: true, nivaer: false, visaFacit: true, stavningskontroll: false, tidsgransMin: null } })));
  });
});

describe("provTillfallen/{t}: kopian av inställningarna (#762)", () => {
  it("Kör i klass med de nya valen godtas, ett ogiltigt val nekas", async () => {
    const tf = {
      provId: "p1", provNamn: PROV.namn, classId: "4a", createdBy: "ak4", status: "forberett", fragor: [],
      installningar: tillfalleInstallningar(PROV.installningar), tidsgransMin: null, skapad: serverTimestamp(),
    };
    await assertSucceeds(setDoc(doc(env.ak4(), "provTillfallen", "n1"), tf));
    await assertFails(setDoc(doc(env.ak4(), "provTillfallen", "n2"), { ...tf, installningar: { ...tf.installningar, visaPoangForElev: null } }));
  });
  it("eleven läser tillfället (med avsnitten) men aldrig privat/facit med kriterierna", async () => {
    const snap = await assertSucceeds(getDoc(doc(elev(), "provTillfallen", "t1")));
    assert.equal(snap.data().fragor[0].typ, "avsnitt");
    assert.ok(!JSON.stringify(snap.data()).includes("nämner en orsak"), "kriterierna ligger inte på tillfället");
    await assertFails(getDoc(doc(elev(), "provTillfallen", "t1", "privat", "facit")));
    await assertSucceeds(getDoc(doc(env.ak4(), "provTillfallen", "t1", "privat", "facit")));
  });
});

describe("rattning/{uid}: kriterierna bara efter tillbakalämningen (#762)", () => {
  it("halvpoäng sparas; kriterier i en ej tillbakalämnad rättning nekas", async () => {
    const r = sparDok(rattad(), fragor);
    assert.equal(r.totalPoang, 6);
    assert.equal(r.maxPoang, 7.5);
    await assertSucceeds(setDoc(rattRef(env.ak4()), r));
    await assertFails(setDoc(rattRef(env.ak4()), { ...r, kriterier }), "kriterier före tillbakalämningen");
    await assertFails(getDoc(rattRef(elev())), "eleven läser inte rättningen före tillbakalämningen");
  });
  it("tillbakalämnad med kriterierna → eleven läser dem; ångra tar bort dem", async () => {
    const lar = env.ak4();
    await assertSucceeds(setDoc(rattRef(lar), sparDok(rattad(), fragor)));
    const dok = aterlamnadDok(sparDok(rattad(), fragor), { visaFacit: false, facit, kriterier });
    await assertSucceeds(setDoc(rattRef(lar), { ...dok, aterlamnadAt: serverTimestamp() }));
    const snap = await assertSucceeds(getDoc(rattRef(elev())));
    assert.deepEqual(snap.data().kriterier, kriterier);
    assert.equal(snap.data().totalPoang, 6);
    // Ångra utan att ta bort kriterierna nekas – med deleteField godtas det.
    await assertFails(updateDoc(rattRef(lar), { aterlamnad: false, aterlamnadAt: deleteField() }));
    await assertSucceeds(updateDoc(rattRef(lar), { aterlamnad: false, aterlamnadAt: deleteField(), facit: deleteField(), kriterier: deleteField() }));
    await assertFails(getDoc(rattRef(elev())));
  });
  it("kriterier måste vara en map", async () => {
    const dok = aterlamnadDok(sparDok(rattad(), fragor), { visaFacit: false, facit });
    await assertFails(setDoc(rattRef(env.ak4()), { ...dok, kriterier: ["1 p"], aterlamnadAt: serverTimestamp() }));
  });
});
