// ============================================================================
// Prov (#747, spec §12 + testlistan "Statistiken"): den fördjupade statistiken –
// staplarna per fråga (svårast först), fördelningen av totalen och nivåerna,
// jämförelsen mellan klasser, CSV-exporten (semikolon, citering, åäö, formler)
// och att inget av det läser databasen utom jämförelsen (på knapptryck).
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { delaUppProv } from "../src/prov/prov-modell.js";
import { validateProv } from "../src/prov/prov-validera.js";
import { bedom, godkann, godkannAlla, nyRattning } from "../src/prov/prov-rattning-logik.js";
import { klassOversikt } from "../src/prov/prov-statistik.js";
import {
  csvFalt, csvFilnamn, jamforKlasser, kortText, nivaFordelning, perFragaStaplar, poangFordelning, resultatCsv,
} from "../src/prov/prov-statistik-fordjupad.js";

const PROV = validateProv({
  namn: "Vikingarna", installningar: { poang: true, nivaer: true },
  fragor: [
    { id: "t1", typ: "text", titel: "Läs", brodtext: "Text" },
    { id: "q1", typ: "flerval", fraga: "Var låg Birka?", alternativ: ["Björkö", "Gotland"], ratt: 0 },
    { id: "q2", typ: "santfalskt", fraga: "Vikingar hade horn.", ratt: false },
    { id: "q3", typ: "kortsvar", fraga: "Åskguden?", godkanda: ["Tor"], exaktStavning: false, poang: 2 },
  ],
}).value;
const { fragor, facit } = delaUppProv(PROV);
const SVAR = {
  a: { q1: 0, q2: false, q3: "Tor" },    // allt rätt
  b: { q1: 1, q2: true, q3: "Oden" },    // allt fel
  c: { q1: 0, q2: true },                // rätt, fel, obesvarad
  d: { q1: 0, q2: false, q3: "Tor" },    // bara förslag = ej rättad
};
const ny = (uid) => nyRattning({ elevId: uid, classId: "4a", provNamn: "Vikingarna", fragor, svar: SVAR[uid], facit });
const q3 = fragor.find((f) => f.id === "q3");
const RATT = {
  a: { ...godkannAlla(ny("a"), fragor), niva: "MG" },
  b: { ...godkannAlla(ny("b"), fragor), niva: "EG" },
  c: godkann(godkann(ny("c"), "q1"), "q2"),
  d: ny("d"),
};
const MED = ["a", "b", "c", "d"];
const NAMN = { a: "Åsa Öberg", b: "Bo", c: "Cia; \"Cissi\"", d: "=SUMMA(A1)" };
const oversikt = (rattningar = RATT, med = MED) => klassOversikt({
  fragor, med, namn: NAMN, svarAv: (uid, fid) => SVAR[uid]?.[fid], rattningar, installningar: PROV.installningar,
});

describe("staplar per fråga (§12)", () => {
  const s = perFragaStaplar(oversikt(), fragor);
  it("en stapel per fråga (inte textblocket), med antal rätt/delvis/fel/obesvarade/ej rättade", () => {
    assert.equal(s.length, 3);
    const q2 = s.find((x) => x.fid === "q2");
    assert.deepEqual(q2.n, { ratt: 1, delvis: 0, fel: 2, obesvarad: 0, ej: 1 });
    const x3 = s.find((x) => x.fid === "q3");
    assert.deepEqual(x3.n, { ratt: 1, delvis: 0, fel: 1, obesvarad: 1, ej: 1 }, "c svarade inte, d är inte rättad");
    for (const x of s) assert.equal(Object.values(x.n).reduce((a, b) => a + b, 0), 4);
  });
  it("svårast först: lägst andel överst, lika andel i nummerordning, frågetexten med", () => {
    assert.deepEqual(s.map((x) => [x.fid, Math.round(x.andel * 100)]), [["q2", 33], ["q3", 50], ["q1", 67]]);
    assert.equal(s[0].text, "Vikingar hade horn.");
    assert.equal(s[0].nr, 2);
  });
  it("frågor utan något bedömt hamnar sist", () => {
    const bara = perFragaStaplar(oversikt({ d: RATT.d }, ["d"]), fragor);
    assert.ok(bara.every((x) => x.andel == null));
    assert.deepEqual(bara.map((x) => x.nr), [1, 2, 3]);
  });
  it("delvis räknas som delvis", () => {
    const r = { ...RATT, a: bedom(RATT.a, q3, { ratt: "delvis", poang: 1 }, fragor) };
    const x3 = perFragaStaplar(oversikt(r), fragor).find((x) => x.fid === "q3");
    assert.equal(x3.n.delvis, 1);
    assert.equal(x3.n.ratt, 0);
  });
});

describe("fördelningen (§12)", () => {
  it("tio staplar à 10 %, 100 % i den sista, ej rättade för sig", () => {
    const f = poangFordelning([{ andel: 0 }, { andel: 0.09 }, { andel: 0.1 }, { andel: 0.7 }, { andel: 0.7 }, { andel: 1 }, { andel: null }], { gul: 40, gron: 70 });
    assert.deepEqual(f.staplar.map((s) => s.antal), [2, 1, 0, 0, 0, 0, 0, 2, 0, 1]);
    assert.equal(f.ej, 1);
    assert.equal(f.flest, 2);
    assert.equal(f.staplar[9].text, "90–100 %");
  });
  it("0,7 i flyttal (0.7 * 100 = 70.00000000000001) hamnar i 70-stapeln, 0,6999 i 60", () => {
    const f = poangFordelning([{ andel: 7 / 10 }, { andel: 0.6999 }], { gul: 40, gron: 70 });
    assert.equal(f.staplar[7].antal, 1);
    assert.equal(f.staplar[6].antal, 1);
  });
  it("staplarnas färg följer provets gränser", () => {
    const f = poangFordelning([], { gul: 40, gron: 70 });
    assert.deepEqual(f.staplar.map((s) => s.farg), ["rod", "rod", "rod", "rod", "gul", "gul", "gul", "gron", "gron", "gron"]);
    const g = poangFordelning([], { gul: 50, gron: 80 });
    assert.equal(g.staplar[4].farg, "rod");
    assert.equal(g.staplar[7].farg, "gul");
  });
  it("ur översikten: a 100 %, b 0 %, c 50 %, d ej rättad", () => {
    const f = poangFordelning(oversikt().rader, { gul: 40, gron: 70 });
    assert.deepEqual([f.staplar[0].antal, f.staplar[5].antal, f.staplar[9].antal, f.ej], [1, 1, 1, 1]);
  });
  it("nivåerna: EG/G/MG och ingen nivå", () => {
    assert.deepEqual(nivaFordelning(oversikt().rader).map((n) => [n.id, n.antal]), [["EG", 1], ["G", 0], ["MG", 1], ["", 2]]);
  });
});

describe("jämförelse mellan klasser (§12)", () => {
  const tfA = { id: "tA", provId: "p", classId: "4a", fragor, installningar: { ...PROV.installningar, granser: { gul: 40, gron: 70 } } };
  // 4B: samma prov, två elever, båda allt rätt – men med andra gränser (ska inte användas).
  const tfB = { id: "tB", provId: "p", classId: "4b", fragor, installningar: { ...PROV.installningar, granser: { gul: 90, gron: 95 } } };
  const rB = { x: godkannAlla(ny("a"), fragor), y: godkannAlla(ny("a"), fragor) };
  // 3A: en äldre version av provet utan q3.
  const tfC = { id: "tC", provId: "p", classId: "3a", fragor: fragor.filter((f) => f.id !== "q3"), installningar: PROV.installningar };
  const rC = { z: godkannAlla(ny("b"), tfC.fragor) };
  const j = jamforKlasser({ tf: tfA, klassNamn: "4A", rattningar: RATT, med: MED },
    [{ tf: tfB, klassNamn: "4B", rattningar: rB }, { tf: tfC, klassNamn: "3A", rattningar: rC }, { tf: tfA, klassNamn: "4A", rattningar: RATT }]);
  it("den här klassen först, de andra i namnordning; samma tillfälle räknas inte två gånger", () => {
    assert.deepEqual(j.kolumner.map((k) => k.klassNamn), ["4A", "3A", "4B"]);
  });
  it("antal, rättade, snitt och fördelning per klass – med det HÄR provets gränser", () => {
    const [a, c, b] = j.kolumner;
    assert.deepEqual([a.antal, a.rattade, Math.round(a.snitt * 100)], [4, 3, 50]);
    assert.deepEqual(a.fordelning, { gron: 1, gul: 1, rod: 1, ej: 1 });
    assert.deepEqual([b.antal, b.snitt, b.farg], [2, 1, "gron"], "4B:s egna gränser (95 %) gäller inte här");
    assert.deepEqual([c.snitt, c.farg], [0, "rod"]);
  });
  it("per fråga: en andel per klass, null där frågan saknas", () => {
    const rad = j.perFraga.find((f) => f.fid === "q3");
    assert.deepEqual(rad.andelar.map((a) => (a == null ? null : Math.round(a * 100))), [50, null, 100]);
    assert.equal(j.perFraga.length, 3);
    assert.equal(j.perFraga[0].text, "Var låg Birka?");
  });
  it("utan andra klasser: bara den här kolumnen; samma klassnamn två gånger får en siffra", () => {
    assert.equal(jamforKlasser({ tf: tfA, klassNamn: "4A", rattningar: RATT, med: MED }).kolumner.length, 1);
    const tfA2 = { ...tfA, id: "tA2" };
    const k = jamforKlasser({ tf: tfA, klassNamn: "4A", rattningar: RATT, med: MED }, [{ tf: tfA2, klassNamn: "4A", rattningar: {} }]).kolumner;
    assert.deepEqual(k.map((x) => x.klassNamn), ["4A", "4A (2)"]);
    assert.equal(k[1].snitt, null);
  });
  it("omprovet heter \"4A – omprov\", inte \"4A (2)\" (#749 F2)", () => {
    const omprov = { ...tfA, id: "tA3", elevIds: ["a"], omprovAv: tfA.id };
    const k = jamforKlasser({ tf: tfA, klassNamn: "4A", rattningar: RATT, med: MED }, [{ tf: omprov, klassNamn: "4A", rattningar: {} }]).kolumner;
    assert.deepEqual(k.map((x) => x.klassNamn), ["4A", "4A – omprov"]);
  });
});

describe("CSV-exporten (§12)", () => {
  const csv = resultatCsv({ fragor, med: MED, namn: NAMN, rattningar: RATT, installningar: PROV.installningar });
  const rader = csv.replace(/^﻿/, "").split("\r\n");
  it("BOM först (åäö i Excel), CRLF, sista raden tom", () => {
    assert.ok(csv.startsWith("﻿"));
    assert.equal(rader.at(-1), "");
    assert.equal(rader.length, 1 + 4 + 1);
  });
  it("rubriken: elev, poäng per fråga (inte textblocket), total, procent, färg, nivå, status", () => {
    assert.equal(rader[0], "Elev;Fråga 1 (1 p);Fråga 2 (1 p);Fråga 3 (2 p);Poäng;Av (rättade);Procent;Färg;Nivå;Status");
  });
  it("en rad per elev i bokstavsordning (sv), åäö orörda, orättat tomt", () => {
    // sv: Å kommer efter Z, = (formeln) först.
    assert.deepEqual(rader.slice(1, 5).map((r) => r.split(";")[0]), ["'=SUMMA(A1)", "Bo", "\"Cia", "Åsa Öberg"]);
    assert.equal(rader[4], "Åsa Öberg;1;1;2;4;4;100;Grön;MG;Rättad");
    assert.equal(rader[2], "Bo;0;0;0;0;4;0;Röd;EG;Rättad");
    assert.equal(rader[1], "'=SUMMA(A1);;;;;;;;;Ej rättad", "bara förslag = tomt");
  });
  it("semikolon och citattecken i ett namn citeras; delvis rättad elev", () => {
    // 50 % är röd med standardgränserna 60/85 (#759).
    assert.equal(rader[3], "\"Cia; \"\"Cissi\"\"\";1;0;;1;2;50;Röd;;Delvis rättad");
  });
  it("utan poäng: rätt/delvis/fel per fråga, inga poängkolumner", () => {
    const r = { ...RATT, a: bedom(RATT.a, q3, { ratt: "delvis" }, fragor) };
    const ut = resultatCsv({ fragor, med: ["a"], namn: NAMN, rattningar: r, installningar: { poang: false } }).replace(/^﻿/, "").split("\r\n");
    assert.equal(ut[0], "Elev;Fråga 1;Fråga 2;Fråga 3;Procent;Färg;Nivå;Status");
    assert.equal(ut[1], "Åsa Öberg;rätt;rätt;delvis;83;Gul;MG;Rättad", "83 % < 85 % (standard, #759)");
  });
  it("halva poäng med decimalkomma", () => {
    const r = { a: bedom(RATT.a, q3, { poang: 1.5 }, fragor) };
    const ut = resultatCsv({ fragor, med: ["a"], namn: NAMN, rattningar: r, installningar: PROV.installningar }).split("\r\n");
    assert.match(ut[1], /^Åsa Öberg;1;1;1,5;3,5;4;88;/);
  });
  it("csvFalt: citering, formelskydd, blanksteg, radbrytning", () => {
    assert.equal(csvFalt("vanlig"), "vanlig");
    assert.equal(csvFalt("a;b"), "\"a;b\"");
    assert.equal(csvFalt("säg \"hej\""), "\"säg \"\"hej\"\"\"");
    assert.equal(csvFalt("rad1\nrad2"), "\"rad1\nrad2\"");
    assert.equal(csvFalt(" luft"), "\" luft\"");
    assert.equal(csvFalt("+46 70"), "'+46 70");
    assert.equal(csvFalt("-1"), "'-1");
    assert.equal(csvFalt("@x"), "'@x");
    assert.equal(csvFalt(null), "");
    assert.equal(csvFalt(3), "3");
  });
  it("filnamnet: prov – klass, utan otillåtna tecken", () => {
    assert.equal(csvFilnamn("Vikingatiden", "4B"), "Vikingatiden – 4B.csv");
    assert.equal(csvFilnamn("Bråk: 1/2 & 3/4?", "5A"), "Bråk 1 2 & 3 4 – 5A.csv");
    assert.equal(csvFilnamn("", ""), "Prov.csv");
  });
  it("kortText: första raden, avkortad med …", () => {
    assert.equal(kortText("Hej\nrad 2"), "Hej");
    assert.equal(kortText("a".repeat(70), 10), `${"a".repeat(9)}…`);
    assert.equal(kortText(null), "");
  });
});

describe("inga extra läsningar (§12) och lat laddning (#271)", () => {
  const src = (f) => readFileSync(new URL(`../src/prov/${f}`, import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
  it("logiken, vyn och utskriften importerar inte Firebase och läser inget", () => {
    for (const f of ["prov-statistik-fordjupad.js", "prov-fordjupad-vy.js", "prov-utskrift.js", "prov-utskrift-papper.js"]) {
      const s = src(f);
      assert.doesNotMatch(s, /firebase/i, f);
      assert.doesNotMatch(s, /\bgetDocs?\(|onSnapshot\(/, f);
    }
  });
  it("jämförelsen läser först på knapptryck: prov-jamfor-data.js laddas med import() i vyn", () => {
    const vy = src("prov-fordjupad-vy.js");
    assert.match(vy, /await import\("\.\/prov-jamfor-data\.js"\)/);
    assert.doesNotMatch(vy, /^import .*prov-jamfor-data/m);
    const data = src("prov-jamfor-data.js");
    assert.equal((data.match(/\bgetDocs\(/g) || []).length, 1, "en läsning av rattning per annat tillfälle");
    assert.match(data, /listaTillfallen\(/);
    assert.match(data, /filterClasses\(/, "bara lärarens egna klasser");
  });
  it("översikten laddar den fördjupade vyn och utskriften med import()", () => {
    const vy = src("prov-stat-vy.js");
    assert.match(vy, /import\("\.\/prov-fordjupad-vy\.js"\)/);
    assert.doesNotMatch(vy, /^import .*prov-(fordjupad-vy|utskrift)/m);
    for (const f of ["larare/provl-redigera.js", "larare/provl-lista.js"]) {
      assert.match(src(f), /import\("\.\.\/prov-utskrift\.js"\)/, f);
      assert.doesNotMatch(src(f), /^import .*prov-utskrift/m, f);
    }
  });
});
