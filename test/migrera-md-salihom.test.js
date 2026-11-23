// ============================================================================
// Matchdagen: Hedda → Salihom i de sparade spelarna (#916) – den rena kärnan
// admin/migrera-md-salihom-core.mjs planeraNamnbyte(K) → patch | null.
//   trupp, reserver (objekt) och marknaden (rader, äldre: objekt) byts
//   bara förnamnet exakt "Hedda" – inte "Heddie", "Ahedda" eller efternamnet "Hedda"
//   allt annat i spelaren och dokumentet orört; andra körningen ger null
//   en migrerad karriär går igenom nyMarknad/marknadFranDok som förut
// Körs med: node --test test/migrera-md-salihom.test.js
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planeraNamnbyte, nyttNamn } from "../admin/migrera-md-salihom-core.mjs";
import { FORNAMN } from "../src/matchdagen/delat/md-namn.js";
import { nyKarriar } from "../src/matchdagen/delat/md-sasong.js";
import { marknadFranDok } from "../src/matchdagen/delat/md-trupp.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";

const sp = (id, namn, extra = {}) => ({ id, namn, pos: "MIT", nr: 8, st: 2, xp: 13, ...extra });
const efter = (K, patch) => ({ ...structuredClone(K), ...structuredClone(patch || {}) });

describe("nyttNamn", () => {
  it("bara förnamnet exakt Hedda", () => {
    assert.equal(nyttNamn("Hedda Berg"), "Salihom Berg");
    assert.equal(nyttNamn("Hedda Hedlund"), "Salihom Hedlund");
    assert.equal(nyttNamn("Hedda"), "Salihom");
    for (const n of ["Heddie Berg", "Ahedda Berg", "hedda Berg", "Berg Hedda", "HeddaBerg", "Salihom Berg", "", null, 5]) {
      assert.equal(nyttNamn(n), null, String(n));
    }
  });
});

describe("planeraNamnbyte", () => {
  const K = {
    klubb: { namn: "Hedda FC", farg: "#2f6fe8" },
    kassa: 1200,
    trupp: [sp("g1", "Alvin Ek", { grundpelare: true }), sp("g2", "Hedda Berg", { grundpelare: true, kapten: true }),
      sp("k3a", "Omar Hedda")],
    reserver: [sp("g4", "Hedda Lind", { grundpelare: true })],
    marknad: ["k1|Hedda Ström|ANF|17|3", "k2|Selma Holm|MV|1|2"],
    liga: { lag: [{ id: "oss" }, { id: "m1", namn: "Hedda IF" }] },
  };

  it("byter i truppen, reserverna och marknaden – resten orört", () => {
    const rakna = {};
    const p = planeraNamnbyte(K, rakna);
    assert.deepEqual(Object.keys(p).sort(), ["marknad", "reserver", "trupp"]);
    assert.deepEqual(p.trupp[1], sp("g2", "Salihom Berg", { grundpelare: true, kapten: true }));
    assert.deepEqual(p.trupp[0], K.trupp[0]);
    assert.equal(p.trupp[2].namn, "Omar Hedda", "efternamnet rörs inte");
    assert.deepEqual(p.reserver, [sp("g4", "Salihom Lind", { grundpelare: true })]);
    assert.deepEqual(p.marknad, ["k1|Salihom Ström|ANF|17|3", "k2|Selma Holm|MV|1|2"]);
    assert.deepEqual(rakna, { trupp: 1, reserver: 1, marknad: 1 });
    assert.equal(K.trupp[1].namn, "Hedda Berg", "indata ändras inte");
  });

  it("bara de listor som ändras kommer med", () => {
    assert.deepEqual(Object.keys(planeraNamnbyte({ trupp: K.trupp, reserver: [], marknad: ["k2|Selma Holm|MV|1|2"] })), ["trupp"]);
    assert.deepEqual(Object.keys(planeraNamnbyte({ marknad: ["k1|Hedda Ström|ANF|17|3"] })), ["marknad"]);
  });

  it("marknaden som objekt (dokument från före radformen)", () => {
    const p = planeraNamnbyte({ marknad: [{ id: "k1", namn: "Hedda Falk", pos: "FÖR", nr: 4, st: 2 }] });
    assert.deepEqual(p.marknad, [{ id: "k1", namn: "Salihom Falk", pos: "FÖR", nr: 4, st: 2 }]);
  });

  it("idempotent: andra körningen ger null; inget Hedda → null", () => {
    const p = planeraNamnbyte(K);
    assert.equal(planeraNamnbyte(efter(K, p)), null);
    assert.equal(planeraNamnbyte({ trupp: [sp("g1", "Alvin Ek")], marknad: [] }), null);
    assert.equal(planeraNamnbyte({}), null);
    assert.equal(planeraNamnbyte(null), null);
    assert.equal(planeraNamnbyte({ trupp: "x", marknad: [null, 3, "trasig"] }), null, "tålig mot konstiga fält");
  });

  it("räknaren summerar över flera dokument", () => {
    const rakna = {};
    planeraNamnbyte(K, rakna);
    planeraNamnbyte({ trupp: [sp("g1", "Hedda Ek"), sp("g2", "Hedda Dahl")] }, rakna);
    assert.deepEqual(rakna, { trupp: 3, reserver: 1, marknad: 1 });
  });

  it("en riktig karriär: namnet byts och marknaden läses som förut", () => {
    const K0 = nyKarriar({ namn: "Testlaget", farg: "#2f6fe8", rng: skapaPrng("916").tal });
    K0.trupp[3] = { ...K0.trupp[3], namn: "Hedda Sund" };
    K0.marknad = ["kab1|Hedda Ek|MIT|12|2"];
    const K1 = efter(K0, planeraNamnbyte(K0));
    assert.equal(K1.trupp[3].namn, "Salihom Sund");
    assert.deepEqual(marknadFranDok(K1.marknad), [{ id: "kab1", namn: "Salihom Ek", pos: "MIT", nr: 12, st: 2, xp: 0 }]);
    assert.ok(FORNAMN.includes("Salihom") && !FORNAMN.includes("Hedda"));
  });
});
