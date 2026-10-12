// ============================================================================
// Tester: Hitta rätt! – startsidan (#605) och lämna-vakten.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  KATEGORIER, grupperaPack, startsidaHtml, packKortHtml, formatBast, formatTid,
} from "../src/hitta-ratt/hr-start-vy.js";
import { armeraLamnaVakt, lamnaVaktAktiv } from "../src/hitta-ratt/hr-lamna-vakt.js";

const index = JSON.parse(readFileSync(new URL("../src/hitta-ratt/content/packs/index.json", import.meta.url)));

test("alla pack hamnar i någon av de fyra kategorierna, i ordning", () => {
  assert.deepEqual(KATEGORIER.map((k) => k.namn), ["Sverige", "Europa", "Världen", "Kända platser"]);
  const g = grupperaPack(index);
  assert.deepEqual(g.map((k) => k.id), ["sverige", "europa", "varlden", "kanda-platser"]);
  assert.equal(g.reduce((n, k) => n + k.pack.length, 0), index.length);
});

test("kortet visar namn, typ, antal frågor, svårighet och Spela", () => {
  const p = index.find((x) => x.id === "europa-huvudstader-alla");
  const h = packKortHtml(p, undefined);
  assert.match(h, /Europas huvudstäder – alla/);
  assert.match(h, /Punkt/);
  assert.match(h, /46 frågor/);
  assert.match(h, /hr-niva-rod/);
  assert.match(h, />Spela</);
  assert.doesNotMatch(h, /Ditt bästa/);
  assert.match(packKortHtml(index.find((x) => x.id === "sverige-landskap")), /Område.*hr-niva-gul/s);
  assert.match(packKortHtml(index.find((x) => x.id === "sverige-stader")), /hr-niva-gron/);
});

test("personbästa: punkt = poäng, område = rätt + tid", () => {
  assert.equal(formatBast({ typ: "point", s: 1743, max: 2000 }), "1743 p");
  assert.equal(formatBast({ typ: "area", r: 24, t: 1180, max: 25 }), "24/25 rätt · 1:58");
  assert.equal(formatBast(undefined), "");
  assert.equal(formatTid(990), "1:39");
  const h = packKortHtml(index[0], { typ: "point", s: 1500 });
  assert.match(h, /Ditt bästa: <b>1500 p<\/b>/);
});

test("startsidan har 🏆-knappen men inga topplistor, och inget är låst", () => {
  const h = startsidaHtml(index, {});
  assert.match(h, /🏆 Topplistor/);
  assert.doesNotMatch(h, /Top 15|låst|disabled/i);
  assert.equal((h.match(/class="btn gron hr-spela"/g) || []).length, index.length);
});

test("titlar escapas", () => {
  const h = packKortHtml({ id: "x", title: "<b>x</b>", type: "area", antal: 1, difficulty: "grund" });
  assert.doesNotMatch(h, /<b>x<\/b>/);
});

// --- lämna-vakten ----------------------------------------------------------
function fakeWin() {
  const ls = {};
  const win = {
    addEventListener: (t, f, c) => ((ls[t] ||= []).push({ f, c })),
    removeEventListener: (t, f) => (ls[t] = (ls[t] || []).filter((x) => x.f !== f)),
    history: { state: null, replaced: null, replaceState(_s, _t, u) { this.replaced = u; } },
    fire(t, e) { for (const x of [...(ls[t] || [])]) x.f(e); },
    ls,
  };
  return win;
}

test("vakten: Avbryt stoppar routern och återställer hashen", () => {
  const win = fakeWin();
  const av = armeraLamnaVakt({ win, fraga: () => false });
  assert.equal(typeof win.__ppLamnaVakt, "function", "routerns krok");
  const stanna = win.__ppLamnaVakt({ oldURL: "http://x/#/elev/hitta-ratt?pack=a", newURL: "http://x/#/elev/hus" });
  assert.equal(stanna, true);
  assert.equal(win.history.replaced, "#/elev/hitta-ratt?pack=a");
  assert.ok(lamnaVaktAktiv());
  av();
  assert.equal(win.__ppLamnaVakt, null);
  assert.equal(win.ls.beforeunload.length, 0);
  assert.ok(!lamnaVaktAktiv());
});

test("vakten: OK släpper igenom och avarmerar", () => {
  const win = fakeWin();
  armeraLamnaVakt({ win, fraga: () => true });
  assert.equal(win.__ppLamnaVakt({ oldURL: "a#/1", newURL: "a#/2" }), false);
  assert.ok(!lamnaVaktAktiv());
  assert.equal(win.__ppLamnaVakt, null);
});

test("Logga ut frågar vakten FÖRE utloggningen (#611 F1)", () => {
  // Annars loggas eleven ut även om hen svarar Avbryt och blir kvar i omgången utloggad.
  const ui = readFileSync(new URL("../src/ui.js", import.meta.url), "utf8");
  const klick = ui.slice(ui.indexOf('"#logout-btn"'));
  const vakt = klick.indexOf("__ppLamnaVakt");
  assert.ok(vakt > 0, "logout-knappen frågar lämna-vakten");
  assert.ok(vakt < klick.indexOf("data.logout()"), "vakten frågas före data.logout()");
});
