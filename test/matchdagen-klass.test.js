// ============================================================================
// Tester: Matchdagen för hela klassen (#876) – enabledModules, klassens inställningar
// (classes/{id}.matchdagenInst), effektivInst (egna > klassens > tabellerna 0–10),
// "Välj alla" (nyaElevModuler med flera elever) och serverns spegel (functions/).
// Ren node, ingen emulator: node --test test/matchdagen-klass.test.js
// Reglerna: test/firestore-rules-matchdagen-inst.test.js (emulatorn).
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { modulesHiddenForStudent } from "../src/gamemode-visibility.js";
import {
  STANDARD_FRAGOR, STANDARD_INST, effektivInst, elevPa, harMatchdagen, klassInst, klassPa, normalizeInst,
  nyaElevModuler, nyaEnabledModules, sammaInst,
} from "../src/matchdagen/md-inst.js";
import { effektivInst as serverInst, normInst } from "../functions/md-vanskap-fragor.js";
import { harMatchdagen as serverHar } from "../functions/md-vanskap-state.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const MD = "matchdagen";
const ALLA = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe("Matchdagen för hela klassen (enabledModules)", () => {
  const k3a = () => ({ id: "3a", studentIds: ["alva", "bo"], enabledModules: ["schack", MD] });
  it("alla elever i klassen ser den, andra klasser inte", () => {
    const klasser = [k3a(), { id: "3b", studentIds: ["cia"] }];
    assert.equal(modulesHiddenForStudent(klasser, "alva").includes(MD), false);
    assert.equal(modulesHiddenForStudent(klasser, "bo").includes(MD), false);
    assert.equal(modulesHiddenForStudent(klasser, "cia").includes(MD), true);
  });
  it("harMatchdagen: klassen ELLER eleven; klassPa/elevPa skiljer på dem", () => {
    const k = k3a();
    assert.equal(klassPa(k), true);
    assert.equal(harMatchdagen(k, "alva"), true);
    assert.equal(elevPa(k, "alva"), false);
    assert.equal(harMatchdagen(k, "okand"), false, "bara klassens elever");
    const per = { id: "x", studentIds: ["a", "b"], elevModuler: { a: [MD] } };
    assert.equal(klassPa(per), false);
    assert.equal(harMatchdagen(per, "a"), true);
    assert.equal(harMatchdagen(per, "b"), false);
  });
  it("nyaEnabledModules: på/av rör inte klassens andra moduler", () => {
    assert.deepEqual(nyaEnabledModules({ enabledModules: ["schack"] }, true), ["schack", MD]);
    assert.deepEqual(nyaEnabledModules(k3a(), false), ["schack"]);
    assert.deepEqual(nyaEnabledModules({}, true), [MD]);
    assert.deepEqual(nyaEnabledModules(k3a(), true), ["schack", MD], "inga dubbletter");
  });
  it("Välj alla: nyaElevModuler med en lista elever", () => {
    const cls = { studentIds: ["a", "b", "c"], elevModuler: { a: [MD], gammal: [MD] } };
    assert.deepEqual(nyaElevModuler(cls, ["a", "b", "c"], true), { a: [MD], b: [MD], c: [MD] });
    assert.deepEqual(nyaElevModuler(cls, ["a", "b"], false), {});
    assert.deepEqual(nyaElevModuler(cls, "b", true), { a: [MD], b: [MD] }, "en elev som förut");
  });
});

describe("inställningarna eleven spelar med (effektivInst)", () => {
  const klassens = { omraden: ["so/vikingar"], tabeller: [3], rakna: [], svarssatt: "skriv", klocka: 30, lugnt: true, paus: 45, foljPlugga: false, lastext: true };
  const egna = { omraden: [], tabeller: [7], rakna: [], svarssatt: "flerval", klocka: 0, lugnt: false, paus: 60, foljPlugga: false, lastext: false };
  const k = (over = {}) => ({ id: "3a", studentIds: ["alva"], enabledModules: [MD], matchdagenInst: klassens, ...over });
  it("egna går före klassens", () => {
    assert.deepEqual(effektivInst(egna, [k()], "alva"), { inst: egna, kalla: "egen" });
  });
  it("utan egna: klassens", () => {
    assert.deepEqual(effektivInst(null, [k()], "alva"), { inst: klassens, kalla: "klass" });
  });
  it("utan egna och utan klassens: Samma som Plugga (#899; tabellerna 0–10 avgörs av synligheten)", () => {
    const r = effektivInst(null, [k({ matchdagenInst: undefined })], "alva");
    assert.equal(r.kalla, "standard");
    assert.deepEqual(r.inst, { ...STANDARD_INST, foljPlugga: true });
    assert.equal(STANDARD_FRAGOR.foljPlugga, true);
    assert.equal(effektivInst(null, [], "alva").inst.foljPlugga, true, "ingen klass alls");
  });
  it("en klass eleven inte går i räknas inte", () => {
    assert.equal(effektivInst(null, [k({ studentIds: ["bo"] })], "alva").kalla, "standard");
  });
  it("två klasser: den där eleven har Matchdagen går först", () => {
    const utan = { id: "sp", studentIds: ["alva"], matchdagenInst: { tabeller: [9] } };
    const med = k();
    assert.deepEqual(effektivInst(null, [utan, med], "alva").inst, klassens);
    assert.deepEqual(effektivInst(null, [utan], "alva").inst.tabeller, [9], "annars första med inställningar");
  });
  it("klassInst: trasigt värde = inga, och normaliseras", () => {
    for (const x of [null, "x", [], 7]) assert.equal(klassInst({ matchdagenInst: x }), null);
    assert.deepEqual(klassInst({ matchdagenInst: { tabeller: [3, 3, 99], updatedBy: "t" } }), normalizeInst({ tabeller: [3] }));
  });
  it("sammaInst: ordningen i listorna spelar ingen roll", () => {
    assert.equal(sammaInst({ omraden: ["a/b", "c/d"] }, { omraden: ["c/d", "a/b"] }), true);
    assert.equal(sammaInst({ tabeller: [1] }, { tabeller: [2] }), false);
    assert.equal(sammaInst(null, STANDARD_INST), true);
  });
});

describe("servern speglar klienten (functions/)", () => {
  it("effektivInst: egna > klassens > Samma som Plugga", () => {
    const egna = { tabeller: [7] };
    const klass = { matchdagenInst: { omraden: ["so/v"], tabeller: [], rakna: [], klocka: 30 } };
    assert.deepEqual(serverInst(egna, klass), normInst(egna));
    assert.deepEqual(serverInst(null, klass), normInst(klass.matchdagenInst));
    assert.equal(serverInst(null, {}).foljPlugga, true);
    assert.equal(serverInst(null, null).foljPlugga, true);
  });
  it("harMatchdagen: enabledModules eller elevModuler", () => {
    assert.equal(serverHar({ enabledModules: [MD] }, "a"), true);
    assert.equal(serverHar({ elevModuler: { a: [MD] } }, "a"), true);
    assert.equal(serverHar({ enabledModules: ["schack"], elevModuler: { b: [MD] } }, "a"), false);
  });
});

describe("källkod: lärarens vy", () => {
  it("Anpassningar per elev har Hela klassen och Välj alla", () => {
    const s = read("src/matchdagen/larare/md-anpassningar.js");
    for (const t of ["Välj alla", "Avmarkera alla", "Slå på för valda", "Slå av för valda", "Hela klassen", "sparaElevModuler"]) {
      assert.ok(s.includes(t), t);
    }
  });
  it("panelen: klassläge och Följ klassens inställningar", () => {
    const p = read("src/matchdagen/larare/md-anpassningar-panel.js");
    for (const t of ["sparaKlass", "foljKlassen", "Följ klassens inställningar", "för hela"]) assert.ok(p.includes(t), t);
  });
  it("eleven får effektivInst på sin sida", () => {
    assert.match(read("src/matchdagen/page-matchdagen.js"), /effektivInst\(egenInst, klasser, uid\)/);
  });
});
