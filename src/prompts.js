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

// Skalningsregler: mängden övningsinnehåll ska växa med hur mycket text läraren
// matar in, så att en lång text inte ger ett tunt övningsmaterial.
const SKALA_QUIZ = `Anpassa ANTALET quizfrågor efter hur mycket text du fått:
- Kort text (ungefär 1 stycke): 5–6 frågor.
- Medellång text (ungefär en halv sida): 8–10 frågor.
- Lång text (ungefär en sida eller mer): 12–15 frågor.
- Är texten ännu längre? Fortsätt lägga till frågor i samma takt (ca 3–4 frågor per halvsida).
Täck HELA texten jämnt – ta med frågor från början, mitten och slutet, inte bara det första stycket.
Undvik upprepade frågor och triviala frågor som eleven kan svara på utan att ha läst texten.`;

const SKALA_PAR = `Anpassa ANTALET fakta-par efter hur mycket text du fått:
- Kort text: minst 6 par.
- Medellång text: 8–10 par.
- Lång text (en sida eller mer): 12–15 par.
Välj de viktigaste begreppen från HELA texten, inte bara början. Undvik dubbletter.`;

const SKALA_TEXTER = `Anpassa ANTALET faktatexter efter hur mycket material du fått:
- Kort text: 1–2 faktatexter.
- Medellång text: 2–3 faktatexter.
- Lång text (en sida eller mer): 3–5 faktatexter.
Dela upp innehållet i tydliga delämnen så att hela materialet täcks.`;

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

Här är materialet du ska utgå ifrån:
<<< KLISTRA IN DIN LEKTIONSTEXT HÄR, eller bifoga en PDF >>>`;

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
