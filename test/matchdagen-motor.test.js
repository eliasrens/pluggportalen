// ============================================================================
// Tester: Matchdagen 1b (#868) – den rena matchmotorn och ligan
// (src/matchdagen/delat/). Spec docs/UTVECKLINGSUPPDRAG_MATCHDAGEN.md §3, §5, §15:
//   • alla val med sina sannolikheter (seedad slump)
//   • skott: långskott går nästan aldrig in, ett perfekt avslut kan räddas
//   • hörnor, tacklingar, täckningar och räddningar
//   • matchklockan och halvtid
//   • två frågor för skott från Division 3 (kroken, §7.3)
//   • determinism: samma frö → samma match
// Ligan och renheten: test/matchdagen-liga.test.js.
// Ren node: node --test test/matchdagen-motor.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as M from "../src/matchdagen/delat/md-motor.js";
import * as C from "../src/matchdagen/delat/md-config.js";
import { KOMMENTAR } from "../src/matchdagen/delat/md-texter.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

const STYRKA = 0.2;
const bas = (extra = {}) => ({ ...M.nyMatch({ mot: { namn: "Ekebacka IF", styrka: STYRKA } }), ...extra });
const RATT = [true];
const FEL = [false];

/** Spela samma läge n gånger med olika frön → andelen där pred(h, m) gäller. */
function andel(m, valId, svar, pred, n = 4000) {
  let k = 0;
  for (let i = 0; i < n; i++) {
    const r = M.spela(m, valId, svar, skapaPrng(`t${i}`).tal);
    if (pred(r.h, r.m)) k++;
  }
  return k / n;
}
const nara = (v, mal, tol = 0.025) => assert.ok(Math.abs(v - mal) <= tol, `${v.toFixed(3)} ≠ ${mal.toFixed(3)} ± ${tol}`);

describe("valen när vi har bollen (§3.2)", () => {
  const m = bas({ x: 40 });
  it("läget visar fyra val, skott av bortom 45 m, frågor 1", () => {
    const l = M.lage(m);
    assert.equal(l.typ, "anfall");
    assert.deepEqual(l.val.map((v) => v.id), ["kort", "lang", "dribbla", "skjut"]);
    assert.ok(l.val.every((v) => v.fragor === 1));
    assert.equal(l.val[3].av, true);
    assert.equal(l.val[3].text, "För långt bort");
    assert.throws(() => M.spela(m, "skjut", RATT, Math.random), /skjut/);
  });
  it("skottknappens text följer avståndet", () => {
    assert.equal(M.skottText(46), "För långt bort");
    assert.equal(M.skottText(40), "Långt skott – liten chans");
    assert.equal(M.skottText(20), "Bra läge");
    assert.equal(M.skottText(10), "Jätteläge!");
  });
  for (const val of ["kort", "lang", "dribbla"]) {
    it(`${val}: chansen vid rätt och fel svar är formeln, och spelet följer den`, () => {
      const p = C.PASS[val];
      assert.equal(M.chansPass(val, true, {}, STYRKA), M.kl(p.ratt - STYRKA * C.PASS_STYRKA, 0, 1));
      assert.equal(M.chansPass(val, false, {}, STYRKA), M.kl(p.fel - STYRKA * C.PASS_STYRKA, 0, 1));
      assert.ok(M.chansPass(val, true, { MIT: 0.1 }, STYRKA) > M.chansPass(val, true, {}, STYRKA), "lagbonus hjälper");
      for (const [svar, ratt] of [[RATT, true], [FEL, false]]) {
        nara(andel(m, val, svar, (h) => h.utfall === "ok"), M.chansPass(val, ratt, {}, STYRKA));
      }
    });
  }
  it("ett lyckat pass går fram så långt som tabellen säger, ett brutet ger dem bollen där den är", () => {
    for (let i = 0; i < 300; i++) {
      const { h, m: ut } = M.spela(m, "lang", RATT, skapaPrng(`l${i}`).tal);
      const steg = h.till.x - h.fran.x;
      if (h.utfall === "ok") {
        assert.ok(steg >= C.PASS.lang.fram.min && steg <= C.PASS.lang.fram.max, steg);
        assert.equal(ut.boll, "oss");
        assert.equal(h.hojd, "bage");
      } else {
        assert.ok(steg >= C.BRUTET_FRAM.min && steg <= C.BRUTET_FRAM.max, steg);
        assert.equal(ut.boll, "dem");
        assert.match(h.rad, /^Rätt svar, men/);
      }
    }
  });
  it("fel svar på ett pass som bryts: \"Fel svar – motståndaren tar bollen.\"", () => {
    const rader = new Set();
    for (let i = 0; i < 200; i++) {
      const { h } = M.spela(m, "kort", FEL, skapaPrng(`f${i}`).tal);
      if (h.utfall === "bruten") rader.add(h.rad);
    }
    assert.deepEqual([...rader], ["Fel svar – motståndaren tar bollen."]);
  });
});

describe("skotten (§3.2)", () => {
  it("formeln: kl(bas − d × perMeter) × (1 − styrka × faktor) + anfallsbonus, fel svar = SKOTT.fel", () => {
    const s = C.SKOTT;
    assert.equal(M.chansSkott(20, true, {}, STYRKA), M.kl(s.bas - 20 * s.perMeter, s.min, s.max) * (1 - STYRKA * s.styrka));
    assert.equal(M.chansSkott(20, false, { ANF: 0.2 }, STYRKA), s.fel);
    assert.ok(M.chansSkott(20, true, { ANF: 0.05 }, STYRKA) > M.chansSkott(20, true, {}, STYRKA));
  });
  it("ett långskott går nästan aldrig in", () => {
    assert.ok(M.chansSkott(40, true, {}, STYRKA) <= 0.1);
    assert.ok(M.chansSkott(45, true, {}, STYRKA) <= 0.05);
    const p = andel(bas({ x: 56 }), "skjut", RATT, (h) => h.utfall === "mal");
    assert.ok(p <= 0.06, `långskott från 44 m: ${p}`);
  });
  it("även ett perfekt avslut kan räddas", () => {
    const max = M.chansSkott(0, true, {}, STYRKA);
    assert.ok(max <= C.SKOTT.max && max < 1);
    const ut = new Set();
    for (let i = 0; i < 400; i++) ut.add(M.spela(bas({ x: 98 }), "skjut", RATT, skapaPrng(`p${i}`).tal).h.utfall);
    assert.ok(ut.has("mal") && ut.has("raddning"), [...ut].join(","));
  });
  it("målchansen i spelet följer formeln (rätt och fel svar)", () => {
    const m = bas({ x: 80 });
    nara(andel(m, "skjut", RATT, (h) => h.utfall === "mal"), M.chansSkott(20, true, {}, STYRKA));
    nara(andel(m, "skjut", FEL, (h) => h.utfall === "mal"), C.SKOTT.fel);
  });
  it("mål: ställningen, målminuten och avspark för dem från mitten", () => {
    for (let i = 0; i < 200; i++) {
      const { h, m } = M.spela(bas({ x: 90, min: 12.4 }), "skjut", RATT, skapaPrng(`m${i}`).tal);
      if (h.utfall !== "mal") continue;
      assert.equal(m.oss, 1);
      assert.deepEqual(m.mal, [{ min: 13, lag: "oss" }]);
      assert.equal(m.boll, "dem");
      assert.deepEqual([m.x, m.y], [C.AVSPARK.x, C.AVSPARK.y]);
      assert.equal(m.stat.skottPaMal, 1);
      return;
    }
    assert.fail("inget mål på 200 försök");
  });
  it("inget mål: räddning, stolpe eller utanför – inspark för dem, eller hörna efter räddning vid rätt svar", () => {
    const ut = {};
    let raddRatt = 0;
    let horna = 0;
    for (let i = 0; i < 6000; i++) {
      const { h, m } = M.spela(bas({ x: 75 }), "skjut", RATT, skapaPrng(`h${i}`).tal);
      ut[h.utfall] = (ut[h.utfall] || 0) + 1;
      if (h.utfall === "raddning") raddRatt++;
      if (h.horna) {
        horna++;
        assert.equal(h.utfall, "raddning");
        assert.equal(m.boll, "oss");
        assert.equal(m.x, C.HORNA.x);
        assert.ok(m.y === C.HORNA.y || m.y === C.PLAN.bredd - C.HORNA.y);
        assert.equal(M.lage(m).horna, true);
        assert.match(M.lage(m).rad, /Hörna/);
        assert.equal(m.stat.horner, 1);
      } else if (h.utfall !== "mal") {
        assert.equal(m.boll, "dem");
        assert.equal(m.x, C.INSPARK_DERAS);
      }
    }
    assert.ok(ut.raddning && ut.stolpe && ut.utanfor && ut.mal);
    nara(horna / raddRatt, C.HORNA_CHANS, 0.04);
    for (let i = 0; i < 500; i++) {
      assert.ok(!M.spela(bas({ x: 75 }), "skjut", FEL, skapaPrng(`hf${i}`).tal).h.horna, "ingen hörna efter fel svar");
    }
  });
  it("från Division 3 kräver skottet två rätt i rad; fel på den första (finten) ger SKOTT.fintFel (§7.3)", () => {
    assert.equal(M.lage(bas({ x: 80, div: 2 })).val[3].fragor, 1);
    const m = bas({ x: 80, div: C.DUBBEL_SKOTT_FRAN_DIV });
    assert.ok(M.dubbelSkott(m.div));
    assert.equal(M.antalFragor(m, "skjut"), 2);
    assert.equal(M.antalFragor(m, "kort"), 1);
    assert.throws(() => M.spela(m, "skjut", RATT, Math.random), /2 svar/);
    assert.throws(() => M.spela(m, "skjut", [], Math.random), /2 svar/);
    assert.ok(M.behoverFraga(m, "skjut", []) && M.behoverFraga(m, "skjut", RATT));
    assert.ok(!M.behoverFraga(m, "skjut", FEL), "fel på finten: ingen fråga till");
    assert.ok(!M.behoverFraga(m, "skjut", [true, false]) && !M.behoverFraga(bas({ x: 80 }), "skjut", RATT));
    nara(andel(m, "skjut", FEL, (h) => h.utfall === "mal"), C.SKOTT.fintFel, 0.01);
    nara(andel(m, "skjut", [false, true], (h) => h.utfall === "mal"), C.SKOTT.fintFel, 0.01);
    nara(andel(m, "skjut", [true, false], (h) => h.utfall === "mal"), M.chansSkott(20, false, {}, STYRKA));
    nara(andel(m, "skjut", [true, true], (h) => h.utfall === "mal"), M.chansSkott(20, true, {}, STYRKA));
    const { h } = M.spela(m, "skjut", [false, true], skapaPrng("x").tal);
    if (h.utfall !== "mal") assert.ok(KOMMENTAR.dubbelFel.includes(h.rad));
  });
});

describe("när motståndarna har bollen (§3.3)", () => {
  it("på deras planhalva: automatiskt pass framåt, ingen fråga, ibland snett", () => {
    const m = bas({ boll: "dem", x: 70 });
    const l = M.lage(m);
    assert.equal(l.typ, "derasPass");
    assert.equal(M.antalFragor(m), 0);
    const p = C.DERAS_PASS;
    for (let i = 0; i < 200; i++) {
      const { h } = M.spela(m, null, [], skapaPrng(`d${i}`).tal);
      const steg = h.fran.x - h.till.x;
      assert.ok(steg >= p.fram.min * (p.bas + STYRKA * p.perStyrka) - 1e-9 && steg <= p.fram.max * (p.bas + STYRKA * p.perStyrka));
    }
    nara(andel(m, null, [], (h) => h.utfall === "snett"), M.chansSnett({}, STYRKA));
    assert.equal(M.chansSnett({ MIT: 0.05 }, STYRKA), M.chansSnett({}, STYRKA) + 0.05);
  });
  it("på vår planhalva: Tackla och Täck med sina chanser", () => {
    const m = bas({ boll: "dem", x: 40 });
    assert.deepEqual(M.lage(m).val.map((v) => v.id), ["tackla", "tack"]);
    for (const val of ["tackla", "tack"]) {
      const t = val === "tackla" ? C.TACKLA : C.TACK;
      assert.equal(M.chansForsvar(val, true, {}, STYRKA), t.ratt - STYRKA * C.FORSVAR_STYRKA);
      assert.equal(M.chansForsvar(val, false, {}, STYRKA), t.fel - STYRKA * C.FORSVAR_STYRKA);
      for (const [svar, ratt] of [[RATT, true], [FEL, false]]) {
        nara(andel(m, val, svar, (h) => h.utfall === "vunnen"), M.chansForsvar(val, ratt, {}, STYRKA));
      }
    }
  });
  it("Täck med rätt svar stoppar farten; annars tar de sig förbi", () => {
    const m = bas({ boll: "dem", x: 40 });
    for (let i = 0; i < 300; i++) {
      const { h, m: ut } = M.spela(m, "tack", RATT, skapaPrng(`s${i}`).tal);
      if (h.utfall === "vunnen") { assert.equal(ut.boll, "oss"); assert.equal(ut.stat.vunnaBollar, 1); continue; }
      assert.equal(h.utfall, "stoppad");
      assert.equal(h.fran.x - h.till.x, C.TACK_STOPP);
    }
    for (let i = 0; i < 300; i++) {
      const { h } = M.spela(m, "tackla", FEL, skapaPrng(`s${i}`).tal);
      if (h.utfall === "vunnen") continue;
      assert.equal(h.utfall, "forbi");
      assert.ok(h.fran.x - h.till.x >= C.FORBI.min && h.fran.x - h.till.x <= C.FORBI.max);
      assert.equal(h.rad, "Fel svar – de tar sig förbi.");
    }
  });
  it("deras skott: \"Kan målvakten rädda?\" – målchansen (bas + styrka) × (1 − räddning)", () => {
    const m = bas({ boll: "dem", x: 20 });
    const l = M.lage(m);
    assert.equal(l.typ, "derasSkott");
    assert.match(l.rad, /Ekebacka IF skjuter! Kan målvakten rädda\?/);
    assert.equal(M.antalFragor(m), 1);
    const r = C.RADDNING;
    assert.equal(M.chansRaddning(true, {}, STYRKA), M.kl(r.bas - STYRKA * r.perStyrka, r.min, r.max));
    assert.equal(M.chansRaddning(false, { MV: 0.2 }, STYRKA), r.fel);
    assert.equal(M.chansDerasMal(true, {}, STYRKA), (C.DERAS_SKOTT.bas + STYRKA * C.DERAS_SKOTT.perStyrka) * (1 - M.chansRaddning(true, {}, STYRKA)));
    for (const [svar, ratt] of [[RATT, true], [FEL, false]]) {
      nara(andel(m, null, svar, (h) => h.utfall === "mal"), M.chansDerasMal(ratt, {}, STYRKA));
    }
    const ut = {};
    for (let i = 0; i < 400; i++) {
      const { h, m: e } = M.spela(m, null, RATT, skapaPrng(`r${i}`).tal);
      ut[h.utfall] = 1;
      if (h.utfall === "mal") { assert.equal(e.dem, 1); assert.equal(e.boll, "oss"); assert.equal(e.x, C.AVSPARK.x); } else {
        assert.equal(e.boll, "oss");
        assert.equal(e.x, C.INSPARK_VAR, "inspark från vårt målområde");
        if (h.utfall === "raddning") assert.equal(e.stat.raddningar, 1);
      }
    }
    assert.deepEqual(Object.keys(ut).sort(), ["mal", "raddning", "utanfor"]);
  });
});

describe("matchklockan och halvtid (§3.1)", () => {
  /** Spela en hel match med ett enkelt val och svar ur frö. */
  function helMatch(seed, andelRatt = 0.7, nu0 = null) {
    const rng = skapaPrng(seed, "motor").tal;
    const elev = skapaPrng(seed, "elev").tal;
    let m = M.nyMatch({ mot: { namn: "FC Stjärnbo", styrka: 0.22 }, nu: nu0 });
    const handelser = [];
    const minuter = [];
    let nu = nu0;
    let halvtider = 0;
    while (!m.slut) {
      if (m.halvtid) { halvtider++; m = M.andraHalvlek(m, nu); continue; }
      const l = M.lage(m);
      const val = l.typ === "anfall" ? (l.d <= 28 ? "skjut" : "kort") : l.typ === "forsvar" ? "tackla" : null;
      const n = M.antalFragor(m, val);
      if (nu !== null) nu += 9000;
      const r = M.spela(m, val, Array.from({ length: n }, () => ({ ratt: elev() < andelRatt, kalla: "tabell:7" })), rng, nu ?? undefined);
      minuter.push([m.min, r.m.min, m.halvlek]);
      handelser.push(r.h);
      m = r.m;
    }
    return { m, handelser, minuter, halvtider };
  }
  it("varje läge flyttar klockan STEG_MIN, halvtid vid 45, slut vid 90", () => {
    const { m, minuter, halvtider, handelser } = helMatch("klocka");
    assert.equal(halvtider, 1);
    assert.equal(m.min, 90);
    assert.ok(m.slut);
    for (const [fore, efter, halvlek] of minuter) {
      const slut = halvlek * C.HALVLEK_MIN;
      const steg = efter - fore;
      if (efter < slut) assert.ok(steg >= C.STEG_MIN.min && steg <= C.STEG_MIN.max, steg);
      else assert.equal(efter, slut);
    }
    const lagen = handelser.length;
    const vantat = (2 * C.HALVLEK_MIN) / ((C.STEG_MIN.min + C.STEG_MIN.max) / 2);
    assert.ok(Math.abs(lagen - vantat) <= 8, `${lagen} lägen, väntat ~${vantat}`);
    for (const g of m.mal) assert.ok(g.min >= 1 && g.min <= 90);
  });
  it("halvtid: inget spel förrän Andra halvlek; laget som inte började gör avspark", () => {
    let m = bas({ min: 44.9 });
    m = M.spela(m, "kort", RATT, skapaPrng("ht").tal).m;
    assert.equal(m.halvtid, true);
    assert.equal(m.min, 45);
    assert.equal(M.lage(m).typ, "halvtid");
    assert.throws(() => M.spela(m, "kort", RATT, Math.random), /halvtid/);
    assert.throws(() => M.andraHalvlek(bas()), /inte halvtid/);
    const m2 = M.andraHalvlek(m);
    assert.deepEqual([m2.halvlek, m2.min, m2.boll, m2.x, m2.halvtid], [2, 45, "dem", C.AVSPARK.x, false]);
    const slut = M.spela({ ...m2, min: 89.5 }, null, [], skapaPrng("s").tal).m;
    assert.equal(slut.slut, true);
    assert.equal(M.lage(slut).typ, "slut");
    assert.throws(() => M.spela(slut, null, [], Math.random), /slut/);
  });
  it("statistiken (§3.6): frågor, rätt per källa, pass, skott och speltid med tak per läge", () => {
    const { m } = helMatch("stat", 0.7, 1_000_000);
    const s = m.stat;
    assert.ok(s.fragor > 10 && s.ratt <= s.fragor);
    assert.deepEqual(s.perKalla, { "tabell:7": { fragor: s.fragor, ratt: s.ratt } });
    assert.ok(s.passOk <= s.pass && s.skottPaMal <= s.skott && s.vunnaBollar >= 0);
    assert.equal(s.sekunder, 9 * m.lagen);
    const r = M.spela(bas({ senast: 0 }), "kort", RATT, skapaPrng("t").tal, 10 * 60_000).m;
    assert.equal(r.stat.sekunder, C.MAX_LAGE_S, "en elev som går ifrån räknas inte");
    const res = M.resultat(m);
    assert.equal(res.oss + res.dem, m.mal.length);
    assert.equal(res.utfall, m.oss > m.dem ? "vinst" : m.oss < m.dem ? "forlust" : "oavgjort");
  });
  it("determinism: samma frö och samma svar ger samma match; tillståndet är ren JSON", () => {
    const a = helMatch("frö-1");
    assert.deepEqual(helMatch("frö-1"), a);
    assert.notDeepEqual(helMatch("frö-2").handelser, a.handelser);
    assert.deepEqual(JSON.parse(JSON.stringify(a.m)), a.m);
  });
  it("spela ändrar inte tillståndet det får", () => {
    const m = bas({ x: 60 });
    const kopia = JSON.parse(JSON.stringify(m));
    M.spela(m, "lang", RATT, skapaPrng("o").tal, 5);
    assert.deepEqual(m, kopia);
  });
  it("felaktiga anrop kastar: fel antal svar, okänt val, ingen slump", () => {
    assert.throws(() => M.spela(bas(), "kort", [], Math.random), /1 svar/);
    assert.throws(() => M.spela(bas(), "tackla", RATT, Math.random), /tackla/);
    assert.throws(() => M.spela(bas(), "kort", RATT), /rng/);
    assert.throws(() => M.nyMatch({ mot: {} }), /styrka/);
  });
});

describe("kommentatorn och lagbonusen", () => {
  it("aldrig hånfull; fel svar säger vad som hände", () => {
    const alla = Object.values(KOMMENTAR).flat();
    assert.ok(alla.length >= 40);
    for (const rad of alla) assert.doesNotMatch(rad, /dålig|usel|pinsam|kass|dum|haha|skäms|loser|töntig/i, rad);
    assert.ok(KOMMENTAR.passFel.every((r) => r.startsWith("Fel svar")));
    assert.ok(KOMMENTAR.passBruten.includes("Rätt svar, men motståndaren bröt passningen."));
    assert.ok(KOMMENTAR.raddningRatt.includes("Målvakten räddar med en fantastisk parad!"));
    assert.ok(KOMMENTAR.mal.includes("Rakt upp i krysset!"));
  });
  it("lagbonus: (snittstjärnor − 2) × 0,05 per lagdel, startlaget 0", () => {
    const start = [{ pos: "MV", st: 2 }, { pos: "FÖR", st: 2 }, { pos: "FÖR", st: 2 }, { pos: "MIT", st: 2 }, { pos: "MIT", st: 2 }, { pos: "ANF", st: 2 }, { pos: "ANF", st: 2 }];
    assert.deepEqual(M.lagbonus(start), { MV: 0, FÖR: 0, MIT: 0, ANF: 0 });
    const b = M.lagbonus([{ pos: "MV", st: 4 }, { pos: "ANF", st: 5 }, { pos: "ANF", st: 3 }]);
    assert.ok(Math.abs(b.MV - 0.1) < 1e-12 && Math.abs(b.ANF - 0.1) < 1e-12 && b.MIT === 0);
  });
});
