// ============================================================================
// #807 mot EMULATORN med de riktiga reglerna och de riktiga src-modulerna
// (Firestore-SDK:t ur npm, inloggad som årskurskontot ak4 med klasserna 4a+4b):
//   * räknarna genom Stäng → rättningen → tillbakalämning → ångra → Öppna igen
//     → Stäng → omprov; ingen rättning läses bara för att räkna
//   * Hem: läsningarna räknade (classProjections en per klass + frågorna),
//     inga students/studentData/svar/rattning
// Hjälparen: test/helpers/emulator-firestore.js. Körs av `npm run test:rules`
// (kräver FIRESTORE_EMULATOR_HOST – hoppas annars över).
// ============================================================================

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { doc, setDoc } from "firebase/firestore";
import { installeraEmulatorFirestore } from "./helpers/emulator-firestore.js";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { EXEMPEL } from "./helpers/prov-exempel.js";

const HAR_EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;
const PROJEKT = "pluggportalen-so-2026"; // src/firebase-config.js
const ALLA_RATT = { q1: 0, q2: [0, 1], q3: false, q4: "Birka", q5: ["Miklagård", "Bagdad"], q6: ["Åska", "Visdom", "Kärlek"], q7: ["Stenåldern", "Bronsåldern", "Järnåldern", "Vikingatiden"], q8: "Djur, hus och arbete." };

describe("räknarna och Hems läsningar mot emulatorn (riktiga regler, ak4)", { skip: !HAR_EMULATOR && "ingen FIRESTORE_EMULATOR_HOST" }, () => {
  let env, td, rd, lagerMod, logik, attRatta, hemData, fragor, facit, F;
  const T = "t-emu";
  const logg = () => globalThis.__ppEmuLas;

  before(async () => {
    env = await createRollerEnv(PROJEKT); // före webbstubbarna (window/location) – rules-unit-testing läser dem
    await installeraEmulatorFirestore({ sub: "ak4", user_id: "ak4", teacher: true, role: "arskurs" });
    await env.testEnv.clearFirestore();
    await seedRoller(env);
    const { validateProv } = await import("../src/prov/prov-validera.js");
    const { delaUppProv } = await import("../src/prov/prov-modell.js");
    const prov = validateProv({ namn: "Vikingar", installningar: {}, fragor: Object.values(EXEMPEL).map((e) => structuredClone(e.f)) }).value;
    ({ fragor, facit } = delaUppProv(prov));
    F = Object.fromEntries(fragor.map((f) => [f.id, f]));
    await env.seed(async (db) => {
      const tf = { provId: "p1", provNamn: "Vikingar", classId: "4a", createdBy: "ak4", status: "oppet", fragor, installningar: {}, tidsgransMin: null };
      await setDoc(doc(db, "provTillfallen", T), tf);
      await setDoc(doc(db, "provTillfallen", T, "privat", "facit"), { facit, bedomningsstod: {} });
      for (const [uid, inl] of [["e4a", true], ["x1", true], ["x2", false], ["x3", false]]) {
        await setDoc(doc(db, "provTillfallen", T, "svar", uid), { elevId: uid, classId: "4a", svar: ALLA_RATT, inlamnad: inl, ...(inl ? { inlamnadNar: "elev" } : {}) });
      }
      for (const c of ["4a", "4b"]) {
        await setDoc(doc(db, "classProjections", c), { members: { [`e${c}`]: { namn: "Elev", ovat: "2026-09-01" }, [`y${c}`]: { namn: "Ny", ovat: "2026-10-19" } } });
      }
    });
    td = await import("../src/prov/prov-tillfalle-data.js");
    rd = await import("../src/prov/prov-rattning-data.js");
    lagerMod = await import("../src/prov/prov-ratta-lager.js");
    logik = await import("../src/prov/prov-rattning-logik.js");
    attRatta = await import("../src/prov/prov-att-ratta.js");
    hemData = await import("../src/teacher-hem-data.js");
  });
  after(async () => {
    if (env) await env.testEnv.cleanup();
    // npm-SDK:ts anslutning håller processen vid liv annars.
    setTimeout(() => process.exit(process.exitCode || 0), 200).unref();
  });

  const tfNu = async () => (await td.hamtaTillfalle(T));
  const raknare = async () => { const d = await tfNu(); return [d.rattStatus?.antal, d.rattStatus?.rattade, d.rattStatus?.tillbaka, d.attRatta]; };
  const fardig = (r) => logik.bedom(logik.godkannAlla(r, fragor), F.q8, { poang: 4 }, fragor);
  let lager;
  const oppnaRattning = async () => {
    const data = await rd.laddaRattning(T);
    const med = Object.values(data.svar).filter((s) => s.inlamnad).map((s) => s.id);
    lager = lagerMod.skapaRattningsLager({ data, med, onStatus: (s) => { if (s.lage === "nekad") throw new Error("nekad"); } });
    await lager.spola();
  };

  it("Stäng: räknaren ur svaren som ändå läses – reglerna godtar skrivningen", async () => {
    const fran = logg().length;
    await td.stangTillfalle(await tfNu());
    assert.ok(!logg().slice(fran).some((l) => l.includes("/rattning")), logg().slice(fran).join(" | "));
    assert.deepEqual(await raknare(), [4, 0, 0, true]);
  });

  it("rättningen: förslag → bedömning → tillbakalämning → ångra", async () => {
    await oppnaRattning();
    assert.deepEqual(await raknare(), [4, 0, 0, true]);
    for (const uid of ["e4a", "x1"]) lager.rattningar[uid] = fardig(lager.rattningar[uid]);
    lager.andrat(["e4a", "x1"]);
    await lager.spola();
    assert.deepEqual(await raknare(), [4, 2, 0, true]);
    await lager.lamnaTillbaka(["e4a", "x1"], false);
    assert.deepEqual(await raknare(), [4, 2, 2, true]);
    await lager.angra("x1");
    assert.deepEqual(await raknare(), [4, 2, 1, true]);
    for (const uid of ["x2", "x3"]) lager.rattningar[uid] = fardig(lager.rattningar[uid]);
    lager.andrat(["x2", "x3"]);
    await lager.spola();
    assert.deepEqual(await raknare(), [4, 4, 1, false]);
  });

  it("Öppna igen och Stäng igen", async () => {
    await td.oppnaTillfalle(await tfNu(), null);
    assert.deepEqual(await raknare(), [2, 2, 1, false]);
    await td.stangTillfalle(await tfNu());
    assert.deepEqual(await raknare(), [4, 2, 1, true]);
  });

  it("omprov: egna räknare", async () => {
    await env.seed(async (db) => {
      await setDoc(doc(db, "provTillfallen", "t-omprov"), { provId: "p1", provNamn: "Vikingar", classId: "4a", createdBy: "ak4", status: "oppet", fragor, installningar: {}, elevIds: ["x2"], omprovAv: T });
      await setDoc(doc(db, "provTillfallen", "t-omprov", "svar", "x2"), { elevId: "x2", classId: "4a", svar: ALLA_RATT, inlamnad: true, inlamnadNar: "elev" });
    });
    await td.stangTillfalle(await td.hamtaTillfalle("t-omprov"));
    const o = await td.hamtaTillfalle("t-omprov");
    assert.deepEqual([o.rattStatus, o.attRatta], [{ antal: 1, rattade: 0, tillbaka: 0 }, true]);
    assert.deepEqual(await raknare(), [4, 2, 1, true], "ursprunget orört");
  });

  it("F1: Stäng med ett inaktuellt tillfälle i minnet räknar mot det lagrade (transaktionen godtas av reglerna)", async () => {
    const gammal = await tfNu();
    await env.seed(async (db) => {
      const { updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "provTillfallen", T), { "rattStatus.rattade": 3 }); // "en annan flik" rättade en till
    });
    await td.stangTillfalle(gammal);
    assert.deepEqual(await raknare(), [4, 3, 1, true]);
  });

  it("reglerna gäller: ak4 får inte stänga (och räkna) ett prov i 5a", async () => {
    await env.seed(async (db) => {
      await setDoc(doc(db, "provTillfallen", "t-5a"), { provId: "p1", provNamn: "X", classId: "5a", createdBy: "ak5", status: "oppet", fragor: [], installningar: {} });
    });
    await assert.rejects(td.stangTillfalle({ id: "t-5a", classId: "5a", status: "oppet" }), (e) => /permission/i.test(String(e.code || e.message)));
  });

  it("Hem: en projektion per klass + att rätta + öppna prov (+ Kom igång) – inga elevdokument", async () => {
    const { glomAttRatta } = await import("../src/prov/prov-raknare.js");
    glomAttRatta();
    const classes = [{ id: "4a", name: "4A", studentIds: ["e4a"] }, { id: "4b", name: "4B", studentIds: ["e4b"] }];
    const fran = logg().length;
    const ut = await hemData.lasHem({ classes, synliga: classes, role: { uid: "ak4", admin: false, classIds: new Set(["4a", "4b"]) }, fraga: { prov: true, live: true } });
    const las = logg().slice(fran);
    assert.deepEqual(las.filter((l) => l.includes("classProjections")).sort(), ["doc classProjections/4a", "doc classProjections/4b"]);
    assert.equal(las.length, 2 + 4, las.join(" | "));
    assert.ok(!las.some((l) => /students|studentData|\/svar|\/rattning/.test(l)), las.join(" | "));
    assert.deepEqual(ut.attRatta.map((r) => [r.id, r.antal]).sort(), [["t-emu", 1], ["t-omprov", 1]]);
    assert.deepEqual(ut.oppnaProv, []);
    assert.equal(ut.members.get("4a").e4a.ovat, "2026-09-01");
    console.log("Hem-läsningar (emulator):", las.join(" | "));
  });
});
