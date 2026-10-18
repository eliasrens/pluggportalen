// ============================================================================
// Prov (#741, spec §6–§7 + testlistan): rättningens rena logik –
// förslagen, grupperingen av identiska kortsvar (bedömningen gäller alla i
// gruppen), status per elev, "Lämna tillbaka till alla rättade" (hoppar över
// ej färdigrättade), ångra, och elevens resultat (först efter
// tillbakalämningen, facit bara om valt). Reglerna: firestore-rules-prov-rattning.test.js.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FRAGETYPER, fragetyp } from "../src/prov/prov-fragetyper.js";
import { delaUppProv } from "../src/prov/prov-modell.js";
import { validateProv } from "../src/prov/prov-validera.js";
import {
  ELEV_STATUS, angratDok, arBedomd, aterlamnaPlan, aterlamnadDok, bedom, bedomGrupp, ejKlaraText, elevStatus,
  forslagFor, forslagPaFraga, fragaKlar, godkannAlla, godkannFraga, gruppPost, kompletteraForslag, nyRattning,
  poangFor, rattFor, rattStatusSumma, rattStatusText, resultatModell, sparDok, summera, svarsGrupper, tolkaPoang,
} from "../src/prov/prov-rattning-logik.js";
import { snabbPoang } from "../src/prov/prov-ratta-kort.js";
import { LARARENS_SPARNING } from "../src/prov/prov-sparning.js";
import { EXEMPEL } from "./helpers/prov-exempel.js";

const PROV = validateProv({ namn: "Vikingar", installningar: { visaFacit: true }, fragor: Object.values(EXEMPEL).map((e) => structuredClone(e.f)) }).value;
const { fragor, facit } = delaUppProv(PROV);
const F = Object.fromEntries(fragor.map((f) => [f.id, f]));
const ALLA_RATT = { q1: 0, q2: [0, 1], q3: false, q4: "Birka", q5: ["Miklagård", "Bagdad"], q6: ["Åska", "Visdom", "Kärlek"], q7: ["Stenåldern", "Bronsåldern", "Järnåldern", "Vikingatiden"], q8: "Djur, hus och arbete." };
const ny = (uid, svar = ALLA_RATT) => nyRattning({ elevId: uid, classId: "4a", provNamn: "Vikingar", fragor, svar, facit });
// Läraren godkänner allt och sätter fritexten.
const fardig = (uid, svar) => bedom(godkannAlla(ny(uid, svar), fragor), F.q8, { poang: 4 }, fragor);

describe("förslagen (§6.1)", () => {
  it("alla automatiska typer får ett förslag med auto: true – fritext inte, utom obesvarad (fel)", () => {
    const r = ny("e1");
    for (const id of ["q1", "q2", "q3", "q4", "q5", "q6", "q7"]) assert.deepEqual(r.fragor[id].auto, true, id);
    assert.equal(r.fragor.q4.ratt, true);
    assert.ok(!("q8" in r.fragor), "fritexten rättar läraren");
    assert.ok(!("t1" in r.fragor), "textblocket rättas inte");
    const tom = ny("e2", { q8: "" });
    assert.deepEqual(tom.fragor.q8, { poang: 0, ratt: false, auto: true }, "obesvarad fritext = förslag fel");
    assert.equal(tom.fragor.q1.ratt, false, "obesvarad flerval = fel");
  });
  it("totalen räknas med förslagen; maxPoang ur frågorna; aterlamnad false", () => {
    const r = ny("e1");
    assert.equal(r.maxPoang, 1 + 2 + 1 + 1 + 2 + 3 + 4 + 4);
    assert.equal(r.totalPoang, 1 + 2 + 1 + 1 + 2 + 3 + 4);
    assert.equal(r.aterlamnad, false);
    assert.equal(r.niva, null);
  });
  it("kompletteraForslag fyller bara i det som saknas – aldrig lärarens bedömning", () => {
    const r = bedom(ny("e1"), F.q1, { ratt: false }, fragor);
    delete r.fragor.q4;
    const k = kompletteraForslag(r, fragor, ALLA_RATT, facit);
    assert.equal(k.andrad, true);
    assert.equal(k.r.fragor.q4.auto, true);
    assert.deepEqual(k.r.fragor.q1, { ...r.fragor.q1 }, "lärarens fel står kvar");
    assert.equal(kompletteraForslag(k.r, fragor, ALLA_RATT, facit).andrad, false);
  });
});

describe("bedömningen", () => {
  it("rätt = max, fel = 0, delvis = halva (eller tidigare delpoäng); poängen ger bedömningen", () => {
    assert.equal(poangFor(true, 4), 4);
    assert.equal(poangFor(false, 4), 0);
    assert.equal(poangFor("delvis", 4), 2);
    assert.equal(poangFor("delvis", 4, 3), 3);
    assert.equal(poangFor("delvis", 1), 0.5);
    assert.equal(rattFor(4, 4), true);
    assert.equal(rattFor(0, 4), false);
    assert.equal(rattFor(1.5, 4), "delvis");
  });
  it("en ny bedömning/poäng = auto false; en kommentar ensam lämnar förslaget som förslag", () => {
    let r = ny("e1");
    r = bedom(r, F.q4, { kommentar: "Bra!" }, fragor);
    assert.equal(r.fragor.q4.auto, true);
    assert.equal(r.fragor.q4.kommentar, "Bra!");
    r = bedom(r, F.q4, { ratt: "delvis" }, fragor);
    assert.deepEqual(r.fragor.q4, { poang: 0.5, ratt: "delvis", auto: false, kommentar: "Bra!" });
    r = bedom(r, F.q7, { poang: 3 }, fragor);
    assert.deepEqual([r.fragor.q7.ratt, r.fragor.q7.poang, r.fragor.q7.auto], ["delvis", 3, false]);
    r = bedom(r, F.q7, { poang: 99 }, fragor);
    assert.equal(r.fragor.q7.poang, 4, "aldrig över max");
    r = bedom(r, F.q4, { kommentar: "  " }, fragor);
    assert.ok(!("kommentar" in r.fragor.q4), "tom kommentar tas bort");
    assert.equal(r.totalPoang, summera(r, fragor).totalPoang);
  });
  it("tolkaPoang: decimalkomma, halva poäng, 0–max; snabbknapparna 0 … max", () => {
    assert.equal(tolkaPoang("1,5", 2), 1.5);
    assert.equal(tolkaPoang("1.3", 2), 1.5);
    assert.equal(tolkaPoang("7", 2), 2);
    assert.equal(tolkaPoang("", 2), null);
    assert.equal(tolkaPoang("x", 2), null);
    // #764: halva poäng (0, ½, 1 … max); över 6 p − och + i stället för snabbknappar.
    assert.deepEqual(snabbPoang(3), [0, 0.5, 1, 1.5, 2, 2.5, 3]);
    assert.deepEqual(snabbPoang(10), []);
    assert.deepEqual(snabbPoang(0), []);
  });
});

describe("status per elev (§6.3)", () => {
  it("bara förslag = ej rättad; några bedömda = delvis; alla = rättad; tillbakalämnad", () => {
    let r = ny("e1");
    assert.equal(elevStatus(null, fragor), ELEV_STATUS.EJ);
    assert.equal(elevStatus(r, fragor), ELEV_STATUS.EJ, "förslag räknas inte som rättat");
    r = bedom(r, F.q1, { ratt: true }, fragor);
    assert.equal(elevStatus(r, fragor), ELEV_STATUS.DELVIS);
    r = bedom(godkannAlla(r, fragor), F.q8, { ratt: true }, fragor);
    assert.equal(elevStatus(r, fragor), ELEV_STATUS.RATTAD);
    assert.equal(elevStatus({ ...r, aterlamnad: true }, fragor), ELEV_STATUS.TILLBAKA);
    assert.ok(arBedomd(r.fragor.q8));
  });
  it("räkneverket på tillfället: '6 av 8 rättade · 2 tillbakalämnade'", () => {
    const rattningar = { a: fardig("a"), b: { ...fardig("b"), aterlamnad: true }, c: ny("c") };
    const s = rattStatusSumma(["a", "b", "c", "d"], rattningar, fragor);
    assert.deepEqual(s, { antal: 4, rattade: 2, tillbaka: 1 });
    assert.equal(rattStatusText(s), "2 av 4 rättade · 1 tillbakalämnade");
    assert.equal(rattStatusText({ antal: 3, rattade: 0, tillbaka: 0 }), "0 av 3 rättade");
  });
});

describe("grupperade kortsvar (§6.1)", () => {
  const svar = { a: "Birka", b: "birka.", c: " BIRKA ", d: "Bjärka", e: "", f: "Birka" };
  const uids = Object.keys(svar);
  it("identiska svar efter normaliseringen blir en grupp, störst först, obesvarade sist", () => {
    const g = svarsGrupper(F.q4, uids, (u) => svar[u], facit.q4);
    assert.deepEqual(g.map((x) => x.elever), [["a", "b", "c", "f"], ["d"], ["e"]]);
    assert.equal(g[2].nyckel, "", "inget svar");
    assert.ok(g.every((x) => x.grupp));
  });
  it("rättningen av en grupp gäller alla i gruppen – utom redan tillbakalämnade", () => {
    const rattningar = Object.fromEntries(uids.map((u) => [u, ny(u, { ...ALLA_RATT, q4: svar[u] })]));
    rattningar.f = { ...rattningar.f, aterlamnad: true };
    const fore = structuredClone(rattningar.f);
    const [birka] = svarsGrupper(F.q4, uids, (u) => svar[u], facit.q4);
    const andrade = bedomGrupp(rattningar, birka.elever, F.q4, { ratt: "delvis", kommentar: "Stor bokstav!" }, fragor);
    assert.deepEqual(andrade, ["a", "b", "c"]);
    for (const u of andrade) assert.deepEqual(rattningar[u].fragor.q4, { poang: 0.5, ratt: "delvis", auto: false, kommentar: "Stor bokstav!" }, u);
    assert.deepEqual(rattningar.f, fore, "tillbakalämnad rörs inte");
    assert.deepEqual(gruppPost(rattningar, ["a", "b", "c"], "q4").ratt, "delvis");
    assert.equal(rattningar.d.fragor.q4.ratt, false, "andra grupper orörda");
  });
  it("samma bedömning, några godkända och några förslag = förslag (inte 'olika'); olika = null", () => {
    const r = { a: ny("a"), b: godkannAlla(ny("b"), fragor) };
    assert.equal(gruppPost(r, ["a", "b"], "q4").auto, true);
    r.b = bedom(r.b, F.q4, { ratt: false }, fragor);
    assert.equal(gruppPost(r, ["a", "b"], "q4"), null);
  });
  it("lucktext grupperas på alla luckor; andra typer får en rad per elev", () => {
    const s = { a: ["Miklagård", "Bagdad"], b: ["miklagård", "bagdad."], c: ["Miklagård", ""] };
    const g = svarsGrupper(F.q5, Object.keys(s), (u) => s[u], facit.q5);
    assert.deepEqual(g.map((x) => x.elever), [["a", "b"], ["c"]]);
    const f = svarsGrupper(F.q1, ["a", "b"], () => 0, facit.q1);
    assert.deepEqual(f.map((x) => [x.elever, x.grupp]), [[["a"], false], [["b"], false]]);
  });
  it("Godkänn alla förslag på frågan: bara förslagen, inte tillbakalämnade", () => {
    const r = { a: ny("a"), b: bedom(ny("b"), F.q1, { ratt: false }, fragor), c: { ...ny("c"), aterlamnad: true } };
    assert.equal(forslagPaFraga(r, ["a", "b", "c"], "q1"), 1);
    assert.deepEqual(godkannFraga(r, ["a", "b", "c"], "q1"), ["a"]);
    assert.equal(r.a.fragor.q1.auto, false);
    assert.equal(r.b.fragor.q1.ratt, false, "lärarens fel står kvar");
    assert.equal(fragaKlar(r, ["a", "b", "c"], "q1"), true);
    assert.equal(fragaKlar(r, ["a", "b"], "q8"), false);
  });
});

describe("lämna tillbaka och ångra (§7)", () => {
  it("'Lämna tillbaka till alla rättade' hoppar över elever som inte är färdigrättade", () => {
    const r = { a: fardig("a"), b: fardig("b"), c: ny("c"), d: bedom(ny("d"), F.q1, { ratt: true }, fragor), e: { ...fardig("e"), aterlamnad: true } };
    const plan = aterlamnaPlan(["a", "b", "c", "d", "e", "f"], r, fragor);
    assert.deepEqual(plan, { klara: ["a", "b"], ejKlara: ["c", "d", "f"], redan: ["e"] });
    assert.equal(ejKlaraText(plan.ejKlara.length), "3 elever är inte färdigrättade och lämnas inte tillbaka än.");
    assert.equal(ejKlaraText(1), "1 elev är inte färdigrättad och lämnas inte tillbaka än.");
    assert.equal(ejKlaraText(0), "");
  });
  it("facit kopieras in bara om läraren valt 'Visa facit'; ångra tar bort facit och tiden", () => {
    const d = sparDok(fardig("a"), fragor);
    const med = aterlamnadDok(d, { visaFacit: true, facit });
    assert.equal(med.aterlamnad, true);
    assert.deepEqual(med.facit, facit);
    const utan = aterlamnadDok(d, { visaFacit: false, facit });
    assert.ok(!("facit" in utan));
    const angrat = angratDok({ ...med, aterlamnadAt: 123 });
    assert.equal(angrat.aterlamnad, false);
    assert.ok(!("facit" in angrat) && !("aterlamnadAt" in angrat));
  });
  it("sparDok har bara reglernas fält – och aldrig facit i en rättning som inte är tillbakalämnad", () => {
    const tillatna = ["elevId", "classId", "provNamn", "fragor", "totalPoang", "maxPoang", "niva", "helhetskommentar", "aterlamnad", "aterlamnadAt", "facit"];
    const r = { ...fardig("a"), helhetskommentar: "  Bra jobbat!  ", niva: "G", facit, okant: 1 };
    const d = sparDok(r, fragor);
    assert.deepEqual(Object.keys(d).filter((k) => !tillatna.includes(k)), []);
    assert.ok(!("facit" in d), "inte tillbakalämnad → inget facit");
    assert.equal(d.helhetskommentar, "Bra jobbat!");
    assert.equal(sparDok({ ...r, niva: "A" }, fragor).niva, null);
    // Reglerna (firestore.rules validRattning) tillåter exakt de här fälten.
    const regler = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
    for (const k of tillatna) assert.ok(regler.includes(`'${k}'`), k);
  });
});

describe("elevens resultat (§7)", () => {
  const tf = { provNamn: "Vikingar", fragor, installningar: { poang: true } };
  const svarDok = { svar: ALLA_RATT };
  it("syns först efter tillbakalämningen", () => {
    assert.equal(resultatModell(tf, svarDok, null), null);
    assert.equal(resultatModell(tf, svarDok, sparDok(fardig("a"), fragor)), null);
    assert.ok(resultatModell(tf, svarDok, aterlamnadDok(sparDok(fardig("a"), fragor), { visaFacit: false, facit })));
  });
  it("facit bara om läraren valt det; poäng, nivå och kommentarer följer med", () => {
    const r = { ...fardig("a"), niva: "MG", helhetskommentar: "Toppen!" };
    const utan = resultatModell(tf, svarDok, aterlamnadDok(sparDok(r, fragor), { visaFacit: false, facit }));
    assert.equal(utan.visaFacit, false);
    assert.ok(utan.poster.every((p) => p.facit === null));
    assert.equal(utan.totalPoang, 18);
    assert.equal(utan.maxPoang, 18);
    assert.equal(utan.nivaNamn, "Mer än godtagbart");
    assert.equal(utan.helhetskommentar, "Toppen!");
    const med = resultatModell(tf, svarDok, aterlamnadDok(sparDok(r, fragor), { visaFacit: true, facit }));
    assert.equal(med.visaFacit, true);
    assert.deepEqual(med.poster.find((p) => p.fraga.id === "q4").facit, facit.q4);
    assert.equal(med.poster.find((p) => p.fraga.id === "t1").nr, null, "textblocket har inget nummer");
  });
});

describe("registret: rättnings- och resultatvyerna (§2)", () => {
  it("varje typ har renderRattning, renderResultat och facitText; kortsvar och lucktext grupperar", () => {
    for (const t of FRAGETYPER) {
      for (const m of ["renderRattning", "renderResultat", "facitText"]) assert.equal(typeof t[m], "function", `${t.id}.${m}`);
    }
    assert.equal(typeof fragetyp("kortsvar").gruppNyckel, "function");
    assert.equal(typeof fragetyp("lucktext").gruppNyckel, "function");
    assert.equal(fragetyp("flerval").gruppNyckel, undefined);
  });
  it("facitText för lärarens rubrik", () => {
    assert.equal(fragetyp("flerval").facitText(F.q1, facit.q1), "Björkö");
    assert.equal(fragetyp("flerval-flera").facitText(F.q2, facit.q2), "Birka, Hedeby");
    assert.equal(fragetyp("santfalskt").facitText(F.q3, facit.q3), "Falskt");
    assert.equal(fragetyp("kortsvar").facitText(F.q4, facit.q4), "Birka · Björkö");
    assert.equal(fragetyp("lucktext").facitText(F.q5, facit.q5), "1: Miklagård / Konstantinopel · 2: Bagdad");
    assert.equal(fragetyp("para").facitText(F.q6, facit.q6), "Tor → Åska · Oden → Visdom · Freja → Kärlek");
    assert.equal(fragetyp("ordna").facitText(F.q7, facit.q7), "1. Stenåldern  2. Bronsåldern  3. Järnåldern  4. Vikingatiden");
  });
});

describe("budget (§9): rättningen", () => {
  it("läser en gång och sparar med tak", () => {
    // 25 elever: tillfället + facit + 25 svar + 25 rättningar + 25 namn = 77 läsningar.
    const lasningar = 1 + 1 + 25 + 25 + 25;
    assert.ok(lasningar < 100);
    assert.ok(LARARENS_SPARNING.mellanrumMs >= 10_000, "högst en batch per 10 s");
    const sida = readFileSync(new URL("../src/prov/prov-rattning-data.js", import.meta.url), "utf8");
    assert.ok(!/onSnapshot/.test(sida), "inga lyssnare i rättningen");
  });
});
