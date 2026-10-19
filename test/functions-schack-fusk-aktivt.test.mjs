// ============================================================================
// #779 Schack 2A, fuskprov 4/4 – omtest: spärren studentData.schack.aktivtParti (F2),
// regeln för saknade partier (F4) och lobbyanrop utan ändring.
// Rigg: test/helpers/schack-fusk-rig.mjs. Körs mot functions + auth + firestore.
// ============================================================================

import assert from "node:assert/strict";
import { test, after } from "node:test";
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, documentId, increment, deleteField,
} from "firebase/firestore";
import {
  adb, KLASS, KLASS_B, ANNA, BO, CIA, DAN, AK, who, code, getP, getK, reset, nytt, seed, stang,
} from "./helpers/schack-fusk-rig.mjs";

after(stang);
test("seed", seed);

const akt = async (u) => (await adb.doc(`studentData/${u}`).get()).data()?.schack?.aktivtParti ?? null;
const ned = (m) => Date.now() - m * 60_000;

// --- F4: saknat parti läsbart, inget annat läcker ------------------------------------------

test("F4: saknat parti → tomt svar för inloggad; utloggad nekas; existerande annans parti, listor och documentId-frågor nekas", async () => {
  await reset();
  const { partiId, vit } = await nytt(ANNA, BO);
  const cia = await who(CIA);
  const dan = await who(DAN);
  const v = await who(vit);
  const snap = await getDoc(doc(cia.db, "schackPartier", "scf-saknas-helt"));
  assert.equal(snap.exists(), false);
  assert.equal(await code(getDoc(doc(cia.db, "schackPartier", partiId))), "permission-denied");
  assert.equal(await code(getDoc(doc(dan.db, "schackPartier", partiId))), "permission-denied");
  const ut = {};
  const fraga = {
    allt: collection(cia.db, "schackPartier"),
    klass: query(collection(cia.db, "schackPartier"), where("classId", "==", KLASS)),
    id_lika: query(collection(cia.db, "schackPartier"), where(documentId(), "==", partiId)),
    id_in: query(collection(cia.db, "schackPartier"), where(documentId(), "in", [partiId, "scf-saknas-helt"])),
    vit_lika: query(collection(cia.db, "schackPartier"), where("vit", "==", vit)),
    status: query(collection(cia.db, "schackPartier"), where("status", "==", "pagar")),
  };
  for (const [k, q] of Object.entries(fraga)) {
    try {
      ut[k] = (await getDocs(q)).size;
    } catch (e) {
      ut[k] = String(e.code).replace("firestore/", "");
    }
  }
  assert.deepEqual(Object.entries(ut).filter(([, r]) => r !== "permission-denied"), [], JSON.stringify(ut));
  // spelaren ser sitt eget
  assert.equal((await getDoc(doc(v.db, "schackPartier", partiId))).exists(), true);
  // utloggad (egen app utan inloggning)
  const { initializeApp, deleteApp } = await import("firebase/app");
  const { getFirestore, connectFirestoreEmulator } = await import("firebase/firestore");
  const app = initializeApp({ apiKey: "x", projectId: "pluggportalen-so-2026" }, "scf-anon");
  const adb2 = getFirestore(app);
  const [h, p] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
  connectFirestoreEmulator(adb2, h, Number(p));
  try {
    assert.equal(await code(getDoc(doc(adb2, "schackPartier", "scf-saknas-helt"))), "permission-denied");
    assert.equal(await code(getDoc(doc(adb2, "schackKlass", KLASS))), "permission-denied");
  } finally {
    await deleteApp(app);
  }
});

// --- F2: aktivtParti, klientens möjligheter ---------------------------------------------------

test("aktivtParti sätts för båda vid start och klienten kan inte sätta, rensa eller ändra det", async () => {
  await reset();
  const { partiId, vit, svart } = await nytt(ANNA, BO);
  assert.equal(await akt(vit), partiId);
  assert.equal(await akt(svart), partiId);
  const c = await who(vit);
  const ref = doc(c.db, "studentData", vit);
  const forsok = {
    nollstall_punkt: () => updateDoc(ref, { "schack.aktivtParti": null }),
    byt_punkt: () => updateDoc(ref, { "schack.aktivtParti": "annat" }),
    ta_bort_punkt: () => updateDoc(ref, { "schack.aktivtParti": deleteField() }),
    hel_schack_tom: () => updateDoc(ref, { schack: {} }),
    hel_schack_bara_dator: () => updateDoc(ref, { schack: { datorPartier: 1 } }),
    hel_schack_borta: () => updateDoc(ref, { schack: deleteField() }),
    hel_schack_null: () => updateDoc(ref, { schack: null }),
    merge_null: () => setDoc(ref, { schack: { aktivtParti: null } }, { merge: true }),
    merge_tomt: () => setDoc(ref, { schack: {} }, { merge: true }),
    set_utan_schack: () => setDoc(ref, { coins: 5 }),
    set_med_andra: () => setDoc(ref, { coins: 5, schack: { aktivtParti: "x" } }),
    annan_nyckel: () => updateDoc(ref, { "schack.poang": 1 }),
  };
  const ut = {};
  for (const [k, f] of Object.entries(forsok)) ut[k] = await code(f());
  assert.deepEqual(Object.entries(ut).filter(([, r]) => r === "ok"), [], JSON.stringify(ut));
  assert.equal(await akt(vit), partiId);
  // motspelarens dokument
  const o = await who(svart);
  assert.notEqual(await code(updateDoc(doc(o.db, "studentData", vit), { "schack.aktivtParti": null })), "ok");
});

test("datorPartier +1 fungerar fortfarande med aktivtParti satt, null och saknat; +2 nekas", async () => {
  await reset();
  const anna = await who(ANNA);
  const ref = doc(anna.db, "studentData", ANNA);
  assert.equal(await code(updateDoc(ref, { "schack.datorPartier": increment(1) })), "ok", "utan aktivtParti");
  const { partiId } = await nytt(ANNA, BO);
  assert.equal(await code(updateDoc(ref, { "schack.datorPartier": increment(1) })), "ok", "med aktivtParti");
  assert.equal(await code(updateDoc(ref, { "schack.datorPartier": increment(2) })), "permission-denied");
  await anna.call("schackGeUpp", { partiId });
  assert.equal(await akt(ANNA), null);
  assert.equal(await code(updateDoc(ref, { "schack.datorPartier": increment(1) })), "ok", "efter slut (aktivtParti null)");
  assert.equal((await adb.doc(`studentData/${ANNA}`).get()).data().schack.datorPartier, 3);
  assert.equal(await code(updateDoc(ref, { coins: 9 })), "ok", "andra fält påverkas inte");
});

// F9 (info/låg): eleven får radera sitt eget studentData (regeln allow delete: isSelf) – det rensar spärren men kostar henne allt sparat (mynt m.m.).
test("deleteDoc av eget studentData rensar spärren (kringgår 'ett parti åt gången' över klasser)", { todo: "F9 accepterad: radering kostar eleven all data – docs/SCHACK.md §12.1" }, async () => {
  await reset();
  const { partiId } = await nytt(ANNA, BO, { classId: KLASS });
  const anna = await who(ANNA);
  const dan = await who(DAN);
  await dan.call("schackVanta", { classId: KLASS_B, klocka: null });
  // utan trick: nekas via spärren
  assert.equal(await code(anna.call("schackGaMed", { classId: KLASS_B, motstandare: DAN })), "failed-precondition");
  const d = await code(deleteDoc(doc(anna.db, "studentData", ANNA)));
  const c = await code(anna.call("schackGaMed", { classId: KLASS_B, motstandare: DAN }));
  console.log(`  [info] deleteDoc(studentData)=${d}; därefter gaMed i klass B=${c} (parti ${partiId} i klass A pågår)`);
  assert.equal(c === "ok" && d === "ok", false, "elev kan kringgå spärren genom att radera sitt studentData");
});

// --- F2: livscykel ----------------------------------------------------------------------------

async function fri(a, b) {
  assert.equal(await akt(a), null, `${a} har kvar aktivtParti`);
  assert.equal(await akt(b), null, `${b} har kvar aktivtParti`);
  const r = await nytt(a, b);
  assert.ok(r.partiId);
}

test("aktivtParti släpps efter geUpp, remi, kravaVinst, mattar, tid slut och lärarens avslut – och nytt parti går att starta", async () => {
  // geUpp
  await reset();
  let g = await nytt(ANNA, BO);
  await (await who(g.vit)).call("schackGeUpp", { partiId: g.partiId });
  await fri(ANNA, BO);
  // remi
  await reset();
  g = await nytt(ANNA, BO);
  await (await who(g.vit)).call("schackRemi", { partiId: g.partiId, handling: "erbjud" });
  await (await who(g.svart)).call("schackRemi", { partiId: g.partiId, handling: "acceptera" });
  await fri(ANNA, BO);
  // kravaVinst utan klocka
  await reset();
  g = await nytt(ANNA, BO);
  await adb.doc(`schackPartier/${g.partiId}`).update({ senastDragAt: ned(6) });
  await (await who(g.svart)).call("schackKravaVinst", { partiId: g.partiId });
  await fri(ANNA, BO);
  // matt (dårmatt)
  await reset();
  g = await nytt(ANNA, BO);
  const v = await who(g.vit);
  const s = await who(g.svart);
  await v.call("schackDrag", { partiId: g.partiId, from: "f2", to: "f3" });
  await s.call("schackDrag", { partiId: g.partiId, from: "e7", to: "e5" });
  await v.call("schackDrag", { partiId: g.partiId, from: "g2", to: "g4" });
  await s.call("schackDrag", { partiId: g.partiId, from: "d8", to: "h4" });
  await fri(ANNA, BO);
  // tid slut vid eget drag
  await reset();
  g = await nytt(ANNA, BO, { klocka: 5 });
  await adb.doc(`schackPartier/${g.partiId}`).update({ "klocka.senastDragAt": ned(6) });
  await (await who(g.vit)).call("schackDrag", { partiId: g.partiId, from: "e2", to: "e4" });
  await fri(ANNA, BO);
  // tid slut via remi (F5)
  await reset();
  g = await nytt(ANNA, BO, { klocka: 5 });
  await adb.doc(`schackPartier/${g.partiId}`).update({ "klocka.senastDragAt": ned(6) });
  await (await who(g.vit)).call("schackRemi", { partiId: g.partiId, handling: "erbjud" });
  assert.equal((await getP(g.partiId)).orsak, "tid");
  await fri(ANNA, BO);
  // lärarens avslut
  await reset();
  g = await nytt(ANNA, BO);
  await (await who(AK)).call("schackLarareAvsluta", { partiId: g.partiId });
  await fri(ANNA, BO);
});

test("24 h: parti avbryts via drag av spelaren → båda fria; via annans lobbyanrop → båda fria", async () => {
  await reset();
  let g = await nytt(ANNA, BO);
  await adb.doc(`schackPartier/${g.partiId}`).update({ senastDragAt: ned(25 * 60) });
  const v = await who(g.vit);
  assert.equal(await code(v.call("schackDrag", { partiId: g.partiId, from: "e2", to: "e4" })), "failed-precondition");
  await fri(ANNA, BO);
  await reset();
  g = await nytt(ANNA, BO);
  await adb.doc(`schackPartier/${g.partiId}`).update({ senastDragAt: ned(25 * 60) });
  await adb.doc(`schackKlass/${KLASS}`).update({ [`partier.${g.partiId}.start`]: ned(25 * 60) });
  await (await who(CIA)).call("schackVanta", { classId: KLASS, klocka: null });
  assert.equal((await getP(g.partiId)).orsak, "avbrutet");
  await fri(ANNA, BO);
});

test("24 h: spelaren själv anropar vanta när det gamla partiet städas – första anropet får inte låsa ute henne", async () => {
  await reset();
  const g = await nytt(ANNA, BO);
  await adb.doc(`schackPartier/${g.partiId}`).update({ senastDragAt: ned(25 * 60) });
  await adb.doc(`schackKlass/${KLASS}`).update({ [`partier.${g.partiId}.start`]: ned(25 * 60) });
  const anna = await who(ANNA);
  const c1 = await code(anna.call("schackVanta", { classId: KLASS, klocka: null }));
  const c2 = c1 === "ok" ? "ok" : await code(anna.call("schackVanta", { classId: KLASS, klocka: null }));
  assert.equal(c1, "ok", `första vanta efter städning gav ${c1} (andra: ${c2}); partiets orsak=${(await getP(g.partiId)).orsak}`);
  assert.equal((await getP(g.partiId)).orsak, "avbrutet");
});

test("hängande aktivtParti (id som inte pågår / saknas / skräp) räknas som fritt", async () => {
  await reset();
  const g = await nytt(ANNA, BO);
  await (await who(g.vit)).call("schackGeUpp", { partiId: g.partiId });
  for (const id of [g.partiId, "finns-inte", "x".repeat(70), 5, null]) {
    await adb.doc(`studentData/${ANNA}`).set({ coins: 0, schack: { aktivtParti: id } });
    const anna = await who(ANNA);
    assert.equal(await code(anna.call("schackVanta", { classId: KLASS, klocka: null })), "ok", `aktivtParti=${id}`);
    await anna.call("schackSlutaVanta", { classId: KLASS });
  }
});

test("elev utan studentData-dokument: partiet fungerar; vad skapas?", async () => {
  await reset();
  await adb.doc(`studentData/${CIA}`).delete();
  const g = await nytt(CIA, BO);
  const d = (await adb.doc(`studentData/${CIA}`).get()).data();
  console.log("  [info] studentData för elev utan dokument efter start:", JSON.stringify(d));
  await (await who(g.vit)).call("schackGeUpp", { partiId: g.partiId });
  assert.equal(await akt(CIA), null);
});

// --- samtidighet över två klasser ------------------------------------------------------------

test("samtidiga gaMed över två klasser (Anna i A och B) → exakt ETT parti, 6 varv", async () => {
  for (let i = 0; i < 6; i++) {
    await reset();
    const anna = await who(ANNA);
    const bo = await who(BO);
    const dan = await who(DAN);
    await bo.call("schackVanta", { classId: KLASS, klocka: null });
    await dan.call("schackVanta", { classId: KLASS_B, klocka: null });
    const r = await Promise.all([
      code(anna.call("schackGaMed", { classId: KLASS, motstandare: BO })),
      code(anna.call("schackGaMed", { classId: KLASS_B, motstandare: DAN })),
    ]);
    assert.equal(r.filter((x) => x === "ok").length, 1, `varv ${i}: ${r}`);
    const n = (await adb.collection("schackPartier").where("status", "==", "pagar").get()).docs.filter((d) => d.id && [ANNA].some((u) => d.data().vit === u || d.data().svart === u));
    assert.equal(n.length, 1, `varv ${i}: Anna i ${n.length} partier`);
  }
});

test("samtidigt svara (klass A) + gaMed (klass B) för Anna, och två svara över klasser → ett parti", async () => {
  for (let i = 0; i < 5; i++) {
    await reset();
    const anna = await who(ANNA);
    const bo = await who(BO);
    const dan = await who(DAN);
    const u1 = (await bo.call("schackUtmana", { classId: KLASS, till: ANNA, klocka: null })).utmaningId;
    const u2 = (await dan.call("schackUtmana", { classId: KLASS_B, till: ANNA, klocka: null })).utmaningId;
    const r = await Promise.all([
      code(anna.call("schackSvara", { utmaningId: u1, ja: true, classId: KLASS })),
      code(anna.call("schackSvara", { utmaningId: u2, ja: true, classId: KLASS_B })),
    ]);
    assert.equal(r.filter((x) => x === "ok").length, 1, `varv ${i}: ${r}`);
    const n = (await adb.collection("schackPartier").where("status", "==", "pagar").get()).docs.filter((d) => d.data().vit === ANNA || d.data().svart === ANNA);
    assert.equal(n.length, 1);
  }
  await reset();
  const anna = await who(ANNA);
  const bo = await who(BO);
  const dan = await who(DAN);
  const u = (await bo.call("schackUtmana", { classId: KLASS, till: ANNA, klocka: null })).utmaningId;
  await dan.call("schackVanta", { classId: KLASS_B, klocka: null });
  const r = await Promise.all([code(anna.call("schackSvara", { utmaningId: u, ja: true, classId: KLASS })), code(anna.call("schackGaMed", { classId: KLASS_B, motstandare: DAN }))]);
  assert.equal(r.filter((x) => x === "ok").length, 1, r.join());
});

test("samtidigt: Bo går med i Annas väntan (klass A) medan Bo utmanas av Dan? – Bo och Dan i olika klasser mot samma Anna", async () => {
  for (let i = 0; i < 4; i++) {
    await reset();
    const anna = await who(ANNA);
    const bo = await who(BO);
    const dan = await who(DAN);
    await anna.call("schackVanta", { classId: KLASS, klocka: null });
    const u = (await dan.call("schackUtmana", { classId: KLASS_B, till: ANNA, klocka: null })).utmaningId;
    const r = await Promise.all([
      code(bo.call("schackGaMed", { classId: KLASS, motstandare: ANNA })),
      code(anna.call("schackSvara", { utmaningId: u, ja: true, classId: KLASS_B })),
    ]);
    assert.equal(r.filter((x) => x === "ok").length, 1, `varv ${i}: ${r}`);
  }
});

// --- (c) anrop utan ändring ---------------------------------------------------------------------

test("lobbyanrop utan ändring skriver inte – men utgångna poster rensas ändå vid nästa skrivande anrop", async () => {
  await reset();
  const anna = await who(ANNA);
  const bo = await who(BO);
  const cia = await who(CIA);
  await anna.call("schackVanta", { classId: KLASS, klocka: 5 });
  const t0 = (await adb.doc(`schackKlass/${KLASS}`).get()).updateTime.toMillis();
  await new Promise((r) => setTimeout(r, 30));
  await bo.call("schackSlutaVanta", { classId: KLASS });
  assert.equal((await adb.doc(`schackKlass/${KLASS}`).get()).updateTime.toMillis(), t0, "tomt anrop skrev");
  // Annas väntan blir 11 min gammal; ett tomt anrop av Bo ska ändå rensa den (innehållet ändras)
  await adb.doc(`schackKlass/${KLASS}`).update({ [`vantar.${ANNA}.sedan`]: ned(11) });
  await bo.call("schackSlutaVanta", { classId: KLASS });
  assert.equal((await getK()).vantar[ANNA], undefined, "utgången väntan rensades inte");
  // utmaning äldre än 2 min rensas av ett tomt anrop
  const { utmaningId } = await cia.call("schackUtmana", { classId: KLASS, till: BO, klocka: null });
  await adb.doc(`schackKlass/${KLASS}`).update({ [`utmaningar.${utmaningId}.sedan`]: ned(3) });
  await anna.call("schackSlutaVanta", { classId: KLASS });
  assert.deepEqual(Object.keys((await getK()).utmaningar), []);
  // gaMed mot rensad väntan nekas, mot ny väntan går
  await adb.doc(`schackKlass/${KLASS}`).update({ [`vantar.${ANNA}`]: { namn: "Anna", klocka: null, sedan: ned(11) } });
  assert.equal(await code(bo.call("schackGaMed", { classId: KLASS, motstandare: ANNA })), "failed-precondition");
});
