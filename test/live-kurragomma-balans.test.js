// ============================================================================
// Kurragömma (#836): balanssimuleringen (spec §11.5) – en kort körning med de
// riktiga reglerna. Fäller en ändring i kg-config.js som flyttar matchen
// utanför riktmärkena. Hela tabellen: npm run balans:kurragomma.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spelaMatch, korBalans, NIVAER, tabell } from "../admin/kg-balans-sim.mjs";

describe("balansen (spec §11.5)", () => {
  it("en match: 25 elever, 3 startsökare, samma frö → samma match", () => {
    const a = spelaMatch({ seed: "t", andelRatt: 0.75 });
    assert.equal(a.elever.length, 25);
    assert.equal(a.elever.filter((e) => e.start === "sokare").length, 3);
    assert.equal(a.gomdaStart, 22);
    assert.ok(a.letMs > 0 && a.letMs <= 8 * 60_000);
    assert.deepEqual(spelaMatch({ seed: "t", andelRatt: 0.75 }), a);
    for (const e of a.elever) {
      assert.ok(e.poang >= e.rattPoang && e.rattPoang % 10 === 0, e.uid);
      if (e.start === "gomd" && e.roll === "gomd") assert.equal(e.hittadAt, undefined);
    }
  });

  const rader = NIVAER.map((andelRatt) => korBalans({ andelRatt, n: 30 }));
  for (const r of rader) {
    it(`${Math.round(r.andelRatt * 100)} % rätt: riktmärkena nås i medel`, () => {
      assert.ok(r.kvar >= 0.15 && r.kvar <= 0.4, `gömda kvar ${r.kvar}`);
      assert.ok(r.visslingarPerMin <= 6, `visslingar/min ${r.visslingarPerMin}`);
      assert.ok(r.andelRattPoang >= 0.6, `andel från rätt svar ${r.andelRattPoang}`);
      assert.ok(r.startsokare > 0 && r.hittade > 0 && r.klarade > 0);
    });
  }

  it("bättre svar lönar sig i alla roller", () => {
    for (const k of ["startsokare", "hittade", "klarade"]) {
      assert.ok(rader[0][k] < rader[2][k], k);
    }
  });

  it("tabellen skrivs ut med alla mått", () => {
    const t = tabell(rader, true);
    assert.match(t, /Gömda kvar/);
    assert.match(t, /Visslingar\/min/);
    assert.match(t, /Poäng från rätt svar/);
    assert.equal(t.split("\n").length, 5);
  });
});
