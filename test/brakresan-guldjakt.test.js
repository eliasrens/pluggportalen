// Bråkresan #715 J: guldjaktens texter i klienten (src/brakresan/guldjakt.js) och
// drakpanelens jaktdata (drakInfo). Servern testas i functions-brakresan-jakt.test.mjs.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { jaktTexter, jaktFelText, kistaSvg, KLAR_TEXT } from "../src/brakresan/guldjakt.js";
import { drakInfo } from "../src/brakresan/drakpanel.js";

describe("guldjaktens texter", () => {
  test("bekräftat fynd och återhämtning (already) visar samma belopp", () => {
    const ny = jaktTexter({ amount: 37, level: 4, max: 40, already: false });
    assert.equal(ny.fynd, "Draken hittade 37 mynt!");
    assert.equal(ny.plus, "+37");
    assert.equal(ny.detalj, "Nivå 4 letar 1–40 mynt.");
    assert.equal(ny.klar, "Dagens jakt är klar – tillbaka imorgon.");
    assert.equal(KLAR_TEXT, ny.klar);
    assert.equal(jaktTexter({ amount: 1, level: 15, max: 200, already: true }).fynd, "Dagens jakt är redan gjord. Draken hittade 1 mynt.");
  });

  test("fel är sakliga, utlovar inga mynt och erbjuder bara säkra omförsök", () => {
    const nat = jaktFelText({ code: "unavailable", retryable: true });
    assert.equal(nat.igen, true);
    assert.match(nat.text, /Ingen kontakt/);
    assert.match(nat.text, /Inga mynt har lagts till/);
    assert.equal(jaktFelText({ code: "internal" }).igen, true);
    const agg = jaktFelText({ code: "failed-precondition", message: "Ägget har inte kläckts ännu." });
    assert.deepEqual(agg, { text: "Ägget har inte kläckts ännu.", igen: false });
    assert.equal(jaktFelText({ code: "permission-denied" }).igen, false);
    assert.equal(jaktFelText({ code: "unauthenticated" }).igen, false);
  });

  test("kistan är dekor (aria-hidden) och kan ritas öppen", () => {
    assert.match(kistaSvg(), /aria-hidden="true"/);
    assert.match(kistaSvg(true), /gj-kista--oppen/);
    assert.doesNotMatch(kistaSvg(false), /gj-kista--oppen/);
  });
});

describe("drakpanelens jaktdata", () => {
  test("dagens fynd visas bara när serverns lastDate är idag", () => {
    const st = { totalStars: 150, dragon: {}, hunts: { count: 3, coins: 410, lastDate: "2026-10-15", lastAmount: 200 } };
    const idag = drakInfo(st, { idag: "2026-10-15" }).jakt;
    assert.deepEqual([idag.klarIdag, idag.idagFynd, idag.antal, idag.mynt, idag.max], [true, 200, 3, 410, 200]);
    const imorgon = drakInfo(st, { idag: "2026-10-16" }).jakt;
    assert.deepEqual([imorgon.klarIdag, imorgon.idagFynd], [false, null]);
    // Äldre state utan lastAmount: klar men inget belopp att visa.
    assert.equal(drakInfo({ ...st, hunts: { lastDate: "2026-10-15" } }, { idag: "2026-10-15" }).jakt.idagFynd, null);
  });

  test("ägget har ingen jakt; intervallen för nivå 1, 11 och 15", () => {
    assert.equal(drakInfo({ totalStars: 9 }).jakt, null);
    for (const [s, text] of [[10, "1–10 mynt"], [110, "1–120 mynt"], [150, "1–200 mynt"]]) {
      assert.equal(drakInfo({ totalStars: s, dragon: {} }).jakt.intervallText, text);
    }
  });
});
