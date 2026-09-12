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
//  Generator-katalog (issue #290)
// ---------------------------------------------------------------------------
// KATALOGEN – vilka topics och varianter matte-generator-adaptern (#278) erbjuder –
// bor HÄR, inte i matte-generator.js. Skälet är boot-säkerhet: den här filen ligger
// i den STATISKA bootgrafen (app.js → … → exercise-types.js) och laddas av ALLA
// användare vid boot. Om vi importerade matte-generator.js statiskt härifrån (som
// tidigare) drogs hela adaptern + dess plugin-lager in i bootgrafen – exakt
// #271-mönstret (en ny fil som 404:ar under en icke-atomär Pages-deploy → vit sida
// för alla). Katalogen är BARA namn/ordning (ingen generatorlogik), så den kan bo i
// bootgrafen utan att dra in adaptern. Den TUNGA vägen (generateProblem) laddas i
// stället dynamiskt via rakna-core.js.
//
// SINGLE SOURCE OF TRUTH: adaptern (matte-generator.js) håller sin egen VARIANTS-
// tabell (med motor-force/minGrade). Att katalogen här och adapterns tabell är
// IDENTISKA (samma topics, samma varianter, samma ordning) asserteras av
// test/matte-generator.test.js ("katalogen matchar adaptern") så de aldrig driftar isär.
// FAS 2 (issue #295): katalogen surfar bara de SPELBARA topics/varianter (de vars
// uppgift är självbärande + har ett otvetydigt numeriskt svar som räkna-läget
// rättar). Adaptern porterar ÄVEN visuella/icke-numeriska topics (klocka, geometri,
// koordinatsystem, statistik, sannolikhet, symmetri, mönster, bråk, talsorter) men
// de exponeras INTE här förrän de fått egen rendering/svarswidget. Ordning + innehåll
// asserteras mot adapterns listTopics()/listVariants() i test/matte-generator.test.js.
const GENERATOR_CATALOG = {
  addition: ["enkel", "uppstallning", "flersteg", "decimaler"],
  subtraktion: ["enkel", "uppstallning", "decimaler"],
  multiplikation: ["tabeller", "tiopotens", "stora-tal", "dubbelt", "bild", "decimaler"],
  division: ["tabeller", "rest", "tiopotens", "stora-tal", "halften", "decimaler"],
  tallinje: ["enkel"],
  talfoljd: ["nasta", "saknas"],
  "negativa-tal": ["temperatur", "rakna"],
  romerska: ["till-tal"],
  procent: ["av-heltal"],
  avrundning: ["tiotal", "hundratal"],
  prioritet: ["utan-parentes", "med-parentes"],
  "oppna-utsaga": ["addition", "subtraktion", "multiplikation", "division"],
  ekvationer: ["enstegs", "tvastegs", "geometri"],
  "matt-langd": ["omvandla"],
  "matt-vikt": ["omvandla"],
  "matt-tid": ["omvandla"],
  "matt-area": ["omvandla"],
  "matt-volym": ["omvandla", "addition", "subtraktion", "oppen"],
};

/** Alla topics som fas 1 stödjer, i visningsordning. */
export function listTopics() {
  return Object.keys(GENERATOR_CATALOG);
}

/** Variantnamnen för ett topic (tom array för okänt topic). */
export function listVariants(topic) {
  return [...(GENERATOR_CATALOG[topic] || [])];
}

// ---------------------------------------------------------------------------
//  Generator-innehåll (issue #279)
// ---------------------------------------------------------------------------
// Ett generator-område lagrar area.generator = { topic, variants, grade? }.
// topic + varianter valideras mot katalogen ovan (listTopics/listVariants) så bara
// kända värden sparas. Inget färdigt innehåll (quiz/pairs) finns.

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
