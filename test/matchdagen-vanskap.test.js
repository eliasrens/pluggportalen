// ============================================================================
// Tester: Matchdagen 4 (#874) – vänskapsmatchens rena motor (src/matchdagen/delat/md-vanskap.js)
// och balansen (admin/md-balans-vanskap.mjs). Spec docs/UTVECKLINGSUPPDRAG_MATCHDAGEN.md §11.3, §12, §15.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as C from "../src/matchdagen/delat/md-config.js";
import { chansPass, chansForsvar, chansSkott, chansRaddning } from "../src/matchdagen/delat/md-motor.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";
import { VANSKAP_KOMMENTAR } from "../src/matchdagen/delat/md-texter.js";
import {
  nyVanskap, vLage, vSpela, vAndraHalvlek, vWalkover, vResultat, spegla, vy, motsida, giltigtVal,
} from "../src/matchdagen/delat/md-vanskap.js";
import { vanskapBalans, bedomVanskap, VANSKAP_RADER } from "../admin/md-balans-vanskap.mjs";

const lag = (namn, farg = "#ff0000") => ({ namn, farg, bonus: {} });
const fast = (v) => () => v;
/** Spela en hel match med fasta val och svar. */
function helMatch(seed, svar = () => ({ a: { val: "kort", ratt: true }, b: { val: "tackla", ratt: true } })) {
  const r = skapaPrng(seed).tal;
  let V = nyVanskap({ a: lag("Blixtarna IF"), b: lag("FC Omar", "#0000ff") });
  let n = 0;
  while (!V.slut && n++ < 500) {
    if (V.halvtid) { V = vAndraHalvlek(V); continue; }
    V = vSpela(V, svar(vLage(V)), r).V;
  }
  return V;
}

describe("vänskapsmatchens motor (§11.3)", () => {
  it("ny match: avspark för a, 0–0, båda lagen med namn, färg och bonus", () => {
    const V = nyVanskap({ a: lag("Blixtarna IF"), b: { namn: "x".repeat(40), farg: "red", bonus: { MIT: 9 } } });
    assert.equal(V.boll, "a");
    assert.deepEqual(V.stallning, { a: 0, b: 0 });
    assert.equal(V.lag.b.namn.length, C.LAGNAMN_MAX);
    assert.match(V.lag.b.farg, /^#[0-9a-f]{6}$/i);
    assert.equal(V.lag.b.bonus.MIT, 0.5); // klämd
    const l = vLage(V);
    assert.equal(l.typ, "spel");
    assert.equal(l.anf, "a");
    assert.equal(l.forsv, "b");
    assert.deepEqual(l.valAnf.map((v) => v.id), ["kort", "lang", "dribbla", "skjut"]);
    assert.equal(l.valAnf[3].av, true); // 50 m: för långt bort
    assert.deepEqual(l.valForsv.map((v) => v.id), ["tackla", "tack"]);
  });

  it("avståndet ses från anfallaren: a mot x = 100, b mot x = 0", () => {
    const V = { ...nyVanskap({ a: lag("A"), b: lag("B") }), x: 80 };
    assert.equal(vLage(V).d, 20);
    assert.equal(vLage({ ...V, boll: "b" }).d, 80);
  });

  it("ogiltiga val och tiden ute: anfallaren spelar kort pass, försvararen täcker; ett skott för långt bort går inte", () => {
    const l = vLage(nyVanskap({ a: lag("A"), b: lag("B") }));
    assert.equal(giltigtVal(l, "anf", "skjut"), "kort");
    assert.equal(giltigtVal(l, "anf", null), "kort");
    assert.equal(giltigtVal(l, "anf", "lang"), "lang");
    assert.equal(giltigtVal(l, "forsv", "flyga"), "tack");
    const { h } = vSpela(nyVanskap({ a: lag("A"), b: lag("B") }), {}, fast(0.99));
    assert.equal(h.val.a, "kort");
    assert.equal(h.val.b, "tack");
    assert.deepEqual(h.ratt, { a: false, b: false }); // uteblivet svar = fel
  });

  it("båda svaren räknas: anfallarens rätt hjälper, försvararens rätt stjälper", () => {
    const V = nyVanskap({ a: lag("A"), b: lag("B") });
    const andel = (rA, rF) => {
      let ok = 0;
      for (let i = 0; i < 4000; i++) {
        const { h } = vSpela(V, { a: { val: "kort", ratt: rA }, b: { val: "tackla", ratt: rF } }, skapaPrng(`p${rA}${rF}${i}`).tal);
        if (h.boll === "a") ok++;
      }
      return ok / 4000;
    };
    const ff = andel(false, false), rf = andel(true, false), fr = andel(false, true), rr = andel(true, true);
    assert.ok(rf > ff && rf > rr, `rätt anfall: ${rf}`);
    assert.ok(fr < ff && fr < rr, `rätt försvar: ${fr}`);
    const vantat = chansPass("kort", true, {}, 0) * (1 - chansForsvar("tackla", true, {}, 0) * C.VANSKAP.forsvar);
    assert.ok(Math.abs(rr - vantat) < 0.03, `${rr} ≈ ${vantat}`);
  });

  it("skottet: mål med chansSkott × (1 − räddning × vikt); målvaktens räddning är försvararens svar", () => {
    const V = { ...nyVanskap({ a: lag("A"), b: lag("B") }), x: 85 };
    let mal = 0;
    for (let i = 0; i < 4000; i++) {
      const { h, V: V2 } = vSpela(V, { a: { val: "skjut", ratt: true }, b: { val: "tackla", ratt: true } }, skapaPrng(`s${i}`).tal);
      assert.equal(h.typ, "skott");
      if (h.utfall === "mal") {
        mal++;
        assert.equal(V2.boll, "b"); // avspark för den andra
        assert.equal(V2.x, 50);
      }
    }
    const vantat = chansSkott(15, true, {}, 0) * (1 - chansRaddning(true, {}, 0) * C.VANSKAP.raddning);
    assert.ok(Math.abs(mal / 4000 - vantat) < 0.03, `${mal / 4000} ≈ ${vantat}`);
  });

  it("hörna efter räddning vid rätt svar: ett nytt skottläge för anfallaren nära mål (även för b)", () => {
    for (const s of ["a", "b"]) {
      let horna = null;
      for (let i = 0; i < 400 && !horna; i++) {
        const V = { ...nyVanskap({ a: lag("A"), b: lag("B"), avspark: s }), x: s === "a" ? 85 : 15 };
        const r = vSpela(V, { [s]: { val: "skjut", ratt: true }, [motsida(s)]: { val: "tack", ratt: true } }, skapaPrng(`h${s}${i}`).tal);
        if (r.h.horna) horna = r;
      }
      assert.ok(horna, `hörna för ${s}`);
      assert.equal(horna.V.boll, s);
      assert.equal(horna.V.horna, true);
      assert.ok(vLage(horna.V).d <= 10);
      assert.equal(horna.V.stat[s].horner, 1);
      assert.equal(horna.V.stat[motsida(s)].raddningar, 1);
    }
  });

  it("statistiken per sida: frågor, rätt och per källa för båda i varje läge", () => {
    const V = nyVanskap({ a: lag("A"), b: lag("B") });
    const { V: V2 } = vSpela(V, { a: { val: "kort", ratt: true, kalla: "tabell:7" }, b: { val: "tack", ratt: false, kalla: "omrade:so/vikingar" } }, fast(0.5));
    assert.deepEqual([V2.stat.a.fragor, V2.stat.a.ratt, V2.stat.b.fragor, V2.stat.b.ratt], [1, 1, 1, 0]);
    assert.deepEqual(V2.stat.a.perKalla["tabell:7"], { fragor: 1, ratt: 1 });
    assert.deepEqual(V2.stat.b.perKalla["omrade:so/vikingar"], { fragor: 1, ratt: 0 });
    assert.equal(V.lagen, 0); // V0 ändras inte
  });

  it("matchklockan: halvtid efter 45, andra halvlek med avspark för det andra laget, slut efter 90", () => {
    const r = skapaPrng("klocka").tal;
    let V = nyVanskap({ a: lag("A"), b: lag("B") });
    while (!V.halvtid) V = vSpela(V, {}, r).V;
    assert.equal(V.min, 45);
    assert.equal(vLage(V).typ, "halvtid");
    assert.throws(() => vSpela(V, {}, r));
    V = vAndraHalvlek(V);
    assert.equal(V.boll, "b");
    assert.equal(V.halvlek, 2);
    while (!V.slut) V = vSpela(V, {}, r).V;
    assert.equal(V.min, 90);
    assert.equal(vLage(V).typ, "slut");
    assert.ok(V.lagen >= 20 && V.lagen <= 40, `${V.lagen} lägen`);
  });

  it("oavgjort är tillåtet (inga straffar) och vinnaren är den med flest mål", () => {
    const V = { ...nyVanskap({ a: lag("A"), b: lag("B") }), slut: true, stallning: { a: 2, b: 2 } };
    assert.equal(vResultat(V).vinnare, null);
    assert.equal(vResultat({ ...V, stallning: { a: 1, b: 3 } }).vinnare, "b");
    assert.equal(vResultat(V).klar, true);
  });

  it("walkover: den andra sidan vinner, ställningen står kvar", () => {
    const V = vWalkover({ ...nyVanskap({ a: lag("A"), b: lag("B") }), stallning: { a: 3, b: 0 } }, "a");
    const res = vResultat(V);
    assert.equal(res.vinnare, "b");
    assert.equal(res.walkover, "a");
    assert.deepEqual(res.stallning, { a: 3, b: 0 });
    assert.equal(vLage(V).typ, "slut");
  });

  it("determinism: samma frö ger samma match", () => {
    const svar = (l) => ({ [l.anf]: { val: l.d <= 28 ? "skjut" : "kort", ratt: true }, [l.forsv]: { val: "tackla", ratt: false } });
    assert.deepEqual(helMatch("d1", svar), helMatch("d1", svar));
    assert.notDeepEqual(helMatch("d1", svar).mal, helMatch("d2", svar).mal.concat([{ x: 1 }]));
  });

  it("speglingen: b ser sig själv som oss, planen vänd och ställningen från sitt håll", () => {
    const V = { ...nyVanskap({ a: lag("A"), b: lag("B") }), x: 85 };
    let r = null;
    for (let i = 0; i < 400 && !r; i++) {
      const x = vSpela(V, { a: { val: "skjut", ratt: true }, b: { val: "tack", ratt: false } }, skapaPrng(`m${i}`).tal);
      if (x.h.utfall === "mal") r = x;
    }
    const ha = spegla(r.h, "a");
    const hb = spegla(r.h, "b");
    assert.equal(ha.typ, "anfall");
    assert.equal(ha.mal, "oss");
    assert.deepEqual(ha.stallning, [1, 0]);
    assert.equal(hb.typ, "derasSkott");
    assert.equal(hb.mal, "dem");
    assert.deepEqual(hb.stallning, [0, 1]);
    assert.equal(hb.fran.x, 100 - r.h.fran.x);
    assert.equal(hb.boll, "oss"); // avspark för b
    assert.equal(hb.val, "tack");
    const vb = vy(r.V, "b");
    assert.equal(vb.boll, "oss");
    assert.equal(vb.mot.namn, "A");
    assert.deepEqual([vb.oss, vb.dem], [0, 1]);
  });

  it("kommentaren nämner lagen vid namn och är aldrig hånfull", () => {
    const V = helMatch("text", (l) => ({ [l.anf]: { val: l.d <= 28 ? "skjut" : "lang", ratt: true }, [l.forsv]: { val: "tackla", ratt: true } }));
    assert.ok(V.lagen > 0);
    for (const lista of Object.values(VANSKAP_KOMMENTAR)) for (const t of lista) assert.doesNotMatch(t, /dålig|usel|pinsam|förlorare/i);
    const { h } = vSpela(nyVanskap({ a: lag("Blixtarna IF"), b: lag("FC Omar") }), { a: { val: "kort", ratt: true } }, fast(0.01));
    assert.match(h.rad, /Blixtarna IF/);
    assert.doesNotMatch(h.rad, /\{/);
  });
});

describe("vänskapsmatchens balans (§12, admin/md-balans-vanskap.mjs)", () => {
  for (const [ratt, stjarnor] of VANSKAP_RADER) {
    it(`${ratt.join(" mot ")} rätt, ${stjarnor.join(" mot ")}★: målen och tiden nås`, () => {
      const r = vanskapBalans({ ratt, stjarnor, n: 300 });
      assert.deepEqual(bedomVanskap(r, { ratt, stjarnor }), []);
    });
  }
  it("bedomVanskap fäller en konfiguration utanför målen", () => {
    const ok = { vinstA: 0.4, vinstB: 0.4, oavgjort: 0.2, malPerMatch: 2.2, lagen: 29, minuter: 7.3 };
    assert.deepEqual(bedomVanskap(ok, { ratt: [0.7, 0.7], stjarnor: [2, 2] }), []);
    assert.match(bedomVanskap({ ...ok, malPerMatch: 5 }, { ratt: [0.7, 0.7], stjarnor: [2, 2] }).join(), /mål/);
    assert.match(bedomVanskap({ ...ok, minuter: 11 }, { ratt: [0.7, 0.7], stjarnor: [2, 2] }).join(), /minuter/);
    assert.match(bedomVanskap({ ...ok, vinstA: 0.3, vinstB: 0.5 }, { ratt: [0.7, 0.5], stjarnor: [2, 2] }).join(), /fler rätt/);
  });
});
