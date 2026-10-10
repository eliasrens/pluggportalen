// #566 – Guldrushen: historikens siffror (andel rätt per fråga/tabell, per
// elev, pallplats med delad placering) och det isolerade demoläget.
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildResult } from "../src/live/formats/guldrush/guldrush-core.js";
import {
  questionKey, questionStats, playerAnswerStats, hardestQuestions, podiumGroups, playerCounts,
} from "../src/live/formats/guldrush/gr-historik-data.js";
import { categoryRates } from "../src/live/formats/snilleblixt/sb-historik-data.js";
import MULT from "../src/live/modes/multiplication-0-10.js";
import { createGrDemo } from "../src/live/formats/guldrush/gr-demo.js";
import { GR_CHESTS } from "../src/live/formats/guldrush/delat/chests-config.js";

const S = { id: "x", format: "guldrush", participatingClassIds: ["a", "b"], classNames: { a: "4A", b: "4B" } };
const PLAYERS = [{ uid: "u1", name: "Alma", classId: "a" }, { uid: "u2", name: "Bo", classId: "a" }, { uid: "u3", name: "Cia", classId: "b" }];
const GR = [
  { uid: "u1", gold: 120, correct: 3, incorrect: 1, chests: 3 },
  { uid: "u2", gold: 120, correct: 2, incorrect: 0, chests: 2 },
  { uid: "u3", gold: 40, correct: 1, incorrect: 2, chests: 1 },
];
const m = (uid, classId, a, b, ok, at) => ({ uid, classId, mode: "multiplication_0_10", factorA: a, factorB: b, isCorrect: ok, at });
const ANSWERS = [
  m("u1", "a", 7, 8, true, 1), m("u1", "a", 8, 7, false, 2), m("u1", "a", 6, 6, true, 3), m("u1", "a", 3, 4, true, 4),
  m("u2", "a", 7, 8, true, 5), m("u2", "a", 6, 6, true, 6),
  m("u3", "b", 8, 7, false, 7), m("u3", "b", 9, 9, false, 8), m("u3", "b", 6, 6, true, 9),
];

describe("#566 frågestatistik ur svaren", () => {
  it("multiplikation: faktorparet oberoende av ordning; quiz: frågeindex", () => {
    assert.equal(questionKey({ mode: "multiplication_0_10", factorA: 8, factorB: 7 }), "m:7x8");
    assert.equal(questionKey({ mode: "plugga_quiz", q: 3 }), "q:3");
    assert.equal(questionKey({}), null);
  });
  it("perQuestion: svar/rätt, statKeys per tabell och byClass", () => {
    const qs = questionStats(ANSWERS, { players: PLAYERS });
    const by = Object.fromEntries(qs.map((q) => [q.text, q]));
    assert.deepEqual(Object.keys(by), ["3 × 4", "6 × 6", "7 × 8", "9 × 9"], "tabellordning");
    assert.deepEqual([by["7 × 8"].answered, by["7 × 8"].correct], [4, 2]);
    assert.deepEqual(by["7 × 8"].statKeys, ["t7", "t8"]);
    assert.deepEqual(by["6 × 6"].statKeys, ["t6"]);
    assert.deepEqual(by["7 × 8"].byClass, { a: { answered: 3, correct: 2 }, b: { answered: 1, correct: 0 } });
  });
  it("per tabell via spellägets statKeys/statCategories (Statistik → Live)", () => {
    const qs = questionStats(ANSWERS, { players: PLAYERS });
    const all = Object.fromEntries(categoryRates(qs, MULT.statCategories).map((c) => [c.key, [c.correct, c.answered]]));
    assert.deepEqual(all.t7, [2, 4]);
    assert.deepEqual(all.t6, [3, 3]);
    const b = Object.fromEntries(categoryRates(qs, MULT.statCategories, { classId: "b" }).map((c) => [c.key, [c.correct, c.answered]]));
    assert.deepEqual(b, { t6: [1, 1], t7: [0, 1], t8: [0, 1], t9: [0, 1] });
  });
  it("quiz: text och statKeys ur frågan/svaret", () => {
    const qs = questionStats([{ uid: "u1", classId: "a", mode: "plugga_quiz", q: 1, isCorrect: false, statKeys: ["natur"] }],
      { questions: [{ text: "A" }, { text: "Vad är H2O?" }] });
    assert.deepEqual([qs[0].text, qs[0].statKeys], ["Vad är H2O?", ["natur"]]);
  });
  it("per elev: rätt, antal och felsvaren (unika, i svarsordning)", () => {
    const pa = playerAnswerStats(ANSWERS);
    assert.deepEqual(pa.get("u1"), { answered: 4, correct: 3, wrong: ["7 × 8"] });
    assert.deepEqual(pa.get("u3").wrong, ["7 × 8", "9 × 9"]);
  });
  it("svåraste frågorna: lägst andel rätt, minst två svar", () => {
    const h = hardestQuestions(questionStats(ANSWERS));
    assert.deepEqual(h.map((q) => q.text), ["7 × 8"]);
  });
});

describe("#566 buildResult + pallplats", () => {
  const r = buildResult({ ...S }, [], PLAYERS, null, { grPlayers: GR, answers: ANSWERS });
  it("perQuestion i result när svaren finns – utan svar som förut", () => {
    assert.equal(r.perQuestion.length, 4);
    const old = buildResult({ ...S }, [], PLAYERS, null, { grPlayers: GR });
    assert.equal("perQuestion" in old, false);
  });
  it("klassens totala guld och delad 1:a på pallen", () => {
    assert.deepEqual(r.classGold, { a: 240, b: 40 });
    const g = podiumGroups(r.ranking);
    assert.deepEqual(g.map((x) => [x.rank, x.players.map((p) => p.name)]), [[1, ["Alma", "Bo"]], [3, ["Cia"]]]);
  });
  it("playerCounts ur rankingen (Statistik → Live per elev)", () => {
    assert.deepEqual(playerCounts(r).get("u3"), { correct: 1, incorrect: 2 });
  });
  it("historiken ritar ingen kärn-elevtabell och har en sammanfattning per klass", () => {
    const src = readFileSync(new URL("../src/live/formats/guldrush/guldrush-history.js", import.meta.url), "utf8");
    assert.match(src, /export const ownPlayerTable = true/);
    assert.match(src, /export function classSummaryHtml/);
    assert.match(src, /export function playerCounts/);
  });
});

describe("#566 demoläget – isolerat", () => {
  const demos = [];
  const mk = (o = {}) => { const d = createGrDemo({ rng: mulberry(7), ...o }); demos.push(d); return d; };
  after(() => demos.forEach((d) => d.destroy()));

  it("30 elever med olika avatarer och kläder i lobbyn", async () => {
    const d = mk();
    d.join(30, 0);
    assert.equal(d.state().players.length, 30);
    const proj = await d.deps.loadProjection("4b");
    const looks = Object.values(proj.members).map((x) => `${x.avatarId}|${x.avatarItems.join(",")}`);
    assert.equal(new Set(looks).size, 30);
    assert.equal(new Set(Object.values(proj.members).map((x) => x.avatarId)).size, 30);
  });
  it("varje kisttyp går att trigga separat och ger sin händelse", () => {
    const d = mk();
    d.playHistory(120);
    for (const c of GR_CHESTS) {
      d.chest(c.id);
      const e = d.state().events.find((x) => x.type !== "lead");
      if (c.id === "stold") assert.equal(e.type, "steal");
      else if (c.id === "byte") assert.equal(e.type, "swap");
      else assert.deepEqual([e.type, e.chest], ["chest", c.id]);
    }
  });
  it("sköld stoppar stöld, ledningsbyte, storm och tid snart slut", () => {
    const d = mk();
    d.playHistory(120);
    d.shieldBlock();
    assert.equal(d.state().events[0].type, "shieldBlock");
    d.leadChange();
    assert.equal(d.state().events[0].type, "lead");
    const n = d.state().answers.length;
    d.storm();
    assert.equal(d.state().answers.length, n + 30);
    d.soonOut(12);
    const left = d.session.startedAt + (d.session.countdownSeconds + d.session.durationSeconds) * 1000 - Date.now();
    assert.ok(left > 10_000 && left <= 12_000, String(left));
  });
  it("pallplats: delad 2:a och oavgjort om 1:a", () => {
    for (const [tie, ranks] of [["forsta", [1, 1, 3]], ["andra", [1, 2, 2]]]) {
      const d = mk();
      d.jumpToFinal(tie);
      assert.equal(d.session.status, "finished");
      const r = buildResult(d.session, [], d.state().players, null, { grPlayers: d.state().grPlayers });
      assert.deepEqual(r.ranking.slice(0, 3).map((p) => p.rank), ranks);
    }
  });
  it("rör aldrig riktig data: demo:true (inga pluggmynt), inga Firebase-/funktionsimporter", () => {
    const d = mk();
    assert.equal(d.session.demo, true);
    assert.ok(d.deps.guldrush.watchGrPlayers && d.deps.guldrush.watchEvents);
    const src = readFileSync(new URL("../src/live/formats/guldrush/gr-demo.js", import.meta.url), "utf8");
    const imports = src.match(/^(?:import|export) .* from .*$/gm).join("\n");
    assert.doesNotMatch(imports, /guldrush-data|firebase|live-data|live-rewards-data/);
    const html = readFileSync(new URL("../preview-guldrush-demo.html", import.meta.url), "utf8");
    assert.match(html, /cloudfunctions\\\.net/);
    assert.match(html, /deps: demo\.deps/);
  });
});

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
