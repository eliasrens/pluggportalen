// ============================================================================
// Läsresan (#402): lärarens klasstabell – src/lasresan/teacher-rows.js.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TABLE_COLUMNS, teacherClassRows, sortTeacherRows, nextSort, pctLevel,
} from "../src/lasresan/teacher-rows.js";

const entries = [
  { studentId: "s1", namn: "Örjan", lasresa: { level: 5, totalTexts: 18, totalQuestions: 126, totalCorrect: 91, totalIncorrect: 35, moneyEarned: 273, worldId: "skogen", stepInWorld: 18, completedWorlds: [] } },
  { studentId: "s2", namn: "Alva", lasresa: null },
  { studentId: "s3", namn: "Bo", lasresa: { level: 2, totalTexts: 4, totalQuestions: 24, totalCorrect: 9, totalIncorrect: 15, moneyEarned: 27, worldId: "skogen", stepInWorld: 4, completedWorlds: [] } },
  { studentId: "s4", namn: "Cleo", lasresa: { level: 6, totalTexts: 22, totalQuestions: 150, totalCorrect: 130, totalIncorrect: 20, moneyEarned: 390, worldId: "oknen", stepInWorld: 2, completedWorlds: ["skogen"] } },
  // Startat en text men inte avslutat någon: börjat, men ingen procent.
  { studentId: "s5", namn: "Dan", lasresa: { level: 3, totalTexts: 0, totalQuestions: 0, worldId: "skogen", stepInWorld: 0, currentTextId: "t1" } },
];

test("rader: korrekta värden, ej börjat = nivå 3 / Skogen 0 utan procent", () => {
  const rows = teacherClassRows(entries);
  const by = Object.fromEntries(rows.map((r) => [r.studentId, r]));
  assert.equal(rows.length, 5);
  assert.deepEqual(
    [by.s1.texts, by.s1.questions, by.s1.correct, by.s1.incorrect, by.s1.pct, by.s1.level, by.s1.worldName, by.s1.stepInWorld, by.s1.steps],
    [18, 126, 91, 35, 72, 5, "Skogen", 18, 20]
  );
  assert.equal(by.s2.started, false);
  assert.deepEqual([by.s2.level, by.s2.worldName, by.s2.stepInWorld, by.s2.pct, by.s2.texts], [3, "Skogen", 0, null, 0]);
  assert.equal(by.s4.worldName, "Öknen");
  assert.equal(by.s5.started, true);
  assert.equal(by.s5.pct, null);
});

test("sortering: namn (sv), texter, rätt %, läsnivå, värld", () => {
  const rows = teacherClassRows(entries);
  const ids = (key, dir) => sortTeacherRows(rows, key, dir).map((r) => r.studentId);
  assert.deepEqual(ids("namn", "asc"), ["s2", "s3", "s4", "s5", "s1"]); // Ö sist på svenska
  assert.deepEqual(ids("namn", "desc"), ["s1", "s5", "s4", "s3", "s2"]);
  assert.deepEqual(ids("texts", "desc"), ["s4", "s1", "s3", "s2", "s5"]); // lika → namn
  // Saknad procent (ej börjat / inga svar) alltid sist, åt båda hållen.
  assert.deepEqual(ids("pct", "desc"), ["s4", "s1", "s3", "s2", "s5"]);
  assert.deepEqual(ids("pct", "asc"), ["s3", "s1", "s4", "s2", "s5"]);
  assert.deepEqual(ids("level", "asc"), ["s3", "s2", "s5", "s1", "s4"]);
  // Öknen steg 2 ligger längre fram på resan än Skogen steg 18.
  assert.deepEqual(ids("journey", "desc"), ["s4", "s1", "s3", "s2", "s5"]);
});

test("nextSort: samma kolumn växlar, numerisk börjar fallande, namn stigande", () => {
  assert.deepEqual(nextSort({ key: "namn", dir: "asc" }, "namn"), { key: "namn", dir: "desc" });
  assert.deepEqual(nextSort({ key: "namn", dir: "asc" }, "pct"), { key: "pct", dir: "desc" });
  assert.deepEqual(nextSort({ key: "pct", dir: "desc" }, "namn"), { key: "namn", dir: "asc" });
  assert.deepEqual(TABLE_COLUMNS.map((c) => c.label), ["Elev", "Texter", "Frågor", "Rätt", "Fel", "Rätt %", "Läsresan-nivå", "Värld", "Steg"]);
});

test("pctLevel: gränser och saknat värde", () => {
  assert.deepEqual([pctLevel(null), pctLevel(0), pctLevel(33), pctLevel(34), pctLevel(66), pctLevel(67)], ["tom", "lag", "lag", "mellan", "mellan", "hog"]);
});

test("lärarvyn laddas dynamiskt (inte i bootgrafen) och läser inga försök i tabellen", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");
  const cls = readFileSync(join(root, "teacher-class.js"), "utf8");
  assert.match(cls, /import\(["']\.\/teacher-lasresan\.js["']\)/);
  assert.doesNotMatch(cls, /^import .*teacher-lasresan/m);
  const table = readFileSync(join(root, "teacher-lasresan.js"), "utf8");
  assert.doesNotMatch(table, /^import .*data-lasresan/m);
  // listAttempts används bara som injicerbar källa till elevdetaljen.
  assert.equal((table.match(/listAttempts/g) || []).length, 1);
});
