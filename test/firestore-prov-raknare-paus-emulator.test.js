// ============================================================================
// #812 (merge av #810 in i epic #802): räknarna (#807) och helskärmsläget (#810)
// tillsammans – mot EMULATORN med de riktiga reglerna och de riktiga src-modulerna,
// inloggad som årskurskontot ak4 (klasserna 4a+4b):
//   * Släpp in (+5 min) och Helskärm av/på ändrar aldrig räknarna eller flaggan
//   * Stäng med pausade elever: de markeras inlämnade och räknas, pausdatan står kvar
//   * Öppna igen: en pausad elev är fortfarande pausad (läraren släpper in), räknarna
//     ur svaren som läses; Stäng igen räknar alla
//   * "Att rätta"-frågan och Hem läser aldrig svaren (pausdatan)
// Eget projekt-id: kan köras parallellt med de andra emulatortesterna.
// Körs av `npm run test:rules` (kräver FIRESTORE_EMULATOR_HOST – hoppas annars över).
// ============================================================================

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Timestamp, doc, getDoc, setDoc } from "firebase/firestore";
import { installeraMedProjekt } from "./helpers/emulator-eget-projekt-tester807.js";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";

const HAR_EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;
const PROJEKT = "pluggportalen-812-paus";
const T = "t-paus";
const PAUS = (orsak) => ({ pausad: true, pausadAt: Timestamp.fromMillis(1_760_000_000_000), pausOrsak: orsak, pausLogg: [{ at: 1_760_000_000_000, orsak }], flikbyten: 1 });

describe("räknarna och helskärmsläget tillsammans (riktiga regler, ak4)", { skip: !HAR_EMULATOR && "ingen FIRESTORE_EMULATOR_HOST" }, () => {
  let env, td, attRatta, hemData;
  const logg = () => globalThis.__ppEmuLas;

  before(async () => {
    env = await createRollerEnv(PROJEKT);
    await installeraMedProjekt(PROJEKT, { sub: "ak4", user_id: "ak4", teacher: true, role: "arskurs" });
    await env.testEnv.clearFirestore();
    await seedRoller(env);
    await env.seed(async (db) => {
      await setDoc(doc(db, "provTillfallen", T), {
        provId: "p1", provNamn: "Vikingar", classId: "4a", createdBy: "ak4", status: "oppet", fragor: [], installningar: {},
        tidsgransMin: 40, helskarm: true, helskarmUndantag: [],
      });
      const svar = { e4a: { inlamnad: true, inlamnadNar: "elev" }, x1: { inlamnad: false, ...PAUS("flik") }, x2: { inlamnad: false, ...PAUS("helskarm") }, x3: { inlamnad: false } };
      for (const [uid, d] of Object.entries(svar)) {
        await setDoc(doc(db, "provTillfallen", T, "svar", uid), { elevId: uid, classId: "4a", svar: {}, ...d });
      }
    });
    td = await import("../src/prov/prov-tillfalle-data.js");
    attRatta = await import("../src/prov/prov-att-ratta.js");
    hemData = await import("../src/teacher-hem-data.js");
  });
  after(async () => {
    if (env) await env.testEnv.cleanup();
    setTimeout(() => process.exit(process.exitCode || 0), 200).unref();
  });

  const tfNu = () => td.hamtaTillfalle(T);
  const raknare = async () => { const d = await tfNu(); return [d.rattStatus?.antal, d.rattStatus?.rattade, d.rattStatus?.tillbaka, d.attRatta]; };
  const svarDok = async (uid) => (await getDoc(doc(env.admin(), "provTillfallen", T, "svar", uid))).data();
  const pausade = () => new Promise((klar, fel) => {
    const sluta = td.lyssnaPausade(T, (p) => { sluta(); klar(Object.keys(p).sort()); }, fel);
  });

  it("öppet prov: Släpp in (+5 min) och Helskärm av/på rör inte räknarna", async () => {
    assert.deepEqual(await pausade(), ["x1", "x2"]);
    const ny = await td.slappIn(await tfNu(), ["x1"], { plusMin: true });
    assert.deepEqual(ny, { x1: 5 });
    await td.sparaHelskarm(T, { pa: false, undantag: ["x3"] });
    await td.sparaHelskarm(T, { pa: true, undantag: [] });
    const tf = await tfNu();
    assert.deepEqual(tf.extraTid, { x1: 5 });
    assert.equal(tf.helskarm, true);
    assert.deepEqual(await raknare(), [undefined, undefined, undefined, undefined], "öppet prov utan rättning har inga räknare");
    assert.equal((await svarDok("x1")).pausad, false);
    assert.deepEqual(await pausade(), ["x2"]);
    assert.deepEqual(await attRatta.lasAttRattaTillfallen(["4a"]), Object.assign([], { fler: false }));
  });

  it("Stäng med en pausad elev: hen markeras inlämnad och räknas, pausdatan står kvar", async () => {
    const markerade = await td.stangTillfalle(await tfNu());
    assert.equal(markerade, 3);
    assert.deepEqual(await raknare(), [4, 0, 0, true]);
    const x2 = await svarDok("x2");
    assert.deepEqual([x2.inlamnad, x2.inlamnadNar, x2.pausad, x2.pausLogg.length], [true, "stangt", true, 1]);
    assert.deepEqual((await attRatta.lasAttRattaTillfallen(["4a"])).map((t) => t.id), [T]);
  });

  it("Hem: Att rätta räknar alla fyra – och läser inga svar (pausdatan)", async () => {
    const { glomAttRatta } = await import("../src/prov/prov-raknare.js");
    glomAttRatta();
    const classes = [{ id: "4a", name: "4A", studentIds: ["e4a"] }];
    const fran = logg().length;
    const ut = await hemData.lasHem({ classes, synliga: classes, role: { uid: "ak4", admin: false, classIds: new Set(["4a", "4b"]) }, fraga: { prov: true, live: true } });
    const las = logg().slice(fran);
    assert.ok(!las.some((l) => /\/svar|\/rattning/.test(l)), las.join(" | "));
    assert.deepEqual(ut.attRatta.map((r) => [r.id, r.antal]), [[T, 4]]);
  });

  it("Öppna igen: den pausade är fortfarande pausad, räknarna ur svaren; Släpp in rör dem inte; Stäng räknar alla", async () => {
    await td.oppnaTillfalle(await tfNu(), null);
    assert.deepEqual(await raknare(), [1, 0, 0, true]);
    const x2 = await svarDok("x2");
    assert.deepEqual([x2.inlamnad, x2.pausad], [false, true]);
    assert.deepEqual(await pausade(), ["x2"]);
    await td.slappIn(await tfNu(), ["x2"], { plusMin: true });
    assert.deepEqual((await tfNu()).extraTid, { x1: 5, x2: 5 });
    assert.deepEqual(await raknare(), [1, 0, 0, true]);
    assert.deepEqual(await pausade(), []);
    await td.stangTillfalle(await tfNu());
    assert.deepEqual(await raknare(), [4, 0, 0, true]);
  });
});
