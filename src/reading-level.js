// ============================================================================
// Pluggportalen – per-elev läsnivå (reading-level.js)
// ----------------------------------------------------------------------------
// Issue #154: läraren sätter en LÄSNIVÅ (1–3) per elev, och läsförståelse-läget
// serverar sedan texterna/frågorna på ELEVENS nivå ur arbetsområdets
// `readingTexts` (läsförståelse 2.0, se validate-reading.js).
//
// Den här modulen är MEDVETET fri från browser-/Firebase-beroenden så att både
// elevspelet (games-quiz.js), datamodulen (data.js) och lärar-UI:t
// (teacher-reading-level.js) kan dela samma normalisering och nivåbygge – och
// så att den kan enhetstestas med `node --test` (se test/reading-texts.test.js).
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

/**
 * Bygg fråge-poolen för läsförståelse på en given elevnivå ur ett arbetsområdes
 * `readingTexts`. Varje läs-text bidrar med sin nivås brödtext (som `passage`)
 * plus den nivåns kryssfrågor – exakt den form frågemotorn (runQuestions i
 * game-shared.js) väntar sig: { question, options, answerIndex, explanation?,
 * passage }. Så får svagare läsare nivå 1:s text/frågor och starkare nivå 3:s,
 * på samma tema.
 *
 * Defensiv mot glesa data: saknas den exakta nivån på en läs-text används
 * närmaste tillgängliga nivå (validate-reading kräver alla tre, men äldre/rå
 * data kan vara ofullständig). Texter helt utan frågor hoppas tyst över.
 *
 * @param {Array} readingTexts  områdets readingTexts (kan sakna/vara tom)
 * @param {number|string} level elevens läsnivå (1–3)
 * @returns {Array} platt fråge-pool för runQuestions/pickSessionQuestions
 */
export function buildReadingPool(readingTexts, level) {
  const lvl = normalizeReadingLevel(level);
  if (!Array.isArray(readingTexts)) return [];
  const pool = [];
  for (const rt of readingTexts) {
    const L = pickLevel(rt && rt.levels, lvl);
    if (!L || !Array.isArray(L.questions)) continue;
    const passage = typeof L.body === "string" ? L.body : "";
    for (const q of L.questions) {
      if (!q || !Array.isArray(q.options)) continue;
      pool.push({
        question: q.question,
        options: q.options,
        answerIndex: q.answerIndex,
        explanation: q.explanation,
        passage,
      });
    }
  }
  return pool;
}

/**
 * Hämta en läs-texts nivå-objekt för `lvl`; faller tillbaka på närmaste
 * tillgängliga nivå (2→1/3, 1→2→3, 3→2→1) om just den nivån saknas.
 */
function pickLevel(levels, lvl) {
  if (!levels || typeof levels !== "object") return null;
  const order = [lvl, lvl - 1, lvl + 1, lvl - 2, lvl + 2];
  for (const n of order) {
    const L = levels[n] || levels[String(n)];
    if (L) return L;
  }
  return null;
}
