// ============================================================================
// Bråkresan #709 D: utmaningarna 03, 12, 19 och 34 – egna matematikkontroller
// (admin/qa-brakresan/uNN.mjs över 200 exempel + 100 omgångar) och specens
// exempel ordagrant (§8).
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadChallenge } from "../src/brakresan/utmaningar/index.js";
import { auditChallenge } from "../admin/qa-brakresan-generatorer.mjs";
import { buildTask, gradeTask, MIN_CORES } from "../src/brakresan/schema/kontrakt.js";
import { publicTask } from "../src/brakresan/schema/uppgift.js";
import { PAR } from "../src/brakresan/utmaningar/u34.js";
import { VARIANTER } from "../src/brakresan/utmaningar/u19.js";

const D = ["03", "12", "19", "34"];
const falt = (n, d) => ({ fields: { n: String(n), d: String(d) } });

for (const id of D) {
  test(`utmaning ${id}: egna kontroller över 200 exempel och 100 omgångar`, async () => {
    const r = await auditChallenge(await loadChallenge(id));
    assert.equal(r.audited, true);
    assert.deepEqual(r.problems, []);
    assert.ok(r.relaxedPerSerie < 1, `för många återkommande kärnor: ${r.relaxedPerSerie}`);
  });
}

test("03: Måla 3/5 → valfria tre av fem delar (spec-exemplet)", async () => {
  const ch = await loadChallenge("03");
  const t = buildTask(ch, { shape: "rektangel", n: 5, a: 3 });
  assert.equal(t.prompt, "Måla 3/5 av rektangeln.");
  for (const sel of [["p0", "p1", "p2"], ["p4", "p0", "p2"], ["p1", "p3", "p4"]]) {
    assert.equal(gradeTask(ch, t, { selected: sel }).correct, true);
  }
  assert.equal(gradeTask(ch, t, { selected: ["p0", "p1"] }).correct, false);
  assert.equal(gradeTask(ch, t, { selected: ["p0", "p1", "p2", "p3", "p4"] }).correct, false);
  // Före kontroll: inget om "3/5 markerat" i vyn eller svarsytan.
  assert.doesNotMatch(JSON.stringify({ v: publicTask(t).view, a: publicTask(t).answer }), /3\/5|tre femtedelar/);
});

test("12: spec-exemplet 2/4, 3/6 … – bara den likvärdiga trippeln, i valfri ordning", async () => {
  const ch = await loadChallenge("12");
  const t = buildTask(ch, ch.reserve[0].params); // 1/2 × 1, 2, 3
  const ratt = t.key.groups[0].ids;
  assert.deepEqual(ratt.map((id) => t.values.cards[id]).map((v) => `${v.n}/${v.d}`), ["1/2", "1/2", "1/2"]);
  for (const perm of [[0, 1, 2], [2, 0, 1], [1, 2, 0]]) {
    assert.equal(gradeTask(ch, t, { ids: perm.map((i) => ratt[i]) }).correct, true);
  }
  const g = gradeTask(ch, t, { ids: ratt.slice(0, 2) });
  assert.equal(g.status, "invalid");
  assert.equal(g.message, "Välj ett kort till.");
});

test("19: Placera 2/5 på linjen i femtedelar; 3/4 på åttondelar godtar 6/8", async () => {
  const ch = await loadChallenge("19");
  const t = buildTask(ch, { a: 2, n: 5, ticks: 5 });
  assert.equal(gradeTask(ch, t, { value: { n: 2, d: 5 } }).correct, true);
  assert.equal(gradeTask(ch, t, { value: { n: 3, d: 5 } }).correct, false);
  const f = buildTask(ch, { a: 3, n: 4, ticks: 8 });
  assert.equal(gradeTask(ch, f, { value: { n: 6, d: 8 } }).correct, true);
  assert.equal(gradeTask(ch, f, { value: { n: 3, d: 8 } }).correct, false); // täljaren på finare gradering
  assert.ok(VARIANTER.EGNA.length + VARIANTER.FINARE.length + VARIANTER.LIKVARDIGA.length >= 60);
});

test("34: 1/2 + 1/4 = 2/4 + 1/4 = 3/4 (spec-exemplet), annan gemensam nämnare och likvärdig summa godtas", async () => {
  const ch = await loadChallenge("34");
  const t = buildTask(ch, { a: 1, n: 2, b: 1, m: 4 });
  assert.equal(t.key.display, "1/2 + 1/4 = 2/4 + 1/4 = 3/4");
  const g = (a, b, s) => gradeTask(ch, t, { parts: { a, b, summa: s } });
  assert.equal(g(falt(2, 4), falt(1, 4), falt(3, 4)).correct, true);
  assert.equal(g(falt(4, 8), falt(2, 8), falt(6, 8)).correct, true);
  assert.equal(g(falt(2, 4), falt(1, 4), falt(6, 8)).correct, true);
  const nam = g(falt(1, 2), falt(1, 4), falt(3, 4));
  assert.equal(nam.correct, false);
  assert.equal(nam.reason, "olika-namnare");
  assert.deepEqual(nam.parts, { a: false, b: false, summa: true });
  const add = g(falt(2, 4), falt(1, 4), falt(2, 6));
  assert.equal(add.reason, "fel-summa");
  assert.equal(g(falt(2, 4), falt(1, 4), { fields: { n: "", d: "" } }).status, "invalid");
  assert.equal(g(falt(16, 32), falt(8, 32), falt(24, 32)).reason, "for-stor-namnare");
});

test("34: hela talrymden enligt §8 – 42 par, minst tre multipelpar, motiverat minimum ≥ 30", async () => {
  const ch = await loadChallenge("34");
  assert.equal(new Set(PAR.map((p) => [`${p.a}/${p.n}`, `${p.b}/${p.m}`].sort().join("+"))).size, 42);
  assert.ok(PAR.filter((p) => p.multipel).length >= 3);
  assert.ok(ch.minVariants >= MIN_CORES && ch.minVariantsReason);
});
