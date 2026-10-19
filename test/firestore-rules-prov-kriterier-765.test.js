// ============================================================================
// Regel-tester: Prov 3D (#765, spec §2.2) – fritextens poängkriterier syns
// för eleven bara efter tillbakalämningen OCH bara när läraren valt det.
//   - visaKriterier av på tillfället → en tillbakalämning med kriterier nekas,
//     utan kriterier godtas (eleven läser rättningen utan kriterier)
//   - visaKriterier på → kriterierna följer med och eleven läser dem
//   - före tillbakalämningen nekas kriterierna oavsett flaggan (3A, provAterlamningOk)
//   - flaggan slås av efteråt: en sparning som behåller kriterierna oförändrade
//     godtas, att ändra dem nekas
// Riggen: test/helpers/roller-env.js (ak4 har 4a, eleven e4a går i 4a).
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { delaUppProv } from "../src/prov/prov-modell.js";
import { tillfalleInstallningar, validateProv } from "../src/prov/prov-validera.js";
import { aterlamnadDok, bedom, godkannAlla, nyRattning, sparDok } from "../src/prov/prov-rattning-logik.js";

let env;
const prov = (visaKriterier) => validateProv({
  namn: "Vikingaprovet",
  installningar: { visaKriterier },
  fragor: [
    { id: "a1", typ: "avsnitt", titel: "Del 1" },
    { id: "q1", typ: "flerval", fraga: "Var låg Birka?", alternativ: ["Björkö", "Gotland"], ratt: 0, poang: 0.5 },
    { id: "a2", typ: "avsnitt", titel: "Del 2" },
    { id: "q2", typ: "fritext", fraga: "Varför reste vikingarna?", poang: 4, kriterier: ["1 p: nämner en orsak", "+1 p: förklarar varför"] },
  ],
}).value;
const { fragor, facit, kriterier } = delaUppProv(prov(true));
const q2 = fragor.find((f) => f.id === "q2");
const SVAR = { q1: 0, q2: "För att handla." };

before(async () => { env = await createRollerEnv("pluggportalen-rules-test-prov-kriterier-765"); });
after(async () => { if (env) await env.testEnv.cleanup(); });

async function seed(visaKriterier) {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    await setDoc(doc(db, "provTillfallen", "t1"), {
      provId: "p1", provNamn: "Vikingaprovet", classId: "4a", createdBy: "ak4", status: "stangt", fragor,
      installningar: tillfalleInstallningar(prov(visaKriterier).installningar), tidsgransMin: null,
    });
    await setDoc(doc(db, "provTillfallen", "t1", "privat", "facit"), { facit, kriterier });
    await setDoc(doc(db, "provTillfallen", "t1", "svar", "e4a"), { elevId: "e4a", classId: "4a", svar: SVAR, inlamnad: true, inlamnadNar: "elev" });
  });
}

const elev = () => env.as("e4a");
const rattRef = (db) => doc(db, "provTillfallen", "t1", "rattning", "e4a");
// q1 rätt (0,5 p) + q2 3,5 av 4 → 4 av 4,5.
const rattad = () => sparDok(bedom(godkannAlla(nyRattning({ elevId: "e4a", classId: "4a", provNamn: "Vikingaprovet", fragor, svar: SVAR, facit }), fragor), q2, { poang: 3.5 }, fragor), fragor);
const tillbaka = (medKriterier) => ({ ...aterlamnadDok(rattad(), { visaFacit: false, facit, kriterier: medKriterier ? kriterier : null }), aterlamnadAt: serverTimestamp() });

describe("rattning.kriterier följer flaggan visaKriterier (#765)", () => {
  it("flaggan av: tillbakalämning med kriterier nekas, utan godtas – eleven ser inga kriterier", async () => {
    await seed(false);
    const lar = env.ak4();
    await assertSucceeds(setDoc(rattRef(lar), rattad()));
    await assertFails(setDoc(rattRef(lar), tillbaka(true)), "kriterier när läraren inte valt att visa dem");
    await assertSucceeds(setDoc(rattRef(lar), tillbaka(false)));
    const snap = await assertSucceeds(getDoc(rattRef(elev())));
    assert.equal("kriterier" in snap.data(), false);
    assert.equal(snap.data().totalPoang, 4);
  });

  it("flaggan på: kriterierna följer med tillbakalämningen och eleven läser dem", async () => {
    await seed(true);
    const lar = env.ak4();
    await assertSucceeds(setDoc(rattRef(lar), rattad()));
    await assertFails(getDoc(rattRef(elev())), "inte före tillbakalämningen");
    await assertFails(setDoc(rattRef(lar), { ...rattad(), kriterier }), "kriterier före tillbakalämningen nekas även med flaggan på");
    await assertSucceeds(setDoc(rattRef(lar), tillbaka(true)));
    const snap = await assertSucceeds(getDoc(rattRef(elev())));
    assert.deepEqual(snap.data().kriterier, kriterier);
    assert.equal(snap.data().maxPoang, 4.5);
  });

  it("flaggan slås av efteråt: oförändrade kriterier står kvar, ändrade nekas", async () => {
    await seed(true);
    const lar = env.ak4();
    await assertSucceeds(setDoc(rattRef(lar), tillbaka(true)));
    await env.seed(async (db) => {
      await updateDoc(doc(db, "provTillfallen", "t1"), { "installningar.visaKriterier": false });
    });
    await assertSucceeds(updateDoc(rattRef(lar), { niva: "G" }), "kriterierna rörs inte");
    await assertFails(updateDoc(rattRef(lar), { kriterier: { q2: ["2 p: allt"] } }), "nya kriterier utan flaggan");
  });
});
