// ============================================================================
// Läsresan – nivåskala 1–7 → 1–10, lat migrering (src/lasresan/level-scale.js)
// ----------------------------------------------------------------------------
// Epic #516 / #519: de gamla nivåerna 1–7 är nu 4–10 (gammal N = ny N+3).
// Ingen engångsmigrering mot Firestore – lagrad data tolkas vid LÄSNING och
// skrivs i ny form vid nästa skrivning. Ren logik (config + validate), testad i
// test/lasresan-level-scale.test.js. Se docs/LASRESAN.md "Nivåskala 1–10".
//
// VARFÖR NYA FÄLTNAMN: en gammal cachad klient (Pages ~10 min, eller en flik
// som stått öppen) klampar `lasresa.level` till 1–7 och sprider okända fält
// (`...raw`). Låg den nya nivån i `level` skulle en gammal klient skriva 9 → 7.
// Därför bär NYA fält den nya skalan och de gamla fälten blir en SPEGEL i
// gammal skala, som gamla klienter läser och skriver som förut:
//
//   studentData.lasresa  level10 (1–10)        + level (1–7, spegel)
//                        pendingLevel10 (1–10)  + pendingLevel (1–7, spegel)
//   classes/{id}         lasresaStartLevel10    + lasresaStartLevel (spegel)
//   lasresaAttempts      levelScale: 10 (textLevel är då redan ny skala)
//
// Spegeln avslöjar också en gammal klients skrivning: stämmer spegeln inte
// längre med det nya fältet har en gammal klient ändrat nivån (progression
// eller lärarbyte) – då vinner det gamla värdet, flyttat +3.
//
// I MINNET (normalizeLasresa) bär `level`/`pendingLevel` alltid ny skala och
// objektet märks `levelScale: 10` – så att en ny normalisering aldrig lägger
// på +3 igen. toStoredLasresa gör om det till lagringsformen före skrivning.
// ============================================================================

import { LEVEL_MIN, LEVEL_MAX } from "./config.js";
import { levelFromId } from "./content/validate.js";

/** Markör: objektets `level`/`pendingLevel` (eller ett försöks textLevel) är på skalan 1–10. */
export const LEVEL_SCALE = 10;
/** Gamla skalan: nivå 1–LEGACY_LEVEL_MAX, ny nivå = gammal + LEGACY_OFFSET. */
export const LEGACY_LEVEL_MAX = 7;
export const LEGACY_OFFSET = 3;

/** Fältnamn för den nya skalan i lagringen. */
export const STORED_LEVEL_FIELD = "level10";
export const STORED_PENDING_FIELD = "pendingLevel10";
export const CLASS_START_LEVEL_LEGACY_FIELD = "lasresaStartLevel";
export const CLASS_START_LEVEL_FIELD = "lasresaStartLevel10";

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** Strikt heltal lo–hi (även "4" från en <select>), annars null. */
function strictInt(value, lo, hi) {
  let n = value;
  if (typeof value === "string") {
    if (!/^\s*\d+\s*$/.test(value)) return null;
    n = Number(value);
  }
  return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
}

/** Nivå på nya skalan (strikt 1–10) eller null. */
export const parseLevel10 = (value) => strictInt(value, LEVEL_MIN, LEVEL_MAX);

/** Lärarvärde på gamla skalan (strikt 1–7, som gamla parseTeacherLevel) eller null. */
const parseLegacyStrict = (value) => strictInt(value, LEVEL_MIN, LEGACY_LEVEL_MAX);

/** Lagrad gammal `level` som gamla normalizeLevel läste den (avrundad, klampad 1–7) eller null. */
function parseLegacyLevel(value) {
  const n = typeof value === "string" ? parseInt(value, 10) : value;
  return Number.isFinite(n) ? clamp(Math.round(n), LEVEL_MIN, LEGACY_LEVEL_MAX) : null;
}

/** Gammal nivå 1–7 → ny nivå 4–10. */
export const fromLegacyLevel = (old) => old + LEGACY_OFFSET;

/** Ny nivå 1–10 → spegel på gamla skalan (1–3 → 1, 4–10 → 1–7). */
export const toLegacyLevel = (level) => clamp(level - LEGACY_OFFSET, LEVEL_MIN, LEGACY_LEVEL_MAX);

/**
 * Nivå + väntande nivå ur LAGRAD studentData.lasresa, på nya skalan.
 * Utan `level10` = gammal data → +3. Med `level10` gäller de nya fälten så
 * länge spegeln stämmer; har en gammal klient skrivit (spegeln ändrad) vinner
 * dess värde (+3). null = saknas (anroparen väljer startnivå).
 * @returns {{level:(number|null), pendingLevel:(number|null)}}
 */
export function readStoredLevels(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const legacyLevel = parseLegacyLevel(r.level);
  const legacyPending = parseLegacyStrict(r.pendingLevel);
  const level10 = parseLevel10(r[STORED_LEVEL_FIELD]);
  const pending10 = parseLevel10(r[STORED_PENDING_FIELD]);
  const legacy = (v) => (v === null ? null : fromLegacyLevel(v));

  if (level10 === null) return { level: legacy(legacyLevel), pendingLevel: legacy(legacyPending) };

  // Väntande nivå: spegeln borta = förbrukad/rensad (nya skrivare skriver alltid båda).
  let pendingLevel = null;
  if (legacyPending !== null) {
    pendingLevel = pending10 !== null && legacyPending === toLegacyLevel(pending10) ? pending10 : legacy(legacyPending);
  }

  let level;
  if (pending10 !== null && legacyPending === null && legacyLevel === toLegacyLevel(pending10)) {
    level = pending10; // en gammal klient lade den väntande nivån på plats
  } else if (legacyLevel === null || legacyLevel === toLegacyLevel(level10)) {
    level = level10;
  } else {
    level = legacy(legacyLevel); // en gammal klient flyttade nivån
  }
  return { level, pendingLevel };
}

/** Är ett lasresa-objekt redan i minnesform (ny skala i `level`)? */
export function isScaledLasresa(raw) {
  return !!raw && raw.levelScale === LEVEL_SCALE && !(STORED_LEVEL_FIELD in raw);
}

/**
 * Minnesform (normalizeLasresa, ny skala + `levelScale: 10`) → lagringsform.
 * Kastar om objektet inte är i minnesform – att skriva ny skala i `level`
 * skulle låta gamla klienter klampa den.
 */
export function toStoredLasresa(lasresa) {
  if (!isScaledLasresa(lasresa)) {
    throw new Error("toStoredLasresa: väntade normaliserat lasresa-objekt (levelScale 10).");
  }
  // eslint-disable-next-line no-unused-vars
  const { levelScale, ...rest } = lasresa;
  const level = parseLevel10(lasresa.level);
  const pending = parseLevel10(lasresa.pendingLevel);
  if (level === null) throw new Error(`toStoredLasresa: ogiltig nivå ${lasresa.level}.`);
  return {
    ...rest,
    level: toLegacyLevel(level),
    pendingLevel: pending === null ? null : toLegacyLevel(pending),
    [STORED_LEVEL_FIELD]: level,
    [STORED_PENDING_FIELD]: pending,
  };
}

/**
 * Klassens startnivå (ny skala) ur ett klassdokument, null = ej satt.
 * Utan lasresaStartLevel10 = gammalt värde +3. Med det: gäller så länge
 * spegeln stämmer; spegeln borttagen = en gammal klient återställde till
 * standard (null); spegeln ändrad = gammal klients värde +3.
 */
export function readClassStartLevel(classDoc) {
  const c = classDoc && typeof classDoc === "object" ? classDoc : {};
  const legacy = parseLegacyStrict(c[CLASS_START_LEVEL_LEGACY_FIELD]);
  const level10 = parseLevel10(c[CLASS_START_LEVEL_FIELD]);
  if (legacy === null) return null;
  if (level10 !== null && legacy === toLegacyLevel(level10)) return level10;
  return fromLegacyLevel(legacy);
}

/** Fälten att skriva för startnivå `level` (1–10): ny skala + spegel. */
export function classStartLevelFields(level) {
  const lvl = parseLevel10(level);
  if (lvl === null) throw new Error(`Ogiltig startnivå: ${level}.`);
  return { [CLASS_START_LEVEL_FIELD]: lvl, [CLASS_START_LEVEL_LEGACY_FIELD]: toLegacyLevel(lvl) };
}

/**
 * Ett försöks textnivå på nya skalan. Nya försök bär `levelScale: 10`. Gamla:
 * text-id:t avgör om det följer konventionen (id:n är oförändrade), annars
 * textLevel +3. null om nivån inte går att avgöra.
 */
export function attemptTextLevel(attempt) {
  const a = attempt || {};
  if (a.levelScale === LEVEL_SCALE) return parseLevel10(a.textLevel);
  const fromId = parseLevel10(levelFromId(a.textId));
  if (fromId !== null) return fromId;
  const old = parseLegacyStrict(a.textLevel);
  return old === null ? null : fromLegacyLevel(old);
}

/** Försök (lagrat, ev. gammal skala) → samma försök med textLevel på nya skalan (idempotent). */
export function normalizeAttempt(attempt) {
  if (!attempt || attempt.levelScale === LEVEL_SCALE) return attempt;
  return { ...attempt, textLevel: attemptTextLevel(attempt), levelScale: LEVEL_SCALE };
}
