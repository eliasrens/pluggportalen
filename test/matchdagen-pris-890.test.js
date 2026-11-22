// ============================================================================
// Matchdagen (#890): marknadens pristabell – 1★–3★ som förut (§12-ekonomin),
// 4★ 3 150 och 5★ 5 200 kr. Modulen (md-config.js MARKNAD.pris, md-trupp.js
// pris/kopInfo/kop) och reglerna (firestore.rules mdPris, mdKopTillagg).
// Reglerna själva prövas i test/firestore-rules-matchdagen-pris-890.test.js.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as C from "../src/matchdagen/delat/md-config.js";
import * as T from "../src/matchdagen/delat/md-trupp.js";
import { matchKlar, nyKarriar } from "../src/matchdagen/delat/md-sasong.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

const NU = Date.UTC(2026, 10, 22, 9);
const STAT = { skott: 5, skottPaMal: 3, pass: 12, passOk: 9, tacklingar: 6, vunnaBollar: 4, raddningar: 2, horner: 1, derasSkott: 3,
  fragor: 28, ratt: 20, perKalla: { "tabell:7": { fragor: 28, ratt: 20 } }, sekunder: 420 };
const kopia = (v) => JSON.parse(JSON.stringify(v));
const r = skapaPrng("pris-890").tal;
const K1 = matchKlar(nyKarriar({ namn: "Prisarna", farg: "#2f6fe8", rng: r }),
  { res: { oss: 2, dem: 1, utfall: "vinst", mal: [], stat: STAT }, rng: r, nu: NU, matchId: "m1" }).K;
const salu = (st) => ({ id: "kny", namn: "Ny Spelare", pos: "ANF", nr: 50, st, xp: 0 });
const med = (marknad, over = {}) => ({ ...kopia(K1), div: 7, marknad, kassa: 6000, ...over });
const regler = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");

describe("marknadens pristabell (#890)", () => {
  it("150, 560, 1 210, 3 150, 5 200 kr; säljs för halva; text som i ett dokument; ingen 6★", () => {
    assert.deepEqual(C.MARKNAD.pris, [0, 150, 560, 1210, 3150, 5200]);
    assert.deepEqual([1, 2, 3, 4, 5].map(T.pris), [150, 560, 1210, 3150, 5200]);
    assert.deepEqual([1, 2, 3, 4, 5].map(T.saljPris), [75, 280, 605, 1575, 2600]);
    assert.equal(T.pris("4"), 3150);
    assert.equal(T.pris(6), 0);
  });
  it("köpet drar 3 150 för 4★ och 5 200 för 5★; en krona för lite räcker inte", () => {
    for (const [st, kostnad] of [[4, 3150], [5, 5200]]) {
      const i = T.kopInfo(med([salu(st)]), "kny");
      assert.equal(i.kostnad, kostnad);
      assert.ok(i.kan && i.tillReserv, `${st}★ ersätter en grundpelare`);
      assert.equal(T.kop(med([salu(st)]), "kny").K.kassa, 6000 - kostnad);
      assert.equal(T.kopInfo(med([salu(st)], { kassa: kostnad - 1 }), "kny").orsak, "kassa");
    }
  });
  it("en marknad sparad före #890 (raden har inget pris) kostar det nya priset", () => {
    const sparad = T.marknadFranDok(["kny|Ny Spelare|ANF|50|5"]);
    assert.equal(T.kopInfo(med(sparad), "kny").kostnad, 5200);
  });
  it("reglerna: samma tabell, och kassatillägget räcker för det största överskottet i ett köp", () => {
    const pris = JSON.parse(regler.match(/function mdPris\(st\) \{ return (\[[^\]]+\])/)[1]);
    assert.deepEqual(pris, C.MARKNAD.pris);
    // En släppt köpt 5★ ger halva sitt pris; det billigaste köp som ersätter en grundpelare (minst 1★) är en 2★.
    const tillagg = Number(regler.match(/size\(\) > 0 \? ([0-9]+) : 0;/)[1]);
    assert.equal(tillagg, T.saljPris(5) - T.pris(2));
  });
});
