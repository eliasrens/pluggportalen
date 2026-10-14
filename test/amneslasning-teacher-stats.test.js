// Ämnesläsning D (#674): lärarstatistiken. Spec docs/UTVECKLINGSUPPDRAG_AMNESLASNING.md
// §8 + §10 test 22–24: källfiltret Alla / Läsresan / Ämnesläsning i Läsresans
// klasstabell och ämnesläsningen per elev i Per område.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyAmnesCompletion, buildAmnesAttempt, normalizeAmneslasning, withStartedAmnesText,
} from "../src/amneslasning/progress.js";
import { amnesAreaRows, availableAmnesTexts, summarizeAmnesRows } from "../src/amneslasning/teacher-stats.js";
import { normalizeLasresa, buildAttempt, applyCompletion, withStartedText } from "../src/lasresan/progress.js";
import { attemptSourceKey, filterAttempts, totalsForSource } from "../src/lasresan/stats.js";
import { teacherClassRows } from "../src/lasresan/teacher-rows.js";

function text(id, n = 4, level = 2, cats = ["fakta", "mellan_raderna"]) {
  return {
    id, title: `Text ${id}`, level, textType: "fact", body: "x",
    questions: Array.from({ length: n }, (_, i) => ({
      id: `q${i + 1}`, question: "?", options: ["a", "b", "c", "d"], answerIndex: 1, category: cats[i % cats.length],
    })),
  };
}
const answers = (t, correct) => t.questions.map((q, i) => ({ qid: q.id, chosen: i < correct ? q.answerIndex : 0 }));

/** Elev som läser ämnestexter: [{areaId, text, correct}] → { lasresa, amneslasning, attempts }. */
function readAmnes(state, reads) {
  let { lasresa, amneslasning } = state;
  const attempts = [];
  let now = 1000;
  for (const r of reads) {
    now += 100;
    const started = withStartedAmnesText(amneslasning, { subjectId: "so", areaId: r.areaId, textId: r.text.id }, now - 10).amneslasning;
    const a = buildAmnesAttempt(r.text, answers(r.text, r.correct), { subjectId: "so", areaId: r.areaId, completedAt: now });
    const out = applyAmnesCompletion({ lasresa, amneslasning: started }, a, now);
    lasresa = out.lasresa;
    amneslasning = out.amneslasning;
    attempts.push(a);
  }
  return { lasresa, amneslasning, attempts };
}

/** Elev som läser en Läsresan-text. */
function readLasresan(lasresa, t, correct) {
  const started = withStartedText(lasresa, t.id, 50).lasresa;
  const a = buildAttempt({ ...t, level: 5 }, answers(t, correct), { completedAt: 60 });
  return { lasresa: applyCompletion(started, a, undefined, 60).lasresa, attempt: a };
}

test("Test 22: ämnesförsöket har source/areaId/nivåer och räknas in i Läsresans tabell med filter", () => {
  const lr = readLasresan(normalizeLasresa(undefined), text("L1", 5), 4).lasresa;
  assert.equal(lr.totalTexts, 1);
  const { lasresa, amneslasning, attempts } = readAmnes({ lasresa: lr, amneslasning: undefined }, [
    { areaId: "vikingar", text: text("v1", 4), correct: 4 },
    { areaId: "vikingar", text: text("v2", 4), correct: 2 },
  ]);
  assert.equal(attempts[0].source, "amnesläsning");
  assert.equal(attempts[0].areaId, "vikingar");
  assert.equal(attempts[0].amnesLevel, 2);
  assert.ok(Number.isFinite(attempts[0].textLevel));
  // Läsresans totaler rörs inte av ämnestexter …
  assert.equal(lasresa.totalTexts, 1);
  // … men tabellen räknar in dem enligt filtret.
  const entry = { studentId: "e1", namn: "Ada", lasresa, amnesTotals: amneslasning.totals };
  const [alla] = teacherClassRows([entry], undefined, { source: "alla" });
  const [resan] = teacherClassRows([entry], undefined, { source: "lasresan" });
  const [amnes] = teacherClassRows([entry], undefined, { source: "amnes" });
  assert.deepEqual([alla.texts, alla.questions, alla.correct, alla.incorrect], [3, 13, 10, 3]);
  assert.deepEqual([resan.texts, resan.questions, resan.correct], [1, 5, 4]);
  assert.deepEqual([amnes.texts, amnes.questions, amnes.correct, amnes.pct], [2, 8, 6, 75]);
  // Nivå/värld/steg är alltid Läsresans resa.
  for (const r of [alla, amnes]) {
    assert.equal(r.level, resan.level);
    assert.equal(r.worldId, resan.worldId);
    assert.equal(r.stepInWorld, resan.stepInWorld);
  }
  // Kategorierna summeras (Alla = Läsresan + Ämnes).
  const cats = totalsForSource(lasresa, amneslasning.totals, "alla").catStats;
  const q = Object.values(cats).reduce((s, c) => s + c.q, 0);
  assert.equal(q, 13);
});

test("Test 22: 'ej börjat' följer filtret; elev som bara läst ämnestexter", () => {
  const { lasresa, amneslasning } = readAmnes({ lasresa: normalizeLasresa(undefined), amneslasning: undefined }, [
    { areaId: "vikingar", text: text("v1"), correct: 3 },
  ]);
  const entry = { studentId: "e1", lasresa, amnesTotals: amneslasning.totals };
  assert.equal(teacherClassRows([entry], undefined, { source: "alla" })[0].started, true);
  assert.equal(teacherClassRows([entry], undefined, { source: "amnes" })[0].started, true);
  const resan = teacherClassRows([entry], undefined, { source: "lasresan" })[0];
  assert.equal(resan.started, false);
  assert.equal(resan.pct, null);
  assert.equal(resan.stepInWorld, 0);
});

test("Test 24: filtret 'Läsresan' utan ämnesförsök = exakt samma rader som före #674", () => {
  let lr = normalizeLasresa(undefined);
  lr = readLasresan(lr, text("L1", 5), 5).lasresa;
  lr = readLasresan(lr, text("L2", 5), 2).lasresa;
  const entries = [
    { studentId: "a", namn: "A", lasresa: lr },
    { studentId: "b", namn: "B", lasresa: null },
    { studentId: "c", namn: "C", lasresa: { level10: 6, pendingLevel10: 7 } },
  ];
  const before = teacherClassRows(entries, undefined, { startLevel: 5 }); // inget filter = "alla"
  const resan = teacherClassRows(entries.map((e) => ({ ...e, amnesTotals: null })), undefined, { startLevel: 5, source: "lasresan" });
  assert.deepEqual(resan, before);
  // Även med ämnesdata ändras inte Läsresan-filtret.
  const withAmnes = teacherClassRows(
    entries.map((e) => ({ ...e, amnesTotals: { totalTexts: 3, totalQuestions: 12, totalCorrect: 9, totalIncorrect: 3 } })),
    undefined, { startLevel: 5, source: "lasresan" }
  );
  assert.deepEqual(withAmnes, before);
});

test("försök filtreras på källa; gamla utan source = Läsresan", () => {
  const list = [{ textId: "a" }, { textId: "b", source: "amnesläsning" }, { textId: "c", source: "lasresan" }, null];
  assert.deepEqual(filterAttempts(list, "lasresan").map((a) => a.textId), ["a", "c"]);
  assert.deepEqual(filterAttempts(list, "amnes").map((a) => a.textId), ["b"]);
  assert.equal(filterAttempts(list, "alla").length, 3);
  assert.equal(filterAttempts(list, "skräp").length, 3);
  assert.equal(attemptSourceKey({}), "lasresan");
  assert.equal(totalsForSource(null, null, "alla"), null);
  assert.equal(totalsForSource(null, { totalTexts: 0 }, "amnes"), null);
});

test("Test 23: områdets lärarvy – lästa texter, andel rätt och kategorier per elev", () => {
  const vikingar = { id: "vikingar", readingTexts: [text("v1"), text("v2"), text("v3"), { id: "gammal", levels: {} }] };
  const egypten = { id: "egypten", readingTexts: [text("e1")] };
  const { amneslasning } = readAmnes({ lasresa: normalizeLasresa(undefined), amneslasning: undefined }, [
    { areaId: "vikingar", text: text("v1"), correct: 4 },
    { areaId: "vikingar", text: text("v1"), correct: 2 }, // omläsning
    { areaId: "vikingar", text: text("v2"), correct: 3 },
    { areaId: "egypten", text: text("e1"), correct: 0 },
  ]);
  const entries = [
    { studentId: "a", namn: "Ada", amneslasning },
    { studentId: "b", namn: "Bo", amneslasning: undefined },
  ];
  assert.equal(availableAmnesTexts([vikingar]), 3);
  const [ada, bo] = amnesAreaRows(entries, [vikingar]);
  assert.deepEqual([ada.active, ada.read, ada.available, ada.readings, ada.questions, ada.correct, ada.pct], [true, 2, 3, 3, 12, 9, 75]);
  const fakta = ada.perCategory.find((c) => c.category === "fakta");
  const mellan = ada.perCategory.find((c) => c.category === "mellan_raderna");
  assert.equal(fakta.q + mellan.q, 12);
  assert.equal(fakta.correct + mellan.correct, 9);
  assert.equal(ada.hasCategoryData, true);
  assert.deepEqual([bo.active, bo.read, bo.pct, bo.hasCategoryData], [false, 0, null, false]);
  // Hela ämnet = båda områdena.
  const [adaAll] = amnesAreaRows(entries, [vikingar, egypten]);
  assert.deepEqual([adaAll.read, adaAll.available, adaAll.readings, adaAll.questions, adaAll.correct], [3, 4, 4, 16, 9]);
  const sum = summarizeAmnesRows(amnesAreaRows(entries, [vikingar]));
  assert.deepEqual([sum.students, sum.activeStudents, sum.readings, sum.pct], [2, 1, 3, 75]);
  // Lagrat utan totals (skräp) kraschar inte.
  assert.equal(amnesAreaRows([{ studentId: "x", amneslasning: normalizeAmneslasning({ areas: { vikingar: { read: { v1: { count: 1 } } } } }) }], [vikingar])[0].read, 1);
});
