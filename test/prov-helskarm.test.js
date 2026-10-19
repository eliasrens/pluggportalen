// Prov (#810, spec §5.6): helskärmsläget – den rena logiken i src/prov/prov-helskarm.js.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FOKUS_GRANS_MS, extraEfterSlappIn, helskarmFor, helskarmPa, lamnadeText, orsakText, pausFalt, pausRadText,
  rensaUndantag, skapaPausvakt, tolkaPausLogg,
} from "../src/prov/prov-helskarm.js";
import { oversiktRader } from "../src/prov/prov-tillfalle-logik.js";

const kl = (h, m) => new Date(2026, 9, 19, h, m).getTime();

describe("inställningen", () => {
  it("standard på; av med helskarm: false; undantag per elev", () => {
    assert.equal(helskarmPa({}), true);
    assert.equal(helskarmPa({ helskarm: true }), true);
    assert.equal(helskarmPa({ helskarm: false }), false);
    assert.equal(helskarmFor({}, "a"), true);
    assert.equal(helskarmFor({ helskarm: false }, "a"), false);
    assert.equal(helskarmFor({ helskarmUndantag: ["a"] }, "a"), false);
    assert.equal(helskarmFor({ helskarmUndantag: ["a"] }, "b"), true);
    assert.equal(helskarmFor(null, "a"), true);
  });
  it("rensaUndantag: bara elever som finns, inga dubbletter", () => {
    assert.deepEqual(rensaUndantag(["a", "a", "b", "", 3, "x"], ["a", "b"]), ["a", "b"]);
    assert.deepEqual(rensaUndantag(null), []);
    assert.equal(rensaUndantag(Array.from({ length: 150 }, (_, i) => `e${i}`)).length, 100);
  });
});

describe("pausen", () => {
  it("pausFalt: räknaren är flikbyten (#748) och loggen får en post", () => {
    const f = pausFalt({ flikbyten: 2, pausLogg: [{ at: 1, orsak: "flik" }] }, "fokus", 5);
    assert.deepEqual(f, { pausOrsak: "fokus", flikbyten: 3, pausLogg: [{ at: 1, orsak: "flik" }, { at: 5, orsak: "fokus" }] });
    assert.equal(pausFalt({}, "konstig", 1).pausOrsak, "helskarm");
    assert.equal(pausFalt({ flikbyten: 10_000 }, "flik", 1).flikbyten, 10_000);
    assert.equal(pausFalt({ pausLogg: Array.from({ length: 200 }, (_, i) => ({ at: i, orsak: "flik" })) }, "flik", 999).pausLogg.length, 200);
  });
  it("tolkaPausLogg slänger skräp", () => {
    assert.deepEqual(tolkaPausLogg([{ at: 1, orsak: "flik" }, { at: "x", orsak: "flik" }, { at: 2, orsak: "?" }, null]), [{ at: 1, orsak: "flik" }]);
    assert.deepEqual(tolkaPausLogg("nej"), []);
  });
  it("rättningen: 'Lämnade provet 2 gånger (10:42 bytte flik, 10:58 gick ur helskärm)'", () => {
    const d = { flikbyten: 2, pausLogg: [{ at: kl(10, 42), orsak: "flik" }, { at: kl(10, 58), orsak: "helskarm" }] };
    assert.equal(lamnadeText(d), "Lämnade provet 2 gånger (10:42 bytte flik, 10:58 gick ur helskärm)");
    // Utan helskärmsläget: som #748.
    assert.equal(lamnadeText({ flikbyten: 1 }), "Lämnade provet 1 gång");
    assert.equal(lamnadeText({}), "");
    assert.equal(lamnadeText(undefined), "");
  });
  it("lärarens rad", () => {
    assert.equal(pausRadText("Elias", { pausOrsak: "flik" }, kl(10, 42)), "⏸ Elias lämnade provet 10:42 (bytte flik)");
    assert.equal(pausRadText("", { pausOrsak: "fokus" }), "⏸ Okänd elev lämnade provet (bytte program)");
    assert.equal(orsakText("helskarm"), "gick ur helskärm");
  });
  it("+5 min ovanpå befintlig extra tid, aldrig över 240", () => {
    assert.equal(extraEfterSlappIn({}, "a"), 5);
    assert.equal(extraEfterSlappIn({ extraTid: { a: 15 } }, "a"), 20);
    assert.equal(extraEfterSlappIn({ extraTid: { a: 238 } }, "a"), 240);
  });
  it("översikten: pausad och 'Helskärm fungerade inte'", () => {
    const tf = { fragor: [], tidsgransMin: 40 };
    const [r] = oversiktRader([{ id: "a", namn: "A" }], { a: { startad: 0, pausad: true, helskarmFel: true } }, tf, 1000);
    assert.equal(r.status, "skriver");
    assert.equal(r.statusText, "Pausad");
    assert.equal(r.pausad, true);
    assert.equal(r.helskarmFel, true);
  });
});

// En liten falsk webbläsare för pausvakten.
function falsk() {
  const lyss = { doc: {}, win: {} };
  const mk = (k) => ({
    addEventListener: (t, f) => ((lyss[k][t] ||= new Set()).add(f)),
    removeEventListener: (t, f) => lyss[k][t]?.delete(f),
  });
  const doc = Object.assign(mk("doc"), { hidden: false, fullscreenElement: {} });
  const win = mk("win");
  const timers = new Map();
  let id = 0;
  const timer = { set: (fn, ms) => (timers.set(++id, { fn, ms }), id), clear: (i) => timers.delete(i) };
  const skicka = (k, t) => lyss[k][t]?.forEach((f) => f());
  const korTimers = () => { for (const [i, { fn }] of [...timers]) { timers.delete(i); fn(); } };
  return { doc, win, timer, timers, skicka, korTimers, antal: (k, t) => lyss[k][t]?.size || 0 };
}

describe("pausvakten", () => {
  it("Esc (ur helskärm) pausar – en gång tills läraren släppt in", () => {
    const f = falsk();
    const pauser = [];
    const v = skapaPausvakt({ onPaus: (o) => pauser.push(o), doc: f.doc, win: f.win, timer: f.timer });
    v.starta();
    f.doc.fullscreenElement = null;
    f.skicka("doc", "fullscreenchange");
    assert.deepEqual(pauser, [], "orsaken bestäms efter en kort stund");
    f.korTimers();
    assert.deepEqual(pauser, ["helskarm"]);
    f.doc.hidden = true;
    f.skicka("doc", "visibilitychange"); // samma lämning – ingen andra skrivning
    assert.deepEqual(pauser, ["helskarm"]);
    v.aterstall();
    f.skicka("doc", "visibilitychange");
    assert.deepEqual(pauser, ["helskarm", "flik"]);
  });
  it("in i helskärm pausar inte", () => {
    const f = falsk();
    const pauser = [];
    const v = skapaPausvakt({ onPaus: (o) => pauser.push(o), doc: f.doc, win: f.win, timer: f.timer });
    v.starta();
    f.skicka("doc", "fullscreenchange");
    assert.deepEqual(pauser, []);
  });
  it("flikbyte i helskärm: Chrome lämnar helskärmen först – orsaken blir ändå flik, en paus", () => {
    const f = falsk();
    const pauser = [];
    skapaPausvakt({ onPaus: (o) => pauser.push(o), doc: f.doc, win: f.win, timer: f.timer }).starta();
    f.doc.fullscreenElement = null;
    f.skicka("doc", "fullscreenchange");
    f.doc.hidden = true;
    f.skicka("doc", "visibilitychange");
    f.korTimers();
    assert.deepEqual(pauser, ["flik"]);
  });
  it("flikbyte pausar", () => {
    const f = falsk();
    const pauser = [];
    skapaPausvakt({ onPaus: (o) => pauser.push(o), doc: f.doc, win: f.win, timer: f.timer }).starta();
    f.doc.hidden = true;
    f.skicka("doc", "visibilitychange");
    assert.deepEqual(pauser, ["flik"]);
  });
  it("Alt+Tab: blur > 2 s pausar, kort blur gör det inte", () => {
    const f = falsk();
    const pauser = [];
    let fokus = false;
    skapaPausvakt({ onPaus: (o) => pauser.push(o), doc: f.doc, win: f.win, timer: f.timer, harFokus: () => fokus }).starta();
    f.skicka("win", "blur");
    assert.equal([...f.timers.values()][0].ms, FOKUS_GRANS_MS);
    f.skicka("win", "focus"); // tillbaka inom 2 s
    f.korTimers();
    assert.deepEqual(pauser, []);
    f.skicka("win", "blur");
    f.korTimers();
    assert.deepEqual(pauser, ["fokus"]);
  });
  it("utan helskärm (gick inte) pausar bara flik och fokus", () => {
    const f = falsk();
    const pauser = [];
    const v = skapaPausvakt({ onPaus: (o) => pauser.push(o), doc: f.doc, win: f.win, timer: f.timer, kravHelskarm: false });
    v.starta();
    f.doc.fullscreenElement = null;
    f.skicka("doc", "fullscreenchange");
    f.korTimers();
    assert.deepEqual(pauser, []);
  });
  it("stoppa tar bort lyssnarna; markeraPausad tystar utan onPaus", () => {
    const f = falsk();
    const pauser = [];
    const v = skapaPausvakt({ onPaus: (o) => pauser.push(o), doc: f.doc, win: f.win, timer: f.timer });
    v.starta();
    v.markeraPausad();
    f.doc.hidden = true;
    f.skicka("doc", "visibilitychange");
    assert.deepEqual(pauser, []);
    v.stoppa();
    assert.equal(f.antal("doc", "visibilitychange") + f.antal("doc", "fullscreenchange") + f.antal("win", "blur"), 0);
    v.aterstall();
    f.skicka("doc", "visibilitychange");
    assert.deepEqual(pauser, []);
  });
});
