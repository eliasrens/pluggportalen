// ============================================================================
// Pluggportalen – AI-prompter (prompts.js)
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

import { normalizeExerciseTypes } from "./exercise-types.js";
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
 * @param {string[]} types – valda typ-id ("quiz", "pairs", "bildpar").
 * @param {string} [onskemal] – valfritt fritext-önskemål (vävs in i materialblocket).
 * @returns {string} färdig prompt att kopiera.
 */
export function buildAreaPrompt(types, onskemal) {
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

  return `Du hjälper en lärare att skapa studiematerial för en studiesajt för årskurs 4.

Utifrån den bifogade PDF:en / texten nedan ska du skapa ETT arbetsområde som JSON i exakt det här formatet.
Läraren har valt vilka övningstyper området ska ha: ${valda}. Skapa BARA innehåll för de valda typerna – låt alla övriga listor vara tomma ([]).

${SCHEMA}

Innehållskrav (mängden ska VÄXA med hur mycket text du fått – ju mer text, desto fler frågor och par):
${krav.join("\n")}

${REGLER}

Exempel på hur svaret ska se ut (följ formatet, byt ut innehållet):
${areaExample({ wantQuiz, wantPairs, wantImages })}

${materialBlock(onskemal)}`;
}
