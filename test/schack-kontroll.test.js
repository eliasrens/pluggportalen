// ============================================================================
// Schack A (#775): brädets logik via kontrollens API – samma anrop som brädet
// gör vid tryck, dra-och-släpp och tangentbord (spec §1, §2.2, §5).
// Rockad, en passant och förvandling går att göra; drag som ställer eller
// lämnar kungen i schack visas inte och nekas. Körs med: node --test
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { skapaSchackKontroll } from "../src/schack/schack-kontroll.js";
import { STALLNINGAR, SLUT } from "../preview/schack/stallningar.js";

const ROCKAD = "r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R3K2R w KQkq - 0 1";
const mal = (k) => k.getState().mal.map((m) => m.to).sort();
const pjas = (k, ruta) => k.getState().pjaser.find((p) => p.ruta === ruta) || null;

describe("rockad, en passant och förvandling via brädets API", () => {
  it("kort rockad: kungen visar g1 och c1, ett tryck på g1 flyttar även tornet", () => {
    const k = skapaSchackKontroll({ fen: ROCKAD });
    assert.equal(k.tryck("e1").typ, "vald");
    assert.deepEqual(mal(k), ["c1", "d1", "e2", "f1", "g1"]);
    const r = k.tryck("g1");
    assert.equal(r.typ, "drag");
    assert.equal(r.drag.sanSv, "O-O");
    assert.deepEqual([pjas(k, "g1")?.type, pjas(k, "f1")?.type, pjas(k, "h1")], ["k", "r", null]);
  });
  it("lång rockad för svart med dra-och-släpp", () => {
    const k = skapaSchackKontroll();
    k.setPosition(ROCKAD.replace(" w ", " b "));
    const r = k.slapp("e8", "c8");
    assert.equal(r.typ, "drag");
    assert.equal(r.drag.san, "O-O-O");
    assert.deepEqual([pjas(k, "c8")?.type, pjas(k, "d8")?.type, pjas(k, "a8")], ["k", "r", null]);
  });
  it("en passant: e5 visar d6 som slag och tar bonden på d5", () => {
    const k = skapaSchackKontroll();
    assert.ok(k.loadGame({ fen: "rnbqkbnr/pppppppp/8/4P3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2", drag: ["d5"] }));
    k.tryck("e5");
    assert.deepEqual(k.getState().mal, [{ to: "e6", tar: false }, { to: "d6", tar: true }]);
    const r = k.tryck("d6");
    assert.equal(r.drag.flags, "e");
    assert.equal(pjas(k, "d5"), null);
    assert.equal(pjas(k, "d6").color, "w");
    assert.deepEqual(k.getState().tagna.w, ["p"]);
  });
  it("förvandling: väljaren öppnas, springare går att välja, Avbryt ändrar inget", () => {
    const k = skapaSchackKontroll({ fen: "r7/1P5k/8/8/8/8/6K1/8 w - - 0 1" });
    const fore = k.getFen();
    k.tryck("b7");
    assert.equal(k.tryck("b8").typ, "forvandling");
    assert.deepEqual(k.getState().forvandling, { from: "b7", to: "b8", farg: "w" });
    assert.equal(k.tryck("g2").typ, "ingen", "brädet är låst medan väljaren är öppen");
    k.avbrytForvandling();
    assert.equal(k.getFen(), fore);
    assert.equal(k.slapp("b7", "a8").typ, "forvandling");
    const r = k.valjForvandling("n");
    assert.equal(r.drag.sanSv, "bxa8=S");
    assert.deepEqual(pjas(k, "a8"), { ruta: "a8", color: "w", type: "n" });
  });
  it("förvandling från koden blir dam om inget annat sägs", () => {
    const k = skapaSchackKontroll();
    k.setPosition("8/1P5k/8/8/8/8/6K1/8 w - - 0 1");
    assert.equal(k.move({ from: "b7", to: "b8" }).promotion, "q");
  });
});

describe("bara lagliga drag visas och går att göra", () => {
  it("kungen kan inte gå in i schack: bara f1 och Kxd2 visas", () => {
    const k = skapaSchackKontroll();
    k.setPosition("4k3/8/8/8/8/8/3r4/4K3 w - - 0 1");
    k.tryck("e1");
    assert.deepEqual(mal(k), ["d2", "f1"]);
    assert.equal(k.tryck("e2").typ, "avmarkerad", "ett tryck på e2 flyttar inte");
    assert.equal(k.slapp("e1", "f2").typ, "nekad");
    assert.equal(k.getState().vald, "e1", "markeringen står kvar efter ett nekat släpp");
    assert.equal(k.getFen(), "4k3/8/8/8/8/8/3r4/4K3 w - - 0 1");
  });
  it("bunden springare: inga möjliga drag, alla släpp nekas", () => {
    const k = skapaSchackKontroll();
    k.setPosition("4k3/4r3/8/8/8/8/4N3/4K3 w - - 0 1");
    k.tryck("e2");
    assert.deepEqual(mal(k), []);
    for (const till of ["c1", "c3", "d4", "f4", "g3", "g1"]) assert.equal(k.slapp("e2", till).typ, "nekad", till);
    assert.equal(k.move({ from: "e2", to: "c3" }), null, "inte heller från koden");
  });
  it("i schack visas bara drag som räddar kungen", () => {
    const k = skapaSchackKontroll();
    k.setPosition("rnbqk1nr/pppp1ppp/8/4p3/1b1P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 3");
    const s = k.getState();
    assert.equal(s.schackRuta, "e1");
    assert.match(s.status.text, /^Schack!/);
    const alla = s.pjaser.filter((p) => p.color === "w").flatMap((p) => k.lagligaDrag(p.ruta).map((d) => d.sanSv));
    assert.deepEqual(alla.sort(), ["Dd2", "Ld2", "Sc3", "Sd2", "c3"]);
  });
  it("motståndarens pjäser och fel tur går inte att markera", () => {
    const k = skapaSchackKontroll();
    assert.equal(k.tryck("e7").typ, "ingen");
    k.setInteractive("b");
    assert.equal(k.tryck("e2").typ, "ingen", "bara svart får flytta – men det är vits tur");
    k.setInteractive(false);
    assert.equal(k.slapp("e2", "e4").typ, "ingen");
    k.setInteractive("w");
    assert.equal(k.slapp("e2", "e4").typ, "drag");
  });
  it("tryck: byt markering, avmarkera med samma ruta och med en tom ruta", () => {
    const k = skapaSchackKontroll();
    k.tryck("e2");
    assert.equal(k.tryck("d2").ruta, "d2");
    assert.equal(k.tryck("d2").typ, "avmarkerad");
    k.tryck("g1");
    assert.equal(k.tryck("e5").typ, "avmarkerad");
    assert.equal(k.getState().vald, null);
  });
});

describe("fånga ett drag innan det görs (beforeMove)", () => {
  it("false nekar, true släpper igenom; onMove får svensk notation", () => {
    const gjorda = [];
    let svar = false;
    const k = skapaSchackKontroll({ beforeMove: () => svar, onMove: (d) => gjorda.push(d.sanSv) });
    assert.equal(k.slapp("g1", "f3").typ, "nekad");
    assert.equal(k.getState().drag.length, 0);
    svar = true;
    assert.equal(k.slapp("g1", "f3").typ, "drag");
    assert.deepEqual(gjorda, ["Sf3"]);
  });
  it("ett löfte: pjäsen väntar på målrutan och hoppar tillbaka om svaret blir nej", async () => {
    let svara;
    const k = skapaSchackKontroll({ beforeMove: () => new Promise((r) => { svara = r; }) });
    const r = k.tryck("e2") && k.tryck("e4");
    assert.equal(r.typ, "vantar");
    assert.deepEqual(k.getState().pagaende, { from: "e2", to: "e4", pjas: { color: "w", type: "p" } });
    assert.equal(k.tryck("d2").typ, "ingen", "brädet är låst medan draget skickas");
    svara(false);
    assert.equal(await r.klart, null);
    assert.equal(k.getState().pagaende, null);
    assert.equal(pjas(k, "e2").type, "p");
    const r2 = k.slapp("e2", "e4");
    svara(true);
    assert.equal((await r2.klart).san, "e4");
  });
  it("avsluta under väntan tar bort spökpjäsen direkt; svaret gör inget drag (F1)", async () => {
    let svara;
    const drag = [];
    const k = skapaSchackKontroll({ beforeMove: () => new Promise((r) => { svara = r; }), onMove: (d) => drag.push(d) });
    const r = k.slapp("e2", "e4");
    k.avsluta({ resultat: "0-1", orsak: "gav-upp", vinnare: "b" });
    assert.equal(k.getState().pagaende, null);
    svara(true);
    assert.equal(await r.klart, null);
    assert.deepEqual(drag, []);
  });
  it("ett gammalt svar rör inte en nyare väntan efter undo (F2)", async () => {
    const svar = [];
    const k = skapaSchackKontroll({ beforeMove: () => new Promise((r) => svar.push(r)) });
    k.move("e4");
    const a = k.slapp("e7", "e5");
    k.undo(1);
    const b = k.slapp("e2", "e4");
    svar[0](true);
    assert.equal(await a.klart, null);
    assert.deepEqual(k.getState().pagaende?.to, "e4", "den nya väntan står kvar");
    assert.equal(k.tryck("d2").typ, "ingen", "och brädet är fortfarande låst");
    svar[1](true);
    assert.equal((await b.klart).san, "e4");
  });
  it("en callback som kastar stoppar inte brädet, och onGameOver kommer ändå (F3)", () => {
    const slut = [];
    const fel = console.error;
    console.error = () => {};
    try {
      const k = skapaSchackKontroll({
        fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1",
        onMove: () => { throw new Error("sidans fel"); },
        onGameOver: (s) => slut.push(s.orsak),
      });
      k.subscribe(() => { throw new Error("lyssnarens fel"); });
      k.tryck("a1");
      assert.equal(k.tryck("a8").typ, "drag");
      assert.deepEqual(slut, ["matt"]);
      assert.equal(k.getState().slut.orsak, "matt");
    } finally {
      console.error = fel;
    }
  });
  it("drag från koden (datorn) passerar inte beforeMove", () => {
    const k = skapaSchackKontroll({ beforeMove: () => false });
    assert.equal(k.move("e4").san, "e4");
    assert.equal(k.move({ from: "e7", to: "e5" }).sanSv, "e5");
  });
});

describe("tillståndet runt brädet", () => {
  it("senaste draget, draglistan, ångra och pilar", () => {
    const k = skapaSchackKontroll();
    for (const d of ["e4", "e5", "Nf3", "Nc6", "Bb5"]) k.move(d);
    let s = k.getState();
    assert.deepEqual(s.senast, { from: "f1", to: "b5" });
    assert.equal(s.dragText, "1. e4 e5 2. Sf3 Sc6 3. Lb5");
    k.showArrow("a7", "a6");
    assert.equal(k.getState().pilar.length, 1);
    assert.equal(k.undo(2), 2);
    s = k.getState();
    assert.deepEqual(s.senast, { from: "g1", to: "f3" });
    assert.equal(s.dragText, "1. e4 e5 2. Sf3");
    assert.equal(s.pilar.length, 0);
    k.showArrow("b8", "c6");
    k.move("Nc6");
    assert.equal(k.getState().pilar.length, 0, "pilen försvinner vid nästa drag");
  });
  it("loadGame/getGame tar partiet fram och tillbaka (B sparar så)", () => {
    const k = skapaSchackKontroll();
    for (const d of ["d4", "d5", "c4"]) k.move(d);
    const sparat = JSON.parse(JSON.stringify(k.getGame()));
    const k2 = skapaSchackKontroll();
    assert.ok(k2.loadGame(sparat));
    assert.equal(k2.getFen(), k.getFen());
    assert.equal(k2.getState().dragText, "1. d4 d5 2. c4");
    assert.equal(k2.loadGame({ drag: ["e5"] }), false, "olagligt drag i partiet");
    assert.equal(k2.setPosition("inte en fen"), false);
    assert.equal(k2.getFen(), k.getFen(), "ett fel ändrar inget");
  });
  it("ogiltig start-FEN ger utgångsställningen", () => {
    assert.equal(skapaSchackKontroll({ fen: "trasig" }).getFen(), "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  });
  it("orienteringen följer egen färg och går att vända", () => {
    const k = skapaSchackKontroll({ egenFarg: "b" });
    assert.equal(k.getState().orientering, "b");
    k.setOrientation("w");
    k.flip();
    assert.equal(k.getState().orientering, "b");
  });
  it("tagna pjäser och materialövervikt", () => {
    const k = skapaSchackKontroll();
    for (const d of ["e4", "d5", "exd5", "Qxd5", "Nc3", "Qxg2"]) k.move(d);
    const s = k.getState();
    assert.deepEqual(s.tagna, { w: ["p"], b: ["p", "p"] });
    assert.deepEqual(s.fordel, { w: 0, b: 1 });
  });
});

describe("statusraden och slutet", () => {
  it("din tur / datorn tänker / schack", () => {
    const k = skapaSchackKontroll({ egenFarg: "w", motstandare: "dator" });
    assert.equal(k.getState().status.text, "Din tur");
    k.move("e4");
    assert.equal(k.getState().status.text, "Datorn tänker…");
    k.setSpelare({ motstandare: "kompis", namn: { b: "Sara" } });
    assert.equal(k.getState().status.text, "Väntar på Sara…");
    k.setStatus("Skickar…");
    assert.equal(k.getState().status.text, "Skickar…");
    k.setStatus(null);
    k.setPosition("rnbqk1nr/pppp1ppp/8/4p3/1b1P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 3");
    assert.equal(k.getState().status.text, "Schack! Din tur – rädda kungen!");
  });
  it("matt: du vann / datorn vann; onGameOver anropas en gång", () => {
    const slut = [];
    const k = skapaSchackKontroll({ egenFarg: "w", motstandare: "dator", onGameOver: (s) => slut.push(s) });
    k.setPosition("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
    k.slapp("a1", "a8");
    assert.deepEqual(slut, [{ resultat: "1-0", orsak: "matt", vinnare: "w" }]);
    assert.equal(k.getState().status.text, "Schack matt – du vann! 🎉");
    assert.equal(k.tryck("g1").typ, "ingen", "inga drag efter slutet");
    k.setSpelare({ egenFarg: "b" });
    assert.equal(k.getState().status.text, "Schack matt – datorn vann.");
  });
  it("patt, för lite material, upprepning och 50-dragsregeln ger remi med förklaring", () => {
    const fall = [
      ["7k/8/6Q1/8/8/8/8/K7 b - - 1 1", "patt"],
      ["8/8/4k3/8/8/8/3K4/8 b - - 0 1", "material"],
      ["8/8/4k3/8/8/2B5/2N5/3K4 b - - 100 80", "femtio"],
    ];
    for (const [fen, orsak] of fall) {
      const k = skapaSchackKontroll({ egenFarg: "w" });
      k.setPosition(fen);
      const s = k.getState();
      assert.equal(s.slut.orsak, orsak);
      assert.equal(s.slut.resultat, "½-½");
      assert.equal(s.status.text, "Remi – ingen vann");
      assert.ok(s.status.orsak.length > 10);
    }
    const k = skapaSchackKontroll();
    k.loadGame({ drag: ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1"] });
    assert.equal(k.getState().slut, null);
    k.move("Ng8");
    assert.equal(k.getState().slut.orsak, "upprepning");
  });
  it("avsluta utifrån (gav upp) med egen rubrik", () => {
    const k = skapaSchackKontroll({ egenFarg: "w", motstandare: "kompis" });
    k.avsluta({ resultat: "1-0", orsak: "gav-upp", vinnare: "w", titel: "Du vann! Sara gav upp." });
    const s = k.getState();
    assert.equal(s.status.text, "Du vann! Sara gav upp.");
    assert.equal(s.status.ton, "vinst");
    assert.equal(k.tryck("e2").typ, "ingen");
  });
});

describe("förhandsvisningens ställningar", () => {
  it("alla färdiga ställningar och slutrutor går att ladda", () => {
    for (const st of STALLNINGAR) assert.ok(skapaSchackKontroll().loadGame({ fen: st.fen, drag: st.drag || [] }), st.id);
    for (const s of SLUT.filter((x) => x.fen)) {
      const k = skapaSchackKontroll();
      assert.ok(k.setPosition(s.fen), s.namn);
      assert.ok(k.getState().slut, `${s.namn} är en slutställning`);
    }
  });
  it("dragen som texterna lovar är lagliga", () => {
    const lagligt = (id, san) => {
      const st = STALLNINGAR.find((s) => s.id === id);
      const k = skapaSchackKontroll();
      k.loadGame({ fen: st.fen, drag: st.drag || [] });
      return k.move(san);
    };
    assert.ok(lagligt("en-passant", "exd6"));
    assert.equal(lagligt("matt", "Ra8#").san, "Ra8#");
    assert.ok(lagligt("patt", "Qg6"));
    assert.ok(lagligt("material", "Kxd2"));
    assert.ok(lagligt("forvandling", "b8=Q"));
  });
});
