// ============================================================================
// Meteorstormen (#820): motorn – determinism, spegelvänd storm, sköld, laser,
// dragstråle och cachen. Ren node, ingen emulator (spec §10 "Motorn").
// Reglerna i övrigt (per elev, hjälp, händelser, attacker, slut): live-meteorstorm-regler.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { simulera, skapaMotor } from "../src/live/formats/meteorstorm/delat/ms-motor.js";
import { kanAgera, effektPerTryck } from "../src/live/formats/meteorstorm/delat/ms-agera.js";
import { skapaPrng } from "../src/live/formats/meteorstorm/delat/ms-prng.js";
import { STORLEKAR, SKOLD_TAK, ATTACKER, KAST_FLYGTID_MS, STEG_MS } from "../src/live/formats/meteorstorm/delat/ms-balans.js";
import { START, MIN10, cfg, enKlass, tryck, planFor, ensamMeteor, sista } from "./meteorstorm-hjalp.mjs";

/** En påhittad logg: elever i båda klasserna trycker slumpvis (seedat). */
function slumpLogg(seed = "logg", n = 600) {
  const rng = skapaPrng(seed, "test");
  const typer = ["skold", "laser", "laser", "skold", "drag", "spara"];
  return Array.from({ length: n }, (_, i) => ({
    id: `h${i}`, t: START + rng.heltal(0, MIN10 - 1), classId: rng.tal() < 0.5 ? "4B" : "4D",
    uid: `e${rng.heltal(1, 20)}`, typ: typer[rng.heltal(0, typer.length - 1)],
  }));
}

describe("Meteorstormen – determinism", () => {
  it("samma frö och logg → identiskt resultat (ny motor, cachad simulera, steg för steg)", () => {
    const c = cfg({ handlingar: slumpLogg() });
    const facit = skapaMotor(c);
    facit.satHandlingar(c.handlingar);
    for (const sek of [0, 61, 187.3, 333, 480.05, 599.9, 600, 700]) {
      const t = START + sek * 1000;
      const ny = skapaMotor(c);
      ny.satHandlingar(c.handlingar);
      assert.deepEqual(simulera(c, t), ny.tillstand(t), `t=${sek}`);
      assert.deepEqual(facit.tillstand(t), ny.tillstand(t), `steg för steg, t=${sek}`);
    }
  });

  it("ordningen i indata spelar ingen roll – samma t avgörs på id", () => {
    const logg = slumpLogg("ordning");
    const blandad = [...logg].reverse();
    assert.deepEqual(simulera(cfg({ handlingar: logg }), START + MIN10), simulera(cfg({ handlingar: blandad }), START + MIN10));

    // Två dragstrålar i exakt samma ögonblick: den med lägst id vinner, alltid.
    const { seed, m } = ensamMeteor();
    const t = START + m.spawnMs + 1000;
    const a = { id: "a", t, classId: "4B", typ: "drag", uid: "ahlaam" };
    const b = { id: "b", t, classId: "4B", typ: "drag", uid: "omar" };
    for (const lista of [[a, b], [b, a]]) {
      const s = simulera(cfg({ seed, handlingar: lista }), t + 1000);
      assert.equal(s.bidrag.ahlaam.drag, 1);
      assert.equal(s.bidrag.omar, undefined, "den andra ignoreras (en dragstråle i taget)");
    }
  });

  it("olika frön → olika stormar; samma frö → samma storm", () => {
    assert.deepEqual(planFor("x"), planFor("x"));
    assert.notDeepEqual(planFor("x"), planFor("y"));
    assert.deepEqual(planFor(12345), planFor(12345));
  });
});

describe("Meteorstormen – spegelvänd storm", () => {
  it("utan handlingar får alla stationer exakt samma skada (2, 3 och 4 stationer)", () => {
    for (const n of [2, 3, 4]) {
      const stationer = ["4A", "4B", "4C", "4D"].slice(0, n).map((classId, i) => ({ classId, aktiva: 10 + i * 5 }));
      for (const sek of [100, 300, 450, 599, 600]) {
        const s = simulera(cfg({ stationer }), START + sek * 1000);
        for (const st of s.stationer) {
          assert.equal(st.skrov, s.stationer[0].skrov, `${n} stationer, t=${sek}`);
          assert.equal(st.traffar, s.stationer[0].traffar);
        }
        const per = (c) => s.meteorer.filter((m) => m.mal === c).map((m) => [m.storlek, m.spawnMs, m.ankomstMs, m.bana]);
        for (const st of s.stationer) assert.deepEqual(per(st.classId), per("4A"));
      }
    }
  });
});

describe("Meteorstormen – sköld, laser och stora meteorer", () => {
  it("skölden tar skadan först", () => {
    const { seed, m } = ensamMeteor();
    const skada = STORLEKAR[m.storlek].skada;
    const per = effektPerTryck(enKlass(), "4B").skold;
    const n = Math.ceil(SKOLD_TAK / per);
    const c = enKlass({ seed, handlingar: tryck(n, m.spawnMs - 5000, "4B", "skold") });
    const fore = simulera(c, START + m.ankomstMs - STEG_MS).stationer[0];
    const efter = simulera(c, START + m.ankomstMs);
    assert.equal(efter.stationer[0].skrov, fore.skrov, "skrovet orört");
    assert.equal(efter.stationer[0].skold, fore.skold - skada);
    assert.equal(sista(efter.logg, (l) => l.meteor === `${m.n}.0`).typ, "skold");
  });

  it("skölden har tak 60", () => {
    const s = simulera(enKlass({ handlingar: tryck(500, 1000, "4B", "skold") }), START + 2000);
    assert.equal(s.stationer[0].skold, SKOLD_TAK);
  });

  it("laserladdningen förstör en inkommande meteor (liten/mellan = 1 skott) och tillskriver skottet", () => {
    const { seed, m } = ensamMeteor((x) => x.storlek !== "stor");
    const lp = effektPerTryck(enKlass(), "4B").laser;
    const n = Math.ceil(1 / lp);
    const c = enKlass({ seed, handlingar: tryck(n, m.spawnMs - 5000, "4B", "laser", "p", "ahlaam") });
    const fore = simulera(c, START + m.spawnMs - STEG_MS).stationer[0];
    assert.ok(fore.laddning >= 1 && fore.laddning < 2, "exakt ett skott laddat");
    const efter = simulera(c, START + m.ankomstMs);
    assert.equal(efter.stationer[0].skrov, fore.skrov);
    const ned = sista(efter.logg, (l) => l.typ === "nedskjuten");
    assert.equal(ned.meteor, `${m.n}.0`);
    assert.equal(ned.uid, "ahlaam");
    assert.equal(efter.bidrag.ahlaam.nedskjutna, 1);
  });

  it("en stor meteor kräver 2 skott (1 skott räcker inte – den slår ner med full skada)", () => {
    const { seed, m } = ensamMeteor((x) => x.storlek === "stor");
    const lp = effektPerTryck(enKlass(), "4B").laser;
    for (const [skott, traff] of [[1, true], [2, false]]) {
      const c = enKlass({ seed, handlingar: tryck(Math.ceil(skott / lp), m.spawnMs - 5000, "4B", "laser") });
      const fore = simulera(c, START + m.ankomstMs - STEG_MS).stationer[0];
      const efter = simulera(c, START + m.ankomstMs).stationer[0];
      if (traff) {
        assert.equal(efter.skrov, Math.max(0, fore.skrov - STORLEKAR.stor.skada), "1 skott: full skada");
      } else {
        assert.equal(efter.skrov, fore.skrov, "2 skott: nedskjuten");
        assert.equal(efter.nedskjutna, simulera(c, START + m.spawnMs - STEG_MS).stationer[0].nedskjutna + 1);
      }
    }
  });

  it("laddningen har tak 10 skott", () => {
    const s = simulera(enKlass({ handlingar: tryck(2000, 1000, "4B", "laser") }), START + 2000);
    assert.equal(s.stationer[0].laddning, 10);
  });
});

describe("Meteorstormen – dragstrålen", () => {
  it("flyttar nästa inkommande meteor till den andra stationen och respekterar väntetiden", () => {
    const { seed, m } = ensamMeteor();
    const t0 = m.spawnMs + 1000;
    const c = cfg({ seed, handlingar: [...tryck(1, t0, "4B", "drag", "d1", "ahlaam"), ...tryck(1, t0 + 5000, "4B", "drag", "d2", "omar")] });
    const s = simulera(c, START + t0 + 2 * STEG_MS);
    const kast = sista(s.logg, (l) => l.typ === "kast");
    assert.deepEqual([kast.classId, kast.mot, kast.uid, kast.meteor], ["4B", "4D", "ahlaam", `${m.n}.0`]);
    const flyger = s.meteorer.find((x) => x.id === `${m.n}.0`);
    assert.equal(flyger.mal, "4D");
    assert.equal(flyger.kastadAv, "4B");
    assert.equal(flyger.ankomstMs - flyger.spawnMs, KAST_FLYGTID_MS);
    // Andra dragstrålen 5 s senare ignoreras (10 s väntetid) – och servern nekar den.
    const slut = simulera(c, START + m.ankomstMs + 10_000);
    assert.equal(slut.stationer[0].kastade, 1);
    assert.equal(slut.bidrag.omar, undefined);
    const nek = kanAgera(cfg({ seed, handlingar: c.handlingar.slice(0, 1) }), START + t0 + 5000, "4B", "drag");
    assert.equal(nek.orsak, "vantetid");
    const ok = kanAgera(cfg({ seed, handlingar: c.handlingar.slice(0, 1) }), START + t0 + ATTACKER.milda.vantetidMs, "4B", "drag");
    assert.equal(ok.ok, true);
    // 4B slapp meteoren, 4D fick både sin egen kopia och den slungade.
    const skada = STORLEKAR[m.storlek].skada;
    assert.equal(slut.stationer[0].skadaTagen, simulera(cfg({ seed }), START + m.ankomstMs + 10_000).stationer[0].skadaTagen - skada);
    assert.ok(slut.logg.some((l) => l.typ === "traff" && l.classId === "4D" && l.fran === "4B"));
  });

  it("en slungad meteor kan skjutas ner av den mottagande klassen", () => {
    const { seed, m } = ensamMeteor((x) => x.storlek !== "stor");
    const t0 = m.spawnMs + 1000;
    const lp = effektPerTryck(cfg(), "4D").laser;
    const c = cfg({ seed, handlingar: [...tryck(1, t0, "4B", "drag"), ...tryck(Math.ceil(2 / lp), m.spawnMs - 5000, "4D", "laser", "l", "omar")] });
    const s = simulera(c, START + m.ankomstMs + 10_000);
    const ned = s.logg.find((l) => l.typ === "nedskjuten" && l.classId === "4D" && l.fran === "4B");
    assert.ok(ned, "4D sköt ner meteoren från 4B");
    assert.equal(ned.uid, "omar");
    assert.ok(!s.logg.some((l) => l.typ === "traff" && l.fran === "4B"));
  });

  it("väntar (armerad) tills en meteor kommer om ingen är på väg", () => {
    const { seed, m } = ensamMeteor();
    const c = cfg({ seed, handlingar: tryck(1, m.spawnMs - 3000, "4B", "drag") });
    const fore = simulera(c, START + m.spawnMs - 1000).stationer[0];
    assert.equal(fore.drag.armerad, true);
    assert.equal(kanAgera(c, START + m.spawnMs - 1000, "4B", "drag").orsak, "armerad");
    const efter = simulera(c, START + m.spawnMs + STEG_MS);
    assert.equal(efter.stationer[0].drag.armerad, false);
    assert.equal(sista(efter.logg, (l) => l.typ === "kast").meteor, `${m.n}.0`);
  });
});

describe("Meteorstormen – cachen (projektorn ritar nu − fördröjning)", () => {
  it("stegar vidare utan omräkning; spolar tillbaka bara när loggen ändrats före beräknad tid", () => {
    const c = cfg({ handlingar: slumpLogg("cache", 200).filter((h) => h.t < START + 300_000) });
    const motor = skapaMotor(c);
    motor.satHandlingar(c.handlingar);
    motor.tillstand(START + 300_000);
    assert.equal(motor.steg, 3000);
    motor.satHandlingar([...c.handlingar, { id: "sen", t: START + 400_000, classId: "4B", typ: "laser" }]);
    assert.equal(motor.steg, 3000, "handling efter beräknad tid → ingen omräkning");
    const tidig = [...c.handlingar, { id: "tidig", t: START + 100_000, classId: "4D", typ: "skold" }];
    motor.satHandlingar(tidig);
    assert.ok(motor.steg <= 1000, "handling före beräknad tid → tillbaka till kontrollpunkt");
    const ny = skapaMotor(c);
    ny.satHandlingar(tidig);
    assert.deepEqual(motor.tillstand(START + 450_000), ny.tillstand(START + 450_000));
  });

  it("tid bakåt (projektorn spolar) och sedan en sen handling ger samma svar som en ny motor", () => {
    const c = cfg({ handlingar: slumpLogg("bakat", 300) });
    const motor = skapaMotor(c);
    motor.satHandlingar(c.handlingar);
    motor.tillstand(START + 500_000);
    motor.tillstand(START + 120_000);
    const extra = [...c.handlingar, { id: "x", t: START + 200_000, classId: "4B", typ: "drag" }, { id: "y", t: START + 90_000, classId: "4D", typ: "laser" }];
    motor.satHandlingar(extra);
    motor.laggTill({ id: "z", t: START + 60_000, classId: "4B", typ: "skold" });
    const ny = skapaMotor(c);
    ny.satHandlingar([...extra, { id: "z", t: START + 60_000, classId: "4B", typ: "skold" }]);
    for (const sek of [100, 300, 600]) assert.deepEqual(motor.tillstand(START + sek * 1000), ny.tillstand(START + sek * 1000));
  });

  it("en hel match räknas fram snabbt (< 200 ms i node)", () => {
    const c = cfg({ seed: "fart", handlingar: slumpLogg("fart", 4000) });
    const t0 = performance.now();
    simulera(c, START + MIN10);
    assert.ok(performance.now() - t0 < 200);
  });
});
