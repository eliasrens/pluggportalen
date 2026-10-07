// Mattematchen elevlogik (#458) – spec MM-test 1, 2, 4, 5, 6 på den rena kärnan.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  toMs, competitionPhase, activeCompetitionFor, nextBoundary, topList, classStandings,
  statsSummary, formatScore, formatPct, formatLeft,
} from "../src/tavling/mm-core.js";

const H = 3600 * 1000;
const NOW = Date.UTC(2026, 9, 6, 10);
const comp = (over = {}) => ({
  id: "mm1", name: "Mattematchen", participatingClassIds: ["4b", "5e"],
  startAt: NOW - H, endAt: NOW + H, status: "active", counterShards: 5, ...over,
});

describe("synlighet (MM-test 1–2)", () => {
  it("ingen tävling → dold", () => {
    assert.equal(activeCompetitionFor([], ["4b"], NOW), null);
  });
  it("tävling där klassen INTE deltar → dold", () => {
    assert.equal(activeCompetitionFor([comp({ participatingClassIds: ["6a"] })], ["4b"], NOW), null);
  });
  it("kommande, pausad, avslutad och utgången → dold", () => {
    for (const c of [comp({ startAt: NOW + 1 }), comp({ status: "stopped" }), comp({ status: "finished" }),
      comp({ endAt: NOW })]) {
      assert.equal(activeCompetitionFor([c], ["4b"], NOW), null, JSON.stringify(c));
    }
  });
  it("perioden startar → syns automatiskt; slutar → försvinner", () => {
    const c = comp({ startAt: NOW + 5000, endAt: NOW + H });
    assert.equal(activeCompetitionFor([c], ["4b"], NOW), null);
    assert.equal(nextBoundary([c], ["4b"], NOW), NOW + 5000);
    const m = activeCompetitionFor([c], ["4b"], NOW + 5000);
    assert.equal(m.competition.id, "mm1");
    assert.equal(m.classId, "4b");
    assert.equal(nextBoundary([c], ["4b"], NOW + 5000), NOW + H);
    assert.equal(activeCompetitionFor([c], ["4b"], NOW + H), null);
  });
  it("klassen = första av ELEVENS klasser som deltar; flera aktiva → senast startad", () => {
    const a = comp({ id: "a", startAt: NOW - 2 * H });
    const b = comp({ id: "b", startAt: NOW - H, participatingClassIds: ["5e"] });
    const m = activeCompetitionFor([a, b], ["9z", "5e", "4b"], NOW);
    assert.equal(m.competition.id, "b");
    assert.equal(m.classId, "5e");
  });
  it("Firestore-Timestamp-liknande värden fungerar", () => {
    assert.equal(toMs({ seconds: 10, nanoseconds: 5e8 }), 10500);
    assert.equal(toMs({ toMillis: () => 42 }), 42);
    assert.equal(competitionPhase(comp({ startAt: { seconds: (NOW - H) / 1000 } }), NOW), "aktiv");
  });
});

describe("Topp 25 (MM-test 4)", () => {
  it("60 elever → exakt 25, flest rätt först", () => {
    const scores = Array.from({ length: 60 }, (_, i) => ({ uid: `e${i}`, name: `Elev ${i}`, classId: "4b", correct: i + 1 }));
    const t = topList(scores);
    assert.equal(t.length, 25);
    assert.equal(t[0].correct, 60);
    assert.equal(t[24].correct, 36);
    assert.equal(t[0].rank, 1);
  });
  it("aldrig fler än 25 även vid lika poäng; delade platser", () => {
    const scores = Array.from({ length: 40 }, (_, i) => ({ uid: `e${i}`, name: `E${i}`, correct: i < 3 ? 9 : 5 }));
    const t = topList(scores);
    assert.equal(t.length, 25);
    assert.deepEqual(t.slice(0, 5).map((r) => r.rank), [1, 1, 1, 4, 4]);
  });
  it("0 poäng visas inte", () => {
    assert.equal(topList([{ uid: "x", name: "X", correct: 0 }]).length, 0);
  });
});

describe("Klasskamp (MM-test 5)", () => {
  const klasser = [
    { id: "5a", name: "5A", studentIds: Array.from({ length: 25 }, (_, i) => `a${i}`) },
    { id: "5b", name: "5B", studentIds: Array.from({ length: 20 }, (_, i) => `b${i}`) },
    { id: "5c", name: "5C", studentIds: [] },
    { id: "6x", name: "6X", studentIds: ["x"] },
  ];
  it("20 elever / 4000 rätt → 200,0 (summa över shards)", () => {
    const rows = classStandings(
      [{ classId: "5b", correct: 1500 }, { classId: "5b", correct: 2500 }], klasser, ["5b"]);
    assert.equal(rows[0].score, 200);
    assert.equal(formatScore(rows[0].score), "200,0");
  });
  it("specens exempel: 5B 215,0 leder före 5A 200,0", () => {
    const rows = classStandings(
      [{ classId: "5a", correct: 5000 }, { classId: "5b", correct: 4300 }], klasser, ["5a", "5b"]);
    assert.deepEqual(rows.map((r) => [r.name, formatScore(r.score)]), [["5B", "215,0"], ["5A", "200,0"]]);
  });
  it("ALLA deltagande klasser visas (även utan svar/elever), inga andra", () => {
    const rows = classStandings([{ classId: "6x", correct: 99 }], klasser, ["5a", "5b", "5c"]);
    assert.deepEqual(rows.map((r) => r.classId).sort(), ["5a", "5b", "5c"]);
    assert.ok(rows.every((r) => r.score === 0));
  });
  it("1 decimal med svensk komma", () => {
    const rows = classStandings([{ classId: "5a", correct: 4617 }], klasser, ["5a"]); // 184,68
    assert.equal(formatScore(rows[0].score), "184,7");
  });
});

describe("📊 egen statistik (MM-test 6)", () => {
  it("rätt, fel, totalt, % + per tabell 0–10", () => {
    const s = statsSummary({ correct: 90, incorrect: 10, c7: 16, w7: 4, c0: 5 });
    assert.equal(s.total, 100);
    assert.equal(s.pctCorrect, 90);
    assert.equal(s.pctWrong, 10);
    assert.equal(s.tables.length, 11);
    assert.deepEqual(s.tables[7], { table: 7, correct: 16, wrong: 4, total: 20, pct: 80 });
    assert.equal(s.tables[0].pct, 100);
    assert.equal(s.tables[3].total, 0);
  });
  it("tomt dokument → nollor (ingen division med noll)", () => {
    const s = statsSummary(null);
    assert.equal(s.total, 0);
    assert.equal(s.pctCorrect, 0);
    assert.equal(s.pctWrong, 0);
  });
  it("% rätt + % fel = 100 även vid avrundning", () => {
    const s = statsSummary({ correct: 2, incorrect: 1 });
    assert.equal(s.pctCorrect + s.pctWrong, 100);
  });
});

describe("format", () => {
  it("formatPct/formatLeft", () => {
    assert.equal(formatPct(94), "94 %");
    assert.equal(formatLeft(30 * 1000), "under en minut");
    assert.equal(formatLeft(12 * 60000), "12 min");
    assert.equal(formatLeft(5 * H), "5 tim");
    assert.equal(formatLeft(3 * 24 * H), "3 dagar");
  });
});
