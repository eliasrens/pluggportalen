// ============================================================================
// #779 Schack 2A, fuskprov 3/3 – grinden (modul/fokus/klass), lärarcallables och Firestore-reglerna (direktskrivning/läsning).
// Rigg: test/helpers/schack-fusk-rig.mjs. Körs mot functions + auth + firestore
// (test:functions, --test-concurrency=1).
// ============================================================================

import assert from "node:assert/strict";
import { test, after } from "node:test";
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, increment, deleteField,
} from "firebase/firestore";
import {
  adb, KLASS, KLASS_B, ANNA, BO, CIA, DAN, ADMIN, AK, AK5, AKOFF, ADMOFF, who, code, getP, getK, reset, nytt, seed, stang,
} from "./helpers/schack-fusk-rig.mjs";

after(stang);
test("seed", seed);

// --- modul / fokus / klass -------------------------------------------------------------

test("modul av, hiddenModules, fokusläge (alla låstyper), fel klass: alla elevcallables nekas; pågående parti fryst", async () => {
  await reset();
  const { partiId, vit } = await nytt(ANNA, BO);
  const v = await who(vit);
  const names = [
    ["schackVanta", { classId: KLASS, klocka: null }], ["schackSlutaVanta", { classId: KLASS }], ["schackGaMed", { classId: KLASS, motstandare: CIA }],
    ["schackUtmana", { classId: KLASS, till: CIA, klocka: null }], ["schackDrag", { partiId, from: "e2", to: "e4" }],
    ["schackGeUpp", { partiId }], ["schackRemi", { partiId, handling: "erbjud" }], ["schackKravaVinst", { partiId }],
  ];
  const nek = async (kommentar) => {
    for (const [n, d] of names) {
      const c = await code(v.call(n, d));
      assert.notEqual(c, "ok", `${kommentar}: ${n}`);
    }
  };
  await adb.doc(`classes/${KLASS}`).update({ enabledModules: [] });
  await nek("modul av");
  await adb.doc(`classes/${KLASS}`).update({ enabledModules: ["schack"], hiddenModules: ["schack"] });
  await nek("dold");
  await adb.doc(`classes/${KLASS}`).update({ hiddenModules: [], lock: { mal: { typ: "omrade", id: "x" }, till: Date.now() + 60_000 } });
  await nek("fokus omrade");
  await adb.doc(`classes/${KLASS}`).update({ lock: { mal: { typ: "schack" }, till: Date.now() + 60_000 } });
  await nek("fokus mal.typ=schack");
  // utgånget lås öppnar igen
  await adb.doc(`classes/${KLASS}`).update({ lock: { mal: { typ: "lasresan" }, till: Date.now() - 1000 } });
  assert.equal(await code(v.call("schackDrag", { partiId, from: "e2", to: "e4" })), "ok");
  // eleven flyttas ur klassen
  await adb.doc(`classes/${KLASS}`).update({ studentIds: [CIA] });
  await nek("borttagen ur klassen");
});

test("lärarkonto (arskurs/admin) kan inte använda elevcallables, även med klassen", async () => {
  await reset();
  const { partiId } = await nytt(ANNA, BO);
  for (const t of [AK, ADMIN]) {
    const c = await who(t);
    assert.equal(await code(c.call("schackVanta", { classId: KLASS, klocka: null })), "permission-denied", t);
    assert.equal(await code(c.call("schackDrag", { partiId, from: "e2", to: "e4" })), "permission-denied", t);
    assert.equal(await code(c.call("schackGeUpp", { partiId })), "permission-denied", t);
  }
});

// --- lärarcallables ------------------------------------------------------------------------

test("lärarcallables: elev, fel klass, avstängt konto och avstängd admin nekas; rätt lärare och admin ok", async () => {
  await reset();
  const { partiId, vit, svart } = await nytt(ANNA, BO);
  for (const u of [ANNA, AK5, AKOFF, ADMOFF]) {
    const c = await who(u);
    assert.equal(await code(c.call("schackLarareAvsluta", { partiId })), "permission-denied", `avsluta ${u}`);
    assert.equal(await code(c.call("schackLarareTopplista", { classId: KLASS, dold: true })), "permission-denied", `topplista ${u}`);
  }
  assert.equal((await getP(partiId)).status, "pagar");
  assert.equal((await getK()).dold, false);
  const ak = await who(AK);
  for (const d of [{ classId: KLASS }, { classId: KLASS, dold: "true" }, { classId: KLASS, dold: 1 }, { classId: KLASS, dold: [] }, { classId: "a/b", dold: true }]) {
    assert.equal(await code(ak.call("schackLarareTopplista", d)), "invalid-argument", JSON.stringify(d));
  }
  assert.equal(await code(ak.call("schackLarareAvsluta", { partiId: "finnsinte" })), "not-found");
  const r = await ak.call("schackLarareAvsluta", { partiId });
  assert.deepEqual(r.slut, { resultat: null, orsak: "avbrutet" });
  const p = await getP(partiId);
  assert.deepEqual([p.status, p.orsak, p.resultat], ["slut", "avbrutet", null]);
  assert.deepEqual((await getK()).tabell, {}, "tabellen orörd");
  assert.equal(await code(ak.call("schackLarareAvsluta", { partiId })), "failed-precondition");
  // spelarna kan inte längre dra
  const v = await who(vit);
  assert.equal(await code(v.call("schackDrag", { partiId, from: "e2", to: "e4" })), "failed-precondition");
  assert.ok(svart);
  // dölj + nollställ i ett anrop; bara dold ändrar inte tabellen
  await adb.doc(`schackKlass/${KLASS}`).update({ tabell: { [ANNA]: { poang: 1100, vinster: 1, forluster: 0, remier: 0, partier: 1 } } });
  assert.deepEqual(await ak.call("schackLarareTopplista", { classId: KLASS, dold: true }), { dold: true, nollstalld: false });
  assert.equal((await getK()).tabell[ANNA].poang, 1100);
  assert.deepEqual(await ak.call("schackLarareTopplista", { classId: KLASS, nollstall: true }), { dold: true, nollstalld: true });
  assert.deepEqual((await getK()).tabell, {});
  const adm = await who(ADMIN);
  assert.deepEqual(await adm.call("schackLarareTopplista", { classId: KLASS, dold: false }), { dold: false, nollstalld: false });
});

test("lärare kan avsluta parti även när modulen är av / fokusläge (läraren stänger lektionen)", async () => {
  await reset();
  const { partiId } = await nytt(ANNA, BO);
  await adb.doc(`classes/${KLASS}`).update({ enabledModules: [], lock: { mal: { typ: "lasresan" }, till: Date.now() + 60_000 } });
  const ak = await who(AK);
  const r = await ak.call("schackLarareAvsluta", { partiId });
  assert.equal(r.slut.orsak, "avbrutet");
});

// --- reglerna: direktskrivning -------------------------------------------------------

test("reglerna: ingen klient (elev, lärare, admin) kan skapa/ändra/radera schackKlass eller schackPartier", async () => {
  await reset();
  const { partiId, vit } = await nytt(ANNA, BO);
  const res = [];
  for (const u of [vit, CIA, AK, ADMIN]) {
    const c = await who(u);
    for (const [namn, ref] of [["klass", doc(c.db, "schackKlass", KLASS)], ["nyKlass", doc(c.db, "schackKlass", "scf-ny")], ["parti", doc(c.db, "schackPartier", partiId)], ["nyttParti", doc(c.db, "schackPartier", "scf-nytt")]]) {
      res.push([u, namn, "set", await code(setDoc(ref, { classId: KLASS, vit: u, svart: u, tur: "w", dold: true }))]);
      res.push([u, namn, "update", await code(updateDoc(ref, { tur: "b", dold: true }))]);
      res.push([u, namn, "merge", await code(setDoc(ref, { tabell: { [u]: { poang: 9999 } } }, { merge: true }))]);
      res.push([u, namn, "delete", await code(deleteDoc(ref))]);
    }
  }
  assert.deepEqual(res.filter(([, , , c]) => c === "ok"), []);
  assert.equal((await getP(partiId)).tur, "w");
});

test("reglerna: studentData.schack – bara datorPartier +1, inga andra nycklar, aldrig minska/ta bort, inte andras", async () => {
  await reset();
  const anna = await who(ANNA);
  const ref = doc(anna.db, "studentData", ANNA);
  assert.equal(await code(updateDoc(ref, { "schack.datorPartier": increment(1) })), "ok");
  assert.equal(await code(updateDoc(ref, { "schack.datorPartier": increment(1) })), "ok");
  const neka = {
    hopp2: { "schack.datorPartier": increment(2) },
    minska: { "schack.datorPartier": increment(-1) },
    nollstall: { "schack.datorPartier": 0 },
    text: { "schack.datorPartier": "7" },
    flyt: { "schack.datorPartier": 3.5 },
    annanNyckel: { "schack.poang": 1, "schack.datorPartier": increment(1) },
    bara_annan: { "schack.lektioner": 1 },
    hel: { schack: { datorPartier: 99 } },
    tabort: { schack: deleteField() },
    nullas: { schack: null },
    text_hel: { schack: "x" },
    lista: { schack: [1] },
  };
  const ut = {};
  for (const [k, d] of Object.entries(neka)) ut[k] = await code(updateDoc(ref, d));
  assert.deepEqual(Object.entries(ut).filter(([, c]) => c === "ok"), [], JSON.stringify(ut));
  assert.equal((await adb.doc(`studentData/${ANNA}`).get()).data().schack.datorPartier, 2);
  // någon annans dokument
  const bo = await who(BO);
  assert.equal(await code(updateDoc(doc(bo.db, "studentData", ANNA), { "schack.datorPartier": increment(1) })), "permission-denied");
  // läraren med klassen (gradeStudent) och admin-claims-läraren
  for (const t of [AK, AK5]) {
    const c = await who(t);
    assert.notEqual(await code(updateDoc(doc(c.db, "studentData", ANNA), { "schack.datorPartier": increment(1) })), "ok", t);
    assert.notEqual(await code(updateDoc(doc(c.db, "studentData", ANNA), { schack: { datorPartier: 500 } })), "ok", t);
  }
  assert.equal((await adb.doc(`studentData/${ANNA}`).get()).data().schack.datorPartier, 2);
});

test("reglerna: studentData utan schack kan fortfarande skrivas (coins mm) – schackOk bryter inget", async () => {
  await reset();
  const cia = await who(CIA);
  assert.equal(await code(updateDoc(doc(cia.db, "studentData", CIA), { coins: 5 })), "ok");
  assert.equal(await code(setDoc(doc(cia.db, "studentData", CIA), { coins: 7 }, { merge: true })), "ok");
  // första skrivning med schack på ett dokument som saknas
  assert.equal(await code(setDoc(doc(cia.db, "studentData", CIA), { coins: 7, schack: { datorPartier: 1 } })), "ok");
  assert.equal(await code(setDoc(doc(cia.db, "studentData", CIA), { coins: 7, schack: { datorPartier: 50 } })), "permission-denied", "hopp 1→50 via set");
});

test("reglerna: läsning – annan klass, medspelare i klassen, saknat parti, listfrågor", async () => {
  await reset();
  const { partiId, vit, svart } = await nytt(ANNA, BO);
  const cia = await who(CIA);
  const dan = await who(DAN);
  const ak = await who(AK);
  const ak5 = await who(AK5);
  const v = await who(vit);
  const s = await who(svart);
  assert.equal(await code(getDoc(doc(v.db, "schackPartier", partiId))), "ok");
  assert.equal(await code(getDoc(doc(s.db, "schackPartier", partiId))), "ok");
  assert.equal(await code(getDoc(doc(cia.db, "schackPartier", partiId))), "permission-denied");
  assert.equal(await code(getDoc(doc(dan.db, "schackPartier", partiId))), "permission-denied");
  assert.equal(await code(getDoc(doc(ak.db, "schackPartier", partiId))), "ok");
  assert.equal(await code(getDoc(doc(ak5.db, "schackPartier", partiId))), "permission-denied");
  assert.equal(await code(getDoc(doc(cia.db, "schackKlass", KLASS))), "ok");
  assert.equal(await code(getDoc(doc(dan.db, "schackKlass", KLASS))), "permission-denied");
  assert.equal(await code(getDoc(doc(ak.db, "schackKlass", KLASS))), "ok");
  assert.equal(await code(getDoc(doc(ak5.db, "schackKlass", KLASS))), "permission-denied");
  // klass utan dokument: medlemmen får ett tomt snapshot, inget fel
  assert.equal(await code(getDoc(doc(cia.db, "schackKlass", "scf-finns-inte"))), "permission-denied", "inte medlem i klassen som inte finns");
  assert.equal(await code(getDoc(doc(dan.db, "schackKlass", KLASS_B))), "ok");
  // saknat parti (listenerns 'cb(null)')
  const saknat = await code(getDoc(doc(cia.db, "schackPartier", "scf-saknas")));
  console.log("  [info] läsa saknat schackPartier som elev →", saknat);
  // list-frågor
  assert.equal(await code(getDocs(collection(cia.db, "schackPartier"))), "permission-denied");
  assert.equal(await code(getDocs(query(collection(cia.db, "schackPartier"), where("classId", "==", KLASS)))), "permission-denied");
  assert.equal(await code(getDocs(collection(cia.db, "schackKlass"))), "permission-denied");
  assert.equal(await code(getDocs(query(collection(ak.db, "schackPartier"), where("classId", "==", KLASS)))), "ok");
  assert.equal(await code(getDocs(query(collection(ak5.db, "schackPartier"), where("classId", "==", KLASS)))), "permission-denied");
  assert.equal(await code(getDocs(query(collection(v.db, "schackPartier"), where("vit", "==", vit)))), "ok", "spelaren listar egna partier");
});
