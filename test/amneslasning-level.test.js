// ============================================================================
// Ämnesläsning (#671): nivå – ämnesnivå-mappning och den DELADE läsnivån med
// Läsresan (tak 7 uppåt, samma streaks). Spec docs/UTVECKLINGSUPPDRAG_AMNESLASNING.md
// §10 test 1–9.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { amnesLevelFor, amnesLevelOf, readingLevelOf, readingLevelForAmnes, applyAmnesLevel } from "../src/amneslasning/level.js";
import { buildAmnesAttempt, applyAmnesCompletion, withStartedAmnesText } from "../src/amneslasning/progress.js";
import { AMNES_LEVEL_CAP, START_LEVEL } from "../src/lasresan/config.js";
import { applyCompletion, buildAttempt, normalizeLasresa, withStartedText } from "../src/lasresan/progress.js";
import { classStartLevelFields, readClassStartLevel, toStoredLasresa } from "../src/lasresan/level-scale.js";
import { withTeacherLevel } from "../src/lasresan/level-control.js";

/** Ämnestext med n frågor (rätt svar = index 1). */
function amnesText(id, n = 5, level = 2) {
  const cats = ["fakta", "ordforstaelse", "mellan_raderna", "helhet_slutsats"];
  return {
    id, title: `Ämnestext ${id}`, level, textType: "fact", body: "x",
    questions: Array.from({ length: n }, (_, i) => ({
      id: `q${i + 1}`, question: "?", options: ["a", "b", "c", "d"], answerIndex: 1, category: cats[i % 4],
    })),
  };
}
const answersFor = (text, correct) =>
  text.questions.map((q, i) => ({ qid: q.id, chosen: i < correct ? q.answerIndex : (q.answerIndex + 1) % 4 }));

/** Läs en ämnestext klart i området "vikingar" och lagra som bryggan gör. */
function readAmnes(state, text, correct, now = 2000) {
  const ctx = { subjectId: "so", areaId: "vikingar", textId: text.id };
  const started = withStartedAmnesText(state.amneslasning, ctx, now - 1000).amneslasning;
  const attempt = buildAmnesAttempt(text, answersFor(text, correct), { ...ctx, startedAt: now - 1000, completedAt: now });
  const out = applyAmnesCompletion({ lasresa: normalizeLasresa(state.lasresa), amneslasning: started }, attempt, now);
  return { ...out, attempt, stored: toStoredLasresa(out.lasresa) };
}
/** Läs n ämnestexter med `correct` av 5 rätt. */
function readMany(lasresa, n, correct) {
  let state = { lasresa, amneslasning: undefined };
  for (let i = 0; i < n; i++) state = readAmnes(state, amnesText(`t${i}`), correct, 2000 + i);
  return state;
}
/** Elev på läsnivå `level` (normaliserad) via lärarens nivåbyte. */
const atLevel = (level) => withTeacherLevel(normalizeLasresa(undefined), level, 1).lasresa;

test("Test 1: läsnivå 1,2,3,4,5,6,7,10 → ämnesnivå 1,1,2,2,3,3,3,3", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 10].map(amnesLevelFor), [1, 1, 2, 2, 3, 3, 3, 3]);
  assert.deepEqual([8, 9].map(amnesLevelFor), [3, 3]);
  // Ämnestextens motsvarande läsnivå (försökets textLevel).
  assert.deepEqual([1, 2, 3].map(readingLevelForAmnes), [2, 4, 6]);
});

test("Test 2: elev utan Läsresan-historik → klassens startnivå (annars 4) → ämnesnivå 2", () => {
  assert.equal(START_LEVEL, 4);
  assert.equal(readingLevelOf(undefined), 4);
  assert.equal(amnesLevelOf(undefined), 2);
  // Klassens startnivå (lasresaStartLevel10 + spegel) styr elev som inte börjat.
  const cls = classStartLevelFields(2);
  assert.equal(amnesLevelOf(undefined, { startLevel: readClassStartLevel(cls) }), 1);
  assert.equal(amnesLevelOf(undefined, { startLevel: readClassStartLevel(classStartLevelFields(6)) }), 3);
  // …men inte en elev som redan har en egen nivå.
  assert.equal(amnesLevelOf(toStoredLasresa(atLevel(5)), { startLevel: 1 }), 3);
  // Gammal lagrad nivå (utan level10) läses som Läsresan: gammal 1 → 4.
  assert.equal(readingLevelOf({ level: 1 }), 4);
});

test("Test 3: tre ämnestexter i rad med ≥ 70 % → läsnivån +1", () => {
  const s = readMany(atLevel(4), 3, 4); // 4/5 = 80 %
  assert.equal(s.lasresa.level, 5);
  assert.equal(s.lasresa.highStreak, 0);
  // Exakt 70 % räknas som högt, som i Läsresan.
  let st = { lasresa: atLevel(4) };
  for (let i = 0; i < 3; i++) st = readAmnes(st, amnesText(`s${i}`, 10), 7);
  assert.equal(st.lasresa.level, 5);
});

test("Test 4: två ämnestexter i rad med < 50 % → läsnivån −1", () => {
  const one = readMany(atLevel(4), 1, 2); // 40 %
  assert.equal(one.lasresa.level, 4);
  assert.equal(one.lasresa.lowStreak, 1);
  assert.equal(readMany(atLevel(4), 2, 2).lasresa.level, 3);
});

test("Test 5: en hög text i Läsresan + två höga ämnestexter → nivå upp (gemensam streak)", () => {
  const lr = { ...amnesText("lr-n4-x", 5, 4), textType: "story" };
  const started = withStartedText(atLevel(4), lr.id, 1000).lasresa;
  const attempt = buildAttempt(lr, answersFor(lr, 5), { startedAt: 1000, completedAt: 1500 });
  const afterLr = applyCompletion(started, attempt, undefined, 1500).lasresa;
  assert.equal(afterLr.highStreak, 1);
  // Lagrad och läst tillbaka som bryggan gör – streaken följer med.
  const s1 = readAmnes({ lasresa: toStoredLasresa(afterLr) }, amnesText("a1"), 5, 2000);
  assert.equal(s1.lasresa.highStreak, 2);
  assert.equal(s1.lasresa.level, 4);
  const s2 = readAmnes({ lasresa: s1.stored, amneslasning: s1.amneslasning }, amnesText("a2"), 4, 3000);
  assert.equal(s2.lasresa.level, 5);
  assert.equal(s2.levelChanged, true);
  // Och omvänt: en låg ämnestext bryter en hög Läsresan-streak.
  const low = readAmnes({ lasresa: toStoredLasresa(afterLr) }, amnesText("a3"), 1, 2000);
  assert.equal(low.lasresa.highStreak, 0);
  assert.equal(low.lasresa.lowStreak, 1);
});

test("Test 6: elev på läsnivå 7 läser tre höga ämnestexter → stannar på 7 (taket)", () => {
  assert.equal(AMNES_LEVEL_CAP, 7);
  const s = readMany(atLevel(7), 3, 5);
  assert.equal(s.lasresa.level, 7);
  assert.equal(s.lasresa.highStreak, 0, "streaken nollas vid taket, som vid nivå 10 i Läsresan");
  assert.equal(s.levelChanged, false);
  // Från 6 går det upp till 7 men inte längre.
  assert.equal(readMany(atLevel(6), 3, 5).lasresa.level, 7);
  assert.equal(readMany(atLevel(6), 6, 5).lasresa.level, 7);
  // En elev ÖVER taket (nivå 9 via Läsresan) sänks inte av höga ämnestexter.
  assert.equal(readMany(atLevel(9), 3, 5).lasresa.level, 9);
  // Läsresan själv har fortfarande inget tak under 10.
  const lr = { ...amnesText("lr-n7-x", 5, 7) };
  let l = atLevel(7);
  for (let i = 0; i < 3; i++) {
    const st = withStartedText(l, `${lr.id}${i}`, 1000).lasresa;
    l = applyCompletion(st, buildAttempt({ ...lr, id: `${lr.id}${i}` }, answersFor(lr, 5), {}), undefined, 2000).lasresa;
  }
  assert.equal(l.level, 8);
});

test("Test 7: elev på läsnivå 9 läser två låga ämnestexter → nivå 8 (nedåt fungerar)", () => {
  const s = readMany(atLevel(9), 2, 1);
  assert.equal(s.lasresa.level, 8);
  assert.equal(s.levelChanged, true);
  assert.equal(readMany(atLevel(2), 4, 0).lasresa.level, 1, "golvet är 1 som i Läsresan");
});

test("Test 8: en ämnestext flyttar aldrig avataren i Läsresan", () => {
  // Elev mitt i resan med en påbörjad Läsresan-text.
  const mid = { ...atLevel(5), worldId: "skogen", stepInWorld: 7, seenTextIds: ["lr-n5-a"], totalTexts: 7, totalQuestions: 40, totalCorrect: 30, totalIncorrect: 10, moneyEarned: 90, catStats: { fakta: { q: 10, correct: 8 } } };
  const lasresa = withStartedText(mid, "lr-n5-b", 500).lasresa;
  const s = readMany(toStoredLasresa(lasresa), 3, 5);
  for (const k of ["worldId", "stepInWorld", "completedWorlds", "seenTextIds", "currentTextId", "currentStartedAt", "lastTextId", "totalTexts", "totalQuestions", "totalCorrect", "totalIncorrect", "moneyEarned", "catStats"]) {
    assert.deepEqual(s.lasresa[k], lasresa[k], k);
  }
  // Ämnestexterna hamnar i ämnesläsningens egen läst-lista per område, med tidpunkt.
  assert.deepEqual(Object.keys(s.amneslasning.areas.vikingar.read).sort(), ["t0", "t1", "t2"]);
  assert.equal(s.amneslasning.areas.vikingar.read.t2.lastAt, 2002);
  // Ny elev: objektet skapas på startnivån men står kvar före steg 1.
  const fresh = readAmnes({ lasresa: undefined }, amnesText("n1"), 5);
  assert.equal(fresh.lasresa.stepInWorld, 0);
  assert.deepEqual(fresh.lasresa.seenTextIds, []);
  assert.equal(fresh.lasresa.totalTexts, 0);
});

test("Test 9: nivålagringen – level10 + spegel som när Läsresan ändrar nivån", () => {
  const s = readMany(toStoredLasresa(atLevel(4)), 3, 5);
  assert.equal(s.stored.level10, 5);
  assert.equal(s.stored.level, 2, "spegeln i gammal skala = ny − 3");
  assert.equal(s.stored.levelScale, undefined);
  // Exakt samma lagrade nivåfält som när Läsresan höjer från 4 till 5.
  let l = atLevel(4);
  for (let i = 0; i < 3; i++) {
    const t = { ...amnesText(`lr-n4-${i}`, 5, 4) };
    const st = withStartedText(l, t.id, 1000).lasresa;
    l = applyCompletion(st, buildAttempt(t, answersFor(t, 5), {}), undefined, 2000).lasresa;
  }
  const lr = toStoredLasresa(l);
  for (const k of ["level", "level10", "pendingLevel", "pendingLevel10", "highStreak", "lowStreak"]) {
    assert.equal(s.stored[k], lr[k], k);
  }
  // Nivå 1–3 speglas som 1 (gamla klienter), läses tillbaka som ny skala.
  const down = readMany(toStoredLasresa(atLevel(3)), 2, 0);
  assert.equal(down.stored.level10, 2);
  assert.equal(down.stored.level, 1);
  assert.equal(normalizeLasresa(down.stored).level, 2);
  // En väntande lärarnivå (påbörjad Läsresan-text) ligger kvar orörd i båda fälten.
  const busy = withStartedText(atLevel(5), "lr-n5-x", 1).lasresa;
  const pend = withTeacherLevel(busy, 8, 2).lasresa;
  const p = readAmnes({ lasresa: toStoredLasresa(pend) }, amnesText("p1"), 5);
  assert.equal(p.stored.pendingLevel10, 8);
  assert.equal(p.stored.pendingLevel, 5);
});

test("applyAmnesLevel rör bara level/streaks/updatedAt", () => {
  const before = atLevel(4);
  const { lasresa } = applyAmnesLevel(before, { correct: 5, total: 5 }, 99);
  const strip = ({ highStreak, updatedAt, ...rest }) => rest; // eslint-disable-line no-unused-vars
  assert.deepEqual(strip(lasresa), strip(before));
  assert.equal(lasresa.highStreak, 1);
  assert.equal(lasresa.updatedAt, 99);
});
