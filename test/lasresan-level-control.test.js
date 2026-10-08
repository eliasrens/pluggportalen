// ============================================================================
// Läsresan (#505): lärarstyrd nivå – level-control.js + progress.js-kroken.
// Enskild elev / hela klassen (withTeacherLevel per elev), pendingLevel vid
// påbörjad text, klassens startnivå för elever som inte börjat, och att inget
// annat fält än nivå/streaks/stämpel ändras. Bryggan (data-lasresan-niva.js)
// kör exakt de här funktionerna i sina transaktioner.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  defaultLasresa, normalizeLasresa, withStartedText, buildAttempt, applyCompletion,
} from "../src/lasresan/progress.js";
import {
  parseTeacherLevel, effectiveStartLevel, classStartLevelOf, hasStartedLasresa,
  applyPendingLevel, withTeacherLevel, LEVEL_SET_BY_TEACHER,
} from "../src/lasresan/level-control.js";
import { teacherClassRows } from "../src/lasresan/teacher-rows.js";
import { pickText } from "../src/lasresan/picker.js";
import { START_LEVEL } from "../src/lasresan/config.js";

function makeText(id, n = 5, level = 3) {
  return {
    id, title: id, level, textType: "story", topic: "t", body: "x",
    questions: Array.from({ length: n }, (_, i) => ({
      id: `q${i + 1}`, question: "?", options: ["a", "b", "c", "d"], answerIndex: 2, category: "fakta",
    })),
  };
}
const answersFor = (text, correct) =>
  text.questions.map((q, i) => ({ qid: q.id, chosen: i < correct ? 2 : 3 }));
function complete(lasresa, text, correct, at = 2000) {
  const attempt = buildAttempt(text, answersFor(text, correct), { startedAt: lasresa.currentStartedAt, completedAt: at });
  return applyCompletion(lasresa, attempt, undefined, at);
}
function finish(lasresa, text, correct, at = 2000) {
  return complete(withStartedText(lasresa, text.id, at - 1).lasresa, text, correct, at);
}

/** En elev mitt i resan: allt som INTE får röras av ett nivåbyte. */
function midJourney() {
  let l = defaultLasresa();
  for (let i = 0; i < 4; i++) l = finish(l, makeText(`t${i}`), i % 2 ? 5 : 3, 1000 + i * 10).lasresa;
  return { ...l, level: 5, highStreak: 2, lowStreak: 0, extra: "okänt fält" };
}
const KEEP = [
  "worldId", "stepInWorld", "completedWorlds", "totalTexts", "totalQuestions", "totalCorrect",
  "totalIncorrect", "moneyEarned", "seenTextIds", "catStats", "lastTextId", "extra",
];
const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));

test("parseTeacherLevel: bara heltal 1–10 (även '4' från <select>)", () => {
  for (const ok of [1, 4, 7, 10, "1", " 7 ", "10"]) assert.equal(parseTeacherLevel(ok), Number(ok));
  for (const bad of [0, 11, -1, 3.5, "3.5", "abc", "", null, undefined, NaN, true, {}, [3]]) {
    assert.equal(parseTeacherLevel(bad), null, String(bad));
  }
});

test("withTeacherLevel avvisar ogiltig nivå (kastar), startnivå normaliseras till 4", () => {
  for (const bad of [0, 11, "x", 2.5]) assert.throws(() => withTeacherLevel(defaultLasresa(), bad), /Ogiltig nivå/);
  assert.equal(effectiveStartLevel(undefined), START_LEVEL);
  assert.equal(effectiveStartLevel(11), START_LEVEL);
  assert.equal(effectiveStartLevel(10), 10);
  assert.equal(effectiveStartLevel("1"), 1);
  assert.equal(classStartLevelOf({ lasresaStartLevel10: 2, lasresaStartLevel: 1 }), 2);
  assert.equal(classStartLevelOf({ lasresaStartLevel: 2 }), 5); // gammal skala (#519)
  assert.equal(classStartLevelOf({}), null);
  assert.equal(classStartLevelOf(null), null);
});

test("enskild elev utan påbörjad text: nivån gäller direkt, streaks 0, inget annat ändras", () => {
  const before = midJourney();
  const { lasresa, applied } = withTeacherLevel(normalizeLasresa(before), 1, 5000);
  assert.equal(applied, "now");
  assert.equal(lasresa.level, 1);
  assert.equal(lasresa.highStreak, 0);
  assert.equal(lasresa.lowStreak, 0);
  assert.equal(lasresa.pendingLevel, null);
  assert.equal(lasresa.levelSetAt, 5000);
  assert.equal(lasresa.levelSetBy, LEVEL_SET_BY_TEACHER);
  assert.deepEqual(pick(lasresa, KEEP), pick(before, KEEP));
  assert.equal(lasresa.currentTextId, null);
  // Nästa text hämtas från nivå 1.
  const bank = [makeText("a", 5, 1), makeText("b", 5, 5)];
  assert.equal(pickText(lasresa.level, lasresa.seenTextIds, bank).id, "a");
});

test("påbörjad text: pendingLevel – texten slutförs på gamla nivån, nivån byts efteråt", () => {
  const before = withStartedText(midJourney(), "pagaende", 3000).lasresa;
  const { lasresa: set, applied } = withTeacherLevel(normalizeLasresa(before), 2, 3500);
  assert.equal(applied, "pending");
  assert.equal(set.level, 5, "nivån orörd medan texten pågår");
  assert.equal(set.highStreak, 2);
  assert.equal(set.pendingLevel, 2);
  assert.equal(set.currentTextId, "pagaende");
  assert.deepEqual(pick(set, KEEP), pick(before, KEEP));

  // Omladdning: normaliseringen behåller pending så länge texten pågår,
  // och den påbörjade texten återupptas (byts inte).
  const reloaded = normalizeLasresa(JSON.parse(JSON.stringify(set)));
  assert.equal(reloaded.level, 5);
  assert.equal(reloaded.pendingLevel, 2);
  assert.equal(withStartedText(reloaded, "annan", 3600).textId, "pagaende");

  // Slutför med 5/5 (hög, highStreak 2 → skulle ge nivå 6) – lärarens nivå vinner.
  const { lasresa: done, levelChanged } = complete(reloaded, makeText("pagaende"), 5, 4000);
  assert.equal(done.level, 2);
  assert.equal(levelChanged, true);
  assert.equal(done.highStreak, 0);
  assert.equal(done.lowStreak, 0);
  assert.equal(done.pendingLevel, null);
  assert.equal(done.currentTextId, null);
  // Resultatet räknades som vanligt.
  assert.equal(done.totalTexts, before.totalTexts + 1);
  assert.equal(done.totalCorrect, before.totalCorrect + 5);
  assert.equal(done.moneyEarned, before.moneyEarned + 15);
  assert.ok(done.seenTextIds.includes("pagaende"));
  assert.equal(done.stepInWorld, before.stepInWorld + 1);
});

test("progressionen fortsätter automatiskt från lärarens nivå", () => {
  let l = withTeacherLevel(normalizeLasresa(midJourney()), 1).lasresa;
  for (const id of ["u1", "u2"]) l = finish(l, makeText(id, 5, 1), 5).lasresa;
  assert.equal(l.level, 1, "2 höga i rad räcker inte");
  l = finish(l, makeText("u3", 5, 1), 5).lasresa;
  assert.equal(l.level, 2, "3 höga i rad → +1 från lärarens nivå");
  l = withTeacherLevel(l, 7).lasresa;
  l = finish(l, makeText("u4", 5, 7), 0).lasresa;
  l = finish(l, makeText("u5", 5, 7), 0).lasresa;
  assert.equal(l.level, 6, "2 låga i rad → −1");
});

test("pendingLevel utan påbörjad text läggs på plats (race/force-byte)", () => {
  const stale = { ...normalizeLasresa(midJourney()), pendingLevel: 1 };
  const n = normalizeLasresa(stale);
  assert.equal(n.level, 1);
  assert.equal(n.pendingLevel, null);
  assert.equal(n.highStreak, 0);
  // force-byte (påbörjad text borta ur banken) → den nya texten på lärarnivån.
  const active = { ...withStartedText(midJourney(), "borta", 10).lasresa, pendingLevel: 3 };
  const forced = withStartedText(normalizeLasresa(active), "ny", 20, { force: true });
  assert.equal(forced.textId, "ny");
  assert.equal(forced.lasresa.level, 3);
  assert.equal(forced.lasresa.pendingLevel, null);
  assert.equal(applyPendingLevel(null), null);
  assert.equal(normalizeLasresa({ ...stale, pendingLevel: 9 }).pendingLevel, null, "ogiltig pending rensas");
});

test("hela klassen = samma semantik per elev (blandat igång/ej igång/pågående)", () => {
  const klass = [
    undefined,
    midJourney(),
    withStartedText(midJourney(), "x", 1).lasresa,
    { ...midJourney(), level: 7 },
  ];
  const res = klass.map((raw) => withTeacherLevel(normalizeLasresa(raw), "1", 99));
  assert.deepEqual(res.map((r) => r.applied), ["now", "now", "pending", "now"]);
  assert.deepEqual(res.map((r) => (r.applied === "now" ? r.lasresa.level : r.lasresa.pendingLevel)), [1, 1, 1, 1]);
  // Efteråt kan en enskild elev ändras igen.
  assert.equal(withTeacherLevel(res[1].lasresa, 4).lasresa.level, 4);
});

test("klassens startnivå: ej börjad/ny elev får den, igång-elev påverkas inte", () => {
  const ny = normalizeLasresa(undefined, undefined, { startLevel: 1 });
  assert.equal(ny.level, 1);
  assert.deepEqual(ny, defaultLasresa(undefined, 1));
  assert.equal(normalizeLasresa(null, undefined, { startLevel: "x" }).level, START_LEVEL);
  assert.equal(normalizeLasresa(undefined).level, START_LEVEL);
  // Första texten sparas på startnivån (startText kör detta i transaktionen).
  const first = withStartedText(normalizeLasresa(undefined, undefined, { startLevel: 6 }), "t", 1).lasresa;
  assert.equal(first.level, 6);
  // Igång: startnivån ignoreras – både lagrad nivå och efter omladdning.
  const igang = midJourney();
  assert.equal(normalizeLasresa(igang, undefined, { startLevel: 1 }).level, 5);
  assert.equal(normalizeLasresa(JSON.parse(JSON.stringify(first)), undefined, { startLevel: 2 }).level, 6);
});

test("individuell lärarnivå vinner över klassens startnivå (även innan eleven börjat)", () => {
  const set = withTeacherLevel(normalizeLasresa(undefined, undefined, { startLevel: 1 }), 4).lasresa;
  const stored = JSON.parse(JSON.stringify(set));
  assert.equal(hasStartedLasresa(stored), false);
  assert.equal(normalizeLasresa(stored, undefined, { startLevel: 1 }).level, 4);
  assert.equal(withStartedText(normalizeLasresa(stored, undefined, { startLevel: 2 }), "t", 1).lasresa.level, 4);
});

test("hasStartedLasresa: exakt definition", () => {
  assert.equal(hasStartedLasresa(undefined), false);
  assert.equal(hasStartedLasresa(null), false);
  assert.equal(hasStartedLasresa(defaultLasresa()), false);
  assert.equal(hasStartedLasresa({ ...defaultLasresa(), currentTextId: "t" }), true);
  assert.equal(hasStartedLasresa({ ...defaultLasresa(), totalTexts: 1 }), true);
  assert.equal(hasStartedLasresa({ ...defaultLasresa(), seenTextIds: ["t"] }), true);
});

test("lärartabellen: klassens startnivå för ej börjat, lärarnivå + pendingLevel syns", () => {
  const teacherOnly = withTeacherLevel(defaultLasresa(), 6).lasresa;
  const active = withTeacherLevel(normalizeLasresa(withStartedText(midJourney(), "x", 1).lasresa), 2).lasresa;
  const rows = teacherClassRows(
    [
      { studentId: "a", namn: "A", lasresa: null },
      { studentId: "b", namn: "B", lasresa: teacherOnly },
      { studentId: "c", namn: "C", lasresa: active },
    ],
    undefined,
    { startLevel: 1 }
  );
  const by = Object.fromEntries(rows.map((r) => [r.studentId, r]));
  assert.deepEqual([by.a.started, by.a.level, by.a.pendingLevel], [false, 1, null]);
  assert.deepEqual([by.b.started, by.b.level, by.b.pendingLevel], [false, 6, null]);
  assert.deepEqual([by.c.started, by.c.level, by.c.pendingLevel], [true, 5, 2]);
  // Utan startnivå: som förut (3).
  assert.equal(teacherClassRows([{ studentId: "a", lasresa: null }])[0].level, START_LEVEL);
});

test("bryggan laddas inte statiskt från app.js (bootgrafen)", () => {
  const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  assert.ok(!/from\s+["'][^"']*data-lasresan-niva\.js["']/.test(app));
  assert.ok(!/from\s+["'][^"']*level-control\.js["']/.test(app));
});
