// ============================================================================
// Prov 2F (#759), testarens kantfall: avrundningsregeln från Etapp 1 med de nya
// gränserna (visningen avrundar, färgen räknas på den exakta andelen),
// gränsfallen 1/2 och 99/100, "rätta själv" när alla luckor har stavfel,
// och att stavfelsvalet inte påverkar frågor där exakt stavning krävs.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { delaUppProv } from "../src/prov/prov-modell.js";
import { tillfalleInstallningar, validateProv } from "../src/prov/prov-validera.js";
import { nyRattning } from "../src/prov/prov-rattning-logik.js";
import { fargFor, granserFor, procent } from "../src/prov/prov-statistik.js";

const FRAGOR = [
  { id: "k1", typ: "kortsvar", fraga: "Huvudstaden?", godkanda: ["Stockholm"], exaktStavning: false, poang: 2 },
  { id: "k2", typ: "kortsvar", fraga: "Handelsstaden?", godkanda: ["Birka"], poang: 2 }, // exakt stavning (standard)
  { id: "l1", typ: "lucktext", fraga: "Fyll i.", lucktext: "Norges är [[Oslo]] och Danmarks [[Köpenhamn]].", exaktStavning: false, poang: 2 },
];
const rattning = (stavfel, svar) => {
  const p = validateProv({ namn: "Kanter", installningar: { stavfel }, fragor: structuredClone(FRAGOR) }).value;
  const { fragor, facit } = delaUppProv(p);
  return nyRattning({ elevId: "e", classId: "4a", provNamn: p.namn, fragor, svar, facit, stavfel: tillfalleInstallningar(p.installningar).stavfel });
};

describe("färggränserna – avrundningsregeln från Etapp 1 står kvar med 60/85", () => {
  const std = granserFor();
  it("84,6 % visas som 85 % men är gul; 59,6 % visas som 60 % men är röd", () => {
    assert.equal(procent(0.846), "85 %");
    assert.equal(fargFor(0.846, std), "gul");
    assert.equal(procent(0.596), "60 %");
    assert.equal(fargFor(0.596, std), "rod");
  });
  it("exakt på gränsen räknas uppåt, även med flyttalsbrus (17/20, 3/5)", () => {
    assert.equal(fargFor(17 / 20, std), "gron");
    assert.equal(fargFor(0.1 * 8.5, std), "gron");
    assert.equal(fargFor(3 / 5, std), "gul");
    assert.equal(fargFor(0.1 * 6, std), "gul");
  });
  it("gränsfallen 1/2 och 99/100 är giltiga och färgar rätt", () => {
    const smal = granserFor({ granser: { gul: 1, gron: 2 } });
    assert.deepEqual(smal, { gul: 1, gron: 2 });
    assert.deepEqual([0, 0.01, 0.02].map((a) => fargFor(a, smal)), ["rod", "gul", "gron"]);
    const hog = granserFor({ granser: { gul: 99, gron: 100 } });
    assert.deepEqual(hog, { gul: 99, gron: 100 });
    assert.deepEqual([0.989, 0.99, 0.999, 1].map((a) => fargFor(a, hog)), ["rod", "gul", "gul", "gron"]);
  });
  it("gränser som text eller decimaltal på tillfället hoppas över (provets/standarden gäller)", () => {
    assert.deepEqual(granserFor({ granser: { gul: 50.5, gron: 80 } }), { gul: 60, gron: 85 });
    assert.deepEqual(granserFor({ granser: { gul: null, gron: 80 } }), { gul: 60, gron: 85 });
    assert.deepEqual(granserFor({ granser: { gul: 50.5, gron: 80 } }, { granser: { gul: 50, gron: 75 } }), { gul: 50, gron: 75 });
  });
});

describe("rätta stavfel själv – kantfall", () => {
  it("stavfel i alla luckor: inget förslag; alla rätt: förslag rätt", () => {
    assert.ok(!("l1" in rattning("sjalv", { l1: ["Olso", "Köpenhamm"] }).fragor));
    assert.deepEqual(rattning("sjalv", { l1: ["Oslo", "Köpenhamn"] }).fragor.l1, { poang: 2, ratt: true, auto: true });
    assert.deepEqual(rattning("auto", { l1: ["Olso", "Köpenhamm"] }).fragor.l1.ratt, "delvis");
  });
  it("en tom lucka och ingen stavfel: förslag som förut (inte till läraren)", () => {
    assert.deepEqual(rattning("sjalv", { l1: ["Oslo", ""] }).fragor.l1, { poang: 1, ratt: "delvis", auto: true });
  });
  it("exakt stavning krävs: stavfelet är fel oavsett val", () => {
    for (const v of ["auto", "sjalv"]) assert.deepEqual(rattning(v, { k2: "Brika" }).fragor.k2, { poang: 0, ratt: false, auto: true });
  });
  it("okänt eller saknat val på tillfället = auto", () => {
    assert.equal(tillfalleInstallningar({}).stavfel, "auto");
    assert.equal(tillfalleInstallningar({ stavfel: "halva" }).stavfel, "auto");
    assert.equal(tillfalleInstallningar({ stavfel: "sjalv" }).stavfel, "sjalv");
  });
});
