// #807 tester: eleven skriver `ovat` i klassprojektionen EXAKT som appen gör efter en övning
// (data.updateStudentProjectionAllClasses via mirrorStudentProjection + awardProjectionPatch + ovatIdag),
// inloggad som eleven e4a mot emulatorn med de riktiga reglerna. Och eleven kan inte röra räknarna.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { installeraMedProjekt } from "./helpers/emulator-eget-projekt-tester807.js";
import { createRollerEnv, seedRoller } from "./helpers/roller-env.js";

const PROJEKT = "pluggportalen-807-elev"; // eget projekt: parallellt med andra emulatortester
const HAR = !!process.env.FIRESTORE_EMULATOR_HOST;
describe("#807 eleven skriver ovat (riktiga regler, e4a)", { skip: !HAR && "ingen emulator" }, () => {
  let env, data, sync;
  before(async () => {
    env = await createRollerEnv(PROJEKT);
    await installeraMedProjekt(PROJEKT, { sub: "e4a", user_id: "e4a" });
    await env.testEnv.clearFirestore();
    await seedRoller(env);
    await env.seed(async (db) => {
      await setDoc(doc(db, "classProjections", "4a"), { members: { e4a: { namn: "e4a", stars: 1 }, kompis: { namn: "K", ovat: "2026-10-01" } } });
      await setDoc(doc(db, "provTillfallen", "t1"), { provId: "p", provNamn: "X", classId: "4a", createdBy: "ak4", status: "stangt", fragor: [], installningar: {}, rattStatus: { antal: 2, rattade: 0, tillbaka: 0 }, attRatta: true });
    });
    data = await import("../src/data.js");
    sync = await import("../src/projection-sync.js");
  });
  after(async () => {
    if (env) await env.testEnv.cleanup();
    setTimeout(() => process.exit(process.exitCode || 0), 200).unref();
  });
  const proj = async () => (await getDoc(doc(env.admin(), "classProjections", "4a"))).data().members;

  it("efter en övning: { ...awardProjectionPatch(sd), ovat } skrivs genom appens egen väg", async () => {
    const patch = { ...sync.awardProjectionPatch({ progress: {} }), ovat: sync.ovatIdag() };
    let fel = null;
    await sync.mirrorStudentProjection(data.updateStudentProjectionAllClasses, "e4a", patch, (e) => { fel = e; });
    assert.equal(fel, null, String(fel?.code || fel));
    const m = await proj();
    assert.equal(m.e4a.ovat, sync.ovatIdag());
    assert.equal(m.kompis.ovat, "2026-10-01", "klasskamratens post orörd");
  });
  it("ovat skrivs också när projektionsdokumentet saknas (setDoc merge-vägen)", async () => {
    await env.testEnv.withSecurityRulesDisabled(async (c) => { await (await import("firebase/firestore")).deleteDoc(doc(c.firestore(), "classProjections", "4a")); });
    let fel = null;
    await sync.mirrorStudentProjection(data.updateStudentProjectionAllClasses, "e4a", { stars: 0, xp: 0, completed: 0, plays: 0, ovat: sync.ovatIdag() }, (e) => { fel = e; });
    assert.equal(fel, null, String(fel?.code || fel));
    assert.equal((await proj()).e4a.ovat, sync.ovatIdag());
  });
  it("eleven kan inte skriva räknarna på tillfället", async () => {
    const { assertFails } = await import("@firebase/rules-unit-testing");
    await assertFails(updateDoc(doc(env.as("e4a"), "provTillfallen", "t1"), { attRatta: false, rattStatus: { antal: 2, rattade: 2, tillbaka: 0 } }));
  });
});
