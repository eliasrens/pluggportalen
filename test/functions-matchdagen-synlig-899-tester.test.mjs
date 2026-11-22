// ============================================================================
// Testarens tester #899 (Veckoschema A.1–A.2) – vänskapsmatchens serverväg för "Samma som Plugga"
// som coderns test inte täcker: HELA biblioteket (klassen utan assignedAreas → subjects/areas i
// ordning) och taket MAX_OMRADEN, både i bibliotekets och i klassens ordning.
// Egna ämnen med låg order (t899*) så att andra testers ämnen i samma emulator hamnar efter.
// `npm run test:functions` (eller bara Firestore-emulatorn).
// ============================================================================

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { utmana, svara } from "../functions/md-vanskap-lobby.js";
import { MAX_OMRADEN } from "../functions/matchdagen/md-synlighet.js";
import { createMvRig, karriar, KLASS, ANNA, CIA, OMRADE } from "./helpers/md-vanskap-rig.js";

const rig = createMvRig("mvt899");
const { deps, ctl, db } = rig;
const RAKNA = { name: "Addera", generator: { topic: "addition", variants: ["enkel"], grade: "ak4" } };
const AMNEN = { t899a: -1000, t899b: -999, t899c: -998 };
const STORT = 65; // fler än taket
const nr = (i) => String(i).padStart(2, "0");

async function rensa() {
  await rig.rensa();
  for (const s of Object.keys(AMNEN)) {
    for (const a of (await db.collection(`subjects/${s}/areas`).get()).docs) await a.ref.delete();
    await db.doc(`subjects/${s}`).delete();
  }
}
const tilldela = (...k) => db.doc(`classes/${KLASS}`).update({ assignedAreas: k.map((x) => ({ subjectId: x.split("/")[0], areaId: x.split("/")[1] })) });
const kallor = async (id, uid) => [...new Set((await rig.facit(id, uid)).bank.map((p) => p.kalla))].sort();
async function match() {
  const { utmaningId } = await utmana(deps, ANNA, { classId: KLASS, till: CIA });
  return (await svara(deps, CIA, { utmaningId, ja: true })).matchId;
}

before(rensa);
after(async () => { await rensa(); await rig.app.delete(); });
beforeEach(async () => {
  await rensa();
  ctl.clock = Date.parse("2026-11-22T09:00:00Z");
  ctl.rng = 0.25;
  await rig.seed();
  await db.doc(`classes/${KLASS}`).update({ elevModuler: { [ANNA]: ["matchdagen"], [CIA]: ["matchdagen"] } });
  await db.doc(`matchdagen/${CIA}`).set(karriar("Cias FF", "#8e24aa"));
});

describe("Samma som Plugga på servern – hela biblioteket och taket (#899, testaren)", () => {
  it("klassen utan assignedAreas: hela biblioteket, områden med underlag (Plugga + Räkna), tomma hoppas över", async () => {
    for (const [s, order] of Object.entries(AMNEN).slice(0, 2)) await db.doc(`subjects/${s}`).set({ name: s, order });
    await db.doc("subjects/t899a/areas/viking").set({ ...OMRADE, order: 1 });
    await db.doc("subjects/t899a/areas/tomt").set({ name: "Tomt", order: 2 });
    await db.doc("subjects/t899b/areas/addera").set({ ...RAKNA, order: 1 });
    // Cia har inga inställningar alls → standard = Samma som Plugga.
    const k = await kallor(await match(), CIA);
    assert.ok(k.includes("omrade:t899a/viking") && k.includes("rakna:t899b/addera"), `Cia: ${k}`);
    assert.ok(!k.some((x) => x.includes("tomt") || x.startsWith("tabell:")), `Cia: ${k}`);
  });

  it(`taket i bibliotekets ordning: bara de ${MAX_OMRADEN} första områdena (order) används`, async () => {
    await db.doc("subjects/t899a").set({ name: "a", order: AMNEN.t899a });
    for (let i = 0; i < STORT; i++) await db.doc(`subjects/t899a/areas/o${nr(i)}`).set({ ...OMRADE, name: `O${i}`, order: i });
    await db.doc(`classes/${KLASS}`).update({ matchdagenInst: { foljPlugga: true } });
    const k = await kallor(await match(), CIA);
    assert.ok(k.length > 1, `Cia: ${k}`);
    for (const x of k) assert.ok(Number(x.slice(-2)) < MAX_OMRADEN, `utanför taket: ${x}`);
  });

  it(`taket i klassens ordning: de ${MAX_OMRADEN} första i assignedAreas, inte bibliotekets`, async () => {
    await db.doc("subjects/t899a").set({ name: "a", order: AMNEN.t899a });
    const nycklar = [];
    for (let i = 0; i < STORT; i++) {
      await db.doc(`subjects/t899a/areas/o${nr(i)}`).set({ ...OMRADE, name: `O${i}`, order: i });
      nycklar.unshift(`t899a/o${nr(i)}`); // klassens ordning = omvänd
    }
    await tilldela(...nycklar);
    await db.doc(`matchdagenInst/${CIA}`).set({ foljPlugga: true, omraden: [], tabeller: [], rakna: [] });
    const k = await kallor(await match(), CIA);
    assert.ok(k.length > 1, `Cia: ${k}`);
    for (const x of k) assert.ok(Number(x.slice(-2)) >= STORT - MAX_OMRADEN, `utanför taket: ${x}`);
  });

  it("Välj själv utan assignedAreas: allt syns, valda områden används oförändrade", async () => {
    await db.doc("subjects/t899a").set({ name: "a", order: AMNEN.t899a });
    await db.doc("subjects/t899a/areas/viking").set({ ...OMRADE, order: 1 });
    await db.doc(`matchdagenInst/${CIA}`).set({ omraden: ["t899a/viking"], tabeller: [4], rakna: [], foljPlugga: false });
    assert.deepEqual(await kallor(await match(), CIA), ["omrade:t899a/viking", "tabell:4"]);
  });
});
