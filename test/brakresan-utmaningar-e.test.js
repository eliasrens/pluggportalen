// ============================================================================
// Bråkresan #710 E: utmaningarna 01–20 (utom D:s 03, 12, 19) – egna
// matematikkontroller (admin/qa-brakresan/uNN.mjs över 200 exempel + 100
// omgångar), specens exempel ordagrant (§8) och validatorerna: rätta svar
// godtas, rimliga fel avvisas, flera korrekta markerings-/sorteringsmönster.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadChallenge } from "../src/brakresan/utmaningar/index.js";
import { auditChallenge } from "../admin/qa-brakresan-generatorer.mjs";
import { buildTask, gradeTask, MIN_CORES } from "../src/brakresan/schema/kontrakt.js";
import { publicTask } from "../src/brakresan/schema/uppgift.js";
import { svarText } from "../src/brakresan/omgang-resultat.js";
import { OLIKFORM, areor } from "../src/brakresan/utmaningar/u01.js";

const E = ["01", "02", "04", "05", "06", "07", "08", "09", "10", "11", "13", "14", "15", "16", "17", "18", "20"];
const falt = (n, d) => ({ fields: { n: String(n), d: String(d) } });
const ch = (id) => loadChallenge(id);
const g = async (id, params, svar) => {
  const c = await ch(id);
  return gradeTask(c, buildTask(c, params), svar);
};

for (const id of E) {
  test(`utmaning ${id}: byggd, egna kontroller över 200 exempel och 100 omgångar`, async () => {
    const c = await ch(id);
    assert.equal(c.implemented, true);
    const r = await auditChallenge(c);
    assert.equal(r.audited, true, "admin/qa-brakresan/uNN.mjs saknas");
    assert.deepEqual(r.problems, []);
    assert.ok(r.distinctCores >= (c.minVariants ?? 60), `${r.distinctCores} kärnor`);
    // §6: de tre första belöningsomgångarna undviker tidigare kärnor så långt banken räcker.
    assert.ok(r.relaxedPerSerie <= (c.minVariants ? 6 : 1), `återkommande kärnor: ${r.relaxedPerSerie}`);
  });
}

test("01: rektanglar med lika area men olika form – rutnäten täcker hela figuren, felvarianterna har olika area", () => {
  for (const L of Object.values(OLIKFORM)) {
    const lika = L.lika.map((r) => r.length);
    assert.ok(lika.every((x) => x === lika[0]) && lika.length === L.n);
    assert.equal(new Set(L.lika.flat()).size, L.rows * L.cols);
    const fel = L.fel.map((r) => r.length);
    assert.ok(new Set(fel).size > 1);
  }
  assert.deepEqual(areor("stav", { sizes: [2, 3, 4] }), [2, 3, 4]);
});

test("01: Vilken rektangel visar fyra lika stora delar? – bara rätt figur godtas; ja/nej", async () => {
  const c = await ch("01");
  const t = buildTask(c, c.reserve[1].params);
  assert.equal(t.prompt, "Vilken rektangel är delad i fyra lika stora delar?");
  assert.equal(gradeTask(c, t, { id: t.key.correct }).correct, true);
  for (const id of t.answer.options.filter((x) => x !== t.key.correct)) assert.equal(gradeTask(c, t, { id }).correct, false);
  const jn = buildTask(c, c.reserve.find((r) => r.slot === "janej" && r.params.lay).params);
  assert.equal(jn.key.correct, "ja"); // lika area, olika form = ja
  assert.match(jn.feedback.correct, /olika form/);
});

test("02: tre av fem stavdelar markerade → 3/5; ombytt och omarkerade bland felen", async () => {
  const c = await ch("02");
  const p = c.generate((await import("../src/brakresan/schema/prng.js")).createRng("x"), { slot: "normal" });
  const t = buildTask(c, { ...p, shape: "stav", n: 5, a: 3, kort: [{ n: 3, d: 5, ratt: true }, { n: 5, d: 3, tag: "x" }, { n: 2, d: 5, tag: "y" }, { n: 3, d: 2, tag: "z" }] });
  assert.equal(t.key.display, "3/5");
  assert.equal(gradeTask(c, t, { id: "k1" }).correct, true);
  assert.equal(gradeTask(c, t, { id: "k2" }).correct, false);
});

test("04: 2/3 ↔ två tredjedelar ↔ två markerade sektorer av tre", async () => {
  const c = await ch("04");
  const t = buildTask(c, c.reserve[1].params); // 2/3 stav
  const ratt = t.key.groups[0].ids;
  const faces = ratt.map((id) => t.view.cards.find((x) => x.id === id).face);
  assert.ok(faces.some((f) => f.text === "två tredjedelar"));
  assert.ok(faces.some((f) => f.kind === "fraction" && f.n === 2 && f.d === 3));
  assert.ok(faces.some((f) => f.component === "stav" && f.parts === 3 && f.marked === 2));
  assert.equal(gradeTask(c, t, { ids: [...ratt].reverse() }).correct, true);
});

test("05: en bit på 1/3 kräver totalt tre bitar; 'två till' är fel", async () => {
  assert.equal((await g("05", { form: "stav", n: 3 }, { text: "3" })).correct, true);
  assert.equal((await g("05", { form: "stav", n: 3 }, { text: "2" })).correct, false);
  assert.equal((await g("05", { form: "mangd", n: 4, k: 3, item: "kula" }, { text: "12" })).correct, true);
  assert.equal((await g("05", { form: "mangd", n: 4, k: 3, item: "kula" }, { text: "9" })).correct, false);
});

test("07: 4 av 12 kulor → 4/12 eller 1/3 (förkortning krävs inte); del mot del avvisas", async () => {
  const p = { mode: "visa", k: 4, N: 12, item: "kula" };
  assert.equal((await g("07", p, falt(4, 12))).correct, true);
  assert.equal((await g("07", p, falt(1, 3))).correct, true);
  assert.equal((await g("07", p, falt(8, 24))).correct, true);
  assert.equal((await g("07", p, falt(4, 8))).correct, false);
  assert.equal((await g("07", p, falt(4, 0))).status, "invalid");
  // Markera först: vilka fyra som helst, sedan bråket.
  const m = { mode: "markera", k: 4, N: 12, item: "kula" };
  for (const sel of [["p0", "p1", "p2", "p3"], ["p11", "p5", "p7", "p0"], ["p2", "p4", "p6", "p8"]]) {
    assert.equal((await g("07", m, { parts: { markera: { selected: sel }, svar: falt(1, 3) } })).correct, true);
  }
  assert.equal((await g("07", m, { parts: { markera: { selected: ["p0", "p1", "p2"] }, svar: falt(1, 3) } })).correct, false);
});

test("08: 1/2, en halv, två av fyra kulor, stav med en av fyra delar → sista kortet avviker", async () => {
  const c = await ch("08");
  const t = buildTask(c, c.reserve[0].params);
  assert.equal(t.key.correct, "k4");
  assert.equal(t.view.cards[2].face.component, "mangd");
  assert.equal(gradeTask(c, t, { id: "k4" }).correct, true);
  assert.equal(gradeTask(c, t, { id: "k1" }).correct, false);
});

test("09: 3/4 > 1/4; 1/2 = 2/4 med olika indelning", async () => {
  assert.equal((await g("09", { slot: "samma", form: "stav", A: [3, 4], B: [1, 4] }, { value: ">" })).correct, true);
  assert.equal((await g("09", { slot: "samma", form: "stav", A: [3, 4], B: [1, 4] }, { value: "<" })).correct, false);
  assert.equal((await g("09", { slot: "lika", form: "cirkel", A: [1, 2], B: [2, 4] }, { value: "=" })).correct, true);
});

test("10: ett band i fyra bitar, två används – kvar är 2/4 eller 1/2; målning med valfria delar", async () => {
  const p = { typ: "tal", fraga: "kvar", sit: "band", n: 4, k: 2 };
  assert.equal((await g("10", p, falt(2, 4))).correct, true);
  assert.equal((await g("10", p, falt(1, 2))).correct, true);
  const m = { typ: "mala", fraga: "kvar", sit: "band", n: 5, k: 2 };
  for (const sel of [["p0", "p1", "p2"], ["p4", "p3", "p0"], ["p1", "p2", "p4"]]) assert.equal((await g("10", m, { selected: sel })).correct, true);
  assert.equal((await g("10", m, { selected: ["p0", "p1"] })).correct, false); // målar det som används
});

test("11: halv cirkel i två delar ↔ fyra av åtta stavdelar; varje giltig parning godtas", async () => {
  const c = await ch("11");
  const t = buildTask(c, c.reserve[0].params);
  const [p1, p2] = t.key.examples.right[0].pairs;
  assert.equal(gradeTask(c, t, { pairs: [{ a: p2.b, b: p2.a }, p1] }).correct, true);
  assert.equal(gradeTask(c, t, { pairs: [{ a: p1.a, b: p2.a }, { a: p1.b, b: p2.b }] }).correct, false);
});

test("13: 2/3, dela varje tredjedel i två → 4/6; både delning och bråk krävs, odelad stav är ofullständig", async () => {
  const p = { a: 2, n: 3, k: 2 };
  assert.equal((await g("13", p, { parts: { k: { text: "2" }, ny: falt(4, 6) } })).correct, true);
  assert.equal((await g("13", p, { parts: { k: { text: "2" }, ny: falt(2, 3) } })).correct, false);
  assert.equal((await g("13", p, { parts: { k: { text: "3" }, ny: falt(6, 9) } })).correct, false);
  assert.equal((await g("13", p, { parts: { k: { text: "1" }, ny: falt(4, 6) } })).status, "invalid");
});

test("14: 3/4 = ?/12 → 9/12 med faktorn 3; 3/4 som slutsvar uppfyller inte instruktionen", async () => {
  const p = { a: 3, b: 4, f: 3 };
  assert.equal((await g("14", p, { parts: { faktor: { text: "3" }, svar: falt(9, 12) } })).correct, true);
  const r = await g("14", p, { parts: { faktor: { text: "3" }, svar: falt(3, 4) } });
  assert.equal(r.correct, false);
  assert.equal(r.reason, "fel-namnare");
  assert.match(r.message, /nämnaren 12/);
  assert.equal((await g("14", p, { parts: { faktor: { text: "3" }, svar: falt(11, 12) } })).correct, false);
});

test("15: 1/2-familjen tar 2/4 och 3/6, 1/3 tar 2/6 och 3/9 – ordning inom fack saknar betydelse", async () => {
  const c = await ch("15");
  const t = buildTask(c, c.reserve[0].params);
  const ratt = t.key.examples.right[0].bins;
  const kort = (id) => t.view.cards.find((x) => x.id === id).face;
  assert.deepEqual(ratt.f1.map(kort).map((f) => `${f.n}/${f.d}`).sort(), ["2/4", "3/6"]);
  assert.deepEqual(ratt.f2.map(kort).map((f) => `${f.n}/${f.d}`).sort(), ["2/6", "3/9"]);
  assert.equal(gradeTask(c, t, { bins: { f1: [...ratt.f1].reverse(), f2: ratt.f2, f3: ratt.f3 } }).correct, true);
  assert.equal(gradeTask(c, t, { bins: { f1: [ratt.f2[0], ratt.f1[1]], f2: [ratt.f1[0], ratt.f2[1]], f3: ratt.f3 } }).correct, false);
  assert.equal(gradeTask(c, t, { bins: { f1: ratt.f1 } }).status, "invalid");
  assert.ok(t.view.bins.every((b) => b.face && !/färg/.test(b.label)));
});

test("16: 3/8 < 5/8 – med förklaring krävs båda delarna", async () => {
  const c = await ch("16");
  const t = buildTask(c, { slot: "rel-forkl", n: 8, a: 3, b: 5, ordning: [0, 1, 2] });
  assert.equal(t.answer.type, "multi");
  assert.equal(gradeTask(c, t, { parts: { rel: { value: "<" }, forkl: { id: "f1" } } }).correct, true);
  assert.equal(gradeTask(c, t, { parts: { rel: { value: "<" }, forkl: { id: "f2" } } }).correct, false); // "större nämnare"
  assert.equal(gradeTask(c, t, { parts: { rel: { value: ">" }, forkl: { id: "f1" } } }).correct, false);
  assert.equal(gradeTask(c, t, { parts: { rel: { value: "<" } } }).status, "invalid");
  assert.match(t.view.delar.at(-1).view.cards[0].face.text, /Fem åttondelar är fler lika stora delar än tre åttondelar/);
});

test("17: 2/3 > 2/5; förklaringen nämner samma helhet, aldrig 'större nämnare ger alltid mindre'", async () => {
  const c = await ch("17");
  const t = buildTask(c, { slot: "bild-forkl", a: 2, n: 3, m: 5, ordning: [0, 1, 2] });
  assert.equal(gradeTask(c, t, { parts: { rel: { value: ">" }, forkl: { id: "f1" } } }).correct, true);
  assert.equal(gradeTask(c, t, { parts: { rel: { value: ">" }, forkl: { id: "f2" } } }).correct, false);
  assert.doesNotMatch(JSON.stringify(t), /större nämnare ger alltid/);
});

test("18: 3/4 ligger tre fjärdedelssteg från 0 – facit är punktens exakta värde", async () => {
  const c = await ch("18");
  const t = buildTask(c, { n: 4, a: 3, ticks: 8, streck: [3, 5, 6, 7] });
  assert.equal(t.key.correct, "C");
  assert.equal(gradeTask(c, t, { id: "C" }).correct, true);
  assert.equal(gradeTask(c, t, { id: "A" }).correct, false); // täljaren som streck på åttondelar
});

test("20: 1/3 av 18 äpplen → 6; vid fördelning måste grupperna vara jämna", async () => {
  assert.equal((await g("20", { mode: "tal", n: 3, k: 6, sit: "av", item: "kula" }, { text: "6" })).correct, true);
  assert.equal((await g("20", { mode: "tal", n: 3, k: 6, sit: "av", item: "kula" }, { text: "3" })).correct, false);
  const p = { mode: "fordela", n: 3, k: 6, sit: "dela", item: "kula" };
  const ids = Array.from({ length: 18 }, (_, i) => `p${i}`);
  const jamn = { g1: ids.slice(0, 6), g2: ids.slice(6, 12), g3: ids.slice(12) };
  const varannan = { g1: ids.filter((_, i) => i % 3 === 0), g2: ids.filter((_, i) => i % 3 === 1), g3: ids.filter((_, i) => i % 3 === 2) };
  assert.equal((await g("20", p, { parts: { grupper: { bins: jamn }, svar: { text: "6" } } })).correct, true);
  assert.equal((await g("20", p, { parts: { grupper: { bins: varannan }, svar: { text: "6" } } })).correct, true);
  const ojamn = await g("20", p, { parts: { grupper: { bins: { g1: ids.slice(0, 7), g2: ids.slice(7, 12), g3: ids.slice(12) } }, svar: { text: "6" } } });
  assert.equal(ojamn.correct, false);
  assert.equal(ojamn.reason, "ojamn-fordelning");
  assert.equal((await g("20", p, { parts: { grupper: { bins: { g1: ids.slice(0, 6) } }, svar: { text: "6" } } })).status, "invalid");
});

test("publicTask visar aldrig facit för E:s utmaningar; minVariants bara med motivering", async () => {
  for (const id of E) {
    const c = await ch(id);
    const t = buildTask(c, c.reserve[0].params, { role: c.reserve[0].slot });
    const pub = JSON.stringify(publicTask(t));
    assert.doesNotMatch(pub, /"ratt"|"correct"|"key"/, id);
    if (c.minVariants) assert.ok(c.minVariants >= MIN_CORES && c.minVariantsReason, id);
  }
});

test("svarText beskriver elevens svar för E:s svarstyper", async () => {
  const c20 = await ch("20");
  const t20 = buildTask(c20, { mode: "fordela", n: 2, k: 3, sit: "av", item: "kula" });
  assert.equal(svarText(t20, { parts: { grupper: { bins: { g1: ["p0", "p1", "p2"], g2: ["p3", "p4", "p5"] } }, svar: { text: "3" } } }),
    "Du lade 3 + 3 i 2 grupper och skrev 3.");
  const c13 = await ch("13");
  const t13 = buildTask(c13, { a: 2, n: 3, k: 2 });
  assert.equal(svarText(t13, { parts: { k: { text: "2" }, ny: falt(4, 6) } }), "Du skrev 2, 4/6.");
  const c16 = await ch("16");
  const t16 = buildTask(c16, { slot: "rel", n: 8, a: 3, b: 5, ordning: [0, 1, 2] });
  assert.equal(svarText(t16, { value: "<" }), "Du svarade <.");
});
