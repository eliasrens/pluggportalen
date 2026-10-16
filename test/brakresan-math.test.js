// ============================================================================
// Bråkresan (#706): matematikmotorn – ALLA exempel i spec §15 "Matematikmotor"
// (docs/BRAKRESAN-SPEC.md) + enheter för form, inmatning, formkrav och ord.
// ============================================================================

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  q, add, sub, mul, div, eq, cmp, gcd, lcm, isQ, toMixedParts, fromMixed, numeratorFor, commonDenominator,
  fraction, mixed, integer, decimal, percent, valueOf, formatForm, isSimplest, simplify, mixedFormOf, fractionFormOf,
  isTerminating, decimalPlaces, decimalText, fitsDecimals, placeValues,
  fromPercent, integerPercent, percentOf, percentOfWhole, discount, increase,
  relation, sortAscending, allDistinct, isAscending,
  parseFraction, parseMixed, parseDecimal, parsePercent, parseInteger, parseText,
  checkForm, fractionWords, speakForm, numberWords, partName,
} from "../src/brakresan/math/index.js";

const Q = (n, d = 1) => q(n, d);
const val = (text) => {
  const r = parseText(text);
  assert.equal(r.ok, true, `"${text}" ska gå att tolka`);
  return valueOf(r.form);
};

describe("§15 Matematikmotor – specens exempel", () => {
  test("2/4 = 1/2; 0,50 = 0,5; 25 % = 1/4", () => {
    assert.ok(eq(val("2/4"), val("1/2")));
    assert.deepEqual(q(2, 4), { n: 1, d: 2 });
    assert.ok(eq(val("0,50"), val("0,5")));
    assert.ok(eq(val("0.50"), val("0,5")), "punkt godtas som decimaltecken");
    assert.ok(eq(val("25 %"), Q(1, 4)));
    assert.ok(eq(fromPercent(25), Q(1, 4)));
  });

  test("1/2 + 1/4 = 3/4", () => assert.deepEqual(add(Q(1, 2), Q(1, 4)), Q(3, 4)));
  test("3/4 − 1/6 = 7/12", () => assert.deepEqual(sub(Q(3, 4), Q(1, 6)), Q(7, 12)));

  test("3 · 2/5 = 6/5 = 1 1/5", () => {
    const p = mul(Q(3), Q(2, 5));
    assert.deepEqual(p, Q(6, 5));
    assert.equal(formatForm(mixedFormOf(p)), "1 1/5");
    assert.ok(eq(val("1 1/5"), Q(6, 5)));
  });

  test("1/2 · 3/4 = 3/8", () => assert.deepEqual(mul(Q(1, 2), Q(3, 4)), Q(3, 8)));
  test("3/4 ÷ 3 = 1/4", () => assert.deepEqual(div(Q(3, 4), Q(3)), Q(1, 4)));
  test("1/2 ÷ 1/4 = 2", () => assert.deepEqual(div(Q(1, 2), Q(1, 4)), Q(2)));

  test("25 % av 80 = 20; 6 av 24 = 25 %; nytt pris efter 25 % rabatt på 200 = 150", () => {
    assert.deepEqual(percentOf(25, 80), Q(20));
    assert.deepEqual(percentOfWhole(6, 24), Q(25));
    const r = discount(200, 25);
    assert.deepEqual(r.discount, Q(50));
    assert.deepEqual(r.newPrice, Q(150));
  });

  test("2/3 = 8/12 och 11/4 = 2 3/4", () => {
    assert.ok(eq(Q(2, 3), Q(8, 12)));
    assert.equal(numeratorFor(Q(2, 3), 12), 8);
    assert.deepEqual(toMixedParts(Q(11, 4)), { whole: 2, n: 3, d: 4 });
    assert.equal(formatForm(mixedFormOf(Q(11, 4))), "2 3/4");
    assert.ok(eq(val("11/4"), val("2 3/4")));
  });

  test("nämnare 0 och tomma/ofullständiga strukturer avvisas som INMATNINGSFEL (ingen bedömning)", () => {
    assert.deepEqual(parseFraction({ n: "3", d: "0" }).error, "namnare-noll");
    assert.equal(parseFraction({ n: "", d: "" }).error, "tom");
    assert.equal(parseFraction({ n: "3", d: "" }).error, "ofullstandig");
    assert.equal(parseFraction({ n: "", d: "4" }).error, "ofullstandig");
    assert.equal(parseMixed({ whole: "2", n: "1", d: "0" }).error, "namnare-noll");
    assert.equal(parseMixed({}).error, "tom");
    assert.equal(parseDecimal("").error, "tom");
    assert.equal(parseDecimal(",").error, "ogiltig");
    assert.equal(parsePercent(" % ").error, "tom");
    assert.equal(parseText("3/0").error, "namnare-noll");
    for (const r of [parseFraction({ n: "3", d: "0" }), parseFraction({}), parseDecimal("abc")]) {
      assert.equal(r.ok, false);
      assert.equal(typeof r.message, "string", "inmatningsfel har ett begripligt meddelande");
      assert.equal("correct" in r, false, "inmatningsfel bär ingen bedömning");
    }
    assert.throws(() => q(1, 0), RangeError);
    assert.throws(() => checkForm(null, Q(1)), TypeError, "en otolkad struktur kan inte bedömas");
  });

  test("6/8 godtas på värdefråga om 3/4 men inte som färdig enklaste form", () => {
    const sexAttondelar = parseFraction({ n: "6", d: "8" }).form;
    assert.equal(checkForm(sexAttondelar, Q(3, 4)).correct, true);
    assert.equal(checkForm(sexAttondelar, Q(3, 4), { kind: "value" }).correct, true);
    const r = checkForm(sexAttondelar, Q(3, 4), { kind: "simplest" });
    assert.equal(r.correct, false);
    assert.equal(r.valueOk, true, "värdet är rätt – det är skrivformen som saknas");
    assert.equal(r.reason, "ej-enklaste");
    assert.match(r.message, /enklaste form/);
    assert.equal(checkForm(fraction(3, 4), Q(3, 4), { kind: "simplest" }).correct, true);
  });

  test("1/3 behandlas aldrig som exakt 0,33", () => {
    assert.equal(isTerminating(Q(1, 3)), false);
    assert.equal(decimalText(Q(1, 3)), null);
    assert.equal(decimalPlaces(Q(2, 3)), null);
    assert.equal(eq(val("0,33"), Q(1, 3)), false);
    assert.equal(eq(val("0,333333"), Q(1, 3)), false);
    assert.throws(() => decimal(Q(1, 3)), RangeError);
    assert.equal(integerPercent(Q(1, 3)), null, "1/3 är inte en hel procent");
    assert.equal(checkForm(parseDecimal("0,33").form, Q(1, 3)).correct, false);
  });
});

describe("rationella tal", () => {
  test("gcd-normalisering och positiv nämnare", () => {
    assert.deepEqual(q(4, 6), { n: 2, d: 3 });
    assert.deepEqual(q(3, -6), { n: -1, d: 2 });
    assert.deepEqual(q(0, 7), { n: 0, d: 1 });
    assert.equal(isQ(q(6, 8)), true);
    assert.equal(isQ({ n: 6, d: 8 }), false);
    assert.equal(isQ({ n: 1, d: -2 }), false);
    assert.equal(gcd(12, 18), 6);
    assert.equal(lcm(4, 6), 12);
    assert.equal(commonDenominator([Q(3, 4), Q(1, 6)]), 12);
    assert.deepEqual(fromMixed(2, 3, 4), Q(11, 4));
    assert.equal(numeratorFor(Q(3, 4), 6), null);
  });

  test("osäkra heltal kastar i stället för att bli inexakta", () => {
    assert.throws(() => mul(Q(2 ** 40), Q(2 ** 20)), RangeError);
  });

  test("exakt jämförelse utan flyttal", () => {
    assert.equal(cmp(Q(2, 3), Q(3, 5)), 1);
    assert.equal(relation(Q(2, 3), Q(3, 5)), ">");
    assert.equal(relation(Q(1, 2), Q(2, 4)), "=");
    assert.equal(relation(Q(3, 8), Q(5, 8)), "<");
    // 0,1 + 0,2 = 0,3 exakt (flyttal skulle säga nej)
    assert.ok(eq(add(val("0,1"), val("0,2")), val("0,3")));
  });

  test("sortering och unikhet", () => {
    const v = [Q(3, 4), Q(1, 4), Q(1, 2), Q(1, 3)];
    assert.deepEqual(sortAscending(v), [Q(1, 4), Q(1, 3), Q(1, 2), Q(3, 4)]);
    assert.equal(allDistinct(v), true);
    assert.equal(allDistinct([Q(1, 2), q(2, 4)]), false);
    assert.equal(isAscending([val("20 %"), Q(1, 4), val("0,4"), val("75 %")]), true);
    assert.equal(isAscending([Q(1, 2), Q(1, 2), Q(3, 4)]), true, "lika värden i valfri inbördes ordning");
  });
});

describe("presentationsform skild från värde", () => {
  test("2/4 visas som 2/4 men har värdet 1/2", () => {
    const f = fraction(2, 4);
    assert.equal(formatForm(f), "2/4");
    assert.deepEqual(valueOf(f), Q(1, 2));
    assert.equal(isSimplest(f), false);
    assert.equal(formatForm(simplify(f)), "1/2");
  });

  test("blandad form, decimal med slutnolla, procent med hårt mellanslag", () => {
    assert.equal(formatForm(mixed(2, 3, 4)), "2 3/4");
    assert.throws(() => mixed(2, 5, 4), RangeError, "bråkdelen måste vara mindre än 1");
    assert.equal(formatForm(decimal(Q(1, 2), 2)), "0,50");
    assert.equal(formatForm(decimal(Q(7, 20))), "0,35");
    assert.equal(formatForm(percent(75)), "75 %");
    assert.equal(formatForm(integer(7)), "7");
    assert.equal(formatForm(fractionFormOf(Q(8, 4))), "2");
    assert.equal(formatForm(mixedFormOf(Q(3, 4))), "3/4");
  });

  test("decimaler: bara 2/5-nämnare, positionsvärden", () => {
    assert.equal(isTerminating(Q(7, 20)), true);
    assert.equal(isTerminating(Q(1, 6)), false);
    assert.equal(decimalText(Q(3, 4)), "0,75");
    assert.equal(decimalText(Q(5, 100)), "0,05");
    assert.equal(decimalText(Q(3, 2)), "1,5");
    assert.equal(decimalText(Q(1, 8)), "0,125");
    assert.equal(fitsDecimals(Q(1, 8), 2), false, "1/8 kräver tre decimaler – inte i standardläget (utm. 40)");
    assert.deepEqual(placeValues(Q(37, 100)), { whole: 0, tenths: 3, hundredths: 7 });
    assert.deepEqual(placeValues(val("1,5")), { whole: 1, tenths: 5, hundredths: 0 });
    assert.ok(eq(val("0,3"), val("0,30")));
    assert.equal(eq(val("0,5"), val("0,05")), false);
  });

  test("procent: samma exakta värde som bråk och decimal", () => {
    assert.ok(eq(fromPercent(75), val("0,75")));
    assert.ok(eq(fromPercent(75), Q(3, 4)));
    assert.equal(integerPercent(Q(7, 20)), 35);
    assert.deepEqual(percentOf(75, 40), Q(30));
    assert.deepEqual(increase(200, 10).newPrice, Q(220));
    assert.deepEqual(discount(80, 50).newPrice, Q(40));
  });
});

describe("inmatningsparser", () => {
  test("bråkfält: oreducerat sparas som skrivet", () => {
    assert.deepEqual(parseFraction({ n: "6", d: "8" }), { ok: true, form: { kind: "fraction", n: 6, d: 8 } });
    assert.deepEqual(parseFraction({ n: " 3 ", d: "04" }).form, { kind: "fraction", n: 3, d: 4 });
    assert.equal(parseFraction({ n: "−3", d: "4" }).error, "ogiltig", "inga negativa tal i modulen");
    assert.equal(parseFraction({ n: "1,5", d: "4" }).error, "ogiltig");
  });

  test("blandad form: tomt heltal = bråk, tom bråkdel = heltal", () => {
    assert.deepEqual(parseMixed({ whole: "2", n: "3", d: "4" }).form, { kind: "mixed", whole: 2, n: 3, d: 4 });
    assert.deepEqual(parseMixed({ whole: "", n: "3", d: "4" }).form, { kind: "fraction", n: 3, d: 4 });
    assert.deepEqual(parseMixed({ whole: "2", n: "", d: "" }).form, { kind: "integer", v: 2 });
    assert.equal(parseMixed({ whole: "2", n: "3", d: "" }).error, "ofullstandig");
  });

  test("decimal och procent: komma eller punkt, slutnollor, mellanslag", () => {
    assert.deepEqual(parseDecimal("0,50").form, { kind: "decimal", value: { n: 1, d: 2 }, places: 2 });
    assert.deepEqual(parseDecimal("0.5").form.value, { n: 1, d: 2 });
    assert.deepEqual(parseDecimal(",5").form.value, { n: 1, d: 2 });
    assert.deepEqual(parseDecimal("2").form.value, { n: 2, d: 1 });
    assert.equal(parseDecimal("1,2,3").ok, false);
    assert.equal(parseDecimal("1e3").ok, false, "ingen exponentnotation");
    assert.deepEqual(parsePercent("25 %").form.p, { n: 25, d: 1 });
    assert.deepEqual(parsePercent("25%").form.p, { n: 25, d: 1 });
    assert.deepEqual(parsePercent("12,5").form.p, { n: 25, d: 2 });
    assert.equal(parseInteger("12").form.v, 12);
    assert.equal(parseInteger("12,0").ok, false);
    assert.equal(parseInteger("1234567890").ok, false, "orimligt långa tal avvisas");
  });
});

describe("formkrav (utm. 14, 21, 28, 36, 40–46)", () => {
  test("angiven nämnare (14): 3/4 = ?/12", () => {
    const req = { kind: "denominator", d: 12 };
    assert.equal(checkForm(fraction(9, 12), Q(3, 4), req).correct, true);
    const r = checkForm(fraction(3, 4), Q(3, 4), req);
    assert.equal(r.correct, false);
    assert.equal(r.reason, "fel-namnare");
    assert.match(r.message, /nämnaren 12/);
    assert.equal(checkForm(fraction(8, 12), Q(3, 4), req).reason, "fel-varde");
  });

  test("blandad form med förkortad bråkdel (28, 36)", () => {
    const req = { kind: "mixed" };
    assert.equal(checkForm(mixed(2, 3, 4), Q(11, 4), req).correct, true);
    assert.equal(checkForm(fraction(11, 4), Q(11, 4), req).reason, "ej-blandad");
    assert.equal(checkForm(parseMixed({ whole: "1", n: "7", d: "4" }).form, Q(11, 4), req).reason, "ej-blandad");
    assert.equal(checkForm(mixed(1, 2, 4), Q(3, 2), req).reason, "ej-forkortad-del");
    assert.equal(checkForm(mixed(1, 2, 4), Q(3, 2), { kind: "mixed", simplified: false }).correct, true);
    assert.equal(checkForm(integer(2), Q(2), req).correct, true);
    assert.equal(checkForm(fraction(3, 4), Q(3, 4), req).correct, true, "värde under 1 = vanligt bråk");
  });

  test("bråkform (28 åt andra hållet: 1 2/3 → 5/3)", () => {
    const req = { kind: "fraction" };
    assert.equal(checkForm(fraction(5, 3), Q(5, 3), req).correct, true);
    assert.equal(checkForm(fraction(10, 6), Q(5, 3), req).correct, true);
    assert.equal(checkForm(fraction(10, 6), Q(5, 3), { kind: "fraction", simplified: true }).reason, "ej-enklaste");
    assert.equal(checkForm(mixed(1, 2, 3), Q(5, 3), req).reason, "ej-brakform");
  });

  test("decimal- och procentkrav bygger på samma värde", () => {
    assert.equal(checkForm(parseDecimal("0,750").form, Q(3, 4), { kind: "decimal" }).correct, true);
    assert.equal(checkForm(fraction(3, 4), Q(3, 4), { kind: "decimal" }).reason, "ej-decimal");
    assert.equal(checkForm(parsePercent("75").form, Q(3, 4), { kind: "percent" }).correct, true);
    assert.equal(checkForm(parsePercent("7,5").form, Q(3, 4), { kind: "percent" }).reason, "fel-varde");
    assert.equal(checkForm(parseDecimal("0,75").form, Q(3, 4), { kind: "percent" }).reason, "ej-procent");
    assert.equal(checkForm(integer(15), Q(15), { kind: "integer" }).correct, true);
  });
});

describe("uppläsning (§4, utm. 04)", () => {
  test("korrekt böjning", () => {
    assert.equal(fractionWords(1, 2), "en halv");
    assert.equal(fractionWords(3, 2), "tre halvor");
    assert.equal(fractionWords(3, 4), "tre fjärdedelar");
    assert.equal(fractionWords(2, 3), "två tredjedelar");
    assert.equal(fractionWords(1, 3), "en tredjedel");
    assert.equal(fractionWords(5, 8), "fem åttondelar");
    assert.equal(fractionWords(7, 10), "sju tiondelar");
    assert.equal(fractionWords(37, 100), "trettiosju hundradelar");
    assert.equal(partName(24), "tjugofjärdedel");
    assert.equal(numberWords(150), "hundrafemtio");
    assert.equal(numberWords(6000), "sextusen");
  });

  test("formerna upplästa", () => {
    assert.equal(speakForm(mixed(2, 3, 4)), "två hela och tre fjärdedelar");
    assert.equal(speakForm(mixed(1, 1, 2)), "en hel och en halv");
    assert.equal(speakForm(decimal(Q(3, 4))), "noll komma sjuttiofem");
    assert.equal(speakForm(decimal(Q(1, 20))), "noll komma noll fem");
    assert.equal(speakForm(percent(25)), "tjugofem procent");
    assert.equal(speakForm(integer(7)), "sju");
  });
});
