// ============================================================================
// Matchdagen (#868): balanssimuleringen (spec §12) – en kort körning med den
// riktiga motorn. Fäller en ändring i md-config.js som flyttar Division 6
// utanför målen. Hela tabellen: npm run balans:matchdagen.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spelaMatch, spelaSasong, korBalans, bedom, tabell, divTabell, karriar, karriarTabell, tranatLag, NIVAER, MAL, SUPER } from "../admin/md-balans-sim.mjs";
import { TOPP_DIV } from "../src/matchdagen/delat/md-config.js";

describe("balansen i Division 6 (spec §12)", () => {
  it("en match och en säsong: samma frö → samma resultat; 6 lag, 5 omgångar", () => {
    const a = spelaMatch({ seed: "t", andelRatt: 0.7, styrka: 0.2 });
    assert.deepEqual(spelaMatch({ seed: "t", andelRatt: 0.7, styrka: 0.2 }), a);
    assert.ok(a.fragor > 10 && a.ratt <= a.fragor && a.sekunder > 0);
    const s = spelaSasong({ seed: "s", andelRatt: 0.5 });
    assert.equal(s.matcher.length, 5);
    assert.equal(Object.keys(s.tabell).length, 6);
    assert.ok(Object.values(s.tabell).every((r) => r.s === 5));
    assert.ok(s.placering >= 1 && s.placering <= 6);
  });

  const rader = NIVAER.map((andelRatt) => korBalans({ andelRatt, n: 200 }));
  for (const r of rader) {
    it(`${Math.round(r.andelRatt * 100)} % rätt: målen nås`, () => {
      assert.deepEqual(bedom(r), []);
    });
  }

  it("bättre svar lönar sig: fler vinster, fler egna mål, färre insläppta", () => {
    for (const k of ["vinst", "gjorda", "liga"]) assert.ok(rader[0][k] > rader[1][k] && rader[1][k] > rader[2][k], k);
    assert.ok(rader[0].insl < rader[2].insl);
  });

  it("bedom fäller en konfiguration utanför målen", () => {
    const ok = { ...rader[0] };
    assert.deepEqual(bedom(ok), []);
    assert.match(bedom({ ...ok, vinst: MAL[0.7].vinst[1] + 0.05 }).join(), /vinst/);
    assert.match(bedom({ ...ok, malPerMatch: 0.8 }).join(), /malPerMatch/);
    assert.match(bedom({ ...ok, matchMin: 4 }).join(), /matchMin/);
    assert.match(bedom({ ...rader[2], minstEttMal: 0.3 }).join(), /minstEttMal/);
    assert.match(bedom({ ...rader[2], jattestor: 0.05 }).join(), /jattestor/);
  });

  it("tabellen skrivs ut med alla mått", () => {
    const t = tabell(rader);
    assert.match(t, /Vinst/);
    assert.match(t, /Mål\/match/);
    assert.match(t, /Match \(min\)/);
    assert.equal(t.split("\n").length, 4);
    assert.match(tabell(rader, true), /^\| Rätt \|/);
  });
});

describe("balansen i alla divisioner (#870, spec §7, §12)", () => {
  it("Superligan: 80 % rätt med ett tränat lag (snitt 4★) vinner 45–55 %", () => {
    const r = korBalans({ andelRatt: SUPER.andelRatt, n: 150, div: TOPP_DIV, bonus: tranatLag(SUPER.stjarnor), namn: "super", stjarnor: SUPER.stjarnor });
    assert.deepEqual(bedom(r), []);
    assert.match(divTabell([r]), /Superligan \(4★\)/);
  });
  it("ligavinnaren spelar kvalet (oavgjort → straffar) – Superligan har inget kval", () => {
    let kval = 0;
    for (let i = 0; i < 40; i++) {
      const s = spelaSasong({ seed: `k${i}`, andelRatt: 0.8, div: 0 });
      assert.equal(!!s.kval, s.placering === 1);
      if (s.kval) {
        kval++;
        assert.equal(typeof s.kval.vann, "boolean");
        assert.equal(!!s.kval.straffar, s.kval.oss === s.kval.dem);
      }
    }
    assert.ok(kval > 10);
    assert.equal(spelaSasong({ seed: "s", andelRatt: 1, div: TOPP_DIV, bonus: tranatLag(5) }).kval, null);
  });
  it("Division 3 och uppåt är tuffare: färre egna mål med samma svar (finten, §7.3)", () => {
    const d2 = korBalans({ andelRatt: 0.7, n: 40, div: 2 });
    const d3 = korBalans({ andelRatt: 0.7, n: 40, div: 3 });
    assert.ok(d3.gjorda < d2.gjorda && d3.vinst < d2.vinst);
  });
  it("karriären går bara uppåt och tabellen skrivs ut", () => {
    const k = karriar({ andelRatt: 0.8, n: 4, sasonger: 6 });
    assert.equal(k.div[0].andel, 1);
    for (let d = 1; d < k.div.length; d++) assert.ok(k.div[d].andel <= k.div[d - 1].andel);
    assert.match(karriarTabell([k]), /Division 5/);
  });
});
