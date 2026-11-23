// ============================================================================
// Tester #903 (Veckoschema Del E, spec F.1 Functions): vänskapsmatchens start med schema, med
// SERVERNS tid (ctl.clock = c.now()) – mot Firestore-emulatorn (md-vanskap-rig.js):
//   • en NO-lektion pågår → bara NO-frågor (ämnesfiltret), tabellerna bort när de inte är kopplade
//   • inget kvar efter filtret → reserven "Samma som Plugga inom ämnet"
//   • båda får frågor → matchen startar; den ena saknar frågor → vänligt besked, ingen match
//   • samma schema utanför lektionen (eller urbockat) → som vanligt
// `npm run test:functions` (eller bara Firestore-emulatorn).
// ============================================================================

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { utmana, svara } from "../functions/md-vanskap-lobby.js";
import { MdFel } from "../functions/md-vanskap-spel.js";
import { createMvRig, karriar, KLASS, ANNA, BO, CIA, OMRADE } from "./helpers/md-vanskap-rig.js";

const rig = createMvRig("mvl903");
const { deps, ctl, db } = rig;
// 2026-11-23 är en måndag; 08:30 UTC = 09:30 svensk tid (CET).
const LEKTION = Date.parse("2026-11-23T08:30:00Z");
const EFTER = Date.parse("2026-11-23T09:30:00Z"); // 10:30 – lektionen är slut
// `order` som i biblioteket (Plugga-listan och servern sorterar på det).
const AREAS = {
  "mvlso/vikingar": { ...OMRADE, order: 1 },
  "mvlno/lasning": { name: "Läsning", order: 1, texts: [{ title: "T", body: "B" }] },
  "mvlno/kroppen": { ...OMRADE, name: "Kroppen", order: 2 },
  "mvlsv/lasa": { name: "Läsa", order: 1, texts: [{ title: "T", body: "B" }] },
};
const SUBJ = { mvlso: { name: "SO", order: 901 }, mvlno: { name: "NO", order: 902 }, mvlsv: { name: "Svenska", order: 903 }, mvlma: { name: "Matematik", order: 904 } };
const lektion = (amne, over = {}) => ({ id: `l${amne}`, dag: 1, start: "09:00", slut: "10:00", amne, ...over });
const schema = (lektioner, over = {}) => db.doc(`classes/${KLASS}`).update({ schema: { pa: true, lektioner, koppling: {}, ...over } });
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
  for (const s of Object.keys(SUBJ)) await db.doc(`subjects/${s}`).delete();
}

before(rensa);
after(async () => { await rensa(); await rig.app.delete(); });
beforeEach(async () => {
  await rensa();
  ctl.clock = LEKTION;
  ctl.rng = 0.25;
  await rig.seed();
  for (const [s, d] of Object.entries(SUBJ)) await db.doc(`subjects/${s}`).set(d);
  for (const [k, a] of Object.entries(AREAS)) await db.doc(`subjects/${k.split("/")[0]}/areas/${k.split("/")[1]}`).set(a);
  await db.doc(`classes/${KLASS}`).update({ elevModuler: { [ANNA]: ["matchdagen"], [BO]: ["matchdagen"], [CIA]: ["matchdagen"] } });
  await db.doc(`matchdagen/${CIA}`).set(karriar("Cias FF", "#8e24aa"));
  await tilldela("mvlso/vikingar", "mvlno/kroppen", "mvlno/lasning", "mvlsv/lasa");
});

describe("vänskapsmatchen under en lektion (#903, serverns tid)", () => {
  it("NO-lektion: bara NO-frågor – valda NO-områden, tabellerna bort (inte kopplade till NO)", async () => {
    await schema([lektion("mvlno")]);
    await db.doc(`matchdagenInst/${ANNA}`).set({ omraden: ["mvlno/kroppen", "mvlso/vikingar"], tabeller: [7] });
    await db.doc(`matchdagenInst/${BO}`).set({ omraden: ["mvlno/kroppen"] });
    const id = await match(ANNA, BO);
    assert.deepEqual(await kallor(id, ANNA), ["omrade:mvlno/kroppen"]);
    assert.deepEqual(await kallor(id, BO), ["omrade:mvlno/kroppen"]);
  });
  it("inget NO bland de valda → reserven Samma som Plugga inom NO (bara områden med underlag)", async () => {
    await schema([lektion("mvlno")]);
    // Anna: tabell 7 (riggen), Bo: SO-området – inget av det är NO.
    await db.doc(`matchdagenInst/${BO}`).set({ omraden: ["mvlso/vikingar"] });
    const id = await match(ANNA, BO);
    assert.deepEqual(await kallor(id, ANNA), ["omrade:mvlno/kroppen"]);
    assert.deepEqual(await kallor(id, BO), ["omrade:mvlno/kroppen"]);
  });
  it("Matte-lektion med tabellerna kopplade till ämnet: tabellerna står kvar", async () => {
    await schema([lektion("mvlma")], { koppling: { "matchdagen:tabeller": "mvlma" } });
    await db.doc(`matchdagenInst/${BO}`).set({ tabeller: [3] });
    const id = await match(ANNA, BO);
    assert.deepEqual(await kallor(id, ANNA), ["tabell:7"]);
    assert.deepEqual(await kallor(id, BO), ["tabell:3"]);
  });
  it("den ena saknar frågor under sin lektion → vänligt besked till den som antar, ingen match", async () => {
    await schema([lektion("mvlsv")]); // Svenska: bara läsning, ingen tabellkoppling
    const { utmaningId } = await utmana(deps, ANNA, { classId: KLASS, till: BO });
    const e = await fel(svara(deps, BO, { utmaningId, ja: true }));
    assert.equal(e?.code, "failed-precondition");
    assert.match(e.message, /^(Kompisen har Svenska-lektion just nu|Just nu är det Svenska-lektion)/);
    assert.match(e.message, /klockan 10\.00\./);
    assert.equal(Object.keys((await rig.lobby()).matcher || {}).length, 0);
    assert.equal((await db.doc(`mdVanskapElev/${BO}`).get()).data()?.aktiv ?? null, null);
  });
  it("bara kompisen har lektionen (en annan klass) → beskedet nämner kompisen", async () => {
    await db.doc("classes/mvl903-sv").set({ name: "Svenska-gruppen", order: -1, studentIds: [ANNA],
      assignedAreas: [{ subjectId: "mvlsv", areaId: "lasa" }], schema: { pa: true, lektioner: [lektion("mvlsv")], koppling: {} } });
    await db.doc(`matchdagenInst/${BO}`).set({ omraden: ["mvlso/vikingar"] });
    try {
      const { utmaningId } = await utmana(deps, ANNA, { classId: KLASS, till: BO });
      const e = await fel(svara(deps, BO, { utmaningId, ja: true }));
      assert.equal(e?.message, "Kompisen har Svenska-lektion just nu och kan inte få några frågor till Matchdagen. Prova igen efter klockan 10.00.");
    } finally {
      await db.doc("classes/mvl903-sv").delete();
    }
  });
  it("den som antar saknar frågor → beskedet till eleven själv", async () => {
    await db.doc("classes/mvl903-sv").set({ name: "Svenska-gruppen", order: -1, studentIds: [BO],
      assignedAreas: [{ subjectId: "mvlsv", areaId: "lasa" }], schema: { pa: true, lektioner: [lektion("mvlsv")], koppling: {} } });
    try {
      const { utmaningId } = await utmana(deps, ANNA, { classId: KLASS, till: BO });
      const e = await fel(svara(deps, BO, { utmaningId, ja: true }));
      assert.equal(e?.message, "Just nu är det Svenska-lektion och Matchdagen har inga frågor i Svenska. Matchdagen öppnar igen klockan 10.00.");
    } finally {
      await db.doc("classes/mvl903-sv").delete();
    }
  });
  it("fokuslåset går före schemat: ett aktivt lås i elevens andra klass → inget schemafilter", async () => {
    await db.doc("classes/mvl903-sv").set({ name: "Svenska-gruppen", order: 5, studentIds: [ANNA],
      lock: { mal: { typ: "omrade", id: "mvlsv/lasa" }, till: LEKTION + 3_600_000 },
      schema: { pa: true, lektioner: [lektion("mvlsv")], koppling: {} } });
    try {
      const id = await match(ANNA, CIA);
      assert.deepEqual(await kallor(id, ANNA), ["tabell:7"]);
    } finally {
      await db.doc("classes/mvl903-sv").delete();
    }
  });
  it("serverns tid avgör: samma schema efter lektionen → som vanligt", async () => {
    await schema([lektion("mvlsv")]);
    ctl.clock = EFTER;
    const id = await match(ANNA, CIA);
    assert.deepEqual(await kallor(id, ANNA), ["tabell:7"]);
    assert.deepEqual(await kallor(id, CIA), ["omrade:mvlno/kroppen", "omrade:mvlso/vikingar"]);
  });
  it("urbockat schema (pa: false) mitt i lektionstid → som vanligt", async () => {
    await schema([lektion("mvlsv")], { pa: false });
    const id = await match(ANNA, CIA);
    assert.deepEqual(await kallor(id, ANNA), ["tabell:7"]);
  });
  it("hela biblioteket: reserven läser bara lektionsämnets områden", async () => {
    await db.doc(`classes/${KLASS}`).update({ assignedAreas: [] });
    await schema([lektion("mvlno")]);
    const id = await match(ANNA, CIA);
    assert.deepEqual(await kallor(id, ANNA), ["omrade:mvlno/kroppen"]);
    assert.deepEqual(await kallor(id, CIA), ["omrade:mvlno/kroppen"]); // Cia: inga inställningar = Samma som Plugga
  });
});
