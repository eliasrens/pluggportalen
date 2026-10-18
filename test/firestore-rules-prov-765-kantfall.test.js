// ============================================================================
// Regel-tester: #765 testarens kantfall – poängkriterierna (rattning.kriterier)
// och den nya regeln provKriterierOk får inte blockera lärarens vanliga flöden,
// och eleven ser aldrig kriterierna före tillbakalämningen.
//   - flaggan av: sparning (Rätta alla-batch, flera elever) och tillbakalämning
//     utan kriterier godtas; ett gammalt tillfälle utan installningar likaså
//   - flaggan slås av efter tillbakalämningen: ångra (delete av kriterierna),
//     en ny tillbakalämning utan kriterier och en omskrivning med oförändrade
//     kriterier godtas; ångra + ny tillbakalämning MED kriterier nekas
//   - eleven: kan inte skriva kriterier, läser dem inte före tillbakalämningen
//     (dokument eller collection group), läser dem efter
//   - en annan lärare skriver inte kriterier
// Riggen: test/helpers/roller-env.js (ak4 har 4a, eleven e4a går i 4a).
// Kräver emulatorn: FIRESTORE_EMULATOR_HOST=… node --test <den här filen>
// ============================================================================

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  collectionGroup, deleteField, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { delaUppProv } from "../src/prov/prov-modell.js";
import { tillfalleInstallningar, validateProv } from "../src/prov/prov-validera.js";
import { angratDok, aterlamnadDok, bedom, godkannAlla, nyRattning, sparDok } from "../src/prov/prov-rattning-logik.js";

let env;
const PROV = (visaKriterier) => validateProv({
  namn: "Medeltiden",
  installningar: { visaKriterier },
  fragor: [
    { id: "a1", typ: "avsnitt", titel: "Del 1" },
    { id: "q1", typ: "flerval", fraga: "Hansan?", alternativ: ["Förbund", "Kung"], ratt: 0, poang: 0.5 },
    { id: "a2", typ: "avsnitt", titel: "Del 2" },
    { id: "q2", typ: "fritext", fraga: "Beskriv en borg.", poang: 7.5, kriterier: ["1 p: murar", "+1 p: varför"] },
  ],
}).value;
const { fragor, facit, kriterier } = delaUppProv(PROV(true));
const q2 = fragor.find((f) => f.id === "q2");
const SVAR = { q1: 0, q2: "Murar." };

before(async () => { env = await createRollerEnv("pluggportalen-rules-test-prov-765-kantfall"); });
after(async () => { if (env) await env.testEnv.cleanup(); });

/** installningar: true/false = visaKriterier, null = gammalt tillfälle utan installningar-fältet. */
async function seed(visaKriterier) {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    const tf = { provId: "p1", provNamn: "Medeltiden", classId: "4a", createdBy: "ak4", status: "stangt", fragor, tidsgransMin: null };
    if (visaKriterier !== null) tf.installningar = tillfalleInstallningar(PROV(visaKriterier).installningar);
    await setDoc(doc(db, "provTillfallen", "t1"), tf);
    await setDoc(doc(db, "provTillfallen", "t1", "privat", "facit"), { facit, kriterier });
    for (const uid of ["e4a", "x2"]) {
      await setDoc(doc(db, "provTillfallen", "t1", "svar", uid), { elevId: uid, classId: "4a", svar: SVAR, inlamnad: true, inlamnadNar: "elev" });
    }
  });
}

const rattRef = (db, uid = "e4a") => doc(db, "provTillfallen", "t1", "rattning", uid);
// q1 rätt (0,5) + q2 6,5 av 7,5 → 7 av 8.
const rattad = (uid = "e4a") => sparDok(bedom(godkannAlla(nyRattning({ elevId: uid, classId: "4a", provNamn: "Medeltiden", fragor, svar: SVAR, facit }), fragor), q2, { poang: 6.5 }, fragor), fragor);
const tillbaka = (kr = null, uid = "e4a") => ({ ...aterlamnadDok(rattad(uid), { visaFacit: true, facit, kriterier: kr }), aterlamnadAt: serverTimestamp() });
const slaAvFlaggan = () => env.seed(async (db) => { await updateDoc(doc(db, "provTillfallen", "t1"), { "installningar.visaKriterier": false }); });

describe("provKriterierOk blockerar inte lärarens flöden (#765)", () => {
  it("flaggan av: Rätta alla-batch för två elever + rattStatus, sedan tillbakalämning utan kriterier", async () => {
    await seed(false);
    const lar = env.ak4();
    const b = writeBatch(lar);
    b.set(rattRef(lar, "e4a"), rattad("e4a"));
    b.update(doc(lar, "provTillfallen", "t1"), { rattStatus: { antal: 1, rattade: 1, tillbaka: 0 } });
    await assertSucceeds(b.commit());
    await assertSucceeds(setDoc(rattRef(lar), tillbaka(null)));
    const snap = await assertSucceeds(getDoc(rattRef(env.as("e4a"))));
    assert.equal(snap.data().totalPoang, 7);
    assert.equal("kriterier" in snap.data(), false);
  });

  it("gammalt tillfälle utan installningar: tillbakalämning utan kriterier godtas, med nekas", async () => {
    await seed(null);
    const lar = env.ak4();
    await assertSucceeds(setDoc(rattRef(lar), rattad()));
    await assertFails(setDoc(rattRef(lar), tillbaka(kriterier)));
    await assertSucceeds(setDoc(rattRef(lar), tillbaka(null)));
  });

  it("flaggan slås av efter tillbakalämningen: omskrivning med samma kriterier, ångra och ny tillbakalämning utan kriterier godtas", async () => {
    await seed(true);
    const lar = env.ak4();
    await assertSucceeds(setDoc(rattRef(lar), tillbaka(kriterier)));
    await slaAvFlaggan();
    // Tillbakalämningen körs igen (batch.set av hela dokumentet) med kriterierna oförändrade.
    await assertSucceeds(setDoc(rattRef(lar), tillbaka(kriterier)), "samma kriterier");
    // angraTillbaka i prov-rattning-data.js: update med deleteField.
    await assertSucceeds(updateDoc(rattRef(lar), { aterlamnad: false, aterlamnadAt: deleteField(), facit: deleteField(), kriterier: deleteField() }));
    await assertFails(setDoc(rattRef(lar), tillbaka(kriterier)), "efter ångra finns inga gamla kriterier att behålla");
    await assertSucceeds(setDoc(rattRef(lar), tillbaka(null)));
  });

  it("angratDok som hel set (utan kriterier) godtas med flaggan på och av", async () => {
    for (const flagga of [true, false]) {
      await seed(flagga);
      const lar = env.ak4();
      await assertSucceeds(setDoc(rattRef(lar), tillbaka(flagga ? kriterier : null)));
      await assertSucceeds(setDoc(rattRef(lar), angratDok(rattad())), `flaggan ${flagga}`);
    }
  });
});

describe("eleven och kriterierna (#762/#765)", () => {
  it("eleven läser inte rättningen före tillbakalämningen (dokument och collection group) och kan aldrig skriva kriterier", async () => {
    await seed(true);
    await assertSucceeds(setDoc(rattRef(env.ak4()), rattad()));
    const e = env.as("e4a");
    await assertFails(getDoc(rattRef(e)));
    const q = query(collectionGroup(e, "rattning"), where("elevId", "==", "e4a"), where("aterlamnad", "==", true));
    const tom = await assertSucceeds(getDocs(q));
    assert.equal(tom.size, 0);
    await assertFails(getDocs(query(collectionGroup(e, "rattning"), where("elevId", "==", "e4a"))), "utan aterlamnad-filtret");
    await assertFails(updateDoc(rattRef(e), { kriterier }));
    await assertFails(setDoc(rattRef(e), tillbaka(kriterier)));
  });

  it("efter tillbakalämningen läser eleven kriterierna via collection group-frågan", async () => {
    await seed(true);
    await assertSucceeds(setDoc(rattRef(env.ak4()), tillbaka(kriterier)));
    const e = env.as("e4a");
    const snap = await assertSucceeds(getDocs(query(collectionGroup(e, "rattning"), where("elevId", "==", "e4a"), where("aterlamnad", "==", true))));
    assert.equal(snap.size, 1);
    assert.deepEqual(snap.docs[0].data().kriterier, kriterier);
    await assertFails(updateDoc(rattRef(e), { kriterier: { q2: ["allt"] } }), "eleven ändrar inte kriterierna efteråt heller");
  });

  it("en lärare utan klassen skriver inte kriterier", async () => {
    await seed(true);
    await assertFails(setDoc(rattRef(env.ak5()), tillbaka(kriterier)));
  });
});
