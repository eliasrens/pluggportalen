// ============================================================================
// Tester #876: vänskapsmatchernas serverkärna med Matchdagen för HELA klassen
// (classes/{id}.enabledModules) och klassens inställningar (classes/{id}.matchdagenInst)
// mot Firestore-emulatorn. Frågebanken i facit visar vilka inställningar servern valde:
//   egna > klassens > tabellerna 0–10; fokuslåset stänger även klassvis Matchdagen;
//   klassen av och ingen elevModuler → nekad; egna utan källor går ändå före klassens.
// `npm run test:functions` (eller bara Firestore-emulatorn).
// ============================================================================

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { utmana, svara } from "../functions/md-vanskap-lobby.js";
import { MdFel } from "../functions/md-vanskap-spel.js";
import { createMvRig, karriar, KLASS, ANNA, BO, CIA } from "./helpers/md-vanskap-rig.js";

const rig = createMvRig("mvk876");
const { deps, ctl, db } = rig;
async function kod(p) {
  try { await p; } catch (e) { if (!(e instanceof MdFel)) throw e; return e.code; }
  return "ok";
}
const kallor = async (id, uid) => [...new Set((await rig.facit(id, uid)).bank.map((p) => p.kalla))].sort();
const tabeller = (...t) => t.map((x) => `tabell:${x}`).sort();

before(() => rig.rensa());
after(() => rig.app.delete());
beforeEach(async () => {
  await rig.rensa();
  ctl.clock = Date.parse("2026-11-20T09:00:00Z");
  ctl.rng = 0.25;
  await rig.seed();
  // Klassen: Matchdagen för HELA klassen, ingen elevModuler. Cia har klubb men inga egna inställningar.
  await db.doc(`classes/${KLASS}`).update({ enabledModules: ["matchdagen"], elevModuler: {} });
  await db.doc(`matchdagen/${CIA}`).set(karriar("Cias FF", "#8e24aa"));
});

async function match(fran, till) {
  const { utmaningId } = await utmana(deps, fran, { classId: KLASS, till });
  return (await svara(deps, till, { utmaningId, ja: true })).matchId;
}

describe("Matchdagen för hela klassen i vänskapsmatcherna (#876)", () => {
  it("klassen på: Cia (bara klassen) kan utmana och antas; utan klassens inst → tabellerna 0–10", async () => {
    // #899: utan inställningar gäller "Samma som Plugga" – tabellerna 0–10 bara när klassen inte ser
    // något område med frågor (här ett område som inte finns).
    await db.doc(`classes/${KLASS}`).update({ assignedAreas: [{ subjectId: "mvso", areaId: "finnsinte-876" }] });
    const id = await match(CIA, ANNA);
    assert.ok(id);
    const k = await kallor(id, CIA);
    assert.ok(k.length > 1 && k.every((x) => /^tabell:(10|[0-9])$/.test(x)), `Cia: ${k}`);
    assert.deepEqual(await kallor(id, ANNA), tabeller(7), "Anna: egna (tabell 7)");
  });
  it("klassens inställningar används för elev utan egna, egna går före", async () => {
    await db.doc(`classes/${KLASS}`).update({ matchdagenInst: { omraden: [], tabeller: [2, 5], rakna: [], svarssatt: "skriv", klocka: 0, lugnt: false, paus: 60 } });
    const id = await match(CIA, BO);
    assert.deepEqual(await kallor(id, CIA), tabeller(2, 5));
    assert.equal((await rig.facit(id, CIA)).bank[0].pub.typ, "skriv", "klassens svarssätt");
    assert.deepEqual(await kallor(id, BO), ["omrade:mvso/vikingar"], "Bo: egna");
  });
  it("klassen av och ingen elevModuler → nekad", async () => {
    await db.doc(`classes/${KLASS}`).update({ enabledModules: [] });
    assert.equal(await kod(utmana(deps, CIA, { classId: KLASS, till: ANNA })), "failed-precondition");
  });
  it("fokuslås stänger även klassvis Matchdagen", async () => {
    await db.doc(`classes/${KLASS}`).update({ lock: { mal: { typ: "omrade", id: "so/x" }, till: ctl.clock + 60_000 } });
    assert.equal(await kod(utmana(deps, CIA, { classId: KLASS, till: ANNA })), "failed-precondition");
  });
  it("egna inställningar UTAN källor går före klassens → ingen match (dokumenterat beteende)", async () => {
    await db.doc(`classes/${KLASS}`).update({ matchdagenInst: { tabeller: [2] } });
    await db.doc(`matchdagenInst/${CIA}`).set({ omraden: [], tabeller: [], rakna: [] });
    const { utmaningId } = await utmana(deps, ANNA, { classId: KLASS, till: CIA });
    assert.equal(await kod(svara(deps, CIA, { utmaningId, ja: true })), "failed-precondition");
  });
  it("elev i klassen men inte i studentIds-listan för en annan klass: klassvis gäller bara den egna klassen", async () => {
    await db.doc("classes/mvk876-x").set({ name: "X", studentIds: ["mvk876-ute"], enabledModules: ["matchdagen"] });
    assert.equal(await kod(utmana(deps, CIA, { classId: "mvk876-x", till: "mvk876-ute" })), "permission-denied");
    await db.doc("classes/mvk876-x").delete();
  });
});
