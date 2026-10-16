// ============================================================================
// Regel-/emulatortester: Pluggmynt per prov (#746, spec §11) med appens egen
// utbetalning (src/prov/prov-mynt-pay.js betalaProvMynt) och EXAKT de
// rättningsskrivningar som src/prov/prov-rattning-data.js gör:
//   • tillbakalämning → mynten betalas en gång (kvitto + saldo + myntUtbetalt)
//   • dubbelklick och två flikar samtidigt → betalas ändå bara en gång
//   • ångra → mynten står kvar; ny tillbakalämning → bara skillnaden
//   • taket 200 per prov och elev, och tillfällets inställning
//   • reglerna: bara läraren med klassen, kvittot bara uppåt, saldot exakt,
//     myntUtbetalt kan inte fuskas upp eller ned, eleven kan inget
// Riggen: test/helpers/roller-env.js (ak4 har 4a, eleven e4a går i 4a, 100 mynt).
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  deleteDoc, deleteField, doc, getDoc, runTransaction, serverTimestamp, setDoc, updateDoc, writeBatch,
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

before(async () => { env = await createRollerEnv("pluggportalen-rules-test-prov-mynt"); });
after(async () => { if (env) await env.testEnv.cleanup(); });
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    await setDoc(doc(db, "provTillfallen", "t1"), tfDok(PER_POANG));
    await setDoc(doc(db, "provTillfallen", "t1", "svar", "e4a"), { elevId: "e4a", classId: "4a", svar: SVAR, inlamnad: true, inlamnadNar: "elev" });
  });
});

const rattRef = (db, uid = "e4a") => doc(db, "provTillfallen", "t1", "rattning", uid);
const kvittoRef = (db, uid = "e4a") => doc(db, "studentData", uid, "provMynt", "t1");
const ny = () => nyRattning({ elevId: "e4a", classId: "4a", provNamn: PROV.namn, fragor, svar: SVAR, facit });
/** Färdigrättad: förslagen godkända och fritexten (4 p) satt till `q8p` poäng. */
const fardig = (q8p = 3) => bedom(godkannAlla(ny(), fragor), q8, { poang: q8p }, fragor);
/** Allt rätt (18 av 18 poäng). */
const alltRatt = () => fragor.filter((f) => f.poang).reduce((r, f) => bedom(r, f, { ratt: true }, fragor), ny());
const coins = async (uid = "e4a") => (await getDoc(doc(env.ak4(), "studentData", uid))).data().coins;
const tillfalleFran = async (db) => ({ id: "t1", ...(await getDoc(doc(db, "provTillfallen", "t1"))).data() });

// lamnaTillbaka (prov-rattning-data.js): hela dokumentet, aterlamnadAt = serverns tid.
function lamna(db, r) {
  const b = writeBatch(db);
  b.set(rattRef(db), { ...aterlamnadDok(sparDok(r, fragor), { visaFacit: true, facit }), aterlamnadAt: serverTimestamp() });
  return b.commit();
}
// angraTillbaka
const angra = (db) => updateDoc(rattRef(db), { aterlamnad: false, aterlamnadAt: deleteField(), facit: deleteField() });
// Lagret (prov-ratta-lager.js): lämna tillbaka, sedan betala de eleverna.
async function lamnaOchBetala(db, r, by = "ak4") {
  await lamna(db, r);
  return betalaProvMynt(sdk, db, { t: "t1", tf: await tillfalleFran(db), elever: ["e4a"], by });
}
const vanta = () => Promise.resolve();

describe("utbetalningen (§11): en gång, skillnaden, taket", () => {
  it("tillbakalämning betalar 2 mynt per poäng; eleven ser myntUtbetalt i sin rättning", async () => {
    const r = fardig();
    const belopp = Math.floor(2 * sparDok(r, fragor).totalPoang);
    assert.ok(belopp > 0);
    const [b] = await lamnaOchBetala(env.ak4(), r);
    assert.deepEqual(b, { uid: "e4a", status: "betald", total: belopp });
    assert.equal(await coins(), 100 + belopp);
    const k = (await getDoc(kvittoRef(env.as("e4a")))).data();
    assert.equal(k.total, belopp, "eleven läser sitt kvitto");
    assert.equal(k.by, "ak4");
    const elevR = (await assertSucceeds(getDoc(rattRef(env.as("e4a"))))).data();
    assert.equal(elevR.myntUtbetalt, belopp);
  });

  it("dubbelklick (samma flik två gånger samtidigt) betalar en gång", async () => {
    const lar = env.ak4();
    await lamna(lar, fardig());
    const tf = await tillfalleFran(lar);
    const kor = () => betalaProvMynt(sdk, lar, { t: "t1", tf, elever: ["e4a"], by: "ak4", vanta });
    const ut = (await Promise.all([kor(), kor()])).flat();
    const belopp = ut[0].total;
    assert.deepEqual(ut.map((b) => b.status).sort(), ["betald", "redan"]);
    assert.equal(await coins(), 100 + belopp);
  });

  it("två flikar (två klienter, admin och årskurskontot) samtidigt + en omladdning → en gång", async () => {
    await lamna(env.ak4(), fardig());
    const tf = await tillfalleFran(env.ak4());
    const [a, b] = await Promise.all([
      betalaProvMynt(sdk, env.ak4(), { t: "t1", tf, elever: ["e4a"], by: "ak4", vanta }),
      betalaProvMynt(sdk, env.admin(), { t: "t1", tf, elever: ["e4a"], by: "admin1", vanta }),
    ]);
    assert.deepEqual([a[0].status, b[0].status].sort(), ["betald", "redan"]);
    const igen = await betalaProvMynt(sdk, env.ak4(), { t: "t1", tf, elever: ["e4a"], by: "ak4" });
    assert.equal(igen[0].status, "redan");
    assert.equal(await coins(), 100 + a[0].total);
  });

  it("ångra drar inte tillbaka; ny tillbakalämning betalar bara skillnaden – och inget om summan sjönk", async () => {
    const lar = env.ak4();
    const [forsta] = await lamnaOchBetala(lar, fardig(1));
    await assertSucceeds(angra(lar));
    assert.equal(await coins(), 100 + forsta.total, "ångra rör inte saldot");
    const efterAngra = (await getDoc(rattRef(lar))).data();
    assert.equal(efterAngra.myntUtbetalt, forsta.total, "myntUtbetalt står kvar efter ångra");
    assert.equal(efterAngra.aterlamnad, false);
    // Läraren rättar om (+3 poäng på fritexten) – sparningen behåller myntUtbetalt (sparDok).
    const hogre = { ...fardig(4), myntUtbetalt: efterAngra.myntUtbetalt };
    await assertSucceeds(setDoc(rattRef(lar), sparDok(hogre, fragor)));
    const [andra] = await lamnaOchBetala(lar, hogre);
    assert.equal(andra.status, "betald");
    assert.equal(andra.total, forsta.total + 6, "2 mynt × 3 poäng till");
    assert.equal(await coins(), 100 + andra.total, "bara skillnaden betalades");
    // Ångra igen och sänk poängen: inget betalas, inget dras.
    await assertSucceeds(angra(lar));
    const lagre = { ...fardig(0), myntUtbetalt: andra.total };
    const [tredje] = await lamnaOchBetala(lar, lagre);
    assert.deepEqual(tredje, { uid: "e4a", status: "redan", total: andra.total });
    assert.equal(await coins(), 100 + andra.total);
    assert.equal((await getDoc(kvittoRef(lar))).data().total, andra.total);
  });

  it("radera rättningen och rätta från början: kvittot finns kvar hos eleven → inget betalas igen", async () => {
    const lar = env.ak4();
    const [forsta] = await lamnaOchBetala(lar, fardig());
    await assertSucceeds(deleteDoc(rattRef(lar)));
    await assertSucceeds(setDoc(rattRef(lar), sparDok(ny(), fragor)));
    const [igen] = await lamnaOchBetala(lar, fardig());
    assert.equal(igen.status, "redan");
    assert.equal(await coins(), 100 + forsta.total);
    assert.equal((await getDoc(rattRef(lar))).data().myntUtbetalt, forsta.total, "spegeln återställd utan nya mynt");
  });

  it("taket: högst 200 per prov och elev (20 mynt per poäng)", async () => {
    await env.seed((db) => updateDoc(doc(db, "provTillfallen", "t1"), { "installningar.mynt": { typ: "poang", antal: 20 } }));
    const r = alltRatt();
    assert.equal(sparDok(r, fragor).totalPoang, 18, "20 × 18 = 360 mynt utan taket");
    const [b] = await lamnaOchBetala(env.ak4(), r);
    assert.equal(b.total, 200);
    assert.equal(await coins(), 300);
  });

  it("fast summa; inga mynt (standard) betalar ingenting", async () => {
    await env.seed((db) => updateDoc(doc(db, "provTillfallen", "t1"), { "installningar.mynt": { typ: "fast", antal: 20 } }));
    const [b] = await lamnaOchBetala(env.ak4(), fardig(0));
    assert.deepEqual(b, { uid: "e4a", status: "betald", total: 20 });
    await env.seed((db) => updateDoc(doc(db, "provTillfallen", "t1"), { "installningar.mynt": { typ: "inga" } }));
    await angra(env.ak4());
    const [c] = await lamnaOchBetala(env.ak4(), { ...fardig(4), myntUtbetalt: 20 });
    assert.equal(c.status, "redan");
    assert.equal(await coins(), 120);
  });

  it("inte tillbakalämnad → ingenting", async () => {
    const lar = env.ak4();
    await setDoc(rattRef(lar), sparDok(fardig(), fragor));
    const [b] = await betalaProvMynt(sdk, lar, { t: "t1", tf: await tillfalleFran(lar), elever: ["e4a"], by: "ak4" });
    assert.equal(b.status, "ingen");
    assert.equal(await coins(), 100);
  });
});

describe("reglerna: kvittot, saldot och myntUtbetalt", () => {
  // En utbetalning skriven för hand (som prov-mynt-pay.js), för att pröva varje villkor.
  function betala(db, { total, fore = 0, saldo = 100, diff = total - fore, spegel = total, by = "ak4", extra = {} }) {
    const b = writeBatch(db);
    b.update(doc(db, "studentData", "e4a"), { coins: saldo + diff, lastProvMynt: "t1" });
    b.set(kvittoRef(db), { total, tillfalleId: "t1", classId: "4a", at: serverTimestamp(), by, ...extra });
    b.update(rattRef(db), { myntUtbetalt: spegel });
    return b.commit();
  }
  const tillbaka = async () => lamna(env.ak4(), fardig(4)); // 2 × totalPoang mynt tillåtet
  const tak = () => 2 * sparDok(fardig(4), fragor).totalPoang;

  it("rätt utbetalning går igenom; fel saldo, fel spegel, för mycket eller fel avsändare nekas", async () => {
    await tillbaka();
    const lar = env.ak4();
    await assertFails(betala(lar, { total: 10, diff: 11 }), "saldot ökar mer än kvittot");
    await assertFails(betala(lar, { total: 10, spegel: 9 }), "myntUtbetalt ≠ kvittot");
    await assertFails(betala(lar, { total: Math.floor(tak()) + 1 }), "mer än 2 mynt per poäng");
    await assertFails(betala(lar, { total: 10, by: "admin1" }), "by = den som skriver");
    await assertFails(betala(lar, { total: 10, extra: { hemligt: 1 } }));
    await assertSucceeds(betala(lar, { total: 10 }));
    await assertFails(betala(lar, { total: 10, fore: 10, saldo: 110 }), "kvittot måste öka");
    await assertFails(betala(lar, { total: 8, fore: 10, saldo: 110 }), "kvittot får aldrig minska");
    await assertSucceeds(betala(lar, { total: 12, fore: 10, saldo: 110 }), "skillnaden");
    assert.equal(await coins(), 112);
  });

  it("taket 200 gäller även om inställningen ger mer", async () => {
    await env.seed((db) => updateDoc(doc(db, "provTillfallen", "t1"), { "installningar.mynt": { typ: "fast", antal: 500 } }));
    await tillbaka();
    await assertFails(betala(env.ak4(), { total: 201 }));
    await assertSucceeds(betala(env.ak4(), { total: 200 }));
  });

  it("inga mynt, per poäng utan poängsättning, inte tillbakalämnat eller inte inlämnat → nekas", async () => {
    await tillbaka();
    await env.seed((db) => updateDoc(doc(db, "provTillfallen", "t1"), { "installningar.mynt": { typ: "inga" } }));
    await assertFails(betala(env.ak4(), { total: 10 }), "inga mynt");
    await env.seed((db) => updateDoc(doc(db, "provTillfallen", "t1"), { "installningar.mynt": PER_POANG, "installningar.poang": false }));
    await assertFails(betala(env.ak4(), { total: 10 }), "per poäng kräver poäng");
    await env.seed((db) => updateDoc(doc(db, "provTillfallen", "t1"), { "installningar.poang": true }));
    await env.seed((db) => updateDoc(doc(db, "provTillfallen", "t1", "svar", "e4a"), { inlamnad: false }));
    await assertFails(betala(env.ak4(), { total: 10 }), "inte inlämnat");
    await env.seed((db) => updateDoc(doc(db, "provTillfallen", "t1", "svar", "e4a"), { inlamnad: true }));
    await angra(env.ak4());
    await assertFails(betala(env.ak4(), { total: 10 }), "inte tillbakalämnat");
  });

  it("eleven, en annan klass lärare och ett avstängt konto kan inte betala; eleven läser bara sitt eget kvitto", async () => {
    await tillbaka();
    await assertFails(betala(env.as("e4a"), { total: 10, by: "e4a" }));
    await assertFails(betala(env.ak5(), { total: 10, by: "ak5" }));
    await assertFails(betala(env.ak4av(), { total: 10, by: "ak4av" }));
    await assertSucceeds(betala(env.ak4(), { total: 10 }));
    await assertSucceeds(getDoc(kvittoRef(env.as("e4a"))));
    await assertFails(getDoc(kvittoRef(env.as("e4b"))), "en annan elev");
    await assertFails(getDoc(kvittoRef(env.ak5())), "lärare utan eleven");
    await assertFails(deleteDoc(kvittoRef(env.ak4())), "kvittot raderas aldrig av läraren");
    await assertFails(setDoc(kvittoRef(env.as("e4a")), { total: 200, tillfalleId: "t1", classId: "4a", at: serverTimestamp(), by: "e4a" }));
  });

  it("årskurskontot: coins bara tillsammans med kvittot (inte lastProvMynt ensamt mot ett gammalt kvitto)", async () => {
    await tillbaka();
    const lar = env.ak4();
    await assertFails(updateDoc(doc(lar, "studentData", "e4a"), { coins: 150, lastProvMynt: "t1" }), "inget kvitto");
    await assertSucceeds(betala(lar, { total: 10 }));
    await assertFails(updateDoc(doc(lar, "studentData", "e4a"), { coins: 120, lastProvMynt: "t1" }), "kvittot oförändrat");
  });

  it("myntUtbetalt: sparningen behåller eller utelämnar den, men kan inte höja eller sänka den", async () => {
    await tillbaka();
    const lar = env.ak4();
    await assertFails(updateDoc(rattRef(lar), { myntUtbetalt: 30 }), "utan kvitto");
    await assertSucceeds(betala(lar, { total: 10 }));
    await assertFails(updateDoc(rattRef(lar), { myntUtbetalt: 5 }), "sänka");
    await assertFails(updateDoc(rattRef(lar), { myntUtbetalt: 12 }), "höja utan kvitto");
    await assertSucceeds(updateDoc(rattRef(lar), { helhetskommentar: "Bra jobbat!" }), "andra fält, spegeln kvar");
    await assertSucceeds(angra(lar));
    const r = { ...fardig(4), myntUtbetalt: 10 };
    await assertSucceeds(setDoc(rattRef(lar), sparDok(r, fragor)), "autosparningen (hela dokumentet) med spegeln");
    await assertFails(setDoc(rattRef(lar), { ...sparDok(r, fragor), myntUtbetalt: 40 }));
    await assertFails(setDoc(rattRef(lar), { ...sparDok(r, fragor), myntUtbetalt: 201 }));
  });
});
