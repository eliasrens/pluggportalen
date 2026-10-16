// ============================================================================
// Regel-tester: den enkla statistiken (#742, spec §7.5) med EXAKT de
// läsningar och skrivningar klienten gör:
//   provInfo i rättningen (sparDok + provInfoDok) – bara datum/granser/andel
//   färggränserna på tillfället (sparaGranser: installningar.granser)
//   statistikfliken "Prov": EN collection group-fråga på rattning med
//   where("classId", "==", klassen) (hamtaKlassensRattningar) – bara egen klass
// Riggen: test/helpers/roller-env.js (ak4 har 4a, ak5 har 5a, e4a går i 4a).
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collectionGroup, doc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { delaUppProv } from "../src/prov/prov-modell.js";
import { validateProv, STANDARD_INSTALLNINGAR } from "../src/prov/prov-validera.js";
import { godkannAlla, nyRattning, sparDok } from "../src/prov/prov-rattning-logik.js";
import { provInfoDok } from "../src/prov/prov-statistik.js";
import { EXEMPEL } from "./helpers/prov-exempel.js";

let env;
const PROV = validateProv({ namn: "Vikingaprovet", fragor: Object.values(EXEMPEL).map((e) => structuredClone(e.f)) }).value;
const { fragor, facit } = delaUppProv(PROV);
const SVAR = { q1: 0, q4: "Birka", q8: "Djur och hus." };
const TF = {
  provId: "p1", provNamn: PROV.namn, classId: "4a", createdBy: "ak4", status: "stangt", fragor,
  installningar: { ...STANDARD_INSTALLNINGAR }, tidsgransMin: null, oppnad: 1_700_000_000_000,
};

before(async () => { env = await createRollerEnv("pluggportalen-rules-test-prov-statistik"); });
after(async () => { if (env) await env.testEnv.cleanup(); });
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    await setDoc(doc(db, "provTillfallen", "t1"), TF);
    await setDoc(doc(db, "provTillfallen", "t2"), TF);
    await setDoc(doc(db, "provTillfallen", "t5"), { ...TF, classId: "5a", createdBy: "ak5" });
    await setDoc(doc(db, "provTillfallen", "t5", "rattning", "e5a"), { elevId: "e5a", classId: "5a", provNamn: "x", fragor: {}, aterlamnad: false });
  });
});

const rattRef = (db, uid, t = "t1") => doc(db, "provTillfallen", t, "rattning", uid);
const dok = (uid, classId = "4a", tf = TF) => {
  const r = godkannAlla(nyRattning({ elevId: uid, classId, provNamn: PROV.namn, fragor, svar: SVAR, facit }), fragor);
  return sparDok(r, fragor, provInfoDok(r, fragor, tf));
};

describe("statistiken (§7.5): provInfo, färggränserna, collection group-frågan", () => {
  it("läraren sparar rättningen med provInfo (datum, gränser, andel)", async () => {
    const d = dok("e4a");
    assert.deepEqual(Object.keys(d.provInfo).sort(), ["andel", "datum", "granser"]);
    await assertSucceeds(setDoc(rattRef(env.ak4(), "e4a"), d));
  });
  it("provInfo med andra fält eller som inte är en map nekas", async () => {
    const d = dok("e4a");
    await assertFails(setDoc(rattRef(env.ak4(), "e4a"), { ...d, provInfo: { ...d.provInfo, hemligt: 1 } }));
    await assertFails(setDoc(rattRef(env.ak4(), "e4a"), { ...d, provInfo: "70 %" }));
  });
  it("färggränserna sparas på tillfället (sparaGranser) – bara av läraren med klassen", async () => {
    await assertSucceeds(updateDoc(doc(env.ak4(), "provTillfallen", "t1"), { "installningar.granser": { gul: 50, gron: 80 } }));
    await assertFails(updateDoc(doc(env.ak5(), "provTillfallen", "t1"), { "installningar.granser": { gul: 50, gron: 80 } }));
    await assertFails(updateDoc(doc(env.as("e4a"), "provTillfallen", "t1"), { "installningar.granser": { gul: 50, gron: 80 } }));
  });
  it("statistikfliken: EN collection group-fråga ger klassens rättningar från alla tillfällen, med tillfällets id", async () => {
    const lar = env.ak4();
    await setDoc(rattRef(lar, "e4a", "t1"), dok("e4a"));
    await setDoc(rattRef(lar, "x1", "t1"), dok("x1"));
    await setDoc(rattRef(lar, "e4a", "t2"), dok("e4a"));
    // Samma fråga som hamtaKlassensRattningar (prov-statistik-data.js).
    const snap = await assertSucceeds(getDocs(query(collectionGroup(lar, "rattning"), where("classId", "==", "4a"))));
    assert.equal(snap.size, 3);
    assert.deepEqual(snap.docs.map((d) => d.ref.parent.parent.id).sort(), ["t1", "t1", "t2"]);
    assert.ok(snap.docs.every((d) => d.data().provInfo && "andel" in d.data().provInfo));
  });
  it("en annan klass, en elev eller en fråga utan klassfilter nekas", async () => {
    await assertFails(getDocs(query(collectionGroup(env.ak4(), "rattning"), where("classId", "==", "5a"))));
    await assertFails(getDocs(query(collectionGroup(env.as("e4a"), "rattning"), where("classId", "==", "4a"))));
    await assertFails(getDocs(collectionGroup(env.ak4(), "rattning")));
  });
});
