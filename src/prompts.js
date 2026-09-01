// ============================================================================
// Pluggportalen – AI-prompter (prompts.js)
// ----------------------------------------------------------------------------
// Färdiga prompter som läraren kopierar och klistrar in i valfri AI
// (ChatGPT, Claude, Gemini ...) tillsammans med en PDF eller inklistrad
// lektionstext. AI:n svarar med en JSON i EXAKT det format som lärarsidans
// innehållsinmatning validerar (se src/validate.js och docs/DATAMODELL.md).
//
// Varje prompt innehåller schemat + ett komplett exempel, så att den genererade
// JSON:en passerar valideringen direkt.
// ============================================================================

// Schemabeskrivning som stoppas in i prompterna.
const SCHEMA = `Objektet (ETT arbetsområde) har fälten:
- "id": string – kort id i gemener med bindestreck, t.ex. "vikingatiden". (Får utelämnas; skapas då från namnet.)
- "name": string – arbetsområdets namn, t.ex. "Vikingatiden". (Obligatoriskt.)
- "order": number – sorteringsordning, t.ex. 1. (Får utelämnas.)
- "coverEmoji": string – en emoji som symbol, t.ex. "🛶".
- "description": string – en kort beskrivning på 1–2 meningar.
- "texts": lista med faktatexter. Varje text: { "id": string, "title": string, "body": string }
- "quiz": lista med flervalsfrågor. Varje fråga:
    { "id": string, "question": string, "options": [string, ...],
      "answerIndex": number, "explanation": string }
    * "options" måste ha minst 2 alternativ.
    * "answerIndex" är index (0 = första alternativet) för det RÄTTA svaret.
    * "explanation" förklarar kort varför svaret är rätt.
- "pairs": lista med fakta-par (begrepp ↔ förklaring). Varje par:
    { "id": string, "term": string, "definition": string }`;

const EXAMPLE = `{
  "id": "vikingatiden",
  "name": "Vikingatiden",
  "order": 1,
  "coverEmoji": "🛶",
  "description": "Lär dig om vikingarna – hur de levde, reste och trodde.",
  "texts": [
    {
      "id": "vem-var-vikingarna",
      "title": "Vilka var vikingarna?",
      "body": "Vikingarna levde i Norden för mer än tusen år sedan, ungefär mellan år 800 och 1050. De flesta var bönder, men de är mest kända för sina resor med snabba skepp."
    }
  ],
  "quiz": [
    {
      "id": "q1",
      "question": "Ungefär när levde vikingarna?",
      "options": ["År 800–1050", "År 1500–1700", "År 0–200", "Idag"],
      "answerIndex": 0,
      "explanation": "Vikingatiden räknas från cirka år 800 till 1050."
    }
  ],
  "pairs": [
    { "id": "p1", "term": "Oden", "definition": "Gudarnas kung, gud för visdom och krig" },
    { "id": "p2", "term": "Långskepp", "definition": "Vikingarnas långa, smala segelskepp" }
  ]
}`;

const REGLER = `Viktiga regler:
- Svara med ENBART giltig JSON – ingen förklarande text före eller efter, inga \`\`\`-kodstaket.
- Använd dubbla citattecken runt alla nycklar och strängar. Inga avslutande kommatecken.
- Skriv på svenska och anpassa språket till elever i årskurs 4 (ca 10 år): korta meningar, enkla ord.
- Hitta INTE på fakta. Använd bara innehållet i det bifogade materialet / texten nedan.`;

/**
 * Prompt: komplett arbetsområde (texter + quiz + fakta-par).
 */
export const PROMPT_KOMPLETT = `Du hjälper en lärare att skapa studiematerial för en studiesajt för årskurs 4.

Utifrån den bifogade PDF:en / texten nedan ska du skapa ETT arbetsområde som JSON i exakt det här formatet.

${SCHEMA}

Innehållskrav:
- 2–4 faktatexter (varje "body" ca 3–6 meningar).
- 5–8 quizfrågor med 4 svarsalternativ vardera.
- 6–10 fakta-par (begrepp ↔ kort förklaring).

${REGLER}

Exempel på hur svaret ska se ut (följ formatet, byt ut innehållet):
${EXAMPLE}

Här är materialet du ska utgå ifrån:
<<< KLISTRA IN DIN LEKTIONSTEXT HÄR, eller bifoga en PDF >>>`;

/**
 * Prompt: bara quizfrågor.
 */
export const PROMPT_QUIZ = `Du hjälper en lärare att skapa quizfrågor för en studiesajt för årskurs 4.

Utifrån den bifogade PDF:en / texten nedan ska du skapa ETT arbetsområde som JSON, men fyll BARA i "quiz"-listan (låt "texts" och "pairs" vara tomma listor []).

${SCHEMA}

Innehållskrav:
- 8–10 quizfrågor med 4 svarsalternativ vardera.
- Variera svårighetsgraden. "answerIndex" ska peka på det rätta alternativet.

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
      "explanation": "Vikingatiden räknas från cirka år 800 till 1050."
    }
  ],
  "pairs": []
}

Här är materialet du ska utgå ifrån:
<<< KLISTRA IN DIN LEKTIONSTEXT HÄR, eller bifoga en PDF >>>`;

/**
 * Prompt: bara fakta-par.
 */
export const PROMPT_PAR = `Du hjälper en lärare att skapa fakta-par (begrepp ↔ förklaring) för en studiesajt för årskurs 4.

Utifrån den bifogade PDF:en / texten nedan ska du skapa ETT arbetsområde som JSON, men fyll BARA i "pairs"-listan (låt "texts" och "quiz" vara tomma listor []).

${SCHEMA}

Innehållskrav:
- 8–12 fakta-par. "term" är ett kort begrepp, "definition" en kort förklaring (max en mening).

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
    { "id": "p2", "term": "Långskepp", "definition": "Vikingarnas långa, smala segelskepp" }
  ]
}

Här är materialet du ska utgå ifrån:
<<< KLISTRA IN DIN LEKTIONSTEXT HÄR, eller bifoga en PDF >>>`;

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
