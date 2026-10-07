// Klasscentret EXP-regelregister + skrivplan (#477).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  klassExpFor, planKlassExp, registreraRegel, harRegel, listaRegler, modulFor, klassBonusFor,
  FORSTA_GANGER,
} from "../src/klasscenter/kc-exp-regler.js";
import {
  planKlassExpWrites, planRaknareWrite, planKlassBonusWrite, sumKlassExp, pickExpShard,
  EXP_SHARDS, MAX_EXP_PER_SKRIVNING, MAX_BONUS_PER_SKRIVNING,
} from "../src/klasscenter/kc-exp-skriv.js";

const fv = { increment: (n) => ({ inc: n }), serverTimestamp: () => "TS" };

describe("Quiz + Läsförståelse: ≥ 50 % rätt", () => {
  for (const modul of ["quiz", "lasforstaelse"]) {
    it(`${modul}: 49 % → 0, 50 % → 1, varje gång`, () => {
      assert.equal(klassExpFor(modul, { ratt: 49, totalt: 100 }), 0);
      assert.equal(klassExpFor(modul, { ratt: 50, totalt: 100 }), 1);
      assert.equal(klassExpFor(modul, { ratt: 4, totalt: 10 }), 0);
      assert.equal(klassExpFor(modul, { ratt: 5, totalt: 10 }), 1);
      assert.equal(klassExpFor(modul, { ratt: 10, totalt: 10 }), 1);
      // Ingen räknare → lika mycket den 50:e gången.
      assert.equal(klassExpFor(modul, { ratt: 7, totalt: 10 }, { area: "a", raknare: { [`${modul}|a`]: 50 } }), 1);
    });
  }
  it("skräp/tom omgång ger 0", () => {
    assert.equal(klassExpFor("quiz", { ratt: 0, totalt: 0 }), 0);
    assert.equal(klassExpFor("quiz", {}), 0);
    assert.equal(klassExpFor("quiz", null), 0);
    assert.equal(klassExpFor("quiz", { ratt: 11, totalt: 10 }), 0);
  });
});

describe("Para ihop / Memory / liknande: 3 första gångerna per område och elev", () => {
  for (const modul of ["para", "memory", "kunskapsjakt", "sanningsjakt", "lastext", "aventyr"]) {
    it(`${modul}: 3:e gången → 1, 4:e → 0`, () => {
      const nyckel = `${modul}|vikingar`;
      const ctx = (n) => ({ area: "vikingar", raknare: { [nyckel]: n } });
      assert.equal(klassExpFor(modul, {}, ctx(0)), 1);
      assert.equal(klassExpFor(modul, {}, ctx(2)), 1); // 3:e gången
      assert.equal(klassExpFor(modul, {}, ctx(3)), 0); // 4:e gången
      assert.deepEqual(planKlassExp(modul, {}, ctx(2)).raknare, { [nyckel]: 3 });
      assert.equal(planKlassExp(modul, {}, ctx(3)).raknare, null);
    });
  }
  it("räknaren är per område (annat område börjar om)", () => {
    const raknare = { "memory|vikingar": 3 };
    assert.equal(klassExpFor("memory", {}, { area: "vikingar", raknare }), 0);
    assert.equal(klassExpFor("memory", {}, { area: "rymden", raknare }), 1);
  });
  it("räknaren körs genom en hel följd: 1,1,1,0,0", () => {
    let raknare = {};
    const ut = [];
    for (let i = 0; i < 5; i++) {
      const p = planKlassExp("para", {}, { area: "x", raknare });
      ut.push(p.antal);
      raknare = { ...raknare, ...(p.raknare || {}) };
    }
    assert.deepEqual(ut, [1, 1, 1, 0, 0]);
    assert.equal(raknare["para|x"], FORSTA_GANGER);
  });
  it("äventyrsbanor (aventyr:<id>) delar äventyrsregeln", () => {
    assert.equal(modulFor("aventyr:gruvan"), "aventyr");
    assert.deepEqual(planKlassExp("aventyr:gruvan", {}, { area: "a" }).raknare, { "aventyr|a": 1 });
  });
  it("avbruten omgång (klar:false) ger 0 och räknas inte", () => {
    assert.deepEqual(planKlassExp("memory", { klar: false }, { area: "a" }), { antal: 0, raknare: null });
  });
});

describe("Läsresan: ≥ 5/7 rätt", () => {
  it("4/7 → 0, 5/7 → 1, 7/7 → 1", () => {
    assert.equal(klassExpFor("lasresan", { ratt: 4, totalt: 7 }), 0);
    assert.equal(klassExpFor("lasresan", { ratt: 5, totalt: 7 }), 1);
    assert.equal(klassExpFor("lasresan", { ratt: 7 }), 1); // totalt = 7 som standard
    assert.equal(klassExpFor("lasresan", { ratt: 4 }), 0);
  });
});

describe("Mattematchen: var 20:e rätt", () => {
  it("19 → 0, 20 → 1, 39→40 → 1, 20→21 → 0", () => {
    assert.equal(klassExpFor("mattematchen", { rattFore: 18, rattEfter: 19 }), 0);
    assert.equal(klassExpFor("mattematchen", { rattFore: 19, rattEfter: 20 }), 1);
    assert.equal(klassExpFor("mattematchen", { rattFore: 20, rattEfter: 21 }), 0);
    assert.equal(klassExpFor("mattematchen", { rattFore: 39, rattEfter: 40 }), 1);
    assert.equal(klassExpFor("mattematchen", { rattFore: 0, rattEfter: 45 }), 2);
    assert.equal(klassExpFor("mattematchen", { rattFore: 40, rattEfter: 30 }), 0); // aldrig negativt
  });
});

describe("Räkna-läget: 10 rätt = 1, resten sparas", () => {
  it("9 rätt → 0 men räknaren sparar 9; nästa omgång 1 rätt → 1", () => {
    const a = planKlassExp("rakna", { ratt: 9 }, { raknare: {} });
    assert.deepEqual(a, { antal: 0, raknare: { "rakna|ratt": 9 } });
    const b = planKlassExp("rakna", { ratt: 1 }, { raknare: a.raknare });
    assert.deepEqual(b, { antal: 1, raknare: { "rakna|ratt": 0 } });
  });
  it("10 rätt → 1, 25 rätt → 2 (rest 5)", () => {
    assert.equal(klassExpFor("rakna", { ratt: 10 }), 1);
    assert.deepEqual(planKlassExp("rakna", { ratt: 25 }), { antal: 2, raknare: { "rakna|ratt": 5 } });
  });
});

describe("registret", () => {
  it("okänd modul → 0, ingen räknare", () => {
    assert.deepEqual(planKlassExp("finnsinte", { ratt: 10, totalt: 10 }), { antal: 0, raknare: null });
  });
  it("en ny modul registrerar sin regel och används direkt", () => {
    assert.equal(harRegel("testmodul"), false);
    registreraRegel("testmodul", { beskrivning: "test", exp: (r) => (r.ok ? 2 : 0) });
    assert.equal(klassExpFor("testmodul", { ok: true }), 2);
    assert.ok(listaRegler().some((r) => r.modul === "testmodul"));
    assert.throws(() => registreraRegel("x", {}));
  });
  it("alla specens moduler har en regel med beskrivning", () => {
    for (const m of ["quiz", "lasforstaelse", "para", "memory", "lasresan", "mattematchen", "rakna"]) {
      assert.ok(harRegel(m), m);
    }
    assert.ok(listaRegler().every((r) => r.beskrivning));
  });
  it("klassbonus skalas med elevantalet (Live > en vanlig övning)", () => {
    assert.equal(klassBonusFor("live", 20), 60);
    assert.equal(klassBonusFor("live", 10), 30);
    assert.equal(klassBonusFor("okand", 20), 0);
  });
});

describe("skrivplanen (kc-exp-skriv.js)", () => {
  it("utdelning = shard +n och elevpost +n i samma plan", () => {
    const w = planKlassExpWrites({
      classId: "6a", uid: "elev1", antal: 1, kalla: "quiz", raknare: { "memory|a": 1 }, shard: 2, fv,
    });
    assert.deepEqual(w.map((x) => x.path.join("/")), [
      "classCenters/6a/expShards/2", "classCenters/6a/expMembers/elev1",
    ]);
    assert.deepEqual(w[0].data, { exp: { inc: 1 }, lastUid: "elev1", lastAt: "TS", lastKalla: "quiz" });
    assert.deepEqual(w[1].data, {
      uid: "elev1", exp: { inc: 1 }, lastAt: "TS", lastAmount: 1, lastShard: 2, lastKalla: "quiz",
      counts: { "memory|a": 1 },
    });
    assert.ok(w.every((x) => x.merge));
  });
  it("0 → ingen skrivning; för stort klamras till max", () => {
    assert.deepEqual(planKlassExpWrites({ classId: "6a", uid: "e", antal: 0, shard: 0, fv }), []);
    const w = planKlassExpWrites({ classId: "6a", uid: "e", antal: 9, shard: 0, fv });
    assert.equal(w[1].data.lastAmount, MAX_EXP_PER_SKRIVNING);
  });
  it("räknar-skrivning och lärarbonus", () => {
    assert.equal(planRaknareWrite({ classId: "6a", uid: "e", raknare: null }), null);
    assert.deepEqual(planRaknareWrite({ classId: "6a", uid: "e", raknare: { "rakna|ratt": 7 } }).data,
      { uid: "e", counts: { "rakna|ratt": 7 } });
    const b = planKlassBonusWrite({ classId: "6a", uid: "larare1", mangd: 5000, kalla: "live", shard: 1, fv });
    assert.deepEqual(b.data.exp, { inc: MAX_BONUS_PER_SKRIVNING });
    assert.equal(planKlassBonusWrite({ classId: "6a", uid: "l", mangd: 0, shard: 0, fv }), null);
  });
  it("summa över shards och shard-val inom intervallet", () => {
    assert.equal(sumKlassExp([{ exp: 3 }, { exp: 4 }, {}, { exp: -2 }, null]), 7);
    for (const r of [0, 0.5, 0.9999]) {
      const s = pickExpShard(() => r);
      assert.ok(s >= 0 && s < EXP_SHARDS);
    }
  });
});
