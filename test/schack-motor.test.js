// ============================================================================
// Schack B (#776, spec §5): motorn – hittar matt i ett på Tornet och Damen,
// Bonden väljer inte alltid bäst (fast slumptal), tidsgränsen hålls, alla
// drag är lagliga enligt chess.js publika API, och chess.js snabba väg finns.
// Körs med: node --test test/schack-motor.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { Chess } from "../src/schack/vendor/chess.js";
import {
  valjDrag, analysera, valjEnligtNiva, skapaSlump, utvardera, nivaFor, arMatt, ruta,
  NIVAER, MOTOR_KRAV, TIDSGRANS_MS,
} from "../src/schack/schack-motor.js";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const MITT = "r2q1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PPQ1BPPP/R4RK1 w - - 0 11";
const KOMPLEX = "r1bq1rk1/pp2nppp/2n1p3/3pP3/2pP4/P1P1BN2/2P1QPPP/R3KB1R w KQ - 0 12";
const MATT_I_ETT = [
  ["6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", "a1", "a8"], // Ta8#
  ["r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4", "h5", "f7"], // Dxf7# (skolmatt)
  ["r5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1", "a8", "a1"], // svart: Ta1#
  ["6k1/4Pppp/8/8/8/8/8/K7 w - - 0 1", "e7", "e8"], // e8=D#
  ["3k4/R7/3K4/8/8/8/8/8 w - - 0 1", "a7", "a8"], // Ta8# (kungarna mittemot varandra)
];
const san = (fen, d) => new Chess(fen).move({ from: d.from, to: d.to, promotion: d.promotion }).san;

describe("chess.js snabba väg (interna metoder motorn bygger på)", () => {
  it("finns i den vendorade versionen", () => {
    const c = new Chess();
    for (const k of MOTOR_KRAV) assert.equal(typeof c[k], "function", k);
    assert.ok(Array.isArray(c._board) && c._board.length === 128);
    assert.equal(c._turn, "w");
    assert.equal(typeof c._hash, "bigint");
  });
  it("0x88-index → ruta", () => {
    assert.equal(ruta(0), "a8");
    assert.equal(ruta(119), "h1");
    assert.equal(ruta(0x34), "e5");
  });
  it("utgångsställningen värderas lika för båda", () => {
    assert.equal(utvardera(new Chess()), 0);
    assert.ok(utvardera(new Chess("4k3/8/8/3q4/8/8/8/4K3 w - - 0 1")) < -800, "vit saknar damen");
  });
});

describe("matt i ett (§5): Tornet och Damen hittar det alltid", () => {
  for (const nivaId of ["tornet", "damen"]) {
    it(nivaId, () => {
      for (const [fen] of MATT_I_ETT) {
        const r = valjDrag(fen, { niva: nivaId, seed: 7 });
        const c = new Chess(fen);
        c.move({ from: r.drag.from, to: r.drag.to, promotion: r.drag.promotion });
        assert.ok(c.isCheckmate(), `${nivaId} ${fen}: ${r.drag.from}${r.drag.to} är inte matt`);
        assert.ok(arMatt(r.varde), "mattvärde");
      }
    });
  }
  it("Tips (analysera) hittar också matten och flaggar den", () => {
    const r = analysera(MATT_I_ETT[1][0]);
    assert.deepEqual([r.drag.from, r.drag.to, r.matt], ["h5", "f7", true]);
    assert.equal(san(MATT_I_ETT[1][0], r.drag), "Qxf7#");
  });
  it("väljer den snabbaste matten: matt i ett före matt i två", () => {
    // Damen kan både göra matt direkt (Dg7#? nej) – ställning med matt i ett OCH långsammare vinster.
    const fen = "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1"; // Df8# och Df7-g7#? bara Df8/Dh7 är matt
    const r = valjDrag(fen, { niva: "damen" });
    const c = new Chess(fen);
    c.move(r.drag);
    assert.ok(c.isCheckmate(), `${r.drag.from}${r.drag.to}`);
  });
});

describe("nivåerna (§3.2)", () => {
  // Fri svart dam på d5: Dxd5 är överlägset bäst (+900).
  const FRI_DAM = "4k3/8/8/3q4/8/8/8/3QK3 w - - 0 1";
  it("Tornet och Damen tar damen – alltid, oavsett seed", () => {
    for (const nivaId of ["tornet", "damen"]) {
      for (const seed of [1, 2, 3]) {
        const r = valjDrag(FRI_DAM, { niva: nivaId, seed });
        assert.deepEqual([r.drag.from, r.drag.to], ["d1", "d5"], `${nivaId} seed ${seed}`);
      }
    }
  });
  it("Bonden väljer inte alltid det bästa draget – men ibland (fast slumptal)", () => {
    const val = new Set();
    for (let seed = 1; seed <= 24; seed++) {
      const r = valjDrag(FRI_DAM, { niva: "bonden", seed });
      val.add(`${r.drag.from}${r.drag.to}`);
      assert.equal(r.djup, 1);
      assert.ok(r.kandidater.length >= 2 && r.kandidater[0].varde >= r.kandidater[1].varde, "kandidater sorterade");
    }
    assert.ok(val.has("d1d5"), "tar damen ibland");
    assert.ok(val.size >= 2, `bara ${[...val]} – Bonden ska inte alltid välja bäst`);
  });
  it("samma seed → samma drag (Bonden och Springaren)", () => {
    for (const niva of ["bonden", "springaren"]) {
      const a = valjDrag(MITT, { niva, seed: 42 });
      const b = valjDrag(MITT, { niva, seed: 42 });
      assert.deepEqual(a.drag, b.drag, niva);
    }
  });
  it("Springaren tänker två drag, Tornet tre; Damen minst fyra när tiden räcker", () => {
    assert.equal(valjDrag(START, { niva: "springaren", seed: 1 }).djup, 2);
    assert.equal(valjDrag(START, { niva: "tornet" }).djup, 3);
    assert.ok(valjDrag(START, { niva: "damen", tidsgransMs: 2000 }).djup >= 4);
  });
  it("valjEnligtNiva: Tornet/Damen = bäst; Bonden kan hoppa över slag och välja bland de näst bästa", () => {
    const poang = [
      { m: { captured: "q", from: 1, to: 2 }, v: 900 }, { m: { from: 3, to: 4 }, v: 40 }, { m: { from: 5, to: 6 }, v: -20 }, { m: { from: 7, to: 8 }, v: -500 },
    ];
    assert.equal(valjEnligtNiva(poang, nivaFor("tornet"), skapaSlump(1)), poang[0]);
    assert.equal(valjEnligtNiva(poang, nivaFor("damen"), skapaSlump(1)), poang[0]);
    const bond = new Set();
    for (let s = 1; s < 40; s++) bond.add(valjEnligtNiva(poang, nivaFor("bonden"), skapaSlump(s)));
    assert.ok(bond.has(poang[1]) || bond.has(poang[2]), "väljer ibland ett icke-slag");
    assert.ok(!bond.has(poang[3]), "aldrig ett drag långt under det bästa");
    assert.equal(valjEnligtNiva([], nivaFor("bonden"), skapaSlump(1)), null);
  });
  it("okänd nivå → standardnivån; NIVAER har fyra rader med pjäs och text", () => {
    assert.equal(nivaFor("x").id, "bonden");
    assert.deepEqual(NIVAER.map((n) => n.id), ["bonden", "springaren", "tornet", "damen"]);
    for (const n of NIVAER) assert.ok(n.namn && n.text && "pnrq".includes(n.pjas) && n.djup >= 1);
  });
});

describe("tidsgränsen (§3.1): högst ~1 s per drag, mätt", () => {
  it("Damen avbryter sökningen vid tidsgränsen och svarar med senaste färdiga djup", () => {
    const r = valjDrag(KOMPLEX, { niva: "damen", tidsgransMs: 150 });
    assert.ok(r.ms < 150 + 80, `tog ${r.ms.toFixed(0)} ms`);
    assert.ok(r.djup >= 1);
    assert.equal(san(KOMPLEX, r.drag).length > 0, true);
  });
  it("med en klocka som rusar (1 ms per avläsning): avbryts vid gränsen, lagligt drag ändå", () => {
    let t = 0;
    const r = valjDrag(MITT, { niva: "damen", tidsgransMs: 50, nu: () => (t += 1) });
    assert.ok(r.drag && san(MITT, r.drag));
    assert.ok(r.ms <= 50 + 5, `klockan stod på ${r.ms}`); // gränsen kontrolleras var 256:e nod
    assert.ok(r.djup < 5, "hann inte djupt");
  });
  it("standardgränsen är under en sekund och alla nivåer håller den i ett medelspel", () => {
    assert.ok(TIDSGRANS_MS <= 900);
    for (const n of NIVAER) {
      const r = valjDrag(MITT, { niva: n.id, seed: 3 });
      assert.ok(r.ms <= TIDSGRANS_MS + 100, `${n.id}: ${r.ms.toFixed(0)} ms`);
    }
  });
});

describe("slutspel och upprepning (F3)", () => {
  it("historiken följer med: en ställning som redan stått i partiet värderas som remi och undviks", () => {
    // Vit dam + kung mot kung: utan historik är Dd1–d2–d1 lika bra som allt annat; med den pressar motorn på.
    const fen = "8/8/8/4k3/8/8/8/Q3K3 w - - 0 1";
    const c = new Chess(fen);
    const slump = skapaSlump(9);
    let n = 0;
    while (!c.isGameOver() && n < 80) {
      if (c.turn() === "w") c.move(valjDrag(c.fen(), { niva: "damen", seed: 1, historik: { fen, drag: c.history() }, tidsgransMs: 250 }).drag);
      else { const m = c.moves(); c.move(m[Math.floor(slump() * m.length)]); }
      n++;
    }
    assert.ok(c.isCheckmate(), `slutade utan matt efter ${n} halvdrag (${c.isThreefoldRepetition() ? "upprepning" : c.fen()})`);
  });
  it("mop-up: den ensamma kungen vid kanten och den egna kungen nära är bättre än mitt på brädet", () => {
    const kant = utvardera(new Chess("7k/8/5K2/8/8/8/8/Q7 w - - 0 1"));
    const mitten = utvardera(new Chess("8/8/8/3k4/8/8/8/Q3K3 w - - 0 1"));
    assert.ok(kant > mitten + 50, `${kant} > ${mitten}`);
  });
  it("en trasig historik ignoreras (bara FEN:en används)", () => {
    const r = valjDrag(MITT, { niva: "tornet", historik: { fen: START, drag: ["e4", "e4", "Qxz9"] } });
    assert.ok(r && san(MITT, r.drag));
    assert.ok(new Chess().move(valjDrag(START, { niva: "tornet", historik: { drag: [] } }).drag));
  });
});

describe("alla drag är lagliga (slumpade partier per nivå, fast seed)", () => {
  for (const n of NIVAER) {
    it(n.id, () => {
      const c = new Chess();
      for (let i = 0; i < 24 && !c.isGameOver(); i++) {
        const r = valjDrag(c.fen(), { niva: n.id, seed: 100 + i, tidsgransMs: n.id === "damen" ? 120 : 400 });
        assert.ok(r, "ett drag när partiet inte är slut");
        assert.doesNotThrow(() => c.move({ from: r.drag.from, to: r.drag.to, promotion: r.drag.promotion }), `${n.id} drag ${i}: ${r.drag.from}${r.drag.to}`);
      }
    });
  }
  it("ingen ställning utan drag → null", () => {
    assert.equal(valjDrag("R5k1/5ppp/8/8/8/8/8/6K1 b - - 1 1", { niva: "tornet" }), null);
    assert.equal(analysera("7k/8/6Q1/8/8/8/8/K7 b - - 1 1"), null); // patt
  });
});
