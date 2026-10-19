// ============================================================================
// Tester-sonden (#810): större batch, kantfall. Regel-tester: Prov – helskärmsläget (#810, spec §5.6) med EXAKT de
// skrivningar som src/prov/prov-elev-data.js och prov-tillfalle-data.js gör:
//   pausa         eleven: svar + pausad/pausadAt/pausOrsak/flikbyten/pausLogg i EN skrivning
//   (pausad)      alla elevens sparningar nekas – utom tidens inlämning (lamnaInPausad)
//   slappIn       läraren: BARA pausad → false + slapptInAt (+5 min i tillfällets extraTid)
//   lyssnaPausade where("pausad","==",true) – läser inget vid vanliga sparningar (mätt)
// Riggen: test/helpers/roller-env.js, plus en andra elev i 4a (e4a2).
// Körs av `npm run test:rules` (kräver emulatorn).
// ============================================================================

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  addDoc, collection, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch, Timestamp,
} from "firebase/firestore";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";

let env;
const MIN = 60 * 1000;
const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
const FRAGOR = [{ id: "f1", typ: "kortsvar", fraga: "Vilken stad?", poang: 1 }];

before(async () => { env = await createRollerEnv("pluggportalen-rules-test-prov-helskarm-tester"); });
after(async () => { if (env) await env.testEnv.cleanup(); });

const tillfalleDok = (over = {}) => ({
  provId: "p1", provNamn: "Vikingaprovet", classId: "4a", createdBy: "ak4", createdByName: "Årskurs 4",
  status: "oppet", fragor: FRAGOR, installningar: { poang: true }, tidsgransMin: null,
  helskarm: true, helskarmUndantag: [], ...over,
});
const svarRef = (db, t, uid) => doc(db, "provTillfallen", t, "svar", uid);
const tfRef = (db, t) => doc(db, "provTillfallen", t);
const startat = (uid, sedan, over = {}) => ({
  elevId: uid, classId: "4a", startad: ts(-sedan), uppdaterad: ts(-MIN), svar: {}, inlamnad: false, ...over,
});
const pausatDok = (uid, sedan, over = {}) => startat(uid, sedan, {
  pausad: true, pausadAt: ts(-MIN), pausOrsak: "flik", flikbyten: 1, pausLogg: [{ at: Date.now() - MIN, orsak: "flik" }], ...over,
});

beforeEach(async () => {
  await env.testEnv.clearFirestore();
  await seedRoller(env);
  await env.seed(async (db) => {
    await setDoc(doc(db, "students", "e4a2"), { namn: "e4a2", username: "e4a2", classIds: ["4a"] });
    await updateDoc(doc(db, "classes", "4a"), { studentIds: ["e4a", "e4a2"] });
    await setDoc(tfRef(db, "t1"), tillfalleDok());
    await setDoc(tfRef(db, "t-tid"), tillfalleDok({ tidsgransMin: 5 }));
  });
});

// prov-elev-data.js
const starta = (db, t, uid, extra = {}) => setDoc(svarRef(db, t, uid), {
  elevId: uid, classId: "4a", startad: serverTimestamp(), uppdaterad: serverTimestamp(), svar: {}, inlamnad: false, ...extra,
});
const spara = (db, t, uid, svar, extra = {}) => updateDoc(svarRef(db, t, uid), { svar, uppdaterad: serverTimestamp(), ...extra });
const lamnaIn = (db, t, uid, svar, nar) => updateDoc(svarRef(db, t, uid), {
  svar, uppdaterad: serverTimestamp(), inlamnad: true, inlamnadNar: nar, inlamnadAt: serverTimestamp(),
});
const pausa = (db, t, uid, svar, orsak = "flik", over = {}) => updateDoc(svarRef(db, t, uid), {
  svar, uppdaterad: serverTimestamp(), pausad: true, pausadAt: serverTimestamp(), pausOrsak: orsak,
  flikbyten: 1, pausLogg: [{ at: Date.now(), orsak }], ...over,
});
const lamnaInPausad = (db, t, uid) => updateDoc(svarRef(db, t, uid), {
  uppdaterad: serverTimestamp(), inlamnad: true, inlamnadNar: "tid", inlamnadAt: serverTimestamp(),
});
// prov-tillfalle-data.js
const slappIn = (db, t, uid) => updateDoc(svarRef(db, t, uid), { pausad: false, slapptInAt: serverTimestamp() });


describe("tester-sonder", () => {
  it("Släpp in alla för 30 pausade i en batch + extraTid (rules-åtkomstgräns)", async () => {
    const uids = Array.from({ length: 30 }, (_, i) => "x" + i);
    await env.seed(async (db) => {
      await updateDoc(doc(db, "classes", "4a"), { studentIds: uids });
      for (const u of uids) { await setDoc(doc(db, "students", u), { namn: u, username: u, classIds: ["4a"] }); await setDoc(svarRef(db, "t-tid", u), pausatDok(u, MIN)); }
    });
    const db = env.ak4();
    const b = writeBatch(db);
    const ex = {};
    for (const u of uids) { b.update(svarRef(db, "t-tid", u), { pausad: false, slapptInAt: serverTimestamp() }); ex[u] = 5; }
    b.update(tfRef(db, "t-tid"), { extraTid: ex });
    await assertSucceeds(b.commit());
  });
  it("eleven kan inte pausa sig i annans dokument eller skriva extraTid", async () => {
    await env.seed((db) => setDoc(svarRef(db, "t-tid", "e4a"), startat("e4a", MIN)));
    await assertFails(pausa(env.as("e4a2"), "t-tid", "e4a", {}));
    await assertFails(updateDoc(tfRef(env.as("e4a"), "t-tid"), { extraTid: { e4a: 100 } }));
  });
  it("pausad + stängd av läraren: eleven kan inte häva", async () => {
    await env.seed((db) => setDoc(svarRef(db, "t-tid", "e4a"), pausatDok("e4a", MIN)));
    await assertFails(updateDoc(svarRef(env.as("e4a"), "t-tid", "e4a"), { uppdaterad: serverTimestamp(), pausad: false }));
    await assertFails(updateDoc(svarRef(env.as("e4a"), "t-tid", "e4a"), { uppdaterad: serverTimestamp(), pausOrsak: "fokus" }));
    await assertFails(updateDoc(svarRef(env.as("e4a"), "t-tid", "e4a"), { uppdaterad: serverTimestamp(), pausLogg: [] }));
  });
  it("lärare kan inte släppa in och samtidigt röra inlamnad", async () => {
    await env.seed((db) => setDoc(svarRef(db, "t-tid", "e4a"), pausatDok("e4a", MIN)));
    await assertFails(updateDoc(svarRef(env.ak4(), "t-tid", "e4a"), { pausad: false, slapptInAt: serverTimestamp(), inlamnad: true, inlamnadNar: "stangt", inlamnadAt: serverTimestamp() }));
  });
  it("stängt tillfälle: ingen paus och inget släpp in från elev", async () => {
    await env.seed(async (db) => { await setDoc(svarRef(db, "t-tid", "e4a"), startat("e4a", MIN)); await updateDoc(tfRef(db, "t-tid"), { status: "stangt" }); });
    await assertFails(pausa(env.as("e4a"), "t-tid", "e4a", {}));
  });
  it("pausLogg över 200 nekas, pausad som sträng nekas", async () => {
    await env.seed((db) => setDoc(svarRef(db, "t-tid", "e4a"), startat("e4a", MIN)));
    await assertFails(pausa(env.as("e4a"), "t-tid", "e4a", {}, "flik", { pausLogg: Array.from({ length: 201 }, () => ({ at: 1, orsak: "flik" })) }));
    await assertFails(updateDoc(svarRef(env.as("e4a"), "t-tid", "e4a"), { uppdaterad: serverTimestamp(), pausad: "ja" }));
  });
});
