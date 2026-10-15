// ============================================================================
// Bråkresan (#706): katalogen (50 id/namn), uppgiftsschemat, generator-
// kontraktet, omgångsplanen, den generiska bedömningen och reglerna (stjärnor,
// mynt, draknivå, jakt, svensk kalenderdag).
// ============================================================================

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHALLENGES, CHALLENGE_IDS, SECTIONS, TAGS, COMPONENTS, challengeMeta, extraLabel } from "../src/brakresan/schema/katalog.js";
import { createRng } from "../src/brakresan/schema/prng.js";
import { defineChallenge, stubChallenge, buildTask, gradeTask, ContractError, DEFAULT_SLOTS } from "../src/brakresan/schema/kontrakt.js";
import { planRound, PlanError, MAX_TRIES } from "../src/brakresan/schema/omgangsplan.js";
import { publicTask, revealTask, validateTask } from "../src/brakresan/schema/uppgift.js";
import { gradeWith } from "../src/brakresan/schema/bedomning.js";
import { reviewChallenge } from "../src/brakresan/schema/granskning.js";
import {
  roundReward, resultMessage, dragonLevel, dragonProgress, huntMax, stockholmDate, challengeStatus, accuracy,
  isSmallSample, starEventId, MAX_TOTAL_STARS, COINS_PER_STAR, ENCOURAGE_COINS, cleanDragonName, DRAGON_DEFAULT_NAME,
} from "../src/brakresan/schema/regler.js";
import { loadChallenge, loadAllChallenges } from "../src/brakresan/utmaningar/index.js";
import { fixture, fixtureDef } from "./helpers/brakresan-fixtur.js";

describe("katalogen (§8)", () => {
  test("exakt 50 utmaningar, id 01–50, namn ordagrant som i specen", () => {
    const spec = readFileSync(new URL("../docs/BRAKRESAN-SPEC.md", import.meta.url), "utf8");
    const rubriker = [...spec.matchAll(/^### (\d\d)\. (.+?)(?: – EXTRA UTMANING)?$/gm)].map(([, id, name]) => [id, name]);
    assert.equal(rubriker.length, 50);
    assert.deepEqual(CHALLENGES.map((c) => [c.id, c.name]), rubriker);
    assert.deepEqual(CHALLENGE_IDS, Array.from({ length: 50 }, (_, i) => String(i + 1).padStart(2, "0")));
  });

  test("ämnesrubriker, extra-markeringar, taggar och komponenter", () => {
    assert.equal(SECTIONS.length, 5);
    assert.deepEqual(CHALLENGES.filter((c) => c.extra).map((c) => [c.id, extraLabel(c)]), [
      ["38", "Extra utmaning"], ["47", "Extra utmaning"], ["48", "Extra utmaning"],
      ["50", "Extra utmaning – blandade kluringar"],
    ]);
    for (const c of CHALLENGES) {
      assert.ok(c.goal.length > 10 && c.goal.length < 90, `${c.id} har en kort målmening`);
      assert.ok(c.tags.length && c.tags.every((t) => TAGS[t]), `${c.id} har kända taggar`);
      assert.ok(c.components.every((k) => COMPONENTS[k]), `${c.id} har kända komponenter`);
    }
    assert.equal(Object.keys(COMPONENTS).length, 12, "spec §4: tolv komponenter");
    assert.equal(challengeMeta(3).name, "Måla bråket");
    assert.equal(challengeMeta("51"), null);
  });

  test("alla 50 filer laddas lat och bär rätt id; stubbar är inte byggda", async () => {
    const all = await loadAllChallenges();
    assert.deepEqual(all.map((c) => c.id), CHALLENGE_IDS);
    for (const c of all) assert.equal(typeof c.implemented, "boolean");
    await assert.rejects(loadChallenge("99"), RangeError);
    assert.throws(() => buildTask(stubChallenge("01"), {}), ContractError);
  });
});

describe("seedad slump", () => {
  test("samma seed → samma följd, oberoende delströmmar", () => {
    const a = createRng("x");
    const b = createRng("x");
    assert.deepEqual([a.int(1, 100), a.int(1, 100), a.pick([1, 2, 3])], [b.int(1, 100), b.int(1, 100), b.pick([1, 2, 3])]);
    assert.notDeepEqual(createRng("x").shuffle([1, 2, 3, 4, 5, 6]), createRng("y").shuffle([1, 2, 3, 4, 5, 6]));
    assert.deepEqual(createRng("x").fork("k").sample([1, 2, 3, 4], 2), createRng("x").fork("k").sample([1, 2, 3, 4], 2));
    const r = createRng("gränser");
    for (let i = 0; i < 1000; i++) {
      const v = r.int(2, 5);
      assert.ok(v >= 2 && v <= 5 && Number.isInteger(v));
    }
  });
});

describe("generatorkontraktet och uppgiftsschemat (§6)", () => {
  test("en byggd uppgift följer schemat och publicTask saknar facit", () => {
    const ch = fixture();
    const task = buildTask(ch, { a: 3, n: 5, shape: "cirkel" }, { index: 4, id: "r1-4" });
    assert.deepEqual(validateTask(task), []);
    assert.equal(task.role, "normal");
    assert.equal(task.version, 1);
    const pub = publicTask(task);
    for (const k of ["key", "feedback", "review", "params", "values", "core"]) assert.equal(k in pub, false, k);
    assert.deepEqual(Object.keys(revealTask(task)), ["display", "feedback", "review"]);
    assert.deepEqual(JSON.parse(JSON.stringify(task)), task, "uppgiften är ren JSON");
  });

  test("kontraktet fäller trasiga utmaningar", () => {
    assert.throws(() => defineChallenge({ ...fixtureDef(), id: "77" }), ContractError);
    assert.throws(() => defineChallenge({ ...fixtureDef(), version: 0 }), /version/);
    assert.throws(() => defineChallenge({ ...fixtureDef(), reserve: [] }), /reserve/);
    assert.throws(() => defineChallenge({ ...fixtureDef(), slots: ["intro"] }), /slots/);
    const base = fixtureDef();
    const med = (patch) => fixture({ build: (p) => ({ ...base.build(p), ...patch(base.build(p)) }) });
    assert.throws(() => buildTask(med(() => ({ help: [] })), { a: 1, n: 2, shape: "cirkel" }), /help/);
    assert.throws(() => buildTask(med((b) => ({ help: [{ step: "princip", text: `Svaret är ${b.key.display}.` }] })),
      { a: 1, n: 2, shape: "cirkel" }), /facit/);
    assert.throws(() => buildTask(med((b) => ({ key: { ...b.key, groups: [["a", "b"]] } })),
      { a: 1, n: 2, shape: "cirkel" }), /Firestore/);
    assert.throws(() => buildTask(med(() => ({ values: { x: 0.1 + undefined } })), { a: 1, n: 2, shape: "cirkel" }), /ändligt/);
    assert.throws(() => buildTask(med(() => ({ help: [{ step: "princip", text: "a" }, { step: "orientering", text: "b" }] })),
      { a: 1, n: 2, shape: "cirkel" }), /ordningen/);
  });

  test("generatorgranskningen godkänner fixturen och fäller en icke-deterministisk generator", () => {
    const ok = reviewChallenge(fixture());
    assert.deepEqual(ok.problems, []);
    assert.equal(ok.samples, 200);
    assert.ok(ok.distinctCores >= 60);

    let bump = 0;
    const flaky = fixture({ build: (p) => ({ ...fixtureDef().build(p), review: `${bump++}` }) });
    assert.ok(reviewChallenge(flaky, { samples: 5, plans: 1 }).problems.some((p) => /build ger annan/.test(p)));

    const lat = fixture({ generate: (rng) => ({ a: 1, n: rng.int(2, 3), shape: "cirkel" }) });
    assert.ok(reviewChallenge(lat, { samples: 20, plans: 0 }).problems.some((p) => /olika kärnor/.test(p)));

    const slapp = fixture({ build: (p) => {
      const b = fixtureDef().build(p);
      return { ...b, key: { ...b.key, examples: { ...b.key.examples, wrong: [{ selected: b.key.examples.right[0].selected }] } } };
    } });
    assert.ok(reviewChallenge(slapp, { samples: 3, plans: 0 }).problems.some((p) => /fel exempel godkänt/.test(p)));
  });
});

describe("omgångsplanen (§6)", () => {
  test("tio olika kärnor i slot-ordning, deterministiskt", () => {
    const ch = fixture();
    const a = planRound(ch, { seed: "s1" });
    assert.equal(a.entries.length, 10);
    assert.deepEqual(a.entries.map((e) => e.role), DEFAULT_SLOTS);
    assert.equal(new Set(a.entries.map((e) => e.core)).size, 10);
    assert.deepEqual(planRound(ch, { seed: "s1" }), a);
    assert.notDeepEqual(planRound(ch, { seed: "s2" }).entries.map((e) => e.core), a.entries.map((e) => e.core));
  });

  test("undviker tidigare omgångars kärnor så länge banken räcker", () => {
    const ch = fixture();
    const first = planRound(ch, { seed: "r1" });
    const second = planRound(ch, { seed: "r2", avoidCores: first.entries.map((e) => e.core) });
    const overlap = second.entries.filter((e) => first.entries.some((f) => f.core === e.core));
    assert.equal(overlap.length, 0);
    assert.ok(second.entries.every((e) => !e.relaxed));
  });

  test("liten bank: släpper tidigare kärnor men aldrig dubbletter inom omgången, sedan reservbanken", () => {
    let calls = 0;
    const tight = fixture({
      generate: (rng) => {
        calls++;
        return { a: 1, n: rng.int(2, 6), shape: "cirkel" }; // bara 5 kärnor
      },
    });
    const plan = planRound(tight, { seed: "t", avoidCores: ["cirkel-1/2"] });
    assert.equal(new Set(plan.entries.map((e) => e.core)).size, 10);
    assert.ok(plan.entries.some((e) => e.source === "reserv"), "reservbanken fyller på");
    assert.ok(calls <= 10 * MAX_TRIES, "begränsat antal försök");
  });

  test("tom generator + uttömd reserv → PlanError, aldrig en oändlig loop", () => {
    const dead = fixture({
      generate: () => ({ a: 1, n: 2, shape: "cirkel" }),
      reserve: Array.from({ length: 10 }, () => ({ params: { a: 1, n: 3, shape: "cirkel" } })),
    });
    assert.throws(() => planRound(dead, { seed: "d" }), PlanError);
    assert.throws(() => planRound(stubChallenge("05"), { seed: "d" }), PlanError);
  });
});

describe("generisk bedömning", () => {
  const sel = { type: "select", count: 3, options: ["a", "b", "c", "d", "e", "f"] };
  const selKey = { type: "select", groups: [{ ids: ["a", "c", "f"] }] };

  test("välj tre: alla permutationer rätt; två val = 'Välj ett kort till', ingen bedömning", () => {
    assert.equal(gradeWith(sel, selKey, { ids: ["f", "a", "c"] }).correct, true);
    assert.equal(gradeWith(sel, selKey, { ids: ["a", "b", "c"] }).correct, false);
    const tva = gradeWith(sel, selKey, { ids: ["a", "c"] });
    assert.deepEqual([tva.status, tva.message], ["invalid", "Välj ett kort till."]);
    assert.equal(gradeWith(sel, selKey, { ids: ["a"] }).message, "Välj 2 kort till.");
    assert.equal(gradeWith(sel, selKey, { ids: ["a", "b", "c", "d"] }).status, "invalid");
    assert.equal(gradeWith(sel, selKey, { ids: ["a", "a", "c"] }).status, "invalid");
  });

  test("val, ja/nej, relation", () => {
    const ch = { type: "choice", options: ["x", "y", "z", "w"] };
    assert.equal(gradeWith(ch, { type: "choice", correct: "y" }, { id: "y" }).correct, true);
    assert.equal(gradeWith(ch, { type: "choice", correct: "y" }, {}).status, "invalid");
    assert.equal(gradeWith({ type: "yesno" }, { type: "yesno", correct: false }, { value: false }).correct, true);
    assert.equal(gradeWith({ type: "relation" }, { type: "relation", correct: "=" }, { value: ">" }).correct, false);
    assert.equal(gradeWith({ type: "relation" }, { type: "relation", correct: "=" }, { value: "≥" }).status, "invalid");
  });

  test("parning godtar varje parning med samma värden", () => {
    const spec = { type: "pairs" };
    const key = { type: "pairs", cards: { k1: "1/2", k2: "1/2", k3: "1/3", k4: "1/3" } };
    assert.equal(gradeWith(spec, key, { pairs: [{ a: "k2", b: "k1" }, { a: "k3", b: "k4" }] }).correct, true);
    assert.equal(gradeWith(spec, key, { pairs: [{ a: "k1", b: "k3" }, { a: "k2", b: "k4" }] }).correct, false);
    assert.equal(gradeWith(spec, key, { pairs: [{ a: "k1", b: "k2" }] }).message, "Para ihop alla kort först.");
  });

  test("sortering i fack och ordning (lika värden i valfri inbördes ordning)", () => {
    const spec = { type: "categories", bins: ["mindre", "lika", "storre"] };
    const key = { type: "categories", bins: { a: "mindre", b: "lika", c: "storre" } };
    assert.equal(gradeWith(spec, key, { bins: { mindre: ["a"], lika: ["b"], storre: ["c"] } }).correct, true);
    assert.equal(gradeWith(spec, key, { bins: { mindre: ["b"], lika: ["a"], storre: ["c"] } }).correct, false);
    assert.equal(gradeWith(spec, key, { bins: { mindre: ["a"] } }).message, "Sortera alla kort först.");
    const ord = { type: "order", values: { a: { n: 1, d: 4 }, b: { n: 1, d: 2 }, c: { n: 2, d: 4 }, d: { n: 3, d: 4 } } };
    assert.equal(gradeWith({ type: "order" }, ord, { ids: ["a", "c", "b", "d"] }).correct, true);
    assert.equal(gradeWith({ type: "order" }, ord, { ids: ["a", "b", "c", "d"] }).correct, true);
    assert.equal(gradeWith({ type: "order" }, ord, { ids: ["b", "a", "c", "d"] }).correct, false);
  });

  test("målning: antalet räknas, vilka delar som helst; tom markering låser inte", () => {
    const spec = { type: "paint", parts: ["p0", "p1", "p2", "p3", "p4"] };
    const key = { type: "paint", count: 3 };
    assert.equal(gradeWith(spec, key, { selected: ["p4", "p0", "p2"] }).correct, true);
    assert.equal(gradeWith(spec, key, { selected: ["p1", "p2", "p3"] }).correct, true);
    assert.equal(gradeWith(spec, key, { selected: ["p1"] }).correct, false);
    assert.equal(gradeWith(spec, key, { selected: [] }).status, "invalid");
    assert.equal(gradeWith(spec, key, { selected: ["p9"] }).status, "invalid");
  });

  test("talinmatning med formkrav; nämnare 0 är inmatningsfel", () => {
    const spec = { type: "number", input: "fraction" };
    const key = { type: "number", value: { n: 3, d: 4 }, requirement: { kind: "simplest" } };
    assert.equal(gradeWith(spec, key, { fields: { n: "3", d: "4" } }).correct, true);
    const r = gradeWith(spec, key, { fields: { n: "6", d: "8" } });
    assert.deepEqual([r.status, r.correct, r.reason], ["graded", false, "ej-enklaste"]);
    assert.equal(gradeWith(spec, key, { fields: { n: "3", d: "0" } }).error, "namnare-noll");
    const dec = { type: "number", input: "decimal" };
    assert.equal(gradeWith(dec, { type: "number", value: { n: 1, d: 2 } }, { text: "0,50" }).correct, true);
  });

  test("tallinje: exakt snäppvärde, inte pixelnärhet", () => {
    const spec = { type: "point", min: { n: 0, d: 1 }, max: { n: 1, d: 1 }, snap: 8 };
    const key = { type: "point", value: { n: 1, d: 4 } };
    assert.equal(gradeWith(spec, key, { value: { n: 2, d: 8 } }).correct, true);
    assert.equal(gradeWith(spec, key, { value: { n: 3, d: 8 } }).correct, false);
    assert.equal(gradeWith(spec, key, { value: { n: 1, d: 3 } }).status, "invalid", "inte ett streck");
    assert.equal(gradeWith(spec, key, { value: { n: 9, d: 8 } }).status, "invalid", "utanför linjen");
    assert.equal(gradeWith(spec, key, {}).status, "invalid");
  });

  test("flerstegsuppgift = EN poäng; alla delar måste vara rätt", () => {
    const spec = { type: "multi", parts: { rel: { type: "relation" }, why: { type: "choice", options: ["a", "b"] } } };
    const key = { type: "multi", parts: { rel: { type: "relation", correct: "<" }, why: { type: "choice", correct: "b" } } };
    assert.equal(gradeWith(spec, key, { parts: { rel: { value: "<" }, why: { id: "b" } } }).correct, true);
    const half = gradeWith(spec, key, { parts: { rel: { value: "<" }, why: { id: "a" } } });
    assert.deepEqual([half.correct, half.parts], [false, { rel: true, why: false }]);
    assert.equal(gradeWith(spec, key, { parts: { rel: { value: "<" } } }).status, "invalid");
  });

  test("gradeTask använder utmaningens egen validate om den finns", () => {
    const ch = fixture({ validate: () => ({ status: "graded", correct: true, reason: null, message: null }) });
    const task = buildTask(ch, { a: 2, n: 4, shape: "cirkel" });
    assert.equal(gradeTask(ch, task, { selected: ["p0"] }).correct, true);
  });
});

describe("regler: stjärnor och mynt (§2, §5, §15 Belöningar)", () => {
  const r = (correct, starsBefore = 0, encouragementPaid = false) => roundReward({ correct, starsBefore, encouragementPaid });

  test("7/10 ingen stjärna, 8/10 en, 10/10 fortfarande en", () => {
    assert.equal(r(7).kind, "uppmuntran");
    assert.deepEqual(r(8), { kind: "stjarna", starOrdinal: 1, coins: 40 });
    assert.deepEqual(r(10), { kind: "stjarna", starOrdinal: 1, coins: 40 });
  });

  test("tre godkända omgångar ger tre stjärnor; den fjärde ger inga mynt", () => {
    assert.equal(r(9, 1).starOrdinal, 2);
    assert.equal(r(9, 2).starOrdinal, 3);
    assert.deepEqual(r(10, 3), { kind: "repetition", starOrdinal: null, coins: 0 });
    assert.deepEqual(r(6, 3), { kind: "repetition", starOrdinal: null, coins: 0 }, "inga uppmuntransmynt efter bemästring");
  });

  test("uppmuntran 6–7 rätt en gång per utmaning; 0–5 inget", () => {
    assert.deepEqual(r(6), { kind: "uppmuntran", starOrdinal: null, coins: 10 });
    assert.equal(r(7, 0, true).kind, "ingen");
    assert.equal(r(5).kind, "ingen");
    assert.equal(r(0).coins, 0);
    assert.throws(() => r(11), RangeError);
  });

  test("full progression = 150 stjärnor och 6 000 stjärnmynt; uppmuntran högst 500", () => {
    assert.equal(MAX_TOTAL_STARS, 150);
    assert.equal(MAX_TOTAL_STARS * COINS_PER_STAR, 6000);
    assert.equal(50 * ENCOURAGE_COINS, 500);
    assert.equal(starEventId("03", 2), "stjarna-03-2");
  });

  test("resultattexterna", () => {
    assert.equal(resultMessage({ correct: 8, reward: r(8) }), "Du klarade omgången! 8 av 10 rätt.");
    assert.match(resultMessage({ correct: 6, reward: r(6) }), /^Du fick 6 av 10 rätt\. Två rätt till behövs/);
    assert.match(resultMessage({ correct: 7, reward: r(7) }), /Ett rätt till/);
    assert.equal(resultMessage({ correct: 3, reward: r(3) }), "Bra att du tränade. Vi hjälper dig vidare.");
    assert.match(resultMessage({ correct: 10, reward: r(10, 3) }), /^Repetition – du har redan alla tre stjärnor/);
  });
});

describe("regler: draken och jakten (§9, §10)", () => {
  test("drakens namn (#713): standardnamn, säker text, högst 16 tecken", () => {
    assert.equal(cleanDragonName(DRAGON_DEFAULT_NAME), DRAGON_DEFAULT_NAME);
    assert.equal(cleanDragonName("  Glöd  "), "Glöd");
    assert.equal(cleanDragonName("<img src=x onerror=1>"), "img src=x onerro");
    assert.equal(cleanDragonName("a\n\tb\u0000c\u200Bd"), "a bcd");
    assert.equal(cleanDragonName("abcdefghijklmnopqrstuvwxyz"), "abcdefghijklmnop");
    assert.equal(Array.from(cleanDragonName("🐉".repeat(30))).length, 16, "räknar tecken, inte UTF-16-enheter");
    for (const tomt of ["", "   ", "<>&", null, undefined, 42, {}]) assert.equal(cleanDragonName(tomt), null);
  });
  test("draktrösklar 0, 9, 10, 19, 20, 149, 150", () => {
    assert.deepEqual([0, 9, 10, 19, 20, 149, 150].map(dragonLevel), [0, 0, 1, 1, 2, 14, 15]);
    assert.deepEqual(dragonProgress(7), { level: 0, egg: true, nextAt: 10, starsToNext: 3, fullyGrown: false });
    assert.deepEqual(dragonProgress(23), { level: 2, egg: false, nextAt: 30, starsToNext: 7, fullyGrown: false });
    assert.deepEqual(dragonProgress(150), { level: 15, egg: false, nextAt: null, starsToNext: null, fullyGrown: true });
    // #713: trösklarna 0, 9, 10, 19, 20, 149, 150 i panelens progress.
    assert.deepEqual([0, 9, 10, 19, 20, 149, 150].map((s) => {
      const p = dragonProgress(s);
      return [p.level, p.egg, p.nextAt, p.starsToNext, p.fullyGrown];
    }), [
      [0, true, 10, 10, false], [0, true, 10, 1, false], [1, false, 20, 10, false], [1, false, 20, 1, false],
      [2, false, 30, 10, false], [14, false, 150, 1, false], [15, false, null, null, true],
    ]);
  });

  test("jaktintervall per nivå, även 11 och 15", () => {
    assert.deepEqual([0, 1, 2, 10, 11, 12, 14, 15].map(huntMax), [0, 10, 20, 100, 120, 140, 180, 200]);
  });

  test("svensk kalenderdag runt midnatt och vid sommar-/vintertid", () => {
    const utc = (s) => Date.parse(s);
    assert.equal(stockholmDate(utc("2026-10-13T21:59:59Z")), "2026-10-13"); // 23:59:59 CEST
    assert.equal(stockholmDate(utc("2026-10-13T22:00:00Z")), "2026-10-14"); // 00:00 CEST
    assert.equal(stockholmDate(utc("2026-01-14T22:59:59Z")), "2026-01-14"); // 23:59:59 CET
    assert.equal(stockholmDate(utc("2026-01-14T23:00:00Z")), "2026-01-15"); // 00:00 CET
    // Sommartid börjar 2026-03-29 02:00 → 03:00, vintertid 2026-10-25 03:00 → 02:00.
    assert.equal(stockholmDate(utc("2026-03-28T22:59:00Z")), "2026-03-28");
    assert.equal(stockholmDate(utc("2026-03-28T23:00:00Z")), "2026-03-29");
    assert.equal(stockholmDate(utc("2026-03-29T21:59:00Z")), "2026-03-29");
    assert.equal(stockholmDate(utc("2026-03-29T22:00:00Z")), "2026-03-30");
    assert.equal(stockholmDate(utc("2026-10-24T21:59:00Z")), "2026-10-24");
    assert.equal(stockholmDate(utc("2026-10-24T22:00:00Z")), "2026-10-25");
    assert.equal(stockholmDate(utc("2026-10-25T22:59:00Z")), "2026-10-25");
    assert.equal(stockholmDate(utc("2026-10-25T23:00:00Z")), "2026-10-26");
  });
});

describe("regler: status och statistik (§11, §12)", () => {
  test("status läses utan färg", () => {
    assert.equal(challengeStatus({}).label, "Inte påbörjad");
    assert.equal(challengeStatus({ activeRoundId: "r", activeAnswered: 4 }).label, "Pågående omgång (4/10 svarade)");
    assert.equal(challengeStatus({ firstTotal: 10 }).label, "Tränar");
    assert.equal(challengeStatus({ stars: 2, firstTotal: 20 }).label, "2 av 3 stjärnor");
    assert.equal(challengeStatus({ stars: 3, activeRoundId: "r" }).label, "Bemästrad");
  });

  test("träffsäkerhet och litet underlag", () => {
    assert.equal(accuracy(0, 0), null);
    assert.equal(accuracy(5, 12), 42);
    assert.equal(isSmallSample(2, 100), true);
    assert.equal(isSmallSample(3, 19), true);
    assert.equal(isSmallSample(3, 20), false);
  });
});
