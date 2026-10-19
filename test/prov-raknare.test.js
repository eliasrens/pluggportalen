// ============================================================================
// #807 (epic #802 §1.3): räknarna "prov att rätta" på provtillfället.
//   * de rena hjälparna (prov-raknare.js)
//   * hela flödet med de RIKTIGA data-modulerna mot förhandsvisningens
//     minnes-Firestore (räknar läsningar): Stäng → rättningsvyn (förslag) →
//     bedömning → Rätta alla → tillbakalämning → ångra → Öppna igen → Stäng →
//     omprov. Efter varje steg stämmer tillfällets rattStatus/attRatta med
//     rattStatusSumma, och ingen rättning läses bara för att räkna.
//   * frågan som märket och "Att rätta" gör (attRatta == true)
// Körs med: node --test
// ============================================================================

import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { installeraMinnesFirestore } from "./helpers/minnes-firestore-loader.js";
import { EXEMPEL } from "./helpers/prov-exempel.js";
import {
  attRattaAntal, attRattaCache, attRattaRader, flaggaStammer, glomAttRatta, raknareFalt, rattaHash, stangRaknare, summaAttRatta,
} from "../src/prov/prov-raknare.js";

describe("prov-raknare (rena hjälpare)", () => {
  it("attRattaAntal = inlämnade − rättade, aldrig under 0; förberett = 0", () => {
    assert.equal(attRattaAntal({ status: "stangt", rattStatus: { antal: 24, rattade: 6, tillbaka: 2 } }), 18);
    assert.equal(attRattaAntal({ status: "oppet", rattStatus: { antal: 3, rattade: 5 } }), 0);
    assert.equal(attRattaAntal({ status: "forberett", rattStatus: { antal: 3, rattade: 0 } }), 0);
    assert.equal(attRattaAntal({ status: "stangt" }), 0, "utan räknare: inget märke");
    assert.equal(attRattaAntal(null), 0);
  });
  it("raknareFalt: hela räkneverket + flaggan; stangRaknare behåller rättade/tillbaka", () => {
    assert.deepEqual(raknareFalt({ antal: 4, rattade: 4, tillbaka: 1 }), { rattStatus: { antal: 4, rattade: 4, tillbaka: 1 }, attRatta: false });
    assert.deepEqual(raknareFalt(null), { rattStatus: { antal: 0, rattade: 0, tillbaka: 0 }, attRatta: false });
    assert.deepEqual(stangRaknare({ rattStatus: { antal: 2, rattade: 2, tillbaka: 1 } }, 5),
      { rattStatus: { antal: 5, rattade: 2, tillbaka: 1 }, attRatta: true });
    assert.deepEqual(stangRaknare({}, 3), { rattStatus: { antal: 3, rattade: 0, tillbaka: 0 }, attRatta: true });
  });
  it("flaggaStammer: äldre tillfällen utan attRatta rättas vid nästa sparning", () => {
    assert.equal(flaggaStammer({ rattStatus: { antal: 3, rattade: 1 } }), false);
    assert.equal(flaggaStammer({ rattStatus: { antal: 3, rattade: 1 }, attRatta: true }), true);
    assert.equal(flaggaStammer({ rattStatus: { antal: 3, rattade: 3 }, attRatta: false }), true);
  });
  it("attRattaRader: bara tillfällen med orättade, flest först, klassens namn, omprov märkt; summan = märket", () => {
    const rader = attRattaRader([
      { id: "a", provNamn: "Vikingar", classId: "4b", status: "stangt", rattStatus: { antal: 22, rattade: 4 } },
      { id: "b", provNamn: "Bråk", classId: "4a", status: "stangt", rattStatus: { antal: 5, rattade: 5 } },
      { id: "c", provNamn: "Vikingar", classId: "4a", status: "stangt", elevIds: ["x"], rattStatus: { antal: 1, rattade: 0 } },
    ], [{ id: "4a", name: "4A" }, { id: "4b", name: "4B" }]);
    assert.deepEqual(rader.map((r) => [r.id, r.antal, r.klass, r.omprov]), [["a", 18, "4B", false], ["c", 1, "4A", true]]);
    assert.equal(rader[0].inlamnade, 22);
    assert.equal(summaAttRatta(rader), 19);
    assert.equal(rattaHash("a b"), "#/larare/prov/ratta?t=a%20b");
  });
  it("glomAttRatta tömmer sessionscachen", () => {
    Object.assign(attRattaCache, { nyckel: "x", tid: Date.now(), lofte: Promise.resolve([]) });
    glomAttRatta();
    assert.equal(attRattaCache.tid, 0);
    assert.equal(attRattaCache.lofte, null);
  });
});

describe("räknarna genom hela flödet (riktiga data-moduler, minnes-Firestore)", () => {
  let fs, td, rd, lagerMod, logik, prov, attRatta;
  const T = "t-flode";
  const ALLA_RATT = { q1: 0, q2: [0, 1], q3: false, q4: "Birka", q5: ["Miklagård", "Bagdad"], q6: ["Åska", "Visdom", "Kärlek"], q7: ["Stenåldern", "Bronsåldern", "Järnåldern", "Vikingatiden"], q8: "Djur, hus och arbete." };
  let fragor, facit, F;

  before(async () => {
    fs = await installeraMinnesFirestore();
    td = await import("../src/prov/prov-tillfalle-data.js");
    rd = await import("../src/prov/prov-rattning-data.js");
    lagerMod = await import("../src/prov/prov-ratta-lager.js");
    logik = await import("../src/prov/prov-rattning-logik.js");
    attRatta = await import("../src/prov/prov-att-ratta.js");
    const { validateProv } = await import("../src/prov/prov-validera.js");
    const { delaUppProv } = await import("../src/prov/prov-modell.js");
    prov = validateProv({ namn: "Vikingar", installningar: {}, fragor: Object.values(EXEMPEL).map((e) => structuredClone(e.f)) }).value;
    ({ fragor, facit } = delaUppProv(prov));
    F = Object.fromEntries(fragor.map((f) => [f.id, f]));
    const satt = (p, d) => fs.setDoc(fs.doc(fs.db, p), d);
    await satt(`provTillfallen/${T}`, { provId: "p1", provNamn: "Vikingar", classId: "4a", createdBy: "l1", status: "oppet", fragor, installningar: {} });
    await satt(`provTillfallen/${T}/privat/facit`, { facit, bedomningsstod: {} });
    // e1, e2 lämnade in själva; e3, e4 skriver fortfarande när läraren stänger.
    for (const [uid, inl] of [["e1", true], ["e2", true], ["e3", false], ["e4", false]]) {
      await satt(`provTillfallen/${T}/svar/${uid}`, { elevId: uid, classId: "4a", svar: ALLA_RATT, inlamnad: inl, ...(inl ? { inlamnadNar: "elev" } : {}) });
    }
  });

  const tfNu = () => fs.las(`provTillfallen/${T}`);
  const raknare = () => { const d = tfNu(); return [d.rattStatus?.antal, d.rattStatus?.rattade, d.rattStatus?.tillbaka, d.attRatta]; };
  const lasningar = (fran) => fs.rakna.logg.slice(fran).filter((l) => l.startsWith("las "));
  // Läraren godkänner allt och sätter fritexten (som i prov-rattning-flode.test.js).
  const fardig = (r) => logik.bedom(logik.godkannAlla(r, fragor), F.q8, { poang: 4 }, fragor);
  let lager, med;
  const oppnaRattning = async () => {
    const data = await rd.laddaRattning(T);
    med = Object.values(data.svar).filter((s) => s.inlamnad).map((s) => s.id);
    lager = lagerMod.skapaRattningsLager({ data, med });
    await lager.spola();
  };
  const stammer = () => {
    const st = logik.rattStatusSumma(med, lager.rattningar, fragor);
    assert.deepEqual(tfNu().rattStatus, st, "räknaren = rattStatusSumma");
    assert.equal(tfNu().attRatta, st.antal > st.rattade);
  };

  it("Stäng: alla svar räknas som inlämnade – ur svaren stängningen ändå läser, inga rättningar läses", async () => {
    const fran = fs.rakna.logg.length;
    await td.stangTillfalle({ id: T, ...tfNu() });
    assert.deepEqual(raknare(), [4, 0, 0, true]);
    assert.ok(!lasningar(fran).some((l) => l.includes("/rattning")), lasningar(fran).join(" | "));
  });

  it("rättningsvyn: förslagen sparas men räknas inte som rättade", async () => {
    await oppnaRattning();
    assert.deepEqual(raknare(), [4, 0, 0, true]);
    stammer();
  });

  it("bedömning sparas → rättade ökar; Rätta alla ändrar inte en ofärdig fritext", async () => {
    for (const uid of ["e1", "e2"]) lager.rattningar[uid] = fardig(lager.rattningar[uid]);
    lager.andrat(["e1", "e2"]);
    await lager.spola();
    assert.deepEqual(raknare(), [4, 2, 0, true]);
    await lager.rattaAlla();
    stammer();
    assert.equal(attRattaAntal(tfNu()), 2);
  });

  it("tillbakalämning och ångra: tillbaka räknas, rättade står kvar", async () => {
    await lager.lamnaTillbaka(["e1", "e2"], false);
    assert.deepEqual(raknare(), [4, 2, 2, true]);
    await lager.angra("e1");
    assert.deepEqual(raknare(), [4, 2, 1, true]);
    stammer();
  });

  it("allt rättat → attRatta false, och frågan för märket hittar inte tillfället", async () => {
    for (const uid of ["e3", "e4"]) lager.rattningar[uid] = fardig(lager.rattningar[uid]);
    lager.andrat(["e3", "e4"]);
    await lager.spola();
    assert.deepEqual(raknare(), [4, 4, 1, false]);
    assert.deepEqual(await attRatta.lasAttRattaTillfallen(["4a"]), []);
  });

  it("Öppna igen: de som får skriva igen är inte inlämnade – räknarna ur svaren och rättningarna som redan läses", async () => {
    await td.oppnaTillfalle({ id: T, ...tfNu() }, null);
    // e3, e4 (stängningens markering) skriver igen; e1 (inlämnat själv) och e2 (tillbaka) står kvar.
    assert.deepEqual(raknare(), [2, 2, 1, false]);
  });

  it("Stäng igen: de som skrivit om väntar på rättning; rättningsvyn rättar räknarna när den öppnas", async () => {
    await td.stangTillfalle({ id: T, ...tfNu() });
    assert.deepEqual(raknare(), [4, 2, 1, true]);
    const hittade = await attRatta.lasAttRattaTillfallen(["4a"]);
    assert.deepEqual(hittade.map((t) => t.id), [T]);
    assert.equal(summaAttRatta(attRattaRader(hittade, [{ id: "4a", name: "4A" }])), 2);
    await oppnaRattning();
    stammer();
  });

  it("omprov: eget tillfälle med egna räknare; ursprunget rörs inte", async () => {
    const fore = tfNu();
    const O = "t-omprov";
    await fs.setDoc(fs.doc(fs.db, `provTillfallen/${O}`), { provId: "p1", provNamn: "Vikingar", classId: "4a", status: "oppet", fragor, elevIds: ["e3"], omprovAv: T });
    await fs.setDoc(fs.doc(fs.db, `provTillfallen/${O}/svar/e3`), { elevId: "e3", classId: "4a", svar: ALLA_RATT, inlamnad: true, inlamnadNar: "elev" });
    await td.stangTillfalle({ id: O, ...fs.las(`provTillfallen/${O}`) });
    assert.deepEqual(fs.las(`provTillfallen/${O}`).rattStatus, { antal: 1, rattade: 0, tillbaka: 0 });
    assert.equal(fs.las(`provTillfallen/${O}`).attRatta, true);
    assert.deepEqual(tfNu().rattStatus, fore.rattStatus);
    const ids = (await attRatta.lasAttRattaTillfallen(["4a"])).map((t) => t.id).sort();
    assert.ok(ids.includes(O));
  });

  it("Radera: tillfället försvinner ur frågan", async () => {
    await td.raderaTillfalle({ id: "t-omprov", classId: "4a" });
    assert.ok(!(await attRatta.lasAttRattaTillfallen(["4a"])).some((t) => t.id === "t-omprov"));
  });
});
