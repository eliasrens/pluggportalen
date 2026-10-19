// #807 tester: årskurslärare ak4 som INTE skapade provet (createdBy = "kollega") men har klassen 4a:
// Stäng, rättning, Öppna igen med de riktiga src-modulerna mot emulatorn och riktiga regler.
// Och: tillfälle i 5a (ej ak4:s klass) nekas, även att räkna.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { doc, setDoc } from "firebase/firestore";
import { installeraMedProjekt } from "./helpers/emulator-eget-projekt-tester807.js";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";
import { EXEMPEL } from "./helpers/prov-exempel.js";

const PROJEKT = "pluggportalen-807-kollega";
const HAR = !!process.env.FIRESTORE_EMULATOR_HOST;
const RATT = { q1: 0, q2: [0, 1], q3: false, q4: "Birka", q5: ["Miklagård", "Bagdad"], q6: ["Åska", "Visdom", "Kärlek"], q7: ["Stenåldern", "Bronsåldern", "Järnåldern", "Vikingatiden"] };
describe("#807 kollega med klassen skriver räknarna (riktiga regler, ak4)", { skip: !HAR && "ingen emulator" }, () => {
  let env, td, rd, lagerMod, logik, fragor, facit;
  before(async () => {
    env = await createRollerEnv(PROJEKT);
    await installeraMedProjekt(PROJEKT, { sub: "ak4", user_id: "ak4", teacher: true, role: "arskurs" });
    await env.testEnv.clearFirestore();
    await seedRoller(env);
    const { validateProv } = await import("../src/prov/prov-validera.js");
    const { delaUppProv } = await import("../src/prov/prov-modell.js");
    const lista = ["flerval", "flerval-flera", "santfalskt", "kortsvar", "lucktext", "para", "ordna"].map((k) => structuredClone(EXEMPEL[k].f));
    ({ fragor, facit } = delaUppProv(validateProv({ namn: "Auto", installningar: {}, fragor: lista }).value));
    await env.seed(async (db) => {
      const tf = { provId: "p1", provNamn: "Auto", classId: "4a", createdBy: "kollega", status: "oppet", fragor, installningar: {} };
      await setDoc(doc(db, "provTillfallen", "k1"), tf);
      await setDoc(doc(db, "provTillfallen", "k1", "privat", "facit"), { facit, bedomningsstod: {} });
      for (const [uid, inl] of [["a", true], ["b", false], ["c", false]]) await setDoc(doc(db, "provTillfallen", "k1", "svar", uid), { elevId: uid, classId: "4a", svar: RATT, inlamnad: inl, ...(inl ? { inlamnadNar: "elev" } : {}) });
      await setDoc(doc(db, "provTillfallen", "x5"), { ...tf, classId: "5a", createdBy: "ak5" });
    });
    td = await import("../src/prov/prov-tillfalle-data.js");
    rd = await import("../src/prov/prov-rattning-data.js");
    lagerMod = await import("../src/prov/prov-ratta-lager.js");
    logik = await import("../src/prov/prov-rattning-logik.js");
  });
  after(async () => {
    if (env) await env.testEnv.cleanup();
    setTimeout(() => process.exit(process.exitCode || 0), 200).unref();
  });
  const nu = async () => { const d = await td.hamtaTillfalle("k1"); return [d.rattStatus?.antal, d.rattStatus?.rattade, d.rattStatus?.tillbaka, d.attRatta]; };

  it("Stäng → Rätta alla → återlämna → Öppna igen → Stäng (provet skapat av en kollega)", async () => {
    await td.stangTillfalle(await td.hamtaTillfalle("k1"));
    assert.deepEqual(await nu(), [3, 0, 0, true]);
    const data = await rd.laddaRattning("k1");
    const med = Object.values(data.svar).filter((s) => s.inlamnad).map((s) => s.id);
    const lager = lagerMod.skapaRattningsLager({ data, med, onStatus: (s) => { if (s.lage === "nekad") throw new Error("nekad"); } });
    await lager.spola();
    await lager.rattaAlla();
    assert.deepEqual(await nu(), [3, 3, 0, false]);
    await lager.lamnaTillbaka(["a"], false);
    assert.deepEqual(await nu(), [3, 3, 1, false]);
    await td.oppnaTillfalle(await td.hamtaTillfalle("k1"), null);
    assert.deepEqual(await nu(), [1, 1, 1, false]);
    await td.stangTillfalle(await td.hamtaTillfalle("k1"));
    assert.deepEqual(await nu(), [3, 1, 1, true]);
  });
  it("tillfälle i 5a: Stäng nekas", async () => {
    await assert.rejects(td.stangTillfalle({ id: "x5", classId: "5a", status: "oppet" }), (e) => /permission/i.test(String(e.code || e.message)));
  });
});
