// ============================================================================
// Regel-tester: Prov (#738, epic #737, spec docs/UTVECKLINGSUPPDRAG_PROV.md §4).
// ----------------------------------------------------------------------------
// prov, provTillfallen, privat/facit, svar och rattning (+ collection group-
// frågorna på rattning). Riggen: test/helpers/roller-env.js – Årskurs 4 (ak4)
// har 4a/4b, Årskurs 5 (ak5) har 5a; eleverna e4a (4a), e4b (4b), e5a (5a).
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  collection, collectionGroup, deleteDoc, deleteField, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp,
  setDoc, updateDoc, where, writeBatch, Timestamp,
} from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";

let env;
const MIN = 60 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);

before(async () => { env = await createRollerEnv("pluggportalen-rules-test-prov"); });
after(async () => { if (env) await env.testEnv.cleanup(); });

const FRAGOR = [{ id: "f1", typ: "kortsvar", fraga: "Vilken stad?", poang: 1 }];
const tillfalleDok = (over = {}) => ({
  provId: "p1", provNamn: "Vikingar", classId: "4a", createdBy: "ak4", createdByName: "Årskurs 4",
  status: "oppet", fragor: FRAGOR, installningar: { poang: true }, tidsgransMin: null, ...over,
});
const svarDok = (uid, classId, over = {}) => ({
  elevId: uid, classId, startad: serverTimestamp(), uppdaterad: serverTimestamp(),
  svar: { f1: "Birka" }, inlamnad: false, ...over,
});

// t-oppet (4a, öppet), t-forb (4a, förberett), t-5a (5a, öppet), t-tid (4a,
// öppet, 5 min) – med facit, svar och rättningar på plats.
beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    await setDoc(doc(db, "prov", "p1"), {
      namn: "Vikingar", fragor: [{ ...FRAGOR[0], godkanda: ["Birka"] }], createdBy: "ak4", createdByName: "Årskurs 4",
    });
    await setDoc(doc(db, "prov", "p5"), { namn: "Stenåldern", fragor: [], createdBy: "ak5" });
    await setDoc(doc(db, "provTillfallen", "t-oppet"), tillfalleDok());
    await setDoc(doc(db, "provTillfallen", "t-forb"), tillfalleDok({ status: "forberett" }));
    await setDoc(doc(db, "provTillfallen", "t-stangt"), tillfalleDok({ status: "stangt" }));
    await setDoc(doc(db, "provTillfallen", "t-5a"), tillfalleDok({ classId: "5a", createdBy: "ak5" }));
    await setDoc(doc(db, "provTillfallen", "t-tid"), tillfalleDok({ tidsgransMin: 5 }));
    for (const t of ["t-oppet", "t-forb", "t-stangt", "t-5a", "t-tid"]) {
      const classId = t === "t-5a" ? "5a" : "4a";
      await setDoc(doc(db, "provTillfallen", t, "privat", "facit"), { facit: { f1: { godkanda: ["Birka"] } }, bedomningsstod: {} });
      const elev = classId === "5a" ? "e5a" : "e4a";
      await setDoc(doc(db, "provTillfallen", t, "rattning", elev), {
        elevId: elev, classId, provNamn: "Vikingar", fragor: { f1: { ratt: true, poang: 1, auto: true } }, aterlamnad: false,
      });
    }
    // Svar som redan finns: e4a i t-stangt (inte inlämnat), t-tid startat för 10 min sedan.
    await setDoc(doc(db, "provTillfallen", "t-stangt", "svar", "e4a"), {
      elevId: "e4a", classId: "4a", startad: ts(-5 * MIN), uppdaterad: ts(-MIN), svar: { f1: "Birk" }, inlamnad: false,
    });
    await setDoc(doc(db, "provTillfallen", "t-tid", "svar", "e4a"), {
      elevId: "e4a", classId: "4a", startad: ts(-10 * MIN), uppdaterad: ts(-8 * MIN), svar: {}, inlamnad: false,
    });
    await setDoc(doc(db, "provTillfallen", "t-5a", "svar", "e5a"), {
      elevId: "e5a", classId: "5a", startad: ts(-MIN), uppdaterad: ts(-MIN), svar: { f1: "x" }, inlamnad: false,
    });
  });
});

const elev = (uid) => env.as(uid);
const svarRef = (db, t, uid) => doc(db, "provTillfallen", t, "svar", uid);
const rattRef = (db, t, uid) => doc(db, "provTillfallen", t, "rattning", uid);

describe("prov/{id}: lärarnas, aldrig elevernas", () => {
  it("eleven kan inte läsa provet (facit)", async () => {
    await assertFails(getDoc(doc(elev("e4a"), "prov", "p1")));
  });
  it("årskurskontot läser alla prov (även kollegans) men ändrar och raderar bara sitt eget", async () => {
    await assertSucceeds(getDoc(doc(env.ak4(), "prov", "p5")));
    await assertSucceeds(updateDoc(doc(env.ak4(), "prov", "p1"), { namn: "Vikingarna" }));
    await assertFails(updateDoc(doc(env.ak4(), "prov", "p5"), { namn: "Mitt nu" }));
    await assertFails(deleteDoc(doc(env.ak4(), "prov", "p5")));
    await assertSucceeds(deleteDoc(doc(env.ak4(), "prov", "p1")));
  });
  it("skapa kräver createdBy = sig själv; createdBy kan inte bytas", async () => {
    await assertSucceeds(setDoc(doc(env.ak4(), "prov", "ny"), { namn: "Nytt", fragor: [], createdBy: "ak4" }));
    await assertFails(setDoc(doc(env.ak4(), "prov", "ny2"), { namn: "Nytt", fragor: [], createdBy: "ak5" }));
    await assertFails(updateDoc(doc(env.ak4(), "prov", "p1"), { createdBy: "ak5" }));
    await assertFails(setDoc(doc(elev("e4a"), "prov", "ny3"), { namn: "Elevens", fragor: [], createdBy: "e4a" }));
  });
  it("admin ändrar och raderar andras prov", async () => {
    await assertSucceeds(updateDoc(doc(env.admin(), "prov", "p5"), { namn: "Admins ändring" }));
    await assertSucceeds(deleteDoc(doc(env.admin(), "prov", "p5")));
  });
  it("gränser: namn 1–80 tecken, högst 60 frågor", async () => {
    await assertFails(setDoc(doc(env.ak4(), "prov", "x1"), { namn: "", fragor: [], createdBy: "ak4" }));
    await assertFails(setDoc(doc(env.ak4(), "prov", "x2"), { namn: "a".repeat(81), fragor: [], createdBy: "ak4" }));
    await assertFails(setDoc(doc(env.ak4(), "prov", "x3"), { namn: "a", fragor: Array(61).fill({}), createdBy: "ak4" }));
  });
});

describe("provTillfallen/{t}: läsa", () => {
  it("eleven läser ett öppet/stängt tillfälle i sin klass men inte i en annan klass", async () => {
    await assertSucceeds(getDoc(doc(elev("e4a"), "provTillfallen", "t-oppet")));
    await assertSucceeds(getDoc(doc(elev("e4a"), "provTillfallen", "t-stangt")));
    await assertFails(getDoc(doc(elev("e4a"), "provTillfallen", "t-5a")));
    await assertFails(getDoc(doc(elev("e4b"), "provTillfallen", "t-oppet")));
  });
  it("eleven kan inte läsa ett förberett tillfälle", async () => {
    await assertFails(getDoc(doc(elev("e4a"), "provTillfallen", "t-forb")));
  });
  it("elevens lyssnare: where classId in [...] + status == oppet (live-watch-mönstret)", async () => {
    const q = query(collection(elev("e4a"), "provTillfallen"), where("classId", "in", ["4a"]), where("status", "==", "oppet"));
    const s = await assertSucceeds(getDocs(q));
    assert.deepEqual(s.docs.map((d) => d.id).sort(), ["t-oppet", "t-tid"]);
    const enKlass = query(collection(elev("e4a"), "provTillfallen"), where("classId", "==", "4a"), where("status", "==", "oppet"));
    await assertSucceeds(getDocs(enKlass));
    await assertFails(getDocs(query(collection(elev("e4a"), "provTillfallen"), where("classId", "==", "4a"))));
  });
  it("årskurskontot läser bara sina klassers tillfällen (lista filtrerad på egna klasser)", async () => {
    await assertSucceeds(getDoc(doc(env.ak4(), "provTillfallen", "t-forb")));
    await assertFails(getDoc(doc(env.ak4(), "provTillfallen", "t-5a")));
    const s = await assertSucceeds(getDocs(query(collection(env.ak4(), "provTillfallen"), where("classId", "in", ["4a", "4b"]))));
    assert.equal(s.size, 4);
    await assertFails(getDocs(collection(env.ak4(), "provTillfallen")));
  });
});

describe("provTillfallen/{t}: skapa, statusflöde, radera", () => {
  it("läraren skapar ett förberett tillfälle i sin klass – inte i en annan, inte direkt öppet", async () => {
    await assertSucceeds(setDoc(doc(env.ak4(), "provTillfallen", "n1"), tillfalleDok({ status: "forberett" })));
    await assertFails(setDoc(doc(env.ak4(), "provTillfallen", "n2"), tillfalleDok({ status: "forberett", classId: "5a" })));
    await assertFails(setDoc(doc(env.ak4(), "provTillfallen", "n3"), tillfalleDok()));
    await assertFails(setDoc(doc(env.ak4(), "provTillfallen", "n4"), tillfalleDok({ status: "forberett", createdBy: "ak5" })));
    await assertFails(setDoc(doc(elev("e4a"), "provTillfallen", "n5"), tillfalleDok({ status: "forberett", createdBy: "e4a" })));
  });
  it("forberett → oppet → stangt → oppet; inte tillbaka till förberett, inte byta klass", async () => {
    const ref = doc(env.ak4(), "provTillfallen", "t-forb");
    await assertFails(updateDoc(ref, { status: "stangt" }));
    await assertSucceeds(updateDoc(ref, { status: "oppet", oppnad: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { status: "stangt", stangd: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { status: "oppet" }));
    await assertFails(updateDoc(ref, { status: "forberett" }));
    await assertFails(updateDoc(ref, { classId: "4b" }));
    await assertFails(updateDoc(ref, { tidsgransMin: 3 }));
    await assertSucceeds(updateDoc(ref, { tidsgransMin: 40 }));
  });
  it("en årskurslärare kan inte styra eller radera ett tillfälle i en annan klass", async () => {
    await assertFails(updateDoc(doc(env.ak4(), "provTillfallen", "t-5a"), { status: "stangt" }));
    await assertFails(deleteDoc(doc(env.ak4(), "provTillfallen", "t-5a")));
  });
  it("radera: en klientbatch tar tillfället, facit, svar och rättningar", async () => {
    const db = env.ak4();
    const b = writeBatch(db);
    b.delete(svarRef(db, "t-stangt", "e4a"));
    b.delete(rattRef(db, "t-stangt", "e4a"));
    b.delete(doc(db, "provTillfallen", "t-stangt", "privat", "facit"));
    b.delete(doc(db, "provTillfallen", "t-stangt"));
    await assertSucceeds(b.commit());
    await assertFails(deleteDoc(svarRef(elev("e4a"), "t-tid", "e4a")));
  });
});

describe("privat/facit", () => {
  it("bara läraren med klassen – aldrig eleven", async () => {
    await assertSucceeds(getDoc(doc(env.ak4(), "provTillfallen", "t-oppet", "privat", "facit")));
    await assertFails(getDoc(doc(elev("e4a"), "provTillfallen", "t-oppet", "privat", "facit")));
    await assertFails(getDoc(doc(env.ak4(), "provTillfallen", "t-5a", "privat", "facit")));
    await assertSucceeds(setDoc(doc(env.ak4(), "provTillfallen", "t-forb", "privat", "facit"), { facit: {}, bedomningsstod: {} }));
    await assertFails(setDoc(doc(env.ak4(), "provTillfallen", "t-forb", "privat", "annat"), { x: 1 }));
  });
});

describe("svar/{elevUid}: eleven", () => {
  it("skapar sitt eget i ett öppet prov i sin klass, med startad = serverns tid", async () => {
    await assertSucceeds(setDoc(svarRef(elev("e4a"), "t-oppet", "e4a"), svarDok("e4a", "4a")));
    await assertFails(setDoc(svarRef(elev("e4a"), "t-oppet", "e4b"), svarDok("e4b", "4a")), "någon annans");
    await assertFails(setDoc(svarRef(elev("e4b"), "t-oppet", "e4b"), svarDok("e4b", "4a")), "inte i klassen");
    await assertFails(setDoc(svarRef(elev("e4a"), "t-forb", "e4a"), svarDok("e4a", "4a")), "förberett");
    await assertFails(setDoc(svarRef(elev("e4a"), "t-stangt", "e4x"), svarDok("e4x", "4a")));
    await assertFails(setDoc(svarRef(elev("e4a"), "t-oppet", "e4a"), svarDok("e4a", "4a", { startad: ts(-30 * MIN) })), "startad bakåt");
    await assertFails(setDoc(svarRef(elev("e4a"), "t-oppet", "e4a"), svarDok("e4a", "4b")), "fel classId");
    await assertFails(setDoc(svarRef(elev("e4a"), "t-oppet", "e4a"), svarDok("e4a", "4a", { coins: 100 })), "främmande fält");
  });
  it("sparar, lämnar in – och kan sedan inte ändra något mer", async () => {
    const ref = svarRef(elev("e4a"), "t-oppet", "e4a");
    await assertSucceeds(setDoc(ref, svarDok("e4a", "4a")));
    await assertSucceeds(updateDoc(ref, { "svar.f1": "Birka!", uppdaterad: serverTimestamp() }));
    await assertFails(updateDoc(ref, { "svar.f1": "x", uppdaterad: ts(-MIN) }), "uppdaterad = serverns tid");
    await assertFails(updateDoc(ref, { startad: serverTimestamp(), uppdaterad: serverTimestamp() }), "startad låst");
    await assertFails(updateDoc(ref, { elevId: "e4b", uppdaterad: serverTimestamp() }), "elevId låst");
    await assertFails(updateDoc(ref, { inlamnad: true, inlamnadNar: "stangt", inlamnadAt: serverTimestamp(), uppdaterad: serverTimestamp() }), "eleven stänger inte");
    await assertSucceeds(updateDoc(ref, { inlamnad: true, inlamnadNar: "elev", inlamnadAt: serverTimestamp(), uppdaterad: serverTimestamp() }));
    await assertFails(updateDoc(ref, { "svar.f1": "ändrat efteråt", uppdaterad: serverTimestamp() }), "efter inlämning");
    await assertFails(updateDoc(ref, { inlamnad: false, uppdaterad: serverTimestamp() }), "inlämnat är slutgiltigt");
  });
  it("kan inte skriva efter tidsgränsen + 2 min", async () => {
    const ref = svarRef(elev("e4a"), "t-tid", "e4a"); // startad −10 min, gräns 5 + 2 min
    await assertFails(updateDoc(ref, { "svar.f1": "sent", uppdaterad: serverTimestamp() }));
    await assertFails(updateDoc(ref, { inlamnad: true, inlamnadNar: "tid", inlamnadAt: serverTimestamp(), uppdaterad: serverTimestamp() }));
    // Inom gränsen + marginalen går det (startad −6 min < 5 + 2 min).
    await env.seed((db) => updateDoc(svarRef(db, "t-tid", "e4a"), { startad: ts(-6 * MIN) }));
    await assertSucceeds(updateDoc(ref, { "svar.f1": "i tid", uppdaterad: serverTimestamp() }));
  });
  it("kan inte skriva när provet är stängt", async () => {
    await assertFails(updateDoc(svarRef(elev("e4a"), "t-stangt", "e4a"), { "svar.f1": "Birka", uppdaterad: serverTimestamp() }));
  });
  it("storlek: högst 60 svar", async () => {
    const svar = Object.fromEntries(Array.from({ length: 61 }, (_, i) => [`f${i}`, "x"]));
    await assertFails(setDoc(svarRef(elev("e4a"), "t-oppet", "e4a"), svarDok("e4a", "4a", { svar })));
  });
  it("kan inte läsa andra elevers svar; läser sitt eget", async () => {
    await assertSucceeds(getDoc(svarRef(elev("e4a"), "t-tid", "e4a")));
    await assertFails(getDoc(svarRef(elev("e4b"), "t-tid", "e4a")));
    await assertFails(getDocs(collection(elev("e4a"), "provTillfallen", "t-tid", "svar")));
  });
});

describe("svar/{elevUid}: läraren", () => {
  it("läser klassens svar (en lista per tillfälle) – inte en annan klass", async () => {
    const s = await assertSucceeds(getDocs(collection(env.ak4(), "provTillfallen", "t-tid", "svar")));
    assert.equal(s.size, 1);
    await assertFails(getDocs(collection(env.ak4(), "provTillfallen", "t-5a", "svar")));
    await assertFails(getDoc(svarRef(env.ak4(), "t-5a", "e5a")));
  });
  it("kan inte ändra elevens svar", async () => {
    await assertFails(updateDoc(svarRef(env.ak4(), "t-stangt", "e4a"), { "svar.f1": "Birka" }));
    await assertFails(updateDoc(svarRef(env.admin(), "t-stangt", "e4a"), { "svar.f1": "Birka" }));
    await assertFails(setDoc(svarRef(env.ak4(), "t-oppet", "e4a"), svarDok("e4a", "4a")));
  });
  it("markerar inlämnad när provet stängs, och tar bort just den markeringen om provet öppnas igen", async () => {
    const ref = svarRef(env.ak4(), "t-stangt", "e4a");
    await assertFails(updateDoc(ref, { inlamnad: true, inlamnadNar: "elev", inlamnadAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { inlamnad: true, inlamnadNar: "stangt", inlamnadAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { inlamnad: false, inlamnadNar: deleteField(), inlamnadAt: deleteField() }));
    await assertFails(updateDoc(svarRef(env.ak5(), "t-tid", "e4a"), { inlamnad: true, inlamnadNar: "stangt", inlamnadAt: serverTimestamp() }));
  });
  it("öppnar inte elevens egen inlämning igen", async () => {
    const e = svarRef(elev("e4a"), "t-oppet", "e4a");
    await assertSucceeds(setDoc(e, svarDok("e4a", "4a", { inlamnad: true, inlamnadNar: "elev", inlamnadAt: serverTimestamp() })));
    await assertFails(updateDoc(svarRef(env.ak4(), "t-oppet", "e4a"), { inlamnad: false, inlamnadNar: deleteField(), inlamnadAt: deleteField() }));
  });
});

describe("rattning/{elevUid}", () => {
  it("eleven kan inte läsa sin rättning före tillbakalämningen, men efter", async () => {
    await assertFails(getDoc(rattRef(elev("e4a"), "t-oppet", "e4a")));
    await assertSucceeds(updateDoc(rattRef(env.ak4(), "t-oppet", "e4a"), { aterlamnad: true, aterlamnadAt: serverTimestamp() }));
    await assertSucceeds(getDoc(rattRef(elev("e4a"), "t-oppet", "e4a")));
    await assertFails(getDoc(rattRef(elev("e4b"), "t-oppet", "e4a")), "andras rättning");
  });
  it("en rättning som inte finns kan eleven fråga efter (ingen behörighetsfel)", async () => {
    await assertSucceeds(getDoc(rattRef(elev("e4b"), "t-oppet", "e4b")));
  });
  it("eleven kan aldrig skriva en rättning", async () => {
    await assertFails(setDoc(rattRef(elev("e4a"), "t-oppet", "e4a"), {
      elevId: "e4a", classId: "4a", fragor: {}, aterlamnad: true,
    }));
  });
  it("läraren rättar sin klass – en årskurslärare kan inte läsa eller rätta en annan klass", async () => {
    await assertSucceeds(setDoc(rattRef(env.ak4(), "t-oppet", "e4b"), {
      elevId: "e4b", classId: "4a", provNamn: "Vikingar", fragor: { f1: { ratt: "delvis", poang: 0.5, auto: false } },
      aterlamnad: false, niva: "G",
    }));
    await assertFails(setDoc(rattRef(env.ak4(), "t-oppet", "e4x"), { elevId: "annan", classId: "4a", fragor: {}, aterlamnad: false }));
    await assertFails(setDoc(rattRef(env.ak4(), "t-oppet", "e4b"), { elevId: "e4b", classId: "5a", fragor: {}, aterlamnad: false }));
    await assertFails(setDoc(rattRef(env.ak4(), "t-oppet", "e4b"), { elevId: "e4b", classId: "4a", fragor: {}, aterlamnad: false, niva: "A" }));
    await assertFails(getDoc(rattRef(env.ak4(), "t-5a", "e5a")));
    await assertFails(getDocs(collection(env.ak4(), "provTillfallen", "t-5a", "rattning")));
    await assertFails(updateDoc(rattRef(env.ak4(), "t-5a", "e5a"), { aterlamnad: true }));
    await assertSucceeds(getDocs(collection(env.ak5(), "provTillfallen", "t-5a", "rattning")));
  });
  it("ångra tillbakalämning: aterlamnad false och facit bort", async () => {
    const ref = rattRef(env.ak4(), "t-oppet", "e4a");
    await assertSucceeds(updateDoc(ref, { aterlamnad: true, aterlamnadAt: serverTimestamp(), facit: { f1: { godkanda: ["Birka"] } } }));
    await assertSucceeds(updateDoc(ref, { aterlamnad: false, aterlamnadAt: deleteField(), facit: deleteField() }));
    await assertFails(getDoc(rattRef(elev("e4a"), "t-oppet", "e4a")));
  });
});

describe("collection group rattning", () => {
  it("eleven: sina tillbakalämnade (elevId + aterlamnad, nyast först, högst 10)", async () => {
    await env.seed((db) => updateDoc(rattRef(db, "t-oppet", "e4a"), { aterlamnad: true, aterlamnadAt: ts(-MIN) }));
    const db = elev("e4a");
    const q = query(collectionGroup(db, "rattning"), where("elevId", "==", "e4a"), where("aterlamnad", "==", true),
      orderBy("aterlamnadAt", "desc"), limit(10));
    const s = await assertSucceeds(getDocs(q));
    assert.deepEqual(s.docs.map((d) => d.ref.parent.parent.id), ["t-oppet"]);
    await assertFails(getDocs(query(collectionGroup(db, "rattning"), where("elevId", "==", "e4a"))), "utan aterlamnad");
    await assertFails(getDocs(query(collectionGroup(db, "rattning"), where("elevId", "==", "e5a"), where("aterlamnad", "==", true))));
  });
  it("läraren: en klass i taget (statistikfliken)", async () => {
    const s = await assertSucceeds(getDocs(query(collectionGroup(env.ak4(), "rattning"), where("classId", "==", "4a"))));
    assert.equal(s.size, 4);
    await assertFails(getDocs(query(collectionGroup(env.ak4(), "rattning"), where("classId", "==", "5a"))));
    await assertFails(getDocs(collectionGroup(env.ak4(), "rattning")));
    await assertSucceeds(getDocs(collectionGroup(env.admin(), "rattning")));
  });
});
