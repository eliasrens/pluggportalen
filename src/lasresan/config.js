// ============================================================================
// Läsresan – konfiguration (src/lasresan/config.js)
// ----------------------------------------------------------------------------
// ALLA justerbara tal för Läsresan på ETT ställe: nivåintervall, gränser för
// nivåförändring, belöning, stegantal och innehållskrav. Ren data – inga
// beroenden, så den kan importeras av både webbläsarkod och `node --test`.
// Se docs/LASRESAN.md för hur talen används.
//
// OBS: den gamla lärarsatta studentData.readingLevel (1–3) är borttagen (#531)
// och läses inte längre. Läsresans dolda nivå (1–10) är elevens ENDA läsnivå –
// den delas med Ämnesläsningen (talen längst ned, src/amneslasning/).
// ============================================================================

// --- Dold adaptiv läsnivå (level.js) ----------------------------------------
export const LEVEL_MIN = 1;
export const LEVEL_MAX = 10;
/**
 * Alla nya elever börjar här (spec §9). Nivå 1–3 är de enklare nivåerna från
 * epic #516; den gamla startnivån 3 motsvarar nu 4 (gammal nivå N = ny N+3).
 */
export const START_LEVEL = 4;
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
/** Globalt frågeintervall per text – gäller nivåer som saknas i QUESTIONS_BY_LEVEL. */
export const QUESTIONS_MIN = 5;
export const QUESTIONS_MAX = 9;
/** Frågeintervall [min, max] per nivå (epic #516): de nya enkla nivåerna har färre frågor. */
export const QUESTIONS_BY_LEVEL = {
  1: [3, 4],
  2: [4, 5],
  3: [5, 7],
};
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
 * validatorn ger en VARNING (aldrig fel) utanför intervallet. Nivå 1–3 (epic
 * #516, spec 30–50 / 60–90 / 100–140 ord) har lite marginal; nivå 4–10 är
 * de gamla nivåerna 1–7 oförändrade.
 */
export const LEVEL_WORD_RANGES = {
  1: [25, 55],
  2: [55, 95],
  3: [95, 150],
  4: [60, 110],
  5: [80, 140],
  6: [120, 190],
  7: [150, 230],
  8: [180, 300],
  9: [220, 380],
  10: [280, 500],
};

/**
 * Rätt svars position: varna om en position (A–D) står för mer än så här stor
 * andel av frågorna på en nivå (förväntat ≈ 25 %). Kontrolleras först när
 * nivån har minst ANSWER_SKEW_MIN_QUESTIONS frågor (annars är urvalet för litet).
 */
export const ANSWER_SKEW_MAX_SHARE = 0.4;
export const ANSWER_SKEW_MIN_QUESTIONS = 12;

/**
 * Längdledtråd: varna om rätt svar är det UNIKT längsta alternativet (strikt
 * längre i tecken efter trim än alla andra) i mer än LENGTH_CUE_MAX_SHARE eller
 * mindre än LENGTH_CUE_MIN_SHARE av flervalsfrågorna på en nivå (slump ≈ 25 %).
 * Samma minsta urval som positionskontrollen (ANSWER_SKEW_MIN_QUESTIONS).
 */
export const LENGTH_CUE_MAX_SHARE = 0.45;
export const LENGTH_CUE_MIN_SHARE = 0.1;

// --- Ämnesläsning (src/amneslasning/, docs/UTVECKLINGSUPPDRAG_AMNESLASNING.md) ---
// Läsförståelse i arbetsområdena med Läsresans motor och SAMMA dolda läsnivå.
// Områdets texter har tre ämnesnivåer (1–3); elevens läsnivå (1–10) avgör vilken.

/** Ämnesnivåerna ett område har texter på. */
export const AMNES_LEVELS = [1, 2, 3];
/**
 * Läsnivå (1–10) → ämnesnivå (spec §2.1): [ämnesnivå, lägsta läsnivå, högsta läsnivå].
 * 1–2 → 1, 3–4 → 2, 5–10 → 3.
 */
export const AMNES_LEVEL_FROM_READING = [
  [1, 1, 2],
  [2, 3, 4],
  [3, 5, 10],
];
/**
 * Läsnivån (1–10) en ämnestext motsvarar, som sparas i försökets textLevel
 * (spec §2.2/§8): övre änden av nivåns intervall 1–2 / 3–4 / 5–6.
 */
export const AMNES_TEXT_READING_LEVEL = { 1: 2, 2: 4, 3: 6 };
/**
 * Tak uppåt (spec §3.4): Ämnesläsningen höjer läsnivån till HÖGST hit. Nivå 8–10
 * nås bara genom Läsresan. Nedåt är det fritt (till LEVEL_MIN).
 */
export const AMNES_LEVEL_CAP = 7;
/** Riktintervall för ordantal per ämnesnivå (spec §2.2) – VARNING, aldrig fel. */
export const AMNES_WORD_RANGES = {
  1: [40, 90],
  2: [80, 150],
  3: [130, 220],
};
/** Frågeintervall [min, max] per ämnesnivå (spec §2.2) – VARNING, aldrig fel. */
export const AMNES_QUESTIONS_BY_LEVEL = {
  1: [3, 5],
  2: [4, 6],
  3: [5, 7],
};
/**
 * Pluggcoins per rätt svar (spec §5), till det VANLIGA saldot som Läsresans.
 * Omläsning av samma text skalas med leveling.grindMultiplier (per text och elev).
 */
export const AMNES_COINS_PER_CORRECT = 5;
/** Försökets `source` i lasresaAttempts. Försök utan source = Läsresan. */
export const AMNES_SOURCE = "amnesläsning";
export const LASRESAN_SOURCE = "lasresan";

// --- Ämnesläsning: lärarens innehåll (#673, spec §6–7 och bilaga A) ----------
// AI-prompten (src/prompt-parts.js) och valideringen (src/amneslasning/content.js)
// läser BÅDA talen och texterna härifrån, så att de aldrig glider isär.

/** Antal texter per nivå i panelen "Skapa ämnestexter": [min, max] och förval. */
export const AMNES_TEXTS_PER_LEVEL_RANGE = [1, 5];
export const AMNES_TEXTS_PER_LEVEL_DEFAULT = 3;
/** Färre texter än så på en nivå (befintliga + nya) → varning, aldrig fel. */
export const AMNES_MIN_TEXTS_PER_LEVEL = 2;
/**
 * Svarsposition/längdledtråd kontrolleras först när en nivå har minst så här
 * många frågor. Lägre än Läsresans bank (12): ett område har bara några texter.
 */
export const AMNES_ANSWER_SKEW_MIN_QUESTIONS = 8;
/** Fältet på arbetsområdet (spec §7.1). Inte samma som områdets `texts`. */
export const AMNES_FIELD_ON_AREA = "readingTexts";

/**
 * Nivåbeskrivningar till AI-prompten (bilaga A). Ordantal och frågeantal
 * hämtas ur AMNES_WORD_RANGES / AMNES_QUESTIONS_BY_LEVEL – här bara orden.
 */
export const AMNES_LEVEL_DESCRIPTIONS = {
  1: {
    reader: "för elever som är ovana läsare",
    language: "korta meningar, vanliga ord, ett tydligt huvudbudskap",
    questions: "nästan alla svar står direkt i texten",
  },
  2: {
    reader: "för elever som läser på en normal nivå för åldern",
    language: "något längre meningar och några ämnesord som förklaras i texten",
    questions: "med en eller två frågor där eleven måste dra en enkel slutsats",
  },
  3: {
    reader: "för elever som läser bra",
    language: "mer varierat språk och fler ämnesbegrepp, information som behöver kopplas ihop",
    questions: "med flera frågor om orsak och följd, slutsatser och textens huvudbudskap",
  },
};

/** Vad varje frågekategori testar – AI-promptens förklaring (bilaga A). */
export const CATEGORY_AI_HINTS = {
  fakta: "svaret står tydligt i texten",
  ordforstaelse: "förstå ett ord eller uttryck i sammanhanget",
  mellan_raderna: "dra en slutsats som inte står uttryckligen",
  helhet_slutsats: "huvudbudskap, orsak och följd, varför något händer",
};
