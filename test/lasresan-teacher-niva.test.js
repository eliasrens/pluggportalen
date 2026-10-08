// Läsresan – lärarens nivåstyrning, ren logik (#506): src/lasresan/teacher-niva.js
// + att den nya vyn bara nås dynamiskt (bootgrafen, #271).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LEVELS,
  classConfirmText,
  classResultText,
  classStudentIds,
  elever,
  genitiv,
  levelCell,
  startLevelInfo,
  startSavedText,
  studentLevelStatus,
  studentSavedText,
} from "../src/lasresan/teacher-niva.js";
import { teacherClassRows } from "../src/lasresan/teacher-rows.js";

const base = (over = {}) => ({
  level: 4, highStreak: 0, lowStreak: 0, worldId: "skogen", stepInWorld: 3, completedWorlds: [],
  totalTexts: 3, totalQuestions: 18, totalCorrect: 12, totalIncorrect: 6, moneyEarned: 36,
  seenTextIds: ["a", "b", "c"], catStats: {}, currentTextId: null, lastTextId: "c", ...over,
});
const rowOf = (lasresa, startLevel) =>
  teacherClassRows([{ studentId: "s", namn: "Sam", lasresa }], undefined, { startLevel })[0];

test("nivåerna 1–10", () => {
  assert.deepEqual(LEVELS, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("elever + genitiv", () => {
  assert.equal(elever(1), "1 elev");
  assert.equal(elever(28), "28 elever");
  assert.equal(elever(0), "0 elever");
  assert.equal(genitiv("Astrid"), "Astrids");
  assert.equal(genitiv("Elias"), "Elias");
  assert.equal(genitiv("Max"), "Max");
});

test("startLevelInfo: standard 4 när inget är satt, annars klassens", () => {
  assert.deepEqual(startLevelInfo({}), { level: 4, isDefault: true, text: "Nivå 4 (standard)" });
  assert.deepEqual(startLevelInfo(null), { level: 4, isDefault: true, text: "Nivå 4 (standard)" });
  assert.deepEqual(startLevelInfo({ lasresaStartLevel: 1 }), { level: 1, isDefault: false, text: "Nivå 1" });
  assert.equal(startLevelInfo({ lasresaStartLevel: 11 }).text, "Nivå 4 (standard)");
  assert.equal(startLevelInfo({ lasresaStartLevel: 9 }).text, "Nivå 9");
});

test("classStudentIds: bara kända elever, inga dubbletter", () => {
  const cls = { studentIds: ["a", "b", "a", "borttagen", "", null] };
  assert.deepEqual(classStudentIds(cls, new Set(["a", "b"])), ["a", "b"]);
  assert.deepEqual(classStudentIds(cls, new Map([["b", {}]])), ["b"]);
  assert.deepEqual(classStudentIds(cls), ["a", "b", "borttagen"]);
  assert.deepEqual(classStudentIds({}, new Set()), []);
});

test("levelCell: nuvarande nivå, väntande nivå och klassens startnivå", () => {
  assert.equal(levelCell(rowOf(base())).text, "4");
  assert.match(levelCell(rowOf(base())).title, /Dold Läsresan-nivå 4 av 10/);

  const pend = levelCell(rowOf(base({ currentTextId: "x", pendingLevel: 1 })));
  assert.equal(pend.text, "4 → 1");
  assert.equal(pend.pending, 1);
  assert.match(pend.title, /väntande nivå 1 gäller från nästa text/);

  // Ej startad elev utan lasresa → klassens startnivå i nivå-kolumnen.
  const notStarted = levelCell(rowOf(null, 1));
  assert.equal(notStarted.text, "1");
  assert.match(notStarted.title, /Har inte börjat – börjar på nivå 1/);
  assert.equal(levelCell(rowOf(null)).text, "4");
});

test("levelCell: väntande nivå lika med nuvarande räknas inte som väntande", () => {
  assert.equal(levelCell(rowOf(base({ currentTextId: "x", pendingLevel: 4 }))).pending, null);
});

test("studentLevelStatus", () => {
  assert.equal(studentLevelStatus(rowOf(base()), base()), "Nästa text hämtas från nivå 4.");
  const open = base({ currentTextId: "x" });
  assert.match(studentLevelStatus(rowOf(open), open), /påbörjad text\. En ny nivå gäller från nästa text/);
  const pend = base({ currentTextId: "x", pendingLevel: 2 });
  assert.match(studentLevelStatus(rowOf(pend), pend), /^Väntande nivå 2: .*sedan gäller nivå 2\./);
  assert.match(studentLevelStatus(rowOf(null, 1), null), /inte börjat Läsresan och börjar på nivå 1/);
});

test("studentSavedText: direkt eller väntande", () => {
  assert.equal(studentSavedText("Astrid", { level: 5, applied: "now" }), "✓ Sparat. Astrids nästa text hämtas från nivå 5.");
  assert.match(studentSavedText("Elias", { level: 2, applied: "pending" }), /Elias läser klart.*väntande nivå 2/);
});

test("classConfirmText visar TYDLIGT klass, antal och nivå", () => {
  const t = classConfirmText({ className: "4B", count: 28, level: 1 });
  assert.deepEqual(t.facts, [
    { label: "Klass", value: "4B" },
    { label: "Antal elever", value: "28 elever" },
    { label: "Ny nivå", value: "Nivå 1" },
  ]);
  assert.match(t.body, /Alla 28 elever i 4B får nivå 1 – även elever som redan är igång/);
  assert.match(t.body, /Resultat, lästa texter, statistik och pluggcoins finns kvar/);
  assert.equal(t.confirm, "Ja, sätt 28 elever till nivå 1");
  assert.equal(classConfirmText({ className: "X", count: 1, level: 7 }).confirm, "Ja, sätt 1 elev till nivå 7");
});

test("classResultText: lyckat, väntande och misslyckade", () => {
  const ok = classResultText({ level: 1, total: 28, updated: 28, now: 28, pending: 0, failed: [] }, "4B");
  assert.deepEqual(ok, { ok: true, lines: ["28 elever i 4B satta till nivå 1."] });

  const mixed = classResultText(
    { level: 2, total: 5, updated: 3, now: 2, pending: 1, failed: [{ studentId: "a" }, { studentId: "b" }] },
    "5A",
    (id) => ({ a: "Ada", b: "Bo" })[id]
  );
  assert.equal(mixed.ok, false);
  assert.deepEqual(mixed.lines, [
    "3 elever i 5A satta till nivå 2.",
    "1 elev läser klart sin påbörjade text först (väntande nivå 2).",
    "Misslyckades för 2 elever: Ada, Bo. Försök igen.",
  ]);
});

test("startSavedText", () => {
  assert.equal(
    startSavedText("4B", 1),
    "✓ Startnivån för 4B är nu nivå 1. Den gäller nya elever och elever som inte har börjat."
  );
});

test("bootgraf: nivåvyn importeras bara från dynamiskt laddade lärarmoduler", () => {
  const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
  // teacher-class.js når Läsresan bara via import() …
  assert.match(src("teacher-class.js"), /await import\("\.\/teacher-lasresan\.js"\)/);
  assert.doesNotMatch(src("teacher-class.js"), /^import .*teacher-lasresan/m);
  // … och Firestore-bryggan för nivåer laddas lat även inne i vyn.
  assert.doesNotMatch(src("teacher-lasresan-niva.js"), /^import .*data-lasresan-niva/m);
  assert.match(src("teacher-lasresan-niva.js"), /import\("\.\/data-lasresan-niva\.js"\)/);
});
