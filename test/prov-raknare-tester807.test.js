// ============================================================================
// #807 tester: kantfall för räknarna "prov att rätta" (minnes-Firestore).
//   A  Rätta alla på ett prov utan fritext → alla rättade, flaggan släcks
//   B  Äldre tillfälle (stängt, rattStatus men ingen attRatta) → märket ser det inte
//      förrän rättningsvyn öppnats; vyn skriver flaggan även utan ändrade rättningar
//   C  Stäng två gånger / Stäng utan svar
//   D  Rättning medan provet är öppet, sedan inlämning, sedan Stäng
//   E  Stäng med ett inaktuellt tf-objekt skriver över nyare rättade-siffror
//   F  Rätta alla på ett öppet prov där inte alla lämnat in
//   G  Öppna igen utan rattning-samlingen / med tom fragor
// ============================================================================
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { installeraMinnesFirestore } from "./helpers/minnes-firestore-loader.js";
import { EXEMPEL } from "./helpers/prov-exempel.js";

const RATT = { q1: 0, q2: [0, 1], q3: false, q4: "Birka", q5: ["Miklagård", "Bagdad"], q6: ["Åska", "Visdom", "Kärlek"], q7: ["Stenåldern", "Bronsåldern", "Järnåldern", "Vikingatiden"] };
const FEL = { q1: 1, q2: [2], q3: true, q4: "Rom", q5: ["a", "b"], q6: ["Kärlek", "Åska", "Visdom"], q7: ["Vikingatiden", "Järnåldern", "Bronsåldern", "Stenåldern"] };

describe("#807 tester – kantfall", () => {
  let fs, td, rd, lagerMod, logik, attRatta, fragor, facit;
  before(async () => {
    fs = await installeraMinnesFirestore();
    td = await import("../src/prov/prov-tillfalle-data.js");
    rd = await import("../src/prov/prov-rattning-data.js");
    lagerMod = await import("../src/prov/prov-ratta-lager.js");
    logik = await import("../src/prov/prov-rattning-logik.js");
    attRatta = await import("../src/prov/prov-att-ratta.js");
    const { validateProv } = await import("../src/prov/prov-validera.js");
    const { delaUppProv } = await import("../src/prov/prov-modell.js");
    const lista = ["flerval", "flerval-flera", "santfalskt", "kortsvar", "lucktext", "para", "ordna"].map((k) => structuredClone(EXEMPEL[k].f));
    const prov = validateProv({ namn: "Auto", installningar: {}, fragor: lista }).value;
    ({ fragor, facit } = delaUppProv(prov));
  });
  const satt = (p, d) => fs.setDoc(fs.doc(fs.db, p), d);
  const las = (t) => fs.las(`provTillfallen/${t}`);
  const skapa = async (t, extra = {}, svar = []) => {
    await satt(`provTillfallen/${t}`, { provId: "p", provNamn: "Auto", classId: "4a", createdBy: "l1", status: "oppet", fragor, installningar: {}, ...extra });
    await satt(`provTillfallen/${t}/privat/facit`, { facit, bedomningsstod: {} });
    for (const [uid, s, inl, nar] of svar) await satt(`provTillfallen/${t}/svar/${uid}`, { elevId: uid, classId: "4a", svar: s, inlamnad: inl, ...(nar ? { inlamnadNar: nar } : {}) });
  };
  const rattning = async (t, med) => {
    const data = await rd.laddaRattning(t);
    const m = med || Object.values(data.svar).filter((s) => s.inlamnad).map((s) => s.id);
    const lager = lagerMod.skapaRattningsLager({ data, med: m });
    await lager.spola();
    return { lager, med: m, data };
  };

  it("A: Rätta alla på ett prov utan fritext rättar alla – attRatta släcks", async () => {
    await skapa("tA", {}, [["e1", RATT, true, "elev"], ["e2", FEL, true, "elev"], ["e3", {}, true, "elev"]]);
    const { lager, med } = await rattning("tA");
    await lager.rattaAlla();
    const st = logik.rattStatusSumma(med, lager.rattningar, fragor);
    assert.deepEqual(las("tA").rattStatus, st);
    assert.equal(las("tA").rattStatus.rattade, 3, JSON.stringify(las("tA").rattStatus));
    assert.equal(las("tA").attRatta, false);
  });

  it("B: äldre tillfälle med rattStatus men utan attRatta – frågan hittar det inte; rättningsvyn skriver flaggan", async () => {
    await skapa("tB", { status: "stangt", rattStatus: { antal: 2, rattade: 0, tillbaka: 0 } }, [["e1", RATT, true, "elev"], ["e2", FEL, true, "stangt"]]);
    assert.ok(!(await attRatta.lasAttRattaTillfallen(["4a"])).some((t) => t.id === "tB"), "märket missar äldre tillfällen (känt, redovisat)");
    await rattning("tB");
    assert.equal(las("tB").attRatta, true);
    assert.ok((await attRatta.lasAttRattaTillfallen(["4a"])).some((t) => t.id === "tB"));
  });

  it("C: Stäng två gånger ändrar inget; Stäng utan svar ger 0/false", async () => {
    await skapa("tC1", {}, [["e1", RATT, false]]);
    await td.stangTillfalle({ id: "tC1", ...las("tC1") });
    const efter1 = structuredClone(las("tC1"));
    await td.stangTillfalle({ id: "tC1", ...las("tC1") });
    assert.deepEqual(las("tC1").rattStatus, efter1.rattStatus);
    await skapa("tC2");
    await td.stangTillfalle({ id: "tC2", ...las("tC2") });
    assert.deepEqual([las("tC2").rattStatus.antal, las("tC2").attRatta], [0, false]);
    assert.ok(!(await attRatta.lasAttRattaTillfallen(["4a"])).some((t) => t.id === "tC2"));
  });

  it("D: rättning på öppet prov (2 inlämnade) → fler lämnar in → Stäng räknar alla, rättade står kvar", async () => {
    await skapa("tD", {}, [["e1", RATT, true, "elev"], ["e2", RATT, true, "elev"], ["e3", RATT, false], ["e4", FEL, false]]);
    const { lager } = await rattning("tD");
    await lager.rattaAlla();
    assert.deepEqual([las("tD").rattStatus.antal, las("tD").rattStatus.rattade], [2, 2]);
    assert.equal(las("tD").attRatta, false, "öppet prov: allt inlämnat är rättat");
    await td.stangTillfalle({ id: "tD", ...las("tD") });
    assert.deepEqual([las("tD").rattStatus.antal, las("tD").rattStatus.rattade, las("tD").attRatta], [4, 2, true]);
  });

  it("E: Stäng med inaktuellt tf-objekt (rättning gjord i en annan flik) räknar mot det lagrade räkneverket (F1 rättad)", async () => {
    await skapa("tE", {}, [["e1", RATT, true, "elev"], ["e2", RATT, true, "elev"], ["e3", FEL, false]]);
    const gammal = { id: "tE", ...las("tE") }; // läst före rättningen
    const { lager } = await rattning("tE");
    await lager.rattaAlla();
    assert.equal(las("tE").rattStatus.rattade, 2);
    await td.stangTillfalle(gammal);
    assert.deepEqual([las("tE").rattStatus.antal, las("tE").rattStatus.rattade], [3, 2], `skrev ${JSON.stringify(las("tE").rattStatus)}`);
  });

  it("F: Öppna igen på stängt tillfälle utan rattStatus och utan rättningar", async () => {
    await skapa("tF", { status: "stangt" }, [["e1", RATT, true, "stangt"], ["e2", RATT, true, "elev"]]);
    await td.oppnaTillfalle({ id: "tF", ...las("tF") }, null);
    assert.deepEqual([las("tF").rattStatus.antal, las("tF").rattStatus.rattade, las("tF").attRatta], [1, 0, true]);
  });

  it("G: Öppna igen när tf saknar fragor (äldre objekt i minnet) ger ändå rimliga räknare", async () => {
    await skapa("tG", { status: "stangt" }, [["e1", RATT, true, "elev"]]);
    const tf = { id: "tG", ...las("tG") };
    delete tf.fragor;
    await td.oppnaTillfalle(tf, null);
    assert.equal(las("tG").rattStatus.antal, 1);
  });
});
