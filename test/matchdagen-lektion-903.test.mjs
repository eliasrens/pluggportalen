// ============================================================================
// Veckoschema Del E (#903, docs/VECKOSCHEMA.md §Matchdagen under en lektion) – den rena logiken:
//   E.1  ämnesfiltret (omraden/rakna i lektionens ämnen, tabellerna bara när matchdagen:tabeller
//        är kopplad till lektionens ämne)
//   E.2  reserven "Samma som Plugga inom ämnet" (och tabellerna 0–10 när bara tabellerna är kopplade)
//   E.3  spärren när inget finns – lektionsBesked, och grindens lage.matchdagen === false
//        (menyn: gråad länk, "Öppnar 10.00"; direktlänk → Plugga-listan)
//   losKallor (md-synlig.js) under en lektion: bara lektionens ämnen läses
// Samma tester körs mot SERVERNS kopia (functions/matchdagen/md-synlighet.js och
// functions/matchdagen/kallor/klass-schema.js) – det är samma rena funktion.
// Ren Node: node --test test/matchdagen-lektion-903.test.mjs
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as klient from "../src/matchdagen/delat/md-synlighet.js";
import * as server from "../functions/matchdagen/md-synlighet.js";
import * as schemaKlient from "../src/klass-schema.js";
import * as schemaServer from "../functions/matchdagen/kallor/klass-schema.js";
import { losKallor } from "../src/matchdagen/md-synlig.js";
import { normalizeInst, STANDARD_FRAGOR } from "../src/matchdagen/md-inst.js";

const utc = (iso) => Date.parse(iso + "Z");
const MAN_0930 = utc("2026-11-23T08:30:00"); // måndag 23 nov 09:30 svensk tid (CET)
const MAN_1030 = utc("2026-11-23T09:30:00"); // måndag 10:30 – ingen lektion
const SOMMAR_0930 = utc("2026-06-01T07:30:00"); // måndag 1 juni 09:30 svensk tid (CEST)
const SUBJECTS = [{ id: "no", name: "NO" }, { id: "ma", name: "Matematik" }, { id: "sv", name: "Svenska" }, { id: "so", name: "SO" }];
const L = (amne, over = {}) => ({ id: `l${amne}`, dag: 1, start: "09:00", slut: "10:00", amne, ...over });
const klass = (lektioner, over = {}) => ({
  id: "4a", name: "4A", studentIds: ["e1"], elevModuler: { e1: ["matchdagen"] }, assignedAreas: [],
  schema: { pa: true, lektioner, koppling: {} }, ...over,
});
const a = (k) => ({ subjectId: k.split("/")[0], areaId: k.split("/")[1] });
const inst = (o = {}) => ({ ...normalizeInst(o), foljPlugga: false });
const SVENSKA = "Just nu är det Svenska-lektion och Matchdagen har inga frågor i Svenska. Matchdagen öppnar igen klockan 10.00.";

for (const [namn, M, S] of [["klienten", klient, schemaKlient], ["servern (kopian)", server, schemaServer]]) {
  describe(`E – ämnesfiltret, reserven och spärren (${namn})`, () => {
    const NO = { amnen: ["no"], tabeller: false, label: "NO", klockslag: "10:00" };
    const MA = { amnen: ["ma"], tabeller: true, label: "Matematik", klockslag: "10:00" };

    it("ingen lektion: källorna orörda", () => {
      const i = inst({ omraden: ["so/vikingar"], tabeller: [7] });
      assert.deepEqual(M.lektionsKallor(i, null), { inst: i, reserv: false, sparrad: false });
      assert.equal(M.lektionsFilter(i, null), i);
    });
    it("E.1: bara lektionens ämne – omraden och rakna – och tabellerna bort när de inte är kopplade", () => {
      const i = inst({ omraden: ["no/kroppen", "so/vikingar"], rakna: ["ma/addera", "no/matt"], tabeller: [7] });
      const r = M.lektionsKallor(i, NO);
      assert.deepEqual([r.inst.omraden, r.inst.rakna, r.inst.tabeller], [["no/kroppen"], ["no/matt"], []]);
      assert.deepEqual([r.reserv, r.sparrad], [false, false]);
    });
    it("E.1: tabellerna står kvar när matchdagen:tabeller är kopplad till lektionens ämne", () => {
      const r = M.lektionsKallor(inst({ omraden: ["no/kroppen"], tabeller: [3, 7] }), MA);
      assert.deepEqual([r.inst.omraden, r.inst.tabeller, r.reserv], [[], [3, 7], false]);
    });
    it("E.2: inget kvar efter filtret → Samma som Plugga inom ämnet", () => {
      const inom = M.pluggaKallor([
        { nyckel: "no/kroppen", plugga: true, rakna: false },
        { nyckel: "no/tomt", plugga: false, rakna: false },
        { nyckel: "no/matt", plugga: false, rakna: true },
        { nyckel: "so/vikingar", plugga: true, rakna: false }, // fel ämne – tas aldrig med
      ]);
      const r = M.lektionsKallor(inst({ omraden: ["so/vikingar"], tabeller: [7] }), NO, inom);
      assert.deepEqual([r.inst.omraden, r.inst.rakna, r.inst.tabeller], [["no/kroppen"], ["no/matt"], []]);
      assert.deepEqual([r.reserv, r.sparrad], [true, false]);
    });
    it("E.2: ämnet har inga områden med underlag men tabellerna är kopplade → tabellerna 0–10", () => {
      const r = M.lektionsKallor(inst({ omraden: ["no/kroppen"] }), MA, { omraden: [], rakna: [] });
      assert.deepEqual(r.inst.tabeller, [...M.STANDARD_TABELLER]);
      assert.deepEqual([r.reserv, r.sparrad], [true, false]);
    });
    it("E.3: inget alls i ämnet → spärrad, med ett vänligt besked", () => {
      const SV = { amnen: ["sv"], tabeller: false, label: "Svenska", klockslag: "10:00" };
      const r = M.lektionsKallor(inst({ omraden: ["no/kroppen"], tabeller: [7] }), SV, { omraden: [], rakna: [] });
      assert.equal(r.sparrad, true);
      assert.equal(M.harKonkretaKallor(r.inst), false);
      assert.equal(M.lektionsBesked(SV), SVENSKA);
      assert.equal(M.lektionsBesked({ ...SV, klockslag: "09:40" }, true),
        "Kompisen har Svenska-lektion just nu och kan inte få några frågor till Matchdagen. Prova igen efter klockan 9.40.");
    });
    it("unionen av flera lektioners ämnen", () => {
      const r = M.lektionsKallor(inst({ omraden: ["no/kroppen", "so/vikingar", "sv/ord"] }), { amnen: ["no", "so"], tabeller: false });
      assert.deepEqual(r.inst.omraden, ["no/kroppen", "so/vikingar"]);
    });
    it("iLektionen: null (hela biblioteket) förblir null, [] förblir [], annars ämnets nycklar", () => {
      assert.equal(M.iLektionen(null, ["no"]), null);
      assert.deepEqual(M.iLektionen([], ["no"]), []);
      assert.deepEqual(M.iLektionen(["so/a", "no/b", "no/c"], ["no"]), ["no/b", "no/c"]);
    });
    it("klassOrdning = getClasses-ordningen (order, sedan namnet)", () => {
      const k = M.klassOrdning([{ id: "b", name: "Ö", order: 1 }, { id: "c", name: "B" }, { id: "a", name: "A" }]);
      assert.deepEqual(k.map((x) => x.id), ["a", "c", "b"]);
    });

    describe(`grindens lage.matchdagen (${namn === "klienten" ? "src" : "functions"}/…/klass-schema.js)`, () => {
      const lage = (k, opts = { subjects: SUBJECTS }, now = MAN_0930) => S.schemaForStudent([k], "e1", now, opts);

      it("synliga områden med underlag i ämnet → öppen", () => {
        const k = klass([L("no")], { assignedAreas: [a("no/kroppen")] });
        assert.equal(lage(k, { subjects: SUBJECTS, underlagAmnen: ["no"] }).matchdagen, true);
      });
      it("ämnet har bara områden utan underlag (och ingen tabellkoppling) → spärrad", () => {
        const k = klass([L("sv")], { assignedAreas: [a("sv/lasning")] });
        const l = lage(k, { subjects: SUBJECTS, underlagAmnen: [] });
        assert.equal(l.matchdagen, false);
        const g = S.gateForSchema(l);
        assert.equal(g.allows("/elev/matchdagen"), false, "direktlänken spärras");
        assert.equal(g.klockslag, "10:00");
      });
      it("tabellerna kopplade till lektionens ämne → öppen även utan områden med underlag", () => {
        const k = klass([L("ma")], { assignedAreas: [a("ma/geometri")] });
        const l = lage(k, { subjects: SUBJECTS, underlagAmnen: [] });
        assert.deepEqual([l.tabeller, l.matchdagen], [true, true]);
      });
      it("utan underlagAmnen räcker synliga områden i ämnet (aldrig ett stängt läge medan info laddas)", () => {
        assert.equal(lage(klass([L("no")], { assignedAreas: [a("no/kroppen")] })).matchdagen, true);
      });
      it("ämnet med bara en kopplad modul (Läsresan), inga områden, ingen tabellkoppling → spärrad", () => {
        const k = klass([L("sv")], { assignedAreas: [a("no/kroppen")] });
        assert.equal(lage(k).matchdagen, false);
      });
      it("eleven har inte Matchdagen → fältet saknas (modulgrinden gäller som vanligt)", () => {
        const k = klass([L("no")], { assignedAreas: [a("no/kroppen")], elevModuler: {} });
        assert.equal("matchdagen" in lage(k), false);
      });
      it("ingen lektion just nu → inget schemaläge (Matchdagen som vanligt)", () => {
        assert.equal(lage(klass([L("sv")]), { subjects: SUBJECTS }, MAN_1030), null);
      });
      it("sommartid: samma lektion 09:00–10:00 svensk tid", () => {
        const k = klass([L("sv")], { assignedAreas: [a("sv/lasning")] });
        assert.equal(lage(k, { subjects: SUBJECTS, underlagAmnen: [] }, SOMMAR_0930).matchdagen, false);
      });
      it("schemaInfoBehov säger när ämnenas områden behövs för Matchdagen", () => {
        const k = klass([L("no")], { assignedAreas: [a("no/kroppen")] });
        assert.equal(S.schemaInfoBehov([k], "e1", MAN_0930).matchdagen, true);
        assert.equal(S.schemaInfoBehov([{ ...k, elevModuler: {} }], "e1", MAN_0930).matchdagen, false);
      });
    });
  });
}

describe("losKallor under en lektion (md-synlig.js) – bara lektionens ämnen läses", () => {
  const OMR = {
    "no/kroppen": { id: "kroppen", name: "Kroppen", quiz: [{ question: "?", options: ["a", "b"], answerIndex: 0 }] },
    "no/lasning": { id: "lasning", name: "Läsning", texts: [{ title: "t", body: "b" }] },
    "so/vikingar": { id: "vikingar", name: "Vikingar", quiz: [{ question: "?", options: ["a", "b"], answerIndex: 0 }] },
    "ma/addera": { id: "addera", name: "Addera", generator: { topic: "addition", variants: ["enkel"], grade: "ak4" } },
  };
  const hamtaMed = (lasta) => ({
    getSubjects: async () => { lasta.push("subjects"); return SUBJECTS; },
    getAreas: async (s) => { lasta.push(`areas/${s}`); return Object.entries(OMR).filter(([k]) => k.startsWith(`${s}/`)).map(([, v]) => v); },
    getArea: async (s, ar) => { lasta.push(`area/${s}/${ar}`); return OMR[`${s}/${ar}`] || null; },
  });
  const NO = { amnen: ["no"], tabeller: false, label: "NO", klockslag: "10:00" };
  const klasser = (assigned) => [{ id: "4a", studentIds: ["e1"], assignedAreas: assigned.map(a) }];

  it("Samma som Plugga (standard) → bara lektionens synliga områden läses", async () => {
    const lasta = [];
    const r = await losKallor({ inst: normalizeInst(STANDARD_FRAGOR), kalla: "standard", klasser: klasser(["so/vikingar", "no/kroppen", "no/lasning"]), uid: "e1", hamta: hamtaMed(lasta), lektion: NO });
    assert.deepEqual([r.inst.omraden, r.inst.tabeller, r.sparrad], [["no/kroppen"], [], false]);
    assert.deepEqual(lasta.sort(), ["area/no/kroppen", "area/no/lasning"]);
  });
  it("Välj själv utan NO → reserven Samma som Plugga inom NO", async () => {
    const lasta = [];
    const r = await losKallor({ inst: normalizeInst({ omraden: ["so/vikingar"], tabeller: [7] }), kalla: "egen", klasser: klasser(["so/vikingar", "no/kroppen"]), uid: "e1", hamta: hamtaMed(lasta), lektion: NO });
    assert.deepEqual([r.inst.omraden, r.inst.tabeller, r.sparrad], [["no/kroppen"], [], false]);
    assert.deepEqual(lasta, ["area/no/kroppen"]);
  });
  it("hela biblioteket: bara lektionsämnets områdeslista läses", async () => {
    const lasta = [];
    const r = await losKallor({ inst: normalizeInst(STANDARD_FRAGOR), kalla: "standard", klasser: klasser([]), uid: "e1", hamta: hamtaMed(lasta), lektion: NO });
    assert.deepEqual(r.inst.omraden, ["no/kroppen"]);
    assert.deepEqual(lasta, ["subjects", "areas/no"]);
  });
  it("valda NO-källor räcker → ingen reserv läses", async () => {
    const lasta = [];
    const r = await losKallor({ inst: normalizeInst({ omraden: ["no/kroppen", "so/vikingar"] }), kalla: "egen", klasser: klasser(["so/vikingar", "no/kroppen"]), uid: "e1", hamta: hamtaMed(lasta), lektion: NO });
    assert.deepEqual(r.inst.omraden, ["no/kroppen"]);
    assert.deepEqual(lasta, []);
  });
  it("inget i ämnet att göra frågor av → sparrad", async () => {
    const r = await losKallor({ inst: normalizeInst({ tabeller: [7] }), kalla: "egen", klasser: klasser(["so/vikingar", "no/lasning"]), uid: "e1", hamta: hamtaMed([]), lektion: NO });
    assert.equal(r.sparrad, true);
  });
  it("utan lektion: som #899 (A.1) – inget ämnesfilter", async () => {
    const r = await losKallor({ inst: normalizeInst({ omraden: ["so/vikingar"], tabeller: [7] }), kalla: "egen", klasser: klasser(["so/vikingar"]), uid: "e1", hamta: hamtaMed([]) });
    assert.deepEqual([r.inst.omraden, r.inst.tabeller, r.sparrad], [["so/vikingar"], [7], false]);
  });
});
