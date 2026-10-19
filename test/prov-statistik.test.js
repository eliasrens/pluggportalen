// ============================================================================
// Prov (#742, spec §7.5 + testlistan "Statistiken"): färgerna vid gränserna
// 39/40 % och 69/70 %, "delvis" = ½ utan poäng, obesvarade/orättade räknas inte
// som fel förrän de rättats, klassöversikten, historiken över tid och att
// fliken "Prov" i klassens statistik gör EXAKT EN fråga mot databasen.
// Reglerna (provInfo, collection group-frågan): firestore-rules-prov-statistik.test.js.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { delaUppProv } from "../src/prov/prov-modell.js";
import { validateProv } from "../src/prov/prov-validera.js";
import { bedom, godkann, godkannAlla, nyRattning, sparDok } from "../src/prov/prov-rattning-logik.js";
import {
  CELL, andelFor, cellLage, fargFor, fordelning, fordelningText, granserFor, historik, klassOversikt, linjePunkter,
  procent, provInfoDok, medTillfallensGranser, snitt, sorteraRader, totalText,
} from "../src/prov/prov-statistik.js";

// 10 flervalsfrågor à 10 poäng → varje fråga = 10 %, och poäng 0–100 ger exakta procent.
const fragorN = (n, poang = 10) => Array.from({ length: n }, (_, i) => ({ id: `f${i}`, typ: "flerval", fraga: `F${i}`, alternativ: ["a", "b"], ratt: 0, poang }));
const R = (poster) => ({ fragor: poster });
const post = (ratt, poang) => ({ ratt, poang, auto: false });

describe("färgerna (§7.5)", () => {
  it("gränserna 59/60 % och 84/85 % (standard 60/85, #759)", () => {
    assert.equal(fargFor(0.59), "rod");
    assert.equal(fargFor(0.5999), "rod");
    assert.equal(fargFor(0.6), "gul");
    assert.equal(fargFor(0.84), "gul");
    assert.equal(fargFor(0.8499), "gul");
    assert.equal(fargFor(0.85), "gron");
    assert.equal(fargFor(1), "gron");
    assert.equal(fargFor(0), "rod");
    assert.equal(fargFor(null), null, "inget bedömt = ingen färg");
  });
  it("poängen räknas exakt vid gränserna: 59/100 röd, 60/100 gul, 84/100 gul, 85/100 grön", () => {
    // En fråga à 100 poäng – andelen = poängen.
    const f = [{ id: "a", typ: "flerval", fraga: "?", alternativ: ["x", "y"], ratt: 0, poang: 100 }];
    const farg = (p) => fargFor(andelFor(R({ a: post("delvis", p) }), f, true).andel);
    assert.deepEqual([59, 60, 84, 85].map(farg), ["rod", "gul", "gul", "gron"]);
    // 7 av 10 rätt (0.7 * 100 = 70.00000000000001 i flyttal) blir grön med 40/70, 4 av 10 gul.
    const tio = fragorN(10);
    const k = (n) => R(Object.fromEntries(tio.map((x, i) => [x.id, i < n ? post(true, 10) : post(false, 0)])));
    const g = { gul: 40, gron: 70 };
    assert.equal(fargFor(andelFor(k(7), tio, true).andel, g), "gron");
    assert.equal(fargFor(andelFor(k(4), tio, true).andel, g), "gul");
    assert.equal(fargFor(andelFor(k(3), tio, true).andel, g), "rod");
  });
  it("läraren ändrar gränserna per prov", () => {
    assert.equal(fargFor(0.55, { gul: 50, gron: 60 }), "gul");
    assert.equal(fargFor(0.6, { gul: 50, gron: 60 }), "gron");
    assert.equal(fargFor(0.49, { gul: 50, gron: 60 }), "rod");
    assert.deepEqual(granserFor({ granser: { gul: 30, gron: 80 } }), { gul: 30, gron: 80 });
    assert.deepEqual(granserFor({}), { gul: 60, gron: 85 }, "gamla prov utan gränser → standard 60/85");
    assert.deepEqual(granserFor({ granser: { gul: 80, gron: 70 } }), { gul: 60, gron: 85 }, "ogiltiga gränser → standard");
  });
});

describe("andelen", () => {
  it('"delvis" räknas som ½ när provet inte poängsätts', () => {
    const f = fragorN(4, 3); // poängen ignoreras utan poängsättning
    const r = R({ f0: post(true, 3), f1: post("delvis", 1), f2: post("delvis", 2), f3: post(false, 0) });
    const a = andelFor(r, f, false);
    assert.equal(a.andel, (1 + 0.5 + 0.5 + 0) / 4);
    assert.equal(procent(a.andel), "50 %");
    assert.equal(totalText({ ...a }, false), "50 %");
  });
  it("med poäng: poängen av max för de bedömda frågorna", () => {
    const f = fragorN(3, 4);
    const a = andelFor(R({ f0: post(true, 4), f1: post("delvis", 1), f2: post(false, 0) }), f, true);
    assert.deepEqual([a.poang, a.max, a.bedomda], [5, 12, 3]);
    assert.equal(totalText(a, true), "5/12 · 42 %");
  });
  it("obesvarade och orättade frågor räknas inte som fel förrän de rättats", () => {
    const f = fragorN(4);
    // Två rätt bedömda, ett förslag (fel) och en fråga utan post: 2 av 2 = 100 %, inte 50 %.
    const r = R({ f0: post(true, 10), f1: post(true, 10), f2: { ratt: false, poang: 0, auto: true } });
    const a = andelFor(r, f, true);
    assert.equal(a.andel, 1);
    assert.equal(a.bedomda, 2);
    assert.equal(fargFor(a.andel), "gron");
    // När läraren rättar dem som fel räknas de.
    const efter = R({ ...r.fragor, f2: post(false, 0), f3: post(false, 0) });
    assert.equal(andelFor(efter, f, true).andel, 0.5);
    // Ingenting bedömt: ingen färg ("ej rättad").
    assert.equal(andelFor(R({ f0: { ratt: true, poang: 10, auto: true } }), f, true).andel, null);
    assert.equal(andelFor(null, f, true).andel, null);
  });
  it("cellerna: bedömd → färg; obesvarad (streckad) och inte rättad (?) är aldrig fel", () => {
    const [f] = fragorN(1);
    assert.equal(cellLage(post(true, 10), 0, f), CELL.RATT);
    assert.equal(cellLage(post("delvis", 5), 0, f), CELL.DELVIS);
    assert.equal(cellLage(post(false, 0), 1, f), CELL.FEL);
    assert.equal(cellLage({ ratt: false, poang: 0, auto: true }, null, f), CELL.OBESVARAD, "förslag fel på obesvarad = obesvarad");
    assert.equal(cellLage(undefined, null, f), CELL.OBESVARAD);
    assert.equal(cellLage({ ratt: true, poang: 10, auto: true }, 0, f), CELL.EJ, "förslag = inte rättad än");
    assert.equal(cellLage(undefined, 0, f), CELL.EJ);
    assert.equal(cellLage(post(false, 0), null, f), CELL.FEL, "obesvarad som läraren rättat som fel = fel");
  });
});

describe("klassöversikten (§7.5 Hela klassen)", () => {
  const PROV = validateProv({
    namn: "P", installningar: { poang: true, granser: { gul: 40, gron: 70 } },
    fragor: [
      { id: "t1", typ: "text", titel: "Läs", brodtext: "Text" },
      { id: "q1", typ: "flerval", fraga: "1?", alternativ: ["a", "b"], ratt: 0 },
      { id: "q2", typ: "santfalskt", fraga: "2?", ratt: true },
      { id: "q3", typ: "kortsvar", fraga: "3?", godkanda: ["Birka"], exaktStavning: false, poang: 2 },
    ],
  }).value;
  const { fragor, facit } = delaUppProv(PROV);
  const SVAR = {
    a: { q1: 0, q2: true, q3: "Birka" },  // allt rätt
    b: { q1: 1, q2: false, q3: "Sigtuna" }, // allt fel
    c: { q1: 0, q2: false },                // 1 av 2 + obesvarad
    d: { q1: 0, q2: true, q3: "Birka" },  // bara förslag
  };
  const ny = (uid) => nyRattning({ elevId: uid, classId: "4a", provNamn: "P", fragor, svar: SVAR[uid], facit });
  const rattningar = { a: godkannAlla(ny("a"), fragor), b: godkannAlla(ny("b"), fragor), c: godkann(godkann(ny("c"), "q1"), "q2"), d: ny("d") };
  rattningar.a = { ...rattningar.a, niva: "MG" };
  const m = klassOversikt({
    fragor, med: ["a", "b", "c", "d"], namn: { a: "Ada", b: "Bo", c: "Cia", d: "Dan" },
    svarAv: (uid, fid) => SVAR[uid][fid], rattningar, installningar: PROV.installningar,
  });

  it("en rad per elev, en cell per fråga (inte textblocket), total, färg och nivå", () => {
    assert.equal(m.rader.length, 4);
    const a = m.rader.find((r) => r.id === "a");
    assert.deepEqual(a.celler.map((c) => c.lage), ["ratt", "ratt", "ratt"]);
    assert.deepEqual([a.poang, a.max, a.farg, a.niva, a.nivaNamn], [4, 4, "gron", "MG", "Mer än godtagbart"]);
    const c = m.rader.find((r) => r.id === "c");
    assert.deepEqual(c.celler.map((x) => x.lage), ["ratt", "fel", "obesvarad"]);
    assert.equal(c.andel, 0.5, "obesvarad räknas inte");
    assert.equal(c.farg, "gul");
    const d = m.rader.find((r) => r.id === "d");
    assert.deepEqual(d.celler.map((x) => x.lage), ["ej", "ej", "ej"]);
    assert.equal(d.farg, null);
  });
  it('räknaren "🟢 · 🟡 · 🔴 · ej rättade", snittet och summan per fråga', () => {
    assert.deepEqual(m.raknare, { gron: 1, gul: 1, rod: 1, ej: 1 });
    assert.equal(fordelningText(m.raknare), "🟢 1 · 🟡 1 · 🔴 1 · ej rättade 1");
    assert.equal(m.snitt, (1 + 0 + 0.5) / 3);
    const q1 = m.fragaSumma.find((s) => s.fid === "q1");
    assert.equal(q1.andel, 2 / 3);
    assert.equal(q1.bedomda, 3, "förslagen (Dan) räknas inte");
    assert.equal(m.fragaSumma.find((s) => s.fid === "q3").andel, 0.5, "Cias obesvarade q3 räknas inte");
  });
  it("de tre svåraste frågorna – lägst andel först", () => {
    assert.deepEqual(m.svarast.map((s) => s.fid), ["q2", "q3", "q1"]);
  });
  it("sortering efter namn eller resultat (ej rättade sist)", () => {
    assert.deepEqual(sorteraRader(m.rader, "namn").map((r) => r.namn), ["Ada", "Bo", "Cia", "Dan"]);
    assert.deepEqual(sorteraRader(m.rader, "resultat").map((r) => r.namn), ["Ada", "Cia", "Bo", "Dan"]);
  });
  it("provInfo i rättningen: datum, gränser och andelen – följer med sparDok", () => {
    const tf = { oppnad: 1_700_000_000_000, installningar: { poang: true, granser: { gul: 50, gron: 80 } } };
    const info = provInfoDok(rattningar.c, fragor, tf);
    assert.deepEqual(info, { datum: 1_700_000_000_000, granser: { gul: 50, gron: 80 }, andel: 0.5 });
    assert.deepEqual(sparDok(rattningar.c, fragor, info).provInfo, info);
    assert.ok(!("provInfo" in sparDok(rattningar.c, fragor)), "utan provInfo som förut");
    assert.equal(provInfoDok(rattningar.d, fragor, tf).andel, null);
    // Firestore-tidsstämpel (toMillis) fungerar också.
    assert.equal(provInfoDok(rattningar.c, fragor, { oppnad: { toMillis: () => 5 } }).datum, 5);
  });
  it("bedömningen ändras → färgen följer", () => {
    const q3 = fragor.find((f) => f.id === "q3");
    const c2 = bedom(rattningar.c, q3, { ratt: true }, fragor);
    assert.equal(andelFor(c2, fragor, true).andel, 3 / 4);
  });
});

describe("historiken (§7.5 Över tid)", () => {
  const D = (dag) => Date.UTC(2026, 8, dag);
  const lista = [
    { t: "t1", elevId: "a", classId: "4a", provNamn: "Sten", provInfo: { datum: D(1), granser: { gul: 40, gron: 70 }, andel: 0.9 }, niva: "MG", aterlamnad: true },
    { t: "t1", elevId: "b", classId: "4a", provNamn: "Sten", provInfo: { datum: D(1), granser: { gul: 40, gron: 70 }, andel: 0.3 }, aterlamnad: true },
    { t: "t1", elevId: "c", classId: "4a", provNamn: "Sten", provInfo: { datum: D(1), granser: { gul: 40, gron: 70 }, andel: null }, aterlamnad: false },
    { t: "t2", elevId: "a", classId: "4a", provNamn: "Brons", provInfo: { datum: D(20), granser: { gul: 50, gron: 90 }, andel: 0.8 }, aterlamnad: true },
    // äldre dokument utan provInfo: totalen av max om det är tillbakalämnat
    { t: "t0", elevId: "a", classId: "4a", provNamn: "Gammalt", totalPoang: 3, maxPoang: 4, aterlamnad: true, aterlamnadAt: { toMillis: () => D(0) } },
  ];
  const { tillfallen, perElev } = historik(lista);
  it("klassens tillfällen nyast först med snitt och fördelning", () => {
    assert.deepEqual(tillfallen.map((t) => t.t), ["t2", "t1", "t0"]);
    const t1 = tillfallen.find((t) => t.t === "t1");
    assert.equal(t1.snitt, 0.6);
    assert.equal(t1.farg, "gul");
    assert.deepEqual(t1.fordelning, { gron: 1, gul: 0, rod: 1, ej: 1 });
    assert.equal(tillfallen.find((t) => t.t === "t2").fordelning.gul, 1, "provets egna gränser (80 % < 90 %)");
  });
  it("varje elev: alla prov äldst först med andel, färg och nivå", () => {
    const a = perElev.get("a");
    assert.deepEqual(a.map((p) => p.t), ["t0", "t1", "t2"]);
    assert.deepEqual(a.map((p) => p.andel), [0.75, 0.9, 0.8]);
    // t0 saknar provInfo → standardgränserna 60/85 (#759): 75 % är gul.
    assert.deepEqual(a.map((p) => p.farg), ["gul", "gron", "gul"]);
    assert.equal(a[1].nivaNamn, "Mer än godtagbart");
    assert.equal(perElev.get("c")[0].farg, null);
  });
  it("linjens punkter (null hoppas över)", () => {
    const p = linjePunkter([0, null, 1], 100, 40, 4);
    assert.deepEqual(p.map((x) => [x.x, x.y]), [[4, 36], [96, 4]]);
    assert.deepEqual(linjePunkter([0.5], 100, 40).map((x) => x.x), [50]);
  });
  it("snitt och fördelning", () => {
    assert.equal(snitt([null, 0.5, 1]), 0.75);
    assert.equal(snitt([null]), null);
    assert.deepEqual(fordelning([0.59, 0.6, 0.85, null]), { gron: 1, gul: 1, rod: 1, ej: 1 });
    assert.deepEqual(fordelning([0.39, 0.4, 0.7, null], { gul: 40, gron: 70 }), { gron: 1, gul: 1, rod: 1, ej: 1 });
  });
});

describe('fliken "Prov" i klassens statistik: EN fråga på rättningarna + EN på klassens tillfällen (gränserna, #796)', () => {
  const data = readFileSync(new URL("../src/prov/prov-statistik-data.js", import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
  const vy = readFileSync(new URL("../src/prov/prov-klass-statistik.js", import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
  const rakna = (src, re) => (src.match(re) || []).length;
  it("datafilen: en getDocs på en collection group med where classId == (+ en på tillfällena, #796), inga andra läsningar", () => {
    assert.equal(rakna(data, /\bgetDocs\(/g), 2);
    assert.equal(rakna(data, /\bcollection\(db, SAMLING_TILLFALLEN\)/g), 1);
    assert.equal(rakna(data, /\bcollectionGroup\(/g), 1);
    assert.match(data, /where\("classId", "==", classId\)/);
    for (const re of [/\bgetDoc\(/, /\bonSnapshot\(/, /\bgetDocsFromServer\(/, /\bgetCountFromServer\(/]) assert.doesNotMatch(data, re);
  });
  it("vyn läser bara genom hamta(classId), en gång, och importerar inte Firebase", () => {
    assert.equal(rakna(vy, /\bhamta\(classId\)/g), 1);
    assert.equal(rakna(vy, /\bhamtaTillfallen\(classId\)/g), 1);
    assert.doesNotMatch(vy, /firebase|getDocs|getDoc\(|onSnapshot|data-content|getStudentsByIds/);
  });
  it("teacher-class.js laddar fliken lat (import()) och bara med classId", () => {
    const tc = readFileSync(new URL("../src/teacher-class.js", import.meta.url), "utf8");
    assert.match(tc, /key: "prov"[\s\S]*?when: \(o\) => !!o\.classId[\s\S]*?await import\("\.\/prov\/prov-klass-statistik\.js"\)/);
    assert.doesNotMatch(tc, /^import .*prov\//m);
  });
  it("collection group-indexet för classId finns i firestore.indexes.json", () => {
    const idx = JSON.parse(readFileSync(new URL("../firestore.indexes.json", import.meta.url), "utf8"));
    const o = idx.fieldOverrides.find((x) => x.collectionGroup === "rattning" && x.fieldPath === "classId");
    assert.ok(o?.indexes.some((i) => i.queryScope === "COLLECTION_GROUP" && i.order === "ASCENDING"));
  });
});

describe("tillfällets gränser före rättningens kopia (#796)", () => {
  const lista = [
    { t: "a", elevId: "e1", provInfo: { andel: 0.7, granser: { gul: 60, gron: 85 }, datum: 1 } },
    { t: "b", elevId: "e1", provInfo: { andel: 0.7, granser: { gul: 60, gron: 85 }, datum: 2 } },
    { t: "c", elevId: "e1" },
  ];
  it("tillfället vinner; saknat eller ogiltigt tillfälle → rättningens kopia", () => {
    const ut = medTillfallensGranser(lista, [
      { id: "a", installningar: { granser: { gul: 50, gron: 70 } } },
      { id: "b", installningar: { granser: { gul: 90, gron: 80 } } },
    ]);
    assert.deepEqual(ut[0].provInfo.granser, { gul: 50, gron: 70 });
    assert.equal(ut[0].provInfo.andel, 0.7);
    assert.deepEqual(ut[1].provInfo.granser, { gul: 60, gron: 85 });
    assert.equal(ut[2].provInfo, undefined);
  });
  it("historiken färgar efter de nya gränserna direkt", () => {
    const vid = (granser) => historik(medTillfallensGranser(lista.slice(0, 1), [{ id: "a", installningar: { granser } }])).tillfallen[0];
    assert.equal(vid({ gul: 60, gron: 85 }).farg, "gul");
    assert.equal(vid({ gul: 50, gron: 70 }).farg, "gron");
    assert.equal(vid({ gul: 75, gron: 90 }).farg, "rod");
  });
  it("tillfällena läses utan tillfälleslista (null) → oförändrat", () => {
    assert.deepEqual(medTillfallensGranser(lista, null), lista);
  });
});
