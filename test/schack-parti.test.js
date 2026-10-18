// ============================================================================
// Schack B (#776, spec §3.3/§5): partiet i localStorage (try/catch, per elev),
// datorn-wrappern (worker-protokollet, reserven i huvudtråden, vakten) och
// ångra/tips-flödet via brädets kontroll + motorn – utan webbläsare.
// Körs med: node --test test/schack-parti.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  partiNyckel, varnaStandard, nyttParti, giltigtParti, lasParti, sparaParti, rensaParti, lasVal, sparaVal, partiText,
} from "../src/schack/schack-parti.js";
import { skapaDator } from "../src/schack/schack-dator.js";
import * as motor from "../src/schack/schack-motor.js";
import { skapaSchackKontroll } from "../src/schack/schack-kontroll.js";

/** localStorage-attrapp. `trasig` = kastar vid skrivning (full kvot / privat läge). */
function lagring(trasig = false) {
  const m = new Map();
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem(k, v) { if (trasig) throw new Error("QuotaExceededError"); m.set(k, String(v)); },
    removeItem: (k) => void m.delete(k),
  };
}

describe("partiet i localStorage", () => {
  it("nyckeln är per elev; Varna mig är på för Bonden och Springaren", () => {
    assert.equal(partiNyckel("elev1"), "pp:schack:dator:elev1");
    assert.equal(partiNyckel(null), "pp:schack:dator:gast");
    assert.deepEqual(["bonden", "springaren", "tornet", "damen"].map(varnaStandard), [true, true, false, false]);
  });
  it("nyttParti: nivå, färg (slumpad med injicerad slump), seed och varna-standard", () => {
    const p = nyttParti({ niva: "tornet", farg: "b", slump: () => 0.1, nu: () => 5 });
    assert.deepEqual([p.niva, p.egenFarg, p.varna, p.drag, p.slut, p.skapad], ["tornet", "b", false, [], null, 5]);
    assert.equal(nyttParti({ farg: "slump", slump: () => 0.9 }).egenFarg, "b");
    assert.equal(nyttParti({ farg: "slump", slump: () => 0.2 }).egenFarg, "w");
    assert.equal(nyttParti({ niva: "okand" }).niva, "bonden");
    assert.ok(giltigtParti(p));
  });
  it("spara → läs ger samma parti; drag och slut följer med", () => {
    const l = lagring();
    const p = nyttParti({ niva: "springaren" });
    p.drag = ["e4", "e5", "Nf3"];
    assert.equal(sparaParti(l, "k", p, () => 99), true);
    const u = lasParti(l, "k");
    assert.deepEqual(u.drag, ["e4", "e5", "Nf3"]);
    assert.equal(u.uppdaterad, 99);
    assert.equal(u.varna, true);
    p.slut = { resultat: "1-0", orsak: "matt", vinnare: "w" };
    sparaParti(l, "k", p);
    assert.deepEqual(lasParti(l, "k").slut, { resultat: "1-0", orsak: "matt", vinnare: "w" });
    rensaParti(l, "k");
    assert.equal(lasParti(l, "k"), null);
  });
  it("trasig JSON, fel version, okänd nivå eller skräpdrag → null (inget kastas)", () => {
    const l = lagring();
    l.m.set("k", "{trasig");
    assert.equal(lasParti(l, "k"), null);
    l.m.set("k", JSON.stringify({ v: 2, niva: "bonden", egenFarg: "w", drag: [] }));
    assert.equal(lasParti(l, "k"), null);
    l.m.set("k", JSON.stringify({ v: 1, niva: "kungen", egenFarg: "w", drag: [] }));
    assert.equal(lasParti(l, "k"), null);
    l.m.set("k", JSON.stringify({ v: 1, niva: "bonden", egenFarg: "w", drag: ["e4", 7] }));
    assert.equal(lasParti(l, "k"), null);
    assert.equal(lasParti({ getItem() { throw new Error("blockerad"); } }, "k"), null);
  });
  it("en lagring som nekar (full kvot) ger false men kastar inte", () => {
    const l = lagring(true);
    assert.equal(sparaParti(l, "k", nyttParti()), false);
    assert.equal(sparaVal(l, "k", { niva: "damen", farg: "b" }), false);
    assert.deepEqual(lasVal(l, "k"), { niva: "bonden", farg: "w" });
  });
  it("senaste valet sparas och läses, med rimliga standardvärden", () => {
    const l = lagring();
    sparaVal(l, "k", { niva: "damen", farg: "slump", extra: 1 });
    assert.deepEqual(lasVal(l, "k"), { niva: "damen", farg: "slump" });
    assert.equal(l.m.get("k:val"), JSON.stringify({ niva: "damen", farg: "slump" }));
    l.m.set("k:val", JSON.stringify({ niva: "x", farg: "y" }));
    assert.deepEqual(lasVal(l, "k"), { niva: "bonden", farg: "w" });
  });
  it("partiText", () => {
    const p = nyttParti({ niva: "tornet", farg: "b" });
    p.drag = ["e4", "e5", "Nf3"];
    assert.equal(partiText(p), "Mot Tornet · 2 drag · du spelar svart");
  });
});

/** En Worker-attrapp som kör motorn i samma tråd men pratar worker-protokollet. */
class LatsasWorker {
  static skapade = 0;
  static sista = null;
  static tystNasta = false; // nästa worker svarar aldrig (vakten testas)
  constructor(url, opt) {
    LatsasWorker.skapade++;
    LatsasWorker.sista = this;
    this.url = String(url);
    this.opt = opt;
    this.tyst = LatsasWorker.tystNasta;
    LatsasWorker.tystNasta = false;
    this.avslutad = false;
  }
  postMessage(d) {
    if (this.tyst) return;
    const resultat = d.typ === "tips" ? motor.analysera(d.fen, d.opt) : motor.valjDrag(d.fen, d.opt);
    setTimeout(() => this.onmessage?.({ data: { id: d.id, ok: true, resultat } }), 0);
  }
  terminate() { this.avslutad = true; }
}

describe("datorn (schack-dator.js)", () => {
  const FEN = "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1";
  it("startar en modul-worker på rätt URL och svarar via protokollet", async () => {
    const d = skapaDator({ Worker: LatsasWorker });
    const r = await d.valjDrag(FEN, { niva: "tornet" });
    assert.deepEqual([r.drag.from, r.drag.to], ["a1", "a8"]);
    assert.match(LatsasWorker.sista.url, /\/src\/schack\/schack-motor-worker\.js$/);
    assert.deepEqual(LatsasWorker.sista.opt, { type: "module" });
    assert.equal(d.iWorker(), true);
    const t = await d.tips(FEN);
    assert.equal(t.matt, true);
    d.destroy();
    assert.equal(LatsasWorker.sista.avslutad, true);
  });
  it("utan Worker körs motorn i huvudtråden", async () => {
    const d = skapaDator({ Worker: null, motor });
    assert.equal(d.iWorker(), false);
    const r = await d.valjDrag(FEN, { niva: "damen" });
    assert.deepEqual([r.drag.from, r.drag.to], ["a1", "a8"]);
  });
  it("en worker som inte svarar startas om och frågan körs i huvudtråden", async () => {
    LatsasWorker.tystNasta = true;
    const d = skapaDator({ Worker: LatsasWorker, motor, vaktMs: 20 });
    const r = await d.valjDrag(FEN, { niva: "tornet", tidsgransMs: 30 });
    assert.deepEqual([r.drag.from, r.drag.to], ["a1", "a8"]);
    assert.equal(LatsasWorker.sista.avslutad, true);
    assert.equal(d.iWorker(), false);
  });
  it("avbryt() förkastar pågående svar", async () => {
    const d = skapaDator({ Worker: LatsasWorker });
    const p = d.valjDrag(FEN, { niva: "tornet" });
    d.avbryt();
    await assert.rejects(p, /avbruten/);
    d.destroy();
  });
});

describe("ångra och tips mot datorn via brädets API (§5)", () => {
  it("elevens drag → datorns svar → undo(2) är tillbaka; tipset är ett lagligt drag", async () => {
    const dator = skapaDator({ Worker: null, motor });
    const k = skapaSchackKontroll({ egenFarg: "w", motstandare: "dator", interaktiv: "w" });
    const start = k.getFen();
    assert.equal(k.tryck("e2").typ, "vald");
    assert.equal(k.tryck("e4").typ, "drag");
    const svar = await dator.valjDrag(k.getFen(), { niva: "tornet" });
    assert.ok(k.move(svar.drag), "datorns drag är lagligt på brädet");
    assert.equal(k.getHistory().length, 2);
    assert.equal(k.undo(2), 2);
    assert.equal(k.getFen(), start);
    const tips = await dator.tips(k.getFen());
    assert.ok(k.lagligaDrag(tips.drag.from).some((d) => d.to === tips.drag.to));
    k.showArrow(tips.drag.from, tips.drag.to);
    assert.deepEqual(k.getState().pilar[0], { from: tips.drag.from, to: tips.drag.to, farg: "tips" });
    k.move(tips.drag);
    assert.deepEqual(k.getState().pilar, [], "pilen försvinner vid nästa drag");
  });
  it("det sparade partiet (drag) laddas tillbaka i brädet efter en 'omladdning'", () => {
    const l = lagring();
    const p = nyttParti({ niva: "bonden" });
    const k1 = skapaSchackKontroll();
    for (const d of ["e4", "e5", "Qh5", "Nc6", "Bc4"]) k1.move(d);
    p.drag = k1.getGame().drag;
    sparaParti(l, "k", p);
    const k2 = skapaSchackKontroll();
    assert.ok(k2.loadGame({ drag: lasParti(l, "k").drag }));
    assert.equal(k2.getFen(), k1.getFen());
    assert.equal(k2.getState().dragText, "1. e4 e5 2. Dh5 Sc6 3. Lc4");
  });
});
