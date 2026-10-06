// ============================================================================
// Pluggporten – frågekategorier: konfiguration (question-categories.js)
// ----------------------------------------------------------------------------
// Epic #444 / issue #445: ETT ställe för Plugga-frågornas kategorier – svensk
// etikett, kort beskrivning (för lärare/AI-prompten), ikon och färg. Ren data,
// inga beroenden utöver katalogen, så den kan importeras av webbläsarkod och
// `node --test`. Jfr src/lasresan/config.js (Läsresans EGNA kategorier – helt
// skilda från dessa; blanda inte ihop dem).
//
// ⚠️ BOOTGRAF (#271): den här filen är NY och får INTE importeras statiskt från
// någon fil i app.js:s statiska importkedja (validate.js, game-*.js, data*.js,
// teacher*.js …). Nycklarna + normalisering/räkning bor därför i den befintliga
// bootfilen src/exercise-types.js (QUESTION_CATEGORY_KEYS); hit importerar man
// DYNAMISKT (await import()) eller från moduler som själva laddas dynamiskt.
// Testet asserterar att de två listorna stämmer överens (drift-vakt).
// ============================================================================

import { QUESTION_CATEGORY_KEYS, normalizeQuestionCategory } from "./exercise-types.js";

export { QUESTION_CATEGORY_KEYS, normalizeQuestionCategory };

/**
 * Kategorierna i visningsordning. `key` sparas i datat (quiz[].category och
 * progress[...].cat), `color` är ett palettnamn ur styles.css (var(--<color>)),
 * `hex` samma färg för t.ex. SVG/diagram.
 */
export const QUESTION_CATEGORIES = [
  {
    key: "begrepp",
    label: "Begreppsförståelse",
    short: "Begrepp",
    hint: "Förstår eleven vad ord och begrepp betyder?",
    icon: "💡",
    color: "lila",
    hex: "#9b51e0",
  },
  {
    key: "fakta",
    label: "Fakta",
    short: "Fakta",
    hint: "Kommer eleven ihåg fakta – vem, vad, var, när?",
    icon: "📌",
    color: "bla",
    hex: "#2f80ed",
  },
  {
    key: "analys",
    label: "Analys/resonemang",
    short: "Analys",
    hint: "Kan eleven förklara orsaker, följder och samband – varför?",
    icon: "🧠",
    color: "orange",
    hex: "#f2994a",
  },
];

/** key → etikett, t.ex. CATEGORY_LABELS.analys === "Analys/resonemang". */
export const CATEGORY_LABELS = Object.fromEntries(QUESTION_CATEGORIES.map((c) => [c.key, c.label]));

/**
 * Metadata för en kategori (tål alias/versaler). Okänd nyckel → en neutral post
 * med nyckeln som etikett, så framtida/okända kategorier aldrig kraschar en vy.
 * @param {string} key
 */
export function categoryMeta(key) {
  const k = normalizeQuestionCategory(key);
  const hit = k && QUESTION_CATEGORIES.find((c) => c.key === k);
  if (hit) return hit;
  const raw = String(key == null ? "" : key);
  return { key: raw, label: raw, short: raw, hint: "", icon: "❔", color: "text-svag", hex: "#64748b" };
}
