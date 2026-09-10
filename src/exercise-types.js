// ============================================================================
// Pluggportalen – övningstyper per arbetsområde (exercise-types.js)
// ----------------------------------------------------------------------------
// Läraren väljer vilka typer av övningar ett arbetsområde ska ha. Valet sparas
// på området (fältet "exerciseTypes") och styr dessutom AI-prompten som skapar
// innehållet (se buildAreaPrompt i src/prompts.js) – så att AI:n bara ombeds
// skapa passande innehåll (t.ex. inga bildpar om det inte kryssats i).
//
// Typerna mappar mot elevens spellägen (se GAMEMODES i src/game-shared.js):
//   • "quiz"     → Quiz, Läsförståelse och Kunskapsjakt (kräver quiz-innehåll)
//   • "pairs"    → Para ihop och Memory (kräver fakta-par)
//   • "bildpar"  → fakta-par som visar en färdig bild i stället för text
//                  (delmängd av "pairs" – kräver alltså också fakta-par)
//   • "generator"→ ETT genererat räkne-område (issue #279). Inget färdigt
//                  innehåll sparas – i stället lagras area.generator =
//                  { topic, variants, grade } och uppgifterna genereras på
//                  begäran via matte-generator-adaptern (#278). Tänder räkna-
//                  läget, INTE quiz/par-lägena (de kräver text/par).
// Arkad-läget "Fånga sanningar" (sanningsjakt) härleder påståenden ur BÅDA
// källorna: minst 2 textpar, annars quiz. Det syns alltså så fort området har
// antingen quiz eller (minst två) fakta-par – ingen egen övningstyp behövs.
//
// VIKTIGT (grötskydd): generator-innehåll är en EGEN väg. Varianter (enkel,
// uppställning, decimaler …) är INNEHÅLL – vilka slags tal – inte spellägen.
// quiz[]/pairs[]-antagandena rörs inte; ett generator-område har inga sådana.
// ============================================================================

import { listTopics, listVariants } from "./matte-generator.js";
import { normalizeGrade } from "./grades.js";

/** De valbara övningstyperna, i visnings-/kanonisk ordning. */
export const EXERCISE_TYPES = [
  {
    id: "quiz",
    emoji: "❓",
    label: "Quiz, läsförståelse, kunskapsjakt & fånga sanningar",
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
  {
    id: "generator",
    emoji: "🔢",
    label: "Räknegenerator (matte)",
    hint: "Automatiskt genererade räkneuppgifter – välj tal-typ och varianter",
    // Genereras (inte AI-författat/inklistrat) – har en EGEN lärar-kontroll och
    // ingår därför inte i AI-prompt-rutans kryssruterad (jfr teacher-content-view.js).
    generated: true,
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
 * @param {object} area – { quiz?: [], pairs?: [], generator?: {...} }
 * @returns {string[]}
 */
export function deriveExerciseTypes(area) {
  const quiz = Array.isArray(area?.quiz) ? area.quiz : [];
  const pairs = Array.isArray(area?.pairs) ? area.pairs : [];
  const out = [];
  if (quiz.length > 0) out.push("quiz");
  if (pairs.length > 0) out.push("pairs");
  if (pairs.some((p) => p && (p.termImage || p.defImage))) out.push("bildpar");
  // Generator-innehåll: en giltig area.generator (topic + minst en variant) gör
  // området till ett generator-område. Håll isär från quiz/pairs ovan.
  if (hasGeneratorContent(area)) out.push("generator");
  return normalizeExerciseTypes(out);
}

// ---------------------------------------------------------------------------
//  Generator-innehåll (issue #279)
// ---------------------------------------------------------------------------
// Ett generator-område lagrar area.generator = { topic, variants, grade? }.
// topic + varianter valideras mot matte-generator-adapterns publika gränssnitt
// (#278) så bara kända värden sparas. Inget färdigt innehåll (quiz/pairs) finns.

/**
 * Rensa/validera en generator-konfiguration mot adapterns topics/varianter.
 * @param {*} raw – { topic, variants, grade? }
 * @returns {{topic:string, variants:string[], grade?:string}|null}
 *   null om topic är okänt eller ingen giltig variant är vald.
 */
export function normalizeGenerator(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const topic = String(raw.topic || "").trim();
  if (!listTopics().includes(topic)) return null;

  const valid = new Set(listVariants(topic));
  const seen = new Set();
  const variants = (Array.isArray(raw.variants) ? raw.variants : [])
    .map((v) => String(v || "").trim())
    .filter((v) => valid.has(v) && !seen.has(v) && (seen.add(v), true));
  if (variants.length === 0) return null; // minst en variant krävs

  const out = { topic, variants };
  // Årskurs är valfri styrning (jfr grades.js) – tas bara med när den är satt.
  const grade = normalizeGrade(raw.grade);
  if (grade) out.grade = grade;
  return out;
}

/**
 * Har området giltigt generator-innehåll (en normaliserbar area.generator)?
 * @param {object} area
 * @returns {boolean}
 */
export function hasGeneratorContent(area) {
  return normalizeGenerator(area?.generator) !== null;
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
