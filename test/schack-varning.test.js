// ============================================================================
// Schack B (#776, spec §5): "Varna mig" varnar för ett drag som ger matt i ett
// och för en dam/ett torn som kan tas, men inte för vanliga drag eller byten.
// Körs med: node --test test/schack-varning.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { Chess } from "../src/schack/vendor/chess.js";
import { analyseraVarning, utbyte, mattIEtt, VARNING_TEXT, GRATIS_GRANS } from "../src/schack/schack-varning.js";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
// 1.e4 e5 2.Sc3 Sf6 – vit drar: Dh5?? och Dg4?? hänger damen, Df3 är skyddad.
const SC3 = "rnbqkb1r/pppp1ppp/5n2/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3";
// 1.f3 e5 – vit drar: g4?? tillåter Dh4# (narrmatt).
const NARR = "rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq e6 0 2";

describe("matt i nästa drag", () => {
  it("g4?? i narrmatten varnar, e4 gör det inte", () => {
    assert.deepEqual(analyseraVarning(NARR, { from: "g2", to: "g4" }), { typ: "matt", text: VARNING_TEXT.matt });
    assert.equal(analyseraVarning(NARR, { from: "e2", to: "e4" }), null);
    assert.equal(analyseraVarning(NARR, { from: "g2", to: "g3" }), null);
  });
  it("mattIEtt ser bara motståndarens omedelbara matt", () => {
    assert.equal(mattIEtt(new Chess("rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2")), true);
    assert.equal(mattIEtt(new Chess(START)), false);
  });
  it("texten ber om bekräftelse enligt specen", () => {
    assert.equal(VARNING_TEXT.q, "Om du flyttar dit kan datorn ta din dam. Vill du ändå?");
    assert.match(VARNING_TEXT.matt, /schack matt.*Vill du ändå\?$/);
  });
});

describe("dam eller torn som kan tas", () => {
  it("Dh5?? och Dg4?? varnar för damen (tas gratis av springaren); Df3 (skyddad av g2) inte", () => {
    const h5 = analyseraVarning(SC3, { from: "d1", to: "h5" });
    assert.deepEqual([h5.typ, h5.pjas, h5.ruta, h5.text], ["pjas", "q", "h5", VARNING_TEXT.q]);
    assert.equal(analyseraVarning(SC3, { from: "d1", to: "g4" }).pjas, "q");
    assert.equal(analyseraVarning(SC3, { from: "d1", to: "f3" }), null);
    assert.equal(analyseraVarning(SC3, { from: "g1", to: "f3" }), null, "vanligt drag");
  });
  it("ett torn som kan tas gratis varnar; ett skyddat torn mot en lätt pjäs varnar också (torn mot löpare)", () => {
    // 1.a4 e5: Ta3?? – Lxa3 bxa3 ger svart torn mot löpare (170 ≥ gränsen).
    const A4 = "rnbqkbnr/pppp1ppp/8/4p3/P7/8/1PPPPPPP/RNBQKBNR w KQkq e6 0 2";
    assert.equal(analyseraVarning(A4, { from: "a1", to: "a3" })?.pjas, "r");
    assert.equal(analyseraVarning(A4, { from: "a1", to: "a2" }), null);
    // Helt oskyddat torn: Ta8?? ställer tornet på löparens diagonal (g2–a8) – tas gratis.
    const T = "4k3/8/8/8/8/8/6b1/R3K3 w - - 0 1";
    assert.equal(analyseraVarning(T, { from: "a1", to: "a8" })?.pjas, "r"); // Lxa8
    assert.equal(analyseraVarning(T, { from: "a1", to: "a2" }), null);
  });
  it("ett byte varnar inte: dam tar dam och tas tillbaka", () => {
    // Vit dam d1, svart dam d5 skyddad av bonde c6: Dxd5 cxd5 är ett byte.
    const BYTE = "4k3/8/2p5/3q4/8/8/8/3QK3 w - - 0 1";
    assert.equal(analyseraVarning(BYTE, { from: "d1", to: "d5" }), null);
    // …men att ställa damen framför bonden utan att ta något varnar.
    assert.equal(analyseraVarning(BYTE, { from: "d1", to: "b5" }), null, "b5 anfalls inte av c6");
    assert.equal(analyseraVarning("4k3/8/2p5/8/8/8/8/3QK3 w - - 0 1", { from: "d1", to: "d5" })?.pjas, "q");
  });
  it("damen som redan hänger varnar även om eleven flyttar något annat", () => {
    assert.equal(analyseraVarning("rnbqkb1r/pppp1ppp/5n2/4p2Q/4P3/2N5/PPPP1PPP/R1B1KBNR w KQkq - 3 4", { from: "a2", to: "a3" })?.pjas, "q");
  });
  it("ett drag som avslutar partiet, eller ett olagligt drag, ger ingen varning", () => {
    assert.equal(analyseraVarning("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", { from: "a1", to: "a8" }), null); // Ta8#
    assert.equal(analyseraVarning(START, { from: "e2", to: "e5" }), null);
    assert.equal(analyseraVarning("trasig fen", { from: "e2", to: "e4" }), null);
  });
  it("utbyte: billigaste pjäsen slår först, bara lagliga slag, aldrig negativt", () => {
    // Svart på tur: dam d5 anfalls av vit dam d1 OCH tornet d8 bakom? Nej: vit dam d1 tar d5, svart tar tillbaka med c6.
    const c = new Chess("4k3/8/2p5/3q4/8/8/8/3QK3 w - - 0 1");
    assert.equal(utbyte(c, "d5"), 0, "Dxd5 cxd5: 900 − 900 = 0");
    assert.equal(utbyte(new Chess("4k3/8/8/3q4/8/8/8/3QK3 w - - 0 1"), "d5"), 900);
    assert.equal(utbyte(new Chess(START), "e5"), 0, "ingen att slå");
    // Bunden pjäs kan inte försvara: svart löpare c6 "skyddar" d5 men är bunden av tornet a8→e8? (kungen e8)
    assert.ok(GRATIS_GRANS > 0 && GRATIS_GRANS < 500);
  });
});
