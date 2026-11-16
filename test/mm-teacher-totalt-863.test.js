// Mattematchen lärarstatistik (#863): totalt rätt/fel/felprocent per klass,
// per årskurs och hela skolan (mm-teacher-core.classTotals + tabellens HTML).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classTotals, formatFelprocent, buildResult } from "../src/tavling/mm-teacher-core.js";
import { totalsHtml } from "../src/tavling/mm-totalt-html.js";

const classes = [
  { id: "3a", name: "3A", studentIds: ["a1", "a2"] },
  { id: "4b", name: "4B", studentIds: ["b1"] },
  { id: "4c", name: "4C", studentIds: [] },
  { id: "fri", name: "Fritids", studentIds: ["f1"] },
];
const ids = ["4b", "3a", "4c"];
// Samma form som studentStats-dokumenten OCH result.students (classId/correct/incorrect).
const stats = [
  { uid: "a1", classId: "3a", correct: 10, incorrect: 2 },
  { uid: "a2", classId: "3a", correct: 5, incorrect: 3 },
  { uid: "b1", classId: "4b", correct: 7, incorrect: 0 },
  { uid: "x9", classId: "5x", correct: 99, incorrect: 99 }, // klass som inte deltar → räknas inte
  { uid: "trasig", classId: "3a", correct: "nej", incorrect: -4 },   // ogiltigt → 0
  null,
];

describe("classTotals – admin", () => {
  const t = classTotals({ stats, classes, participatingIds: ids });
  it("en rad per deltagande klass i namnordning, rätt/fel/felprocent", () => {
    assert.deepEqual(t.rows.map((r) => [r.name, r.correct, r.incorrect, r.total, r.pctWrong]), [
      ["3A", 15, 5, 20, 25],
      ["4B", 7, 0, 7, 0],
      ["4C", 0, 0, 0, null],
    ]);
  });
  it("Hela skolan = summan av klasserna; inte filtrerad", () => {
    assert.deepEqual(t.skola, { correct: 22, incorrect: 5, total: 27, pctWrong: 18.5 });
    assert.equal(t.filtrerad, false);
    assert.equal(t.mina, null);
    assert.equal(t.skolanLabel, "Hela skolan");
  });
  it("delsumma per årskurs (3 och 4) ur klassnamnen", () => {
    assert.deepEqual(t.arskurser.map((a) => [a.label, a.correct, a.incorrect, a.pctWrong]), [["Åk 3", 15, 5, 25], ["Åk 4", 7, 0, 0]]);
  });
  it("en enda årskurs, eller en klass per årskurs → inga delsummor", () => {
    assert.deepEqual(classTotals({ stats, classes, participatingIds: ["4b", "4c"] }).arskurser, []);
    assert.deepEqual(classTotals({ stats, classes, participatingIds: ["3a", "4b"] }).arskurser, []);
  });
  it("Övriga sist bland årskurserna", () => {
    const o = classTotals({ stats, classes, participatingIds: ["fri", "4b", "4c"] });
    assert.deepEqual(o.arskurser.map((a) => a.label), ["Åk 4", "Övriga"]);
  });
  it("felprocent har en decimal: 1 fel av 3 = 33,3 %", () => {
    const r = classTotals({ stats: [{ classId: "4b", correct: 2, incorrect: 1 }], classes, participatingIds: ["4b"] });
    assert.equal(r.rows[0].pctWrong, 33.3);
    assert.equal(formatFelprocent(r.rows[0].pctWrong), "33,3 %");
    assert.equal(formatFelprocent(0), "0,0 %");
    assert.equal(formatFelprocent(null), "–");
  });
  it("inga svar alls → nollor och – i procent", () => {
    const r = classTotals({ stats: [], classes, participatingIds: ids });
    assert.ok(r.rows.every((x) => x.total === 0 && x.pctWrong === null));
    assert.equal(r.skola.pctWrong, null);
  });
});

describe("classTotals – årskurskonto (bara egna klasser)", () => {
  const egna = new Set(["3a", "9z"]);
  it("pågående: bara egna klassers rader, Mina klasser, ingen skoltotal", () => {
    const t = classTotals({ stats, classes, participatingIds: ids, classIds: egna });
    assert.deepEqual(t.rows.map((r) => r.name), ["3A"]);
    assert.equal(t.filtrerad, true);
    assert.deepEqual(t.mina, { correct: 15, incorrect: 5, total: 20, pctWrong: 25 });
    assert.equal(t.skola, null);
    assert.deepEqual(t.arskurser, []);
  });
  it("avslutad: Hela skolan ur det sparade result.totals som ett enda tal", () => {
    const t = classTotals({ stats, classes, participatingIds: ids, classIds: egna, skola: { correct: 22, incorrect: 5 } });
    assert.deepEqual(t.skola, { correct: 22, incorrect: 5, total: 27, pctWrong: 18.5 });
    assert.deepEqual(t.rows.map((r) => r.name), ["3A"]);
  });
  it("kontot utan klasser i matchen → inga rader", () => {
    const t = classTotals({ stats, classes, participatingIds: ids, classIds: new Set(["9z"]) });
    assert.deepEqual(t.rows, []);
    assert.equal(t.filtrerad, true);
  });
  it("årskurskonto som har ALLA matchens klasser = som admin", () => {
    const t = classTotals({ stats, classes, participatingIds: ids, classIds: new Set(ids) });
    assert.equal(t.filtrerad, false);
    assert.equal(t.skola.correct, 22);
  });
});

describe("avslutad match: samma siffror ur result som ur studentStats", () => {
  it("buildResult.students + totals ger samma tabell", () => {
    // result.totals räknar alla studentStats (som historikens Statistik-kort) – därför utan 5x-eleven här.
    const deltar = stats.filter((s) => s && s.classId !== "5x");
    const live = classTotals({ stats: deltar, classes, participatingIds: ids });
    const result = buildResult({ scores: [], stats: deltar, counters: [], classes, participatingIds: ids, now: 0 });
    const sparat = classTotals({ stats: result.students, classes, participatingIds: ids, skola: result.totals });
    assert.deepEqual(sparat.rows, live.rows);
    assert.deepEqual(sparat.skola, live.skola);
  });
  it("admin: Hela skolan ur result.totals även när result.students är kapat", () => {
    const t = classTotals({ stats: stats.slice(0, 1), classes, participatingIds: ids, skola: { correct: 22, incorrect: 5 } });
    assert.deepEqual(t.skola, { correct: 22, incorrect: 5, total: 27, pctWrong: 18.5 });
    assert.equal(t.rows[0].correct, 10);
  });
});

describe("totalsHtml", () => {
  it("klassrader, årskursdelsummor och Hela skolan; – vid noll svar", () => {
    const html = totalsHtml(classTotals({ stats, classes, participatingIds: ids }));
    assert.match(html, /<th scope="col">Klass<\/th>/);
    assert.match(html, /Felprocent/);
    assert.match(html, /<td>3A<\/td><td class="lrt-num">15<\/td><td class="lrt-num">5<\/td>\s*<td class="lrt-num">25,0 %<\/td>/);
    assert.match(html, /Åk 3 totalt/);
    assert.match(html, /mmt-tot-skola"><th scope="row">Hela skolan<\/th><td class="lrt-num">22<\/td><td class="lrt-num">5<\/td>\s*<td class="lrt-num">18,5 %/);
    assert.match(html, /<td>4C<\/td><td class="lrt-num"><span class="lrt-dash"[^>]*>–<\/span><\/td>/);
    // Klasserna står under sin årskurs: 3A före "Åk 3 totalt" före 4B.
    assert.ok(html.indexOf("3A") < html.indexOf("Åk 3 totalt") && html.indexOf("Åk 3 totalt") < html.indexOf("4B"));
  });
  it("årskurskonto: Mina klasser (bara vid fler än en egen klass) utan Hela skolan; klassnamn escapas", () => {
    const html = totalsHtml(classTotals({
      stats, classes: [{ id: "3a", name: "3<b>A" }], participatingIds: ids, classIds: new Set(["3a"]),
    }));
    assert.doesNotMatch(html, /Mina klasser/);
    assert.doesNotMatch(html, /Hela skolan/);
    const tva = totalsHtml(classTotals({ stats, classes, participatingIds: [...ids, "fri"], classIds: new Set(["3a", "4b"]) }));
    assert.match(tva, /Mina klasser<\/th><td class="lrt-num">22<\/td><td class="lrt-num">5<\/td>/);
    assert.doesNotMatch(tva, /Hela skolan/);
    assert.doesNotMatch(html, /<b>/);
    assert.match(html, /3&#60;b&#62;A/);
  });
  it("inga rader → hint", () => {
    assert.match(totalsHtml(classTotals({ stats: [], classes, participatingIds: [] })), /Inga klasser/);
  });
});
