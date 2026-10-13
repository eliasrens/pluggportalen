// ============================================================================
// Ämnesläsning – nivå (src/amneslasning/level.js)
// ----------------------------------------------------------------------------
// Ren logik (ingen DOM/Firestore), testad i test/amneslasning-level.test.js.
// Spec: docs/UTVECKLINGSUPPDRAG_AMNESLASNING.md §2–3.
//
// Ämnesläsningen har INGEN egen nivå. Den läser och uppdaterar Läsresans dolda
// läsnivå (1–10) och samma streaks:
//   * läsa:      normalizeLasresa (lagrad data, klassens startnivå, annars
//                START_LEVEL) → läsnivå → ämnesnivå 1–3 (AMNES_LEVEL_FROM_READING)
//   * uppdatera: progress.applyLevelResult (level.js-reglerna) med taket
//                AMNES_LEVEL_CAP uppåt, fritt nedåt
//   * lagra:     bryggan skriver toStoredLasresa (level10 + spegel), aldrig
//                nivåfälten direkt
// Läsresans resa (worldId, stepInWorld, seenTextIds, currentTextId) rörs aldrig.
// ============================================================================

import {
  AMNES_LEVEL_CAP,
  AMNES_LEVEL_FROM_READING,
  AMNES_LEVELS,
  AMNES_TEXT_READING_LEVEL,
} from "../lasresan/config.js";
import { normalizeLevel } from "../lasresan/level.js";
import { applyLevelResult, normalizeLasresa } from "../lasresan/progress.js";

/** Läsnivå (1–10) → ämnesnivå (1–3). Ogiltigt värde tolkas som normalizeLevel (START_LEVEL). */
export function amnesLevelFor(readingLevel) {
  const lvl = normalizeLevel(readingLevel);
  const row = AMNES_LEVEL_FROM_READING.find(([, lo, hi]) => lvl >= lo && lvl <= hi);
  return row ? row[0] : AMNES_LEVELS[AMNES_LEVELS.length - 1];
}

/** Strikt ämnesnivå 1–3 (även "2"), annars null. */
export function parseAmnesLevel(value) {
  const n = typeof value === "string" && /^\s*\d+\s*$/.test(value) ? Number(value) : value;
  return AMNES_LEVELS.includes(n) ? n : null;
}

/** Läsnivån (1–10) en ämnestext på `amnesLevel` motsvarar (försökets textLevel). */
export function readingLevelForAmnes(amnesLevel) {
  const lvl = parseAmnesLevel(amnesLevel);
  return lvl === null ? null : AMNES_TEXT_READING_LEVEL[lvl];
}

/**
 * Elevens läsnivå (1–10) ur LAGRAD studentData.lasresa, som Läsresan läser den.
 * `startLevel` = klassens lasresaStartLevel10 (gäller bara elev som inte börjat).
 */
export function readingLevelOf(rawLasresa, { startLevel } = {}) {
  return normalizeLasresa(rawLasresa, undefined, { startLevel }).level;
}

/** Elevens ämnesnivå (1–3) ur lagrad studentData.lasresa. */
export function amnesLevelOf(rawLasresa, { startLevel } = {}) {
  return amnesLevelFor(readingLevelOf(rawLasresa, { startLevel }));
}

/**
 * Uppdatera den delade läsnivån efter en färdig ämnestext: Läsresans regler och
 * streaks, högst AMNES_LEVEL_CAP uppåt. `lasresa` = normaliserat tillstånd
 * (normalizeLasresa med klassens startnivå). Bara level/streaks/updatedAt ändras.
 * @returns {{lasresa:object, levelChanged:boolean, band:("high"|"mid"|"low"|null)}}
 */
export function applyAmnesLevel(lasresa, { correct, total }, now = Date.now()) {
  return applyLevelResult(lasresa, { correct, total }, { maxLevel: AMNES_LEVEL_CAP, now });
}
