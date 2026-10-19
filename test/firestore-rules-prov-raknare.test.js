// ============================================================================
// Regel-tester (#807, epic #802 §1.3 + DEL 2): räknarna på provtillfället och
// Hem-sidans frågor – INGEN regeländring behövs, det här visar varför:
//   * läraren med klassen skriver rattStatus + attRatta (Stäng, Öppna igen,
//     rättningen) med EXAKT de fält prov-raknare.js ger – även på ett stängt prov
//   * eleven och en lärare utan klassen nekas
//   * märkets fråga (classId in … + attRatta == true) och Hems övriga frågor
//     (öppna prov, eget prov, egen Live, klassens projektion) går för läraren;
//     eleven kan inte lista tillfällen på attRatta
// Riggen: test/helpers/roller-env.js (ak4 har 4a+4b, ak5 har 5a, e4a går i 4a).
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, limit, query, setDoc, updateDoc, where } from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { raknareFalt, stangRaknare } from "../src/prov/prov-raknare.js";
import { STANDARD_INSTALLNINGAR } from "../src/prov/prov-validera.js";

let env;
before(async () => { env = await createRollerEnv("pluggportalen-rules-test-prov-raknare"); });
after(async () => { if (env) await env.testEnv.cleanup(); });
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    const tf = { provId: "p1", provNamn: "Vikingar", classId: "4a", createdBy: "ak4", status: "oppet", fragor: [], installningar: { ...STANDARD_INSTALLNINGAR }, tidsgransMin: null };
    await setDoc(doc(db, "provTillfallen", "t1"), tf);
    await setDoc(doc(db, "provTillfallen", "t2"), { ...tf, status: "stangt", rattStatus: { antal: 5, rattade: 1, tillbaka: 0 }, attRatta: true });
    await setDoc(doc(db, "provTillfallen", "t5"), { ...tf, classId: "5a", createdBy: "ak5", status: "stangt", attRatta: true, rattStatus: { antal: 2, rattade: 0, tillbaka: 0 } });
    await setDoc(doc(db, "prov", "p1"), { namn: "Vikingar", fragor: [], createdBy: "ak4" });
    await setDoc(doc(db, "classProjections", "4a"), { members: { e4a: { namn: "Elev", ovat: "2026-10-19" } } });
  });
});
const tfRef = (db, t) => doc(db, "provTillfallen", t);

describe("räknarna på tillfället – inga nya regler", () => {
  it("Stäng: status först, sedan räknarna på det stängda tillfället (prov-tillfalle-data.js)", async () => {
    const lar = env.ak4();
    await assertSucceeds(updateDoc(tfRef(lar, "t1"), { status: "stangt" }));
    await assertSucceeds(updateDoc(tfRef(lar, "t1"), stangRaknare({}, 3)));
    const d = (await getDoc(tfRef(lar, "t1"))).data();
    assert.deepEqual([d.rattStatus, d.attRatta], [{ antal: 3, rattade: 0, tillbaka: 0 }, true]);
  });
  it("Öppna igen: status oppet, sedan hela räkneverket", async () => {
    const lar = env.ak4();
    await assertSucceeds(updateDoc(tfRef(lar, "t2"), { status: "oppet" }));
    await assertSucceeds(updateDoc(tfRef(lar, "t2"), raknareFalt({ antal: 1, rattade: 1, tillbaka: 0 })));
  });
  it("admin får också; eleven och läraren utan klassen nekas", async () => {
    await assertSucceeds(updateDoc(tfRef(env.admin(), "t2"), raknareFalt({ antal: 5, rattade: 5, tillbaka: 0 })));
    await assertFails(updateDoc(tfRef(env.as("e4a"), "t2"), raknareFalt({ antal: 0, rattade: 0, tillbaka: 0 })));
    await assertFails(updateDoc(tfRef(env.ak5(), "t2"), raknareFalt({ antal: 0, rattade: 0, tillbaka: 0 })));
  });
});

describe("Hems och märkets frågor", () => {
  it("märket: classId in [kontots klasser] + attRatta == true", async () => {
    const s = await assertSucceeds(getDocs(query(collection(env.ak4(), "provTillfallen"), where("classId", "in", ["4a", "4b"]), where("attRatta", "==", true))));
    assert.deepEqual(s.docs.map((d) => d.id), ["t2"]);
    await assertFails(getDocs(query(collection(env.ak4(), "provTillfallen"), where("classId", "in", ["5a"]), where("attRatta", "==", true))));
    const alla = await assertSucceeds(getDocs(query(collection(env.admin(), "provTillfallen"), where("classId", "in", ["4a", "5a"]), where("attRatta", "==", true))));
    assert.equal(alla.size, 2);
  });
  it("eleven kan inte lista tillfällen på attRatta (bara öppna, som elevens lyssnare)", async () => {
    await assertFails(getDocs(query(collection(env.as("e4a"), "provTillfallen"), where("classId", "in", ["4a"]), where("attRatta", "==", true))));
  });
  it("öppna prov, eget prov, egen Live och klassens projektion – en läsning var", async () => {
    const lar = env.ak4();
    const oppna = await assertSucceeds(getDocs(query(collection(lar, "provTillfallen"), where("classId", "in", ["4a", "4b"]), where("status", "==", "oppet"))));
    assert.deepEqual(oppna.docs.map((d) => d.id), ["t1"]);
    assert.equal((await assertSucceeds(getDocs(query(collection(lar, "prov"), where("createdBy", "==", "ak4"), limit(1))))).size, 1);
    await assertSucceeds(getDocs(query(collection(lar, "liveSessions"), where("createdBy", "==", "ak4"), limit(1))));
    const p = await assertSucceeds(getDoc(doc(lar, "classProjections", "4a")));
    assert.equal(p.data().members.e4a.ovat, "2026-10-19");
  });
  it("eleven får skriva sitt ovat-datum i projektionen (som award-patchen redan gör)", async () => {
    await assertSucceeds(updateDoc(doc(env.as("e4a"), "classProjections", "4a"), { "members.e4a.ovat": "2026-10-20", "members.e4a.stars": 4 }));
  });
});
