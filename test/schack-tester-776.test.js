// ============================================================================
// Schack B (#776) – testarens egna tester mot motorn, varningen, datorn och
// modulen. Anropar de riktiga modulerna (samma form som sidan använder).
// test.todo = en öppen bugg som testaren rapporterat (se rapporten till leaden).
// Körs med: node --test test/schack-tester-776.test.js
// ============================================================================

import { describe, it, test } from "node:test";
import assert from "node:assert/strict";

import { Chess } from "../src/schack/vendor/chess.js";
import { valjDrag, analysera, skapaSlump, TIDSGRANS_MS, NIVAER, VARDE } from "../src/schack/schack-motor.js";
import { analyseraVarning } from "../src/schack/schack-varning.js";
import { skapaDator } from "../src/schack/schack-dator.js";
import { lockAllowsRoute } from "../src/class-lock.js";
import { STUDENT_MODULES, moduleForRoute } from "../src/gamemode-visibility.js";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Slumpade ställningar: spelar slumpade (lagliga) drag, deterministiskt ur `seed`. */
function slumpStallningar(seed, antal, { minDrag = 8, maxDrag = 70 } = {}) {
  const rnd = skapaSlump(seed);
  const ut = [];
  for (let g = 0; ut.length < antal && g < antal * 10; g++) {
    const c = new Chess();
    const n = minDrag + Math.floor(rnd() * (maxDrag - minDrag));
    for (let i = 0; i < n && !c.isGameOver(); i++) {
      const m = c.moves();
      c.move(m[Math.floor(rnd() * m.length)]);
    }
    if (!c.isGameOver()) ut.push(c.fen());
  }
  return ut;
}

/** Ställningar där den som är på tur kan göra matt i ett. */
function mattIEtt(fens) {
  const ut = [];
  for (const f of fens) {
    const c = new Chess(f);
    if (c.moves({ verbose: true }).some((m) => { c.move(m); const mt = c.isCheckmate(); c.undo(); return mt; })) ut.push(f);
  }
  return ut;
}

const gor = (fen, drag) => {
  const c = new Chess(fen);
  const m = c.move({ from: drag.from, to: drag.to, promotion: drag.promotion });
  return { c, m };
};

describe("motorn: matt i ett på Tornet och Damen", () => {
  const HAND = {
    baslinje: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1",
    narrmatt: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
    pyttematt: "6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1", // Sf7#? (springare mot kungen i hörnet bakom egna bönder)
    svartMatt: "6k1/8/8/8/8/6q1/8/5rK1 b - - 0 1",
  };
  for (const [namn, fen] of Object.entries(HAND)) {
    assert.ok(mattIEtt([fen]).length, `${namn} är inte en matt-i-ett-ställning`);
    for (const niva of ["tornet", "damen"]) {
      it(`${niva} gör matt i ett: ${namn}`, () => {
        const r = valjDrag(fen, { niva, seed: 1 });
        const { c } = gor(fen, r.drag);
        assert.ok(c.isCheckmate(), `${niva} spelade ${JSON.stringify(r.drag)} i ${fen}`);
      });
    }
  }
  // Medelspelsställningar (slumpade, 20–110 halvdrag) där den som är på tur kan göra matt i ett.
  const MATT_FEN = [
      "2Q2b1k/3r3b/pp2pp1r/qP5p/5Pp1/B1N5/P5NP/2K1RB1R b - - 3 34",
      "r2k4/3bp1N1/7b/7r/1R1P4/4q2B/P2QpP1P/3NK3 b - - 1 54",
      "1nBQ4/rb3kb1/4qpp1/2P2Pr1/4P1PP/P5R1/3K4/1NBR4 w - - 1 45",
      "2r1kq2/2p3Q1/1Pn1P3/8/1p2p1b1/2p3N1/2P2P2/R1b1KB2 w - - 0 37",
      "1r3bnr/2N1p2p/4P1k1/p1p2Nn1/p2P2P1/1p3b2/4q1BP/2R3KR b - - 1 37",
      "1qb1k3/r3nrp1/1p2N1Q1/4p2P/1b2R3/1pP1p3/P3P3/4KB1q b - - 1 36",
      "7r/4bk2/3p2p1/Pp6/1P3nqP/2Q1K1P1/2P5/2R1bb1b b - - 15 54",
      "rn2kbn1/4pppr/1p1p4/1qp2QP1/P3PP1p/1pN4P/2PP4/R1BK3R w q - 1 22",
      "1r3q2/pnbpkr2/B3PN1p/2PQ3P/Pp1Bp3/1P5N/K7/1R2R3 w - - 1 39",
      "2b1kn2/4b3/p3PQN1/Pp1p4/7K/1Rp1P1n1/2P2P1R/5BN1 w - - 3 47",
      "1nbk1bn1/2p1p1p1/1p5B/5Nr1/6q1/PNPp4/RP3P2/5K1R b - - 15 25",
      "3Nk3/2nqr1Pp/p1rp1p2/1PpPQ3/2b1p1P1/2N1P2B/1P6/R1BRK3 w - - 0 34",
      "4q3/3k2b1/1Pn1p1pr/rp1p1p2/1p1n1Qb1/1N6/1BP1P1BP/1R1KR3 w - - 0 42",
      "1nB3k1/p1rpQ3/1ppN4/4p1b1/4pP2/1PP1K3/PR1P2qR/2B5 b - - 2 28"
  ];
  it("14 medelspelsställningar med matt i ett: Tornet och Damen hittar alltid en matt", () => {
    assert.equal(mattIEtt(MATT_FEN).length, MATT_FEN.length, "alla ställningar ska ha matt i ett");
    for (const f of MATT_FEN) {
      for (const niva of ["tornet", "damen"]) {
        const r = valjDrag(f, { niva, seed: 7, tidsgransMs: 300 });
        assert.ok(gor(f, r.drag).c.isCheckmate(), `${niva} missade matt i ${f}`);
      }
    }
  });
  it("tipset (analysera) hittar också matten och markerar den", () => {
    const a = analysera(HAND.baslinje);
    assert.equal(a.matt, true);
    assert.ok(gor(HAND.baslinje, a.drag).c.isCheckmate());
  });
});

describe("motorn: lagliga drag och specialfall", () => {
  it("alla nivåer ger alltid ett lagligt drag i 80 slumpade ställningar (inkl. rockad/en passant/förvandling i fuzzen)", () => {
    for (const f of slumpStallningar(7, 80)) {
      for (const niva of NIVAER.map((n) => n.id)) {
        const r = valjDrag(f, { niva, seed: 5, tidsgransMs: 60 });
        assert.ok(r, `inget drag i ${f}`);
        gor(f, r.drag); // chess.js kastar vid olagligt drag
      }
    }
  });
  const SPECIAL = {
    forvandling: "4k3/P7/8/8/8/8/8/4K3 w - - 0 1",
    forvandlingSvart: "4k3/8/8/8/8/8/p7/4K3 b - - 0 1",
    forvandlingMedSlag: "1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1",
    enPassant: "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1",
    rockad: "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1",
    enda: "7k/8/8/8/8/8/5q2/6K1 w - - 0 1",
  };
  for (const [namn, f] of Object.entries(SPECIAL)) {
    it(`lagligt drag på alla nivåer: ${namn}`, () => {
      for (const niva of NIVAER.map((n) => n.id)) gor(f, valjDrag(f, { niva, seed: 2 }).drag);
    });
  }
  it("Tornet och Damen förvandlar till dam när det är bäst", () => {
    for (const niva of ["tornet", "damen"]) {
      const r = valjDrag(SPECIAL.forvandling, { niva, seed: 1 });
      assert.deepEqual([r.drag.from, r.drag.to, r.drag.promotion], ["a7", "a8", "q"]);
    }
  });
  it("matt och patt ger null (inga drag), på alla nivåer och i tipset", () => {
    const matt = "R5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1";
    const patt = "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1";
    for (const f of [matt, patt]) {
      for (const niva of NIVAER.map((n) => n.id)) assert.equal(valjDrag(f, { niva }), null);
      assert.equal(analysera(f), null);
    }
  });
  it("Damen tar en hängande dam och undviker att hänga sin egen (Tornet också)", () => {
    const f = "4k3/8/8/3q4/8/8/8/3QK3 w - - 0 1"; // Qxd5 vinner damen
    for (const niva of ["tornet", "damen"]) assert.equal(gor(f, valjDrag(f, { niva }).drag).m.captured, "q");
  });
});

describe("nivåerna: slump och styrka", () => {
  const F = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
  const san = (niva, seed) => gor(F, valjDrag(F, { niva, seed }).drag).m.san;
  it("samma seed ger samma drag (deterministiskt), olika seed ger olika drag på Bonden och Springaren", () => {
    for (const niva of ["bonden", "springaren"]) {
      assert.equal(san(niva, 11), san(niva, 11));
      const set = new Set(Array.from({ length: 40 }, (_, i) => san(niva, i + 1)));
      assert.ok(set.size >= 3, `${niva}: bara ${set.size} olika drag på 40 seeds`);
    }
  });
  it("Tornet och Damen ignorerar seed (ingen slump)", () => {
    for (const niva of ["tornet", "damen"]) {
      const set = new Set(Array.from({ length: 8 }, (_, i) => san(niva, i + 1)));
      assert.equal(set.size, 1, `${niva}: ${[...set]}`);
    }
  });
  it("Bonden väljer inte alltid det bästa, och missar ibland ett slag med flit", () => {
    const f = "4k3/8/8/3q4/8/8/8/3QK3 w - - 0 1"; // dam kan ta dam
    const tog = Array.from({ length: 60 }, (_, i) => gor(f, valjDrag(f, { niva: "bonden", seed: i + 1 }).drag).m.captured === "q");
    assert.ok(tog.some(Boolean), "Bonden tog aldrig damen");
    assert.ok(tog.some((x) => !x), "Bonden tog alltid damen – missar aldrig med flit");
  });
  it("Springarens drag ligger alltid inom 100 cp från det bästa", () => {
    for (const f of slumpStallningar(3, 25)) {
      const r = valjDrag(f, { niva: "springaren", seed: 9, tidsgransMs: 100 });
      assert.ok(r.varde >= r.kandidater[0].varde - 100, `${r.varde} mot ${r.kandidater[0].varde} i ${f}`);
    }
  });
  it("styrkeordningen: Damen ≥ Tornet > Springaren > Bonden (korta partier, 2 + 2 med färgbyte)", { timeout: 240000 }, () => {
    const spela = (vit, svart, g) => {
      const rnd = skapaSlump(1000 + g);
      const c = new Chess();
      for (let i = 0; i < 4; i++) { const m = c.moves(); c.move(m[Math.floor(rnd() * m.length)]); }
      let seed = g * 101;
      while (!c.isGameOver() && c.history().length < 100) {
        const r = valjDrag(c.fen(), { niva: c.turn() === "w" ? vit : svart, seed: seed++, tidsgransMs: 40 });
        c.move(r.drag);
      }
      if (c.isCheckmate()) return c.turn() === "w" ? -1 : 1;
      if (c.isDraw()) return 0;
      let mat = 0;
      for (const rad of c.board()) for (const p of rad) if (p) mat += (p.color === "w" ? 1 : -1) * VARDE[p.type];
      return mat > 300 ? 1 : mat < -300 ? -1 : 0;
    };
    const mot = (a, b) => { let s = 0; for (let g = 0; g < 2; g++) { s += spela(a, b, g); s -= spela(b, a, g); } return s; };
    assert.ok(mot("tornet", "springaren") > 0, "Tornet ska slå Springaren");
    assert.ok(mot("springaren", "bonden") > 0, "Springaren ska slå Bonden");
    assert.ok(mot("damen", "bonden") > 0, "Damen ska slå Bonden");
  });
});

describe("tidsgränsen (§3.1: ≤ 1 s per drag)", () => {
  const FENS = slumpStallningar(99, 20, { minDrag: 16, maxDrag: 50 });
  it("Damen håller tidsgränsen med riktig klocka: varje drag ≤ gräns + 120 ms (20 ställningar)", () => {
    let max = 0;
    for (const f of FENS) max = Math.max(max, valjDrag(f, { niva: "damen", seed: 1 }).ms);
    assert.ok(max <= TIDSGRANS_MS + 120, `max ${Math.round(max)} ms`);
  });
  it("tidsgränsen är < 1000 ms med marginal för worker-tur och kontrollglapp", () => {
    assert.ok(TIDSGRANS_MS <= 900);
  });
  it("överdraget är litet nog för en 6× långsammare maskin: simulerad klocka ×6 ger ≤ 1000 'långsamma' ms", () => {
    // Klockan går 6× fortare – sökningen tror att den kört 6× längre, stannar tidigare men
    // glappet mellan tidsgräns och avbrott (var 256:e nod) skalas upp 6× i den simulerade tiden.
    const nu6 = () => performance.now() * 6;
    const tider = [];
    for (const f of FENS) for (const niva of ["springaren", "tornet", "damen"]) tider.push(valjDrag(f, { niva, seed: 1, nu: nu6 }).ms);
    tider.sort((a, b) => b - a);
    // näst största: en enstaka schemaläggningshicka på en delad maskin (×6!) ska inte fälla testet
    assert.ok(tider[1] <= 1000, `näst största ${Math.round(tider[1])} simulerade ms (största ${Math.round(tider[0])})`);
  });
  it("tidsgränsen kapar: en tidsgräns på 20 ms ger svar inom ~60 ms och ett lagligt drag", () => {
    for (const f of FENS.slice(0, 8)) {
      const r = valjDrag(f, { niva: "damen", tidsgransMs: 20 });
      assert.ok(r.ms < 80, `${Math.round(r.ms)} ms`);
      gor(f, r.drag);
    }
  });
});

describe("Varna mig (§3.3)", () => {
  const v = (fen, from, to, promotion) => analyseraVarning(fen, { from, to, promotion });
  it("varnar för matt i nästa drag (dårmatt)", () => {
    const c = new Chess();
    c.move("f3"); c.move("e5");
    assert.equal(v(c.fen(), "g2", "g4")?.typ, "matt");
    assert.equal(v(c.fen(), "e2", "e3"), null);
  });
  it("varnar för hängande dam och torn med rätt text, inte för vanliga drag", () => {
    const dam = v("4k3/8/4p3/8/8/8/8/3QK3 w - - 0 1", "d1", "d5");
    assert.equal(dam?.pjas, "q");
    assert.equal(dam.text, "Om du flyttar dit kan datorn ta din dam. Vill du ändå?");
    assert.equal(v("4k3/8/4p3/8/8/8/8/3QK3 w - - 0 1", "d1", "d2"), null);
    assert.equal(v("r5k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1", "a1", "a5")?.pjas, "r");
  });
  it("ingen varning för något av de 20 första dragen från utgångsställningen", () => {
    const c = new Chess();
    for (const m of c.moves({ verbose: true })) assert.equal(v(START, m.from, m.to, m.promotion), null, m.san);
  });
  it("ingen varning för ett byte (dam mot dam) eller när eleven själv tar lika mycket", () => {
    assert.equal(v("4k3/8/3q4/8/3Q4/8/8/4K3 w - - 0 1", "d4", "d6"), null);
  });
  it("ett olagligt eller trasigt drag ger null, inte ett kast", () => {
    assert.equal(v(START, "e2", "e5"), null);
    assert.equal(v("skräp", "e2", "e4"), null);
    assert.equal(v(START, "z9", "a1"), null);
  });
  it("få falska varningar: av motorns egna drag (Tornet) i hela partier varnas < 5 %", () => {
    let tot = 0, varn = 0;
    for (let g = 0; g < 3; g++) {
      const c = new Chess();
      for (let i = 0; i < 60 && !c.isGameOver(); i++) {
        const r = valjDrag(c.fen(), { niva: "tornet", seed: g * 100 + i, nu: () => 0 }); // klockan står still: alltid fullt djup, deterministiskt
        tot++;
        if (analyseraVarning(c.fen(), r.drag)) varn++;
        c.move(r.drag);
      }
    }
    assert.ok(varn / tot < 0.05, `${varn}/${tot}`);
  });
  it("varningens räknetid (huvudtråd): ≤ 150 ms i snitt (generös: maskinen delas med andra sviter) över en motorgenererad medelspelsställning", () => {
    const f = slumpStallningar(5, 1, { minDrag: 24, maxDrag: 30 })[0];
    const c = new Chess(f);
    const t = performance.now();
    for (const m of c.moves({ verbose: true })) analyseraVarning(f, { from: m.from, to: m.to, promotion: m.promotion });
    assert.ok((performance.now() - t) / c.moves().length < 150, "varningen är för långsam för huvudtråden");
  });
});

describe("datorn (schack-dator.js): reservvägen och kön", () => {
  it("en ensam fråga i huvudtråden (utan Worker) svarar inom gränsen och med lagligt drag", async () => {
    const d = skapaDator({ Worker: null });
    const f = slumpStallningar(2, 1, { minDrag: 20, maxDrag: 40 })[0];
    const t = performance.now();
    const r = await d.valjDrag(f, { niva: "damen", seed: 1 });
    assert.ok(performance.now() - t < 1000);
    gor(f, r.drag);
  });
  it("avbryt() medan datorn tänker lämnar inget svar kvar som kan spöka in senare", async () => {
    class Tyst { constructor() { Tyst.sista = this; this.m = []; } postMessage(x) { this.m.push(x); } terminate() { this.slut = true; } }
    const d = skapaDator({ Worker: Tyst, vaktMs: 10000 });
    const p = d.valjDrag(START, { niva: "damen" });
    d.avbryt();
    await assert.rejects(p, /avbruten/);
    Tyst.sista.onmessage?.({ data: { id: 1, ok: true, resultat: { drag: { from: "e2", to: "e4" } } } }); // sent svar
    d.destroy();
  });
  // Workern är entrådad: en avbruten fråga tuggar färdigt sin tidsgräns och
  // nästa fråga köar bakom den (Ångra + nytt drag ⇒ svaret kommer ~1,7 s senare, fyra Ångra
  // i rad > vakten på 3,35 s ⇒ workern dödas och motorn körs i huvudtråden).
  test.todo("OPEN F2: avbryt() ska stoppa workern (terminate + ny worker) så att en avbruten sökning inte köar bakom nästa");
});

describe("motorns slutspel (kvalitet)", () => {
  // OPEN F3: sökningen ser inte upprepning och har ingen slutspelsvärdering – Damen
  // med dam mot en ensam kung drar ofta remi på trefaldig upprepning i stället för att mattsätta.
  test.todo("OPEN F3: Damen mattar en ensam kung med dam inom 40 drag mot en slumpande motståndare (utan trefaldig upprepning)");
});

describe("modulen och fokusläget", () => {
  const lock = (typ, doljOvrigt) => ({ mal: { typ, id: "x" }, doljOvrigt });
  it("fokusläget stänger schack (aldrig målet) oavsett 'dölj allt annat'", () => {
    for (const typ of ["prov", "lasresan", "mattematchen", "hittaratt", "ekvationsresan", "brakresan"]) {
      for (const dolj of [false, true]) assert.equal(lockAllowsRoute(lock(typ, dolj), "/elev/schack", new URLSearchParams()), false, `${typ}/${dolj}`);
    }
  });
  it("schack är en egen modul med unik route och unikt id, och en länk i Öva", () => {
    const m = STUDENT_MODULES.filter((x) => x.id === "schack");
    assert.equal(m.length, 1);
    assert.equal(moduleForRoute("/elev/schack"), "schack");
    assert.equal(m[0].grupp, "ova");
  });
});
