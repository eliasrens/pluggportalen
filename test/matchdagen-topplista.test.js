// ============================================================================
// Matchdagen (#880): topplistan per årskurs – rangordningen, rimlighetskontrollen,
// filtreringen per årskurs (delat/md-topplista.js), fliken (vy/md-vy-topplista.js:
// placeringspolicyn, escape) och att fliken finns i appen. docs/MATCHDAGEN.md §21.
// Ren Node: node --test test/matchdagen-topplista.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  akLabel, akNyckel, arskursAvKlass, bastaDiv, byggTopplistor, elevArskurs, minMatcherTill, radFor, rangordna,
  rimligKarriar, sorteraNycklar, TAK, TOPP,
} from "../src/matchdagen/delat/md-topplista.js";
import { arskursAvKlass as mmArskurs } from "../src/tavling/arskurs.js";
import { arskursKnappar, topplistaHtml } from "../src/matchdagen/vy/md-vy-topplista.js";
import { matchKlar, nyKarriar, nySasong, sasongFro } from "../src/matchdagen/delat/md-sasong.js";
import { kvalKlar, kvalMatch } from "../src/matchdagen/delat/md-kval.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";
import { LAGANTAL } from "../src/matchdagen/delat/md-config.js";
import { harMatchdagen } from "../src/matchdagen/md-inst.js";

const NU = Date.UTC(2026, 10, 22, 10);
const stat = (fragor = 28, ratt = 20) => ({ skott: 5, skottPaMal: 3, pass: 12, passOk: 9, tacklingar: 6, vunnaBollar: 4, raddningar: 2, horner: 1, derasSkott: 3,
  fragor, ratt, perKalla: { "tabell:7": { fragor, ratt } }, sekunder: 420 });
const res = (oss, dem) => ({ oss, dem, utfall: "", mal: [], stat: stat() });

/** En karriär med givna summor (rimlig om inget annat sägs). */
function K(over = {}) {
  const { summa = {}, klubb = {}, ...rest } = over;
  return {
    klubb: { namn: "Blixtarna IF", farg: "#2f6fe8", legendStjarnor: 0, ...klubb },
    div: 0, sasong: 1, sasonger: [], dagar: { "2026-11-20": { m: 3 } },
    summa: { matcher: 10, v: 5, o: 2, f: 3, gjorda: 20, inslappta: 10, fragor: 280, ratt: 200, ...summa },
    ...rest,
  };
}

describe("årskursen", () => {
  it("arskursAvKlass är samma som Mattematchens (src/tavling/arskurs.js)", () => {
    for (const n of ["4B", "3A", "10A", "6", "Klass 3", "Fritids", "", null, undefined, "2024A", "0A", " 4B", "9c", "12X"]) {
      assert.deepEqual(arskursAvKlass(n), mmArskurs(n), String(n));
    }
  });
  it("nycklar och etiketter; Övriga sist", () => {
    assert.equal(akNyckel(4), "4");
    assert.equal(akNyckel("Övriga"), "ovriga");
    assert.equal(akLabel("4"), "Åk 4");
    assert.equal(akLabel("ovriga"), "Övriga");
    assert.deepEqual(sorteraNycklar(["ovriga", "10", "4", "3"]), ["3", "4", "10", "ovriga"]);
  });
  it("elevens årskurs: bara klasser där eleven har Matchdagen, den lägsta", () => {
    const klasser = [
      { name: "6A", studentIds: ["a"], enabledModules: ["matchdagen"] },
      { name: "4B", studentIds: ["a", "b"], elevModuler: { a: ["matchdagen"] } },
      { name: "3C", studentIds: ["a"] },
      { name: "Fritids", studentIds: ["c"], enabledModules: ["matchdagen"] },
    ];
    assert.equal(elevArskurs(klasser, "a", harMatchdagen), "4");
    assert.equal(elevArskurs(klasser, "b", harMatchdagen), null, "4B utan Matchdagen för b");
    assert.equal(elevArskurs(klasser, "c", harMatchdagen), "ovriga");
    assert.equal(elevArskurs(null, "a", harMatchdagen), null);
  });
});

describe("rimlighetskontrollen", () => {
  it("en vanlig karriär är rimlig", () => assert.deepEqual(rimligKarriar(K()), { ok: true, skal: "" }));
  it("en riktig karriär genom två kval är rimlig hela vägen (precis efter kvalet också)", () => {
    const r = skapaPrng("t880").tal;
    let k = nyKarriar({ namn: "Testlaget", farg: "#2f6fe8", rng: r });
    let nr = 0;
    for (let s = 0; s < 2; s++) {
      for (let i = 0; i < LAGANTAL[k.div] - 1; i++) {
        k = matchKlar(k, { res: res(6, 0), rng: r, nu: NU, matchId: `m${nr++}` }).K;
        assert.ok(rimligKarriar(k).ok, `${rimligKarriar(k).skal} efter match ${nr}`);
      }
      assert.ok(kvalMatch(k), "ligavinnaren kvalar");
      k = kvalKlar(k, { res: res(2, 1), nu: NU, matchId: `k${s}` }).K;
      assert.equal(k.div, s + 1);
      assert.ok(rimligKarriar(k).ok, `precis efter kvalet: ${rimligKarriar(k).skal}`);
      k = nySasong(k, skapaPrng(sasongFro(k, "u")).tal);
      assert.ok(rimligKarriar(k).ok);
    }
    assert.equal(k.summa.matcher, minMatcherTill(2), "det snabbaste möjliga");
    assert.equal(bastaDiv(k), 2);
  });
  const fall = [
    ["v + o + f ≠ matcher", { summa: { v: 9 } }],
    ["negativt", { summa: { f: -1, v: 9 } }],
    ["flyttal", { summa: { v: 5.5 } }],
    ["för många mål", { summa: { gjorda: 1000 } }],
    ["fler rätt än frågor", { summa: { ratt: 300 } }],
    ["färre frågor än matcher", { summa: { fragor: 5, ratt: 1 } }],
    ["Superligan efter 10 matcher", { div: 7, sasong: 8 }],
    ["Division 4 i säsong 1", { div: 2, summa: { matcher: 30, v: 25, o: 2, f: 3 } }],
    ["Superligan i säsongshistoriken utan matcher", { sasonger: [{ sasong: 1, div: 7 }] }],
    ["legendklubb utan matcher", { klubb: { legendStjarnor: 1 }, sasong: 20 }],
    ["för många matcher en dag", { dagar: { "2026-11-20": { m: 500 } }, summa: { matcher: 600, v: 300, o: 100, f: 200, fragor: 9000 } }],
    ["fler matcher i dagarna än totalt", { dagar: { "2026-11-20": { m: 11 } } }],
    ["okänd division", { div: 9 }],
    ["ingen summa", { summa: null }],
  ];
  for (const [namn, over] of fall) {
    it(`nej: ${namn}`, () => {
      const k = over.summa === null ? { ...K(), summa: null } : K(over);
      assert.equal(rimligKarriar(k).ok, false, namn);
    });
  }
  it("Superligan med tillräckligt många matcher och säsonger är rimlig", () => {
    const m = minMatcherTill(7);
    assert.equal(m, 6 + 6 + 8 + 8 + 10 + 10 + 12);
    assert.ok(rimligKarriar(K({ div: 7, sasong: 7, summa: { matcher: m, v: m, o: 0, f: 0, fragor: m * 20, ratt: m * 15 } })).ok);
    assert.equal(rimligKarriar(K({ div: 7, sasong: 6, summa: { matcher: m, v: m, o: 0, f: 0, fragor: m * 20, ratt: m * 15 } })).ok, false, "en säsong för lite");
  });
  it("bästa division: säsongshistoriken och legendklubben räknas", () => {
    assert.equal(bastaDiv(K({ div: 1, sasonger: [{ div: 3 }] })), 3);
    assert.equal(bastaDiv(K({ div: 0, klubb: { legendStjarnor: 2 } })), 7);
  });
});

const rad = (uid, d, v, gm, im, extra = {}) => ({ uid, n: uid, lag: "", f: "#000000", k: "", d, ls: 0, v, gm, im, m: v, ...extra });

describe("rangordningen", () => {
  it("division före legendstjärnor före vinster före målskillnad", () => {
    const ut = rangordna([
      rad("vinster", 2, 30, 50, 10), rad("division", 3, 1, 1, 9), rad("ms", 2, 30, 60, 10), rad("legend", 2, 0, 0, 0, { ls: 1 }),
    ]);
    assert.deepEqual(ut.map((r) => r.uid), ["division", "legend", "ms", "vinster"]);
    assert.deepEqual(ut.map((r) => r.plats), [1, 2, 3, 4]);
  });
  it("lika på allt = delad plats (1, 2, 2, 4), inom platsen på namnet", () => {
    const ut = rangordna([rad("Cleo", 1, 5, 10, 5), rad("Bo", 1, 5, 10, 5), rad("Ada", 2, 0, 0, 0), rad("Dan", 1, 4, 10, 5)]);
    assert.deepEqual(ut.map((r) => [r.uid, r.plats]), [["Ada", 1], ["Bo", 2], ["Cleo", 2], ["Dan", 4]]);
  });
  it("bara topp 5 – en delad femteplats tas med, högst TAK rader", () => {
    const tio = Array.from({ length: 10 }, (_, i) => rad(`e${i}`, 0, 10 - i, 0, 0));
    assert.equal(rangordna(tio).length, TOPP);
    const delad = [...tio.slice(0, 4), ...Array.from({ length: 6 }, (_, i) => rad(`f${i}`, 0, 1, 0, 0))];
    const ut = rangordna(delad);
    assert.equal(ut.length, TAK);
    assert.ok(ut.every((r) => r.plats <= TOPP));
    assert.equal(ut.at(-1).plats, 5);
  });
});

describe("byggTopplistor – filtreringen", () => {
  const e = (uid, ak, over = {}, namn = uid) => ({ uid, ak, K: K(over), namn, klass: `${ak}A` });
  it("per årskurs, otrimliga och tomma utanför, raden har division, vinster och mål", () => {
    const { arskurser, antal, uteslutna } = byggTopplistor([
      e("a", "3"), e("b", "3", { div: 1, sasong: 2 }), e("c", "4"), e("fusk", "4", { div: 7, sasong: 9 }),
      e("noll", "6", { summa: { matcher: 0, v: 0, o: 0, f: 0, gjorda: 0, inslappta: 0, fragor: 0, ratt: 0 }, dagar: {} }),
      { uid: "ingenklubb", ak: "6", K: { ...K(), klubb: null } }, { uid: "ingenak", ak: null, K: K() },
    ]);
    assert.deepEqual(Object.keys(arskurser), ["3", "4"]);
    assert.deepEqual(arskurser["3"].map((r) => r.uid), ["b", "a"]);
    assert.deepEqual(arskurser["4"].map((r) => r.uid), ["c"], "fusk är utanför");
    assert.equal(uteslutna, 1);
    assert.deepEqual(antal, { 3: 2, 4: 1 });
    const r = arskurser["3"][0];
    assert.deepEqual({ d: r.d, v: r.v, gm: r.gm, im: r.im, lag: r.lag, k: r.k, plats: r.plats }, { d: 1, v: 5, gm: 20, im: 10, lag: "Blixtarna IF", k: "3A", plats: 1 });
  });
  it("radFor: namnen kortas, okänd färg byts, inget annat ur karriären följer med", () => {
    const r = radFor("x", K({ klubb: { farg: "red;}" }, trupp: [1], kassa: 5 }), { namn: " ".repeat(3) + "x".repeat(60) });
    assert.equal(r.n.length, 40);
    assert.equal(r.f, "#888888");
    assert.deepEqual(Object.keys(r).sort(), ["d", "f", "gm", "im", "k", "lag", "ls", "m", "n", "uid", "v"]);
    assert.equal(radFor("y", K(), {}).n, "Elev");
  });
});

describe("fliken – placeringspolicyn", () => {
  const lista = {
    arskurser: {
      4: [1, 2, 3, 4, 5].map((p) => rad(`u${p}`, 3, 10 - p, 20, 5, { plats: p, n: `Elev ${p}`, lag: "Lag", k: "4A" })),
      6: [rad("s1", 7, 40, 90, 30, { plats: 1, n: "<img src=x onerror=alert(1)>", lag: "<b>Lag</b>", ls: 2 })],
    },
    byggd: NU,
  };
  it("eleven på listan: markerad, inget 'fortsätt kämpa'", () => {
    const h = topplistaHtml(lista, { ak: "4", uid: "u3", egen: "4" });
    assert.match(h, /class="vi"[^>]*aria-current="true"/);
    assert.match(h, /Elev 3 \(du\)/);
    assert.doesNotMatch(h, /fortsätt kämpa/);
  });
  it("eleven utanför topp 5: aldrig en egen placering, bara 'fortsätt kämpa!'", () => {
    const h = topplistaHtml(lista, { ak: "4", uid: "nisse", egen: "4" });
    assert.match(h, /fortsätt kämpa!/);
    assert.doesNotMatch(h, /\(du\)|plats \d|Din placering/i);
  });
  it("en annan årskurs: ingen rad om eleven själv; division, vinster, mål; escape", () => {
    const h = topplistaHtml(lista, { ak: "6", uid: "nisse", egen: "4" });
    assert.doesNotMatch(h, /fortsätt kämpa/);
    assert.match(h, /Superligan/);
    assert.match(h, /<td>40<\/td>/);
    assert.match(h, /90–30/);
    assert.doesNotMatch(h, /<img|<b>Lag/);
    assert.match(h, /&lt;img/);
    assert.match(h, /★★/);
  });
  it("knapparna: årskurserna med lista + den egna, den valda nedtryckt", () => {
    assert.deepEqual(arskursKnappar(lista, "3"), ["3", "4", "6"]);
    assert.deepEqual(arskursKnappar({ arskurser: { "x\"": [], 4: [] } }, null), ["4"], "okända nycklar bort");
    const h = topplistaHtml(lista, { ak: "6", uid: "u", egen: "4" });
    assert.match(h, /data-ak="6" aria-pressed="true"/);
    assert.match(h, /data-ak="4" aria-pressed="false"/);
  });
  it("tom årskurs: en uppmuntran, ingen tabell", () => {
    const h = topplistaHtml(lista, { ak: "3", uid: "u", egen: "3" });
    assert.doesNotMatch(h, /<table/);
    assert.match(h, /spela en match/);
  });
});

describe("appen", () => {
  it("md-app.js har fliken Topplista och laddar vyn lat", () => {
    const s = readFileSync(new URL("../src/matchdagen/md-app.js", import.meta.url), "utf8");
    assert.match(s, /\["topplista", "Topplista"\]/);
    assert.match(s, /import\("\.\/vy\/md-vy-topplista\.js"\)/);
  });
  it("md-data.js läser EN dokument: mdTopplista/skolan", () => {
    const s = readFileSync(new URL("../src/matchdagen/md-data.js", import.meta.url), "utf8");
    assert.match(s, /getDoc\(doc\(db, "mdTopplista", "skolan"\)\)/);
  });
});
