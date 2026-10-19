// ============================================================================
// Prov 3D (#765, spec §2.2–§2.3, §7, §7.5, §12–§13): statistik per avsnitt,
// elevens resultat (decimalkomma, avsnitt, poängkriterier) och "Delvis" på
// en fråga värd 0,5 p. Ren logik – vyerna provas i previewn.
//   - poäng per avsnitt för en elev ("Del 1: 8 av 10") och klassens snitt,
//     exakt med halvpoäng, färggränserna (#759) rätt på halvpoäng
//   - avsnitt räknas aldrig som frågor, numreringen är löpande
//   - full poäng = rätt (0,5 av 0,5 p är aldrig en gul ½-cell), ingen Delvis vid max 0,5
//   - kriterierna i resultatet bara när flaggan är på OCH efter tillbakalämningen
//   - gamla prov (inga avsnitt, heltal) ser ut som förut
// Reglerna för kriterierna: firestore-rules-prov-kriterier-765.test.js.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { delaUppProv, fragaNummer, poangAvsnitt } from "../src/prov/prov-modell.js";
import { validateProv } from "../src/prov/prov-validera.js";
import {
  aterlamnadDok, bedom, delvisMojlig, godkannAlla, nyRattning, sparDok, visadRatt,
} from "../src/prov/prov-rattning-logik.js";
import { avsnittsPoang, resultatModell } from "../src/prov/prov-resultat-modell.js";
import {
  CELL, andelFor, avsnittFor, avsnittText, avsnittVarde, cellLage, granserFor, klassOversikt, snittTal,
} from "../src/prov/prov-statistik.js";
import { jamforKlasser, perFragaStaplar, resultatCsv } from "../src/prov/prov-statistik-fordjupad.js";

// Del 1: 4 frågor à 2,5 p = 10 p. Del 2: 3,5 + 4 + 6,5 = 14 p. Före Del 1: en fråga à 0,5 p.
const PROV = validateProv({
  namn: "Vikingatiden",
  installningar: { visaKriterier: true },
  fragor: [
    { id: "q0", typ: "santfalskt", fraga: "Birka låg på Björkö.", ratt: true, poang: 0.5 },
    { id: "a1", typ: "avsnitt", titel: "Del 1", instruktion: "Svara kort." },
    ...[1, 2, 3, 4].map((i) => ({ id: `q${i}`, typ: "flerval", fraga: `F${i}`, alternativ: ["a", "b"], ratt: 0, poang: 2.5 })),
    { id: "t1", typ: "text", titel: "Läs", brodtext: "En text." },
    { id: "a2", typ: "avsnitt", titel: "Del 2" },
    { id: "q5", typ: "kortsvar", fraga: "Åskguden?", godkanda: ["Tor"], poang: 3.5 },
    { id: "q6", typ: "fritext", fraga: "Varför reste vikingarna?", poang: 4, kriterier: ["1 p: en orsak", "+1 p: förklarar"] },
    { id: "q7", typ: "fritext", fraga: "Beskriv en gård.", poang: 6.5 },
  ],
}).value;
const { fragor, facit, kriterier } = delaUppProv(PROV);
const F = (id) => fragor.find((f) => f.id === id);
const SVAR = { q0: true, q1: 0, q2: 0, q3: 0, q4: 1, q5: "Tor", q6: "Handel", q7: "Hus" };

/** En elev med poängen { q1: 2.5, … } – allt bedömt av läraren. */
function elev(uid, poang) {
  let r = godkannAlla(nyRattning({ elevId: uid, classId: "4a", provNamn: "x", fragor, svar: SVAR, facit }), fragor);
  for (const [id, p] of Object.entries(poang)) r = bedom(r, F(id), { poang: p }, fragor);
  return sparDok(r, fragor);
}
// Alva: Del 1 q1–q3 rätt (7,5), q4 fel → 7,5 av 10; Del 2 3,5 + 2,5 + 3,5 = 9,5 av 14; totalt 17,5.
const ALVA = elev("e1", { q0: 0.5, q4: 0, q6: 2.5, q7: 3.5 });
// Bo: Del 1 1,5 + 2,5 + 2,5 + 2,5 = 9 av 10; Del 2 0 + 4 + 6,5 = 10,5 av 14.
const BO = elev("e2", { q0: 0, q1: 1.5, q4: 2.5, q5: 0, q6: 4, q7: 6.5 });

describe("poäng per avsnitt (§2.3, §7.5)", () => {
  it("poangAvsnitt: avsnitt med frågor, löpande numrering, avsnitten är inga frågor", () => {
    const a = poangAvsnitt(fragor);
    assert.deepEqual(a.map((x) => [x.id, x.titel, x.fragor.map((f) => f.id), x.maxPoang]),
      [["", "Inledning", ["q0"], 0.5], ["a1", "Del 1", ["q1", "q2", "q3", "q4"], 10], ["a2", "Del 2", ["q5", "q6", "q7"], 14]]);
    assert.deepEqual(Object.values(fragaNummer(fragor)), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.deepEqual(poangAvsnitt(fragor.filter((f) => f.typ !== "avsnitt")), [], "inga avsnitt → [] (som förut)");
  });

  it("en elev: \"Del 1: 7,5 av 10 · Del 2: 9,5 av 14\" exakt med halvpoäng", () => {
    const a = avsnittFor(ALVA, poangAvsnitt(fragor), true, granserFor());
    assert.deepEqual(a.map((x) => avsnittText(x, true)), ["Inledning: 0,5 av 0,5", "Del 1: 7,5 av 10", "Del 2: 9,5 av 14"]);
    assert.deepEqual(a.map((x) => x.farg), ["gron", "gul", "gul"], "100 % grön, 75 % gul, 67,9 % gul (60/85)");
    // Summan av avsnitten = totalen, utan flyttalsbrus.
    assert.equal(a.reduce((s, x) => s + x.poang, 0), andelFor(ALVA, fragor, true).poang);
    assert.equal(andelFor(ALVA, fragor, true).poang, 17.5);
  });

  it("färggränserna på halvpoäng: 8,5 av 10 = 85 % grön, 5,5 av 10 = 55 % röd, 6 av 10 gul", () => {
    const a1 = poangAvsnitt(fragor)[1];
    const farg = (p) => avsnittFor(elev("x", { q1: p, q2: 2.5, q3: 2.5, q4: 1 }), [a1], true, granserFor())[0];
    assert.equal(farg(2.5).poang, 8.5);
    assert.equal(farg(2.5).farg, "gron");
    assert.equal(farg(0).farg, "gul", "6 av 10 = 60 % gul");
    const rod = avsnittFor(elev("y", { q1: 0, q2: 2.5, q3: 2.5, q4: 0.5 }), [a1], true, granserFor())[0];
    assert.equal(avsnittVarde(rod, true), "5,5 av 10");
    assert.equal(rod.farg, "rod");
    assert.equal(avsnittFor(elev("z", { q1: 0, q2: 2.5, q3: 2.5, q4: 0.5 }), [a1], true, { gul: 50, gron: 70 })[0].farg, "gul", "provets egna gränser");
  });

  it("klassen: snittpoäng per avsnitt med decimalkomma, rutnätet utan avsnittskolumner", () => {
    const m = klassOversikt({ fragor, med: ["e1", "e2"], svarAv: () => undefined, rattningar: { e1: ALVA, e2: BO }, installningar: {} });
    assert.equal(m.rader[0].celler.length, 8, "avsnitt och textblock är inga frågor");
    assert.deepEqual(m.fragaSumma.map((s) => s.nr), [1, 2, 3, 4, 5, 6, 7, 8]);
    // Del 1: (7,5 + 9) / 2 = 8,25 → "8,3 av 10"; Del 2: (9,5 + 10,5) / 2 = 10 → "10 av 14".
    assert.deepEqual(m.avsnitt.map((a) => avsnittText(a, true)), ["Inledning: 0,3 av 0,5", "Del 1: 8,3 av 10", "Del 2: 10 av 14"]);
    assert.equal(m.avsnitt[1].andel, 16.5 / 20);
    assert.equal(m.avsnitt[1].farg, "gul");
    assert.equal(snittTal(8.25), "8,3");
    assert.equal(snittTal(10), "10");
    assert.ok(!avsnittText(m.avsnitt[1], true).includes("."), "inga punkt-decimaler");
    assert.deepEqual(m.rader.map((r) => r.avsnitt.map((a) => avsnittVarde(a, true))), [["0,5 av 0,5", "7,5 av 10", "9,5 av 14"], ["0 av 0,5", "9 av 10", "10,5 av 14"]]);
  });

  it("bara bedömda frågor räknas i avsnittet (förslag inte); utan poäng: procent", () => {
    const halv = sparDok(nyRattning({ elevId: "e3", classId: "4a", provNamn: "x", fragor, svar: SVAR, facit }), fragor);
    const a = avsnittFor(halv, poangAvsnitt(fragor), true, granserFor());
    assert.deepEqual(a.map((x) => avsnittVarde(x, true)), ["ej rättat", "ej rättat", "ej rättat"]);
    const m = klassOversikt({ fragor, med: ["e1"], svarAv: () => undefined, rattningar: { e1: ALVA }, installningar: { poang: false } });
    assert.equal(avsnittText(m.avsnitt[1], false), "Del 1: 75 %");
    assert.equal(avsnittText(m.rader[0].avsnitt[1], false), "Del 1: 75 %");
  });

  it("fördjupad: staplarna bär avsnittets namn, jämförelsen grupperar per avsnitt, CSV har avsnittskolumner", () => {
    const m = klassOversikt({ fragor, med: ["e1", "e2"], svarAv: () => undefined, rattningar: { e1: ALVA, e2: BO }, installningar: {} });
    const st = perFragaStaplar(m, fragor);
    assert.equal(st.find((s) => s.fid === "q6").avsnitt, "Del 2");
    const tf = { id: "t1", classId: "4a", fragor, installningar: {} };
    const j = jamforKlasser({ tf, klassNamn: "4A", rattningar: { e1: ALVA }, med: ["e1"] },
      [{ tf: { ...tf, id: "t2", classId: "4b" }, klassNamn: "4B", rattningar: { e2: BO } }]);
    assert.deepEqual(j.avsnitt.map((a) => [a.titel, a.fids.length, a.andelar]), [["Inledning", 1, [1, 0]], ["Del 1", 4, [0.75, 0.9]], ["Del 2", 3, [9.5 / 14, 10.5 / 14]]]);
    const csv = resultatCsv({ fragor, med: ["e1"], namn: { e1: "Alva" }, rattningar: { e1: ALVA }, installningar: {} });
    const [huvud, rad] = csv.replace(/^﻿/, "").split("\r\n");
    assert.match(huvud, /Fråga 8 \(6,5 p\);Inledning \(0,5 p\);Del 1 \(10 p\);Del 2 \(14 p\);Poäng/);
    assert.match(rad, /;0,5;7,5;9,5;17,5;24,5;/);
  });
});

describe("full poäng = rätt, ingen Delvis vid max 0,5 (3C-uppföljning)", () => {
  it("delvisMojlig: inte på en poängsatt fråga värd 0,5 p", () => {
    assert.equal(delvisMojlig(0.5, true), false);
    assert.equal(delvisMojlig(1, true), true);
    assert.equal(delvisMojlig(0, true), true, "max 0: delvis = ½ av andelen");
    assert.equal(delvisMojlig(0.5, false), true, "utan poäng finns Delvis alltid");
  });
  it("rättningskortet döljer Delvis och tangenten 2 gör inget när delvisMojlig är false", () => {
    const src = readFileSync(new URL("../src/prov/prov-ratta-kort.js", import.meta.url), "utf8");
    assert.match(src, /const delvisOk = delvisMojlig\(max, o\.poangsatt\)/);
    assert.match(src, /BEDOMNINGAR\.filter\(\(b\) => delvisOk \|\| b\.ratt !== "delvis"\)/);
    assert.match(src, /ratt === "delvis" && !delvisOk\)\) return/);
  });
  it("en gammal \"delvis\" med 0,5 av 0,5 p visas som rätt – cellen grön, eleven 100 %", () => {
    const post = { ratt: "delvis", poang: 0.5, auto: false };
    assert.equal(visadRatt(post, 0.5, true), true);
    assert.equal(visadRatt(post, 0.5, false), "delvis", "utan poäng gäller markeringen");
    assert.equal(visadRatt({ ratt: "delvis", poang: 1, auto: false }, 2, true), "delvis");
    assert.equal(cellLage(post, true, F("q0"), true), CELL.RATT);
    assert.equal(cellLage(post, true, F("q0"), false), CELL.DELVIS);
    const r = { ...ALVA, fragor: { ...ALVA.fragor, q0: post } };
    const m = klassOversikt({ fragor, med: ["e1"], svarAv: () => undefined, rattningar: { e1: r }, installningar: {} });
    assert.equal(m.rader[0].celler[0].lage, CELL.RATT);
    assert.equal(m.rader[0].avsnitt[0].andel, 1);
  });
});

describe("elevens resultat (§7, §2.2)", () => {
  const tf = (ins = {}) => ({ provNamn: "Vikingatiden", fragor, installningar: { poang: true, visaKriterier: true, ...ins } });
  const tillbaka = (medKriterier) => aterlamnadDok(ALVA, { visaFacit: false, facit, kriterier: medKriterier ? kriterier : null });

  it("poäng per avsnitt och totalen med halvpoäng: 17,5 av 24,5", () => {
    const m = resultatModell(tf(), { svar: SVAR }, tillbaka(true));
    assert.equal(m.totalPoang, 17.5);
    assert.equal(m.maxPoang, 24.5);
    assert.deepEqual(m.avsnitt.map((a) => [a.titel, a.poang, a.max]), [["Inledning", 0.5, 0.5], ["Del 1", 7.5, 10], ["Del 2", 9.5, 14]]);
    assert.deepEqual(m.poster.filter((p) => p.avsnitt).map((p) => p.fraga.id), ["a1", "a2"], "avsnittets poäng sitter på rubriken");
    assert.deepEqual(m.poster.filter((p) => p.nr != null).map((p) => p.nr), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.deepEqual(avsnittsPoang(ALVA, fragor.filter((f) => f.typ !== "avsnitt")), [], "gammalt prov: inga avsnitt");
  });

  it("kriterierna bara när flaggan är på OCH tillbakalämningen kopierade dem", () => {
    const med = resultatModell(tf(), { svar: SVAR }, tillbaka(true));
    assert.deepEqual(med.poster.find((p) => p.fraga.id === "q6").kriterier, ["1 p: en orsak", "+1 p: förklarar"]);
    assert.equal(med.poster.find((p) => p.fraga.id === "q7").kriterier, null);
    assert.ok(med.poster.filter((p) => p.fraga.id !== "q6").every((p) => p.kriterier === null));
    // Flaggan av (även om fältet mot förmodan finns) → inga kriterier.
    assert.ok(resultatModell(tf({ visaKriterier: false }), { svar: SVAR }, tillbaka(true)).poster.every((p) => p.kriterier === null));
    // Flaggan på men inte kopierade → inga.
    assert.ok(resultatModell(tf(), { svar: SVAR }, tillbaka(false)).poster.every((p) => p.kriterier === null));
    // Före tillbakalämningen finns inget resultat alls.
    assert.equal(resultatModell(tf(), { svar: SVAR }, { ...ALVA, kriterier }), null);
  });
});

describe("gamla prov (inga avsnitt, heltal) ser ut som förut", () => {
  const gamla = validateProv({
    namn: "Gammalt", installningar: { poang: true },
    fragor: [1, 2, 3].map((i) => ({ id: `g${i}`, typ: "flerval", fraga: `G${i}`, alternativ: ["a", "b"], ratt: 0, poang: i })),
  }).value;
  const g = delaUppProv(gamla);
  let r = godkannAlla(nyRattning({ elevId: "e", classId: "k", provNamn: "x", fragor: g.fragor, svar: { g1: 0, g2: 1, g3: 0 }, facit: g.facit }), g.fragor);
  r = sparDok(r, g.fragor);

  it("statistik: inga avsnitt, samma CSV-huvud som förut", () => {
    const m = klassOversikt({ fragor: g.fragor, med: ["e"], svarAv: () => undefined, rattningar: { e: r }, installningar: {} });
    assert.deepEqual(m.avsnitt, []);
    assert.deepEqual(m.rader[0].avsnitt, []);
    const csv = resultatCsv({ fragor: g.fragor, med: ["e"], namn: { e: "Alva" }, rattningar: { e: r }, installningar: {} });
    assert.equal(csv.replace(/^﻿/, "").split("\r\n")[0], "Elev;Fråga 1 (1 p);Fråga 2 (2 p);Fråga 3 (3 p);Poäng;Av (rättade);Procent;Färg;Nivå;Status");
  });
  it("resultat: inga avsnitt, inga kriterier, heltal", () => {
    const m = resultatModell({ fragor: g.fragor, installningar: { poang: true } }, null, aterlamnadDok(r, { visaFacit: false, facit: g.facit }));
    assert.deepEqual(m.avsnitt, []);
    assert.equal(m.totalPoang, 4);
    assert.equal(m.maxPoang, 6);
    assert.ok(m.poster.every((p) => p.kriterier === null && p.avsnitt === null));
  });
});
