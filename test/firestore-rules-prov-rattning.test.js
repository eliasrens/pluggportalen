// ============================================================================
// Regel-tester: rättningen och tillbakalämningen (#741, spec §6.3, §7 +
// testlistan) med EXAKT de skrivningar som src/prov/prov-rattning-data.js gör:
//   förslagen (batch med hela rättningsdokument + räkneverket på tillfället) →
//   autosparningen → "Lämna tillbaka till alla rättade" (batch, aterlamnadAt =
//   serverns tid, facit bara om valt) → eleven läser → Ångra (facit och tid bort).
// Riggen: test/helpers/roller-env.js (ak4 har 4a, eleven e4a går i 4a).
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  collection, collectionGroup, deleteField, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc,
  updateDoc, where, writeBatch,
} from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { delaUppProv } from "../src/prov/prov-modell.js";
import { validateProv, STANDARD_INSTALLNINGAR } from "../src/prov/prov-validera.js";
import {
  angratDok, aterlamnaPlan, aterlamnadDok, bedom, godkannAlla, nyRattning, rattStatusSumma, sparDok,
} from "../src/prov/prov-rattning-logik.js";
import { EXEMPEL } from "./helpers/prov-exempel.js";

let env;
const PROV = validateProv({ namn: "Vikingaprovet", fragor: Object.values(EXEMPEL).map((e) => structuredClone(e.f)) }).value;
const { fragor, facit, bedomningsstod } = delaUppProv(PROV);
const q8 = fragor.find((f) => f.id === "q8");
// 25 elever: e4a (riktig elev i 4a) + 24 påhittade uid:n.
const ELEVER = ["e4a", ...Array.from({ length: 24 }, (_, i) => `x${i}`)];
const SVAR = { q1: 0, q4: "Birka", q8: "Djur och hus." };

before(async () => { env = await createRollerEnv("pluggportalen-rules-test-prov-rattning"); });
after(async () => { if (env) await env.testEnv.cleanup(); });
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    const tf = {
      provId: "p1", provNamn: PROV.namn, classId: "4a", createdBy: "ak4", status: "stangt", fragor,
      installningar: { ...STANDARD_INSTALLNINGAR }, tidsgransMin: null,
    };
    await setDoc(doc(db, "provTillfallen", "t1"), tf);
    await setDoc(doc(db, "provTillfallen", "t5"), { ...tf, classId: "5a", createdBy: "ak5" });
    await setDoc(doc(db, "provTillfallen", "t1", "privat", "facit"), { facit, bedomningsstod });
    for (const uid of ELEVER) {
      await setDoc(doc(db, "provTillfallen", "t1", "svar", uid), { elevId: uid, classId: "4a", svar: SVAR, inlamnad: true, inlamnadNar: "elev" });
    }
  });
});

const elev = () => env.as("e4a");
const rattRef = (db, uid, t = "t1") => doc(db, "provTillfallen", t, "rattning", uid);
const ny = (uid, classId = "4a") => nyRattning({ elevId: uid, classId, provNamn: PROV.namn, fragor, svar: SVAR, facit });
const fardig = (uid) => bedom(godkannAlla(ny(uid), fragor), q8, { poang: 3, kommentar: "Bra!" }, fragor);

// sparaRattningar (prov-rattning-data.js): hela dokumenten + räkneverket i en batch.
function spara(db, dok, rattStatus, t = "t1") {
  const b = writeBatch(db);
  for (const [uid, d] of Object.entries(dok)) b.set(rattRef(db, uid, t), d);
  if (rattStatus) b.update(doc(db, "provTillfallen", t), { rattStatus });
  return b.commit();
}
// lamnaTillbaka: aterlamnadDok + aterlamnadAt = serverns tid.
function lamna(db, dok, rattStatus) {
  const b = writeBatch(db);
  for (const [uid, d] of Object.entries(dok)) b.set(rattRef(db, uid), { ...d, aterlamnadAt: serverTimestamp() });
  if (rattStatus) b.update(doc(db, "provTillfallen", "t1"), { rattStatus });
  return b.commit();
}
// angraTillbaka
function angra(db, uid, rattStatus) {
  const b = writeBatch(db);
  b.update(rattRef(db, uid), { aterlamnad: false, aterlamnadAt: deleteField(), facit: deleteField() });
  if (rattStatus) b.update(doc(db, "provTillfallen", "t1"), { rattStatus });
  return b.commit();
}

describe("rättningen: förslag, sparning, tillbakalämning, ångra (§6.3, §7)", () => {
  it("hela flödet för en klass med 25 elever (batcharna håller sig inom reglernas get()-gräns)", async () => {
    const lar = env.ak4();
    const rattningar = Object.fromEntries(ELEVER.map((u) => [u, ny(u)]));
    // Förslagen sparas direkt med auto: true – en batch för hela klassen.
    await assertSucceeds(spara(lar, Object.fromEntries(ELEVER.map((u) => [u, sparDok(rattningar[u], fragor)])), rattStatusSumma(ELEVER, rattningar, fragor)));
    await assertFails(getDoc(rattRef(elev(), "e4a")), "inte tillbakalämnad");
    // Läraren rättar alla utom två färdigt.
    for (const u of ELEVER.slice(0, 23)) rattningar[u] = fardig(u);
    await assertSucceeds(spara(lar, Object.fromEntries(ELEVER.map((u) => [u, sparDok(rattningar[u], fragor)])), rattStatusSumma(ELEVER, rattningar, fragor)));
    // "Lämna tillbaka till alla rättade": 23 lämnas tillbaka, 2 hoppas över.
    const plan = aterlamnaPlan(ELEVER, rattningar, fragor);
    assert.equal(plan.klara.length, 23);
    assert.equal(plan.ejKlara.length, 2);
    const dok = Object.fromEntries(plan.klara.map((u) => [u, aterlamnadDok(sparDok(rattningar[u], fragor), { visaFacit: true, facit })]));
    await assertSucceeds(lamna(lar, dok, { antal: 25, rattade: 23, tillbaka: 23 }));
    const s = await assertSucceeds(getDoc(rattRef(elev(), "e4a")));
    assert.equal(s.data().aterlamnad, true);
    assert.deepEqual(s.data().facit.q4, facit.q4, "facit följer med när läraren valt det");
    assert.equal(s.data().fragor.q8.kommentar, "Bra!");
    const lista = await getDocs(collection(lar, "provTillfallen", "t1", "rattning"));
    assert.equal(lista.docs.filter((d) => d.data().aterlamnad).length, 23);
    assert.equal((await getDoc(doc(lar, "provTillfallen", "t1"))).data().rattStatus.tillbaka, 23);
    // Elevens menylänk (prov-watch.js) hittar den tillbakalämnade rättningen.
    const cg = await assertSucceeds(getDocs(query(collectionGroup(elev(), "rattning"), where("elevId", "==", "e4a"),
      where("aterlamnad", "==", true), orderBy("aterlamnadAt", "desc"), limit(10))));
    assert.equal(cg.size, 1);
    // Ångra: eleven ser den inte längre, och facit är borta.
    await assertSucceeds(angra(lar, "e4a", { antal: 25, rattade: 23, tillbaka: 22 }));
    await assertFails(getDoc(rattRef(elev(), "e4a")));
    const efter = (await getDoc(rattRef(lar, "e4a"))).data();
    assert.ok(!("facit" in efter) && !("aterlamnadAt" in efter));
    assert.deepEqual(efter, { ...angratDok({ ...dok.e4a }), aterlamnad: false });
  });

  it("utan 'Visa facit' får eleven ingen facit", async () => {
    await assertSucceeds(lamna(env.ak4(), { e4a: aterlamnadDok(sparDok(fardig("e4a"), fragor), { visaFacit: false, facit }) }));
    const d = (await assertSucceeds(getDoc(rattRef(elev(), "e4a")))).data();
    assert.ok(!("facit" in d));
  });
});

describe("rattning: statusflödet och synligheten i reglerna", () => {
  const bas = () => sparDok(fardig("e4a"), fragor);
  it("facit och aterlamnadAt bara i en tillbakalämnad rättning", async () => {
    const lar = env.ak4();
    await assertFails(setDoc(rattRef(lar, "e4a"), { ...bas(), facit }), "facit utan tillbakalämning");
    await assertFails(setDoc(rattRef(lar, "e4a"), { ...bas(), aterlamnadAt: serverTimestamp() }));
    await assertSucceeds(lamna(lar, { e4a: aterlamnadDok(bas(), { visaFacit: true, facit }) }));
    await assertFails(updateDoc(rattRef(lar, "e4a"), { aterlamnad: false }), "ångra måste ta bort facit och tiden");
    await assertFails(updateDoc(rattRef(lar, "e4a"), { aterlamnad: false, aterlamnadAt: deleteField() }), "facit kvar");
    await assertSucceeds(angra(lar, "e4a"));
  });
  it("att lämna tillbaka kräver aterlamnadAt = serverns tid; en tillbakalämnad behåller sin tid", async () => {
    const lar = env.ak4();
    await assertFails(setDoc(rattRef(lar, "e4a"), { ...bas(), aterlamnad: true }), "utan tid");
    await assertFails(setDoc(rattRef(lar, "e4a"), { ...bas(), aterlamnad: true, aterlamnadAt: new Date(2020, 1, 1) }), "påhittad tid");
    await assertSucceeds(lamna(lar, { e4a: aterlamnadDok(bas(), { visaFacit: true, facit }) }));
    const tid = (await getDoc(rattRef(lar, "e4a"))).data().aterlamnadAt;
    await assertSucceeds(updateDoc(rattRef(lar, "e4a"), { helhetskommentar: "Rättat stavfel." }), "samma tid står kvar");
    await assertFails(updateDoc(rattRef(lar, "e4a"), { aterlamnadAt: new Date(2020, 1, 1) }));
    assert.ok(tid);
  });
  it("bara kända fält med rätt typ; helhetskommentaren högst 4000 tecken", async () => {
    const lar = env.ak4();
    await assertSucceeds(setDoc(rattRef(lar, "e4a"), bas()));
    await assertFails(setDoc(rattRef(lar, "e4a"), { ...bas(), hemligt: 1 }));
    await assertFails(setDoc(rattRef(lar, "e4a"), { ...bas(), totalPoang: "18" }));
    await assertFails(setDoc(rattRef(lar, "e4a"), { ...bas(), helhetskommentar: "x".repeat(4001) }));
    await assertSucceeds(setDoc(rattRef(lar, "e4a"), { ...bas(), helhetskommentar: "x".repeat(4000), niva: "G" }));
  });
  it("en årskurslärare kan inte rätta eller lämna tillbaka i en annan klass; eleven aldrig", async () => {
    await assertFails(spara(env.ak4(), { e5a: sparDok(ny("e5a", "5a"), fragor) }, null, "t5"));
    await assertFails(lamna(env.ak5(), { e4a: aterlamnadDok(bas(), { visaFacit: true, facit }) }));
    await assertFails(setDoc(rattRef(elev(), "e4a"), { ...bas(), aterlamnad: true, aterlamnadAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(elev(), "provTillfallen", "t1"), { rattStatus: { antal: 1, rattade: 1, tillbaka: 1 } }), "eleven rör inte räkneverket");
  });
});
