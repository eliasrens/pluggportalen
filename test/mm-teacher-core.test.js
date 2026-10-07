// Mattematchen lärarlogik (#459): formulär, kontroller, nollställnings-
// bekräftelse, historik-ögonblicksbild och klasstabellen.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  localMs, toInputs, defaultPeriod, validateCompetition, phaseActions, resetConfirmOk,
  splitCompetitions, buildResult, studentRows, sortMmRows, nextMmSort, MM_COLUMNS,
} from "../src/tavling/mm-teacher-core.js";

const H = 3600 * 1000;
const NOW = new Date(2026, 9, 6, 10, 0).getTime();
const comp = (over = {}) => ({
  id: "mm1", name: "Mattematchen", participatingClassIds: ["4a"],
  startAt: NOW - H, endAt: NOW + H, status: "active", ...over,
});

describe("datum + tid", () => {
  it("lokal tid åt båda hållen", () => {
    const ms = localMs("2026-10-12", "08:00");
    assert.deepEqual(toInputs(ms), { date: "2026-10-12", time: "08:00" });
  });
  it("ogiltigt → NaN (31 feb, tomt, 25:00)", () => {
    assert.ok(Number.isNaN(localMs("2026-02-31", "08:00")));
    assert.ok(Number.isNaN(localMs("", "08:00")));
    assert.ok(Number.isNaN(localMs("2026-10-12", "25:00")));
  });
  it("förslag: nästa hela timme → 14 dagar senare 15:00", () => {
    const { startMs, endMs } = defaultPeriod(new Date(2026, 9, 6, 9, 41).getTime());
    assert.deepEqual(toInputs(startMs), { date: "2026-10-06", time: "10:00" });
    assert.deepEqual(toInputs(endMs), { date: "2026-10-20", time: "15:00" });
  });
});

describe("validateCompetition", () => {
  const ok = { name: "  Mattematchen   oktober ", classIds: ["4a", "4a", "4b"], startMs: NOW + H, endMs: NOW + 9 * H };
  it("godkänt formulär normaliseras (namn, dubbletter)", () => {
    const r = validateCompetition(ok, NOW);
    assert.equal(r.ok, true);
    assert.deepEqual(r.fields, { name: "Mattematchen oktober", participatingClassIds: ["4a", "4b"] });
  });
  it("saknat namn / inga klasser / slut före start", () => {
    assert.equal(validateCompetition({ ...ok, name: " " }, NOW).ok, false);
    assert.equal(validateCompetition({ ...ok, classIds: [] }, NOW).ok, false);
    assert.equal(validateCompetition({ ...ok, endMs: ok.startMs }, NOW).ok, false);
    assert.equal(validateCompetition({ ...ok, name: "x".repeat(81) }, NOW).ok, false);
  });
  it("ny tävling får inte sluta i det förflutna – men en ändring får", () => {
    const old = { ...ok, startMs: NOW - 9 * H, endMs: NOW - H };
    assert.equal(validateCompetition(old, NOW).ok, false);
    assert.equal(validateCompetition({ ...old, editing: true }, NOW).ok, true);
  });
});

describe("kontroller per läge", () => {
  it("kommande kan startas nu; aktiv stoppas; stoppad fortsätter; avslutad bara nollställs", () => {
    assert.ok(phaseActions("kommande").includes("start"));
    assert.ok(phaseActions("aktiv").includes("stop") && !phaseActions("aktiv").includes("start"));
    assert.ok(phaseActions("pausad").includes("resume"));
    assert.deepEqual(phaseActions("avslutad"), ["reset"]);
    for (const p of ["kommande", "aktiv", "pausad"]) assert.ok(phaseActions(p).includes("finish"));
  });
  it("nollställning kräver tävlingsnamnet", () => {
    assert.equal(resetConfirmOk("", "Mattematchen oktober"), false);
    assert.equal(resetConfirmOk("ja", "Mattematchen oktober"), false);
    assert.equal(resetConfirmOk(" mattematchen  OKTOBER ", "Mattematchen oktober"), true);
    assert.equal(resetConfirmOk("", ""), false);
  });
});

describe("splitCompetitions", () => {
  it("aktiv först, kommande sist; historik senast avslutad först", () => {
    const list = [
      comp({ id: "k", startAt: NOW + H, endAt: NOW + 2 * H }),
      comp({ id: "a" }),
      comp({ id: "p", status: "stopped" }),
      comp({ id: "h1", startAt: NOW - 9 * H, endAt: NOW - 5 * H }),
      comp({ id: "h2", status: "finished", startAt: NOW - 3 * H, endAt: NOW - 2 * H }),
    ];
    const { current, history } = splitCompetitions(list, NOW);
    assert.deepEqual(current.map((c) => c.id), ["a", "p", "k"]);
    assert.deepEqual(current.map((c) => c.phase), ["aktiv", "pausad", "kommande"]);
    assert.deepEqual(history.map((c) => c.id), ["h2", "h1"]);
  });
});

describe("buildResult (historik)", () => {
  const scores = [
    { uid: "u1", name: "Alma", classId: "4a", correct: 30 },
    { uid: "u2", name: "Omar", classId: "4b", correct: 40 },
  ];
  const stats = [
    { uid: "u1", classId: "4a", correct: 30, incorrect: 10, c7: 5, w7: 2 },
    { uid: "u2", classId: "4b", correct: 40, incorrect: 0, c7: 3 },
    { uid: "u3", classId: "4b", correct: 0, incorrect: 4, w3: 4 },
  ];
  const counters = [{ classId: "4a", correct: 30 }, { classId: "4b", correct: 40 }];
  const classes = [{ id: "4a", name: "4A", studentIds: ["u1"] }, { id: "4b", name: "4B", studentIds: ["u2", "u3", "x", "y"] }];
  const r = buildResult({ scores, stats, counters, classes, participatingIds: ["4a", "4b"], names: new Map([["u3", "Clara"]]), now: NOW });
  it("vinnare individuellt + klass (rätt / elevantal)", () => {
    assert.deepEqual(r.winner, { uid: "u2", name: "Omar", classId: "4b", correct: 40 });
    assert.equal(r.winnerClass, "4a"); // 30/1 = 30,0 > 40/4 = 10,0
    assert.deepEqual(r.classes.map((k) => k.score), [30, 10]);
  });
  it("elevresultat inkl. elev med bara fel svar (namn ur names)", () => {
    assert.deepEqual(r.students.map((s) => [s.name, s.correct, s.incorrect]), [["Omar", 40, 0], ["Alma", 30, 10], ["Clara", 0, 4]]);
  });
  it("statistik: totalt + per tabell", () => {
    assert.deepEqual(r.totals, { correct: 70, incorrect: 14, total: 84, participants: 3 });
    assert.deepEqual(r.tables[7], { table: 7, correct: 8, wrong: 2 });
    assert.deepEqual(r.tables[3], { table: 3, correct: 0, wrong: 4 });
  });
  it("ingen har svarat → ingen vinnare", () => {
    const tom = buildResult({ scores: [], stats: [], counters: [], classes, participatingIds: ["4a"], now: NOW });
    assert.equal(tom.winner, null);
    assert.equal(tom.winnerClass, null);
  });
});

describe("klasstabellen", () => {
  const students = [{ id: "a", namn: "Bo" }, { id: "b", namn: "Ada" }, { id: "c", namn: "Cia" }];
  const stats = new Map([["a", { correct: 9, incorrect: 1 }], ["b", { correct: 3, incorrect: 3 }]]);
  const rows = studentRows(students, stats);
  it("en rad per elev, även utan svar; procent bara när eleven svarat", () => {
    assert.equal(rows.length, 3);
    assert.deepEqual([rows[0].total, rows[0].pctCorrect, rows[0].pctWrong], [10, 90, 10]);
    assert.equal(rows[2].started, false);
    assert.equal(rows[2].pctCorrect, null);
  });
  it("kolumnerna enligt spec", () => {
    assert.deepEqual(MM_COLUMNS.map((c) => c.label), ["Elev", "Rätt", "Fel", "Totalt", "Rätt %", "Fel %"]);
  });
  it("sortering: tal fallande först, saknade värden sist i båda riktningar", () => {
    let s = nextMmSort({ key: "namn", dir: "asc" }, "pctCorrect");
    assert.deepEqual(s, { key: "pctCorrect", dir: "desc" });
    assert.deepEqual(sortMmRows(rows, s.key, s.dir).map((r) => r.namn), ["Bo", "Ada", "Cia"]);
    s = nextMmSort(s, "pctCorrect");
    assert.deepEqual(sortMmRows(rows, s.key, s.dir).map((r) => r.namn), ["Ada", "Bo", "Cia"]);
    assert.deepEqual(sortMmRows(rows, "namn", "asc").map((r) => r.namn), ["Ada", "Bo", "Cia"]);
  });
});
