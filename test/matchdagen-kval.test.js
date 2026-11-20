// ============================================================================
// Matchdagen 2a (#870): alla divisioner, kvalet och straffarna – den rena
// motorn (src/matchdagen/delat/md-straffar.js, md-kval.js, md-sasong.js).
// Spec docs/UTVECKLINGSUPPDRAG_MATCHDAGEN.md §7, §15:
//   • straffläggningen med sudden death och tidigt avgörande
//   • två frågor för skott från Division 3 (finten, md-motor.js – se också matchdagen-motor.test.js)
//   • ligan för 6, 8, 10 och 12 lag (stegen §7.1)
//   • kval och uppflyttning flyttar aldrig ner ett lag
// Ren node: node --test test/matchdagen-kval.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as M from "../src/matchdagen/delat/md-motor.js";
import * as C from "../src/matchdagen/delat/md-config.js";
import { avgjord, chansStraff, straffa, straffLage, straffStallning } from "../src/matchdagen/delat/md-straffar.js";
import { kvalKlar, kvalMatch, stegen } from "../src/matchdagen/delat/md-kval.js";
import { matchKlar, nastaMatch, nyKarriar, nyLiga, nySasong, sasongFro, tabellRader } from "../src/matchdagen/delat/md-sasong.js";
import { MOTSTANDARE } from "../src/matchdagen/delat/md-namn.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

const rng = (f = "t") => skapaPrng(f).tal;
const NU = Date.UTC(2026, 10, 20, 10);
const T = true;
const F = false;

/** En match efter slutsignalen: oavgjort och avgor → straffar väntar. */
function slutMatch({ oss = 1, dem = 1, avgor = true } = {}) {
  return { ...M.nyMatch({ mot: { namn: "Ekebacka IF", styrka: 0.3 }, avgor }), min: 90, halvlek: 2, slut: true, oss, dem };
}
/** Spela straffar med givna svar (ratt per straff, i ordningen vi, de, vi, de …) tills det är avgjort. */
function straffarMed(svar, m = slutMatch(), r = rng("s")) {
  const hs = [];
  for (let i = 0; straffLage(m); i++) {
    const ut = straffa(m, [{ ratt: svar[i % svar.length], kalla: "tabell:7" }], r, NU + i * 9000);
    m = ut.m;
    hs.push(ut.h);
  }
  return { m, hs };
}

describe("straffläggningen (§7.4)", () => {
  it("avgörs så fort ena laget inte kan komma ikapp", () => {
    assert.equal(avgjord({ oss: [T, T, T], dem: [F, F] }), null, "de har tre straffar kvar");
    assert.equal(avgjord({ oss: [T, T, T], dem: [F, F, F] }), "oss", "3 – 0 efter tre var");
    assert.equal(avgjord({ oss: [F, F, F, F], dem: [T, T, T] }), "dem", "vi kan bara nå 1");
    assert.equal(avgjord({ oss: [T, T, T, T, F], dem: [T, T, T, T] }), null);
    assert.equal(avgjord({ oss: [T, T, T, T, F], dem: [T, T, T, T, T] }), "dem");
    assert.equal(avgjord({ oss: [T, F, T, F, T], dem: [T, F, T, F, T] }), null, "lika efter fem → sudden death");
  });
  it("sudden death: avgjort först när omgången är slut och det skiljer", () => {
    const fem = [T, T, F, T, F];
    assert.equal(avgjord({ oss: [...fem, T], dem: fem }), null, "vi satte vår – de måste sätta sin");
    assert.equal(avgjord({ oss: [...fem, F], dem: fem }), null, "vi missade – de kan vinna");
    assert.equal(avgjord({ oss: [...fem, T], dem: [...fem, F] }), "oss");
    assert.equal(avgjord({ oss: [...fem, F], dem: [...fem, T] }), "dem");
    assert.equal(avgjord({ oss: [...fem, T, F], dem: [...fem, T, F] }), null);
    const max = Array(C.STRAFFAR.max).fill(T);
    assert.equal(avgjord({ oss: max, dem: max }), "oss", "aldrig ändlöst");
  });
  it("vi skjuter först, sedan de – fem var och sudden death; ställningen syns hela tiden", () => {
    const m = slutMatch();
    assert.ok(M.behoverStraffar(m));
    assert.ok(!M.arKlar(m));
    const l = straffLage(m);
    assert.deepEqual([l.lag, l.nr, l.fragor, l.sudden], ["oss", 1, 1, false]);
    assert.match(l.rad, /Straff 1/);
    const { m: m2, h } = straffa(m, [T], rng());
    assert.equal(straffLage(m2).lag, "dem");
    assert.match(straffLage(m2).rad, /Ekebacka IF skjuter/);
    assert.deepEqual(h.stallning, straffStallning(m2));
    assert.equal(h.typ, "straff");
    // Alla rätt för oss, alla fel för dem: aldrig fler än 5 + sudden death, avgjort tidigt oftast.
    const { m: slut, hs } = straffarMed([T, F]);
    assert.ok(slut.straffar.klar && M.arKlar(slut));
    assert.equal(straffLage(slut), null);
    assert.throws(() => straffa(slut, [T], rng()), /ingen straffläggning/);
    assert.ok(hs.at(-1).klar && hs.slice(0, -1).every((x) => !x.klar));
    assert.equal(hs.at(-1).vinnare, slut.straffar.vinnare);
    for (let i = 0; i < hs.length; i++) assert.equal(hs[i].lag, i % 2 ? "dem" : "oss");
  });
  it("ett svar per straff; svaren räknas i matchens statistik", () => {
    const m = slutMatch();
    assert.throws(() => straffa(m, [], rng()), /1 svar/);
    assert.throws(() => straffa(m, [T, T], rng()), /1 svar/);
    assert.throws(() => straffa(m, [T]), /rng/);
    const { m: slut, hs } = straffarMed([T, F, F, T]);
    assert.equal(slut.stat.fragor, hs.length);
    assert.equal(slut.stat.ratt, hs.filter((x) => x.ratt).length);
    assert.equal(slut.stat.perKalla["tabell:7"].fragor, hs.length);
    assert.ok(slut.stat.sekunder > 0);
  });
  it("chanserna: vår straff 0,82 / 0,20, deras 0,45 / 0,85 (seedad slump)", () => {
    assert.equal(chansStraff("oss", true), 0.82);
    assert.equal(chansStraff("oss", false), 0.2);
    assert.equal(chansStraff("dem", true), 0.45);
    assert.equal(chansStraff("dem", false), 0.85);
    const andel = (m, svar, n = 3000) => {
      let k = 0;
      for (let i = 0; i < n; i++) if (straffa(m, [svar], rng(`c${i}`)).h.mal) k++;
      return k / n;
    };
    const vi = slutMatch();
    const de = straffa(vi, [T], rng("a")).m; // nu är det deras tur
    for (const [m, svar, mal] of [[vi, T, 0.82], [vi, F, 0.2], [de, T, 0.45], [de, F, 0.85]]) {
      const v = andel(m, svar);
      assert.ok(Math.abs(v - mal) < 0.03, `${v} ≠ ${mal}`);
    }
  });
  it("inga straffar när matchen inte måste avgöras eller inte är oavgjord", () => {
    assert.equal(straffLage(slutMatch({ avgor: false })), null);
    assert.equal(straffLage(slutMatch({ oss: 2, dem: 1 })), null);
    assert.equal(straffLage({ ...slutMatch(), slut: false }), null);
    assert.equal(M.resultat(slutMatch({ oss: 2, dem: 1 })).vann, true);
    assert.equal(M.resultat(slutMatch()).vann, null, "straffarna väntar");
    assert.equal(M.resultat(slutMatch({ avgor: false })).vann, null, "oavgjord ligamatch");
  });
  it("resultatet: oavgjort på mål, straffarna och vem som gick vidare; samma frö → samma straffläggning", () => {
    const a = straffarMed([T, F, T]);
    const b = straffarMed([T, F, T]);
    assert.deepEqual(a.m, b.m);
    const r = M.resultat(a.m);
    assert.equal(r.utfall, "oavgjort");
    assert.equal(r.klar, true);
    assert.deepEqual(r.straffar, straffStallning(a.m));
    assert.equal(r.vann, a.m.straffar.vinnare === "oss");
    assert.ok(r.straffar[0] !== r.straffar[1]);
  });
  it("tillståndet är ren JSON (fortsätter efter omladdning)", () => {
    let m = slutMatch();
    for (let i = 0; i < 3; i++) m = JSON.parse(JSON.stringify(straffa(m, [i % 2 === 0], rng(`j${i}`)).m));
    assert.equal(m.straffar.oss.length + m.straffar.dem.length, 3);
    assert.equal(straffLage(m).lag, "dem");
  });
});

describe("Division 3 och uppåt: två frågor för skott (§7.3)", () => {
  for (const div of [0, 2, 3, 7]) {
    it(`Division ${C.DIVISIONER[div]}: ${M.dubbelSkott(div) ? "två" : "en"} fråga per skott`, () => {
      const m = { ...M.nyMatch({ mot: { namn: "X", styrka: 0.3 }, div }), x: 82 };
      assert.equal(M.antalFragor(m, "skjut"), div >= 3 ? 2 : 1);
      assert.equal(M.lage(m).val.find((v) => v.id === "skjut").fragor, div >= 3 ? 2 : 1);
      assert.equal(M.antalFragor(m, "kort"), 1, "passen är alltid en fråga");
    });
  }
});

describe("stegen och ligorna i alla divisioner (§7.1)", () => {
  it("åtta nivåer: Division 6 … Superligan, 6/6/8/8/10/10/12/12 lag", () => {
    assert.deepEqual(stegen(3).map((s) => [s.namn, s.lag, s.omgangar]), [
      ["Division 6", 6, 5], ["Division 5", 6, 5], ["Division 4", 8, 7], ["Division 3", 8, 7],
      ["Division 2", 10, 9], ["Division 1", 10, 9], ["Elitligan", 12, 11], ["Superligan", 12, 11]]);
    assert.deepEqual(stegen(3).filter((s) => s.nu).map((s) => s.div), [3]);
  });
  for (let div = 0; div <= C.TOPP_DIV; div++) {
    it(`${C.DIVISIONER[div]}: ${C.LAGANTAL[div]} lag med olika namn, ${C.LAGANTAL[div] - 1} omgångar, alla möter alla`, () => {
      const L = nyLiga(div, "#2f6fe8", rng(`l${div}`));
      const n = C.LAGANTAL[div];
      assert.equal(L.lag.length, n);
      assert.equal(new Set(L.lag.map((l) => l.namn)).size, n);
      assert.ok(L.lag.slice(1).every((l) => MOTSTANDARE.includes(l.namn) && l.farg !== "#2f6fe8"));
      assert.equal(L.schema.length, n - 1);
      const moten = new Set(L.schema.flatMap((o) => o.split("|").map((p) => p.split(":").sort().join("-"))));
      assert.equal(moten.size, (n * (n - 1)) / 2);
      const lo = C.STYRKA.bas + div * C.STYRKA.perDiv - C.STYRKA.spridning - 1e-9;
      assert.ok(L.lag.slice(1).every((l) => l.styrka >= Math.max(C.STYRKA.min, lo) && l.styrka <= C.STYRKA.max));
    });
  }
});

// ---- kvalet och uppflyttningen ----------------------------------------------

function stat(fragor = 28, ratt = 20) {
  return { skott: 5, skottPaMal: 3, pass: 12, passOk: 9, tacklingar: 6, vunnaBollar: 4, raddningar: 2, horner: 1, derasSkott: 3,
    fragor, ratt, perKalla: { "tabell:7": { fragor, ratt } }, sekunder: 420 };
}
const res = (oss, dem, extra = {}) => ({ oss, dem, utfall: oss > dem ? "vinst" : oss < dem ? "forlust" : "oavgjort",
  mal: [], stat: stat(), klar: true, straffar: null, vann: oss === dem ? null : oss > dem, ...extra });

/** Spela ligan till slut med samma resultat i varje match. */
function spelaLigan(K, [oss, dem], r = rng("liga")) {
  for (let i = 0; nastaMatch(K); i++) K = matchKlar(K, { res: res(oss, dem), rng: r, nu: NU, matchId: `m${K.sasong}-${i}` }).K;
  return K;
}

describe("kvalet: bara ligavinnaren, upp vid vinst, aldrig ned (§7.2)", () => {
  const K0 = nyKarriar({ namn: "Blixtarna", farg: "#2f6fe8", rng: rng("k") });
  it("ligavinnaren får en pokal och ett kval mot ett lag från divisionen ovanför", () => {
    const K = spelaLigan(K0, [6, 0]);
    const kv = kvalMatch(K);
    assert.ok(kv);
    assert.deepEqual([kv.div, kv.till], [0, 1]);
    assert.ok(!K.liga.lag.some((l) => l.namn === kv.mot.namn), "inte ett lag ur ligan");
    assert.ok(MOTSTANDARE.includes(kv.mot.namn));
    assert.notEqual(kv.mot.farg, K.klubb.farg);
    const s = C.STYRKA;
    assert.ok(kv.mot.styrka >= s.bas + s.perDiv - s.spridning - 1e-9 && kv.mot.styrka <= s.bas + s.perDiv + s.spridning + 1e-9, "styrka(div + 1)");
    assert.equal(K.pokaler.at(-1).namn, "Vinnare Division 6");
    assert.equal(nastaMatch(K), null);
  });
  it("tvåan och sämre: inget kval, samma division nästa säsong", () => {
    const K = spelaLigan(K0, [0, 3]);
    assert.ok(tabellRader(K)[0].id !== "oss");
    assert.equal(kvalMatch(K), null);
    const N = nySasong(K, rng());
    assert.equal(N.div, 0);
    assert.equal(N.kval, null);
  });
  it("vinst i kvalet: upp en division, pokalen, uppflyttningspengar – nästa säsong har rätt antal lag", () => {
    const K = spelaLigan(K0, [6, 0]);
    const ut = kvalKlar(K, { res: res(2, 1), nu: NU, matchId: "kval1" });
    assert.equal(ut.vann, true);
    assert.equal(ut.K.div, 1);
    assert.equal(ut.K.pokaler.at(-1).namn, "Kvalade upp till Division 5");
    assert.equal(ut.K.pokaler.at(-1).typ, "kval");
    assert.equal(ut.pengar, 300 + 300 + 50 + C.KASSA.uppflyttning);
    assert.equal(ut.K.kassa, K.kassa + ut.pengar);
    assert.equal(ut.match.typ, "kval");
    assert.equal(ut.match.div, 0, "matchen spelades från Division 6");
    assert.equal(ut.match.omg, undefined);
    assert.equal(ut.K.senaste[0].typ, "kval");
    assert.equal(ut.K.sasonger[0].kval, "upp");
    assert.equal(ut.K.summa.matcher, K.summa.matcher + 1);
    assert.equal(kvalMatch(ut.K), null);
    assert.throws(() => kvalKlar(ut.K, { res: res(2, 1), nu: NU, matchId: "igen" }), /inget kval/);
    const N = nySasong(ut.K, skapaPrng(sasongFro(ut.K, "u")).tal);
    assert.equal(N.div, 1);
    assert.equal(N.sasong, 2);
    assert.equal(N.liga.lag.length, C.LAGANTAL[1]);
    assert.equal(N.kval, null);
    assert.deepEqual(N.pokaler, ut.K.pokaler, "pokalerna följer med");
  });
  it("oavgjort kval avgörs på straffar – straffarna sparas i matchen och karriären", () => {
    const K = spelaLigan(K0, [6, 0]);
    const vinst = kvalKlar(K, { res: res(1, 1, { straffar: [4, 3], vann: true }), nu: NU, matchId: "kv" });
    assert.equal(vinst.K.div, 1);
    assert.deepEqual(vinst.match.straffar, [4, 3]);
    assert.deepEqual(vinst.K.kval.straffar, [4, 3]);
    assert.deepEqual(vinst.K.senaste[0].straffar, [4, 3]);
    assert.equal(vinst.K.summa.o, K.summa.o + 1, "på mål är det oavgjort");
    const forlust = kvalKlar(K, { res: res(0, 0, { straffar: [2, 4], vann: false }), nu: NU, matchId: "kv" });
    assert.equal(forlust.K.div, 0);
    assert.throws(() => kvalKlar(K, { res: res(1, 1, { vann: null }), nu: NU, matchId: "kv" }), /utan straffar/);
  });
  it("förlust i kvalet: kvar i divisionen, ny chans nästa säsong", () => {
    const K = spelaLigan(K0, [6, 0]);
    const ut = kvalKlar(K, { res: res(0, 1), nu: NU, matchId: "kv" });
    assert.equal(ut.vann, false);
    assert.equal(ut.K.div, 0);
    assert.equal(ut.K.pokaler.filter((p) => p.typ === "kval").length, 0);
    assert.equal(ut.K.sasonger[0].kval, "kvar");
    assert.equal(ut.pengar, 80 + 300);
    assert.equal(nySasong(ut.K, rng()).div, 0);
  });
  it("Superligan är toppen: ligavinnaren får pokalen men inget kval", () => {
    let K = { ...K0, div: C.TOPP_DIV, liga: nyLiga(C.TOPP_DIV, K0.klubb.farg, rng("sl")) };
    K = spelaLigan(K, [6, 0]);
    assert.equal(K.pokaler.at(-1).namn, "Vinnare Superligan");
    assert.equal(kvalMatch(K), null);
    assert.equal(nySasong(K, rng()).div, C.TOPP_DIV);
  });
  it("kvalet flyttar aldrig ned ett lag – inte ens med ett trasigt kval i dokumentet", () => {
    const K = spelaLigan(K0, [6, 0]);
    const trasig = { ...K, div: 4, kval: { ...K.kval, div: 1 } };
    assert.equal(kvalKlar(trasig, { res: res(0, 1), nu: NU, matchId: "a" }).K.div, 4);
    assert.equal(kvalKlar(trasig, { res: res(1, 0), nu: NU, matchId: "b" }).K.div, 4);
  });
  it("en lång karriär med slumpade resultat: divisionen går bara uppåt, en i taget, aldrig över Superligan", () => {
    const r = rng("karriar");
    let K = K0;
    let fore = K.div;
    let uppflyttningar = 0;
    for (let i = 0; i < 400; i++) {
      if (kvalMatch(K)) {
        const [o, d] = [Math.floor(r() * 3), Math.floor(r() * 3)];
        K = kvalKlar(K, { res: res(o, d, o === d ? { straffar: [5, 4], vann: r() < 0.5 } : {}), nu: NU, matchId: `k${i}` }).K;
      } else if (!nastaMatch(K)) K = nySasong(K, rng(`n${i}`));
      else K = matchKlar(K, { res: res(Math.floor(r() * 7), Math.floor(r() * 2)), rng: r, nu: NU, matchId: `m${i}` }).K;
      assert.ok(K.div >= fore && K.div <= fore + 1 && K.div <= C.TOPP_DIV, `${fore} → ${K.div}`);
      if (K.div > fore) uppflyttningar++;
      fore = K.div;
      if (!K.kval) assert.equal(K.liga.lag.length, C.LAGANTAL[K.div] ?? 0, "ligan har divisionens storlek");
    }
    assert.ok(uppflyttningar >= 3, `${uppflyttningar} uppflyttningar`);
  });
});
