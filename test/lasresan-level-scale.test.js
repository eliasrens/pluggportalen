// ============================================================================
// Läsresan 10 nivåer B (#519, epic #516): lat migrering 1–7 → 1–10 (+3).
// level-scale.js + normalizeLasresa/applyCompletion/withTeacherLevel ovanpå:
//   * gammal elevdata (utan level10) flyttas +3 vid läsning, allt annat orört
//   * idempotent: minnesform och ny lagringsform får aldrig +3 igen
//   * gamla cachade klienter (klampar level till 1–7, sprider ...raw) kan inte
//     korrumpera ny-skala-data – deras ändringar läses i stället som gammal skala
//   * klassens startnivå och försökens textLevel på samma sätt
//   * progressionen 1↔2 och 9↔10 med golv/tak
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LEVEL_SCALE,
  readStoredLevels,
  toStoredLasresa,
  toLegacyLevel,
  readClassStartLevel,
  classStartLevelFields,
  attemptTextLevel,
  normalizeAttempt,
} from "../src/lasresan/level-scale.js";
import { normalizeLasresa, applyCompletion, buildAttempt, withStartedText } from "../src/lasresan/progress.js";
import { withTeacherLevel, classStartLevelOf, effectiveStartLevel } from "../src/lasresan/level-control.js";
import { applyResult } from "../src/lasresan/level.js";
import { teacherClassRows } from "../src/lasresan/teacher-rows.js";

/** En elev som lagrades INNAN epic #516 (gammal skala, inga nya fält). */
const legacyStudent = (over = {}) => ({
  level: 3, highStreak: 2, lowStreak: 0,
  worldId: "oknen", stepInWorld: 7, completedWorlds: ["skogen"],
  totalTexts: 27, totalQuestions: 160, totalCorrect: 120, totalIncorrect: 40, moneyEarned: 360,
  seenTextIds: ["lr-n1-katten-i-regnet", "lr-n3-x", "lr-n2-y"],
  catStats: { fakta: { q: 40, correct: 30 }, ordforstaelse: { q: 40, correct: 31 } },
  currentTextId: null, currentStartedAt: null, lastTextId: "lr-n2-y", updatedAt: 99,
  pendingLevel: null, levelSetAt: null, levelSetBy: null,
  framtidaFalt: "kvar",
  ...over,
});

/** Allt som INTE är nivå ska vara orört efter migreringen. */
const UNTOUCHED = [
  "highStreak", "lowStreak", "worldId", "stepInWorld", "completedWorlds", "totalTexts", "totalQuestions",
  "totalCorrect", "totalIncorrect", "moneyEarned", "seenTextIds", "catStats", "lastTextId", "framtidaFalt",
];

/**
 * En GAMMAL klient (före #519, LEVEL_MAX 7): normalizeLasresa klampade level
 * till 1–7, tolkade pendingLevel strikt 1–7 och spred okända fält (...raw).
 * `change` = vad den gamla klienten sedan gör med sitt tillstånd.
 */
function oldClientWrite(stored, change = (x) => x) {
  const clamp7 = (v) => Math.min(7, Math.max(1, Math.round(Number(v)) || 3));
  const p = Number.isInteger(stored.pendingLevel) && stored.pendingLevel >= 1 && stored.pendingLevel <= 7
    ? stored.pendingLevel : null;
  let cur = { ...stored, level: clamp7(stored.level), pendingLevel: p };
  if (!cur.currentTextId && cur.pendingLevel != null) cur = { ...cur, level: cur.pendingLevel, pendingLevel: null };
  return change(cur);
}

const stored = (lasresa) => toStoredLasresa(lasresa);

test("migrering: gammal nivå 1/3/7 → 4/6/10, inget annat ändras", () => {
  for (const [old, ny] of [[1, 4], [3, 6], [7, 10]]) {
    const raw = legacyStudent({ level: old });
    const l = normalizeLasresa(raw);
    assert.equal(l.level, ny, `gammal ${old}`);
    assert.equal(l.levelScale, LEVEL_SCALE);
    for (const k of UNTOUCHED) assert.deepEqual(l[k], raw[k], k);
  }
});

test("migrering: väntande lärarnivå gammal 2 → 5 (påbörjad text), lärarsatt nivå +3", () => {
  const l = normalizeLasresa(legacyStudent({ level: 4, currentTextId: "lr-n4-a", pendingLevel: 2, levelSetBy: "teacher", levelSetAt: 5 }));
  assert.equal(l.level, 7);
  assert.equal(l.pendingLevel, 5);
  assert.equal(l.levelSetBy, "teacher");
  // Utan påbörjad text läggs den väntande nivån på plats direkt – på nya skalan.
  const done = normalizeLasresa(legacyStudent({ level: 4, pendingLevel: 2 }));
  assert.equal(done.level, 5);
  assert.equal(done.pendingLevel, null);
});

test("migrering: ny elev → 4; klassens startnivå (ny skala) används som den är", () => {
  assert.equal(normalizeLasresa(undefined).level, 4);
  assert.equal(normalizeLasresa(null, undefined, { startLevel: 2 }).level, 2);
  assert.equal(normalizeLasresa({}).level, 4); // objekt utan nivå → startnivå, inte +3
  assert.equal(stored(normalizeLasresa(undefined)).level10, 4);
});

test("idempotens: minnesform och ny lagringsform får aldrig +3 igen", () => {
  const once = normalizeLasresa(legacyStudent({ level: 5, currentTextId: "t", pendingLevel: 1 }));
  assert.equal(once.level, 8);
  assert.deepEqual(normalizeLasresa(once), once);
  assert.deepEqual(normalizeLasresa(normalizeLasresa(once)), once);
  // Spara → läs → spara → läs: samma.
  const s1 = stored(once);
  assert.deepEqual(normalizeLasresa(s1), once);
  assert.deepEqual(stored(normalizeLasresa(s1)), s1);
  // Lagringsformen bär inte minnesmarkören, minnesformen inte lagringsfälten.
  assert.equal("levelScale" in s1, false);
  assert.equal("level10" in once, false);
});

test("lagringsform: ny skala i level10/pendingLevel10, gammal skala som spegel", () => {
  const s = stored({ ...normalizeLasresa(undefined), level: 9, currentTextId: "t", pendingLevel: 2 });
  assert.equal(s.level10, 9);
  assert.equal(s.level, 6);
  assert.equal(s.pendingLevel10, 2);
  assert.equal(s.pendingLevel, 1);
  assert.deepEqual([1, 2, 3, 4, 7, 10].map(toLegacyLevel), [1, 1, 1, 1, 4, 7]);
  // Rå lagrad/gammal data får inte skrivas utan att normaliseras först.
  assert.throws(() => toStoredLasresa(legacyStudent()), /normaliserat/);
  assert.throws(() => toStoredLasresa(s), /normaliserat/);
});

test("gammal klient: läser + skriver tillbaka orört → nivå 8–10 överlever (klampas inte)", () => {
  for (const lvl of [1, 2, 4, 8, 9, 10]) {
    const s = stored({ ...normalizeLasresa(undefined), level: lvl });
    assert.equal(normalizeLasresa(oldClientWrite(s)).level, lvl, `nivå ${lvl}`);
  }
});

test("gammal klient: dess progression/lärarbyte läses som gammal skala (+3)", () => {
  const s = stored({ ...normalizeLasresa(undefined), level: 9 }); // spegel 6
  // Progression upp: 6 → 7 i gammal skala = 9 → 10.
  assert.equal(normalizeLasresa(oldClientWrite(s, (c) => ({ ...c, level: 7 }))).level, 10);
  // Progression ner: 6 → 5 = 9 → 8.
  assert.equal(normalizeLasresa(oldClientWrite(s, (c) => ({ ...c, level: 5 }))).level, 8);
  // Gammal lärarvy sätter nivå 2 (= ny 5).
  assert.equal(normalizeLasresa(oldClientWrite(s, (c) => ({ ...c, level: 2 }))).level, 5);
  // Gammal lärarvy sätter väntande nivå 4 under påbörjad text (= ny 7).
  const open = stored({ ...normalizeLasresa(undefined), level: 9, currentTextId: "t" });
  const l = normalizeLasresa(oldClientWrite(open, (c) => ({ ...c, pendingLevel: 4 })));
  assert.equal(l.level, 9);
  assert.equal(l.pendingLevel, 7);
});

test("gammal klient lägger NY väntande nivå på plats → den nya nivån gäller (även 1–3)", () => {
  const s = stored({ ...normalizeLasresa(undefined), level: 8, currentTextId: "t", pendingLevel: 2 }); // spegel 5 / 1
  // Gamla klienten slutför texten: nivån blir pending-spegeln (1), pending rensas.
  const after = oldClientWrite(s, (c) => ({ ...c, currentTextId: null, level: c.pendingLevel, pendingLevel: null }));
  const l = normalizeLasresa(after);
  assert.equal(l.level, 2);
  assert.equal(l.pendingLevel, null);
});

test("lärarens nivåbyte på gammal data: sparas på nya skalan, resten orört", () => {
  const cur = normalizeLasresa(legacyStudent({ level: 2 }));
  const { lasresa } = withTeacherLevel(cur, 10, 7);
  const s = stored(lasresa);
  assert.equal(s.level10, 10);
  assert.equal(s.level, 7);
  for (const k of UNTOUCHED.filter((k) => !k.endsWith("Streak"))) assert.deepEqual(s[k], legacyStudent()[k], k);
  assert.equal(normalizeLasresa(s).level, 10);
});

test("applyCompletion på gammal data: räknar på nya skalan och behåller totaler", () => {
  const text = { id: "lr-n7-z", title: "Z", level: 10, textType: "fact", questions: [{ id: "q1", answerIndex: 0, category: "fakta" }] };
  const started = withStartedText(normalizeLasresa(legacyStudent({ level: 7, highStreak: 2 })), text.id, 1).lasresa;
  const attempt = buildAttempt(text, [{ qid: "q1", chosen: 0 }], { completedAt: 2 });
  const { lasresa } = applyCompletion(started, attempt, undefined, 2);
  assert.equal(lasresa.level, 10); // tak
  assert.equal(lasresa.totalTexts, 28);
  assert.equal(lasresa.moneyEarned, 360 + attempt.earnedMoney);
  assert.equal(stored(lasresa).level10, 10);
});

test("klassens startnivå: gammal 3 → 6, ny form, gammal klients ändring/återställning", () => {
  assert.equal(readClassStartLevel({ lasresaStartLevel: 3 }), 6);
  assert.equal(readClassStartLevel({ lasresaStartLevel: 1 }), 4);
  assert.equal(readClassStartLevel({ lasresaStartLevel: 7 }), 10);
  assert.equal(readClassStartLevel({}), null);
  assert.equal(effectiveStartLevel(classStartLevelOf({})), 4); // ny klass utan värde
  for (const lvl of [1, 2, 3, 4, 9, 10]) {
    const doc = { name: "6A", ...classStartLevelFields(lvl) };
    assert.equal(readClassStartLevel(doc), lvl, `nivå ${lvl}`);
    assert.equal(classStartLevelOf(doc), lvl);
  }
  assert.deepEqual(classStartLevelFields(9), { lasresaStartLevel10: 9, lasresaStartLevel: 6 });
  assert.throws(() => classStartLevelFields(11));
  // Gammal lärarvy ändrar spegeln → dess värde +3; tar bort den → standard.
  assert.equal(readClassStartLevel({ ...classStartLevelFields(9), lasresaStartLevel: 2 }), 5);
  assert.equal(readClassStartLevel({ lasresaStartLevel10: 9 }), null);
  // Ogiltigt nytt fält → spegeln (gammal skala) gäller.
  assert.equal(readClassStartLevel({ lasresaStartLevel10: 11, lasresaStartLevel: 2 }), 5);
});

test("försök: textLevel på nya skalan – nya bär levelScale, gamla via id eller +3", () => {
  const text = { id: "lr-g1-ny", title: "Ny", level: 1, textType: "story", questions: [] };
  const a = buildAttempt(text, []);
  assert.equal(a.levelScale, LEVEL_SCALE);
  assert.equal(attemptTextLevel(a), 1);
  assert.equal(attemptTextLevel({ textId: "lr-n2-gammal", textLevel: 2 }), 5);
  assert.equal(attemptTextLevel({ textId: "dev-text", textLevel: 2 }), 5);
  assert.equal(attemptTextLevel({ textId: "dev-text" }), null);
  const n = normalizeAttempt({ textId: "lr-n7-x", textLevel: 7, correct: 3 });
  assert.equal(n.textLevel, 10);
  assert.equal(n.correct, 3);
  assert.deepEqual(normalizeAttempt(n), n); // idempotent
});

test("lärartabellen visar migrerade nivåer (via normalizeLasresa) och gammal startnivå +3", () => {
  const rows = teacherClassRows(
    [
      { studentId: "a", namn: "A", lasresa: normalizeLasresa(legacyStudent({ level: 1 })) },
      { studentId: "b", namn: "B", lasresa: null },
    ],
    undefined,
    { startLevel: classStartLevelOf({ lasresaStartLevel: 2 }) }
  );
  assert.equal(rows[0].level, 4);
  assert.equal(rows[1].level, 5);
});

test("readStoredLevels: skräp i gamla fält tolkas som förut (klampas 1–7, sedan +3)", () => {
  assert.deepEqual(readStoredLevels({ level: 42 }), { level: 10, pendingLevel: null });
  assert.deepEqual(readStoredLevels({ level: "2" }), { level: 5, pendingLevel: null });
  assert.deepEqual(readStoredLevels({ level: "abc", pendingLevel: 9 }), { level: null, pendingLevel: null });
  assert.deepEqual(readStoredLevels(undefined), { level: null, pendingLevel: null });
});

test("progression över 10 nivåer: 1↔2 och 9↔10, golv 1 och tak 10", () => {
  const high = { correct: 10, total: 10 };
  const low = { correct: 0, total: 10 };
  const run = (level, result, n) => {
    let s = { level, highStreak: 0, lowStreak: 0 };
    for (let i = 0; i < n; i++) s = applyResult(s, result);
    return s.level;
  };
  assert.equal(run(1, high, 3), 2);
  assert.equal(run(2, low, 2), 1);
  assert.equal(run(1, low, 2), 1); // golv
  assert.equal(run(1, low, 6), 1);
  assert.equal(run(9, high, 3), 10);
  assert.equal(run(10, low, 2), 9);
  assert.equal(run(10, high, 3), 10); // tak
  assert.equal(run(10, high, 9), 10);
  assert.equal(run(1, high, 27), 10); // hela vägen upp
  assert.equal(run(10, low, 18), 1); // hela vägen ner
  // Vid tak/golv nollas streaken ändå.
  assert.deepEqual(applyResult({ level: 10, highStreak: 2 }, high), { level: 10, highStreak: 0, lowStreak: 0, changed: false, band: "high" });
  assert.deepEqual(applyResult({ level: 1, lowStreak: 1 }, low), { level: 1, highStreak: 0, lowStreak: 0, changed: false, band: "low" });
});
