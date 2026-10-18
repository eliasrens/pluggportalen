// ============================================================================
// Prov (#764, spec §6.0 + testlistan): "Rätta alla automatiska frågor" –
// säkra fall godkänns, nästan rätta kortsvar lämnas åt läraren, fritext rörs
// inte, manuellt bedömda skrivs inte över, en andra körning efter ett tillägg
// i facit rättar bara det som inte bedömts manuellt, ungefär en skrivning per
// elev, stavfel "rätta själv" (#759) samspelar – och halvpoängen i rättningen
// (§6.1: snabbknappar, − och +, aldrig > max eller < 0). Regler:
// test/firestore-rules-prov-ratta-alla.test.js.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { delaUppProv } from "../src/prov/prov-modell.js";
import { validateProv, felKortsvarFelFor, tillfalleInstallningar } from "../src/prov/prov-validera.js";
import {
  ELEV_STATUS, arAutoRattad, arBedomd, arForslag, arManuell, bedom, elevStatus, godkannFraga, gruppPost, nyRattning, sparDok, summera,
} from "../src/prov/prov-rattning-logik.js";
import {
  FACIT_LISTA_MAX, LAGE, RATTNING_PER_BATCH, autoBedom, delaIBatchar, facitMedTillagg, godkannbara, rattaAlla, rattaAllaElev,
  rattaAllaVal, sammanfattning,
} from "../src/prov/prov-ratta-alla.js";
import { SNABB_MAX, halvText, snabbPoang, stegaPoang } from "../src/prov/prov-ratta-kort.js";
import { andelFor, fargFor } from "../src/prov/prov-statistik.js";
import { summaPoang } from "../src/prov/prov-poang.js";

const PROV = validateProv({
  namn: "Vikingar",
  fragor: [
    { id: "a1", typ: "avsnitt", titel: "Del 1" },
    { id: "q1", typ: "flerval", fraga: "Var låg Birka?", alternativ: ["Björkö", "Gotland", "Öland"], ratt: 0 },
    { id: "q2", typ: "flerval-flera", fraga: "Vikingastäder?", alternativ: ["Birka", "Hedeby", "Paris", "Rom"], ratt: [0, 1], poang: 2 },
    { id: "q3", typ: "santfalskt", fraga: "Horn på hjälmarna.", ratt: false },
    { id: "q4", typ: "kortsvar", fraga: "Handelsstaden?", godkanda: ["Birka"], exaktStavning: false },
    { id: "q5", typ: "lucktext", fraga: "Fyll i.", lucktext: "Till [[Miklagård|Konstantinopel]] och [[Bagdad]].", poang: 2, exaktStavning: false },
    { id: "q6", typ: "para", fraga: "Para.", poang: 2,
      par: [{ vanster: "A", hoger: "1" }, { vanster: "B", hoger: "2" }, { vanster: "C", hoger: "3" }, { vanster: "D", hoger: "4" }, { vanster: "E", hoger: "5" }] },
    { id: "q7", typ: "ordna", fraga: "Ordna.", saker: ["Sten", "Brons", "Järn", "Vikinga"], poang: 3 },
    { id: "a2", typ: "avsnitt", titel: "Del 2" },
    { id: "q8", typ: "fritext", fraga: "Beskriv.", poang: 4 },
  ],
}).value;
const { fragor, facit } = delaUppProv(PROV);
const F = Object.fromEntries(fragor.map((f) => [f.id, f]));
const RATT = { q1: 0, q2: [0, 1], q3: false, q4: "Birka", q5: ["Miklagård", "Bagdad"], q6: ["1", "2", "3", "4", "5"], q7: ["Sten", "Brons", "Järn", "Vikinga"], q8: "Text" };
const ny = (uid, svar = RATT, stavfel = "auto") => nyRattning({ elevId: uid, classId: "4a", provNamn: "Vikingar", fragor, svar, facit, stavfel });
const kor = (r, svar = RATT, opt = {}) => rattaAllaElev(r, fragor, svar, facit, opt);

describe("autoBedom – säkert eller osäkert (§6.0)", () => {
  it("flerval, flera rätt, sant/falskt, para och ordna är säkra", () => {
    for (const id of ["q1", "q2", "q3", "q6", "q7"]) {
      const b = autoBedom(F[id], RATT[id], facit[id]);
      assert.equal(b.lage, LAGE.SAKER, id);
      assert.deepEqual(b.post, { poang: F[id].poang, ratt: true, auto: true, autoRattad: true }, id);
    }
  });
  it("para med delpoäng avrundas NEDÅT till 0,5 (2 p, 3 av 5 → 1,2 → 1)", () => {
    const b = autoBedom(F.q6, ["1", "2", "3", "x", "y"], facit.q6);
    assert.equal(b.lage, LAGE.SAKER);
    assert.deepEqual(b.post, { poang: 1, ratt: "delvis", auto: true, autoRattad: true });
  });
  it("ordna 3 p, 2 av 4 på rätt plats → 1,5", () => {
    assert.equal(autoBedom(F.q7, ["Sten", "Brons", "Vikinga", "Järn"], facit.q7).post.poang, 1.5);
  });
  it("kortsvar som stämmer exakt efter normaliseringen är säkert", () => {
    for (const s of ["Birka", " BIRKA", "birka."]) assert.equal(autoBedom(F.q4, s, facit.q4).lage, LAGE.SAKER, s);
  });
  it("nästan rätt kortsvar (ett stavfel, exakt stavning krävs inte) lämnas åt läraren", () => {
    const b = autoBedom(F.q4, "Birkka", facit.q4);
    assert.equal(b.lage, LAGE.OSAKER);
    assert.deepEqual(b.post, { poang: 0.5, ratt: "delvis", auto: true }, "stavfel auto: halva poängen står kvar som FÖRSLAG");
    assert.equal(autoBedom(F.q4, "Birkka", facit.q4, { stavfel: "sjalv" }).post, null, "rätta själv: inget förslag alls");
  });
  it("fel kortsvar: fel med felKortsvarFel (standard), annars åt läraren", () => {
    assert.deepEqual(autoBedom(F.q4, "Uppsala", facit.q4).post, { poang: 0, ratt: false, auto: true, autoRattad: true });
    const av = autoBedom(F.q4, "Uppsala", facit.q4, { felKortsvarFel: false });
    assert.equal(av.lage, LAGE.OSAKER);
    assert.equal(arForslag(av.post), true);
  });
  it("obesvarat är säkert fel – även med felKortsvarFel av", () => {
    for (const [id, s] of [["q4", ""], ["q1", null], ["q5", ["", ""]], ["q7", []]]) {
      const b = autoBedom(F[id], s, facit[id], { felKortsvarFel: false });
      assert.equal(b.lage, LAGE.SAKER, id);
      assert.equal(b.post.ratt, false, id);
    }
  });
  it("lucktext: alla rätt säkert; stavfel i en lucka osäkert; tom lucka säkert fel", () => {
    assert.equal(autoBedom(F.q5, ["Konstantinopel", "bagdad"], facit.q5).lage, LAGE.SAKER);
    assert.equal(autoBedom(F.q5, ["Miklagårdd", "Bagdad"], facit.q5).lage, LAGE.OSAKER);
    const tom = autoBedom(F.q5, ["Miklagård", ""], facit.q5, { felKortsvarFel: false });
    assert.equal(tom.lage, LAGE.SAKER);
    assert.deepEqual([tom.post.poang, tom.post.ratt], [1, "delvis"]);
    assert.equal(autoBedom(F.q5, ["Miklagård", "Rom"], facit.q5, { felKortsvarFel: false }).lage, LAGE.OSAKER);
    assert.equal(autoBedom(F.q5, ["Miklagård", "Rom"], facit.q5).lage, LAGE.SAKER);
  });
  it("poäng ↔ markering: avrundning nedåt till 0 p ger fel, aldrig 'delvis' med 0 p", () => {
    const P = validateProv({ namn: "x", fragor: [
      { id: "l1", typ: "lucktext", fraga: "?", lucktext: "[[a1]] [[b1]] [[c1]]", poang: 1 },
      { id: "k1", typ: "kortsvar", fraga: "?", godkanda: ["Birka"], exaktStavning: false, poang: 0.5 },
      { id: "p1", typ: "para", fraga: "?", poang: 1, par: [{ vanster: "A", hoger: "1" }, { vanster: "B", hoger: "2" }, { vanster: "C", hoger: "3" }] },
    ] }).value;
    const d = delaUppProv(P);
    const G = Object.fromEntries(d.fragor.map((f) => [f.id, f]));
    // 1 p lucktext, 1 av 3 rätt: 1/3 → 0,33 → 0 p → fel (säkert).
    const l = autoBedom(G.l1, ["a1", "x", "y"], d.facit.l1);
    assert.deepEqual([l.lage, l.post.poang, l.post.ratt], [LAGE.SAKER, 0, false]);
    // 2 av 3 → 0,67 → 0,5 p → delvis.
    assert.deepEqual([autoBedom(G.l1, ["a1", "b1", "y"], d.facit.l1).post.poang, autoBedom(G.l1, ["a1", "b1", "y"], d.facit.l1).post.ratt], [0.5, "delvis"]);
    // para 1 p, 1 av 3 → 0 p → fel.
    assert.equal(autoBedom(G.p1, ["1", "x", "y"], d.facit.p1).post.ratt, false);
    // kortsvar 0,5 p med ett stavfel: halva poängen avrundas till 0 → förslaget är fel (fortfarande åt läraren).
    const k = autoBedom(G.k1, "Birkka", d.facit.k1);
    assert.deepEqual([k.lage, k.post.poang, k.post.ratt], [LAGE.OSAKER, 0, false]);
    // Vanliga förslag när vyn öppnas följer samma regel.
    const r = nyRattning({ elevId: "e", classId: "4a", provNamn: "x", fragor: d.fragor, svar: { l1: ["a1", "x", "y"] }, facit: d.facit });
    assert.deepEqual([r.fragor.l1.poang, r.fragor.l1.ratt], [0, false]);
  });
  it("fritext rörs aldrig", () => {
    assert.deepEqual(autoBedom(F.q8, "Text", undefined), { lage: LAGE.FRITEXT, post: null });
    assert.deepEqual(autoBedom(F.q8, "", undefined), { lage: LAGE.FRITEXT, post: null });
  });
});

describe("rättaAllaElev / rattaAlla", () => {
  it("säkra fall blir autorättade och räknas som bedömda; fritext väntar", () => {
    const e = kor(ny("e1"));
    assert.deepEqual(e.rattade.sort(), ["q1", "q2", "q3", "q4", "q5", "q6", "q7"]);
    assert.deepEqual(e.fritext, ["q8"]);
    assert.deepEqual(e.osakra, []);
    for (const id of e.rattade) assert.equal(arAutoRattad(e.r.fragor[id]), true, id);
    assert.equal(arBedomd(e.r.fragor.q8), false);
    assert.equal(elevStatus(e.r, fragor), ELEV_STATUS.DELVIS);
    assert.equal(e.r.totalPoang, summaPoang(["q1", "q2", "q3", "q4", "q5", "q6", "q7"].map((id) => F[id].poang)));
  });
  it("fritext orörd: förslaget (obesvarad) och lärarens poäng står kvar exakt", () => {
    const r0 = ny("e1", { ...RATT, q8: "" });
    const fore = structuredClone(r0.fragor.q8);
    assert.deepEqual(kor(r0, { ...RATT, q8: "" }).r.fragor.q8, fore);
    const r1 = bedom(ny("e1"), F.q8, { poang: 2.5 }, fragor);
    assert.deepEqual(kor(r1).r.fragor.q8, r1.fragor.q8);
  });
  it("manuellt bedömda skrivs aldrig över – inte heller gamla poster utan auto-fält", () => {
    let r = bedom(ny("e1"), F.q1, { ratt: false }, fragor); // läraren: fel trots rätt svar
    r = { ...r, fragor: { ...r.fragor, q3: { poang: 0, ratt: "delvis" } } }; // gammal post utan auto
    const e = kor(r);
    assert.deepEqual(e.r.fragor.q1, r.fragor.q1);
    assert.deepEqual(e.r.fragor.q3, r.fragor.q3);
    assert.ok(!e.rattade.includes("q1") && !e.rattade.includes("q3"));
    assert.equal(arManuell(e.r.fragor.q1), true);
  });
  it("lärarens kommentar på ett förslag följer med", () => {
    const r = bedom(ny("e1"), F.q4, { kommentar: "Bra!" }, fragor);
    assert.equal(kor(r).r.fragor.q4.kommentar, "Bra!");
  });
  it("tillbakalämnade rörs inte", () => {
    const r = { ...ny("e1"), aterlamnad: true };
    const e = kor(r);
    assert.equal(e.andrad, false);
    assert.equal(e.r, r);
  });
  it("andra körningen utan ändringar ändrar ingenting (inga nya skrivningar)", () => {
    const e1 = kor(ny("e1"));
    const e2 = kor(e1.r);
    assert.equal(e2.andrad, false);
    assert.equal(e2.rattade.length, 0);
  });
  it("andra körning efter facit-tillägg rättar bara icke-manuella", () => {
    const rattningar = { a: ny("a", { ...RATT, q4: "Björkö" }), b: ny("b", { ...RATT, q4: "Björkö" }) };
    rattningar.b = bedom(rattningar.b, F.q4, { ratt: "delvis" }, fragor); // läraren har bedömt b
    const svar = { a: { ...RATT, q4: "Björkö" }, b: { ...RATT, q4: "Björkö" } };
    const opt = { felKortsvarFel: true };
    const forsta = rattaAlla({ med: ["a", "b"], rattningar, fragor, svarAv: (u) => svar[u], facit, opt });
    assert.equal(rattningar.a.fragor.q4.ratt, false, "Björkö finns inte i facit → fel");
    assert.deepEqual(forsta.andrade.sort(), ["a", "b"]);
    const facit2 = { ...facit, q4: facitMedTillagg(F.q4, facit.q4, "Björkö") };
    const andra = rattaAlla({ med: ["a", "b"], rattningar, fragor, svarAv: (u) => svar[u], facit: facit2, opt });
    assert.deepEqual(andra.andrade, ["a"], "bara a skrivs igen");
    assert.equal(andra.rattade, 1);
    assert.deepEqual(rattningar.a.fragor.q4, { poang: 1, ratt: true, auto: true, autoRattad: true });
    assert.equal(rattningar.b.fragor.q4.ratt, "delvis", "lärarens bedömning står kvar");
  });
  it("ungefär en skrivning per elev: en ändrad rättning per elev, batchar ≤ 500", () => {
    const med = Array.from({ length: 25 }, (_, i) => `e${i}`);
    const rattningar = Object.fromEntries(med.map((u) => [u, ny(u)]));
    const res = rattaAlla({ med, rattningar, fragor, svarAv: () => RATT, facit });
    assert.equal(res.andrade.length, 25, "25 elever → 25 dokument");
    assert.equal(res.rattade, 25 * 7, "175 svar men bara 25 skrivningar");
    assert.deepEqual(delaIBatchar(res.andrade).map((b) => b.length), [25]);
    const stora = delaIBatchar(Array.from({ length: 1000 }, (_, i) => i));
    assert.deepEqual(stora.map((b) => b.length), [450, 450, 100]);
    assert.ok(stora.every((b) => b.length + 1 <= 500), "+ räkneverket ryms");
    assert.equal(RATTNING_PER_BATCH + 1 <= 500, true);
    assert.deepEqual(delaIBatchar([]), [[]]);
  });
  it("sammanfattningen: rättade, osäkra kortsvar (länk) och fritext", () => {
    const med = ["a", "b", "c"];
    const svar = { a: RATT, b: { ...RATT, q4: "Birkka" }, c: { ...RATT, q4: "Birkka", q5: ["Mikklagård", "Bagdad"] } };
    const rattningar = Object.fromEntries(med.map((u) => [u, ny(u, svar[u])]));
    const res = rattaAlla({ med, rattningar, fragor, svarAv: (u) => svar[u], facit });
    const rader = sammanfattning(res, fragor);
    assert.equal(rader[0].text, `${res.rattade} svar rättades automatiskt.`);
    assert.equal(rader[1].text, "3 kortsvar och lucktexter behöver din bedömning.");
    assert.equal(rader[1].fid, "q4");
    assert.deepEqual(rader[1].fragor.map((x) => [x.nr, x.antal]), [[4, 2], [5, 1]]);
    assert.equal(rader[2].text, "3 fritextsvar väntar på rättning.");
    assert.equal(rader[2].fid, "q8");
    const igen = sammanfattning(rattaAlla({ med, rattningar, fragor, svarAv: (u) => svar[u], facit }), fragor);
    assert.equal(igen[0].text, "Inga nya svar att rätta automatiskt.");
  });
  it("stavfel 'rätta själv' + rätta alla: stavfelet får ingen post, resten rättas", () => {
    const s = { ...RATT, q4: "Birkka" };
    const e = kor(ny("e1", s, "sjalv"), s, { stavfel: "sjalv" });
    assert.equal(e.r.fragor.q4, undefined, "inget förslag och ingen rättning");
    assert.deepEqual(e.osakra, ["q4"]);
    assert.ok(e.rattade.includes("q1"));
    // Ett autorättat svar som blir osäkert (t.ex. efter byte till sjalv) går tillbaka till läraren.
    const r = { ...ny("e2", s), fragor: { ...ny("e2", s).fragor, q4: { poang: 0, ratt: false, auto: true, autoRattad: true } } };
    assert.equal(kor(r, s, { stavfel: "sjalv" }).r.fragor.q4, undefined);
  });
  it("stavfel 'auto': nästan rätt står kvar som förslag (halva poängen), inte rättat", () => {
    const s = { ...RATT, q4: "Birkka" };
    const e = kor(ny("e1", s), s, { stavfel: "auto" });
    assert.equal(arForslag(e.r.fragor.q4), true);
    assert.equal(e.r.fragor.q4.poang, 0.5);
  });
  it("läraren ändrar en autorättad: den blir manuell (Auto-etiketten försvinner)", () => {
    const r = kor(ny("e1")).r;
    const b = bedom(r, F.q2, { poang: 1.5 }, fragor);
    assert.deepEqual(b.fragor.q2, { poang: 1.5, ratt: "delvis", auto: false });
    assert.equal(arManuell(b.fragor.q2), true);
    const k = bedom(r, F.q2, { kommentar: "Snyggt" }, fragor);
    assert.equal(arAutoRattad(k.fragor.q2), true, "en kommentar ensam ändrar inte bedömningen");
  });
  it("'Godkänn alla förslag' rör inte autorättade; gruppen visar Auto", () => {
    const rattningar = { a: kor(ny("a")).r, b: kor(ny("b")).r };
    assert.deepEqual(godkannFraga(rattningar, ["a", "b"], "q1"), []);
    assert.equal(gruppPost(rattningar, ["a", "b"], "q1").autoRattad, true);
  });
  it("gamla prov (heltal, utan auto-fält) visas och summeras som förut", () => {
    const gammal = { elevId: "e1", classId: "4a", provNamn: "x", aterlamnad: false,
      fragor: { q1: { poang: 1, ratt: true }, q2: { poang: 2, ratt: true }, q3: { poang: 0, ratt: false } } };
    assert.equal(summera(gammal, fragor).totalPoang, 3);
    assert.equal(arBedomd(gammal.fragor.q1), true);
    assert.equal(sparDok(gammal, fragor).fragor.q1.auto, undefined, "inga fält läggs till");
  });
});

describe("facit i efterhand (§6.0)", () => {
  it("kortsvar: läggs till en gång (normaliserat), inte tomt, inte för många", () => {
    const fa = facitMedTillagg(F.q4, facit.q4, "  Björkö ");
    assert.deepEqual(fa.godkanda, ["Birka", "Björkö"]);
    assert.equal(fa.exaktStavning, false, "valen följer med");
    assert.equal(facitMedTillagg(F.q4, fa, "björkö."), null);
    assert.equal(facitMedTillagg(F.q4, fa, "  "), null);
    const full = { ...facit.q4, godkanda: Array.from({ length: FACIT_LISTA_MAX }, (_, i) => `s${i}`) };
    assert.equal(facitMedTillagg(F.q4, full, "Ny"), null);
    assert.equal(facitMedTillagg(F.q1, facit.q1, "x"), null, "bara kortsvar och lucktext");
  });
  it("lucktext: bara den luckan", () => {
    const fa = facitMedTillagg(F.q5, facit.q5, "Bysans", 0);
    assert.deepEqual(fa.luckor.map((l) => l.godkanda), [["Miklagård", "Konstantinopel", "Bysans"], ["Bagdad"]]);
    assert.equal(facitMedTillagg(F.q5, facit.q5, "Bysans", 7), null);
  });
  it("godkannbara: svar som inte stämmer exakt (även stavfel) – inte rätta eller tomma", () => {
    assert.deepEqual(godkannbara(F.q4, "Björkö", facit.q4), [{ text: "Björkö", lucka: null }]);
    assert.deepEqual(godkannbara(F.q4, "Birkka", facit.q4), [{ text: "Birkka", lucka: null }]);
    assert.deepEqual(godkannbara(F.q4, "birka", facit.q4), []);
    assert.deepEqual(godkannbara(F.q4, "", facit.q4), []);
    assert.deepEqual(godkannbara(F.q5, ["Bysans", ""], facit.q5), [{ text: "Bysans", lucka: 0 }]);
    assert.deepEqual(godkannbara(F.q1, 2, facit.q1), []);
  });
});

describe("inställningen 'Fel svar på kortsvar rättas som fel'", () => {
  it("standard på; gamla prov utan fältet = på; validateProv godtar bara true/false", () => {
    assert.equal(felKortsvarFelFor(undefined), true);
    assert.equal(felKortsvarFelFor({}), true);
    assert.equal(felKortsvarFelFor({ felKortsvarFel: false }), false);
    const FR = [{ id: "k", typ: "kortsvar", fraga: "?", godkanda: ["a"] }];
    assert.equal(validateProv({ namn: "x", fragor: FR }).value.installningar.felKortsvarFel, true);
    assert.equal(validateProv({ namn: "x", fragor: FR, installningar: { felKortsvarFel: false } }).value.installningar.felKortsvarFel, false);
    assert.equal(validateProv({ namn: "x", fragor: FR, installningar: { felKortsvarFel: "nej" } }).ok, false);
    assert.equal(tillfalleInstallningar({}).felKortsvarFel, true);
    assert.deepEqual(rattaAllaVal({ stavfel: "sjalv", felKortsvarFel: false }), { stavfel: "sjalv", felKortsvarFel: false });
  });
});

describe("halvpoäng i rättningen (§6.1)", () => {
  it("snabbknappar 0, ½, 1, 1½ … max; inga över 6 p", () => {
    assert.deepEqual(snabbPoang(2), [0, 0.5, 1, 1.5, 2]);
    assert.deepEqual(snabbPoang(0.5), [0, 0.5]);
    assert.equal(snabbPoang(6).length, 13);
    assert.deepEqual(snabbPoang(6.5), []);
    assert.deepEqual(snabbPoang(20), []);
    assert.deepEqual(snabbPoang(0), []);
    assert.equal(SNABB_MAX, 6);
    assert.deepEqual([0, 0.5, 1, 1.5, 6].map(halvText), ["0", "½", "1", "1½", "6"]);
  });
  it("− och +: steg om 0,5, aldrig över max eller under 0", () => {
    assert.equal(stegaPoang(3.5, 1, 8), 4);
    assert.equal(stegaPoang(8, 1, 8), 8);
    assert.equal(stegaPoang(0, -1, 8), 0);
    assert.equal(stegaPoang(null, 1, 8), 0.5);
    assert.equal(stegaPoang(7.5, 1, 7.5), 7.5);
  });
  it("poäng ↔ markering: full = rätt, 0 = fel, däremellan delvis; kläms till 0 … max", () => {
    const r = ny("e1");
    assert.deepEqual(bedom(r, F.q7, { poang: 3 }, fragor).fragor.q7.ratt, true);
    assert.deepEqual(bedom(r, F.q7, { poang: 0 }, fragor).fragor.q7.ratt, false);
    assert.deepEqual(bedom(r, F.q7, { poang: 2.5 }, fragor).fragor.q7.ratt, "delvis");
    assert.equal(bedom(r, F.q7, { poang: 99 }, fragor).fragor.q7.poang, 3);
    assert.equal(bedom(r, F.q7, { poang: -2 }, fragor).fragor.q7.poang, 0);
    assert.equal(bedom(r, F.q7, { poang: 1.3 }, fragor).fragor.q7.poang, 1.5);
  });
  it("halvpoäng summeras exakt (3,5 + 4 + 0,5 = 8) och sparas som tal", () => {
    let r = ny("e1");
    for (const [id, p] of [["q7", 2.5], ["q8", 3.5], ["q2", 1.5], ["q5", 0.5]]) r = bedom(r, F[id], { poang: p }, fragor);
    const d = sparDok(r, fragor);
    assert.equal(d.totalPoang, 1 + 1.5 + 1 + 1 + 0.5 + 2 + 2.5 + 3.5);
    assert.equal(d.fragor.q8.poang, 3.5);
    assert.ok(Number.isInteger(d.totalPoang * 2));
  });
  it("färggränserna räknas på halvpoängen utan brus", () => {
    // 0,1-steg ger brus; halva poäng får aldrig tippa 85 % till 84,999…
    const fr = [{ id: "x1", typ: "fritext", fraga: "?", poang: 10 }, { id: "x2", typ: "fritext", fraga: "?", poang: 10 }];
    const r = { fragor: { x1: { poang: 8.5, ratt: "delvis", auto: false }, x2: { poang: 8.5, ratt: "delvis", auto: false } } };
    const a = andelFor(r, fr, true);
    assert.equal(a.poang, 17);
    assert.equal(a.max, 20);
    assert.equal(fargFor(a.andel, { gul: 60, gron: 85 }), "gron");
  });
});
