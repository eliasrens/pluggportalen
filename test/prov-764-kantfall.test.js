// ============================================================================
// Prov (#764) – testarens kantfall för "Rätta alla automatiska frågor":
// lärarens ändringar (bedömning, bara poäng, bara kommentar) på förslag och
// autorättade, andra körningen efter facit-tillägg, stavfel "sjalv" med
// kommentar, inställningen felKortsvarFel som slås av mellan körningarna,
// batch-uppdelningen vid 451 elever och en slumpad invariant-körning (poäng
// aldrig > max / < 0, exakta halvpoängssummor, manuella poster orörda, en
// andra identisk körning skriver ingenting). Coderns tester:
// test/prov-ratta-alla.test.js.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { delaUppProv } from "../src/prov/prov-modell.js";
import { validateProv } from "../src/prov/prov-validera.js";
import {
  ELEV_STATUS, arAutoRattad, arBedomd, arForslag, arManuell, bedom, delvisPoang, elevStatus, kompletteraForslag, nyRattning,
  poangFor, sparDok,
} from "../src/prov/prov-rattning-logik.js";
import {
  LAGE, RATTNING_PER_BATCH, autoBedom, delaIBatchar, facitMedTillagg, rattaAlla, rattaAllaElev, sammanfattning,
} from "../src/prov/prov-ratta-alla.js";
import { halvor, summaPoang } from "../src/prov/prov-poang.js";

const PROV = validateProv({
  namn: "Kantfall",
  fragor: [
    { id: "q1", typ: "flerval", fraga: "?", alternativ: ["A", "B", "C"], ratt: 0, poang: 0.5 },
    { id: "q2", typ: "flerval-flera", fraga: "?", alternativ: ["A", "B", "C", "D"], ratt: [0, 1], poang: 1.5 },
    { id: "q3", typ: "santfalskt", fraga: "?", ratt: true },
    { id: "q4", typ: "kortsvar", fraga: "Var låg Birka?", godkanda: ["Birka"], exaktStavning: false, poang: 2.5 },
    { id: "q5", typ: "lucktext", fraga: "?", lucktext: "[[Oden]] och [[Tor]] och [[Frej]]", exaktStavning: false, poang: 1.5 },
    { id: "q6", typ: "para", fraga: "?", poang: 7,
      par: [{ vanster: "A", hoger: "1" }, { vanster: "B", hoger: "2" }, { vanster: "C", hoger: "3" }] },
    { id: "q7", typ: "ordna", fraga: "?", saker: ["a", "b", "c", "d", "e"], poang: 2 },
    { id: "q8", typ: "fritext", fraga: "?", poang: 4.5 },
    { id: "q9", typ: "kortsvar", fraga: "7 + 0?", godkanda: ["7"], exaktStavning: true, poang: 1 },
  ],
}).value;
const { fragor, facit } = delaUppProv(PROV);
const F = Object.fromEntries(fragor.map((f) => [f.id, f]));
const RATT = { q1: 0, q2: [0, 1], q3: true, q4: "Birka", q5: ["Oden", "Tor", "Frej"], q6: ["1", "2", "3"], q7: ["a", "b", "c", "d", "e"], q8: "Text", q9: "7" };
const ny = (uid, svar = RATT, stavfel = "auto") => nyRattning({ elevId: uid, classId: "4a", provNamn: "Kantfall", fragor, svar, facit, stavfel });

describe("lärarens ändringar skrivs aldrig över", () => {
  it("ett FÖRSLAG som läraren ändrat (Delvis) står kvar efter facit-tillägg och ny körning", () => {
    const svar = { ...RATT, q4: "Björkö" };
    let r = ny("e", svar);
    r = rattaAllaElev(r, fragor, svar, facit).r;
    assert.equal(r.fragor.q4.ratt, false, "felKortsvarFel: Björkö är fel automatiskt");
    r = bedom(r, F.q4, { ratt: "delvis" }, fragor);
    const fore = structuredClone(r.fragor.q4);
    assert.equal(arManuell(fore), true);
    const fa = { ...facit, q4: facitMedTillagg(F.q4, facit.q4, "Björkö") };
    const e = rattaAllaElev(r, fragor, svar, fa);
    assert.deepEqual(e.r.fragor.q4, fore);
    assert.equal(e.rattade.includes("q4"), false);
  });
  it("bara POÄNG ändrad på en autorättad → manuell; ny körning rör den inte", () => {
    let r = rattaAllaElev(ny("e"), fragor, RATT, facit).r;
    assert.equal(arAutoRattad(r.fragor.q6), true);
    r = bedom(r, F.q6, { poang: 6.5 }, fragor);
    assert.deepEqual([r.fragor.q6.poang, r.fragor.q6.ratt, r.fragor.q6.auto, "autoRattad" in r.fragor.q6], [6.5, "delvis", false, false]);
    const e = rattaAllaElev(r, fragor, RATT, facit);
    assert.equal(e.andrad, false);
    assert.equal(e.r.fragor.q6.poang, 6.5);
  });
  it("bara KOMMENTAR på en autorättad → förblir autorättad; omräkningen behåller kommentaren", () => {
    const svar = { ...RATT, q4: "Björkö" };
    let r = rattaAllaElev(ny("e", svar), fragor, svar, facit).r;
    r = bedom(r, F.q4, { kommentar: "Kolla kartan" }, fragor);
    assert.equal(arAutoRattad(r.fragor.q4), true);
    const fa = { ...facit, q4: facitMedTillagg(F.q4, facit.q4, "Björkö") };
    const e = rattaAllaElev(r, fragor, svar, fa);
    assert.deepEqual(e.r.fragor.q4, { poang: 2.5, ratt: true, auto: true, autoRattad: true, kommentar: "Kolla kartan" });
    assert.deepEqual(e.rattade, ["q4"]);
  });
  it("gamla poster (heltal, utan auto) och godkända förslag räknas som lärarens", () => {
    const r = { ...ny("e"), fragor: { q1: { poang: 0, ratt: false }, q4: { poang: 1, ratt: "delvis", auto: false } } };
    const e = rattaAllaElev(r, fragor, RATT, facit);
    assert.deepEqual(e.r.fragor.q1, { poang: 0, ratt: false });
    assert.deepEqual(e.r.fragor.q4, { poang: 1, ratt: "delvis", auto: false });
  });
});

describe("andra körningen", () => {
  it("efter facit-tillägg: förslag (felKortsvarFel av) och autorättade fel blir rätt, manuella står kvar", () => {
    const svar = { ...RATT, q4: "Björkö" };
    const opt = { felKortsvarFel: false };
    const rattningar = { a: ny("a", svar), b: ny("b", svar), c: ny("c", svar) };
    rattaAlla({ med: ["a", "b", "c"], rattningar, fragor, svarAv: () => svar, facit, opt });
    assert.equal(arForslag(rattningar.a.fragor.q4), true, "osäkert → förslag");
    rattningar.b = rattaAllaElev(rattningar.b, fragor, svar, facit, { felKortsvarFel: true }).r;
    assert.equal(arAutoRattad(rattningar.b.fragor.q4), true);
    rattningar.c = bedom(rattningar.c, F.q4, { ratt: false }, fragor);
    const fa = { ...facit, q4: facitMedTillagg(F.q4, facit.q4, "björkö") };
    const res = rattaAlla({ med: ["a", "b", "c"], rattningar, fragor, svarAv: () => svar, facit: fa, opt });
    assert.deepEqual(res.andrade, ["a", "b"]);
    assert.equal(res.rattade, 2);
    assert.equal(rattningar.a.fragor.q4.ratt, true);
    assert.equal(rattningar.b.fragor.q4.ratt, true);
    assert.equal(rattningar.c.fragor.q4.ratt, false);
    assert.equal(arManuell(rattningar.c.fragor.q4), true);
  });
  it("felKortsvarFel slås AV mellan körningarna: autorättat fel blir förslag igen (dokumenterat beteende)", () => {
    const svar = { ...RATT, q4: "Uppsala" };
    let r = rattaAllaElev(ny("e", svar), fragor, svar, facit).r;
    assert.equal(arAutoRattad(r.fragor.q4), true);
    r = rattaAllaElev(r, fragor, svar, facit, { felKortsvarFel: false }).r;
    assert.equal(arForslag(r.fragor.q4), true);
    assert.equal(arBedomd(r.fragor.q4), false);
  });
  it("identisk körning nummer två: inga ändrade elever, inga skrivningar", () => {
    const rattningar = Object.fromEntries(["a", "b"].map((u) => [u, ny(u, { ...RATT, q4: "Birkka" })]));
    const arg = { med: ["a", "b"], rattningar, fragor, svarAv: () => ({ ...RATT, q4: "Birkka" }), facit };
    assert.equal(rattaAlla(arg).andrade.length, 2);
    const res = rattaAlla(arg);
    assert.deepEqual(res.andrade, []);
    assert.equal(res.rattade, 0);
    assert.equal(res.osakra, 2, "nästan rätt väntar fortfarande på läraren");
    assert.equal(sammanfattning(res, fragor)[0].text, "Inga nya svar att rätta automatiskt.");
  });
});

describe("stavfel 'rätta själv' (#759) + rätta alla", () => {
  it("nästan rätt + lärarens kommentar: ingen bedömning, kommentaren står kvar, inte rättad", () => {
    const svar = { ...RATT, q4: "Birkka" };
    let r = ny("e", svar, "sjalv");
    assert.equal(r.fragor.q4, undefined);
    r = bedom(r, F.q4, { kommentar: "Nästan!" }, fragor);
    const e = rattaAllaElev(r, fragor, svar, facit, { stavfel: "sjalv" });
    assert.equal(e.r.fragor.q4.ratt, undefined);
    assert.equal(e.r.fragor.q4.kommentar, "Nästan!");
    assert.equal(elevStatus(e.r, fragor), ELEV_STATUS.DELVIS);
    assert.deepEqual(e.osakra, ["q4"]);
    assert.equal(sparDok(e.r, fragor).totalPoang, summaPoang(Object.values(e.r.fragor).map((p) => p.poang)));
  });
  it("lucktext med stavfel i EN lucka: hela frågan åt läraren, också med felKortsvarFel på", () => {
    const b = autoBedom(F.q5, ["Oden", "x", "Frejj"], facit.q5, { stavfel: "sjalv", felKortsvarFel: true });
    assert.deepEqual([b.lage, b.post], [LAGE.OSAKER, null]);
  });
  it("exakt stavning krävs: ett stavfel är bara fel – säkert fel med felKortsvarFel, även med 'sjalv'", () => {
    const b = autoBedom(F.q9, "8", facit.q9, { stavfel: "sjalv" });
    assert.deepEqual([b.lage, b.post.ratt, b.post.poang], [LAGE.SAKER, false, 0]);
    assert.equal(autoBedom(F.q9, "7,0", facit.q9).post.ratt, true, "7,0 = 7 efter normaliseringen");
  });
  it("svar med bara blanksteg är obesvarade = säkert fel", () => {
    assert.deepEqual(autoBedom(F.q4, "   ", facit.q4, { felKortsvarFel: false }).post, { poang: 0, ratt: false, auto: true, autoRattad: true });
    assert.equal(autoBedom(F.q5, [" ", "", "  "], facit.q5, { felKortsvarFel: false }).lage, LAGE.SAKER);
  });
});

describe("halvpoäng i automatiken", () => {
  it("para 7 p (> 6): 2 av 3 → 4,666 → 4,5 delvis; 0 av 3 → fel", () => {
    assert.deepEqual(autoBedom(F.q6, ["1", "2", "x"], facit.q6).post, { poang: 4.5, ratt: "delvis", auto: true, autoRattad: true });
    assert.deepEqual(autoBedom(F.q6, ["x", "y", "z"], facit.q6).post.ratt, false);
  });
  it("flerval 0,5 p: rätt = 0,5, fel = 0 – totalen exakt", () => {
    const r = rattaAllaElev(ny("e"), fragor, RATT, facit).r;
    assert.equal(r.fragor.q1.poang, 0.5);
    assert.equal(r.totalPoang, 0.5 + 1.5 + 1 + 2.5 + 1.5 + 7 + 2 + 1, "fritext q8 utan poäng (väntar)");
  });
  it("bedom med uttrycklig poäng över max och under 0 kläms (poangsatt via sifferfältet)", () => {
    let r = ny("e");
    r = bedom(r, F.q4, { poang: 99 }, fragor);
    assert.equal(r.fragor.q4.poang, 2.5);
    r = bedom(r, F.q4, { poang: -3 }, fragor);
    assert.equal(r.fragor.q4.poang, 0);
  });
  it("bedom med ratt OCH poäng över max kläms också (annars nekar reglerna totalen > max)", () => {
    const r = bedom(ny("e"), F.q4, { ratt: true, poang: 99 }, fragor);
    assert.equal(r.fragor.q4.poang, 2.5, "kläms till max 2,5");
    assert.ok(r.totalPoang <= r.maxPoang);
    assert.equal(bedom(ny("e"), F.q4, { ratt: false, poang: -3 }, fragor).fragor.q4.poang, 0);
    assert.equal(bedom(ny("e"), F.q4, { ratt: "delvis", poang: 1.3 }, fragor).fragor.q4.poang, 1.5, "halva steg");
  });
  it("manuell Delvis ger aldrig 0 p eller full poäng (F2): minst 0,5, högst max − 0,5", () => {
    for (const [max, vant] of [[0.5, 0.5], [1, 0.5], [1.5, 0.5], [2, 1], [2.5, 1], [3, 1.5], [7, 3.5], [20, 10]]) {
      assert.equal(delvisPoang(max), vant, `max ${max}`);
      assert.equal(poangFor("delvis", max, null), vant, `poangFor max ${max}`);
    }
    assert.equal(delvisPoang(0), 0);
    // q1 är värd 0,5 p: Delvis → 0,5 p (inte 0 p med markeringen delvis).
    const r = bedom(ny("e"), F.q1, { ratt: "delvis" }, fragor);
    assert.deepEqual([r.fragor.q1.poang, r.fragor.q1.ratt], [0.5, "delvis"]);
    // En tidigare delpoäng mellan 0 och max behålls.
    const r2 = bedom(bedom(ny("e"), F.q6, { poang: 5.5 }, fragor), F.q6, { ratt: "delvis" }, fragor);
    assert.equal(r2.fragor.q6.poang, 5.5);
    // Från rätt (max) till Delvis → delvisPoang, inte max.
    const r3 = bedom(bedom(ny("e"), F.q6, { ratt: true }, fragor), F.q6, { ratt: "delvis" }, fragor);
    assert.equal(r3.fragor.q6.poang, 3.5);
  });
});

describe("batcharna (≤ 500 skrivningar)", () => {
  it("451 ändrade elever → 450 + 1; räkneverket i den första ger 451 ≤ 500", () => {
    const uids = Array.from({ length: 451 }, (_, i) => `e${i}`);
    const rattningar = Object.fromEntries(uids.map((u) => [u, ny(u)]));
    const res = rattaAlla({ med: uids, rattningar, fragor, svarAv: () => RATT, facit });
    assert.equal(res.andrade.length, 451, "en skrivning per elev");
    const b = delaIBatchar(res.andrade);
    assert.deepEqual(b.map((x) => x.length), [450, 1]);
    assert.ok(RATTNING_PER_BATCH + 1 <= 500);
    assert.deepEqual(delaIBatchar([]), [[]]);
    assert.deepEqual(delaIBatchar(uids.slice(0, 450)).map((x) => x.length), [450]);
  });
  it("tillbakalämnade och elever utan rättning räknas inte som skrivningar", () => {
    const rattningar = { a: ny("a"), b: { ...ny("b"), aterlamnad: true } };
    const res = rattaAlla({ med: ["a", "b", "saknas"], rattningar, fragor, svarAv: () => RATT, facit });
    assert.deepEqual(res.andrade, ["a"]);
    assert.equal(res.tillbaka, 1);
    assert.equal(sammanfattning(res, fragor).at(-1).text, "1 tillbakalämnat prov rördes inte.");
  });
});

describe("facit i efterhand – kantfall", () => {
  it("lucka utanför, ogiltig fråga, blanksteg, skiftläge", () => {
    assert.equal(facitMedTillagg(F.q5, facit.q5, "Balder", 9), null);
    assert.equal(facitMedTillagg(F.q5, facit.q5, "Balder", null), null, "lucktext utan lucka");
    assert.equal(facitMedTillagg(F.q1, facit.q1, "B"), null, "flerval har inget godkänt-svar");
    assert.equal(facitMedTillagg(F.q4, facit.q4, "   "), null);
    assert.equal(facitMedTillagg(F.q4, facit.q4, " BIRKA. "), null, "redan godkänt efter normaliseringen");
    assert.deepEqual(facitMedTillagg(F.q4, facit.q4, "  Björkö  ").godkanda, ["Birka", "Björkö"]);
    assert.equal(facit.q4.godkanda.length, 1, "facit muteras inte");
  });
});

// En liten deterministisk slumpgenerator (samma körning varje gång).
function slump(fro) {
  let s = fro >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const valj = (rnd, lista) => lista[Math.floor(rnd() * lista.length)];

describe("slumpad invariant-körning (300 elever, 3 körningar)", () => {
  it("poäng 0 … max i halva steg, exakt summa, total ≤ max, manuella/fritext orörda, idempotent", () => {
    const rnd = slump(764);
    const SVARSVAL = {
      q1: [0, 1, 2, null], q2: [[0, 1], [0], [2, 3], [], [0, 1, 2]], q3: [true, false, null],
      q4: ["Birka", "birka.", "Birkka", "Björkö", "", "  ", "Uppsala"], q5: [["Oden", "Tor", "Frej"], ["oden", "Torr", ""], ["", "", ""], ["x", "Tor", "Frej"]],
      q6: [["1", "2", "3"], ["1", "x", "y"], ["3", "1", "2"], []], q7: [["a", "b", "c", "d", "e"], ["b", "a", "c", "d", "e"], ["e", "d", "c", "b", "a"], []],
      q8: ["Text", ""], q9: ["7", "7,0", "8", ""],
    };
    const uids = Array.from({ length: 300 }, (_, i) => `e${i}`);
    const svar = Object.fromEntries(uids.map((u) => [u, Object.fromEntries(Object.entries(SVARSVAL).map(([k, v]) => [k, valj(rnd, v)]))]));
    const stav = valj(rnd, ["auto", "sjalv"]);
    const rattningar = Object.fromEntries(uids.map((u) => [u, ny(u, svar[u], stav)]));
    // Läraren hinner bedöma en del själv (också med poäng utanför 0 … max).
    const manuella = {};
    for (const u of uids) {
      if (rnd() < 0.3) {
        const f = valj(rnd, fragor);
        const andring = valj(rnd, [{ ratt: true }, { ratt: false }, { ratt: "delvis" }, { poang: 99 }, { poang: -2 }, { poang: rnd() * 8 }]);
        rattningar[u] = bedom(rattningar[u], f, andring, fragor);
        manuella[u] = { fid: f.id, post: structuredClone(rattningar[u].fragor[f.id]) };
      }
    }
    const fritext = Object.fromEntries(uids.map((u) => [u, structuredClone(rattningar[u].fragor.q8 ?? null)]));
    let fa = facit;
    for (let varv = 0; varv < 3; varv++) {
      const opt = { stavfel: stav, felKortsvarFel: varv !== 1 };
      rattaAlla({ med: uids, rattningar, fragor, svarAv: (u) => svar[u], facit: fa, opt });
      for (const u of uids) {
        const r = rattningar[u];
        for (const f of fragor) {
          const p = r.fragor[f.id];
          if (!p || p.poang == null) continue;
          assert.ok(p.poang >= 0 && p.poang <= f.poang, `${u}/${f.id}: ${p.poang} utanför 0 … ${f.poang}`);
          assert.ok(Number.isInteger(p.poang * 2), `${u}/${f.id}: ${p.poang} inte halvpoäng`);
          if (p.auto === true) {
            const vantad = p.poang >= f.poang ? true : p.poang <= 0 ? false : "delvis";
            assert.equal(p.ratt, vantad, `${u}/${f.id}: markeringen följer inte poängen (${p.poang} → ${p.ratt})`);
          }
        }
        const d = sparDok(r, fragor);
        assert.equal(d.totalPoang, summaPoang(fragor.map((f) => r.fragor[f.id]?.poang)));
        assert.ok(d.totalPoang <= d.maxPoang && d.totalPoang >= 0, `${u}: total ${d.totalPoang} av ${d.maxPoang}`);
        assert.ok(Number.isInteger(halvor(d.totalPoang)) && d.totalPoang * 2 === halvor(d.totalPoang));
        if (manuella[u] && manuella[u].fid !== "q8") assert.deepEqual(r.fragor[manuella[u].fid], manuella[u].post, `${u}: manuell skrevs över`);
        if (!(manuella[u]?.fid === "q8")) assert.deepEqual(r.fragor.q8 ?? null, fritext[u], `${u}: fritext rördes`);
      }
      // Identisk körning direkt efter: ingenting ändras.
      const igen = rattaAlla({ med: uids, rattningar, fragor, svarAv: (u) => svar[u], facit: fa, opt });
      assert.deepEqual(igen.andrade, [], `varv ${varv}: andra identiska körningen ändrade ${igen.andrade.length}`);
      if (varv === 0) fa = { ...fa, q4: facitMedTillagg(F.q4, fa.q4, "Björkö"), q5: facitMedTillagg(F.q5, fa.q5, "x", 0) };
    }
  });
  it("kompletteraForslag (vyn öppnas igen) rör inte autorättade eller manuella", () => {
    let r = rattaAllaElev(ny("e", { ...RATT, q4: "Uppsala" }), fragor, { ...RATT, q4: "Uppsala" }, facit).r;
    r = bedom(r, F.q1, { ratt: false }, fragor);
    const fore = structuredClone(r.fragor);
    const k = kompletteraForslag(r, fragor, { ...RATT, q4: "Uppsala" }, facit, "auto");
    assert.equal(k.andrad, false);
    assert.deepEqual(k.r.fragor, fore);
  });
});
