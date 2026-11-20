// ============================================================================
// Matchdagen 1c (#869): klubben, säsongen och karriären (delat/md-sasong.js),
// formationen (plan/md-formation.js) och den lokala sparningen (md-lokal.js).
// Spec docs/UTVECKLINGSUPPDRAG_MATCHDAGEN.md §5, §6.1–6.2, §8.3.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  OSS, dagNyckel, karriarOk, lagInfo, lagnamnOk, matchKlar, nastaMatch, nyKarriar, nySasong, omgangsPar,
  pengarFor, sasongFro, sekunderSenaste, tabellRader, veckoRatt,
} from "../src/matchdagen/delat/md-sasong.js";
import { MOTSTANDARE, STANDARD_LAGNAMN, TROJFARGER } from "../src/matchdagen/delat/md-namn.js";
import { skapaPrng } from "../src/matchdagen/delat/md-prng.js";
import * as C from "../src/matchdagen/delat/md-config.js";
import { firande, formation, planX, PLAN_B, PLAN_L } from "../src/matchdagen/plan/md-formation.js";
import { KO_MAX, laggIKo, lasOsparad, lasPagaende, rensaPagaende, sparaOsparad, sparaPagaende } from "../src/matchdagen/md-lokal.js";
import { hamtaKarriar, sparaKon } from "../src/matchdagen/md-spara.js";

const rng = (f = "t") => skapaPrng(f).tal;
const NU = Date.UTC(2026, 10, 20, 10);

function stat(fragor = 28, ratt = 20, sekunder = 420) {
  return { skott: 5, skottPaMal: 3, pass: 12, passOk: 9, tacklingar: 6, vunnaBollar: 4, raddningar: 2, horner: 1, derasSkott: 3,
    fragor, ratt, perKalla: { "tabell:7": { fragor, ratt } }, sekunder };
}
const res = (oss, dem, s = stat()) => ({ oss, dem, utfall: oss > dem ? "vinst" : oss < dem ? "forlust" : "oavgjort",
  mal: [...Array(oss)].map(() => ({ min: 10, lag: "oss" })).concat([...Array(dem)].map(() => ({ min: 20, lag: "dem" }))), stat: s });

/** Spela en hel säsong med givna resultat för oss. */
function sasong(K, resultat, r = rng("s")) {
  const ut = [];
  for (const [o, d] of resultat) {
    const k = matchKlar(K, { res: res(o, d), rng: r, nu: NU, matchId: `m${ut.length}` });
    ut.push(k);
    K = k.K;
  }
  return { K, ut };
}

/** Firestore tillåter inga listor direkt i listor. */
function utanNastladeListor(v, inneILista = false) {
  if (Array.isArray(v)) return !inneILista && v.every((x) => utanNastladeListor(x, true));
  if (v && typeof v === "object") return Object.values(v).every((x) => utanNastladeListor(x, false));
  return true;
}

describe("ny klubb (§5)", () => {
  const K = nyKarriar({ namn: "  Blixtarna   IF ", farg: "#e8473f", rng: rng() });
  it("namn 1–24 tecken, en av de 8 tröjfärgerna, Division 6, säsong 1, kassa 600", () => {
    assert.equal(K.klubb.namn, "Blixtarna IF");
    assert.equal(K.klubb.farg, "#e8473f");
    assert.equal(TROJFARGER.length, 8);
    assert.deepEqual([K.div, K.sasong, K.kassa], [0, 1, C.KASSA.start]);
    assert.equal(lagnamnOk(""), null);
    assert.equal(lagnamnOk("x".repeat(25)), null);
    assert.equal(lagnamnOk("x".repeat(24)), "x".repeat(24));
    assert.equal(lagnamnOk("<b>FC</b>"), "bFC/b");
    assert.equal(nyKarriar({ namn: "", farg: "#123456", rng: rng() }).klubb.namn, STANDARD_LAGNAMN);
    assert.equal(nyKarriar({ namn: "A", farg: "#123456", rng: rng() }).klubb.farg, TROJFARGER[0]);
  });
  it("sju grundpelare med färdiga, olika namn, alla 2★, en kapten som inte är målvakten", () => {
    assert.equal(K.trupp.length, 7);
    assert.deepEqual(K.trupp.map((p) => p.pos), ["MV", "FÖR", "FÖR", "MIT", "MIT", "ANF", "ANF"]);
    assert.equal(new Set(K.trupp.map((p) => p.namn)).size, 7);
    assert.ok(K.trupp.every((p) => p.st === 2 && p.xp === 0 && p.grundpelare));
    const kaptener = K.trupp.filter((p) => p.kapten);
    assert.equal(kaptener.length, 1);
    assert.notEqual(kaptener[0].pos, "MV");
  });
  it("Division 6 = 6 lag, 5 omgångar, alla möter alla exakt en gång (cirkelmetoden)", () => {
    assert.equal(K.liga.lag.length, 6);
    assert.equal(K.liga.schema.length, 5);
    const moten = new Set();
    for (let o = 0; o < 5; o++) {
      const par = omgangsPar(K.liga, o);
      assert.equal(par.length, 3);
      assert.equal(new Set(par.flat()).size, 6, "varje lag en gång per omgång");
      for (const [a, b] of par) moten.add([a, b].sort().join("-"));
    }
    assert.equal(moten.size, 15);
  });
  it("motståndarna: påhittade namn ur listan (≥ 60), egna färger, dold styrka i Division 6", () => {
    assert.ok(MOTSTANDARE.length >= 60);
    assert.equal(new Set(MOTSTANDARE).size, MOTSTANDARE.length);
    for (const l of K.liga.lag.filter((x) => x.id !== OSS)) {
      assert.ok(MOTSTANDARE.includes(l.namn));
      assert.notEqual(l.farg, K.klubb.farg);
      assert.ok(l.styrka >= C.STYRKA.min && l.styrka <= C.STYRKA.bas + C.STYRKA.spridning + 1e-9);
    }
    assert.equal(lagInfo(K, OSS).namn, "Blixtarna IF");
  });
  it("dokumentet passar Firestore: inga listor i listor, kända fält", () => {
    assert.ok(utanNastladeListor(K));
    assert.ok(karriarOk(K));
    assert.ok(!karriarOk({ klubb: {} }));
  });
});

describe("matchen klar: tabellen, kassan och statistiken (§5, §6.1, §8.3)", () => {
  const K0 = nyKarriar({ namn: "Lag", farg: "#2f6fe8", rng: rng("k") });
  it("nästa match är mot motståndaren i omgången", () => {
    const n = nastaMatch(K0);
    assert.equal(n.omg, 0);
    assert.equal(n.antal, 5);
    assert.ok(omgangsPar(K0.liga, 0).some(([a, b]) => [a, b].includes(OSS) && [a, b].includes(n.mot.id)));
  });
  it("alla omgångens matcher räknas in (övriga med simMal) – 3/1/0 poäng", () => {
    const { K } = matchKlar(K0, { res: res(2, 1), rng: rng(), nu: NU, matchId: "a" });
    const rader = tabellRader(K);
    assert.ok(rader.every((r) => r.s === 1));
    assert.equal(rader.find((r) => r.vi).p, 3);
    assert.equal(rader.reduce((s, r) => s + r.gm, 0), rader.reduce((s, r) => s + r.im, 0));
    assert.equal(K.liga.omg, 1);
  });
  it("tabellen sorteras på poäng, målskillnad och gjorda mål", () => {
    const { K } = sasong(K0, [[3, 0], [1, 1], [0, 2], [2, 2], [4, 1]]);
    const rader = tabellRader(K);
    for (let i = 1; i < rader.length; i++) {
      const a = rader[i - 1], b = rader[i];
      assert.ok(a.p > b.p || (a.p === b.p && (a.md > b.md || (a.md === b.md && a.gm >= b.gm))));
    }
  });
  it("kassan: (grund + 15/rätt + 25/mål) × (1 + div × 0,25)", () => {
    assert.equal(pengarFor({ oss: 2, dem: 1 }, 20, 0), 300 + 300 + 50);
    assert.equal(pengarFor({ oss: 1, dem: 1 }, 10, 0), 150 + 150 + 25);
    assert.equal(pengarFor({ oss: 0, dem: 3 }, 0, 0), 80);
    assert.equal(pengarFor({ oss: 0, dem: 3 }, 0, 4), 160);
    const k = matchKlar(K0, { res: res(2, 1), rng: rng(), nu: NU, matchId: "a" });
    assert.equal(k.K.kassa, 600 + k.pengar);
  });
  it("summan, de senaste 20 och dagarna (≤ 70) uppdateras – K ändras inte", () => {
    const fore = JSON.stringify(K0);
    const k = matchKlar(K0, { res: res(2, 1), rng: rng(), nu: NU, matchId: "a", kallNamn: { "tabell:7": "7:ans tabell" } });
    assert.equal(JSON.stringify(K0), fore);
    assert.deepEqual([k.K.summa.matcher, k.K.summa.v, k.K.summa.gjorda, k.K.summa.inslappta, k.K.summa.fragor, k.K.summa.ratt], [1, 1, 2, 1, 28, 20]);
    assert.deepEqual(k.K.summa.perKalla["tabell:7"], { fragor: 28, ratt: 20, namn: "7:ans tabell" });
    assert.equal(k.K.summa.spelminuter, 7);
    assert.equal(k.K.senaste[0].id, "a");
    assert.deepEqual(k.K.dagar[dagNyckel(NU)], { m: 1, sek: 420, fragor: 28, ratt: 20 });
    // Matchen (matcher/{id}): utan perKalla i stat, med mål och sekunder.
    assert.equal(k.match.typ, "liga");
    assert.equal(k.match.mal.length, 3);
    assert.equal(k.match.stat.perKalla, undefined);
    assert.deepEqual(k.match.perKalla, { "tabell:7": { fragor: 28, ratt: 20 } });
    let K = K0;
    for (let i = 0; i < 80; i++) {
      if (!nastaMatch(K)) K = nySasong(K, rng(`n${i}`));
      K = matchKlar(K, { res: res(1, 0), rng: rng(`r${i}`), nu: NU + i * 86400000, matchId: `x${i}` }).K;
    }
    assert.equal(K.senaste.length, C.SENASTE_MAX);
    assert.equal(K.senaste[0].id, "x79");
    assert.equal(Object.keys(K.dagar).length, C.DAGAR_MAX);
    assert.ok(utanNastladeListor(K));
    assert.ok(JSON.stringify(K).length < 60_000, "långt under 200 kB efter 16 säsonger");
  });
  it("efter sista omgången: placeringen och (för ligavinnaren) en pokal", () => {
    const { K, ut } = sasong(K0, [[5, 0], [5, 0], [5, 0], [5, 0], [5, 0]]);
    assert.deepEqual(ut.map((x) => x.sasongKlar), [false, false, false, false, true]);
    assert.equal(ut[4].plac, 1);
    assert.equal(nastaMatch(K), null);
    assert.deepEqual(K.sasonger[0], { sasong: 1, div: 0, plac: 1, lag: 6 });
    assert.equal(K.pokaler.length, 1);
    assert.equal(K.pokaler[0].namn, "Vinnare Division 6");
    const forlust = sasong(K0, [[0, 5], [0, 5], [0, 5], [0, 5], [0, 5]]);
    assert.ok(forlust.ut[4].plac > 1);
    assert.equal(forlust.K.pokaler.length, 0);
    assert.throws(() => matchKlar(K, { res: res(1, 0), rng: rng(), nu: NU, matchId: "z" }), /redan slut/);
  });
  it("nästa säsong: nya motståndare, omgång 1, samma division (Etapp 1) – samma frö ger samma liga", () => {
    const { K } = sasong(K0, [[1, 0], [1, 0], [1, 0], [1, 0], [1, 0]]);
    const a = nySasong(K, skapaPrng(sasongFro(K, "u1")).tal);
    const b = nySasong(K, skapaPrng(sasongFro(K, "u1")).tal);
    assert.deepEqual(a.liga, b.liga);
    assert.equal(a.sasong, 2);
    assert.equal(a.div, 0);
    assert.equal(a.liga.omg, 0);
    assert.ok(tabellRader(a).every((r) => r.s === 0));
    assert.equal(a.sasonger.length, 1, "historiken följer med");
    assert.throws(() => nySasong(K0, rng()), /inte slut/);
  });
  it("speltid de senaste 7 dagarna och andel rätt per vecka (lärarens tabell och linje)", () => {
    const dagar = { [dagNyckel(NU)]: { sek: 600, fragor: 10, ratt: 8 }, [dagNyckel(NU - 6 * 864e5)]: { sek: 300, fragor: 10, ratt: 5 },
      [dagNyckel(NU - 8 * 864e5)]: { sek: 1000, fragor: 10, ratt: 2 } };
    assert.equal(sekunderSenaste(dagar, NU, 7), 900);
    const v = veckoRatt(dagar, NU, 4);
    assert.equal(v.length, 4);
    assert.equal(v[3], 13 / 20);
    assert.equal(v[2], 0.2);
    assert.equal(v[0], null);
  });
});

describe("formationen (2D och 3D visar samma match)", () => {
  it("alla 14 spelare och bollen står på planen, den med bollen står vid bollen", () => {
    const r = rng("f");
    for (let i = 0; i < 300; i++) {
      const f = formation({ x: r() * 100, y: r() * 68, innehav: r() < 0.5 ? "oss" : "dem", avspark: r() < 0.1 });
      for (const [x, y] of [...f.vi, ...f.dem]) assert.ok(x >= 0 && x <= PLAN_L && y >= 0 && y <= PLAN_B);
      assert.equal(f.vi.length, 7);
      if (f.vid) {
        const p = (f.vid.lag === "vi" ? f.vi : f.dem)[f.vid.i];
        assert.ok(Math.hypot(p[0] - f.boll[0], p[1] - f.boll[1]) < 2);
      }
    }
    assert.equal(planX(0), 2);
    assert.equal(planX(100), 103);
  });
  it("avspark: båda lagen på sin planhalva; målvakterna i sina mål", () => {
    const f = formation({ x: 50, y: 34, innehav: "oss", avspark: true });
    assert.ok(f.vi.every(([x]) => x <= PLAN_L / 2));
    assert.ok(f.dem.every(([x]) => x >= PLAN_L / 2));
    assert.ok(f.vi[0][0] < 10 && f.dem[0][0] > PLAN_L - 10);
    const fir = firande(f.vi, [103, 34]);
    assert.deepEqual(fir[0], f.vi[0], "målvakten firar på sin plats");
  });
});

describe("lokalt: pågående match och osparad match (§5)", () => {
  const lagring = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  const K = nyKarriar({ namn: "Lag", farg: "#2f6fe8", rng: rng("l") });
  it("den pågående matchen fortsätter bara om den gäller klubbens nästa match", () => {
    const L = lagring();
    sparaPagaende(L, "u", { sasong: 1, omg: 0, matchId: "m1", m: { slut: false, oss: 1 } });
    assert.equal(lasPagaende(L, "u", K).m.oss, 1);
    assert.equal(lasPagaende(L, "annan", K), null);
    assert.equal(lasPagaende(L, "u", { ...K, liga: { ...K.liga, omg: 1 } }), null, "annan omgång");
    assert.equal(lasPagaende(L, "u", { ...K, sasong: 2 }), null, "annan säsong");
    rensaPagaende(L, "u");
    assert.equal(lasPagaende(L, "u", K), null);
    L.setItem("matchdagen-match:u", "{trasig");
    assert.equal(lasPagaende(L, "u", K), null);
    assert.equal(lasPagaende(null, "u", K), null, "ingen lagring (privat fönster)");
  });
  it("osparade matcher ligger i en kö tills de sparats (äldre form med en match läses också)", () => {
    const L = lagring();
    laggIKo(L, "u", { K, matchId: "m1", match: { oss: 1 } });
    laggIKo(L, "u", { K: { ...K, kassa: 9 }, matchId: "m2", match: { oss: 2 } });
    laggIKo(L, "u", { K: { ...K, kassa: 9 }, matchId: "m2", match: { oss: 2 } });
    const o = lasOsparad(L, "u");
    assert.deepEqual(o.koe.map((x) => x.matchId), ["m1", "m2"], "ordning, ingen dubblett");
    assert.equal(o.K.kassa, 9, "K är den senaste");
    sparaOsparad(L, "u", null);
    assert.equal(lasOsparad(L, "u"), null);
    L.setItem("matchdagen-osparad:u", JSON.stringify({ K, matchId: "gammal", match: { oss: 3 } }));
    assert.deepEqual(lasOsparad(L, "u").koe, [{ matchId: "gammal", match: { oss: 3 } }]);
    for (let i = 0; i < KO_MAX + 5; i++) laggIKo(L, "u", { K, matchId: `x${i}`, match: {} });
    assert.equal(lasOsparad(L, "u").koe.length, KO_MAX);
  });
});

describe("sparningen: kön och valet av karriär (md-spara.js, #869 granskning)", () => {
  const lagring = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  const K = nyKarriar({ namn: "Lag", farg: "#2f6fe8", rng: rng("s") });
  const med = (n, namn = "Lag") => ({ ...K, klubb: { ...K.klubb, namn }, summa: { ...K.summa, matcher: n } });
  /** En låtsas-server: sparaMatch misslyckas för id:n i `fel`. */
  function server({ K: sparad = null, fel = new Set(), lasfel = false } = {}) {
    const s = { K: sparad, matcher: [], fel };
    s.data = {
      lasKarriar: async () => { if (lasfel) throw new Error("offline"); return s.K; },
      sparaMatch: async (uid, K2, id) => { if (s.fel.has(id)) throw Object.assign(new Error("nej"), { code: "timeout" }); s.K = K2; s.matcher.push(id); },
    };
    return s;
  }
  it("två misslyckade sparningar i rad: båda matcherna sparas sen, i ordning", async () => {
    const srv = server({ K: med(0), fel: new Set(["m1", "m2"]) });
    const S = { uid: "u", lagring: lagring(), data: srv.data };
    laggIKo(S.lagring, "u", { K: med(1), matchId: "m1", match: {} });
    assert.equal(await sparaKon(S, med(1)), false);
    laggIKo(S.lagring, "u", { K: med(2), matchId: "m2", match: {} });
    assert.equal(await sparaKon(S, med(2)), false);
    srv.fel.clear();
    const val = await hamtaKarriar(S);
    assert.deepEqual(srv.matcher, ["m1", "m2"]);
    assert.equal(val.summa.matcher, 2);
    assert.equal(lasOsparad(S.lagring, "u"), null, "kön är tom");
  });
  it("namnbyte efter en osparad match: matchen sparas ändå (samma antal matcher på servern)", async () => {
    const srv = server({ K: med(1, "Nytt namn") });
    const S = { uid: "u", lagring: lagring(), data: srv.data };
    laggIKo(S.lagring, "u", { K: med(1), matchId: "m1", match: {} });
    const val = await hamtaKarriar(S);
    assert.deepEqual(srv.matcher, ["m1"]);
    assert.equal(val.klubb.namn, "Nytt namn", "serverns karriär");
  });
  it("lokal karriär med fler matcher tar serverns klubb (lärarens återställda lagnamn)", async () => {
    const srv = server({ K: med(0, STANDARD_LAGNAMN) });
    const S = { uid: "u", lagring: lagring(), data: srv.data };
    laggIKo(S.lagring, "u", { K: med(1, "Gamla namnet"), matchId: "m1", match: {} });
    const val = await hamtaKarriar(S);
    assert.equal(val.summa.matcher, 1);
    assert.equal(val.klubb.namn, STANDARD_LAGNAMN);
  });
  it("kunde karriären inte läsas skrivs ingenting och kön ligger kvar", async () => {
    const srv = server({ lasfel: true });
    const S = { uid: "u", lagring: lagring(), data: srv.data };
    laggIKo(S.lagring, "u", { K: med(1), matchId: "m1", match: {} });
    assert.equal(await hamtaKarriar(S), null);
    assert.equal(S.lasfel, true);
    assert.deepEqual(srv.matcher, []);
    assert.equal(lasOsparad(S.lagring, "u").koe.length, 1);
  });
});
