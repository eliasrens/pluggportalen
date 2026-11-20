// ============================================================================
// Matchdagen 3 (#873) – Testerns motorprov (ren, ingen emulator): inbjudan bara
// säsongen efter en vunnen Superliga, erbjudandet går ut nästa säsong, Mästarcupen
// QF/SF/F med straffar, ingen flyttas ned, legendklubben behåller pokaler/rekord/statistik.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MASTARCUP, TOPP_DIV } from "../src/matchdagen/delat/md-config.js";
import { matchKlar, nastaMatch, nyKarriar, nyLiga, nySasong } from "../src/matchdagen/delat/md-sasong.js";
import { cupKlar, cupMatch } from "../src/matchdagen/delat/md-cup.js";
import { mcKlar, mcLage, mcLottning, mcMatch, mcSchema, MC_MONSTER } from "../src/matchdagen/delat/md-mastarcup.js";
import { legendErbjudande, nyLegendklubb, skapet, historikRader, guldkant } from "../src/matchdagen/delat/md-legend.js";
import { lasRekord } from "../src/matchdagen/delat/md-rekord.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

const NU = Date.UTC(2026, 10, 20, 9);
const UID = "t873";
const STAT = { skott: 5, skottPaMal: 3, pass: 12, passOk: 9, tacklingar: 6, vunnaBollar: 4, raddningar: 2, horner: 1, derasSkott: 3,
  fragor: 28, ratt: 22, perKalla: { "tabell:7": { fragor: 28, ratt: 22 } }, sekunder: 420 };
const res = (oss, dem, x = {}) => ({ oss, dem, utfall: oss > dem ? "vinst" : oss < dem ? "forlust" : "oavgjort", mal: [{ min: 4, lag: "oss" }], stat: STAT, ...x });
const kopia = (v) => JSON.parse(JSON.stringify(v));

/** Spelar ligan (och cuperna) till slutet. ligaRes(i) ger ligamatchens resultat, mcRes(runda) Mästarcupens. */
function spelaSasong(K, r, { ligaRes = () => res(3, 0), mcRes = () => res(2, 1), tillsCupenKlar = false } = {}) {
  const logg = [];
  for (let i = 0; i < 80; i++) {
    if (tillsCupenKlar && logg.length && (mcLage(K).ute || mcLage(K).vann)) break;
    if (cupMatch(K, UID)) { K = cupKlar(K, { res: res(0, 1), nu: NU, matchId: `c${i}`, uid: UID, rng: r }).K; continue; }
    const mc = mcMatch(K, UID);
    if (mc) {
      logg.push({ omg: K.liga.omg, runda: mc.runda, final: mc.final, styrka: mc.mot.styrka });
      const ut = mcKlar(K, { res: mcRes(mc.runda), nu: NU, matchId: `mc${i}`, uid: UID, rng: r });
      assert.equal(ut.K.div, K.div, "divisionen ändras aldrig i Mästarcupen");
      K = ut.K;
      continue;
    }
    if (!nastaMatch(K)) break;
    K = matchKlar(K, { res: ligaRes(i), rng: r, nu: NU, matchId: `m${i}` }).K;
  }
  return { K, logg };
}

const r = skapaPrng("tester-873-motor").tal;
const K0 = nyKarriar({ namn: "Testarna FK", farg: "#e8473f", rng: r });
const SUPER = { ...K0, div: TOPP_DIV, sasong: 30, liga: nyLiga(TOPP_DIV, K0.klubb.farg, r) };

describe("#873 Tester: inbjudan och Mästarcupens schema", () => {
  it("vinst i Superligan → inbjudan till NÄSTA säsong; inte inbjuden samma säsong", () => {
    const { K } = spelaSasong(kopia(SUPER), r);
    assert.equal(K.mastarcup, "31-0");
    assert.ok(K.pokaler.some((p) => p.typ === "superliga" && p.sasong === 30));
    assert.equal(K.kval ?? null, null, "ingen kval i Superligan");
    assert.equal(mcLage(K).inbjuden, false, "säsong 30: inbjudan gäller 31");
    assert.equal(guldkant(K), true);
  });
  it("tvåan/förlorande Superligan → ingen inbjudan", () => {
    const { K } = spelaSasong(kopia(SUPER), r, { ligaRes: () => res(0, 3) });
    assert.ok(!K.mastarcup);
    assert.equal(K.div, TOPP_DIV, "sist i Superligan – ingen nedflyttning");
    assert.equal(nySasong(K, r).div, TOPP_DIV);
  });
  it("QF/SF/F efter omgång 3, 6, 8; motståndarna 0,86–0,95, svagast först, finalen sist; samma lottning vid omladdning", () => {
    const A = spelaSasong(kopia(SUPER), r).K;
    const B = nySasong(A, r);
    assert.deepEqual(mcSchema(B.liga.schema.length), [3, 6, 8]);
    assert.deepEqual(mcLottning(B, UID), mcLottning(kopia(B), UID));
    const { K, logg } = spelaSasong(B, r, { tillsCupenKlar: true });
    assert.deepEqual(logg.map((x) => [x.omg, x.runda, x.final]), [[3, 0, false], [6, 1, false], [8, 2, true]]);
    for (const x of logg) assert.ok(x.styrka >= MASTARCUP.styrka.min && x.styrka <= MASTARCUP.styrka.max);
    assert.ok(logg[0].styrka <= logg[1].styrka && logg[1].styrka <= logg[2].styrka);
    assert.equal(K.mastarcup, "31-3");
    assert.equal(mcLage(K).vann, true);
    assert.ok(K.pokaler.some((p) => p.typ === "mastarcup" && p.sasong === 31));
    assert.ok(new RegExp(`^${MC_MONSTER}$`).test(K.mastarcup));
  });
  it("oavgjort utan straffar kastar; straffförlust i semifinalen → ute (-u), ingen fler match, divisionen kvar", () => {
    const B = nySasong(spelaSasong(kopia(SUPER), r).K, r);
    let K = B;
    for (let i = 0; !mcMatch(K, UID); i++) {
      if (cupMatch(K, UID)) K = cupKlar(K, { res: res(0, 1), nu: NU, matchId: `c${i}`, uid: UID, rng: r }).K;
      else K = matchKlar(K, { res: res(3, 0), rng: r, nu: NU, matchId: `m${i}` }).K;
    }
    assert.throws(() => mcKlar(K, { res: res(1, 1), nu: NU, matchId: "x", uid: UID }), /oavgjord/);
    const { K: efter, logg } = spelaSasong(K, r, { mcRes: (runda) => (runda === 0 ? res(1, 1, { straffar: [5, 3], vann: true }) : res(2, 2, { straffar: [3, 4], vann: false })), tillsCupenKlar: true });
    assert.equal(logg.length, 2);
    assert.equal(efter.mastarcup, "31-2-u");
    assert.equal(mcLage(efter).ute, true);
    assert.equal(efter.div, TOPP_DIV);
    assert.ok(!efter.pokaler.some((p) => p.typ === "mastarcup"));
    assert.equal(legendErbjudande(efter), false);
  });
  it("inbjudan gäller bara säsongen efter: säsong 32 utan ny titel → inte inbjuden", () => {
    const A = spelaSasong(kopia(SUPER), r).K;
    const B = spelaSasong(nySasong(A, r), r, { ligaRes: () => res(0, 1), mcRes: () => res(0, 1) }).K;
    assert.equal(B.mastarcup, "31-1-u");
    const C = nySasong(B, r);
    assert.equal(mcLage(C).inbjuden, false);
    assert.equal(spelaSasong(C, r).logg.length, 0, "ingen Mästarcup säsong 32");
  });
});

describe("#873 Tester: legendklubben", () => {
  const A = spelaSasong(kopia(SUPER), r).K;
  const VUNNEN = spelaSasong(nySasong(A, r), r).K; // säsong 31, cupen vunnen, ligan klar
  it("erbjudandet gäller resten av säsongen och går ut nästa säsong", () => {
    assert.equal(legendErbjudande(VUNNEN), true);
    const nasta = nySasong(VUNNEN, r);
    assert.equal(legendErbjudande(nasta), false);
    assert.throws(() => nyLegendklubb(nasta, { namn: "Sen FK", farg: "#2ecc71", rng: r }));
  });
  it("den nya klubben: Division 6, nästa säsong, pokaler/rekord/summa/sasonger kvar, en stjärna, historikrad", () => {
    const L = nyLegendklubb(VUNNEN, { namn: "<b>Ny</b> FK", farg: "#2ecc71", rng: r });
    assert.equal(L.div, 0);
    assert.equal(L.sasong, 32);
    assert.equal(L.kassa, 600);
    assert.deepEqual(L.reserver, []);
    assert.deepEqual(L.marknad, []);
    assert.deepEqual(L.pokaler, VUNNEN.pokaler);
    assert.deepEqual(L.summa, VUNNEN.summa);
    assert.deepEqual(L.sasonger, VUNNEN.sasonger);
    assert.deepEqual(L.senaste, VUNNEN.senaste);
    const R0 = lasRekord(VUNNEN.rekord, 31), R1 = lasRekord(L.rekord, 32);
    for (const k of ["mm", "ms", "ss", "sv", "lt", "os", "ar", "sm"]) assert.deepEqual(R1[k], R0[k], `rekord ${k}`);
    assert.equal(L.klubb.legendStjarnor, 1);
    assert.ok(!/[<>]/.test(L.klubb.namn), "namnet rensat");
    assert.equal(L.klubbhistorik.length, 1);
    const [h] = historikRader(L.klubbhistorik);
    assert.equal(h.namn, "Testarna FK");
    assert.equal(h.fran, 1);
    assert.equal(h.till, 31);
    assert.equal(h.pokaler.superliga, 2, "säsong 30 och 31");
    assert.equal(h.pokaler.mastarcup, 1);
    assert.equal(L.mastarcup, null, "den gamla klubbens inbjudan (32-0) följer inte med");
    assert.equal(guldkant(L), false, "den nya klubben har inte vunnit Superligan");
    assert.ok(L.trupp.every((p) => p.st === 2 && p.xp === 0 && p.grundpelare));
    assert.ok(L.trupp.every((p) => !VUNNEN.trupp.some((q) => q.namn === p.namn && q.id === p.id && q.st !== 2)));
    const s = skapet(L.pokaler);
    assert.equal(s.find((x) => x.id === "superliga").antal, 2);
    assert.equal(s.find((x) => x.id === "mastarcup").antal, 1);
    assert.equal(L.liga.omg, 0, "en ny liga i Division 6");
    assert.equal(L.liga.lag.length, 6);
  });
  it("en andra legend räknar historiken från den förra klubbens slut och stjärnorna till 2", () => {
    const L = nyLegendklubb(VUNNEN, { namn: "Andra FK", farg: "#2ecc71", rng: r });
    const L2in = { ...L, div: TOPP_DIV, sasong: 50, pokaler: [...L.pokaler, { typ: "superliga", sasong: 49, namn: "x" }, { typ: "mastarcup", sasong: 50, namn: "y" }] };
    const L2 = nyLegendklubb(L2in, { namn: "Tredje FK", farg: "#e8473f", rng: r });
    const h = historikRader(L2.klubbhistorik);
    assert.equal(h.length, 2);
    assert.deepEqual([h[1].fran, h[1].till], [32, 50]);
    assert.deepEqual([h[1].pokaler.superliga, h[1].pokaler.mastarcup], [1, 1]);
    assert.equal(L2.klubb.legendStjarnor, 2);
  });
  it("trasiga dokument: historikRader och skapet tål skräp", () => {
    assert.deepEqual(historikRader(["<x>", null, 5, "a|#zzz|1-2|1.1.1.1.1", "a|#2f6fe8|1-2|1.1"]), []);
    assert.equal(skapet([null, { typ: "superliga" }, "x", { typ: "liga", namn: "Vinnare Superligan", sasong: 3 }]).find((x) => x.id === "superliga").antal, 2);
  });
});
