// ============================================================================
// Pluggporten – byggstenar för AI-prompterna (prompt-parts.js)
// ----------------------------------------------------------------------------
// De återanvändbara textfragmenten (schema, skalningsregler, regler, exempel,
// material-block) som src/prompts.js sätter ihop till färdiga prompter. Bruten
// ut ur prompts.js så att prompt-sammansättningen och byggstenarna hålls isär
// (och håller filerna under radtaket). Ändra schemat/reglerna HÄR – prompts.js
// bara komponerar.
// ============================================================================

import { listPairImageKeys } from "./pair-images.js";
import { QUESTION_CATEGORY_KEYS } from "./exercise-types.js";

// Punktlista över de inbyggda bildnycklarna (partisymbol-paketet), så att
// schemat/exemplen alltid matchar pair-images.js utan manuell synk.
const BILDNYCKLAR = listPairImageKeys()
  .map((x) => `    * "${x.key}" – ${x.name}`)
  .join("\n");

// Frågekategorier (#445/#466): nycklarna hämtas ur QUESTION_CATEGORY_KEYS så att
// prompten och valideringen aldrig glider isär; här finns bara AI-förklaringen.
const KATEGORI_FORKLARING = {
  begrepp: "Begreppsförståelse – vad ett ord/begrepp betyder",
  fakta: "Fakta – vem, vad, var, när",
  analys: "Analys/resonemang – orsaker, följder och samband (varför?)",
};
const KATEGORI_NYCKLAR = QUESTION_CATEGORY_KEYS.map((k) => `"${k}"`).join(", ");
const KATEGORI_LISTA = QUESTION_CATEGORY_KEYS.map(
  (k) => `        · "${k}" = ${KATEGORI_FORKLARING[k] || k}`
).join("\n");

// Schemabeskrivning som stoppas in i prompterna.
export const SCHEMA = `Objektet (ETT arbetsområde) har fälten:
- "id": string – kort id i gemener med bindestreck, t.ex. "vikingatiden". (Får utelämnas; skapas då från namnet.)
- "name": string – arbetsområdets namn, t.ex. "Vikingatiden". (Obligatoriskt.)
- "order": number – sorteringsordning, t.ex. 1. (Får utelämnas.)
- "coverEmoji": string – en emoji som symbol, t.ex. "🛶".
- "description": string – en kort beskrivning på 1–2 meningar.
- "texts": lista med faktatexter. Varje text: { "id": string, "title": string, "body": string }
- "quiz": lista med flervalsfrågor. Varje fråga:
    { "id": string, "question": string, "options": [string, ...],
      "answerIndex": number, "explanation": string, "passage": string, "category": string }
    * "options" ska ha exakt 4 alternativ (minst 2), alla olika och rimliga.
      Undvik svarsalternativ som "alla ovanstående" eller "vet ej".
    * "answerIndex" är 0-baserat index i "options" för det RÄTTA svaret
      (0 = första alternativet, 1 = andra, osv.). Kontrollera att talet verkligen
      pekar på det alternativ som är rätt.
    * "explanation" förklarar kort (1–2 meningar) varför svaret är rätt.
    * "passage" är BAKGRUNDSINFORMATION till JUST DEN frågan: 3–5 fullständiga
      meningar hämtade ur materialet där svaret framgår. Visas ovanför frågan i
      läsförståelse-läget – men frågan visas också UTAN passage (Quiz, Live).
      OBLIGATORISK – varje fråga MÅSTE ha en egen passage, och samma passage får
      inte återanvändas ordagrant till flera frågor.
    * Varje quizfråga MÅSTE gå att besvara med rätt ämneskunskap UTAN att läsa
      passagen. Formuleringar som "enligt texten", "i texten", "texten ovan",
      "i stycket" eller "författaren" är FÖRBJUDNA – fråga om själva sakkunskapen
      (t.ex. "Vilka år räknas som vikingatiden?").
    * "category" anger vad frågan testar – EXAKT en av nycklarna ${KATEGORI_NYCKLAR}:
${KATEGORI_LISTA}
      OBLIGATORISK på varje fråga. Skriv nyckeln exakt (gemener). Sprid kategorierna
      rimligt – inte bara faktafrågor; ta med begreppsfrågor och analysfrågor (varför?).
- "pairs": lista med fakta-par (begrepp ↔ förklaring). Varje par:
    { "id": string, "term": string, "definition": string,
      "termImage": string, "defImage": string, "group": string, "category": string }
    * "term" är begreppet, "definition" förklaringen. Vanliga par har bara dessa två.
    * "group" är VALFRI. Par med samma "group" visas aldrig samtidigt i en och samma
      spelomgång (Para ihop/Memory plockar högst ett par per group) – använd den för att
      undvika att två varianter av samma sak dyker upp tillsammans. Utelämna den annars.
    * "category" anger vad paret testar, samma nycklar som för quiz (${KATEGORI_NYCKLAR}).
      Ett begrepp ↔ förklaring är normalt "begrepp"; ett faktapar (t.ex. årtal) "fakta".
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

export const EXAMPLE = `{
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
      "passage": "Vikingarna levde i Norden för mer än tusen år sedan. Tiden då de levde kallas för vikingatiden. Vikingatiden brukar räknas från ungefär år 800 till år 1050. Det var alltså mycket längre sedan än när dina far- och morföräldrar levde.",
      "category": "fakta"
    }
  ],
  "pairs": [
    { "id": "p1", "term": "Oden", "definition": "Gudarnas kung, gud för visdom och krig", "category": "fakta" },
    { "id": "p2", "term": "Långskepp", "definition": "Vikingarnas långa, smala segelskepp", "category": "begrepp" },
    { "id": "p3", "term": "", "termImage": "partier/s", "definition": "Socialdemokraterna", "category": "fakta" }
  ]
}`;

// Kommentar (ej del av JSON:en): sista paret ovan är ett BILDPAR – "termImage"
// pekar på en färdig partisymbol och matchas mot partinamnet i "definition".
// Bildpar fungerar i vilket arbetsområde som helst; just nu finns
// partisymbol-nycklarna (se listan i schemat).

// Skalningsregler: mängden övningsinnehåll ska växa med hur mycket text läraren
// matar in, så att en lång text inte ger ett tunt övningsmaterial.
export const SKALA_QUIZ = `Anpassa ANTALET quizfrågor efter hur mycket text du fått:
- Kort text (ungefär 1 stycke): 5–6 frågor.
- Medellång text (ungefär en halv sida): 8–10 frågor.
- Lång text (ungefär en sida eller mer): 12–15 frågor.
- Är texten ännu längre? Fortsätt lägga till frågor i samma takt (ca 3–4 frågor per halvsida).
Täck HELA texten jämnt – ta med frågor från början, mitten och slutet, inte bara det första stycket.
Undvik upprepade frågor och triviala frågor.
Ge VARJE fråga ett "passage" (OBLIGATORISKT): bakgrundsinformation på 3–5 fullständiga meningar
hämtad ur materialet, där svaret på just den frågan framgår. Skriv en egen, passande passage per
fråga (inte bara en enda mening, och upprepa inte samma text ordagrant till alla frågor).
Själva frågan ska ändå gå att besvara med rätt ämneskunskap UTAN att läsa passagen – den visas
ofta utan passage (Quiz, Live). "Enligt texten", "i texten", "texten ovan" och liknande
hänvisningar till en text är FÖRBJUDNA i frågor och svarsalternativ.`;

export const SKALA_PAR_BAS = `Anpassa ANTALET fakta-par efter hur mycket text du fått:
- Kort text: minst 6 par.
- Medellång text: 8–10 par.
- Lång text (en sida eller mer): 12–15 par.
Välj de viktigaste begreppen från HELA texten, inte bara början. Undvik dubbletter.`;

// Bildpar-tillägget till par-instruktionen. Bryts ut så att buildAreaPrompt kan
// utelämna det (och uttryckligen förbjuda bildpar) när läraren inte kryssat i
// bildpar för området.
export const SKALA_PAR_BILDPAR = `BILDPAR (valfritt): passar temat en bild i det inbyggda paketet kan du göra ett bildpar –
sätt "termImage"/"defImage" till en bildnyckel (se listan i schemat) och matcha mot texten
på andra sidan. Exempel: en partisymbol matchas mot partinamnet. Hitta INTE på nya nycklar –
använd bara de som finns; passar ingen bild, gör vanliga text-par.`;

// Instruktion när området INTE ska ha bildpar (så AI:n inte hittar på sådana).
export const SKALA_PAR_INGA_BILDPAR = `Använd INGA bildpar i det här området – varje par ska ha ren text på båda sidorna. Sätt aldrig "termImage" eller "defImage".`;

export const SKALA_PAR = `${SKALA_PAR_BAS}\n${SKALA_PAR_BILDPAR}`;

export const SKALA_TEXTER = `Anpassa ANTALET faktatexter efter hur mycket material du fått:
- Kort text: 1–2 faktatexter.
- Medellång text: 2–3 faktatexter.
- Lång text (en sida eller mer): 3–5 faktatexter.
Dela upp innehållet i tydliga delämnen så att hela materialet täcks.`;

// Slut-blocket där läraren bifogar sitt material. Definieras EN gång så att
// materialBlock() kan använda det (eller ersätta det med ett önskemåls-block).
export const MATERIAL_ANCHOR = `Här är materialet du ska utgå ifrån:
<<< KLISTRA IN DIN LEKTIONSTEXT HÄR, eller bifoga en PDF >>>`;

export const REGLER = `Viktiga regler:
- Svara med ENBART giltig JSON – ingen förklarande text före eller efter, inga \`\`\`-kodstaket.
- Använd dubbla citattecken runt alla nycklar och strängar. Inga avslutande kommatecken.
- Skriv på svenska med korta meningar och enkla ord, anpassat till elevernas ålder (se årskursen ovan).
- Hitta INTE på fakta. Använd bara innehållet i det bifogade materialet / texten nedan.
- Varje quizfråga: exakt 4 svarsalternativ (alla olika och rimliga) och "answerIndex" 0-baserat
  som pekar på det rätta alternativet (0 = första). Dubbelkolla att rätt svar ligger på det indexet.
- Varje fråga ska gå att svara på fristående med ämneskunskap – hänvisa inte till andra frågor,
  till "texten" eller till passagen ("enligt texten" är förbjudet). Passagen är bara bakgrund.
- Håll texter lagom korta: "passage" 3–5 meningar, "explanation" 1–2 meningar, alternativ korta.
- Skriv INTE ledtrådar i själva frågan om vilket alternativ som är rätt.
- Ge varje quizfråga och varje par ett "category" (${KATEGORI_NYCKLAR}) och sprid kategorierna rimligt.`;

/**
 * Slut-blocket i en prompt: antingen platshållaren för bifogad PDF/text
 * (MATERIAL_ANCHOR, tomt önskemål) eller ett önskemåls-block när läraren skrivit
 * en beskrivning. Används av buildAreaPrompt (prompts.js).
 */
export function materialBlock(onskemal) {
  const text = (onskemal || "").trim();
  if (!text) return MATERIAL_ANCHOR;
  return `Lärarens önskemål (ingen text/PDF bifogas – utgå från beskrivningen nedan):
"${text}"
Skapa lämpligt, faktakorrekt och åldersanpassat innehåll för detta utifrån reglerna ovan. Eftersom inget material bifogas får du använda allmän, korrekt ämneskunskap om det efterfrågade ämnet. Hitta inte på felaktiga fakta.`;
}

/**
 * Bygg exempel-JSON:en till en områdes-prompt, anpassad efter valda typer, så
 * att exemplet inte visar innehåll AI:n inte ska skapa (t.ex. tomma listor för
 * bortvalda typer, och inget bildpar-exempel om bildpar inte valts).
 */
export function areaExample({ wantQuiz, wantPairs, wantImages }) {
  const texts = `  "texts": [
    {
      "id": "vem-var-vikingarna",
      "title": "Vilka var vikingarna?",
      "body": "Vikingarna levde i Norden för mer än tusen år sedan, ungefär mellan år 800 och 1050. De flesta var bönder, men de är mest kända för sina resor med snabba skepp."
    }
  ]`;
  const quiz = wantQuiz
    ? `  "quiz": [
    {
      "id": "q1",
      "question": "Ungefär när levde vikingarna?",
      "options": ["År 800–1050", "År 1500–1700", "År 0–200", "Idag"],
      "answerIndex": 0,
      "explanation": "Vikingatiden räknas från cirka år 800 till 1050.",
      "passage": "Vikingarna levde i Norden för mer än tusen år sedan. Tiden då de levde kallas för vikingatiden. Vikingatiden brukar räknas från ungefär år 800 till år 1050. Det var alltså mycket längre sedan än när dina far- och morföräldrar levde.",
      "category": "fakta"
    }
  ]`
    : `  "quiz": []`;
  let pairs = `  "pairs": []`;
  if (wantPairs) {
    const lines = [
      `    { "id": "p1", "term": "Oden", "definition": "Gudarnas kung, gud för visdom och krig", "category": "fakta" }`,
      `    { "id": "p2", "term": "Långskepp", "definition": "Vikingarnas långa, smala segelskepp", "category": "begrepp" }`,
    ];
    if (wantImages) {
      lines.push(`    { "id": "p3", "term": "", "termImage": "partier/s", "definition": "Socialdemokraterna", "category": "fakta" }`);
    }
    pairs = `  "pairs": [\n${lines.join(",\n")}\n  ]`;
  }
  return `{
  "id": "vikingatiden",
  "name": "Vikingatiden",
  "order": 1,
  "coverEmoji": "🛶",
  "description": "Lär dig om vikingarna – hur de levde, reste och trodde.",
${texts},
${quiz},
${pairs}
}`;
}
