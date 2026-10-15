// ============================================================================
// Bråkresan #711 F: utmaningarna 21–33 och 35 – egna matematikkontroller
// (admin/qa-brakresan/uNN.mjs över 200 exempel + 100 omgångar) och specens
// exempel ordagrant (§8), med validatorerna: rätt godtas, rimliga fel avvisas,
// ofullständiga svar är inmatningshjälp.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadChallenge } from "../src/brakresan/utmaningar/index.js";
import { auditChallenge } from "../admin/qa-brakresan-generatorer.mjs";
import { buildTask, gradeTask } from "../src/brakresan/schema/kontrakt.js";
import { publicTask } from "../src/brakresan/schema/uppgift.js";

const F = ["21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "35"];
const falt = (n, d, whole) => ({ fields: { n: String(n), d: String(d), ...(whole !== undefined ? { whole: String(whole) } : {}) } });
const tal = (v) => ({ text: String(v) });
const g = async (id, params, svar) => {
  const ch = await loadChallenge(id);
  const t = buildTask(ch, params);
  return { t, r: gradeTask(ch, t, svar), ch };
};

for (const id of F) {
  test(`utmaning ${id}: egna kontroller över 200 exempel och 100 omgångar`, async () => {
    const r = await auditChallenge(await loadChallenge(id));
    assert.equal(r.audited, true);
    assert.deepEqual(r.problems, []);
    assert.ok(r.distinctCores >= 60, `bara ${r.distinctCores} kärnor`);
    assert.ok(r.relaxedPerSerie < 1, `för många återkommande kärnor: ${r.relaxedPerSerie}`);
  });
}

test("21: 6/8 → 3/4 i enklaste form; 6/8 är rätt värde men ofärdigt", async () => {
  const p = { p: 3, q: 4, k: 2 };
  assert.equal((await g("21", p, falt(3, 4))).r.correct, true);
  const ofardig = (await g("21", p, falt(6, 8))).r;
  assert.equal(ofardig.correct, false);
  assert.equal(ofardig.reason, "ej-enklaste");
  assert.equal((await g("21", { p: 3, q: 4, k: 4 }, falt(6, 8))).r.reason, "ej-enklaste"); // 12/16 → 6/8 ett steg kvar
  assert.equal((await g("21", p, falt(3, 0))).r.status, "invalid");
});

test("22: 2/3 = 8/? → 12 och ?/15 = 2/5 → 6", async () => {
  assert.equal((await g("22", { p: 2, q: 3, k: 4, saknas: "n", i: "stor", helaVanster: true }, tal(12))).r.correct, true);
  assert.equal((await g("22", { p: 2, q: 3, k: 4, saknas: "n", i: "stor", helaVanster: true }, tal(9))).r.correct, false); // additivt
  const { t, r } = await g("22", { p: 2, q: 5, k: 3, saknas: "t", i: "stor", helaVanster: false }, tal(6));
  assert.equal(r.correct, true);
  assert.equal(t.key.display, "6/15 = 2/5");
  assert.equal(t.view.expr[1].pilar, "÷");
});

test("23: 2/3, fyra av sex delar och åtta av tolv kulor är en trippel", async () => {
  const kort = [
    { typ: "symbol", n: 2, d: 3, ratt: true }, { typ: "stav", n: 4, d: 6, ratt: true },
    { typ: "mangd", n: 8, d: 12, ratt: true, item: "kula" }, { typ: "symbol", n: 3, d: 4, tag: "x" },
    { typ: "text", n: 1, d: 3, tag: "omarkerade" }, { typ: "cirkel", n: 4, d: 7, tag: "samma-antal-annan-helhet" },
  ];
  const { t, ch } = await g("23", { p: 2, q: 3, kort }, null);
  assert.equal(gradeTask(ch, t, { ids: ["k3", "k1", "k2"] }).correct, true);
  assert.equal(gradeTask(ch, t, { ids: ["k1", "k2", "k5"] }).correct, false);
  assert.equal(t.view.cards[2].face.component, "mangd");
  assert.equal(t.view.cards[4].face.text, "En tredjedel");
});

test("24: 3/8 < 1/2, 2/4 = 1/2, 5/6 > 1/2 – ordningen i facken fri", async () => {
  const kort = [{ n: 3, d: 8 }, { n: 2, d: 4 }, { n: 5, d: 6 }, { n: 1, d: 5 }, { n: 5, d: 10 }, { n: 7, d: 12 }];
  const { t, ch } = await g("24", { kort }, null);
  assert.deepEqual(t.key.bins, { k1: "mindre", k2: "lika", k3: "storre", k4: "mindre", k5: "lika", k6: "storre" });
  assert.equal(gradeTask(ch, t, { bins: { mindre: ["k4", "k1"], lika: ["k5", "k2"], storre: ["k3", "k6"] } }).correct, true);
  assert.equal(gradeTask(ch, t, { bins: { mindre: ["k4", "k1"], lika: ["k2"], storre: ["k3", "k6", "k5"] } }).correct, false);
  assert.match(t.review, /2 · 3 = 6 < 8/);
});

test("25: 2/3 > 3/5 (10/15 > 9/15); med resonemang krävs båda delarna", async () => {
  assert.equal((await g("25", { a: 2, n: 3, b: 3, m: 5, sort: "omdelning" }, { value: ">" })).r.correct, true);
  assert.equal((await g("25", { a: 2, n: 3, b: 3, m: 5, sort: "omdelning" }, { value: "<" })).r.correct, false);
  const params = { a: 2, n: 3, b: 3, m: 5, sort: "omdelning", ordning: ["namnare", "ratt", "additiv", "taljare"] };
  const { t, ch } = await g("25", params, null);
  assert.equal(t.view.fragor[0].options[1].text, "Med lika stora bitar: 2/3 = 10/15 och 3/5 = 9/15.");
  assert.equal(gradeTask(ch, t, { parts: { rel: { value: ">" }, varfor: { id: "r2" } } }).correct, true);
  const felSkal = gradeTask(ch, t, { parts: { rel: { value: ">" }, varfor: { id: "r1" } } });
  assert.equal(felSkal.correct, false);
  assert.equal(felSkal.reason, "fel-resonemang");
  assert.equal(gradeTask(ch, t, { parts: { rel: { value: ">" } } }).status, "invalid");
  assert.ok(t.view.stavar.every((s) => s.iHjalp), "stavarna bara i hjälpen");
});

test("26: 1/4 < 1/3 < 1/2 < 3/4 – bara hela ordningen ger poäng", async () => {
  const kort = [{ n: 1, d: 2 }, { n: 1, d: 4 }, { n: 3, d: 4 }, { n: 1, d: 3 }];
  const { t, ch } = await g("26", { kort }, null);
  assert.equal(t.key.display, "1/4 < 1/3 < 1/2 < 3/4");
  assert.equal(gradeTask(ch, t, { ids: ["k2", "k4", "k1", "k3"] }).correct, true);
  assert.equal(gradeTask(ch, t, { ids: ["k2", "k1", "k4", "k3"] }).correct, false);
  assert.equal(gradeTask(ch, t, { ids: ["k2", "k4"] }).status, "invalid");
});

test("27: 7/4 = en hel och tre fjärdedelar; bråk och blandad form godtas, ingen fyrdelad cirkel med sju delar", async () => {
  const p = { typ: "bild", form: "cirkel", n: 4, a: 7 };
  const { t, ch } = await g("27", p, null);
  assert.equal(gradeTask(ch, t, falt(7, 4)).correct, true);
  assert.equal(gradeTask(ch, t, falt(3, 4, 1)).correct, true);
  assert.equal(gradeTask(ch, t, falt(7, 8)).correct, false);
  assert.deepEqual([t.view.wholes, t.view.parts, t.view.marked], [2, 4, 7]);
  const bygg = await g("27", { typ: "bygg", form: "stav", n: 4, a: 7 }, { selected: ["p0", "p1", "p2", "p3", "p5", "p8", "p11"] });
  assert.equal(bygg.r.correct, true);
});

test("28: 11/4 → 2 3/4 och 1 2/3 → 5/3; bråkdelen förkortad", async () => {
  assert.equal((await g("28", { riktning: "blandad", n: 4, w: 2, r: 3 }, falt(3, 4, 2))).r.correct, true);
  assert.equal((await g("28", { riktning: "blandad", n: 4, w: 2, r: 3 }, falt(11, 4))).r.reason, "ej-blandad");
  assert.equal((await g("28", { riktning: "blandad", n: 4, w: 2, r: 2 }, falt(2, 4, 2))).r.reason, "ej-forkortad-del");
  assert.equal((await g("28", { riktning: "blandad", n: 4, w: 2, r: 2 }, falt(1, 2, 2))).r.correct, true);
  assert.equal((await g("28", { riktning: "brak", n: 3, w: 1, r: 2 }, falt(5, 3))).r.correct, true);
  assert.equal((await g("28", { riktning: "brak", n: 3, w: 1, r: 2 }, falt(3, 3))).r.correct, false);
});

test("29: 3/4 av 20 → 15, med markering av tre grupper", async () => {
  const { t, ch } = await g("29", { n: 4, a: 3, k: 5, sak: "kula" }, null);
  const ids = t.answer.parts.grupper.parts;
  assert.equal(ids.length, 20);
  assert.equal(gradeTask(ch, t, { parts: { grupper: { selected: ids.slice(5) }, antal: tal(15) } }).correct, true);
  assert.equal(gradeTask(ch, t, { parts: { grupper: { selected: ids.slice(5) }, antal: tal(5) } }).correct, false);
  // N > 36: bandet med n delar
  const band = await g("29", { n: 4, a: 3, k: 10, sak: "bok" }, null);
  assert.equal(band.t.view.stavar[0].parts, 4);
  assert.equal(gradeTask(band.ch, band.t, { parts: { grupper: { selected: ["p0", "p1", "p3"] }, antal: tal(30) } }).correct, true);
});

test("30: 3/4 av kulorna är 18 → 24 totalt; 2/3 av 24 böcker lånas ut → 8 kvar", async () => {
  assert.equal((await g("30", { typ: "helhet", n: 4, a: 3, k: 6, sak: "kulor" }, tal(24))).r.correct, true);
  assert.equal((await g("30", { typ: "helhet", n: 4, a: 3, k: 6, sak: "kulor" }, tal(72))).r.correct, false);
  const { t, r } = await g("30", { typ: "rest", n: 3, a: 2, k: 8, sak: "bocker" }, tal(8));
  assert.equal(r.correct, true);
  assert.match(t.prompt, /2\/3 av 24 böcker lånas ut/);
});

test("31: 2/7 + 3/7 = 5/7; adderade nämnare avvisas, en bit i mallen är inmatningshjälp", async () => {
  const p = { n: 7, a: 2, b: 3 };
  const mall = (k) => ({ selected: Array.from({ length: k }, (_, i) => `p${i}`) });
  assert.equal((await g("31", p, { parts: { mall: mall(5), summa: falt(5, 7) } })).r.correct, true);
  const ad = (await g("31", p, { parts: { mall: mall(5), summa: falt(5, 14) } })).r;
  assert.equal(ad.reason, "adderar-namnarna");
  assert.equal((await g("31", p, { parts: { mall: mall(2), summa: falt(5, 7) } })).r.status, "invalid");
});

test("32: 5/8 − 2/8 = 3/8; noll-uppgiften 3/7 − 3/7 = 0/7", async () => {
  const bort = (k) => ({ selected: Array.from({ length: k }, (_, i) => `p${i}`) });
  assert.equal((await g("32", { n: 8, a: 5, b: 2 }, { parts: { bort: bort(2), kvar: falt(3, 8) } })).r.correct, true);
  assert.equal((await g("32", { n: 8, a: 5, b: 2 }, { parts: { bort: bort(2), kvar: falt(3, 6) } })).r.correct, false);
  assert.equal((await g("32", { n: 7, a: 3, b: 3 }, { parts: { bort: bort(3), kvar: falt(0, 7) } })).r.correct, true);
});

test("33: 1/5 + 2/5 = 3/10 – felet är på rad 1 och förklaringen är delstorleken", async () => {
  const params = { mall: "add", t: { a: 1, b: 2, n: 5 }, felRad: 1, forklaringar: ["inget-fel", "adderar-namnare", "additiv-forlangning", "storre-namnare-storre"] };
  const { t, ch } = await g("33", params, null);
  assert.equal(t.view.fragor[0].options[0].text, "1/5 + 2/5 = 3/10");
  assert.equal(gradeTask(ch, t, { parts: { steg: { id: "s1" }, varfor: { id: "f2" } } }).correct, true);
  assert.equal(gradeTask(ch, t, { parts: { steg: { id: "s1" }, varfor: { id: "f1" } } }).correct, false);
  assert.equal(gradeTask(ch, t, { parts: { steg: { id: "inget" }, varfor: { id: "f2" } } }).correct, false);
  assert.equal(gradeTask(ch, t, { parts: { steg: { id: "s1" } } }).status, "invalid");
});

test("35: 3/4 − 1/6 = 9/12 − 2/12 = 7/12; noll med olika skrivna likvärdiga bråk", async () => {
  const p = { a: 3, n: 4, b: 1, m: 6 };
  const { t, r } = await g("35", p, { parts: { a: falt(9, 12), b: falt(2, 12), skillnad: falt(7, 12) } });
  assert.equal(r.correct, true);
  assert.equal(t.key.display, "3/4 − 1/6 = 9/12 − 2/12 = 7/12");
  assert.equal((await g("35", p, { parts: { a: falt(18, 24), b: falt(4, 24), skillnad: falt(14, 24) } })).r.correct, true);
  assert.equal((await g("35", p, { parts: { a: falt(3, 4), b: falt(1, 6), skillnad: falt(7, 12) } })).r.reason, "olika-namnare");
  const noll = await g("35", { a: 2, n: 4, b: 1, m: 2 }, { parts: { a: falt(2, 4), b: falt(2, 4), skillnad: falt(0, 4) } });
  assert.equal(noll.r.correct, true);
});

test("F: publicTask avslöjar inget facit i vyn (svarets värde står inte i view)", async () => {
  for (const [id, params, hemligt] of [["21", { p: 3, q: 4, k: 2 }, "3/4"], ["29", { n: 4, a: 3, k: 5, sak: "kula" }, "15 kulor"]]) {
    const ch = await loadChallenge(id);
    const pub = publicTask(buildTask(ch, params));
    assert.doesNotMatch(JSON.stringify(pub.view), new RegExp(hemligt.replace("/", "\\/")));
  }
});
