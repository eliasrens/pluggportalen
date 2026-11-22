// ============================================================================
// Tester: Matchdagen följer det som är synligt (#899, Veckoschema Del A, spec F.1 "Matchdagen (Node)")
//   A.1  snittet med elevens synliga områden (omraden OCH rakna), tabellerna orörda,
//        klassen ur Plugga-listans regel (första klassen i getClasses-ordningen med eleven)
//   A.2  foljPlugga med tak, standarden för elever utan inställningar, gamla inställningar = false
//   A.3  panelens texter, elevens vänligare besked
// Samma tester körs mot den DELADE kopian servern använder (functions/matchdagen/md-synlighet.js).
// Ren node: node --test test/matchdagen-synlighet-899.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as KLIENT from "../src/matchdagen/delat/md-synlighet.js";
import * as SERVER from "../functions/matchdagen/md-synlighet.js";
import { INGA_FRAGOR, STANDARD_FRAGOR, harKallor, normalizeInst, sammaInst, sammanfattning, fragorText } from "../src/matchdagen/md-inst.js";
import { losKallor, raderUrBibliotek } from "../src/matchdagen/md-synlig.js";
import { areaContentFlags } from "../src/gamemode-visibility.js";
import * as B from "../functions/md-vanskap-fragor.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const ALLA = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const tilldelat = (...k) => k.map((x) => ({ subjectId: x.split("/")[0], areaId: x.split("/")[1] }));
const klass = (o = {}) => ({ id: "4a", name: "4A", studentIds: ["alva"], ...o });

for (const [namn, M] of [["klienten (src/matchdagen/delat/)", KLIENT], ["servern (functions/matchdagen/)", SERVER]]) {
  describe(`md-synlighet – ${namn}`, () => {
    it("synliga områden: klassens assignedAreas i klassens ordning, tom/saknad lista = hela biblioteket", () => {
      assert.deepEqual(M.synligaOmraden([klass({ assignedAreas: tilldelat("so/b", "so/a", "so/b") })], "alva"), ["so/b", "so/a"]);
      assert.equal(M.synligaOmraden([klass({ assignedAreas: [] })], "alva"), null);
      assert.equal(M.synligaOmraden([klass()], "alva"), null);
      assert.equal(M.synligaOmraden([], "alva"), null, "ingen klass");
      assert.equal(M.synligaOmraden([klass({ studentIds: ["bo"], assignedAreas: tilldelat("so/a") })], "alva"), null, "inte elevens klass");
    });
    it("flera klasser: samma regel som Plugga-listan – den första i getClasses-ordningen (order, namn)", () => {
      const a = klass({ id: "a", name: "Svenska", order: 2, assignedAreas: tilldelat("sv/x") });
      const b = klass({ id: "b", name: "Matte", order: 1, assignedAreas: tilldelat("ma/y") });
      const c = klass({ id: "c", name: "Ämne", order: 1, assignedAreas: [] });
      assert.deepEqual(M.synligaOmraden([a, b], "alva"), ["ma/y"], "lägst order");
      assert.deepEqual(M.synligaOmraden([a, c, b], "alva"), ["ma/y"], "samma order → namnet (Matte före Ämne)");
      assert.equal(M.elevensKlass([a, c], "alva").id, "c");
      assert.equal(M.synligaOmraden([a, c], "alva"), null, "den första klassen har ingen lista → allt");
    });
    it("A.1: valda ∩ synliga – både omraden och rakna, tabellerna orörda", () => {
      const inst = normalizeInst({ omraden: ["so/a", "so/dold"], rakna: ["ma/r", "ma/dold"], tabeller: [3, 7] });
      const ut = M.effektivaKallor(inst, { synliga: ["so/a", "ma/r"] });
      assert.deepEqual([ut.omraden, ut.rakna, ut.tabeller], [["so/a"], ["ma/r"], [3, 7]]);
      assert.deepEqual(M.effektivaKallor(inst, { synliga: null }).omraden, ["so/a", "so/dold"], "hela biblioteket: inget filter");
      const bara = M.effektivaKallor(normalizeInst({ omraden: ["so/dold"] }), { synliga: ["so/a"] });
      assert.equal(harKallor(bara), false, "inget kvar → inga frågor (INGA_FRAGOR)");
      assert.deepEqual(M.effektivaKallor(normalizeInst({ omraden: ["so/dold"], tabeller: [5] }), { synliga: ["so/a"] }).tabeller, [5]);
    });
    it("A.2: Samma som Plugga – de synliga med underlag, valda områden ignoreras, tabellerna kan kombineras", () => {
      const rader = [
        { nyckel: "so/a", plugga: true, rakna: false }, { nyckel: "ma/r", plugga: false, rakna: true },
        { nyckel: "so/tom", plugga: false, rakna: false }, { nyckel: "ma/bada", plugga: true, rakna: true },
      ];
      const p = M.pluggaKallor(rader);
      assert.deepEqual(p, { omraden: ["so/a", "ma/bada"], rakna: ["ma/r", "ma/bada"], fler: false });
      const ut = M.effektivaKallor(normalizeInst({ foljPlugga: true, omraden: ["x/gammal"], tabeller: [7] }), { synliga: null, plugga: p });
      assert.deepEqual([ut.omraden, ut.rakna, ut.tabeller, ut.foljPlugga], [["so/a", "ma/bada"], ["ma/r", "ma/bada"], [7], false]);
    });
    it("A.2: taket MAX_OMRADEN – de första i klassens ordning, och fler sägs", () => {
      assert.equal(M.MAX_OMRADEN, 60);
      const rader = Array.from({ length: 75 }, (_, n) => ({ nyckel: `s/a${n}`, plugga: true, rakna: n % 2 === 0 }));
      const p = M.pluggaKallor(rader);
      assert.equal(p.omraden.length, 60);
      assert.equal(p.omraden.at(-1), "s/a59");
      assert.equal(p.rakna.length, 30);
      assert.equal(p.fler, true);
      assert.equal(M.pluggaKallor(rader.slice(0, 60)).fler, false);
    });
    it("A.2: standarden – Samma som Plugga, utan synliga områden med underlag tabellerna 0–10", () => {
      const std = normalizeInst(STANDARD_FRAGOR);
      const med = M.effektivaKallor(std, { synliga: ["so/a"], plugga: M.pluggaKallor([{ nyckel: "so/a", plugga: true, rakna: false }]), standard: true });
      assert.deepEqual([med.omraden, med.tabeller], [["so/a"], []]);
      const utan = M.effektivaKallor(std, { synliga: ["so/a"], plugga: M.pluggaKallor([{ nyckel: "so/a", plugga: false, rakna: false }]), standard: true });
      assert.deepEqual([utan.omraden, utan.rakna, utan.tabeller], [[], [], ALLA]);
      const sparad = M.effektivaKallor(normalizeInst({ foljPlugga: true }), { synliga: ["so/a"], plugga: M.pluggaKallor([]), standard: false });
      assert.equal(harKallor(sparad), false, "läraren valde själv Samma som Plugga – ingen reserv, utan besked");
    });
  });
}

describe("matchdagenInst.foljPlugga (md-inst.js och servern)", () => {
  it("gamla sparade inställningar läses som foljPlugga: false; bara true räknas", () => {
    assert.equal(normalizeInst({ omraden: ["so/a"] }).foljPlugga, false);
    assert.equal(normalizeInst({ foljPlugga: "ja" }).foljPlugga, false);
    assert.equal(normalizeInst({ foljPlugga: true }).foljPlugga, true);
    for (const raw of [null, {}, { foljPlugga: true }, { foljPlugga: 1 }, { omraden: ["so/a"] }]) {
      assert.equal(B.normInst(raw).foljPlugga, normalizeInst(raw).foljPlugga, JSON.stringify(raw));
    }
  });
  it("standarden är Samma som Plugga – på klienten och servern", () => {
    assert.equal(STANDARD_FRAGOR.foljPlugga, true);
    assert.deepEqual(STANDARD_FRAGOR.tabeller, []);
    assert.equal(B.effektivInst(null, null).foljPlugga, true);
    assert.equal(B.arStandard(null, {}), true);
    assert.equal(B.arStandard(null, { matchdagenInst: { tabeller: [3] } }), false);
    assert.equal(B.arStandard({ tabeller: [3] }, null), false);
  });
  it("sammaInst, harKallor, sammanfattning och elevens rad", () => {
    assert.equal(sammaInst({ foljPlugga: true }, { foljPlugga: false }), false);
    assert.equal(sammaInst({ omraden: ["a/b"] }, { omraden: ["a/b"], foljPlugga: false }), true);
    assert.equal(harKallor({ foljPlugga: true }), true);
    assert.equal(sammanfattning({ foljPlugga: true, omraden: ["a/b"], rakna: ["c/d"], tabeller: [7] }), "Samma som Plugga · tabell 7");
    assert.equal(fragorText({ foljPlugga: true }), "Dina frågor kommer från områdena du ser i Plugga.");
  });
  it("A.3: elevens besked utan frågor", () => {
    assert.equal(INGA_FRAGOR, "Din lärare behöver välja frågor till Matchdagen");
    assert.equal(fragorText({}), "Din lärare behöver välja frågor till Matchdagen.");
  });
  it("serverns underlag = areaContentFlags (quiz, par, generator)", () => {
    const areas = [{}, { quiz: [{}] }, { pairs: [{}] }, { generator: { topic: "addition", variants: ["enkel"], grade: "ak4" } },
      { generator: { topic: "finnsinte" } }, { quiz: [], pairs: [] }];
    for (const a of areas) {
      const f = areaContentFlags(a);
      assert.deepEqual(B.flaggor(a), { quiz: f.quiz, pairs: f.pairs, generator: f.generator }, JSON.stringify(a));
    }
  });
});

// Ett litet bibliotek: so (order 1) med a, tom, r; ma (order 2) med x.
const BIB = [
  { id: "so", areas: [{ id: "a", quiz: [{ question: "Q", options: ["1", "2"], answerIndex: 0 }] }, { id: "tom" }, { id: "r", generator: { topic: "addition", variants: ["enkel"], grade: "ak4" } }] },
  { id: "ma", areas: [{ id: "x", pairs: [{ term: "a", definition: "b" }, { term: "c", definition: "d" }] }] },
];
function hamta() {
  const lasningar = [];
  return {
    lasningar,
    getSubjects: async () => { lasningar.push("subjects"); return BIB.map(({ id }) => ({ id })); },
    getAreas: async (s) => { lasningar.push(`areas/${s}`); return BIB.find((x) => x.id === s)?.areas || []; },
    getArea: async (s, a) => { lasningar.push(`area/${s}/${a}`); return BIB.find((x) => x.id === s)?.areas.find((y) => y.id === a) || null; },
  };
}

describe("klienten: losKallor (md-synlig.js)", () => {
  it("Samma som Plugga med en tilldelad: bara det området, och det lästa följer med", async () => {
    const h = hamta();
    const r = await losKallor({ inst: normalizeInst({ foljPlugga: true }), kalla: "klass", klasser: [klass({ assignedAreas: tilldelat("ma/x") })], uid: "alva", hamta: h });
    assert.deepEqual([r.inst.omraden, r.inst.rakna, r.inst.tabeller], [["ma/x"], [], []]);
    assert.deepEqual(h.lasningar, ["area/ma/x"]);
    assert.ok(r.omraden.get("ma/x")?.pairs);
  });
  it("Samma som Plugga utan tilldelning: hela biblioteket i ämnenas och områdenas ordning", async () => {
    const h = hamta();
    const r = await losKallor({ inst: normalizeInst({ foljPlugga: true }), kalla: "egen", klasser: [klass()], uid: "alva", hamta: h });
    assert.deepEqual([r.inst.omraden, r.inst.rakna], [["so/a", "ma/x"], ["so/r"]]);
    assert.deepEqual(h.lasningar, ["subjects", "areas/so", "areas/ma"]);
  });
  it("standard utan synliga områden med underlag → tabellerna 0–10", async () => {
    const r = await losKallor({ inst: normalizeInst(STANDARD_FRAGOR), kalla: "standard", klasser: [klass({ assignedAreas: tilldelat("so/tom") })], uid: "alva", hamta: hamta() });
    assert.deepEqual([r.inst.omraden, r.inst.tabeller], [[], ALLA]);
  });
  it("Välj själv: ett dolt område ger inga frågor, och inget läses i förväg", async () => {
    const h = hamta();
    const r = await losKallor({ inst: normalizeInst({ omraden: ["so/a", "ma/x"], tabeller: [2] }), kalla: "egen", klasser: [klass({ assignedAreas: tilldelat("ma/x") })], uid: "alva", hamta: h });
    assert.deepEqual([r.inst.omraden, r.inst.tabeller], [["ma/x"], [2]]);
    assert.deepEqual(h.lasningar, []);
  });
  it("taket: högst MAX_OMRADEN områden läses", async () => {
    const h = hamta();
    const nycklar = Array.from({ length: 70 }, (_, n) => `so/x${n}`);
    const r = await losKallor({ inst: normalizeInst({ foljPlugga: true }), kalla: "egen", klasser: [klass({ assignedAreas: tilldelat(...nycklar) })], uid: "alva", hamta: h });
    assert.equal(h.lasningar.length, 60);
    assert.equal(r.fler, true);
  });
  it("panelens rader ur biblioteket = elevens", () => {
    assert.deepEqual(raderUrBibliotek(BIB, null).map((x) => x.nyckel), ["so/a", "so/tom", "so/r", "ma/x"]);
    assert.deepEqual(raderUrBibliotek(BIB, ["ma/x", "so/borta"]), [{ nyckel: "ma/x", plugga: true, rakna: false }, { nyckel: "so/borta", plugga: false, rakna: false }]);
  });
});

describe("källkod (#899)", () => {
  it("panelen: Samma som Plugga, Välj områden själv, dolt område och Byt till Samma som Plugga", () => {
    const p = read("src/matchdagen/larare/md-anpassningar-panel.js");
    for (const t of ["Samma som Plugga – frågor från de områden eleven ser just nu", "(rekommenderat)", "Välj områden själv",
      "Dolt för klassen – används inte just nu", "Byt till Samma som Plugga", "foljPlugga"]) assert.ok(p.includes(t), t);
  });
  it("sidan och servern använder den delade funktionen", () => {
    assert.match(read("src/matchdagen/page-matchdagen.js"), /import\("\.\/md-synlig\.js"\)/);
    assert.match(read("src/matchdagen/md-synlig.js"), /from "\.\/delat\/md-synlighet\.js"/);
    assert.match(read("functions/md-vanskap-lobby.js"), /from "\.\/matchdagen\/md-synlighet\.js"/);
  });
  it("reglerna: foljPlugga är en valfri bool i validMatchdagenInst", () => {
    assert.match(read("firestore.rules"), /\(!\('foljPlugga' in d\) \|\| d\.foljPlugga is bool\)/);
  });
});
