// ============================================================================
// Prov 3A (#762) – testarens kantfall utöver test/prov-poang-avsnitt.test.js:
//   poäng-kärnan    flyttalsbrus, ogiltiga värden, stora summor, decimalkomma
//   validering      "3,5" som text, gränserna 0 / 0,5 / 20 / 20,5, avsnittets
//                   fält, kriteriernas gränser och att andra typer tappar dem
//   avsnitt         grupper i början/slutet/i följd, textblock före första,
//                   löpande numrering i felen, konsumenterna (översikten,
//                   tillbakalämningsplanen, elevsparningen, AI-inklistringen,
//                   duplicera/kopiera)
//   gamla prov      delpoängen nedåt är den ENDA ändringen i förslagen
//   rättningsvyn    snabbknapparna med halvpoängsmax (todo – #764 §6.1)
// Ren Node: node --test test/prov-762-kantfall.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  arGiltigMaxpoang, delpoangNed, halvor, klamPoang, poangAv, poangP, poangTal, summaPoang,
} from "../src/prov/prov-poang.js";
import { fragetyp } from "../src/prov/prov-fragetyper.js";
import { avsnittsGrupper, delaUppProv, fragaNummer, maxPoang, rensaSvar, tomtSvar } from "../src/prov/prov-modell.js";
import { validateProv } from "../src/prov/prov-validera.js";
import { aterlamnaPlan, godkannAlla, nyRattning, rattFor, summera, tolkaPoang } from "../src/prov/prov-rattning-logik.js";
import { oversiktRader } from "../src/prov/prov-tillfalle-logik.js";
import {
  dupliceraFraga, fyllFranAi, kopieraProv, nyttProv, provFranDok, provSumma, sparaFraga, tolkaAiJson,
} from "../src/prov/prov-redigera-ops.js";
import { snabbPoang } from "../src/prov/prov-ratta-kort.js";

const KS = (id, poang, extra = {}) => ({ id, typ: "kortsvar", fraga: `Fråga ${id}?`, godkanda: ["Birka"], poang, ...extra });
const AV = (id, titel = `Del ${id}`, extra = {}) => ({ id, typ: "avsnitt", titel, ...extra });
const TX = (id) => ({ id, typ: "text", titel: "Text", brodtext: "Birka var en stad." });

describe("poäng-kärnan – kantfall (#762)", () => {
  it("flyttalsbrus tippar aldrig avrundningen nedåt", () => {
    assert.equal(delpoangNed(0.7, 10), 7); // 0.7 × 20 = 13.999999999999998
    assert.equal(delpoangNed(1 / 3, 3), 1);
    assert.equal(delpoangNed(2 / 3, 1.5), 1);
    assert.equal(delpoangNed(3 / 10, 10), 3);
    assert.equal(delpoangNed(0.29, 100), 29);
    assert.equal(delpoangNed(4 / 7, 7), 4);
  });
  it("delpoäng: andelen kläms 0–1, max 0/ogiltig ger 0", () => {
    assert.equal(delpoangNed(1.5, 4), 4);
    assert.equal(delpoangNed(-1, 4), 0);
    assert.equal(delpoangNed(NaN, 4), 0);
    assert.equal(delpoangNed(0.5, 0), 0);
    assert.equal(delpoangNed(0.5, undefined), 0);
    assert.equal(delpoangNed(0.99, 0.5), 0); // under hela → 0, aldrig uppåt
    assert.equal(delpoangNed(1, 0.5), 0.5);
  });
  it("klämning: negativt → 0, över max → max, kvartar till närmaste halva", () => {
    assert.equal(klamPoang(-3, 4), 0);
    assert.equal(klamPoang(9, 3.5), 3.5);
    assert.equal(klamPoang(0.25, 4), 0.5);
    assert.equal(klamPoang(0.24, 4), 0);
    assert.equal(klamPoang("2,5", 4), 0, "text med komma tolkas av tolkaPoang, inte här");
    assert.equal(klamPoang(NaN, 4), 0);
    assert.equal(tolkaPoang("2,5", 4), 2.5);
    assert.equal(tolkaPoang(" 3.75 ", 4), 4);
    assert.equal(tolkaPoang("-1", 4), 0);
    assert.equal(tolkaPoang("", 4), null);
    assert.equal(tolkaPoang("abc", 4), null);
  });
  it("summor: tusen halvor, ogiltiga värden = 0, text med punkt räknas", () => {
    assert.equal(summaPoang(Array(1000).fill(0.5)), 500);
    assert.equal(summaPoang(Array(35).fill(0.1 + 0.2 + 0.2)), 17.5, "0.5000000000000001 räknas som 0,5");
    assert.equal(summaPoang([3.5, null, undefined, "x", NaN, 4, "0.5"]), 8);
    assert.equal(summaPoang(null), 0);
    assert.equal(halvor(Infinity), 0);
  });
  it("decimalkomma: aldrig punkt, aldrig -0, aldrig långa decimaler", () => {
    assert.equal(poangTal(-0), "0");
    assert.equal(poangTal(0.1 + 0.2 + 0.2), "0,5");
    assert.equal(poangTal(17.499999), "17,5");
    assert.equal(poangTal(20), "20");
    assert.equal(poangTal(undefined), "0");
    assert.equal(poangP(0.5), "0,5 p");
    assert.equal(poangAv(0, 0.5), "0 av 0,5 poäng");
    for (let n = 0; n <= 40; n++) assert.doesNotMatch(poangTal(n / 2), /\./);
  });
  it("giltig maxpoäng: bara tal, 0,5–20 i steg om 0,5", () => {
    for (const ok of [0.5, 1, 3.5, 19.5, 20]) assert.ok(arGiltigMaxpoang(ok), String(ok));
    for (const nej of [0, -0.5, 0.25, 20.5, 21, 100, NaN, Infinity, "3.5", "1", null, true]) assert.ok(!arGiltigMaxpoang(nej), String(nej));
  });
});

describe("validering – kantfall (#762, §2.5)", () => {
  const poangFel = (poang) => validateProv({ namn: "x", fragor: [KS("q1", poang)] });
  it("text med decimalkomma eller -punkt godtas och lagras som tal", () => {
    assert.equal(poangFel("3,5").value.fragor[0].poang, 3.5);
    assert.equal(poangFel(" 2.5 ").value.fragor[0].poang, 2.5);
    assert.equal(poangFel("20").value.fragor[0].poang, 20);
    assert.equal(poangFel(null).value.fragor[0].poang, 1, "saknas → standard 1");
    assert.equal(poangFel("").value.fragor[0].poang, 1);
  });
  it("gränserna: 0, 20,5, 0,25, negativt och skräp nekas", () => {
    for (const p of [0, 20.5, 0.25, -1, "abc", "3,25", 100, true]) {
      const r = poangFel(p);
      assert.equal(r.ok, false, `poang ${JSON.stringify(p)} ska nekas`);
      assert.match(r.errors[0], /^Fråga 1 \(Kort svar\): poängen \("poang"\) måste vara 0,5–20 i steg om 0,5\.$/);
    }
  });
  it("avsnittet tappar fråge-/poängfält och har gränser på rubrik och instruktion", () => {
    const r = validateProv({ namn: "x", fragor: [AV("a1", "  Del 1  ", { poang: 5, fraga: "?", hjalptext: "h", instruktion: "  " }), KS("q1", 1)] });
    assert.ok(r.ok, r.errors.join("; "));
    assert.deepEqual(r.value.fragor[0], { id: "a1", typ: "avsnitt", titel: "Del 1" });
    assert.equal(maxPoang(r.value.fragor), 1);
    const lang = validateProv({ namn: "x", fragor: [AV("a1", "D", { instruktion: "x".repeat(1001) }), KS("q1", 1)] });
    assert.match(lang.errors.join(), /Avsnitt 1 \(Avsnitt\): instruktionen är för lång \(högst 1000 tecken\)/);
    const ok = validateProv({ namn: "x", fragor: [AV("a1", "D", { instruktion: "x".repeat(1000) }), KS("q1", 1)] });
    assert.ok(ok.ok);
  });
  it("felen numrerar frågorna löpande och avsnitten för sig", () => {
    const r = validateProv({ namn: "x", fragor: [AV("a1"), KS("q1", 1), TX("t1"), AV("a2", ""), KS("q2", 0), AV("a3"), KS("q3", 25)] });
    assert.deepEqual(r.errors, [
      'Avsnitt 2 (Avsnitt): rubriken ("titel") saknas eller är tom.',
      'Fråga 2 (Kort svar): poängen ("poang") måste vara 0,5–20 i steg om 0,5.',
      'Fråga 3 (Kort svar): poängen ("poang") måste vara 0,5–20 i steg om 0,5.',
    ]);
  });
  it("kriterier: 20 går, 21 nekas, tomma rader bort, tom lista = inget fält", () => {
    const fx = (kriterier) => validateProv({ namn: "x", fragor: [{ id: "q1", typ: "fritext", fraga: "Varför?", poang: 4, kriterier }] });
    assert.ok(fx(Array.from({ length: 20 }, (_, i) => `k${i}`)).ok);
    assert.match(fx(Array.from({ length: 21 }, (_, i) => `k${i}`)).errors[0], /högst 20 poängkriterier \(nu 21\)/);
    assert.deepEqual(fx(["  a ", "", "   ", "b"]).value.fragor[0].kriterier, ["a", "b"]);
    assert.ok(!("kriterier" in fx([]).value.fragor[0]));
    assert.ok(!("kriterier" in fx(["", " "]).value.fragor[0]));
    assert.match(fx("1 p: en orsak").errors[0], /"kriterier" måste vara en lista med texter/);
    assert.match(fx(["a", 3]).errors[0], /"kriterier" får bara innehålla texter/);
    assert.match(fx(["x".repeat(301)]).errors[0], /poängkriterium 1 är för långt/);
  });
  it("kriterier på en annan typ än fritext följer inte med (varken till provet eller privat/facit)", () => {
    const r = validateProv({ namn: "x", fragor: [KS("q1", 1, { kriterier: ["hemligt"] })] });
    assert.ok(r.ok);
    assert.ok(!JSON.stringify(r.value).includes("hemligt"));
    assert.deepEqual(delaUppProv(r.value).kriterier, {});
  });
});

describe("avsnittsGrupper – kantfall (#762)", () => {
  it("tomt prov: en grupp utan avsnitt", () => {
    assert.deepEqual(avsnittsGrupper([]), [{ avsnitt: null, poster: [], fragor: [], maxPoang: 0 }]);
    assert.deepEqual(avsnittsGrupper(undefined), [{ avsnitt: null, poster: [], fragor: [], maxPoang: 0 }]);
  });
  it("avsnitt först: ingen tom grupp före; avsnitt sist och i följd: tomma grupper med 0 p", () => {
    const g = avsnittsGrupper([AV("a1"), KS("q1", 1.5), AV("a2"), AV("a3"), KS("q2", 2.5), KS("q3", 0.5), AV("a4")]);
    assert.deepEqual(g.map((x) => [x.avsnitt?.id ?? null, x.fragor.map((f) => f.id), x.maxPoang]), [
      ["a1", ["q1"], 1.5], ["a2", [], 0], ["a3", ["q2", "q3"], 3], ["a4", [], 0],
    ]);
  });
  it("textblock före första avsnittet: en grupp utan avsnitt med posten men inga frågor", () => {
    const g = avsnittsGrupper([TX("t1"), AV("a1"), TX("t2"), KS("q1", 1)]);
    assert.equal(g.length, 2);
    assert.deepEqual([g[0].avsnitt, g[0].poster.map((p) => p.id), g[0].fragor], [null, ["t1"], []]);
    assert.deepEqual([g[1].poster.map((p) => p.id), g[1].fragor.map((f) => f.id)], [["t2", "q1"], ["q1"]]);
  });
  it("summan av gruppernas max = provets max; numreringen löper över avsnitten", () => {
    const fr = [KS("q0", 0.5), AV("a1"), KS("q1", 3.5), TX("t1"), KS("q2", 4), AV("a2"), KS("q3", 0.5), KS("q4", 19.5)];
    assert.equal(summaPoang(avsnittsGrupper(fr).map((g) => g.maxPoang)), maxPoang(fr));
    assert.equal(maxPoang(fr), 28);
    assert.deepEqual(fragaNummer(fr), { q0: 1, q1: 2, q2: 3, q3: 4, q4: 5 });
    assert.equal(provSumma(fr), "5 frågor · 28 p");
  });
});

describe("avsnitt i konsumenterna – kantfall (#762)", () => {
  const fr = delaUppProv(validateProv({ namn: "x", fragor: [AV("a1"), KS("q1", 1.5), AV("a2", "Del 2", { instruktion: "Läs." }), KS("q2", 2)] }).value).fragor;
  const facit = { q1: { godkanda: ["Birka"] }, q2: { godkanda: ["Birka"] } };
  it("elevsparningen: inget tomt svar för avsnitt, ett inskickat avsnitts-svar rensas bort", () => {
    assert.deepEqual(Object.keys(tomtSvar(fr)), ["q1", "q2"]);
    assert.deepEqual(rensaSvar({ a1: "hack", q1: "Birka", a2: null }, fr), { q1: "Birka" });
  });
  it("lärarens översikt: antal frågor räknar inte avsnitten", () => {
    const [rad] = oversiktRader([{ id: "e1", namn: "Alva" }], { e1: { svar: { q1: "Birka" }, inlamnad: false, startad: 0 } }, { fragor: fr, tidsgransMin: null }, 0);
    assert.deepEqual([rad.besvarade, rad.antal], [1, 2]);
  });
  it("tillbakalämningsplanen: en fullt rättad elev är klar trots avsnitten", () => {
    const r = godkannAlla(nyRattning({ elevId: "e1", classId: "k", provNamn: "x", fragor: fr, svar: { q1: "Birka", q2: "Paris" }, facit }), fr);
    assert.deepEqual(Object.keys(r.fragor).sort(), ["q1", "q2"]);
    assert.deepEqual(aterlamnaPlan(["e1"], { e1: r }, fr).klara, ["e1"]);
    assert.deepEqual([summera(r, fr).totalPoang, summera(r, fr).maxPoang], [1.5, 3.5]);
  });
  it("redigeraren: duplicera ett avsnitt ger nytt id; kopiera/öppna ett prov behåller avsnitten", () => {
    const p = { ...nyttProv(), fragor: [AV("f1", "Del 1", { instruktion: "Läs." }), KS("f2", 1.5)] };
    const d = dupliceraFraga(p, 0);
    assert.deepEqual(d.fragor.map((f) => [f.id, f.typ]), [["f1", "avsnitt"], ["f3", "avsnitt"], ["f2", "kortsvar"]]);
    assert.equal(d.fragor[1].instruktion, "Läs.");
    assert.deepEqual(kopieraProv({ namn: "P", fragor: p.fragor }).fragor, p.fragor);
    assert.equal(provFranDok({ namn: "P", fragor: p.fragor }).installningar.visaPoangForElev, true);
  });
  it("redigeraren: ett avsnitt utan rubrik nekas i formuläret", () => {
    const r = sparaFraga(nyttProv(), null, "avsnitt", { titel: "  ", instruktion: "x" });
    assert.equal(r.ok, false);
    assert.match(r.errors[0], /^Rubriken \("titel"\) saknas eller är tom\.$/);
  });
  it("redigeraren: poäng i formuläret – \"0,5\" och \"20\" går, \"0\" och \"20,5\" nekas", () => {
    const spara = (poang) => sparaFraga(nyttProv(), null, "kortsvar", { fraga: "?", poang, godkanda: "Birka" });
    assert.equal(spara("0,5").prov.fragor[0].poang, 0.5);
    assert.equal(spara("20").prov.fragor[0].poang, 20);
    assert.equal(spara("").prov.fragor[0].poang, 1);
    for (const p of ["0", "20,5", "1,25", "?"]) assert.equal(spara(p).ok, false, p);
  });
  it("AI-inklistringen: avsnitt + halvpoäng (tal och text) läggs till sist", () => {
    const json = JSON.stringify({ namn: "AI", fragor: [AV("x1", "Del A"), { typ: "kortsvar", fraga: "Ön?", godkanda: ["Björkö"], poang: 2.5 }, { typ: "fritext", fraga: "Varför?", poang: "3,5", kriterier: ["1 p: orsak"] }] });
    const t = tolkaAiJson(json);
    assert.ok(t.ok, t.errors.join("; "));
    const r = fyllFranAi({ ...nyttProv(), fragor: [KS("f1", 1)] }, t.value);
    assert.ok(r.ok, (r.errors || []).join("; "));
    assert.deepEqual(r.prov.fragor.map((f) => [f.typ, f.poang ?? null]), [["kortsvar", 1], ["avsnitt", null], ["kortsvar", 2.5], ["fritext", 3.5]]);
    assert.equal(provSumma(r.prov.fragor), "3 frågor · 7 p");
    assert.match(tolkaAiJson(JSON.stringify({ namn: "AI", fragor: [{ typ: "kortsvar", fraga: "?", godkanda: ["a"], poang: 0.75 }] })).errors.join(), /0,5–20 i steg om 0,5/);
  });
});

describe("gamla prov: delpoängen nedåt är den enda ändringen (#762)", () => {
  it("ordna 2 p, 2 av 5 på rätt plats → 0,5 p (förr 1 p); para 5 p, 1 av 3 → 1,5 p (som förr)", () => {
    const ordna = fragetyp("ordna");
    const f = ordna.validera({ id: "q1", typ: "ordna", fraga: "Ordna.", saker: ["A", "B", "C", "D", "E"], poang: 2 }).value;
    const fs = ordna.forslag(["A", "B", "E", "C", "D"], ordna.facit(f), ordna.utanFacit(f));
    assert.equal(fs.poang, 0.5);
    const para = fragetyp("para");
    const p = para.validera({ id: "q2", typ: "para", fraga: "Para.", poang: 5, par: [{ vanster: "Tor", hoger: "Åska" }, { vanster: "Oden", hoger: "Visdom" }, { vanster: "Freja", hoger: "Kärlek" }] }).value;
    const pe = para.utanFacit(p);
    const ps = para.forslag(pe.vanster.map((v) => ({ Tor: "Åska", Oden: "Kärlek", Freja: "Visdom" })[v]), para.facit(p), pe);
    assert.equal(ps.poang, 1.5);
  });
  it("ett delvis-förslag kan bli 0 p (ordna 2 p, 1 av 5) – markeringen följer andelen, poängen nedåt", () => {
    const ordna = fragetyp("ordna");
    const f = ordna.validera({ id: "q1", typ: "ordna", fraga: "Ordna.", saker: ["A", "B", "C", "D", "E"], poang: 2 }).value;
    const fs = ordna.forslag(["A", "C", "D", "E", "B"], ordna.facit(f), ordna.utanFacit(f));
    assert.deepEqual([fs.poang, fs.ratt], [0, "delvis"]);
    assert.equal(rattFor(fs.poang, 2), false, "lärarens poäng 0 skulle betyda fel");
  });
});

describe("rättningsvyns snabbknappar med halvpoängsmax (#764 §6.1)", () => {
  it("heltalsmax som förr", () => {
    assert.deepEqual(snabbPoang(0), []);
    assert.deepEqual(snabbPoang(3), [0, 1, 2, 3]);
    assert.deepEqual(snabbPoang(8), [0, 4, 8]);
  });
  it("maxpoängen finns alltid som knapp (0,5 → [0, 0,5]; 3,5 → … 3,5)", { todo: "F1: snabbPoang(3.5) = [0,1,2,3], snabbPoang(0.5) = [0] – #764 bygger om knapparna (0, ½, 1 … max)" }, () => {
    for (const max of [0.5, 1.5, 3.5, 5.5]) assert.equal(snabbPoang(max).at(-1), max, `max ${max}`);
  });
});
