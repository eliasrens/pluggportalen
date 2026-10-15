// ============================================================================
// Bråkresan #712 G: utmaningarna 36–50 – egna matematikkontroller
// (admin/qa-brakresan/uNN.mjs över 200 exempel + 100 omgångar), specens
// exempel ordagrant (§8, §15) och validatorerna: rätta svar i flera former
// godtas, missuppfattningar avvisas, decimal/procent ur samma exakta värde.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadChallenge } from "../src/brakresan/utmaningar/index.js";
import { auditChallenge } from "../admin/qa-brakresan-generatorer.mjs";
import { buildTask, gradeTask } from "../src/brakresan/schema/kontrakt.js";
import { createRng } from "../src/brakresan/schema/prng.js";
import { publicTask } from "../src/brakresan/schema/uppgift.js";
import { svarText } from "../src/brakresan/omgang-resultat.js";
import { q, decimalText, percentOf, discount } from "../src/brakresan/math/index.js";
import { BRAK } from "../src/brakresan/utmaningar/u40.js";

const G = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48", "49", "50"];
const falt = (n, d) => ({ fields: { n: String(n), d: String(d) } });
const bl = (whole, n = "", d = "") => ({ fields: { whole: String(whole), n: String(n), d: String(d) } });
const ch = (id) => loadChallenge(id);
const mellanrum = (s) => s.replace(/\u00a0/g, " ");
const uppg = async (id, params) => {
  const c = await ch(id);
  return { c, t: buildTask(c, params) };
};
const g = (c, t, svar) => gradeTask(c, t, svar);

for (const id of G) {
  test(`utmaning ${id}: byggd, egna kontroller över 200 exempel och 100 omgångar`, async () => {
    const c = await ch(id);
    assert.equal(c.implemented, true);
    const r = await auditChallenge(c);
    assert.equal(r.audited, true, "admin/qa-brakresan/uNN.mjs saknas");
    assert.deepEqual(r.problems, []);
    assert.ok(r.distinctCores >= (c.minVariants ?? 60), `${r.distinctCores} kärnor`);
    assert.ok(r.relaxedPerSerie <= (c.minVariants ? 6 : 1), `återkommande kärnor: ${r.relaxedPerSerie}`);
  });
}

test("§3: 38, 47, 48 är Extra utmaning, 50 Extra utmaning – blandade kluringar", async () => {
  const { extraLabel, challengeMeta } = await import("../src/brakresan/schema/katalog.js");
  for (const id of ["38", "47", "48"]) assert.equal(extraLabel(challengeMeta(id)), "Extra utmaning");
  assert.equal(extraLabel(challengeMeta("50")), "Extra utmaning – blandade kluringar");
});

test("36: 3/4 + 3/4 = 1 1/2 och 2 1/4 − 3/4 = 1 1/2 – blandad form krävs, 6/4 får formförklaring", async () => {
  const { c, t } = await uppg("36", { op: "+", A: { W: 0, x: 3, n: 4 }, B: { W: 0, x: 3, n: 4 } });
  const stav = (k) => ({ selected: t.answer.parts.stav.parts.slice(0, k) });
  assert.equal(g(c, t, { parts: { stav: stav(6), svar: bl(1, 1, 2) } }).correct, true);
  assert.equal(g(c, t, { parts: { stav: stav(6), svar: bl(1, 2, 4) } }).correct, true);
  const brak = g(c, t, { parts: { stav: stav(6), svar: bl("", 6, 4) } });
  assert.equal(brak.correct, false);
  assert.equal(brak.reason, "ej-blandad");
  assert.equal(g(c, t, { parts: { stav: stav(6), svar: bl(1, 6, 8) } }).correct, false); // 1 6/8 är fel värde
  const m = await uppg("36", { op: "−", A: { W: 2, x: 1, n: 4 }, B: { W: 0, x: 3, n: 4 } });
  const sel = m.t.answer.parts.stav.parts.slice(0, 6);
  assert.equal(g(m.c, m.t, { parts: { stav: { selected: sel }, svar: bl(1, 1, 2) } }).correct, true);
  assert.equal(g(m.c, m.t, { parts: { stav: { selected: sel }, svar: bl(2, 2, 4) } }).correct, false); // osynlig "låning" baklänges
  assert.equal(m.t.view.delar[0].view.marked, 9); // staven börjar med 2 1/4 i fjärdedelar
});

test("37: 3 · 2/5 = 6/5 = 1 1/5 – likvärdiga former godtas, multiplicerad nämnare avvisas", async () => {
  const { c, t } = await uppg("37", { k: 3, a: 2, n: 5 });
  assert.equal(t.key.display, "3 · 2/5 = 2/5 + 2/5 + 2/5 = 6/5 = 1 1/5");
  const stav = { selected: t.answer.parts.stav.parts.slice(0, 6) };
  for (const s of [falt(6, 5), bl(1, 1, 5), falt(12, 10)]) assert.equal(g(c, t, { parts: { stav, svar: s } }).correct, true);
  assert.equal(g(c, t, { parts: { stav, svar: falt(6, 15) } }).correct, false);
  assert.equal(t.view.delar[1].view.wholes, 3); // en stavram per kopia
});

test("38: 1/2 av 3/4 = 3/8 – målning inuti den randiga delen, 1/2 som svar avvisas", async () => {
  const { c, t } = await uppg("38", { a: 3, n: 4, b: 1, m: 2 });
  const ids = t.answer.parts.mala.parts; // 2 rader × 4 kolumner
  const randigaRad2 = ["p4", "p5", "p6"];
  assert.equal(g(c, t, { parts: { mala: { selected: randigaRad2 }, svar: falt(3, 8) } }).correct, true);
  assert.equal(g(c, t, { parts: { mala: { selected: ["p0", "p5", "p2"] }, svar: falt(6, 16) } }).correct, true);
  const utanfor = g(c, t, { parts: { mala: { selected: ["p0", "p1", "p3"] }, svar: falt(3, 8) } });
  assert.equal(utanfor.correct, false);
  assert.equal(utanfor.reason, "utanfor");
  assert.equal(g(c, t, { parts: { mala: { selected: randigaRad2 }, svar: falt(1, 2) } }).correct, false);
  assert.equal(ids.length, 8);
  assert.match(t.feedback.correct, /mindre än både 3\/4 och 1\/2/);
});

test("39: 0,37 = tre tiondelar och sju hundradelar = 37/100; 0,5 mot 0,05; slutnolla", async () => {
  const { c, t } = await uppg("39", { typ: "las", h: 37 });
  for (const x of ["0,37", "0.37", "0,370"]) assert.equal(g(c, t, { text: x }).correct, true, x);
  assert.equal(g(c, t, { text: "0,73" }).correct, false);
  assert.match(t.review, /3 rader och 7 rutor/);
  const m = await uppg("39", { typ: "mala", h: 5 });
  assert.equal(g(m.c, m.t, { selected: m.t.answer.parts.slice(0, 50) }).correct, false); // 0,5 målat för 0,05
  assert.doesNotMatch(m.t.view.label, /0,05/); // etiketten avslöjar inte målet
  const j = await uppg("39", { typ: "jamfor", A: { h: 30, places: 1 }, B: { h: 30, places: 2 } });
  assert.equal(j.t.key.correct, "=");
  const b = await uppg("39", { typ: "bygg", W: 1, t: 4, u: 12, ordning: "baklanges" });
  assert.equal(g(b.c, b.t, { text: "1,52" }).correct, true);
  assert.equal(g(b.c, b.t, { text: "1,412" }).correct, false);
});

test("40: 3/4 ↔ 0,75; 7/20 ↔ 0,35; 0,6 ↔ 3/5 eller 6/10; aldrig 1/3 eller 1/8", async () => {
  const d = await uppg("40", { typ: "skriv-dec", a: 3, d: 4 });
  assert.equal(g(d.c, d.t, { text: "0,75" }).correct, true);
  const d2 = await uppg("40", { typ: "skriv-dec", a: 7, d: 20 });
  assert.equal(g(d2.c, d2.t, { text: "0.35" }).correct, true);
  const b = await uppg("40", { typ: "skriv-brak", a: 3, d: 5 });
  for (const [n, dd] of [[3, 5], [6, 10], [60, 100]]) assert.equal(g(b.c, b.t, falt(n, dd)).correct, true);
  const h = await uppg("40", { typ: "skriv-dec", a: 1, d: 2 });
  assert.equal(g(h.c, h.t, { text: "0,50" }).correct, true); // slutnollan ändrar inte värdet
  assert.equal(decimalText(q(1, 3)), null); // 1/3 är aldrig 0,33
  assert.ok(BRAK.every((x) => [2, 4, 5, 10, 20, 25, 50, 100].includes(x.d)));
  assert.ok(!BRAK.some((x) => x.d === 3 || x.d === 8));
});

test("41: 37 % = 37 av 100 rutor, valfria rutor; läsning godtar 37 och 37 %", async () => {
  const { c, t } = await uppg("41", { typ: "mala", p: 37 });
  const rng = createRng("u41-test");
  assert.equal(g(c, t, { selected: rng.sample(t.answer.parts, 37) }).correct, true);
  const l = await uppg("41", { typ: "las", p: 25, layout: "block" });
  assert.equal(l.t.view.marked.length, 25);
  for (const x of ["25", "25 %"]) assert.equal(g(l.c, l.t, { text: x }).correct, true);
  assert.equal(g(l.c, l.t, { text: "75" }).correct, false);
});

test("42: 3/4, 0,75, 75 % – en av varje form, unik trippel, alla ordningar", async () => {
  const c = await ch("42");
  const t = buildTask(c, c.reserve[0].params);
  const ids = t.key.groups[0].ids;
  const forms = ids.map((id) => t.view.cards.find((x) => x.id === id).face.kind).sort();
  assert.deepEqual(forms, ["decimal", "fraction", "percent"]);
  assert.equal(g(c, t, { ids: [...ids].reverse() }).correct, true);
  assert.equal(mellanrum(t.key.display), "3/4 = 75/100 = 0,75 = 75 %");
  assert.equal(g(c, t, { ids: ids.slice(0, 2) }).status, "invalid"); // "Välj ett kort till" låser inte
});

test("43: 1/4, 0,25, 25 % och en bild med 50/100 markerat → bilden avviker", async () => {
  const c = await ch("43");
  const t = buildTask(c, c.reserve[0].params);
  const bild = t.view.cards.find((x) => x.face.component === "hundraruta");
  assert.equal(bild.face.marked, 50);
  assert.equal(t.key.correct, bild.id);
  assert.equal(bild.face.label, "Hela hundrarutan = 1");
});

test("44: 25 % av 80 = 20, 75 % av 40 = 30 – procentsiffran är fel svar", async () => {
  assert.equal(percentOf(25, 80).n, 20);
  const { c, t } = await uppg("44", { p: 25, N: 80 });
  assert.equal(g(c, t, { text: "20" }).correct, true);
  assert.equal(g(c, t, { text: "25" }).correct, false);
  const b = await uppg("44", { p: 75, N: 40 });
  assert.equal(g(b.c, b.t, { text: "30" }).correct, true);
  assert.equal(g(b.c, b.t, { text: "10" }).correct, false);
});

test("45: 6 av 24 → 1/4 → 25 %; 6 av 12 och 6 av 24 är olika procent", async () => {
  const { c, t } = await uppg("45", { k: 6, N: 24 });
  for (const [n, d] of [[6, 24], [1, 4], [25, 100]]) assert.equal(g(c, t, { parts: { brak: falt(n, d), procent: { text: "25" } } }).correct, true);
  assert.equal(g(c, t, { parts: { brak: falt(6, 24), procent: { text: "6" } } }).correct, false);
  const j = await uppg("45", { k: 6, N: 12, N2: 24 });
  assert.equal(g(j.c, j.t, { parts: { a: { text: "50" }, b: { text: "25 %" } } }).correct, true);
  assert.equal(g(j.c, j.t, { parts: { a: { text: "50" }, b: { text: "50" } } }).correct, false);
});

test("46: 20 % < 1/4 < 0,4 < 75 %", async () => {
  const c = await ch("46");
  const t = buildTask(c, c.reserve[0].params);
  assert.equal(mellanrum(t.key.display), "20 % < 1/4 < 0,4 < 75 %"); // hårt mellanslag före %
  assert.equal(g(c, t, t.key.examples.right[0]).correct, true);
});

test("47: 3/4 ÷ 3 = 1/4 utan omdelning; 1/2 ÷ 3 = 1/6 kräver att bitarna delas", async () => {
  const a = await uppg("47", { a: 3, n: 4, k: 3 });
  assert.equal(g(a.c, a.t, { parts: { dela: { text: "1" }, svar: falt(1, 4) } }).correct, true);
  assert.equal(g(a.c, a.t, { parts: { dela: { text: "1" }, svar: falt(3, 12) } }).correct, true);
  const b = await uppg("47", { a: 1, n: 2, k: 3 });
  assert.equal(g(b.c, b.t, { parts: { dela: { text: "3" }, svar: falt(1, 6) } }).correct, true);
  const ojamn = g(b.c, b.t, { parts: { dela: { text: "1" }, svar: falt(1, 6) } });
  assert.equal(ojamn.correct, false);
  assert.equal(ojamn.reason, "ojamn");
});

test("48: 1/2 ÷ 1/4 = 2 – två fjärdedelar fyller en halv", async () => {
  const { c, t } = await uppg("48", { c: 2, m: 4 });
  assert.equal(t.key.display, "1/2 ÷ 1/4 = 2: 2 bitar 1/4 fyller 1/2");
  const sel = t.answer.parts.bitar.parts.slice(0, 2);
  assert.equal(g(c, t, { parts: { bitar: { selected: sel }, antal: { text: "2" } } }).correct, true);
  assert.equal(g(c, t, { parts: { bitar: { selected: sel }, antal: { text: "4" } } }).correct, false);
});

test("49: pris 200 kr, rabatt 25 % → rabatt 50 kr, nytt pris 150 kr", async () => {
  const d = discount(200, 25);
  assert.deepEqual([d.discount.n, d.newPrice.n], [50, 150]);
  const r = await uppg("49", { typ: "rabatt", pris: 200, p: 25, vara: 0 });
  assert.equal(g(r.c, r.t, { text: "50" }).correct, true);
  assert.equal(g(r.c, r.t, { text: "150" }).correct, false);
  const n = await uppg("49", { typ: "nytt", pris: 200, p: 25, vara: 0 });
  assert.equal(g(n.c, n.t, { text: "150" }).correct, true);
  assert.equal(g(n.c, n.t, { text: "50" }).correct, false);
});

test("50: 3/4 av 24 kulor röda, hälften av de röda ges bort → 15 kvar; tio familjer per omgång", async () => {
  const c = await ch("50");
  const t = buildTask(c, c.reserve[1].params);
  assert.equal(g(c, t, { parts: { svar: { text: "15" } } }).correct, true);
  assert.equal(g(c, t, { parts: { svar: { text: "9" } } }).correct, false); // bara de röda som är kvar
  const b = buildTask(c, c.reserve[5].params); // jacka 400 kr, 25 %, budget 320 kr → räcker, 20 kr över
  assert.equal(g(c, b, { parts: { val: { id: "ja" }, svar: { text: "20" } } }).correct, true);
  assert.equal(g(c, b, { parts: { val: { id: "nej" }, svar: { text: "80" } } }).correct, false);
});

test("genomgången beskriver svaren och publicTask läcker inget facit (36–50)", async () => {
  for (const id of G) {
    const c = await ch(id);
    const t = buildTask(c, c.reserve[0].params);
    const pub = publicTask(t);
    assert.equal(JSON.stringify(pub).includes("\"key\""), false);
    assert.equal(typeof svarText(t, t.key.examples.right[0]), "string", id);
  }
});
