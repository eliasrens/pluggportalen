// ============================================================================
// Läsresan – lärarstyrd nivå (src/lasresan/level-control.js)  ·  #505
// ----------------------------------------------------------------------------
// Ren logik (ingen DOM/Firestore), testad i test/lasresan-level-control.test.js.
// Bryggan src/data-lasresan-niva.js läser/skriver bara. Spec: docs/
// spec-lasresan-uppdatering.md §2–5, se docs/LASRESAN.md "Lärarstyrd nivå".
//
// Tre vägar in:
//   * ENSKILD ELEV / HELA KLASSEN (samma semantik per elev, withTeacherLevel):
//       - ingen påbörjad text → `level` sätts direkt, streaks nollas
//       - påbörjad text       → `pendingLevel` sparas; texten slutförs på den
//         gamla nivån och nivån byts när den är klar (progress.applyCompletion)
//     Inget annat fält rörs (resultat, sedda texter, totaler, världar, pengar).
//     Efteråt fortsätter den vanliga automatiska progressionen (level.js).
//   * KLASSENS STARTNIVÅ (classes/{id}.lasresaStartLevel): ersätter START_LEVEL
//     för elever som INTE har börjat. "Inte börjat" = studentData.lasresa
//     saknas helt. Läsresans objekt skapas först när eleven startar sin första
//     text (startText) eller när läraren sätter en individuell nivå – därefter
//     gäller elevens egen nivå och startnivån påverkar inte längre eleven.
//     En lärarsatt individuell nivå vinner alltså alltid över startnivån.
// ============================================================================

import { LEVEL_MIN, LEVEL_MAX, START_LEVEL } from "./config.js";

/** Vem som senast satte nivån manuellt (studentData.lasresa.levelSetBy). */
export const LEVEL_SET_BY_TEACHER = "teacher";

/**
 * STRIKT tolkning av en lärarvald nivå: heltal LEVEL_MIN–LEVEL_MAX (även som
 * sträng från en <select>, t.ex. "4"). Allt annat (0, 8, 3.5, "abc", null) → null.
 */
export function parseTeacherLevel(value) {
  let n = value;
  if (typeof value === "string") {
    if (!/^\s*\d+\s*$/.test(value)) return null;
    n = Number(value);
  }
  if (!Number.isInteger(n) || n < LEVEL_MIN || n > LEVEL_MAX) return null;
  return n;
}

/** Klassens startnivå → giltig nivå (saknas/ogiltig → START_LEVEL). */
export function effectiveStartLevel(classStartLevel) {
  return parseTeacherLevel(classStartLevel) ?? START_LEVEL;
}

/** Startnivån ur ett klassdokument ({ lasresaStartLevel? }) – null = ej satt. */
export function classStartLevelOf(classDoc) {
  return parseTeacherLevel(classDoc && classDoc.lasresaStartLevel);
}

/**
 * Har eleven börjat Läsresan? Saknat lasresa-objekt = nej. Med objekt räknas
 * eleven som igång om den läst, påbörjat eller sett någon text. (Ett objekt med
 * bara en lärarsatt nivå = INTE börjat, men har en egen nivå – lärartabellen
 * visar då "ej börjat" med lärarens nivå.)
 */
export function hasStartedLasresa(raw) {
  if (!raw || typeof raw !== "object") return false;
  if (Number.isFinite(raw.totalTexts) && raw.totalTexts > 0) return true;
  if (typeof raw.currentTextId === "string" && raw.currentTextId) return true;
  return Array.isArray(raw.seenTextIds) && raw.seenTextIds.length > 0;
}

/**
 * Lägg en väntande lärarnivå på plats om ingen text är påbörjad: level =
 * pendingLevel, streaks 0, pendingLevel bort. Annars oförändrat (samma objekt).
 * Anropas av normalizeLasresa, withStartedText och applyCompletion.
 */
export function applyPendingLevel(lasresa) {
  if (!lasresa || lasresa.currentTextId) return lasresa;
  const pending = parseTeacherLevel(lasresa.pendingLevel);
  if (pending === null) return lasresa.pendingLevel == null ? lasresa : { ...lasresa, pendingLevel: null };
  return { ...lasresa, level: pending, highStreak: 0, lowStreak: 0, pendingLevel: null };
}

/**
 * Lärarens nivåbyte för EN elev. `lasresa` = normaliserat tillstånd
 * (progress.normalizeLasresa). Kastar vid ogiltig nivå.
 * @returns {{lasresa:object, applied:("now"|"pending")}}
 *   "now" = nästa text hämtas från nivån; "pending" = gäller efter påbörjad text.
 */
export function withTeacherLevel(lasresa, level, now = Date.now()) {
  const lvl = parseTeacherLevel(level);
  if (lvl === null) throw new Error(`Ogiltig nivå: ${level} (måste vara ${LEVEL_MIN}–${LEVEL_MAX}).`);
  const stamp = { levelSetAt: now, levelSetBy: LEVEL_SET_BY_TEACHER, updatedAt: now };
  if (lasresa.currentTextId) {
    return { lasresa: { ...lasresa, pendingLevel: lvl, ...stamp }, applied: "pending" };
  }
  return {
    lasresa: { ...lasresa, level: lvl, highStreak: 0, lowStreak: 0, pendingLevel: null, ...stamp },
    applied: "now",
  };
}
