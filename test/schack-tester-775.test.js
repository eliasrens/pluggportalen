// ============================================================================
// Schack A (#775) – testarens egna angreppstester mot kontrollens API.
// 1) perft genom UI-vägen (tryck → markera → tryck mål → förvandlingsväljaren
//    → undo): antalet drag eleven kan göra måste stämma med de kända
//    perft-talen, dvs. bara lagliga drag visas och alla lagliga går att göra.
// 2) race/ordning: pågående beforeMove + avsluta/undo/setPosition, snabba tryck.
// Körs med: node --test test/schack-tester-775.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { skapaSchackKontroll } from "../src/schack/schack-kontroll.js";

/** Räknar löv på djup `d` genom att bara använda det eleven kan: tryck, mål, väljare, undo. */
function perft(k, d) {
  if (d === 0) return 1;
  let n = 0;
  const st = k.getState();
  if (st.slut) return 0;
  const egna = st.pjaser.filter((p) => p.color === st.tur).map((p) => p.ruta);
  for (const from of egna) {
    const r = k.tryck(from);
    if (r.typ !== "vald") continue;
    const mal = k.getState().mal.map((m) => m.to);
    for (const to of mal) {
      const svar = k.tryck(to);
      if (svar.typ === "forvandling") {
        for (const typ of ["q", "r", "b", "n"]) {
          // öppna väljaren igen efter varje val (undo nollställer)
          const s2 = k.valjForvandling(typ);
          assert.equal(s2.typ, "drag", `förvandling ${from}${to}=${typ}`);
          n += perft(k, d - 1);
          k.undo(1);
          k.tryck(from);
          k.tryck(to);
        }
        k.avbrytForvandling();
        k.avmarkera();
      } else {
        assert.equal(svar.typ, "drag", `${from}→${to} ska gå att göra`);
        n += perft(k, d - 1);
        k.undo(1);
      }
      k.tryck(from); // markera igen för nästa mål
    }
    k.avmarkera();
  }
  return n;
}

const POS = [
  ["utgång", undefined, [20, 400, 8902]],
  ["kiwipete", "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", [48, 2039]],
  ["pos 3 (bundna, en passant-schack)", "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", [14, 191, 2812]],
  ["pos 4 (förvandling, rockad i schack)", "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", [6, 264]],
  ["pos 5 (förvandling med slag)", "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", [44, 1486]],
];

describe("perft genom elevens väg (tryck/markera/mål/väljare)", () => {
  for (const [namn, fen, tal] of POS) {
    it(namn, () => {
      const k = skapaSchackKontroll(fen ? { fen } : {});
      tal.forEach((forvantat, i) => {
        assert.equal(perft(k, i + 1), forvantat, `${namn} djup ${i + 1}`);
        assert.equal(k.getState().drag.length, 0, "undo ska tömma historiken");
      });
    });
  }
});

describe("ordning och race", () => {
  it("avsluta medan beforeMove väntar: draget görs inte efter att partiet avslutats", async () => {
    let ok;
    const k = skapaSchackKontroll({ beforeMove: () => new Promise((r) => (ok = r)) });
    k.tryck("e2");
    const svar = k.tryck("e4");
    assert.equal(svar.typ, "vantar");
    k.avsluta({ resultat: "0-1", orsak: "gav-upp", vinnare: "b" });
    ok(true);
    await svar.klart;
    assert.equal(k.getFen().split(" ")[0], "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR", "inget drag efter avslut");
  });

  it("setPosition medan beforeMove väntar: gamla svaret får inte flytta i nya ställningen", async () => {
    let ok;
    const k = skapaSchackKontroll({ beforeMove: () => new Promise((r) => (ok = r)) });
    k.tryck("e2");
    const svar = k.tryck("e4");
    k.setPosition("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1");
    ok(true);
    await svar.klart;
    assert.equal(k.getFen(), "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1");
  });

  it("ny väntan startar medan gammal inte är klar: gamla svaret nollar inte nya väntan", async () => {
    const resolvers = [];
    const k = skapaSchackKontroll({ beforeMove: () => new Promise((r) => resolvers.push(r)) });
    k.tryck("e2");
    const a = k.tryck("e4");
    k.setPosition("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1");
    k.tryck("e2");
    const b = k.tryck("e4");
    assert.equal(b.typ, "vantar");
    resolvers[0](true);
    await a.klart;
    assert.ok(k.getState().pagaende, "andra väntan ska fortfarande vara pågående");
    resolvers[1](true);
    await b.klart;
    assert.equal(k.getState().drag.length, 1);
  });

  it("tryck under pågående och under förvandling ignoreras", async () => {
    let ok;
    const k = skapaSchackKontroll({ fen: "7k/4P3/8/8/8/8/8/K7 w - - 0 1", beforeMove: () => new Promise((r) => (ok = r)) });
    k.tryck("e7");
    assert.equal(k.tryck("e8").typ, "forvandling");
    assert.equal(k.tryck("a1").typ, "ingen");
    assert.equal(k.valjForvandling("x").typ, "ingen");
    const v = k.valjForvandling("q");
    assert.equal(v.typ, "vantar");
    assert.equal(k.tryck("a2").typ, "ingen");
    assert.equal(k.slapp("a1", "a2").typ, "ingen");
    assert.equal(k.valjForvandling("q").typ, "ingen");
    ok(true);
    await v.klart;
    assert.equal(k.getState().pjaser.find((p) => p.ruta === "e8").type, "q");
  });

  it("beforeMove som kastar fel nekar draget utan att ramla", () => {
    const k = skapaSchackKontroll({ beforeMove: () => { throw new Error("x"); } });
    k.tryck("e2");
    assert.equal(k.tryck("e4").typ, "nekad");
    assert.equal(k.getState().drag.length, 0);
  });

  it("beforeMove vars löfte avvisas (reject) nekar draget", async () => {
    const k = skapaSchackKontroll({ beforeMove: () => Promise.reject(new Error("nät")) });
    k.tryck("e2");
    const s = k.tryck("e4");
    await s.klart;
    assert.equal(k.getState().drag.length, 0);
    assert.equal(k.getState().pagaende, null);
  });

  it("setInteractive(false) medan en pjäs är markerad avmarkerar; drag nekas", () => {
    const k = skapaSchackKontroll();
    k.tryck("e2");
    k.setInteractive(false);
    assert.equal(k.getState().vald, null);
    assert.equal(k.tryck("e2").typ, "ingen");
    assert.equal(k.slapp("e2", "e4").typ, "ingen");
  });

  it("bara svart får flytta: vits pjäser kan inte markeras", () => {
    const k = skapaSchackKontroll({ interaktiv: "b" });
    assert.equal(k.tryck("e2").typ, "ingen");
  });

  it("slapp utanför brädet (to=null/undefined) markerar bara pjäsen, inget drag", () => {
    const k = skapaSchackKontroll();
    assert.equal(k.slapp("e2", null).typ, "vald");
    assert.equal(k.slapp("e2", undefined).typ, "vald");
    assert.equal(k.getState().drag.length, 0);
  });

  it("ogiltiga rutnamn och skräp kraschar inte", () => {
    const k = skapaSchackKontroll();
    for (const r of ["z9", "", null, undefined, "e22", 5, {}]) {
      assert.doesNotThrow(() => { k.tryck(r); k.slapp(r, "e4"); k.slapp("e2", r); k.valj(r); k.lagligaDrag(r); k.avmarkera(); });
    }
    assert.equal(k.move({ from: "e2", to: "e5" }), null);
    assert.equal(k.move("zzz"), null);
    assert.equal(k.move(null), null);
    assert.equal(k.setPosition("skräp"), false);
    assert.equal(k.loadGame({ drag: ["e4", "e4"] }), false);
    assert.equal(k.getFen().split(" ")[0], "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
  });

  it("onGameOver anropas en gång vid matt även med beforeMove-löfte", async () => {
    let slut = 0;
    const k = skapaSchackKontroll({ fen: "6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1", beforeMove: async () => true, onGameOver: () => slut++ });
    k.tryck("a1");
    const s = k.tryck("a8");
    await s.klart;
    assert.equal(slut, 1);
    assert.equal(k.tryck("e1").typ, "ingen", "inga drag efter matt");
  });

  it("ångra efter matt öppnar partiet igen", () => {
    const k = skapaSchackKontroll({ fen: "6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1" });
    k.tryck("a1");
    k.tryck("a8");
    assert.ok(k.getState().slut);
    k.undo(1);
    assert.equal(k.getState().slut, null);
    assert.equal(k.tryck("a1").typ, "vald");
  });
});
