// ============================================================================
// Läsresan – konfiguration (src/lasresan/config.js)
// ----------------------------------------------------------------------------
// ALLA justerbara tal för Läsresan på ETT ställe: nivåintervall, gränser för
// nivåförändring, belöning, stegantal och innehållskrav. Ren data – inga
// beroenden, så den kan importeras av både webbläsarkod och `node --test`.
// Se docs/LASRESAN.md för hur talen används.
//
// OBS: Läsresans dolda nivå (1–7) är HELT skild från Läsuppdragens lärarsatta
// studentData.readingLevel (1–3, src/reading-level.js). Blanda aldrig ihop dem.
// ============================================================================

// --- Dold adaptiv läsnivå (level.js) ----------------------------------------
export const LEVEL_MIN = 1;
export const LEVEL_MAX = 7;
/** Alla nya elever börjar här (spec §9). */
export const START_LEVEL = 3;
/** ≥ HIGH_PCT % rätt på en text = hög prestation (exakt 70 % ÄR hög). */
export const HIGH_PCT = 70;
/** < LOW_PCT % rätt = låg prestation (exakt 50 % är INTE låg). */
export const LOW_PCT = 50;
/** Så många höga texter i rad → nivå +1. */
export const HIGH_STREAK_TO_UP = 3;
/** Så många låga texter i rad → nivå −1. */
export const LOW_STREAK_TO_DOWN = 2;

// --- Belöning (rewards.js) ----------------------------------------------------
/** Pluggcoins per rätt svar. Läggs på elevens VANLIGA saldo via data.addCoins. */
export const COINS_PER_CORRECT = 3;

// --- Resan (journey.js / worlds/) ---------------------------------------------
/** Standardantal steg i en värld (en värld kan ange eget `steps`). */
export const DEFAULT_STEPS_PER_WORLD = 20;

// --- Innehåll (content/validate.js) -------------------------------------------
export const QUESTIONS_MIN = 5;
export const QUESTIONS_MAX = 9;
export const OPTIONS_PER_QUESTION = 4;
export const TEXT_TYPES = ["story", "fact"];

/** Frågekategorier i visningsordning (spec §14). Nyckeln sparas i datat. */
export const CATEGORIES = ["fakta", "ordforstaelse", "mellan_raderna", "helhet_slutsats"];
export const CATEGORY_LABELS = {
  fakta: "Fakta",
  ordforstaelse: "Ordförståelse",
  mellan_raderna: "Mellan raderna",
  helhet_slutsats: "Helhet/slutsats",
};

/**
 * Riktintervall för ordantal per nivå (spec §16). RIKTLINJER, inte regler:
 * validatorn ger en VARNING (aldrig fel) utanför intervallet.
 */
export const LEVEL_WORD_RANGES = {
  1: [60, 110],
  2: [80, 140],
  3: [120, 190],
  4: [150, 230],
  5: [180, 300],
  6: [220, 380],
  7: [280, 500],
};

/**
 * Rätt svars position: varna om en position (A–D) står för mer än så här stor
 * andel av frågorna på en nivå (förväntat ≈ 25 %). Kontrolleras först när
 * nivån har minst ANSWER_SKEW_MIN_QUESTIONS frågor (annars är urvalet för litet).
 */
export const ANSWER_SKEW_MAX_SHARE = 0.4;
export const ANSWER_SKEW_MIN_QUESTIONS = 12;
