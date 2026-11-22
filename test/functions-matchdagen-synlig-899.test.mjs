// ============================================================================
// Tester #899 (Veckoschema A.1–A.2, spec F.1 Functions): vänskapsmatchens frågebank följer det
// eleven ser i Plugga – mot Firestore-emulatorn (md-vanskap-rig.js). Facit-bankens källor visar
// vad servern valde:
//   • valda områden ∩ klassens assignedAreas (omraden och rakna), tabellerna orörda
//   • "Samma som Plugga" (foljPlugga) = de synliga områdena med underlag, plus valda tabeller
//   • helt utan inställningar: Samma som Plugga, annars tabellerna 0–10
//   • inget kvar efter filtret → vänligt besked, ingen match
//   • en elev i flera klasser följer Plugga-listans klass (lägst order, sedan namnet)
// `npm run test:functions` (eller bara Firestore-emulatorn).
// ============================================================================

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { utmana, svara } from "../functions/md-vanskap-lobby.js";
import { MdFel } from "../functions/md-vanskap-spel.js";
import { createMvRig, karriar, KLASS, ANNA, BO, CIA, OMRADE } from "./helpers/md-vanskap-rig.js";

const rig = createMvRig("mvs899");
const { deps, ctl, db } = rig;
const ALLA = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((t) => `tabell:${t}`).sort();
const RAKNA = { name: "Addera", generator: { topic: "addition", variants: ["enkel"], grade: "ak4" } };
const AREAS = { "mvso/vikingar": OMRADE, "mvso/tomt": { name: "Tomt" }, "mvma/addera": RAKNA, "mvso/stenalder": { ...OMRADE, name: "Stenålder" } };
const tilldela = (...k) => db.doc(`classes/${KLASS}`).update({ assignedAreas: k.map((x) => ({ subjectId: x.split("/")[0], areaId: x.split("/")[1] })) });
const kallor = async (id, uid) => [...new Set((await rig.facit(id, uid)).bank.map((p) => p.kalla))].sort();

async function fel(p) {
  try { await p; } catch (e) { if (!(e instanceof MdFel)) throw e; return e; }
  return null;
}
async function match(fran, till) {
  const { utmaningId } = await utmana(deps, fran, { classId: KLASS, till });
  return (await svara(deps, till, { utmaningId, ja: true })).matchId;
}
async function rensa() {
  await rig.rensa();
  for (const k of Object.keys(AREAS)) await db.doc(`subjects/${k.split("/")[0]}/areas/${k.split("/")[1]}`).delete();
  await db.doc("classes/mvs899-sp").delete();
}

before(rensa);
after(async () => { await rensa(); await rig.app.delete(); });
beforeEach(async () => {
  await rensa();
  ctl.clock = Date.parse("2026-11-22T09:00:00Z");
  ctl.rng = 0.25;
  await rig.seed();
  for (const [k, a] of Object.entries(AREAS)) await db.doc(`subjects/${k.split("/")[0]}/areas/${k.split("/")[1]}`).set(a);
  await db.doc(`classes/${KLASS}`).update({ elevModuler: { [ANNA]: ["matchdagen"], [BO]: ["matchdagen"], [CIA]: ["matchdagen"] } });
  await db.doc(`matchdagen/${CIA}`).set(karriar("Cias FF", "#8e24aa"));
});

describe("vänskapsmatchen följer det som är synligt (#899)", () => {
  it("A.1: valda områden ∩ synliga – ett dolt område ger inga frågor, tabellerna orörda", async () => {
    await tilldela("mvso/stenalder");
    await db.doc(`matchdagenInst/${ANNA}`).set({ omraden: ["mvso/vikingar", "mvso/stenalder"], rakna: ["mvma/addera"], tabeller: [7] });
    const id = await match(ANNA, CIA);
    assert.deepEqual(await kallor(id, ANNA), ["omrade:mvso/stenalder", "tabell:7"]);
  });
  it("A.1: inget kvar efter filtret → vänligt besked och ingen match", async () => {
    await tilldela("mvso/stenalder");
    const { utmaningId } = await utmana(deps, ANNA, { classId: KLASS, till: BO });
    const e = await fel(svara(deps, BO, { utmaningId, ja: true }));
    assert.equal(e?.code, "failed-precondition");
    assert.equal(e.message, "Din lärare behöver välja frågor till Matchdagen.");
    assert.equal((await rig.lobby()).matcher && Object.keys((await rig.lobby()).matcher).length, 0);
  });
  it("A.2: Samma som Plugga – de synliga med underlag (Plugga och Räkna) plus valda tabeller", async () => {
    await tilldela("mvma/addera", "mvso/tomt", "mvso/vikingar", "mvso/finnsinte");
    await db.doc(`matchdagenInst/${ANNA}`).set({ foljPlugga: true, omraden: ["mvso/stenalder"], tabeller: [3] });
    const id = await match(ANNA, CIA);
    assert.deepEqual(await kallor(id, ANNA), ["omrade:mvso/vikingar", "rakna:mvma/addera", "tabell:3"]);
  });
  it("A.2: helt utan inställningar → Samma som Plugga", async () => {
    await tilldela("mvso/vikingar");
    const id = await match(ANNA, CIA);
    assert.deepEqual(await kallor(id, CIA), ["omrade:mvso/vikingar"]);
  });
  it("A.2: helt utan inställningar och inget synligt med underlag → tabellerna 0–10", async () => {
    await tilldela("mvso/tomt");
    const id = await match(ANNA, CIA);
    assert.deepEqual(await kallor(id, CIA), ALLA);
  });
  it("A.2: klassens Samma som Plugga utan något synligt → besked (ingen reserv när läraren valt)", async () => {
    await tilldela("mvso/tomt");
    await db.doc(`classes/${KLASS}`).update({ matchdagenInst: { foljPlugga: true } });
    const { utmaningId } = await utmana(deps, ANNA, { classId: KLASS, till: CIA });
    assert.equal((await fel(svara(deps, CIA, { utmaningId, ja: true })))?.message, "Din lärare behöver välja frågor till Matchdagen.");
  });
  it("gamla inställningar utan foljPlugga = Välj själv", async () => {
    await tilldela("mvso/vikingar", "mvso/stenalder");
    const id = await match(ANNA, BO);
    assert.deepEqual(await kallor(id, BO), ["omrade:mvso/vikingar"]);
    assert.deepEqual(await kallor(id, ANNA), ["tabell:7"]);
  });
  it("flera klasser: Plugga-listans klass (lägst order) avgör synligheten", async () => {
    await tilldela("mvso/vikingar");
    await db.doc("classes/mvs899-sp").set({ name: "Specialgrupp", order: -1, studentIds: [CIA],
      assignedAreas: [{ subjectId: "mvso", areaId: "stenalder" }] });
    const id = await match(ANNA, CIA);
    assert.deepEqual(await kallor(id, CIA), ["omrade:mvso/stenalder"]);
  });
});
