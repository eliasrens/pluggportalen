// ============================================================================
// #812 tester: räknarna (#807) och helskärmsläget (#810) efter mergen – kantfall
// mot EMULATORN med de riktiga reglerna. Läraren = de riktiga src-modulerna
// (inloggad som ak4); eleverna skriver EXAKT som src/prov/prov-elev-data.js
// (starta/spara/lamnaIn/pausa/lamnaInPausad, pausFalt ur prov-helskarm.js):
//   * elever pausar sig, "Släpp in" (+5 min), återupptar och lämnar in, tidens
//     inlämning under pausen – räknarna och "Att rätta" orörda medan provet är öppet
//   * Stäng med flera pausade: alla räknas, en paus efter Stäng nekas
//   * "Släpp in" från en inaktuell flik efter Stäng rör inte räknarna
//   * rättningen av pausade/stängda → märket försvinner; Öppna igen → pausade
//     fortfarande pausade, tidens inlämning står kvar; Stäng igen
//   * ett tillfälle från före #810 (utan helskarm) med räknare: Öppna igen via
//     rutans väg (sparaHelskarm först) behåller räknarna
// Eget projekt-id: kan köras parallellt med de andra emulatortesterna.
// Kräver FIRESTORE_EMULATOR_HOST – hoppas annars över.
// ============================================================================

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { Timestamp, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { installeraMedProjekt } from "./helpers/emulator-eget-projekt-tester807.js";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { EXEMPEL } from "./helpers/prov-exempel.js";
import { pausFalt } from "../src/prov/prov-helskarm.js";

const HAR_EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;
const PROJEKT = "pluggportalen-812-tester";
const T = "t-812";
const T_GAMMAL = "t-812-fore810";
const ELEVER = ["p1", "p2", "p3", "p4", "p5"];
const MIN = 60_000;

// prov-elev-data.js – samma fält, samma ordning.
const svarRef = (db, t, uid) => doc(db, "provTillfallen", t, "svar", uid);
const starta = (db, t, uid) => setDoc(svarRef(db, t, uid), {
  elevId: uid, classId: "4a", startad: serverTimestamp(), uppdaterad: serverTimestamp(), svar: {}, inlamnad: false,
});
const spara = (db, t, uid, svar, flikbyten = 0) => updateDoc(svarRef(db, t, uid), { svar, uppdaterad: serverTimestamp(), ...(flikbyten > 0 ? { flikbyten } : {}) });
const lamnaIn = (db, t, uid, svar, nar, flikbyten = 0) => updateDoc(svarRef(db, t, uid), {
  svar, uppdaterad: serverTimestamp(), inlamnad: true, inlamnadNar: nar, inlamnadAt: serverTimestamp(), ...(flikbyten > 0 ? { flikbyten } : {}),
});
const pausa = (db, t, uid, svar, falt) => updateDoc(svarRef(db, t, uid), { svar, uppdaterad: serverTimestamp(), pausad: true, pausadAt: serverTimestamp(), ...falt });
const lamnaInPausad = (db, t, uid) => updateDoc(svarRef(db, t, uid), { uppdaterad: serverTimestamp(), inlamnad: true, inlamnadNar: "tid", inlamnadAt: serverTimestamp() });

describe("#812 tester: räknarna under paus / Släpp in / Stäng / Öppna igen (riktiga regler)", { skip: !HAR_EMULATOR && "ingen FIRESTORE_EMULATOR_HOST" }, () => {
  let env, td, rd, lagerMod, logik, attRatta, fragor, facit, F;

  before(async () => {
    env = await createRollerEnv(PROJEKT);
    await installeraMedProjekt(PROJEKT, { sub: "ak4", user_id: "ak4", teacher: true, role: "arskurs" });
    await env.testEnv.clearFirestore();
    await seedRoller(env);
    const { validateProv } = await import("../src/prov/prov-validera.js");
    const { delaUppProv } = await import("../src/prov/prov-modell.js");
    const prov = validateProv({ namn: "Vikingar", installningar: {}, fragor: Object.values(EXEMPEL).map((e) => structuredClone(e.f)) }).value;
    ({ fragor, facit } = delaUppProv(prov));
    F = Object.fromEntries(fragor.map((f) => [f.id, f]));
    await env.seed(async (db) => {
      for (const uid of ELEVER) await setDoc(doc(db, "students", uid), { namn: uid, username: uid, classIds: ["4a"] });
      await updateDoc(doc(db, "classes", "4a"), { studentIds: ["e4a", ...ELEVER] });
      await setDoc(doc(db, "provTillfallen", T), {
        provId: "p1", provNamn: "Vikingar", classId: "4a", createdBy: "ak4", status: "oppet", fragor, installningar: {},
        tidsgransMin: 5, helskarm: true, helskarmUndantag: [],
      });
      await setDoc(doc(db, "provTillfallen", T, "privat", "facit"), { facit, bedomningsstod: {} });
      // p5 startade för 6 min sedan (tidsgräns 5) och pausades – tiden tar slut under pausen.
      await setDoc(svarRef(db, T, "p5"), {
        elevId: "p5", classId: "4a", startad: Timestamp.fromMillis(Date.now() - 6 * MIN), uppdaterad: Timestamp.fromMillis(Date.now() - MIN),
        svar: { q4: "Birka" }, inlamnad: false, pausad: true, pausadAt: Timestamp.fromMillis(Date.now() - MIN), pausOrsak: "helskarm",
        flikbyten: 1, pausLogg: [{ at: Date.now() - MIN, orsak: "helskarm" }],
      });
    });
    td = await import("../src/prov/prov-tillfalle-data.js");
    rd = await import("../src/prov/prov-rattning-data.js");
    lagerMod = await import("../src/prov/prov-ratta-lager.js");
    logik = await import("../src/prov/prov-rattning-logik.js");
    attRatta = await import("../src/prov/prov-att-ratta.js");
  });
  after(async () => {
    if (env) await env.testEnv.cleanup();
    setTimeout(() => process.exit(process.exitCode || 0), 200).unref();
  });

  const tfNu = (t = T) => td.hamtaTillfalle(t);
  const raknare = async (t = T) => { const d = await tfNu(t); return [d.rattStatus?.antal, d.rattStatus?.rattade, d.rattStatus?.tillbaka, d.attRatta]; };
  const svarDok = async (uid, t = T) => (await getDoc(svarRef(env.admin(), t, uid))).data();
  const pausade = () => new Promise((klar, fel) => {
    const sluta = td.lyssnaPausade(T, (p) => { sluta(); klar(Object.keys(p).sort()); }, fel);
  });
  const attRattaIds = async () => {
    (await import("../src/prov/prov-raknare.js")).glomAttRatta();
    return (await attRatta.lasAttRattaTillfallen(["4a", "4b"])).map((t) => t.id).sort();
  };
  const paus = async (uid, orsak) => {
    const fore = await svarDok(uid);
    return pausa(env.as(uid), T, uid, fore.svar, pausFalt(fore, orsak, Date.now()));
  };

  it("öppet: pauser, Släpp in (+5 min), återuppta, lämna in, tidens inlämning under pausen – räknarna orörda", async () => {
    for (const uid of ["p1", "p2", "p3", "p4"]) await assertSucceeds(starta(env.as(uid), T, uid));
    await assertSucceeds(paus("p1", "flik"));
    await assertSucceeds(paus("p2", "helskarm"));
    await assertSucceeds(paus("p3", "fokus"));
    assert.deepEqual(await pausade(), ["p1", "p2", "p3", "p5"]);
    await assertFails(spara(env.as("p1"), T, "p1", { q4: "x" }, 1), "pausad elev får inte spara");

    const ny = await td.slappIn(await tfNu(), ["p1", "p2"], { plusMin: true });
    assert.deepEqual(ny, { p1: 5, p2: 5 });
    assert.deepEqual(await pausade(), ["p3", "p5"]);
    await assertSucceeds(spara(env.as("p1"), T, "p1", { q4: "Birka" }, 1));
    await assertSucceeds(lamnaIn(env.as("p1"), T, "p1", { q4: "Birka" }, "elev", 1));
    await assertSucceeds(lamnaInPausad(env.as("p5"), T, "p5"));

    assert.deepEqual(await raknare(), [undefined, undefined, undefined, undefined], "elevinlämning på öppet prov ändrar inte räknarna (#807-beslut)");
    assert.deepEqual(await attRattaIds(), []);
  });

  it("Stäng med två pausade (p3 + p4 som pausar sist): alla fem räknas, en paus efter Stäng nekas", async () => {
    await assertSucceeds(paus("p4", "flik"));
    const markerade = await td.stangTillfalle(await tfNu());
    assert.equal(markerade, 3, "p2, p3, p4 – p1 (elev) och p5 (tid) var redan inlämnade");
    assert.deepEqual(await raknare(), [5, 0, 0, true]);
    await assertFails(paus("p2", "flik"), "provet är stängt");
    for (const uid of ["p3", "p4"]) {
      const d = await svarDok(uid);
      assert.deepEqual([d.inlamnad, d.inlamnadNar, d.pausad], [true, "stangt", true], uid);
    }
    assert.deepEqual(await attRattaIds(), [T]);
  });

  it("Släpp in från en inaktuell flik efter Stäng: räknarna och flaggan orörda", async () => {
    const gammal = { ...(await tfNu()), status: "oppet" };
    let fel = null;
    try { await td.slappIn(gammal, ["p3"], { plusMin: true }); } catch (err) { fel = err; }
    console.log("Släpp in efter Stäng:", fel ? `nekad (${fel.code || fel.message})` : "godtagen", "· p3.pausad =", (await svarDok("p3")).pausad);
    assert.deepEqual(await raknare(), [5, 0, 0, true]);
  });

  it("rättningen av pausade/stängda: räknarna går upp och märket försvinner", async () => {
    const data = await rd.laddaRattning(T);
    const med = Object.values(data.svar).filter((s) => s.inlamnad).map((s) => s.id).sort();
    assert.deepEqual(med, ELEVER, "alla fem (även de pausade) finns i rättningen");
    const lager = lagerMod.skapaRattningsLager({ data, med, onStatus: (s) => { if (s.lage === "nekad") throw new Error("nekad"); } });
    await lager.spola();
    for (const uid of ELEVER) lager.rattningar[uid] = logik.bedom(logik.godkannAlla(lager.rattningar[uid], fragor), F.q8, { poang: 4 }, fragor);
    lager.andrat(ELEVER);
    await lager.spola();
    assert.deepEqual(await raknare(), [5, 5, 0, false]);
    assert.deepEqual(await attRattaIds(), []);
  });

  it("Öppna igen: stängningens markeringar tas tillbaka, pausade är fortfarande pausade, p1/p5 står kvar; Stäng igen", async () => {
    await td.oppnaTillfalle(await tfNu(), null);
    assert.deepEqual(await raknare(), [2, 2, 0, false], "kvar: p1 (elev) och p5 (tid) – båda rättade");
    const p5 = await svarDok("p5");
    assert.deepEqual([p5.inlamnad, p5.inlamnadNar], [true, "tid"]);
    const p4 = await svarDok("p4");
    assert.deepEqual([p4.inlamnad, p4.pausad], [false, true]);
    assert.ok((await pausade()).includes("p4"));
    await assertFails(spara(env.as("p4"), T, "p4", {}), "fortfarande pausad efter Öppna igen");
    await assertSucceeds(spara(env.as("p2"), T, "p2", { q4: "Birka" }), "p2 släpptes in före Stäng och skriver igen");
    await td.slappIn(await tfNu(), ["p4"]);
    await assertSucceeds(spara(env.as("p4"), T, "p4", { q4: "Birka" }));
    assert.deepEqual(await raknare(), [2, 2, 0, false], "Släpp in rör inte räknarna");
    await td.stangTillfalle(await tfNu());
    assert.deepEqual(await raknare(), [5, 2, 0, true]);
  });

  it("tillfälle från före #810 (utan helskarm) med räknare: rutans Öppna igen (sparaHelskarm först) behåller räknarna", async () => {
    await env.seed(async (db) => {
      await setDoc(doc(db, "provTillfallen", T_GAMMAL), {
        provId: "p1", provNamn: "Gammalt", classId: "4a", createdBy: "ak4", status: "stangt", fragor, installningar: {},
        tidsgransMin: null, rattStatus: { antal: 2, rattade: 1, tillbaka: 0 }, attRatta: true,
      });
      await setDoc(svarRef(db, T_GAMMAL, "p1"), { elevId: "p1", classId: "4a", svar: {}, inlamnad: true, inlamnadNar: "elev" });
      await setDoc(svarRef(db, T_GAMMAL, "p2"), { elevId: "p2", classId: "4a", svar: {}, inlamnad: true, inlamnadNar: "stangt" });
    });
    const tf = await tfNu(T_GAMMAL);
    assert.equal(await td.uppgraderaRaknare([tf]), 0, "flaggan stämmer redan");
    assert.ok(!("helskarm" in tf));
    await td.sparaHelskarm(T_GAMMAL, { pa: true, undantag: [] }); // prov-tillfalle-rutor.js oppnaRuta: !("helskarm" in tf)
    await td.oppnaTillfalle(tf, null);
    const efter = await tfNu(T_GAMMAL);
    assert.deepEqual([efter.status, efter.helskarm, efter.rattStatus, efter.attRatta], ["oppet", true, { antal: 1, rattade: 0, tillbaka: 0 }, true]);
    await td.stangTillfalle(efter);
    assert.deepEqual(await raknare(T_GAMMAL), [2, 0, 0, true]);
  });
});
