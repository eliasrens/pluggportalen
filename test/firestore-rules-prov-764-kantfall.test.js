// ============================================================================
// Regel-tester (#764) – testarens kantfall, i produktionens form
// (src/prov/prov-rattning-data.js): 451 elever i två batchar via delaIBatchar
// med räkneverket i den första, otillåtna poängvärden (NaN, Infinity, text,
// null, 1200,5), ångra tillbakalämning på en GAMMAL rättning (heltal, utan
// auto) och facit i efterhand från fel roller. Coderns regeltester:
// test/firestore-rules-prov-ratta-alla.test.js.
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { FieldPath, collection, deleteField, doc, getDocs, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { delaUppProv } from "../src/prov/prov-modell.js";
import { STANDARD_INSTALLNINGAR, validateProv } from "../src/prov/prov-validera.js";
import { nyRattning, rattStatusSumma, sparDok } from "../src/prov/prov-rattning-logik.js";
import { delaIBatchar, facitMedTillagg, rattaAlla } from "../src/prov/prov-ratta-alla.js";
import { EXEMPEL } from "./helpers/prov-exempel.js";

let env;
const PROV = validateProv({ namn: "Vikingaprovet", fragor: Object.values(EXEMPEL).map((e) => structuredClone(e.f)) }).value;
const { fragor, facit, bedomningsstod } = delaUppProv(PROV);
const F = Object.fromEntries(fragor.map((f) => [f.id, f]));
const SVAR = { q1: 0, q2: [0, 1], q3: false, q4: "Uppåkra", q5: ["Miklagård", "Bagdad"], q6: ["Åska", "Visdom", "Kärlek"], q7: ["Stenåldern", "Bronsåldern", "Järnåldern", "Vikingatiden"], q8: "Djur och hus." };
const TF = {
  provId: "p1", provNamn: PROV.namn, classId: "4a", createdBy: "ak4", status: "stangt", fragor,
  installningar: { ...STANDARD_INSTALLNINGAR }, tidsgransMin: null,
};

before(async () => { env = await createRollerEnv("pluggportalen-rules-test-prov-764-kantfall"); });
after(async () => { if (env) await env.testEnv.cleanup(); });
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    await setDoc(doc(db, "provTillfallen", "t1"), TF);
    await setDoc(doc(db, "provTillfallen", "t1", "privat", "facit"), { facit, bedomningsstod });
  });
});

const rattRef = (db, uid) => doc(db, "provTillfallen", "t1", "rattning", uid);
const facitRef = (db) => doc(db, "provTillfallen", "t1", "privat", "facit");
const ny = (uid) => nyRattning({ elevId: uid, classId: "4a", provNamn: PROV.namn, fragor, svar: SVAR, facit });

describe("Rätta alla: 451 elever (≤ 500 skrivningar per batch)", () => {
  it("två batchar (450 + räkneverket, sedan 1) godtas och alla 451 dokument finns", async () => {
    const uids = Array.from({ length: 451 }, (_, i) => `y${i}`);
    const rattningar = Object.fromEntries(uids.map((u) => [u, ny(u)]));
    const res = rattaAlla({ med: uids, rattningar, fragor, svarAv: () => SVAR, facit });
    const lista = res.andrade.map((u) => [u, sparDok(rattningar[u], fragor)]);
    const rattStatus = rattStatusSumma(uids, rattningar, fragor);
    const lar = env.ak4();
    const delar = delaIBatchar(lista);
    assert.equal(delar.length, 2);
    for (const [i, del] of delar.entries()) {
      const b = writeBatch(lar);
      for (const [uid, d] of del) b.set(rattRef(lar, uid), d);
      if (i === 0) b.update(doc(lar, "provTillfallen", "t1"), { rattStatus });
      await assertSucceeds(b.commit());
    }
    const snap = await getDocs(collection(lar, "provTillfallen", "t1", "rattning"));
    assert.equal(snap.size, 451);
  });
});

describe("otillåtna poängvärden i rättningen", () => {
  const bas = (over = {}) => ({ ...sparDok(ny("e4a"), fragor), ...over });
  for (const [namn, over] of [
    ["NaN", { totalPoang: NaN }], ["Infinity", { totalPoang: Infinity }], ["text", { totalPoang: "7" }],
    ["null", { totalPoang: null }], ["max 1200,5", { maxPoang: 1200.5, totalPoang: 0 }], ["maxPoang negativ", { maxPoang: -1, totalPoang: 0 }],
    ["total 0,1", { totalPoang: 0.1 }],
  ]) {
    it(`${namn} nekas`, async () => { await assertFails(setDoc(rattRef(env.ak4(), "e4a"), bas(over))); });
  }
  it("gränsen 1200 av 1200 godtas", async () => {
    await assertSucceeds(setDoc(rattRef(env.ak4(), "e4a"), bas({ maxPoang: 1200, totalPoang: 1200 })));
  });
  it("eleven kan inte skriva sin rättning, inte ens med autoRattad", async () => {
    await assertFails(setDoc(rattRef(env.as("e4a"), "e4a"), bas()));
  });
});

describe("gamla rättningar (heltal, utan auto-fält)", () => {
  const gammal = {
    elevId: "e4a", classId: "4a", provNamn: "x", niva: null, fragor: { q1: { poang: 1, ratt: true } },
    totalPoang: 1, maxPoang: 18, aterlamnad: true, facit: { q1: 0 },
  };
  it("ångra tillbakalämning (angraTillbaka: update med deleteField) godtas", async () => {
    await env.seed(async (db) => { await setDoc(rattRef(db, "e4a"), { ...gammal, aterlamnadAt: new Date() }); });
    const lar = env.ak4();
    const b = writeBatch(lar);
    b.update(rattRef(lar, "e4a"), { aterlamnad: false, aterlamnadAt: deleteField(), facit: deleteField(), kriterier: deleteField() });
    await assertSucceeds(b.commit());
  });
  it("rättning utan maxPoang (bara totalPoang) godtas", async () => {
    const { maxPoang: _m, facit: _f, ...utan } = gammal;
    await assertSucceeds(setDoc(rattRef(env.ak4(), "e4a"), { ...utan, aterlamnad: false }));
  });
});

describe("facit i efterhand – roller och form", () => {
  const fa = () => facitMedTillagg(F.q4, facit.q4, "Björkö");
  it("lärare i annan klass och elev nekas; klassens lärare godtas; radera facit går fortfarande", async () => {
    await assertFails(updateDoc(facitRef(env.ak5()), new FieldPath("facit", "q4"), fa()));
    await assertFails(updateDoc(facitRef(env.as("e4a")), new FieldPath("facit", "q4"), fa()));
    await assertSucceeds(updateDoc(facitRef(env.ak4()), new FieldPath("facit", "q4"), fa()));
    await assertSucceeds(updateDoc(facitRef(env.ak4()), new FieldPath("facit", "q4"), facitMedTillagg(F.q4, fa(), "Uppåkra")));
  });
  it("att ta bort facit-mappen eller byta den mot en lista nekas", async () => {
    await assertFails(updateDoc(facitRef(env.ak4()), { facit: deleteField() }));
    await assertFails(updateDoc(facitRef(env.ak4()), { facit: ["x"] }));
  });
});
