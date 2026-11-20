// ============================================================================
// Tester #869: lärarens Hur går det? → Matchdagen får inte krascha på ett
// elevdokument som reglerna släpper igenom. Reglerna prövar inte VÄRDENA i
// dagar och summa.perKalla (test/firestore-rules-matchdagen-tester-869.test.js,
// T1), så en elev kan skriva null där – och då kastar elevRad/veckoRatt, och
// hela fliken för klassen visar "Kunde inte ladda Matchdagen" (QA-fynd T1).
// Fallen står som `todo` tills vyn (eller reglerna) tål det.
// ============================================================================

import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { installeraFirebaseStubbe } from "./helpers/firebase-stub-loader.js";
import { sekunderSenaste, veckoRatt } from "../src/matchdagen/delat/md-sasong.js";

const NU = Date.UTC(2026, 10, 20, 9);
let elevRad;
before(async () => {
  installeraFirebaseStubbe();
  ({ elevRad } = await import("../src/matchdagen/larare/md-larare-stat.js"));
});

const K = (over = {}) => ({ klubb: { namn: "Lag" }, div: 0, sasong: 1, dagar: {},
  summa: { matcher: 1, v: 1, o: 0, f: 0, gjorda: 1, inslappta: 0, fragor: 10, ratt: 7, spelminuter: 5, perKalla: { "tabell:7": { fragor: 10, ratt: 7 } } }, ...over });

describe("lärarens Matchdagen-flik tål ett trasigt elevdokument (#869 tester, T1)", () => {
  it("ett vanligt dokument ger en rad (kontroll)", () => {
    const r = elevRad({ id: "e1", namn: "Alva" }, K(), NU);
    assert.equal(r.matcher, 1);
  });
  it("perKalla med null bredvid en riktig källa", { todo: "T1: sort läser b[1].fragor på null" }, () => {
    const k = K();
    k.summa.perKalla = { a: null, "tabell:7": { fragor: 10, ratt: 7 } };
    assert.doesNotThrow(() => elevRad({ id: "e1", namn: "Alva" }, k, NU));
  });
  it("dagar med null (speltid 7 dagar)", { todo: "T1: sekunderSenaste läser v.sek på null" }, () => {
    assert.doesNotThrow(() => elevRad({ id: "e1", namn: "Alva" }, K({ dagar: { "2026-11-20": null } }), NU));
    assert.doesNotThrow(() => sekunderSenaste({ "2026-11-20": null }, NU));
  });
  it("veckolinjen: dagar med null eller en okänd nyckel", { todo: "T1: veckoRatt läser v.fragor på null / ut[NaN]" }, () => {
    assert.doesNotThrow(() => veckoRatt({ "2026-11-20": null }, NU));
    assert.doesNotThrow(() => veckoRatt({ x: { fragor: 1, ratt: 1 } }, NU));
  });
});
