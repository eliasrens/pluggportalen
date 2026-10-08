// Klasskassan (#526): Live-priset i live-core, prisposter/uttagsplan i
// kc-kassa-plan.js, HTML i kc-kassa-html.js / kc-shop-kort.js / kc-larare.js.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parsePrize, sessionPrize, prizeShare, prizeText, validateSessionInput, buildSessionDoc, buildResult,
  classStandings, LIVE_PRIZE_MAX,
} from "../src/live/live-core.js";
import {
  livePrisPoster, planKassaUt, planKassaUtWrites, planKassaInWrites, korLivePris, normaliseraHistorik, kassaSaldo,
} from "../src/klasscenter/kc-kassa-plan.js";
import { kassaRadHtml, kassaHistorikHtml, kassorText } from "../src/klasscenter/kc-kassa-html.js";
import { handlingHtml, panelHtml, skankText } from "../src/klasscenter/kc-shop-kort.js";
import { donatorerPerForemal, kassorerHtml } from "../src/klasscenter/kc-larare.js";
import { kcShopItem } from "../src/klasscenter/kc-shop-items.js";

const S = { classNames: { a: "4B", b: "5E" }, participatingClassIds: ["a", "b"], classDivisors: { a: 2, b: 2 } };
const input = (over = {}) => ({
  name: "4B mot 5E", gameMode: "m", classIds: ["a", "b"], durationMin: 10, divisors: { a: 2, b: 2 }, ...over,
});

describe("Live-priset (live-core)", () => {
  it("parsePrize: tomt = 0, mellanslag ok, decimal/negativt/text = NaN", () => {
    assert.equal(parsePrize(""), 0);
    assert.equal(parsePrize(undefined), 0);
    assert.equal(parsePrize("1 000"), 1000);
    assert.ok(Number.isNaN(parsePrize("1.5")));
    assert.ok(Number.isNaN(parsePrize("-5")));
    assert.ok(Number.isNaN(parsePrize("abc")));
  });
  it("validering: 0–100 000 ok, annat fel", () => {
    assert.deepEqual(validateSessionInput(input({ coinPrize: "1000" })), []);
    assert.deepEqual(validateSessionInput(input()), []);
    assert.equal(validateSessionInput(input({ coinPrize: String(LIVE_PRIZE_MAX + 1) })).length, 1);
    assert.equal(validateSessionInput(input({ coinPrize: "-1" })).length, 1);
  });
  it("buildSessionDoc: coinPrize bara när > 0", () => {
    assert.equal(buildSessionDoc(input({ coinPrize: "1000" }), { uid: "t" }).coinPrize, 1000);
    assert.equal("coinPrize" in buildSessionDoc(input({ coinPrize: "" }), { uid: "t" }), false);
    assert.equal("coinPrize" in buildSessionDoc(input({ coinPrize: "0" }), { uid: "t" }), false);
  });
  it("buildResult.winnerClasses: vinnare, oavgjort = alla ledare, 0 poäng = ingen", () => {
    const st = (a, b) => classStandings(S, { a, b }, [{ classId: "a" }, { classId: "b" }]);
    assert.deepEqual(buildResult(S, st(10, 4)).winnerClasses, ["a"]);
    assert.deepEqual(buildResult(S, st(6, 6)).winnerClasses, ["a", "b"]);
    assert.deepEqual(buildResult(S, st(0, 0)).winnerClasses, []);
  });
  it("kooperativt: alla som spelade om målet nåddes, annars ingen", () => {
    const mode = (ok) => ({ id: "m", cooperative: true, goalReached: () => ok });
    const s = { ...S, gameMode: "m" };
    const st = classStandings(s, { a: 3, b: 1 }, [{ classId: "a" }]);
    assert.deepEqual(buildResult(s, st, [], mode(true)).winnerClasses, ["a"]);
    assert.deepEqual(buildResult(s, st, [], mode(false)).winnerClasses, []);
  });
  it("sessionPrize, prizeShare och texterna", () => {
    assert.equal(sessionPrize({ coinPrize: 1000 }), 1000);
    assert.equal(sessionPrize({ coinPrize: 0 }), 0);
    assert.equal(sessionPrize({}), 0);
    assert.equal(prizeShare(1001, 2), 500);
    assert.equal(prizeShare(1000, 3), 333);
    assert.equal(prizeShare(1000, 0), 0);
    const s = { ...S, coinPrize: 1000 };
    assert.equal(prizeText({}), "");
    assert.match(prizeText(s), /^Vinnarklassen får 1[\s\u00a0]000 mynt till klasskassan!$/);
    assert.match(prizeText(s, { winnerClasses: ["a"] }), /^4B får 1[\s\u00a0]000 mynt till klasskassan!$/);
    assert.match(prizeText(s, { winnerClasses: ["a", "b"] }), /500 mynt var/);
    assert.match(prizeText(s, { winnerClasses: [] }), /delas inte ut/);
  });
});

describe("kc-kassa-plan", () => {
  const fin = (over = {}) => ({
    name: "4B mot 5E", status: "finished", startedAt: 1, coinPrize: 1000, result: { winnerClasses: ["a"] }, ...over,
  });
  it("livePrisPoster: id live-<sid>, andel, inget utan pris/slut/result", () => {
    assert.deepEqual(livePrisPoster("s1", fin()), [{ classId: "a", txId: "live-s1", belopp: 1000, titel: "4B mot 5E" }]);
    assert.deepEqual(livePrisPoster("s1", fin({ result: { winnerClasses: ["a", "b"] }, coinPrize: 1001 })).map((p) => p.belopp), [500, 500]);
    assert.deepEqual(livePrisPoster("s1", fin({ coinPrize: 0 })), []);
    assert.deepEqual(livePrisPoster("s1", fin({ status: "live" })), []);
    assert.deepEqual(livePrisPoster("s1", fin({ startedAt: null })), []);
    assert.deepEqual(livePrisPoster("s1", fin({ result: null })), []);
    assert.deepEqual(livePrisPoster("s1", fin({ result: { winnerClasses: [] } })), []);
  });
  it("planKassaInWrites: saldo increment + historik", () => {
    const fv = { increment: (n) => ({ inc: n }), serverTimestamp: () => "TS" };
    const w = planKassaInWrites({ classId: "a", post: livePrisPoster("s1", fin())[0], uid: "t", sessionId: "s1", fv });
    assert.deepEqual(w[0], { path: ["classCenters", "a", "kassa", "saldo"], data: { saldo: { inc: 1000 }, lastTxId: "live-s1" }, merge: true });
    assert.deepEqual(w[1].data, { typ: "in", kalla: "live", sessionId: "s1", titel: "4B mot 5E", belopp: 1000, at: "TS", av: "t" });
  });
  it("korLivePris: redan betald hoppas över, nekad rapporteras", async () => {
    const finns = new Set(["a"]);
    const sdk = {
      doc: (_db, ...p) => p.join("/"),
      getDoc: async (p) => ({ exists: () => finns.has(p.split("/")[1]) }),
      writeBatch: () => ({ set() {}, commit: async () => { throw Object.assign(new Error("x"), { code: "permission-denied" }); } }),
      increment: (n) => n, serverTimestamp: () => 0,
    };
    const r = await korLivePris(sdk, {}, { sid: "s1", session: fin({ result: { winnerClasses: ["a", "b"] } }), uid: "t" });
    assert.deepEqual(r.map((x) => [x.classId, x.status]), [["a", "redan"], ["b", "nekad"]]);
  });
  it("planKassaUt: cappar till saldo och det som saknas; tom kassa", () => {
    const item = kcShopItem("guldstaty");
    const p = planKassaUt({ item, amount: 300, saldo: 200 });
    assert.equal(p.amount, 200);
    assert.equal(p.saldo, 0);
    assert.equal(p.cappat, true);
    const q = planKassaUt({ item, fund: { targetPrice: 5000, fundedAmount: 4950 }, amount: 300, saldo: 1000 });
    assert.equal(q.amount, 50);
    assert.equal(q.isUnlocked, true);
    assert.equal(planKassaUt({ item, amount: 10, saldo: 0 }).error, "Klasskassan är tom.");
  });
  it("planKassaUtWrites: kassa −n, historik ut, donation kassa:true, fund +n", () => {
    const item = kcShopItem("guldstaty");
    const plan = planKassaUt({ item, amount: 300, saldo: 1000 });
    const fv = { serverTimestamp: () => "TS" };
    const w = planKassaUtWrites({ classId: "a", uid: "k", itemId: "guldstaty", plan, txId: "tx", saldoFore: 1000, fv });
    assert.deepEqual(w.map((x) => x.path.join("/")), [
      "classCenters/a/kassa/saldo", "classCenters/a/kassaHistorik/tx", "classCenters/a/donations/tx", "classCenters/a/fund/guldstaty",
    ]);
    assert.equal(w[0].data.saldo, 700);
    assert.deepEqual(w[1].data, { typ: "ut", itemId: "guldstaty", belopp: 300, uid: "k", at: "TS" });
    assert.equal(w[2].data.kassa, true);
    assert.equal(w[3].data.fundedAmount, 300);
  });
  it("normaliseraHistorik + kassaSaldo", () => {
    const docs = [
      { id: "1", data: { typ: "in", belopp: 1000, at: 1 } },
      { id: "2", data: { typ: "ut", belopp: 300, at: 5 } },
      { id: "3", data: { typ: "x", at: 9 } },
    ];
    assert.deepEqual(normaliseraHistorik(docs).map((p) => p.id), ["2", "1"]);
    assert.equal(kassaSaldo({ saldo: 12.7 }), 12);
    assert.equal(kassaSaldo(null), 0);
  });
});

describe("Kassans HTML", () => {
  it("kassaRadHtml: saldo, kassörstext, historik dold/öppen", () => {
    const h = kassaRadHtml(1200, { kan: true });
    assert.match(h, /1[\s ]200 mynt/);
    assert.match(h, /Du är klasskassör/);
    assert.match(h, /kcs-kassa-lista" hidden/);
    assert.doesNotMatch(kassaRadHtml(0, { kan: false }), /Du är klasskassör/);
    assert.match(kassaRadHtml(0, { oppen: true }), /kcs-kassa-lista"><\/div>/);
  });
  it("kassorText", () => {
    assert.equal(kassorText([]), "");
    assert.equal(kassorText(["Ali"]), "Klassens kassör: Ali.");
    assert.equal(kassorText(["Ali", "Bea", "Cem"]), "Klassens kassörer: Ali, Bea och Cem.");
  });
  it("kassaHistorikHtml: in och ut med vem, tom lista", () => {
    const h = kassaHistorikHtml([
      { typ: "ut", itemId: "guldstaty", belopp: 300, uid: "u1", at: null },
      { typ: "in", titel: "4B mot 5E", belopp: 1000, at: null },
    ], { namnFor: (u) => (u === "u1" ? "Kalle" : "?") });
    assert.match(h, /−300/);
    assert.match(h, /Guldstaty · av Kalle/);
    assert.match(h, /\+1[\s ]000/);
    assert.match(h, /Live-match: 4B mot 5E/);
    assert.match(kassaHistorikHtml([]), /Inga händelser/);
  });
  it("kortets knappar: kassör ser 'Från klasskassan', vanlig elev inte, tom kassa avstängd", () => {
    const fund = { targetPrice: 5000, fundedAmount: 0 };
    assert.doesNotMatch(handlingHtml(fund, 100), /kcs-fran-kassan/);
    assert.doesNotMatch(handlingHtml(fund, 100, { kan: false, saldo: 500 }), /kcs-fran-kassan/);
    assert.match(handlingHtml(fund, 100, { kan: true, saldo: 500 }), /kcs-fran-kassan">/);
    assert.match(handlingHtml(fund, 100, { kan: true, saldo: 0 }), /kcs-fran-kassan" disabled/);
    assert.match(handlingHtml({ ...fund, isUnlocked: true }, 100, { kan: true, saldo: 5 }), /Köpt/);
  });
  it("panel i kassaläge + skankText", () => {
    assert.match(panelHtml({ saknas: 500, max: 300 }, 100, { kassa: true }), /Från klasskassan/);
    assert.match(panelHtml({ saknas: 500, max: 300 }, 100, { kassa: true }), /Lägg 100 från kassan/);
    assert.equal(skankText(50, false), "Skänk 50");
    assert.equal(skankText(0, true), "Lägg från kassan");
  });
  it("lärarsidan: kassa-donationer samlas som Klasskassan, kassörs-kryssrutor", () => {
    const per = donatorerPerForemal([
      { itemId: "guldstaty", uid: "k1", amount: 300, kassa: true },
      { itemId: "guldstaty", uid: "k2", amount: 200, kassa: true },
      { itemId: "guldstaty", uid: "k1", amount: 50 },
    ]).get("guldstaty");
    assert.deepEqual(per.map((r) => [r.uid, r.summa]), [["kassa", 500], ["k1", 50]]);
    const h = kassorerHtml([{ id: "a", namn: "Ali" }, { id: "b", namn: "Bea" }], ["b"]);
    assert.match(h, /data-kc-kassor="a" \/>/);
    assert.match(h, /data-kc-kassor="b" checked/);
  });
});
