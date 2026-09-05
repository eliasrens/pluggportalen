// ============================================================================
// Pluggportalen – AI-prompter (prompts.js)
// ----------------------------------------------------------------------------
// Färdiga prompter som läraren kopierar och klistrar in i valfri AI
// (ChatGPT, Claude, Gemini ...) tillsammans med en PDF eller inklistrad
// lektionstext. AI:n svarar med en JSON i EXAKT det format som lärarsidans
// innehållsinmatning validerar (se src/validate.js och docs/DATAMODELL.md).
//
// Varje prompt innehåller schemat + ett komplett exempel, så att den genererade
// JSON:en passerar valideringen direkt. Textfragmenten (schema/regler/exempel)
// bor i src/prompt-parts.js – här komponeras de bara ihop.
// ============================================================================

import { normalizeExerciseTypes } from "./exercise-types.js";
import {
  SCHEMA,
  EXAMPLE,
  SKALA_QUIZ,
  SKALA_PAR,
  SKALA_PAR_BAS,
  SKALA_PAR_BILDPAR,
  SKALA_PAR_INGA_BILDPAR,
  SKALA_TEXTER,
  MATERIAL_ANCHOR,
  REGLER,
  materialBlock,
  areaExample,
} from "./prompt-parts.js";

// Re-exporteras för bakåtkompatibilitet (tidigare definierad här).
export { MATERIAL_ANCHOR };

/**
 * Prompt: komplett arbetsområde (texter + quiz + fakta-par).
 */
export const PROMPT_KOMPLETT = `Du hjälper en lärare att skapa studiematerial för en studiesajt för årskurs 4.

Utifrån den bifogade PDF:en / texten nedan ska du skapa ETT arbetsområde som JSON i exakt det här formatet.

${SCHEMA}

Innehållskrav (mängden ska VÄXA med hur mycket text du fått – ju mer text, desto fler frågor och par):
- Faktatexter (varje "body" ca 3–6 meningar):
${SKALA_TEXTER}
- Quizfrågor med 4 svarsalternativ vardera:
${SKALA_QUIZ}
- Fakta-par (begrepp ↔ kort förklaring):
${SKALA_PAR}

${REGLER}

Exempel på hur svaret ska se ut (följ formatet, byt ut innehållet):
${EXAMPLE}

${MATERIAL_ANCHOR}`;

/**
 * Prompt: bara quizfrågor.
 */
export const PROMPT_QUIZ = `Du hjälper en lärare att skapa quizfrågor för en studiesajt för årskurs 4.

Utifrån den bifogade PDF:en / texten nedan ska du skapa ETT arbetsområde som JSON, men fyll BARA i "quiz"-listan (låt "texts" och "pairs" vara tomma listor []).

${SCHEMA}

Innehållskrav (antalet frågor ska VÄXA med hur mycket text du fått):
${SKALA_QUIZ}
- Alla frågor har 4 svarsalternativ. Variera svårighetsgraden. "answerIndex" ska peka på det rätta alternativet.

${REGLER}

Exempel på hur svaret ska se ut (följ formatet, byt ut innehållet):
{
  "name": "Vikingatiden",
  "coverEmoji": "🛶",
  "description": "Quiz om vikingarna.",
  "texts": [],
  "quiz": [
    {
      "id": "q1",
      "question": "Ungefär när levde vikingarna?",
      "options": ["År 800–1050", "År 1500–1700", "År 0–200", "Idag"],
      "answerIndex": 0,
      "explanation": "Vikingatiden räknas från cirka år 800 till 1050.",
      "passage": "Vikingarna levde i Norden för mer än tusen år sedan. Tiden då de levde kallas för vikingatiden. Vikingatiden brukar räknas från ungefär år 800 till år 1050. Det var alltså mycket längre sedan än när dina far- och morföräldrar levde."
    }
  ],
  "pairs": []
}

${MATERIAL_ANCHOR}`;

/**
 * Prompt: bara fakta-par.
 */
export const PROMPT_PAR = `Du hjälper en lärare att skapa fakta-par (begrepp ↔ förklaring) för en studiesajt för årskurs 4.

Utifrån den bifogade PDF:en / texten nedan ska du skapa ETT arbetsområde som JSON, men fyll BARA i "pairs"-listan (låt "texts" och "quiz" vara tomma listor []).

${SCHEMA}

Innehållskrav (antalet par ska VÄXA med hur mycket text du fått):
${SKALA_PAR}
- "term" är ett kort begrepp, "definition" en kort förklaring (max en mening).

${REGLER}

Exempel på hur svaret ska se ut (följ formatet, byt ut innehållet):
{
  "name": "Vikingatiden",
  "coverEmoji": "🛶",
  "description": "Begrepp om vikingarna.",
  "texts": [],
  "quiz": [],
  "pairs": [
    { "id": "p1", "term": "Oden", "definition": "Gudarnas kung, gud för visdom och krig" },
    { "id": "p2", "term": "Långskepp", "definition": "Vikingarnas långa, smala segelskepp" },
    { "id": "p3", "term": "", "termImage": "partier/s", "definition": "Socialdemokraterna" }
  ]
}
(Sista paret visar ett bildpar – ta bara med sådana om en bildnyckel i listan passar temat.)

${MATERIAL_ANCHOR}`;

/** Lista för rendering på prompt-sidan. */
export const PROMPTS = [
  {
    id: "komplett",
    title: "Komplett arbetsområde",
    emoji: "📦",
    desc: "Texter, quizfrågor och fakta-par – allt på en gång. Bäst när du har ett nytt tema.",
    text: PROMPT_KOMPLETT,
  },
  {
    id: "quiz",
    title: "Bara quizfrågor",
    emoji: "❓",
    desc: "Genererar enbart flervalsfrågor. Bra som komplement till ett befintligt område.",
    text: PROMPT_QUIZ,
  },
  {
    id: "par",
    title: "Bara fakta-par",
    emoji: "🔗",
    desc: "Genererar enbart begrepp och förklaringar för para ihop / memory.",
    text: PROMPT_PAR,
  },
];

// Exempel-JSON som även innehållssidan kan visa som mall.
export const EXAMPLE_JSON = EXAMPLE;

/**
 * Vävar in ett fritext-önskemål i en prompt.
 *
 * Är önskemålet tomt returneras prompten OFÖRÄNDRAD (platshållaren för
 * PDF/text är kvar – exakt dagens beteende). Har läraren skrivit ett önskemål
 * ersätts slut-blocket (MATERIAL_ANCHOR) med ett önskemåls-block så att AI:n
 * genererar innehåll utifrån beskrivningen istället för utifrån bifogat material.
 * Önskemåls-blocket säger uttryckligen att AI:n får använda allmän, korrekt
 * ämneskunskap, så att det inte krockar med "använd bara bifogat material"-regeln.
 *
 * @param {string} promptText – en av PROMPTS[].text.
 * @param {string} onskemal – lärarens fritext (får vara tom/undefined).
 * @returns {string} färdig prompt att kopiera.
 */
export function buildPromptWith(promptText, onskemal) {
  const text = (onskemal || "").trim();
  if (!text) return promptText;
  return promptText.replace(MATERIAL_ANCHOR, materialBlock(onskemal));
}

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
 * @param {string} [onskemal] – valfritt fritext-önskemål (samma som prompt-sidan).
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
