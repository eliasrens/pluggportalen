// ============================================================================
// Meteorstormen B (#821) utan emulator: kortleken (fragaFor), serverns
// pluggmynt = live-rewards.js, byggResultat ur en logg, synken av delat/ till
// functions/meteorstorm/ och elevklientens buffring (ms-klient.js).
// Serverkärnan mot emulatorn: functions-meteorstorm-*.test.mjs.
// ============================================================================

import { describe, it } from "node:test";
import { readdirSync } from "node:fs";
import assert from "node:assert/strict";
import { fragaFor, multFor, MS_FEL_SKICKA, MS_FEL_TAK } from "../src/live/formats/meteorstorm/delat/ms-anrop.js";
import { simulera } from "../src/live/formats/meteorstorm/delat/ms-motor.js";
import { createMsKlient } from "../src/live/formats/meteorstorm/ms-klient.js";
import * as klientMynt from "../src/live/live-rewards.js";
import { LIVE_REWARDS as KONFIG } from "../src/live/rewards-config.js";
import * as serverMynt from "../functions/meteorstorm-mynt.js";
import { byggResultat } from "../functions/meteorstorm-resultat.js";
import { driftedFiles, meteorstormFiles } from "../admin/sync-guldrush-functions.mjs";

describe("kortleken (fragaFor)", () => {
  it("varje fråga en gång per varv, aldrig samma två i rad, samma för samma frö + uid", () => {
    for (const n of [2, 3, 7, 40]) {
      const seq = Array.from({ length: n * 6 }, (_, k) => fragaFor(99, "alma", k, n));
      for (let v = 0; v < 6; v++) assert.deepEqual([...seq.slice(v * n, v * n + n)].sort((a, b) => a - b), [...Array(n).keys()]);
      for (let k = 1; k < seq.length; k++) assert.notEqual(seq[k], seq[k - 1], `n=${n} k=${k}`);
      assert.deepEqual(seq, Array.from({ length: n * 6 }, (_, k) => fragaFor(99, "alma", k, n)));
    }
    const a = Array.from({ length: 20 }, (_, k) => fragaFor(1, "alma", k, 20));
    const b = Array.from({ length: 20 }, (_, k) => fragaFor(1, "omar", k, 20));
    assert.notDeepEqual(a, b, "eleverna får olika ordning");
    assert.equal(fragaFor(1, "x", 5, 1), 0);
    assert.equal(fragaFor(1, "x", -1, 5), 0);
  });
});

describe("multiplikationens påse (multFor, #821 F1)", () => {
  it("varje kombination 0–10 i varje påse (×0/×1 en gång, övriga två), aldrig samma eller spegeln två gånger i rad", () => {
    const PASE = 40 + 81 * 2;
    const seq = Array.from({ length: PASE * 3 }, (_, k) => multFor(7, "omar", k));
    const forsta = seq.slice(0, PASE);
    const antal = new Map();
    for (const { a, b } of forsta) antal.set(`${a}x${b}`, (antal.get(`${a}x${b}`) || 0) + 1);
    assert.equal(antal.size, 121);
    for (const [nyckel, n] of antal) {
      const [a, b] = nyckel.split("x").map(Number);
      assert.equal(n, a <= 1 || b <= 1 ? 1 : 2, nyckel);
    }
    for (let k = 1; k < seq.length; k++) {
      const p = seq[k - 1];
      const q = seq[k];
      assert.ok(!((p.a === q.a && p.b === q.b) || (p.a === q.b && p.b === q.a)), `k=${k}`);
    }
    assert.deepEqual(multFor(7, "omar", 250), seq[250], "samma svar oavsett ordning");
    assert.notDeepEqual(seq.slice(0, 10), Array.from({ length: 10 }, (_, k) => multFor(7, "alma", k)));
  });
});

describe("serverns pluggmynt = live-rewards.js", () => {
  it("samma rattar och samma belopp", () => {
    assert.deepEqual({ ...serverMynt.LIVE_REWARDS, steps: [...serverMynt.LIVE_REWARDS.steps] },
      { blockSize: KONFIG.blockSize, steps: [...KONFIG.steps], placeFactor: KONFIG.placeFactor });
    for (const first of [0, 1, 7, 100, 333, 1000]) for (let p = 1; p <= 6; p++) {
      assert.equal(serverMynt.placementPrize(first, p), klientMynt.placementPrize(first, p));
    }
    for (const n of [0, 1, 19, 20, 21, 57, 100, 150]) for (const [per, cap] of [[1, 1000], [5, 300], [50, 1000], [0, 10]]) {
      assert.equal(serverMynt.perCorrectCoins(n, per, cap), klientMynt.perCorrectCoins(n, per, cap));
    }
    for (const r of [null, {}, { firstPrize: 0, perCorrect: 0, cap: 300 }, { firstPrize: 10, perCorrect: 0, cap: 1 }]) {
      assert.deepEqual(serverMynt.sessionRewards({ rewards: r }), klientMynt.sessionRewards({ rewards: r }));
    }
  });
  it("En klass: platsen efter stjärnorna", () => {
    assert.deepEqual([3, 2, 1, 0].map((stjarnor) => serverMynt.msPlats({ lage: "en-klass", stjarnor })), [1, 2, 3, 4]);
    assert.equal(serverMynt.msPlats({ lage: "klass-mot-klass", placering: [{ classId: "a", plats: 1 }, { classId: "b", plats: 1 }] }, "b"), 1);
  });
});

describe("byggResultat (msAvsluta)", () => {
  const START = 1_000_000;
  const cfg = {
    seed: 7, startMs: START, varaktighetMs: 300_000, installningar: { lage: "klass-mot-klass", attacker: "milda" },
    stationer: [{ classId: "4b", aktiva: 2 }, { classId: "4d", aktiva: 2 }],
  };
  const s = { classNames: { "4b": "4B", "4d": "4D" }, gameMode: "multiplication_0_10", rewards: { firstPrize: 100, perCorrect: 5, cap: 300 } };
  const ev = (uid, classId, nr, t, typ, extra = {}) => ({
    id: `${uid}_${nr}`, uid, classId, namn: uid, nr, t: START + t, typ, energi: 0, svar: { factorA: 2, factorB: 3, answer: 6 }, fel: [], ...extra,
  });
  const events = [];
  for (let i = 0; i < 60; i++) {
    events.push(ev("alma", "4b", i + 1, i * 4000 + 100, i % 2 ? "laser" : "skold"));
    if (i % 3 === 0) events.push(ev("omar", "4d", i / 3 + 1, i * 4000 + 200, "skold", { fel: [{ factorA: 7, factorB: 8, answer: 55, isCorrect: false, attemptId: `f${i}` }] }));
  }
  events.push(ev("omar", "4d", 99, 400_000, "laser")); // efter slutet – räknas inte
  const players = [{ uid: "alma", classId: "4b", name: "Alma" }, { uid: "omar", classId: "4d", name: "Omar" }, { uid: "tyst", classId: "4d", name: "Tyst" }];

  it("motorn med hela loggen; totaler, ögonblick, andel rätt och mynt", () => {
    const { result, spelare } = byggResultat({
      s, cfg, slutMs: START + 300_000, events, players,
      extraFel: { omar: [{ factorA: 7, factorB: 8, answer: 55, isCorrect: false, attemptId: "f0" }, { factorA: 2, factorB: 2, answer: 5, isCorrect: false }] },
    });
    const motor = simulera({ ...cfg, handlingar: events.filter((e) => e.t <= START + 300_000) }, START + 300_000).resultat;
    assert.deepEqual(result.placering, motor.placering);
    assert.equal(result.winner, motor.vinnare);
    assert.equal(spelare.alma.correct, 60);
    assert.equal(spelare.alma.handlingar.laser, 30);
    assert.equal(spelare.omar.correct, 20);
    assert.equal(spelare.omar.incorrect, 21, "f0 dubbelt (händelse + slutbuffert) räknas en gång");
    assert.equal(result.perClass["4d"].players, 1, "Tyst svarade aldrig");
    assert.equal(result.ranking.find((r) => r.uid === "tyst").answered, 0);
    assert.equal(result.rewards.tyst, undefined);
    assert.equal(result.rewards.alma.rank, result.placering.find((p) => p.classId === "4b").plats);
    assert.equal(result.rewards.alma.correctCoins, serverMynt.perCorrectCoins(60, 5, 300));
    const q78 = result.perQuestion.find((r) => r.key === "m:7x8");
    assert.equal(q78.correct, 0);
    assert.equal(q78.byClass["4d"].answered, 20);
    assert.ok(result.perClass["4b"].ogonblick.every((o) => o.uid === "alma"));
    assert.equal(JSON.stringify(result).includes("undefined"), false);
  });
  it("En klass: stjärnor och pris efter stjärnorna", () => {
    const en = { ...cfg, installningar: { lage: "en-klass", attacker: "av" }, stationer: [{ classId: "4b", aktiva: 2 }] };
    const { result } = byggResultat({ s, cfg: en, slutMs: START + 300_000, events: events.filter((e) => e.classId === "4b"), players });
    assert.equal(result.lage, "en-klass");
    assert.equal(result.winner, null);
    assert.equal(result.rewards.alma.rank, 4 - result.stjarnor);
  });
});

describe("synken till functions/meteorstorm/", () => {
  it("ms-anrop.js är med och ingen kopia har glidit isär", () => {
    assert.ok(meteorstormFiles().includes("ms-anrop.js"));
    assert.deepEqual(driftedFiles().filter((f) => f.startsWith("meteorstorm/")), [], "kör npm run sync:meteorstorm");
  });
  it("#821 F8: functions/meteorstorm/ har exakt samma filer som delat/ (ingen gammal kvar)", () => {
    const kopior = readdirSync(new URL("../functions/meteorstorm/", import.meta.url)).filter((f) => f.endsWith(".js") || f.endsWith(".json")).sort();
    assert.deepEqual(kopior, meteorstormFiles(), "en fil i functions/meteorstorm/ saknar källa i delat/ – ta bort den");
  });
});

describe("elevklienten (ms-klient.js)", () => {
  function rigg(gameMode = "multiplication_0_10") {
    const anrop = [];
    const svar = { msAgera: (d) => (d.svar ? { correct: true, nr: (d.nr || 1), energi: 0, typ: d.typ } : { ok: true, fel: d.fel.length }) };
    const minne = new Map();
    const lagring = { getItem: (k) => minne.get(k) ?? null, setItem: (k, v) => minne.set(k, v) };
    const call = async (namn, d) => {
      anrop.push([namn, structuredClone(d)]);
      if (svar[namn] instanceof Error) throw svar[namn];
      return svar[namn](d);
    };
    const k = createMsKlient({ sid: "s1", uid: "alma", seed: 5, gameMode, antalFragor: 4, call, lagring, vanta: async () => {} });
    return { k, anrop, svar, lagring };
  }

  it("multiplikation: fel svar buffras (inget anrop), rätt svar väntar på handlingen, sedan ETT anrop", async () => {
    const { k, anrop } = rigg();
    assert.equal((await k.svara({ attemptId: "a1-xxxxxx", factorA: 2, factorB: 3, answer: "5" })).correct, false);
    assert.equal((await k.svara({ attemptId: "a2-xxxxxx", factorA: 2, factorB: 4, answer: "9" })).correct, false);
    assert.equal(anrop.length, 0);
    assert.equal(k.buffert.length, 2);
    assert.equal((await k.svara({ attemptId: "a3-xxxxxx", factorA: 3, factorB: 3, answer: "9" })).correct, true);
    assert.equal(k.vantar(), true);
    await k.agera("laser");
    assert.equal(anrop.length, 1);
    const [namn, d] = anrop[0];
    assert.equal(namn, "msAgera");
    assert.deepEqual({ typ: d.typ, attemptId: d.attemptId, svar: d.svar, fel: d.fel.length }, { typ: "laser", attemptId: "a3-xxxxxx", svar: { k: 2, factorA: 3, factorB: 3, answer: "9" }, fel: 2 });
    assert.equal(k.buffert.length, 0);
    assert.equal(k.vantar(), false);
    await assert.rejects(k.agera("skold"), /Svara rätt först/);
  });

  it("#821 F1: kalla() delar ut elevens kortlek (multFor) med k; en obesvarad fråga visas igen", async () => {
    const { k, anrop } = rigg();
    const kalla = k.kalla();
    const q0 = kalla.next();
    assert.deepEqual({ a: q0.a, b: q0.b, k: q0.k }, { ...multFor(5, "alma", 0), k: 0 });
    assert.equal(kalla.next().k, 0, "inte besvarad – samma fråga");
    await k.svara({ attemptId: "w0-xxxxxx", factorA: q0.a, factorB: q0.b, answer: String(q0.answer + 1) });
    const q1 = kalla.next();
    assert.deepEqual({ a: q1.a, b: q1.b, k: q1.k }, { ...multFor(5, "alma", 1), k: 1 });
    await k.svara({ attemptId: "r1-xxxxxx", factorA: q1.a, factorB: q1.b, answer: String(q1.answer) });
    await k.agera("skold");
    assert.deepEqual(anrop[0][1].fel.map((f) => f.k), [0]);
    assert.equal(anrop[0][1].svar.k, 1);
  });

  it("omsynk från servern: klienten frågar msLage och börjar efter senaste länken", async () => {
    const { k, svar } = rigg();
    svar.msAgera = Object.assign(new Error("ordning"), { code: "failed-precondition", details: { omsynk: true, k: 7 } });
    svar.msLage = () => ({ nr: 3, energi: 2, k: 7, status: null });
    await k.svara({ attemptId: "w0-xxxxxx", factorA: 1, factorB: 1, answer: "5" });
    await k.svara({ attemptId: "r1-xxxxxx", factorA: 1, factorB: 1, answer: "1" });
    await assert.rejects(k.agera("laser"));
    assert.deepEqual({ nr: k.nr, energi: k.energi, k: k.k, vantar: k.vantar(), buffert: k.buffert.length }, { nr: 3, energi: 2, k: 8, vantar: false, buffert: 0 });
  });

  it("nätfel: svaret och bufferten ligger kvar, samma attemptId nästa gång; väntetid → ett omförsök", async () => {
    const { k, anrop, svar } = rigg();
    await k.svara({ attemptId: "a1-xxxxxx", factorA: 2, factorB: 3, answer: "1" });
    await k.svara({ attemptId: "a2-xxxxxx", factorA: 2, factorB: 3, answer: "6" });
    const ok = svar.msAgera;
    svar.msAgera = Object.assign(new Error("borta"), { code: "unavailable" });
    await assert.rejects(k.agera("skold"));
    assert.equal(k.buffert.length, 1);
    svar.msAgera = ok;
    let forst = true;
    svar.msAgera = (d) => {
      if (forst) { forst = false; throw Object.assign(new Error("lugn"), { code: "resource-exhausted", details: { vantaMs: 300 } }); }
      return ok(d);
    };
    await k.agera("skold");
    assert.deepEqual(anrop.map(([, d]) => d.attemptId), ["a2-xxxxxx", "a2-xxxxxx", "a2-xxxxxx"]);
    assert.equal(k.buffert.length, 0);
  });

  it("lång buffert skickas ensam; slutet skickar resten; lagringen överlever en omladdning", async () => {
    const { k, anrop, lagring } = rigg();
    for (let i = 0; i < MS_FEL_SKICKA; i++) await k.svara({ attemptId: `f${i}-xxxxxx`, factorA: 2, factorB: 3, answer: "0" });
    await new Promise((r) => setImmediate(r));
    assert.equal(anrop.length, 1);
    assert.equal(anrop[0][1].fel.length, Math.min(MS_FEL_SKICKA, MS_FEL_TAK));
    await k.svara({ attemptId: "sist-xxxxxx", factorA: 2, factorB: 3, answer: "0" });
    const igen = createMsKlient({ sid: "s1", uid: "alma", seed: 5, gameMode: "multiplication_0_10", call: async (n, d) => ({ ok: true, fel: d.fel.length }), lagring });
    assert.equal(igen.buffert.length, 1);
    assert.deepEqual(await igen.skickaFel(), { ok: true, fel: 1 });
    assert.equal(await igen.skickaFel(), null);
  });

  it("quiz: msRatta för rätt/fel, k växer, nästa fråga ur kortleken", async () => {
    const { k, anrop, svar } = rigg("plugga_quiz");
    svar.msRatta = (d) => ({ correct: d.svar.choiceIndex === 1, correctAnswer: "b" });
    const q0 = k.fraga();
    assert.equal(q0, fragaFor(5, "alma", 0, 4));
    const r0 = await k.svara({ attemptId: "q0-xxxxxx", q: q0, choiceIndex: 0 });
    assert.equal(r0.correct, false);
    assert.equal(r0.nextQ, fragaFor(5, "alma", 1, 4));
    await k.svara({ attemptId: "q1-xxxxxx", q: r0.nextQ, choiceIndex: 1 });
    await k.agera("skold");
    const sista = anrop.at(-1)[1];
    assert.deepEqual(sista.svar, { k: 1, q: r0.nextQ, choiceIndex: 1 });
    assert.deepEqual(sista.fel.map((f) => f.k), [0]);
    assert.equal(k.k, 2);
  });
});
