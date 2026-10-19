// ============================================================================
// Regel-tester (#764, spec §6.0–§6.1): "Rätta alla automatiska frågor", facit
// i efterhand och halvpoängen i rättningsdokumenten – med EXAKT de skrivningar
// som src/prov/prov-rattning-data.js gör:
//   rätta alla → sparaRattningar: EN skrivning per elev (hela dokumentet med
//     auto: true + autoRattad: true) + räkneverket, i en batch (25 elever)
//   facit i efterhand → sparaFacitTillagg: update av privat/facit facit.<fråga>
//   halvpoäng: totalPoang/maxPoang 0 … 1200 i steg om 0,5, total ≤ max
//   installningar.felKortsvarFel bara true/false
// Riggen: test/helpers/roller-env.js (ak4 har 4a, eleven e4a går i 4a).
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { FieldPath, doc, getDoc, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { delaUppProv } from "../src/prov/prov-modell.js";
import { STANDARD_INSTALLNINGAR, validateProv } from "../src/prov/prov-validera.js";
import { bedom, nyRattning, rattStatusSumma, sparDok } from "../src/prov/prov-rattning-logik.js";
import { delaIBatchar, facitMedTillagg, rattaAlla } from "../src/prov/prov-ratta-alla.js";
import { EXEMPEL } from "./helpers/prov-exempel.js";

let env;
const PROV = validateProv({ namn: "Vikingaprovet", fragor: Object.values(EXEMPEL).map((e) => structuredClone(e.f)) }).value;
const { fragor, facit, bedomningsstod } = delaUppProv(PROV);
const F = Object.fromEntries(fragor.map((f) => [f.id, f]));
const ELEVER = ["e4a", ...Array.from({ length: 24 }, (_, i) => `x${i}`)];
const SVAR = { q1: 0, q2: [0, 1], q3: false, q4: "Uppåkra", q5: ["Miklagård", "Bagdad"], q6: ["Åska", "Visdom", "Kärlek"], q7: ["Stenåldern", "Bronsåldern", "Järnåldern", "Vikingatiden"], q8: "Djur och hus." };
const TF = {
  provId: "p1", provNamn: PROV.namn, classId: "4a", createdBy: "ak4", status: "stangt", fragor,
  installningar: { ...STANDARD_INSTALLNINGAR }, tidsgransMin: null,
};

before(async () => { env = await createRollerEnv("pluggportalen-rules-test-prov-ratta-alla"); });
after(async () => { if (env) await env.testEnv.cleanup(); });
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    await setDoc(doc(db, "provTillfallen", "t1"), TF);
    await setDoc(doc(db, "provTillfallen", "t5"), { ...TF, classId: "5a", createdBy: "ak5" });
    await setDoc(doc(db, "provTillfallen", "t1", "privat", "facit"), { facit, bedomningsstod });
    await setDoc(doc(db, "provTillfallen", "t5", "privat", "facit"), { facit, bedomningsstod });
  });
});

const rattRef = (db, uid, t = "t1") => doc(db, "provTillfallen", t, "rattning", uid);
const facitRef = (db, t = "t1") => doc(db, "provTillfallen", t, "privat", "facit");
const ny = (uid) => nyRattning({ elevId: uid, classId: "4a", provNamn: PROV.namn, fragor, svar: SVAR, facit });

// sparaRattningar: hela dokumenten i batchar (delaIBatchar) + räkneverket i den första.
async function spara(db, dok, rattStatus) {
  let n = 0;
  for (const [i, del] of delaIBatchar(Object.entries(dok)).entries()) {
    const b = writeBatch(db);
    for (const [uid, d] of del) b.set(rattRef(db, uid), d);
    if (i === 0 && rattStatus) b.update(doc(db, "provTillfallen", "t1"), { rattStatus });
    await b.commit();
    n++;
  }
  return n;
}

describe("Rätta alla automatiska frågor (§6.0)", () => {
  it("25 elever: en skrivning per elev i EN batch, auto + autoRattad godtas", async () => {
    const rattningar = Object.fromEntries(ELEVER.map((u) => [u, ny(u)]));
    const res = rattaAlla({ med: ELEVER, rattningar, fragor, svarAv: () => SVAR, facit });
    assert.equal(res.andrade.length, 25);
    const dok = Object.fromEntries(res.andrade.map((u) => [u, sparDok(rattningar[u], fragor)]));
    assert.equal(dok.e4a.fragor.q1.autoRattad, true);
    assert.equal(dok.e4a.fragor.q4.ratt, false, "Uppåkra finns inte i facit än");
    let batchar;
    await assertSucceeds((async () => { batchar = await spara(env.ak4(), dok, rattStatusSumma(ELEVER, rattningar, fragor)); })());
    assert.equal(batchar, 1, "25 elever → 1 batch, 26 skrivningar");
    const snap = await getDoc(rattRef(env.ak4(), "x3"));
    assert.equal(snap.data().fragor.q2.autoRattad, true);
  });
  it("facit i efterhand: läraren lägger till ”Uppåkra” (facit.q4) – andra körningen rättar bara icke-manuella", async () => {
    const lar = env.ak4();
    const rattningar = { e4a: ny("e4a"), x1: bedom(ny("x1"), F.q4, { ratt: "delvis" }, fragor) };
    rattaAlla({ med: ["e4a", "x1"], rattningar, fragor, svarAv: () => SVAR, facit });
    await assertSucceeds(spara(lar, Object.fromEntries(Object.entries(rattningar).map(([u, r]) => [u, sparDok(r, fragor)]))));
    const fa = facitMedTillagg(F.q4, facit.q4, "Uppåkra");
    await assertSucceeds(updateDoc(facitRef(lar), new FieldPath("facit", "q4"), fa));
    const sparat = (await getDoc(facitRef(lar))).data();
    assert.deepEqual(sparat.facit.q4.godkanda, [...facit.q4.godkanda, "Uppåkra"]);
    assert.deepEqual(sparat.bedomningsstod, bedomningsstod, "resten av dokumentet orört");
    const svar2 = { ...SVAR, q4: "Uppåkra" };
    const res = rattaAlla({ med: ["e4a", "x1"], rattningar, fragor, svarAv: () => svar2, facit: sparat.facit });
    assert.deepEqual(res.andrade, ["e4a"]);
    await assertSucceeds(spara(lar, { e4a: sparDok(rattningar.e4a, fragor) }));
    assert.equal((await getDoc(rattRef(lar, "x1"))).data().fragor.q4.ratt, "delvis");
  });
  it("facit i efterhand: bara läraren med klassen; inga främmande fält; eleven aldrig", async () => {
    const fa = facitMedTillagg(F.q4, facit.q4, "Uppåkra");
    await assertFails(updateDoc(facitRef(env.as("e4a")), new FieldPath("facit", "q4"), fa));
    await assertFails(getDoc(facitRef(env.as("e4a"))));
    await assertFails(updateDoc(facitRef(env.ak4(), "t5"), new FieldPath("facit", "q4"), fa));
    await assertFails(updateDoc(facitRef(env.ak4()), { hemligt: 1 }));
    await assertFails(updateDoc(facitRef(env.ak4()), { facit: "inte en map" }));
    await assertFails(setDoc(facitRef(env.ak4()), { facit, bedomningsstod: "x" }));
    await assertSucceeds(setDoc(facitRef(env.ak4()), { facit, bedomningsstod, kriterier: { q8: ["1 p: djur"] } }));
  });
});

describe("halvpoäng i rättningsdokumenten (§6.1)", () => {
  const bas = (over = {}) => ({ ...sparDok(ny("e4a"), fragor), ...over });
  it("halvpoäng godtas; total över max, negativt, 0,25-steg och text nekas", async () => {
    const lar = env.ak4();
    const max = bas().maxPoang;
    await assertSucceeds(setDoc(rattRef(lar, "e4a"), bas({ totalPoang: 7.5 })));
    await assertSucceeds(setDoc(rattRef(lar, "e4a"), bas({ totalPoang: max })));
    await assertSucceeds(setDoc(rattRef(lar, "e4a"), bas({ totalPoang: 0 })));
    await assertFails(setDoc(rattRef(lar, "e4a"), bas({ totalPoang: max + 0.5 })));
    await assertFails(setDoc(rattRef(lar, "e4a"), bas({ totalPoang: -0.5 })));
    await assertFails(setDoc(rattRef(lar, "e4a"), bas({ totalPoang: 7.25 })));
    await assertFails(setDoc(rattRef(lar, "e4a"), bas({ totalPoang: 17.499999 })));
    await assertFails(setDoc(rattRef(lar, "e4a"), bas({ maxPoang: 12.3 })));
    await assertFails(setDoc(rattRef(lar, "e4a"), bas({ maxPoang: 1300, totalPoang: 0 })));
  });
  it("lärarens halvpoäng sparas exakt (bedom → sparDok)", async () => {
    let r = ny("e4a");
    for (const [id, p] of [["q8", 3.5], ["q7", 2.5], ["q6", 0.5]]) r = bedom(r, F[id], { poang: p }, fragor);
    const d = sparDok(r, fragor);
    await assertSucceeds(setDoc(rattRef(env.ak4(), "e4a"), d));
    const snap = (await getDoc(rattRef(env.ak4(), "e4a"))).data();
    assert.equal(snap.fragor.q8.poang, 3.5);
    assert.equal(snap.totalPoang, d.totalPoang);
  });
  it("gamla rättningar (heltal, utan auto-fält) godtas som förut", async () => {
    const gammal = { elevId: "e4a", classId: "4a", provNamn: "x", aterlamnad: false, niva: null,
      fragor: { q1: { poang: 1, ratt: true } }, totalPoang: 1, maxPoang: 18 };
    await assertSucceeds(setDoc(rattRef(env.ak4(), "e4a"), gammal));
  });
});

describe("installningar.felKortsvarFel (#764)", () => {
  it("true/false godtas på prov och tillfälle, annat nekas", async () => {
    const lar = env.ak4();
    const prov = { namn: "x", fragor: [], createdBy: "ak4" };
    await assertSucceeds(setDoc(doc(lar, "prov", "p2"), { ...prov, installningar: { ...STANDARD_INSTALLNINGAR, felKortsvarFel: false } }));
    await assertFails(setDoc(doc(lar, "prov", "p3"), { ...prov, installningar: { ...STANDARD_INSTALLNINGAR, felKortsvarFel: "ja" } }));
    await assertSucceeds(updateDoc(doc(lar, "provTillfallen", "t1"), { installningar: { ...STANDARD_INSTALLNINGAR, felKortsvarFel: true } }));
    await assertFails(updateDoc(doc(lar, "provTillfallen", "t1"), { installningar: { ...STANDARD_INSTALLNINGAR, felKortsvarFel: 1 } }));
  });
});
