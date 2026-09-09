// ============================================================================
// Enhetstest för per-elev läsnivå (issue #154):
//   • normalizeReadingLevel: giltiga/ogiltiga värden → nivå 1–3 (default 2)
//   • buildReadingPool: bygger fråge-pool på ELEVENS nivå ur readingTexts, med
//     nivåns brödtext som passage och bakåtkompatibel fallback.
// Ren, browser-fri logik (reading-level.js) – körs med `node --test`.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeReadingLevel,
  buildReadingPool,
  readingLevelName,
  DEFAULT_READING_LEVEL,
} from "../src/reading-level.js";

// En läs-text med tre nivåer; frågorna märks med nivån så vi kan verifiera att
// rätt nivå plockas.
function readingText() {
  const level = (n) => ({
    body: `Brödtext nivå ${n}.`,
    questions: [
      { question: `Fråga 1 nivå ${n}?`, options: ["Rätt", "Fel"], answerIndex: 0 },
      { question: `Fråga 2 nivå ${n}?`, options: ["Fel", "Rätt"], answerIndex: 1 },
    ],
  });
  return { id: "vikingar", title: "Vikingar", levels: { 1: level(1), 2: level(2), 3: level(3) } };
}

// --- normalizeReadingLevel --------------------------------------------------

test("normalizeReadingLevel accepterar 1, 2, 3 (tal och sträng)", () => {
  assert.equal(normalizeReadingLevel(1), 1);
  assert.equal(normalizeReadingLevel(3), 3);
  assert.equal(normalizeReadingLevel("2"), 2);
  assert.equal(normalizeReadingLevel("3"), 3);
});

test("normalizeReadingLevel faller tillbaka på default (2) för ogiltigt", () => {
  assert.equal(DEFAULT_READING_LEVEL, 2);
  assert.equal(normalizeReadingLevel(undefined), 2);
  assert.equal(normalizeReadingLevel(null), 2);
  assert.equal(normalizeReadingLevel(0), 2);
  assert.equal(normalizeReadingLevel(4), 2);
  assert.equal(normalizeReadingLevel("hej"), 2);
});

test("readingLevelName ger 'Nivå N'", () => {
  assert.equal(readingLevelName(1), "Nivå 1");
  assert.equal(readingLevelName("3"), "Nivå 3");
  assert.equal(readingLevelName(9), "Nivå 2"); // ogiltig → default
});

// --- buildReadingPool -------------------------------------------------------

test("buildReadingPool serverar elevens nivå med brödtext som passage", () => {
  const pool = buildReadingPool([readingText()], 3);
  assert.equal(pool.length, 2); // två frågor på nivå 3
  for (const q of pool) {
    assert.equal(q.passage, "Brödtext nivå 3.");
    assert.match(q.question, /nivå 3/);
    assert.ok(Array.isArray(q.options));
    assert.equal(typeof q.answerIndex, "number");
  }
});

test("buildReadingPool default-nivå (2) när nivån är ogiltig/saknas", () => {
  const pool = buildReadingPool([readingText()], undefined);
  assert.equal(pool.length, 2);
  assert.equal(pool[0].passage, "Brödtext nivå 2.");
});

test("buildReadingPool slår ihop flera läs-texter", () => {
  const pool = buildReadingPool([readingText(), readingText()], 1);
  assert.equal(pool.length, 4);
  assert.ok(pool.every((q) => q.passage === "Brödtext nivå 1."));
});

test("buildReadingPool faller tillbaka på närmaste nivå om den saknas", () => {
  const rt = readingText();
  delete rt.levels[3]; // nivå 3 saknas → närmaste (2)
  const pool = buildReadingPool([rt], 3);
  assert.equal(pool.length, 2);
  assert.equal(pool[0].passage, "Brödtext nivå 2.");
});

test("buildReadingPool tål tom/ogiltig indata", () => {
  assert.deepEqual(buildReadingPool(undefined, 2), []);
  assert.deepEqual(buildReadingPool([], 2), []);
  assert.deepEqual(buildReadingPool(null, 2), []);
  assert.deepEqual(buildReadingPool([{ title: "x" }], 2), []); // ingen levels
});
