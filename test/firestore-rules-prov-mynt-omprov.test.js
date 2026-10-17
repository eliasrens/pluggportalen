// ============================================================================
// Regel-/emulatortester: Pluggmynt och OMPROV (#748 + #746, spec §11 och §14)
// med appens egen utbetalning (src/prov/prov-mynt-pay.js betalaProvMynt):
//   • ett omprov (omprovAv = ursprunget) delar ursprungets kvitto
//     studentData/{elev}/provMynt/{ursprung} och betalar bara det som
//     överstiger vad provet redan gett – ett sämre omprov betalar 0
//   • taket 200 gäller provet som helhet (ursprung + omprov)
//   • ett omprov får aldrig ett eget kvitto, och `senast` kan inte förfalskas
//   • omprovAv: samma prov och klass, självt inget omprov, byts aldrig
// Riggen: test/helpers/roller-env.js (ak4 har 4a, eleven e4a går i 4a, 100 mynt).
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  addDoc, collection, doc, getDoc, runTransaction, serverTimestamp, setDoc, updateDoc, writeBatch,
} from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { delaUppProv } from "../src/prov/prov-modell.js";
import { validateProv, STANDARD_INSTALLNINGAR } from "../src/prov/prov-validera.js";
import { aterlamnadDok, bedom, godkannAlla, nyRattning, sparDok } from "../src/prov/prov-rattning-logik.js";
import { betalaProvMynt } from "../src/prov/prov-mynt-pay.js";
import { EXEMPEL } from "./helpers/prov-exempel.js";

let env;
const sdk = { doc, getDoc, runTransaction, serverTimestamp };
const PROV = validateProv({ namn: "Vikingaprovet", fragor: Object.values(EXEMPEL).map((e) => structuredClone(e.f)) }).value;
const { fragor, facit } = delaUppProv(PROV);
const q8 = fragor.find((f) => f.id === "q8");
const SVAR = { q1: 0, q4: "Birka", q8: "Djur och hus." };
const PER_POANG = { typ: "poang", antal: 2 };
const tfDok = (mynt, over = {}) => ({
  provId: "p1", provNamn: PROV.namn, classId: "4a", createdBy: "ak4", status: "stangt", fragor,
  installningar: { ...STANDARD_INSTALLNINGAR, mynt }, tidsgransMin: null, ...over,
});
const svarDok = { elevId: "e4a", classId: "4a", svar: SVAR, inlamnad: true, inlamnadNar: "elev" };

before(async () => { env = await createRollerEnv("pluggportalen-rules-test-prov-mynt-omprov"); });
after(async () => { if (env) await env.testEnv.cleanup(); });
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    // t1 = ursprunget, t2 = omprovet för e4a (samma prov, samma klass).
    await setDoc(doc(db, "provTillfallen", "t1"), tfDok(PER_POANG));
    await setDoc(doc(db, "provTillfallen", "t2"), tfDok(PER_POANG, { elevIds: ["e4a"], omprovAv: "t1" }));
    for (const t of ["t1", "t2"]) await setDoc(doc(db, "provTillfallen", t, "svar", "e4a"), svarDok);
  });
});

const rattRef = (db, t) => doc(db, "provTillfallen", t, "rattning", "e4a");
const kvittoRef = (db, k) => doc(db, "studentData", "e4a", "provMynt", k);
const ny = () => nyRattning({ elevId: "e4a", classId: "4a", provNamn: PROV.namn, fragor, svar: SVAR, facit });
/** Färdigrättad: förslagen godkända och fritexten (4 p) satt till `q8p` poäng. */
const fardig = (q8p = 3) => bedom(godkannAlla(ny(), fragor), q8, { poang: q8p }, fragor);
const alltRatt = () => fragor.filter((f) => f.poang).reduce((r, f) => bedom(r, f, { ratt: true }, fragor), ny());
const belopp = (r, perPoang = 2) => Math.min(200, Math.floor(perPoang * sparDok(r, fragor).totalPoang));
const coins = async () => (await getDoc(doc(env.ak4(), "studentData", "e4a"))).data().coins;
const tillfalle = async (db, t) => ({ id: t, ...(await getDoc(doc(db, "provTillfallen", t))).data() });

function lamna(db, t, r) {
  const b = writeBatch(db);
  b.set(rattRef(db, t), { ...aterlamnadDok(sparDok(r, fragor), { visaFacit: true, facit }), aterlamnadAt: serverTimestamp() });
  return b.commit();
}
async function lamnaOchBetala(db, t, r) {
  await lamna(db, t, r);
  return betalaProvMynt(sdk, db, { t, tf: await tillfalle(db, t), elever: ["e4a"], by: "ak4" });
}

describe("omprovet delar ursprungets kvitto (§11 + §14)", () => {
  it("ursprunget betalar, omprovet med bättre resultat betalar bara skillnaden", async () => {
    const lar = env.ak4();
    const [forsta] = await lamnaOchBetala(lar, "t1", fardig(1));
    assert.equal(forsta.status, "betald");
    const [andra] = await lamnaOchBetala(lar, "t2", alltRatt());
    assert.deepEqual(andra, { uid: "e4a", status: "betald", total: belopp(alltRatt()) });
    assert.ok(andra.total > forsta.total);
    assert.equal(await coins(), 100 + andra.total, "bara skillnaden betalades ut");
    const k = (await getDoc(kvittoRef(lar, "t1"))).data();
    assert.equal(k.total, andra.total);
    assert.equal(k.senast, "t2");
    assert.equal(k.tillfalleId, "t1");
    assert.equal((await getDoc(kvittoRef(lar, "t2"))).exists(), false, "omprovet har inget eget kvitto");
    assert.equal((await getDoc(rattRef(lar, "t2"))).data().myntUtbetalt, andra.total, "omprovet speglar provets summa");
    assert.equal((await getDoc(doc(lar, "studentData", "e4a"))).data().lastProvMynt, "t1");
  });

  it("ett sämre omprov betalar 0 – och speglar det provet redan gett", async () => {
    const lar = env.ak4();
    const [forsta] = await lamnaOchBetala(lar, "t1", fardig(4));
    const [andra] = await lamnaOchBetala(lar, "t2", fardig(0));
    assert.deepEqual(andra, { uid: "e4a", status: "redan", total: forsta.total });
    assert.equal(await coins(), 100 + forsta.total);
    assert.equal((await getDoc(rattRef(lar, "t2"))).data().myntUtbetalt, forsta.total);
  });

  it("omprov utan ursprungligt kvitto (eleven var sjuk) betalar som vanligt – på ursprungets kvitto", async () => {
    const [b] = await lamnaOchBetala(env.ak4(), "t2", fardig(2));
    assert.equal(b.status, "betald");
    assert.equal(await coins(), 100 + b.total);
    assert.equal((await getDoc(kvittoRef(env.ak4(), "t1"))).data().total, b.total);
  });

  it("taket 200 gäller ursprung + omprov tillsammans", async () => {
    await env.seed(async (db) => {
      await updateDoc(doc(db, "provTillfallen", "t1"), { "installningar.mynt": { typ: "fast", antal: 150 } });
      await updateDoc(doc(db, "provTillfallen", "t2"), { "installningar.mynt": { typ: "fast", antal: 200 } });
    });
    const lar = env.ak4();
    const [a] = await lamnaOchBetala(lar, "t1", fardig());
    assert.equal(a.total, 150);
    const [b] = await lamnaOchBetala(lar, "t2", fardig());
    assert.equal(b.total, 200);
    assert.equal(await coins(), 300, "150 + 50, aldrig 150 + 200");
  });
});

describe("reglerna: inget eget kvitto för omprovet, senast kan inte förfalskas", () => {
  // En utbetalning skriven för hand (som prov-mynt-pay.js).
  function betala(db, { k, src, total, fore = 0, saldo = 100, extra = {} }) {
    const b = writeBatch(db);
    b.update(doc(db, "studentData", "e4a"), { coins: saldo + total - fore, lastProvMynt: k });
    b.set(kvittoRef(db, k), { total, tillfalleId: k, classId: "4a", at: serverTimestamp(), by: "ak4", ...(src ? { senast: src } : {}), ...extra });
    b.update(rattRef(db, src || k), { myntUtbetalt: total });
    return b.commit();
  }

  it("ett eget kvitto provMynt/{omprov} nekas – annars kunde omprovet betala 200 till", async () => {
    await lamna(env.ak4(), "t2", fardig(4));
    await assertFails(betala(env.ak4(), { k: "t2", total: 10 }));
    await assertSucceeds(betala(env.ak4(), { k: "t1", src: "t2", total: 10 }), "på ursprungets kvitto går det");
  });

  it("senast måste vara ett omprov av just det tillfället", async () => {
    await env.seed(async (db) => {
      // t3: ett vanligt tillfälle i samma klass (inget omprov av t1).
      await setDoc(doc(db, "provTillfallen", "t3"), tfDok(PER_POANG));
      await setDoc(doc(db, "provTillfallen", "t3", "svar", "e4a"), svarDok);
    });
    await lamna(env.ak4(), "t3", fardig(4));
    await assertFails(betala(env.ak4(), { k: "t1", src: "t3", total: 10 }), "t3 är inget omprov av t1");
    await assertSucceeds(betala(env.ak4(), { k: "t3", total: 10 }), "t3 betalar på sitt eget kvitto");
  });

  it("omprovets spegel måste vara ursprungets kvitto, inte ett eget belopp", async () => {
    const lar = env.ak4();
    await lamnaOchBetala(lar, "t1", fardig(4));
    await lamna(lar, "t2", fardig(4));
    await assertFails(updateDoc(rattRef(lar, "t2"), { myntUtbetalt: 3 }));
  });
});

describe("omprovAv (§14): samma prov och klass, inget omprov av ett omprov, byts aldrig", () => {
  const skapa = (over) => addDoc(collection(env.ak4(), "provTillfallen"), {
    ...tfDok(PER_POANG, { status: "forberett", fragor: [] }), createdBy: "ak4", elevIds: ["e4a"], skapad: serverTimestamp(), ...over,
  });
  it("rätt ursprung går; annat prov, annan klass, ett omprov eller ett som inte finns nekas", async () => {
    await env.seed(async (db) => {
      await setDoc(doc(db, "provTillfallen", "t-annat-prov"), tfDok(PER_POANG, { provId: "p2" }));
      await setDoc(doc(db, "provTillfallen", "t-4b"), tfDok(PER_POANG, { classId: "4b" }));
    });
    await assertSucceeds(skapa({ omprovAv: "t1" }));
    await assertFails(skapa({ omprovAv: "t-annat-prov" }), "annat prov");
    await assertFails(skapa({ omprovAv: "t-4b" }), "annan klass");
    await assertFails(skapa({ omprovAv: "t2" }), "t2 är självt ett omprov");
    await assertFails(skapa({ omprovAv: "finns-inte" }));
    await assertFails(skapa({ omprovAv: 7 }));
  });
  it("omprovAv byts aldrig och läggs aldrig till i efterhand", async () => {
    await assertFails(updateDoc(doc(env.ak4(), "provTillfallen", "t2"), { omprovAv: "t3" }));
    await assertFails(updateDoc(doc(env.ak4(), "provTillfallen", "t1"), { omprovAv: "t2" }));
    await assertSucceeds(updateDoc(doc(env.ak4(), "provTillfallen", "t2"), { status: "oppet", oppnad: serverTimestamp() }));
  });
});
