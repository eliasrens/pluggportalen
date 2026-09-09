// ============================================================================
// Pluggportalen – per-elev läsnivå (reading-level.js)
// ----------------------------------------------------------------------------
// Issue #154: läraren sätter en LÄSNIVÅ (1–3) per elev, och Läsuppdrag-läget
// (games-lastext.js, #153) serverar sedan texterna på ELEVENS tilldelade nivå
// ur arbetsområdets `readingTexts` (läsförståelse 2.0, se validate-reading.js).
//
// Den här modulen är MEDVETET fri från browser-/Firebase-beroenden så att både
// elevspelet (games-lastext.js), datamodulen (data-reading-level.js) och
// lärar-UI:t (teacher-student-level.js) kan dela samma normalisering – och så
// att den kan enhetstestas med `node --test` (se test/reading-level.test.js).
// ============================================================================

// De tre nivåerna (1 = lättast, 3 = svårast) – samma tema, olika svårighet.
export const READING_LEVELS = [1, 2, 3];
// Rimlig default när en elev saknar satt nivå (bakåtkompatibelt: gamla
// elevdokument utan `readingLevel` behandlas som mellannivån).
export const DEFAULT_READING_LEVEL = 2;

// Korta, elevvänliga etiketter (för lärar-väljaren och elevens ledtext).
export const READING_LEVEL_LABELS = {
  1: "Nivå 1 – lättast",
  2: "Nivå 2 – mellan",
  3: "Nivå 3 – svårast",
};

/**
 * Tvinga ett godtyckligt värde till en giltig läsnivå (1, 2 eller 3). Allt som
 * inte är en av de tre nivåerna (saknas, sträng, ogiltigt tal) faller tillbaka
 * på DEFAULT_READING_LEVEL. Accepterar både tal (2) och sträng ("2").
 */
export function normalizeReadingLevel(value) {
  const n = typeof value === "string" ? parseInt(value, 10) : value;
  return READING_LEVELS.includes(n) ? n : DEFAULT_READING_LEVEL;
}

/** Kort namn för en nivå, t.ex. "Nivå 2". */
export function readingLevelName(level) {
  return `Nivå ${normalizeReadingLevel(level)}`;
}
