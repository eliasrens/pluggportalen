// ============================================================================
// Prov 3A (#762, spec §2.2, §2.3, §2.5 + testlistan "Poängen"/"Avsnitten"):
//   prov-poang.js   halvpoäng – exakta summor, delpoäng NEDÅT, klämning,
//                   giltig maxpoäng och svenskt decimalkomma
//   avsnitt         löpande numrering, avsnittsGrupper, och att elevsparning,
//                   rättning, statistik, CSV, pluggmynt och redigeraren hoppar
//                   över avsnitten
//   kriterier       fritextens poängkriterier → privat/facit, aldrig till eleven
//   gamla prov      heltal, inga avsnitt, inga nya fält: som förut
// Ren Node: node --test test/prov-poang-avsnitt.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  arGiltigMaxpoang, delpoangNed, franHalvor, halvor, klamPoang, poangAv, poangP, poangTal, summaPoang,
} from "../src/prov/prov-poang.js";
import { arAvsnitt, arFraga, fragetyp } from "../src/prov/prov-fragetyper.js";
import {
  autoForslag, avsnittsGrupper, besvarat, delaUppProv, fragaNummer, maxPoang, rensaSvar, tomtSvar,
} from "../src/prov/prov-modell.js";
import { STANDARD_INSTALLNINGAR, tillfalleInstallningar, validateProv } from "../src/prov/prov-validera.js";
import {
  aterlamnadDok, angratDok, bedom, elevStatus, nyRattning, rattFragor, resultatModell, sparDok, summera, tolkaPoang,
} from "../src/prov/prov-rattning-logik.js";
import { andelFor, klassOversikt, totalText } from "../src/prov/prov-statistik.js";
import { resultatCsv } from "../src/prov/prov-statistik-fordjupad.js";
import { provMyntBelopp } from "../src/prov/prov-mynt.js";
import { avsnittSummor, fragaRubrik, provSumma, sparaFraga, nyttProv, flyttaFraga } from "../src/prov/prov-redigera-ops.js";
import { buildProvPrompt } from "../src/prov/prov-prompt.js";

describe("poäng-kärnan (prov-poang.js, §2.2)", () => {
  it("summor av halvpoäng är exakta: 3,5 + 4 + 0,5 = 8", () => {
    assert.equal(summaPoang([3.5, 4, 0.5]), 8);
    assert.equal(summaPoang(Array(35).fill(0.5)), 17.5);
    assert.equal(summaPoang([1.4999999, 2.0000001]), 3.5, "varje poäng räknas i halva poäng – brus försvinner");
    assert.equal(summaPoang([2, "1,5", null, undefined, NaN, "x"]), 2, "ogiltigt = 0 (text med komma räknas inte)");
    assert.equal(summaPoang([]), 0);
    assert.equal(halvor(3.5), 7);
    assert.equal(franHalvor(7), 3.5);
  });
  it("automatikens delpoäng avrundas NEDÅT till 0,5", () => {
    assert.equal(delpoangNed(3 / 5, 2), 1, "para 2 p, 3 av 5 → 1,2 → 1");
    assert.equal(delpoangNed(2 / 3, 3), 2);
    assert.equal(delpoangNed(1 / 3, 3), 1, "flyttalsbruset (0,9999…) tippar inte nedåt");
    assert.equal(delpoangNed(0.7, 1), 0.5);
    assert.equal(delpoangNed(0.49, 1), 0);
    assert.equal(delpoangNed(0.5, 1.5), 0.5);
    assert.equal(delpoangNed(1, 3.5), 3.5);
    assert.equal(delpoangNed(1.4, 2), 2, "andelen kläms till 0–1");
    assert.equal(delpoangNed(-1, 2), 0);
  });
  it("lärarens poäng kläms till 0 … max i steg om 0,5", () => {
    assert.equal(klamPoang(3.7, 4), 3.5);
    assert.equal(klamPoang(3.8, 4), 4);
    assert.equal(klamPoang(9, 4), 4);
    assert.equal(klamPoang(-2, 4), 0);
    assert.equal(tolkaPoang("3,5", 4), 3.5);
    assert.equal(tolkaPoang("5", 4), 4);
    assert.equal(tolkaPoang("", 4), null);
  });
  it("frågans maxpoäng: 0,5–20 i steg om 0,5 (gamla heltal giltiga)", () => {
    for (const p of [0.5, 1, 1.5, 4, 19.5, 20]) assert.ok(arGiltigMaxpoang(p), String(p));
    for (const p of [0, 0.25, 1.2, 20.5, 25, 100, -1, "1", null, NaN, Infinity]) assert.ok(!arGiltigMaxpoang(p), String(p));
  });
  it("decimalkomma överallt: \"3,5 p\", \"17,5 av 24 poäng\"", () => {
    assert.equal(poangTal(3.5), "3,5");
    assert.equal(poangTal(4), "4");
    assert.equal(poangP(0.5), "0,5 p");
    assert.equal(poangAv(17.5, 24), "17,5 av 24 poäng");
    assert.equal(poangTal(17.499999999), "17,5");
    assert.equal(totalText({ andel: 0.75, poang: 7.5, max: 10 }, true), "7,5/10 · 75 %");
  });
  it("frågetyperna ger delpoäng nedåt (para 2 p, 3 av 5 rätt → 1 p)", () => {
    const t = fragetyp("para");
    const f = t.validera({
      id: "p", typ: "para", fraga: "Para", poang: 2,
      par: ["a", "b", "c", "d", "e"].map((v, i) => ({ vanster: v, hoger: `H${i}` })),
    }).value;
    const svar = ["H0", "H1", "H2", "H4", "H3"];
    assert.deepEqual(t.forslag(svar, t.facit(f), t.utanFacit(f)), { poang: 1, maxPoang: 2, ratt: "delvis" });
  });
});

// Ett prov med avsnitt: Del 1 (2 frågor + textblock), Del 2 (1 fritext), halvpoäng.
const PROV = validateProv({
  namn: "Vikingaprovet",
  fragor: [
    { id: "q0", typ: "santfalskt", fraga: "Före första avsnittet.", ratt: true, poang: 0.5 },
    { id: "a1", typ: "avsnitt", titel: "Del 1 – Begrepp", instruktion: "Svara kort." },
    { id: "q1", typ: "flerval", fraga: "Var låg Birka?", alternativ: ["Björkö", "Gotland"], ratt: 0, poang: 1.5 },
    { id: "t1", typ: "text", titel: "Källan", brodtext: "Birka låg på Björkö." },
    { id: "q2", typ: "kortsvar", fraga: "Ön?", godkanda: ["Björkö"], poang: 2 },
    { id: "a2", typ: "avsnitt", titel: "Del 2 – Skriv och förklara" },
    { id: "q3", typ: "fritext", fraga: "Varför?", poang: 4, kriterier: ["1 p: en orsak", "+1 p: förklarar"] },
  ],
}).value;

describe("avsnitt (§2.3)", () => {
  it("är en typ i registret utan fråga, poäng och svar", () => {
    const t = fragetyp("avsnitt");
    assert.equal(t.arFraga, false);
    assert.equal(t.autoratt, false);
    assert.equal(arFraga({ typ: "avsnitt" }), false);
    assert.equal(arAvsnitt({ typ: "avsnitt" }), true);
    assert.equal(arAvsnitt({ typ: "text" }), false);
    const v = t.validera({ typ: "avsnitt", titel: "  Del 1 ", instruktion: " ", poang: 5, fraga: "x" }).value;
    assert.deepEqual(v, { typ: "avsnitt", titel: "Del 1" }, "ingen poäng, ingen frågetext, tom instruktion bort");
  });
  it("frågorna numreras löpande genom hela provet (avsnitt och text utan nummer)", () => {
    assert.deepEqual(fragaNummer(PROV.fragor), { q0: 1, q1: 2, q2: 3, q3: 4 });
  });
  it("avsnittsGrupper: en grupp per avsnitt, poster före första i en grupp utan avsnitt", () => {
    const g = avsnittsGrupper(PROV.fragor);
    assert.deepEqual(g.map((x) => x.avsnitt?.id ?? null), [null, "a1", "a2"]);
    assert.deepEqual(g.map((x) => x.fragor.map((f) => f.id)), [["q0"], ["q1", "q2"], ["q3"]]);
    assert.deepEqual(g[1].poster.map((f) => f.id), ["q1", "t1", "q2"]);
    assert.deepEqual(g.map((x) => x.maxPoang), [0.5, 3.5, 4]);
    // Inget före första avsnittet → ingen tom grupp; inga avsnitt → en grupp som förr.
    assert.deepEqual(avsnittsGrupper(PROV.fragor.slice(1)).map((x) => x.avsnitt?.id ?? null), ["a1", "a2"]);
    const utan = avsnittsGrupper(PROV.fragor.filter((f) => f.typ !== "avsnitt"));
    assert.equal(utan.length, 1);
    assert.equal(utan[0].avsnitt, null);
    assert.equal(utan[0].fragor.length, 4);
    assert.deepEqual(avsnittsGrupper([]), [{ avsnitt: null, poster: [], fragor: [], maxPoang: 0 }]);
    assert.equal(avsnittsGrupper([{ id: "a", typ: "avsnitt", titel: "Tom" }])[0].fragor.length, 0);
  });
  it("maxpoängen hoppar över avsnitten och summeras exakt: 0,5 + 1,5 + 2 + 4 = 8", () => {
    assert.equal(maxPoang(PROV.fragor), 8);
  });
  it("elevsparningen: inget svar för avsnitt, obesvarade-räkningen påverkas inte", () => {
    const { fragor } = delaUppProv(PROV);
    const tom = tomtSvar(fragor);
    assert.ok(!("a1" in tom) && !("a2" in tom));
    assert.deepEqual(Object.keys(rensaSvar({ a1: "x", q1: 0, q3: "Svar" }, fragor)).sort(), ["q1", "q3"]);
    assert.deepEqual(besvarat(fragor, { q1: 0, q3: "Svar" }), { besvarade: 2, antal: 4, obesvarade: [1, 3] });
  });
  it("delaUppProv: avsnittet följer med till eleven, kriterierna till privat/facit", () => {
    const { fragor, facit, bedomningsstod, kriterier } = delaUppProv(PROV);
    assert.deepEqual(fragor.find((f) => f.id === "a1"), { id: "a1", typ: "avsnitt", titel: "Del 1 – Begrepp", instruktion: "Svara kort." });
    assert.ok(!("a1" in facit));
    assert.deepEqual(kriterier, { q3: ["1 p: en orsak", "+1 p: förklarar"] });
    assert.deepEqual(bedomningsstod, {});
    assert.ok(!JSON.stringify(fragor).includes("en orsak"), "kriterierna når aldrig eleven");
  });
  it("rättning och statistik hoppar över avsnitten", () => {
    const { fragor, facit } = delaUppProv(PROV);
    assert.deepEqual(rattFragor(fragor).map((f) => f.id), ["q0", "q1", "q2", "q3"]);
    const forslag = autoForslag(fragor, { q0: true, q1: 0, q2: "björkö" }, facit);
    assert.deepEqual(Object.keys(forslag).sort(), ["q0", "q1", "q2"]);
    let r = nyRattning({ elevId: "e1", classId: "k", provNamn: "x", fragor, svar: { q0: true, q1: 0, q2: "björkö", q3: "Handel" }, facit });
    assert.ok(!("a1" in r.fragor) && !("a2" in r.fragor));
    for (const f of rattFragor(fragor)) r = bedom(r, f, { ratt: true }, fragor);
    r = bedom(r, fragor.find((f) => f.id === "q3"), { poang: 3.5 }, fragor);
    assert.equal(elevStatus(r, fragor), "rattad");
    assert.equal(summera(r, fragor).totalPoang, 7.5);
    assert.equal(sparDok(r, fragor).maxPoang, 8);
    const res = andelFor(r, fragor, true);
    assert.equal(res.poang, 7.5);
    assert.equal(res.antal, 4);
    const m = klassOversikt({ fragor, med: ["e1"], svarAv: () => undefined, rattningar: { e1: r }, installningar: {} });
    assert.equal(m.rader[0].celler.length, 4);
    assert.deepEqual(m.fragaSumma.map((s) => s.nr), [1, 2, 3, 4]);
    const csv = resultatCsv({ fragor, med: ["e1"], namn: { e1: "Alva" }, rattningar: { e1: r }, installningar: {} });
    const [huvud, rad] = csv.replace(/^﻿/, "").split("\r\n");
    assert.equal(huvud, "Elev;Fråga 1 (0,5 p);Fråga 2 (1,5 p);Fråga 3 (2 p);Fråga 4 (4 p);Poäng;Av (rättade);Procent;Färg;Nivå;Status");
    assert.match(rad, /^Alva;0,5;1,5;2;3,5;7,5;8;/);
    // Resultatvyn: avsnittet har inget nummer och ingen post.
    const tf = { fragor, installningar: { poang: true }, provNamn: "x" };
    const modell = resultatModell(tf, { svar: {} }, { ...r, aterlamnad: true });
    assert.deepEqual(modell.poster.filter((p) => p.fraga.typ === "avsnitt").map((p) => [p.nr, p.post]), [[null, null], [null, null]]);
    assert.equal(modell.totalPoang, 7.5);
    // Pluggmynt per poäng räknar på totalen (halvpoäng avrundas nedåt).
    assert.equal(provMyntBelopp({ poang: true, mynt: { typ: "poang", antal: 1 } }, { aterlamnad: true, totalPoang: 7.5 }, { inlamnad: true }), 7);
  });
  it("redigeraren: \"12 frågor · 32 p\" överst och poängsumma per avsnitt", () => {
    assert.equal(provSumma(PROV.fragor, true), "4 frågor · 8 p");
    assert.equal(provSumma(PROV.fragor, false), "4 frågor");
    assert.equal(provSumma([], true), "0 frågor");
    assert.deepEqual(avsnittSummor(PROV.fragor), { a1: { antal: 2, poang: 3.5 }, a2: { antal: 1, poang: 4 } });
    assert.equal(fragaRubrik(PROV.fragor[2]), "2 alternativ · rätt: Björkö · 1,5 p");
    assert.match(fragaRubrik(PROV.fragor[1]), /Instruktion: Svara kort\./);
    assert.match(fragaRubrik(PROV.fragor[6]), /2 poängkriterier · 4 p$/);
    // Avsnitt läggs till som en "fråga" och flyttas som de andra korten.
    let p = sparaFraga(nyttProv(), null, "kortsvar", { fraga: "Ön?", poang: "1,5", godkanda: "Björkö" }).prov;
    p = sparaFraga(p, null, "avsnitt", { titel: "Del 1", instruktion: "" }).prov;
    assert.deepEqual(p.fragor[1], { id: "f2", typ: "avsnitt", titel: "Del 1" });
    p = flyttaFraga(p, 1, -1);
    assert.deepEqual(p.fragor.map((f) => f.typ), ["avsnitt", "kortsvar"]);
    assert.equal(p.fragor[1].poang, 1.5);
  });
  it("validateProv: avsnitten numreras för sig, räknas inte som frågor", () => {
    const r = validateProv({ namn: "x", fragor: [{ typ: "avsnitt", titel: "" }, { typ: "kortsvar", fraga: "?", godkanda: ["a"], poang: 0.3 }] });
    assert.deepEqual(r.errors, [
      'Avsnitt 1 (Avsnitt): rubriken ("titel") saknas eller är tom.',
      'Fråga 1 (Kort svar): poängen ("poang") måste vara 0,5–20 i steg om 0,5.',
    ]);
    assert.match(validateProv({ namn: "x", fragor: [{ typ: "avsnitt", titel: "Del 1" }] }).errors[0], /minst en fråga krävs \(textblock och avsnitt räknas inte\)/);
  });
  it("AI-prompten känner avsnitt, kriterier och halvpoäng", () => {
    const p = buildProvPrompt({ typer: ["avsnitt", "fritext"], antal: 3 });
    assert.match(p, /"avsnitt" \(Avsnitt\): INGEN fråga/);
    assert.match(p, /"kriterier"/);
    assert.match(p, /0\.5–20 i steg om 0\.5/);
    assert.match(p, /avsnitt räknas inte som frågor/);
    const ex = JSON.parse(p.slice(p.indexOf("{\n"), p.indexOf("\n}\n") + 2));
    assert.equal(ex.fragor[0].typ, "avsnitt", "avsnittet inleder exemplet");
    assert.ok(validateProv(ex).ok, validateProv(ex).errors.join("; "));
  });
});

describe("kriterier och visaKriterier (§2.2)", () => {
  it("visaKriterier är av och visaPoangForElev på som standard; tillfället får dem", () => {
    assert.equal(STANDARD_INSTALLNINGAR.visaPoangForElev, true);
    assert.equal(STANDARD_INSTALLNINGAR.visaKriterier, false);
    assert.equal(PROV.installningar.visaPoangForElev, true);
    const ins = tillfalleInstallningar({ poang: true });
    assert.equal(ins.visaPoangForElev, true);
    assert.equal(ins.visaKriterier, false);
    const r = validateProv({ namn: "x", installningar: { visaPoangForElev: false, visaKriterier: true }, fragor: [PROV.fragor[0]] });
    assert.equal(r.value.installningar.visaPoangForElev, false);
    assert.equal(r.value.installningar.visaKriterier, true);
    assert.match(validateProv({ namn: "x", installningar: { visaPoangForElev: "nej" }, fragor: [PROV.fragor[0]] }).errors[0], /"visaPoangForElev" måste vara true eller false/);
  });
  it("tillbakalämningen kopierar kriterierna bara när de skickas; ångra tar bort dem", () => {
    const r = { elevId: "e", classId: "k", fragor: {}, aterlamnad: false };
    const k = { q3: ["1 p: en orsak"] };
    assert.deepEqual(aterlamnadDok(r, { visaFacit: false, facit: {}, kriterier: k }).kriterier, k);
    assert.ok(!("kriterier" in aterlamnadDok(r, { visaFacit: false, facit: {} })));
    assert.ok(!("kriterier" in aterlamnadDok(r, { visaFacit: false, facit: {}, kriterier: {} })));
    assert.ok(!("kriterier" in angratDok({ ...r, aterlamnad: true, kriterier: k })));
    assert.ok(!("kriterier" in sparDok({ ...r, kriterier: k }, [])), "aldrig i en ej tillbakalämnad rättning");
    assert.deepEqual(sparDok({ ...r, aterlamnad: true, kriterier: k }, []).kriterier, k);
  });
});

describe("gamla prov (heltal, inga avsnitt, inga nya fält)", () => {
  const GAMMALT = {
    namn: "Etapp 1-prov",
    installningar: { poang: true, nivaer: false, visaFacit: true, stavningskontroll: false, tidsgransMin: null },
    fragor: [
      { id: "f1", typ: "flerval", fraga: "A?", alternativ: ["x", "y"], ratt: 0, poang: 1 },
      { id: "f2", typ: "text", titel: "T", brodtext: "Text." },
      { id: "f3", typ: "fritext", fraga: "B?", poang: 4, bedomningsstod: "Stöd" },
      { id: "f4", typ: "ordna", fraga: "C?", saker: ["1", "2", "3", "4"], poang: 4 },
    ],
  };
  it("valideras med samma frågor och poäng", () => {
    const r = validateProv(structuredClone(GAMMALT));
    assert.ok(r.ok, r.errors.join("; "));
    assert.deepEqual(r.value.fragor, GAMMALT.fragor);
  });
  it("delas, numreras och summeras som förut (en grupp, inga kriterier)", () => {
    const { fragor, facit, bedomningsstod, kriterier } = delaUppProv(GAMMALT);
    assert.deepEqual(fragaNummer(fragor), { f1: 1, f3: 2, f4: 3 });
    assert.equal(maxPoang(fragor), 9);
    assert.deepEqual(kriterier, {});
    assert.deepEqual(bedomningsstod, { f3: "Stöd" });
    assert.deepEqual(Object.keys(facit).sort(), ["f1", "f4"]);
    assert.equal(avsnittsGrupper(fragor).length, 1);
    // Heltalsdelpoäng som förut: ordna 4 p, 2 av 4 rätt → 2.
    const t = fragetyp("ordna");
    const f4 = fragor.find((f) => f.id === "f4");
    assert.deepEqual(t.forslag(["1", "2", "4", "3"], facit.f4, f4), { poang: 2, maxPoang: 4, ratt: "delvis" });
  });
});
