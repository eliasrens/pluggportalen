// ============================================================================
// Pluggportalen – övningstyper per arbetsområde (exercise-types.js)
// ----------------------------------------------------------------------------
// Läraren väljer vilka typer av övningar ett arbetsområde ska ha. Valet sparas
// på området (fältet "exerciseTypes") och styr dessutom AI-prompten som skapar
// innehållet (se buildAreaPrompt i src/prompts.js) – så att AI:n bara ombeds
// skapa passande innehåll (t.ex. inga bildpar om det inte kryssats i).
//
// Typerna mappar mot elevens spellägen (se GAMEMODES i src/game-shared.js):
//   • "quiz"   → Quiz, Läsförståelse och Kunskapsjakt (kräver quiz-innehåll)
//   • "pairs"  → Para ihop och Memory (kräver fakta-par)
//   • "bildpar"→ fakta-par som visar en färdig bild i stället för text
//                (delmängd av "pairs" – kräver alltså också fakta-par)
// ============================================================================

/** De valbara övningstyperna, i visnings-/kanonisk ordning. */
export const EXERCISE_TYPES = [
  {
    id: "quiz",
    emoji: "❓",
    label: "Quiz, läsförståelse & kunskapsjakt",
    hint: "Flervalsfrågor med källtext",
  },
  {
    id: "pairs",
    emoji: "🧩",
    label: "Para ihop & memory",
    hint: "Begrepp och förklaringar i text",
  },
  {
    id: "bildpar",
    emoji: "🖼️",
    label: "Bildpar",
    hint: "Matcha en färdig bild mot text (t.ex. partisymboler)",
  },
];

const EXERCISE_TYPE_IDS = EXERCISE_TYPES.map((t) => t.id);

/**
 * Rensa en lista med typ-id: behåll bara kända id, utan dubbletter, i kanonisk
 * ordning. Ogiltig indata ger en tom lista.
 * @param {*} types
 * @returns {string[]}
 */
export function normalizeExerciseTypes(types) {
  const set = new Set((Array.isArray(types) ? types : []).map((t) => String(t || "").trim()));
  return EXERCISE_TYPE_IDS.filter((id) => set.has(id));
}

/**
 * Härled övningstyper ur ett områdes faktiska innehåll. Används som fallback för
 * äldre områden som sparats innan "exerciseTypes"-fältet fanns.
 * @param {object} area – { quiz?: [], pairs?: [] }
 * @returns {string[]}
 */
export function deriveExerciseTypes(area) {
  const quiz = Array.isArray(area?.quiz) ? area.quiz : [];
  const pairs = Array.isArray(area?.pairs) ? area.pairs : [];
  const out = [];
  if (quiz.length > 0) out.push("quiz");
  if (pairs.length > 0) out.push("pairs");
  if (pairs.some((p) => p && (p.termImage || p.defImage))) out.push("bildpar");
  return normalizeExerciseTypes(out);
}

/**
 * Ett områdes övningstyper: uttryckligt sparade om de finns, annars härledda ur
 * innehållet (bakåtkompatibelt).
 * @param {object} area
 * @returns {string[]}
 */
export function areaExerciseTypes(area) {
  const stored = normalizeExerciseTypes(area?.exerciseTypes);
  return stored.length > 0 ? stored : deriveExerciseTypes(area);
}
