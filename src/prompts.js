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

import { listPairImageKeys } from "./pair-images.js";

// Punktlista över de inbyggda bildnycklarna (partisymbol-paketet), så att
// schemat/exemplen alltid matchar pair-images.js utan manuell synk.
const BILDNYCKLAR = listPairImageKeys()
  .map((x) => `    * "${x.key}" – ${x.name}`)
  .join("\n");

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
      "answerIndex": number, "explanation": string, "passage": string }
    * "options" ska ha exakt 4 alternativ (minst 2), alla olika och rimliga.
      Undvik svarsalternativ som "alla ovanstående" eller "vet ej".
    * "answerIndex" är 0-baserat index i "options" för det RÄTTA svaret
      (0 = första alternativet, 1 = andra, osv.). Kontrollera att talet verkligen
      pekar på det alternativ som är rätt.
    * "explanation" förklarar kort (1–2 meningar) varför svaret är rätt.
    * "passage" är källtexten som JUST DEN frågan bygger på: 3–5 fullständiga
      meningar hämtade ur materialet, formulerade så att eleven kan besvara frågan
      enbart utifrån passagen. Visas ovanför frågan i läsförståelse-läget.
      OBLIGATORISK för läsförståelse – varje fråga MÅSTE ha en egen passage, och
      samma passage får inte återanvändas ordagrant till flera frågor. Frågan och
      alternativen ska vara helt begripliga utifrån frågans egen passage: hänvisa
      ALDRIG till "texten ovan", "enligt texten" eller liknande om inte den texten
      finns i just denna frågas passage. (Endast för ett rent quiz utan läsförståelse
      får "passage" utelämnas – men alla prompter här skapar quiz som även används
      som läsförståelse, så ta alltid med passage.)
- "pairs": lista med fakta-par (begrepp ↔ förklaring). Varje par:
    { "id": string, "term": string, "definition": string,
      "termImage": string, "defImage": string, "group": string }
    * "term" är begreppet, "definition" förklaringen. Vanliga par har bara dessa två.
    * "group" är VALFRI. Par med samma "group" visas aldrig samtidigt i en och samma
      spelomgång (Para ihop/Memory plockar högst ett par per group) – använd den för att
      undvika att två varianter av samma sak dyker upp tillsammans. Utelämna den annars.
    * "termImage"/"defImage" är VALFRIA och används för BILDPAR: i stället för (eller
      utöver) text visas en färdig bild på term- respektive definition-sidan. Fältet
      anges som en NYCKEL in i det inbyggda bildpaketet – ladda inte upp egna bilder.
      Använd bildpar när eleven ska matcha en bild mot en text, t.ex. en partisymbol
      mot partinamnet: sätt "termImage" till symbolens nyckel och "definition" till namnet
      (lämna då "term" som "").
    * Varje sida (term/definition) måste ha ANTINGEN text ELLER bild (eller båda).
    * Tillgängliga bildnycklar just nu (partisymbol-paketet, riksdagens 8 partier):
${BILDNYCKLAR}
      Skriv nyckeln EXAKT som ovan. Andra nycklar finns inte – använd bara text om det
      inte passar en av dessa. (Fler bildpaket för andra ämnen/moment kan tillkomma senare.)`;

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
      "explanation": "Vikingatiden räknas från cirka år 800 till 1050.",
      "passage": "Vikingarna levde i Norden för mer än tusen år sedan. Tiden då de levde kallas för vikingatiden. Vikingatiden brukar räknas från ungefär år 800 till år 1050. Det var alltså mycket längre sedan än när dina far- och morföräldrar levde."
    }
  ],
  "pairs": [
    { "id": "p1", "term": "Oden", "definition": "Gudarnas kung, gud för visdom och krig" },
    { "id": "p2", "term": "Långskepp", "definition": "Vikingarnas långa, smala segelskepp" },
    { "id": "p3", "term": "", "termImage": "partier/s", "definition": "Socialdemokraterna" }
  ]
}`;

// Kommentar (ej del av JSON:en): sista paret ovan är ett BILDPAR – "termImage"
// pekar på en färdig partisymbol och matchas mot partinamnet i "definition".
// Bildpar fungerar i vilket arbetsområde som helst; just nu finns
// partisymbol-nycklarna (se listan i schemat).

// Skalningsregler: mängden övningsinnehåll ska växa med hur mycket text läraren
// matar in, så att en lång text inte ger ett tunt övningsmaterial.
const SKALA_QUIZ = `Anpassa ANTALET quizfrågor efter hur mycket text du fått:
- Kort text (ungefär 1 stycke): 5–6 frågor.
- Medellång text (ungefär en halv sida): 8–10 frågor.
- Lång text (ungefär en sida eller mer): 12–15 frågor.
- Är texten ännu längre? Fortsätt lägga till frågor i samma takt (ca 3–4 frågor per halvsida).
Täck HELA texten jämnt – ta med frågor från början, mitten och slutet, inte bara det första stycket.
Undvik upprepade frågor och triviala frågor som eleven kan svara på utan att ha läst texten.
Ge VARJE fråga ett "passage" (OBLIGATORISKT): en källtext på 3–5 fullständiga meningar hämtad ur
materialet, som just den frågan kan besvaras enbart utifrån. Skriv en egen, passande passage per
fråga (inte bara en enda mening, och upprepa inte samma text ordagrant till alla frågor). Frågan
och svarsalternativen får INTE hänvisa till text utanför frågans egen passage ("enligt texten
ovan" utan medskickad text är förbjudet). Passagen används i läsförståelse-läget och visas
ovanför frågan – en fråga utan passage godkänns inte i läsförståelse.`;

const SKALA_PAR = `Anpassa ANTALET fakta-par efter hur mycket text du fått:
- Kort text: minst 6 par.
- Medellång text: 8–10 par.
- Lång text (en sida eller mer): 12–15 par.
Välj de viktigaste begreppen från HELA texten, inte bara början. Undvik dubbletter.
BILDPAR (valfritt): passar temat en bild i det inbyggda paketet kan du göra ett bildpar –
sätt "termImage"/"defImage" till en bildnyckel (se listan i schemat) och matcha mot texten
på andra sidan. Exempel: en partisymbol matchas mot partinamnet. Hitta INTE på nya nycklar –
använd bara de som finns; passar ingen bild, gör vanliga text-par.`;

const SKALA_TEXTER = `Anpassa ANTALET faktatexter efter hur mycket material du fått:
- Kort text: 1–2 faktatexter.
- Medellång text: 2–3 faktatexter.
- Lång text (en sida eller mer): 3–5 faktatexter.
Dela upp innehållet i tydliga delämnen så att hela materialet täcks.`;

// Slut-blocket där läraren bifogar sitt material. Definieras EN gång så att
// buildPromptWith() kan hitta och ev. ersätta det i alla tre prompterna.
export const MATERIAL_ANCHOR = `Här är materialet du ska utgå ifrån:
<<< KLISTRA IN DIN LEKTIONSTEXT HÄR, eller bifoga en PDF >>>`;

const REGLER = `Viktiga regler:
- Svara med ENBART giltig JSON – ingen förklarande text före eller efter, inga \`\`\`-kodstaket.
- Använd dubbla citattecken runt alla nycklar och strängar. Inga avslutande kommatecken.
- Skriv på svenska och anpassa språket till elever i årskurs 4 (ca 10 år): korta meningar, enkla ord.
- Hitta INTE på fakta. Använd bara innehållet i det bifogade materialet / texten nedan.
- Varje quizfråga: exakt 4 svarsalternativ (alla olika och rimliga) och "answerIndex" 0-baserat
  som pekar på det rätta alternativet (0 = första). Dubbelkolla att rätt svar ligger på det indexet.
- Varje fråga ska gå att svara på fristående – hänvisa inte till andra frågor eller till text som
  inte visas. I läsförståelse betyder det att frågan besvaras utifrån frågans egna "passage".
- Håll texter lagom korta: "passage" 3–5 meningar, "explanation" 1–2 meningar, alternativ korta.
- Skriv INTE ledtrådar i själva frågan om vilket alternativ som är rätt.`;

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
  const block = `Lärarens önskemål (ingen text/PDF bifogas – utgå från beskrivningen nedan):
"${text}"
Skapa lämpligt, faktakorrekt och åldersanpassat innehåll för detta utifrån reglerna ovan. Eftersom inget material bifogas får du använda allmän, korrekt ämneskunskap om det efterfrågade ämnet. Hitta inte på felaktiga fakta.`;
  return promptText.replace(MATERIAL_ANCHOR, block);
}
