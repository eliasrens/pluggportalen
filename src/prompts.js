// ============================================================================
// Pluggporten – AI-prompter (prompts.js)
// ----------------------------------------------------------------------------
// Läraren bygger en prompt på innehållssidan (#/larare/innehall): hen kryssar i
// vilka övningstyper området ska ha och får en prompt som är anpassad efter just
// de valen. Prompten klistras in i valfri AI (ChatGPT, Claude, Gemini ...)
// tillsammans med en PDF/lektionstext eller ett eget önskemål. AI:n svarar med
// en JSON i EXAKT det format som lärarsidans innehållsinmatning validerar
// (se src/validate.js och docs/DATAMODELL.md).
//
// Prompten innehåller schemat + ett komplett exempel, så att den genererade
// JSON:en passerar valideringen direkt. Textfragmenten (schema/regler/exempel)
// bor i src/prompt-parts.js – här komponeras de bara ihop.
//
// Tidigare fanns även en fristående prompt-sida med tre statiska prompter
// (komplett/quiz/par). Den var redundant med den dynamiska byggaren nedan och
// togs bort (issue #62) – buildAreaPrompt täcker alla tre fallen via valen.
// ============================================================================

import { normalizeExerciseTypes, areaExerciseTypes } from "./exercise-types.js";
import { gradeNr, gradeAge, DEFAULT_GRADE_NR } from "./grades.js";
import {
  SCHEMA,
  EXAMPLE,
  SKALA_QUIZ,
  SKALA_PAR_BAS,
  SKALA_PAR_BILDPAR,
  SKALA_PAR_INGA_BILDPAR,
  SKALA_TEXTER,
  REGLER,
  materialBlock,
  areaExample,
} from "./prompt-parts.js";
import { EXISTING_MAX_CHARS, existingContentBlock, generatorContext } from "./prompt-existing.js";

// Exempel-JSON som innehållssidan visar som mall ("Visa exempel-JSON").
export const EXAMPLE_JSON = EXAMPLE;

/**
 * Bygg en komplett områdes-prompt som speglar de valda övningstyperna.
 *
 * AI:n ombeds bara skapa innehåll för de valda typerna – övriga listor ska vara
 * tomma. Bildpar-instruktionerna tas bara med om "bildpar" valts; annars förbjuds
 * bildpar uttryckligen (och exemplet visar inget bildpar). Ett tomt/ogiltigt val
 * behandlas som "allt utom bildpar" (quiz + text-par), så knappen aldrig ger en
 * innehållslös prompt.
 *
 * Årskursen (om satt) styr språk, svårighetsgrad och exempel – men bara som en
 * styrning läraren kan sätta, inte tvingande (issue #145). Saknas den används
 * dagens standard (årskurs 4), så äldre områden får samma prompt som förut.
 *
 * @param {string[]} types – valda typ-id ("quiz", "pairs", "bildpar").
 * @param {string} [onskemal] – valfritt fritext-önskemål (vävs in i materialblocket).
 * @param {string|number|null} [grade] – årskurs ("ak1".."ak9" eller null).
 * @returns {string} färdig prompt att kopiera.
 */
export function buildAreaPrompt(types, onskemal, grade) {
  const set = new Set(normalizeExerciseTypes(types));
  const inget = set.size === 0;
  const wantQuiz = inget || set.has("quiz");
  const wantPairs = inget || set.has("pairs") || set.has("bildpar");
  const wantImages = set.has("bildpar");

  const valda = [
    wantQuiz && "quiz (Quiz, Läsförståelse och Kunskapsjakt)",
    wantPairs &&
      (wantImages
        ? "fakta-par inklusive bildpar (Para ihop och Memory)"
        : "fakta-par som text (Para ihop och Memory)"),
  ]
    .filter(Boolean)
    .join(", ");

  const krav = [`- Faktatexter (varje "body" ca 3–6 meningar):`, SKALA_TEXTER];
  if (wantQuiz) {
    krav.push("- Quizfrågor med 4 svarsalternativ vardera:", SKALA_QUIZ);
  } else {
    krav.push(`- Skapa INGA quizfrågor – låt "quiz" vara en tom lista [].`);
  }
  if (wantPairs) {
    krav.push("- Fakta-par (begrepp ↔ kort förklaring):", SKALA_PAR_BAS);
    krav.push(wantImages ? SKALA_PAR_BILDPAR : SKALA_PAR_INGA_BILDPAR);
  } else {
    krav.push(`- Skapa INGA fakta-par – låt "pairs" vara en tom lista [].`);
  }

  // Årskurs: sätt av läraren → styr språk/svårighetsgrad. Saknas den används
  // dagens standard (åk 4) så prompten ser likadan ut som förut.
  const nr = gradeNr(grade) ?? DEFAULT_GRADE_NR;
  const age = gradeAge(grade) ?? nr + 6;
  const gradniva = `Materialet riktar sig till elever i årskurs ${nr} (ca ${age} år). Anpassa språk, svårighetsgrad och exempel efter den årskursen – enklare och mer konkret för låga årskurser, mer nyanserat och abstrakt för höga. Detta är en styrning, inte en tvingande regel.`;

  return `Du hjälper en lärare att skapa studiematerial för en studiesajt för årskurs ${nr}.

Utifrån den bifogade PDF:en / texten nedan ska du skapa ETT arbetsområde som JSON i exakt det här formatet.
Läraren har valt vilka övningstyper området ska ha: ${valda}. Skapa BARA innehåll för de valda typerna – låt alla övriga listor vara tomma ([]).

${gradniva}

${SCHEMA}

Innehållskrav (mängden ska VÄXA med hur mycket text du fått – ju mer text, desto fler frågor och par):
${krav.join("\n")}

${REGLER}

Exempel på hur svaret ska se ut (följ formatet, byt ut innehållet):
${areaExample({ wantQuiz, wantPairs, wantImages })}

${materialBlock(onskemal)}`;
}

// Tak för "BEFINTLIGT INNEHÅLL"-blocket i tecken (#471, ersätter #453:s 40-radstak).
export const MORE_PROMPT_MAX_CHARS = EXISTING_MAX_CHARS;

/**
 * "Lägg till"-panelens prompt (issue #453): MER innehåll till ett BEFINTLIGT
 * område. Bygger på buildAreaPrompt OFÖRÄNDRAD (områdets typer + årskurs) och
 * lägger till ett tillägg som ber AI:n att bara svara med det nya. Issue #471:
 * HELA det befintliga innehållet (texter, quiz med alternativ/svar/kategori/
 * passage, par) skickas med som JSON så AI:n ser allt och inte
 * upprepar det; bara extrema områden kortas (EXISTING_MAX_CHARS, med notering).
 * Har området läsförståelse-frågor (quiz[].passage) ombeds AI:n göra fler av
 * samma slag. Räknegeneratorn är inget AI-innehåll och skickas inte med som typ –
 * men dess räknesätt (#470) nämns som kontext.
 *
 * @param {object} area – områdesdokumentet ({ name, grade, exerciseTypes, quiz, pairs, … }).
 * @param {string} [onskemal] – lärarens valfria önskemål, t.ex. "fler svåra frågor om handel".
 * @param {number} [maxChars] – tak för befintligt-blocket (för tester).
 * @returns {string}
 */
export function buildMorePrompt(area, onskemal, maxChars = EXISTING_MAX_CHARS) {
  const name = String(area?.name || "arbetsområdet").trim();
  const types = areaExerciseTypes(area).filter((t) => t !== "generator");
  const extra = String(onskemal || "").trim();
  const bas = buildAreaPrompt(
    types,
    `Mer innehåll till det befintliga arbetsområdet "${name}"${extra ? `. Önskemål: ${extra}` : ""}`,
    area?.grade ?? null
  );

  const befintligt = existingContentBlock(
    area,
    ["texts", "quiz", "pairs"],
    `allt detta finns redan i "${name}" (samma JSON-format som ovan; "answerIndex" pekar ut rätt svar):`,
    maxChars
  );
  const harPassage = (area?.quiz || []).some((q) => q && String(q.passage || "").trim());
  const generator = generatorContext(area);

  const krav = [
    `- Svara med samma JSON-format som ovan, men ta BARA med det NYA innehållet (nya "texts", "quiz" och/eller "pairs"). Behåll "name": "${name}".`,
    befintligt && "- Läs igenom det befintliga innehållet nedan och bygg vidare i samma stil, ton och svårighetsnivå.",
    "- Upprepa INTE det som redan finns i området, och skriv inga nära varianter av det (samma fråga med andra ord, samma begrepp, samma faktapåstående).",
    "- Hitta inte på nya övningstyper – skapa bara innehåll för de typer som anges ovan.",
  ].filter(Boolean);
  if (harPassage) {
    krav.push(
      `- Området används för läsförståelse: varje ny quizfråga MÅSTE ha en egen "passage" (3–5 meningar) precis som de befintliga frågorna – gör fler frågor av samma slag.`
    );
  }
  if (generator) krav.push(`- ${generator}`);

  return `${bas}

VIKTIGT – detta gäller MER innehåll till ett BEFINTLIGT arbetsområde ("${name}"), inte ett nytt område.
${krav.join("\n")}${befintligt ? `\n\n${befintligt}` : ""}`;
}
