// ============================================================================
// Matchdagen (#868): balanssimuleringen (spec §12) – en kort körning med den
// riktiga motorn. Fäller en ändring i md-config.js som flyttar Division 6
// utanför målen. Hela tabellen: npm run balans:matchdagen.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spelaMatch, spelaSasong, korBalans, bedom, tabell, NIVAER, MAL } from "../admin/md-balans-sim.mjs";

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
