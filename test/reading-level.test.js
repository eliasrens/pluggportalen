// ============================================================================
// Enhetstest för per-elev läsnivå (issue #154):
//   • normalizeReadingLevel: giltiga/ogiltiga värden → nivå 1–3 (default 2)
//   • readingLevelName: kort etikett
// Ren, browser-fri logik (reading-level.js). Nivån används av Läsuppdrag-läget
// (games-lastext.js, #153) för att servera elevens tilldelade nivå. Körs med
// `node --test`.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeReadingLevel,
  readingLevelName,
  READING_LEVELS,
  DEFAULT_READING_LEVEL,
} from "../src/reading-level.js";

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

test("READING_LEVELS är [1, 2, 3]", () => {
  assert.deepEqual(READING_LEVELS, [1, 2, 3]);
});

test("readingLevelName ger 'Nivå N'", () => {
  assert.equal(readingLevelName(1), "Nivå 1");
  assert.equal(readingLevelName("3"), "Nivå 3");
  assert.equal(readingLevelName(9), "Nivå 2"); // ogiltig → default
});
